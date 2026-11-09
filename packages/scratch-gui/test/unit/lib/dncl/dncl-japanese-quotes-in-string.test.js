// 「」 written inside a `"..."` string literal (Issue #1457)
//
// DNCL lets a string be written as `「...」`, which becomes `"..."` in Ruby.
// A Japanese sentence in a `"..."` string often contains 「」 too, so that
// conversion must skip string literals — otherwise `"「く」がある"` became
// `""@く"がある"` and the program could not be turned into blocks.

import { loadPrism } from '../../../../src/lib/prism-parser';
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';

const dToR = (src) => dnclToRuby(src).ruby;
const rToD = (src) => rubyToDncl(src).dncl;

describe('DNCL: 「」 inside a "..." string (Issue #1457)', () => {
    let prism;

    beforeAll(async () => {
        prism = await loadPrism();
    });

    const parseErrors = (ruby) => prism.parse(ruby).errors;

    test('表示する("「く」がある") keeps the 「」 as they are', () => {
        const ruby = dToR('表示する("「く」がある")');
        expect(ruby).toBe('puts("「く」がある")');
        expect(parseErrors(ruby)).toEqual([]);
        expect(rToD(ruby)).toBe('表示する("「く」がある")');
    });

    test('namae + "には「く」がある" keeps the 「」 as they are', () => {
        const ruby = dToR('表示する(namae + "には「く」がある")');
        expect(ruby).toBe('puts(@namae + "には「く」がある")');
        expect(parseErrors(ruby)).toEqual([]);
        expect(rToD(ruby)).toBe('表示する(namae + "には「く」がある")');
    });

    test('an assignment of a "..." string with 「」 round-trips', () => {
        const ruby = dToR('a = "「く」と「け」"');
        expect(ruby).toBe('@a = "「く」と「け」"');
        expect(rToD(ruby)).toBe('a = "「く」と「け」"');
    });

    test('a single-quoted string with 「」 is left alone', () => {
        expect(dToR("a = '「く」'")).toBe("@a = '「く」'");
    });

    test('「」 inside a "..." string in a condition is left alone', () => {
        expect(dToR('もし a == "「く」" ならば\n  a = 1\nを実行する')).toBe(
            'if @a == "「く」"\n  @a = 1\nend',
        );
    });

    test('a string written with 「」 still becomes "..."', () => {
        expect(dToR('表示する(「こんにちは」)')).toBe('puts("こんにちは")');
        expect(dToR('a = 「く」 + "「け」"')).toBe('@a = "く" + "「け」"');
        expect(dToR('もし a == 「く」 ならば\n  a = 1\nを実行する')).toBe(
            'if @a == "く"\n  @a = 1\nend',
        );
    });
});
