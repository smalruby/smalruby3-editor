/* eslint-env jest */
/**
 * 生徒の画面の「進む順の帯」の状態 (#1792)。決まりは docs/classroom/ui-ux.md の
 * 「進む順の帯」の表。
 */
import { STUDENT_STEPS, studentCurrentStep, studentStepStates } from '../../../src/lib/classroom-student-steps.js';

const statesOf = (input) => studentStepStates(input).steps.map((s) => s.state);

describe('STUDENT_STEPS', () => {
    test('① 参加 → ② 番号 → ③ はじめる → ④ つくる → ⑤ 提出 の順', () => {
        expect(STUDENT_STEPS).toEqual(['join', 'seat', 'start', 'make', 'submit']);
    });
});

describe('studentCurrentStep', () => {
    test.each([
        ['student-join', {}, 'join'],
        ['student-seat', {}, 'seat'],
        ['student-joined', {}, 'start'],
        ['student-assignment', {}, 'start'],
        ['student-assignment', { assignmentReopened: true }, 'make'],
        ['student-status', {}, 'make'],
        ['student-status', { submissionStatus: 'not_submitted' }, 'make'],
        ['student-submit-confirm', {}, 'submit'],
        ['student-submit-confirm', { submissionStatus: 'submitted' }, 'submit'],
    ])('%s %o → %s', (phase, extra, expected) => {
        expect(studentCurrentStep({ phase, ...extra })).toBe(expected);
    });

    test.each([
        ['student-status', 'submitted'],
        ['student-status', 'returned'],
        ['student-assignment', 'submitted'],
        ['student-assignment', 'returned'],
    ])('%s で %s なら全部すんだ (complete)', (phase, submissionStatus) => {
        expect(studentCurrentStep({ phase, submissionStatus, assignmentReopened: true })).toBe('complete');
    });

    test('参加完了は提出済みでも ③ はじめる', () => {
        expect(studentCurrentStep({ phase: 'student-joined', submissionStatus: 'submitted' })).toBe('start');
    });

    test('作品を提出しないレッスンの課題は、課題クリアで全部すんだ', () => {
        const lesson = { submitWork: false, cleared: true };
        expect(studentCurrentStep({ phase: 'student-status', lesson })).toBe('complete');
        expect(studentCurrentStep({ phase: 'student-status', lesson: { ...lesson, cleared: false } })).toBe('make');
    });

    test('作品も提出するレッスンの課題は、課題クリアだけではすまない', () => {
        expect(studentCurrentStep({ phase: 'student-status', lesson: { submitWork: true, cleared: true } })).toBe(
            'make',
        );
    });

    test('生徒の画面でなければ null (帯を出さない)', () => {
        expect(studentCurrentStep({ phase: 'teacher-login' })).toBeNull();
        expect(studentCurrentStep({})).toBeNull();
    });
});

describe('studentStepStates', () => {
    test('参加コード入力: ① がいま、ほかはまだ', () => {
        expect(statesOf({ phase: 'student-join' })).toEqual(['now', 'todo', 'todo', 'todo', 'todo']);
    });

    test('出席番号選択: ① すんだ、② いま', () => {
        expect(statesOf({ phase: 'student-seat' })).toEqual(['done', 'now', 'todo', 'todo', 'todo']);
    });

    test('参加完了: ①② すんだ、③ いま', () => {
        expect(statesOf({ phase: 'student-joined' })).toEqual(['done', 'done', 'now', 'todo', 'todo']);
    });

    test('おかえりなさい (未提出): ①②③ すんだ、④ いま', () => {
        expect(statesOf({ phase: 'student-status' })).toEqual(['done', 'done', 'done', 'now', 'todo']);
    });

    test('提出確認: ①〜④ すんだ、⑤ いま', () => {
        expect(statesOf({ phase: 'student-submit-confirm' })).toEqual(['done', 'done', 'done', 'done', 'now']);
    });

    test('提出済み・返却済み: 全部すんだ、complete', () => {
        const result = studentStepStates({ phase: 'student-status', submissionStatus: 'returned' });
        expect(result.complete).toBe(true);
        expect(result.steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done', 'done']);
    });

    test('いまの段があるときは complete でない', () => {
        expect(studentStepStates({ phase: 'student-seat' }).complete).toBe(false);
    });

    test('段の名前を順に返す', () => {
        expect(studentStepStates({ phase: 'student-join' }).steps.map((s) => s.step)).toEqual(STUDENT_STEPS);
    });

    test('生徒の画面でなければ null', () => {
        expect(studentStepStates({ phase: 'teacher-login' })).toBeNull();
    });
});
