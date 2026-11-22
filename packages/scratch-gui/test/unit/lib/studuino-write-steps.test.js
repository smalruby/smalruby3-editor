import {
    NOTICE_KIND,
    progressMarks,
    STEP,
    stepAfterCheck,
    writeNotices,
    writePercent,
} from '../../../src/lib/studuino-write-steps';

describe('stepAfterCheck', () => {
    test('検査が通れば hex を作る段階へ', () => {
        expect(stepAfterCheck({ ok: true, ir: { a: 1 } })).toEqual({
            step: STEP.COMPILING,
            ir: { a: 1 },
            notices: [],
        });
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
            notices: [{ kind: 'stop', reason: 'unsupported_block', blockId: 'b1', targetId: 't' }],
        });
    });
});

describe('writeNotices（#2353: 警告と止めた理由の一覧）', () => {
    test('検査が通って警告が無ければ空', () => {
        expect(writeNotices({ ok: true, ir: {}, warnings: [] })).toEqual([]);
    });

    test('検査が通っても、はじめの値が文字の変数は警告にする（書きこみは止めない）', () => {
        expect(
            writeNotices({
                ok: true,
                ir: {},
                warnings: [{ blockId: 'b1', targetId: 's', reason: 'string_initial_value', variable: 'y' }],
            }),
        ).toEqual([
            {
                kind: NOTICE_KIND.WARNING,
                reason: 'string_initial_value',
                blockId: 'b1',
                targetId: 's',
                variable: 'y',
            },
        ]);
    });

    test('旗が 2 つ以上なら、使われる旗と使われない旗を並べ、止めた理由を先に出す', () => {
        const notices = writeNotices({
            ok: false,
            usedFlag: { blockId: 'f1', targetId: 'stage' },
            errors: [
                { blockId: 'x', targetId: 's', reason: 'string_value' },
                { blockId: 'f2', targetId: 's', reason: 'too_many_flags' },
                { blockId: 'f3', targetId: 't', reason: 'too_many_flags' },
            ],
            warnings: [{ blockId: 'b1', targetId: 's', reason: 'string_initial_value', variable: 'y' }],
        });
        expect(notices.map((n) => [n.kind, n.reason, n.blockId])).toEqual([
            ['info', 'used_flag', 'f1'],
            ['stop', 'unused_flag', 'f2'],
            ['stop', 'unused_flag', 'f3'],
            ['stop', 'string_value', 'x'],
            ['warning', 'string_initial_value', 'b1'],
        ]);
    });

    test('ブロックに結びつかないエラー（旗が無い）は一覧に出さず、同じブロックは 1 回だけ', () => {
        const notices = writeNotices({
            ok: false,
            errors: [
                { blockId: null, targetId: null, reason: 'no_flag' },
                { blockId: 'b', targetId: 's', reason: 'unsupported_block' },
                { blockId: 'b', targetId: 's', reason: 'string_value' },
            ],
        });
        expect(notices).toEqual([{ kind: 'stop', reason: 'unsupported_block', blockId: 'b', targetId: 's' }]);
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
