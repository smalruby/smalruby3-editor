import {eslintConfigScratch} from 'eslint-config-scratch';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import {globalIgnores} from 'eslint/config';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import-x';

export default eslintConfigScratch.defineConfig(
    eslintConfigScratch.legacy.base,
    importPlugin.flatConfigs.errors,
    {
        files: ['*.{js,cjs,mjs,ts}', 'scripts/**/*.{js,cjs,mjs,ts}'],
        extends: [eslintConfigScratch.legacy.node],
        languageOptions: {
            globals: globals.node
        },
        rules: {
            'no-console': 'off'
        }
    },
    {
        files: ['{src,test}/**/*.{js,cjs,mjs,jsx,ts,tsx}'],
        extends: [
            eslintConfigScratch.legacy.es6,
            eslintConfigScratch.legacy.react,
            eslintConfigScratch.legacy.typescript
        ],
        languageOptions: {
            globals: {
                ...globals.browser,
                process: 'readonly'
            },
            parserOptions: {
                projectService: false,
                tsconfigRootDir: import.meta.dirname,
                project: [
                    'tsconfig.eslint.json',
                    'tsconfig.test.json'
                ]
            }
        },
        settings: {
            'react': {
                version: 'detect'
            },
            'import-x/resolver': {
                typescript: {
                    project: 'tsconfig.eslint.json'
                }
            }
        },
        rules: {
            // webpack inline loader syntax (e.g. `!raw-loader!./file.svg`) is not resolvable by the
            // TypeScript resolver; these are valid at runtime via webpack's loader pipeline
            'import-x/no-unresolved': ['error', {ignore: ['^!']}],

            // BEGIN: these caused trouble after upgrading eslint-plugin-react from 7.24.0 to 7.33.2
            'react/forbid-prop-types': 'warn',
            'react/no-unknown-property': 'warn',
            // END: these caused trouble after upgrading eslint-plugin-react from 7.24.0 to 7.33.2

            // we should probably just fix these...
            'arrow-parens': 'warn',
            'react/no-deprecated': 'warn',
            'require-atomic-updates': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', {
                args: 'after-used',
                argsIgnorePattern: '^_',
                caughtErrors: 'none', // TODO: use caughtErrorsPattern instead
                varsIgnorePattern: '^_'
            }],
            '@typescript-eslint/no-use-before-define': 'warn',
            '@typescript-eslint/prefer-promise-reject-errors': 'warn'
        }
    },
    {
        files: ['test/**/*.{js,cjs,mjs,jsx,ts,tsx}'],
        languageOptions: {
            globals: {
                ...globals.jest,
                ...globals.node
            }
        },
        rules: {
            'max-len': [
                'warn',
                // settings copied from eslint-config-scratch.legacy.base
                {
                    code: 120,
                    tabWidth: 4,
                    ignoreUrls: true
                }
            ],
            'react/prop-types': 'off' // don't worry about prop types in tests
        }
    },
    {
        // disable some checks for these generated files
        files: ['{src,test}/**/types.d.ts'],
        rules: {
            '@stylistic/indent': 'off'
        }
    },
    {
        files: [
            'src/lib/libraries/extensions/index.jsx',
            'src/lib/libraries/decks/*.js'
        ],
        rules: {
            // the way these files are built makes duplicate imports the natural way to do things
            'no-duplicate-imports': 'off'
        }
    },
    {
        // upstream files with jsdoc warnings
        files: ['src/lib/merge-dynamic-assets.js'],
        rules: {
            'jsdoc/check-types': 'off'
        }
    },
    {
        files: ['test/unit/util/define-dynamic-block.test.js'],
        settings: {
            // TODO: figure out why this is needed...
            // probably something with eslint-plugin-import-x's parser or resolver
            'import-x/core-modules': [
                '@smalruby/scratch-vm/src/extension-support/block-type'
            ]
        }
    },
    {
        files: ['src/locales/*.js'],
        rules: {
            'max-len': 'off'
        }
    },
    {
        files: ['{src,test}/**/*.{js,cjs,mjs,jsx,ts,tsx}'],
        ignores: [
            'src/components/block-display-modal/block-display-modal.jsx',
            'src/components/connection-modal/update-peripheral-step.jsx',
            'src/containers/block-display-modal.jsx',
            'src/containers/ruby-downloader.jsx',
            'src/lib/generator.js',
            'src/lib/google-drive-api.js',
            'src/lib/hash-parser-hoc.jsx',
            'src/lib/localization-hoc.jsx',
            'src/lib/microbit-more-update.js',
            'src/lib/project-fetcher-hoc.jsx',
            'src/lib/project-saver-hoc.jsx',
            'src/lib/query-parser-hoc.jsx',
            'src/lib/ruby-generator/boost.js',
            'src/lib/ruby-generator/colour.js',
            'src/lib/ruby-generator/control.js',
            'src/lib/ruby-generator/data.js',
            'src/lib/ruby-generator/ev3.js',
            'src/lib/ruby-generator/event.js',
            'src/lib/ruby-generator/gdx_for.js',
            'src/lib/ruby-generator/koshien.js',
            'src/lib/ruby-generator/looks.js',
            'src/lib/ruby-generator/makeymakey.js',
            'src/lib/ruby-generator/math.js',
            'src/lib/ruby-generator/mesh.js',
            'src/lib/ruby-generator/microbit.js',
            'src/lib/ruby-generator/microbit_more.js',
            'src/lib/ruby-generator/motion.js',
            'src/lib/ruby-generator/music.js',
            'src/lib/ruby-generator/operators.js',
            'src/lib/ruby-generator/pen.js',
            'src/lib/ruby-generator/procedure.js',
            'src/lib/ruby-generator/ruby.js',
            'src/lib/ruby-generator/sensing.js',
            'src/lib/ruby-generator/smalrubot_s1.js',
            'src/lib/ruby-generator/sound.js',
            'src/lib/ruby-generator/text.js',
            'src/lib/ruby-generator/text2speech.js',
            'src/lib/ruby-generator/translate.js',
            'src/lib/ruby-generator/video.js',
            'src/lib/ruby-generator/wedo2.js',
            'src/lib/ruby-to-blocks-converter/index.js',
            'src/lib/save-project-to-server.js',
            'src/lib/url-loader-hoc.jsx'
        ],
        rules: {
            'react/forbid-prop-types': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
            'jsdoc/check-tag-names': 'off',
            'jsdoc/reject-any-type': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'jsdoc/require-returns-check': 'off',
            'jsdoc/no-undefined-types': 'off',
            'react/no-unknown-property': 'off',
            'react/no-deprecated': 'off',
            'jsdoc/check-param-names': 'off',
            'jsdoc/reject-function-type': 'off',
            'jsdoc/require-returns': 'off',
            'jsdoc/require-param-description': 'off',
            'jsdoc/require-param-type': 'off',
            'jsdoc/valid-types': 'off',
            '@typescript-eslint/prefer-promise-reject-errors': 'off',
            'jsdoc/check-property-names': 'off'
        }
    },
    {
        files: [
            'src/components/block-display-modal/block-display-modal.jsx',
            'src/components/connection-modal/update-peripheral-step.jsx',
            'src/containers/block-display-modal.jsx',
            'src/containers/ruby-downloader.jsx',
            'src/lib/generator.js',
            'src/lib/google-drive-api.js',
            'src/lib/hash-parser-hoc.jsx',
            'src/lib/localization-hoc.jsx',
            'src/lib/microbit-more-update.js',
            'src/lib/project-fetcher-hoc.jsx',
            'src/lib/project-saver-hoc.jsx',
            'src/lib/query-parser-hoc.jsx',
            'src/lib/ruby-generator/boost.js',
            'src/lib/ruby-generator/colour.js',
            'src/lib/ruby-generator/control.js',
            'src/lib/ruby-generator/data.js',
            'src/lib/ruby-generator/ev3.js',
            'src/lib/ruby-generator/event.js',
            'src/lib/ruby-generator/gdx_for.js',
            'src/lib/ruby-generator/koshien.js',
            'src/lib/ruby-generator/looks.js',
            'src/lib/ruby-generator/makeymakey.js',
            'src/lib/ruby-generator/math.js',
            'src/lib/ruby-generator/mesh.js',
            'src/lib/ruby-generator/microbit.js',
            'src/lib/ruby-generator/microbit_more.js',
            'src/lib/ruby-generator/motion.js',
            'src/lib/ruby-generator/music.js',
            'src/lib/ruby-generator/operators.js',
            'src/lib/ruby-generator/pen.js',
            'src/lib/ruby-generator/procedure.js',
            'src/lib/ruby-generator/ruby.js',
            'src/lib/ruby-generator/sensing.js',
            'src/lib/ruby-generator/smalrubot_s1.js',
            'src/lib/ruby-generator/sound.js',
            'src/lib/ruby-generator/text.js',
            'src/lib/ruby-generator/text2speech.js',
            'src/lib/ruby-generator/translate.js',
            'src/lib/ruby-generator/video.js',
            'src/lib/ruby-generator/wedo2.js',
            'src/lib/ruby-to-blocks-converter/index.js',
            'src/lib/save-project-to-server.js',
            'src/lib/url-loader-hoc.jsx'
        ],
        rules: {
            'jsdoc/no-undefined-types': 'off'
        }
    },
    globalIgnores([
        'build/**/*',
        'dist/**/*',
        'node_modules/**/*',
        'static/**/*',
        'test/**/*',
        'src/examples/**/*',
        'coverage/**/*'
    ]),
    // === Smalruby: Start of prettier integration ===
    // Must be last to disable formatting rules that conflict with prettier
    eslintConfigPrettier
    // === Smalruby: End of prettier integration ===
);
