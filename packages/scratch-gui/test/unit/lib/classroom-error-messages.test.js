import translateError from '../../../src/containers/classroom-error-utils.js';
import {
    localizeServerError,
    matchServerError,
    serverErrorMessages,
} from '../../../src/lib/classroom-error-messages.js';
import en from '../../../src/locales/en.js';
import jaHira from '../../../src/locales/ja-Hira.js';
import ja from '../../../src/locales/ja.js';

// Minimal intl mock: uses the given locale table (or defaultMessage) and
// substitutes {placeholders} from the values map.
const makeIntl = (table = {}) => ({
    formatMessage: (descriptor, values = {}) =>
        (table[descriptor.id] || descriptor.defaultMessage).replace(/\{(\w+)\}/g, (m, key) =>
            Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : m,
        ),
});

describe('matchServerError', () => {
    test('the daily AI evaluation limit captures the limit', () => {
        const found = matchServerError('Daily AI evaluation limit reached (50 calls/day). Please continue tomorrow.');
        expect(found.message.id).toBe('gui.classroom.serverError.evalDailyLimit');
        expect(found.values).toEqual({ limit: 50 });
    });

    test('the share/report daily limit captures the limit', () => {
        const found = matchServerError('Daily limit reached (20/day). Please continue tomorrow.');
        expect(found.message.id).toBe('gui.classroom.serverError.sharedDailyLimit');
        expect(found.values).toEqual({ limit: 20 });
    });

    test.each([
        ['Too many evaluation requests. Please try again later.', 'evalRateLimit'],
        ['Too many join attempts. Please try again later.', 'joinRateLimit'],
        ['Too many lesson progress updates. Please try again later.', 'lessonProgressRateLimit'],
        ['AI_TIMEOUT', 'aiTimeout'],
        ['AI_API_ERROR', 'aiApiError'],
        ['AI_RESPONSE_INVALID', 'aiResponseInvalid'],
        ['AI evaluation is not configured', 'aiNotConfigured'],
        ['Classroom not found', 'classroomNotFound'],
        ['Submission not found', 'submissionNotFound'],
        ['Shared assignment not found', 'sharedNotFound'],
        ['This assignment has no lesson', 'noLesson'],
        ['This assignment has no content (pages, starter project or lesson) to share', 'shareNoContent'],
        ['Only the class owner can change the co-teacher list', 'coTeacherOwnerOnly'],
        ['Failed to generate unique join code', 'joinCodeFailed'],
        ['Failed to generate a unique passcode', 'joinCodeFailed'],
        ['Internal server error', 'internalError'],
    ])('%s', (text, key) => {
        expect(matchServerError(text).message.id).toBe(`gui.classroom.serverError.${key}`);
    });

    test.each([
        ['Starter project exceeds the 5MB limit', 'starterTooLarge', { size: 5 }],
        ['A classroom may have at most 10 co-teachers', 'coTeacherMax', { max: 10 }],
        ['Seat 12 is not currently occupied', 'seatNotOccupied', { seat: 12 }],
        ['API error 502', 'httpStatus', { status: 502 }],
    ])('%s captures its number', (text, key, values) => {
        const found = matchServerError(text);
        expect(found.message.id).toBe(`gui.classroom.serverError.${key}`);
        expect(found.values).toEqual(values);
    });

    test('unknown or non-string messages do not match', () => {
        expect(matchServerError('Something new from the server')).toBeNull();
        expect(matchServerError('Classroom not found, really')).toBeNull();
        expect(matchServerError(undefined)).toBeNull();
    });
});

describe('localizeServerError', () => {
    test('shows the daily AI limit in Japanese with the limit', () => {
        const text = localizeServerError(
            makeIntl(ja),
            'Daily AI evaluation limit reached (50 calls/day). Please continue tomorrow.',
        );
        expect(text).toBe(
            'AI の採点は 1 日 50 回までです。今日の分を使い切りました。0 時（日付が変わると）また使えます。',
        );
    });

    test('falls back to the original text for an unknown message', () => {
        expect(localizeServerError(makeIntl(ja), 'Brand new server message')).toBe('Brand new server message');
    });

    test('translateError uses it for a server message', () => {
        const err = new Error('Too many evaluation requests. Please try again later.');
        err.status = 400;
        expect(translateError(makeIntl(ja), err)).toBe(ja['gui.classroom.serverError.evalRateLimit']);
    });

    test('translateError still shows an unknown server message as is', () => {
        const err = new Error('pages[0].text is required');
        err.status = 400;
        expect(translateError(makeIntl(ja), err)).toBe('pages[0].text is required');
    });
});

describe('locale files', () => {
    test.each([
        ['en', en],
        ['ja', ja],
        ['ja-Hira', jaHira],
    ])('%s has every server error message with the same placeholders', (name, table) => {
        for (const descriptor of Object.values(serverErrorMessages)) {
            expect(typeof table[descriptor.id]).toBe('string');
            const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort();
            expect(placeholders(table[descriptor.id])).toEqual(placeholders(descriptor.defaultMessage));
        }
    });

    test('en matches the defaultMessage', () => {
        for (const descriptor of Object.values(serverErrorMessages)) {
            expect(en[descriptor.id]).toBe(descriptor.defaultMessage);
        }
    });
});
