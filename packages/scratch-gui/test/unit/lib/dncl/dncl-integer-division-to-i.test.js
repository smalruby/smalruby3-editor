import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

/**
 * Division as in 共通テスト用プログラム表記: `/` is the ordinary division
 * (`a / 2` ↔ `@a / 2`), `÷` is the integer quotient (`a ÷ 2` ↔
 * `(@a / 2).to_i`), and `÷` has the precedence of `*` (`a * 3 ÷ 2` is
 * `(a * 3) ÷ 2`). Ruby `(式).to_i` that is not one quotient becomes
 * `整数(式)`, so the value stays the same both ways. (Issue #1701)
 */
describe('DNCL / and ÷ (Issue #1701)', () => {
    const toRuby = (dncl) => dnclToRuby(dncl).ruby;
    const toDncl = (ruby) => rubyToDncl(ruby).dncl;

    /**
     * Evaluate a Ruby expression of the subset used here: numbers, `@vars`,
     * `( )`, `+ - * /` (Scratch division: never truncates), unary `-` and the
     * postfix `.to_i` (truncation) / `.to_s`.
     * @param {string} src - The Ruby expression.
     * @param {object} vars - Values of the `@vars` (without `@`).
     * @returns {number|string} The value.
     */
    const evaluate = (src, vars) => {
        const tokens = src.match(/\d+(?:\.\d+)?|@\w+|\.to_[is]|[-+*/()]/g);
        let pos = 0;
        const peek = () => tokens[pos];
        const next = () => tokens[pos++];
        let parseExpr = null;
        const parsePrimary = () => {
            const t = next();
            let value;
            if (t === '(') {
                value = parseExpr();
                next(); // ')'
            } else if (t === '-') {
                value = -parsePrimary();
            } else if (t.startsWith('@')) {
                value = vars[t.slice(1)];
            } else {
                value = Number(t);
            }
            while (peek() === '.to_i' || peek() === '.to_s') {
                value = next() === '.to_i' ? Math.trunc(Number(value)) : String(value);
            }
            return value;
        };
        const parseTerm = () => {
            let value = parsePrimary();
            while (peek() === '*' || peek() === '/') {
                const op = next();
                const right = parsePrimary();
                value = op === '*' ? value * right : value / right;
            }
            return value;
        };
        parseExpr = () => {
            let value = parseTerm();
            while (peek() === '+' || peek() === '-') {
                const op = next();
                const right = parseTerm();
                value = op === '+' ? value + right : value - right;
            }
            return value;
        };
        return parseExpr();
    };

    const rhs = (line) => line.replace(/^@b = /, '');
    const VALUES = [3, -1, 7, 2.5, -3.5, 10];
    const valuesOf = (ruby) => VALUES.map((a) => [a, evaluate(rhs(ruby), { a, b: a + 1 })]);

    describe('Ruby → DNCL → Ruby keeps the value', () => {
        test.each([
            '@b = (@a / 2 * 3).to_i',
            '@b = (@a / 2 + 1).to_i',
            '@b = (@a / 2).to_i',
            '@b = (@a / (2 * 3)).to_i',
            '@b = ((@a / 2) * 3).to_i',
            '@b = ((@a / 2).to_i / 3).to_i',
            '@b = (@a * 3 / 2).to_i',
            '@b = (@a / 2 / 3).to_i',
            '@b = (@a / (@a / 2).to_i).to_i',
            '@b = ((@a / 2) / 3).to_i',
            '@b = ((@a / 2).to_i * 3).to_i',
            '@b = (@a / 2).to_i * 3',
            '@b = @a * (@a / 2).to_i',
            '@b = @a / (@a / 2).to_i',
            '@b = (@a / 2).to_i + (@a / 4).to_i',
            '@b = -(@a / 2).to_i',
            '@b = (@a / 2 * 3).to_i.to_s',
            '@b = (@a / 2).to_i.to_s',
            '@b = @a / 2',
            '@b = @a / 2 * 3',
            '@b = (@a + @b) / 2',
        ])('%s', (ruby) => {
            expect(valuesOf(toRuby(toDncl(ruby)))).toEqual(valuesOf(ruby));
        });
    });

    describe('Ruby → DNCL', () => {
        test.each([
            ['@b = @a / 2', 'b = a / 2'],
            ['@b = @a / 2 * 3', 'b = a / 2 * 3'],
            ['@b = (@x / 2).to_i', 'b = x ÷ 2'],
            ['@b = ((@a + @b) / 2).to_i', 'b = (a + b) ÷ 2'],
            ['@b = (@a / (2 * 3)).to_i', 'b = a ÷ (2 * 3)'],
            ['@b = ((@a / 2).to_i / 3).to_i', 'b = a ÷ 2 ÷ 3'],
            ['@b = (@a * 3 / 2).to_i', 'b = a * 3 ÷ 2'],
            ['@b = (@a / 2 / 3).to_i', 'b = a / 2 ÷ 3'],
            ['@b = ((@a / 2) / 3).to_i', 'b = (a / 2) ÷ 3'],
            ['@b = (@a / (@a / 2).to_i).to_i', 'b = a ÷ (a ÷ 2)'],
            ['@b = @a * (@a / 2).to_i', 'b = a * (a ÷ 2)'],
            ['@b = (@a / 2).to_i * 3', 'b = a ÷ 2 * 3'],
            ['@b = (@a / 2).to_i.to_s', 'b = 文字列(a ÷ 2)'],
            // Not one quotient: 整数(式), with the ordinary `/` in it.
            ['@b = (@a / 2 * 3).to_i', 'b = 整数(a / 2 * 3)'],
            ['@b = (@a / 2 + 1).to_i', 'b = 整数(a / 2 + 1)'],
            ['@b = ((@a / 2) * 3).to_i', 'b = 整数((a / 2) * 3)'],
            ['@b = ((@a / 2).to_i * 3).to_i', 'b = 整数(a ÷ 2 * 3)'],
            ['@b = (@a / 2 * 3).to_i.to_s', 'b = 文字列(整数(a / 2 * 3))'],
        ])('%s → %s', (ruby, dncl) => {
            expect(toDncl(ruby)).toBe(dncl);
        });
    });

    describe('DNCL → Ruby', () => {
        test.each([
            ['b = a / 2', '@b = @a / 2'],
            ['b = a / 2 * 3', '@b = @a / 2 * 3'],
            ['b = a ÷ 2', '@b = (@a / 2).to_i'],
            ['b = a // 2', '@b = (@a / 2).to_i'],
            // `//` is read as `÷`: the same operands and precedence.
            ['b = (a + c) // 2', '@b = ((@a + @c) / 2).to_i'],
            ['b = a * 3 // 2', '@b = (@a * 3 / 2).to_i'],
            ['b = a // (c + 1)', '@b = (@a / (@c + 1)).to_i'],
            ['b = Data[i + 1] // 2', '@b = (@_array_Data_[@i + 1] / 2).to_i'],
            ['b = a // 2 + 1', '@b = (@a / 2).to_i + 1'],
            ['b = a // 2 // 3', '@b = ((@a / 2).to_i / 3).to_i'],
            ['b = 合計 // 個数', '@b = (@合計 / @個数).to_i'],
            ['b = a ÷ 2 * 3', '@b = (@a / 2).to_i * 3'],
            ['b = a * 3 ÷ 2', '@b = (@a * 3 / 2).to_i'],
            ['b = a / 2 ÷ 3', '@b = (@a / 2 / 3).to_i'],
            ['b = a + c ÷ 2', '@b = @a + (@c / 2).to_i'],
            ['b = a ÷ 2 ÷ 3', '@b = ((@a / 2).to_i / 3).to_i'],
            ['b = (a + c) ÷ 2', '@b = ((@a + @c) / 2).to_i'],
            ['b = a ÷ (a ÷ 2)', '@b = (@a / ((@a / 2).to_i)).to_i'],
            ['b = 整数(a / 2 * 3)', '@b = (@a / 2 * 3).to_i'],
            ['b = 整数(a ÷ 2)', '@b = (@a / 2).to_i'],
            ['b = Data[i ÷ 2]', '@b = @_array_Data_[(@i / 2).to_i]'],
        ])('%s → %s', (dncl, ruby) => {
            expect(toRuby(dncl)).toBe(ruby);
        });
    });

    describe('DNCL → Ruby → DNCL', () => {
        const DNCL = [
            'b = a / 2',
            'b = a ÷ 2',
            'b = a / 2 * 3',
            'b = a ÷ 2 * 3',
            'b = a * 3 ÷ 2',
            'b = a / 2 ÷ 3',
            'b = a ÷ 2 ÷ 3',
            'b = a ÷ (a ÷ 2)',
            'b = a * (a ÷ 2)',
            'b = (a + c) ÷ 2',
            'b = (a ÷ 2) * 3',
            'b = 整数(a / 2 * 3)',
            'b = 整数(a ÷ 2 * 3)',
            'b = 文字列(a ÷ 2)',
            'b = 文字列(a / 2)',
        ];

        test.each(DNCL)('%s', (dncl) => {
            expect(toDncl(toRuby(dncl))).toBe(dncl);
        });

        test.each(DNCL)('keeps the value: %s', (dncl) => {
            const ruby = toRuby(dncl);
            const vars = (a) => ({ a, c: a + 1 });
            const back = toRuby(toDncl(ruby));
            for (const a of VALUES) {
                expect(evaluate(rhs(back), vars(a))).toEqual(evaluate(rhs(ruby), vars(a)));
            }
        });

        test.each([
            ['b = a // 2', 'b = a ÷ 2'],
            ['b = 整数(a ÷ 2)', 'b = a ÷ 2'],
        ])('%s comes back as %s', (dncl, expected) => {
            expect(toDncl(toRuby(dncl))).toBe(expected);
        });
    });
});
