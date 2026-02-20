import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {RubyToBlocksConverterError} from '../../../../src/lib/ruby-to-blocks-converter/errors';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Motion', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
    });

    test('motion_movesteps', async () => {
        let code;
        let expected;

        code = 'move(10)';
        expected = [
            {
                opcode: 'motion_movesteps',
                inputs: [
                    {
                        name: 'STEPS',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'move(x)';
        expected = [
            {
                opcode: 'motion_movesteps',
                inputs: [
                    {
                        name: 'STEPS',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'move()',
            'move(10, 10)',
            'move("10")',
            'move(abc)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_turn_right', async () => {
        let code;
        let expected;

        code = 'turn_right(180)';
        expected = [
            {
                opcode: 'motion_turnright',
                inputs: [
                    {
                        name: 'DEGREES',
                        block: expectedInfo.makeNumber(180)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'turn_right(x)';
        expected = [
            {
                opcode: 'motion_turnright',
                inputs: [
                    {
                        name: 'DEGREES',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(15)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'turn_right()',
            'turn_right(180, 0)',
            'turn_right("180")',
            'turn_right(abc)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_turn_left', async () => {
        let code;
        let expected;

        code = 'turn_left(180)';
        expected = [
            {
                opcode: 'motion_turnleft',
                inputs: [
                    {
                        name: 'DEGREES',
                        block: expectedInfo.makeNumber(180)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'turn_left(x)';
        expected = [
            {
                opcode: 'motion_turnleft',
                inputs: [
                    {
                        name: 'DEGREES',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(15)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'turn_left()',
            'turn_left(180, 0)',
            'turn_left("180")',
            'turn_left(abc)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_goto', async () => {
        const code = 'go_to("_mouse_")';
        const expected = [
            {
                opcode: 'motion_goto',
                inputs: [
                    {
                        name: 'TO',
                        block: {
                            opcode: 'motion_goto_menu',
                            fields: [
                                {
                                    name: 'TO',
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

        { for (const s of [
            'go_to(10)',
            'go_to()',
            'go_to("_mouse_", secs: 5)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_gotoxy', async () => {
        let code;
        let expected;

        code = 'go_to([12, 34])';
        expected = [
            {
                opcode: 'motion_gotoxy',
                inputs: [
                    {
                        name: 'X',
                        block: expectedInfo.makeNumber(12)
                    },
                    {
                        name: 'Y',
                        block: expectedInfo.makeNumber(34)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'go_to([x, y])';
        expected = [
            {
                opcode: 'motion_gotoxy',
                inputs: [
                    {
                        name: 'X',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    },
                    {
                        name: 'Y',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'go_to([])',
            'go_to([12])',
            'go_to([12, 34, 56])',
            'go_to([12, 34], secs: 5)',
            'go_to(["12", "34"])',
            'go_to([abc, abc])'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_glideto', async () => {
        let code;
        let expected;

        code = 'glide("_mouse_", secs: 5)';
        expected = [
            {
                opcode: 'motion_glideto',
                inputs: [
                    {
                        name: 'TO',
                        block: {
                            opcode: 'motion_glideto_menu',
                            fields: [
                                {
                                    name: 'TO',
                                    value: '_mouse_'
                                }
                            ],
                            shadow: true
                        }
                    },
                    {
                        name: 'SECS',
                        block: expectedInfo.makeNumber(5)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'glide("_mouse_", secs: x)';
        expected = [
            {
                opcode: 'motion_glideto',
                inputs: [
                    {
                        name: 'TO',
                        block: {
                            opcode: 'motion_glideto_menu',
                            fields: [
                                {
                                    name: 'TO',
                                    value: '_mouse_'
                                }
                            ],
                            shadow: true
                        }
                    },
                    {
                        name: 'SECS',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'glide()',
            'glide(10, secs: 5)',
            'glide("_mouse_")',
            'glide("_mouse_", 5)',
            'glide("_mouse_", secs: abc)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_glidesecstoxy', async () => {
        let code;
        let expected;

        code = 'glide([12, 34], secs: 5)';
        expected = [
            {
                opcode: 'motion_glidesecstoxy',
                inputs: [
                    {
                        name: 'X',
                        block: expectedInfo.makeNumber(12)
                    },
                    {
                        name: 'Y',
                        block: expectedInfo.makeNumber(34)
                    },
                    {
                        name: 'SECS',
                        block: expectedInfo.makeNumber(5)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'glide([x, y], secs: x)';
        expected = [
            {
                opcode: 'motion_glidesecstoxy',
                inputs: [
                    {
                        name: 'X',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    },
                    {
                        name: 'Y',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    },
                    {
                        name: 'SECS',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'glide([], secs: 5)',
            'glide([12, 34])',
            'glide([12, 34], 5)',
            'glide([abc, abc], secs: abc)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_pointindirection', async () => {
        let code;
        let expected;

        code = 'self.direction = 90';
        expected = [
            {
                opcode: 'motion_pointindirection',
                inputs: [
                    {
                        name: 'DIRECTION',
                        block: expectedInfo.makeNumber(90, 'math_angle')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.direction = x';
        expected = [
            {
                opcode: 'motion_pointindirection',
                inputs: [
                    {
                        name: 'DIRECTION',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(90, 'math_angle')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'self.direction = "90"',
            'self.direction = :symbol',
            'self.direction = abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_pointtowards', async () => {
        const code = 'point_towards("_mouse_")';
        const expected = [
            {
                opcode: 'motion_pointtowards',
                inputs: [
                    {
                        name: 'TOWARDS',
                        block: {
                            opcode: 'motion_pointtowards_menu',
                            fields: [
                                {
                                    name: 'TOWARDS',
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

        { for (const s of [
            'point_towards()',
            'point_towards(1)',
            'point_towards("_mouse_", secs: 1)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_ifonedgebounce', async () => {
        const expected = [
            {
                opcode: 'motion_ifonedgebounce'
            }
        ];
        for (const code of [
            'bounce_if_on_edge',
            'bounce_if_on_edge()'
        ]) {
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        { for (const s of [
            'bounce_if_on_edge(1)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_setrotationstyle', async () => {
        for (const style of [
            'left-right',
            "don't rotate",
            'all around'
        ]) {
            const code = `self.rotation_style = "${style}"`;
            const expected = [
                {
                    opcode: 'motion_setrotationstyle',
                    fields: [
                        {
                            name: 'STYLE',
                            value: style
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        { for (const s of [
            'self.rotation_style = 1',
            'self.rotation_style = "invalid"'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_changexby', async () => {
        let code;
        let expected;

        code = 'self.x += 10';
        expected = [
            {
                opcode: 'motion_changexby',
                inputs: [
                    {
                        name: 'DX',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.x += y';
        expected = [
            {
                opcode: 'motion_changexby',
                inputs: [
                    {
                        name: 'DX',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'self.x += "10"',
            'self.x += :symbol',
            'self.x += abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_setx', async () => {
        let code;
        let expected;

        code = 'self.x = 10';
        expected = [
            {
                opcode: 'motion_setx',
                inputs: [
                    {
                        name: 'X',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.x = y';
        expected = [
            {
                opcode: 'motion_setx',
                inputs: [
                    {
                        name: 'X',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'self.x = "10"',
            'self.x = :symbol',
            'self.x = abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_changeyby', async () => {
        let code;
        let expected;

        code = 'self.y += 10';
        expected = [
            {
                opcode: 'motion_changeyby',
                inputs: [
                    {
                        name: 'DY',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.y += x';
        expected = [
            {
                opcode: 'motion_changeyby',
                inputs: [
                    {
                        name: 'DY',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'self.y += "10"',
            'self.y += :symbol',
            'self.y += abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_sety', async () => {
        let code;
        let expected;

        code = 'self.y = 10';
        expected = [
            {
                opcode: 'motion_sety',
                inputs: [
                    {
                        name: 'Y',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'self.y = x';
        expected = [
            {
                opcode: 'motion_sety',
                inputs: [
                    {
                        name: 'Y',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'self.y = "10"',
            'self.y = :symbol',
            'self.y = abc'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    [
        'x',
        'y'
    ].forEach(xy => {
        test(`motion_${xy}position`, async () => {
            const code = xy;
            const expected = [
                {
                    opcode: `motion_${xy}position`
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    test('motion_direction', async () => {
        const code = 'direction';
        const expected = [
            {
                opcode: 'motion_direction'
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    describe('Stage validation', () => {
        let stageTarget;

        beforeEach(() => {
            stageTarget = {
                isStage: true,
                variables: {}
            };
        });

        test('all motion blocks should throw error on stage', async () => {
            const motionCommands = [
                'move(10)',
                'turn_right(15)',
                'turn_left(15)',
                'go_to("_mouse_")',
                'go_to([10, 20])',
                'glide("_mouse_", secs: 1)',
                'glide([10, 20], secs: 1)',
                'point_towards("_mouse_")',
                'bounce_if_on_edge',
                'self.direction = 90',
                'self.rotation_style = "all around"',
                'self.x = 10',
                'self.y = 10',
                'self.x += 5',
                'self.y += 5',
                'x',
                'y',
                'direction'
            ];

            for (const code of motionCommands) {
                const res = await converter.targetCodeToBlocks(stageTarget, code);
                expect(res).toBeFalsy();
                expect(converter.errors).toHaveLength(1);
                expect(converter.errors[0].text).toMatch(/"\{SOURCE\}" is the wrong instruction\./);
                
                // Reset for next test
                converter.reset();
            }
        });

        test('motion blocks work fine on sprite target', async () => {
            const spriteTarget = {
                isStage: false,
                variables: {}
            };

            // Test a few representative motion commands work on sprite
            { for (const code of ['move(10)', 'turn_right(15)', 'x']) {
                const res = await converter.targetCodeToBlocks(spriteTarget, code);
                expect(res).toBeTruthy();
                expect(converter.errors).toHaveLength(0);
                
                // Reset for next test
                converter.reset();
            } }
        });
    });
});
