import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    rubyToExpected,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/MicrobitMore', () => {
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

    test('microbit_more.when_pin_connected', async () => {
        code = 'microbit_more.when_pin_connected(0) do; end';
        expected = [
            {
                opcode: 'microbitMore_whenPinConnected',
                fields: [
                    {
                        name: 'PIN',
                        value: 'P0'
                    }
                ],
                next: null,
                parent: null,
                topLevel: true
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.tilted?', async () => {
        code = 'microbit_more.tilted?("any")';
        expected = [
            {
                opcode: 'microbitMore_isTilted',
                fields: [
                    {
                        name: 'DIRECTION',
                        value: 'ANY'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.tilt_angle', async () => {
        code = 'microbit_more.tilt_angle("front")';
        expected = [
            {
                opcode: 'microbitMore_getTiltAngle',
                fields: [
                    {
                        name: 'DIRECTION',
                        value: 'FRONT'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.when(moved)', async () => {
        code = 'microbit_more.when("moved") do; end';
        expected = [
            {
                opcode: 'microbitMore_whenGesture',
                fields: [
                    {
                        name: 'GESTURE',
                        value: 'MOVED'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.when_tilted', async () => {
        code = 'microbit_more.when_tilted("any") do; end';
        expected = [
            {
                opcode: 'microbitMore_whenTilted',
                fields: [
                    {
                        name: 'DIRECTION',
                        value: 'ANY'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.when(tilted_any)', async () => {
        code = 'microbit_more.when("tilted_any") do; end';
        expected = [
            {
                opcode: 'microbitMore_whenGesture',
                fields: [
                    {
                        name: 'GESTURE',
                        value: 'TILTED'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.when(tilted_front)', async () => {
        code = 'microbit_more.when("tilted_front") do; end';
        expected = [
            {
                opcode: 'microbitMore_whenGesture',
                fields: [
                    {
                        name: 'GESTURE',
                        value: 'TILT_UP'
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.display_text', async () => {
        code = 'microbit_more.display_text("Hello!")';
        expected = [
            {
                opcode: 'microbitMore_display',
                inputs: [
                    {
                        name: 'TEXT',
                        block: expectedInfo.makeText('Hello!')
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.display_text_delay', async () => {
        code = 'microbit_more.display_text_delay("Hello!", 120)';
        expected = [
            {
                opcode: 'microbitMore_displayText',
                inputs: [
                    {
                        name: 'TEXT',
                        block: expectedInfo.makeText('Hello!')
                    },
                    {
                        name: 'DELAY',
                        block: expectedInfo.makeNumber(120)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
