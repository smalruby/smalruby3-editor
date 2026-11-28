// A method on an expression, with arguments or after another method (Issue #1699)
//
// Ruby → Japanese reads the Ruby syntax tree, so a method that is a built-in
// of the Japanese mode comes back as the built-in whatever its receiver is
// (a variable, an expression in parentheses, another call). A method with
// no Japanese form is not turned into a broken built-in (`四捨五入(x)(2)`,
// `s.要素数(upcase)`); it is an error on its line.
// The programs are made up for the tests.
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';

beforeAll(() => loadPrism());

const messages = (errors) => errors.map(({ line, message }) => ({ line, message }));

describe('Ruby → Japanese: a built-in on any receiver (Issue #1699)', () => {
    test.each([
        ['@b = (@s + @t).include?("a")', 'b = 含む(s + t, "a")'],
        ['@b = @s.include?("a")', 'b = 含む(s, "a")'],
        ['@b = @_array_Data_[1].include?("a")', 'b = 含む(Data[1], "a")'],
        ['@b = (@x * 2).round', 'b = 四捨五入(x * 2)'],
        ['@b = (@s + @t).length', 'b = 要素数(s + t)'],
    ])('%s', (ruby, japanese) => {
        const result = rubyToDncl(ruby);
        expect(result.errors).toEqual([]);
        expect(result.dncl).toBe(japanese);
    });

    test('the Japanese goes back to the same Ruby', () => {
        const ruby = '@b = (@s + @t).include?("a")';
        expect(dnclToRuby(rubyToDncl(ruby).dncl).ruby).toBe(ruby);
    });
});

describe('Ruby → Japanese: a method with no Japanese form is an error (Issue #1699)', () => {
    test.each([
        ['@b = @x.round(2)', '「round」は日本語タブでは書けない命令です。ルビータブでは書けます。'],
        ['@b = @s.upcase.length', '「upcase」は日本語タブでは書けない命令です。ルビータブでは書けます。'],
    ])('%s', (ruby, message) => {
        const result = rubyToDncl(ruby);
        expect(messages(result.errors)).toEqual([{ line: 1, message }]);
        expect(result.dncl).not.toMatch(/四捨五入\(x\)\(|\.要素数\(/);
    });
});
