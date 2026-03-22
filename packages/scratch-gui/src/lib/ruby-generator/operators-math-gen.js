// === Smalruby: This file is Smalruby-specific (Ruby code generator for arithmetic and math function blocks) ===
/**
 * Define Ruby code generator for Arithmetic and Math Function Blocks
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
        const comment = Generator.getCommentText(block);
        if (comment && comment.includes('@ruby:array:index')) {
            // Round-trip pattern: subtract(itemnumoflist, 1) -> pass through .index() result
            const num1 = Generator.valueToCode(block, 'NUM1', Generator.ORDER_FUNCTION_CALL) || 0;
            return [num1, Generator.ORDER_FUNCTION_CALL];
        }

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
