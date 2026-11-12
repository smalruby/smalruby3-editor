// === Smalruby: This file is Smalruby-specific (a name used as both a variable and a list, issue #1593) ===
/**
 * Scratch can have a variable and a list of the same name in a sprite, but Ruby has one `@a`.
 * Ruby code that uses one name as both (e.g. `@a = 0` then `@a = []`) cannot become blocks, so
 * converting it is an error that tells the lines, instead of the script silently disappearing.
 * Only reading a list (`@a = []` then `say(@a)`) is not such a use (issue #1567).
 */
import Variable from '@smalruby/scratch-vm/src/engine/variable';
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

    describe('a variable and a list of the same name that the project already has', () => {
        // Scratch can have both, and the Ruby of such a project uses one name for both.
        test.each([
            ['on the stage', true, '$score = 0\n$score.push(1)'],
            ['in the sprite', false, '@score = 0\n@score.push(1)'],
        ])('%s still converts', async (_name, onStage, code) => {
            const { target, stage, runtime } = makeSpriteTarget();
            const owner = onStage ? stage : target;
            owner.variables.v1 = new Variable('v1', 'score', Variable.SCALAR_TYPE);
            owner.variables.l1 = new Variable('l1', 'score', Variable.LIST_TYPE);
            setupRubyGenerator();
            const converter = makeConverter(target, runtime, { version: '2' });
            await expectRoundTrip(converter, target, code);
        });
    });

    describe('a list that the sprite already has and this code does not use as a list (issue #1612)', () => {
        // The list stays in the project after the code that made it is rewritten (the VM does not
        // delete unused variables), so the code is converted again with the list still there.
        const convertTwice = async (first, second, expected = second) => {
            const { target, stage, runtime } = makeSpriteTarget();
            setupRubyGenerator();
            await expectRoundTrip(makeConverter(target, runtime, { version: '2' }), target, first);
            await expectRoundTrip(makeConverter(target, runtime, { version: '2' }), target, second, expected);
            return { target, stage, runtime };
        };
        const scalarsAndLists = (owner, name) =>
            Object.values(owner.variables)
                .filter((v) => v.name === name)
                .map((v) => v.type)
                .sort();

        test.each([
            ['@a = 0, say(@a)', '@a = []\n@a.push(1)', '@a = 0\nsay(@a)', false],
            ['$a = 0, say($a)', '$a = []\n$a.push(1)', '$a = 0\nsay($a)', true],
            ['@a = "abc", say(@a.length)', '@a = []\n@a.push(1)', '@a = "abc"\nsay(@a.length)', false],
            ['$a = "abc", say($a.length)', '$a = []\n$a.push(1)', '$a = "abc"\nsay($a.length)', true],
            ['@a += 1', '@a = []\n@a.push(1)', '@a = 0\n@a += 1\nsay(@a)', false],
        ])('%s does not lose the script', async (_name, first, second, onStage) => {
            const { target, stage } = await convertTwice(first, second);
            // Scratch keeps both: the list from before, and the variable that this code uses.
            expect(scalarsAndLists(onStage ? stage : target, 'a')).toEqual(['', 'list']);
        });

        test('converting the same code again keeps the script', async () => {
            const { target, runtime } = await convertTwice('@a = []\n@a.push(1)', '@a = "abc"\nsay(@a.length)');
            const converter = makeConverter(target, runtime, { version: '2' });
            await expectRoundTrip(converter, target, '@a = "abc"\nsay(@a.length)');
        });

        test('reading the list that the sprite has still reads the list (issue #1567)', async () => {
            await convertTwice('@a = []\n@a.push(1)', 'say(@a)');
        });

        test('using it as a list again still works', async () => {
            await convertTwice('@a = []\n@a.push(1)', '@a.push(2)\nsay(@a)');
        });

        test('a list method of a variable that has a list of the same name is still an error', async () => {
            const { target, runtime } = makeSpriteTarget();
            setupRubyGenerator();
            await expectRoundTrip(makeConverter(target, runtime, { version: '2' }), target, '@a = []\n@a.push(1)');
            const converter = makeConverter(target, runtime, { version: '2' });
            const result = await converter.targetCodeToBlocks(target, '@a = 0\n@a.push(1)');
            expect(result).toBe(false);
            expect(converter.errors[0].text).toContain(
                '"@a" is used as a list on line 2 and as a variable on line 1.',
            );
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
