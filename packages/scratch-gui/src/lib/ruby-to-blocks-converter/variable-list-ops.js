// === Smalruby: This file is Smalruby-specific (List/show/hide handlers for variable converter) ===
import {RubyToBlocksConverterError} from './errors';

/**
 * Register all list operation and show/hide variable handlers on the converter.
 * @param {object} converter - The converter instance.
 * @param {object} messages - The messages object for error messages.
 * @param {Function} convertToListBlock - Helper to convert data_variable to data_listcontents.
 * @param {Function} adjustIndex - Helper to adjust 0-indexed to 1-indexed.
 * @param {Function} convertHashGet - Helper to convert hash bracket read.
 * @param {Function} convertHashSet - Helper to convert hash bracket write.
 */
export const registerListOperations = function (
    converter, messages, convertToListBlock, adjustIndex, convertHashGet, convertHashSet
) {
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

        const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
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
        const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
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

        const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;

        // Detect delete_at(-1) as "last" special value
        if (converter._isNumber(args[0]) && Number(args[0]) === -1) {
            const block = converter._changeBlock(recv, 'data_deleteoflist', 'statement');
            converter._addNumberInput(block, 'INDEX', 'math_integer', 1, 1);
            block.comment = converter._createComment(
                '@ruby:array:delete_at:last', block.id
            );
            return block;
        }

        const index = adjustIndex(converter, args[0], converted);

        const block = converter._changeBlock(recv, 'data_deleteoflist', 'statement');
        converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
        return block;
    });

    converter.registerOnSend('variable', 'clear', 0, params => {
        const {receiver} = params;

        const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;

        return converter._changeBlock(recv, 'data_deletealloflist', 'statement');
    });

    converter.registerOnSend('variable', 'insert', 2, params => {
        const {receiver, args} = params;
        if (!converter._isNumberOrBlock(args[0])) return null;
        if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1])) return null;

        const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;
        const index = adjustIndex(converter, args[0], converted);

        const block = converter._changeBlock(recv, 'data_insertatlist', 'statement');
        converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
        converter._addTextInput(
            block, 'ITEM', converter._isNumber(args[1]) ? args[1].toString() : args[1], 'thing'
        );
        return block;
    });

    converter.registerOnSend('variable', '[]=', 2, params => {
        const {receiver, args} = params;

        // Hash write: $a[:key] = value or $a["key"] = value
        if (converter._isSymbol(args[0]) || converter._isString(args[0])) {
            if (converter.version < 2) {
                throw new RubyToBlocksConverterError(
                    converter._context.currentNode,
                    converter._translator(messages.hashSyntaxNotAvailableInV1)
                );
            }
            if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1]) &&
                !(converter._isPrimitive(args[1]) && args[1].type === 'sym')) return null;
            return convertHashSet(converter, receiver, args[0], args[1]);
        }

        if (!converter._isNumberOrBlock(args[0])) return null;
        if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1])) return null;

        const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;
        const index = adjustIndex(converter, args[0], converted);

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
            return convertHashGet(converter, receiver, args[0]);
        }

        if (!converter._isNumberOrBlock(args[0])) return null;

        const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
        if (converted && listBlock) {
            const index = adjustIndex(converter, args[0], true);
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

        const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
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

        const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
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
            const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
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

        const {block: listBlock, converted} = convertToListBlock(converter, messages, receiver);
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
};
