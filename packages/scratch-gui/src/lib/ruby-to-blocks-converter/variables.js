import {defineMessages} from 'react-intl';
import {RubyToBlocksConverterError} from './errors';
import {convertToListBlock, adjustIndex, convertHashGet, convertHashSet} from './variable-hash-ops';
import {registerListOperations} from './variable-list-ops';

const messages = defineMessages({
    arraySyntaxNotAvailableInV1: {
        defaultMessage: 'Array syntax is only available in Ruby version 2.' +
            '\nPlease switch to Ruby version 2 from the settings menu,' +
            '\nor use list() syntax instead.',
        description: 'Error message when array syntax ($a.push, $a[0], etc.) is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.arraySyntaxNotAvailableInV1'
    },
    listSyntaxNotAvailableInV2: {
        defaultMessage: 'list() syntax is only available in Ruby version 1.' +
            '\nPlease use array syntax ($a.push(), $a[0], etc.) instead.',
        description: 'Error message when list() syntax is used in Ruby version 2',
        id: 'gui.smalruby3.rubyToBlocksConverter.listSyntaxNotAvailableInV2'
    },
    arrayLiteralNotAvailableInV1: {
        defaultMessage: 'Array literal syntax is only available in Ruby version 2.' +
            '\nPlease switch to Ruby version 2 from the settings menu.',
        description: 'Error message when array literal ($a = [1, 2, 3]) is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.arrayLiteralNotAvailableInV1'
    },
    hashSyntaxNotAvailableInV1: {
        defaultMessage: 'Hash syntax is only available in Ruby version 2.' +
            '\nPlease switch to Ruby version 2 from the settings menu.',
        description: 'Error message when hash syntax ($a = {key: value}) is used in Ruby version 1',
        id: 'gui.smalruby3.rubyToBlocksConverter.hashSyntaxNotAvailableInV1'
    }
});

/**
 * Variables converter
 */
const VariablesConverter = {
    register: function (converter) {
        registerListOperations(
            converter, messages, convertToListBlock, adjustIndex, convertHashGet, convertHashSet
        );

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
            if ((scope === 'global' || scope === 'instance' ||
                (scope === 'local' && !variable.isArgument)) &&
                converter._isPrimitive(rh) && rh.type === 'sym') {
                rh = converter._symbolToBlock(rh.value, rh.node);
            }

            if ((scope === 'global' || scope === 'instance' ||
                (scope === 'local' && !variable.isArgument)) &&
                converter._isArray(rh)) {
                if (converter.version < 2) {
                    throw new RubyToBlocksConverterError(
                        converter._context.currentNode,
                        converter._translator(messages.arrayLiteralNotAvailableInV1)
                    );
                }
                const elements = rh.value;
                let prefixedName;
                if (variable.scope === 'global') {
                    prefixedName = `$${variable.name}`;
                } else if (variable.scope === 'instance') {
                    prefixedName = `@${variable.name}`;
                } else {
                    prefixedName = variable.originalName;
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
                let arrayLiteralComment = `@ruby:array:literal:${elements.length}`;
                if (scope === 'local') {
                    arrayLiteralComment =
                        `@ruby:lvar:${variable.originalName}:${variable.scopeIndex},${arrayLiteralComment}`;
                }
                clearBlock.comment = converter._createComment(
                    arrayLiteralComment, clearBlock.id
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

            if ((scope === 'global' || scope === 'instance' ||
                (scope === 'local' && !variable.isArgument)) &&
                converter._isHash(rh)) {
                if (converter.version < 2) {
                    throw new RubyToBlocksConverterError(
                        converter._context.currentNode,
                        converter._translator(messages.hashSyntaxNotAvailableInV1)
                    );
                }
                const hashEntries = rh.value; // Map<Primitive, Primitive>
                let prefixedName;
                if (variable.scope === 'global') {
                    prefixedName = `$${variable.name}`;
                } else if (variable.scope === 'instance') {
                    prefixedName = `@${variable.name}`;
                } else {
                    prefixedName = variable.originalName;
                }
                const keysListName = converter._hashKeysListName(prefixedName);
                const valuesListName = converter._hashValuesListName(prefixedName);
                const keysList = converter._lookupOrCreateList(keysListName);
                const valuesList = converter._lookupOrCreateList(valuesListName);

                // Create clear block for keys
                const clearKeysBlock = converter._createBlock('data_deletealloflist', 'statement', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: keysList.id,
                            value: keysList.name,
                            variableType: keysList.type
                        }
                    }
                });
                let hashLiteralComment = `@ruby:hash:literal:${hashEntries.size}`;
                if (scope === 'local') {
                    hashLiteralComment =
                        `@ruby:lvar:${variable.originalName}:${variable.scopeIndex},${hashLiteralComment}`;
                }
                clearKeysBlock.comment = converter._createComment(
                    hashLiteralComment, clearKeysBlock.id
                );

                // Create clear block for values
                const clearValuesBlock = converter._createBlock('data_deletealloflist', 'statement', {
                    fields: {
                        LIST: {
                            name: 'LIST',
                            id: valuesList.id,
                            value: valuesList.name,
                            variableType: valuesList.type
                        }
                    }
                });
                clearValuesBlock.comment = converter._createComment(
                    '@ruby:hash:literal:values', clearValuesBlock.id
                );

                const blocks = [clearKeysBlock, clearValuesBlock];

                // Create push blocks for each key-value pair
                hashEntries.forEach((value, key) => {
                    let keyStr;
                    let keyComment;
                    if (converter._isSymbol(key)) {
                        const symName = converter._getSymbolValue(key);
                        keyStr = `:${symName}`;
                        keyComment = '@ruby:hash:literal:key:sym';
                    } else if (converter._isString(key)) {
                        keyStr = converter._isPrimitive(key) ? key.value : key;
                        keyComment = '@ruby:hash:literal:key:str';
                    } else {
                        return; // skip unsupported key types
                    }

                    // Push key
                    const pushKeyBlock = converter._createBlock('data_addtolist', 'statement', {
                        fields: {
                            LIST: {
                                name: 'LIST',
                                id: keysList.id,
                                value: keysList.name,
                                variableType: keysList.type
                            }
                        }
                    });
                    converter._addTextInput(pushKeyBlock, 'ITEM', keyStr, 'thing');
                    pushKeyBlock.comment = converter._createComment(keyComment, pushKeyBlock.id);
                    blocks.push(pushKeyBlock);

                    // Push value - handle symbol values via _symbolToBlock
                    let valueItem;
                    if (converter._isPrimitive(value) && value.type === 'sym') {
                        valueItem = converter._symbolToBlock(value.value, value.node);
                    } else if (converter._isNumber(value)) {
                        valueItem = converter._isPrimitive(value) ? value.value.toString() : value.toString();
                    } else if (converter._isString(value)) {
                        valueItem = converter._isPrimitive(value) ? value.value : value;
                    } else {
                        valueItem = value;
                    }

                    const pushValueBlock = converter._createBlock('data_addtolist', 'statement', {
                        fields: {
                            LIST: {
                                name: 'LIST',
                                id: valuesList.id,
                                value: valuesList.name,
                                variableType: valuesList.type
                            }
                        }
                    });
                    converter._addTextInput(
                        pushValueBlock, 'ITEM',
                        converter._isNumber(valueItem) ? valueItem.toString() : valueItem, 'thing'
                    );
                    pushValueBlock.comment = converter._createComment(
                        '@ruby:hash:literal:value', pushValueBlock.id
                    );
                    blocks.push(pushValueBlock);
                });

                return converter._linkBlocks(blocks);
            }

            // === Smalruby: Start of regex variable assignment ===
            if ((scope === 'global' || scope === 'instance' ||
                (scope === 'local' && !variable.isArgument)) &&
                converter._isRegexp(rh)) {
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
                converter._addTextInput(block, 'VALUE', rh.toString(), '0');
                variable.dataType = converter._inferDataType(rh);

                let commentText = '@ruby:regexp:literal';
                if (scope === 'local') {
                    commentText =
                        `@ruby:lvar:${variable.originalName}:${variable.scopeIndex},${commentText}`;
                }
                block.comment = converter._createComment(commentText, block.id);
                return block;
            }
            // === Smalruby: End of regex variable assignment ===

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
