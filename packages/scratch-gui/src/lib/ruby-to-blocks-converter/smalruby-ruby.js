// === Smalruby: This file is Smalruby-specific (Ruby method extension converter) ===

import { convertToListBlock } from './variable-hash-ops';
import { messages } from './converter-errors';

/**
 * Build blockInfo mutation data for isDynamic string method blocks.
 * The mutation must contain the full blockInfo so that domToMutation
 * can reconstruct the block's inputs.
 * @param {string} blockType - 'reporter' or 'command'.
 * @param {string} method - the Ruby method name (e.g. 'delete', 'delete!').
 * @param {string} menuName - the menu name for the METHOD dropdown.
 * @param {object} argumentsByMethod - the argumentsByMethod config.
 * @param {object} menuItems - the menuItems config.
 * @returns {object} mutation object for _createBlock.
 */
const buildMutation = function (blockType, method, menuName, argumentsByMethod, menuItems) {
    const config = argumentsByMethod[method];
    const blockInfo = {
        blockType,
        isDynamic: true,
        text: config.text,
        arguments: config.arguments,
        argumentsByMethod,
        menuItems
    };
    return {
        tagName: 'mutation',
        children: [],
        blockInfo: blockInfo,
        warp: 'false'
    };
};

// Shared argumentsByMethod configs
const methodRArgs = {
    reverse: {
        text: '文字列 [STRING] . [METHOD]',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'methodRMenu', defaultValue: 'reverse'},
        }
    },
    delete: {
        text: '文字列 [STRING] . [METHOD] ( [ARG1] )',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'methodRMenu', defaultValue: 'delete'},
            ARG1: {type: 'string', defaultValue: 'arg1'}
        }
    },
    gsub: {
        text: '文字列 [STRING] . [METHOD] ( [ARG1] [ARG2] )',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'methodRMenu', defaultValue: 'gsub'},
            ARG1: {type: 'string', defaultValue: 'arg1'},
            ARG2: {type: 'string', defaultValue: 'arg2'}
        }
    },
    lines: {
        text: '[STRING] . [METHOD]',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'methodRMenu', defaultValue: 'lines'},
        }
    },
    max: {
        text: '[STRING] . [METHOD]',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'methodRMenu', defaultValue: 'max'},
        }
    },
    sort: {
        text: '[STRING] . [METHOD]',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'methodRMenu', defaultValue: 'sort'},
        }
    },
    join: {
        text: '[STRING] . [METHOD] ( [ARG1] )',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'methodRMenu', defaultValue: 'join'},
            ARG1: {type: 'string', defaultValue: ''}
        }
    },
    keys: {
        text: '[STRING] . [METHOD]',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'methodRMenu', defaultValue: 'keys'},
        }
    },
    values: {
        text: '[STRING] . [METHOD]',
        arguments: {
            STRING: {type: 'string', defaultValue: ''},
            METHOD: {type: 'string', menu: 'methodRMenu', defaultValue: 'values'},
        }
    }
};

const methodCArgs = {
    'delete!': {
        text: '文字列 [STRING] . [METHOD] ( [ARG1] )',
        arguments: {
            STRING: {type: 'string', menu: 'variableNames', defaultValue: ' '},
            METHOD: {type: 'string', menu: 'methodCMenu', defaultValue: 'delete!'},
            ARG1: {type: 'string', defaultValue: 'arg1'}
        }
    },
    'gsub!': {
        text: '文字列 [STRING] . [METHOD] ( [ARG1] [ARG2] )',
        arguments: {
            STRING: {type: 'string', menu: 'variableNames', defaultValue: ' '},
            METHOD: {type: 'string', menu: 'methodCMenu', defaultValue: 'gsub!'},
            ARG1: {type: 'string', defaultValue: 'arg1'},
            ARG2: {type: 'string', defaultValue: 'arg2'}
        }
    },
    'sort!': {
        text: '[STRING] . [METHOD]',
        arguments: {
            STRING: {type: 'string', menu: 'variableNames', defaultValue: ' '},
            METHOD: {type: 'string', menu: 'methodCMenu', defaultValue: 'sort!'},
        }
    },
    'reverse!': {
        text: '[STRING] . [METHOD]',
        arguments: {
            STRING: {type: 'string', menu: 'variableNames', defaultValue: ' '},
            METHOD: {type: 'string', menu: 'methodCMenu', defaultValue: 'reverse!'},
        }
    }
};

const methodRMenuItems = {methodRMenu: [
    ['reverse', 'reverse'], ['delete', 'delete'], ['gsub', 'gsub'], ['lines', 'lines'],
    ['max', 'max'], ['sort', 'sort'], ['join', 'join'],
    ['keys', 'keys'], ['values', 'values']
]};
const methodCMenuItems = {methodCMenu: [
    ['delete!', 'delete!'], ['gsub!', 'gsub!'], ['sort!', 'sort!'], ['reverse!', 'reverse!']
]};

/**
 * Converter for Smalruby Ruby String extension blocks.
 */
const SmalrubyRubyConverter = {
    register: function (converter) {
        // String#reverse (returns value - REPORTER, 0 args)
        converter.registerOnSend(['string', 'block', 'variable'], 'reverse', 0, params => {
            const {receiver} = params;

            const mutation = buildMutation(
                'reporter', 'reverse', 'methodRMenu',
                methodRArgs, methodRMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_methodR', 'value', {mutation});
            converter._addTextInput(block, 'STRING', receiver, 'string');
            converter._addField(block, 'METHOD', 'reverse');
            return block;
        });

        // String#delete (returns value - REPORTER)
        converter.registerOnSend(['string', 'block', 'variable'], 'delete', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;

            const mutation = buildMutation(
                'reporter', 'delete', 'methodRMenu',
                methodRArgs, methodRMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_methodR', 'value', {mutation});
            converter._addTextInput(block, 'STRING', receiver, 'string');
            converter._addField(block, 'METHOD', 'delete');
            converter._addTextInput(block, 'ARG1', args[0], 'arg1');
            return block;
        });

        // String#delete! (mutates in place - COMMAND)
        // Only variables are valid receivers for bang methods (they modify in place)
        converter.registerOnSend(['variable'], 'delete!', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;

            const varInfo = converter.lookupVariableFromVariableBlock(receiver);
            if (!varInfo) return null;

            const mutation = buildMutation(
                'command', 'delete!', 'methodCMenu',
                methodCArgs, methodCMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_methodC', 'statement', {mutation});
            converter._addField(block, 'STRING', varInfo.name);
            converter._addField(block, 'METHOD', 'delete!');
            converter._addTextInput(block, 'ARG1', args[0], 'arg1');
            return block;
        });

        // String#gsub (returns value - REPORTER, 2 args)
        converter.registerOnSend(['string', 'block', 'variable'], 'gsub', 2, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;
            if (!converter._isStringOrBlock(args[1])) return null;

            const mutation = buildMutation(
                'reporter', 'gsub', 'methodRMenu',
                methodRArgs, methodRMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_methodR', 'value', {mutation});
            converter._addTextInput(block, 'STRING', receiver, 'string');
            converter._addField(block, 'METHOD', 'gsub');
            converter._addTextInput(block, 'ARG1', args[0], 'arg1');
            converter._addTextInput(block, 'ARG2', args[1], 'arg2');
            return block;
        });

        // String#gsub! (mutates in place - COMMAND, 2 args)
        converter.registerOnSend(['variable'], 'gsub!', 2, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;
            if (!converter._isStringOrBlock(args[1])) return null;

            const varInfo = converter.lookupVariableFromVariableBlock(receiver);
            if (!varInfo) return null;

            const mutation = buildMutation(
                'command', 'gsub!', 'methodCMenu',
                methodCArgs, methodCMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_methodC', 'statement', {mutation});
            converter._addField(block, 'STRING', varInfo.name);
            converter._addField(block, 'METHOD', 'gsub!');
            converter._addTextInput(block, 'ARG1', args[0], 'arg1');
            converter._addTextInput(block, 'ARG2', args[1], 'arg2');
            return block;
        });

        // Helper: register a no-arg REPORTER method (string)
        const registerNoArgR = (receivers, method) => {
            converter.registerOnSend(receivers, method, 0, params => {
                const {receiver} = params;
                const mutation = buildMutation(
                    'reporter', method, 'methodRMenu',
                    methodRArgs, methodRMenuItems
                );
                const block = converter._createBlock('smalrubyRuby_methodR', 'value', {mutation});
                converter._addTextInput(block, 'STRING', receiver, 'string');
                converter._addField(block, 'METHOD', method);
                return block;
            });
        };

        // Helper: register a no-arg REPORTER method for list/hash receivers
        // Converts data_variable to data_listcontents so the VM receives list contents
        const registerListNoArgR = (receivers, method) => {
            converter.registerOnSend(receivers, method, 0, params => {
                let {receiver} = params;
                // Convert data_variable to data_listcontents for list variables
                const result = convertToListBlock(converter, messages, receiver);
                if (result.converted) {
                    receiver = result.block;
                }
                const mutation = buildMutation(
                    'reporter', method, 'methodRMenu',
                    methodRArgs, methodRMenuItems
                );
                const block = converter._createBlock('smalrubyRuby_methodR', 'value', {mutation});
                converter._addTextInput(block, 'STRING', receiver, 'string');
                converter._addField(block, 'METHOD', method);
                return block;
            });
        };

        // Helper: register a no-arg COMMAND method (bang methods on variables)
        const registerNoArgC = (method) => {
            converter.registerOnSend(['variable'], method, 0, params => {
                const {receiver} = params;
                const varInfo = converter.lookupVariableFromVariableBlock(receiver);
                if (!varInfo) return null;
                const mutation = buildMutation(
                    'command', method, 'methodCMenu',
                    methodCArgs, methodCMenuItems
                );
                const block = converter._createBlock('smalrubyRuby_methodC', 'statement', {mutation});
                converter._addField(block, 'STRING', varInfo.name);
                converter._addField(block, 'METHOD', method);
                return block;
            });
        };

        // String#lines (REPORTER, 0 args)
        registerNoArgR(['string', 'block', 'variable'], 'lines');

        // Array#max (REPORTER, 0 args - list receiver)
        registerListNoArgR(['string', 'block', 'variable', 'array'], 'max');

        // Array#sort (REPORTER, 0 args - list receiver)
        registerListNoArgR(['string', 'block', 'variable', 'array'], 'sort');

        // Array#join (REPORTER, 0-1 args - list receiver)
        registerListNoArgR(['string', 'block', 'variable', 'array'], 'join');
        converter.registerOnSend(['string', 'block', 'variable', 'array'], 'join', 1, params => {
            let {receiver} = params;
            const {args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;
            const result = convertToListBlock(converter, messages, receiver);
            if (result.converted) {
                receiver = result.block;
            }
            const mutation = buildMutation(
                'reporter', 'join', 'methodRMenu',
                methodRArgs, methodRMenuItems
            );
            const block = converter._createBlock('smalrubyRuby_methodR', 'value', {mutation});
            converter._addTextInput(block, 'STRING', receiver, 'string');
            converter._addField(block, 'METHOD', 'join');
            converter._addTextInput(block, 'ARG1', args[0], '');
            return block;
        });

        // Hash#keys / Hash#values (REPORTER, 0 args)
        // For hash variables, reference the __hash_X_keys__ / __hash_X_values__ list
        const registerHashMethodR = (method) => {
            converter.registerOnSend(['string', 'block', 'variable', 'hash'], method, 0, params => {
                const {receiver} = params;

                // Try to resolve hash sub-list (keys or values)
                if (converter._isBlock(receiver) && receiver.opcode === 'data_variable') {
                    const varName = receiver.fields.VARIABLE.value;
                    const variable = converter._context.variables[varName] ||
                        converter._context.localVariables[varName];
                    if (variable) {
                        let prefixedName;
                        if (variable.scope === 'global') prefixedName = `$${varName}`;
                        else if (variable.scope === 'instance') prefixedName = `@${varName}`;
                        else if (variable.scope === 'local') prefixedName = variable.originalName;

                        if (prefixedName) {
                            const listName = method === 'keys'
                                ? converter._hashKeysListName(prefixedName)
                                : converter._hashValuesListName(prefixedName);
                            const listVar = converter._lookupOrCreateList(listName);
                            // Convert in-place to data_listcontents for the sub-list
                            receiver.opcode = 'data_listcontents';
                            delete receiver.fields.VARIABLE;
                            receiver.fields.LIST = {
                                name: 'LIST', id: listVar.id,
                                value: listVar.name, variableType: listVar.type
                            };
                        }
                    }
                }

                const mutation = buildMutation(
                    'reporter', method, 'methodRMenu',
                    methodRArgs, methodRMenuItems
                );
                const block = converter._createBlock('smalrubyRuby_methodR', 'value', {mutation});
                converter._addTextInput(block, 'STRING', receiver, 'string');
                converter._addField(block, 'METHOD', method);
                return block;
            });
        };
        registerHashMethodR('keys');
        registerHashMethodR('values');

        // Array#sort! (COMMAND, 0 args)
        registerNoArgC('sort!');

        // Array#reverse! (COMMAND, 0 args)
        registerNoArgC('reverse!');
    }
};

export default SmalrubyRubyConverter;
