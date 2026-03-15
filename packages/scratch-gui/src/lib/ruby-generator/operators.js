/**
 * Define Ruby code generator for Operators Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.operator_add = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment === '@ruby:method:to_i') {
            const value = Generator.valueToCode(block, 'NUM1', Generator.ORDER_FUNCTION_CALL) || 0;
            return [`${value}.to_i`, Generator.ORDER_FUNCTION_CALL];
        }

        const order = Generator.ORDER_ADDITIVE;
        const num1 = Generator.valueToCode(block, 'NUM1', order) || 0;
        const num2 = Generator.valueToCode(block, 'NUM2', order) || 0;
        return [`${num1} + ${num2}`, order];
    };

    Generator.operator_subtract = function (block) {
        // === Smalruby: Start of array syntax ===
        const comment = Generator.getCommentText(block);
        if (comment && comment.includes('@ruby:array:index')) {
            // Round-trip pattern: subtract(itemnumoflist, 1) → pass through .index() result
            const num1 = Generator.valueToCode(block, 'NUM1', Generator.ORDER_FUNCTION_CALL) || 0;
            return [num1, Generator.ORDER_FUNCTION_CALL];
        }
        // === Smalruby: End of array syntax ===

        const order = Generator.ORDER_ADDITIVE;
        const num1 = Generator.valueToCode(block, 'NUM1', order) || 0;
        const num2 = Generator.valueToCode(block, 'NUM2', order) || 0;
        return [`${num1} - ${num2}`, Generator.ORDER_ADDITIVE];
    };

    Generator.operator_multiply = function (block) {
        const order = Generator.ORDER_MULTIPLICATIVE;
        const num1 = Generator.valueToCode(block, 'NUM1', order) || 0;
        const num2 = Generator.valueToCode(block, 'NUM2', order) || 0;
        return [`${num1} * ${num2}`, order];
    };

    Generator.operator_divide = function (block) {
        const order = Generator.ORDER_MULTIPLICATIVE;
        const num1 = Generator.valueToCode(block, 'NUM1', order) || 0;
        let num2 = Generator.valueToCode(block, 'NUM2', order) || 0.0;
        // guard 0 deviding.
        if (Number(num2) === 0) {
            num2 = '0.0';
        }
        return [`${num1} / ${num2}`, order];
    };

    Generator.operator_random = function (block) {
        const fromNum = Generator.valueToCode(block, 'FROM', Generator.ORDER_RANGE) || 1;
        const toNum = Generator.valueToCode(block, 'TO', Generator.ORDER_RANGE) || 10;
        return [`rand(${fromNum}..${toNum})`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.operator_gt = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            for (const part of commentParts) {
                if (part.startsWith('@ruby:operator:>=:')) {
                    const index = part.substring(18);
                    const order = Generator.ORDER_RELATIONAL;
                    const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
                    const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
                    Generator.greaterThanOrEqualCallCache_[index] = {
                        lhs: Generator.nosToCode(operand1),
                        rhs: Generator.nosToCode(operand2)
                    };
                    return [`@ruby:operator:>=:${index}`, order];
                }
            }
        }

        const order = Generator.ORDER_RELATIONAL;
        const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
        const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
        return [`${Generator.nosToCode(operand1)} > ${Generator.nosToCode(operand2)}`, order];
    };

    Generator.operator_lt = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            for (const part of commentParts) {
                if (part.startsWith('@ruby:operator:<=:')) {
                    const index = part.substring(18);
                    const order = Generator.ORDER_RELATIONAL;
                    const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
                    const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
                    Generator.lessThanOrEqualCallCache_[index] = {
                        lhs: Generator.nosToCode(operand1),
                        rhs: Generator.nosToCode(operand2)
                    };
                    return [`@ruby:operator:<=:${index}`, order];
                }
                if (part.startsWith('@ruby:literal:false:')) {
                    return ['false', Generator.ORDER_ATOMIC];
                }
            }
        }

        const order = Generator.ORDER_RELATIONAL;
        const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
        const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
        return [`${Generator.nosToCode(operand1)} < ${Generator.nosToCode(operand2)}`, order];
    };

    Generator.operator_equals = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            let methodName = null;
            let index = null;
            for (const part of commentParts) {
                if (part.startsWith('@ruby:method:empty?:')) {
                    methodName = 'empty?';
                    index = part.substring(20);
                } else if (part.startsWith('@ruby:operator:!=:')) {
                    methodName = '!=';
                    index = part.substring(18);
                } else if (part.startsWith('@ruby:operator:>=:')) {
                    methodName = '>=';
                    index = part.substring(18);
                } else if (part.startsWith('@ruby:operator:<=:')) {
                    methodName = '<=';
                    index = part.substring(18);
                } else if (part.startsWith('@ruby:literal:true:')) {
                    return ['true', Generator.ORDER_ATOMIC];
                }
            }
            if (methodName === 'empty?') {
                const operand1 = Generator.valueToCode(block, 'OPERAND1', Generator.ORDER_EQUALS);
                if (operand1 === `@ruby:method:empty?:${index}`) {
                    const operand2 = Generator.valueToCode(block, 'OPERAND2', Generator.ORDER_EQUALS);
                    if (Generator.nosToCode(operand2) === 0) {
                        const receiver = Generator.emptyCallCache_[index];
                        delete Generator.emptyCallCache_[index];
                        return [`${receiver}.empty?`, Generator.ORDER_FUNCTION_CALL];
                    }
                }
            } else if (methodName === '!=') {
                const order = Generator.ORDER_EQUALS;
                const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
                const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
                Generator.notEqualsCallCache_[index] = {
                    lhs: Generator.nosToCode(operand1),
                    rhs: Generator.nosToCode(operand2)
                };
                return [`@ruby:operator:!=:${index}`, order];
            } else if (methodName === '>=') {
                return [`@ruby:operator:>=:${index}`, Generator.ORDER_EQUALS];
            } else if (methodName === '<=') {
                return [`@ruby:operator:<=:${index}`, Generator.ORDER_EQUALS];
            }
        }

        const order = Generator.ORDER_EQUALS;
        const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 0;
        const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 0;
        return [`${Generator.nosToCode(operand1)} == ${Generator.nosToCode(operand2)}`, order];
    };

    Generator.operator_and = function (block) {
        const order = Generator.ORDER_LOGICAL_AND;
        const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 'false';
        const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 'false';
        return [`${operand1} && ${operand2}`, order];
    };

    Generator.operator_or = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            for (const part of commentParts) {
                if (part.startsWith('@ruby:operator:>=:')) {
                    const index = part.substring(18);
                    const order = Generator.ORDER_RELATIONAL;
                    const operand1 = Generator.valueToCode(block, 'OPERAND1', Generator.ORDER_NONE);
                    if (operand1 === `@ruby:operator:>=:${index}`) {
                        const {lhs, rhs} = Generator.greaterThanOrEqualCallCache_[index];
                        delete Generator.greaterThanOrEqualCallCache_[index];
                        return [`${lhs} >= ${rhs}`, order];
                    }
                } else if (part.startsWith('@ruby:operator:<=:')) {
                    const index = part.substring(18);
                    const order = Generator.ORDER_RELATIONAL;
                    const operand1 = Generator.valueToCode(block, 'OPERAND1', Generator.ORDER_NONE);
                    if (operand1 === `@ruby:operator:<=:${index}`) {
                        const {lhs, rhs} = Generator.lessThanOrEqualCallCache_[index];
                        delete Generator.lessThanOrEqualCallCache_[index];
                        return [`${lhs} <= ${rhs}`, order];
                    }
                }
            }
        }

        const order = Generator.ORDER_LOGICAL_OR;
        const operand1 = Generator.valueToCode(block, 'OPERAND1', order) || 'false';
        const operand2 = Generator.valueToCode(block, 'OPERAND2', order) || 'false';
        return [`${operand1} || ${operand2}`, order];
    };

    Generator.operator_not = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            for (const part of commentParts) {
                if (part.startsWith('@ruby:operator:!=:')) {
                    const index = part.substring(18);
                    const order = Generator.ORDER_NONE;
                    const operand = Generator.valueToCode(block, 'OPERAND', order);
                    if (operand === `@ruby:operator:!=:${index}`) {
                        const {lhs, rhs} = Generator.notEqualsCallCache_[index];
                        delete Generator.notEqualsCallCache_[index];
                        return [`${lhs} != ${rhs}`, Generator.ORDER_EQUALS];
                    }
                }
            }
        }

        const order = Generator.ORDER_UNARY_SIGN;
        const operand = Generator.valueToCode(block, 'OPERAND', order) || 'false';
        return [`!${operand}`, order];
    };

    Generator.operator_join = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment === '@ruby:method:to_s') {
            const value = Generator.valueToCode(block, 'STRING1', Generator.ORDER_FUNCTION_CALL) ||
                Generator.quote_('');
            return [`${value}.to_s`, Generator.ORDER_FUNCTION_CALL];
        }

        const order = Generator.ORDER_ADDITIVE;
        const rightStr = Generator.valueToCode(block, 'STRING1', order) || Generator.quote_('');
        const leftStr = Generator.valueToCode(block, 'STRING2', order) || Generator.quote_('');
        return [`${rightStr} + ${leftStr}`, order];
    };

    Generator.operator_letter_of = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const str = Generator.valueToCode(block, 'STRING', order) || Generator.quote_('');
        const letter = Generator.valueToCode(block, 'LETTER', Generator.ORDER_INDEX) - 1 || '0';
        return [`${str}[${letter}]`, order];
    };

    Generator.operator_length = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment) {
            const commentParts = comment.split(/,(?=@ruby:)/);
            let methodName = null;
            let index = null;
            for (const part of commentParts) {
                if (part.startsWith('@ruby:method:empty?:')) {
                    methodName = 'empty?';
                    index = part.substring(20);
                }
            }
            if (methodName === 'empty?') {
                const str = Generator.valueToCode(block, 'STRING', Generator.ORDER_FUNCTION_CALL) ||
                    Generator.quote_('');
                Generator.emptyCallCache_[index] = str;
                return [`@ruby:method:empty?:${index}`, Generator.ORDER_FUNCTION_CALL];
            }
        }

        const order = Generator.ORDER_FUNCTION_CALL;
        const str = Generator.valueToCode(block, 'STRING', order) || Generator.quote_('');
        return [`${str}.length`, order];
    };

    Generator.operator_contains = function (block) {
        const str1 = Generator.valueToCode(block, 'STRING1', Generator.ORDER_NONE) || Generator.quote_('');
        const str2 = Generator.valueToCode(block, 'STRING2', Generator.ORDER_NONE) || Generator.quote_('');
        return [`${str1}.include?(${str2})`, Generator.ORDER_ATOMIC];
    };

    Generator.operator_mod = function (block) {
        const order = Generator.ORDER_MULTIPLICATIVE;
        const num1 = Generator.valueToCode(block, 'NUM1', order) || '0';
        const num2 = Generator.valueToCode(block, 'NUM2', order) || '0';
        return [`${num1} % ${num2}`, order];
    };

    Generator.operator_round = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const num = Generator.valueToCode(block, 'NUM', order) || '0';
        return [`${num}.round`, order];
    };

    Generator.operator_mathop = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const num = Generator.valueToCode(block, 'NUM', Generator.ORDER_NONE) || '0';
        const operator = Generator.getFieldValue(block, 'OPERATOR') || null;
        switch (operator) {
        case 'abs':
            return [`${num}.abs`, order];
        case 'floor':
            return [`${num}.floor`, order];
        case 'ceiling':
            return [`${num}.ceil`, order];
        case 'sqrt':
            return [`Math.sqrt(${num})`, order];
        case 'sin':
            return [`Math.sin(${num})`, order];
        case 'cos':
            return [`Math.cos(${num})`, order];
        case 'tan':
            return [`Math.tan(${num})`, order];
        case 'asin':
            return [`Math.asin(${num})`, order];
        case 'acos':
            return [`Math.acos(${num})`, order];
        case 'atan':
            return [`Math.atan(${num})`, order];
        case 'ln':
            return [`Math.log(${num})`, order];
        case 'log':
            return [`Math.log10(${num})`, order];
        case 'e ^':
            return [`Math::E ** ${num}`, order];
        case '10 ^':
            return [`10 ** ${num}`, order];
        default:
            return [null, order];
        }
    };

    return Generator;
}
