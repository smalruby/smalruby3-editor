/**
 * LEGO MINDSTORMS EV3 blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of EV3 move into a send table (issue #2090);
 * ruby-roundtrip/extension_lego_mindstorms_ev3.test.js stays as the long round trip.
 *
 * The menus of the ports keep the index of the port (`"A"` → `"0"`), and a port that is not in the
 * menu becomes `"-1"` (as before).
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const motor = (index) => `ev3_menu_motorPorts(motorPorts = "${index}")`;
const sensor = (index) => `ev3_menu_sensorPorts(sensorPorts = "${index}")`;
const note = (value) => `shadow note(NOTE = "${value}")`;

const rows = [
    {
        blocks: `ev3_motorTurnClockwise(PORT: ${motor(0)}, TIME: 1)`,
        ruby: 'ev3.motor_turn_this_way_for("A", 1)',
    },
    {
        blocks: `ev3_motorTurnClockwise(PORT: ${motor(1)}, TIME: $t)`,
        ruby: 'ev3.motor_turn_this_way_for("B", $t)',
    },
    {
        blocks: `ev3_motorTurnCounterClockwise(PORT: ${motor(3)}, TIME: 2)`,
        ruby: 'ev3.motor_turn_that_way_for("D", 2)',
    },
    {
        blocks: `ev3_motorSetPower(PORT: ${motor(2)}, POWER: 100)`,
        ruby: 'ev3.motor_set_power("C", 100)',
    },
    {
        blocks: `ev3_motorSetPower(PORT: ${motor(-1)}, POWER: 50)`,
        ruby: 'ev3.motor_set_power("E", 50)',
        only: 'toBlocks',
    },
    {
        blocks: `looks_say(MESSAGE: ev3_getMotorPosition(PORT: ${motor(2)}))`,
        ruby: 'say(ev3.motor_position("C"))',
    },
    {
        blocks: `looks_say(MESSAGE: ev3_buttonPressed(PORT: ${sensor(0)}))`,
        ruby: 'say(ev3.button_pressed?("1"))',
    },
    { blocks: 'looks_say(MESSAGE: ev3_getDistance)', ruby: 'say(ev3.distance)' },
    { blocks: 'looks_say(MESSAGE: ev3_getBrightness)', ruby: 'say(ev3.brightness)' },
    { blocks: `ev3_beep(NOTE: ${note(60)}, TIME: 0.5)`, ruby: 'ev3.beep_note(60, 0.5)' },
    { blocks: 'ev3_beep(NOTE: $n, TIME: $t)', ruby: 'ev3.beep_note($n, $t)' },
    {
        blocks: `
            ev3_whenButtonPressed(PORT: ${sensor(1)})
            motion_movesteps(STEPS: 10)
        `,
        ruby: `
            ev3.when_button_pressed("2") do
              move(10)
            end
        `,
    },
    { blocks: 'ev3_whenDistanceLessThan(DISTANCE: 5)', ruby: 'ev3.when_distance_lt(5) do\nend' },
    { blocks: 'ev3_whenDistanceLessThan(DISTANCE: $d)', ruby: 'ev3.when_distance_lt($d) do\nend' },
    { blocks: 'ev3_whenBrightnessLessThan(DISTANCE: 50)', ruby: 'ev3.when_brightness_lt(50) do\nend' },
    // The old names without the receiver (backward compatibility).
    {
        blocks: `ev3_motorTurnClockwise(PORT: ${motor(0)}, TIME: 1)`,
        ruby: 'ev3_motor_turn_this_way_for("A", 1)',
        only: 'toBlocks',
    },
    {
        blocks: `ev3_motorTurnCounterClockwise(PORT: ${motor(1)}, TIME: 1)`,
        ruby: 'ev3_motor_turn_that_way_for("B", 1)',
        only: 'toBlocks',
    },
    {
        blocks: `ev3_motorSetPower(PORT: ${motor(0)}, POWER: 100)`,
        ruby: 'self.ev3_motor_set_power("A", 100)',
        only: 'toBlocks',
    },
    {
        blocks: `looks_say(MESSAGE: ev3_getMotorPosition(PORT: ${motor(3)}))`,
        ruby: 'say(ev3_motor_position("D"))',
        only: 'toBlocks',
    },
    {
        blocks: `looks_say(MESSAGE: ev3_buttonPressed(PORT: ${sensor(3)}))`,
        ruby: 'say(ev3_button_pressed?("4"))',
        only: 'toBlocks',
    },
    { blocks: 'looks_say(MESSAGE: ev3_getDistance)', ruby: 'say(ev3_distance)', only: 'toBlocks' },
    { blocks: 'looks_say(MESSAGE: ev3_getBrightness)', ruby: 'say(ev3_brightness)', only: 'toBlocks' },
    { blocks: `ev3_beep(NOTE: ${note(62)}, TIME: 1)`, ruby: 'ev3_beep_note(62, 1)', only: 'toBlocks' },
    {
        blocks: `ev3_whenButtonPressed(PORT: ${sensor(2)})`,
        ruby: 'self.when(:ev3_button_pressed, "3") do\nend',
        only: 'toBlocks',
    },
    {
        blocks: 'ev3_whenDistanceLessThan(DISTANCE: 10)',
        ruby: 'self.when(:ev3_distance_gt, 10) do\nend',
        only: 'toBlocks',
    },
    {
        blocks: 'ev3_whenBrightnessLessThan(DISTANCE: 20)',
        ruby: 'self.when(:ev3_brightness_gt, 20) do\nend',
        only: 'toBlocks',
    },
];

defineBlockRubyTable('LEGO MINDSTORMS EV3 blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'LEGO MINDSTORMS EV3 blocks ⇔ Ruby (stage)',
    [
        { blocks: `ev3_beep(NOTE: ${note(60)}, TIME: 0.5)`, ruby: 'ev3.beep_note(60, 0.5)' },
        { blocks: `ev3_beep(NOTE: ${note(60)}, TIME: 0.5)`, ruby: 'ev3_beep_note(60, 0.5)', only: 'toBlocks' },
    ],
    { stage: true },
);
