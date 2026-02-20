import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

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
});
