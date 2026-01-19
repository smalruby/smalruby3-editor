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
        converter = new RubyToBlocksConverter(null);
        target = null;
        code = null;
        expected = null;
    });

    test('microbit_more.when_pin_connected', () => {
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
        convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.tilted?', () => {
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
        convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.tilt_angle', () => {
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
        convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.when(moved)', () => {
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
        convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.when_tilted', () => {
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
        convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.when(tilted_any)', () => {
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
        convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.when(tilted_front)', () => {
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
        convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.display_text', () => {
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
        convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('microbit_more.display_text_delay', () => {
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
        convertAndExpectToEqualBlocks(converter, target, code, expected);
    });
});
