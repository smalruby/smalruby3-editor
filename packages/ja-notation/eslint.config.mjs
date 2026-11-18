// SPDX-License-Identifier: MIT
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import { eslintConfigScratch } from 'eslint-config-scratch';
import { globalIgnores } from 'eslint/config';
import globals from 'globals';

export default eslintConfigScratch.defineConfig(
    eslintConfigScratch.legacy.base,
    {
        extends: [eslintConfigScratch.legacy.es6],
        languageOptions: {
            sourceType: 'module',
            globals: globals.node,
        },
        rules: {
            // The functions of the parse and the writers call each other (a
            // recursive descent): one defined below is called only after both are.
            'no-use-before-define': ['error', { functions: false, variables: false }],
        },
    },
    globalIgnores(['node_modules/**']),
    // Last, to turn off the rules of the formatting that prettier does.
    eslintConfigPrettier,
);
