// === Smalruby: This file is Smalruby-specific (Hash/list helper functions for variable converter) ===
import {RubyToBlocksConverterError} from './errors';

/**
 * Convert a data_variable block to data_listcontents for list operations.
 * When $a (global) or `@a` (instance) is used with array methods like .push(),
 * the variable read creates a data_variable block, but list operations need
 * a data_listcontents block with LIST field.
 * @param {object} converter - The converter instance.
 * @param {object} messages - The messages object for error messages.
 * @param {object} block - The receiver block to convert.
 * @returns {{block: object|null, converted: boolean}} The converted block and whether conversion happened.
 */
export const convertToListBlock = function (converter, messages, block) {
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
 * Determine whether a receiver block refers to a *known* list variable,
 * WITHOUT creating one.
 *
 * A variable read is always a data_variable block regardless of whether it
 * holds a scalar/String or an Array, so methods registered for both String and
 * Array receivers (reverse / reverse!) cannot be disambiguated by block type
 * alone. This inspects the tracked variable/list stores to decide which class
 * the receiver belongs to.
 *
 * Unlike convertToListBlock / _lookupOrCreateList, this never creates a list, so
 * it safely returns false for genuine scalar/String variables (avoiding the
 * side effect of accidentally registering a list for them).
 * @param {object} converter - The converter instance.
 * @param {object} block - The receiver block to inspect.
 * @returns {boolean} true if the receiver is (or references) a known list.
 */
export const isKnownListReceiver = function (converter, block) {
    if (!converter._isBlock(block)) return false;

    // Already a list block (data_listcontents).
    if (converter.isListBlock(block)) return true;

    if (block.opcode !== 'data_variable' ||
        !block.fields || !block.fields.VARIABLE) {
        return false;
    }

    // A data_variable's VARIABLE.value is the key under which a corresponding
    // list would live in _context.lists: the bare name for global/instance and
    // the transformed name (e.g. `_ticket_1_`) for locals. Local scalars and
    // lists deliberately share this transformed name so that convertToListBlock
    // can recover the list from a scalar read; here we only *peek* (never
    // create). A genuine scalar/String variable has no matching list entry, so
    // this correctly returns false for them.
    const varName = block.fields.VARIABLE.value;
    return Boolean(converter._context.lists[varName]);
};

/**
 * Adjust a 0-indexed Ruby array index to 1-indexed Scratch list index.
 * Always wraps in operator_add(index, 1) with `@ruby`:array:index comment
 * to enable round-trip conversion.
 * @param {object} converter - The converter instance.
 * @param {object} index - The index block or value.
 * @param {boolean} converted - Whether the receiver was converted to a list block.
 * @returns {object} The adjusted index.
 */
export const adjustIndex = function (converter, index, converted) {
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
 * @param {object} converter - The converter instance.
 * @param {object} receiver - The receiver block (data_variable).
 * @param {*} keyArg - The key argument (symbol or string).
 * @returns {object|null} The generated block, or null on failure.
 */
export const convertHashGet = function (converter, receiver, keyArg) {
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

    // Include @ruby:lvar prefix for local variables
    if (variable.scope === 'local') {
        commentMarker =
            `@ruby:lvar:${variable.originalName}:${variable.scopeIndex},${commentMarker}`;
    }
    block.comment = converter._createComment(commentMarker, block.id);

    return block;
};

/**
 * Convert a hash bracket write (upsert): $a[:key] = value.
 * Generates delete+push pattern (4 blocks).
 * @param {object} converter - The converter instance.
 * @param {object} receiver - The receiver block (data_variable).
 * @param {*} keyArg - The key argument (symbol or string).
 * @param {*} valueArg - The value to set.
 * @returns {object|null} The generated block chain, or null on failure.
 */
export const convertHashSet = function (converter, receiver, keyArg, valueArg) {
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

    // Include @ruby:lvar prefix for local variables
    if (variable.scope === 'local') {
        commentMarker =
            `@ruby:lvar:${variable.originalName}:${variable.scopeIndex},${commentMarker}`;
    }
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
