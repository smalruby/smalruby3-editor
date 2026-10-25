/* eslint-disable no-console */
/* global __webpack_public_path__ */
import { loader } from '@monaco-editor/react';

/**
 * `min/vs` の配信先。`webpack.config.js` の CopyWebpackPlugin が
 * `node_modules/monaco-editor/min/vs` をここへコピーする (#1171)。
 * 場所を変えるときは webpack 側のコピー先も対で変えること。
 */
const MONACO_VS_SUBPATH = 'static/monaco/vs';

/**
 * Monaco の AMD ローダーに渡す `vs` パスを publicPath から組み立てる。
 *
 * CI は smalruby.app / GitHub Pages のサブディレクトリ / ブランチプレビューの 3 通りの
 * base パスでビルドし、`dist` は scratch-desktop / scratch-android のために
 * `publicPath: 'auto'`（実行時解決）を使う。そのため絶対パスを直書きできず、
 * webpack の publicPath を前置して解決する。
 * @param {string} publicPath webpack の publicPath（空文字・末尾スラッシュ有無どちらも可）。
 * @returns {string} Monaco の `vs` ディレクトリを指すパス。
 */
const resolveMonacoVsPath = (publicPath) => {
    // `'auto'` は webpack が実行時の値へ置き換える前のリテラル。素通しすると
    // `auto/static/...` という無効な URL になるので publicPath なし扱いにする。
    const base = typeof publicPath === 'string' && publicPath !== 'auto' ? publicPath : '';
    if (base === '') {
        return MONACO_VS_SUBPATH;
    }
    return `${base.replace(/\/+$/, '')}/${MONACO_VS_SUBPATH}`;
};

/**
 * webpack が注入する publicPath を読む。webpack 外（jest など）では未定義なので空文字にする。
 * @returns {string} publicPath（未定義なら空文字）。
 */
const webpackPublicPath = () =>
    // eslint-disable-next-line camelcase
    typeof __webpack_public_path__ === 'string' ? __webpack_public_path__ : '';

// Monaco 本体は CDN ではなく自前配信物から読み込む (#1171)。
// これにより CDN が塞がれた学校ネットワークやオフライン (PWA) でもルビータブが動き、
// バージョンは package.json の monaco-editor に自動的に揃う。
//
// ⚠️ `@monaco-editor/loader` の既定 `paths.vs` は CDN (cdn.jsdelivr.net) のままで、
// この副作用インポートより先に `loader.init()`（= `<Editor>` の初回レンダー）が走ると
// 静かに CDN へフォールバックする。`@monaco-editor/react` を使うモジュールを新しく
// 追加するときは、`<Editor>` をレンダーする前にこのモジュールを import すること。
loader.config({
    paths: {
        vs: resolveMonacoVsPath(webpackPublicPath()),
    },
});

const loadMonacoLocale = async (locale) => {
    if (locale === 'ja' || locale === 'ja-Hira') {
        try {
            // Import the ESM NLS messages.
            // These files set globalThis._VSCODE_NLS_MESSAGES and globalThis._VSCODE_NLS_LANGUAGE
            await import('monaco-editor/esm/nls.messages.ja.js');
        } catch (e) {
            console.error('Failed to load Monaco Japanese locale', e);
        }
    } else {
        window._VSCODE_NLS_MESSAGES = null;
        window._VSCODE_NLS_LANGUAGE = 'en';
    }
};

export { loadMonacoLocale, resolveMonacoVsPath };
