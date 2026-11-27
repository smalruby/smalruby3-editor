import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected,
    expectedInfo,
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/My Blocks', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, { version: '2' });
        target = null;
    });

    test('procedures_call 2', async () => {
        const code = `
            def made_block(arg1)
            end

            made_block(12)
        `;
        const expected = [
            {
                opcode: 'procedures_definition',
                inputs: [
                    {
                        name: 'custom_block',
                        block: {
                            opcode: 'procedures_prototype',
                            mutation: {
                                proccode: 'made_block %s',
                                arguments: [
                                    {
                                        name: 'arg1',
                                        type: 'string_number',
                                    },
                                ],
                            },
                            shadow: true,
                        },
                    },
                ],
            },
            {
                opcode: 'procedures_call',
                mutation: {
                    proccode: 'made_block %s',
                    argument_blocks: [expectedInfo.makeText('12')],
                },
            },
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('procedures_call recursive', async () => {
        const code = `
            def made_block(arg1)
              made_block(arg1 - 1)
            end

            made_block(12)
        `;
        const expected = [
            {
                opcode: 'procedures_definition',
                inputs: [
                    {
                        name: 'custom_block',
                        block: {
                            opcode: 'procedures_prototype',
                            mutation: {
                                proccode: 'made_block %s',
                                arguments: [
                                    {
                                        name: 'arg1',
                                        type: 'string_number',
                                    },
                                ],
                            },
                            shadow: true,
                        },
                    },
                ],
                next: {
                    opcode: 'procedures_call',
                    mutation: {
                        proccode: 'made_block %s',
                        argument_blocks: [
                            {
                                opcode: 'operator_subtract',
                                inputs: [
                                    {
                                        name: 'NUM1',
                                        block: {
                                            opcode: 'argument_reporter_string_number',
                                            fields: [
                                                {
                                                    name: 'VALUE',
                                                    value: 'arg1',
                                                },
                                            ],
                                        },
                                        shadow: expectedInfo.makeNumber(''),
                                    },
                                    {
                                        name: 'NUM2',
                                        block: expectedInfo.makeNumber(1),
                                    },
                                ],
                            },
                        ],
                    },
                },
            },
            {
                opcode: 'procedures_call',
                mutation: {
                    proccode: 'made_block %s',
                    argument_blocks: [expectedInfo.makeText('12')],
                },
            },
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    // An argument passed on to another My Block keeps its type: it became a boolean argument even when
    // the other My Block takes a number or a string, so a call with a number was an error (issue #2126).
    describe('argument passed on to another My Block', () => {
        const proccodes = (blocks) =>
            Object.values(blocks)
                .filter((b) => b.opcode === 'procedures_prototype')
                .map((b) => b.mutation.proccode);

        test('to a method that returns a value, as a value', async () => {
            const code = `
                def foo(n)
                  return n * 2
                end

                def bar(n)
                  say(foo(n))
                end

                bar(3)
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toEqual([]);
            expect(res).toBeTruthy();
            expect(proccodes(converter.blocks)).toEqual(['foo %s', 'bar %s']);
        });

        test('to a method, as a statement', async () => {
            const code = `
                def foo(n)
                  say(n)
                end

                def bar(n)
                  foo(n)
                end

                bar(3)
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toEqual([]);
            expect(res).toBeTruthy();
            expect(proccodes(converter.blocks)).toEqual(['foo %s', 'bar %s']);
            const argumentOpcodes = Object.values(converter.blocks)
                .filter((b) => /^argument_reporter_/.test(b.opcode))
                .map((b) => b.opcode);
            expect(argumentOpcodes).not.toContain('argument_reporter_boolean');
        });

        test('to a boolean argument, it becomes a boolean argument', async () => {
            const code = `
                def foo(b)
                  if b
                    say(1)
                  end
                end

                def bar(n)
                  foo(n)
                end

                bar(true)
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toEqual([]);
            expect(res).toBeTruthy();
            expect(proccodes(converter.blocks)).toEqual(['foo %b', 'bar %b']);
        });
    });

    describe('error if argument type miss match', () => {
        test('defined string_number, call boolean', async () => {
            const code = `
                def made_block(arg1, arg2)
                  if arg2
                  end
                end

                made_block(12, 34)
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(/invalid type of My Block "made_block" argument #2/);
            expect(res).toBeFalsy();
        });

        test('defined boolean, call string_number', async () => {
            const code = `
                def made_block(arg1, arg2)
                end

                made_block(:symbol, 1)
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(/invalid type of My Block "made_block" argument #1/);
            expect(res).toBeFalsy();
        });
    });
});
