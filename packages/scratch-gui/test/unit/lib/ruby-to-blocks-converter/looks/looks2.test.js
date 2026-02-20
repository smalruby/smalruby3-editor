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

});
