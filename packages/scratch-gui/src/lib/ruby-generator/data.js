/**
 * Define Ruby code generator for Variables Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.data_variable = function (block) {
        let variable = Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));
        const comment = Generator.getCommentText(block);

        // Check for local variable metadata
        if (comment && comment.startsWith('@ruby:lvar:')) {
            const parts = comment.split(':');
            if (parts.length === 4) {
                const originalName = parts[2];
                return [originalName, Generator.ORDER_ATOMIC];
            }
        }

        if (comment && comment.startsWith('@ruby:return:')) {
            const methodName = comment.replace('@ruby:return:', '');

            // Check if we have a cached method call for this method
            if (Generator.returnCallCache_ && Generator.returnCallCache_[methodName]) {
                const methodCall = Generator.returnCallCache_[methodName];
                // Clear the cache entry after use
                delete Generator.returnCallCache_[methodName];
                return [methodCall, Generator.ORDER_FUNCTION_CALL];
            }

            // Fallback: if no cached call found, use the variable with @ prefix
            if (variable[0] !== '@') {
                variable = `@${variable}`;
            }
        }
        return [variable, Generator.ORDER_ATOMIC];
    };

    Generator.data_setvariableto = function (block) {
        const comment = Generator.getCommentText(block);
        const hasValueInput = block.inputs && block.inputs.VALUE && block.inputs.VALUE.block;

        // Check for local variable metadata (skip if compound assignment syntax is also present)
        if (comment && comment.startsWith('@ruby:lvar:') && !comment.includes('@ruby:syntax:')) {
            const parts = comment.split(':');
            if (parts.length === 4) {
                const originalName = parts[2];
                if (!hasValueInput) {
                    return '';
                }
                const value = Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) || '0';
                return `${originalName} = ${Generator.nosToCode(value)}\n`;
            }
        }

        // Check if this is a return value assignment
        if (comment && comment.includes('@ruby:return:')) {
            // Check if it is an evacuation block (has a number at the end) or initialize block
            if (/@ruby:return:\w+:\d+/.test(comment) || /@ruby:return:\w+:initialize/.test(comment)) {
                return '';
            }

            if (!hasValueInput) {
                // Marker block with no value, suppress output
                return '';
            }

            const value = Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) || '0';
            if (comment.includes('@ruby:syntax:return')) {
                return `return ${Generator.nosToCode(value)}\n`;
            }

            // Check if this is the last block in procedure definition
            if (block._isLastReturnInProcedure) {
                // Output just the value (implicit return)
                return `${Generator.nosToCode(value)}\n`;
            }
            // Not the last block, output normal variable assignment
        }

        // Check for compound assignment syntax comments (@ruby:syntax:+=, -=, *=, /=, %=)
        // Supports both standalone (@ruby:syntax:+=) and combined with lvar (@ruby:lvar:name:idx,@ruby:syntax:+=)
        const compoundMatch = comment ? comment.match(/@ruby:syntax:([+\-*/%])=/) : null;
        if (compoundMatch && hasValueInput) {
            const op = compoundMatch[1];
            // Extract original variable name from @ruby:lvar comment if present
            const lvarMatch = comment.match(/@ruby:lvar:([^:,\s]+):\d+/);
            const variable = lvarMatch ?
                lvarMatch[1] :
                Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));
            const operatorBlock = Generator.getBlock(block.inputs.VALUE.block);
            if (operatorBlock) {
                // For operator_join (string +=), use STRING2 input; for numeric operators, use NUM2
                const rhInput = operatorBlock.opcode === 'operator_join' ? 'STRING2' : 'NUM2';
                const rh = Generator.valueToCode(operatorBlock, rhInput, Generator.ORDER_NONE) || '0';
                return `${variable} ${op}= ${Generator.nosToCode(rh)}\n`;
            }
        }

        const variable = Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));

        // Check if this is a return value marker block (return variable with no VALUE input)
        if (!hasValueInput) {
            // Check if variable name matches return variable pattern
            let varName = variable;
            if (varName && varName[0] === '@') {
                varName = varName.substring(1);
            }
            if (varName && varName.startsWith('_return_')) {
                // This is a marker block for return value, suppress output
                return '';
            }
        }

        const value = Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) || '0';
        return `${variable} = ${Generator.nosToCode(value)}\n`;
    };

    Generator.data_changevariableby = function (block) {
        const variable = Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));
        const value = Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) || 0;
        return `${variable} += ${Generator.nosToCode(value)}\n`;
    };

    Generator.data_showvariable = function (block) {
        const variable = Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));
        return `show_variable(${Generator.quote_(variable)})\n`;
    };

    Generator.data_hidevariable = function (block) {
        const variable = Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));
        return `hide_variable(${Generator.quote_(variable)})\n`;
    };

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
     * E.g. '$_hash_a_keys_' → '$a', '@_hash_a_keys_' → '@a', '_hash_a_keys_' → 'a'
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

    Generator.data_listcontents = function (block) {
        const list = getListName(block);
        return [list, Generator.ORDER_COLLECTION];
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

        const item = Generator.valueToCode(block, 'ITEM', Generator.ORDER_NONE) || '0';
        const list = getListName(block);
        return `${list}.push(${Generator.nosToCode(item)})\n`;
    };

    Generator.data_deleteoflist = function (block) {
        const index = getListIndex(block);
        const list = getListName(block);
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
                    // Symbol key: ":name" → generate {name: value} syntax
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
        const index = getListIndex(block);
        const item = Generator.valueToCode(block, 'ITEM', Generator.ORDER_NONE) || '0';
        const list = getListName(block);
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
        if (comment && comment.startsWith('@ruby:hash:get:')) {
            const valuesListName = getListName(block);
            const hashVarName = getHashVarName(
                valuesListName.replace(/_values_$/, '_keys_')
            );

            // Get the key from the nested data_itemnumoflist block
            const indexBlockId = block.inputs && block.inputs.INDEX && block.inputs.INDEX.block;
            if (indexBlockId) {
                const numBlock = Generator.getBlock(indexBlockId);
                if (numBlock && numBlock.opcode === 'data_itemnumoflist') {
                    const rawKey = getTextInputValue(numBlock, 'ITEM');
                    if (comment === '@ruby:hash:get:sym') {
                        // Symbol key: ":name" → $a[:name]
                        const symName = rawKey.slice(1); // remove leading ":"
                        return [`${hashVarName}[:${symName}]`, Generator.ORDER_FUNCTION_CALL];
                    }
                    // String key: "foo" → $a["foo"]
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
