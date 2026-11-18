/**
 * Ruby that has no form in the Japanese mode and is not a command or a number
 * (`case` / `when`, a hash, a symbol, a modifier `unless`) was kept as Ruby by
 * Ruby → Japanese with no error, so the Japanese mode then told `@` or `{`
 * errors that made no sense (issue #1740). It is told on its Ruby line as Ruby
 * the Japanese mode cannot write, by its keyword or its text.
 */
import { dnclToRuby } from '../../../../src/lib/dncl/dncl-to-ruby';
import { UNSUPPORTED_NOTATION_ERROR_ID } from '../../../../src/lib/dncl/dncl-validator';
import { rubyToDncl } from '../../../../src/lib/dncl/ruby-to-dncl';
import { loadPrism } from '../../../../src/lib/prism-parser';

beforeAll(() => loadPrism());

const lines = (...ls) => ls.join('\n');

const notationErrors = (ruby) =>
    rubyToDncl(ruby)
        .errors.filter((err) => err.id === UNSUPPORTED_NOTATION_ERROR_ID)
        .map(({ line, column, name, message }) => ({ line, column, name, message }));

const told = (line, column, name) => ({
    line,
    column,
    name,
    message: `「${name}」は日本語モードでは書けません。Ruby モードでは書けます。`,
});

describe('Ruby → DNCL: Ruby with no Japanese form (issue #1740)', () => {
    test('case / when is told at case', () => {
        expect(notationErrors(lines('case @x', 'when 1', '  puts(1)', 'end'))).toEqual([told(1, 1, 'case')]);
    });

    test('a hash and a symbol are told where they are', () => {
        expect(notationErrors(lines('@h = {}', 'puts(@h[:a])'))).toEqual([told(1, 6, '{}'), told(2, 9, ':a')]);
    });

    test('a modifier unless is told at unless', () => {
        expect(notationErrors('puts(1) unless @x')).toEqual([told(1, 9, 'unless')]);
    });

    test('a modifier if is told at if', () => {
        expect(notationErrors('puts(1) if @x')).toEqual([told(1, 9, 'if')]);
    });

    test('the ternary operator is told by its text', () => {
        expect(notationErrors('@a = @x ? 1 : 2')).toEqual([told(1, 6, '@x ? 1 : 2')]);
    });

    test('a long Ruby is named by its first 20 characters', () => {
        expect(notationErrors('@a = [1, 2, 3].sum + @abcdefghijklmnopqrstuvwxyz ? 1 : 2')).toEqual([
            told(1, 6, '[1, 2, 3].sum + @abc…'),
        ]);
    });

    test('Ruby the Japanese mode has is not told', () => {
        const ruby = lines('@x = 1', 'if @x > 0', '  puts(@x)', 'end');
        expect(rubyToDncl(ruby).errors).toEqual([]);
        expect(dnclToRuby(rubyToDncl(ruby).dncl).ruby).toBe(ruby);
    });
});
