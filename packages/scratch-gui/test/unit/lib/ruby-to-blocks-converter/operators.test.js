import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Operators', () => {
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

    describe('operator_add', () => {
        test('normal', async () => {
            code = '1 + 2';
            expected = [
                {
                    opcode: 'operator_add',
                    inputs: [
                        {
                            name: 'NUM1',
                            block: expectedInfo.makeNumber(1)
                        },
                        {
                            name: 'NUM2',
                            block: expectedInfo.makeNumber(2)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'x + y';
            expected = [
                {
                    opcode: 'operator_add',
                    inputs: [
                        {
                            name: 'NUM1',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber('')
                        },
                        {
                            name: 'NUM2',
                            block: (await rubyToExpected(converter, target, 'y'))[0],
                            shadow: expectedInfo.makeNumber('')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = '$global + y';
            expected = [
                {
                    opcode: 'operator_add',
                    inputs: [
                        {
                            name: 'NUM1',
                            block: (await rubyToExpected(converter, target, '$global'))[0],
                            shadow: expectedInfo.makeNumber('')
                        },
                        {
                            name: 'NUM2',
                            block: (await rubyToExpected(converter, target, 'y'))[0],
                            shadow: expectedInfo.makeNumber('')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('bug, 180 + (1)', async () => {
            code = '180 + (1)';
            expected = [
                {
                    opcode: 'operator_add',
                    inputs: [
                        {
                            name: 'NUM1',
                            block: expectedInfo.makeNumber(180)
                        },
                        {
                            name: 'NUM2',
                            block: expectedInfo.makeNumber(1)
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    test('operator_subtract', async () => {
        code = '2 - 1';
        expected = [
            {
                opcode: 'operator_subtract',
                inputs: [
                    {
                        name: 'NUM1',
                        block: expectedInfo.makeNumber(2)
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '2 - (1)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x - y';
        expected = [
            {
                opcode: 'operator_subtract',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global - y';
        expected = [
            {
                opcode: 'operator_subtract',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            '"2" - "1"',
            '2 - "1"',
            '"2" - 1'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('operator_multiply', async () => {
        code = '1 * 2';
        expected = [
            {
                opcode: 'operator_multiply',
                inputs: [
                    {
                        name: 'NUM1',
                        block: expectedInfo.makeNumber(1)
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(2)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 * (2)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x * y';
        expected = [
            {
                opcode: 'operator_multiply',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global * y';
        expected = [
            {
                opcode: 'operator_multiply',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            '"1" * "2"',
            '1 * "2"',
            '"1" * 2'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('operator_divide', async () => {
        code = '2 / 1';
        expected = [
            {
                opcode: 'operator_divide',
                inputs: [
                    {
                        name: 'NUM1',
                        block: expectedInfo.makeNumber(2)
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '2 / (1)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x / y';
        expected = [
            {
                opcode: 'operator_divide',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global / y';
        expected = [
            {
                opcode: 'operator_divide',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            '"2" / "1"',
            '2 / "1"',
            '"2" / 1'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('operator_random', async () => {
        code = 'rand(1..10)';
        expected = [
            {
                opcode: 'operator_random',
                inputs: [
                    {
                        name: 'FROM',
                        block: expectedInfo.makeNumber(1)
                    },
                    {
                        name: 'TO',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'rand(x..y)';
        expected = [
            {
                opcode: 'operator_random',
                inputs: [
                    {
                        name: 'FROM',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(1)
                    },
                    {
                        name: 'TO',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'rand($global..y)';
        expected = [
            {
                opcode: 'operator_random',
                inputs: [
                    {
                        name: 'FROM',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeNumber(1)
                    },
                    {
                        name: 'TO',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'random()',
            'random',
            'random(1)',
            'random(10)',
            'random(1..10, 23)',
            'random("1..10")'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('operator_gt', async () => {
        code = '1 > 50';
        expected = [
            {
                opcode: 'operator_gt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('1')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 > (50)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x > y';
        expected = [
            {
                opcode: 'operator_gt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global > y';
        expected = [
            {
                opcode: 'operator_gt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_lt', async () => {
        code = '1 < 50';
        expected = [
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('1')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 < (50)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x < y';
        expected = [
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global < y';
        expected = [
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_equals', async () => {
        code = '1 == 50';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('1')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 == (50)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x == y';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('50')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global == 21';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '$global'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('21')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_not_equals', async () => {
        code = '1 != 50';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: {
                            opcode: 'operator_equals',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('1')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:!=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:!=:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x != y';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: {
                            opcode: 'operator_equals',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: (await rubyToExpected(converter, target, 'x'))[0],
                                    shadow: expectedInfo.makeText('')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: (await rubyToExpected(converter, target, 'y'))[0],
                                    shadow: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:!=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:!=:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 != 50\n2 != 60';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: {
                            opcode: 'operator_equals',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('1')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:!=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:!=:1',
                    minimized: true
                }
            },
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: {
                            opcode: 'operator_equals',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('2')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('60')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:!=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:!=:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 != 50 && 2 != 60';
        expected = [
            {
                opcode: 'operator_and',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_not',
                            inputs: [
                                {
                                    name: 'OPERAND',
                                    block: {
                                        opcode: 'operator_equals',
                                        inputs: [
                                            {
                                                name: 'OPERAND1',
                                                block: expectedInfo.makeText('1')
                                            },
                                            {
                                                name: 'OPERAND2',
                                                block: expectedInfo.makeText('50')
                                            }
                                        ],
                                        comment: {
                                            text: '@ruby:operator:!=:1',
                                            minimized: true
                                        }
                                    }
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:!=:1',
                                minimized: true
                            }
                        }
                    },
                    {
                        name: 'OPERAND2',
                        block: {
                            opcode: 'operator_not',
                            inputs: [
                                {
                                    name: 'OPERAND',
                                    block: {
                                        opcode: 'operator_equals',
                                        inputs: [
                                            {
                                                name: 'OPERAND1',
                                                block: expectedInfo.makeText('2')
                                            },
                                            {
                                                name: 'OPERAND2',
                                                block: expectedInfo.makeText('60')
                                            }
                                        ],
                                        comment: {
                                            text: '@ruby:operator:!=:2',
                                            minimized: true
                                        }
                                    }
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:!=:2',
                                minimized: true
                            }
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_ge', async () => {
        code = '1 >= 50';
        expected = [
            {
                opcode: 'operator_or',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_gt',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('1')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:>=:1',
                                minimized: true
                            }
                        }
                    },
                    {
                        name: 'OPERAND2',
                        block: {
                            opcode: 'operator_equals',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('1')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:>=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:>=:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x >= y';
        expected = [
            {
                opcode: 'operator_or',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_gt',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: (await rubyToExpected(converter, target, 'x'))[0],
                                    shadow: expectedInfo.makeText('')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: (await rubyToExpected(converter, target, 'y'))[0],
                                    shadow: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:>=:1',
                                minimized: true
                            }
                        }
                    },
                    {
                        name: 'OPERAND2',
                        block: {
                            opcode: 'operator_equals',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: (await rubyToExpected(converter, target, 'x'))[0],
                                    shadow: expectedInfo.makeText('')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: (await rubyToExpected(converter, target, 'y'))[0],
                                    shadow: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:>=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:>=:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_le', async () => {
        code = '1 <= 50';
        expected = [
            {
                opcode: 'operator_or',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_lt',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('1')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:<=:1',
                                minimized: true
                            }
                        }
                    },
                    {
                        name: 'OPERAND2',
                        block: {
                            opcode: 'operator_equals',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('1')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:<=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:<=:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x <= y';
        expected = [
            {
                opcode: 'operator_or',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_lt',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: (await rubyToExpected(converter, target, 'x'))[0],
                                    shadow: expectedInfo.makeText('')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: (await rubyToExpected(converter, target, 'y'))[0],
                                    shadow: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:<=:1',
                                minimized: true
                            }
                        }
                    },
                    {
                        name: 'OPERAND2',
                        block: {
                            opcode: 'operator_equals',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: (await rubyToExpected(converter, target, 'x'))[0],
                                    shadow: expectedInfo.makeText('')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: (await rubyToExpected(converter, target, 'y'))[0],
                                    shadow: expectedInfo.makeText('50')
                                }
                            ],
                            comment: {
                                text: '@ruby:operator:<=:1',
                                minimized: true
                            }
                        }
                    }
                ],
                comment: {
                    text: '@ruby:operator:<=:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_and', async () => {
        code = '1 < x && x < 10';
        expected = [
            {
                opcode: 'operator_and',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '1 < x'))[0]
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'x < 10'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 < x && (x < 10)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 < $global && $global < 10';
        expected = [
            {
                opcode: 'operator_and',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '1 < $global'))[0]
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, '$global < 10'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'false && false';
        expected = [
            {
                opcode: 'operator_and',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_lt',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('0')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('0')
                                }
                            ],
                            comment: {
                                text: '@ruby:literal:false:1',
                                minimized: true
                            }
                        }
                    },
                    {
                        name: 'OPERAND2',
                        block: {
                            opcode: 'operator_lt',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('0')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('0')
                                }
                            ],
                            comment: {
                                text: '@ruby:literal:false:2',
                                minimized: true
                            }
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_or', async () => {
        code = 'x == 2 || y == 3';
        expected = [
            {
                opcode: 'operator_or',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, 'x == 2'))[0]
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, 'y == 3'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x == 2 || (y == 3)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '$global == 2 || $global == 3';
        expected = [
            {
                opcode: 'operator_or',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: (await rubyToExpected(converter, target, '$global == 2'))[0]
                    },
                    {
                        name: 'OPERAND2',
                        block: (await rubyToExpected(converter, target, '$global == 3'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'false || false';
        expected = [
            {
                opcode: 'operator_or',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_lt',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('0')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('0')
                                }
                            ],
                            comment: {
                                text: '@ruby:literal:false:1',
                                minimized: true
                            }
                        }
                    },
                    {
                        name: 'OPERAND2',
                        block: {
                            opcode: 'operator_lt',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('0')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('0')
                                }
                            ],
                            comment: {
                                text: '@ruby:literal:false:2',
                                minimized: true
                            }
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_not', async () => {
        code = '!touching?("_edge_")';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: await rubyToExpected(converter, target, 'touching?("_edge_")')[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '!($global == 1)';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: (await rubyToExpected(converter, target, '$global == 1'))[0]
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '!false';
        expected = [
            {
                opcode: 'operator_not',
                inputs: [
                    {
                        name: 'OPERAND',
                        block: {
                            opcode: 'operator_lt',
                            inputs: [
                                {
                                    name: 'OPERAND1',
                                    block: expectedInfo.makeText('0')
                                },
                                {
                                    name: 'OPERAND2',
                                    block: expectedInfo.makeText('0')
                                }
                            ],
                            comment: {
                                text: '@ruby:literal:false:1',
                                minimized: true
                            }
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('ruby_literal_true', async () => {
        code = 'true';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('1')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('1')
                    }
                ],
                comment: {
                    text: '@ruby:literal:true:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'true\ntrue';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('1')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('1')
                    }
                ],
                comment: {
                    text: '@ruby:literal:true:1',
                    minimized: true
                }
            },
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('1')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('1')
                    }
                ],
                comment: {
                    text: '@ruby:literal:true:2',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('ruby_literal_false', async () => {
        code = 'false';
        expected = [
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('0')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:literal:false:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'false\nfalse';
        expected = [
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('0')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:literal:false:1',
                    minimized: true
                }
            },
            {
                opcode: 'operator_lt',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: expectedInfo.makeText('0')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:literal:false:2',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('ruby_literal_true_false_assignment', async () => {
        code = 'x = true';
        expected = await rubyToExpected(converter, target, 'x = 0');
        const valueInput1 = expected[0].inputs.find(i => i.name === 'VALUE');
        valueInput1.block = {
            opcode: 'operator_equals',
            inputs: [
                {
                    name: 'OPERAND1',
                    block: expectedInfo.makeText('1')
                },
                {
                    name: 'OPERAND2',
                    block: expectedInfo.makeText('1')
                }
            ],
            comment: {
                text: '@ruby:literal:true:1',
                minimized: true
            }
        };
        valueInput1.shadow = expectedInfo.makeText('0');
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x = false';
        expected = await rubyToExpected(converter, target, 'x = 0');
        const valueInput2 = expected[0].inputs.find(i => i.name === 'VALUE');
        valueInput2.block = {
            opcode: 'operator_lt',
            inputs: [
                {
                    name: 'OPERAND1',
                    block: expectedInfo.makeText('0')
                },
                {
                    name: 'OPERAND2',
                    block: expectedInfo.makeText('0')
                }
            ],
            comment: {
                text: '@ruby:literal:false:1',
                minimized: true
            }
        };
        valueInput2.shadow = expectedInfo.makeText('0');
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('ruby_literal_true_false_if', async () => {
        code = 'if true\n  move(10)\nend';
        expected = await rubyToExpected(converter, target, 'if x == 1\n  move(10)\nend');
        expected[0].inputs.find(i => i.name === 'CONDITION').block = {
            opcode: 'operator_equals',
            inputs: [
                {
                    name: 'OPERAND1',
                    block: expectedInfo.makeText('1')
                },
                {
                    name: 'OPERAND2',
                    block: expectedInfo.makeText('1')
                }
            ],
            comment: {
                text: '@ruby:literal:true:1',
                minimized: true
            }
        };
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_join', async () => {
        code = '"apple" + "banana"';
        expected = [
            {
                opcode: 'operator_join',
                inputs: [
                    {
                        name: 'STRING1',
                        block: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'STRING2',
                        block: expectedInfo.makeText('banana')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '"apple" + x';
        expected = [
            {
                opcode: 'operator_join',
                inputs: [
                    {
                        name: 'STRING1',
                        block: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'STRING2',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('banana')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x + "banana"';
        expected = [
            {
                opcode: 'operator_join',
                inputs: [
                    {
                        name: 'STRING1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'STRING2',
                        block: expectedInfo.makeText('banana')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_letter_of', async () => {
        code = '"apple"[0]';
        expected = [
            {
                opcode: 'operator_letter_of',
                inputs: [
                    {
                        name: 'STRING',
                        block: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'LETTER',
                        block: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x[y]';
        expected = [
            {
                opcode: 'operator_letter_of',
                inputs: [
                    {
                        name: 'STRING',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'LETTER',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(1)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_length', async () => {
        code = '"apple".length';
        expected = [
            {
                opcode: 'operator_length',
                inputs: [
                    {
                        name: 'STRING',
                        block: expectedInfo.makeText('apple')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x.length';
        expected = [
            {
                opcode: 'operator_length',
                inputs: [
                    {
                        name: 'STRING',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('apple')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('empty?', async () => {
        code = '"apple".empty?';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_length',
                            inputs: [
                                {
                                    name: 'STRING',
                                    block: expectedInfo.makeText('apple')
                                }
                            ],
                            comment: {
                                text: '@ruby:method:empty?:1',
                                minimized: true
                            }
                        },
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:method:empty?:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x.empty?';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'operator_length',
                            inputs: [
                                {
                                    name: 'STRING',
                                    block: (await rubyToExpected(converter, target, 'x'))[0],
                                    shadow: expectedInfo.makeText('apple')
                                }
                            ],
                            comment: {
                                text: '@ruby:method:empty?:1',
                                minimized: true
                            }
                        },
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:method:empty?:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'list("@list").empty?';
        expected = [
            {
                opcode: 'operator_equals',
                inputs: [
                    {
                        name: 'OPERAND1',
                        block: {
                            opcode: 'data_lengthoflist',
                            fields: [
                                {
                                    name: 'LIST',
                                    list: '@list'
                                }
                            ],
                            comment: {
                                text: '@ruby:method:empty?:1',
                                minimized: true
                            }
                        },
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'OPERAND2',
                        block: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:method:empty?:1',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_contains', async () => {
        code = '"apple".include?("a")';
        expected = [
            {
                opcode: 'operator_contains',
                inputs: [
                    {
                        name: 'STRING1',
                        block: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'STRING2',
                        block: expectedInfo.makeText('a')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x.include?(y)';
        expected = [
            {
                opcode: 'operator_contains',
                inputs: [
                    {
                        name: 'STRING1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('apple')
                    },
                    {
                        name: 'STRING2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeText('a')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('operator_mod', async () => {
        code = '1 % 2';
        expected = [
            {
                opcode: 'operator_mod',
                inputs: [
                    {
                        name: 'NUM1',
                        block: expectedInfo.makeNumber(1)
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(2)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '1 % (2)';
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x % y';
        expected = [
            {
                opcode: 'operator_mod',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            '"1" % "2"',
            '1 % "2"',
            '"1" % 2'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('operator_round', async () => {
        code = '2.round';
        expected = [
            {
                opcode: 'operator_round',
                inputs: [
                    {
                        name: 'NUM',
                        block: expectedInfo.makeNumber(2)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'x.round';
        expected = [
            {
                opcode: 'operator_round',
                inputs: [
                    {
                        name: 'NUM',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            '"2".round',
            '"2".round(1)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('operator_mathop', async () => {
        let operatorCodes;

        ['3', '(3)'].forEach(three => {
            operatorCodes = {
                'abs': `${three}.abs`,
                'floor': `${three}.floor`,
                'ceiling': `${three}.ceil`,
                'sqrt': `Math.sqrt(${three})`,
                'sin': `Math.sin(${three})`,
                'cos': `Math.cos(${three})`,
                'tan': `Math.tan(${three})`,
                'asin': `Math.asin(${three})`,
                'acos': `Math.acos(${three})`,
                'atan': `Math.atan(${three})`,
                'ln': `Math.log(${three})`,
                'log': `Math.log10(${three})`,
                'e ^': `Math::E ** ${three}`,
                '10 ^': `10 ** ${three}`
            };
            Object.keys(operatorCodes).forEach(async operator => {
                code = operatorCodes[operator];
                expected = [
                    {
                        opcode: 'operator_mathop',
                        fields: [
                            {
                                name: 'OPERATOR',
                                value: operator
                            }
                        ],
                        inputs: [
                            {
                                name: 'NUM',
                                block: expectedInfo.makeNumber(3)
                            }
                        ]
                    }
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);
            });
        });

        operatorCodes = {
            'abs': 'x.abs',
            'floor': 'x.floor',
            'ceiling': 'x.ceil',
            'sqrt': 'Math.sqrt(x)',
            'sin': 'Math.sin(x)',
            'cos': 'Math.cos(x)',
            'tan': 'Math.tan(x)',
            'asin': 'Math.asin(x)',
            'acos': 'Math.acos(x)',
            'atan': 'Math.atan(x)',
            'ln': 'Math.log(x)',
            'log': 'Math.log10(x)',
            'e ^': 'Math::E ** x',
            '10 ^': '10 ** x'
        };
        Object.keys(operatorCodes).forEach(async operator => {
            code = operatorCodes[operator];
            expected = [
                {
                    opcode: 'operator_mathop',
                    fields: [
                        {
                            name: 'OPERATOR',
                            value: operator
                        }
                    ],
                    inputs: [
                        {
                            name: 'NUM',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: expectedInfo.makeNumber('')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    test('to_s', async () => {
        code = 'x.to_s';
        expected = [
            {
                opcode: 'operator_join',
                inputs: [
                    {
                        name: 'STRING1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('')
                    },
                    {
                        name: 'STRING2',
                        block: expectedInfo.makeText(''),
                        shadow: expectedInfo.makeText('')
                    }
                ],
                comment: {
                    text: '@ruby:method:to_s',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '123.to_s';
        expected = [
            {
                opcode: 'operator_join',
                inputs: [
                    {
                        name: 'STRING1',
                        block: expectedInfo.makeNumber(123)
                    },
                    {
                        name: 'STRING2',
                        block: expectedInfo.makeText(''),
                        shadow: expectedInfo.makeText('')
                    }
                ],
                comment: {
                    text: '@ruby:method:to_s',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('to_i', async () => {
        code = 'x.to_i';
        expected = [
            {
                opcode: 'operator_add',
                inputs: [
                    {
                        name: 'NUM1',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber('')
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(0),
                        shadow: expectedInfo.makeNumber(0)
                    }
                ],
                comment: {
                    text: '@ruby:method:to_i',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = '"123".to_i';
        expected = [
            {
                opcode: 'operator_add',
                inputs: [
                    {
                        name: 'NUM1',
                        block: expectedInfo.makeText('123')
                    },
                    {
                        name: 'NUM2',
                        block: expectedInfo.makeNumber(0),
                        shadow: expectedInfo.makeNumber(0)
                    }
                ],
                comment: {
                    text: '@ruby:method:to_i',
                    minimized: true
                }
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('reject non-boolean blocks in boolean inputs', async () => {
        { for (const s of [
            '!move(10)',
            'move(10) && touching?("_edge_")',
            'touching?("_edge_") && move(10)',
            'move(10) || touching?("_edge_")',
            'touching?("_edge_") || move(10)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });
});
