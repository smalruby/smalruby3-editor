/**
 * Round trips of a method's return value that used to change or drop the written Ruby (issue #1553):
 * - `return` without a value came back as `return ""`;
 * - a value no block can hold (`self`, an array, a hash, a constant, a regular expression, a string with
 *   `#{...}`) was dropped from `return ...` or from the last line without an error;
 * - `return "a", "b"` came back as `return "a"`.
 * The first one comes back as written; the others are errors that tell which line to change.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: return without a value', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('return alone', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo
                  return
                end
            `,
        );
    });

    test('return alone in an if', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo(a)
                  if a
                    return
                  end
                  move(10)
                end
            `,
        );
    });

    test('return alone, used as a value', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo
                  return
                end

                say(foo)
            `,
        );
    });

    test('return "" stays return ""', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo
                  return ""
                end
            `,
        );
    });

    test('return nil stays return nil', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo
                  return nil
                end
            `,
        );
    });

    test('the return block holds the text "" for a value used in blocks', async () => {
        await converter.targetCodeToBlocks(target, 'def self.foo\n  return\nend\n');
        const returnBlock = Object.values(converter._context.blocks).find(b => {
            const comment = b.comment && converter._context.comments[b.comment];
            return b.opcode === 'data_setvariableto' && comment && comment.text.includes('@ruby:syntax:return');
        });
        const input = converter._context.blocks[returnBlock.inputs.VALUE.block];
        expect(input.opcode).toBe('text');
        expect(input.fields.TEXT.value).toBe('');
    });
});

describe('Ruby to blocks: a return value that no block can hold', () => {
    const convert = async code => {
        const { target, runtime } = makeSpriteTarget();
        const converter = makeConverter(target, runtime, { version: 2 });
        const result = await converter.targetCodeToBlocks(target, code);
        return { result, errors: converter.errors };
    };

    describe.each([
        ['self', 'self'],
        ['an array', '[1, 2]'],
        ['a hash', '{a: 1}'],
        ['a constant', 'Foo'],
        ['a regular expression', '/a/'],
        ['a string with #{...}', '"#{1}a"'],
    ])('%s', (_name, value) => {
        test('return <value> is an error on its line', async () => {
            const { result, errors } = await convert(`def self.foo\n  move(10)\n  return ${value}\nend\n`);
            expect(result).toBe(false);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toBe(2);
            expect(errors[0].text).toContain(`"${value}" cannot be returned from a method`);
            expect(errors[0].text).toMatch(/Return a number, a string, true \/ false, or a variable instead/);
        });

        test('<value> on the last line is an error on its line', async () => {
            const { result, errors } = await convert(`def self.foo\n  move(10)\n  ${value}\nend\n`);
            expect(result).toBe(false);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toBe(2);
            expect(errors[0].text).toContain(`"${value}" cannot be returned from a method`);
        });

        test('<value> before the last line is an error on its line', async () => {
            const { result, errors } = await convert(`def self.foo\n  move(1)\n  ${value}\n  move(10)\nend\n`);
            expect(result).toBe(false);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toBe(2);
            expect(errors[0].text).toContain(`"${value}" is not a command`);
        });
    });

    test('return with a command as its value is an error', async () => {
        const { result, errors } = await convert('def self.foo\n  return x = 1\nend\n');
        expect(result).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(1);
        expect(errors[0].text).toContain('"x = 1" cannot be returned from a method');
    });

    test('return with two values is an error that shows how to return one', async () => {
        const { result, errors } = await convert('def self.foo\n  return "a", "b"\nend\n');
        expect(result).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(1);
        expect(errors[0].text).toContain('"return "a", "b"" returns more than one value');
        expect(errors[0].text).toContain('(e.g. return "a")');
    });
});
