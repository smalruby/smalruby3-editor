import {loadPrism} from '../../../src/lib/prism-parser';
import FuriganaAnnotator from '../../../src/lib/furigana-annotator';

describe('FuriganaAnnotator', () => {
    let prism;
    let annotator;

    beforeAll(async () => {
        prism = await loadPrism();
        annotator = new FuriganaAnnotator();
    });

    const parse = code => prism.parse(code);
    const annotate = code => annotator.annotate(code, parse(code));
    const labelsAt = (annotations, line) => (annotations.get(line) || []).map(a => a.label);

    describe('empty / invalid input', () => {
        test('empty code returns empty map', () => {
            expect(annotate('').size).toBe(0);
        });
        test('null parseResult returns empty map', () => {
            expect(annotator.annotate('x = 1', null).size).toBe(0);
        });
    });

    describe('variable assignment: answer = 10', () => {
        let annotations;
        beforeAll(() => {
            annotations = annotate('answer = 10');
        });

        test('line 1 has 変数answer, 紐付ける, 数値10 in order', () => {
            expect(labelsAt(annotations, 1)).toEqual(['変数answer', '紐付ける', '数値10']);
        });
        test('answer starts at column 0', () => {
            expect(annotations.get(1)[0].startColumn).toBe(0);
        });
        test('= starts at column 7', () => {
            expect(annotations.get(1)[1].startColumn).toBe(7);
        });
        test('10 starts at column 9', () => {
            expect(annotations.get(1)[2].startColumn).toBe(9);
        });
    });

    describe('numeric literals', () => {
        test('integer literal annotates as 数値N', () => {
            const anns = annotate('x = 42');
            expect(labelsAt(anns, 1)).toContain('数値42');
        });
        test('float literal annotates as 数値N', () => {
            const anns = annotate('x = 0.7');
            expect(labelsAt(anns, 1)).toContain('数値0.7');
        });
    });

    describe('string literals', () => {
        test('string literal annotates as 文字列「...」', () => {
            const anns = annotate('puts "hello"');
            const labels = labelsAt(anns, 1);
            expect(labels.some(l => l === '文字列「hello」')).toBe(true);
        });
    });

    describe('method calls', () => {
        test('puts annotates as 表示する', () => {
            expect(labelsAt(annotate('puts "text"'), 1)).toContain('表示する');
        });
        test('print annotates as 表示する', () => {
            expect(labelsAt(annotate('print "text"'), 1)).toContain('表示する');
        });
        test('gets annotates as 入力する', () => {
            expect(labelsAt(annotate('age = gets.to_i'), 1)).toContain('入力する');
        });
        test('to_i annotates as 整数化', () => {
            expect(labelsAt(annotate('age = gets.to_i'), 1)).toContain('整数化');
        });
        test('to_s annotates as 文字列化', () => {
            const anns = annotate('x = 42\ns = x.to_s');
            expect(labelsAt(anns, 2)).toContain('文字列化');
        });
    });

    describe('arithmetic operators', () => {
        test('+ (numeric) annotates as 足す', () => {
            const anns = annotate('x = 1\ny = 2\na = x + y');
            expect(labelsAt(anns, 3)).toContain('足す');
        });
        test('+ (string) annotates as 連結', () => {
            expect(labelsAt(annotate('"hello" + " world"'), 1)).toContain('連結');
        });
        test('- annotates as 引く', () => {
            const anns = annotate('x = 1\na = x - 1');
            expect(labelsAt(anns, 2)).toContain('引く');
        });
        test('* annotates as 掛ける', () => {
            const anns = annotate('x = 2\na = x * 3');
            expect(labelsAt(anns, 2)).toContain('掛ける');
        });
        test('/ annotates as 割る', () => {
            const anns = annotate('x = 6\na = x / 2');
            expect(labelsAt(anns, 2)).toContain('割る');
        });
        test('% annotates as 余り', () => {
            const anns = annotate('x = 7\na = x % 3');
            expect(labelsAt(anns, 2)).toContain('余り');
        });
    });

    describe('comparison operators', () => {
        test('<= annotates as 以下', () => {
            const anns = annotate('x = 5\nif x <= 10\nend');
            expect(labelsAt(anns, 2)).toContain('以下');
        });
        test('>= annotates as 以上', () => {
            const anns = annotate('x = 65\nif x >= 65\nend');
            expect(labelsAt(anns, 2)).toContain('以上');
        });
        test('< annotates as 小さい', () => {
            const anns = annotate('x = 3\nif x < 5\nend');
            expect(labelsAt(anns, 2)).toContain('小さい');
        });
        test('> annotates as 大きい', () => {
            const anns = annotate('x = 3\nif x > 5\nend');
            expect(labelsAt(anns, 2)).toContain('大きい');
        });
        test('== annotates as 等しい', () => {
            const anns = annotate('x = 3\nif x == 3\nend');
            expect(labelsAt(anns, 2)).toContain('等しい');
        });
        test('!= annotates as 等しくない', () => {
            const anns = annotate('x = 3\nif x != 3\nend');
            expect(labelsAt(anns, 2)).toContain('等しくない');
        });
    });

    describe('logical operators', () => {
        test('&& annotates as かつ', () => {
            const anns = annotate('x = 5\ny = 3\nif x > 0 && y > 0\nend');
            expect(labelsAt(anns, 3)).toContain('かつ');
        });
        test('|| annotates as または', () => {
            const anns = annotate('x = 5\ny = 65\nif x <= 5 || y >= 65\nend');
            expect(labelsAt(anns, 3)).toContain('または');
        });
    });

    describe('control flow: if / elsif / else / end', () => {
        test('if keyword annotates as もし', () => {
            const anns = annotate('x = 5\nif x <= 5\n  puts "ok"\nend');
            expect(labelsAt(anns, 2)).toContain('もし');
        });
        test('end of if annotates as 分岐終了', () => {
            const anns = annotate('x = 5\nif x <= 5\n  puts "ok"\nend');
            expect(labelsAt(anns, 4)).toContain('分岐終了');
        });
        test('else annotates as でなければ', () => {
            const anns = annotate('x = 5\nif x <= 5\n  puts "small"\nelse\n  puts "big"\nend');
            expect(labelsAt(anns, 4)).toContain('でなければ');
        });
        test('elsif annotates as ではなく', () => {
            const anns = annotate('x = 5\nif x <= 5\n  puts "small"\nelsif x >= 65\n  puts "big"\nend');
            expect(labelsAt(anns, 4)).toContain('ではなく');
        });
    });

    describe('control flow: while / end', () => {
        test('while keyword annotates as 繰り返す', () => {
            const anns = annotate('n = 3\nwhile n > 0\n  n = n - 1\nend');
            expect(labelsAt(anns, 2)).toContain('繰り返す');
        });
        test('end of while annotates as ブロック終了', () => {
            const anns = annotate('n = 3\nwhile n > 0\n  n = n - 1\nend');
            expect(labelsAt(anns, 4)).toContain('ブロック終了');
        });
    });

    describe('def / end', () => {
        test('def keyword annotates as メソッド作成', () => {
            const anns = annotate('def greet\n  puts "hi"\nend');
            expect(labelsAt(anns, 1)).toContain('メソッド作成');
        });
        test('method name annotates as Nという名前', () => {
            const anns = annotate('def greet\n  puts "hi"\nend');
            expect(labelsAt(anns, 1)).toContain('greetという名前');
        });
        test('end of def annotates as 作成終了', () => {
            const anns = annotate('def greet\n  puts "hi"\nend');
            expect(labelsAt(anns, 3)).toContain('作成終了');
        });
        test('required parameter annotates as 引数N', () => {
            const anns = annotate('def add(a, b)\n  a + b\nend');
            expect(labelsAt(anns, 1)).toContain('引数a');
            expect(labelsAt(anns, 1)).toContain('引数b');
        });
    });

    describe('return', () => {
        test('return annotates as 呼び出し元に返す', () => {
            const anns = annotate('def double(x)\n  return x * 2\nend');
            expect(labelsAt(anns, 2)).toContain('呼び出し元に返す');
        });
    });

    describe('class definition', () => {
        test('class keyword annotates as クラス作成', () => {
            const anns = annotate('class Dog\nend');
            expect(labelsAt(anns, 1)).toContain('クラス作成');
        });
        test('end of class annotates as 作成終了', () => {
            const anns = annotate('class Dog\nend');
            expect(labelsAt(anns, 2)).toContain('作成終了');
        });
    });

    describe('case / when / end', () => {
        test('case keyword annotates as 状態分岐', () => {
            const anns = annotate('x = 1\ncase x\nwhen 1\n  puts "one"\nend');
            expect(labelsAt(anns, 2)).toContain('状態分岐');
        });
        test('when keyword annotates as のとき', () => {
            const anns = annotate('x = 1\ncase x\nwhen 1\n  puts "one"\nend');
            expect(labelsAt(anns, 3)).toContain('のとき');
        });
        test('end of case annotates as 分岐終了', () => {
            const anns = annotate('x = 1\ncase x\nwhen 1\n  puts "one"\nend');
            expect(labelsAt(anns, 5)).toContain('分岐終了');
        });
    });

    describe('global variables', () => {
        test('$x = ... annotates as グローバル変数x and 紐付ける', () => {
            const anns = annotate('$score = 0');
            expect(labelsAt(anns, 1)).toContain('グローバル変数score');
            expect(labelsAt(anns, 1)).toContain('紐付ける');
        });
        test('$x read annotates as グローバル変数x', () => {
            const anns = annotate('$score = 0\nputs $score');
            expect(labelsAt(anns, 2)).toContain('グローバル変数score');
        });
    });

    describe('instance variables', () => {
        test('@x = ... annotates as インスタンス変数x and 紐付ける', () => {
            const anns = annotate('@name = "Alice"');
            expect(labelsAt(anns, 1)).toContain('インスタンス変数name');
            expect(labelsAt(anns, 1)).toContain('紐付ける');
        });
        test('@x read annotates as インスタンス変数x', () => {
            const anns = annotate('@name = "Alice"\nputs @name');
            expect(labelsAt(anns, 2)).toContain('インスタンス変数name');
        });
    });

    describe('boolean literals', () => {
        test('true annotates as 真', () => {
            const anns = annotate('x = true');
            expect(labelsAt(anns, 1)).toContain('真');
        });
        test('false annotates as 偽', () => {
            const anns = annotate('x = false');
            expect(labelsAt(anns, 1)).toContain('偽');
        });
    });

    describe('operator assignment', () => {
        test('+= (numeric) annotates as ずつ増やす', () => {
            const anns = annotate('x = 1\nx += 1');
            expect(labelsAt(anns, 2)).toContain('ずつ増やす');
        });
        test('+= (string) annotates as と連結', () => {
            const anns = annotate('x = "hello"\nx += " world"');
            expect(labelsAt(anns, 2)).toContain('と連結');
        });
        test('-= annotates as ずつ減らす', () => {
            const anns = annotate('x = 5\nx -= 1');
            expect(labelsAt(anns, 2)).toContain('ずつ減らす');
        });
        test('*= annotates as 倍にする', () => {
            const anns = annotate('x = 2\nx *= 3');
            expect(labelsAt(anns, 2)).toContain('倍にする');
        });
        test('/= annotates as 分の1にする', () => {
            const anns = annotate('x = 6\nx /= 2');
            expect(labelsAt(anns, 2)).toContain('分の1にする');
        });
        test('%= annotates as 余りにする', () => {
            const anns = annotate('x = 7\nx %= 3');
            expect(labelsAt(anns, 2)).toContain('余りにする');
        });
        test('**= annotates as べき乗にする', () => {
            const anns = annotate('x = 2\nx **= 3');
            expect(labelsAt(anns, 2)).toContain('べき乗にする');
        });
    });

    describe('exponentiation and unary operators', () => {
        test('** annotates as べき乗', () => {
            const anns = annotate('x = 2\na = x ** 3');
            expect(labelsAt(anns, 2)).toContain('べき乗');
        });
    });

    describe('to_f conversion', () => {
        test('.to_f annotates as 浮動小数点数化', () => {
            const anns = annotate('x = "3"\ny = x.to_f');
            expect(labelsAt(anns, 2)).toContain('浮動小数点数化');
        });
    });

    describe('wait method', () => {
        test('wait annotates as 待つ', () => {
            const anns = annotate('wait(1)');
            expect(labelsAt(anns, 1)).toContain('待つ');
        });
    });

    describe('until loop', () => {
        test('until keyword annotates as まで繰り返す', () => {
            const anns = annotate('n = 0\nuntil n >= 3\n  n += 1\nend');
            expect(labelsAt(anns, 2)).toContain('まで繰り返す');
        });
        test('end of until annotates as ブロック終了', () => {
            const anns = annotate('n = 0\nuntil n >= 3\n  n += 1\nend');
            expect(labelsAt(anns, 4)).toContain('ブロック終了');
        });
    });

    describe('multiline program from book examples', () => {
        test('kakaku example', () => {
            const code = [
                'kakaku = 100',
                'urine = kakaku * 0.7',
                'puts urine'
            ].join('\n');
            const anns = annotate(code);
            // line 1: kakaku = 100
            expect(labelsAt(anns, 1)).toContain('変数kakaku');
            expect(labelsAt(anns, 1)).toContain('紐付ける');
            expect(labelsAt(anns, 1)).toContain('数値100');
            // line 2: urine = kakaku * 0.7
            expect(labelsAt(anns, 2)).toContain('変数urine');
            expect(labelsAt(anns, 2)).toContain('掛ける');
            expect(labelsAt(anns, 2)).toContain('数値0.7');
            // line 3: puts urine
            expect(labelsAt(anns, 3)).toContain('表示する');
            expect(labelsAt(anns, 3)).toContain('変数urine');
        });
    });
});
