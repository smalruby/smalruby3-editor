// === Smalruby: This file is Smalruby-specific (Ruby code generator for arithmetic and math function blocks) ===
/**
 * Register an `[outerOrder, innerOrder]` pair in `Generator.ORDER_OVERRIDES`
 * so that `valueToCode` skips parens for that combination. Used to suppress
 * unnecessary parens on the LEFT side of left-associative operators
 * (`+`, `-`, `*`, `/`, `%`).
 * @param {object} Generator The RubyGenerator instance.
 * @param {number} outerOrder The synthesized outer order (typically `order + 0.5`).
 * @param {number} innerOrder The inner block's natural order (e.g. ORDER_ADDITIVE).
 */
const registerLeftAssocOverride = (Generator, outerOrder, innerOrder) => {
    if (!Generator.ORDER_OVERRIDES.some((p) => p[0] === outerOrder && p[1] === innerOrder)) {
        Generator.ORDER_OVERRIDES.push([outerOrder, innerOrder]);
    }
};

/**
 * Define Ruby code generator for Arithmetic and Math Function Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.operator_add = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment === '@ruby:method:to_i') {
            const value = Generator.valueToCode(block, 'NUM1', Generator.ORDER_RECEIVER) || 0;
            return [`${value}.to_i`, Generator.ORDER_FUNCTION_CALL];
        }

        const order = Generator.ORDER_ADDITIVE;
        const leftSideOrder = order + 0.5;
        registerLeftAssocOverride(Generator, leftSideOrder, order);
        const num1 = Generator.valueToCode(block, 'NUM1', leftSideOrder) || 0;
        const num2 = Generator.valueToCode(block, 'NUM2', order) || 0;
        return [`${num1} + ${num2}`, order];
    };

    Generator.operator_subtract = function (block) {
        const comment = Generator.getCommentText(block);
        if (comment && comment.includes('@ruby:array:index')) {
            // Round-trip pattern: subtract(itemnumoflist, 1) -> pass through .index() result.
            // Hand back NUM1 with its own order and let the outer block decide on parentheses:
            // asking valueToCode for ORDER_FUNCTION_CALL wrapped the `.index()` call (also
            // ORDER_FUNCTION_CALL) in parentheses, so `say(@a.index("x"))` came back as
            // `say((@a.index("x")))` (issue #1660).
            const innerId = block.inputs && block.inputs.NUM1 && block.inputs.NUM1.block;
            const inner = innerId && Generator.getBlock(innerId);
            const tuple = inner ? Generator.blockToCode(inner) : '';
            if (Array.isArray(tuple) && tuple[0]) {
                return tuple;
            }
            return ['0', Generator.ORDER_ATOMIC];
        }
        const order = Generator.ORDER_ADDITIVE;
        const leftSideOrder = order + 0.5;
        registerLeftAssocOverride(Generator, leftSideOrder, order);
        const num1 = Generator.valueToCode(block, 'NUM1', leftSideOrder) || 0;
        // Only while the left side is still 0: once someone puts another value there the block is
        // a plain subtraction again and `-X` would change its meaning.
        if (String(num1) === '0' && comment && comment.split(/,(?=@ruby:)/).includes('@ruby:unary_minus')) {
            // "(0) - (X)" made from `-X` (issue #1676). In Ruby `**` binds tighter than a unary
            // minus and `*` looser, so X needs parens only when it is looser than `-` itself
            // (`-(1 + 2)`, but `-a ** 2` and `-@a.length`). A nested minus needs no parens
            // either; a space keeps `- -x` from reading as `--x`.
            const unaryOrder = Generator.ORDER_UNARY_MINUS_SIGN;
            registerLeftAssocOverride(Generator, unaryOrder, unaryOrder);
            let operand = String(Generator.valueToCode(block, 'NUM2', unaryOrder) || 0);
            // A minus written right before a number literal is part of the literal, so `-5.abs`
            // is `(-5).abs` and `-5` is a plain number (issue #1747). Keep the parens when X is a
            // literal or starts with a literal followed by a call (`-(5)`, `-(5.abs)`); a literal
            // followed by a space (`-10 ** x`) is still the minus of the whole power.
            const literal = operand.match(/^\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?/);
            if (literal && !operand.slice(literal[0].length).startsWith(' ')) {
                operand = `(${operand})`;
            }
            return [`-${operand.startsWith('-') ? ' ' : ''}${operand}`, unaryOrder];
        }
        const num2 = Generator.valueToCode(block, 'NUM2', order) || 0;
        return [`${num1} - ${num2}`, Generator.ORDER_ADDITIVE];
    };

    Generator.operator_multiply = function (block) {
        const order = Generator.ORDER_MULTIPLICATIVE;
        const leftSideOrder = order + 0.5;
        registerLeftAssocOverride(Generator, leftSideOrder, order);
        const num1 = Generator.valueToCode(block, 'NUM1', leftSideOrder) || 0;
        const num2 = Generator.valueToCode(block, 'NUM2', order) || 0;
        return [`${num1} * ${num2}`, order];
    };

    Generator.operator_divide = function (block) {
        const order = Generator.ORDER_MULTIPLICATIVE;
        const leftSideOrder = order + 0.5;
        registerLeftAssocOverride(Generator, leftSideOrder, order);
        const num1 = Generator.valueToCode(block, 'NUM1', leftSideOrder) || 0;
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
        // `%` is left-associative with `*` and `/`: `a * b % 3` is `(a * b) % 3`.
        const leftSideOrder = order + 0.5;
        registerLeftAssocOverride(Generator, leftSideOrder, order);
        const num1 = Generator.valueToCode(block, 'NUM1', leftSideOrder) || '0';
        const num2 = Generator.valueToCode(block, 'NUM2', order) || '0';
        return [`${num1} % ${num2}`, order];
    };

    Generator.operator_round = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const num = Generator.valueToCode(block, 'NUM', Generator.ORDER_RECEIVER) || '0';
        return [`${num}.round`, order];
    };

    Generator.operator_mathop = function (block) {
        const order = Generator.ORDER_FUNCTION_CALL;
        const operator = Generator.getFieldValue(block, 'OPERATOR') || null;
        // `.abs` and the like take NUM as the receiver: `(a + 1).abs` keeps its parentheses
        // (issue #1675). `Math.sqrt(...)` takes it as an argument, and `10 ** x` as the right
        // operand of `**`, which also makes the whole expression an exponentiation.
        let numOrder = Generator.ORDER_RECEIVER;
        if (operator === 'e ^' || operator === '10 ^') {
            numOrder = Generator.ORDER_EXPONENTIATION;
        } else if (!['abs', 'floor', 'ceiling'].includes(operator)) {
            numOrder = Generator.ORDER_NONE;
        }
        const num = Generator.valueToCode(block, 'NUM', numOrder) || '0';
        const comment = Generator.getCommentText(block);
        switch (operator) {
            case 'abs':
                return [`${num}.abs`, order];
            case 'floor':
                // `.to_i` and `.floor` both compile to operator_mathop(floor);
                // the `@ruby:method:to_i` marker distinguishes the two on
                // round-trip so we restore the source method name.
                if (comment === '@ruby:method:to_i') {
                    return [`${num}.to_i`, order];
                }
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
                return [`Math::E ** ${num}`, Generator.ORDER_EXPONENTIATION];
            case '10 ^':
                return [`10 ** ${num}`, Generator.ORDER_EXPONENTIATION];
            default:
                return [null, order];
        }
    };

    return Generator;
}
