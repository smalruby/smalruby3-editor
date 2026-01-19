import RubyGenerator from '../../../../src/lib/ruby-generator';
import MicrobitMoreBlocks from '../../../../src/lib/ruby-generator/microbit_more';

describe('RubyGenerator/MicrobitMore', () => {
    beforeEach(() => {
        RubyGenerator.cache_ = {};
        RubyGenerator.definitions_ = {};
        RubyGenerator.functionNames_ = {};
        RubyGenerator.currentTarget = null;
        MicrobitMoreBlocks(RubyGenerator);
    });

    test('microbitMore_whenPinConnected', () => {
        const block = {
            opcode: 'microbitMore_whenPinConnected',
            fields: {
                PIN: {
                    value: 'P0'
                }
            }
        };
        const expected = 'microbit.when_pin_connected(0) do\n';
        expect(RubyGenerator.microbitMore_whenPinConnected(block)).toEqual(expected);
    });

    test('microbitMore_whenTilted', () => {
        const block = {
            opcode: 'microbitMore_whenTilted',
            fields: {
                DIRECTION: {
                    value: 'ANY'
                }
            }
        };
        const expected = 'microbit.when_tilted("any") do\n';
        expect(RubyGenerator.microbitMore_whenTilted(block)).toEqual(expected);
    });

    test('microbitMore_isTilted', () => {
        const block = {
            opcode: 'microbitMore_isTilted',
            fields: {
                DIRECTION: {
                    value: 'ANY'
                }
            }
        };
        const result = RubyGenerator.microbitMore_isTilted(block);
        expect(result[0]).toEqual('microbit.tilted?("any")');
    });

    test('microbitMore_getTiltAngle', () => {
        const block = {
            opcode: 'microbitMore_getTiltAngle',
            fields: {
                DIRECTION: {
                    value: 'FRONT'
                }
            }
        };
        const result = RubyGenerator.microbitMore_getTiltAngle(block);
        expect(result[0]).toEqual('microbit.tilt_angle("front")');
    });

    test('microbitMore_whenGesture(MOVED)', () => {
        const block = {
            opcode: 'microbitMore_whenGesture',
            fields: {
                GESTURE: {
                    value: 'MOVED'
                }
            }
        };
        const expected = 'microbit.when("moved") do\n';
        expect(RubyGenerator.microbitMore_whenGesture(block)).toEqual(expected);
    });

    test('microbitMore_whenGesture(TILTED)', () => {
        const block = {
            opcode: 'microbitMore_whenGesture',
            fields: {
                GESTURE: {
                    value: 'TILTED'
                }
            }
        };
        const expected = 'microbit.when("tilted_any") do\n';
        expect(RubyGenerator.microbitMore_whenGesture(block)).toEqual(expected);
    });

    test('microbitMore_whenGesture(TILT_UP)', () => {
        const block = {
            opcode: 'microbitMore_whenGesture',
            fields: {
                GESTURE: {
                    value: 'TILT_UP'
                }
            }
        };
        const expected = 'microbit.when("tilted_front") do\n';
        expect(RubyGenerator.microbitMore_whenGesture(block)).toEqual(expected);
    });

    test('microbitMore_display', () => {
        const block = {
            opcode: 'microbitMore_display',
            inputs: {
                TEXT: {
                    name: 'TEXT'
                }
            }
        };
        RubyGenerator.valueToCode = jest.fn().mockReturnValue('"Hello!"');
        const expected = 'microbit.display_text("Hello!")\n';
        expect(RubyGenerator.microbitMore_display(block)).toEqual(expected);
    });

    test('microbitMore_displayText', () => {
        const block = {
            opcode: 'microbitMore_displayText',
            inputs: {
                TEXT: {
                    name: 'TEXT'
                },
                DELAY: {
                    name: 'DELAY'
                }
            }
        };
        RubyGenerator.valueToCode = jest.fn()
            .mockReturnValueOnce('"Hello!"')
            .mockReturnValueOnce('120');
        const expected = 'microbit.display_text_delay("Hello!", 120)\n';
        expect(RubyGenerator.microbitMore_displayText(block)).toEqual(expected);
    });
});
