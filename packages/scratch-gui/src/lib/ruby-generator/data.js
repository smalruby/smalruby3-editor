import DataListBlocks from './data-list.js';

/**
 * Define Ruby code generator for Variables Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.data_variable = function (block) {
        let variable = Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));
        const comment = Generator.getCommentText(block);

        // Check for local variable metadata (may be mixed with user comments)
        if (comment) {
            const lvarMatch = comment.match(/@ruby:lvar:([^:,\s]+):\d+/);
            if (lvarMatch && !comment.includes('@ruby:return:')) {
                return [lvarMatch[1], Generator.ORDER_ATOMIC];
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

        // === Smalruby: Start of bare literal generation ===
        if (comment && comment.startsWith('@ruby:literal:')) {
            const value = Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) || '""';
            const litType = comment.replace('@ruby:literal:', '');
            if (litType === 'string') {
                return `${value}\n`;
            }
            if (litType === 'integer' || litType === 'float') {
                return `${Generator.nosToCode(value)}\n`;
            }
            return `${value}\n`;
        }
        // === Smalruby: End of bare literal generation ===

        // === Smalruby: Start of regex literal variable generation ===
        if (comment && comment.includes('@ruby:regexp:literal') && hasValueInput) {
            const lvarMatch = comment.match(/@ruby:lvar:([^:,\s]+):\d+/);
            const variable = lvarMatch ?
                lvarMatch[1] :
                Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));
            const value = Generator.valueToCode(block, 'VALUE', Generator.ORDER_NONE) || '""';
            const regexLiteral = Generator.unquoteRegex_(value) || Generator.nosToCode(value);
            return `${variable} = ${regexLiteral}\n`;
        }
        // === Smalruby: End of regex literal variable generation ===

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
                // Check if there's a cached super call for this method
                const returnMethodMatch = comment.match(/@ruby:return:(\w+)/);
                if (returnMethodMatch && Generator.returnCallCache_ &&
                    Generator.returnCallCache_[returnMethodMatch[1]]) {
                    const cachedCall = Generator.returnCallCache_[returnMethodMatch[1]];
                    delete Generator.returnCallCache_[returnMethodMatch[1]];
                    return `${cachedCall}\n`;
                }
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

    Generator.data_listcontents = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const lvarMatch = comment.match(/@ruby:lvar:([^:,\s]+)/);
            if (lvarMatch) {
                return [lvarMatch[1], Generator.ORDER_COLLECTION];
            }
        }
        const list = Generator.listName(Generator.getFieldId(block, 'LIST'));
        return [list, Generator.ORDER_COLLECTION];
    };

    // Register list operation generators
    DataListBlocks(Generator);

    return Generator;
}
