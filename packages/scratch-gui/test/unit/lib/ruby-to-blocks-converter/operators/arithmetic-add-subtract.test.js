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
        converter = new RubyToBlocksConverter(null, {version: '2'});
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

    describe('operator_join via string variable', () => {
        test('string variable + string literal uses operator_join', async () => {
            code = 'a = "He"\na + "llo"';
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            const scripts = Object.values(converter.blocks).filter(b => !b.parent);
            const joinBlock = scripts.find(b => b.opcode === 'operator_join');
            expect(joinBlock).toBeDefined();
        });

        test('two string variables use operator_join', async () => {
            code = 'a = "He"\nb = "llo"\na + b';
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            const joinBlock = Object.values(converter.blocks).find(b => b.opcode === 'operator_join');
            expect(joinBlock).toBeDefined();
        });

        test('to_s result variable + string literal uses operator_join', async () => {
            code = 'a = 1.to_s\na + "!"';
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            const joinBlock = Object.values(converter.blocks).find(b => b.opcode === 'operator_join');
            expect(joinBlock).toBeDefined();
        });

        test('number variable + number uses operator_add (unchanged)', async () => {
            code = 'a = 1\na + 2';
            await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(0);
            const addBlock = Object.values(converter.blocks).find(b => b.opcode === 'operator_add');
            expect(addBlock).toBeDefined();
            const joinBlock = Object.values(converter.blocks).find(b => b.opcode === 'operator_join');
            expect(joinBlock).toBeUndefined();
        });

        test('string variable + number is ruby block error (type mismatch)', async () => {
            code = 'a = "He"\na + 2';
            await convertAndExpectRubyBlockError(converter, target, code);
        });

        test('unknown-type variable + string literal is ruby block error', async () => {
            code = 'a = touching?("edge")\na + "!"';
            await convertAndExpectRubyBlockError(converter, target, code);
        });

        test('string variable + boolean literal is ruby block error', async () => {
            code = 'a = "Hello"\na + true';
            await convertAndExpectRubyBlockError(converter, target, code);

            converter = new RubyToBlocksConverter(null, {version: '2'});
            code = 'a = "Hello"\na + false';
            await convertAndExpectRubyBlockError(converter, target, code);
        });
    });

    describe('operator_add type safety', () => {
        test('number variable + boolean literal is ruby block error', async () => {
            code = 'a = 10\na + true';
            await convertAndExpectRubyBlockError(converter, target, code);
        });

        test('number variable + false is ruby block error', async () => {
            code = 'a = 10\na + false';
            await convertAndExpectRubyBlockError(converter, target, code);
        });

        test('number variable + string literal is ruby block error', async () => {
            code = 'a = 10\na + "Hello"';
            await convertAndExpectRubyBlockError(converter, target, code);
        });
    });
});
