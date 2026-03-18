import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Operators/Regexp', () => {
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

    describe('=~ operator (string receiver)', () => {
        test('string =~ /pattern/', async () => {
            code = '"hello world" =~ /^hello/';
            expected = [
                {
                    opcode: 'operator_contains',
                    inputs: [
                        {
                            name: 'STRING1',
                            block: expectedInfo.makeText('hello world')
                        },
                        {
                            name: 'STRING2',
                            block: expectedInfo.makeText('/^hello/')
                        }
                    ],
                    comment: {
                        text: '@ruby:operator:=~:1',
                        minimized: true
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('string =~ /pattern/i with flags', async () => {
            code = '"Hello" =~ /hello/i';
            expected = [
                {
                    opcode: 'operator_contains',
                    inputs: [
                        {
                            name: 'STRING1',
                            block: expectedInfo.makeText('Hello')
                        },
                        {
                            name: 'STRING2',
                            block: expectedInfo.makeText('/hello/i')
                        }
                    ],
                    comment: {
                        text: '@ruby:operator:=~:1',
                        minimized: true
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('variable =~ /pattern/', async () => {
            code = 'x =~ /\\d+/';
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
                            block: expectedInfo.makeText('/\\d+/')
                        }
                    ],
                    comment: {
                        text: '@ruby:operator:=~:1',
                        minimized: true
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    describe('=~ operator (regexp receiver)', () => {
        test('/pattern/ =~ string', async () => {
            code = '/^hello/ =~ "hello world"';
            expected = [
                {
                    opcode: 'operator_contains',
                    inputs: [
                        {
                            name: 'STRING1',
                            block: expectedInfo.makeText('hello world')
                        },
                        {
                            name: 'STRING2',
                            block: expectedInfo.makeText('/^hello/')
                        }
                    ],
                    comment: {
                        text: '@ruby:operator:=~:1:receiver',
                        minimized: true
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    describe('!~ operator', () => {
        test('string !~ /pattern/', async () => {
            code = '"hello" !~ /world/';
            expected = [
                {
                    opcode: 'operator_not',
                    inputs: [
                        {
                            name: 'OPERAND',
                            block: {
                                opcode: 'operator_contains',
                                inputs: [
                                    {
                                        name: 'STRING1',
                                        block: expectedInfo.makeText('hello')
                                    },
                                    {
                                        name: 'STRING2',
                                        block: expectedInfo.makeText('/world/')
                                    }
                                ],
                                comment: {
                                    text: '@ruby:operator:!~:1',
                                    minimized: true
                                }
                            }
                        }
                    ],
                    comment: {
                        text: '@ruby:operator:!~:1',
                        minimized: true
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('/pattern/ !~ string (regexp receiver)', async () => {
            code = '/world/ !~ "hello"';
            expected = [
                {
                    opcode: 'operator_not',
                    inputs: [
                        {
                            name: 'OPERAND',
                            block: {
                                opcode: 'operator_contains',
                                inputs: [
                                    {
                                        name: 'STRING1',
                                        block: expectedInfo.makeText('hello')
                                    },
                                    {
                                        name: 'STRING2',
                                        block: expectedInfo.makeText('/world/')
                                    }
                                ],
                                comment: {
                                    text: '@ruby:operator:!~:1:receiver',
                                    minimized: true
                                }
                            }
                        }
                    ],
                    comment: {
                        text: '@ruby:operator:!~:1:receiver',
                        minimized: true
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });

    describe('=~ with multiple flags', () => {
        test('regex with multiple flags', async () => {
            code = '"Hello World" =~ /hello/im';
            expected = [
                {
                    opcode: 'operator_contains',
                    inputs: [
                        {
                            name: 'STRING1',
                            block: expectedInfo.makeText('Hello World')
                        },
                        {
                            name: 'STRING2',
                            block: expectedInfo.makeText('/hello/im')
                        }
                    ],
                    comment: {
                        text: '@ruby:operator:=~:1',
                        minimized: true
                    }
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });
});
