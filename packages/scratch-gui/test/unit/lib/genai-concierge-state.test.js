import messages, { KIND_MESSAGES } from '../../../src/components/genai-concierge/messages.js';
import {
    NUDGE_GAP_MS,
    copyChecklist,
    genaiServiceLabel,
    TAKEOVER_AFTER_FAILURES,
    canOfferTakeover,
    isGenaiAvailable,
    isNudgeOffToday,
    localDateKey,
    normalizeStudentGenai,
    panelPlacement,
    resolveGenaiTarget,
    scrollToShowBlocks,
    shouldNudge,
    stepperItems,
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

    test('should keep no unused genaiConcierge words in en, ja and ja-Hira', () => {
        const ids = new Set([
            ...Object.values(messages).map((m) => m.id),
            ...Object.values(KIND_MESSAGES).flatMap((k) => [k.label.id, k.starter.id]),
        ]);
        [en, ja, jaHira].forEach((locale) => {
            const unused = Object.keys(locale).filter((id) => id.startsWith('gui.genaiConcierge.') && !ids.has(id));
            expect(unused).toEqual([]);
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

describe('stepperItems', () => {
    const statuses = (step) => stepperItems(step).map((item) => item.status);

    test('should mark the current step and leave the later ones to do', () => {
        expect(statuses('trouble')).toEqual(['current', 'todo', 'todo']);
        expect(statuses('copy')).toEqual(['done', 'current', 'todo']);
        expect(statuses('paste')).toEqual(['done', 'done', 'current']);
    });

    test('should mark every step done once the blocks are in', () => {
        expect(statuses('done')).toEqual(['done', 'done', 'done']);
    });

    test('should let the student go back only to a finished step before putting the blocks in', () => {
        expect(stepperItems('paste').map((item) => item.canReturn)).toEqual([true, true, false]);
        expect(stepperItems('copy').map((item) => item.canReturn)).toEqual([true, false, false]);
        expect(stepperItems('done').map((item) => item.canReturn)).toEqual([false, false, false]);
    });

    test('should name the steps in order', () => {
        expect(stepperItems('trouble').map((item) => item.id)).toEqual(['trouble', 'copy', 'paste']);
    });
});

describe('copyChecklist', () => {
    test('should point at copying first', () => {
        expect(copyChecklist({ copied: false })).toEqual(['next', 'wait', 'wait']);
    });

    test('should move on to pasting once copied', () => {
        expect(copyChecklist({ copied: true })).toEqual(['done', 'next', 'wait']);
    });
});

describe('panelPlacement', () => {
    test('should put the panel at the right edge of the script area', () => {
        // Script area 920 px wide, the face root at 324, a 340 px panel: right edge at 860,
        // clear of the zoom buttons along the right edge.
        expect(panelPlacement({ areaWidth: 920, rootLeft: 324, panelWidth: 340, faceWidth: 52 })).toEqual({
            left: 920 - 60 - 340 - 324,
            bottom: 0,
        });
    });

    test('should sit above the face when the area is too narrow to keep them side by side', () => {
        expect(panelPlacement({ areaWidth: 640, rootLeft: 324, panelWidth: 340, faceWidth: 52 })).toEqual({
            left: 0,
            bottom: 60,
        });
    });
});

describe('scrollToShowBlocks', () => {
    test('should bring the top left of the blocks near the top left of the script area', () => {
        expect(scrollToShowBlocks({ bbox: { left: 300, top: 200 }, scale: 0.675 })).toEqual({
            x: 24 - 300 * 0.675,
            y: 24 - 200 * 0.675,
        });
    });

    test('should do nothing without blocks', () => {
        expect(scrollToShowBlocks({ bbox: null, scale: 1 })).toBeNull();
    });
});

describe('canOfferTakeover', () => {
    test('offers Rubytee after two checks that could not become blocks, in a class using Rubytee', () => {
        expect(TAKEOVER_AFTER_FAILURES).toBe(2);
        expect(canOfferTakeover({ failures: 1, rubyteeAvailable: true })).toBe(false);
        expect(canOfferTakeover({ failures: 2, rubyteeAvailable: true })).toBe(true);
        expect(canOfferTakeover({ failures: 3, rubyteeAvailable: true })).toBe(true);
        expect(canOfferTakeover({ failures: 2, rubyteeAvailable: false })).toBe(false);
    });
});
