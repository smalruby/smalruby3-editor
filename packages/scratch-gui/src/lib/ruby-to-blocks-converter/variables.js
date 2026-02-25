import _ from 'lodash';

/**
 * Variables converter
 */
const VariablesConverter = {
    register: function (converter) {
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

            const block = converter._changeBlock(receiver, 'data_addtolist', 'statement');
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', 'delete_at', 1, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;

            const block = converter._changeBlock(receiver, 'data_deleteoflist', 'statement');
            converter._addNumberInput(block, 'INDEX', 'math_integer', args[0], 1);
            return block;
        });

        converter.registerOnSend('variable', 'clear', 0, params => {
            const {receiver} = params;
            return converter._changeBlock(receiver, 'data_deletealloflist', 'statement');
        });

        converter.registerOnSend('variable', 'insert', 2, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;
            if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1])) return null;

            const block = converter._changeBlock(receiver, 'data_insertatlist', 'statement');
            converter._addNumberInput(block, 'INDEX', 'math_integer', args[0], 1);
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[1]) ? args[1].toString() : args[1], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', '[]=', 2, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;
            if (!converter._isStringOrBlock(args[1]) && !converter._isNumberOrBlock(args[1])) return null;

            const block = converter._changeBlock(receiver, 'data_replaceitemoflist', 'statement');
            converter._addNumberInput(block, 'INDEX', 'math_integer', args[0], 1);
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[1]) ? args[1].toString() : args[1], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', '[]', 1, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;

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

            const block = converter._changeBlock(receiver, 'data_itemnumoflist', 'value');
            converter._addTextInput(
                block, 'ITEM', converter._isNumber(args[0]) ? args[0].toString() : args[0], 'thing'
            );
            return block;
        });

        converter.registerOnSend('variable', 'length', 0, params => {
            const {receiver} = params;
            if (converter._isBlock(receiver) && converter.isListBlock(receiver)) {
                return converter._changeBlock(receiver, 'data_lengthoflist', 'value');
            }
            return null;
        });

        converter.registerOnSend('variable', 'include?', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0]) && !converter._isNumberOrBlock(args[0])) return null;

            const block = converter._changeBlock(receiver, 'data_listcontainsitem', 'value');
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
