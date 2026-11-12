import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

/**
 * `(式).to_i` and division. DNCL `/` is integer division (`a / 2` ↔
 * `(@a / 2).to_i`), so Ruby → DNCL drops `.to_i` only when `式` is exactly one
 * division. Any other `(式).to_i` becomes `整数(式)`, in which `/` is the
 * ordinary division and only the whole is truncated, so the value is kept
 * both ways. (Issue #1701)
 */
describe('DNCL integer division and .to_i (Issue #1701)', () => {
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

    describe('Ruby → DNCL → Ruby keeps the value', () => {
        test.each([
            '@b = (@a / 2 * 3).to_i',
            '@b = (@a / 2 + 1).to_i',
            '@b = (@a / 2).to_i',
            '@b = (@a / (2 * 3)).to_i',
            '@b = ((@a / 2) * 3).to_i',
            '@b = ((@a / 2).to_i / 3).to_i',
            '@b = (@a * 3 / 2).to_i',
            '@b = (@a / (@a / 2).to_i).to_i',
            '@b = ((@a / 2) / 3).to_i',
            '@b = ((@a / 2).to_i * 3).to_i',
            '@b = (@a / 2).to_i * 3',
            '@b = (@a / 2).to_i + (@a / 4).to_i',
            '@b = -(@a / 2).to_i',
            '@b = (@a / 2 * 3).to_i.to_s',
            '@b = (@a / 2).to_i.to_s',
        ])('%s', (ruby) => {
            const back = toRuby(toDncl(ruby));
            for (const a of VALUES) {
                expect([a, evaluate(rhs(back), { a })]).toEqual([a, evaluate(rhs(ruby), { a })]);
            }
        });
    });

    describe('Ruby → DNCL', () => {
        test.each([
            ['@b = (@a / 2 * 3).to_i', 'b = 整数(a / 2 * 3)'],
            ['@b = (@a / 2 + 1).to_i', 'b = 整数(a / 2 + 1)'],
            ['@b = ((@a / 2) * 3).to_i', 'b = 整数((a / 2) * 3)'],
            ['@b = (@a / 2 * 3).to_i.to_s', 'b = 文字列(整数(a / 2 * 3))'],
            // One division: `.to_i` is what DNCL `/` already does.
            ['@b = (@x / 2).to_i', 'b = x / 2'],
            ['@b = ((@a + @b) / 2).to_i', 'b = (a + b) / 2'],
            ['@b = (@a / (2 * 3)).to_i', 'b = a / (2 * 3)'],
            ['@b = ((@a / 2).to_i / 3).to_i', 'b = a / 2 / 3'],
            ['@b = (@a / 2).to_i.to_s', 'b = 文字列(a / 2)'],
            ['@b = (@a / (@a / 2).to_i).to_i', 'b = a / (a / 2)'],
        ])('%s → %s', (ruby, dncl) => {
            expect(toDncl(ruby)).toBe(dncl);
        });
    });

    describe('DNCL → Ruby', () => {
        test.each([
            // `/` inside 整数(...) is the ordinary division.
            ['b = 整数(a / 2 * 3)', '@b = (@a / 2 * 3).to_i'],
            ['b = 整数((a / 2) * 3)', '@b = ((@a / 2) * 3).to_i'],
            ['b = 整数(a / 2)', '@b = (@a / 2).to_i'],
            // `÷` stays the integer quotient there.
            ['b = 整数(a ÷ 2 * 3)', '@b = ((@a / 2).to_i * 3).to_i'],
            // Arguments of a call and indexes are not inside 整数.
            ['b = 整数(Data[i / 2] * 3)', '@b = (@_array_Data_[(@i / 2).to_i] * 3).to_i'],
            // Outside 整数, `/` is integer division as before.
            ['b = a / 2 * 3', '@b = (@a / 2).to_i * 3'],
            ['b = a / (a / 2)', '@b = (@a / ((@a / 2).to_i)).to_i'],
            ['b = a / 2 / 3', '@b = ((@a / 2).to_i / 3).to_i'],
        ])('%s → %s', (dncl, ruby) => {
            expect(toRuby(dncl)).toBe(ruby);
        });
    });

    describe('DNCL → Ruby → DNCL', () => {
        test.each([
            'b = 整数(a / 2 * 3)',
            'b = 整数(a / 2 + 1)',
            'b = 整数((a / 2) * 3)',
            'b = 文字列(整数(a / 2 * 3))',
            'b = a / 2 * 3',
            'b = a / (2 * 3)',
            'b = a / 2 / 3',
            'b = a / (a / 2)',
            'b = (a + b) / 2',
            'b = 整数(整数(a / 2) * 3)',
        ])('%s', (dncl) => {
            expect(toDncl(toRuby(dncl))).toBe(dncl);
        });

        test('DNCL → Ruby → DNCL keeps the value of 整数(a ÷ 2 * 3)', () => {
            const ruby = toRuby('b = 整数(a ÷ 2 * 3)');
            const back = toRuby(toDncl(ruby));
            for (const a of VALUES) {
                expect(evaluate(rhs(back), { a })).toBe(evaluate(rhs(ruby), { a }));
            }
        });
    });
});
