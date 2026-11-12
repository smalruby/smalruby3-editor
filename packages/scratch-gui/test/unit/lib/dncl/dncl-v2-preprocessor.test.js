// === Smalruby: Tests for DNCLv2 → Smalruby DNCL pre-processor ===
//
// The pre-processor normalizes the DNCLv2 syntax used in 共通テスト
// example programs (https://nodai2hitc.github.io/ictl_example/) into
// the existing Smalruby DNCL form, so the existing DNCL → Ruby pipeline
// can handle them unchanged.
//
// Phase 3 covers: line numbers, trailing colons, 「繰り返す」 suffix
// normalization, comma-separated multi-assignment, and `and`/`or`.
//
// Phase 4 (separate commit) will add `｜` / `⎿` indent markers and the
// implicit `end` insertion based on `⎿` count.
//
// See Issue #640.
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { dnclV2Preprocess, dnclV2PreprocessWithLineMap } from '../../../../src/lib/dncl/dncl-v2-preprocessor';

describe('DNCLv2 pre-processor: line numbers', () => {
    test('strips (N) prefix with single digit', () => {
        expect(dnclV2Preprocess('(1) a = 1')).toBe('a = 1');
    });

    test('strips (NN) prefix with multiple digits', () => {
        expect(dnclV2Preprocess('(20) 表示する(i)')).toBe('表示する(i)');
    });

    test('strips (N) followed by multiple spaces', () => {
        expect(dnclV2Preprocess('(7)  hidari = 0')).toBe('hidari = 0');
    });

    test('does not strip when (N) appears mid-line', () => {
        expect(dnclV2Preprocess('a = (1)')).toBe('a = (1)');
    });

    test('strips line number and preserves rest', () => {
        const input = '(1) a = 1\n(2) b = 2\n(3) 表示する(a + b)';
        const expected = 'a = 1\nb = 2\n表示する(a + b)';
        expect(dnclV2Preprocess(input)).toBe(expected);
    });
});

describe('DNCLv2 pre-processor: trailing colons', () => {
    test('strips colon after ならば', () => {
        expect(dnclV2Preprocess('もし a > 0 ならば:')).toBe('もし a > 0 ならば');
    });

    test('strips colon after なら', () => {
        expect(dnclV2Preprocess('もし a > 0 なら:')).toBe('もし a > 0 なら');
    });

    test('strips colon after そうでなければ', () => {
        expect(dnclV2Preprocess('そうでなければ:')).toBe('そうでなければ');
    });

    test('strips colon after そうでなくもし ... ならば', () => {
        expect(dnclV2Preprocess('そうでなくもし a > 5 ならば:')).toBe('そうでなくもし a > 5 ならば');
    });

    test('strips colon after の間繰り返す (and normalizes suffix)', () => {
        // pipeline applies both stripTrailingColon and normalizeKurikaesuSuffix
        expect(dnclV2Preprocess('a > 0 の間繰り返す:')).toBe('a > 0 の間');
    });

    test('strips colon after 増やしながら繰り返す (and normalizes suffix)', () => {
        expect(dnclV2Preprocess('i を 1 から 10 まで 1 ずつ増やしながら繰り返す:')).toBe(
            'i を 1 から 10 まで 1 ずつ増やしながら',
        );
    });

    test('strips colon after を定義する (and converts to 関数 form)', () => {
        // The pipeline strips the colon AND converts the DNCLv2 opener
        // (`NAME(ARGS) を定義する`) to the Smalruby form (`関数 NAME(ARGS)`).
        expect(dnclV2Preprocess('myfunc(x) を定義する:')).toBe('関数 myfunc(x)');
    });

    test('does not strip colon inside string', () => {
        expect(dnclV2Preprocess('a = "hello: world"')).toBe('a = "hello: world"');
    });

    test('does not strip colon mid-line', () => {
        // Colons inside expressions stay (unlikely in DNCL but be safe).
        expect(dnclV2Preprocess('a = {key: value}')).toBe('a = {key: value}');
    });
});

describe('DNCLv2 pre-processor: 繰り返す suffix normalization', () => {
    test('normalizes の間繰り返す to の間', () => {
        expect(dnclV2Preprocess('a > 0 の間繰り返す')).toBe('a > 0 の間');
    });

    test('normalizes 増やしながら繰り返す to 増やしながら', () => {
        expect(dnclV2Preprocess('i を 1 から 10 まで 1 ずつ増やしながら繰り返す')).toBe(
            'i を 1 から 10 まで 1 ずつ増やしながら',
        );
    });

    test('normalizes 減らしながら繰り返す to 減らしながら', () => {
        expect(dnclV2Preprocess('i を 10 から 0 まで 1 ずつ減らしながら繰り返す')).toBe(
            'i を 10 から 0 まで 1 ずつ減らしながら',
        );
    });

    test('strips both colon and 繰り返す suffix', () => {
        expect(dnclV2Preprocess('a > 0 の間繰り返す:')).toBe('a > 0 の間');
    });

    test('does not normalize bare の間 (already Smalruby form)', () => {
        expect(dnclV2Preprocess('a > 0 の間')).toBe('a > 0 の間');
    });
});

describe('DNCLv2 pre-processor: comma-separated multi-assignment', () => {
    test('splits two assignments on one line', () => {
        expect(dnclV2Preprocess('hidari = 0 , migi = kazu - 1')).toBe('hidari = 0\nmigi = kazu - 1');
    });

    test('splits three assignments on one line', () => {
        expect(dnclV2Preprocess('a = 1 , b = 2 , c = 3')).toBe('a = 1\nb = 2\nc = 3');
    });

    test('indents each split line by its block depth', () => {
        expect(dnclV2Preprocess('もし x ならば\n  a = 1 , b = 2\nを実行する')).toBe(
            'もし x ならば\n  a = 1\n  b = 2\nを実行する',
        );
    });

    test('does not split when comma is inside array literal', () => {
        expect(dnclV2Preprocess('a = [1, 2, 3]')).toBe('a = [1, 2, 3]');
    });

    test('does not split when comma is inside function call', () => {
        expect(dnclV2Preprocess('表示する("a", "b")')).toBe('表示する("a", "b")');
    });

    test('does not split when comma is inside string', () => {
        expect(dnclV2Preprocess('a = "x, y"')).toBe('a = "x, y"');
    });

    // A `,` or `=` in 「...」 is text, as in `"..."` (Issue #1709).
    test('does not split at a comma inside 「...」', () => {
        expect(dnclV2Preprocess('表示 ← 「a=1, b=2」')).toBe('表示 ← 「a=1, b=2」');
        expect(dnclToRuby('表示 ← 「a=1, b=2」').ruby).toBe('@表示 = "a=1, b=2"');
    });

    test('an `=` inside 「...」 does not make a part an assignment', () => {
        expect(dnclV2Preprocess('a = 「x=1」, 表示する(a)')).toBe('a = 「x=1」, 表示する(a)');
    });

    test('splits at the comma after a 「...」 with a comma in it', () => {
        expect(dnclV2Preprocess('a = 「,」, b = 1')).toBe('a = 「,」\nb = 1');
    });

    test('does not split single assignment', () => {
        expect(dnclV2Preprocess('a = 0')).toBe('a = 0');
    });

    test('does not split when one part is not assignment', () => {
        // Don't trigger on `a = 1 , b` (no `=` in second part)
        expect(dnclV2Preprocess('a = 1 , b')).toBe('a = 1 , b');
    });
});

describe('DNCLv2 pre-processor: and / or normalization', () => {
    test('and → かつ', () => {
        expect(dnclV2Preprocess('a > 0 and b < 10')).toBe('a > 0 かつ b < 10');
    });

    test('or → または', () => {
        expect(dnclV2Preprocess('a > 0 or b > 0')).toBe('a > 0 または b > 0');
    });

    test('and inside string is left alone', () => {
        expect(dnclV2Preprocess('a = "x and y"')).toBe('a = "x and y"');
    });

    test('and as part of identifier is left alone', () => {
        // `bandwidth` should not become `bかつwidth`
        expect(dnclV2Preprocess('a = bandwidth')).toBe('a = bandwidth');
    });

    test('or as part of identifier is left alone', () => {
        expect(dnclV2Preprocess('a = ordinary')).toBe('a = ordinary');
    });

    test('combined and/or in complex condition', () => {
        expect(dnclV2Preprocess('hidari <= migi and owari == 0 の間繰り返す:')).toBe(
            'hidari <= migi かつ owari == 0 の間',
        );
    });
});

// Issue #1683 / #1685: comments are kept as written, and `and` / `or`
// touching a Japanese letter or a digit is part of a name — the same rules
// as `not` (Issue #1671).
describe('DNCLv2 pre-processor: and / or / not are left alone in comments and names', () => {
    test('and / or in a comment are left alone (#1683)', () => {
        expect(dnclV2Preprocess('x = 1 # a and b or c')).toBe('x = 1 # a and b or c');
    });

    test('and / or / not in a comment after a condition (#1683)', () => {
        expect(dnclV2Preprocess('もし a > 0 and b ならば # not a or b and c')).toBe(
            'もし a > 0 かつ b ならば # not a or b and c',
        );
    });

    test('a whole-line comment is left alone (#1683)', () => {
        expect(dnclV2Preprocess('# x and y or not z')).toBe('# x and y or not z');
    });

    test('# inside a string is not a comment', () => {
        expect(dnclV2Preprocess('s = "#" and t or u')).toBe('s = "#" かつ t または u');
    });

    test('and / or / not inside a string are left alone', () => {
        expect(dnclV2Preprocess("s = 'x or y' and 'not z'")).toBe("s = 'x or y' かつ 'not z'");
    });

    test('# inside a 「」 string is not a comment', () => {
        expect(dnclV2Preprocess('s = 「#」 and t or not u')).toBe('s = 「#」 かつ t または u でない');
    });

    test('and / or / not inside a 「」 string are left alone', () => {
        expect(dnclV2Preprocess('s = 「x or y」 and 「not z」')).toBe('s = 「x or y」 かつ 「not z」');
    });

    test('an unclosed 「 is not a string', () => {
        expect(dnclV2Preprocess('s = 「 and t')).toBe('s = 「 かつ t');
    });

    test('or at the end of a Japanese name is part of the name (#1685)', () => {
        expect(dnclV2Preprocess('フラグor = 1')).toBe('フラグor = 1');
    });

    test('and at the end of a Japanese name is part of the name (#1685)', () => {
        expect(dnclV2Preprocess('x = 値and + 1')).toBe('x = 値and + 1');
    });

    test('and / or at the start of a Japanese name are part of the name (#1685)', () => {
        expect(dnclV2Preprocess('x = andフラグ + orカウント')).toBe('x = andフラグ + orカウント');
    });

    test('and / or between Japanese names separated by spaces are converted', () => {
        expect(dnclV2Preprocess('もし 値 > 0 and フラグ or 合計 ならば:')).toBe(
            'もし 値 > 0 かつ フラグ または 合計 ならば',
        );
    });

    test('a plain a > 0 and b is converted', () => {
        expect(dnclV2Preprocess('もし a > 0 and b ならば:')).toBe('もし a > 0 かつ b ならば');
    });

    test('nothing / android / order / organ are left alone', () => {
        expect(dnclV2Preprocess('x = nothing + android + order + organ')).toBe(
            'x = nothing + android + order + organ',
        );
    });

    test('and right after a digit is part of the number token, like not', () => {
        // `1and` / `1not` stay as written; DNCLv2 puts spaces around operators.
        expect(dnclV2Preprocess('もし x == 1and y ならば:')).toBe('もし x == 1and y ならば');
        expect(dnclV2Preprocess('b = 1not')).toBe('b = 1not');
    });
});

describe('DNCLv2 and / or in comments and names → Ruby', () => {
    const toRuby = (dncl) => dnclToRuby(dnclV2Preprocess(dncl)).ruby;

    test('フラグor = 1 (#1685)', () => {
        expect(toRuby('フラグor = 1')).toBe('@フラグor = 1');
    });

    test('値and + 1 (#1685)', () => {
        expect(toRuby('x = 値and + 1')).toBe('@x = @値and + 1');
    });

    test('a comment keeps and / or (#1683)', () => {
        expect(toRuby('x = 1 # a and b or c')).toBe('@x = 1 # a and b or c');
    });

    test('a 「#」 string does not hide the and after it', () => {
        expect(toRuby('x = 「#」 and b')).toBe('@x = "#" && @b');
    });
});

describe('DNCLv2 pre-processor: end-to-end DNCLv2 example fragment', () => {
    test('full preprocessing of example header lines', () => {
        const input = [
            '(1)  Data = [3,18,29,33,48,52,62,77,89,97]',
            '(2)  kazu = 要素数(Data)',
            '(5)  hidari = 0 , migi = kazu - 1',
            '(7)  hidari <= migi and owari == 0 の間繰り返す:',
        ].join('\n');
        const expected = [
            'Data = [3,18,29,33,48,52,62,77,89,97]',
            'kazu = 要素数(Data)',
            'hidari = 0',
            'migi = kazu - 1',
            'hidari <= migi かつ owari == 0 の間',
        ].join('\n');
        expect(dnclV2Preprocess(input)).toBe(expected);
    });
});

describe('DNCLv2 pre-processor: ｜ / ⎿ indent markers (Phase 4)', () => {
    test('single ｜ becomes 2 spaces of indent', () => {
        // `｜` with surrounding spaces is replaced by 2 spaces of indent.
        const input = ['(7) もし a > 0 ならば:', '(8)  ｜ a = 1'].join('\n');
        const out = dnclV2Preprocess(input);
        expect(out).toContain('  a = 1');
        // The `｜` itself should not appear in the output.
        expect(out).not.toContain('｜');
    });

    test('double ｜ becomes 4 spaces of indent', () => {
        const input = ['(7) もし a > 0 ならば:', '(8)  ｜ もし b > 0 ならば:', '(9)  ｜  ｜ a = 1'].join('\n');
        const out = dnclV2Preprocess(input);
        expect(out).toContain('    a = 1');
        expect(out).not.toContain('｜');
    });

    test('single ⎿ becomes 2 spaces of indent AND emits a closer', () => {
        // The `⎿` says "this is the last line of one block — close it".
        // The closer keyword depends on the block opener type.
        const input = ['(7) もし a > 0 ならば:', '(8)  ⎿ a = 1'].join('\n');
        const out = dnclV2Preprocess(input);
        const lines = out.split('\n');
        // Three output lines: the if header, the body, and the auto-emitted
        // を実行する.
        expect(lines).toEqual(['もし a > 0 ならば', '  a = 1', 'を実行する']);
    });

    test('double ⎿ closes 2 blocks at once', () => {
        const input = ['(7) もし a > 0 ならば:', '(8)  ｜ もし b > 0 ならば:', '(9)  ⎿  ⎿ a = 1'].join('\n');
        const out = dnclV2Preprocess(input);
        const lines = out.split('\n');
        expect(lines).toEqual([
            'もし a > 0 ならば',
            '  もし b > 0 ならば',
            '    a = 1',
            '  を実行する',
            'を実行する',
        ]);
    });

    test('⎿ on while loop emits を繰り返す', () => {
        const input = ['(7) a > 0 の間繰り返す:', '(8)  ⎿ a = a - 1'].join('\n');
        const out = dnclV2Preprocess(input);
        const lines = out.split('\n');
        expect(lines).toEqual(['a > 0 の間', '  a = a - 1', 'を繰り返す']);
    });

    test('⎿ on for loop emits を繰り返す', () => {
        const input = ['(1) i を 1 から 10 まで 1 ずつ増やしながら繰り返す:', '(2)  ⎿ 表示する(i)'].join('\n');
        const out = dnclV2Preprocess(input);
        const lines = out.split('\n');
        expect(lines).toEqual(['i を 1 から 10 まで 1 ずつ増やしながら', '  表示する(i)', 'を繰り返す']);
    });

    test('⎿ on function definition emits と定義する', () => {
        const input = ['(1) 関数 f(x)', '(2)  ⎿ 返す x + 1'].join('\n');
        const out = dnclV2Preprocess(input);
        const lines = out.split('\n');
        expect(lines).toEqual(['関数 f(x)', '  返す x + 1', 'と定義する']);
    });

    test('そうでなくもし / そうでなければ are NOT new blocks (no new push)', () => {
        const input = [
            '(1) もし a > 0 ならば:',
            '(2)  ｜ a = 1',
            '(3) そうでなくもし a < 0 ならば:',
            '(4)  ｜ a = -1',
            '(5) そうでなければ:',
            '(6)  ⎿ a = 0',
        ].join('\n');
        const out = dnclV2Preprocess(input);
        const lines = out.split('\n');
        // Only ONE close (the original もし block), not three.
        expect(lines).toEqual([
            'もし a > 0 ならば',
            '  a = 1',
            'そうでなくもし a < 0 ならば',
            '  a = -1',
            'そうでなければ',
            '  a = 0',
            'を実行する',
        ]);
    });

    test('full nested DNCLv2 example block (Issue #640 lines 7-15)', () => {
        const input = [
            '(7)  hidari <= migi and owari == 0 の間繰り返す:',
            '(8)   ｜ aida = (hidari+migi) ÷ 2',
            '(9)   ｜ もし Data[aida] == atai ならば:',
            '(10)  ｜  ｜ 表示する(atai, "は", aida, "番目にありました")',
            '(11)  ｜  ｜ owari = 1',
            '(12)  ｜ そうでなくもし Data[aida] < atai ならば:',
            '(13)  ｜  ｜ hidari = aida + 1',
            '(14)  ｜ そうでなければ:',
            '(15)  ⎿  ⎿ migi = aida - 1',
        ].join('\n');
        const out = dnclV2Preprocess(input);
        const lines = out.split('\n');
        expect(lines).toEqual([
            'hidari <= migi かつ owari == 0 の間',
            '  aida = (hidari+migi) ÷ 2',
            '  もし Data[aida] == atai ならば',
            '    表示する(atai, "は", aida, "番目にありました")',
            '    owari = 1',
            '  そうでなくもし Data[aida] < atai ならば',
            '    hidari = aida + 1',
            '  そうでなければ',
            '    migi = aida - 1',
            '  を実行する',
            'を繰り返す',
        ]);
    });

    test('ASCII pipe `|` is also accepted as indent marker (auto-correct compat)', () => {
        // Smalruby's auto-correct (on by default) converts the full-width
        // pipe `｜` to ASCII `|` before our pre-processor sees it. The
        // pre-processor must accept both so DNCLv2 paste-and-run still works
        // when auto-correct is enabled.
        const input = ['(7) もし a > 0 ならば:', '(8)  | a = 1'].join('\n');
        const out = dnclV2Preprocess(input);
        expect(out).toContain('  a = 1');
        expect(out).not.toContain('|');
    });

    test('mixed ASCII `|` and ⎿ markers (typical auto-correct output)', () => {
        const input = ['(7) もし a > 0 ならば:', '(8)  | もし b > 0 ならば:', '(9)  ⎿  ⎿ a = 1'].join('\n');
        const out = dnclV2Preprocess(input);
        const lines = out.split('\n');
        expect(lines).toEqual([
            'もし a > 0 ならば',
            '  もし b > 0 ならば',
            '    a = 1',
            '  を実行する',
            'を実行する',
        ]);
    });

    test('lines without ⎿ do NOT auto-emit closers', () => {
        // Normal Smalruby DNCL with explicit を実行する still works.
        const input = ['もし a > 0 ならば', '  a = 1', 'を実行する'].join('\n');
        const out = dnclV2Preprocess(input);
        expect(out).toBe(input);
    });
});

describe('DNCLv2 pre-processor: function definition (Phase 5)', () => {
    test('NAME(ARGS) を定義する → 関数 NAME(ARGS) (single-line opener)', () => {
        expect(dnclV2Preprocess('myfunc(x) を定義する')).toBe('関数 myfunc(x)');
    });

    test('NAME(ARGS) を定義する: → 関数 NAME(ARGS) (with trailing colon)', () => {
        expect(dnclV2Preprocess('myfunc(x) を定義する:')).toBe('関数 myfunc(x)');
    });

    test('two-arg function definition', () => {
        expect(dnclV2Preprocess('add(a, b) を定義する')).toBe('関数 add(a, b)');
    });

    test('zero-arg function definition', () => {
        expect(dnclV2Preprocess('hello() を定義する')).toBe('関数 hello()');
    });

    test('full DNCLv2 function definition with body and ⎿', () => {
        const input = ['(1) calc(x) を定義する:', '(2)  ⎿ 返す x + 1'].join('\n');
        const out = dnclV2Preprocess(input);
        const lines = out.split('\n');
        expect(lines).toEqual(['関数 calc(x)', '  返す x + 1', 'と定義する']);
    });

    test('does NOT convert `関数 ... と定義する` (already Smalruby form)', () => {
        const input = ['関数 myfunc(x)', '  返す x + 1', 'と定義する'].join('\n');
        expect(dnclV2Preprocess(input)).toBe(input);
    });

    test('does NOT match `を定義する` mid-line (only end-of-line)', () => {
        // `a = "calc(x) を定義する"` should not be touched
        expect(dnclV2Preprocess('a = "calc(x) を定義する"')).toBe('a = "calc(x) を定義する"');
    });
});

describe('DNCLv2 pre-processor: idempotency', () => {
    test('Smalruby DNCL passes through unchanged', () => {
        const src = ['a = 1', 'もし a > 0 ならば', '  表示する(a)', 'を実行する'].join('\n');
        expect(dnclV2Preprocess(src)).toBe(src);
    });

    test('running the pre-processor twice gives the same result', () => {
        const src = ['(1) Data = [1, 2, 3]', '(2) もし a > 0 ならば:', '(3)  ⎿ 表示する(a)'].join('\n');
        const once = dnclV2Preprocess(src);
        const twice = dnclV2Preprocess(once);
        expect(twice).toBe(once);
    });
});

// A bracket or a `#` in a string (`"..."`, `'...'`, `「...」`) is text: it does not keep a
// numbered statement open, so the next line is not joined to it (#1709).
describe('DNCLv2 pre-processor: brackets and # in a string', () => {
    test.each(['(1) 表示する(「(」)', '(1) 表示する("(")', '(1) 表示する(「#」)', "(1) 表示する('#')"])(
        '%s does not swallow the next line',
        (first) => {
            expect(dnclV2Preprocess(`${first}\nx = 1`).split('\n')).toHaveLength(2);
        },
    );

    test('a statement wrapped after a 「#」 is still joined', () => {
        expect(dnclV2Preprocess('(1) 表示する(「#」,\n      a)')).toBe('表示する(「#」, a)');
    });
});

describe('DNCLv2 pre-processor: a # comment on a wrapped statement (Issue #1710)', () => {
    test('the comment moves to the end of the joined line', () => {
        expect(dnclV2Preprocess('(1) x = f(1, # c\n      2)\n(2) 表示する(x)')).toBe('x = f(1, 2) # c\n表示する(x)');
    });

    test('the comments of several wrapped lines are put together at the end', () => {
        expect(dnclV2Preprocess('(1) 表示する(a, # 1つ目\n      b, # 2つ目\n      c)')).toBe(
            '表示する(a, b, c) # 1つ目 # 2つ目',
        );
    });

    test('a continuation line that is only a comment adds no code', () => {
        expect(dnclV2Preprocess('(1) 表示する(a,\n      # メモ\n      b)')).toBe('表示する(a, b) # メモ');
    });

    test('a bracket in the comment is not counted', () => {
        expect(dnclV2Preprocess('(1) x = f(1, # )\n      2)\n(2) y = 3')).toBe('x = f(1, 2) # )\ny = 3');
        expect(dnclV2Preprocess('(1) x = 1 # (メモ\n      y = 2').split('\n')).toHaveLength(2);
    });

    test('a joined line still maps to its first source line', () => {
        const { source, lineMap } = dnclV2PreprocessWithLineMap('(1) x = f(1, # c\n      2)\n(2) 表示する(x)');
        expect(source).toBe('x = f(1, 2) # c\n表示する(x)');
        expect(lineMap).toEqual([1, 3]);
    });

    test('the Ruby keeps the second argument and the comment', () => {
        const { ruby } = dnclToRuby(dnclV2Preprocess('(1) 表示する(1, # c\n      2)'));
        expect(ruby).toContain('# c');
        expect(ruby).not.toMatch(/# c.*2/);
        expect(ruby).toMatch(/1.*2/);
    });
});
