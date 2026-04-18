// === Smalruby: This file is Smalruby-specific (arithmetic operators and math function handlers) ===
import _ from 'lodash';

const Math = '::Math';
const MathE = '::Math::E';

/**
 * Math and arithmetic operator handlers for OperatorsConverter.
 */
const OperatorsMath = {
    registerMath: function (converter) {
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

        converter.registerOnSend(['variable', 'number', 'block'], 'round', 0, params => {
            const {receiver} = params;

            const block = converter._createBlock('operator_round', 'value');
            converter._addNumberInput(block, 'NUM', 'math_number', receiver, '');
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

            if (receiver.value !== 10) return null;
            if (!converter._isNumberOrBlock(rh)) return null;

            const block = converter._createBlock('operator_mathop', 'value');
            converter._addField(block, 'OPERATOR', '10 ^');
            converter._addNumberInput(block, 'NUM', 'math_number', rh, '');
            return block;
        });
    }
};

export default OperatorsMath;
