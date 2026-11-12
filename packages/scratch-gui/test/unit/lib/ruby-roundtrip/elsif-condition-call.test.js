/**
 * A call of a method that returns a value in the condition of `elsif` (issue #1615).
 * The blocks call the method in the `else` before the `if`, and the generator puts them back into
 * `elsif`.
 */
import dedent from 'dedent';
import RubyGenerator from '../../../../src/lib/ruby-generator';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

const BAR = dedent`
    def self.bar(a)
      return a
    end
`;

describe('Ruby Roundtrip: a call in the condition of elsif (issue #1615)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    const roundTrip = (code) => expectRoundTrip(converter, target, `${BAR}\n\n${code}`);

    test.each([
        [
            'elsif',
            dedent`
                if bar(1) == 1
                  move(10)
                elsif bar(2) == 2
                  move(5)
                end
            `,
        ],
        [
            'elsif only in elsif',
            dedent`
                if @x == 1
                  move(10)
                elsif bar(2) == 2
                  move(5)
                end
            `,
        ],
        [
            'two elsif',
            dedent`
                if bar(1) == 1
                  move(10)
                elsif bar(2) == 2
                  move(5)
                elsif bar(3) == 3
                  move(3)
                end
            `,
        ],
        [
            'elsif and else',
            dedent`
                if bar(1) == 1
                  move(10)
                elsif bar(2) == 2
                  move(5)
                else
                  move(1)
                end
            `,
        ],
        [
            'two calls in elsif',
            dedent`
                if bar(1) == 1
                  move(10)
                elsif bar(2) < bar(3)
                  move(5)
                end
            `,
        ],
        [
            'elsif with other calls',
            dedent`
                if @x == 1
                  move(10)
                elsif bar(2) == 2
                  move(5)
                end
                say(bar(3))
                say(bar(4))
            `,
        ],
        [
            'a call in a call',
            dedent`
                if bar(1) == 1
                  move(10)
                elsif bar(bar(2)) == 2
                  move(5)
                end
            `,
        ],
        [
            'elsif in else of elsif',
            dedent`
                if bar(1) == 1
                  move(10)
                elsif bar(2) == 2
                  if bar(3) == 3
                    move(3)
                  elsif bar(4) == 4
                    move(4)
                  end
                else
                  move(1)
                end
            `,
        ],
        [
            'unless',
            dedent`
                unless bar(1) == 1
                  move(10)
                else
                  move(5)
                end
            `,
        ],
        [
            'nested if in else is kept',
            dedent`
                if bar(1) == 1
                  move(10)
                else
                  x = bar(2)
                  if x == 2
                    move(5)
                  end
                end
            `,
        ],
        [
            'if in else',
            dedent`
                if bar(1) == 1
                  move(10)
                else
                  if bar(2) == 2
                    move(5)
                  end
                end
            `,
        ],
    ])('%s', async (_name, code) => {
        await roundTrip(code);
    });

    // A block put after the `if` of `elsif` in the blocks is kept, with or without a call.
    test.each([
        ['without a call', 'if @x == 1\n  move(10)\nelsif @x == 2\n  move(5)\nend'],
        ['with a call', 'if @x == 1\n  move(10)\nelsif bar(2) == 2\n  move(5)\nend'],
    ])('a block after the if of elsif is kept (%s)', async (_name, code) => {
        expect(await converter.targetCodeToBlocks(target, `${BAR}\n\n${code}`)).toBeTruthy();
        await converter.applyTargetBlocks(target);
        const blocks = target.blocks._blocks;
        const elsifIf = Object.values(blocks).find(
            (b) =>
                b.opcode === 'control_if' && b.comment && /@ruby:syntax:elsif/.test(target.comments[b.comment].text),
        );
        const move = Object.values(blocks).find((b) => b.opcode === 'motion_movesteps' && b.parent === elsifIf.id);
        const moved = { ...move, id: 'after-elsif', parent: elsifIf.id, next: null, comment: null };
        moved.inputs = { STEPS: { ...move.inputs.STEPS } };
        blocks[moved.id] = moved;
        elsifIf.next = moved.id;
        RubyGenerator.currentTarget = target;
        const ruby = RubyGenerator.targetToCode(target).trim();
        expect(ruby).toContain('else\n  if ');
        expect(ruby.match(/move\(5\)/g)).toHaveLength(2);
    });

    test('in a method', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.bar(a)
                  return a
                end

                def self.foo(n)
                  if bar(n) == 1
                    move(10)
                  elsif bar(n) == 2
                    move(5)
                  end
                end
            `,
        );
    });
});
