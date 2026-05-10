import _ from 'lodash';
import {RubyToBlocksConverterError} from './errors';
import OperatorsMath from './operators-math';

/**
 * Operators converter
 */
const OperatorsConverter = {
    register: function (converter) {
        // Register arithmetic and math function handlers
        OperatorsMath.registerMath(converter);

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

        // === Smalruby: Start of regex match operators ===
        converter.registerOnSend('any', '=~', 1, params => {
            const {receiver, args, name} = params;

            const index = (converter._context.methodCallIndices[name] || 0) + 1;
            converter._context.methodCallIndices[name] = index;

            let str;
            let regexp;
            let commentSuffix = '';

            if (converter._isRegexp(receiver)) {
                // /pattern/ =~ string
                str = args[0];
                regexp = receiver;
                commentSuffix = ':receiver';
            } else {
                // string =~ /pattern/
                str = receiver;
                regexp = args[0];
            }

            if (!converter._isStringOrBlock(str) && !converter._isRegexpOrBlock(regexp)) return null;

            const block = converter._createBlock('operator_contains', 'value_boolean');
            converter._addTextInput(block, 'STRING1', str, 'apple');
            converter._addTextInput(
                block, 'STRING2', converter._isRegexp(regexp) ? regexp.toString() : regexp, 'a'
            );

            const commentText = `@ruby:operator:${name}:${index}${commentSuffix}`;
            block.comment = converter._createComment(commentText, block.id);
            return block;
        });

        converter.registerOnSend('any', '!~', 1, params => {
            const {receiver, args, name} = params;

            const index = (converter._context.methodCallIndices[name] || 0) + 1;
            converter._context.methodCallIndices[name] = index;

            let str;
            let regexp;
            let commentSuffix = '';

            if (converter._isRegexp(receiver)) {
                // /pattern/ !~ string
                str = args[0];
                regexp = receiver;
                commentSuffix = ':receiver';
            } else {
                // string !~ /pattern/
                str = receiver;
                regexp = args[0];
            }

            if (!converter._isStringOrBlock(str) && !converter._isRegexpOrBlock(regexp)) return null;

            const commentText = `@ruby:operator:${name}:${index}${commentSuffix}`;

            const containsBlock = converter._createBlock('operator_contains', 'value_boolean');
            converter._addTextInput(containsBlock, 'STRING1', str, 'apple');
            converter._addTextInput(
                containsBlock, 'STRING2', converter._isRegexp(regexp) ? regexp.toString() : regexp, 'a'
            );
            containsBlock.comment = converter._createComment(commentText, containsBlock.id);

            const block = converter._createBlock('operator_not', 'value_boolean');
            converter._addInput(block, 'OPERAND', containsBlock);
            block.comment = converter._createComment(commentText, block.id);
            return block;
        });
        // === Smalruby: End of regex match operators ===

        ['>', '<', '=='].forEach(operator => {
            converter.registerOnSend('any', operator, 1, params => {
                const {receiver, args, node} = params;
                let rh = args[0];
                if (_.isArray(rh)) {
                    if (rh.length !== 1) return null;
                    rh = rh[0];
                }

                // For >, <: reject symbol args (Ruby raises ArgumentError for mixed types)
                if (operator !== '==' &&
                    converter._isPrimitive(rh) && rh.type === 'sym') {
                    const source = converter._truncateSource(converter._getSource(node));
                    throw new RubyToBlocksConverterError(
                        node,
                        converter._translator(
                            converter._symbolCannotCompareMessage(), {SOURCE: source}
                        )
                    );
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

        ['>', '<', '=='].forEach(operator => {
            converter.registerOnSend('symbol', operator, 1, params => {
                const {receiver, args, node} = params;
                let rh = args[0];
                if (_.isArray(rh)) {
                    if (rh.length !== 1) return null;
                    rh = rh[0];
                }

                const rhIsSymbol = converter._isPrimitive(rh) && rh.type === 'sym';

                // For >, <: both sides must be symbols (Ruby raises ArgumentError for mixed types)
                if (operator !== '==' && !rhIsSymbol) {
                    const source = converter._truncateSource(converter._getSource(node));
                    throw new RubyToBlocksConverterError(
                        node,
                        converter._translator(converter._symbolCannotCompareMessage(), {SOURCE: source})
                    );
                }

                const receiverBlock = converter._symbolToBlock(
                    converter._getSymbolValue(receiver), receiver.node
                );
                if (rhIsSymbol) {
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

        converter.registerOnSend(['variable', 'boolean', 'block'], '!', 0, params => {
            const {receiver} = params;
            if (!converter._isFalseOrBooleanBlock(receiver) &&
                !(converter._isBlock(receiver) && receiver.opcode === 'data_variable')) return null;

            const block = converter._createBlock('operator_not', 'value_boolean');
            converter._addInput(
                block,
                'OPERAND',
                converter._createTextBlock(converter._isNumber(receiver) ? receiver.toString() : receiver)
            );
            return block;
        });

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

            // Map `.to_i` to `operator_mathop(floor, x)` so the runtime
            // actually truncates (the previous `operator_add(x, 0)` was a
            // pass-through). The `@ruby:method:to_i` marker lets the
            // generator emit `.to_i` instead of `.floor` on round-trip.
            const block = converter._createBlock('operator_mathop', 'value');
            converter._addField(block, 'OPERATOR', 'floor');
            if (converter._isString(receiver)) {
                converter._addTextInput(block, 'NUM', receiver, '');
            } else {
                converter._addNumberInput(block, 'NUM', 'math_number', receiver, '');
            }
            block.comment = converter._createComment('@ruby:method:to_i', block.id);
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
