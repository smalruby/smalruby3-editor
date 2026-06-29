import { chooseDownloadStrategy, isAppleMobile } from '../../../src/lib/download-blob';

describe('chooseDownloadStrategy', () => {
    const base = {
        hasMsSave: false,
        needsMobileSave: false,
        canShareFile: false,
        hasDownloadAttr: true,
    };

    test('uses msSave when available, regardless of other capabilities', () => {
        expect(chooseDownloadStrategy({ ...base, hasMsSave: true, needsMobileSave: true, canShareFile: true })).toBe(
            'msSave',
        );
    });

    test('desktop (download attribute supported) uses the anchor click path', () => {
        expect(chooseDownloadStrategy(base)).toBe('anchor');
    });

    test('mobile that can share files uses the Web Share path', () => {
        expect(chooseDownloadStrategy({ ...base, needsMobileSave: true, canShareFile: true })).toBe('share');
    });

    test('mobile without Web Share opens the blob in a new tab', () => {
        expect(chooseDownloadStrategy({ ...base, needsMobileSave: true, canShareFile: false })).toBe('newTab');
    });

    test('mobile prefers the new-tab fallback over the (ignored) anchor attribute', () => {
        // Even though hasDownloadAttr is true (iOS reports it), the attribute is
        // ignored on iOS Safari, so a mobile platform must never pick 'anchor'.
        expect(
            chooseDownloadStrategy({ ...base, needsMobileSave: true, canShareFile: false, hasDownloadAttr: true }),
        ).toBe('newTab');
    });

    test('very old non-mobile browser without download attribute falls back to a new tab', () => {
        expect(chooseDownloadStrategy({ ...base, hasDownloadAttr: false })).toBe('newTab');
    });
});

describe('isAppleMobile', () => {
    const originalNavigator = global.navigator;

    const setUserAgent = (userAgent, maxTouchPoints = 0) => {
        Object.defineProperty(global, 'navigator', {
            value: { userAgent, maxTouchPoints },
            configurable: true,
            writable: true,
        });
    };

    afterEach(() => {
        Object.defineProperty(global, 'navigator', {
            value: originalNavigator,
            configurable: true,
            writable: true,
        });
    });

    test('detects iPhone', () => {
        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
        expect(isAppleMobile()).toBe(true);
    });

    test('detects iPad (classic iOS user agent)', () => {
        setUserAgent('Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15');
        expect(isAppleMobile()).toBe(true);
    });

    test('detects iPadOS 13+ masquerading as desktop Safari (touch points > 1)', () => {
        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', 5);
        expect(isAppleMobile()).toBe(true);
    });

    test('does not flag a real desktop Mac (no touch points)', () => {
        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15', 0);
        expect(isAppleMobile()).toBe(false);
    });

    test('does not flag Android Chrome (download attribute works there)', () => {
        setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120', 5);
        expect(isAppleMobile()).toBe(false);
    });

    test('does not flag desktop Chrome on Windows', () => {
        setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120');
        expect(isAppleMobile()).toBe(false);
    });
});
