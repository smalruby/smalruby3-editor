import {loader} from '@monaco-editor/react';

// Configure loader to use a specific version from CDN to match our local NLS messages
loader.config({
    paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs'
    }
});

const loadMonacoLocale = async locale => {
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

export {loadMonacoLocale};
