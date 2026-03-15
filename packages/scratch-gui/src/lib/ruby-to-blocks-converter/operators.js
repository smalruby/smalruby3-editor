import _ from 'lodash';

const Math = '::Math';
const MathE = '::Math::E';

/**
 * Operators converter
 */
const OperatorsConverter = {
    register: function (converter) {
        // String-typed variable + any: use operator_join (must be registered before the numeric + handler)
        converter.registerOnSend('variable', '+', 1, params => {
            const {receiver, args} = params;
            const variable = converter.lookupVariableFromVariableBlock(receiver);
            if (!variable || variable.dataType !== 'string') return null;

            let rh = args[0];
            if (_.isArray(rh)) {
                if (rh.length !== 1) return null;
                rh = rh[0];
            }

            // Boolean values are not valid operands for string concatenation
            if (converter._isTrue(rh) || converter._isFalse(rh)) return null;

            if (!converter._isStringOrBlock(rh)) return null;

            const block = converter._createBlock('operator_join', 'value');
            converter._addTextInput(block, 'STRING1', receiver, 'apple');
            converter._addTextInput(block, 'STRING2', converter._isNumber(rh) ? rh.toString() : rh, 'banana');
            return block;
        });

        converter.registerOnSend('self', 'rand', 1, params => {
            const {args} = params;
            if (!converter._isBlock(args[0]) || args[0].opcode !== 'ruby_range') return null;

            return converter._changeBlock(args[0], 'operator_random', 'value');
        });

        converter.registerOnSend(['string', 'block', 'variable'], '[]', 1, params => {
            const {receiver, args} = params;
            if (!converter._isNumberOrBlock(args[0])) return null;

            const block = converter._createBlock('operator_letter_of', 'value');
            converter._addTextInput(block, 'STRING', receiver, 'apple');
            let letter = args[0];
            if (converter._isNumber(args[0]) && !_.isNumber(args[0]) && args[0].type === 'int') {
                letter = letter.value + 1;
            }
            converter._addNumberInput(block, 'LETTER', 'math_number', letter, 1);
            return block;
        });

        converter.registerOnSend(['string', 'block', 'variable'], 'length', 0, params => {
            const {receiver} = params;

            const block = converter._createBlock('operator_length', 'value');
            converter._addTextInput(block, 'STRING', receiver, 'apple');
            return block;
        });

        converter.registerOnSend(['string', 'block', 'variable'], 'empty?', 0, params => {
            const {receiver, name} = params;

            const index = (converter._context.methodCallIndices[name] || 0) + 1;
            converter._context.methodCallIndices[name] = index;

            const commentText = `@ruby:method:${name}:${index}`;

            let lengthBlock;
            if (converter._isBlock(receiver) && converter.isListBlock(receiver)) {
                lengthBlock = converter._changeBlock(receiver, 'data_lengthoflist', 'value');
            } else {
                lengthBlock = converter._createBlock('operator_length', 'value');
                converter._addTextInput(lengthBlock, 'STRING', receiver, 'apple');
            }
            lengthBlock.comment = converter._createComment(commentText, lengthBlock.id);

            const block = converter._createBlock('operator_equals', 'value_boolean');
            converter._addInput(block, 'OPERAND1', lengthBlock, converter._createTextBlock(''));
            converter._addTextInput(block, 'OPERAND2', '0', '50');
            block.comment = converter._createComment(commentText, block.id);
            return block;
        });

        converter.registerOnSend(['string', 'block'], 'include?', 1, params => {
            const {receiver, args} = params;
            if (!converter._isStringOrBlock(args[0])) return null;

            const block = converter._createBlock('operator_contains', 'value');
            converter._addTextInput(block, 'STRING1', receiver, 'apple');
            converter._addTextInput(block, 'STRING2', args[0], 'a');
            return block;
        });

        ['+', '-', '*', '/', '%'].forEach(operator => {
            converter.registerOnSend(['variable', 'number', 'block'], operator, 1, params => {
                const {receiver, args} = params;
                let rh = args[0];
                if (_.isArray(rh)) {
                    if (rh.length !== 1) return null;
                    rh = rh[0];
                }

                // Skip string-typed variables for + (handled by the dedicated string handler)
                if (operator === '+' && converter.isVariableBlock(receiver)) {
                    const variable = converter.lookupVariableFromVariableBlock(receiver);
                    if (variable && variable.dataType === 'string') return null;
                }

                // Boolean values are not valid operands for numeric arithmetic
                if (converter._isTrue(rh) || converter._isFalse(rh)) return null;

                if (!converter._isNumberOrBlock(rh)) return null;

                let opcode;
                if (operator === '+') {
                    opcode = 'operator_add';
                } else if (operator === '-') {
                    opcode = 'operator_subtract';
                } else if (operator === '*') {
                    opcode = 'operator_multiply';
                } else if (operator === '/') {
                    opcode = 'operator_divide';
                } else {
                    opcode = 'operator_mod';
                }

                const block = converter._createBlock(opcode, 'value');
                converter._addNumberInput(block, 'NUM1', 'math_number', receiver, '');
                converter._addNumberInput(block, 'NUM2', 'math_number', rh, '');
                return block;
            });
        });

        converter.registerOnSend(['string', 'block'], '+', 1, params => {
            const {receiver, args} = params;
            let rh = args[0];
            if (_.isArray(rh)) {
                if (rh.length !== 1) return null;
                rh = rh[0];
            }

            // Boolean values are not valid operands for string concatenation
            if (converter._isTrue(rh) || converter._isFalse(rh)) return null;

            if (!converter._isStringOrBlock(rh)) return null;

            const block = converter._createBlock('operator_join', 'value');
            converter._addTextInput(
                block, 'STRING1', converter._isNumber(receiver) ? receiver.toString() : receiver, 'apple'
            );
            converter._addTextInput(block, 'STRING2', converter._isNumber(rh) ? rh.toString() : rh, 'banana');
            return block;
        });

        converter.registerOnSend('any', '!=', 1, params => {
            const {receiver, args, name} = params;
            let rh = args[0];
            if (_.isArray(rh)) {
                if (rh.length !== 1) return null;
                rh = rh[0];
            }

            const index = (converter._context.methodCallIndices[name] || 0) + 1;
            converter._context.methodCallIndices[name] = index;

            const commentText = `@ruby:operator:${name}:${index}`;

            const equalsBlock = converter._createBlock('operator_equals', 'value_boolean');
            converter._addTextInput(
                equalsBlock, 'OPERAND1', converter._isNumber(receiver) ? receiver.toString() : receiver, ''
            );
            converter._addTextInput(
                equalsBlock, 'OPERAND2', converter._isNumber(rh) ? rh.toString() : rh, '50'
            );
            equalsBlock.comment = converter._createComment(commentText, equalsBlock.id);

            const block = converter._createBlock('operator_not', 'value_boolean');
            converter._addInput(block, 'OPERAND', equalsBlock);
            block.comment = converter._createComment(commentText, block.id);
            return block;
        });

        ['>=', '<='].forEach(operator => {
            converter.registerOnSend('any', operator, 1, params => {
                const {receiver, args, name} = params;
                let rh = args[0];
                if (_.isArray(rh)) {
                    if (rh.length !== 1) return null;
                    rh = rh[0];
                }

                const index = (converter._context.methodCallIndices[name] || 0) + 1;
                converter._context.methodCallIndices[name] = index;

                const commentText = `@ruby:operator:${name}:${index}`;

                const receiverValue = converter._isNumber(receiver) ? receiver.toString() : receiver;
                const rhValue = converter._isNumber(rh) ? rh.toString() : rh;

                const subOpcode = operator === '>=' ? 'operator_gt' : 'operator_lt';
                const subBlock = converter._createBlock(subOpcode, 'value_boolean');
                converter._addTextInput(subBlock, 'OPERAND1', receiverValue, '');
                converter._addTextInput(subBlock, 'OPERAND2', rhValue, '50');
                subBlock.comment = converter._createComment(commentText, subBlock.id);

                const equalsBlock = converter._createBlock('operator_equals', 'value_boolean');
                converter._addTextInput(
                    equalsBlock, 'OPERAND1', converter._cloneBlock(receiverValue), ''
                );
                converter._addTextInput(
                    equalsBlock, 'OPERAND2', converter._cloneBlock(rhValue), '50'
                );
                equalsBlock.comment = converter._createComment(commentText, equalsBlock.id);

                const block = converter._createBlock('operator_or', 'value_boolean');
                converter._addInput(block, 'OPERAND1', subBlock);
                converter._addInput(block, 'OPERAND2', equalsBlock);
                block.comment = converter._createComment(commentText, block.id);
                return block;
            });
        });

        ['>', '<', '=='].forEach(operator => {
            converter.registerOnSend('any', operator, 1, params => {
                const {receiver, args} = params;
                let rh = args[0];
                if (_.isArray(rh)) {
                    if (rh.length !== 1) return null;
                    rh = rh[0];
                }

                let opcode;
                if (operator === '>') {
                    opcode = 'operator_gt';
                } else if (operator === '<') {
                    opcode = 'operator_lt';
                } else {
                    opcode = 'operator_equals';
                }

                const block = converter._createBlock(opcode, 'value_boolean');
                converter._addTextInput(
                    block, 'OPERAND1', converter._isNumber(receiver) ? receiver.toString() : receiver, ''
                );
                converter._addTextInput(block, 'OPERAND2', converter._isNumber(rh) ? rh.toString() : rh, '50');
                return block;
            });
        });

        // === Smalruby: Start of symbol comparison ===
        ['>', '<', '=='].forEach(operator => {
            converter.registerOnSend('symbol', operator, 1, params => {
                const {receiver, args} = params;
                let rh = args[0];
                if (_.isArray(rh)) {
                    if (rh.length !== 1) return null;
                    rh = rh[0];
                }

                const receiverBlock = converter._symbolToBlock(
                    converter._getSymbolValue(receiver), receiver.node
                );
                if (converter._isPrimitive(rh) && rh.type === 'sym') {
                    rh = converter._symbolToBlock(rh.value, rh.node);
                }

                let opcode;
                if (operator === '>') {
                    opcode = 'operator_gt';
                } else if (operator === '<') {
                    opcode = 'operator_lt';
                } else {
                    opcode = 'operator_equals';
                }

                const block = converter._createBlock(opcode, 'value_boolean');
                converter._addInput(
                    block, 'OPERAND1', receiverBlock, converter._createTextBlock('')
                );
                if (converter._isBlock(rh)) {
                    converter._addInput(
                        block, 'OPERAND2', rh, converter._createTextBlock('50')
                    );
                } else {
                    converter._addTextInput(
                        block, 'OPERAND2', converter._isNumber(rh) ? rh.toString() : rh, '50'
                    );
                }
                return block;
            });
        });
        // === Smalruby: End of symbol comparison ===

        converter.registerOnSend(['variable', 'boolean', 'block'], '!', 0, params => {
            const {receiver} = params;
            if (!converter._isFalseOrBooleanBlock(receiver)) return null;

            const block = converter._createBlock('operator_not', 'value_boolean');
            converter._addInput(
                block,
                'OPERAND',
                converter._createTextBlock(converter._isNumber(receiver) ? receiver.toString() : receiver)
            );
            return block;
        });

        converter.registerOnSend(['variable', 'number', 'block'], 'round', 0, params => {
            const {receiver} = params;

            const block = converter._createBlock('operator_round', 'value');
            converter._addNumberInput(block, 'NUM', 'math_number', receiver, '');
            return block;
        });

        // === Smalruby: Start of symbol to_s ===
        converter.registerOnSend('symbol', 'to_s', 0, params => {
            const {receiver} = params;
            const symbolName = converter._getSymbolValue(receiver);
            if (!symbolName) return null;

            converter._collectSymbol(symbolName);
            const block = converter._createBlock('operator_join', 'value');
            converter._addTextInput(block, 'STRING1', symbolName, '');
            converter._addTextInput(block, 'STRING2', '', '');
            block.comment = converter._createComment(`@ruby:symbol:${symbolName}`, block.id);
            return block;
        });
        // === Smalruby: End of symbol to_s ===

        converter.registerOnSend(['variable', 'number', 'string', 'block'], 'to_s', 0, params => {
            const {receiver} = params;

            const block = converter._createBlock('operator_join', 'value');
            if (converter._isNumber(receiver)) {
                converter._addNumberInput(block, 'STRING1', 'math_number', receiver, '');
            } else {
                converter._addTextInput(block, 'STRING1', receiver, '');
            }
            converter._addTextInput(block, 'STRING2', '', '');
            block.comment = converter._createComment('@ruby:method:to_s', block.id);
            return block;
        });

        converter.registerOnSend(['variable', 'number', 'string', 'block'], 'to_i', 0, params => {
            const {receiver} = params;

            const block = converter._createBlock('operator_add', 'value');
            if (converter._isString(receiver)) {
                converter._addTextInput(block, 'NUM1', receiver, '');
            } else {
                converter._addNumberInput(block, 'NUM1', 'math_number', receiver, '');
            }
            converter._addNumberInput(block, 'NUM2', 'math_number', 0, '');
            block.comment = converter._createComment('@ruby:method:to_i', block.id);
            return block;
        });

        ['abs', 'floor', 'ceil'].forEach(methodName => {
            converter.registerOnSend(['variable', 'number', 'block'], methodName, 0, params => {
                const {receiver} = params;

                let operator = methodName;
                if (methodName === 'ceil') {
                    operator = 'ceiling';
                }
                const block = converter._createBlock('operator_mathop', 'value');
                converter._addField(block, 'OPERATOR', operator);
                converter._addNumberInput(block, 'NUM', 'math_number', receiver, '');
                return block;
            });
        });

        ['sqrt', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'log10'].forEach(methodName => {
            converter.registerOnSend(Math, methodName, 1, params => {
                const {args} = params;
                let rh = args[0];
                if (_.isArray(rh)) {
                    if (rh.length !== 1) return null;
                    rh = rh[0];
                }

                if (!converter._isNumberOrBlock(rh)) return null;

                let operator;
                switch (methodName) {
                case 'log':
                    operator = 'ln';
                    break;
                case 'log10':
                    operator = 'log';
                    break;
                default:
                    operator = methodName;
                }
                const block = converter._createBlock('operator_mathop', 'value');
                converter._addField(block, 'OPERATOR', operator);
                converter._addNumberInput(block, 'NUM', 'math_number', rh, '');
                return block;
            });
        });

        converter.registerOnSend(MathE, '**', 1, params => {
            const {args} = params;
            let rh = args[0];
            if (_.isArray(rh)) {
                if (rh.length !== 1) return null;
                rh = rh[0];
            }

            if (!converter._isNumberOrBlock(rh)) return null;

            const block = converter._createBlock('operator_mathop', 'value');
            converter._addField(block, 'OPERATOR', 'e ^');
            converter._addNumberInput(block, 'NUM', 'math_number', rh, '');
            return block;
        });

        converter.registerOnSend('number', '**', 1, params => {
            const {receiver, args} = params;
            let rh = args[0];
            if (_.isArray(rh)) {
                if (rh.length !== 1) return null;
                rh = rh[0];
            }

            if (!receiver.value === 10) return null;
            if (!converter._isNumberOrBlock(rh)) return null;

            const block = converter._createBlock('operator_mathop', 'value');
            converter._addField(block, 'OPERATOR', '10 ^');
            converter._addNumberInput(block, 'NUM', 'math_number', rh, '');
            return block;
        });

        // Register onXxx handlers
        converter.registerOnAnd(operands => {
            const block = converter._createBlock('operator_and', 'value_boolean');
            operands.forEach(o => {
                if (o) {
                    o.parent = block.id;
                }
            });
            if (converter._isFalseOrBooleanBlock(operands[0])) {
                converter._addInput(block, 'OPERAND1', converter._createTextBlock(operands[0]));
            }
            if (converter._isFalseOrBooleanBlock(operands[1])) {
                converter._addInput(block, 'OPERAND2', converter._createTextBlock(operands[1]));
            }
            return block;
        });

        converter.registerOnOr(operands => {
            const block = converter._createBlock('operator_or', 'value_boolean');
            operands.forEach(o => {
                if (o) {
                    o.parent = block.id;
                }
            });
            if (converter._isFalseOrBooleanBlock(operands[0])) {
                converter._addInput(block, 'OPERAND1', converter._createTextBlock(operands[0]));
            }
            if (converter._isFalseOrBooleanBlock(operands[1])) {
                converter._addInput(block, 'OPERAND2', converter._createTextBlock(operands[1]));
            }
            return block;
        });
    }
};

export default OperatorsConverter;
