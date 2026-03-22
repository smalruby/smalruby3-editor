// === Smalruby: This file is Smalruby-specific (Ruby String extension) ===

const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const formatMessage = require('format-message');
const Variable = require('../../engine/variable');
const translations = require('./translations.json');

/**
 * Setup format-message for this extension.
 */
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
    static get EXTENSION_NAME () {
        return 'Ruby';
    }

    static get EXTENSION_ID () {
        return 'ruby';
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
                id: 'ruby.categoryName',
                default: 'Ruby',
                description: 'Label for the ruby extension category'
            }),
            blocks: [
                {
                    opcode: 'stringMethodR',
                    text: formatMessage({
                        id: 'ruby.stringMethodR',
                        default: '\u6587\u5b57\u5217 [STRING] . [METHOD] ( [ARG1] )',
                        description: 'String method that returns a value'
                    }),
                    blockType: BlockType.REPORTER,
                    isDynamic: true,
                    arguments: {
                        STRING: {
                            type: ArgumentType.STRING,
                            defaultValue: 'hello world'
                        },
                        METHOD: {
                            type: ArgumentType.STRING,
                            menu: 'stringMethodRMenu',
                            defaultValue: 'delete'
                        },
                        ARG1: {
                            type: ArgumentType.STRING,
                            defaultValue: 'l'
                        }
                    },
                    argumentsByMethod: {
                        delete: {
                            text: formatMessage({
                                id: 'ruby.stringMethodR',
                                default: '\u6587\u5b57\u5217 [STRING] . [METHOD] ( [ARG1] )',
                                description: 'String method that returns a value'
                            }),
                            arguments: {
                                STRING: {type: ArgumentType.STRING, defaultValue: 'hello world'},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'stringMethodRMenu',
                                    defaultValue: 'delete'
                                },
                                ARG1: {type: ArgumentType.STRING, defaultValue: 'l'}
                            }
                        }
                    },
                    menuItems: {
                        stringMethodRMenu: [['delete', 'delete']]
                    }
                },
                {
                    opcode: 'stringMethodC',
                    text: formatMessage({
                        id: 'ruby.stringMethodC',
                        default: '\u6587\u5b57\u5217 [STRING] . [METHOD] ( [ARG1] )',
                        description: 'String method that does not return a value'
                    }),
                    blockType: BlockType.COMMAND,
                    isDynamic: true,
                    arguments: {
                        STRING: {
                            type: ArgumentType.STRING,
                            menu: 'variableNames',
                            defaultValue: ' '
                        },
                        METHOD: {
                            type: ArgumentType.STRING,
                            menu: 'stringMethodCMenu',
                            defaultValue: 'delete!'
                        },
                        ARG1: {
                            type: ArgumentType.STRING,
                            defaultValue: 'l'
                        }
                    },
                    argumentsByMethod: {
                        'delete!': {
                            text: formatMessage({
                                id: 'ruby.stringMethodC',
                                default: '\u6587\u5b57\u5217 [STRING] . [METHOD] ( [ARG1] )',
                                description: 'String method that does not return a value'
                            }),
                            arguments: {
                                STRING: {type: ArgumentType.STRING, menu: 'variableNames', defaultValue: ' '},
                                METHOD: {
                                    type: ArgumentType.STRING,
                                    menu: 'stringMethodCMenu',
                                    defaultValue: 'delete!'
                                },
                                ARG1: {type: ArgumentType.STRING, defaultValue: 'l'}
                            }
                        }
                    },
                    menuItems: {
                        stringMethodCMenu: [['delete!', 'delete!']]
                    }
                }
            ],
            menus: {
                stringMethodRMenu: {
                    acceptReporters: false,
                    items: [
                        {text: 'delete', value: 'delete'}
                    ]
                },
                stringMethodCMenu: {
                    acceptReporters: false,
                    items: [
                        {text: 'delete!', value: 'delete!'}
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

    /**
     * Execute string method that returns a value (REPORTER).
     * @param {object} args - block arguments.
     * @param {string} args.STRING - the target string.
     * @param {string} args.METHOD - the method name.
     * @param {string} args.ARG1 - the first argument.
     * @returns {string} the result string.
     */
    stringMethodR (args) {
        const string = String(args.STRING || '');
        const method = args.METHOD;
        const arg1 = String(args.ARG1 || '');
        switch (method) {
        case 'delete':
            return string.split('')
                .filter(c => !arg1.includes(c))
                .join('');
        default:
            return string;
        }
    }

    /**
     * Execute string method that modifies a variable in place (COMMAND).
     * STRING is a variable name (from the variableNames menu).
     * @param {object} args - block arguments.
     * @param {string} args.STRING - the variable name.
     * @param {string} args.METHOD - the method name.
     * @param {string} args.ARG1 - the first argument.
     * @param {object} util - block utility object.
     */
    stringMethodC (args, util) {
        const variableName = args.STRING;
        const target = util.target;
        const variable = target.lookupVariableByNameAndType(variableName, Variable.SCALAR_TYPE);
        if (!variable) return;

        const string = String(variable.value || '');
        const method = args.METHOD;
        const arg1 = String(args.ARG1 || '');
        let result;
        switch (method) {
        case 'delete!':
            result = string.split('')
                .filter(c => !arg1.includes(c))
                .join('');
            break;
        default:
            result = string;
        }
        variable.value = result;
    }

    /**
     * Get variable names for the variableNames menu.
     * @returns {Array<string>} list of variable names.
     */
    getVariableNamesMenuItems () {
        const sprite = this.runtime.getEditingTarget();
        if (!sprite) return [' '];
        return [' '].concat(sprite.getAllVariableNamesInScopeByType(Variable.SCALAR_TYPE));
    }
}

module.exports = SmalrubyRubyBlocks;
