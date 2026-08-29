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
        ignores: ['build/**', 'node_modules/**']
    }
);
