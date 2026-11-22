/**
 * micro:bit More blocks ⇔ Ruby (the calls of `microbit.xxx`), as a table (block notation:
 * test/unit/helpers/block-notation.js). It fixes the output of the converter before the calls move
 * into a send table (issue #2090). The menus are fields: a string looked up without regard to case
 * (`"a"` → `"A"`, `"p8"` → `8`); the old calls of `microbit_more.xxx` are in
 * microbit-more-legacy-table.test.js.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const say = (block) => `looks_say(MESSAGE: ${block})`;
const level = (value) => `microbitMore_menu_digitalValueMenu(digitalValueMenu = "${value}")`;

const reporters = [
    ['light_intensity', 'microbitMore_getLightLevel'],
    ['temperature', 'microbitMore_getTemperature'],
    ['angle_with_north', 'microbitMore_getCompassHeading'],
    ['pitch', 'microbitMore_getPitch'],
    ['roll', 'microbitMore_getRoll'],
    ['sound_level', 'microbitMore_getSoundLevel'],
].map(([name, opcode]) => ({ blocks: say(opcode), ruby: `say(microbit.${name})` }));

const rows = [
    {
        blocks: 'microbitMore_whenConnectionChanged(STATE = "connected")\nmotion_movesteps(STEPS: 10)',
        ruby: 'microbit.when_microbit("connected") do\n  move(10)\nend',
    },
    {
        blocks: 'microbitMore_whenConnectionChanged(STATE = "disconnected")',
        ruby: 'microbit.when_microbit("Disconnected") do\nend',
        only: 'toBlocks',
    },
    {
        blocks: 'microbitMore_whenButtonEvent(NAME = "A", EVENT = "down")',
        ruby: 'microbit.when_button_is("A", "down") do\nend',
    },
    {
        blocks: 'microbitMore_whenButtonEvent(NAME = "B", EVENT = "click")',
        ruby: 'microbit.when_button_is("b", "CLICK") do\nend',
        only: 'toBlocks',
    },
    { blocks: say('microbitMore_isButtonPressed(NAME = "B")'), ruby: 'say(microbit.button_pressed?("B"))' },
    {
        blocks: 'microbitMore_whenTouchEvent(NAME = "LOGO", EVENT = "DOWN")',
        ruby: 'microbit.when_pin_is("LOGO", "touched") do\nend',
    },
    {
        blocks: 'microbitMore_whenTouchEvent(NAME = "P1", EVENT = "CLICK")',
        ruby: 'microbit.when_pin_is("p1", "Tapped") do\nend',
        only: 'toBlocks',
    },
    { blocks: say('microbitMore_isPinTouched(NAME = "P2")'), ruby: 'say(microbit.pin_is_touched?("P2"))' },
    { blocks: 'microbitMore_whenGesture(GESTURE = "SHAKE")', ruby: 'microbit.when("shake") do\nend' },
    {
        blocks: 'microbitMore_whenGesture(GESTURE = "TILT_UP")',
        ruby: 'microbit.when("Tilted_Front") do\nend',
        only: 'toBlocks',
    },
    { blocks: 'microbitMore_whenTilted(DIRECTION = "ANY")', ruby: 'microbit.when_tilted("any") do\nend' },
    { blocks: say('microbitMore_isTilted(DIRECTION = "LEFT")'), ruby: 'say(microbit.tilted?("left"))' },
    { blocks: say('microbitMore_getTiltAngle(DIRECTION = "BACK")'), ruby: 'say(microbit.tilt_angle("back"))' },
    { blocks: 'microbitMore_display(TEXT: "Hello!")', ruby: 'microbit.display_text("Hello!")' },
    { blocks: 'microbitMore_display(TEXT: $t)', ruby: 'microbit.display_text($t)' },
    {
        blocks: 'microbitMore_displayText(TEXT: "Hi", DELAY: 120)',
        ruby: 'microbit.display_text_delay("Hi", 120)',
    },
    { blocks: 'microbitMore_displayText(TEXT: $t, DELAY: $d)', ruby: 'microbit.display_text_delay($t, $d)' },
    { blocks: 'microbitMore_displayClear', ruby: 'microbit.clear_display' },
    ...reporters,
    {
        blocks: say('microbitMore_getMagneticForce(AXIS = "absolute")'),
        ruby: 'say(microbit.magnetic_force("absolute"))',
    },
    { blocks: say('microbitMore_getAcceleration(AXIS = "x")'), ruby: 'say(microbit.acceleration("x"))' },
    {
        blocks: say('microbitMore_getAcceleration(AXIS = "z")'),
        ruby: 'say(microbit.acceleration("Z"))',
        only: 'toBlocks',
    },
    { blocks: say('microbitMore_getAnalogValue(PIN = "1")'), ruby: 'say(microbit.analog_value("P1"))' },
    {
        blocks: 'microbitMore_setPullMode(PIN = "8", MODE = "UP")',
        ruby: 'microbit.set_pin_to_input_pull("P8", "up")',
    },
    { blocks: say('microbitMore_isPinHigh(PIN = "13")'), ruby: 'say(microbit.is_pin_high?("P13"))' },
    {
        blocks: `microbitMore_setDigitalOut(PIN = "0", LEVEL: ${level('true')})`,
        ruby: 'microbit.set_digital("P0", "High")',
    },
    {
        blocks: `microbitMore_setDigitalOut(PIN = "2", LEVEL: ${level('false')})`,
        ruby: 'microbit.set_digital("P2", "LOW")',
        only: 'toBlocks',
    },
    { blocks: 'microbitMore_setAnalogOut(PIN = "1", LEVEL: 512)', ruby: 'microbit.set_analog("P1", 512)' },
    { blocks: 'microbitMore_setServo(PIN = "16", ANGLE: $a)', ruby: 'microbit.set_servo("P16", $a)' },
    { blocks: 'microbitMore_playTone(FREQ: 440, VOL: 100)', ruby: 'microbit.play_tone(440, 100)' },
    { blocks: 'microbitMore_stopTone', ruby: 'microbit.stop_tone' },
    {
        blocks: 'microbitMore_setPullMode(PIN = "8", MODE = "UP")',
        ruby: 'microbit.set_pin_to_input_pull("p8", "up")',
        only: 'toBlocks',
    },
    {
        blocks: 'microbitMore_listenPinEventType(EVENT_TYPE = "ON_PULSE", PIN = "0")',
        ruby: 'microbit.listen_event_on("pulse", "P0")',
    },
    {
        blocks: say('microbitMore_getPinEventValue(EVENT = "PULSE_LOW", PIN = "0")'),
        ruby: 'say(microbit.value_of("low pulse", "P0"))',
    },
    { blocks: 'microbitMore_getPinEventValue(EVENT = "RISE", PIN = "16")', ruby: 'microbit.value_of("rise", "P16")' },
    {
        blocks: 'microbitMore_whenDataReceived(LABEL: "label-01")',
        ruby: 'microbit.when_data_received_from_microbit("label-01") do\nend',
    },
];

defineBlockRubyTable('micro:bit More blocks ⇔ Ruby', rows, { versions: ['1', '2'] });

defineBlockRubyTable(
    'micro:bit More blocks ⇔ Ruby (stage)',
    [{ blocks: 'microbitMore_stopTone', ruby: 'microbit.stop_tone' }],
    { stage: true },
);
