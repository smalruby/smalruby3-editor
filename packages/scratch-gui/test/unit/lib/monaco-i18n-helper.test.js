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
            expect(resolveMonacoVsPath('/smalruby3-editor/')).toBe(
                '/smalruby3-editor/static/monaco/vs',
            );
        });

        test('joins a publicPath without a trailing slash', () => {
            expect(resolveMonacoVsPath('/smalruby3-editor')).toBe(
                '/smalruby3-editor/static/monaco/vs',
            );
        });

        test('keeps absolute origins intact', () => {
            expect(resolveMonacoVsPath('https://smalruby.app/')).toBe(
                'https://smalruby.app/static/monaco/vs',
            );
        });

        test('treats the literal "auto" and non-strings as no publicPath', () => {
            expect(resolveMonacoVsPath('auto')).toBe('static/monaco/vs');
            expect(resolveMonacoVsPath(undefined)).toBe('static/monaco/vs');
            expect(resolveMonacoVsPath(null)).toBe('static/monaco/vs');
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
});
