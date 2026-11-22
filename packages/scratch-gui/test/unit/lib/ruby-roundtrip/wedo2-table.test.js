/**
 * LEGO WeDo 2.0 blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of WeDo 2.0 move into a send table
 * (issue #2090); ruby-roundtrip/extension_wedo2.test.js stays as the long round trip.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const menu = (name, value) => `wedo2_menu_${name}(${name} = "${value}")`;
const motor = (value) => menu('MOTOR_ID', value);

const rows = [
    {
        blocks: `wedo2_motorOnFor(MOTOR_ID: ${motor('motor A')}, DURATION: 1)`,
        ruby: 'wedo2.turn_on_for("motor A", 1)',
    },
    {
        blocks: `wedo2_motorOnFor(MOTOR_ID: ${motor('all motors')}, DURATION: 1)`,
        ruby: 'wedo2.turn_on_for("ALL MOTORS", 1)',
        only: 'toBlocks',
    },
    { blocks: 'wedo2_motorOnFor(MOTOR_ID: $m, DURATION: $d)', ruby: 'wedo2.turn_on_for($m, $d)' },
    { blocks: `wedo2_motorOn(MOTOR_ID: ${motor('motor')})`, ruby: 'wedo2.turn_on("motor")' },
    { blocks: `wedo2_motorOff(MOTOR_ID: ${motor('motor B')})`, ruby: 'wedo2.turn_off("motor B")' },
    { blocks: 'wedo2_motorOff(MOTOR_ID: $m)', ruby: 'wedo2.turn_off($m)' },
    {
        blocks: `wedo2_startMotorPower(MOTOR_ID: ${motor('motor')}, POWER: 100)`,
        ruby: 'wedo2.set_power("motor", 100)',
    },
    {
        blocks: `wedo2_setMotorDirection(MOTOR_ID: ${motor('motor')}, MOTOR_DIRECTION: ${menu('MOTOR_DIRECTION', 'that way')})`,
        ruby: 'wedo2.set_direction("motor", "that way")',
    },
    {
        blocks: `wedo2_setMotorDirection(MOTOR_ID: ${motor('motor A')}, MOTOR_DIRECTION: ${menu('MOTOR_DIRECTION', 'this way')})`,
        ruby: 'wedo2.set_direction("motor a", "THIS WAY")',
        only: 'toBlocks',
    },
    { blocks: 'wedo2_setMotorDirection(MOTOR_ID: $m, MOTOR_DIRECTION: $d)', ruby: 'wedo2.set_direction($m, $d)' },
    { blocks: 'wedo2_setLightHue(HUE: 50)', ruby: 'wedo2.light_color = 50' },
    { blocks: 'wedo2_setLightHue(HUE: $h)', ruby: 'wedo2.light_color = $h' },
    {
        blocks: `
            wedo2_whenDistance(OP: ${menu('OP', '>')}, REFERENCE: 50)
            motion_movesteps(STEPS: 10)
        `,
        ruby: `
            wedo2.when_distance(">", 50) do
              move(10)
            end
        `,
    },
    { blocks: 'wedo2_whenDistance(OP: $o, REFERENCE: $r)', ruby: 'wedo2.when_distance($o, $r) do\nend' },
    {
        blocks: `wedo2_whenTilted(TILT_DIRECTION_ANY: ${menu('TILT_DIRECTION_ANY', 'left')})`,
        ruby: 'wedo2.when_tilted("left") do\nend',
    },
    {
        blocks: `wedo2_whenTilted(TILT_DIRECTION_ANY: ${menu('TILT_DIRECTION_ANY', 'any')})`,
        ruby: 'wedo2.when_tilted("ANY") do\nend',
        only: 'toBlocks',
    },
    { blocks: 'looks_say(MESSAGE: wedo2_getDistance)', ruby: 'say(wedo2.distance)' },
    {
        blocks: `looks_say(MESSAGE: wedo2_isTilted(TILT_DIRECTION_ANY: ${menu('TILT_DIRECTION_ANY', 'any')}))`,
        ruby: 'say(wedo2.tilted?("any"))',
        // The generator writes this reporter as a statement (a string, not [code, order]), so inside a
        // value it comes out broken (`say(w)`). Only the converter is fixed here.
        only: 'toBlocks',
    },
    {
        blocks: `looks_say(MESSAGE: wedo2_getTiltAngle(TILT_DIRECTION: ${menu('TILT_DIRECTION', 'up')}))`,
        ruby: 'say(wedo2.tilt_angle("up"))',
    },
    { blocks: 'looks_say(MESSAGE: wedo2_getTiltAngle(TILT_DIRECTION: $t))', ruby: 'say(wedo2.tilt_angle($t))' },
];

defineBlockRubyTable('LEGO WeDo 2.0 blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'LEGO WeDo 2.0 blocks ⇔ Ruby (stage)',
    [{ blocks: `wedo2_motorOn(MOTOR_ID: ${motor('motor')})`, ruby: 'wedo2.turn_on("motor")' }],
    { stage: true },
);
