import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo,
    expectNoArgsMethod
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Sensing', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
        code = null;
        expected = null;
    });

    describe('sensing_coloristouchingcolor', () => {
        test('normal', async () => {
            code = 'color_is_touching_color?("#aad315", "#fca3bf")';
            expected = [
                {
                    opcode: 'sensing_coloristouchingcolor',
                    inputs: [
                        {
                            name: 'COLOR',
                            block: {
                                opcode: 'colour_picker',
                                fields: [
                                    {
                                        name: 'COLOUR',
                                        value: '#aad315'
                                    }
                                ],
                                shadow: true
                            }
                        },
                        {
                            name: 'COLOR2',
                            block: {
                                opcode: 'colour_picker',
                                fields: [
                                    {
                                        name: 'COLOUR',
                                        value: '#fca3bf'
                                    }
                                ],
                                shadow: true
                            }
                        }

                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'color_is_touching_color?(x, y)';
            expected = [
                {
                    opcode: 'sensing_coloristouchingcolor',
                    inputs: [
                        {
                            name: 'COLOR',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: {
                                opcode: 'colour_picker',
                                fields: [
                                    {
                                        name: 'COLOUR',
                                        value: '#aad315'
                                    }
                                ],
                                shadow: true
                            }
                        },
                        {
                            name: 'COLOR2',
                            block: (await rubyToExpected(converter, target, 'y'))[0],
                            shadow: {
                                opcode: 'colour_picker',
                                fields: [
                                    {
                                        name: 'COLOUR',
                                        value: '#fca3bf'
                                    }
                                ],
                                shadow: true
                            }
                        }

                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('value_boolean', async () => {
            code = `
                bounce_if_on_edge
                color_is_touching_color?("#aad315", "#fca3bf")
                bounce_if_on_edge
            `;
            expected = [
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0],
                (await rubyToExpected(converter, target, 'color_is_touching_color?("#aad315", "#fca3bf")'))[0],
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'color_is_touching_color?()',
                'color_is_touching_color?(1)',
                'color_is_touching_color?("#0", "#fca3bf")',
                'color_is_touching_color?("aad315", "#fca3bf")',
                'color_is_touching_color?("#aad3150", "#fca3bf")',
                'color_is_touching_color?("#aad315", "#0")',
                'color_is_touching_color?("#aad315", "fca3bf")',
                'color_is_touching_color?("#aad315", "#fca3bf0")',
                'color_is_touching_color?("#aad315", "#fca3bf", 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });

        test('error', async () => {
            code = `
                forever do
                  color_is_touching_color?("#aad315", "#fca3bf")
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(res).toBeFalsy();
        });

        // Regression for #834: named / shorthand colors normalize to #rrggbb here too.
        test('named colors normalize to #rrggbb', async () => {
            code = 'color_is_touching_color?("red", "#00f")';
            expected = [
                {
                    opcode: 'sensing_coloristouchingcolor',
                    inputs: [
                        {
                            name: 'COLOR',
                            block: {
                                opcode: 'colour_picker',
                                fields: [{name: 'COLOUR', value: '#ff0000'}],
                                shadow: true
                            }
                        },
                        {
                            name: 'COLOR2',
                            block: {
                                opcode: 'colour_picker',
                                fields: [{name: 'COLOUR', value: '#0000ff'}],
                                shadow: true
                            }
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    describe('sensing_distanceto', () => {
        test('normal', async () => {
            code = 'distance("_mouse_")';
            expected = [
                {
                    opcode: 'sensing_distanceto',
                    inputs: [
                        {
                            name: 'DISTANCETOMENU',
                            block: {
                                opcode: 'sensing_distancetomenu',
                                fields: [
                                    {
                                        name: 'DISTANCETOMENU',
                                        value: '_mouse_'
                                    }
                                ],
                                shadow: true
                            }
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'distance(x)';
            expected = [
                {
                    opcode: 'sensing_distanceto',
                    inputs: [
                        {
                            name: 'DISTANCETOMENU',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: {
                                opcode: 'sensing_distancetomenu',
                                fields: [
                                    {
                                        name: 'DISTANCETOMENU',
                                        value: '_mouse_'
                                    }
                                ],
                                shadow: true
                            }
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('value', async () => {
            code = `
                bounce_if_on_edge
                distance("_mouse_")
                bounce_if_on_edge
            `;
            expected = [
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0],
                (await rubyToExpected(converter, target, 'distance("_mouse_")'))[0],
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'distance()',
                'distance(1)',
                'distance("_mouse_", 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });

        test('error', async () => {
            code = `
                forever do
                  distance("_mouse_")
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(res).toBeFalsy();
        });
    });

    describe('sensing_askandwait', () => {
        test('normal', async () => {
            code = 'ask("What\'s your name?")';
            expected = [
                {
                    opcode: 'sensing_askandwait',
                    inputs: [
                        {
                            name: 'QUESTION',
                            block: expectedInfo.makeText('What\'s your name?')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'ask(x)';
            expected = [
                {
                    opcode: 'sensing_askandwait',
                    inputs: [
                        {
                            name: 'QUESTION',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeText('What\'s your name?')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('statement', async () => {
            code = `
                bounce_if_on_edge
                ask("What's your name?")
                bounce_if_on_edge
            `;
            expected = [
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
            ];
            expected[0].next = (await rubyToExpected(converter, target, 'ask("What\'s your name?")'))[0];
            expected[0].next.next = (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'ask()',
                'ask(1)',
                'ask("What\'s your name?", 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    expectNoArgsMethod('sensing_answer', 'answer', 'value');

});
