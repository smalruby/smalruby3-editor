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
        test('the length of the list is still the list (issue #1613)', async () => {
            const { target, runtime } = makeSpriteTarget();
            target.variables.v1 = new Variable('v1', 'score', Variable.SCALAR_TYPE);
            target.variables.l1 = new Variable('l1', 'score', Variable.LIST_TYPE);
            setupRubyGenerator();
            const converter = makeConverter(target, runtime, { version: '2' });
            await expectRoundTrip(converter, target, '@score = 0\nsay(@score.length)');
            const opcodes = Object.values(target.blocks._blocks).map((b) => b.opcode);
            expect(opcodes).toContain('data_lengthoflist');
            expect(opcodes).not.toContain('operator_length');
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

    describe('a string method does not depend on the order of the code (issue #1613)', () => {
        // Whether `@a` holds a string or a list is decided from the whole code before converting,
        // so a read before the assignment, `gets`, or a number set last still reads the variable.
        let target, runtime, converter;

        beforeEach(() => {
            ({ target, runtime } = makeSpriteTarget());
            setupRubyGenerator();
            converter = makeConverter(target, runtime, { version: '2' });
        });

        test.each([
            ['@a = gets', '@a = gets\nsay(@a.length)'],
            ['a local set to gets', 'text = gets\nsay(text.length)'],
            ['read in a method before the assignment', 'def f\n  say(@a.length)\nend\n\n@a = "abc"\nf'],
            ['@a[0] in a method before the assignment', 'def f\n  say(@a[0])\nend\n\n@a = "abc"\nf'],
            ['@a.include? in a method before the assignment', 'def f\n  say(@a.include?("b"))\nend\n\n@a = "abc"\nf'],
            [
                '@a.empty? in a method before the assignment',
                'def f\n  if @a.empty?\n    say("empty")\n  end\nend\n\n@a = "abc"\nf',
            ],
            [
                'a number set in the last branch',
                dedent`
                    if @x == 1
                      @a = "abc"
                    else
                      @a = 1
                    end
                    say(@a.length)
                `,
            ],
            ['a number set after a string', '@a = "abc"\n@a = 3\nsay(@a.length)'],
            ['read in an event before the assignment', 'when_flag_clicked do\n  say(@a.length)\nend\n\n@a = "abc"'],
        ])('%s', async (_name, code) => {
            await expectRoundTrip(converter, target, code);
            expect(Object.values(target.variables).filter((v) => v.type === 'list')).toEqual([]);
        });

        test('a list method still makes the name a list', async () => {
            await expectRoundTrip(converter, target, 'def f\n  say(@a.length)\nend\n\n@a.push(1)\nf');
            expect(Object.values(target.variables).filter((v) => v.type === 'list')).toHaveLength(1);
        });

        test('a list method of a name that is also set to a string is still an error that shows the line of the list method', async () => {
            const { result, errors } = await convert('def f\n  say(@a.length)\nend\n\n@a = "abc"\n@a.push(1)');
            expect(result).toBe(false);
            expect(errors[0].text).toContain('"@a" is used as a list on line 6 and as a variable on line 5.');
        });

        test.each([
            ['read in a method', 'def f\n  say(@a.length)\nend\n\n@a = "abc"\nf'],
            ['read in an event', 'when_flag_clicked do\n  say(@a.length)\nend\n\n@a = "abc"'],
        ])('with a list that the sprite already has, %s before the assignment', async (_name, code) => {
            await expectRoundTrip(converter, target, '@a = []\n@a.push(1)');
            const second = makeConverter(target, runtime, { version: '2' });
            await expectRoundTrip(second, target, code);
            expect(
                Object.values(target.variables)
                    .filter((v) => v.name === 'a')
                    .map((v) => v.type)
                    .sort(),
            ).toEqual(['', 'list']);
        });
    });
    describe('a method of both String and Array that has no string block (issue #1629)', () => {
        // `index` is a method of String too, but Scratch has no block for the position of a text
        // in a string. A name used only as a string is not a list, so the error says so.
        const stringIndexError =
            'A string (text) has no block for "index".\nUse it on a list, or write it with other blocks.';

        test.each([
            ['@a = gets', '@a = gets\nsay(@a.index("x"))', 2],
            ['@a = "abc"', '@a = "abc"\nsay(@a.index("x"))', 2],
            ['$a = gets', '$a = gets\nsay($a.index("x"))', 2],
            ['a local set to gets', 'text = gets\nsay(text.index("x"))', 2],
            ['read in a method before the assignment', 'def f\n  say(@a.index("x"))\nend\n\n@a = gets\nf', 2],
            ['a number set after a string', '@a = "abc"\n@a = 3\nsay(@a.index("x"))', 3],
        ])('%s is an error that does not say list', async (_name, code, line) => {
            const { result, errors } = await convert(code);
            expect(result).toBe(false);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toBe(line - 1);
            expect(errors[0].text).toBe(stringIndexError);
        });

        describe('a list still uses the list block', () => {
            let target, runtime, converter;

            beforeEach(() => {
                ({ target, runtime } = makeSpriteTarget());
                setupRubyGenerator();
                converter = makeConverter(target, runtime, { version: '2' });
            });

            test.each([
                ['@a = []', '@a = []\n@a.push("x")\n@b = @a.index("x")'],
                ['a list method only', '@a.push("x")\n@b = @a.index("x")'],
                ['read in a method before the list is made', 'def f\n  @b = @a.index("x")\nend\n\n@a = []\nf'],
            ])('%s', async (_name, code) => {
                // The generator writes `(...)` around the `index` of a list, as on develop.
                await expectRoundTrip(converter, target, code, code.replace('@a.index("x")', '(@a.index("x"))'));
                expect(Object.values(target.variables).filter((v) => v.type === 'list')).toHaveLength(1);
            });

            test('a variable and a list of the same name that the project already has', async () => {
                target.variables.v1 = new Variable('v1', 'score', Variable.SCALAR_TYPE);
                target.variables.l1 = new Variable('l1', 'score', Variable.LIST_TYPE);
                await expectRoundTrip(
                    converter,
                    target,
                    '@score = 0\n@b = @score.index("x")',
                    '@score = 0\n@b = (@score.index("x"))',
                );
                const opcodes = Object.values(target.blocks._blocks).map((b) => b.opcode);
                expect(opcodes).toContain('data_itemnumoflist');
            });
        });
    });
});
