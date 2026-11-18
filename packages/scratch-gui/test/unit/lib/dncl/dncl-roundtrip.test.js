import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { FORMS, rubyToDncl as rubyToDnclInForm } from '../../../../src/lib/dncl/ruby-to-dncl';

/**
 * Round-trip test: DNCL → Ruby → DNCL
 * Verifies that converting DNCL to Ruby and back produces the same DNCL,
 * in both forms the writer has (Issue #1754): the DNCL 風の形 gives the
 * input back, the standard form gives the text written for it (the same
 * as the input when no block, logic or return value is in it). In both,
 * the text reads back to the same Ruby and does not change again.
 */
describe.each([FORMS.DNCL, FORMS.STANDARD])('DNCL round-trip (DNCL → Ruby → DNCL), form %s', (form) => {
    const rubyToDncl = (ruby) => rubyToDnclInForm(ruby, { form });
    const toRuby = (dncl) => dnclToRuby(dncl).ruby;
    const roundtrip = (dncl) => rubyToDncl(toRuby(dncl)).dncl;
    const expectRoundtrip = (input, expected, expectedStandard = expected) => {
        const result = roundtrip(input);
        expect(result).toBe(form === FORMS.DNCL ? expected : expectedStandard);
        expect(toRuby(result)).toBe(toRuby(input));
        expect(roundtrip(result)).toBe(result);
    };

    describe('variables', () => {
        test('lowercase variable assignment', () => {
            expectRoundtrip('a = 3', 'a = 3');
        });

        test('uppercase scalar variable', () => {
            expectRoundtrip('A = 3', 'A = 3');
        });

        test('uppercase array variable', () => {
            expectRoundtrip('Kouka = [1, 5, 10]', 'Kouka = [1, 5, 10]');
        });
    });

    describe('operators', () => {
        test('boolean true/false', () => {
            expectRoundtrip('a = 真', 'a = 真');
            expectRoundtrip('a = 偽', 'a = 偽');
        });

        test('logical operators', () => {
            expectRoundtrip('a = x かつ y', 'a = x かつ y', 'a = x and y');
            expectRoundtrip('a = x または y', 'a = x または y', 'a = x or y');
        });
    });

    describe('display and input', () => {
        test('表示する round-trips', () => {
            expectRoundtrip('表示する(a)', '表示する(a)');
        });

        test('入力 round-trips', () => {
            expectRoundtrip('a = 【外部からの入力】', 'a = 【外部からの入力】');
            expectRoundtrip('n = 【整数を入力】', 'n = 【整数を入力】');
        });
    });

    describe('control flow', () => {
        test('simple if', () => {
            const dncl = 'もし a > 0 ならば\n  a = 1\nを実行する';
            const standard = 'もし a > 0 ならば:\n    a = 1';
            expectRoundtrip(dncl, dncl, standard);
        });

        test('if-else', () => {
            const dncl = 'もし a > 0 ならば\n  a = 1\nそうでなければ\n  a = 2\nを実行する';
            const standard = 'もし a > 0 ならば:\n    a = 1\nそうでなければ:\n    a = 2';
            expectRoundtrip(dncl, dncl, standard);
        });

        test('if with なら normalizes to ならば', () => {
            const input = 'もし a > 0 なら\n  a = 1\nを実行する';
            const expected = 'もし a > 0 ならば\n  a = 1\nを実行する';
            const standard = 'もし a > 0 ならば:\n    a = 1';
            expectRoundtrip(input, expected, standard);
        });

        test('while loop', () => {
            const dncl = 'a > 0 の間\n  a = a - 1\nを繰り返す';
            const standard = 'a > 0 の間繰り返す:\n    a = a - 1';
            expectRoundtrip(dncl, dncl, standard);
        });

        test('ascending for loop', () => {
            const dncl = 'i を 1 から 10 まで 1 ずつ増やしながら\n  表示する(i)\nを繰り返す';
            const standard = 'i を 1 から 10 まで 1 ずつ増やしながら繰り返す:\n    表示する(i)';
            expectRoundtrip(dncl, dncl, standard);
        });

        test('descending for loop', () => {
            const dncl = 'i を 10 から 0 まで 1 ずつ減らしながら\n  表示する(i)\nを繰り返す';
            const standard = 'i を 10 から 0 まで 1 ずつ減らしながら繰り返す:\n    表示する(i)';
            expectRoundtrip(dncl, dncl, standard);
        });

        test('function definition', () => {
            const dncl = '関数 f(x)\n  返す x * 2\nと定義する';
            const standard = '関数 f(x):\n    x * 2 を返す';
            expectRoundtrip(dncl, dncl, standard);
        });
    });

    describe('built-in functions', () => {
        test('整数 round-trips', () => {
            expectRoundtrip('a = 整数(x)', 'a = 整数(x)');
        });

        test('文字列 round-trips', () => {
            expectRoundtrip('a = 文字列(x)', 'a = 文字列(x)');
        });

        test('乱数 round-trips', () => {
            expectRoundtrip('a = 乱数(10)', 'a = 乱数(10)');
        });

        test('四捨五入 round-trips', () => {
            expectRoundtrip('a = 四捨五入(x)', 'a = 四捨五入(x)');
        });

        test('切り捨て round-trips', () => {
            expectRoundtrip('a = 切り捨て(x)', 'a = 切り捨て(x)');
        });

        test('切り上げ round-trips', () => {
            expectRoundtrip('a = 切り上げ(x)', 'a = 切り上げ(x)');
        });

        test('絶対値 round-trips', () => {
            expectRoundtrip('a = 絶対値(x)', 'a = 絶対値(x)');
        });

        test('平方根 round-trips', () => {
            expectRoundtrip('a = 平方根(x)', 'a = 平方根(x)');
        });

        test('含む round-trips', () => {
            expectRoundtrip('a = 含む("hello", "ell")', 'a = 含む("hello", "ell")');
        });
    });

    describe('nested function calls', () => {
        test('表示する(乱数(1..10)) round-trips', () => {
            expectRoundtrip('表示する(乱数(1..10))', '表示する(乱数(1..10))');
        });

        test('表示する(整数(x)) round-trips', () => {
            expectRoundtrip('表示する(整数(x))', '表示する(整数(x))');
        });

        test('表示する(絶対値(x)) round-trips', () => {
            expectRoundtrip('表示する(絶対値(x))', '表示する(絶対値(x))');
        });

        test('表示する(乱数(1..10) + 5) round-trips', () => {
            expectRoundtrip('表示する(乱数(1..10) + 5)', '表示する(乱数(1..10) + 5)');
        });

        test('a = 含む(s, 乱数(1..10)) round-trips', () => {
            expectRoundtrip('a = 含む(s, 乱数(1..10))', 'a = 含む(s, 乱数(1..10))');
        });
    });

    describe('user-defined function calls', () => {
        test('function definition + call round-trips', () => {
            const dncl = '関数 myfunc(x)\n  返す 5\nと定義する\nmyfunc(3)';
            const standard = '関数 myfunc(x):\n    5 を返す\nmyfunc(3)';
            expectRoundtrip(dncl, dncl, standard);
        });

        test('function call in assignment round-trips', () => {
            const dncl = '関数 myfunc(x)\n  返す 5\nと定義する\na = myfunc(3)';
            const standard = '関数 myfunc(x):\n    5 を返す\na = myfunc(3)';
            expectRoundtrip(dncl, dncl, standard);
        });
    });

    describe('Ruby → DNCL → Ruby (regression for nested parens)', () => {
        const rubyRoundtrip = (ruby) => {
            const dncl = rubyToDncl(ruby).dncl;
            return dnclToRuby(dncl).ruby;
        };

        test('say(rand(1..10), 1) → puts(rand(1..10)) (表示する uses puts)', () => {
            // 表示する → puts (Issue #640): the say() output is normalized to
            // puts() in the new direction, so round-trip lands on puts().
            expect(rubyRoundtrip('say(rand(1..10), 1)')).toBe('puts(rand(1..10))');
        });

        test('say(rand(1..10) + 5, 1) → puts(rand(1..10) + 5) (single expr, not flattened)', () => {
            // Operands are not all string-literal-or-.to_s, so the `+` chain
            // stays as a single expression in DNCL. Round-trips to puts(...).
            expect(rubyRoundtrip('say(rand(1..10) + 5, 1)')).toBe('puts(rand(1..10) + 5)');
        });

        test('say(@x.to_i, 1) → puts(@x.to_i)', () => {
            expect(rubyRoundtrip('say(@x.to_i, 1)')).toBe('puts(@x.to_i)');
        });
    });

    describe('comments and blank lines', () => {
        test('preserves comments', () => {
            expectRoundtrip('# コメント', '# コメント');
        });

        test('preserves blank lines', () => {
            expectRoundtrip('a = 1\n\nb = 2', 'a = 1\n\nb = 2');
        });
    });
});
