/**
 * Define Ruby code generator for Math Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.math_number = function (block) {
        const raw = Generator.getFieldValue(block, 'NUM');
        // Preserve float notation like "1.0" that would otherwise become integer 1
        if (typeof raw === 'string' && raw.includes('.')) {
            const n = Number(raw);
            if (!isNaN(n) && Number.isInteger(n)) {
                const order = n < 0 ? Generator.ORDER_UNARY_SIGN : Generator.ORDER_ATOMIC;
                return [raw, order];
            }
        }
        let n = Number(raw);
        if (isNaN(n)) {
            n = 0;
        }
        const order = n < 0 ? Generator.ORDER_UNARY_SIGN : Generator.ORDER_ATOMIC;
        return [n, order];
    };

    ['math_integer', 'math_whole_number', 'math_positive_number', 'math_angle'].forEach(name => {
        Generator[name] = Generator.math_number;
    });

    return Generator;
}
