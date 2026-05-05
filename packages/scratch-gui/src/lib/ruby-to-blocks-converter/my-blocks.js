import {defineMessages} from 'react-intl';
import _ from 'lodash';
import * as Blockly from 'scratch-blocks';
import Primitive from './primitive';
import {RubyToBlocksConverterError} from './errors';

const messages = defineMessages({
    invalidMyBlockArgumentType: {
        defaultMessage: 'invalid type of My Block "{NAME}" argument #{INDEX}.' +
            '\nUse a number, string, or boolean value.',
        description: 'Error message when My Block argument has invalid type',
        id: 'gui.smalruby3.rubyToBlocksConverter.invalidMyBlockArgumentType'
    },
    wrongInstructionInMyBlock: {
        defaultMessage: '"{SOURCE}" is the wrong instruction.' +
            '\nCheck the spelling or use a supported block.',
        description: 'Error message when non-statement block found in My Block definition body',
        id: 'gui.smalruby3.rubyToBlocksConverter.wrongInstructionInMyBlock'
    }
});

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
                    converter._translator(messages.invalidMyBlockArgumentType, {NAME: name, INDEX: i + 1})
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
            const receiver = converter.visit(node.receiver);
            if (!converter._isSelf(receiver) && receiver !== null) {
                return null;
            }

            converter._enterScope('method');

            // Use renamed name if this is a module method being renamed for super
            const procedureName = converter._context.superRenameTarget || node.name;
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

            (converter.visit(node.parameters) || []).forEach(n => {
                const originalName = n.toString();
                // Convert argument name to snake_case lowercase
                const normalizedName = converter._toSnakeCaseLowercase(originalName);

                procedure.argumentNames.push(normalizedName);
                const variable = converter._lookupOrCreateVariable(normalizedName, true);
                procedure.argumentVariables.push(variable);
                procedure.procCode.push('%s');
                procedure.argumentDefaults.push('');
                const inputId = Blockly.utils.idGenerator.genUid();
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

            // Process method body - use visit instead of _processStatement
            // because the last expression can be a value (which will be wrapped in return assignment)
            const savedInMyBlockDefinition = converter._context.inMyBlockDefinition;
            const savedCurrentProcedureName = converter._context.currentProcedureName;
            converter._context.inMyBlockDefinition = true;
            converter._context.currentProcedureName = procedureName;
            let body = converter.visit(node.body);
            if (typeof body === 'undefined') {
                body = [];
            } else if (!_.isArray(body)) {
                body = [body];
            }
            body = body.filter(b => b !== null && typeof b !== 'undefined').map(b => {
                if (converter._isNumber(b)) {
                    const value = (b instanceof Primitive) ? b.value : b;
                    return converter._createNumberBlock('math_number', value);
                }
                if (converter._isTrue(b)) {
                    return converter._createTextBlock('true');
                }
                if (converter._isFalse(b)) {
                    return converter._createTextBlock('false');
                }
                if (converter._isString(b) || converter.isNil(b) || converter._isSymbol(b)) {
                    const value = (b instanceof Primitive) ? b.value : b;
                    return converter._createTextBlock(value === null ? '' : value.toString());
                }
                if (converter._isBlock(b)) return b;
                return b;
            });
            converter._context.inMyBlockDefinition = savedInMyBlockDefinition;
            converter._context.currentProcedureName = savedCurrentProcedureName;

            converter._exitScope();

            if (body.length > 0) {
                const lastIdx = body.length - 1;
                let last = body[lastIdx];
                if (_.isArray(last)) {
                    last = last[last.length - 1];
                }
                const lastCommentText = (last && last.comment) ? converter._context.comments[last.comment].text : '';
                // Check if the last expression is a procedures_call to a procedure with a return
                // value (e.g., super calls to module methods that return values). In this case,
                // the procedures_call sets the callee's return variable, and we need to copy it
                // to this procedure's return variable.
                if (last && last.opcode === 'procedures_call' &&
                    converter._isProcedureCallWithReturnValue(last) &&
                    !lastCommentText.includes('@ruby:syntax:return')) {
                    const calledProccode = last.mutation.proccode;
                    const calledProcName = calledProccode
                        .split(' ')
                        .filter(i => !/^%[sb]$/.test(i))
                        .join('_');
                    const sourceVariable = converter._lookupOrCreateVariable(`@_return_${calledProcName}_`);
                    const targetVariable = converter._lookupOrCreateVariable(`@_return_${procedureName}_`);

                    // Create a data_variable block to read the callee's return variable
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

                    // Create assignment: @_return_procedureName_ = @_return_calledProcName_
                    const returnBlock = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: targetVariable.id,
                                value: targetVariable.name,
                                variableType: targetVariable.type
                            }
                        }
                    });
                    returnBlock.comment = converter._createComment(`@ruby:return:${procedureName}`, returnBlock.id);
                    converter._addInput(returnBlock, 'VALUE', sourceBlock);

                    // Link: procedures_call → return assignment
                    last.next = returnBlock.id;
                    returnBlock.parent = last.id;
                    body.push(returnBlock);

                    // Mark procedure as having a return value
                    procedure.hasReturnValue = true;
                } else if (converter._isValueBlock(last) &&
                    !(last instanceof Primitive && (last.type === 'self' || last.type === 'nil')) &&
                    !lastCommentText.includes('@ruby:syntax:return')) {
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

                    if (last.shadow) {
                        // Shadow blocks (e.g. math_number, text) are used directly as both block and shadow
                        converter._addInput(returnBlock, 'VALUE', last);
                    } else {
                        converter._addTextInput(returnBlock, 'VALUE', last, '0');
                    }
                    body[lastIdx] = returnBlock;

                    // Mark procedure as having a return value
                    procedure.hasReturnValue = true;

                    // Re-link the body if it's a sequence
                    if (lastIdx > 0) {
                        const prev = converter._lastBlock(body[lastIdx - 1]);
                        if (converter._isBlock(prev)) {
                            prev.next = returnBlock.id;
                            returnBlock.parent = prev.id;
                        }
                    }
                }

                // If any block in the body has @ruby:syntax:return comment (from explicit return),
                // mark procedure as having a return value so callers can use it as a value.
                if (!procedure.hasReturnValue) {
                    const hasExplicitReturn = Object.values(converter._context.blocks).some(b =>
                        b.opcode === 'data_setvariableto' &&
                        b.comment &&
                        converter._context.comments[b.comment] &&
                        converter._context.comments[b.comment].text.includes('@ruby:syntax:return') &&
                        converter._context.comments[b.comment].text.includes(`@ruby:return:${procedureName}`)
                    );
                    if (hasExplicitReturn) {
                        procedure.hasReturnValue = true;
                    }
                }

                // If procedure has explicit return statements, insert an initialize block at the top
                // of the body to reset @_return_name_ to "" before each call, preventing stale values.
                // This is only needed for explicit return (not for implicit return from last value).
                const hasExplicitReturnForInit = Object.values(converter._context.blocks).some(b =>
                    b.opcode === 'data_setvariableto' &&
                    b.comment &&
                    converter._context.comments[b.comment] &&
                    converter._context.comments[b.comment].text.includes('@ruby:syntax:return') &&
                    converter._context.comments[b.comment].text.includes(`@ruby:return:${procedureName}`)
                );
                if (hasExplicitReturnForInit) {
                    const variable = converter._lookupOrCreateVariable(`@_return_${procedureName}_`);
                    const initBlock = converter._createBlock('data_setvariableto', 'statement', {
                        fields: {
                            VARIABLE: {
                                name: 'VARIABLE',
                                id: variable.id,
                                value: variable.name,
                                variableType: variable.type
                            }
                        }
                    });
                    initBlock.comment = converter._createComment(
                        `@ruby:return:${procedureName}:initialize`, initBlock.id
                    );
                    initBlock.node = node; // Use the def node for initialization block
                    converter._addTextInput(initBlock, 'VALUE', '', '');

                    // Link init block → first body block
                    if (body.length > 0 && converter._isBlock(body[0])) {
                        initBlock.next = body[0].id;
                        body[0].parent = initBlock.id;
                    }
                    body.unshift(initBlock);
                }
            }

            _.flatten(body).forEach(b => {
                if (converter._isValueBlock(b) ||
                    converter._isNumber(b) ||
                    converter._isString(b) ||
                    converter._isTrue(b) ||
                    converter._isFalse(b)) {
                    let bNode = b.node;
                    if (!bNode && b.id) {
                        for (const [n, id] of converter._context.nodeToBlockMap.entries()) {
                            if (id === b.id) {
                                bNode = n;
                                break;
                            }
                        }
                    }
                    const src = converter._truncateSource(bNode ? bNode.source : '');
                    const msg = converter._translator(messages.wrongInstructionInMyBlock, {SOURCE: src});
                    throw new RubyToBlocksConverterError(bNode, msg);
                }
            });
            if (body.length > 0 && converter._isBlock(body[0])) {
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
