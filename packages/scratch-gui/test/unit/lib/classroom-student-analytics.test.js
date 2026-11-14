/* eslint-env jest */
/**
 * 生徒の参加〜提出の流れの GA 計測 (#1831)。決まりは docs/classroom/ui-ux.md の「GA の計測」。
 */
import {
    CLASSROOM_STUDENT_CATEGORY,
    CLASSROOM_STUDENT_EVENTS,
    CLASSROOM_STUDENT_PARAM_KEYS,
    buildClassroomStudentEvent,
    joinCodeResult,
    modalCloseStep,
    seatViewParams,
    secondsSince,
    sendClassroomStudentEvent,
    submitOpenState,
    submitReminderGaEvent,
    welcomeMain,
} from '../../../src/lib/classroom-student-analytics.js';

describe('buildClassroomStudentEvent', () => {
    test('category は classroom_student、label は使わない', () => {
        const event = buildClassroomStudentEvent(CLASSROOM_STUDENT_EVENTS.JOIN_CODE, { result: 'ok' });
        expect(event.category).toBe('classroom_student');
        expect(CLASSROOM_STUDENT_CATEGORY).toBe('classroom_student');
        expect(event.action).toBe('join_code');
        expect(event.label).toBeUndefined();
        expect(event.result).toBe('ok');
    });

    test('いつも同じ項目を全部入れ、使わない項目は undefined にする', () => {
        const event = buildClassroomStudentEvent('seat_idle_guide');
        const keys = Object.keys(event).filter((k) => !['category', 'action', 'label'].includes(k));
        expect(keys.sort()).toEqual([...CLASSROOM_STUDENT_PARAM_KEYS].sort());
        keys.forEach((k) => expect(event[k]).toBeUndefined());
        expect(Object.prototype.hasOwnProperty.call(event, 'seconds')).toBe(true);
    });

    test('決めた項目のほかは送らない（クラス・席・ニックネーム・参加コードなどが混ざっても落とす）', () => {
        const event = buildClassroomStudentEvent('seat_select', {
            seconds: 3,
            seatNumber: 12,
            seat_number: 12,
            joinCode: 'abc123',
            className: '1組',
            nickname: 'たろう',
            memberId: 'm-1',
        });
        expect(event.seconds).toBe(3);
        ['seatNumber', 'seat_number', 'joinCode', 'className', 'nickname', 'memberId'].forEach((k) =>
            expect(event).not.toHaveProperty(k),
        );
    });

    test('値は文字列・数・真偽だけ（オブジェクトは落とす）', () => {
        const event = buildClassroomStudentEvent('start_view', { main: { id: 'x' }, others_count: 2 });
        expect(event.main).toBeUndefined();
        expect(event.others_count).toBe(2);
    });

    test('イベントの名前', () => {
        expect(Object.values(CLASSROOM_STUDENT_EVENTS).sort()).toEqual(
            [
                'join_code',
                'seat_view',
                'seat_idle_guide',
                'seat_select',
                'kick_request',
                'start_view',
                'start_choose',
                'welcome_view',
                'welcome_action',
                'submit_open',
                'submit_result',
                'leave_class',
                'session_end',
                'modal_close',
                'submit_reminder_shown',
                'submit_reminder_dismissed',
                'submit_reminder_submitted',
            ].sort(),
        );
    });
});

describe('sendClassroomStudentEvent', () => {
    test('送る', () => {
        const send = jest.fn();
        sendClassroomStudentEvent('leave_class', { result: 'confirm' }, { send });
        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0]).toMatchObject({ action: 'leave_class', result: 'confirm' });
    });

    test('先生がログイン中なら送らない', () => {
        const send = jest.fn();
        sendClassroomStudentEvent('leave_class', { result: 'confirm' }, { teacherLoggedIn: true, send });
        expect(send).not.toHaveBeenCalled();
    });

    test('送るのに失敗しても投げない', () => {
        const send = jest.fn(() => {
            throw new Error('gtm');
        });
        expect(() => sendClassroomStudentEvent('leave_class', {}, { send })).not.toThrow();
    });
});

describe('secondsSince', () => {
    test('四捨五入した秒', () => {
        expect(secondsSince(1000, 13600)).toBe(13);
        expect(secondsSince(1000, 14600)).toBe(14);
    });

    test('はじまりが無ければ undefined（送らない）', () => {
        expect(secondsSince(null, 5000)).toBeUndefined();
        expect(secondsSince(undefined, 5000)).toBeUndefined();
    });

    test('負にならない', () => {
        expect(secondsSince(5000, 1000)).toBe(0);
    });
});

describe('joinCodeResult', () => {
    test.each([
        [null, 'ok'],
        [{ status: 404 }, 'not_found'],
        [{ message: 'Invalid join code' }, 'not_found'],
        [{ status: 410 }, 'closed'],
        [{ status: 403, message: 'This assignment is no longer active' }, 'closed'],
        [{ isNetworkError: true }, 'error'],
        [{ status: 500 }, 'error'],
    ])('%o → %s', (err, expected) => {
        expect(joinCodeResult(err)).toBe(expected);
    });
});

describe('seatViewParams', () => {
    test('前回の番号が無い', () => {
        expect(seatViewParams(null, [1, 2])).toEqual({ previous_seat: false, previous_taken: false });
    });

    test('前回の番号があり空いている', () => {
        expect(seatViewParams(5, [1, 2])).toEqual({ previous_seat: true, previous_taken: false });
    });

    test('前回の番号が使用中（番号そのものは返さない）', () => {
        expect(seatViewParams(2, [1, 2])).toEqual({ previous_seat: true, previous_taken: true });
    });
});

describe('submitOpenState', () => {
    test.each([
        [null, 'first'],
        ['not_submitted', 'first'],
        ['submitted', 'resubmit'],
        ['returned', 'returned'],
    ])('%s → %s', (status, expected) => {
        expect(submitOpenState(status)).toBe(expected);
    });
});

describe('welcomeMain', () => {
    test.each([
        [{ mainIsLesson: true }, 'lesson'],
        [{ mainIsCurrent: true }, 'this_submission'],
        [{}, 'continue'],
    ])('%o → %s', (input, expected) => {
        expect(welcomeMain(input)).toBe(expected);
    });
});

describe('modalCloseStep', () => {
    test('帯の段', () => {
        expect(modalCloseStep({ phase: 'student-seat' })).toBe('seat');
        expect(modalCloseStep({ phase: 'student-submit-done' })).toBe('complete');
    });

    test('生徒の画面でなければ null', () => {
        expect(modalCloseStep({ phase: 'teacher-login' })).toBeNull();
    });
});

describe('submitReminderGaEvent', () => {
    test('はじめて出した（resumed でない）ものだけを「出した」として送る', () => {
        expect(submitReminderGaEvent({ type: 'shown', first: true, resumed: false, minutesSinceStart: 15 })).toEqual({
            action: 'submit_reminder_shown',
            params: { first: true, minutes: 15 },
        });
        expect(
            submitReminderGaEvent({ type: 'shown', first: false, resumed: true, minutesSinceStart: 20 }),
        ).toBeNull();
    });

    test('消した', () => {
        expect(submitReminderGaEvent({ type: 'dismissed', reason: 'close' })).toEqual({
            action: 'submit_reminder_dismissed',
            params: { reason: 'close' },
        });
    });

    test('出したあとで提出した', () => {
        expect(submitReminderGaEvent({ type: 'submitted_after_shown', minutesSinceShown: 3 })).toEqual({
            action: 'submit_reminder_submitted',
            params: { minutes: 3 },
        });
    });

    test('知らない出来事は送らない', () => {
        expect(submitReminderGaEvent({ type: 'other' })).toBeNull();
        expect(submitReminderGaEvent(null)).toBeNull();
    });
});
