/**
 * micro:bit (the original extension, `microbit_v1`) blocks ⇔ Ruby, as a table (block notation:
 * test/unit/helpers/block-notation.js). It fixes the output of the converter before the calls of
 * micro:bit move into a send table (issue #2090); ruby-roundtrip/extension_microbit.test.js stays as
 * the long round trip (it also has `display` with a matrix and `when_pin_connected`).
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const buttons = (value) => `microbit_menu_buttons(buttons = "${value}")`;
const gestures = (value) => `microbit_menu_gestures(gestures = "${value}")`;
const tiltAny = (value) => `microbit_menu_tiltDirectionAny(tiltDirectionAny = "${value}")`;
const tilt = (value) => `microbit_menu_tiltDirection(tiltDirection = "${value}")`;

const rows = [
    {
        blocks: `
            microbit_whenButtonPressed(BTN: ${buttons('A')})
            motion_movesteps(STEPS: 10)
        `,
        ruby: `
            microbit_v1.when_button_pressed("A") do
              move(10)
            end
        `,
    },
    {
        blocks: `microbit_whenButtonPressed(BTN: ${buttons('any')})`,
        ruby: 'microbit_v1.when_button_pressed("ANY") do\nend',
        only: 'toBlocks',
    },
    {
        blocks: `microbit_whenButtonPressed(BTN: ${buttons('B')})`,
        ruby: 'microbit_v1.when_button_pressed("b") do\nend',
        only: 'toBlocks',
    },
    { blocks: 'microbit_whenButtonPressed(BTN: $b)', ruby: 'microbit_v1.when_button_pressed($b) do\nend' },
    {
        blocks: `looks_say(MESSAGE: microbit_isButtonPressed(BTN: ${buttons('A')}))`,
        ruby: 'say(microbit_v1.button_pressed?("A"))',
    },
    {
        blocks: `looks_say(MESSAGE: microbit_isButtonPressed(BTN: ${buttons('A')}))`,
        ruby: 'say(microbit_v1.button_pressed?("a"))',
        only: 'toBlocks',
    },
    {
        blocks: `microbit_whenGesture(GESTURE: ${gestures('shaken')})`,
        ruby: 'microbit_v1.when("shaken") do\nend',
        // Ruby v1 writes `self.when(:microbit_gesture, ...)` (the row below).
        versions: ['2'],
    },
    {
        blocks: `microbit_whenGesture(GESTURE: ${gestures('jumped')})`,
        ruby: 'microbit_v1.when("JUMPED") do\nend',
        only: 'toBlocks',
    },
    {
        blocks: `microbit_whenGesture(GESTURE: ${gestures('moved')})`,
        ruby: 'self.when(:microbit_gesture, "moved") do\nend',
        versions: ['1'],
    },
    {
        blocks: `microbit_whenButtonPressed(BTN: ${buttons('B')})`,
        ruby: 'self.when(:microbit_button_pressed, "B") do\nend',
        only: 'toBlocks',
    },
    {
        blocks: `microbit_whenTilted(DIRECTION: ${tiltAny('left')})`,
        ruby: 'self.when(:microbit_tilted, "left") do\nend',
        only: 'toBlocks',
    },
    { blocks: 'microbit_displayText(TEXT: "Hello!")', ruby: 'microbit_v1.display_text("Hello!")' },
    { blocks: 'microbit_displayText(TEXT: $t)', ruby: 'microbit_v1.display_text($t)' },
    { blocks: 'microbit_displayClear', ruby: 'microbit_v1.clear_display' },
    {
        blocks: `microbit_whenTilted(DIRECTION: ${tiltAny('front')})`,
        ruby: 'microbit_v1.when_tilted("front") do\nend',
    },
    {
        blocks: `microbit_whenTilted(DIRECTION: ${tiltAny('any')})`,
        ruby: 'microbit_v1.when_tilted("Any") do\nend',
        only: 'toBlocks',
    },
    { blocks: 'microbit_whenTilted(DIRECTION: $d)', ruby: 'microbit_v1.when_tilted($d) do\nend' },
    {
        blocks: `looks_say(MESSAGE: microbit_isTilted(DIRECTION: ${tiltAny('right')}))`,
        ruby: 'say(microbit_v1.tilted?("right"))',
    },
    {
        blocks: `looks_say(MESSAGE: microbit_getTiltAngle(DIRECTION: ${tilt('back')}))`,
        ruby: 'say(microbit_v1.tilt_angle("back"))',
    },
    {
        blocks: `looks_say(MESSAGE: microbit_getTiltAngle(DIRECTION: ${tilt('left')}))`,
        ruby: 'say(microbit_v1.tilt_angle("LEFT"))',
        only: 'toBlocks',
    },
    {
        blocks: 'looks_say(MESSAGE: microbit_getTiltAngle(DIRECTION: $d))',
        ruby: 'say(microbit_v1.tilt_angle($d))',
    },
];

defineBlockRubyTable('micro:bit blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'micro:bit blocks ⇔ Ruby (stage)',
    [{ blocks: 'microbit_displayClear', ruby: 'microbit_v1.clear_display' }],
    { stage: true },
);
