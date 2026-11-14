/* eslint-env jest */
/**
 * メニューバーの「提出する」ボタン (#1795)。決まりは docs/classroom/ui-ux.md の「メニューバー」。
 */
import { isResubmit, menuSubmitKind, submissionFromVerify } from '../../../src/lib/classroom-menu-submit.js';

const lesson = (submitWork) => ({ submitWork, challengeIds: ['a'], requiredChallengeIds: [] });
const notCleared = { cleared: false, unknownCount: 0 };
const cleared = { cleared: true, unknownCount: 0 };

describe('menuSubmitKind', () => {
    test('参加していなければ出さない', () => {
        expect(menuSubmitKind({ joined: false })).toBeNull();
        expect(menuSubmitKind({ joined: false, submissionStatus: 'submitted' })).toBeNull();
    });

    test.each([
        [null, 'submit'],
        ['not_submitted', 'submit'],
        ['submitted', 'submitted'],
        ['returned', 'returned'],
    ])('ふつうの課題で提出状況が %s なら %s', (submissionStatus, expected) => {
        expect(menuSubmitKind({ joined: true, submissionStatus })).toBe(expected);
    });

    test('作品を提出しないレッスンの課題では出さない (課題クリアでも)', () => {
        expect(menuSubmitKind({ joined: true, lesson: lesson(false), lessonStatus: cleared })).toBeNull();
        expect(menuSubmitKind({ joined: true, lesson: lesson(false), lessonStatus: notCleared })).toBeNull();
    });

    test('作品も提出するレッスンの課題は、条件を満たすまで出さず、満たしたら「提出する」', () => {
        expect(menuSubmitKind({ joined: true, lesson: lesson(true), lessonStatus: notCleared })).toBeNull();
        expect(menuSubmitKind({ joined: true, lesson: lesson(true), lessonStatus: cleared })).toBe('submit');
    });

    test('この版に無いチャレンジがあるときは、提出できるよう「提出する」を出す', () => {
        const status = { cleared: false, unknownCount: 1 };
        expect(menuSubmitKind({ joined: true, lesson: lesson(true), lessonStatus: status })).toBe('submit');
    });

    test('作品も提出するレッスンの課題で一度出したら、進み具合にかかわらず「提出済み」「返却済み」', () => {
        const base = { joined: true, lesson: lesson(true), lessonStatus: notCleared };
        expect(menuSubmitKind({ ...base, submissionStatus: 'submitted' })).toBe('submitted');
        expect(menuSubmitKind({ ...base, submissionStatus: 'returned' })).toBe('returned');
    });
});

describe('isResubmit', () => {
    test.each([
        [null, false],
        ['not_submitted', false],
        ['submitted', true],
        ['returned', true],
    ])('%s → %s', (status, expected) => {
        expect(isResubmit(status)).toBe(expected);
    });
});

describe('submissionFromVerify', () => {
    test('返却済み: 状態・時刻・先生のコメントを読む', () => {
        const result = { submission: { status: 'returned', submittedAt: 't1', teacherComment: 'よい' } };
        expect(submissionFromVerify(result)).toEqual({
            status: 'returned',
            submittedAt: 't1',
            teacherComment: 'よい',
        });
    });

    test('別の PC で出した: 提出済み', () => {
        expect(submissionFromVerify({ submission: { status: 'submitted', submittedAt: 't2' } })).toEqual({
            status: 'submitted',
            submittedAt: 't2',
            teacherComment: null,
        });
    });

    test('まだ出していない (submission: null): 状態を null に戻す', () => {
        expect(submissionFromVerify({ valid: true, submission: null })).toEqual({
            status: null,
            submittedAt: null,
            teacherComment: null,
        });
    });

    test('submission の無い応答は、いまの状態を変えない (null)', () => {
        expect(submissionFromVerify({ valid: true })).toBeNull();
        expect(submissionFromVerify(null)).toBeNull();
    });
});
