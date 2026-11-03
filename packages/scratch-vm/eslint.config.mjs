import {eslintConfigScratch} from 'eslint-config-scratch';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import {globalIgnores} from 'eslint/config';
import globals from 'globals';

export default eslintConfigScratch.defineConfig(
    eslintConfigScratch.legacy.base,
    {
        files: ['src/**/*.{,c,m}js'],
        extends: [eslintConfigScratch.legacy.es6],
        languageOptions: {
            globals: globals.browser
        },
        rules: {
            'no-unused-vars': 'warn',
            'format-message/literal-pattern': 'off',
            'format-message/literal-locale': 'off'
        }
    },
    {
        files: ['src/extension-support/extension-worker.js'],
        languageOptions: {
            globals: globals.worker
        }
    },
    {
        files: [
            '*.{,c,m}js', // for example, webpack.config.js
            'scripts/**/*.{,c,m}js',
            'test/**/*.{,c,m}js'
        ],
        extends: [eslintConfigScratch.legacy.node],
        languageOptions: {
            globals: globals.node
        },
        rules: {
            'no-undefined': 'warn'
        }
    },
    globalIgnores([
        'benchmark/**/*',
        'coverage/**/*',
        'dist/**/*',
        'node_modules/**/*',
        'playground/**/*',
        'tap-snapshots/**/*',
        'src/extension-support/extension-worker.js',
        'src/engine/runtime.js',
        'src/extension-support/extension-manager.js',
        'src/util/maybe-format-message.js'
    ]),
    {
        files: ['src/**/*.js', 'test/**/*.js'],
        ignores: [
            'src/engine/runtime.js',
            'src/extension-support/extension-manager.js',
            'src/util/maybe-format-message.js',
            'src/extensions/koshien/index.js',
            'src/extensions/microbitMore/ble-web.js',
            'src/extensions/microbitMore/index.js',
            'src/extensions/microbitMore/serial-web.js',
            'src/extensions/scratch3_mesh/index.js',
            'src/extensions/scratch3_mesh_v2/rate-limiter.js',
            'src/extensions/scratch3_smalrubot_s1/index.js',
            'src/io/ble.js',
            'test/fixtures/make-test-storage.js',
            'test/fixtures/mock-timer.js',
            'test/unit/extension_mesh_v2_service.js'
        ],
        rules: {
            'no-unused-vars': 'off',
            'no-undefined': 'off',
            'jsdoc/no-undefined-types': 'off',
            'jsdoc/check-types': 'off',
            'jsdoc/reject-function-type': 'off',
            'jsdoc/require-returns': 'off',
            'jsdoc/check-tag-names': 'off',
            'jsdoc/require-returns-check': 'off',
            'jsdoc/valid-types': 'off',
            'jsdoc/check-param-names': 'off',
            'jsdoc/require-param-description': 'off',
            'jsdoc/require-param-type': 'off',
            'jsdoc/ts-no-empty-object-type': 'off',
            'jsdoc/check-property-names': 'off',
            'jsdoc/escape-inline-tags': 'off',
            'jsdoc/reject-any-type': 'off'
        }
    },
    {
        files: [
            'src/extensions/koshien/index.js',
            'src/extensions/microbitMore/ble-web.js',
            'src/extensions/microbitMore/index.js',
            'src/extensions/microbitMore/serial-web.js',
            'src/extensions/scratch3_mesh/index.js',
            'src/extensions/scratch3_smalrubot_s1/index.js',
            'src/io/ble.js'
        ],
        rules: {
            'jsdoc/no-undefined-types': 'off'
        }
    },
    {
        // upstream files with format-message warnings
        files: [
            'src/engine/runtime.js',
            'src/extension-support/extension-manager.js',
            'src/util/maybe-format-message.js'
        ],
        rules: {
            'format-message/literal-pattern': 'off',
            'format-message/literal-locale': 'off'
        }
    },
    // === Smalruby: Start of prettier integration ===
    // Must be last to disable formatting rules that conflict with prettier
    eslintConfigPrettier
    // === Smalruby: End of prettier integration ===
);
