import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Gets', () => {
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

    describe('gets', () => {
        test('variable assignment', () => {
            code = 'text = gets';
            expected = [
                {
                    opcode: 'sensing_askandwait',
                    inputs: [
                        {
                            name: 'QUESTION',
                            block: expectedInfo.makeText('')
                        }
                    ],
                    comment: {
                        text: '@ruby:method:gets',
                        minimized: true
                    }
                }
            ];
            expected[0].next = {
                opcode: 'data_setvariableto',
                fields: [
                    {
                        name: 'VARIABLE',
                        variable: '_text_1_'
                    }
                ],
                inputs: [
                    {
                        name: 'VALUE',
                        block: {
                            opcode: 'sensing_answer',
                            comment: {
                                text: '@ruby:method:gets',
                                minimized: true
                            }
                        },
                        shadow: expectedInfo.makeText('0')
                    }
                ],
                comment: {
                    text: '@ruby:lvar:text:1',
                    minimized: true
                }
            };
            convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('direct usage (e.g., puts gets)', () => {
            code = 'puts gets';
            expected = [
                {
                    opcode: 'sensing_askandwait',
                    inputs: [
                        {
                            name: 'QUESTION',
                            block: expectedInfo.makeText('')
                        }
                    ],
                    comment: {
                        text: '@ruby:method:gets',
                        minimized: true
                    }
                }
            ];
            expected[0].next = {
                opcode: 'looks_say',
                inputs: [
                    {
                        name: 'MESSAGE',
                        block: {
                            opcode: 'sensing_answer',
                            comment: {
                                text: '@ruby:method:gets',
                                minimized: true
                            }
                        },
                        shadow: expectedInfo.makeText('Hello!')
                    }
                ],
                comment: {
                    text: '@ruby:method:puts',
                    minimized: true
                }
            };
            convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('multiple gets', () => {
            code = `
                a = gets
                b = gets
            `;
            const askBlock = () => ({
                opcode: 'sensing_askandwait',
                inputs: [
                    {
                        name: 'QUESTION',
                        block: expectedInfo.makeText('')
                    }
                ],
                comment: {
                    text: '@ruby:method:gets',
                    minimized: true
                }
            });
            const answerBlock = {
                opcode: 'sensing_answer',
                comment: {
                    text: '@ruby:method:gets',
                    minimized: true
                }
            };
            
            const setA = {
                opcode: 'data_setvariableto',
                fields: [{ name: 'VARIABLE', variable: '_a_1_' }],
                inputs: [{ name: 'VALUE', block: answerBlock, shadow: expectedInfo.makeText('0') }],
                comment: {
                    text: '@ruby:lvar:a:1',
                    minimized: true
                }
            };
            const setB = {
                opcode: 'data_setvariableto',
                fields: [{ name: 'VARIABLE', variable: '_b_1_' }],
                inputs: [{ name: 'VALUE', block: answerBlock, shadow: expectedInfo.makeText('0') }],
                comment: {
                    text: '@ruby:lvar:b:1',
                    minimized: true
                }
            };

            const e = askBlock();
            e.next = setA;
            e.next.next = askBlock();
            e.next.next.next = setB;
            expected = [e];
            convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('standalone gets (value block handling)', () => {
            code = 'gets';
            const askBlock = {
                opcode: 'sensing_askandwait',
                inputs: [
                    {
                        name: 'QUESTION',
                        block: expectedInfo.makeText('')
                    }
                ],
                comment: {
                    text: '@ruby:method:gets',
                    minimized: true
                }
            };
            const answerBlock = {
                opcode: 'sensing_answer',
                comment: {
                    text: '@ruby:method:gets',
                    minimized: true
                }
            };
            expected = [askBlock, answerBlock];
            convertAndExpectToEqualBlocks(converter, target, code, expected);
        });
    });
});
