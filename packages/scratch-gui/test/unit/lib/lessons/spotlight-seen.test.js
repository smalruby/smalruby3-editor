import {
    SPOTLIGHT_SEEN_STORAGE_KEY,
    isSpotlightSeen,
    markSpotlightSeen,
} from '../../../../src/lib/lessons/spotlight-seen';

describe('spotlight-seen', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    test('a challenge is not seen until it is marked', () => {
        expect(isSpotlightSeen('blocks-l1-click-say')).toBe(false);
        expect(markSpotlightSeen('blocks-l1-click-say', window.localStorage, '2026-11-10T00:00:00.000Z')).toBe(true);
        expect(isSpotlightSeen('blocks-l1-click-say')).toBe(true);
        expect(isSpotlightSeen('blocks-l1-key-sound')).toBe(false);
        expect(JSON.parse(window.localStorage.getItem(SPOTLIGHT_SEEN_STORAGE_KEY))).toEqual({
            'blocks-l1-click-say': '2026-11-10T00:00:00.000Z',
        });
    });

    test('marking again keeps the first date', () => {
        markSpotlightSeen('a', window.localStorage, '2026-01-01T00:00:00.000Z');
        markSpotlightSeen('a', window.localStorage, '2026-02-01T00:00:00.000Z');
        expect(JSON.parse(window.localStorage.getItem(SPOTLIGHT_SEEN_STORAGE_KEY)).a).toBe(
            '2026-01-01T00:00:00.000Z',
        );
    });

    test('broken storage contents are treated as "not seen" and overwritten', () => {
        window.localStorage.setItem(SPOTLIGHT_SEEN_STORAGE_KEY, '[1,2');
        expect(isSpotlightSeen('a')).toBe(false);
        expect(markSpotlightSeen('a', window.localStorage, '2026-01-01T00:00:00.000Z')).toBe(true);
        expect(isSpotlightSeen('a')).toBe(true);
    });

    test('does not throw without storage or when writing fails', () => {
        expect(isSpotlightSeen('a', null)).toBe(false);
        expect(markSpotlightSeen('a', null)).toBe(false);
        const broken = {
            getItem: () => null,
            setItem: () => {
                throw new Error('quota');
            },
        };
        expect(markSpotlightSeen('a', broken)).toBe(false);
    });
});
