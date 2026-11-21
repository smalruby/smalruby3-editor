import { getStuduinoSettings } from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import {
    FALLBACK_PORTS,
    MENU_FORM,
    PART_CALLS,
    STUDUINO_OPCODES,
    STUDUINO_RECEIVER,
    partMethodName,
    studuinoClassCode,
} from '../studuino-ruby/studuino-ruby';

/**
 * Define Ruby code generator for Studuino (Smalrubot S1) Blocks.
 * The blocks write `studuino.` (#2190); the converter also reads the older `smalrubot_s1.`.
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    Generator.smalrubotS1_action = function (block) {
        const action = Generator.quote_(Generator.getFieldValue(block, 'ACTION', Generator.ORDER_NONE) || 'forward');
        return `studuino.action(${action})\n`;
    };

    Generator.smalrubotS1_actionAndStopAfter = function (block) {
        const action = Generator.quote_(Generator.getFieldValue(block, 'ACTION', Generator.ORDER_NONE) || 'forward');
        const secs = Generator.valueToCode(block, 'SECS', Generator.ORDER_NONE) || 1;
        return `studuino.action(${action}, ${secs})\n`;
    };

    Generator.smalrubotS1_bendArm = function (block) {
        const degree = Generator.valueToCode(block, 'DEGREE', Generator.ORDER_NONE) || 90;
        const secs = Generator.valueToCode(block, 'SECS', Generator.ORDER_NONE) || 1;
        return `studuino.bend_arm(${degree}, ${secs})\n`;
    };

    Generator.smalrubotS1_getSensorValue = function (block) {
        const position = Generator.quote_(Generator.getFieldValue(block, 'POSITION', Generator.ORDER_NONE) || 'left');
        return [`studuino.sensor_value(${position})`, Generator.ORDER_ATOMIC];
    };

    Generator.smalrubotS1_turnLedOn = function (block) {
        const position = Generator.quote_(Generator.getFieldValue(block, 'POSITION', Generator.ORDER_NONE) || 'left');
        return `studuino.led(${position}, true)\n`;
    };

    Generator.smalrubotS1_turnLedOff = function (block) {
        const position = Generator.quote_(Generator.getFieldValue(block, 'POSITION', Generator.ORDER_NONE) || 'left');
        return `studuino.led(${position}, false)\n`;
    };

    Generator.smalrubotS1_getMotorSpeed = function (block) {
        const position = Generator.quote_(Generator.getFieldValue(block, 'POSITION', Generator.ORDER_NONE) || 'left');
        return [`studuino.get_motor_speed(${position})`, Generator.ORDER_ATOMIC];
    };

    Generator.smalrubotS1_setMotorSpeed = function (block) {
        const position = Generator.quote_(Generator.getFieldValue(block, 'POSITION', Generator.ORDER_NONE) || 'left');
        const speed = Generator.valueToCode(block, 'SPEED', Generator.ORDER_NONE) || 1;
        return `studuino.set_motor_speed(${position}, ${speed})\n`;
    };

    Generator.smalrubotS1_controlMotor = function (block) {
        const motor = Generator.quote_(Generator.getFieldValue(block, 'MOTOR', Generator.ORDER_NONE) || 'M1');
        const direction = Generator.quote_(
            Generator.getFieldValue(block, 'DIRECTION', Generator.ORDER_NONE) || 'normal',
        );
        return `studuino.dc_motor(${motor}, ${direction})\n`;
    };

    Generator.smalrubotS1_controlMotorAndStopAfter = function (block) {
        const motor = Generator.quote_(Generator.getFieldValue(block, 'MOTOR', Generator.ORDER_NONE) || 'M1');
        const direction = Generator.quote_(
            Generator.getFieldValue(block, 'DIRECTION', Generator.ORDER_NONE) || 'normal',
        );
        const secs = Generator.valueToCode(block, 'SECS', Generator.ORDER_NONE) || 0.5;
        return `studuino.dc_motor(${motor}, ${direction}, ${secs})\n`;
    };

    Generator.smalrubotS1_setArmCalibration = function (block) {
        const degree = Generator.valueToCode(block, 'DEGREE', Generator.ORDER_NONE) || 0;
        return `studuino.arm_calibration = ${degree}\n`;
    };

    // === Studuino mode (#2218): the part blocks and `class Studuino` ===

    /**
     * The value of a menu argument (`PORT`, `DIRECTION`, ...). It is read from the field of the
     * block, or from the menu block in the input, so that the blocks work in both forms
     * (`MENU_FORM`; the form is decided by #2216).
     * @param {object} block - The block.
     * @param {string} name - The name of the argument.
     * @returns {?string} The value, or null.
     */
    const menuValue = (block, name) => {
        const fromField = Generator.getFieldValue(block, name);
        if (fromField !== null && typeof fromField !== 'undefined') return fromField;
        if (MENU_FORM.form !== 'shadow') return null;
        const menu = Generator.getInputTargetBlock(block, name);
        if (!menu || !menu.fields) return null;
        const fields = Object.values(menu.fields);
        return fields.length > 0 ? fields[0].value : null;
    };

    const portOf = (block, kind, name = 'PORT') => {
        const port = menuValue(block, name);
        return typeof port === 'string' && port !== '' ? port : FALLBACK_PORTS[kind];
    };

    const partCode = (kind, port) => `${STUDUINO_RECEIVER}.${partMethodName(kind, port)}`;

    const callsByOpcode = new Map();
    PART_CALLS.forEach((call) => {
        if (!callsByOpcode.has(call.opcode)) callsByOpcode.set(call.opcode, []);
        callsByOpcode.get(call.opcode).push(call);
    });

    callsByOpcode.forEach((calls, opcode) => {
        Generator[opcode] = function (block) {
            // The menu values (`DIRECTION: normal`) pick the method; the first row is the default
            const call =
                calls.find(
                    (c) => c.fields && Object.entries(c.fields).every(([name, v]) => menuValue(block, name) === v),
                ) || calls[0];
            const target = partCode(call.kind, portOf(block, call.kind));
            if (!call.method) {
                return [target, Generator.ORDER_FUNCTION_CALL];
            }
            let arg = null;
            if (call.arg) {
                arg = Generator.valueToCode(block, call.arg.name, Generator.ORDER_NONE) || call.arg.default;
            }
            if (call.method.endsWith('=')) {
                return `${target}.${call.method.slice(0, -1)} = ${arg}\n`;
            }
            const code = arg === null ? `${target}.${call.method}` : `${target}.${call.method}(${arg})`;
            if (call.type === 'value' || call.type === 'value_boolean') {
                return [code, Generator.ORDER_FUNCTION_CALL];
            }
            return `${code}\n`;
        };
    });

    Generator[STUDUINO_OPCODES.servoPair] = function (block) {
        const port1 = portOf(block, 'servo_motor', 'PORT1');
        const port2 = portOf(block, 'servo_motor', 'PORT2');
        const angle1 = Generator.valueToCode(block, 'ANGLE1', Generator.ORDER_NONE) || 90;
        const angle2 = Generator.valueToCode(block, 'ANGLE2', Generator.ORDER_NONE) || 90;
        const key = (port) => String(port).toLowerCase();
        return `${STUDUINO_RECEIVER}.servo_motors(${key(port1)}: ${angle1}, ${key(port2)}: ${angle2})\n`;
    };

    /**
     * `class Studuino ... end` of the Stage in Studuino mode (#2218), or '' (other targets, normal
     * mode). The port settings are in `runtime.extensionStorage`, not in the blocks, so they are
     * written here from the settings.
     * @returns {string} The Ruby code of the class.
     */
    Generator.studuinoClass_ = function () {
        const target = this.currentTarget;
        if (!target || !target.isStage || !target.runtime) return '';
        const settings = getStuduinoSettings(target.runtime);
        if (settings.mode !== 'studuino') return '';
        return studuinoClassCode(settings, Generator.INDENT);
    };

    return Generator;
}
