import _ from 'lodash';

/**
 * Variables converter
 */
const VariablesConverter = {
    register: function (converter) {
        // === Smalruby: Start of array syntax ===
        /**
         * Convert a data_variable block to data_listcontents for list operations.
         * When $a (global) or @a (instance) is used with array methods like .push(),
         * the variable read creates a data_variable block, but list operations need
         * a data_listcontents block with LIST field.
         * @param {Object} block - The receiver block to convert
         * @returns {{block: Object|null, converted: boolean}} The converted block and whether conversion happened
         */
        const convertToListBlock = function (block) {
            if (!converter._isBlock(block)) return {block: null, converted: false};

            // Already a list block, no conversion needed
            if (converter.isListBlock(block)) return {block, converted: false};

            // Only convert data_variable blocks in version 2
            if (converter.version < 2) return {block: null, converted: false};
            if (block.opcode !== 'data_variable') return {block: null, converted: false};

            const varName = block.fields.VARIABLE.value;
            const variable = converter._context.variables[varName] ||
                converter._context.localVariables[varName];
            if (!variable) return {block: null, converted: false};

            let prefixedName;
            if (variable.scope === 'global') {
                prefixedName = `$${varName}`;
            } else if (variable.scope === 'instance') {
                prefixedName = `@${varName}`;
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
         * Adjust a 0-indexed Ruby array index to 1-indexed Scratch list index.
         * Only adjusts when the receiver was converted from variable to list (array syntax).
         */
        const adjustIndex = function (index, converted) {
            if (!converted) return index;
            if (typeof index === 'number') return index + 1;
            if (converter._isPrimitive(index) &&
                (index.type === 'int' || index.type === 'float')) {
                return index.value + 1;
            }
            // For block expressions, wrap in operator_add(index, 1) with comment
            // This is handled at the generator level via @ruby:array:index_offset
            return index;
        };
        // === Smalruby: End of array syntax ===

        converter.registerOnSend('self', 'show_variable', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            const variable = converter._lookupOrCreateVariable(args[0]);
            if (variable.scope === 'global' || variable.scope === 'instance') {
                return converter._createBlock('data_showvariable', 'statement', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            }
            return null;
        });

        converter.registerOnSend('self', 'hide_variable', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            const variable = converter._lookupOrCreateVariable(args[0]);
            if (variable.scope === 'global' || variable.scope === 'instance') {
                return converter._createBlock('data_hidevariable', 'statement', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            }
            return null;
        });

        converter.registerOnSend('self', 'list', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            const variable = converter._lookupOrCreateList(args[0]);
            if (variable.scope === 'global' || variable.scope === 'instance') {
                return converter._createBlock('data_listcontents', 'value_variable', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            }
            return null;
        });

        converter.registerOnSend('self', 'show_list', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            const variable = converter._lookupOrCreateList(args[0]);
            if (variable.scope === 'global' || variable.scope === 'instance') {
                return converter._createBlock('data_showlist', 'statement', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            }
            return null;
        });

        converter.registerOnSend('self', 'hide_list', 1, params => {
            const {args} = params;
            if (!converter._isString(args[0])) return null;

            const variable = converter._lookupOrCreateList(args[0]);
            if (variable.scope === 'global' || variable.scope === 'instance') {
                return converter._createBlock('data_hidelist', 'statement', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            }
            return null;
        });

        converter.registerOnSend('variable', 'push', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

            // === Smalruby: Start of array syntax ===
            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;
            // === Smalruby: End of array syntax ===

            const block = converter._changeBlock(recv, 'data_addtolist', 'statement');
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing'
            );
            return block;
        });

        // === Smalruby: Start of array syntax ===
        converter.registerOnSend('variable', '<<', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;

            const block = converter._changeBlock(recv, 'data_addtolist', 'statement');
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing'
            );
            return block;
        });
        // === Smalruby: End of array syntax ===

        converter.registerOnSend('variable', 'delete_at', 1, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;

            // === Smalruby: Start of array syntax ===
            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;
            const index = adjustIndex(args[0], converted);
            // === Smalruby: End of array syntax ===

            const block = converter._changeBlock(recv, 'data_deleteoflist', 'statement');
            converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
            return block;
        });

        converter.registerOnSend('variable', 'clear', 0, params => {
            const {receiver} = params;

            // === Smalruby: Start of array syntax ===
            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;
            // === Smalruby: End of array syntax ===

            return converter._changeBlock(recv, 'data_deletealloflist', 'statement');
        });

        converter.registerOnSend('variable', 'insert', 2, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;
            if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1])) return null;

            // === Smalruby: Start of array syntax ===
            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;
            const index = adjustIndex(args[0], converted);
            // === Smalruby: End of array syntax ===

            const block = converter._changeBlock(recv, 'data_insertatlist', 'statement');
            converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[1]) ? args[1].toString() : args[1], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', '[]=', 2, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;
            if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1])) return null;

            // === Smalruby: Start of array syntax ===
            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;
            const index = adjustIndex(args[0], converted);
            // === Smalruby: End of array syntax ===

            const block = converter._changeBlock(recv, 'data_replaceitemoflist', 'statement');
            converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[1]) ? args[1].toString() : args[1], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', '[]', 1, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;

            // === Smalruby: Start of array syntax ===
            const {block: listBlock, converted} = convertToListBlock(receiver);
            if (converted && listBlock) {
                const index = adjustIndex(args[0], true);
                const block = converter._changeBlock(listBlock, 'data_itemoflist', 'value');
                converter._addNumberInput(block, 'INDEX', 'math_integer', index, 1);
                return block;
            }
            // === Smalruby: End of array syntax ===

            if (converter._isBlock(receiver) && converter.isListBlock(receiver)) {
                const block = converter._changeBlock(receiver, 'data_itemoflist', 'value');
                converter._addNumberInput(block, 'INDEX', 'math_integer', args[0], 1);
                return block;
            }

            return null;
        });

        converter.registerOnSend('variable', 'index', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

            // === Smalruby: Start of array syntax ===
            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;
            // === Smalruby: End of array syntax ===

            const block = converter._changeBlock(recv, 'data_itemnumoflist', 'value');
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing'
            );

            // === Smalruby: Start of array syntax ===
            // Wrap in operator_subtract(result, 1) for 0-indexed return value
            if (converted) {
                const subtractBlock = converter._createBlock('operator_subtract', 'value');
                converter._addInput(subtractBlock, 'NUM1', block);
                converter._addNumberInput(subtractBlock, 'NUM2', 'math_number', 1, 0);
                subtractBlock.comment = converter._createComment(
                    '@ruby:array:index', subtractBlock.id
                );
                return subtractBlock;
            }
            // === Smalruby: End of array syntax ===

            return block;
        });

        converter.registerOnSend('variable', 'length', 0, params => {
            const {receiver} = params;

            // === Smalruby: Start of array syntax ===
            const {block: listBlock, converted} = convertToListBlock(receiver);
            if (converted && listBlock) {
                return converter._changeBlock(listBlock, 'data_lengthoflist', 'value');
            }
            // === Smalruby: End of array syntax ===

            if (converter._isBlock(receiver) && converter.isListBlock(receiver)) {
                return converter._changeBlock(receiver, 'data_lengthoflist', 'value');
            }
            return null;
        });

        converter.registerOnSend('variable', 'include?', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

            // === Smalruby: Start of array syntax ===
            const {block: listBlock, converted} = convertToListBlock(receiver);
            const recv = converted ? listBlock : receiver;
            if (!recv) return null;
            // === Smalruby: End of array syntax ===

            const block = converter._changeBlock(recv, 'data_listcontainsitem', 'value');
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing'
            );
            return block;
        });

        // Operator to opcode mapping for compound assignments
        const COMPOUND_OPERATOR_MAP = {
            '-': 'operator_subtract',
            '*': 'operator_multiply',
            '/': 'operator_divide',
            '%': 'operator_mod'
        };

        // Register onXxx handlers
        converter.registerOnOpAsgn((lh, operator, rh) => {
            let block;
            if (!converter._isString(lh)) {
                return block;
            }
            if (!converter._isNumberOrBlock(rh) && !converter._isStringOrBlock(rh)) {
                return block;
            }

            const variable = converter._lookupOrCreateVariable(lh);

            if (operator === '+') {
                // Check if this is a string-typed variable: use operator_join
                if (variable.dataType === 'string') {
                    block = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });

                    const syntaxComment = `@ruby:syntax:+=`;
                    if (variable.scope === 'local') {
                        const lvarComment = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                        block.comment = converter._createComment(
                            `${lvarComment},${syntaxComment}`, block.id
                        );
                    } else {
                        block.comment = converter._createComment(syntaxComment, block.id);
                    }

                    const variableBlock = converter._createBlock('data_variable', 'value_variable', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });
                    if (variable.scope === 'local') {
                        const lvarComment = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                        variableBlock.comment = converter._createComment(lvarComment, variableBlock.id);
                    }

                    const joinBlock = converter._createBlock('operator_join', 'value');
                    converter._addTextInput(joinBlock, 'STRING1', variableBlock, 'apple');
                    converter._addTextInput(
                        joinBlock, 'STRING2', converter._isNumber(rh) ? rh.toString() : rh, 'banana'
                    );

                    converter._addInput(block, 'VALUE', joinBlock);
                } else if (variable.scope === 'global' || variable.scope === 'instance') {
                    if (!converter._isNumberOrBlock(rh)) return block;

                    block = converter._createBlock('data_changevariableby', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });
                    converter._addNumberInput(block, 'VALUE', 'math_number', rh, 1);
                } else {
                    // Numeric += for local variables
                    if (!converter._isNumberOrBlock(rh)) return block;

                    block = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });

                    const lvarComment = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                    block.comment = converter._createComment(
                        `${lvarComment},@ruby:syntax:+=`, block.id
                    );

                    const variableBlock = converter._createBlock('data_variable', 'value_variable', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });
                    variableBlock.comment = converter._createComment(lvarComment, variableBlock.id);

                    const addBlock = converter._createBlock('operator_add', 'value');
                    converter._addInput(addBlock, 'NUM1', variableBlock);
                    converter._addNumberInput(addBlock, 'NUM2', 'math_number', rh, 1);

                    converter._addInput(block, 'VALUE', addBlock);
                }
            } else if (Object.prototype.hasOwnProperty.call(COMPOUND_OPERATOR_MAP, operator)) {
                if (!converter._isNumberOrBlock(rh)) return block;

                const opcode = COMPOUND_OPERATOR_MAP[operator];

                block = converter._createBlock('data_setvariableto', 'statement', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });

                const syntaxComment = `@ruby:syntax:${operator}=`;
                if (variable.scope === 'local') {
                    const lvarComment = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                    block.comment = converter._createComment(
                        `${lvarComment},${syntaxComment}`, block.id
                    );
                } else {
                    block.comment = converter._createComment(syntaxComment, block.id);
                }

                const variableBlock = converter._createBlock('data_variable', 'value_variable', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });

                if (variable.scope === 'local') {
                    const lvarComment = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                    variableBlock.comment = converter._createComment(lvarComment, variableBlock.id);
                }

                const operatorBlock = converter._createBlock(opcode, 'value');
                converter._addInput(operatorBlock, 'NUM1', variableBlock);
                converter._addNumberInput(operatorBlock, 'NUM2', 'math_number', rh, 1);

                converter._addInput(block, 'VALUE', operatorBlock);
            }
            return block;
        });

        converter.registerOnVar((scope, variable) => {
            if (scope === 'global' || scope === 'instance') {
                return converter._createBlock('data_variable', 'value_variable', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
            } else if (scope === 'local' && !variable.isArgument) {
                const block = converter._createBlock('data_variable', 'value_variable', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });

                const commentText = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                block.comment = converter._createComment(commentText, block.id);

                return block;
            }
            return null;
        });

        converter.registerOnVasgn((scope, variable, rh) => {
            // === Smalruby: Start of array syntax ===
            if ((scope === 'global' || scope === 'instance') &&
                converter.version >= 2 &&
                converter._isArray(rh)) {
                const elements = rh.value;
                let prefixedName;
                if (variable.scope === 'global') {
                    prefixedName = `$${variable.name}`;
                } else {
                    prefixedName = `@${variable.name}`;
                }
                const listVar = converter._lookupOrCreateList(prefixedName);

                // Create clear block
                const clearBlock = converter._createBlock('data_deletealloflist', 'statement', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: listVar.id,
                            value: listVar.name,
                            variableType: listVar.type
                        }
                    }
                });
                clearBlock.comment = converter._createComment(
                    `@ruby:array:literal:${elements.length}`, clearBlock.id
                );

                // Create push blocks for each element
                const blocks = [clearBlock];
                for (let i = 0; i < elements.length; i++) {
                    const elem = elements[i];
                    const pushBlock = converter._createBlock('data_addtolist', 'statement', {
                        fields: {
                            LIST: {
                                name: 'LIST',
                                id: listVar.id,
                                value: listVar.name,
                                variableType: listVar.type
                            }
                        }
                    });
                    converter._addTextInput(
                        pushBlock, 'ITEM',
                        converter._isNumber(elem) ? elem.toString() : elem, 'thing'
                    );
                    pushBlock.comment = converter._createComment(
                        '@ruby:array:literal:element', pushBlock.id
                    );
                    blocks.push(pushBlock);
                }

                // Link blocks
                return converter._linkBlocks(blocks);
            }
            // === Smalruby: End of array syntax ===

            if (scope === 'global' || scope === 'instance') {
                if (converter._isNumberOrBlock(rh) || converter._isStringOrBlock(rh)) {
                    const block = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });
                    converter._addTextInput(block, 'VALUE', converter._isNumber(rh) ? rh.toString() : rh, '0');
                    variable.dataType = converter._inferDataType(rh);
                    return block;
                }
            } else if (scope === 'local' && !variable.isArgument) {
                if (converter._isNumberOrBlock(rh) || converter._isStringOrBlock(rh)) {
                    const block = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });

                    const commentText = `@ruby:lvar:${variable.originalName}:${variable.scopeIndex}`;
                    block.comment = converter._createComment(commentText, block.id);

                    converter._addTextInput(block, 'VALUE', converter._isNumber(rh) ? rh.toString() : rh, '0');
                    variable.dataType = converter._inferDataType(rh);
                    return block;
                }
            }
            return null;
        });
    }
};

export default VariablesConverter;
