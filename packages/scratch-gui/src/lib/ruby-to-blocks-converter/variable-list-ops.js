// === Smalruby: This file is Smalruby-specific (List/show/hide handlers for variable converter) ===
import { RubyToBlocksConverterError } from './errors';
import {
    hashListsOfReceiver,
    isKnownListReceiver,
    isKnownStringReceiver,
    rejectHashValueThatIsNotABlock,
    setListField,
} from './variable-hash-ops';

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
    converter,
    messages,
    convertToListBlock,
    adjustIndex,
    convertHashGet,
    convertHashSet,
) {
    converter.registerOnSend('self', 'show_variable', 1, (params) => {
        const { args } = params;
        if (!converter._isString(args[0])) return null;

        const variable = converter._lookupOrCreateVariable(args[0]);
        if (variable.scope === 'global' || variable.scope === 'instance') {
            return converter._createBlock('data_showvariable', 'statement', {
                fields: {
                    VARIABLE: {
                        name: 'VARIABLE',
                        id: variable.id,
                        value: variable.name,
                        variableType: variable.type,
                    },
                },
            });
        }
        return null;
    });

    converter.registerOnSend('self', 'hide_variable', 1, (params) => {
        const { args } = params;
        if (!converter._isString(args[0])) return null;

        const variable = converter._lookupOrCreateVariable(args[0]);
        if (variable.scope === 'global' || variable.scope === 'instance') {
            return converter._createBlock('data_hidevariable', 'statement', {
                fields: {
                    VARIABLE: {
                        name: 'VARIABLE',
                        id: variable.id,
                        value: variable.name,
                        variableType: variable.type,
                    },
                },
            });
        }
        return null;
    });

    converter.registerOnSend('self', 'list', 1, (params) => {
        const { args } = params;
        if (!converter._isString(args[0])) return null;

        if (converter.version >= 2) {
            throw new RubyToBlocksConverterError(
                params.node,
                converter._translator(messages.listSyntaxNotAvailableInV2),
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
                        variableType: variable.type,
                    },
                },
            });
        }
        return null;
    });

    converter.registerOnSend('self', 'show_list', 1, (params) => {
        const { args } = params;
        if (!converter._isString(args[0])) return null;

        const variable = converter._lookupOrCreateList(args[0]);
        if (variable.scope === 'global' || variable.scope === 'instance') {
            return converter._createBlock('data_showlist', 'statement', {
                fields: {
                    LIST: {
                        name: 'LIST',
                        id: variable.id,
                        value: variable.name,
                        variableType: variable.type,
                    },
                },
            });
        }
        return null;
    });

    converter.registerOnSend('self', 'hide_list', 1, (params) => {
        const { args } = params;
        if (!converter._isString(args[0])) return null;

        const variable = converter._lookupOrCreateList(args[0]);
        if (variable.scope === 'global' || variable.scope === 'instance') {
            return converter._createBlock('data_hidelist', 'statement', {
                fields: {
                    LIST: {
                        name: 'LIST',
                        id: variable.id,
                        value: variable.name,
                        variableType: variable.type,
                    },
                },
            });
        }
        return null;
    });

    converter.registerOnSend('variable', 'push', 1, (params) => {
        const { receiver, args } = params;
        if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

        const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;

        const block = converter._changeBlock(recv, 'data_addtolist', 'statement');
        converter._addTextInput(block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing');
        return block;
    });

    converter.registerOnSend('variable', '<<', 1, (params) => {
        const { receiver, args } = params;
        if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

        // convertToListBlock will throw error in v1 if receiver is data_variable
        const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;

        const block = converter._changeBlock(recv, 'data_addtolist', 'statement');
        converter._addTextInput(block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing');
        return block;
    });

    converter.registerOnSend('variable', 'delete_at', 1, (params) => {
        const { receiver, args } = params;
        if (!converter._isNumberOrBlock(args[0])) return null;

        const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;

        // delete_at(-1) deletes the last item: "delete (length of the list) of the list". The index
        // was 1, which deleted the first item when the blocks ran (issue #1840).
        if (converter._isNumber(args[0]) && Number(args[0]) === -1) {
            const block = converter._changeBlock(recv, 'data_deleteoflist', 'statement');
            // Not mapped to the node of the line: the line is the delete block
            const previousNode = converter._context.currentNode;
            converter._context.currentNode = null;
            const lengthBlock = converter._createBlock('data_lengthoflist', 'value', {
                fields: { LIST: { ...block.fields.LIST } },
            });
            converter._context.currentNode = previousNode;
            converter._addNumberInput(block, 'INDEX', 'math_integer', lengthBlock, 1);
            // Keep the comment that names a local list (`@ruby:lvar:a:1`): `a.delete_at(-1)` came back
            // as `@_a_1_.delete_at(-1)`
            const existing = block.comment && converter._context.comments[block.comment];
            if (existing) {
                existing.text = `${existing.text},@ruby:array:delete_at:last`;
            } else {
                block.comment = converter._createComment('@ruby:array:delete_at:last', block.id);
            }
            return block;
        }

        const index = adjustIndex(converter, args[0], converted);

        const block = converter._changeBlock(recv, 'data_deleteoflist', 'statement');
        converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
        return block;
    });

    converter.registerOnSend('variable', 'clear', 0, (params) => {
        const { receiver } = params;

        const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;

        return converter._changeBlock(recv, 'data_deletealloflist', 'statement');
    });

    converter.registerOnSend('variable', 'insert', 2, (params) => {
        const { receiver, args } = params;
        if (!converter._isNumberOrBlock(args[0])) return null;
        if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1])) return null;

        const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;
        const index = adjustIndex(converter, args[0], converted);

        const block = converter._changeBlock(recv, 'data_insertatlist', 'statement');
        converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
        converter._addTextInput(block, 'ITEM', converter._isNumber(args[1]) ? args[1].toString() : args[1], 'thing');
        return block;
    });

    converter.registerOnSend('variable', '[]=', 2, (params) => {
        const { receiver, args } = params;

        // Hash write: $a[:key] = value or $a["key"] = value
        if (converter._isSymbol(args[0]) || converter._isString(args[0])) {
            if (converter.version < 2) {
                throw new RubyToBlocksConverterError(
                    converter._context.currentNode,
                    converter._translator(messages.hashSyntaxNotAvailableInV1),
                );
            }
            rejectHashValueThatIsNotABlock(converter, messages, args[1]);
            if (
                !converter._isStringOrBlock(args[1]) &&
                !converter._isNumberOrBlock(args[1]) &&
                !(converter._isPrimitive(args[1]) && args[1].type === 'sym')
            )
                return null;
            return convertHashSet(converter, receiver, args[0], args[1]);
        }

        if (!converter._isNumberOrBlock(args[0])) return null;
        if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1])) return null;

        const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;
        const index = adjustIndex(converter, args[0], converted);

        const block = converter._changeBlock(recv, 'data_replaceitemoflist', 'statement');
        converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
        converter._addTextInput(block, 'ITEM', converter._isNumber(args[1]) ? args[1].toString() : args[1], 'thing');
        return block;
    });

    converter.registerOnSend('variable', '[]', 1, (params) => {
        const { receiver, args } = params;

        // Hash access: $a[:key] or $a["key"]
        if (converter._isSymbol(args[0]) || converter._isString(args[0])) {
            if (converter.version < 2) {
                throw new RubyToBlocksConverterError(
                    converter._context.currentNode,
                    converter._translator(messages.hashSyntaxNotAvailableInV1),
                );
            }
            return convertHashGet(converter, receiver, args[0]);
        }

        if (!converter._isNumberOrBlock(args[0])) return null;
        if (isKnownStringReceiver(converter, receiver)) return null;

        const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
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

    converter.registerOnSend('variable', 'index', 1, (params) => {
        const { receiver, args } = params;
        if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;
        // String#index too, but Scratch has no block for where a text is in a string. A name used
        // only as a string is not a list, so say that instead of "used as a list" (issue #1629).
        if (isKnownStringReceiver(converter, receiver)) {
            throw new RubyToBlocksConverterError(
                converter._context.currentNode,
                converter._translator(messages.stringMethodHasNoBlock, { METHOD: 'index' }),
            );
        }

        const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
        const recv = converted ? listBlock : receiver;
        if (!recv) return null;

        const block = converter._changeBlock(recv, 'data_itemnumoflist', 'value');
        converter._addTextInput(block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing');

        // Wrap in operator_subtract(result, 1) for 0-indexed return value
        if (converted) {
            const subtractBlock = converter._createBlock('operator_subtract', 'value');
            converter._addInput(subtractBlock, 'NUM1', block);
            converter._addNumberInput(subtractBlock, 'NUM2', 'math_number', 1, 0);
            subtractBlock.comment = converter._createComment('@ruby:array:index', subtractBlock.id);
            return subtractBlock;
        }

        return block;
    });

    /**
     * Turn a hash receiver into "length of the keys list" (`@h.length`, `@h.empty?`). The comment
     * keeps the name of a local hash, as on the other blocks of a local hash, and marks the block
     * as the length of a hash: a list that the user named `@_hash_x_keys_` must still come back
     * as `@_hash_x_keys_.length`, not `@x.length`.
     * @param {object} receiver - The receiver block (data_variable).
     * @param {object} hash - The lists of the hash (`hashListsOfReceiver`).
     * @param {?string} marker - Another `@ruby:` marker for the block, or null.
     * @returns {object} The data_lengthoflist block.
     */
    const hashLengthBlock = (receiver, hash, marker) => {
        const block = converter._changeBlock(receiver, 'data_lengthoflist', 'value');
        setListField(block, hash.keysList);
        const text = [hash.lvarComment, '@ruby:hash:length', marker].filter(Boolean).join(',');
        block.comment = converter._createComment(text, block.id);
        return block;
    };

    /**
     * The `@ruby:method:empty?:N` marker of the next `empty?` call.
     * @returns {string} The marker.
     */
    const nextEmptyMarker = () => {
        const name = 'empty?';
        const index = (converter._context.methodCallIndices[name] || 0) + 1;
        converter._context.methodCallIndices[name] = index;
        return `@ruby:method:${name}:${index}`;
    };

    /**
     * `length == 0` for `empty?`, with the marker on both blocks so that it comes back as `empty?`.
     * @param {object} lengthBlock - The data_lengthoflist block.
     * @param {string} marker - The `@ruby:method:empty?:N` marker.
     * @returns {object} The operator_equals block.
     */
    const emptyBlock = (lengthBlock, marker) => {
        const block = converter._createBlock('operator_equals', 'value_boolean');
        converter._addInput(block, 'OPERAND1', lengthBlock, converter._createTextBlock(''));
        converter._addTextInput(block, 'OPERAND2', '0', '50');
        block.comment = converter._createComment(marker, block.id);
        return block;
    };

    // Hash#key?: whether the keys list has the key (issue #1652). Symbol keys are stored as ":a".
    converter.registerOnSend('variable', 'key?', 1, (params) => {
        if (converter.version < 2) return null;
        const { receiver, args } = params;
        const key = args[0];
        let item;
        let marker;
        if (converter._isSymbol(key) && converter._isPrimitive(key)) {
            item = `:${converter._getSymbolValue(key)}`;
            marker = '@ruby:hash:key?:sym';
        } else if (converter._isString(key) && converter._isPrimitive(key)) {
            item = key.value;
            marker = '@ruby:hash:key?:str';
        } else if (converter._isBlock(key)) {
            item = key;
            marker = '@ruby:hash:key?';
        } else {
            return null;
        }
        // A list or a string has no key?: do not make the lists of a hash for it.
        if (isKnownListReceiver(converter, receiver) || isKnownStringReceiver(converter, receiver)) return null;
        const hash = hashListsOfReceiver(converter, receiver, true);
        if (!hash) return null;

        const block = converter._changeBlock(receiver, 'data_listcontainsitem', 'value_boolean');
        setListField(block, hash.keysList);
        converter._addTextInput(block, 'ITEM', item, 'thing');
        block.comment = converter._createComment([hash.lvarComment, marker].filter(Boolean).join(','), block.id);
        return block;
    });

    converter.registerOnSend('variable', 'length', 0, (params) => {
        const { receiver } = params;
        const hash = hashListsOfReceiver(converter, receiver);
        if (hash) return hashLengthBlock(receiver, hash, null);
        if (isKnownStringReceiver(converter, receiver)) return null;

        const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
        if (converted && listBlock) {
            return converter._changeBlock(listBlock, 'data_lengthoflist', 'value');
        }

        if (converter._isBlock(receiver) && converter.isListBlock(receiver)) {
            return converter._changeBlock(receiver, 'data_lengthoflist', 'value');
        }
        return null;
    });

    converter.registerOnSend('variable', 'include?', 1, (params) => {
        const { receiver, args } = params;
        if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;
        if (isKnownStringReceiver(converter, receiver)) return null;

        let recv = receiver;
        if (converter.version >= 2) {
            const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
            recv = converted ? listBlock : receiver;
            if (!recv) return null;
        }

        const block = converter._changeBlock(recv, 'data_listcontainsitem', 'value_boolean');
        converter._addTextInput(block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing');
        return block;
    });

    converter.registerOnSend('variable', 'empty?', 0, (params) => {
        if (converter.version < 2) return null;

        const { receiver } = params;
        const hash = hashListsOfReceiver(converter, receiver);
        if (hash) {
            const marker = nextEmptyMarker();
            return emptyBlock(hashLengthBlock(receiver, hash, marker), marker);
        }
        if (isKnownStringReceiver(converter, receiver)) return null;

        // The comment of a local's read names the local; keep it with the marker (`a.empty?` came
        // back as `@_a_1_.empty?`, issue #1652).
        const readComment = receiver.comment && converter._context.comments[receiver.comment];
        const lvarMatch = readComment && readComment.text.match(/@ruby:lvar:[^,\s]+/);

        const { block: listBlock, converted } = convertToListBlock(converter, messages, receiver);
        if (!converted || !listBlock) return null;

        const marker = nextEmptyMarker();
        const lengthBlock = converter._changeBlock(listBlock, 'data_lengthoflist', 'value');
        const text = lvarMatch ? `${lvarMatch[0]},${marker}` : marker;
        lengthBlock.comment = converter._createComment(text, lengthBlock.id);
        return emptyBlock(lengthBlock, marker);
    });
};
