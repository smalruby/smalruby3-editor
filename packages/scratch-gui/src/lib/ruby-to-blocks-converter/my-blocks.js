import _ from 'lodash';
import Blockly from 'scratch-blocks';
import Primitive from './primitive';
import {RubyToBlocksConverterError} from './errors';

const Opal = global.Opal || window.Opal;

/**
 * My Blocks converter
 */
const MyBlocksConverter = {
    register: function (converter) {
        // Register my-block handler for procedure calls
        converter.registerOnSendMyBlock('self', params => {
            const {name, args, procedure} = params;

            if (procedure.argumentIds.length !== args.length) return null;

            const block = converter._createBlock('procedures_call', 'statement', {
                mutation: {
                    argumentids: JSON.stringify(procedure.argumentIds),
                    children: [],
                    proccode: procedure.procCode.join(' '),
                    tagName: 'mutation',
                    warp: 'false'
                }
            });

            let callIndex;
            let callCount;
            // Add comment if procedure has return value and used as value
            if (procedure.hasReturnValue && converter.isValueContext()) {
                callCount = converter._context.methodCallCounts[name] || 0;
                callIndex = (converter._context.methodCallIndices[name] || 0) + 1;
                converter._context.methodCallIndices[name] = callIndex;

                let commentText = `@ruby:return:${name}`;
                if (callIndex < callCount) {
                    commentText += `:${callIndex}`;
                }
                block.comment = converter._createComment(commentText, block.id);
            }

            if (Object.prototype.hasOwnProperty.call(converter._context.procedureCallBlocks, procedure.id)) {
                converter._context.procedureCallBlocks[procedure.id].push(block.id);
            } else {
                converter._context.procedureCallBlocks[procedure.id] = [block.id];
            }

            args.forEach((arg, i) => {
                const argumentId = procedure.argumentIds[i];
                if (converter._isFalseOrBooleanBlock(arg)) {
                    if (procedure.argumentVariables[i].isBoolean) {
                        if (!converter._isFalse(arg)) {
                            converter._addInput(block, argumentId, arg, null);
                        }
                        return;
                    }
                }
                if (!procedure.argumentVariables[i].isBoolean &&
                    (converter._isNumberOrBlock(arg) || converter._isStringOrBlock(arg))) {
                    converter._addTextInput(block, argumentId, converter._isNumber(arg) ? arg.toString() : arg, '');
                    return;
                }
                throw new RubyToBlocksConverterError(
                    converter._context.currentNode,
                    `invalid type of My Block "${name}" argument #${i + 1}`
                );
            });

            // If procedure has return value and used in value context,
            // return [procedures_call, evacuation_block, data_variable] for the converter
            if (procedure.hasReturnValue && converter.isValueContext()) {
                const commentText = converter._context.comments[block.comment].text;
                const resultBlocks = [block];

                let varSuffix = '';
                if (callIndex < callCount) {
                    varSuffix = `_${callIndex}`;

                    // Create evacuation block: @_return_name_N_ = @_return_name_
                    const targetVariable = converter._lookupOrCreateVariable(`@_return_${name}${varSuffix}_`);
                    const sourceVariable = converter._lookupOrCreateVariable(`@_return_${name}_`);

                    const sourceBlock = converter._createBlock('data_variable', 'value_variable', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: sourceVariable.id,
                                value: sourceVariable.name,
                                variableType: sourceVariable.type
                            }
                        }
                    });

                    const evacuationBlock = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: targetVariable.id,
                                value: targetVariable.name,
                                variableType: targetVariable.type
                            }
                        },
                        inputs: {
                            VALUE: {
                                name: 'VALUE',
                                block: sourceBlock.id
                            }
                        }
                    });
                    evacuationBlock.comment = converter._createComment(commentText, evacuationBlock.id);
                    resultBlocks.push(evacuationBlock);
                }

                const variable = converter._lookupOrCreateVariable(`@_return_${name}${varSuffix}_`);
                const varBlock = converter._createBlock('data_variable', 'value_variable', {
                    fields: {
                        VARIABLE: {
                            name: 'VARIABLE',
                            id: variable.id,
                            value: variable.name,
                            variableType: variable.type
                        }
                    }
                });
                varBlock.comment = converter._createComment(commentText, varBlock.id);
                resultBlocks.push(varBlock);

                return resultBlocks;
            }

            return block;
        });

        // Register onXxx handlers
        converter.registerOnVar((scope, variable) => {
            let block;
            if (scope === 'local') {
                let opcode;
                let blockType;
                if (variable.isBoolean) {
                    opcode = 'argument_reporter_boolean';
                    blockType = 'value_boolean';
                } else {
                    opcode = 'argument_reporter_string_number';
                    blockType = 'value';
                }
                // Use normalized variable name (should already be in snake_case lowercase)
                const normalizedName = converter._toSnakeCaseLowercase(variable.name);
                block = converter._createBlock(opcode, blockType, {
                    fields: {
                        VALUE: {
                            name: 'VALUE',
                            value: normalizedName
                        }
                    }
                });
                if (Object.prototype.hasOwnProperty.call(converter._context.argumentBlocks, variable.id)) {
                    converter._context.argumentBlocks[variable.id].push(block.id);
                } else {
                    converter._context.argumentBlocks[variable.id] = [block.id];
                }
            }
            return block;
        });

        converter.registerOnDefs((node, saved) => {
            const receiver = converter._process(node.children[0]);
            if (!converter._isSelf(receiver) && receiver !== Opal.nil) {
                return null;
            }

            converter._enterScope('method');

            const procedureName = node.children[1].toString();
            const block = converter._createBlock('procedures_definition', 'hat', {
                topLevel: true
            });
            const procedure = converter._createProcedure(procedureName);

            const customBlock = converter._createBlock('procedures_prototype', 'statement', {
                shadow: true
            });
            converter._addInput(block, 'custom_block', customBlock);

            // Clear arguments from localVariables to allow reuse of names across different methods
            Object.keys(converter._context.localVariables).forEach(key => {
                if (converter._context.localVariables[key].isArgument) {
                    delete converter._context.localVariables[key];
                }
            });

            converter._process(node.children[2]).forEach(n => {
                const originalName = n.toString();
                // Convert argument name to snake_case lowercase
                const normalizedName = converter._toSnakeCaseLowercase(originalName);

                procedure.argumentNames.push(normalizedName);
                const variable = converter._lookupOrCreateVariable(normalizedName, true);
                procedure.argumentVariables.push(variable);
                procedure.procCode.push('%s');
                procedure.argumentDefaults.push('');
                const inputId = Blockly.utils.genUid();
                procedure.argumentIds.push(inputId);
                const inputBlock = converter._createBlock('argument_reporter_string_number', 'value', {
                    fields: {
                        VALUE: {
                            name: 'VALUE',
                            value: normalizedName
                        }
                    },
                    shadow: true
                });
                converter._addInput(customBlock, inputId, inputBlock);
                procedure.argumentBlocks.push(inputBlock);
            });

            // Process method body - use _process instead of _processStatement
            // because the last expression can be a value (which will be wrapped in return assignment)
            const savedInMyBlockDefinition = converter._context.inMyBlockDefinition;
            converter._context.inMyBlockDefinition = true;
            let body = converter._process(node.children[3], false);
            if (!_.isArray(body)) {
                body = [body];
            }
            converter._context.inMyBlockDefinition = savedInMyBlockDefinition;

            converter._exitScope();

            if (body.length > 0) {
                const lastIdx = body.length - 1;
                const last = body[lastIdx];
                if (converter._isValueBlock(last) &&
                    !(last instanceof Primitive && (last.type === 'self' || last.type === 'nil'))) {
                    const variable = converter._lookupOrCreateVariable(`@_return_${procedureName}_`);
                    const returnBlock = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });
                    returnBlock.comment = converter._createComment(`@ruby:return:${procedureName}`, returnBlock.id);
                    converter._addTextInput(
                        returnBlock, 'VALUE', converter._isNumber(last) ? last.toString() : last, '0'
                    );
                    body[lastIdx] = returnBlock;

                    // Mark procedure as having a return value
                    procedure.hasReturnValue = true;

                    // Re-link the body if it's a sequence
                    if (lastIdx > 0) {
                        const prev = converter._lastBlock(body[lastIdx - 1]);
                        prev.next = returnBlock.id;
                        returnBlock.parent = prev.id;
                    }
                }
            }
            if (converter._isBlock(body[0])) {
                block.next = body[0].id;
                body[0].parent = block.id;
            }

            const booleanIndexes = [];
            procedure.argumentVariables.forEach((v, i) => {
                if (v.isBoolean) {
                    booleanIndexes.push(i);
                    procedure.procCode[i + 1] = '%b';
                    procedure.argumentDefaults[i] = 'false';
                    procedure.argumentBlocks[i].opcode = 'argument_reporter_boolean';
                    converter._setBlockType(procedure.argumentBlocks[i], 'value_boolean');
                }
            });

            if (booleanIndexes.length > 0 &&
                Object.prototype.hasOwnProperty.call(converter._context.procedureCallBlocks, procedure.id)) {
                converter._context.procedureCallBlocks[procedure.id].forEach(id => {
                    const b = converter._context.blocks[id];
                    b.mutation.proccode = procedure.procCode.join(' ');
                    booleanIndexes.forEach(booleanIndex => {
                        const input = b.inputs[procedure.argumentIds[booleanIndex]];
                        const inputBlock = converter._context.blocks[input.block];
                        if (inputBlock) {
                            if (!inputBlock.shadow && input.shadow) {
                                delete converter._context.blocks[input.shadow];
                                input.shadow = null;
                            }
                        }
                    });
                });
            }

            customBlock.mutation = {
                argumentdefaults: JSON.stringify(procedure.argumentDefaults),
                argumentids: JSON.stringify(procedure.argumentIds),
                argumentnames: JSON.stringify(procedure.argumentNames),
                children: [],
                proccode: procedure.procCode.join(' '),
                tagName: 'mutation',
                warp: 'false'
            };

            return block;
        });
    }
};

export default MyBlocksConverter;
