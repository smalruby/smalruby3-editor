// === Smalruby: This file is Smalruby-specific (walking into case / when, issue #1813) ===
/**
 * `compactChildNodes()` of `@ruby/prism` 1.9.0 drops the children in an array (the `when` of a
 * `case`, the conditions of a `when`, ...), so code that walked the tree with it did not see the
 * code inside a `when`. The same code inside an `if` was seen.
 */
import dedent from 'dedent';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('RubyToBlocksConverter: the code inside case / when (issue #1813)', () => {
    describe('how a variable is used (`_collectVariableUses`)', () => {
        let target, runtime, converter;

        beforeEach(() => {
            ({ target, runtime } = makeSpriteTarget());
            setupRubyGenerator();
            converter = makeConverter(target, runtime, { version: '2' });
        });

        test.each([
            [
                'in an if (as before)',
                dedent`
                    when_flag_clicked do
                      say(@a.length)
                    end

                    if @x == 1
                      @a = "abc"
                    end
                `,
            ],
            [
                'in the body of a when',
                dedent`
                    when_flag_clicked do
                      say(@a.length)
                    end

                    case @x
                    when 1
                      @a = "abc"
                    end
                `,
            ],
            [
                'in the body of the second when',
                dedent`
                    when_flag_clicked do
                      say(@a.length)
                    end

                    case @x
                    when 1
                      move(10)
                    when 2
                      @a = "abc"
                    end
                `,
            ],
        ])('a string set %s makes `@a.length` the length of the string', async (_name, code) => {
            await expectRoundTrip(converter, target, code);
        });

        // The assignment in the condition of a `when` is the error of a wrong instruction
        // (issue #1818), but `@a` is still not taken for a list: the error is not that one.
        test('a string set in the condition of a when is not taken for a list', async () => {
            const code = dedent`
                when_flag_clicked do
                  say(@a.length)
                end

                case @x
                when (@a = "abc")
                  move(10)
                end
            `;
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converter.errors.map((e) => e.text)).toEqual([
                '"when (@a = "abc")" is the wrong instruction.\nCheck the spelling or use a supported block.',
            ]);
            expect(converter._context.variableUses['@a']).toEqual(
                expect.objectContaining({ list: false, scalar: true, string: true }),
            );
        });
    });

    describe('a list in a when and a variable elsewhere (`_collectVariableUses`)', () => {
        const listAndVariableError =
            '"@a" is used as a list on line 3 and as a variable on line 5.\n' +
            'In Ruby, one name cannot be both a variable and a list. Rename one of them.';

        test.each([
            ['in an if (as before)', 'if @x == 1\n  move(10)\n  @a.push(1)\nend\n@a = 5'],
            ['in the body of a when', 'case @x\nwhen 1\n  @a.push(1)\nend\n@a = 5'],
        ])('`@a.push` %s and `@a = 5` is an error', async (_name, code) => {
            const { target, runtime } = makeSpriteTarget();
            const converter = makeConverter(target, runtime, { version: '2' });
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBe(false);
            expect(converter.errors.map((e) => [e.row, e.text])).toEqual([[4, listAndVariableError]]);
        });
    });

    describe('super inside a when (`_nodeContainsSuper`)', () => {
        test('super in the body of a when calls the method of the module', async () => {
            const converter = new RubyToBlocksConverter(null, { version: '2' });
            const code = dedent`
                module Mod
                  def func(a)
                    say(a)
                  end
                end

                class Sprite1
                  include Mod

                  def func(a)
                    case a
                    when 1
                      super
                    end
                  end
                end
            `;
            const result = await converter.targetCodeToBlocks(null, code);
            expect(converter.errors).toEqual([]);
            expect(result).toBeTruthy();
            const superCalls = Object.values(converter._context.blocks).filter((b) => {
                const comment = b.comment && converter._context.comments[b.comment];
                return b.opcode === 'procedures_call' && comment && comment.text === '@ruby:super:forwarding';
            });
            expect(superCalls).toHaveLength(1);
            expect(superCalls[0].mutation.proccode).toMatch(/^_super_func_1_ /);
        });
    });
});
