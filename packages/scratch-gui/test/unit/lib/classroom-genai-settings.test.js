import {
    GENAI_DEFAULT_URLS,
    buildAiSettingsUpdate,
    changedAiSettings,
    displayGenaiUrl,
    draftFromGroup,
    draftWithService,
    isAiDraftChanged,
    isDraftSavable,
    validateGenaiUrl,
} from '../../../src/lib/classroom-genai-settings.js';

describe('classroom-genai-settings', () => {
    describe('draftFromGroup', () => {
        test('reads a class without settings as both disabled', () => {
            expect(draftFromGroup({})).toEqual({
                use: false,
                service: null,
                url: '',
                confirmed: false,
                rubytee: false,
            });
        });

        test('reads stored settings', () => {
            const group = {
                genai: { enabled: true, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true },
                rubytee: { enabled: true },
            };
            expect(draftFromGroup(group)).toEqual({
                use: true,
                service: 'gemini',
                url: GENAI_DEFAULT_URLS.gemini,
                confirmed: true,
                rubytee: true,
            });
        });

        test('a class that does not use it starts from scratch, even with a stored service', () => {
            const group = {
                genai: { enabled: false, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true },
                rubytee: { enabled: true },
            };
            expect(draftFromGroup(group)).toEqual({
                use: false,
                service: null,
                url: '',
                confirmed: false,
                rubytee: true,
            });
        });

        test('ignores services that are not offered', () => {
            expect(draftFromGroup({ genai: { enabled: true, service: 'claude' } }).service).toBeNull();
        });
    });

    describe('validateGenaiUrl', () => {
        test('accepts https URLs', () => {
            expect(validateGenaiUrl('https://gemini.google.com/app')).toBeNull();
            expect(validateGenaiUrl('  https://ai.example.ed.jp/chat ')).toBeNull();
        });

        test('rejects empty and non-https URLs', () => {
            expect(validateGenaiUrl('')).toBe('required');
            expect(validateGenaiUrl('http://example.com/')).toBe('https');
            expect(validateGenaiUrl('not a url')).toBe('https');
        });

        test('rejects adult-only services, even with a trailing dot or subdomain', () => {
            expect(validateGenaiUrl('https://claude.ai/new')).toBe('adultOnly');
            expect(validateGenaiUrl('https://claude.ai./new')).toBe('adultOnly');
            expect(validateGenaiUrl('https://www.anthropic.com/')).toBe('adultOnly');
        });
    });

    describe('isDraftSavable', () => {
        const base = { use: true, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true, rubytee: false };

        test('not using generative AI is always savable', () => {
            expect(isDraftSavable({ ...base, use: false, service: null, confirmed: false })).toBe(true);
        });

        test('needs a service, a confirmation and a valid URL to enable', () => {
            expect(isDraftSavable(base)).toBe(true);
            expect(isDraftSavable({ ...base, service: null })).toBe(false);
            expect(isDraftSavable({ ...base, confirmed: false })).toBe(false);
            expect(isDraftSavable({ ...base, service: 'other', url: '' })).toBe(false);
            expect(isDraftSavable({ ...base, url: 'http://gemini.google.com/' })).toBe(false);
        });
    });

    describe('buildAiSettingsUpdate', () => {
        test('returns nothing when the settings did not change', () => {
            const group = {
                genai: { enabled: true, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true },
                rubytee: { enabled: false },
            };
            expect(buildAiSettingsUpdate(group, draftFromGroup(group))).toEqual({});
            expect(buildAiSettingsUpdate({}, draftFromGroup({}))).toEqual({});
        });

        test('enables Gemini with the full setting', () => {
            const draft = { use: true, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true, rubytee: false };
            expect(buildAiSettingsUpdate({}, draft)).toEqual({
                genai: { enabled: true, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true },
            });
        });

        test('disabling turns it off and drops the confirmation', () => {
            const group = {
                genai: { enabled: true, service: 'chatgpt', url: GENAI_DEFAULT_URLS.chatgpt, confirmed: true },
            };
            const draft = { ...draftFromGroup(group), use: false };
            expect(buildAiSettingsUpdate(group, draft)).toEqual({ genai: { enabled: false, confirmed: false } });
        });

        test('isAiDraftChanged tells unsaved edits apart', () => {
            const group = { genai: { enabled: true, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true } };
            expect(isAiDraftChanged(group, draftFromGroup(group))).toBe(false);
            expect(isAiDraftChanged(group, { ...draftFromGroup(group), rubytee: true })).toBe(true);
            expect(isAiDraftChanged({}, { ...draftFromGroup({}), use: true, service: 'gemini' })).toBe(true);
        });

        test('sends rubytee only when it changed', () => {
            const draft = { ...draftFromGroup({}), rubytee: true };
            expect(buildAiSettingsUpdate({}, draft)).toEqual({ rubytee: { enabled: true } });
        });

        test('trims the URL', () => {
            const draft = { use: true, service: 'other', url: ' https://ai.example.ed.jp/ ', confirmed: true, rubytee: false };
            expect(buildAiSettingsUpdate({}, draft).genai.url).toBe('https://ai.example.ed.jp/');
        });
    });

    describe('draftWithService', () => {
        const gemini = { use: true, service: 'gemini', url: 'https://gemini.example.ed.jp/', confirmed: true, rubytee: true };

        test('choosing another service resets its URL and confirmation', () => {
            expect(draftWithService(gemini, 'chatgpt')).toEqual({
                use: true,
                service: 'chatgpt',
                url: GENAI_DEFAULT_URLS.chatgpt,
                confirmed: false,
                rubytee: true,
            });
        });

        test('choosing the same service keeps what the teacher entered', () => {
            expect(draftWithService(gemini, 'gemini')).toBe(gemini);
        });

        test('not using it clears the service, URL and confirmation', () => {
            expect(draftWithService(gemini, null)).toEqual({
                use: false,
                service: null,
                url: '',
                confirmed: false,
                rubytee: true,
            });
        });

        test('Claude is never offered', () => {
            expect(draftWithService(gemini, 'claude')).toBe(gemini);
        });
    });

    describe('changedAiSettings', () => {
        const group = { genai: { enabled: true, service: 'gemini', url: GENAI_DEFAULT_URLS.gemini, confirmed: true } };

        test('marks each setting on its own', () => {
            expect(changedAiSettings(group, draftFromGroup(group))).toEqual({ genai: false, rubytee: false });
            expect(changedAiSettings(group, { ...draftFromGroup(group), rubytee: true })).toEqual({
                genai: false,
                rubytee: true,
            });
            expect(changedAiSettings(group, draftWithService(draftFromGroup(group), null))).toEqual({
                genai: true,
                rubytee: false,
            });
        });
    });

    describe('displayGenaiUrl', () => {
        test('drops the scheme and a trailing slash', () => {
            expect(displayGenaiUrl(GENAI_DEFAULT_URLS.gemini)).toBe('gemini.google.com/app');
            expect(displayGenaiUrl(' https://chatgpt.com/ ')).toBe('chatgpt.com');
        });
    });
});
