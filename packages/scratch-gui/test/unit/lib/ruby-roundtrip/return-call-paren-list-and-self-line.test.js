/**
 * Round trips that used to change the written Ruby:
 * - `return bar` (a method that returns a value) came back as `return b` (issue #1556);
 * - `return (x + 1)` came back as an empty method, and `return @a` (a list) as `return 0` (issue #1557);
 * - `self` written alone on a line in a block body or at the top level came back as `"self"` (issue #1558).
 * The calls and the parentheses come back as written; the others are errors that tell which line to change.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: return with a call of a method that returns a value (issue #1556)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: 2 });
    });

    test('return bar', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def bar
                  1
                end

                def foo
                  return bar
                end
            `,
        );
    });

    test('return bar(1)', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def bar(a)
                  a
                end

                def foo
                  return bar(1)
                end
            `,
        );
    });

    test('return hello + 1', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def hello
                  1
                end

                def foo
                  return hello + 1
                end
            `,
        );
    });

    test('return bar(1) + bar(2) keeps both calls', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def bar(a)
                  a
                end

                def foo
                  return bar(1) + bar(2)
                end
            `,
        );
    });

    test('return bar in an if', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def bar
                  1
                end

                def foo(a)
                  if a
                    return bar
                  end
                  move(10)
                end
            `,
        );
    });

    test('return with a call of the method itself', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def fact(n)
                  if n < 2
                    return 1
                  end
                  return fact(n - 1) * n
                end
            `,
        );
    });

    test('hello on the last line', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def hello
                  1
                end

                def foo
                  move(10)
                  hello
                end
            `,
        );
    });

    test('the method is called before the return block', async () => {
        await converter.targetCodeToBlocks(target, 'def bar\n  1\nend\n\ndef foo\n  return bar\nend\n');
        const blocks = converter._context.blocks;
        const returnBlock = Object.values(blocks).find(b => {
            const comment = b.comment && converter._context.comments[b.comment];
            return b.opcode === 'data_setvariableto' && comment && comment.text.includes('@ruby:syntax:return');
        });
        const call = blocks[returnBlock.parent];
        expect(call.opcode).toBe('procedures_call');
        const input = blocks[returnBlock.inputs.VALUE.block];
        expect(input.opcode).toBe('data_variable');
        expect(input.fields.VARIABLE.value).toBe('_return_bar_');
    });
});

describe('Ruby Roundtrip: return with parentheses (issue #1557)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime, { version: 2 });
    });

    test('return (x + 1)', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def foo(x)
                  return (x + 1)
                end
            `,
        );
    });

    test('return (1)', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def foo
                  return (1)
                end
            `,
        );
    });

    test('return (nil)', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def foo
                  return (nil)
                end
            `,
        );
    });

    test('return (bar)', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def bar
                  1
                end

                def foo
                  return (bar)
                end
            `,
        );
    });

    test('return x + 1 stays without parentheses', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def foo(x)
                  return x + 1
                end
            `,
        );
    });
});

describe('Ruby to blocks: return values that no block can hold (issues #1557, #1558)', () => {
    const convert = async code => {
        const { target, runtime } = makeSpriteTarget();
        const converter = makeConverter(target, runtime, { version: 2 });
        const result = await converter.targetCodeToBlocks(target, code);
        return { result, errors: converter.errors };
    };

    test('return with a call of a method that returns no value is an error', async () => {
        const { result, errors } = await convert('def self.bar\n  move(10)\nend\n\ndef self.foo\n  return bar\nend\n');
        expect(result).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(5);
        expect(errors[0].text).toContain('"bar" cannot be returned from a method');
    });

    test('a call of the method itself after another call in the line is an error', async () => {
        // The return value of fib(n - 1) is kept in a variable of the sprite, and fib(n - 2) would
        // overwrite it while it runs, so the blocks would not give the value of Ruby.
        const { result, errors } = await convert(
            'def fib(n)\n  if n < 2\n    return n\n  end\n  return fib(n - 1) + fib(n - 2)\nend\n',
        );
        expect(result).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(4);
        expect(errors[0].text).toContain('"fib(n - 2)" calls "fib" in "fib" after another method call');
    });

    test('a call of the method itself after a call of another method is an error', async () => {
        const { result, errors } = await convert(
            'def bar(a)\n  return a\nend\n\ndef baz\n  say(bar(1))\nend\n\n' +
                'def fib(n)\n  if n < 2\n    return n\n  end\n  return bar(1) + fib(n - 1)\nend\n',
        );
        expect(result).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].text).toContain('"fib(n - 1)" calls "fib" in "fib"');
    });

    test('return with more than one line in parentheses is an error', async () => {
        const { result, errors } = await convert('def self.foo\n  return (move(10); 1)\nend\n');
        expect(result).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(1);
        expect(errors[0].text).toContain('"(move(10); 1)" cannot be returned from a method');
    });

    test('return <a list> is an error on its line', async () => {
        const { result, errors } = await convert('@a = []\n\ndef self.foo\n  move(10)\n  return @a\nend\n');
        expect(result).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(4);
        expect(errors[0].text).toContain('"@a" is a list, so it cannot be returned from a method');
        expect(errors[0].text).toContain('@a[0]');
    });

    test('<a list> on the last line is an error on its line', async () => {
        const { result, errors } = await convert('@a = []\n\ndef self.foo\n  move(10)\n  @a\nend\n');
        expect(result).toBe(false);
        expect(errors).toHaveLength(1);
        expect(errors[0].row).toBe(4);
        expect(errors[0].text).toContain('"@a" is a list, so it cannot be returned from a method');
    });

    test('a list item can be returned', async () => {
        const { result } = await convert('@a = []\n\ndef self.foo\n  return @a[0]\nend\n');
        expect(result).toBe(true);
    });

    describe.each([
        ['self', 'self'],
        ['a hash', '{a: 1}'],
        ['a constant', 'Foo'],
        ['a regular expression', '/a/'],
        ['a string with #{...}', '"#{1}a"'],
    ])('%s written alone on a line', (_name, value) => {
        test('on the last line of a block body is an error', async () => {
            const { result, errors } = await convert(`when_flag_clicked do\n  move(10)\n  ${value}\nend\n`);
            expect(result).toBe(false);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toBe(2);
            expect(errors[0].text).toContain(`"${value}" is not a command`);
        });

        test('on the first line of a block body is an error', async () => {
            const { result, errors } = await convert(`when_flag_clicked do\n  ${value}\n  move(10)\nend\n`);
            expect(result).toBe(false);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toBe(1);
            expect(errors[0].text).toContain(`"${value}" is not a command`);
        });

        test('at the top level is an error', async () => {
            const { result, errors } = await convert(`move(10)\n${value}\n`);
            expect(result).toBe(false);
            expect(errors).toHaveLength(1);
            expect(errors[0].row).toBe(1);
            expect(errors[0].text).toContain(`"${value}" is not a command`);
        });
    });
});

describe('Ruby Roundtrip: an array written alone on a line stays (issue #1558)', () => {
    test.each([
        ['in a block body', 'when_flag_clicked do\n  move(10)\n  [1]\nend'],
        ['at the top level', '[1]'],
    ])('%s', async (_name, code) => {
        const { target, runtime } = makeSpriteTarget();
        setupRubyGenerator();
        const converter = makeConverter(target, runtime, { version: 2 });
        await expectRoundTrip(converter, target, code);
    });
});
