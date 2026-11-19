// === Smalruby: Lock-in tests for the Block ↔ Ruby ↔ DNCL "display" matrix ===
//
// Issue #650: codify the unidirectional design for `表示する` / `puts` / `say`.
//
// Block ↔ Ruby ↔ DNCL の変換マトリクス (本テストで検証する設計):
//
//   方向                                     出力
//   ─────────────────────────────────────────────────────────────────
//   Block say(args, n)            → Ruby   say(args, n)        (現状通り)
//   Block say(args, n)            → DNCL   表示する(args)       (秒数 n は無視)
//   DNCL  表示する(args)          → Ruby   console.puts(args)  (不可逆: say / puts には戻さない)
//   DNCL  表示する(args)          → Block  smalrubyConsole_print (コンソールの拡張機能)
//
// 不可逆性 (重要):
//   DNCL `表示する` は、コンソールへの出力（コンソールの拡張機能のブロック。
//   Ruby では `console.puts`）になる (`say` にも `puts` にも戻さない。#1758、
//   docs/dncl/design.md の 5 章)。`say` は Scratch の吹き出し演出 (秒数指定) を
//   含むため、日本語の「表示」とは異なる。Ruby の `puts` / `say`（コンソールの前の
//   日本語のプログラムと、ルビータブのプログラム）は、`表示する` として読む。
//
// 秒数の扱い:
//   DNCL では秒数を表現しない。Block ↔ Ruby は秒数を保持するが、
//   DNCL を経由すると秒数情報は失われる (1 秒のデフォルトに戻る)。
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';

beforeAll(() => loadPrism());

const dToR = (src) => dnclToRuby(src).ruby;
const rToD = (src) => rubyToDncl(src).dncl;

describe('Display matrix: Ruby say(...) → DNCL 表示する (秒数無視)', () => {
    test('say(@a, 1) → 表示する(a)', () => {
        expect(rToD('say(@a, 1)')).toBe('表示する(a)');
    });

    test('say(@a, 2) → 表示する(a) (秒数 2 は無視)', () => {
        expect(rToD('say(@a, 2)')).toBe('表示する(a)');
    });

    test('say(@a, 0.5) → 表示する(a) (小数の秒数も無視)', () => {
        expect(rToD('say(@a, 0.5)')).toBe('表示する(a)');
    });

    test('say(@変数 + "バナナ", 2) → 表示する(変数 + "バナナ")', () => {
        // The reported bug case: var + string concat with secs=2.
        // The Ruby side keeps the `+` chain because operands are not all
        // string-literal-or-.to_s, so flattening doesn't apply.
        expect(rToD('say(@変数 + "バナナ", 2)')).toBe('表示する(変数 + "バナナ")');
    });

    test('say(arg.to_s + "x" + arg2.to_s, 3) → 表示する(arg, "x", arg2)', () => {
        // All operands are display fragments (.to_s or string literal),
        // so flatten + unwrap applies.
        expect(rToD('say(@a.to_s + "x" + @b.to_s, 3)')).toBe('表示する(a, "x", b)');
    });
});

describe('Display matrix: DNCL 表示する → Ruby console.puts (不可逆)', () => {
    test('表示する(a) → console.puts(@a) (NOT say(...))', () => {
        const ruby = dToR('表示する(a)');
        expect(ruby).toBe('console.puts(@a)');
        expect(ruby).not.toMatch(/^say\(/);
    });

    test('表示する("hello") → console.puts("hello")', () => {
        expect(dToR('表示する("hello")')).toBe('console.puts("hello")');
    });

    test('表示する(a, "は", b) → console.puts(@a.to_s + "は" + @b.to_s)', () => {
        expect(dToR('表示する(a, "は", b)')).toBe('console.puts(@a.to_s + "は" + @b.to_s)');
    });
});

describe('Display matrix: full round-trip (intentionally lossy)', () => {
    // DNCL → Ruby → DNCL: stable (puts round-trips back to 表示する)
    test('DNCL 表示する(a) → Ruby → DNCL stable as 表示する(a)', () => {
        const dncl1 = '表示する(a)';
        const ruby = dToR(dncl1);
        const dncl2 = rToD(ruby);
        expect(dncl2).toBe('表示する(a)');
    });

    // Ruby say → DNCL → Ruby: 不可逆! say(2) becomes console.puts (秒数喪失)
    test('Ruby say(@a, 2) → DNCL → Ruby — 不可逆: console.puts(@a) (秒数喪失)', () => {
        const ruby1 = 'say(@a, 2)';
        const dncl = rToD(ruby1);
        expect(dncl).toBe('表示する(a)');
        const ruby2 = dToR(dncl);
        // 不可逆: say には戻らず console.puts、秒数 2 も失われる
        expect(ruby2).toBe('console.puts(@a)');
        expect(ruby2).not.toBe(ruby1);
    });

    // Ruby puts → DNCL → Ruby: 不可逆! puts becomes console.puts (the console)
    test('Ruby puts(@a) → DNCL → Ruby — 不可逆: console.puts(@a)', () => {
        const dncl = rToD('puts(@a)');
        expect(dncl).toBe('表示する(a)');
        expect(dToR(dncl)).toBe('console.puts(@a)');
    });

    // Ruby console.puts → DNCL → Ruby: stable
    test('Ruby console.puts(@a) → DNCL → Ruby stable as console.puts(@a)', () => {
        const ruby1 = 'console.puts(@a)';
        expect(rToD(ruby1)).toBe('表示する(a)');
        expect(dToR(rToD(ruby1))).toBe(ruby1);
    });
});
