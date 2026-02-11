/**
 * Define Ruby code generator for Procedures Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    // Helper function to convert argument names to snake_case lowercase
    const toSnakeCaseLowercase = function (name) {
        return name
            // Replace any sequence of non-alphanumeric characters except underscores with underscore
            .replace(/[^a-zA-Z0-9_]+/g, '_')
            // Convert camelCase to snake_case: insert underscore before uppercase letters
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            // Convert to lowercase
            .toLowerCase();
    };

    Generator.procedures_definition = function (block) {
        const customBlock = Generator.getInputTargetBlock(block, 'custom_block');

        // Save and temporarily clear block.next to prevent scrub_ from processing it
        const savedNext = block.next;
        block.next = null;

        // Generate method header (def self.method_name(args))
        let code = Generator.blockToCode(customBlock);

        // Generate method body from the saved next block
        const bodyBlock = Generator.getBlock(savedNext);
        if (bodyBlock) {
            // Find the last block in the chain and mark it
            let lastBlock = bodyBlock;
            while (lastBlock.next) {
                const nextBlock = Generator.getBlock(lastBlock.next);
                if (!nextBlock) break;
                lastBlock = nextBlock;
            }

            // Mark the last block so data_setvariableto knows it's the final expression
            if (Generator.isRubyReturnAssignment(lastBlock)) {
                lastBlock._isLastReturnInProcedure = true;
            }

            const bodyCode = Generator.blockToCode(bodyBlock);
            code += Generator.prefixLines(bodyCode, Generator.INDENT);

            // Clean up the flag
            if (lastBlock._isLastReturnInProcedure) {
                delete lastBlock._isLastReturnInProcedure;
            }
        }

        code += 'end\n';

        // Restore block.next to prevent permanent modification of the block object
        // This is critical for subsequent calls to targetToCode
        // Note: We set it to null temporarily to prevent scrub_ from processing it,
        // but we must restore it here to avoid breaking future code generation
        block.next = savedNext;

        // Mark this block so scrub_ knows not to process block.next
        // (we've already manually processed it above)
        block._skipNextInScrub = true;

        return code;
    };

    Generator.isRubyReturnAssignment = function (block) {
        if (!block || block.opcode !== 'data_setvariableto') return false;
        const comment = Generator.getCommentText(block);
        if (comment && comment.startsWith('@ruby:return:')) return true;

        const hasValueInput = block.inputs && block.inputs.VALUE && block.inputs.VALUE.block;
        if (!hasValueInput) {
            const variable = Generator.variableName(Generator.getFieldId(block, 'VARIABLE'));
            let varName = variable;
            if (varName && varName[0] === '@') {
                varName = varName.substring(1);
            }
            if (varName && varName.startsWith('_return_')) {
                return true;
            }
        }
        return false;
    };

    const blockToMethod = function (block, isCall) {
        let methodName = block.mutation.proccode.split(' ')
            .filter(i => !/^%[sb]$/.test(i))
            .join('_');
        if (methodName.length === 0) {
            methodName = 'procedure';
        }
        const args = [];
        const paramNamesIdsAndDefaults =
            Generator.currentTarget.blocks.getProcedureParamNamesIdsAndDefaults(block.mutation.proccode);
        if (isCall) {
            const ids = paramNamesIdsAndDefaults[1];
            const defaults = paramNamesIdsAndDefaults[2];
            for (let i = 0; i < ids.length; i++) {
                let value;
                if (block.inputs[ids[i]]) {
                    value = Generator.valueToCode(block, ids[i], Generator.ORDER_NONE);
                } else {
                    value = defaults[i];
                }
                args.push(Generator.nosToCode(value));
            }
        } else {
            for (let i = 0; i < paramNamesIdsAndDefaults[0].length; i++) {
                // Convert argument name to snake_case lowercase
                let paramName = Generator.escapeVariableName(paramNamesIdsAndDefaults[0][i]);
                paramName = toSnakeCaseLowercase(paramName);
                args.push(paramName);
            }
        }
        const argsString = args.length > 0 ? `(${args.join(', ')})` : '';
        if (isCall) {
            return `${methodName}${argsString}\n`;
        }
        if (Generator.version.toString() === '2') {
            return `def ${methodName}${argsString}\n`;
        }
        return `def self.${methodName}${argsString}\n`;
    };

    Generator.procedures_call = function (block) {
        // Check if this procedures_call has @ruby:return:methodName comment
        const comment = Generator.getCommentText(block);
        if (comment && comment.startsWith('@ruby:return:')) {
            const methodName = comment.replace('@ruby:return:', '');

            // Store the method call in cache for data_variable to retrieve
            if (!Generator.returnCallCache_) {
                Generator.returnCallCache_ = {};
            }
            Generator.returnCallCache_[methodName] = blockToMethod(block, true).trim();

            // This call will be integrated by data_variable later, suppress output
            if (block.isExpression) {
                delete block.isExpression;
                return [Generator.returnCallCache_[methodName], Generator.ORDER_FUNCTION_CALL];
            }

            // Return value is used elsewhere, suppress standalone output
            return '';
        }

        const nextBlock = Generator.getBlock(block.next);
        if (Generator.isRubyReturnAssignment(nextBlock)) {
            if (block.isExpression) {
                delete block.isExpression;
                return [blockToMethod(block, true).trim(), Generator.ORDER_FUNCTION_CALL];
            }
            // Statement mode, but it will be handled as an expression by the next block.
            return '';
        }
        return blockToMethod(block, true);
    };

    Generator.procedures_prototype = function (block) {
        return blockToMethod(block, false);
    };

    Generator.argument_reporter_boolean = function (block) {
        const paramName = toSnakeCaseLowercase(Generator.escapeVariableName(Generator.getFieldValue(block, 'VALUE')));
        return [paramName, Generator.ORDER_ATOMIC];
    };

    Generator.argument_reporter_string_number = function (block) {
        const paramName = toSnakeCaseLowercase(Generator.escapeVariableName(Generator.getFieldValue(block, 'VALUE')));
        return [paramName, Generator.ORDER_ATOMIC];
    };

    return Generator;
}
