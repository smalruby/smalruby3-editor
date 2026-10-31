import messages, { KIND_MESSAGES } from '../../../src/components/genai-concierge/messages.js';
import {
    NUDGE_GAP_MS,
    genaiServiceLabel,
    isGenaiAvailable,
    isNudgeOffToday,
    localDateKey,
    normalizeStudentGenai,
    resolveGenaiTarget,
    shouldNudge,
} from '../../../src/lib/genai-concierge-state.js';
import { PROBLEM_KINDS } from '../../../src/lib/genai-prompt.js';
import en from '../../../src/locales/en.js';
import jaHira from '../../../src/locales/ja-Hira.js';
import ja from '../../../src/locales/ja.js';

describe('normalizeStudentGenai', () => {
    test('should keep an enabled https setting', () => {
        expect(
            normalizeStudentGenai({ enabled: true, service: 'gemini', url: 'https://gemini.google.com/app' }),
        ).toEqual({ enabled: true, service: 'gemini', url: 'https://gemini.google.com/app' });
    });

    test('should read a missing setting as disabled', () => {
        expect(normalizeStudentGenai(undefined)).toEqual({ enabled: false, service: null, url: null });
    });

    test('should read a disabled setting as disabled', () => {
        expect(normalizeStudentGenai({ enabled: false, service: 'gemini', url: 'https://x.example/' }).enabled).toBe(
            false,
        );
    });

    test('should refuse a URL that is not https', () => {
        expect(normalizeStudentGenai({ enabled: true, service: 'other', url: 'http://x.example/' }).enabled).toBe(
            false,
        );
        expect(normalizeStudentGenai({ enabled: true, service: 'other', url: 'javascript:alert(1)' }).enabled).toBe(
            false,
        );
    });
});

describe('genaiServiceLabel', () => {
    test('should name known services', () => {
        expect(genaiServiceLabel('gemini', 'https://gemini.google.com/app')).toBe('Gemini');
        expect(genaiServiceLabel('chatgpt', 'https://chatgpt.com/')).toBe('ChatGPT');
    });

    test('should use the host for other services', () => {
        expect(genaiServiceLabel('other', 'https://ai.school.example/chat')).toBe('ai.school.example');
    });
});

describe('isNudgeOffToday', () => {
    const now = new Date(2026, 9, 31, 10, 0).getTime();

    test('should be off on the same day', () => {
        expect(isNudgeOffToday(localDateKey(now), now)).toBe(true);
    });

    test('should come back the next day', () => {
        const tomorrow = new Date(2026, 10, 1, 8, 0).getTime();
        expect(isNudgeOffToday(localDateKey(now), tomorrow)).toBe(false);
    });

    test('should ignore the prototype value that never expired', () => {
        expect(isNudgeOffToday('true', now)).toBe(false);
        expect(isNudgeOffToday(null, now)).toBe(false);
    });
});

describe('shouldNudge', () => {
    const base = { now: 1000000, lastActivity: 0, lastNudge: 0, idleMs: 150000, busy: false, offToday: false };

    test('should offer help after the idle time', () => {
        expect(shouldNudge(base)).toBe(true);
    });

    test('should wait while the student is active', () => {
        expect(shouldNudge({ ...base, lastActivity: base.now - 1000 })).toBe(false);
    });

    test('should wait 10 minutes after the last offer', () => {
        expect(shouldNudge({ ...base, lastNudge: base.now - NUDGE_GAP_MS + 1 })).toBe(false);
        expect(shouldNudge({ ...base, now: base.now + NUDGE_GAP_MS, lastNudge: base.now })).toBe(true);
    });

    test('should stay quiet on an error, a running program or a hidden tab', () => {
        expect(shouldNudge({ ...base, busy: true })).toBe(false);
    });

    test('should stay quiet when turned off today', () => {
        expect(shouldNudge({ ...base, offToday: true })).toBe(false);
    });
});

describe('resolveGenaiTarget', () => {
    const off = { enabled: false, service: null, url: null };

    test('should use the class setting and ignore the development choice', () => {
        expect(
            resolveGenaiTarget({
                classGenai: { enabled: true, service: 'other', url: 'https://ai.school.example/' },
                devChoice: 'chatgpt',
            }),
        ).toEqual({ name: 'ai.school.example', url: 'https://ai.school.example/', fromClass: true });
    });

    test('should fall back to the development choice outside a class', () => {
        expect(resolveGenaiTarget({ classGenai: off, devChoice: 'gemini' })).toEqual({
            name: 'Gemini',
            url: 'https://gemini.google.com/app',
            fromClass: false,
        });
        expect(resolveGenaiTarget({ classGenai: off, devChoice: 'https://x.example/' }).url).toBe(
            'https://x.example/',
        );
    });

    test('should be null when nothing is chosen or the choice is not https', () => {
        expect(resolveGenaiTarget({ classGenai: off, devChoice: null })).toBeNull();
        expect(resolveGenaiTarget({ classGenai: off, devChoice: 'http://x.example/' })).toBeNull();
    });
});

describe('isGenaiAvailable', () => {
    const on = { enabled: true, service: 'gemini', url: 'https://gemini.google.com/app' };
    const off = { enabled: false, service: null, url: null };

    test('should show the face to a student of a class using a generative AI', () => {
        expect(isGenaiAvailable({ role: 'student', sessionToken: 't', classGenai: on, devFlag: false })).toBe(true);
    });

    test('should hide it in a class without one and outside a class', () => {
        expect(isGenaiAvailable({ role: 'student', sessionToken: 't', classGenai: off, devFlag: false })).toBe(false);
        expect(isGenaiAvailable({ role: null, sessionToken: null, classGenai: on, devFlag: false })).toBe(false);
    });

    test('should show it with the development flag', () => {
        expect(isGenaiAvailable({ role: null, sessionToken: null, classGenai: off, devFlag: true })).toBe(true);
    });
});

describe('genai concierge words', () => {
    test('should have a label and a starter for every kind of trouble', () => {
        PROBLEM_KINDS.forEach((kind) => {
            expect(KIND_MESSAGES[kind.id].label.id).toMatch(/^gui\.genaiConcierge\.kind\./);
            expect(KIND_MESSAGES[kind.id].starter.id).toMatch(/^gui\.genaiConcierge\.starter\./);
        });
    });

    test('should have every message in en, ja and ja-Hira', () => {
        const ids = [
            ...Object.values(messages).map((m) => m.id),
            ...Object.values(KIND_MESSAGES).flatMap((k) => [k.label.id, k.starter.id]),
        ];
        [en, ja, jaHira].forEach((locale) => {
            ids.forEach((id) => expect(locale[id]).toEqual(expect.any(String)));
        });
    });
});
