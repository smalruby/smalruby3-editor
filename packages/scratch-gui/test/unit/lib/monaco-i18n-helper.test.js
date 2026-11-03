/**
 * Monaco Editor のローダ設定が「自前ホスト」を指していることを担保するテスト (#1171)。
 * CDN (cdn.jsdelivr.net) へ戻すリグレッションをここで検出する。
 */

const configCalls = [];

jest.mock('@monaco-editor/react', () => ({
    loader: {
        config: (options) => configCalls.push(options),
    },
}));

describe('monaco-i18n-helper', () => {
    describe('resolveMonacoVsPath', () => {
        const { resolveMonacoVsPath } = require('../../../src/lib/monaco-i18n-helper');

        test('returns a relative path when publicPath is empty', () => {
            expect(resolveMonacoVsPath('')).toBe('static/monaco/vs');
        });

        test('joins a publicPath that ends with a slash', () => {
            expect(resolveMonacoVsPath('/smalruby3-editor/')).toBe('/smalruby3-editor/static/monaco/vs');
        });

        test('joins a publicPath without a trailing slash', () => {
            expect(resolveMonacoVsPath('/smalruby3-editor')).toBe('/smalruby3-editor/static/monaco/vs');
        });

        test('keeps absolute origins intact', () => {
            expect(resolveMonacoVsPath('https://smalruby.app/')).toBe('https://smalruby.app/static/monaco/vs');
        });

        test('treats the literal "auto" and non-strings as no publicPath', () => {
            expect(resolveMonacoVsPath('auto')).toBe('static/monaco/vs');
            expect(resolveMonacoVsPath(undefined)).toBe('static/monaco/vs');
            expect(resolveMonacoVsPath(null)).toBe('static/monaco/vs');
        });

        test('joins a versioned subpath', () => {
            expect(resolveMonacoVsPath('/smalruby3-editor/', 'static/monaco/0.57.0/vs')).toBe(
                '/smalruby3-editor/static/monaco/0.57.0/vs',
            );
            expect(resolveMonacoVsPath('auto', 'static/monaco/0.57.0/vs')).toBe('static/monaco/0.57.0/vs');
        });
    });

    describe('loader configuration', () => {
        test('configures the AMD loader with the self-hosted vs path', () => {
            require('../../../src/lib/monaco-i18n-helper');

            expect(configCalls).toHaveLength(1);
            expect(configCalls[0].paths.vs).toBe('static/monaco/vs');
        });

        test('does not reference any CDN', () => {
            require('../../../src/lib/monaco-i18n-helper');

            expect(JSON.stringify(configCalls)).not.toMatch(/jsdelivr|unpkg|cdn/i);
        });
    });

    describe('loadMonacoLocale', () => {
        const { loadMonacoLocale } = require('../../../src/lib/monaco-i18n-helper');

        afterEach(() => {
            delete globalThis._VSCODE_NLS_MESSAGES;
            delete globalThis._VSCODE_NLS_LANGUAGE;
        });

        test('loads the Japanese NLS messages bundled with monaco-editor', async () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            try {
                await loadMonacoLocale('ja');
                expect(errorSpy).not.toHaveBeenCalled();
            } finally {
                errorSpy.mockRestore();
            }
            expect(globalThis._VSCODE_NLS_LANGUAGE).toBe('ja');
            expect(Array.isArray(globalThis._VSCODE_NLS_MESSAGES)).toBe(true);
        });

        test('resets to English for other locales', async () => {
            await loadMonacoLocale('en');
            expect(globalThis._VSCODE_NLS_MESSAGES).toBeNull();
            expect(globalThis._VSCODE_NLS_LANGUAGE).toBe('en');
        });
    });

    describe('versioned vs path injected by webpack (#1318)', () => {
        const original = process.env.MONACO_VS_SUBPATH;

        afterEach(() => {
            if (typeof original === 'undefined') {
                delete process.env.MONACO_VS_SUBPATH;
            } else {
                process.env.MONACO_VS_SUBPATH = original;
            }
        });

        // 他の describe が数える configCalls を増やすので、ファイルの最後に置く。
        test('configures the AMD loader with the injected versioned path', () => {
            process.env.MONACO_VS_SUBPATH = 'static/monaco/0.57.0/vs';
            jest.isolateModules(() => {
                const { resolveMonacoVsPath } = require('../../../src/lib/monaco-i18n-helper');
                expect(resolveMonacoVsPath('/smalruby3-editor/')).toBe('/smalruby3-editor/static/monaco/0.57.0/vs');
            });
            expect(configCalls[configCalls.length - 1].paths.vs).toBe('static/monaco/0.57.0/vs');
        });
    });
});
