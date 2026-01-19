/**
 * Define Ruby code generator for Microbit More Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @return {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.microbitMore_whenConnectionChanged = function (block) {
        block.isStatement = true;
        const state = Generator.quote_(Generator.getFieldValue(block, 'STATE', 'connected'));
        return `microbit.when_microbit(${state}) do\n`;
    };

    Generator.microbitMore_whenButtonEvent = function (block) {
        block.isStatement = true;
        const name = Generator.quote_(Generator.getFieldValue(block, 'NAME', 'A'));
        const event = Generator.quote_(Generator.getFieldValue(block, 'EVENT', 'down').toLowerCase());
        return `microbit.when_button_is(${name}, ${event}) do\n`;
    };

    Generator.microbitMore_isButtonPressed = function (block) {
        const name = Generator.quote_(Generator.getFieldValue(block, 'NAME', 'A'));
        return [`microbit.button_pressed?(${name})`, Generator.ORDER_FUNCTION_CALL];
    };

    const TouchEventLabel = {
        DOWN: 'touched',
        UP: 'released',
        CLICK: 'tapped'
    };
    Generator.microbitMore_whenTouchEvent = function (block) {
        block.isStatement = true;
        const name = Generator.quote_(Generator.getFieldValue(block, 'NAME', 'LOGO'));
        const event = Generator.getFieldValue(block, 'EVENT', 'DOWN');
        const eventLabel = Generator.quote_(TouchEventLabel[event]);
        return `microbit.when_pin_is(${name}, ${eventLabel}) do\n`;
    };

    Generator.microbitMore_isPinTouched = function (block) {
        const name = Generator.quote_(Generator.getFieldValue(block, 'NAME', 'LOGO'));
        return [`microbit.pin_is_touched?(${name})`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_whenPinConnected = function (block) {
        block.isStatement = true;
        const pin = Generator.getFieldValue(block, 'PIN', 'P0').replace('P', '');
        return `microbit.when_pin_connected(${pin}) do\n`;
    };

    Generator.microbitMore_whenGesture = function (block) {
        block.isStatement = true;
        const GestureLabel = {
            TILT_UP: 'tilted_front',
            TILT_DOWN: 'tilted_back',
            TILT_LEFT: 'tilted_left',
            TILT_RIGHT: 'tilted_right',
            FACE_UP: 'face up',
            FACE_DOWN: 'face down',
            FREEFALL: 'freefall',
            G3: '3G',
            G6: '6G',
            G8: '8G',
            SHAKE: 'shake',
            JUMPED: 'jumped',
            MOVED: 'moved',
            TILTED: 'tilted_any'
        };
        const gesture = Generator.getFieldValue(block, 'GESTURE', 'SHAKE');
        const gestureLabel = Generator.quote_(GestureLabel[gesture]);
        return `microbit.when(${gestureLabel}) do\n`;
    };

    const TiltedDirectionLabel = {
        ANY: 'any',
        FRONT: 'front',
        BACK: 'back',
        LEFT: 'left',
        RIGHT: 'right'
    };
    Generator.microbitMore_whenTilted = function (block) {
        block.isStatement = true;
        const direction = Generator.getFieldValue(block, 'DIRECTION', 'ANY');
        const directionLabel = Generator.quote_(TiltedDirectionLabel[direction] || direction);
        return `microbit.when_tilted(${directionLabel}) do\n`;
    };

    Generator.microbitMore_isTilted = function (block) {
        const direction = Generator.getFieldValue(block, 'DIRECTION', 'ANY');
        const directionLabel = Generator.quote_(TiltedDirectionLabel[direction] || direction);
        return [`microbit.tilted?(${directionLabel})`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_getTiltAngle = function (block) {
        const direction = Generator.getFieldValue(block, 'DIRECTION', 'FRONT').toLowerCase();
        const directionLabel = Generator.quote_(direction);
        return [`microbit.tilt_angle(${directionLabel})`, Generator.ORDER_FUNCTION_CALL];
    };

    const makeMatrixArgs = function (matrix) {
        matrix = matrix.replace(/0/g, '.');
        matrix = matrix.match(/.{5}/g).map(s => Generator.quote_(s));
        return matrix.join(',\n');
    };
    Generator.microbitMore_displayMatrix = function (block) {
        let matrix = Generator.valueToCode(block, 'MATRIX', Generator.ORDER_NONE);
        if (!matrix) {
            matrix = makeMatrixArgs('0101010101100010101000100');
        }
        if (matrix.indexOf('\n') >= 0) {
            matrix = `\n${Generator.prefixLines(matrix, Generator.INDENT)}\n`;
        }
        return `microbit.display_pattern(${matrix})\n`;
    };

    Generator.microbitMore_display = function (block) {
        const text = Generator.valueToCode(block, 'TEXT', Generator.ORDER_NONE) || Generator.quote_('Hello!');
        return `microbit.display_text(${text})\n`;
    };

    Generator.microbitMore_displayText = function (block) {
        const text = Generator.valueToCode(block, 'TEXT', Generator.ORDER_NONE) || Generator.quote_('Hello!');
        const delay = Generator.valueToCode(block, 'DELAY', Generator.ORDER_NONE) || 120;
        return `microbit.display_text_delay(${text}, ${delay})\n`;
    };

    Generator.microbitMore_displayClear = function () {
        return `microbit.clear_display\n`;
    };

    Generator.microbitMore_getLightLevel = function () {
        return ['microbit.light_intensity', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_getTemperature = function () {
        return ['microbit.temperature', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_getCompassHeading = function () {
        return ['microbit.angle_with_north', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_getPitch = function () {
        return ['microbit.pitch', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_getRoll = function () {
        return ['microbit.roll', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_getSoundLevel = function () {
        return ['microbit.sound_level', Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_getMagneticForce = function (block) {
        const axis = Generator.quote_(Generator.getFieldValue(block, 'AXIS', 'absolute'));
        return [`microbit.magnetic_force(${axis})`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_getAcceleration = function (block) {
        const axis = Generator.quote_(Generator.getFieldValue(block, 'AXIS', 'x'));
        return [`microbit.acceleration(${axis})`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_getAnalogValue = function (block) {
        const pin = Generator.quote_(`P${Generator.getFieldValue(block, 'PIN', '0')}`);
        return [`microbit.analog_value(${pin})`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_setPullMode = function (block) {
        const pin = Generator.quote_(`P${Generator.getFieldValue(block, 'PIN', '0')}`);
        const mode = Generator.quote_(Generator.getFieldValue(block, 'MODE', 'up').toLowerCase());
        return `microbit.set_pin_to_input_pull(${pin}, ${mode})\n`;
    };

    Generator.microbitMore_isPinHigh = function (block) {
        const pin = Generator.quote_(`P${Generator.getFieldValue(block, 'PIN', '0')}`);
        return [`microbit.is_pin_high?(${pin})`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_setDigitalOut = function (block) {
        const pin = Generator.quote_(`P${Generator.getFieldValue(block, 'PIN', '0')}`);
        const level = Generator.valueToCode(block, 'LEVEL', Generator.ORDER_NONE) || Generator.quote_('Low');
        return `microbit.set_digital(${pin}, ${level})\n`;
    };

    Generator.microbitMore_setAnalogOut = function (block) {
        const pin = Generator.quote_(`P${Generator.getFieldValue(block, 'PIN', '0')}`);
        const level = Generator.valueToCode(block, 'LEVEL', Generator.ORDER_NONE) || 0;
        return `microbit.set_analog(${pin}, ${level})\n`;
    };

    Generator.microbitMore_setServo = function (block) {
        const pin = Generator.quote_(`P${Generator.getFieldValue(block, 'PIN', '0')}`);
        const angle = Generator.valueToCode(block, 'ANGLE', Generator.ORDER_NONE) || 0;
        return `microbit.set_servo(${pin}, ${angle})\n`;
    };

    Generator.microbitMore_playTone = function (block) {
        const freq = Generator.valueToCode(block, 'FREQ', Generator.ORDER_NONE) || 440;
        const vol = Generator.valueToCode(block, 'VOL', Generator.ORDER_NONE) || 100;
        return `microbit.play_tone(${freq}, ${vol})\n`;
    };

    Generator.microbitMore_stopTone = function () {
        return `microbit.stop_tone\n`;
    };

    const EventTypeLabel = {
        NONE: 'none',
        ON_PULSE: 'pulse',
        ON_EDGE: 'edge'
    };
    Generator.microbitMore_listenPinEventType = function (block) {
        const eventType = Generator.getFieldValue(block, 'EVENT_TYPE', 'NONE');
        const eventTypeLabel = Generator.quote_(EventTypeLabel[eventType]);
        const pin = Generator.quote_(`P${Generator.getFieldValue(block, 'PIN', '0')}`);
        return `microbit.listen_event_on(${eventTypeLabel}, ${pin})\n`;
    };

    const EventLabel = {
        PULSE_LOW: 'low pulse',
        PULSE_HIGH: 'high pulse',
        FALL: 'fall',
        RISE: 'rise'
    };
    Generator.microbitMore_whenPinEvent = function (block) {
        block.isStatement = true;
        const event = Generator.getFieldValue(block, 'EVENT', 'PULSE_LOW');
        const eventLabel = Generator.quote_(EventLabel[event]);
        const pin = Generator.quote_(`P${Generator.getFieldValue(block, 'PIN', '0')}`);
        return `microbit.when_catch_at_pin(${eventLabel}, ${pin}) do\n`;
    };

    Generator.microbitMore_getPinEventValue = function (block) {
        const event = Generator.getFieldValue(block, 'EVENT', 'PULSE_LOW');
        const eventLabel = Generator.quote_(EventLabel[event]);
        const pin = Generator.quote_(`P${Generator.getFieldValue(block, 'PIN', '0')}`);
        return `microbit.value_of(${eventLabel}, ${pin})\n`;
    };

    Generator.microbitMore_whenDataReceived = function (block) {
        block.isStatement = true;
        const label = Generator.valueToCode(block, 'LABEL', Generator.ORDER_NONE) || Generator.quote_('label-01');
        return `microbit.when_data_received_from_microbit(${label}) do\n`;
    };

    Generator.microbitMore_getDataLabeled = function (block) {
        const label = Generator.valueToCode(block, 'LABEL', Generator.ORDER_NONE) || Generator.quote_('label-01');
        return [`microbit.data[${label}]`, Generator.ORDER_FUNCTION_CALL];
    };

    Generator.microbitMore_sendData = function (block) {
        const label = Generator.valueToCode(block, 'LABEL', Generator.ORDER_NONE) || Generator.quote_('label-01');
        const data = Generator.valueToCode(block, 'DATA', Generator.ORDER_NONE) || Generator.quote_('data');
        return `microbit.send_data_to_microbit(${data}, ${label})\n`;
    };

    Generator.microbitMore_menu_digitalValueMenu = function (block) {
        const value = Generator.getFieldValue(block, 'digitalValueMenu') || 'false';
        const code = Generator.quote_(value === 'true' ? 'High' : 'Low');
        return [code, Generator.ORDER_ATOMIC];
    };

    Generator.matrix = function (block) {
        const matrix = Generator.getFieldValue(block, 'MATRIX') || '0000000000000000000000000';
        return [makeMatrixArgs(matrix), Generator.ORDER_ATOMIC];
    };

    return Generator;
}
