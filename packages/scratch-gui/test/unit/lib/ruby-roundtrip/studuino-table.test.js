/**
 * Studuino (Smalrubot S1) blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of Studuino move into a send table (issue #2090);
 * ruby-roundtrip/extension_smalrubot_s1.test.js stays as the long round trip.
 *
 * The blocks write `studuino.`; the older `smalrubot_s1.` is still read (#2190), so each row of
 * `studuino.` is also read as `smalrubot_s1.`.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const rows = [
    { blocks: 'smalrubotS1_action(ACTION = "forward")', ruby: 'studuino.action("forward")' },
    { blocks: 'smalrubotS1_action(ACTION = "stop")', ruby: 'studuino.action("stop")' },
    {
        blocks: 'smalrubotS1_actionAndStopAfter(ACTION = "left", SECS: 0.5)',
        ruby: 'studuino.action("left", 0.5)',
    },
    {
        blocks: 'smalrubotS1_actionAndStopAfter(ACTION = "right", SECS: $s)',
        ruby: 'studuino.action("right", $s)',
    },
    { blocks: 'smalrubotS1_bendArm(DEGREE: 90, SECS: 1)', ruby: 'studuino.bend_arm(90, 1)' },
    { blocks: 'smalrubotS1_bendArm(DEGREE: $d, SECS: $s)', ruby: 'studuino.bend_arm($d, $s)' },
    {
        blocks: 'looks_say(MESSAGE: smalrubotS1_getSensorValue(POSITION = "light"))',
        ruby: 'say(studuino.sensor_value("light"))',
    },
    {
        blocks: 'looks_say(MESSAGE: smalrubotS1_getSensorValue(POSITION = "ir_a4"))',
        ruby: 'say(studuino.sensor_value("ir_a4"))',
    },
    { blocks: 'smalrubotS1_turnLedOn(POSITION = "left")', ruby: 'studuino.led("left", true)' },
    { blocks: 'smalrubotS1_turnLedOff(POSITION = "right")', ruby: 'studuino.led("right", false)' },
    {
        blocks: 'looks_say(MESSAGE: smalrubotS1_getMotorSpeed(POSITION = "right"))',
        ruby: 'say(studuino.get_motor_speed("right"))',
    },
    {
        blocks: 'smalrubotS1_setMotorSpeed(POSITION = "left", SPEED: 100)',
        ruby: 'studuino.set_motor_speed("left", 100)',
    },
    {
        blocks: 'smalrubotS1_setMotorSpeed(POSITION = "right", SPEED: $v)',
        ruby: 'studuino.set_motor_speed("right", $v)',
    },
    {
        blocks: 'smalrubotS1_controlMotor(MOTOR = "M1", DIRECTION = "normal")',
        ruby: 'studuino.dc_motor("M1", "normal")',
    },
    {
        blocks: 'smalrubotS1_controlMotor(MOTOR = "M2", DIRECTION = "stop")',
        ruby: 'studuino.dc_motor("M2", "stop")',
    },
    {
        blocks: 'smalrubotS1_controlMotorAndStopAfter(MOTOR = "M2", DIRECTION = "reverse", SECS: 0.5)',
        ruby: 'studuino.dc_motor("M2", "reverse", 0.5)',
    },
    {
        blocks: 'smalrubotS1_controlMotorAndStopAfter(MOTOR = "M1", DIRECTION = "normal", SECS: $s)',
        ruby: 'studuino.dc_motor("M1", "normal", $s)',
    },
    { blocks: 'smalrubotS1_setArmCalibration(DEGREE: 0)', ruby: 'studuino.arm_calibration = 0' },
    { blocks: 'smalrubotS1_setArmCalibration(DEGREE: $d)', ruby: 'studuino.arm_calibration = $d' },
];

// The older receiver: read only (the blocks write `studuino.`).
const oldRows = rows.map((row) => ({
    ...row,
    name: `old receiver: ${row.ruby.replace('studuino.', 'smalrubot_s1.')}`,
    ruby: row.ruby.replace('studuino.', 'smalrubot_s1.'),
    only: 'toBlocks',
}));

defineBlockRubyTable('Studuino blocks ⇔ Ruby', [...rows, ...oldRows], { versions: ['1', '2'] });

defineBlockRubyTable(
    'Studuino blocks ⇔ Ruby (stage)',
    [{ blocks: 'smalrubotS1_action(ACTION = "forward")', ruby: 'studuino.action("forward")' }],
    { stage: true },
);
