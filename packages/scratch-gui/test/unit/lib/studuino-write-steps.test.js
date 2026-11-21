import { progressMarks, STEP, stepAfterCheck, writePercent } from '../../../src/lib/studuino-write-steps';

describe('stepAfterCheck', () => {
    test('検査が通れば hex を作る段階へ', () => {
        expect(stepAfterCheck({ ok: true, ir: { a: 1 } })).toEqual({ step: STEP.COMPILING, ir: { a: 1 } });
    });

    test('使えないブロック・旗が無いことを分ける', () => {
        const r = stepAfterCheck({
            ok: false,
            errors: [
                { blockId: null, reason: 'no_flag' },
                { blockId: 'b1', targetId: 't', reason: 'unsupported_block' },
            ],
        });
        expect(r).toEqual({
            step: STEP.CHECK_FAILED,
            blocks: [{ blockId: 'b1', targetId: 't', reason: 'unsupported_block' }],
            noFlag: true,
            tooLarge: false,
        });
    });
});

test('writePercent', () => {
    expect(writePercent(0, 100)).toBe(0);
    expect(writePercent(50, 200)).toBe(25);
    expect(writePercent(300, 200)).toBe(100);
    expect(writePercent(1, 0)).toBe(0);
});

test('progressMarks', () => {
    expect(progressMarks(STEP.CHECKING)).toEqual({ check: 'doing', compile: 'todo', write: 'todo' });
    expect(progressMarks(STEP.COMPILE_FAILED)).toEqual({ check: 'done', compile: 'failed', write: 'todo' });
    expect(progressMarks(STEP.WRITING)).toEqual({ check: 'done', compile: 'done', write: 'doing' });
    expect(progressMarks(STEP.DONE)).toEqual({ check: 'done', compile: 'done', write: 'done' });
});
