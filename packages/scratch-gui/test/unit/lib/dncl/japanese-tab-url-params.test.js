// The Japanese tab (docs/dncl/design.md 1 章): the URL parameters and the
// language the editor starts in.

const loadFresh = (path) => {
    let mod;
    window.history.replaceState(null, '', path);
    jest.isolateModules(() => {
        mod = {
            ...require('../../../../src/lib/url-params.js'),
            ...require('../../../../src/reducers/dncl-mode.js'),
        };
    });
    return mod;
};

const RUBY_TAB_INDEX = 3;
const JAPANESE_TAB_INDEX = 4;

describe('the Japanese tab in the URL', () => {
    afterEach(() => {
        window.history.replaceState(null, '', '/');
        window.localStorage.clear();
    });

    test.each([['japanese'], ['ja'], ['dncl'], ['Japanese']])('tab=%s opens the Japanese tab in Japanese', (tab) => {
        const { getUrlParams, getInitialDnclMode } = loadFresh(`/?tab=${tab}`);
        expect(getUrlParams().initialTab).toBe(JAPANESE_TAB_INDEX);
        expect(getUrlParams().rubyMode).toBe('dncl');
        expect(getInitialDnclMode()).toBe(true);
    });

    test('an old link tab=ruby&rubyMode=dncl opens the Japanese tab', () => {
        const { getUrlParams, getInitialDnclMode } = loadFresh('/?tab=ruby&rubyMode=dncl');
        expect(getUrlParams().initialTab).toBe(JAPANESE_TAB_INDEX);
        expect(getInitialDnclMode()).toBe(true);
    });

    test('tab=ruby opens the Ruby tab in Ruby even when the last visit was in Japanese', () => {
        window.localStorage.setItem('smalruby:dnclMode', 'true');
        const { getUrlParams, getInitialDnclMode } = loadFresh('/?tab=ruby');
        expect(getUrlParams().initialTab).toBe(RUBY_TAB_INDEX);
        expect(getInitialDnclMode()).toBe(false);
    });

    test('tab=ruby&rubyMode=furigana stays on the Ruby tab', () => {
        const { getUrlParams, getInitialDnclMode } = loadFresh('/?tab=ruby&rubyMode=furigana');
        expect(getUrlParams().initialTab).toBe(RUBY_TAB_INDEX);
        expect(getInitialDnclMode()).toBe(false);
    });

    test('rubyMode=dncl without a tab writes in Japanese but opens the Code tab', () => {
        const { getUrlParams, getInitialDnclMode } = loadFresh('/?rubyMode=dncl');
        expect(getUrlParams().initialTab).toBe(null);
        expect(getInitialDnclMode()).toBe(true);
    });

    test('without parameters the language of the last visit is kept (smalruby:dnclMode)', () => {
        window.localStorage.setItem('smalruby:dnclMode', 'true');
        expect(loadFresh('/').getInitialDnclMode()).toBe(true);
        window.localStorage.setItem('smalruby:dnclMode', 'false');
        expect(loadFresh('/').getInitialDnclMode()).toBe(false);
    });

    test('without parameters nor a last visit the editor starts in Ruby', () => {
        expect(loadFresh('/').getInitialDnclMode()).toBe(false);
    });
});
