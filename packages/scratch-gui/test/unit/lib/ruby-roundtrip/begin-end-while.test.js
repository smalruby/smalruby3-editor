/**
 * `begin ... end while cond` / `begin ... end until cond` run the body once before the condition is
 * checked (issue #1610). The blocks put the body once before the loop and then repeat it, so they
 * run as in Ruby; the body before the loop is not written back to Ruby.
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

describe('Ruby Roundtrip: begin ... end while / until (issue #1610)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    const blocksOf = () => converter._context.blocks;
    const commentOf = (block) => {
        const comment = block && block.comment && converter._context.comments[block.comment];
        return comment ? comment.text : '';
    };
    const chain = (firstId) => {
        const result = [];
        let block = blocksOf()[firstId];
        while (block) {
            result.push(block);
            block = blocksOf()[block.next];
        }
        return result;
    };
    const loopBlock = () => Object.values(blocksOf()).find((b) => b.opcode === 'control_repeat_until');
    const topChain = () => {
        const top = Object.values(blocksOf()).find(
            (b) => b.topLevel && !b.parent && b.opcode !== 'procedures_definition',
        );
        return chain(top.id);
    };
    const generate = () => {
        RubyGenerator.currentTarget = target;
        return RubyGenerator.targetToCode(target, {}).trim();
    };

    describe.each([
        ['while a < 3', 'a = a + 1'],
        ['until a >= 3', 'a = a + 1'],
        ['while a < 3', 'a = a + 1\n  move(10)'],
        ['while bar(a) < 3', 'a = a + 1'],
        ['until bar(a) == 3', 'a = a + 1'],
        ['while a < 3', 'x = bar(a)\n  a = a + 1'],
        ['until bar(a) == 3 || bar(a) == 5', 'a = a + 1'],
        ['while a < 3', '# a comment\n  move(10)'],
    ])('begin ... end %s', (condition, body) => {
        const code = `a = 0\nbegin\n  ${body}\nend ${condition}`;

        test('comes back as written', async () => {
            await expectRoundTrip(converter, target, `${BAR}\n\n${code}`);
        });

        test('the body is put once before the loop, with the same blocks as the body of the loop', async () => {
            await expectRoundTrip(converter, target, `${BAR}\n\n${code}`);
            const loop = loopBlock();
            expect(loop).toBeTruthy();
            const top = topChain();
            const copy = top.filter((b) => commentOf(b).includes('@ruby:begin_loop_body'));
            const loopBody = chain(loop.inputs.SUBSTACK.block).filter(
                (b) => !commentOf(b).includes('@ruby:loop_condition_call'),
            );
            expect(copy.map((b) => b.opcode)).toEqual(loopBody.map((b) => b.opcode));
            // The copy comes after `a = 0` and before the loop.
            expect(top.indexOf(copy[0])).toBe(1);
            expect(top.indexOf(copy[copy.length - 1])).toBeLessThan(top.indexOf(loop));
        });
    });

    test('a plain while is not changed', async () => {
        await expectRoundTrip(converter, target, 'a = 0\nwhile a < 3\n  a = a + 1\nend');
        expect(Object.values(blocksOf()).some((b) => commentOf(b).includes('@ruby:begin_loop_body'))).toBe(false);
    });

    test('in a method', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                def self.foo
                  a = 0
                  begin
                    a = a + 1
                  end while a < 3
                end
            `,
        );
    });

    test('in a loop', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                a = 0
                while a < 10
                  begin
                    a = a + 1
                  end while a < 3
                end
            `,
        );
    });

    test('a begin ... end while in the body of begin ... end while', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
                a = 0
                begin
                  begin
                    a = a + 1
                  end while a < 3
                  a = a + 2
                end while a < 10
            `,
        );
    });

    test('a body that ends with wait', async () => {
        await expectRoundTrip(converter, target, 'a = 0\nbegin\n  a = a + 1\n  wait\nend while a < 3');
    });

    test('lines after the loop are kept', async () => {
        await expectRoundTrip(converter, target, 'a = 0\nbegin\n  a = a + 1\nend while a < 3\nmove(10)');
    });

    test('when the body before the loop is changed on the blocks screen, it is written before a while', async () => {
        await expectRoundTrip(converter, target, 'a = 0\nbegin\n  move(10)\nend while a < 3');
        const copy = topChain().find((b) => commentOf(b).includes('@ruby:begin_loop_body'));
        const steps = target.blocks._blocks[copy.inputs.STEPS.block];
        steps.fields.NUM.value = '20';
        expect(generate()).toBe('a = 0\nmove(20)\nwhile a < 3\n  move(10)\nend');
    });

    test('when the body of the loop is changed on the blocks screen, the body before it is written', async () => {
        await expectRoundTrip(converter, target, 'a = 0\nbegin\n  move(10)\nend until a >= 3');
        const loop = Object.values(target.blocks._blocks).find((b) => b.opcode === 'control_repeat_until');
        const inLoop = target.blocks._blocks[loop.inputs.SUBSTACK.block];
        target.blocks._blocks[inLoop.inputs.STEPS.block].fields.NUM.value = '5';
        expect(generate()).toBe('a = 0\nmove(10)\nuntil a >= 3\n  move(5)\nend');
    });

    test('when the body before the loop is removed on the blocks screen, the loop is a plain while', async () => {
        await expectRoundTrip(converter, target, 'a = 0\nbegin\n  move(10)\nend while a < 3');
        const blocks = target.blocks._blocks;
        const copy = Object.values(blocks).find((b) => commentOf(b).includes('@ruby:begin_loop_body'));
        const before = blocks[copy.parent];
        const after = blocks[copy.next];
        before.next = after.id;
        after.parent = before.id;
        delete blocks[copy.inputs.STEPS.block];
        delete blocks[copy.id];
        expect(generate()).toBe('a = 0\nwhile a < 3\n  move(10)\nend');
    });

    test.each([
        ['a = a + 1'],
        ['b = 1\n  a = a + b'],
        ['x = bar(a)\n  a = a + 1'],
        ['s = "x"\n  s += "y"\n  a += 1'],
    ])('when a block is put before the loop, the body before it keeps its local variables: %s', async (body) => {
        await expectRoundTrip(converter, target, `${BAR}\n\na = 0\nbegin\n  ${body}\nend while a < 3`);
        const blocks = target.blocks._blocks;
        const loop = Object.values(blocks).find((b) => b.opcode === 'control_repeat_until');
        const before = blocks[loop.parent];
        blocks.turn = {
            id: 'turn',
            opcode: 'motion_turnright',
            inputs: {},
            fields: {},
            next: loop.id,
            parent: before.id,
            topLevel: false,
            shadow: false,
        };
        before.next = 'turn';
        loop.parent = 'turn';
        const copy = body.replace(/\n {2}/g, '\n');
        expect(generate()).toBe(`${BAR}\n\na = 0\n${copy}\nturn_right(0)\nwhile a < 3\n  ${body}\nend`);
    });

    test('when the variable of the body before the loop is changed to another one of the same name', async () => {
        await expectRoundTrip(converter, target, '$v = 0\na = 0\nbegin\n  $v = 1\nend while a < 3');
        target.createVariable('sprite-v', 'v', '');
        const copy = topChain().find((b) => commentOf(b).includes('@ruby:begin_loop_body'));
        target.blocks._blocks[copy.id].fields.VARIABLE.id = 'sprite-v';
        expect(generate()).toBe('$v = 0\na = 0\n@v = 1\nwhile a < 3\n  $v = 1\nend');
    });

    test('a body that ends with return is an error', async () => {
        const code = 'def self.foo\n  a = 0\n  begin\n    return 1\n  end while a < 3\nend';
        expect(await converter.targetCodeToBlocks(target, code)).toBe(false);
        expect(converter.errors).toHaveLength(1);
        expect(converter.errors[0].text).toContain('end while a < 3');
    });

    test('a condition that is only a variable', async () => {
        await expectRoundTrip(converter, target, '@x = true\nbegin\n  move(10)\nend while @x');
    });

    test('a body that never ends is an error on the line of the condition', async () => {
        const code = 'a = 0\nbegin\n  loop do\n    move(10)\n  end\nend while a < 3';
        expect(await converter.targetCodeToBlocks(target, code)).toBe(false);
        expect(converter.errors).toHaveLength(1);
        expect(converter.errors[0].row).toBe(5);
        expect(converter.errors[0].text).toContain('end while a < 3');
        expect(converter.errors[0].text).toContain('begin ... end');
    });

    test('a call in the condition in a class (version 2)', async () => {
        converter = makeConverter(target, runtime, { version: 2 });
        target.sprite = { name: 'Sprite1' };
        runtime.targets = [{ isStage: true, sprite: { name: 'Stage' } }, target];
        await expectRoundTrip(
            converter,
            target,
            dedent`
                class Sprite1
                  def bar(a)
                    return a
                  end

                  when_flag_clicked do
                    a = 0
                    begin
                      a = a + 1
                    end while bar(a) < 3
                  end
                end
            `,
        );
    });
});
