import {
    LESSON_ANALYTICS_CATEGORY,
    LESSON_EVENTS,
    buildLessonEvent,
    createLessonAnalyticsMemo,
    lessonAnalyticsSnapshot,
    lessonEventIds,
    sendLessonEvent,
    stepLessonAnalytics,
} from '../../../../src/lib/lessons/lesson-analytics';

const closed = {
    courseId: null,
    lessonId: null,
    challengeId: null,
    fromAssignment: false,
    hintSession: 0,
    hintVisible: false,
    hintIndex: 0,
    justCompletedId: null,
    libraryVisible: false,
    libraryFocus: false,
};

const opened = (overrides = {}) => ({
    ...closed,
    courseId: 'kyou-kara-programmer',
    lessonId: 'blocks-l1',
    challengeId: 'blocks-l1-click-say',
    hintSession: 1,
    hintVisible: true,
    hintIndex: 0,
    ...overrides,
});

const ids = {
    course_id: 'kyou-kara-programmer',
    lesson_id: 'blocks-l1',
    challenge_id: 'blocks-l1-click-say',
    from_assignment: false,
};

// 状態の並びを時刻つきで流し、出たイベントを全部集める
const run = (steps) => {
    let memo = createLessonAnalyticsMemo();
    const events = [];
    for (const [snapshot, now] of steps) {
        const result = stepLessonAnalytics(memo, snapshot, now);
        memo = result.memo;
        events.push(...result.events);
    }
    return events;
};

const actions = (events) => events.map((e) => e.action);

describe('lesson analytics', () => {
    test('uses the lessons category for every event', () => {
        const events = run([
            [{ ...closed, libraryVisible: true }, 0],
            [opened(), 1000],
            [opened({ hintIndex: 1 }), 5000],
        ]);
        expect(events.length).toBeGreaterThan(0);
        events.forEach((e) => expect(e.category).toBe(LESSON_ANALYTICS_CATEGORY));
        expect(LESSON_ANALYTICS_CATEGORY).toBe('lessons');
    });

    test('sends library_open with menu / next when the lesson table opens', () => {
        expect(run([[{ ...closed, libraryVisible: true }, 0]])).toEqual([
            { category: 'lessons', action: LESSON_EVENTS.LIBRARY_OPEN, label: 'menu' },
        ]);
        const next = run([
            [opened({ hintVisible: false }), 0],
            [opened({ hintVisible: false, libraryVisible: true, libraryFocus: true }), 10],
        ]);
        expect(next[next.length - 1]).toEqual({ category: 'lessons', action: 'library_open', label: 'next' });
    });

    test('does not resend library_open while the table stays open', () => {
        const events = run([
            [{ ...closed, libraryVisible: true }, 0],
            [{ ...closed, libraryVisible: true }, 10],
        ]);
        expect(actions(events)).toEqual(['library_open']);
    });

    test('sends challenge_open with ids and from_assignment', () => {
        const events = run([[opened({ hintVisible: false }), 0]]);
        expect(events).toEqual([
            { category: 'lessons', action: 'challenge_open', label: 'blocks-l1-click-say', ...ids },
        ]);
        const fromAssignment = run([[opened({ hintVisible: false, fromAssignment: true }), 0]]);
        expect(fromAssignment[0].from_assignment).toBe(true);
    });

    test('sends challenge_open again when the same challenge is reopened', () => {
        const events = run([
            [opened({ hintVisible: false }), 0],
            [opened({ hintVisible: false, hintSession: 2 }), 1000],
        ]);
        expect(actions(events)).toEqual(['challenge_open', 'challenge_open']);
    });

    test('sends challenge_complete with seconds since the challenge opened', () => {
        const events = run([
            [opened({ hintVisible: false }), 1000],
            [opened({ hintVisible: false, justCompletedId: 'blocks-l1-click-say' }), 63400],
        ]);
        expect(events[1]).toEqual({
            category: 'lessons',
            action: 'challenge_complete',
            label: 'blocks-l1-click-say',
            ...ids,
            seconds: 62,
        });
    });

    test('sends challenge_complete again after the toast is dismissed and it is done again', () => {
        const done = { hintVisible: false, justCompletedId: 'blocks-l1-click-say' };
        const events = run([
            [opened({ hintVisible: false }), 0],
            [opened(done), 10000],
            [opened(done), 11000],
            [opened({ hintVisible: false }), 12000],
            [opened(done), 20000],
        ]);
        expect(actions(events)).toEqual(['challenge_open', 'challenge_complete', 'challenge_complete']);
        expect(events[2].seconds).toBe(20);
    });

    test('does not send challenge_complete for a challenge that is not open', () => {
        const events = run([
            [opened({ hintVisible: false }), 0],
            [opened({ hintVisible: false, justCompletedId: 'other' }), 1000],
        ]);
        expect(actions(events)).toEqual(['challenge_open']);
    });

    test('sends hint_view with page and dwell time when moving to the next page', () => {
        const events = run([
            [opened(), 0],
            [opened({ hintIndex: 1 }), 12400],
        ]);
        expect(events[1]).toEqual({
            category: 'lessons',
            action: 'hint_view',
            label: 'blocks-l1-click-say',
            ...ids,
            page: 1,
            seconds: 12,
        });
    });

    test('ends a hint page on prev, close, completion and closing the lesson', () => {
        const events = run([
            [opened(), 0],
            [opened({ hintIndex: 1 }), 1000], // page 1 (1s)
            [opened({ hintIndex: 0 }), 3000], // page 2 (2s)
            [opened({ hintIndex: 0, hintVisible: false }), 6000], // page 1 (3s) closed
            [opened({ hintIndex: 0 }), 10000], // reopen page 1
            [opened({ hintIndex: 0, hintVisible: false, justCompletedId: 'blocks-l1-click-say' }), 14000], // 4s
            [opened({ hintIndex: 0, justCompletedId: 'blocks-l1-click-say' }), 20000], // shown again
            [closed, 25000], // 5s closed lesson
        ]);
        const hints = events.filter((e) => e.action === 'hint_view').map((e) => [e.page, e.seconds]);
        expect(hints).toEqual([
            [1, 1],
            [2, 2],
            [1, 3],
            [1, 4],
            [1, 5],
        ]);
    });

    test('ends the hint page before the completion event', () => {
        const events = run([
            [opened(), 0],
            [opened({ hintVisible: false, justCompletedId: 'blocks-l1-click-say' }), 5000],
        ]);
        expect(actions(events)).toEqual(['challenge_open', 'hint_view', 'challenge_complete']);
    });

    test('ends the hint page when another challenge opens with the hint still shown', () => {
        const events = run([
            [opened({ hintIndex: 2 }), 0],
            [opened({ challengeId: 'blocks-l1-other', hintSession: 2, hintIndex: 0 }), 7000],
        ]);
        expect(actions(events)).toEqual(['challenge_open', 'hint_view', 'challenge_open']);
        expect(events[1]).toMatchObject({ challenge_id: 'blocks-l1-click-say', page: 3, seconds: 7 });
        expect(events[2]).toMatchObject({ challenge_id: 'blocks-l1-other' });
    });

    test('does not send anything when nothing changes', () => {
        let memo = createLessonAnalyticsMemo();
        memo = stepLessonAnalytics(memo, opened(), 0).memo;
        expect(stepLessonAnalytics(memo, opened(), 5000).events).toEqual([]);
    });

    test('never sends personal or class data', () => {
        const events = run([
            [{ ...closed, libraryVisible: true }, 0],
            [opened({ fromAssignment: true }), 10],
            [opened({ fromAssignment: true, hintIndex: 1 }), 20],
            [opened({ fromAssignment: true, hintVisible: false, justCompletedId: 'blocks-l1-click-say' }), 30],
        ]);
        const allowed = [
            'category',
            'action',
            'label',
            'course_id',
            'lesson_id',
            'challenge_id',
            'from_assignment',
            'page',
            'seconds',
        ];
        events.forEach((e) => Object.keys(e).forEach((k) => expect(allowed).toContain(k)));
    });

    test('lessonAnalyticsSnapshot reads the lesson mode and the lessons library modal', () => {
        const state = {
            scratchGui: {
                lessonMode: {
                    courseId: 'c',
                    lessonId: 'l',
                    challengeId: 'x',
                    fromAssignment: true,
                    hintSession: 3,
                    hintVisible: true,
                    hintIndex: 2,
                    justCompletedId: null,
                    libraryFocusChallengeId: 'x',
                    progress: { challenges: {} },
                },
                modals: { lessonsLibrary: true },
            },
        };
        expect(lessonAnalyticsSnapshot(state)).toEqual({
            courseId: 'c',
            lessonId: 'l',
            challengeId: 'x',
            fromAssignment: true,
            hintSession: 3,
            hintVisible: true,
            hintIndex: 2,
            justCompletedId: null,
            libraryVisible: true,
            libraryFocus: true,
        });
    });

    test('buildLessonEvent / lessonEventIds build a button event from the current challenge', () => {
        const current = {
            course: { id: 'kyou-kara-programmer' },
            lesson: { id: 'blocks-l1' },
            challenge: { id: 'blocks-l1-click-say' },
        };
        expect(buildLessonEvent(LESSON_EVENTS.LESSON_END, lessonEventIds(current, false))).toEqual({
            category: 'lessons',
            action: 'lesson_end',
            label: 'blocks-l1-click-say',
            ...ids,
        });
        expect(lessonEventIds(null, false)).toBeNull();
    });

    test('sendLessonEvent sends through the given sender and swallows failures', () => {
        const send = jest.fn();
        const current = { course: { id: 'c' }, lesson: { id: 'l' }, challenge: { id: 'x' } };
        sendLessonEvent(LESSON_EVENTS.ANSWER_VIEW, current, true, send);
        expect(send).toHaveBeenCalledWith({
            category: 'lessons',
            action: 'answer_view',
            label: 'x',
            course_id: 'c',
            lesson_id: 'l',
            challenge_id: 'x',
            from_assignment: true,
        });
        const failing = jest.fn(() => {
            throw new Error('no dataLayer');
        });
        expect(() => sendLessonEvent(LESSON_EVENTS.ANSWER_VIEW, current, false, failing)).not.toThrow();
        // チャレンジを開いていなければ送らない
        const none = jest.fn();
        sendLessonEvent(LESSON_EVENTS.LESSON_END, null, false, none);
        expect(none).not.toHaveBeenCalled();
    });
});
