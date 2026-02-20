import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {RubyToBlocksConverterError} from '../../../../src/lib/ruby-to-blocks-converter/errors';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo,
    expectNoArgsMethod
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Looks', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
        code = null;
        expected = null;
    });

    describe('looks_sayforsecs', () => {
        test('normal', async () => {
            code = 'say("Hello!", 2)';
            expected = [
                {
                    opcode: 'looks_sayforsecs',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: expectedInfo.makeText('Hello!')
                        },
                        {
                            name: 'SECS',
                            block: expectedInfo.makeNumber(2)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'say(1, 2)';
            expected = [
                {
                    opcode: 'looks_sayforsecs',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: expectedInfo.makeText('1')
                        },
                        {
                            name: 'SECS',
                            block: expectedInfo.makeNumber(2)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'say(x, 2)';
            expected = [
                {
                    opcode: 'looks_sayforsecs',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeText('Hello!')
                        },
                        {
                            name: 'SECS',
                            block: expectedInfo.makeNumber(2)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'say(x, y)';
            expected = [
                {
                    opcode: 'looks_sayforsecs',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeText('Hello!')
                        },
                        {
                            name: 'SECS',
                            block: (await rubyToExpected(converter, target, 'y'))[0],
                            shadow: expectedInfo.makeNumber(2)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'say("Hello!", "2")',
                'say("Hello!", 2, 3)',
                'say(:symbol, 2)',
                'say("Hello!", :symbol)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_say', () => {
        test('normal', async () => {
            code = 'say("Hello!")';
            expected = [
                {
                    opcode: 'looks_say',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: expectedInfo.makeText('Hello!')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'say(1)';
            expected = [
                {
                    opcode: 'looks_say',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: expectedInfo.makeText('1')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'say(x)';
            expected = [
                {
                    opcode: 'looks_say',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeText('Hello!')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'say',
                'say(:symbol)',
                'say(1, 2, 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_thinkforsecs', () => {
        test('normal', async () => {
            code = 'think("Hmm...", 2)';
            expected = [
                {
                    opcode: 'looks_thinkforsecs',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: expectedInfo.makeText('Hmm...')
                        },
                        {
                            name: 'SECS',
                            block: expectedInfo.makeNumber(2)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'think(1, 2)';
            expected = [
                {
                    opcode: 'looks_thinkforsecs',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: expectedInfo.makeText('1')
                        },
                        {
                            name: 'SECS',
                            block: expectedInfo.makeNumber(2)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'think(x, 2)';
            expected = [
                {
                    opcode: 'looks_thinkforsecs',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeText('Hmm...')
                        },
                        {
                            name: 'SECS',
                            block: expectedInfo.makeNumber(2)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'think(x, y)';
            expected = [
                {
                    opcode: 'looks_thinkforsecs',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeText('Hmm...')
                        },
                        {
                            name: 'SECS',
                            block: (await rubyToExpected(converter, target, 'y'))[0],
                            shadow: expectedInfo.makeNumber(2)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'think("Hello!", "2")',
                'think("Hello!", 2, 3)',
                'think(:symbol, 2)',
                'think("Hello!", :symbol)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_think', () => {
        test('normal', async () => {
            code = 'think("Hmm...")';
            expected = [
                {
                    opcode: 'looks_think',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: expectedInfo.makeText('Hmm...')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'think(1)';
            expected = [
                {
                    opcode: 'looks_think',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: expectedInfo.makeText('1')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'think(x)';
            expected = [
                {
                    opcode: 'looks_think',
                    inputs: [
                        {
                            name: 'MESSAGE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeText('Hmm...')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'think',
                'think(:symbol)',
                'think(1, 2, 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_switchcostumeto', () => {
        test('normal', async () => {
            code = 'switch_costume("costume2")';
            expected = [
                {
                    opcode: 'looks_switchcostumeto',
                    inputs: [
                        {
                            name: 'COSTUME',
                            block: {
                                opcode: 'looks_costume',
                                fields: [
                                    {
                                        name: 'COSTUME',
                                        value: 'costume2'
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

        test('invalid', async () => {
            { for (const c of [
                'switch_costume',
                'switch_costume(:symbol)',
                'switch_costume(1)',
                'switch_costume(x)',
                'switch_costume("costume2", 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    expectNoArgsMethod('looks_nextcostume', 'next_costume');

    describe('looks_switchbackdropto', () => {
        test('normal', async () => {
            code = 'switch_backdrop("backdrop2")';
            expected = [
                {
                    opcode: 'looks_switchbackdropto',
                    inputs: [
                        {
                            name: 'BACKDROP',
                            block: {
                                opcode: 'looks_backdrops',
                                fields: [
                                    {
                                        name: 'BACKDROP',
                                        value: 'backdrop2'
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

        test('invalid', async () => {
            { for (const c of [
                'switch_backdrop',
                'switch_backdrop(:symbol)',
                'switch_backdrop(1)',
                'switch_backdrop(x)',
                'switch_backdrop("backdrop2", 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    expectNoArgsMethod('looks_nextbackdrop', 'next_backdrop');

    describe('looks_changesizeby', () => {
        test('normal', async () => {
            code = 'self.size += 10';
            expected = [
                {
                    opcode: 'looks_changesizeby',
                    inputs: [
                        {
                            name: 'CHANGE',
                            block: expectedInfo.makeNumber(10)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'self.size += x';
            expected = [
                {
                    opcode: 'looks_changesizeby',
                    inputs: [
                        {
                            name: 'CHANGE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber(10)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'self.size += "10"',
                'self.size += :symbol',
                'self.size += abc'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_setsizeto', () => {
        test('normal', async () => {
            code = 'self.size = 10';
            expected = [
                {
                    opcode: 'looks_setsizeto',
                    inputs: [
                        {
                            name: 'SIZE',
                            block: expectedInfo.makeNumber(10)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'self.size = x';
            expected = [
                {
                    opcode: 'looks_setsizeto',
                    inputs: [
                        {
                            name: 'SIZE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber(100)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'self.size = "10"',
                'self.size = :symbol',
                'self.size = abc'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_changeeffectby', () => {
        test('normal', async () => {
            code = 'change_effect_by("color", 25)';
            expected = [
                {
                    opcode: 'looks_changeeffectby',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'CHANGE',
                            block: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'change_effect_by("color", x)';
            expected = [
                {
                    opcode: 'looks_changeeffectby',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'CHANGE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('upper case', async () => {
            code = 'change_effect_by("COLOR", 25)';
            expected = [
                {
                    opcode: 'looks_changeeffectby',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'CHANGE',
                            block: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'change_effect_by',
                'change_effect_by()',
                'change_effect_by("color")',
                'change_effect_by(25)',
                'change_effect_by("invalid effect", 25)',
                'change_effect_by(1, 25)',
                'change_effect_by("color", 25, 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_seteffectto', () => {
        test('normal', async () => {
            code = 'set_effect("color", 25)';
            expected = [
                {
                    opcode: 'looks_seteffectto',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'set_effect("color", x)';
            expected = [
                {
                    opcode: 'looks_seteffectto',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('upper case', async () => {
            code = 'set_effect("COLOR", 25)';
            expected = [
                {
                    opcode: 'looks_seteffectto',
                    fields: [
                        {
                            name: 'EFFECT',
                            value: 'COLOR'
                        }
                    ],
                    inputs: [
                        {
                            name: 'VALUE',
                            block: expectedInfo.makeNumber(25)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'set_effect',
                'set_effect()',
                'set_effect("color")',
                'set_effect(25)',
                'set_effect("invalid effect", 25)',
                'set_effect(1, 25)',
                'set_effect("color", 25, 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    expectNoArgsMethod('looks_cleargraphiceffects', 'clear_graphic_effects');
    expectNoArgsMethod('looks_show', 'show');
    expectNoArgsMethod('looks_hide', 'hide');
    expectNoArgsMethod('looks_size', 'size', 'value');

    describe('looks_gotofrontback', () => {
        test('normal', async () => {
            code = 'go_to_layer("front")';
            expected = [
                {
                    opcode: 'looks_gotofrontback',
                    fields: [
                        {
                            name: 'FRONT_BACK',
                            value: 'front'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'go_to_layer("back")';
            expected = [
                {
                    opcode: 'looks_gotofrontback',
                    fields: [
                        {
                            name: 'FRONT_BACK',
                            value: 'back'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'go_to_layer',
                'go_to_layer()',
                'go_to_layer("invalid")',
                'go_to_layer(25)',
                'go_to_layer(x)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_goforwardbackwardlayers', () => {
        test('normal', async () => {
            code = 'go_layers(1, "forward")';
            expected = [
                {
                    opcode: 'looks_goforwardbackwardlayers',
                    fields: [
                        {
                            name: 'FORWARD_BACKWARD',
                            value: 'forward'
                        }
                    ],
                    inputs: [
                        {
                            name: 'NUM',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'go_layers(1, "backward")';
            expected = [
                {
                    opcode: 'looks_goforwardbackwardlayers',
                    fields: [
                        {
                            name: 'FORWARD_BACKWARD',
                            value: 'backward'
                        }
                    ],
                    inputs: [
                        {
                            name: 'NUM',
                            block: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'go_layers(x, "forward")';
            expected = [
                {
                    opcode: 'looks_goforwardbackwardlayers',
                    fields: [
                        {
                            name: 'FORWARD_BACKWARD',
                            value: 'forward'
                        }
                    ],
                    inputs: [
                        {
                            name: 'NUM',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber(1, 'math_integer')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'go_layers',
                'go_layers()',
                'go_layers("invalid")',
                'go_layers(25)',
                'go_layers(x)',
                'go_layers(1, "invalid")',
                'go_layers("1", "forward")',
                'go_layers(:symbol, "forward")'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_costumenumbername', () => {
        test('normal', async () => {
            code = 'costume_number';
            expected = [
                {
                    opcode: 'looks_costumenumbername',
                    fields: [
                        {
                            name: 'NUMBER_NAME',
                            value: 'number'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'costume_name';
            expected = [
                {
                    opcode: 'looks_costumenumbername',
                    fields: [
                        {
                            name: 'NUMBER_NAME',
                            value: 'name'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'costume_number(1)',
                'costume_name(1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_backdropnumbername', () => {
        test('normal', async () => {
            code = 'backdrop_number';
            expected = [
                {
                    opcode: 'looks_backdropnumbername',
                    fields: [
                        {
                            name: 'NUMBER_NAME',
                            value: 'number'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'backdrop_name';
            expected = [
                {
                    opcode: 'looks_backdropnumbername',
                    fields: [
                        {
                            name: 'NUMBER_NAME',
                            value: 'name'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'backdrop_number(1)',
                'backdrop_name(1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('looks_switchbackdroptoandwait', () => {
        test('normal', async () => {
            code = 'switch_backdrop_and_wait("backdrop2")';
            expected = [
                {
                    opcode: 'looks_switchbackdroptoandwait',
                    inputs: [
                        {
                            name: 'BACKDROP',
                            block: {
                                opcode: 'looks_backdrops',
                                fields: [
                                    {
                                        name: 'BACKDROP',
                                        value: 'backdrop2'
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

        test('invalid', async () => {
            { for (const c of [
                'switch_backdrop_and_wait',
                'switch_backdrop_and_wait(:symbol)',
                'switch_backdrop_and_wait(1)',
                'switch_backdrop_and_wait(x)',
                'switch_backdrop_and_wait("backdrop2", 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    describe('costume existence check', () => {
        let targetWithCostumes;

        beforeEach(() => {
            // Mock target with costumes
            targetWithCostumes = {
                getCostumes: () => [
                    { name: 'costume1' },
                    { name: 'costume2' }
                ]
            };
        });

        describe('switch_costume with costume existence check', () => {
            test('existing costume should work', async () => {
                code = 'switch_costume("costume1")';
                expected = [
                    {
                        opcode: 'looks_switchcostumeto',
                        inputs: [
                            {
                                name: 'COSTUME',
                                block: {
                                    opcode: 'looks_costume',
                                    fields: [
                                        {
                                            name: 'COSTUME',
                                            value: 'costume1'
                                        }
                                    ],
                                    shadow: true
                                }
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converter, targetWithCostumes, code, expected);
            });

            test('non-existing costume should throw error', async () => {
                code = 'switch_costume("NonExistentCostume")';
                const result = await converter.targetCodeToBlocks(targetWithCostumes, code);
                expect(result).toBeFalsy();
                expect(converter.errors).toHaveLength(1);
                expect(converter.errors[0].text).toContain('costume "NonExistentCostume" does not exist');
            });
        });

        describe('costume_number and costume_name with costume existence check', () => {
            test('costume_number should work without costume check', async () => {
                code = 'costume_number';
                expected = [
                    {
                        opcode: 'looks_costumenumbername',
                        fields: [
                            {
                                name: 'NUMBER_NAME',
                                value: 'number'
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converter, targetWithCostumes, code, expected);
            });

            test('costume_name should work without costume check', async () => {
                code = 'costume_name';
                expected = [
                    {
                        opcode: 'looks_costumenumbername',
                        fields: [
                            {
                                name: 'NUMBER_NAME',
                                value: 'name'
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converter, targetWithCostumes, code, expected);
            });
        });
    });

    describe('backdrop existence check', () => {
        let stageWithBackdrops;
        let converterWithVM;

        beforeEach(() => {
            // Mock stage with backdrops
            stageWithBackdrops = {
                getCostumes: () => [
                    { name: 'backdrop1' },
                    { name: 'backdrop2' }
                ]
            };
            
            // Mock converter with VM runtime
            converterWithVM = new RubyToBlocksConverter({
                runtime: {
                    getTargetForStage: () => stageWithBackdrops
                }
            });
        });

        [
            {
                opcode: 'looks_switchbackdropto',
                methodName: 'switch_backdrop'
            },
            {
                opcode: 'looks_switchbackdroptoandwait',
                methodName: 'switch_backdrop_and_wait'
            }
        ].forEach(info => {
            describe(`${info.opcode} with backdrop existence check`, () => {
                test('existing backdrop should work', async () => {
                    code = `${info.methodName}("backdrop1")`;
                    expected = [
                        {
                            opcode: info.opcode,
                            inputs: [
                                {
                                    name: 'BACKDROP',
                                    block: {
                                        opcode: 'looks_backdrops',
                                        fields: [
                                            {
                                                name: 'BACKDROP',
                                                value: 'backdrop1'
                                            }
                                        ],
                                        shadow: true
                                    }
                                }
                            ]
                        }
                    ];
                    await convertAndExpectToEqualBlocks(converterWithVM, stageWithBackdrops, code, expected);
                });

                test('non-existing backdrop should throw error', async () => {
                    code = `${info.methodName}("NonExistentBackdrop")`;
                    const result = await converterWithVM.targetCodeToBlocks(stageWithBackdrops, code);
                    expect(result).toBeFalsy();
                    expect(converterWithVM.errors).toHaveLength(1);
                    expect(converterWithVM.errors[0].text).toContain('backdrop "NonExistentBackdrop" does not exist');
                });
            });
        });

        describe('backdrop_number and backdrop_name with backdrop existence check', () => {
            test('backdrop_number should work without backdrop check', async () => {
                code = 'backdrop_number';
                expected = [
                    {
                        opcode: 'looks_backdropnumbername',
                        fields: [
                            {
                                name: 'NUMBER_NAME',
                                value: 'number'
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converterWithVM, stageWithBackdrops, code, expected);
            });

            test('backdrop_name should work without backdrop check', async () => {
                code = 'backdrop_name';
                expected = [
                    {
                        opcode: 'looks_backdropnumbername',
                        fields: [
                            {
                                name: 'NUMBER_NAME',
                                value: 'name'
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converterWithVM, stageWithBackdrops, code, expected);
            });
        });
    });

    describe('Stage/Sprite validation', () => {
        let stageTarget;
        let spriteTarget;

        beforeEach(() => {
            stageTarget = {
                isStage: true,
                variables: {}
            };
            spriteTarget = {
                isStage: false,
                variables: {}
            };
        });

        test('sprite-only blocks should throw error on stage', async () => {
            const spriteOnlyCommands = [
                'say("Hello")',
                'say("Hello", 2)',
                'think("Hmm")',
                'think("Hmm", 2)',
                'switch_costume("costume1")',
                'next_costume',
                'self.size = 100',
                'go_to_layer("front")',
                'go_layers(1, "forward")',
                'show',
                'hide',
                'size',
                'costume_name',
                'costume_number'
            ];

            for (const code of spriteOnlyCommands) {
                const res = await converter.targetCodeToBlocks(stageTarget, code);
                expect(res).toBeFalsy();
                expect(converter.errors).toHaveLength(1);
                expect(converter.errors[0].text).toMatch(/"\{SOURCE\}" is the wrong instruction\./);
                
                // Reset for next test
                converter.reset();
            }
        });

        test('stage-common blocks should work on stage', async () => {
            const stageCompatibleCommands = [
                'switch_backdrop("backdrop1")',
                'switch_backdrop_and_wait("backdrop1")',
                'next_backdrop',
                'clear_graphic_effects',
                'change_effect_by("COLOR", 25)',
                'set_effect("COLOR", 50)',
                'backdrop_name',
                'backdrop_number'
            ];

            for (const code of stageCompatibleCommands) {
                const res = await converter.targetCodeToBlocks(stageTarget, code);
                if (!res) {
                    console.log(`Failed command: ${code}`);
                    console.log(`Errors: ${JSON.stringify(converter.errors)}`);
                }
                expect(res).toBeTruthy();
                expect(converter.errors).toHaveLength(0);
                
                // Reset for next test
                converter.reset();
            }
        });

        test('all blocks should work on sprite', async () => {
            const allCommands = [
                // Sprite-only blocks
                'say("Hello")',
                'think("Hmm")',
                'switch_costume("costume1")',
                'next_costume',
                'show',
                'hide',
                'size',
                // Common blocks
                'switch_backdrop("backdrop1")',
                'next_backdrop',
                'clear_graphic_effects'
            ];

            { for (const code of allCommands) {
                const res = await converter.targetCodeToBlocks(spriteTarget, code);
                expect(res).toBeTruthy();
                expect(converter.errors).toHaveLength(0);
                
                // Reset for next test
                converter.reset();
            } }
        });
    });

    describe('print, puts, p', () => {
        ['print', 'puts', 'p'].forEach(method => {
            test(`${method}("Hello") should become looks_sayforsecs with comment`, async () => {
                code = `${method}("Hello")`;
                expected = [
                    {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: expectedInfo.makeText('Hello')
                            },
                            {
                                name: 'SECS',
                                block: expectedInfo.makeNumber(1)
                            }
                        ]
                    }
                ];

                // First verify blocks structure
                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                // Then verify comment
                const blockId = Object.keys(converter.blocks).find(id => converter.blocks[id].opcode === 'looks_sayforsecs');
                const block = converter.blocks[blockId];
                expect(block.comment).toBeDefined();

                const commentId = block.comment;
                expect(converter._context.comments[commentId]).toBeDefined();
                expect(converter._context.comments[commentId].text).toEqual(`@ruby:method:${method}`);
            });

            test(`${method}(10) should become looks_sayforsecs with type comment`, async () => {
                code = `${method}(10)`;
                expected = [
                    {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: expectedInfo.makeText('10')
                            },
                            {
                                name: 'SECS',
                                block: expectedInfo.makeNumber(1)
                            }
                        ]
                    }
                ];

                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                const blockId = Object.keys(converter.blocks).find(id => converter.blocks[id].opcode === 'looks_sayforsecs');
                const block = converter.blocks[blockId];
                expect(block.comment).toBeDefined();

                const commentId = block.comment;
                expect(converter._context.comments[commentId].text).toEqual(`@ruby:method:${method},@ruby:argument:1:type:Integer`);
            });

            test(`${method}(3.5) should become looks_sayforsecs with type comment`, async () => {
                code = `${method}(3.5)`;
                expected = [
                    {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: expectedInfo.makeText('3.5')
                            },
                            {
                                name: 'SECS',
                                block: expectedInfo.makeNumber(1)
                            }
                        ]
                    }
                ];

                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                const blockId = Object.keys(converter.blocks).find(id => converter.blocks[id].opcode === 'looks_sayforsecs');
                const block = converter.blocks[blockId];
                expect(block.comment).toBeDefined();

                const commentId = block.comment;
                expect(converter._context.comments[commentId].text).toEqual(`@ruby:method:${method},@ruby:argument:1:type:Float`);
            });

            test(`${method}("Hello", 10, 3.5) should become multiple looks_sayforsecs blocks`, async () => {
                code = `${method}("Hello", 10, 3.5)`;
                expected = [
                    {
                        opcode: 'looks_sayforsecs',
                        inputs: [
                            {
                                name: 'MESSAGE',
                                block: expectedInfo.makeText('Hello')
                            },
                            {
                                name: 'SECS',
                                block: expectedInfo.makeNumber(1)
                            }
                        ],
                        next: {
                            opcode: 'looks_sayforsecs',
                            inputs: [
                                {
                                    name: 'MESSAGE',
                                    block: expectedInfo.makeText('10')
                                },
                                {
                                    name: 'SECS',
                                    block: expectedInfo.makeNumber(1)
                                }
                            ],
                            next: {
                                opcode: 'looks_sayforsecs',
                                inputs: [
                                    {
                                        name: 'MESSAGE',
                                        block: expectedInfo.makeText('3.5')
                                    },
                                    {
                                        name: 'SECS',
                                        block: expectedInfo.makeNumber(1)
                                    }
                                ]
                            }
                        }
                    }
                ];

                await convertAndExpectToEqualBlocks(converter, target, code, expected);

                const blocks = Object.values(converter.blocks).filter(b => b.opcode === 'looks_sayforsecs');
                expect(blocks).toHaveLength(3);

                // Find blocks in order
                const firstBlock = blocks.find(b => !b.parent);
                const secondBlock = converter.blocks[firstBlock.next];
                const thirdBlock = converter.blocks[secondBlock.next];

                expect(converter._context.comments[firstBlock.comment].text).toEqual(`@ruby:method:${method}`);
                expect(converter._context.comments[secondBlock.comment].text).toEqual(`@ruby:method:${method},@ruby:argument:1:type:Integer`);
                expect(converter._context.comments[thirdBlock.comment].text).toEqual(`@ruby:method:${method},@ruby:argument:1:type:Float`);
            });
        });
    });
});
