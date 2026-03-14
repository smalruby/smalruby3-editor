import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/My Blocks', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    test('procedures_definition,procedures_prototype no arguments', async () => {
        const code = `
            def made_block
            end
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
                                proccode: 'made_block',
                                arguments: []
                            },
                            shadow: true
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('procedures_definition,procedures_prototype', async () => {
        const code = `
            def made_block(arg1, arg2)
              move(10)
            end
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
                                proccode: 'made_block %s %s',
                                arguments: [
                                    {
                                        name: 'arg1',
                                        type: 'string_number'
                                    },
                                    {
                                        name: 'arg2',
                                        type: 'string_number'
                                    }
                                ]
                            },
                            shadow: true
                        }
                    }
                ],
                next: {
                    opcode: 'motion_movesteps',
                    inputs: [
                        {
                            name: 'STEPS',
                            block: expectedInfo.makeNumber(10)
                        }
                    ]
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('argument_reporter_string_number', async () => {
        const code = `
            def made_block(arg1, arg2)
              move(arg1)
            end
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
                                proccode: 'made_block %s %s',
                                arguments: [
                                    {
                                        name: 'arg1',
                                        type: 'string_number'
                                    },
                                    {
                                        name: 'arg2',
                                        type: 'string_number'
                                    }
                                ]
                            },
                            shadow: true
                        }
                    }
                ],
                next: {
                    opcode: 'motion_movesteps',
                    inputs: [
                        {
                            name: 'STEPS',
                            block: {
                                opcode: 'argument_reporter_string_number',
                                fields: [
                                    {
                                        name: 'VALUE',
                                        value: 'arg1'
                                    }
                                ]
                            },
                            shadow: expectedInfo.makeNumber(10)
                        }
                    ]
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('argument_reporter_boolean,argument_reporter_string_number', async () => {
        const code = `
            def made_block(arg1, arg2)
              move(arg1)
              if arg2
                bounce_if_on_edge
              end
            end
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
                                proccode: 'made_block %s %b',
                                arguments: [
                                    {
                                        name: 'arg1',
                                        type: 'string_number'
                                    },
                                    {
                                        name: 'arg2',
                                        type: 'boolean'
                                    }
                                ]
                            },
                            shadow: true
                        }
                    }
                ],
                next: {
                    opcode: 'motion_movesteps',
                    inputs: [
                        {
                            name: 'STEPS',
                            block: {
                                opcode: 'argument_reporter_string_number',
                                fields: [
                                    {
                                        name: 'VALUE',
                                        value: 'arg1'
                                    }
                                ]
                            },
                            shadow: expectedInfo.makeNumber(10)
                        }
                    ],
                    next: {
                        opcode: 'control_if',
                        inputs: [
                            {
                                name: 'CONDITION',
                                block: {
                                    opcode: 'argument_reporter_boolean',
                                    fields: [
                                        {
                                            name: 'VALUE',
                                            value: 'arg2'
                                        }
                                    ]
                                }
                            }
                        ],
                        branches: [
                            (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
                        ]
                    }
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
