import {eslintConfigScratch} from 'eslint-config-scratch';
import globals from 'globals';

export default eslintConfigScratch.defineConfig(
    eslintConfigScratch.legacy.base,
    {
        files: ['*.{js,cjs,mjs}'],
        extends: [eslintConfigScratch.legacy.node],
        languageOptions: {
            globals: globals.node
        },
        rules: {
            'no-console': 'off'
        }
    },
    {
        files: ['{src,test}/**/*.{js,jsx}'],
        extends: [
            eslintConfigScratch.legacy.es6,
            eslintConfigScratch.legacy.react
        ],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jest,
                process: 'readonly'
            }
        },
        settings: {
            react: {
                version: 'detect'
            }
        },
        rules: {
            // Operator-only Japanese tool: react-intl is deliberately not
            // used here (unlike the editor).
            'react/jsx-no-literals': 'off'
        }
    },
    {
        // Tests run under jest's CommonJS runtime, so node globals (require,
        // __dirname) are available on top of the browser/jsdom ones — the
        // terminology audit (#1131) reads src/ from disk.
        files: ['test/**/*.{js,jsx}'],
        languageOptions: {
            globals: globals.node
        }
    },
    {
        ignores: ['build/**', 'node_modules/**']
    }
);
