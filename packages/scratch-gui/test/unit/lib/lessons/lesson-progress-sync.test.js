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
    loadConsent,
    loadConsents,
    makeConsent,
    mergeAcked,
    needsConfirmation,
    saveConsent,
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
    test('should join the assignment and the seat', () => {
        expect(consentKey('class-1', 7)).toBe('class-1#7');
    });

    test('should be null without an assignment or a seat', () => {
        expect(consentKey(null, 7)).toBeNull();
        expect(consentKey('class-1', null)).toBeNull();
        expect(consentKey('class-1', '')).toBeNull();
    });
});

describe('consents in storage', () => {
    test('should save and load an answer per assignment and seat', () => {
        const storage = memoryStorage();
        const consent = makeConsent(CONSENT_ANSWERS.MINE, { b: {}, a: {} }, T1);
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
            saveConsent(`c${i}#1`, makeConsent(CONSENT_ANSWERS.NONE, {}, at), storage);
        }
        const consents = loadConsents(storage);
        expect(Object.keys(consents)).toHaveLength(MAX_CONSENTS);
        expect(consents['c0#1']).toBeUndefined();
        expect(consents[`c${MAX_CONSENTS + 1}#1`]).toBeDefined();
    });

    test('should not throw when storage is missing or full', () => {
        expect(saveConsent('k', makeConsent(CONSENT_ANSWERS.NONE, {}, T1), null)).toBe(false);
        const full = {
            getItem: () => null,
            setItem: () => {
                throw new Error('quota');
            },
        };
        expect(saveConsent('k', makeConsent(CONSENT_ANSWERS.NONE, {}, T1), full)).toBe(false);
        expect(loadConsent('k', null)).toBeNull();
    });
});

describe('makeConsent', () => {
    test('should make the present records "before" only when they are mine', () => {
        const records = { a: { completedAt: T1 } };
        expect(makeConsent(CONSENT_ANSWERS.MINE, records, T2).beforeIds).toEqual(['a']);
        expect(makeConsent(CONSENT_ANSWERS.CLEARED, records, T2).beforeIds).toEqual([]);
        expect(makeConsent(CONSENT_ANSWERS.NONE, {}, T2).beforeIds).toEqual([]);
    });
});

describe('needsConfirmation', () => {
    test('should ask once when the device has records of the assignment', () => {
        expect(needsConfirmation(null, { a: { completedAt: T1 } })).toBe(true);
    });

    test('should not ask without records', () => {
        expect(needsConfirmation(null, {})).toBe(false);
    });

    test('should not ask again after an answer', () => {
        const answered = makeConsent(CONSENT_ANSWERS.MINE, {}, T1);
        expect(needsConfirmation(answered, { a: { completedAt: T1 } })).toBe(false);
    });
});

describe('confirmationItems', () => {
    test('should list the records in the order of the assignment', () => {
        const items = confirmationItems(lesson, { c: { completedAt: T2 }, a: { completedAt: T1 } }, FAKE_COURSES);
        expect(items.map((i) => i.id)).toEqual(['a', 'c']);
        expect(items[0].name).toEqual({ id: 'name.a', defaultMessage: 'a' });
        expect(items[1].completedAt).toBe(T2);
    });

    test('should be empty without a lesson', () => {
        expect(confirmationItems(null, { a: { completedAt: T1 } }, FAKE_COURSES)).toEqual([]);
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
    });
});

describe('buildProgressPayload', () => {
    const progress = progressOf({ a: T1, b: T2, z: T1 });

    test('should send every record of the assignment, marking the ones from before', () => {
        const consent = makeConsent(CONSENT_ANSWERS.MINE, { a: {} }, T1);
        expect(buildProgressPayload(lesson, progress, consent, null)).toEqual({
            challenges: {
                a: { completedAt: T1, before: true },
                b: { completedAt: T2, before: false },
            },
        });
    });

    test('should add the open challenge as current', () => {
        const consent = makeConsent(CONSENT_ANSWERS.NONE, {}, T1);
        const current = { challengeId: 'c', openedAt: T2 };
        expect(buildProgressPayload(lesson, progress, consent, current).current).toEqual(current);
    });

    test('should send nothing outside the assignment', () => {
        const payload = buildProgressPayload(lesson, progress, null, null);
        expect(payload.challenges.z).toBeUndefined();
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
