/**
 * Reading the Japanese into a JaAST (ja-notation, J1 and J2 of
 * docs/ruby-editor/converter-roadmap.md): the standard form, and the DNCL-like
 * form into the same JaAST. The programs are written for the tests (no problem
 * of the 大学入試センター).
 */
import { parse } from '../../../../src/lib/ja-notation/parse';

/** The JaAST without positions, to compare shapes. */
const shape = (node) => {
    if (Array.isArray(node)) return node.map(shape);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    Object.entries(node).forEach(([key, value]) => {
        const positions = ['line', 'column', 'endLine', 'closeLine', 'closeAfter', 'elseLine', 'closeOwnLine'];
        if (positions.includes(key)) return;
        out[key] = shape(value);
    });
    return out;
};

const body = (source) => {
    const { program, errors } = parse(source);
    expect(errors).toEqual([]);
    return shape(program.body);
};

const name = (n) => ({ type: 'Name', name: n });
const num = (v) => ({ type: 'Number', value: v });

describe('parse: statements', () => {
    test('an assignment', () => {
        expect(body('x = 1')).toEqual([{ type: 'Assign', target: name('x'), value: num('1') }]);
    });

    test('assignments on one line are two statements', () => {
        expect(body('a = 0, b = 1')).toEqual([
            { type: 'Assign', target: name('a'), value: num('0') },
            { type: 'Assign', target: name('b'), value: num('1') },
        ]);
    });

    test('an assignment to an element of an array', () => {
        expect(body('Data[0] = 5')).toEqual([
            { type: 'Assign', target: { type: 'Index', target: name('Data'), index: num('0') }, value: num('5') },
        ]);
    });

    test('an input', () => {
        expect(body('n = 【整数を入力】')).toEqual([{ type: 'Input', target: name('n'), kind: 'integer' }]);
    });

    test('an array declared empty', () => {
        expect(body('配列変数 Kago を初期化する')).toEqual([
            { type: 'Assign', target: name('Kago'), value: { type: 'ArrayLiteral', elements: [] } },
        ]);
    });

    test('a number is read as a decimal number', () => {
        expect(body('a = 017')).toEqual([{ type: 'Assign', target: name('a'), value: num('17') }]);
    });

    test('a comment line and a comment at the end of a line', () => {
        expect(body('# はじめ\nx = 1 # 一')).toEqual([
            { type: 'Comment', text: '# はじめ' },
            { type: 'Assign', target: name('x'), value: num('1'), comment: '# 一' },
        ]);
    });
});

describe('parse: expressions', () => {
    const value = (source) => body(`x = ${source}`)[0].value;

    test('`not` is weaker than a comparison and stronger than `and`', () => {
        expect(value('not a > 1 and b')).toEqual({
            type: 'Binary',
            operator: 'and',
            left: {
                type: 'Unary',
                operator: 'not',
                operand: { type: 'Binary', operator: '>', left: name('a'), right: num('1') },
            },
            right: name('b'),
        });
    });

    test('`//` and `÷` are the integer quotient, as strong as `*`', () => {
        expect(value('a + b // 2')).toEqual(value('a + b ÷ 2'));
        expect(value('a + b ÷ 2')).toEqual({
            type: 'Binary',
            operator: '+',
            left: name('a'),
            right: { type: 'Binary', operator: '÷', left: name('b'), right: num('2') },
        });
    });

    test('full-width operators are read as the half-width ones', () => {
        expect(value('a ＋ 1 ≦ 3')).toEqual(value('a + 1 <= 3'));
    });

    test('a call with arguments and a range', () => {
        expect(value('乱数(1..6)')).toEqual({
            type: 'Call',
            name: '乱数',
            args: [{ type: 'Binary', operator: '..', left: num('1'), right: num('6') }],
        });
    });

    test('真 and 偽', () => {
        expect(value('真')).toEqual({ type: 'Boolean', value: true });
    });
});

describe('parse: blocks', () => {
    const PRINT = (arg) => ({
        type: 'ExpressionStatement',
        expression: { type: 'Call', name: '表示する', args: [arg] },
    });

    test('blocks written with the marks', () => {
        const source = [
            '(01) i を 1 から 3 まで 1 ずつ増やしながら繰り返す:',
            '(02) ｜ もし i > 1 ならば:',
            '(03) ⎿ ⎿ 表示する(i)',
            '(04) 表示する(0)',
        ].join('\n');
        expect(body(source)).toEqual([
            {
                type: 'For',
                variable: name('i'),
                from: num('1'),
                to: num('3'),
                step: num('1'),
                direction: 'up',
                body: [
                    {
                        type: 'If',
                        branches: [
                            {
                                condition: { type: 'Binary', operator: '>', left: name('i'), right: num('1') },
                                body: [PRINT(name('i'))],
                            },
                        ],
                        elseBody: null,
                    },
                ],
            },
            PRINT(num('0')),
        ]);
    });

    test('the same blocks written with indentation', () => {
        const marks = body(
            'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:\n｜ もし i > 1 ならば:\n⎿ ⎿ 表示する(i)\n表示する(0)',
        );
        const indent = body(
            'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:\n    もし i > 1 ならば:\n        表示する(i)\n表示する(0)',
        );
        expect(indent).toEqual(marks);
    });

    test('else if and else', () => {
        const [node] = body(
            'もし a > 0 ならば:\n    b = 1\nそうでなくもし a < 0 ならば:\n    b = 2\nそうでなければ:\n    b = 3',
        );
        expect(node.branches).toHaveLength(2);
        expect(node.elseBody).toEqual([{ type: 'Assign', target: name('b'), value: num('3') }]);
    });

    test('a loop with a condition and a function', () => {
        expect(body('関数 たす(a, b):\n    返す a + b\nx > 1 の間繰り返す:\n    x = x // 2')).toEqual([
            {
                type: 'FunctionDef',
                name: 'たす',
                params: ['a', 'b'],
                body: [
                    { type: 'Return', value: { type: 'Binary', operator: '+', left: name('a'), right: name('b') } },
                ],
            },
            {
                type: 'While',
                condition: { type: 'Binary', operator: '>', left: name('x'), right: num('1') },
                body: [
                    {
                        type: 'Assign',
                        target: name('x'),
                        value: { type: 'Binary', operator: '÷', left: name('x'), right: num('2') },
                    },
                ],
            },
        ]);
    });

    test('the line numbers aligned on the code are taken off', () => {
        expect(body('(9)  もし x > 0 ならば:\n(10)  y = 1\n(11) z = 2')).toEqual(
            body('もし x > 0 ならば:\n y = 1\nz = 2'),
        );
    });

    test('a numbered line with an open bracket goes on to the next line', () => {
        const { program } = parse('(1) 表示する(a,\n        b)\n(2) c = 1');
        expect(program.body).toHaveLength(2);
        expect(program.body[0]).toMatchObject({ line: 1, endLine: 2 });
    });

    test('a block that ends by its indent ends at the last code line', () => {
        const { program } = parse('もし a > 0 ならば:\n    a = 1\n\nb = 2');
        expect(program.body[0]).toMatchObject({ closeLine: 2, closeAfter: 3 });
    });
});

describe('parse: errors', () => {
    const errorOf = (source) => {
        const { program, errors } = parse(source);
        expect(program).toBeNull();
        return errors[0];
    };

    test.each([
        ['を実行する', 'syntax'],
        ['もし a > 0 ならば:\n    b = 1\n        を実行する', 'syntax'],
        ['もし a > 0 ならば:\n    b = 1\nend', 'syntax'],
        ['もし a > 0 ならば\n  b = 1', 'unclosed'],
        ['関数 f(a)\n  返す a', 'unclosed'],
    ])('a closing line that does not match: %s (%s)', (source, code) => {
        expect(errorOf(source).code).toBe(code);
    });

    test('a block not closed is an error on its opening line', () => {
        expect(errorOf('x = 1\nx > 0 の間\n  x = x - 1')).toMatchObject({ line: 2, code: 'unclosed' });
    });

    test.each([
        ['a = 0x5', 'bad-number'],
        ['a = @b', 'forbidden'],
        ['begin', 'post-test-loop'],
        ['もし a > 0 ならば:', 'empty-block'],
        ['a = (1', 'syntax'],
    ])('%s is an error (%s)', (source, code) => {
        expect(errorOf(source).code).toBe(code);
    });

    test('the error is on the line it is on', () => {
        expect(errorOf('a = 1\nb = 1_000')).toMatchObject({ line: 2, column: 4 });
    });
});

describe('parse: the DNCL-like form', () => {
    test.each([
        ['もし a > 0 ならば\n  b = 1\nを実行する', 'もし a > 0 ならば:\n  b = 1'],
        [
            'もし a > 0 ならば\n  b = 1\nそうでなくもし a < 0 ならば\n  b = 2\nそうでなければ\n  b = 3\nを実行する',
            'もし a > 0 ならば:\n  b = 1\nそうでなくもし a < 0 ならば:\n  b = 2\nそうでなければ:\n  b = 3',
        ],
        ['x > 1 の間\n  x = x - 1\nを繰り返す', 'x > 1 の間繰り返す:\n  x = x - 1'],
        [
            'i を 1 から 3 まで 1 ずつ増やしながら\n  表示する(i)\nを繰り返す',
            'i を 1 から 3 まで 1 ずつ増やしながら繰り返す:\n  表示する(i)',
        ],
        ['関数 f(a)\n  a + 1 を返す\nと定義する', '関数 f(a):\n  返す a + 1'],
        ['f(a) を定義する:\n  返す a', '関数 f(a):\n  返す a'],
        ['a ← 1', 'a = 1'],
        ['a ← 1, b ← 2', 'a = 1, b = 2'],
        ['x = a かつ b または c', 'x = a and b or c'],
        ['x = a > 1 でない かつ b', 'x = not a > 1 and b'],
        ['x = (a かつ b) でない', 'x = not (a and b)'],
        ['表示する(「こんにちは」)', '表示する("こんにちは")'],
        ['表示する(「a"b」)', '表示する("a\\"b")'],
        ['表示する(「#」)', '表示する("#")'],
    ])('%s is read as the standard form', (dnclLike, standard) => {
        expect(body(dnclLike)).toEqual(body(standard));
    });

    test('the indentation inside a block closed by a line does not matter', () => {
        expect(body('a > 0 の間\na = a - 1\n    b = 1\nを繰り返す')).toEqual(
            body('a > 0 の間繰り返す:\n    a = a - 1\n    b = 1'),
        );
    });

    test('the two forms mixed', () => {
        const mixed = body('もし a > 0 ならば\n  x > 1 の間繰り返す:\n      x = x - 1\n  b = 1\nを実行する');
        const standard = body('もし a > 0 ならば:\n  x > 1 の間繰り返す:\n      x = x - 1\n  b = 1');
        expect(mixed).toEqual(standard);
    });

    test('a block opened with `:` whose next line is not deeper ends at a closing line', () => {
        expect(body('もし a > 0 ならば:\nb = 1\nを実行する')).toEqual(body('もし a > 0 ならば:\n  b = 1'));
    });

    test('`end` closes a block opened without `:`', () => {
        expect(body('もし a > 0 ならば\n  b = 1\nend')).toEqual(body('もし a > 0 ならば:\n  b = 1'));
    });

    test('a `でない` before an operator is the left side of it, as Ruby reads `!a == b`', () => {
        expect(body('c = a でない == b')).toEqual([
            {
                type: 'Assign',
                target: name('c'),
                value: {
                    type: 'Binary',
                    operator: '==',
                    left: { type: 'Unary', operator: 'not', operand: name('a') },
                    right: name('b'),
                },
            },
        ]);
    });

    test('a block closed by a line of its own ends on that line, with its comment', () => {
        const { program } = parse('もし a > 0 ならば\n  b = 1\n\nを実行する # おわり');
        expect(program.body[0]).toMatchObject({ closeLine: 4, closeOwnLine: true, closeComment: '# おわり' });
    });
});
