import {
    describeEvalResult,
    describeEvalRunning,
    evalRunningLabelMessages,
    evalStatusMessages,
    runningStepOf,
} from '../../../src/lib/classroom-evaluation/eval-status.js';
import ja from '../../../src/locales/ja.js';

// The Japanese words, filled the way react-intl does for simple {name} values.
const toJa = (described) =>
    ja[described.message.id].replace(/\{(\w+)\}/g, (all, key) =>
        key in described.values ? String(described.values[key]) : all,
    );

describe('describeEvalRunning', () => {
    test('nothing runs: null', () => {
        expect(describeEvalRunning({ progress: null })).toBeNull();
    });

    test('loading before the list is read: the assignment only, no bar', () => {
        const described = describeEvalRunning({
            progress: { kind: 'load', assignmentName: '02_LED', done: 0, total: null },
        });
        expect(described.message).toBe(evalStatusMessages.load);
        expect(described.ratio).toBeNull();
        expect(toJa(described)).toBe('02_LED の提出を読み込んでいます');
    });

    test('loading the submissions: the count and the bar', () => {
        const described = describeEvalRunning({
            progress: { kind: 'load', assignmentName: '02_LED', done: 3, total: 28 },
        });
        expect(toJa(described)).toBe('02_LED の提出を読み込んでいます（3/28）');
        expect(described.ratio).toBeCloseTo(3 / 28);
    });

    test('loading the lesson progress', () => {
        const described = describeEvalRunning({ progress: { kind: 'loadProgress', assignmentName: '01_はじめ' } });
        expect(toJa(described)).toBe('01_はじめ の進み具合を読み込んでいます');
        expect(described.ratio).toBeNull();
    });

    test('the AI grading: seats from–to of total, the bar counts the seats before', () => {
        const described = describeEvalRunning({
            progress: { kind: 'grade', assignmentName: '04_モーター', from: 11, to: 20, total: 28 },
        });
        expect(toJa(described)).toBe('AI が 04_モーター を採点しています（11〜20 人目 / 28）');
        expect(described.ratio).toBeCloseTo(10 / 28);
    });

    test('the AI comment drafts', () => {
        const described = describeEvalRunning({
            progress: { kind: 'comment', assignmentName: '04_モーター', from: 1, to: 10, total: 28 },
        });
        expect(toJa(described)).toBe('AI が 04_モーター のコメントを下書きしています（1〜10 人目 / 28）');
        expect(described.ratio).toBe(0);
    });

    test('returning: the one being returned now', () => {
        const described = describeEvalRunning({ progress: { kind: 'return', done: 4, total: 28 } });
        expect(toJa(described)).toBe('コメントを返却しています（5/28）');
        expect(described.ratio).toBeCloseTo(4 / 28);
    });

    test('opening a work and saving the points use the same form', () => {
        expect(toJa(describeEvalRunning({ progress: null, openingWork: true }))).toBe('作品を開いています');
        const saving = describeEvalRunning({ progress: null, savingName: '01_はじめ' });
        expect(toJa(saving)).toBe('01_はじめ のレッスンの点を保存しています');
        expect(saving.ratio).toBeNull();
    });

    test('a step run comes before opening a work', () => {
        const described = describeEvalRunning({ progress: { kind: 'return', done: 0, total: 2 }, openingWork: true });
        expect(described.message).toBe(evalStatusMessages.return);
    });
});

describe('describeEvalResult', () => {
    test('nothing: null', () => {
        expect(describeEvalResult(null)).toBeNull();
        expect(describeEvalResult({ kind: 'unknown' })).toBeNull();
    });

    test('loaded submissions', () => {
        expect(toJa(describeEvalResult({ kind: 'load', count: 28, lessons: 1 }))).toBe('28 件の提出を読み込みました');
    });

    test('no submission yet and no lesson: 0 submissions', () => {
        expect(toJa(describeEvalResult({ kind: 'load', count: 0, lessons: 0 }))).toBe('0 件の提出を読み込みました');
    });

    test('loaded only lesson progress', () => {
        expect(toJa(describeEvalResult({ kind: 'load', count: 0, lessons: 2 }))).toBe(
            '2 件の課題の進み具合を読み込みました',
        );
    });

    test('works of the same shape got different grades: ask to check them', () => {
        const described = describeEvalResult({ kind: 'grade', count: 35, inconsistent: 7 });
        expect(described.failed).toBe(false);
        expect(toJa(described)).toBe(
            'AI が 35 件を採点しました。同じ形なのに評価が違う作品が 7 件あります（要確認）',
        );
        expect(toJa(describeEvalResult({ kind: 'grade', count: 35, inconsistent: 0 }))).toBe(
            'AI が 35 件を採点しました',
        );
    });

    test('the AI and the return', () => {
        expect(toJa(describeEvalResult({ kind: 'grade', count: 28 }))).toBe('AI が 28 件を採点しました');
        expect(toJa(describeEvalResult({ kind: 'comment', count: 27 }))).toBe(
            'AI が 27 件のコメントを下書きしました',
        );
        expect(toJa(describeEvalResult({ kind: 'return', count: 5 }))).toBe('5 件のコメントを返却しました');
    });

    test('failures say what failed', () => {
        const failed = describeEvalResult({ kind: 'return', failed: true, done: 5, total: 28 });
        expect(failed.failed).toBe(true);
        expect(toJa(failed)).toBe('コメントの返却が途中で止まりました（28 件のうち 5 件を返却済み）');
        expect(toJa(describeEvalResult({ kind: 'load', failed: true }))).toBe('提出を読み込めませんでした');
        expect(toJa(describeEvalResult({ kind: 'grade', failed: true }))).toBe('AI の採点が途中で止まりました');
        expect(toJa(describeEvalResult({ kind: 'comment', failed: true }))).toBe(
            'AI のコメントの下書きが途中で止まりました',
        );
    });
});

describe('runningStepOf', () => {
    test('maps each kind to its step button', () => {
        expect(runningStepOf(null)).toBeNull();
        expect(runningStepOf({ kind: 'loadProgress' })).toEqual({
            step: 'load',
            label: evalRunningLabelMessages.load,
        });
        expect(runningStepOf({ kind: 'grade' }).step).toBe('grade');
        expect(runningStepOf({ kind: 'comment' }).step).toBe('comment');
        expect(runningStepOf({ kind: 'return' }).step).toBe('return');
    });
});

describe('locales', () => {
    test('every message is in en, ja and ja-Hira', () => {
        /* eslint-disable global-require */
        const en = require('../../../src/locales/en.js').default;
        const jaHira = require('../../../src/locales/ja-Hira.js').default;
        /* eslint-enable global-require */
        const ids = [...Object.values(evalStatusMessages), ...Object.values(evalRunningLabelMessages)].map(
            (m) => m.id,
        );
        for (const id of ids) {
            expect([id, typeof en[id], typeof ja[id], typeof jaHira[id]]).toEqual([id, 'string', 'string', 'string']);
        }
    });
});

describe('採点簿の読み込みと確定 (#2424)', () => {
    test('採点簿は件数とバー、確定は課題の名前', () => {
        expect(describeEvalRunning({ progress: { kind: 'gradebook', done: 1, total: 4 } })).toEqual({
            message: evalStatusMessages.gradebook,
            values: { done: 1, total: 4 },
            ratio: 0.25,
        });
        expect(describeEvalRunning({ progress: { kind: 'confirm', assignmentName: '迷路' } })).toEqual({
            message: evalStatusMessages.confirm,
            values: { name: '迷路' },
            ratio: null,
        });
    });

    test('確定はボタンにスピナー、採点簿の読み込みはどのボタンでもない', () => {
        expect(runningStepOf({ kind: 'confirm' }).step).toBe('confirm');
        expect(runningStepOf({ kind: 'gradebook', done: 0, total: 1 })).toBeNull();
    });

    test('確定の結果', () => {
        expect(describeEvalResult({ kind: 'confirm', count: 3 })).toEqual({
            message: evalStatusMessages.confirmDone,
            values: { count: 3 },
            failed: false,
        });
        expect(describeEvalResult({ kind: 'confirm', failed: true }).message).toBe(evalStatusMessages.confirmFailed);
    });
});
