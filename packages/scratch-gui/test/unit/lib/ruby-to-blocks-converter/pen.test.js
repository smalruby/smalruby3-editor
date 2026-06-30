import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Pen', () => {
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

    test('pen_setPenColorToColor', async () => {
        code = 'pen.color = "#e36e1a"';
        expected = [
            {
                opcode: 'pen_setPenColorToColor',
                inputs: [
                    {
                        name: 'COLOR',
                        block: {
                            opcode: 'colour_picker',
                            fields: [
                                {
                                    name: 'COLOUR',
                                    value: '#e36e1a'
                                }
                            ],
                            shadow: true
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'pen.color = "10"',
            'pen.color = :symbol',
            'pen.color = abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    // Regression for #834: AI-generated (Rubytee) / hand-written pen color code uses
    // named colors, shorthand #rgb, uppercase hex and rgb() notation. These must convert
    // to a pen_setPenColorToColor block with a normalized #rrggbb colour_picker value
    // instead of erroring.
    test('pen_setPenColorToColor accepts named / shorthand / rgb() colors', async () => {
        const cases = [
            {code: 'pen.color = "red"', value: '#ff0000'},
            {code: 'pen.color = "Blue"', value: '#0000ff'},
            {code: 'pen.color = "LIME"', value: '#00ff00'},
            {code: 'pen.color = "#f00"', value: '#ff0000'},
            {code: 'pen.color = "#FF0000"', value: '#ff0000'},
            {code: 'pen.color = "rgb(255, 0, 0)"', value: '#ff0000'},
            {code: 'pen.color = "rgb(0,128,0)"', value: '#008000'}
        ];
        for (const {code: caseCode, value} of cases) {
            await convertAndExpectToEqualBlocks(converter, target, caseCode, [
                {
                    opcode: 'pen_setPenColorToColor',
                    inputs: [
                        {
                            name: 'COLOR',
                            block: {
                                opcode: 'colour_picker',
                                fields: [{name: 'COLOUR', value}],
                                shadow: true
                            }
                        }
                    ]
                }
            ]);
        }
    });

    describe('backward compatibility', () => {
        test('pen_clear', async () => {
            code = 'pen_clear';
            expected = [{opcode: 'pen_clear'}];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('pen_stamp', async () => {
            code = 'pen_stamp';
            expected = [{opcode: 'pen_stamp'}];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('pen_down', async () => {
            code = 'pen_down';
            expected = [{opcode: 'pen_penDown'}];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('pen_up', async () => {
            code = 'pen_up';
            expected = [{opcode: 'pen_penUp'}];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('pen_color=', async () => {
            code = 'pen_color = "#e36e1a"';
            expected = [
                {
                    opcode: 'pen_setPenColorToColor',
                    inputs: [
                        {
                            name: 'COLOR',
                            block: {
                                opcode: 'colour_picker',
                                fields: [{name: 'COLOUR', value: '#e36e1a'}],
                                shadow: true
                            }
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('pen_size=', async () => {
            code = 'pen_size = 1';
            expected = [
                {
                    opcode: 'pen_setPenSizeTo',
                    inputs: [{name: 'SIZE', block: expectedInfo.makeNumber(1)}]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('pen_size += 1', async () => {
            code = 'pen_size += 1';
            expected = [
                {
                    opcode: 'pen_changePenSizeBy',
                    inputs: [{name: 'SIZE', block: expectedInfo.makeNumber(1)}]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    const colorParamNames = [
        'color',
        'saturation',
        'brightness',
        'transparency'
    ];

    colorParamNames.forEach(colorParamName => {
        const colorParam = {
            name: 'COLOR_PARAM',
            block: {
                opcode: 'pen_menu_colorParam',
                fields: [
                    {
                        name: 'colorParam',
                        value: `${colorParamName}`
                    }
                ],
                shadow: true
            }
        };

        describe(colorParamName, () => {
            test('pen_changePenColorParamBy', async () => {
                code = `pen.${colorParamName} += 10`;
                expected = [
                    {
                        opcode: 'pen_changePenColorParamBy',
                        inputs: [
                            colorParam,
                            {
                                name: 'VALUE',
                                block: expectedInfo.makeNumber(10)
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                code = `pen.${colorParamName} += y`;
                expected = [
                    {
                        opcode: 'pen_changePenColorParamBy',
                        inputs: [
                            colorParam,
                            {
                                name: 'VALUE',
                                block: (await rubyToExpected(converter, target, 'y'))[0],
                                shadow: expectedInfo.makeNumber(10)
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                { for (const s of [
                    `pen.${colorParamName} += "10"`,
                    `pen.${colorParamName} += :symbol`,
                    `pen.${colorParamName} += abc`
                ]) {
                    await convertAndExpectRubyBlockError(converter, target, s);
                } }
            });

            test('pen_setPenColorParamTo', async () => {
                code = `pen.${colorParamName} = 50`;
                expected = [
                    {
                        opcode: 'pen_setPenColorParamTo',
                        inputs: [
                            colorParam,
                            {
                                name: 'VALUE',
                                block: expectedInfo.makeNumber(50)
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                code = `pen.${colorParamName} = y`;
                expected = [
                    {
                        opcode: 'pen_setPenColorParamTo',
                        inputs: [
                            colorParam,
                            {
                                name: 'VALUE',
                                block: (await rubyToExpected(converter, target, 'y'))[0],
                                shadow: expectedInfo.makeNumber(50)
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                { for (const s of [
                    `pen.${colorParamName} = "10"`,
                    `pen.${colorParamName} = :symbol`,
                    `pen.${colorParamName} = abc`
                ]) {
                    await convertAndExpectRubyBlockError(converter, target, s);
                } }
            });
        });
    });
});
