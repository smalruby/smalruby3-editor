// === Smalruby: This file is Smalruby-specific (walking into case / when, issue #1813) ===
/**
 * `compactChildNodes()` of `@ruby/prism` 1.9.0 drops the children in an array (the `when` of a
 * `case`, the conditions of a `when`, ...), so code that walked the tree with it did not see the
 * code inside a `when`. The same code inside an `if` was seen.
 */
import dedent from 'dedent';
import RubyParser from '../../../../src/lib/ruby-parser';
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
            expect(converter.errors).toEqual([]);
            expect(result).toBeTruthy();
            expect(converter._context.variableUses['@a']).toEqual(
                expect.objectContaining({ list: false, scalar: true, string: true }),
            );
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

    describe('calls of a method that returns a value (`_countMethodCalls`)', () => {
        test('counts the calls in the body of a when', async () => {
            const prism = RubyParser.getPrism() || (await RubyParser.loadPrism());
            const root = prism.parse(dedent`
                case @x
                when 1
                  say(f)
                when f
                  say(f)
                end
            `).value;
            const converter = new RubyToBlocksConverter(null, { version: '2' });
            converter._lookupProcedure = (name) => (name === 'f' ? { hasReturnValue: true } : null);
            expect(converter._countMethodCalls(root)).toEqual({ f: 3 });
        });
    });
});
