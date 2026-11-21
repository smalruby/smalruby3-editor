/**
 * Go Direct Force & Acceleration blocks ⇔ Ruby, as a table (block notation:
 * test/unit/helpers/block-notation.js). It fixes the output of the converter before the calls of
 * the extension move into a send table (issue #2090).
 *
 * The menus take any string as it is (no check of the choices), or a value block in place of the menu.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const menu = (name, value) => `gdxfor_menu_${name}(${name} = "${value}")`;

const rows = [
    {
        blocks: `looks_say(MESSAGE: gdxfor_getAcceleration(DIRECTION: ${menu('axisOptions', 'x')}))`,
        ruby: 'say(gdx_for.acceleration("x"))',
    },
    { blocks: 'looks_say(MESSAGE: gdxfor_getAcceleration(DIRECTION: $d))', ruby: 'say(gdx_for.acceleration($d))' },
    { blocks: 'looks_say(MESSAGE: gdxfor_getForce)', ruby: 'say(gdx_for.force)' },
    {
        blocks: `looks_say(MESSAGE: gdxfor_isTilted(TILT: ${menu('tiltAnyOptions', 'any')}))`,
        ruby: 'say(gdx_for.tilted?("any"))',
    },
    {
        blocks: `looks_say(MESSAGE: gdxfor_getTilt(TILT: ${menu('tiltOptions', 'front')}))`,
        ruby: 'say(gdx_for.tilt_angle("front"))',
    },
    {
        blocks: `looks_say(MESSAGE: gdxfor_getTilt(TILT: ${menu('tiltOptions', 'whatever')}))`,
        ruby: 'say(gdx_for.tilt_angle("whatever"))',
        only: 'toBlocks',
    },
    { blocks: 'looks_say(MESSAGE: gdxfor_isFreeFalling)', ruby: 'say(gdx_for.falling?)' },
    {
        blocks: `looks_say(MESSAGE: gdxfor_getSpinSpeed(DIRECTION: ${menu('axisOptions', 'z')}))`,
        ruby: 'say(gdx_for.spin_speed("z"))',
    },
    {
        blocks: `
            gdxfor_whenGesture(GESTURE: ${menu('gestureOptions', 'shaken')})
            motion_movesteps(STEPS: 10)
        `,
        ruby: `
            gdx_for.when_gesture("shaken") do
              move(10)
            end
        `,
    },
    { blocks: 'gdxfor_whenGesture(GESTURE: $g)', ruby: 'gdx_for.when_gesture($g) do\nend' },
    {
        blocks: `gdxfor_whenForcePushedOrPulled(PUSH_PULL: ${menu('pushPullOptions', 'pulled')})`,
        ruby: 'gdx_for.when_sensor("pulled") do\nend',
    },
    {
        blocks: `gdxfor_whenTilted(TILT: ${menu('tiltAnyOptions', 'left')})`,
        ruby: 'gdx_for.when_tilted("left") do\nend',
    },
    // The old names without the receiver (backward compatibility).
    {
        blocks: `looks_say(MESSAGE: gdxfor_getAcceleration(DIRECTION: ${menu('axisOptions', 'y')}))`,
        ruby: 'say(gdx_for_acceleration("y"))',
        only: 'toBlocks',
    },
    { blocks: 'looks_say(MESSAGE: gdxfor_getForce)', ruby: 'say(gdx_for_force)', only: 'toBlocks' },
    {
        blocks: `looks_say(MESSAGE: gdxfor_isTilted(TILT: ${menu('tiltAnyOptions', 'back')}))`,
        ruby: 'say(gdx_for_tilted?("back"))',
        only: 'toBlocks',
    },
    {
        blocks: `looks_say(MESSAGE: gdxfor_getTilt(TILT: ${menu('tiltOptions', 'right')}))`,
        ruby: 'say(self.gdx_for_tilt_angle("right"))',
        only: 'toBlocks',
    },
    { blocks: 'looks_say(MESSAGE: gdxfor_isFreeFalling)', ruby: 'say(gdx_for_falling?)', only: 'toBlocks' },
    {
        blocks: 'looks_say(MESSAGE: gdxfor_getSpinSpeed(DIRECTION: $d))',
        ruby: 'say(gdx_for_spin_speed($d))',
        only: 'toBlocks',
    },
    {
        blocks: `gdxfor_whenGesture(GESTURE: ${menu('gestureOptions', 'free fall')})`,
        ruby: 'self.when(:gdx_for_gesture, "free fall") do\nend',
        only: 'toBlocks',
    },
    {
        blocks: `gdxfor_whenForcePushedOrPulled(PUSH_PULL: ${menu('pushPullOptions', 'pushed')})`,
        ruby: 'self.when(:gdx_force_sensor, "pushed") do\nend',
        only: 'toBlocks',
    },
    {
        blocks: `gdxfor_whenTilted(TILT: ${menu('tiltAnyOptions', 'any')})`,
        ruby: 'self.when(:gdx_for_tilted, "any") do\nend',
        only: 'toBlocks',
    },
];

defineBlockRubyTable('Go Direct Force & Acceleration blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'Go Direct Force & Acceleration blocks ⇔ Ruby (stage)',
    [
        {
            blocks: `gdxfor_whenTilted(TILT: ${menu('tiltAnyOptions', 'left')})`,
            ruby: 'gdx_for.when_tilted("left") do\nend',
        },
    ],
    { stage: true },
);
