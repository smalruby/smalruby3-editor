import { normalizeAssignmentLesson } from '../../../../src/lib/lessons/assignment-progress';
import {
    CONSENT_ANSWERS,
    LESSON_PROGRESS_CONSENT_STORAGE_KEY,
    MAX_CONSENTS,
    SEND_FAILURES,
    buildProgressPayload,
    classifySendFailure,
    confirmationItems,
    consentKey,
    currentChallengeOf,
    isCoveredBy,
    isSendableTimestamp,
    loadConsent,
    loadConsents,
    makeConsent,
    mergeAcked,
    needsConfirmation,
    saveConsent,
    unconsentedIds,
} from '../../../../src/lib/lessons/lesson-progress-sync';

const T1 = '2026-11-15T01:00:00.000Z';
const T2 = '2026-11-15T02:00:00.000Z';
const record = (completedAt = T1) => ({ completedAt, courseId: 'c', lessonId: 'l' });
const progressOf = (entries) => ({
    version: 1,
    challenges: Object.fromEntries(Object.entries(entries).map(([id, at]) => [id, record(at)])),
});

const lesson = normalizeAssignmentLesson({
    courseId: 'kyou-kara-programmer',
    challengeIds: ['a', 'b', 'c'],
    requiredChallengeIds: [],
    completion: { type: 'all' },
});

const FAKE_COURSES = [
    {
        id: 'kyou-kara-programmer',
        language: 'blocks',
        lessons: [
            {
                id: 'l',
                challenges: ['a', 'b', 'c'].map((id) => ({ id, name: { id: `name.${id}`, defaultMessage: id } })),
            },
        ],
    },
];

const memoryStorage = () => {
    const data = {};
    return {
        data,
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => {
            data[k] = String(v);
        },
    };
};

describe('consentKey', () => {
    test('should join the assignment, the seat and who joined (the join time)', () => {
        expect(consentKey('class-1', 7, { joinedAt: T1, sessionToken: 'tok' })).toBe(`class-1#7#j${T1}`);
    });

    test('should tell who joined by a short hash of the session token without the join time', () => {
        const key = consentKey('class-1', 7, { sessionToken: 'secret-token' });
        expect(key).toMatch(/^class-1#7#t[0-9a-f]{8}$/);
        expect(key).not.toContain('secret-token');
        expect(consentKey('class-1', 7, { sessionToken: 'other-token' })).not.toBe(key);
    });

    test('should be null without an assignment, a seat or who joined', () => {
        expect(consentKey(null, 7, { joinedAt: T1 })).toBeNull();
        expect(consentKey('class-1', null, { joinedAt: T1 })).toBeNull();
        expect(consentKey('class-1', '', { joinedAt: T1 })).toBeNull();
        expect(consentKey('class-1', 7)).toBeNull();
    });
});

describe('consents in storage', () => {
    test('should save and load an answer per assignment and seat', () => {
        const storage = memoryStorage();
        const consent = makeConsent(CONSENT_ANSWERS.MINE, ['b', 'a'], T1);
        expect(saveConsent('class-1#7', consent, storage)).toBe(true);
        expect(loadConsent('class-1#7', storage)).toEqual({ answer: 'mine', beforeIds: ['a', 'b'], decidedAt: T1 });
        expect(loadConsent('class-1#8', storage)).toBeNull();
    });

    test('should read broken or foreign values as nothing', () => {
        const storage = memoryStorage();
        storage.setItem(LESSON_PROGRESS_CONSENT_STORAGE_KEY, '{oops');
        expect(loadConsents(storage)).toEqual({});
        storage.setItem(
            LESSON_PROGRESS_CONSENT_STORAGE_KEY,
            JSON.stringify({ k1: { answer: 'maybe', beforeIds: [], decidedAt: T1 }, k2: 3 }),
        );
        expect(loadConsents(storage)).toEqual({});
    });

    test('should keep only the newest answers', () => {
        const storage = memoryStorage();
        for (let i = 0; i < MAX_CONSENTS + 2; i++) {
            const at = new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString();
            saveConsent(`c${i}#1`, makeConsent(CONSENT_ANSWERS.NONE, [], at), storage);
        }
        const consents = loadConsents(storage);
        expect(Object.keys(consents)).toHaveLength(MAX_CONSENTS);
        expect(consents['c0#1']).toBeUndefined();
        expect(consents[`c${MAX_CONSENTS + 1}#1`]).toBeDefined();
    });

    test('should not throw when storage is missing or full', () => {
        expect(saveConsent('k', makeConsent(CONSENT_ANSWERS.NONE, [], T1), null)).toBe(false);
        const full = {
            getItem: () => null,
            setItem: () => {
                throw new Error('quota');
            },
        };
        expect(saveConsent('k', makeConsent(CONSENT_ANSWERS.NONE, [], T1), full)).toBe(false);
        expect(loadConsent('k', null)).toBeNull();
    });
});

const T0 = '2026-11-15T00:30:00.000Z';
const T3 = '2026-11-15T03:00:00.000Z';
const recs = (entries) => Object.fromEntries(Object.entries(entries).map(([id, at]) => [id, { completedAt: at }]));

describe('makeConsent', () => {
    test('should make only the listed records "before", and only when they are mine', () => {
        expect(makeConsent(CONSENT_ANSWERS.MINE, ['b', 'a'], T2)).toEqual({
            answer: 'mine',
            beforeIds: ['a', 'b'],
            decidedAt: T2,
        });
        expect(makeConsent(CONSENT_ANSWERS.CLEARED, ['a'], T2).beforeIds).toEqual([]);
        expect(makeConsent(CONSENT_ANSWERS.NONE, [], T2).beforeIds).toEqual([]);
    });

    test('should keep the first answer time and add to "before" when asked again', () => {
        const first = makeConsent(CONSENT_ANSWERS.NONE, [], T1);
        expect(makeConsent(CONSENT_ANSWERS.MINE, ['c'], T3, first)).toEqual({
            answer: 'mine',
            beforeIds: ['c'],
            decidedAt: T1,
        });
        const mine = makeConsent(CONSENT_ANSWERS.MINE, ['a'], T1);
        expect(makeConsent(CONSENT_ANSWERS.MINE, ['c'], T3, mine).beforeIds).toEqual(['a', 'c']);
    });

    test('should move the answer time to the clearing time', () => {
        const mine = makeConsent(CONSENT_ANSWERS.MINE, ['a'], T1);
        expect(makeConsent(CONSENT_ANSWERS.CLEARED, [], T3, mine)).toEqual({
            answer: 'cleared',
            beforeIds: ['a'],
            decidedAt: T3,
        });
    });
});

describe('unconsentedIds', () => {
    test('should be every record before any answer', () => {
        expect(unconsentedIds(null, recs({ a: T1, b: T2 }))).toEqual(['a', 'b']);
    });

    test('should be the records done by the answer time that were not agreed to', () => {
        const consent = makeConsent(CONSENT_ANSWERS.MINE, ['a'], T2);
        // a: agreed, b: done at the answer time (not agreed), c: done after the answer
        expect(unconsentedIds(consent, recs({ a: T1, b: T2, c: T3 }))).toEqual(['b']);
    });

    test('should treat unreadable times as not agreed', () => {
        const consent = makeConsent(CONSENT_ANSWERS.NONE, [], T1);
        expect(unconsentedIds(consent, recs({ a: 'oops' }))).toEqual(['a']);
    });
});

describe('needsConfirmation', () => {
    test('should ask once when the device has records of the assignment', () => {
        expect(needsConfirmation(lesson, null, recs({ a: T1 }), FAKE_COURSES)).toBe(true);
    });

    test('should not ask without records', () => {
        expect(needsConfirmation(lesson, null, {}, FAKE_COURSES)).toBe(false);
    });

    test('should not ask again about agreed records or records made after the answer', () => {
        const answered = makeConsent(CONSENT_ANSWERS.MINE, ['a'], T1);
        expect(needsConfirmation(lesson, answered, recs({ a: T0, b: T2 }), FAKE_COURSES)).toBe(false);
    });

    test('should ask again about old records that come into the assignment later (none / mine)', () => {
        // the teacher adds challenge c after the answer; the device has an older record of it
        const none = makeConsent(CONSENT_ANSWERS.NONE, [], T2);
        expect(needsConfirmation(lesson, none, recs({ c: T1 }), FAKE_COURSES)).toBe(true);
        const mine = makeConsent(CONSENT_ANSWERS.MINE, ['a'], T2);
        expect(needsConfirmation(lesson, mine, recs({ a: T1, c: T1 }), FAKE_COURSES)).toBe(true);
    });

    test('should not ask after clearing (the old records are dropped silently)', () => {
        const cleared = makeConsent(CONSENT_ANSWERS.CLEARED, [], T2);
        expect(needsConfirmation(lesson, cleared, recs({ a: T1 }), FAKE_COURSES)).toBe(false);
    });

    test('should not ask about challenges this build does not know (they cannot be listed)', () => {
        const withUnknown = normalizeAssignmentLesson({
            courseId: 'kyou-kara-programmer',
            challengeIds: ['a', 'zz'],
        });
        expect(needsConfirmation(withUnknown, null, recs({ zz: T1 }), FAKE_COURSES)).toBe(false);
    });
});

describe('confirmationItems', () => {
    test('should list the records in the order of the assignment', () => {
        const items = confirmationItems(lesson, recs({ c: T2, a: T1 }), null, FAKE_COURSES);
        expect(items.map((i) => i.id)).toEqual(['a', 'c']);
        expect(items[0].name).toEqual({ id: 'name.a', defaultMessage: 'a' });
        expect(items[1].completedAt).toBe(T2);
    });

    test('should list only the records not agreed to yet when asked again', () => {
        const mine = makeConsent(CONSENT_ANSWERS.MINE, ['a'], T2);
        const items = confirmationItems(lesson, recs({ a: T1, b: T3, c: T1 }), mine, FAKE_COURSES);
        expect(items.map((i) => i.id)).toEqual(['c']);
    });

    test('should be empty without a lesson', () => {
        expect(confirmationItems(null, recs({ a: T1 }), null, FAKE_COURSES)).toEqual([]);
    });
});

describe('isSendableTimestamp', () => {
    test('should accept readable times from 2020 on', () => {
        expect(isSendableTimestamp(T1)).toBe(true);
        expect(isSendableTimestamp('2020-01-01T00:00:00.000Z')).toBe(true);
    });

    test('should reject unreadable or older times (the server answers 400)', () => {
        expect(isSendableTimestamp('2019-12-31T23:59:59.999Z')).toBe(false);
        expect(isSendableTimestamp('yesterday')).toBe(false);
        expect(isSendableTimestamp(null)).toBe(false);
    });
});

describe('currentChallengeOf', () => {
    test('should be the open challenge when it is in the assignment', () => {
        expect(currentChallengeOf(lesson, 'b', T1)).toEqual({ challengeId: 'b', openedAt: T1 });
    });

    test('should be null outside the assignment or when nothing is open', () => {
        expect(currentChallengeOf(lesson, 'z', T1)).toBeNull();
        expect(currentChallengeOf(lesson, null, null)).toBeNull();
        expect(currentChallengeOf(null, 'b', T1)).toBeNull();
        expect(currentChallengeOf(lesson, 'b', '2001-01-01T00:00:00.000Z')).toBeNull();
    });
});

describe('buildProgressPayload', () => {
    const progress = progressOf({ a: T1, b: T2, z: T1 });

    test('should send every record of the assignment, marking the ones from before', () => {
        const consent = makeConsent(CONSENT_ANSWERS.MINE, ['a'], T1);
        expect(buildProgressPayload(lesson, progress, consent, null)).toEqual({
            challenges: {
                a: { completedAt: T1, before: true },
                b: { completedAt: T2, before: false },
            },
        });
    });

    test('should add the open challenge as current', () => {
        const consent = makeConsent(CONSENT_ANSWERS.NONE, [], T1);
        const current = { challengeId: 'c', openedAt: T2 };
        expect(buildProgressPayload(lesson, progress, consent, current).current).toEqual(current);
    });

    test('should send nothing outside the assignment', () => {
        const payload = buildProgressPayload(lesson, progress, makeConsent(CONSENT_ANSWERS.NONE, [], T0), null);
        expect(payload.challenges.z).toBeUndefined();
    });

    test('should never send records done by the answer time that were not agreed to', () => {
        // b: done before the answer and not listed → not sent (none / mine / cleared alike)
        [CONSENT_ANSWERS.NONE, CONSENT_ANSWERS.MINE, CONSENT_ANSWERS.CLEARED].forEach((answer) => {
            const consent = makeConsent(answer, answer === CONSENT_ANSWERS.MINE ? ['a'] : [], T3);
            const payload = buildProgressPayload(lesson, progress, consent, null);
            expect(payload.challenges.b).toBeUndefined();
        });
    });

    test('should drop cleared records written back by another tab, but send newer ones', () => {
        const cleared = makeConsent(CONSENT_ANSWERS.CLEARED, [], T1);
        const payload = buildProgressPayload(lesson, progressOf({ a: T0, b: T2 }), cleared, null);
        expect(payload.challenges).toEqual({ b: { completedAt: T2, before: false } });
    });

    test('should drop records and current with times the server cannot take', () => {
        const consent = makeConsent(CONSENT_ANSWERS.NONE, [], '2000-01-01T00:00:00.000Z');
        const payload = buildProgressPayload(lesson, progressOf({ a: '2019-06-01T00:00:00.000Z', b: T2 }), consent, {
            challengeId: 'c',
            openedAt: 'broken',
        });
        expect(payload).toEqual({ challenges: { b: { completedAt: T2, before: false } } });
    });
});

describe('isCoveredBy / mergeAcked', () => {
    const payload = (ids, current) => ({
        challenges: Object.fromEntries(ids.map((id) => [id, { completedAt: T1, before: false }])),
        ...(current ? { current } : {}),
    });

    test('should send the first time', () => {
        expect(isCoveredBy(payload([]), null)).toBe(false);
    });

    test('should skip a send that adds nothing', () => {
        const acked = mergeAcked(null, payload(['a'], { challengeId: 'a', openedAt: T1 }));
        expect(isCoveredBy(payload(['a']), acked)).toBe(true);
        expect(isCoveredBy(payload(['a'], { challengeId: 'a', openedAt: T1 }), acked)).toBe(true);
    });

    test('should send a new record or a new current', () => {
        const acked = mergeAcked(null, payload(['a']));
        expect(isCoveredBy(payload(['a', 'b']), acked)).toBe(false);
        expect(isCoveredBy(payload(['a'], { challengeId: 'b', openedAt: T2 }), acked)).toBe(false);
    });

    test('should keep the last current when a later send has none', () => {
        const first = mergeAcked(null, payload(['a'], { challengeId: 'a', openedAt: T1 }));
        const second = mergeAcked(first, payload(['a', 'b']));
        expect(second.current).toEqual({ challengeId: 'a', openedAt: T1 });
        expect(Object.keys(second.challenges)).toEqual(['a', 'b']);
    });
});

describe('classifySendFailure', () => {
    test('should stop for an ended session or a missing assignment', () => {
        [401, 403, 404, 410].forEach((status) => {
            expect(classifySendFailure({ status })).toBe(SEND_FAILURES.STOP);
        });
    });

    test('should retry later for network errors, rate limits and server errors', () => {
        expect(classifySendFailure({ isNetworkError: true })).toBe(SEND_FAILURES.RETRY);
        [400, 409, 429, 500, 503].forEach((status) => {
            expect(classifySendFailure({ status })).toBe(SEND_FAILURES.RETRY);
        });
        expect(classifySendFailure(null)).toBe(SEND_FAILURES.RETRY);
    });
});
