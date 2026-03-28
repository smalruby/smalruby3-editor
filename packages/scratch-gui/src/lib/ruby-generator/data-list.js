// === Smalruby: This file is Smalruby-specific (Ruby code generator for List blocks) ===
/**
 * Define Ruby code generator for List Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    const getListName = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const lvarMatch = comment.match(/@ruby:lvar:([^:,\s]+)/);
            if (lvarMatch) {
                return lvarMatch[1];
            }
        }
        return Generator.listName(Generator.getFieldId(block, 'LIST'));
    };

    /**
     * Convert Scratch 1-indexed list index to Ruby 0-indexed array index.
     * For literal numbers, subtracts 1 directly.
     * For expressions, generates "(expr - 1)".
     * Detects operator_add(x, 1) with `@ruby`:array:index_offset comment for round-trip.
     * @param {object} block - The Scratch block containing the index input.
     * @returns {string} The Ruby array index expression.
     */
    const getListIndex = function (block) {
        // Check for operator_add(x, 1) round-trip pattern
        const indexBlockId = block.inputs && block.inputs.INDEX && block.inputs.INDEX.block;
        if (indexBlockId) {
            const indexBlock = Generator.getBlock(indexBlockId);
            if (indexBlock && indexBlock.opcode === 'operator_add') {
                const comment = Generator.getCommentText(indexBlock);
                if (comment && comment.includes('@ruby:array:index')) {
                    // Use NUM1 directly (the original 0-indexed value)
                    return Generator.valueToCode(indexBlock, 'NUM1', Generator.ORDER_NONE) || 0;
                }
            }
        }

        const index = Generator.valueToCode(block, 'INDEX', Generator.ORDER_NONE) || 1;
        const numIndex = Number(index);
        if (!isNaN(numIndex) && String(numIndex) === String(index)) {
            // Literal number: convert 1-indexed to 0-indexed
            return Math.max(0, numIndex - 1);
        }
        // Expression: wrap with "- 1"
        return `${index} - 1`;
    };

    /**
     * Get the raw text value from a block's text input.
     * @param {object} block - The block containing the input.
     * @param {string} inputName - The name of the input (e.g. 'ITEM').
     * @returns {string} The raw text value.
     */
    const getTextInputValue = function (block, inputName) {
        const input = block.inputs && block.inputs[inputName];
        if (!input) return '';
        const textBlock = Generator.getBlock(input.block);
        if (!textBlock || !textBlock.fields || !textBlock.fields.TEXT) return '';
        return textBlock.fields.TEXT.value;
    };

    /**
     * Derive the Ruby hash variable name from a keys list name.
     * E.g. '$_hash_a_keys_' -> '$a', '@_hash_a_keys_' -> '@a', '_hash_a_keys_' -> 'a'
     * @param {string} keysListName - The keys list name.
     * @returns {string} The Ruby variable name.
     */
    const getHashVarName = function (keysListName) {
        let prefix = '';
        let name = keysListName;
        if (name[0] === '$') {
            prefix = '$';
            name = name.slice(1);
        } else if (name[0] === '@') {
            prefix = '@';
            name = name.slice(1);
        }
        // Remove _hash_ prefix and _keys_ suffix
        const match = name.match(/^_hash_(.+)_keys_$/);
        if (match) {
            return `${prefix}${match[1]}`;
        }
        return keysListName;
    };

    Generator.data_addtolist = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment && comment.includes('@ruby:array:literal:element')) {
            // Suppressed: handled by data_deletealloflist array literal pattern
            return '';
        }
        if (comment && (comment.includes('@ruby:hash:literal:key:') ||
            comment.includes('@ruby:hash:literal:value'))) {
            // Suppressed: handled by data_deletealloflist hash literal pattern
            return '';
        }
        if (comment && (comment === '@ruby:hash:set:push:key' ||
            comment === '@ruby:hash:set:push:value')) {
            // Suppressed: handled by data_deleteoflist hash set pattern
            return '';
        }

        const item = Generator.valueToCode(block, 'ITEM', Generator.ORDER_NONE) || '0';
        const list = getListName(block);
        return `${list}.push(${Generator.nosToCode(item)})\n`;
    };

    Generator.data_deleteoflist = function (block) {
        const comment = Generator.getCommentText(block);

        // Hash set: delete+push pattern
        if (comment && comment.includes('@ruby:hash:set:')) {
            if (comment.includes('@ruby:hash:set:delete:key')) {
                // Suppressed: handled by the first delete block
                return '';
            }

            // This is the first block of the delete+push pattern
            // Extract variable name: use @ruby:lvar if present, else derive from list name
            const lvarMatch = comment.match(/@ruby:lvar:([^:,\s]+)/);
            let hashVarName;
            if (lvarMatch) {
                hashVarName = lvarMatch[1];
            } else {
                const valuesListName = getListName(block);
                hashVarName = getHashVarName(
                    valuesListName.replace(/_values_$/, '_keys_')
                );
            }

            // Get the key from the nested data_itemnumoflist
            const indexBlockId = block.inputs && block.inputs.INDEX && block.inputs.INDEX.block;
            let rawKey = '';
            if (indexBlockId) {
                const numBlock = Generator.getBlock(indexBlockId);
                if (numBlock && numBlock.opcode === 'data_itemnumoflist') {
                    rawKey = getTextInputValue(numBlock, 'ITEM');
                }
            }

            // Skip to the push:value block (3 blocks ahead: delete:key, push:key, push:value)
            let nextId = block.next;
            // delete:key
            const deleteKeyBlock = Generator.getBlock(nextId);
            nextId = deleteKeyBlock.next;
            // push:key
            const pushKeyBlock = Generator.getBlock(nextId);
            nextId = pushKeyBlock.next;
            // push:value
            const pushValueBlock = Generator.getBlock(nextId);
            const value = Generator.valueToCode(pushValueBlock, 'ITEM', Generator.ORDER_NONE) || '0';

            if (comment.includes('@ruby:hash:set:sym')) {
                const symName = rawKey.slice(1); // remove leading ":"
                return `${hashVarName}[:${symName}] = ${Generator.nosToCode(value)}\n`;
            }
            // @ruby:hash:set:str
            return `${hashVarName}["${rawKey}"] = ${Generator.nosToCode(value)}\n`;
        }

        const list = getListName(block);
        const rawIndex = Generator.valueToCode(block, 'INDEX', Generator.ORDER_NONE) || 1;
        if (rawIndex === 'last') {
            return `${list}.delete_at(-1) # @ruby:array:delete_at:last\n`;
        }
        if (rawIndex === 'random') {
            return `${list}.delete_at(rand(0...${list}.length)) # @ruby:array:delete_at:random\n`;
        }
        const index = getListIndex(block);
        return `${list}.delete_at(${Generator.nosToCode(index)})\n`;
    };

    Generator.data_deletealloflist = function (block) {
        const list = getListName(block);

        const comment = Generator.getCommentText(block);
        const arrayLiteralMatch = comment ? comment.match(/@ruby:array:literal:(\d+)/) : null;
        if (arrayLiteralMatch) {
            const count = parseInt(arrayLiteralMatch[1], 10);
            const values = [];
            let nextId = block.next;
            for (let i = 0; i < count; i++) {
                const pushBlock = Generator.getBlock(nextId);
                const value = Generator.valueToCode(pushBlock, 'ITEM', Generator.ORDER_NONE) || '0';
                values.push(Generator.nosToCode(value));
                nextId = pushBlock.next;
            }
            return `${list} = [${values.join(', ')}]\n`;
        }

        if (comment && comment === '@ruby:hash:literal:values') {
            // Suppressed: handled by the keys clear block above
            return '';
        }

        const hashLiteralMatch = comment ? comment.match(/@ruby:hash:literal:(\d+)/) : null;
        if (hashLiteralMatch) {
            const count = parseInt(hashLiteralMatch[1], 10);
            // Skip the next block (clear values list)
            let nextId = block.next;
            const clearValuesBlock = Generator.getBlock(nextId);
            nextId = clearValuesBlock.next;

            // Derive the variable name from the keys list name
            const hashVarName = getHashVarName(list);

            const entries = [];
            for (let i = 0; i < count; i++) {
                // Read key block - get raw text value from ITEM input
                const keyBlock = Generator.getBlock(nextId);
                const keyComment = Generator.getCommentText(keyBlock);
                const rawKey = getTextInputValue(keyBlock, 'ITEM');
                nextId = keyBlock.next;

                // Read value block
                const valueBlock = Generator.getBlock(nextId);
                const value = Generator.valueToCode(valueBlock, 'ITEM', Generator.ORDER_NONE) || '0';
                nextId = valueBlock.next;

                if (keyComment && keyComment.includes('@ruby:hash:literal:key:sym')) {
                    // Symbol key: ":name" -> generate {name: value} syntax
                    const symName = rawKey.slice(1); // remove leading ":"
                    entries.push(`${symName}: ${Generator.nosToCode(value)}`);
                } else {
                    // String key: generate {"name" => value} syntax
                    entries.push(`"${rawKey}" => ${Generator.nosToCode(value)}`);
                }
            }

            if (entries.length === 0) {
                return `${hashVarName} = {}\n`;
            }
            return `${hashVarName} = {${entries.join(', ')}}\n`;
        }

        return `${list}.clear\n`;
    };

    Generator.data_insertatlist = function (block) {
        const list = getListName(block);
        const rawIndex = Generator.valueToCode(block, 'INDEX', Generator.ORDER_NONE) || 1;
        const item = Generator.valueToCode(block, 'ITEM', Generator.ORDER_NONE) || '0';
        if (rawIndex === 'last') {
            return `${list}.push(${Generator.nosToCode(item)}) # @ruby:array:insert:last\n`;
        }
        if (rawIndex === 'random') {
            const randExpr = `rand(0..${list}.length)`;
            return `${list}.insert(${randExpr}, ${Generator.nosToCode(item)})` +
                ` # @ruby:array:insert:random\n`;
        }
        const index = getListIndex(block);
        return `${list}.insert(${index}, ${Generator.nosToCode(item)})\n`;
    };

    Generator.data_replaceitemoflist = function (block) {
        const index = getListIndex(block);
        const item = Generator.valueToCode(block, 'ITEM', Generator.ORDER_NONE) || '0';
        const list = getListName(block);
        return `${list}[${index}] = ${Generator.nosToCode(item)}\n`;
    };

    Generator.data_itemoflist = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment === '@ruby:symbol:var') {
            const index = Generator.valueToCode(block, 'INDEX', Generator.ORDER_NONE);
            return [index, Generator.ORDER_ATOMIC];
        }

        // Hash get: data_itemoflist with @ruby:hash:get:sym or @ruby:hash:get:str comment
        if (comment && comment.includes('@ruby:hash:get:')) {
            // Extract variable name: use @ruby:lvar if present, else derive from list name
            const lvarMatch = comment.match(/@ruby:lvar:([^:,\s]+)/);
            let hashVarName;
            if (lvarMatch) {
                hashVarName = lvarMatch[1];
            } else {
                const valuesListName = getListName(block);
                hashVarName = getHashVarName(
                    valuesListName.replace(/_values_$/, '_keys_')
                );
            }

            // Get the key from the nested data_itemnumoflist block
            const indexBlockId = block.inputs && block.inputs.INDEX && block.inputs.INDEX.block;
            if (indexBlockId) {
                const numBlock = Generator.getBlock(indexBlockId);
                if (numBlock && numBlock.opcode === 'data_itemnumoflist') {
                    const rawKey = getTextInputValue(numBlock, 'ITEM');
                    if (comment.includes('@ruby:hash:get:sym')) {
                        // Symbol key: ":name" -> $a[:name]
                        const symName = rawKey.slice(1); // remove leading ":"
                        return [`${hashVarName}[:${symName}]`, Generator.ORDER_FUNCTION_CALL];
                    }
                    // String key: "foo" -> $a["foo"]
                    return [`${hashVarName}["${rawKey}"]`, Generator.ORDER_FUNCTION_CALL];

                }
            }
        }

        const index = getListIndex(block);
        const list = getListName(block);
        return [`${list}[${index}]`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.data_itemnumoflist = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment && comment.startsWith('@ruby:symbol:')) {
            const symbolName = comment.slice('@ruby:symbol:'.length);
            return [`:${symbolName}`, Generator.ORDER_ATOMIC];
        }
        const item = Generator.valueToCode(block, 'ITEM', Generator.ORDER_NONE) || '0';
        const list = getListName(block);
        return [`${list}.index(${Generator.nosToCode(item)})`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.data_lengthoflist = function (block) {
        const list = getListName(block);
        const comment = Generator.getCommentText(block);
        if (comment && comment.startsWith('@ruby:method:empty?:')) {
            const index = comment.substring(20);
            Generator.emptyCallCache_[index] = list;
            return [`@ruby:method:empty?:${index}`, Generator.ORDER_FUNCTION_CALL];
        }
        return [`${list}.length`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.data_listcontainsitem = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const item = Generator.valueToCode(block, 'ITEM', order) || '0';
        const list = getListName(block);
        return [`${list}.include?(${Generator.nosToCode(item)})`, order];
    };

    Generator.data_showlist = function (block) {
        const list = Generator.listName(Generator.getFieldId(block, 'LIST'));
        return `show_list(${Generator.quote_(list)})\n`;
    };

    Generator.data_hidelist = function (block) {
        const list = Generator.listName(Generator.getFieldId(block, 'LIST'));
        return `hide_list(${Generator.quote_(list)})\n`;
    };

    return Generator;
}
