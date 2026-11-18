/**
 * Reading the standard form of the Japanese into a JaAST (ja-notation, J1 of
 * docs/ruby-editor/converter-roadmap.md). The programs are written for the
 * tests (no problem of the 大学入試センター).
 */
import { parseStandard } from '../../../../src/lib/ja-notation/parse-standard';

/** The JaAST without positions, to compare shapes. */
const shape = (node) => {
    if (Array.isArray(node)) return node.map(shape);
    if (!node || typeof node !== 'object') return node;
    const out = {};
    Object.entries(node).forEach(([key, value]) => {
        if (['line', 'column', 'endLine', 'closeLine', 'closeAfter', 'elseLine'].includes(key)) return;
        out[key] = shape(value);
    });
    return out;
};

const body = (source) => {
    const { program, errors } = parseStandard(source);
    expect(errors).toEqual([]);
    return shape(program.body);
};

const name = (n) => ({ type: 'Name', name: n });
const num = (v) => ({ type: 'Number', value: v });

describe('parseStandard: statements', () => {
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

describe('parseStandard: expressions', () => {
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

describe('parseStandard: blocks', () => {
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
        const { program } = parseStandard('(1) 表示する(a,\n        b)\n(2) c = 1');
        expect(program.body).toHaveLength(2);
        expect(program.body[0]).toMatchObject({ line: 1, endLine: 2 });
    });

    test('a block that ends by its indent ends at the last code line', () => {
        const { program } = parseStandard('もし a > 0 ならば:\n    a = 1\n\nb = 2');
        expect(program.body[0]).toMatchObject({ closeLine: 2, closeAfter: 3 });
    });
});

describe('parseStandard: errors', () => {
    const errorOf = (source) => {
        const { program, errors } = parseStandard(source);
        expect(program).toBeNull();
        return errors[0];
    };

    test.each([
        ['もし a > 0 ならば\n  b = 1\nを実行する'],
        ['a ← 1'],
        ['x = a かつ b'],
        ['表示する(「こんにちは」)'],
    ])('the DNCL-like form is told apart: %s', (source) => {
        expect(errorOf(source).code).toBe('dncl-like');
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
