import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {RubyToBlocksConverterError} from '../../../../../src/lib/ruby-to-blocks-converter/errors';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo,
    expectNoArgsMethod
} from '../../../../helpers/expect-to-equal-blocks';

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

});
