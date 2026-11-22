import { compileStuduinoIr, studuinoCompileErrorMessageId } from '../../../src/lib/studuino-compile';

const response = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
});

describe('compileStuduinoIr', () => {
    const ir = { version: 1, board: 'studuino', ports: {}, main: [] };

    test('POST <endpoint>/compile に { ir } を送り、hex と C++ を返す', async () => {
        const fetch = jest.fn(() =>
            Promise.resolve(
                response(200, { hex: ':00000001FF\n', source: 'void setup(){}', size: 10, maxSize: 15872 }),
            ),
        );
        const result = await compileStuduinoIr(ir, { endpoint: 'https://api.example/', fetch });
        expect(fetch).toHaveBeenCalledWith(
            'https://api.example/compile',
            expect.objectContaining({ method: 'POST' }),
        );
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ ir });
        expect(result).toEqual({
            ok: true,
            hex: ':00000001FF\n',
            source: 'void setup(){}',
            size: 10,
            maxSize: 15872,
            toolchain: null,
        });
    });

    test('失敗の error・reason・retryAfter を返す', async () => {
        const fetch = () => Promise.resolve(response(429, { error: 'rate_limited', message: 'x', retryAfter: 30 }));
        expect(await compileStuduinoIr(ir, { endpoint: 'https://a', fetch })).toEqual({
            ok: false,
            error: 'rate_limited',
            reason: null,
            retryAfter: 30,
        });
    });

    test('場所が無い・つながらない・中断', async () => {
        expect(await compileStuduinoIr(ir, { endpoint: '', fetch: jest.fn() })).toEqual({
            ok: false,
            error: 'not_configured',
        });
        expect(
            await compileStuduinoIr(ir, { endpoint: 'https://a', fetch: () => Promise.reject(new Error('x')) }),
        ).toEqual({ ok: false, error: 'network' });
        const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
        expect(await compileStuduinoIr(ir, { endpoint: 'https://a', fetch: () => Promise.reject(abort) })).toEqual({
            ok: false,
            error: 'aborted',
        });
    });

    test('JSON でない応答は internal', async () => {
        const fetch = () => Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error('x')) });
        expect((await compileStuduinoIr(ir, { endpoint: 'https://a', fetch })).error).toBe('internal');
    });
});

describe('studuinoCompileErrorMessageId', () => {
    test.each([
        [{ error: 'compile_failed', reason: 'flash_overflow' }, 'gui.studuinoWrite.error.flashOverflow'],
        [{ error: 'compile_failed', reason: 'compile_failed' }, 'gui.studuinoWrite.error.compileFailed'],
        [{ error: 'rate_limited' }, 'gui.studuinoWrite.error.rateLimited'],
        [{ error: 'too_large' }, 'gui.studuinoWrite.error.tooLarge'],
        [{ error: 'timeout' }, 'gui.studuinoWrite.error.timeout'],
        [{ error: 'not_configured' }, 'gui.studuinoWrite.error.notConfigured'],
        [{ error: 'something' }, 'gui.studuinoWrite.error.internal'],
    ])('%j → %s', (failure, id) => expect(studuinoCompileErrorMessageId(failure)).toBe(id));
});
