// === Smalruby: This file is Smalruby-specific (a name used as both a variable and a list, issue #1593) ===
/**
 * Scratch can have a variable and a list of the same name in a sprite, but Ruby has one `@a`.
 * Ruby code that uses one name as both (e.g. `@a = 0` then `@a = []`) cannot become blocks, so
 * converting it is an error that tells the lines, instead of the script silently disappearing.
 * Only reading a list (`@a = []` then `say(@a)`) is not such a use (issue #1567).
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby to blocks: a name used as both a variable and a list (issue #1593)', () => {
    const convert = async (code) => {
        const { target, runtime } = makeSpriteTarget();
        const converter = makeConverter(target, runtime, { version: '2' });
        const result = await converter.targetCodeToBlocks(target, code);
        return { result, errors: converter.errors };
    };

    test.each([
        ['@a = 0, @a = [], say(@a)', '@a = 0\n@a = []\nsay(@a)', '@a', 2, 1],
        ['@a = [], @a = 0, say(@a)', '@a = []\n@a = 0\nsay(@a)', '@a', 1, 2],
        ['@a = 0, say(@a), @a.push(1)', '@a = 0\nsay(@a)\n@a.push(1)', '@a', 3, 1],
        ['$a = 0, $a = [], say($a)', '$a = 0\n$a = []\nsay($a)', '$a', 2, 1],
        ['$a = [], $a = 0, say($a)', '$a = []\n$a = 0\nsay($a)', '$a', 1, 2],
        ['a = 0, a = [], say(a)', 'a = 0\na = []\nsay(a)', 'a', 2, 1],
        ['a = [], a = 0, say(a)', 'a = []\na = 0\nsay(a)', 'a', 1, 2],
        ['@a = [], @a += 1', '@a = []\n@a += 1', '@a', 1, 2],
        ['in a method before the list is made', 'def f\n  @a = 1\nend\n\n@a = []\nf', '@a', 5, 2],
    ])('%s is an error', async (_name, code, name, listLine, variableLine) => {
        const { result, errors } = await convert(code);
        expect(result).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(variableLine - 1);
        expect(errors[0].text).toBe(
            `"${name}" is used as a list on line ${listLine} and as a variable on line ${variableLine}.\n` +
                'In Ruby, one name cannot be both a variable and a list. Rename one of them.',
        );
    });

    describe('reading a list is not an error (issue #1567)', () => {
        let target, runtime, converter;

        beforeEach(() => {
            ({ target, runtime } = makeSpriteTarget());
            setupRubyGenerator();
            converter = makeConverter(target, runtime, { version: '2' });
        });

        test.each([
            ['say(@a)', '@a = []\nsay(@a)'],
            ['say($a)', '$a = []\nsay($a)'],
            ['a local list', 'a = []\nsay(a)'],
            ['a list read in a method before the list is made', 'def f\n  say(@a)\nend\n\n@a = []\nf'],
            ['@b = @a', '@a = []\n@b = @a'],
            [
                'a list and another variable',
                dedent`
                    @a = []
                    @b = 0
                    @a.push(@b)
                    say(@a)
                `,
            ],
        ])('%s', async (_name, code) => {
            await expectRoundTrip(converter, target, code);
        });
    });

    describe('a string method of a string variable does not make a list of the same name', () => {
        let target, runtime, converter;

        beforeEach(() => {
            ({ target, runtime } = makeSpriteTarget());
            setupRubyGenerator();
            converter = makeConverter(target, runtime, { version: '2' });
        });

        test.each([
            ['@a.length', '@a = "abc"\nsay(@a.length)'],
            ['@a[0]', '@a = "abc"\nsay(@a[0])'],
            ['@a.include? in if', '@a = "abc"\nif @a.include?("b")\n  say("yes")\nend'],
            ['say(@a.include?)', '@a = "abc"\nsay(@a.include?("b"))'],
            ['@a.empty?', '@a = "abc"\nif @a.empty?\n  say("empty")\nend'],
            ['$a.length', '$a = "abc"\nsay($a.length)'],
            ['a local string', 'text = "abc"\nif text.empty?\n  say(text.length)\nend'],
        ])('%s', async (_name, code) => {
            await expectRoundTrip(converter, target, code);
            expect(Object.values(target.variables).filter((v) => v.type === 'list')).toEqual([]);
        });

        test('a list method of a string variable is still an error', async () => {
            const { result, errors } = await convert('@a = "abc"\n@a.push(1)');
            expect(result).toBe(false);
            expect(errors[0].text).toContain('"@a" is used as a list on line 2 and as a variable on line 1.');
        });
    });
});
