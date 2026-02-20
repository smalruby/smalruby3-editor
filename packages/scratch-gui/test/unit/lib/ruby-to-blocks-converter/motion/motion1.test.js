import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {RubyToBlocksConverterError} from '../../../../../src/lib/ruby-to-blocks-converter/errors';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Motion', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
        target = null;
    });

    test('motion_movesteps', async () => {
        let code;
        let expected;

        code = 'move(10)';
        expected = [
            {
                opcode: 'motion_movesteps',
                inputs: [
                    {
                        name: 'STEPS',
                        block: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'move(x)';
        expected = [
            {
                opcode: 'motion_movesteps',
                inputs: [
                    {
                        name: 'STEPS',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(10)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'move()',
            'move(10, 10)',
            'move("10")',
            'move(abc)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_turn_right', async () => {
        let code;
        let expected;

        code = 'turn_right(180)';
        expected = [
            {
                opcode: 'motion_turnright',
                inputs: [
                    {
                        name: 'DEGREES',
                        block: expectedInfo.makeNumber(180)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'turn_right(x)';
        expected = [
            {
                opcode: 'motion_turnright',
                inputs: [
                    {
                        name: 'DEGREES',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(15)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'turn_right()',
            'turn_right(180, 0)',
            'turn_right("180")',
            'turn_right(abc)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_turn_left', async () => {
        let code;
        let expected;

        code = 'turn_left(180)';
        expected = [
            {
                opcode: 'motion_turnleft',
                inputs: [
                    {
                        name: 'DEGREES',
                        block: expectedInfo.makeNumber(180)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'turn_left(x)';
        expected = [
            {
                opcode: 'motion_turnleft',
                inputs: [
                    {
                        name: 'DEGREES',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(15)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'turn_left()',
            'turn_left(180, 0)',
            'turn_left("180")',
            'turn_left(abc)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_goto', async () => {
        const code = 'go_to("_mouse_")';
        const expected = [
            {
                opcode: 'motion_goto',
                inputs: [
                    {
                        name: 'TO',
                        block: {
                            opcode: 'motion_goto_menu',
                            fields: [
                                {
                                    name: 'TO',
                                    value: '_mouse_'
                                }
                            ],
                            shadow: true
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'go_to(10)',
            'go_to()',
            'go_to("_mouse_", secs: 5)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });

    test('motion_gotoxy', async () => {
        let code;
        let expected;

        code = 'go_to([12, 34])';
        expected = [
            {
                opcode: 'motion_gotoxy',
                inputs: [
                    {
                        name: 'X',
                        block: expectedInfo.makeNumber(12)
                    },
                    {
                        name: 'Y',
                        block: expectedInfo.makeNumber(34)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        code = 'go_to([x, y])';
        expected = [
            {
                opcode: 'motion_gotoxy',
                inputs: [
                    {
                        name: 'X',
                        block: (await rubyToExpected(converter, target, 'x'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    },
                    {
                        name: 'Y',
                        block: (await rubyToExpected(converter, target, 'y'))[0],
                        shadow: expectedInfo.makeNumber(0)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        { for (const s of [
            'go_to([])',
            'go_to([12])',
            'go_to([12, 34, 56])',
            'go_to([12, 34], secs: 5)',
            'go_to(["12", "34"])',
            'go_to([abc, abc])'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        } }
    });
});
