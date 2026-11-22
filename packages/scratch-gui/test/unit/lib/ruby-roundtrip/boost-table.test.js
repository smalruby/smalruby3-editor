/**
 * LEGO BOOST blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of LEGO BOOST move into a send table
 * (issue #2090); ruby-roundtrip/extension_lego_boost.test.js stays as the long round trip.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const menu = (name, value) => `boost_menu_${name}(${name} = "${value}")`;
const motor = (value) => menu('MOTOR_ID', value);

const rows = [
    { blocks: `boost_motorOnFor(MOTOR_ID: ${motor('A')}, DURATION: 1)`, ruby: 'boost_motor_turn_on_for("A", 1)' },
    { blocks: 'boost_motorOnFor(MOTOR_ID: $m, DURATION: $d)', ruby: 'boost_motor_turn_on_for($m, $d)' },
    { blocks: `boost_motorOn(MOTOR_ID: ${motor('AB')})`, ruby: 'boost_motor_turn_on_for("AB")' },
    {
        blocks: `boost_motorOnForRotation(MOTOR_ID: ${motor('B')}, ROTATION: 2)`,
        ruby: 'boost_motor_turn_this_way_for("B", 2)',
    },
    { blocks: `boost_motorOff(MOTOR_ID: ${motor('C')})`, ruby: 'boost_motor_turn_off_for("C")' },
    { blocks: 'boost_motorOff(MOTOR_ID: $m)', ruby: 'boost_motor_turn_off_for($m)' },
    {
        blocks: `boost_setMotorPower(MOTOR_ID: ${motor('ABCD')}, POWER: 100)`,
        ruby: 'boost_motor_set_power_for("ABCD", 100)',
    },
    {
        blocks: `boost_setMotorDirection(MOTOR_ID: ${motor('A')}, MOTOR_DIRECTION: ${menu('MOTOR_DIRECTION', 'that way')})`,
        ruby: 'boost_motor_set_direction_for("A", "that way")',
    },
    {
        blocks: 'boost_setMotorDirection(MOTOR_ID: $m, MOTOR_DIRECTION: $d)',
        ruby: 'boost_motor_set_direction_for($m, $d)',
    },
    {
        blocks: `looks_say(MESSAGE: boost_getMotorPosition(MOTOR_REPORTER_ID: ${menu('MOTOR_REPORTER_ID', 'A')}))`,
        ruby: 'say(boost_motor_get_position("A"))',
        // The generator writes these reporters as statements (a string, not [code, order]), so inside
        // a value they come out broken (`say(b)`). Only the converter is fixed here.
        only: 'toBlocks',
    },
    {
        blocks: `looks_say(MESSAGE: boost_seeingColor(COLOR: ${menu('COLOR', 'red')}))`,
        ruby: 'say(boost_seeing_color?("red"))',
        // The generator writes these reporters as statements (a string, not [code, order]), so inside
        // a value they come out broken (`say(b)`). Only the converter is fixed here.
        only: 'toBlocks',
    },
    {
        blocks: `looks_say(MESSAGE: boost_getTiltAngle(TILT_DIRECTION: ${menu('TILT_DIRECTION', 'up')}))`,
        ruby: 'say(boost_get_tilt_angle("up"))',
        // The generator writes these reporters as statements (a string, not [code, order]), so inside
        // a value they come out broken (`say(b)`). Only the converter is fixed here.
        only: 'toBlocks',
    },
    { blocks: 'boost_setLightHue(HUE: 50)', ruby: 'boost_set_light_color(50)' },
    { blocks: 'boost_setLightHue(HUE: $h)', ruby: 'boost_set_light_color($h)' },
    {
        blocks: `
            boost_whenColor(COLOR: ${menu('COLOR', 'red')})
            motion_movesteps(STEPS: 10)
        `,
        ruby: `
            self.when(:boost_color, "red") do
              move(10)
            end
        `,
    },
    {
        blocks: `boost_whenTilted(TILT_DIRECTION_ANY: ${menu('TILT_DIRECTION_ANY', 'any')})`,
        ruby: 'self.when(:boost_tilted, "any") do\nend',
    },
];

defineBlockRubyTable('LEGO BOOST blocks ⇔ Ruby', rows, { versions: ['1', '2'] });
