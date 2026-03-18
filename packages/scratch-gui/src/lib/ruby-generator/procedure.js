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

    /**
     * Generate super call code from a procedures_call block with super comment.
     * @param {object} block - The procedures_call block
     * @param {string} superComment - `@ruby`:super or `@ruby`:super:forwarding
     * @returns {string} The super call code (without trailing newline)
     */
    const generateSuperCall = function (block, superComment) {
        if (superComment === '@ruby:super:forwarding') {
            return 'super';
        }
        // SuperNode: output 'super(args)'
        const args = [];
        const paramNamesIdsAndDefaults =
            Generator.currentTarget.blocks.getProcedureParamNamesIdsAndDefaults(block.mutation.proccode);
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
        const argsString = args.length > 0 ? `(${args.join(', ')})` : '';
        return `super${argsString}`;
    };

    /**
     * Generate method header with a specific name (for renamed module methods with super_of).
     * @param {object} defBlock - The procedures_definition block
     * @param {object} customBlock - The procedures_prototype block
     * @param {string} originalName - The original method name to use
     * @returns {string} The method header code
     */
    const blockToMethodWithName = function (defBlock, customBlock, originalName) {
        const args = [];
        const paramNamesIdsAndDefaults =
            Generator.currentTarget.blocks.getProcedureParamNamesIdsAndDefaults(customBlock.mutation.proccode);
        for (let i = 0; i < paramNamesIdsAndDefaults[0].length; i++) {
            let paramName = Generator.escapeVariableName(paramNamesIdsAndDefaults[0][i]);
            paramName = toSnakeCaseLowercase(paramName);
            args.push(paramName);
        }
        const argsString = args.length > 0 ? `(${args.join(', ')})` : '';
        if (Generator.version.toString() === '2') {
            return `def ${originalName}${argsString}\n`;
        }
        return `def self.${originalName}${argsString}\n`;
    };

    Generator.procedures_definition = function (block) {
        // Check for @ruby:module_source:ModuleName comment
        // Extended format: @ruby:module_source:Mod:super_of:originalName
        const comment = Generator.getCommentText(block);
        const moduleSourceMatch = comment && comment.match(/^@ruby:module_source:(.+)$/m);

        // Check for super_of: extract original method name for renamed module methods
        let superOfOriginalName = null;
        if (moduleSourceMatch) {
            const superOfMatch = moduleSourceMatch[1].match(/^(.+):super_of:(.+)$/);
            if (superOfMatch) {
                superOfOriginalName = superOfMatch[2];
            }
        }

        const customBlock = Generator.getInputTargetBlock(block, 'custom_block');

        // Save and temporarily clear block.next to prevent scrub_ from processing it
        const savedNext = block.next;
        block.next = null;

        // Generate method header (def self.method_name(args))
        // If this is a renamed module method (super_of), use the original name
        let code;
        if (superOfOriginalName) {
            code = blockToMethodWithName(block, customBlock, superOfOriginalName);
        } else {
            code = Generator.blockToCode(customBlock);
        }

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

                // Check if the block before the return assignment is a super call.
                // If so, store the super call in returnCallCache_ so the return
                // assignment's data_variable can retrieve it as the implicit return value.
                let prevBlock = bodyBlock;
                while (prevBlock.next && Generator.getBlock(prevBlock.next) !== lastBlock) {
                    prevBlock = Generator.getBlock(prevBlock.next);
                }
                if (prevBlock !== lastBlock) {
                    const prevComment = Generator.getCommentText(prevBlock);
                    if (prevComment === '@ruby:super' || prevComment === '@ruby:super:forwarding') {
                        const superCode = generateSuperCall(prevBlock, prevComment);
                        // Set up cache so the return block outputs the super call
                        // The return comment contains the method name
                        const returnComment = Generator.getCommentText(lastBlock);
                        if (returnComment) {
                            const returnMatch = returnComment.match(/@ruby:return:(\w+)/);
                            if (returnMatch) {
                                if (!Generator.returnCallCache_) {
                                    Generator.returnCallCache_ = {};
                                }
                                Generator.returnCallCache_[returnMatch[1]] = superCode;
                            }
                        }
                    }
                }
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

        // If this is a module method, store the code separately and suppress from main output
        if (moduleSourceMatch) {
            // Extract module name (handle super_of: suffix)
            let moduleName = moduleSourceMatch[1];
            const superOfIdx = moduleName.indexOf(':super_of:');
            if (superOfIdx !== -1) {
                moduleName = moduleName.substring(0, superOfIdx);
            }
            if (!Generator._moduleMethodCodes[moduleName]) {
                Generator._moduleMethodCodes[moduleName] = [];
            }
            Generator._moduleMethodCodes[moduleName].push(code);
            return '';
        }

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
        const comment = Generator.getCommentText(block);

        // Check if this is a super call AND next block is a return assignment
        // (i.e., super is the last expression in a method with return value)
        if (comment === '@ruby:super' || comment === '@ruby:super:forwarding') {
            const nextBlock = Generator.getBlock(block.next);
            if (Generator.isRubyReturnAssignment(nextBlock)) {
                // Super is the implicit return value — suppress this block's output.
                // The data_setvariableto handler will output the value.
                // Store the super call so data_setvariableto can use it.
                const superCode = generateSuperCall(block, comment);
                if (!Generator.returnCallCache_) {
                    Generator.returnCallCache_ = {};
                }
                // Extract method name from the return assignment comment
                const nextComment = Generator.getCommentText(nextBlock);
                if (nextComment) {
                    const match = nextComment.match(/@ruby:return:(\w+)/);
                    if (match) {
                        Generator.returnCallCache_[match[1]] = superCode;
                    }
                }
                return '';
            }
            // Super call as a standalone statement
            return `${generateSuperCall(block, comment)}\n`;
        }

        // Check if this procedures_call has @ruby:return:methodName comment
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
