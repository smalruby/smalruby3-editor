import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    expectedInfo,
} from '../../../helpers/expect-to-equal-blocks';

// `studuino.` is what the blocks write; `smalrubot_s1.` is still read (#2190). Every row runs with both.
describe.each(['studuino', 'smalrubot_s1'])('RubyToBlocksConverter/SmalrubotS1 (%s.)', (receiver) => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, { version: '2' });
        target = null;
        code = null;
        expected = null;
    });

    test('smalrubotS1_action', async () => {
        const actions = ['forward', 'backward', 'left', 'right', 'stop'];
        for (const action of actions) {
            code = `${receiver}.action("${action}")`;
            expected = [
                {
                    opcode: 'smalrubotS1_action',
                    fields: [
                        {
                            name: 'ACTION',
                            value: action,
                        },
                    ],
                },
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        {
            for (const s of [
                `${receiver}.action`,
                `${receiver}.action()`,
                `${receiver}.action(1)`,
                `${receiver}.action("invalid action")`,
            ]) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        }
    });

    test('smalrubotS1_actionAndStopAfter', async () => {
        const actions = ['forward', 'backward', 'left', 'right', 'stop'];
        for (const action of actions) {
            code = `${receiver}.action("${action}", 0.5)`;
            expected = [
                {
                    opcode: 'smalrubotS1_actionAndStopAfter',
                    inputs: [
                        {
                            name: 'SECS',
                            block: expectedInfo.makeNumber(0.5),
                        },
                    ],
                    fields: [
                        {
                            name: 'ACTION',
                            value: action,
                        },
                    ],
                },
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        {
            for (const s of [
                `${receiver}.action("left", "invalid sec")`,
                `${receiver}.action("left", 0.5, "invalid argument")`,
            ]) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        }
    });

    test('smalrubotS1_bendArm', async () => {
        code = `${receiver}.bend_arm(90, 1)`;
        expected = [
            {
                opcode: 'smalrubotS1_bendArm',
                inputs: [
                    {
                        name: 'DEGREE',
                        block: expectedInfo.makeNumber(90),
                    },
                    {
                        name: 'SECS',
                        block: expectedInfo.makeNumber(1),
                    },
                ],
            },
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        {
            for (const s of [
                `${receiver}.bend_arm`,
                `${receiver}.bend_arm()`,
                `${receiver}.bend_arm(90)`,
                `${receiver}.bend_arm(90, 1, 2)`,
                `${receiver}.bend_arm("90", 1)`,
                `${receiver}.bend_arm(90, "1")`,
                `${receiver}.bend_arm("90", "1")`,
            ]) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        }
    });

    test('smalrubotS1_getSensorValue', async () => {
        const positions = ['left', 'right', 'touch', 'light', 'sound', 'ir_a4', 'ir_a5'];
        for (const position of positions) {
            code = `${receiver}.sensor_value("${position}")`;
            expected = [
                {
                    opcode: 'smalrubotS1_getSensorValue',
                    fields: [
                        {
                            name: 'POSITION',
                            value: position,
                        },
                    ],
                },
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        {
            for (const s of [
                `${receiver}.sensor_value`,
                `${receiver}.sensor_value()`,
                `${receiver}.sensor_value("invalid position")`,
                `${receiver}.sensor_value("left", "invalid argument")`,
                `${receiver}.sensor_value(1)`,
            ]) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        }
    });

    test('smalrubotS1_turnLedOn', async () => {
        const positions = ['left', 'right'];
        for (const position of positions) {
            code = `${receiver}.led("${position}", true)`;
            expected = [
                {
                    opcode: 'smalrubotS1_turnLedOn',
                    fields: [
                        {
                            name: 'POSITION',
                            value: position,
                        },
                    ],
                },
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        {
            for (const s of [
                `${receiver}.led`,
                `${receiver}.led(1)`,
                `${receiver}.led("invalid position", true)`,
                `${receiver}.led("left", "invalid state")`,
                `${receiver}.led("left", true, "invalid argument")`,
            ]) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        }
    });

    test('smalrubotS1_turnLedOff', async () => {
        const positions = ['left', 'right'];
        for (const position of positions) {
            code = `${receiver}.led("${position}", false)`;
            expected = [
                {
                    opcode: 'smalrubotS1_turnLedOff',
                    fields: [
                        {
                            name: 'POSITION',
                            value: position,
                        },
                    ],
                },
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        {
            for (const s of [
                `${receiver}.led("invalid position", false)`,
                `${receiver}.led("left", false, "invalid argument")`,
            ]) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        }
    });

    test('smalrubotS1_getMotorSpeed', async () => {
        const positions = ['left', 'right'];
        for (const position of positions) {
            code = `${receiver}.get_motor_speed("${position}")`;
            expected = [
                {
                    opcode: 'smalrubotS1_getMotorSpeed',
                    fields: [
                        {
                            name: 'POSITION',
                            value: position,
                        },
                    ],
                },
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        {
            for (const s of [
                `${receiver}.get_motor_speed`,
                `${receiver}.get_motor_speed()`,
                `${receiver}.get_motor_speed("left", "invalid speed")`,
                `${receiver}.get_motor_speed(1)`,
            ]) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        }
    });

    test('smalrubotS1_setMotorSpeed', async () => {
        const positions = ['left', 'right'];
        for (const position of positions) {
            code = `${receiver}.set_motor_speed("${position}", 100)`;
            expected = [
                {
                    opcode: 'smalrubotS1_setMotorSpeed',
                    inputs: [
                        {
                            name: 'SPEED',
                            block: expectedInfo.makeNumber(100),
                        },
                    ],
                    fields: [
                        {
                            name: 'POSITION',
                            value: position,
                        },
                    ],
                },
            ];
            await convertAndExpectToEqualBlocks(converter, target, code, expected);
        }

        {
            for (const s of [
                `${receiver}.set_motor_speed`,
                `${receiver}.set_motor_speed()`,
                `${receiver}.set_motor_speed("left")`,
                `${receiver}.set_motor_speed("left", "invalid speed")`,
                `${receiver}.set_motor_speed(1, 100)`,
                `${receiver}.set_motor_speed("left", 100, "invalid argument")`,
            ]) {
                await convertAndExpectRubyBlockError(converter, target, s);
            }
        }
    });
    test('smalrubotS1_controlMotor', async () => {
        for (const motor of ['M1', 'M2']) {
            for (const direction of ['normal', 'reverse', 'stop']) {
                code = `${receiver}.dc_motor("${motor}", "${direction}")`;
                expected = [
                    {
                        opcode: 'smalrubotS1_controlMotor',
                        fields: [
                            { name: 'MOTOR', value: motor },
                            { name: 'DIRECTION', value: direction },
                        ],
                    },
                ];
                await convertAndExpectToEqualBlocks(converter, target, code, expected);
            }
        }

        for (const s of [
            `${receiver}.dc_motor`,
            `${receiver}.dc_motor("M1")`,
            `${receiver}.dc_motor("M3", "normal")`,
            `${receiver}.dc_motor("M1", "forward")`,
            `${receiver}.dc_motor(1, "normal")`,
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        }
    });

    test('smalrubotS1_controlMotorAndStopAfter', async () => {
        code = `${receiver}.dc_motor("M2", "reverse", 0.25)`;
        expected = [
            {
                opcode: 'smalrubotS1_controlMotorAndStopAfter',
                inputs: [
                    {
                        name: 'SECS',
                        block: expectedInfo.makeNumber(0.25),
                    },
                ],
                fields: [
                    { name: 'MOTOR', value: 'M2' },
                    { name: 'DIRECTION', value: 'reverse' },
                ],
            },
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);

        for (const s of [
            `${receiver}.dc_motor("M1", "normal", "invalid sec")`,
            `${receiver}.dc_motor("M1", "normal", 0.5, 1)`,
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        }
    });
});
