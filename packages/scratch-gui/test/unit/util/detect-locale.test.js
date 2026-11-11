import {detectLocale} from '../../../src/lib/detect-locale.js';

const supportedLocales = ['en', 'es', 'pt-br', 'de', 'it'];

/**
 * @type {jest.SpyInstance}
 */
let windowSpy;

/**
 * @type {jest.SpyInstance}
 */
let locationSpy;

const mockWindowLocation = new URL('http://example.com/?name=val');
const mockWindowNavigator = {
    language: 'en-US'
};

beforeEach(() => {
    windowSpy = jest.spyOn(global, 'window', 'get');
    locationSpy = jest.spyOn(global, 'location', 'get');

    windowSpy.mockImplementation(() => ({
        location: mockWindowLocation,
        navigator: mockWindowNavigator
    }));

    // `window.location` and `location` should point to the same object
    locationSpy.mockImplementation(() => mockWindowLocation);
});

afterEach(() => {
    windowSpy.mockRestore();
    locationSpy.mockRestore();
});

describe('detectLocale', () => {
    test('uses locale from the URL when present', () => {
        mockWindowLocation.search = '?locale=pt-br';
        expect(detectLocale(supportedLocales)).toEqual('pt-br');
    });

    test('is case insensitive', () => {
        mockWindowLocation.search = '?locale=pt-BR';
        expect(detectLocale(supportedLocales)).toEqual('pt-br');
    });

    test('also accepts lang from the URL when present', () => {
        mockWindowLocation.search = '?lang=it';
        expect(detectLocale(supportedLocales)).toEqual('it');
    });

    test('ignores unsupported locales', () => {
        mockWindowLocation.search = '?lang=sv';
        expect(detectLocale(supportedLocales)).toEqual('en');
    });

    test('ignores other parameters', () => {
        mockWindowLocation.search = '?enable=language';
        expect(detectLocale(supportedLocales)).toEqual('en');
    });

    test('uses navigator language property for default if supported', () => {
        mockWindowNavigator.language = 'pt-BR';
        expect(detectLocale(supportedLocales)).toEqual('pt-br');
    });

    test('ignores navigator language property if unsupported', () => {
        mockWindowNavigator.language = 'da';
        expect(detectLocale(supportedLocales)).toEqual('en');
    });

    test('works with an empty locale', () => {
        mockWindowLocation.search = '?locale=';
        expect(detectLocale(supportedLocales)).toEqual('en');
    });

    test('if multiple, uses the first locale', () => {
        mockWindowLocation.search = '?locale=de&locale=en';
        expect(detectLocale(supportedLocales)).toEqual('de');
    });
});

// === Smalruby: Start of case-insensitive locale matching ===
describe('detectLocale with mixed-case supported locales', () => {
    const smalrubyLocales = ['en', 'ja', 'ja-Hira', 'zh-cn', 'pt-br'];

    beforeEach(() => {
        mockWindowNavigator.language = 'en-US';
    });

    test.each([
        ['ja-Hira', 'ja-Hira'],
        ['ja-hira', 'ja-Hira'],
        ['JA-HIRA', 'ja-Hira'],
        ['ja', 'ja'],
        ['en', 'en'],
        ['zh-cn', 'zh-cn'],
        ['zh-CN', 'zh-cn'],
    ])('?locale=%s returns the canonical %s', (param, expected) => {
        mockWindowLocation.search = `?locale=${param}`;
        expect(detectLocale(smalrubyLocales)).toEqual(expected);
    });

    test('ignores unsupported locales', () => {
        mockWindowLocation.search = '?locale=xx-Yy';
        expect(detectLocale(smalrubyLocales)).toEqual('en');
    });

    test('uses the canonical form for the navigator language too', () => {
        mockWindowLocation.search = '';
        mockWindowNavigator.language = 'ja-hira';
        expect(detectLocale(smalrubyLocales)).toEqual('ja-Hira');
    });
});
// === Smalruby: End of case-insensitive locale matching ===
