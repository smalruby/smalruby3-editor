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
        // Use cached value if this is a second call for the same block
        const savedNext = '_savedBodyNext' in block ? block._savedBodyNext : block.next;
        if (!('_savedBodyNext' in block)) {
            block._savedBodyNext = block.next;
        }
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

        // Don't restore block.next because we've already processed it as the method body
        // Restoring it would cause targetToCode to process it again as a next block

        return code;
    };

    Generator.isRubyReturnAssignment = function (block) {
        if (!block || block.opcode !== 'data_setvariableto') return false;
        const comment = Generator.getCommentText(block);
        return comment && comment.startsWith('@ruby:return:');
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
            const nextBlock = Generator.getBlock(block.next);
            if (Generator.isRubyReturnAssignment(nextBlock)) {
                // Return null because this block is handled as an expression by the next block
                return null;
            }
            return `${methodName}${argsString}\n`;
        }
        return `def self.${methodName}${argsString}\n`;
    };

    Generator.procedures_call = function (block) {
        // Check if this procedures_call has @ruby:return:methodName comment
        const comment = Generator.getCommentText(block);
        if (comment && comment.startsWith('@ruby:return:')) {
            // Extract method name from comment
            const methodName = comment.replace('@ruby:return:', '');

            // Store the method call in cache for data_variable to retrieve
            if (!Generator.returnCallCache_) {
                Generator.returnCallCache_ = {};
            }
            Generator.returnCallCache_[methodName] = blockToMethod(block, true).trim();

            // This call will be integrated by data_variable later, suppress output
            // Return empty string (not null) to allow next block processing
            if (block.isExpression) {
                delete block.isExpression;
                return [Generator.returnCallCache_[methodName], Generator.ORDER_FUNCTION_CALL];
            }
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
