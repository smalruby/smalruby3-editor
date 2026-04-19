// === Smalruby: This file is Smalruby-specific (Ruby method extension converter) ===

import { convertToListBlock } from './variable-hash-ops';
import { messages } from './converter-errors';
import {
    buildMutation,
    stringMethodArgs,
    stringMethodMenuItems,
    arrayMethodArgs,
    arrayMethodMenuItems,
    hashMethodArgs,
    hashMethodMenuItems,
} from './smalruby-ruby-definitions';

// Set of all registered method names per class
const STRING_METHODS = new Set(Object.keys(stringMethodArgs));
const ARRAY_METHODS = new Set(Object.keys(arrayMethodArgs));
const HASH_METHODS = new Set(Object.keys(hashMethodArgs));

/**
 * Converter for Smalruby Ruby extension blocks.
 */
const SmalrubyRubyConverter = {
    register: function (converter) {
        // --- Helper: create a class method COMMAND block ---
        const createMethodBlock = (opcode, method, receiver, args, methodArgs, menuItems) => {
            const mutation = buildMutation(
                method,
                `${opcode.replace('smalrubyRuby_', '').replace('Method', '')}MethodMenu`,
                methodArgs,
                menuItems,
            );
            if (!mutation) return null;
            const block = converter._createBlock(opcode, 'statement', {
                mutation,
            });
            converter._addTextInput(block, 'RECEIVER', receiver, 'string');
            converter._addField(block, 'METHOD', method);
            const addArg = (name, value, defaultVal) => {
                if (converter._isNumber(value)) {
                    converter._addNumberInput(block, name, 'math_number', value, 0);
                } else {
                    converter._addTextInput(block, name, value, defaultVal);
                }
            };
            if (args.length > 0) {
                addArg('ARG1', args[0], '');
            }
            if (args.length > 1) {
                addArg('ARG2', args[1], '');
            }
            return block;
        };

        // --- Helper: create a bang method COMMAND block ---
        const createBangMethodBlock = (opcode, method, receiver, args, methodArgs, menuItems) => {
            const varInfo = converter.lookupVariableFromVariableBlock(receiver);
            if (!varInfo) return null;
            const mutation = buildMutation(
                method,
                `${opcode.replace('smalrubyRuby_', '').replace('Method', '')}MethodMenu`,
                methodArgs,
                menuItems,
            );
            if (!mutation) return null;
            const block = converter._createBlock(opcode, 'statement', {
                mutation,
            });
            converter._addField(block, 'RECEIVER', varInfo.name);
            converter._addField(block, 'METHOD', method);
            if (args.length > 0) {
                converter._addTextInput(block, 'ARG1', args[0], '');
            }
            if (args.length > 1) {
                converter._addTextInput(block, 'ARG2', args[1], '');
            }
            return block;
        };

        // --- Register string methods ---
        const registerStringMethod = (method, numArgs) => {
            if (method.endsWith('!')) {
                converter.registerOnSend(['variable'], method, numArgs, (params) => {
                    const { receiver, args } = params;
                    return createBangMethodBlock(
                        'smalrubyRuby_stringMethod',
                        method,
                        receiver,
                        args,
                        stringMethodArgs,
                        stringMethodMenuItems,
                    );
                });
            } else {
                converter.registerOnSend(
                    ['string', 'block', 'variable'],
                    method,
                    numArgs,
                    (params) => {
                        const { receiver, args } = params;
                        return createMethodBlock(
                            'smalrubyRuby_stringMethod',
                            method,
                            receiver,
                            args,
                            stringMethodArgs,
                            stringMethodMenuItems,
                        );
                    },
                );
            }
        };

        // 0-arg string methods (empty? handled by operators.js)
        ['reverse', 'upcase', 'downcase', 'lines'].forEach((m) =>
            registerStringMethod(m, 0),
        );
        // 1-arg string methods
        registerStringMethod('delete', 1);
        // String#* — only for string literal receivers to avoid conflict with numeric *
        converter.registerOnSend(['string'], '*', 1, (params) => {
            const { receiver, args } = params;
            return createMethodBlock(
                'smalrubyRuby_stringMethod',
                '*',
                receiver,
                args,
                stringMethodArgs,
                stringMethodMenuItems,
            );
        });
        // 2-arg string methods
        registerStringMethod('gsub', 2);
        // bang methods
        registerStringMethod('reverse!', 0);
        registerStringMethod('delete!', 1);
        registerStringMethod('gsub!', 2);

        // --- Register array methods ---
        const registerArrayMethod = (method, numArgs) => {
            if (method.endsWith('!')) {
                converter.registerOnSend(['variable'], method, numArgs, (params) => {
                    const { receiver, args } = params;
                    return createBangMethodBlock(
                        'smalrubyRuby_arrayMethod',
                        method,
                        receiver,
                        args,
                        arrayMethodArgs,
                        arrayMethodMenuItems,
                    );
                });
            } else {
                converter.registerOnSend(
                    ['string', 'block', 'variable', 'array'],
                    method,
                    numArgs,
                    (params) => {
                        let { receiver } = params;
                        const { args } = params;
                        // Convert data_variable to data_listcontents for list variables
                        const result = convertToListBlock(
                            converter,
                            messages,
                            receiver,
                        );
                        if (result.converted) {
                            receiver = result.block;
                        }
                        return createMethodBlock(
                            'smalrubyRuby_arrayMethod',
                            method,
                            receiver,
                            args,
                            arrayMethodArgs,
                            arrayMethodMenuItems,
                        );
                    },
                );
            }
        };

        // 0-arg array methods (empty? handled by variable-list-ops.js)
        ['max', 'min', 'sort', 'reverse', 'first', 'last'].forEach(
            (m) => registerArrayMethod(m, 0),
        );
        // join: 0-1 args
        registerArrayMethod('join', 0);
        registerArrayMethod('join', 1);
        // bang methods
        registerArrayMethod('sort!', 0);
        registerArrayMethod('reverse!', 0);

        // --- Register hash methods ---
        const registerHashMethod = (method) => {
            converter.registerOnSend(
                ['string', 'block', 'variable', 'hash'],
                method,
                0,
                (params) => {
                    const { receiver } = params;

                    // For keys/values, reference the correct hash sub-list
                    if (
                        (method === 'keys' || method === 'values') &&
                        converter._isBlock(receiver) &&
                        receiver.opcode === 'data_variable'
                    ) {
                        const varName = receiver.fields.VARIABLE.value;
                        const variable =
                            converter._context.variables[varName] ||
                            converter._context.localVariables[varName];
                        if (variable) {
                            let prefixedName;
                            if (variable.scope === 'global')
                                prefixedName = `$${varName}`;
                            else if (variable.scope === 'instance')
                                prefixedName = `@${varName}`;
                            else if (variable.scope === 'local')
                                prefixedName = variable.originalName;

                            if (prefixedName) {
                                const listName =
                                    method === 'keys'
                                        ? converter._hashKeysListName(
                                              prefixedName,
                                          )
                                        : converter._hashValuesListName(
                                              prefixedName,
                                          );
                                const listVar =
                                    converter._lookupOrCreateList(listName);
                                receiver.opcode = 'data_listcontents';
                                delete receiver.fields.VARIABLE;
                                receiver.fields.LIST = {
                                    name: 'LIST',
                                    id: listVar.id,
                                    value: listVar.name,
                                    variableType: listVar.type,
                                };
                            }
                        }
                    }

                    return createMethodBlock(
                        'smalrubyRuby_hashMethod',
                        method,
                        receiver,
                        [],
                        hashMethodArgs,
                        hashMethodMenuItems,
                    );
                },
            );
        };

        registerHashMethod('keys');
        registerHashMethod('values');

        // --- Helper: create arrayMethodWithBlock ---
        const createArrayMethodWithBlock = (
            method,
            receiver,
            rubyBlock,
            rubyBlockArgs,
        ) => {
            if (typeof rubyBlock === 'undefined') return null;
            // Convert data_variable to data_listcontents for list variables
            const result = convertToListBlock(
                converter,
                messages,
                receiver,
            );
            if (result.converted) {
                receiver = result.block;
            }
            const block = converter._createBlock(
                'smalrubyRuby_arrayMethodWithBlock',
                'statement',
            );
            converter._addTextInput(
                block,
                'RECEIVER',
                receiver,
                '',
            );
            converter._addField(block, 'METHOD', method);

            // Handle block parameters: store mapping in comment
            if (rubyBlockArgs && rubyBlockArgs.length > 0) {
                const commentParts = [];
                rubyBlockArgs.forEach((paramName, idx) => {
                    commentParts.push(
                        `@ruby:block_param:${idx + 1}:${paramName}`,
                    );
                });
                block.comment = converter._createComment(
                    commentParts.join('\n'),
                    block.id,
                );

                // Replace variable references in body with blockParam blocks
                if (rubyBlock) {
                    // Build mapping: Scratch variable name → param index
                    const varNameToParamIdx = {};
                    rubyBlockArgs.forEach((paramName, idx) => {
                        const variable =
                            converter._lookupOrCreateVariable(paramName);
                        varNameToParamIdx[variable.name] = idx;
                    });

                    const replaceParamVars = (blockId) => {
                        if (!blockId) return;
                        const b = converter._context.blocks[blockId];
                        if (!b) return;
                        // Check inputs for variable references
                        if (b.inputs) {
                            for (const inputName of Object.keys(b.inputs)) {
                                const input = b.inputs[inputName];
                                const childBlock =
                                    converter._context.blocks[input.block];
                                if (
                                    childBlock &&
                                    childBlock.opcode ===
                                        'data_variable' &&
                                    childBlock.fields &&
                                    childBlock.fields.VARIABLE
                                ) {
                                    const varName =
                                        childBlock.fields.VARIABLE.value;
                                    const paramIdx =
                                        varNameToParamIdx[varName];
                                    if (paramIdx >= 0) {
                                        // Replace with blockParam block
                                        childBlock.opcode =
                                            'smalrubyRuby_blockParam';
                                        delete childBlock.fields
                                            .VARIABLE;
                                        childBlock.fields.PARAM = {
                                            name: 'PARAM',
                                            value: `_${paramIdx + 1}`,
                                        };
                                        converter._setBlockType(
                                            childBlock,
                                            'value',
                                        );
                                    }
                                }
                                // Recurse into child inputs
                                if (input.block) {
                                    replaceParamVars(input.block);
                                }
                            }
                        }
                        // Recurse into next blocks
                        if (b.next) {
                            replaceParamVars(b.next);
                        }
                        // Recurse into SUBSTACK
                        if (
                            b.inputs &&
                            b.inputs.SUBSTACK &&
                            b.inputs.SUBSTACK.block
                        ) {
                            replaceParamVars(
                                b.inputs.SUBSTACK.block,
                            );
                        }
                    };
                    replaceParamVars(rubyBlock.id);
                }
            }

            converter._addSubstack(block, rubyBlock);
            return block;
        };

        // --- Register array method with block (each, etc.) ---
        // Without block params: ticket.each do ... end
        converter.registerOnSendWithBlock(
            ['string', 'block', 'variable', 'array'],
            'each',
            0,
            0,
            (params) => {
                const { receiver } = params;
                const { rubyBlock } = params;
                return createArrayMethodWithBlock(
                    'each',
                    receiver,
                    rubyBlock,
                    null,
                );
            },
        );

        // With block params: ticket.each do |item| ... end
        converter.registerOnSendWithBlock(
            ['string', 'block', 'variable', 'array'],
            'each',
            0,
            1,
            (params) => {
                const { receiver, rubyBlockArgs, rubyBlock } = params;
                return createArrayMethodWithBlock(
                    'each',
                    receiver,
                    rubyBlock,
                    rubyBlockArgs,
                );
            },
        );
    },
};

export { STRING_METHODS, ARRAY_METHODS, HASH_METHODS };
export default SmalrubyRubyConverter;
