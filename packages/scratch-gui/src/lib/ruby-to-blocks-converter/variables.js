import {defineMessages} from 'react-intl';
import _ from 'lodash';
import {RubyToBlocksConverterError} from './errors';

const messages = defineMessages({
    arraySyntaxNotAvailableInV1: {
        defaultMessage: 'Array syntax is only available in Ruby version 2.' +
            '\nPlease switch to Ruby version 2 from the settings menu,' +
            '\nor use list() syntax instead.',
        description: 'Error message when array syntax ($a.push, $a[0], etc.) is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.arraySyntaxNotAvailableInV1'
    },
    listSyntaxNotAvailableInV2: {
        defaultMessage: 'list() syntax is only available in Ruby version 1.' +
            '\nPlease use array syntax ($a.push(), $a[0], etc.) instead.',
        description: 'Error message when list() syntax is used in Ruby version 2',
        id: 'gui.smalruby3.rubyToBlocksConverter.listSyntaxNotAvailableInV2'
    },
    arrayLiteralNotAvailableInV1: {
        defaultMessage: 'Array literal syntax is only available in Ruby version 2.' +
            '\nPlease switch to Ruby version 2 from the settings menu.',
        description: 'Error message when array literal ($a = [1, 2, 3]) is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.arrayLiteralNotAvailableInV1'
    },
    hashSyntaxNotAvailableInV1: {
        defaultMessage: 'Hash syntax is only available in Ruby version 2.' +
            '\nPlease switch to Ruby version 2 from the settings menu.',
        description: 'Error message when hash syntax ($a = {key: value}) is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.hashSyntaxNotAvailableInV1'
    }
});

/**
 * Variables converter
 */
const VariablesConverter = {
    register: function (converter) {
        /**
         * Convert a data_variable block to data_listcontents for list operations.
         * When $a (global) or `@a` (instance) is used with array methods like .push(),
         * the variable read creates a data_variable block, but list operations need
         * a data_listcontents block with LIST field.
         * @param {object} block - The receiver block to convert
         * @returns {{block: object|null, converted: boolean}} The converted block and whether conversion happened
         */
        const convertToListBlock = function (block) {
            if (!converter._isBlock(block)) return {block: null, converted: false};

            // Already a list block, no conversion needed
            if (converter.isListBlock(block)) return {block, converted: false};

            if (block.opcode !== 'data_variable') return {block: null, converted: false};

            // Only convert data_variable blocks in version 2
            if (converter.version < 2) {
                throw new RubyToBlocksConverterError(
                    converter._context.currentNode,
                    converter._translator(messages.arraySyntaxNotAvailableInV1)
                );
            }

            const varName = block.fields.VARIABLE.value;
            const variable = converter._context.variables[varName] ||
                converter._context.localVariables[varName];
            if (!variable) return {block: null, converted: false};

            let prefixedName;
            if (variable.scope === 'global') {
                prefixedName = `$${varName}`;
            } else if (variable.scope === 'instance') {
                prefixedName = `@${varName}`;
            } else if (variable.scope === 'local') {
                prefixedName = variable.originalName;
            } else {
                return {block: null, converted: false};
            }

            const listVar = converter._lookupOrCreateList(prefixedName);

            // Convert the block in-place
            block.opcode = 'data_listcontents';
            delete block.fields.VARIABLE;
            block.fields.LIST = {
                name: 'LIST',
                id: listVar.id,
                value: listVar.name,
                variableType: listVar.type
            };

            return {block, converted: true};
        };

        /**
         * Adjust a 0-indexed Ruby array index to 1-indexed Scratch list index.
         * Always wraps in operator_add(index, 1) with `@ruby`:array:index comment
         * to enable round-trip conversion.
         * @param {object} index - The index block or value.
         * @param {boolean} converted - Whether the receiver was converted to a list block.
         */
        const adjustIndex = function (index, converted) {
            if (!converted) return index;
            const addBlock = converter._createBlock('operator_add', 'value');
            converter._addNumberInput(addBlock, 'NUM1', 'math_number', index, 0);
            converter._addNumberInput(addBlock, 'NUM2', 'math_number', 1, 0);
            addBlock.comment = converter._createComment('@ruby:array:index', addBlock.id);
            return addBlock;
        };

        /**
         * Convert a hash bracket read: $a[:key] or $a["key"].
         * Generates data_itemoflist(INDEX: data_itemnumoflist(key, keys_list), values_list).
         * @param {object} receiver - The receiver block (data_variable).
         * @param {*} keyArg - The key argument (symbol or string).
         * @returns {object|null} The generated block, or null on failure.
         */
        const convertHashGet = function (receiver, keyArg) {
            if (!converter._isBlock(receiver) || receiver.opcode !== 'data_variable') return null;

            const varName = receiver.fields.VARIABLE.value;
            const variable = converter._context.variables[varName] ||
                converter._context.localVariables[varName];
            if (!variable) return null;

            let prefixedName;
            if (variable.scope === 'global') {
                prefixedName = `$${varName}`;
            } else if (variable.scope === 'instance') {
                prefixedName = `@${varName}`;
            } else if (variable.scope === 'local') {
                prefixedName = variable.originalName;
            } else {
                return null;
            }

            const keysListName = converter._hashKeysListName(prefixedName);
            const valuesListName = converter._hashValuesListName(prefixedName);
            const keysList = converter._lookupOrCreateList(keysListName);
            const valuesList = converter._lookupOrCreateList(valuesListName);

            let keyStr;
            let commentMarker;
            if (converter._isSymbol(keyArg)) {
                const symName = converter._getSymbolValue(keyArg);
                keyStr = `:${symName}`;
                commentMarker = '@ruby:hash:get:sym';
            } else {
                keyStr = converter._isPrimitive(keyArg) ? keyArg.value : keyArg;
                commentMarker = '@ruby:hash:get:str';
            }

            // Create data_itemnumoflist block for key lookup
            const numBlock = converter._createBlock('data_itemnumoflist', 'value', {
                fields: {
                    LIST: {
                        name: 'LIST',
                        id: keysList.id,
                        value: keysList.name,
                        variableType: keysList.type
                    }
                }
            });
            converter._addTextInput(numBlock, 'ITEM', keyStr, 'thing');

            // Create data_itemoflist block for value retrieval
            const block = converter._changeBlock(receiver, 'data_itemoflist', 'value');
            delete block.fields.VARIABLE;
            block.fields.LIST = {
                name: 'LIST',
                id: valuesList.id,
                value: valuesList.name,
                variableType: valuesList.type
            };
            converter._addNumberInput(block, 'INDEX', 'math_integer', numBlock, 1);
            block.comment = converter._createComment(commentMarker, block.id);

            return block;
        };

        /**
         * Convert a hash bracket write (upsert): $a[:key] = value.
         * Generates delete+push pattern (4 blocks).
         * @param {object} receiver - The receiver block (data_variable).
         * @param {*} keyArg - The key argument (symbol or string).
         * @param {*} valueArg - The value to set.
         * @returns {object|null} The generated block chain, or null on failure.
         */
        const convertHashSet = function (receiver, keyArg, valueArg) {
            if (!converter._isBlock(receiver) || receiver.opcode !== 'data_variable') return null;

            const varName = receiver.fields.VARIABLE.value;
            const variable = converter._context.variables[varName] ||
                converter._context.localVariables[varName];
            if (!variable) return null;

            let prefixedName;
            if (variable.scope === 'global') {
                prefixedName = `$${varName}`;
            } else if (variable.scope === 'instance') {
                prefixedName = `@${varName}`;
            } else if (variable.scope === 'local') {
                prefixedName = variable.originalName;
            } else {
                return null;
            }

            const keysListName = converter._hashKeysListName(prefixedName);
            const valuesListName = converter._hashValuesListName(prefixedName);
            const keysList = converter._lookupOrCreateList(keysListName);
            const valuesList = converter._lookupOrCreateList(valuesListName);

            let keyStr;
            let commentMarker;
            if (converter._isSymbol(keyArg)) {
                const symName = converter._getSymbolValue(keyArg);
                keyStr = `:${symName}`;
                commentMarker = '@ruby:hash:set:sym';
            } else {
                keyStr = converter._isPrimitive(keyArg) ? keyArg.value : keyArg;
                commentMarker = '@ruby:hash:set:str';
            }

            // Handle symbol values
            let valueItem;
            if (converter._isPrimitive(valueArg) && valueArg.type === 'sym') {
                valueItem = converter._symbolToBlock(valueArg.value, valueArg.node);
            } else if (converter._isNumber(valueArg)) {
                valueItem = converter._isPrimitive(valueArg) ?
                    valueArg.value.toString() : valueArg.toString();
            } else if (converter._isString(valueArg)) {
                valueItem = converter._isPrimitive(valueArg) ? valueArg.value : valueArg;
            } else {
                valueItem = valueArg;
            }

            // Block 1: delete from values list
            const deleteValuesBlock = converter._changeBlock(receiver, 'data_deleteoflist', 'statement');
            delete deleteValuesBlock.fields.VARIABLE;
            deleteValuesBlock.fields.LIST = {
                name: 'LIST',
                id: valuesList.id,
                value: valuesList.name,
                variableType: valuesList.type
            };
            const numBlock1 = converter._createBlock('data_itemnumoflist', 'value', {
                fields: {
                    LIST: {
                        name: 'LIST',
                        id: keysList.id,
                        value: keysList.name,
                        variableType: keysList.type
                    }
                }
            });
            converter._addTextInput(numBlock1, 'ITEM', keyStr, 'thing');
            converter._addNumberInput(deleteValuesBlock, 'INDEX', 'math_integer', numBlock1, 1);
            deleteValuesBlock.comment = converter._createComment(commentMarker, deleteValuesBlock.id);

            // Block 2: delete from keys list
            const deleteKeysBlock = converter._createBlock('data_deleteoflist', 'statement', {
                fields: {
                    LIST: {
                        name: 'LIST',
                        id: keysList.id,
                        value: keysList.name,
                        variableType: keysList.type
                    }
                }
            });
            const numBlock2 = converter._createBlock('data_itemnumoflist', 'value', {
                fields: {
                    LIST: {
                        name: 'LIST',
                        id: keysList.id,
                        value: keysList.name,
                        variableType: keysList.type
                    }
                }
            });
            converter._addTextInput(numBlock2, 'ITEM', keyStr, 'thing');
            converter._addNumberInput(deleteKeysBlock, 'INDEX', 'math_integer', numBlock2, 1);
            deleteKeysBlock.comment = converter._createComment(
                '@ruby:hash:set:delete:key', deleteKeysBlock.id
            );

            // Block 3: push key
            const pushKeyBlock = converter._createBlock('data_addtolist', 'statement', {
                fields: {
                    LIST: {
                        name: 'LIST',
                        id: keysList.id,
                        value: keysList.name,
                        variableType: keysList.type
                    }
                }
            });
            converter._addTextInput(pushKeyBlock, 'ITEM', keyStr, 'thing');
            pushKeyBlock.comment = converter._createComment(
                '@ruby:hash:set:push:key', pushKeyBlock.id
            );

            // Block 4: push value
            const pushValueBlock = converter._createBlock('data_addtolist', 'statement', {
                fields: {
                    LIST: {
                        name: 'LIST',
                        id: valuesList.id,
                        value: valuesList.name,
                        variableType: valuesList.type
                    }
                }
            });
            converter._addTextInput(
                pushValueBlock, 'ITEM',
                converter._isNumber(valueItem) ? valueItem.toString() : valueItem, 'thing'
            );
            pushValueBlock.comment = converter._createComment(
                '@ruby:hash:set:push:value', pushValueBlock.id
            );

            return converter._linkBlocks([
                deleteValuesBlock, deleteKeysBlock, pushKeyBlock, pushValueBlock
            ]);
        };

        converter.registerOnSend('self', 'show_variable', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            const variable = converter._lookupOrCreateVariable(args[0]);
            if (variable.scope === 'global' || variable.scope === 'instance') {
                return converter._createBlock('data_showvariable', 'statement', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            }
            return null;
        });

        converter.registerOnSend('self', 'hide_variable', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            const variable = converter._lookupOrCreateVariable(args[0]);
            if (variable.scope === 'global' || variable.scope === 'instance') {
                return converter._createBlock('data_hidevariable', 'statement', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            }
            return null;
        });

        converter.registerOnSend('self', 'list', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            if (converter.version >= 2) {
                throw new RubyToBlocksConverterError(
                    params.node,
                    converter._translator(messages.listSyntaxNotAvailableInV2)
                );
            }

            const variable = converter._lookupOrCreateList(args[0]);
            if (variable.scope === 'global' || variable.scope === 'instance') {
                return converter._createBlock('data_listcontents', 'value_variable', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            }
            return null;
        });

        converter.registerOnSend('self', 'show_list', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            const variable = converter._lookupOrCreateList(args[0]);
            if (variable.scope === 'global' || variable.scope === 'instance') {
                return converter._createBlock('data_showlist', 'statement', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            }
            return null;
        });

        converter.registerOnSend('self', 'hide_list', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            const variable = converter._lookupOrCreateList(args[0]);
            if (variable.scope === 'global' || variable.scope === 'instance') {
                return converter._createBlock('data_hidelist', 'statement', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            }
            return null;
        });

        converter.registerOnSend('variable', 'push', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;

            const block = converter._changeBlock(recv, 'data_addtolist', 'statement');
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', '<<', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

            // convertToListBlock will throw error in v1 if receiver is data_variable
            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;

            const block = converter._changeBlock(recv, 'data_addtolist', 'statement');
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', 'delete_at', 1, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;

            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;
            const index = adjustIndex(args[0], converted);

            const block = converter._changeBlock(recv, 'data_deleteoflist', 'statement');
            converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
            return block;
        });

        converter.registerOnSend('variable', 'clear', 0, params => {
            const {receiver} = params;

            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;

            return converter._changeBlock(recv, 'data_deletealloflist', 'statement');
        });

        converter.registerOnSend('variable', 'insert', 2, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;
            if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1])) return null;

            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;
            const index = adjustIndex(args[0], converted);

            const block = converter._changeBlock(recv, 'data_insertatlist', 'statement');
            converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[1]) ? args[1].toString() : args[1], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', '[]=', 2, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;
            if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1])) return null;

            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;
            const index = adjustIndex(args[0], converted);

            const block = converter._changeBlock(recv, 'data_replaceitemoflist', 'statement');
            converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[1]) ? args[1].toString() : args[1], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', '[]', 1, params => {
            const {receiver, args} = params;

            // Hash access: $a[:key] or $a["key"]
            if (converter._isSymbol(args[0]) || converter._isString(args[0])) {
                if (converter.version < 2) {
                    throw new RubyToBlocksConverterError(
                        converter._context.currentNode,
                        converter._translator(messages.hashSyntaxNotAvailableInV1)
                    );
                }
                return convertHashGet(receiver, args[0]);
            }

            if (!converter._isNumberOrBlock(args[0])) return null;

            const {block: listBlock, converted} = convertToListBlock(receiver);
            if (converted && listBlock) {
                const index = adjustIndex(args[0], true);
                const block = converter._changeBlock(listBlock, 'data_itemoflist', 'value');
                converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
                return block;
            }

            if (converter._isBlock(receiver) && converter.isListBlock(receiver)) {
                const block = converter._changeBlock(receiver, 'data_itemoflist', 'value');
                converter._addNumberInput(block, 'INDEX', 'math_integer', args[0], 1);
                return block;
            }

            return null;
        });

        converter.registerOnSend('variable', 'index', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;

            const block = converter._changeBlock(recv, 'data_itemnumoflist', 'value');
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing'
            );

            // Wrap in operator_subtract(result, 1) for 0-indexed return value
            if (converted) {
                const subtractBlock = converter._createBlock('operator_subtract', 'value');
                converter._addInput(subtractBlock, 'NUM1', block);
                converter._addNumberInput(subtractBlock, 'NUM2', 'math_number', 1, 0);
                subtractBlock.comment = converter._createComment(
                    '@ruby:array:index', subtractBlock.id
                );
                return subtractBlock;
            }

            return block;
        });

        converter.registerOnSend('variable', 'length', 0, params => {
            const {receiver} = params;

            const {block: listBlock, converted} = convertToListBlock(receiver);
            if (converted && listBlock) {
                return converter._changeBlock(listBlock, 'data_lengthoflist', 'value');
            }

            if (converter._isBlock(receiver) && converter.isListBlock(receiver)) {
                return converter._changeBlock(receiver, 'data_lengthoflist', 'value');
            }
            return null;
        });

        converter.registerOnSend('variable', 'include?', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

            let recv = receiver;
            if (converter.version >= 2) {
                const {block: listBlock, converted} = convertToListBlock(receiver);
                recv = converted ? listBlock : receiver;
                if (!recv) return null;
            }

            const block = converter._changeBlock(recv, 'data_listcontainsitem', 'value_boolean');
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', 'empty?', 0, params => {
            if (converter.version < 2) return null;

            const {receiver} = params;

            const {block: listBlock, converted} = convertToListBlock(receiver);
            if (!converted || !listBlock) return null;

            const name = 'empty?';
            const index = (converter._context.methodCallIndices[name] || 0) + 1;
            converter._context.methodCallIndices[name] = index;
            const commentText = `@ruby:method:${name}:${index}`;

            const lengthBlock = converter._changeBlock(listBlock, 'data_lengthoflist', 'value');
            lengthBlock.comment = converter._createComment(commentText, lengthBlock.id);

            const block = converter._createBlock('operator_equals', 'value_boolean');
            converter._addInput(block, 'OPERAND1', lengthBlock, converter._createTextBlock(''));
            converter._addTextInput(block, 'OPERAND2', '0', '50');
            block.comment = converter._createComment(commentText, block.id);
            return block;
        });

        // Operator to opcode mapping for compound assignments
        const COMPOUND_OPERATOR_MAP = {
            '-': 'operator_subtract',
            '*': 'operator_multiply',
            '/': 'operator_divide',
            '%': 'operator_mod'
        };

        // Register onXxx handlers
        converter.registerOnOpAsgn((lh, operator, rh) => {
            let block;
            if (!converter._isString(lh)) {
                return block;
            }
            if (!converter._isNumberOrBlock(rh) && !converter._isStringOrBlock(rh)) {
                return block;
            }

            const variable = converter._lookupOrCreateVariable(lh);

            if (operator === '+') {
                // Check if this is a string-typed variable: use operator_join
                if (variable.dataType === 'string') {
                    block = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });

                    const syntaxComment = `@ruby:syntax:+=`;
                    if (variable.scope === 'local') {
                        const lvarComment = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                        block.comment = converter._createComment(
                            `${lvarComment},${syntaxComment}`, block.id
                        );
                    } else {
                        block.comment = converter._createComment(syntaxComment, block.id);
                    }

                    const variableBlock = converter._createBlock('data_variable', 'value_variable', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });
                    if (variable.scope === 'local') {
                        const lvarComment = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                        variableBlock.comment = converter._createComment(lvarComment, variableBlock.id);
                    }

                    const joinBlock = converter._createBlock('operator_join', 'value');
                    converter._addTextInput(joinBlock, 'STRING1', variableBlock, 'apple');
                    converter._addTextInput(
                        joinBlock, 'STRING2', converter._isNumber(rh) ? rh.toString() : rh, 'banana'
                    );

                    converter._addInput(block, 'VALUE', joinBlock);
                } else if (variable.scope === 'global' || variable.scope === 'instance') {
                    if (!converter._isNumberOrBlock(rh)) return block;

                    block = converter._createBlock('data_changevariableby', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });
                    converter._addNumberInput(block, 'VALUE', 'math_number', rh, 1);
                } else {
                    // Numeric += for local variables
                    if (!converter._isNumberOrBlock(rh)) return block;

                    block = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });

                    const lvarComment = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                    block.comment = converter._createComment(
                        `${lvarComment},@ruby:syntax:+=`, block.id
                    );

                    const variableBlock = converter._createBlock('data_variable', 'value_variable', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });
                    variableBlock.comment = converter._createComment(lvarComment, variableBlock.id);

                    const addBlock = converter._createBlock('operator_add', 'value');
                    converter._addInput(addBlock, 'NUM1', variableBlock);
                    converter._addNumberInput(addBlock, 'NUM2', 'math_number', rh, 1);

                    converter._addInput(block, 'VALUE', addBlock);
                }
            } else if (Object.prototype.hasOwnProperty.call(COMPOUND_OPERATOR_MAP, operator)) {
                if (!converter._isNumberOrBlock(rh)) return block;

                const opcode = COMPOUND_OPERATOR_MAP[operator];

                block = converter._createBlock('data_setvariableto', 'statement', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });

                const syntaxComment = `@ruby:syntax:${operator}=`;
                if (variable.scope === 'local') {
                    const lvarComment = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                    block.comment = converter._createComment(
                        `${lvarComment},${syntaxComment}`, block.id
                    );
                } else {
                    block.comment = converter._createComment(syntaxComment, block.id);
                }

                const variableBlock = converter._createBlock('data_variable', 'value_variable', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });

                if (variable.scope === 'local') {
                    const lvarComment = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                    variableBlock.comment = converter._createComment(lvarComment, variableBlock.id);
                }

                const operatorBlock = converter._createBlock(opcode, 'value');
                converter._addInput(operatorBlock, 'NUM1', variableBlock);
                converter._addNumberInput(operatorBlock, 'NUM2', 'math_number', rh, 1);

                converter._addInput(block, 'VALUE', operatorBlock);
            }
            return block;
        });

        converter.registerOnVar((scope, variable) => {
            if (scope === 'global' || scope === 'instance') {
                return converter._createBlock('data_variable', 'value_variable', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            } else if (scope === 'local' && !variable.isArgument) {
                const block = converter._createBlock('data_variable', 'value_variable', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });

                const commentText = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                block.comment = converter._createComment(commentText, block.id);

                return block;
            }
            return null;
        });

        converter.registerOnVasgn((scope, variable, rh) => {
            if ((scope === 'global' || scope === 'instance' ||
                (scope === 'local' && !variable.isArgument)) &&
                converter._isPrimitive(rh) && rh.type === 'sym') {
                rh = converter._symbolToBlock(rh.value, rh.node);
            }

            if ((scope === 'global' || scope === 'instance' ||
                (scope === 'local' && !variable.isArgument)) &&
                converter._isArray(rh)) {
                if (converter.version < 2) {
                    throw new RubyToBlocksConverterError(
                        converter._context.currentNode,
                        converter._translator(messages.arrayLiteralNotAvailableInV1)
                    );
                }
                const elements = rh.value;
                let prefixedName;
                if (variable.scope === 'global') {
                    prefixedName = `$${variable.name}`;
                } else if (variable.scope === 'instance') {
                    prefixedName = `@${variable.name}`;
                } else {
                    prefixedName = variable.originalName;
                }
                const listVar = converter._lookupOrCreateList(prefixedName);

                // Create clear block
                const clearBlock = converter._createBlock('data_deletealloflist', 'statement', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: listVar.id,
                            value: listVar.name,
                            variableType: listVar.type
                        }
                    }
                });
                let arrayLiteralComment = `@ruby:array:literal:${elements.length}`;
                if (scope === 'local') {
                    arrayLiteralComment =
                        `@ruby:lvar:${variable.originalName}:${variable.scopeIndex},${arrayLiteralComment}`;
                }
                clearBlock.comment = converter._createComment(
                    arrayLiteralComment, clearBlock.id
                );

                // Create push blocks for each element
                const blocks = [clearBlock];
                for (let i = 0; i < elements.length; i++) {
                    const elem = elements[i];
                    const pushBlock = converter._createBlock('data_addtolist', 'statement', {
                        fields: {
                            LIST: {
                                name: 'LIST',
                                id: listVar.id,
                                value: listVar.name,
                                variableType: listVar.type
                            }
                        }
                    });
                    converter._addTextInput(
                        pushBlock, 'ITEM',
                        converter._isNumber(elem) ? elem.toString() : elem, 'thing'
                    );
                    pushBlock.comment = converter._createComment(
                        '@ruby:array:literal:element', pushBlock.id
                    );
                    blocks.push(pushBlock);
                }

                // Link blocks
                return converter._linkBlocks(blocks);
            }

            if ((scope === 'global' || scope === 'instance' ||
                (scope === 'local' && !variable.isArgument)) &&
                converter._isHash(rh)) {
                if (converter.version < 2) {
                    throw new RubyToBlocksConverterError(
                        converter._context.currentNode,
                        converter._translator(messages.hashSyntaxNotAvailableInV1)
                    );
                }
                const hashEntries = rh.value; // Map<Primitive, Primitive>
                let prefixedName;
                if (variable.scope === 'global') {
                    prefixedName = `$${variable.name}`;
                } else if (variable.scope === 'instance') {
                    prefixedName = `@${variable.name}`;
                } else {
                    prefixedName = variable.originalName;
                }
                const keysListName = converter._hashKeysListName(prefixedName);
                const valuesListName = converter._hashValuesListName(prefixedName);
                const keysList = converter._lookupOrCreateList(keysListName);
                const valuesList = converter._lookupOrCreateList(valuesListName);

                // Create clear block for keys
                const clearKeysBlock = converter._createBlock('data_deletealloflist', 'statement', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: keysList.id,
                            value: keysList.name,
                            variableType: keysList.type
                        }
                    }
                });
                let hashLiteralComment = `@ruby:hash:literal:${hashEntries.size}`;
                if (scope === 'local') {
                    hashLiteralComment =
                        `@ruby:lvar:${variable.originalName}:${variable.scopeIndex},${hashLiteralComment}`;
                }
                clearKeysBlock.comment = converter._createComment(
                    hashLiteralComment, clearKeysBlock.id
                );

                // Create clear block for values
                const clearValuesBlock = converter._createBlock('data_deletealloflist', 'statement', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: valuesList.id,
                            value: valuesList.name,
                            variableType: valuesList.type
                        }
                    }
                });
                clearValuesBlock.comment = converter._createComment(
                    '@ruby:hash:literal:values', clearValuesBlock.id
                );

                const blocks = [clearKeysBlock, clearValuesBlock];

                // Create push blocks for each key-value pair
                hashEntries.forEach((value, key) => {
                    let keyStr;
                    let keyComment;
                    if (converter._isSymbol(key)) {
                        const symName = converter._getSymbolValue(key);
                        keyStr = `:${symName}`;
                        keyComment = '@ruby:hash:literal:key:sym';
                    } else if (converter._isString(key)) {
                        keyStr = converter._isPrimitive(key) ? key.value : key;
                        keyComment = '@ruby:hash:literal:key:str';
                    } else {
                        return; // skip unsupported key types
                    }

                    // Push key
                    const pushKeyBlock = converter._createBlock('data_addtolist', 'statement', {
                        fields: {
                            LIST: {
                                name: 'LIST',
                                id: keysList.id,
                                value: keysList.name,
                                variableType: keysList.type
                            }
                        }
                    });
                    converter._addTextInput(pushKeyBlock, 'ITEM', keyStr, 'thing');
                    pushKeyBlock.comment = converter._createComment(keyComment, pushKeyBlock.id);
                    blocks.push(pushKeyBlock);

                    // Push value - handle symbol values via _symbolToBlock
                    let valueItem;
                    if (converter._isPrimitive(value) && value.type === 'sym') {
                        valueItem = converter._symbolToBlock(value.value, value.node);
                    } else if (converter._isNumber(value)) {
                        valueItem = converter._isPrimitive(value) ? value.value.toString() : value.toString();
                    } else if (converter._isString(value)) {
                        valueItem = converter._isPrimitive(value) ? value.value : value;
                    } else {
                        valueItem = value;
                    }

                    const pushValueBlock = converter._createBlock('data_addtolist', 'statement', {
                        fields: {
                            LIST: {
                                name: 'LIST',
                                id: valuesList.id,
                                value: valuesList.name,
                                variableType: valuesList.type
                            }
                        }
                    });
                    converter._addTextInput(
                        pushValueBlock, 'ITEM',
                        converter._isNumber(valueItem) ? valueItem.toString() : valueItem, 'thing'
                    );
                    pushValueBlock.comment = converter._createComment(
                        '@ruby:hash:literal:value', pushValueBlock.id
                    );
                    blocks.push(pushValueBlock);
                });

                return converter._linkBlocks(blocks);
            }

            if (scope === 'global' || scope === 'instance') {
                if (converter._isNumberOrBlock(rh) || converter._isStringOrBlock(rh)) {
                    const block = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });
                    converter._addTextInput(block, 'VALUE', converter._isNumber(rh) ? rh.toString() : rh, '0');
                    variable.dataType = converter._inferDataType(rh);
                    return block;
                }
            } else if (scope === 'local' && !variable.isArgument) {
                if (converter._isNumberOrBlock(rh) || converter._isStringOrBlock(rh)) {
                    const block = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });

                    const commentText = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                    block.comment = converter._createComment(commentText, block.id);

                    converter._addTextInput(block, 'VALUE', converter._isNumber(rh) ? rh.toString() : rh, '0');
                    variable.dataType = converter._inferDataType(rh);
                    return block;
                }
            }
            return null;
        });
    }
};

export default VariablesConverter;
