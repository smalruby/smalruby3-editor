/**
 * Define Ruby code generator for Variables Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.data_variable = function (block) {
        let variable = Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));
        const comment = Generator.getCommentText(block);
        if (comment && comment === '@ruby:return') {
            // This is a return value reference, try to find the corresponding method call
            // Variable name format: @_return_methodName or _return_methodName
            let varName = variable;
            if (varName[0] === '@') {
                varName = varName.substring(1);
            }

            // Extract method name from variable name
            const match = varName.match(/^_return_(.+)$/);
            if (match) {
                const methodName = match[1];

                // Check if we have a cached method call for this method
                if (Generator.returnCallCache_ && Generator.returnCallCache_[methodName]) {
                    const methodCall = Generator.returnCallCache_[methodName];
                    // Clear the cache entry after use
                    delete Generator.returnCallCache_[methodName];
                    return [methodCall, Generator.ORDER_FUNCTION_CALL];
                }
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

        // Check if this is a return value assignment marker (no VALUE input)
        if (comment && comment.startsWith('@ruby:return:')) {
            // This block marks where the return value will be stored,
            // but doesn't actually contain the value (it's in the previous procedures_call).
            // The actual assignment will be suppressed by procedures_call generator.
            // Return empty string to suppress output.
            return '';
        }

        const variable = Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));

        // Check if this is a return value marker block (return variable with no VALUE input)
        const hasValueInput = block.inputs && block.inputs.VALUE && block.inputs.VALUE.block;
        if (!hasValueInput) {
            // Check if variable name matches return variable pattern
            let varName = variable;
            if (varName[0] === '@') {
                varName = varName.substring(1);
            }
            if (varName.startsWith('_return_')) {
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
        const list = Generator.listName(Generator.getFieldId(block, 'LIST'));
        return `list(${Generator.quote_(list)})`;
    };

    const getListIndex = function (block) {
        const index = Generator.valueToCode(block, 'INDEX', Generator.ORDER_NONE) || 1;
        if (index === '0') {
            return 1;
        }
        return index;
    };

    Generator.data_listcontents = function (block) {
        const list = getListName(block);
        return [list, Generator.ORDER_COLLECTION];
    };

    Generator.data_addtolist = function (block) {
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
        const index = getListIndex(block);
        const list = getListName(block);
        return [`${list}[${index}]`, Generator.ORDER_FUNCTION_CAL];
    };

    Generator.data_itemnumoflist = function (block) {
        const item = Generator.valueToCode(block, 'ITEM', Generator.ORDER_NONE) || '0';
        const list = getListName(block);
        return [`${list}.index(${Generator.nosToCode(item)})`, Generator.ORDER_FUNCTION_CAL];
    };

    Generator.data_lengthoflist = function (block) {
        const list = getListName(block);
        return [`${list}.length`, Generator.ORDER_FUNCTION_CAL];
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
