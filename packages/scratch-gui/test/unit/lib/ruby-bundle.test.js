import {
    generateTargetCode,
    getRubyBundle,
    loadRubyBundle,
    requireRubyBundle,
    resetRubyBundleForTest,
    targetCodeToBlocks,
    whenIdle,
} from '../../../src/lib/ruby-bundle';

const fakeBundle = () => ({
    RubyGenerator: { targetToCode: (target, options) => `code of ${target.id} v${options.version}` },
});

describe('ruby-bundle', () => {
    afterEach(() => {
        resetRubyBundleForTest();
    });

    test('should read the bundle once and share the reading', async () => {
        const loaded = fakeBundle();
        const importer = jest.fn(() => Promise.resolve(loaded));
        const [a, b] = await Promise.all([loadRubyBundle({ importer }), loadRubyBundle({ importer })]);
        expect(a).toBe(loaded);
        expect(b).toBe(loaded);
        expect(importer).toHaveBeenCalledTimes(1);
        expect(getRubyBundle()).toBe(loaded);
        expect(await loadRubyBundle({ importer })).toBe(loaded);
        expect(importer).toHaveBeenCalledTimes(1);
    });

    test('should try again when a reading fails', async () => {
        const loaded = fakeBundle();
        const importer = jest.fn().mockRejectedValueOnce(new Error('ChunkLoadError')).mockResolvedValueOnce(loaded);
        expect(await loadRubyBundle({ importer, retryDelays: [0, 0] })).toBe(loaded);
        expect(importer).toHaveBeenCalledTimes(2);
    });

    test('should reject after every attempt failed, and start over on the next call', async () => {
        const importer = jest.fn().mockRejectedValue(new Error('ChunkLoadError'));
        await expect(loadRubyBundle({ importer, retryDelays: [0, 0] })).rejects.toThrow('ChunkLoadError');
        expect(importer).toHaveBeenCalledTimes(3);
        expect(getRubyBundle()).toBeNull();

        const loaded = fakeBundle();
        expect(await loadRubyBundle({ importer: () => Promise.resolve(loaded), retryDelays: [] })).toBe(loaded);
    });

    test('should generate code only after the bundle is read', async () => {
        const target = { id: 'cat' };
        expect(generateTargetCode(target, { version: '2' })).toBe('');
        expect(() => requireRubyBundle()).toThrow('not loaded');
        await loadRubyBundle({ importer: () => Promise.resolve(fakeBundle()) });
        expect(generateTargetCode(target, { version: '2' })).toBe('code of cat v2');
        expect(requireRubyBundle().RubyGenerator).toBeDefined();
    });

    test('should call the converter directly once the bundle is read (same promise, same timing)', async () => {
        const result = Promise.resolve({ result: true });
        const convert = jest.fn(() => result);
        await loadRubyBundle({ importer: () => Promise.resolve({ targetCodeToBlocks: convert }) });
        expect(targetCodeToBlocks('vm', 'target', 'code')).toBe(result);
        expect(convert).toHaveBeenCalledWith('vm', 'target', 'code');
    });

    test('should read the bundle before converting when it is not read yet', async () => {
        const convert = jest.fn(() => Promise.resolve({ result: true }));
        const pending = loadRubyBundle({ importer: () => Promise.resolve({ targetCodeToBlocks: convert }) });
        const converted = targetCodeToBlocks('vm', 'target', 'code');
        await pending;
        expect(await converted).toEqual({ result: true });
    });

    test('should run in an idle moment when the browser has requestIdleCallback', () => {
        const win = { requestIdleCallback: jest.fn() };
        const callback = jest.fn();
        whenIdle(callback, win);
        expect(win.requestIdleCallback).toHaveBeenCalledWith(callback, { timeout: 5000 });
    });

    test('should fall back to a timer without requestIdleCallback', () => {
        jest.useFakeTimers();
        try {
            const callback = jest.fn();
            whenIdle(callback, {});
            expect(callback).not.toHaveBeenCalled();
            jest.advanceTimersByTime(2000);
            expect(callback).toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    test('should read the real bundle with the generator, the converter and the Ruby tab', async () => {
        const loaded = await loadRubyBundle();
        expect(typeof loaded.RubyGenerator.targetToCode).toBe('function');
        expect(typeof loaded.targetCodeToBlocks).toBe('function');
        expect(typeof loaded.RubyToBlocksConverter).toBe('function');
        expect(typeof loaded.generateProjectCode).toBe('function');
        expect(typeof loaded.loadPrism).toBe('function');
        expect(loaded.RubyTab).toBeDefined();
    }, 60000);
});
