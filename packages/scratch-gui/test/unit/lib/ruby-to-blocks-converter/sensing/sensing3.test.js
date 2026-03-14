import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    rubyToExpected,
    expectedInfo,
    expectNoArgsMethod
} from '../../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Sensing', () => {
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

    describe('sensing_keypressed', () => {
        test('normal', async () => {
            code = 'Keyboard.pressed?("space")';
            expected = [
                {
                    opcode: 'sensing_keypressed',
                    inputs: [
                        {
                            name: 'KEY_OPTION',
                            block: {
                                opcode: 'sensing_keyoptions',
                                fields: [
                                    {
                                        name: 'KEY_OPTION',
                                        value: 'space'
                                    }
                                ],
                                shadow: true
                            }
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'Keyboard.pressed?(x)';
            expected = [
                {
                    opcode: 'sensing_keypressed',
                    inputs: [
                        {
                            name: 'KEY_OPTION',
                            block: (await rubyToExpected(converter, target, 'x'))[0],
                            shadow: {
                                opcode: 'sensing_keyoptions',
                                fields: [
                                    {
                                        name: 'KEY_OPTION',
                                        value: 'space'
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

        test('value_boolean', async () => {
            code = `
                bounce_if_on_edge
                Keyboard.pressed?("space")
                bounce_if_on_edge
            `;
            expected = [
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0],
                (await rubyToExpected(converter, target, 'Keyboard.pressed?("space")'))[0],
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'Keyboard.pressed?',
                'Keyboard.pressed?()',
                'Keyboard.pressed?(1)',
                'Keyboard.pressed?("invalid")',
                'Keyboard.pressed?("space", 1)'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });

        test('error', async () => {
            code = `
                forever do
                  Keyboard.pressed?("space")
                end
            `;
            const res = await converter.targetCodeToBlocks(target, code);
            expect(converter.errors).toHaveLength(1);
            expect(res).toBeFalsy();
        });
    });

    expectNoArgsMethod('sensing_mousedown', 'Mouse.down?', 'value_boolean');
    expectNoArgsMethod('sensing_mousex', 'Mouse.x', 'value');
    expectNoArgsMethod('sensing_mousey', 'Mouse.y', 'value');

    describe('sensing_setdragmode', () => {
        test('normal', async () => {
            code = 'self.drag_mode = "draggable"';
            expected = [
                {
                    opcode: 'sensing_setdragmode',
                    fields: [
                        {
                            name: 'DRAG_MODE',
                            value: 'draggable'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'self.drag_mode = "not draggable"';
            expected = [
                {
                    opcode: 'sensing_setdragmode',
                    fields: [
                        {
                            name: 'DRAG_MODE',
                            value: 'not draggable'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('true/false', async () => {
            code = 'self.drag_mode = true';
            expected = [
                {
                    opcode: 'sensing_setdragmode',
                    fields: [
                        {
                            name: 'DRAG_MODE',
                            value: 'draggable'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);

            code = 'self.drag_mode = false';
            expected = [
                {
                    opcode: 'sensing_setdragmode',
                    fields: [
                        {
                            name: 'DRAG_MODE',
                            value: 'not draggable'
                        }
                    ]
                }
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('statement', async () => {
            code = `
                bounce_if_on_edge
                self.drag_mode = "draggable"
                bounce_if_on_edge
            `;
            expected = [
                (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0]
            ];
            expected[0].next = (await rubyToExpected(converter, target, 'self.drag_mode = "draggable"'))[0];
            expected[0].next.next = (await rubyToExpected(converter, target, 'bounce_if_on_edge'))[0];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        });

        test('invalid', async () => {
            { for (const c of [
                'self.drag_mode',
                'self.drag_mode()',
                'self.drag_mode = "invalid"',
                'self.drag_mode = 1'
            ]) {
                await convertAndExpectRubyBlockError(converter, target, c);
            } }
        });
    });

    expectNoArgsMethod('sensing_loudness', 'loudness', 'value');
    expectNoArgsMethod('sensing_timer', 'Timer.value', 'value');
    expectNoArgsMethod('sensing_resettimer', 'Timer.reset');

});
