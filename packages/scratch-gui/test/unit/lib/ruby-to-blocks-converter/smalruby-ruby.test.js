import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/SmalrubyRuby', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('String#delete (REPORTER)', () => {
        test('should convert string literal receiver with string arg', async () => {
            const code = '"hello world".delete("l")';
            const expected = [
                {
                    opcode: 'ruby_stringMethodR',
                    fields: [
                        {
                            name: 'METHOD',
                            value: 'delete'
                        }
                    ],
                    inputs: [
                        {
                            name: 'STRING',
                            block: expectedInfo.makeText('hello world')
                        },
                        {
                            name: 'ARG1',
                            block: expectedInfo.makeText('l')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should convert variable receiver', async () => {
            const code = 'x = "hello"\nx.delete("l")';
            const expected = [
                (await rubyToExpected(converter, target, 'x = "hello"'))[0]
            ];
            expected[0].next = {
                opcode: 'ruby_stringMethodR',
                fields: [
                    {
                        name: 'METHOD',
                        value: 'delete'
                    }
                ],
                inputs: [
                    {
                        name: 'STRING',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('hello world')
                    },
                    {
                        name: 'ARG1',
                        block: expectedInfo.makeText('l')
                    }
                ]
            };
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should reject non-string argument', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete(true)');
        });

        test('should reject wrong number of arguments', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete()');
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete("l", "o")');
        });
    });

    describe('String#delete! (COMMAND)', () => {
        test('should convert string literal receiver with string arg', async () => {
            const code = '"hello world".delete!("l")';
            const expected = [
                {
                    opcode: 'ruby_stringMethodC',
                    fields: [
                        {
                            name: 'METHOD',
                            value: 'delete!'
                        }
                    ],
                    inputs: [
                        {
                            name: 'STRING',
                            block: expectedInfo.makeText('hello world')
                        },
                        {
                            name: 'ARG1',
                            block: expectedInfo.makeText('l')
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should convert variable receiver', async () => {
            const code = 'x = "hello"\nx.delete!("l")';
            const expected = [
                (await rubyToExpected(converter, target, 'x = "hello"'))[0]
            ];
            expected[0].next = {
                opcode: 'ruby_stringMethodC',
                fields: [
                    {
                        name: 'METHOD',
                        value: 'delete!'
                    }
                ],
                inputs: [
                    {
                        name: 'STRING',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeText('hello world')
                    },
                    {
                        name: 'ARG1',
                        block: expectedInfo.makeText('l')
                    }
                ]
            };
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('should reject non-string argument', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete!(true)');
        });

        test('should reject wrong number of arguments', async () => {
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete!()');
            await convertAndExpectRubyBlockError(converter, target, '"hello".delete!("l", "o")');
        });
    });
});
