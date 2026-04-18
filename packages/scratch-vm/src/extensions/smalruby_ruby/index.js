// === Smalruby: This file is Smalruby-specific (Ruby extension) ===

const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');
const Variable = require('../../engine/variable');
const translations = require('./translations.json');

/**
 * Icon svg to be displayed at the left edge of each extension block, encoded as a data URI.
 * Source: ./ruby-logo-icon.svg
 *   (derived from the official Ruby logo, with "PROGRAMMING Language" text removed)
 * To regenerate: base64 ruby-logo-icon.svg, then prepend
 *   "data:image/svg+xml;base64,".
 * @type {string}
 */

const blockIconURI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMTY4IiBoZWlnaHQ9IjE2OCIgdmlld0JveD0iMzAgMCAxNjggMTY4IiBvdmVyZmxvdz0idmlzaWJsZSI+IDxnIGlkPSJMYXllcl8xIj4gPGxpbmVhckdyYWRpZW50IGlkPSJYTUxJRF8xXyIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIHgxPSIxMTQuMDEwNyIgeTE9IjYuMjk1OSIgeDI9IjExNC4wMTA3IiB5Mj0iMTU5LjA2NjkiPiA8c3RvcCBvZmZzZXQ9IjAiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMzBDMDAiLz4gPHN0b3Agb2Zmc2V0PSIwLjA2MzUiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMzBDMDAiLz4gPHN0b3Agb2Zmc2V0PSIwLjQ0OTQiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMzBDMDAiLz4gPHN0b3Agb2Zmc2V0PSIxIiBzdHlsZT0ic3RvcC1jb2xvcjojRkY0MTAwIi8+IDwvbGluZWFyR3JhZGllbnQ+IDxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBmaWxsPSJ1cmwoI1hNTElEXzFfKSIgZD0iTTE4MC42NiwxNTEuNDY5IGMwLjE1LDUuOTgyLTMuMjU0LDcuNTk4LTcuMjcxLDcuNTk4SDU0LjYzMmMtNC4wMTYsMC03LjI3MS0zLjQwMi03LjI3MS03LjU5OFYxMy45NDljMC00LjE5NSwyLjAxOC04LjE4NCw3LjI1Mi03LjY1MyBsMTE4Ljc3NiwwLjA1N2M0LjAxOCwwLDcuMjcxLDMuNDAxLDcuMjcxLDcuNTk2VjE1MS40Njl6Ii8+IDxnPiA8ZGVmcz4gPHBhdGggaWQ9IlhNTElEXzJfIiBkPSJNMTgwLjY3LDE1Mi4wMTRjMCw0LjY1Ni0yLjU5NCw3LjI2Ni03Ljc2Niw3LjAzMWwtMTE3LjgzMSwwLjAzOWMtNS4xNzIsMC4yMzUtNy43NjYtMi4zNzQtNy43NjYtNy4wM1YxMy4wMjZjMC0zLjg3NywyLjU4My03LjQ0LDcuNjk3LTcuMDMxTDE3Mi45MDQsNi4wOWMzLjQ5Ni0wLjI5OCw3Ljc2NiwyLjUxNCw3Ljc2Niw2Ljk3VjE1Mi4wMTR6Ii8+IDwvZGVmcz4gPGNsaXBQYXRoIGlkPSJYTUxJRF8zXyI+IDx1c2UgeGxpbms6aHJlZj0iI1hNTElEXzJfIiBvdmVyZmxvdz0idmlzaWJsZSIvPiA8L2NsaXBQYXRoPiA8ZyBjbGlwLXBhdGg9InVybCgjWE1MSURfM18pIj4gPHBhdGggZmlsbD0iI0ZGNDQwMiIgZD0iTTk3LjA0Nyw5LjA1N2MzNy45NDctMi4xNjMsNDcuMjI0LDQuMDc4LDUwLjYxNCw4LjUxIGMzLjM4OSw0LjQzMSwzLjM4OSwyNC40NjcsMS4yNCwyNy4xNzVjLTIuMTQ5LDIuNzA4LTcuOTgzLDMuMzUtMTIuNjI1LDYuNjk4IGMtNC42NDIsMy4zNS04LjE4OSw3Ljk4LTguMTg5LDcuOThzOC45NzMsNC43MTQsMTIuMzYyLDguNzQ1YzMuMzg5LDQuMDMxLDQuMTY5LDEyLjY1NCw0LjE2OSwxNy4xMzIgYzAsNC40NzgtMi4xMSwxMy43MDEtNi4wMjksMTcuNzczYy0zLjkyLDQuMDcyLTYuNTA2LDQuMTM0LTExLjE1LDcuNDg0Yy00LjY0MiwzLjM1LTEyLjkzMyw1LjQyNS0yMy45ODMsNy4zOTYgYy0xMS4wNSwxLjk3Mi0yNy4yMTIsMS4zNS0zNy4wNTktMC42MjNjLTkuODQ4LTEuOTcyLTE1LjkxMi0zLjMwMy0yMi40MTUtNy4zNzUgYy02LjUwNC00LjA3Mi0xMS4xNDctOC41MDItMTQuNTM4LTE0Ljc0MWMtMy4zODktNi4yMzktMy44MDktMTIuMjMtMy4xNzktMTcuOTc4IGMwLjYzLTUuNzQ4LDIuNjk2LTEwLjcyOCw2LjA4NC0xNC44YzMuMzg5LTQuMDcyLDEwLjg0My04LjcyNCwxMC44NDMtOC43MjRzLTUuMjcyLTMuOTg3LTguMDc0LTcuMjY1IGMtMi44MDQtMy4yNzktMy4yNjItNy4yNTktMi42MzItMTAuNTM4YzAuNjMtMy4yNzksMy40NjktOS44NzksOC40NDYtMTQuNTEgYzQuOTc3LTQuNjMyLDE0LjE0NC04Ljg3NiwyMi42NTktMTEuMTM0QzgyLjA0MywxMC42NTksOTIuNjA2LDkuMzEsOTcuMDQ3LDkuMDU3eiIvPiA8L2c+IDwvZz4gPGc+IDxwYXRoIGZpbGw9IiNGRkZGRkYiIGQ9Ik0xMjIuMjg2LDcyLjU5MWwtMjguNzA3LDBsMC4wMjUsNzMuODQ3TDU4Ljc2Miw3My4wOWwtMC4wMDMtMC4xNjlsLTAuMDAyLTAuMTY2IGwwLjAyMy0zNi4xODloMjguNjI4bDAuMDQxLTI2LjUwOEw1OC44MTUsOS42MDhMNTguODIzLDkuNDRsNjMuNDM0LDAuMDA0bDAuMDI5LDYzLjE0N1oiLz4gPHBhdGggZmlsbD0iI0ZGRkZGRiIgZD0iTTE2Ny4yNSwxNTIuMDE0YzAsNC42NTYtMi41OTQsNy4yNjYtNy43NjYsNy4wMzFsLTMwLjA4OSwwLjAzOSBjMC04LjcxOSwwLjAwMS0yMi43NTQsMC4wMDEtMjIuNzU0bC0zNS44LTAuMDMzbDAuMDktMjYuNTQ3bDY1LjgxMSwwbDAuMDE1LDYuNjU5IEwxNjcuMjUsMTUyLjAxNHoiLz4gPC9nPiA8L2c+IDwvc3ZnPg==';

const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(
            localeSetup.translations[localeSetup.locale],
            translations[localeSetup.locale]
        );
    }
};

class SmalrubyRubyBlocks {
    static get CATEGORY_NAME () {
        return 'Ruby';
    }

    static get EXTENSION_ID () {
        return 'smalrubyRuby';
    }

    constructor (runtime) {
        this.runtime = runtime;
        if (formatMessage) setupTranslations();
    }

    getInfo () {
        setupTranslations();
        return {
            id: SmalrubyRubyBlocks.EXTENSION_ID,
            name: formatMessage({
                id: 'smalrubyRuby.categoryName',
                default: 'Ruby',
                description: 'Label for the ruby extension category'
            }),
            blockIconURI: blockIconURI,
            blocks: [
                // --- String method (COMMAND, isDynamic) ---
                {
                    opcode: 'stringMethod',
                    text: formatMessage({
                        id: 'smalrubyRuby.stringMethod',
                        default: 'String [RECEIVER] . [METHOD]',
                        description: 'String method call'
                    }),
                    blockType: BlockType.COMMAND,
                    isDynamic: true,
                    arguments: {
                        RECEIVER: {
                            type: ArgumentType.STRING,
                            defaultValue: 'hello'
                        },
                        METHOD: {
                            type: ArgumentType.STRING,
                            menu: 'stringMethodMenu',
                            defaultValue: 'reverse'
                        }
                    },
                    argumentsByMethod: {
                        reverse: {
                            text: 'String [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'hello'},
                                METHOD: {type: ArgumentType.STRING, menu: 'stringMethodMenu', defaultValue: 'reverse'}
                            }
                        },
                        upcase: {
                            text: 'String [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'hello'},
                                METHOD: {type: ArgumentType.STRING, menu: 'stringMethodMenu', defaultValue: 'upcase'}
                            }
                        },
                        downcase: {
                            text: 'String [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'Hello'},
                                METHOD: {type: ArgumentType.STRING, menu: 'stringMethodMenu', defaultValue: 'downcase'}
                            }
                        },
                        'empty?': {
                            text: 'String [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: ''},
                                METHOD: {type: ArgumentType.STRING, menu: 'stringMethodMenu', defaultValue: 'empty?'}
                            }
                        },
                        lines: {
                            text: 'String [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'hello'},
                                METHOD: {type: ArgumentType.STRING, menu: 'stringMethodMenu', defaultValue: 'lines'}
                            }
                        },
                        delete: {
                            text: 'String [RECEIVER] . [METHOD] ( [ARG1] )',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'hello'},
                                METHOD: {type: ArgumentType.STRING, menu: 'stringMethodMenu', defaultValue: 'delete'},
                                ARG1: {type: ArgumentType.STRING, defaultValue: 'l'}
                            }
                        },
                        gsub: {
                            text: 'String [RECEIVER] . [METHOD] ( [ARG1] , [ARG2] )',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'hello'},
                                METHOD: {type: ArgumentType.STRING, menu: 'stringMethodMenu', defaultValue: 'gsub'},
                                ARG1: {type: ArgumentType.STRING, defaultValue: 'l'},
                                ARG2: {type: ArgumentType.STRING, defaultValue: 'r'}
                            }
                        },
                        'reverse!': {
                            text: 'String [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, menu: 'variableNames', defaultValue: ' '},
                                METHOD: {type: ArgumentType.STRING, menu: 'stringMethodMenu', defaultValue: 'reverse!'}
                            }
                        },
                        'delete!': {
                            text: 'String [RECEIVER] . [METHOD] ( [ARG1] )',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, menu: 'variableNames', defaultValue: ' '},
                                METHOD: {type: ArgumentType.STRING, menu: 'stringMethodMenu', defaultValue: 'delete!'},
                                ARG1: {type: ArgumentType.STRING, defaultValue: 'l'}
                            }
                        },
                        'gsub!': {
                            text: 'String [RECEIVER] . [METHOD] ( [ARG1] , [ARG2] )',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, menu: 'variableNames', defaultValue: ' '},
                                METHOD: {type: ArgumentType.STRING, menu: 'stringMethodMenu', defaultValue: 'gsub!'},
                                ARG1: {type: ArgumentType.STRING, defaultValue: 'l'},
                                ARG2: {type: ArgumentType.STRING, defaultValue: 'r'}
                            }
                        }
                    },
                    menuItems: {
                        stringMethodMenu: [
                            ['reverse', 'reverse'], ['upcase', 'upcase'], ['downcase', 'downcase'],
                            ['empty?', 'empty?'], ['lines', 'lines'],
                            ['delete', 'delete'], ['gsub', 'gsub'],
                            ['reverse!', 'reverse!'], ['delete!', 'delete!'], ['gsub!', 'gsub!']
                        ]
                    }
                },
                // --- Array method (COMMAND, isDynamic) ---
                {
                    opcode: 'arrayMethod',
                    text: formatMessage({
                        id: 'smalrubyRuby.arrayMethod',
                        default: 'Array [RECEIVER] . [METHOD]',
                        description: 'Array method call'
                    }),
                    blockType: BlockType.COMMAND,
                    isDynamic: true,
                    arguments: {
                        RECEIVER: {
                            type: ArgumentType.STRING,
                            defaultValue: 'list'
                        },
                        METHOD: {
                            type: ArgumentType.STRING,
                            menu: 'arrayMethodMenu',
                            defaultValue: 'max'
                        }
                    },
                    argumentsByMethod: {
                        max: {
                            text: 'Array [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {type: ArgumentType.STRING, menu: 'arrayMethodMenu', defaultValue: 'max'}
                            }
                        },
                        min: {
                            text: 'Array [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {type: ArgumentType.STRING, menu: 'arrayMethodMenu', defaultValue: 'min'}
                            }
                        },
                        sort: {
                            text: 'Array [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {type: ArgumentType.STRING, menu: 'arrayMethodMenu', defaultValue: 'sort'}
                            }
                        },
                        reverse: {
                            text: 'Array [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {type: ArgumentType.STRING, menu: 'arrayMethodMenu', defaultValue: 'reverse'}
                            }
                        },
                        first: {
                            text: 'Array [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {type: ArgumentType.STRING, menu: 'arrayMethodMenu', defaultValue: 'first'}
                            }
                        },
                        last: {
                            text: 'Array [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {type: ArgumentType.STRING, menu: 'arrayMethodMenu', defaultValue: 'last'}
                            }
                        },
                        'empty?': {
                            text: 'Array [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {type: ArgumentType.STRING, menu: 'arrayMethodMenu', defaultValue: 'empty?'}
                            }
                        },
                        join: {
                            text: 'Array [RECEIVER] . [METHOD] ( [ARG1] )',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'list'},
                                METHOD: {type: ArgumentType.STRING, menu: 'arrayMethodMenu', defaultValue: 'join'},
                                ARG1: {type: ArgumentType.STRING, defaultValue: ''}
                            }
                        },
                        'sort!': {
                            text: 'Array [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, menu: 'variableNames', defaultValue: ' '},
                                METHOD: {type: ArgumentType.STRING, menu: 'arrayMethodMenu', defaultValue: 'sort!'}
                            }
                        },
                        'reverse!': {
                            text: 'Array [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, menu: 'variableNames', defaultValue: ' '},
                                METHOD: {type: ArgumentType.STRING, menu: 'arrayMethodMenu', defaultValue: 'reverse!'}
                            }
                        }
                    },
                    menuItems: {
                        arrayMethodMenu: [
                            ['max', 'max'], ['min', 'min'], ['sort', 'sort'],
                            ['reverse', 'reverse'], ['first', 'first'], ['last', 'last'],
                            ['empty?', 'empty?'], ['join', 'join'],
                            ['sort!', 'sort!'], ['reverse!', 'reverse!']
                        ]
                    }
                },
                // --- Hash method (COMMAND, isDynamic) ---
                {
                    opcode: 'hashMethod',
                    text: formatMessage({
                        id: 'smalrubyRuby.hashMethod',
                        default: 'Hash [RECEIVER] . [METHOD]',
                        description: 'Hash method call'
                    }),
                    blockType: BlockType.COMMAND,
                    isDynamic: true,
                    arguments: {
                        RECEIVER: {
                            type: ArgumentType.STRING,
                            defaultValue: 'hash'
                        },
                        METHOD: {
                            type: ArgumentType.STRING,
                            menu: 'hashMethodMenu',
                            defaultValue: 'keys'
                        }
                    },
                    argumentsByMethod: {
                        keys: {
                            text: 'Hash [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'hash'},
                                METHOD: {type: ArgumentType.STRING, menu: 'hashMethodMenu', defaultValue: 'keys'}
                            }
                        },
                        values: {
                            text: 'Hash [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'hash'},
                                METHOD: {type: ArgumentType.STRING, menu: 'hashMethodMenu', defaultValue: 'values'}
                            }
                        },
                        'empty?': {
                            text: 'Hash [RECEIVER] . [METHOD]',
                            arguments: {
                                RECEIVER: {type: ArgumentType.STRING, defaultValue: 'hash'},
                                METHOD: {type: ArgumentType.STRING, menu: 'hashMethodMenu', defaultValue: 'empty?'}
                            }
                        }
                    },
                    menuItems: {
                        hashMethodMenu: [
                            ['keys', 'keys'], ['values', 'values'], ['empty?', 'empty?']
                        ]
                    }
                },
                // --- Return value (REPORTER) ---
                {
                    opcode: 'returnValue',
                    text: formatMessage({
                        id: 'smalrubyRuby.returnValue',
                        default: 'return value',
                        description: 'Return value of the last Ruby method call'
                    }),
                    blockType: BlockType.REPORTER,
                    disableMonitor: true
                },
                // --- Return value truthy? (BOOLEAN) ---
                {
                    opcode: 'returnValueTruthy',
                    text: formatMessage({
                        id: 'smalrubyRuby.returnValueTruthy',
                        default: 'return value truthy?',
                        description: 'Whether the return value is truthy (Ruby semantics: nil/false are falsy)'
                    }),
                    blockType: BlockType.BOOLEAN,
                    disableMonitor: true
                }
            ],
            menus: {
                stringMethodMenu: {
                    acceptReporters: false,
                    items: [
                        {text: 'reverse', value: 'reverse'}, {text: 'upcase', value: 'upcase'},
                        {text: 'downcase', value: 'downcase'}, {text: 'empty?', value: 'empty?'},
                        {text: 'lines', value: 'lines'},
                        {text: 'delete', value: 'delete'}, {text: 'gsub', value: 'gsub'},
                        {text: 'reverse!', value: 'reverse!'}, {text: 'delete!', value: 'delete!'},
                        {text: 'gsub!', value: 'gsub!'}
                    ]
                },
                arrayMethodMenu: {
                    acceptReporters: false,
                    items: [
                        {text: 'max', value: 'max'}, {text: 'min', value: 'min'},
                        {text: 'sort', value: 'sort'}, {text: 'reverse', value: 'reverse'},
                        {text: 'first', value: 'first'}, {text: 'last', value: 'last'},
                        {text: 'empty?', value: 'empty?'}, {text: 'join', value: 'join'},
                        {text: 'sort!', value: 'sort!'}, {text: 'reverse!', value: 'reverse!'}
                    ]
                },
                hashMethodMenu: {
                    acceptReporters: false,
                    items: [
                        {text: 'keys', value: 'keys'}, {text: 'values', value: 'values'},
                        {text: 'empty?', value: 'empty?'}
                    ]
                },
                variableNames: {
                    acceptReporters: false,
                    items: 'getVariableNamesMenuItems'
                }
            },
            translationMap: translations
        };
    }

    // --- Thread-local return value helpers ---

    /**
     * Store a return value on the current thread.
     * @param {object} util - Block utility (has util.thread).
     * @param {*} value - The value to store.
     */
    _setReturnValue (util, value) {
        util.thread._smalrubyReturnValue = value;
    }

    /**
     * Get the return value from the current thread.
     * @param {object} util - Block utility.
     * @returns {*} The stored return value, or '' if none.
     */
    _getReturnValue (util) {
        const rv = util.thread._smalrubyReturnValue;
        return (rv === undefined || rv === null) ? '' : rv;
    }

    // --- Return value blocks ---

    returnValue (_args, util) {
        return this._getReturnValue(util);
    }

    returnValueTruthy (_args, util) {
        const rv = util.thread._smalrubyReturnValue;
        // Ruby truthiness: nil and false are falsy, everything else is truthy
        if (rv === null || rv === undefined || rv === false || rv === 'false' || rv === '') {
            return false;
        }
        return true;
    }

    // --- String methods ---

    stringMethod (args, util) {
        const method = args.METHOD;
        const arg1 = args.ARG1;
        const arg2 = args.ARG2;
        let result;

        if (method.endsWith('!')) {
            // Bang method: receiver is variable name
            const variableName = args.RECEIVER;
            const target = util.target;
            const variable = target.lookupVariableByNameAndType(variableName, Variable.SCALAR_TYPE);
            if (!variable) {
                this._setReturnValue(util, '');
                return;
            }
            const string = String(variable.value || '');
            switch (method) {
            case 'reverse!':
                result = string.split('').reverse().join('');
                break;
            case 'delete!':
                result = string.split('').filter(c => !String(arg1 || '').includes(c)).join('');
                break;
            case 'gsub!':
                result = (arg2 === undefined) ? string : string.replaceAll(String(arg1 || ''), String(arg2));
                break;
            default:
                result = string;
            }
            variable.value = result;
        } else {
            // Non-bang method: receiver is value
            const string = String(args.RECEIVER || '');
            switch (method) {
            case 'reverse':
                result = string.split('').reverse().join('');
                break;
            case 'upcase':
                result = string.toUpperCase();
                break;
            case 'downcase':
                result = string.toLowerCase();
                break;
            case 'empty?':
                result = string === '';
                break;
            case 'lines':
                result = string.split('\n').filter((_, i, a) => i < a.length - 1 || _ !== '')
                    .map(l => `${l}\n`).join(' ');
                break;
            case 'delete':
                result = string.split('').filter(c => !String(arg1 || '').includes(c)).join('');
                break;
            case 'gsub':
                result = (arg2 === undefined) ? string : string.replaceAll(String(arg1 || ''), String(arg2));
                break;
            default:
                result = string;
            }
        }
        this._setReturnValue(util, result);
    }

    // --- Array methods ---

    arrayMethod (args, util) {
        const method = args.METHOD;
        const arg1 = args.ARG1;

        // Parse list contents (space-separated from data_listcontents)
        const toItems = s => (s === '' ? [] : String(s).split(' '));

        if (method.endsWith('!')) {
            // Bang method: receiver is variable name, modify list in place
            const variableName = args.RECEIVER;
            const target = util.target;
            const listVar = target.lookupVariableByNameAndType(variableName, Variable.LIST_TYPE);
            if (!listVar) {
                this._setReturnValue(util, '');
                return;
            }
            const items = listVar.value;
            let result;
            switch (method) {
            case 'sort!': {
                const nums = items.map(Number);
                if (nums.every(n => !isNaN(n))) {
                    items.sort((a, b) => Number(a) - Number(b));
                } else {
                    items.sort();
                }
                result = items.join(' ');
                break;
            }
            case 'reverse!':
                items.reverse();
                result = items.join(' ');
                break;
            default:
                result = items.join(' ');
            }
            this._setReturnValue(util, result);
        } else {
            // Non-bang method: receiver is list contents string
            const string = String(args.RECEIVER || '');
            const items = toItems(string);
            let result;
            switch (method) {
            case 'max': {
                if (items.length === 0) { result = ''; break; }
                const nums = items.map(Number);
                result = nums.every(n => !isNaN(n))
                    ? String(Math.max(...nums))
                    : items.reduce((a, b) => (a > b ? a : b));
                break;
            }
            case 'min': {
                if (items.length === 0) { result = ''; break; }
                const nums = items.map(Number);
                result = nums.every(n => !isNaN(n))
                    ? String(Math.min(...nums))
                    : items.reduce((a, b) => (a < b ? a : b));
                break;
            }
            case 'sort': {
                const nums = items.map(Number);
                result = nums.every(n => !isNaN(n))
                    ? nums.sort((a, b) => a - b).join(' ')
                    : items.sort().join(' ');
                break;
            }
            case 'reverse':
                result = items.slice().reverse().join(' ');
                break;
            case 'first':
                result = items.length > 0 ? items[0] : '';
                break;
            case 'last':
                result = items.length > 0 ? items[items.length - 1] : '';
                break;
            case 'empty?':
                result = items.length === 0;
                break;
            case 'join':
                result = items.join(arg1 === undefined ? '' : String(arg1));
                break;
            default:
                result = string;
            }
            this._setReturnValue(util, result);
        }
    }

    // --- Hash methods ---

    hashMethod (args, util) {
        const method = args.METHOD;
        const string = String(args.RECEIVER || '');
        let result;
        switch (method) {
        case 'keys':
        case 'values':
            // Receiver is list contents from the keys/values sub-list
            result = string;
            break;
        case 'empty?':
            result = string === '';
            break;
        default:
            result = string;
        }
        this._setReturnValue(util, result);
    }

    // --- Variable names menu ---

    getVariableNamesMenuItems () {
        const sprite = this.runtime.getEditingTarget();
        if (!sprite) return [' '];
        return [' '].concat(sprite.getAllVariableNamesInScopeByType(Variable.SCALAR_TYPE));
    }
}

module.exports = SmalrubyRubyBlocks;
