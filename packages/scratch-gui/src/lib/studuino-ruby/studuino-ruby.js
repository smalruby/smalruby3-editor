// Studuino モードの Ruby（#2218・S3）の約束を 1 か所にまとめる（純粋な値と関数だけ）。
//
// ブロック → Ruby（ruby-generator/smalrubot_s1.js）と Ruby → ブロック
// （ruby-to-blocks-converter/studuino-mode.js）の両方がここを使う。形の正は
// docs/studuino-mode/README.md の「Ruby（S3）」と「第 1 弾のブロック」。
//
// - 宣言: `class Studuino` の中に `<部品の内部の名前> :<ポート>`（補正値は `calibration: n`）。
// - 呼び出し: `studuino.<部品の内部の名前>_<ポートの小文字>`（例 `studuino.light_sensor_a6`）。
import {
    DC_MOTOR_CALIBRATION,
    PARTS_BY_PORT,
    PORT_NAMES,
    SERVO_CALIBRATION,
} from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';

/** ポートの設定を書く class の名前。 */
const STUDUINO_CLASS_NAME = 'Studuino';

/** 部品を呼ぶレシーバー（通常モードと同じ `studuino.`）。 */
const STUDUINO_RECEIVER = 'studuino';

/** 部品の内部の名前（docs の「部品の内部の名前」の表の順）。 */
const PART_KINDS = Object.freeze([
    'servo_motor',
    'dc_motor',
    'led',
    'buzzer',
    'light_sensor',
    'sound_sensor',
    'ir_photoreflector',
    'temperature_sensor',
    'touch_sensor',
    'push_switch',
]);

/**
 * 補正値を持つ部品: Ruby の `calibration:` ↔ 設定の `calibration.<key>` と、はじめの値・範囲。
 * @type {{[kind: string]: {key: string, range: {default: number, min: number, max: number}}}}
 */
const PART_CALIBRATIONS = Object.freeze({
    dc_motor: { key: 'dcMotor', range: DC_MOTOR_CALIBRATION },
    servo_motor: { key: 'servoMotor', range: SERVO_CALIBRATION },
});

/**
 * メニューの引数（`PORT` / `DIRECTION` など）をブロックのどこに持つか。
 * 部品のブロック（`getInfo`）は #2216 で作る。いまの smalrubot_s1 のブロックと同じく、
 * メニューはブロックのフィールド（`form: 'field'`）として読み書きする。#2216 でメニューが
 * 影のメニューのブロックになったら、ここを `{form: 'shadow', opcodes: {PORT: '<opcode>', ...}}`
 * に変える（生成器・変換器はこの値だけを見る）。
 */
const MENU_FORM = Object.freeze({ form: 'field', opcodes: Object.freeze({}) });

const EXT = 'smalrubotS1_';

/** 部品のブロックの opcode（docs の「部品のブロック」の表）。 */
const STUDUINO_OPCODES = Object.freeze({
    dcMotorSpeed: `${EXT}studuinoDcMotorSpeed`,
    dcMotorDirection: `${EXT}studuinoDcMotorDirection`,
    dcMotorStop: `${EXT}studuinoDcMotorStop`,
    servo: `${EXT}studuinoServo`,
    servoReserve: `${EXT}studuinoServoReserve`,
    servoMoveReserved: `${EXT}studuinoServoMoveReserved`,
    servoMoveReservedIn: `${EXT}studuinoServoMoveReservedIn`,
    led: `${EXT}studuinoLed`,
    buzzerOn: `${EXT}studuinoBuzzerOn`,
    buzzerOff: `${EXT}studuinoBuzzerOff`,
    lightSensor: `${EXT}studuinoLightSensor`,
    soundSensor: `${EXT}studuinoSoundSensor`,
    irPhotoreflector: `${EXT}studuinoIrPhotoreflector`,
    temperatureSensor: `${EXT}studuinoTemperatureSensor`,
    touchSensorPressed: `${EXT}studuinoTouchSensorPressed`,
    buttonPressed: `${EXT}studuinoButtonPressed`,
});

const O = STUDUINO_OPCODES;

/**
 * 部品の呼び出しの表（予約したサーボモーターを動かす呼び出し以外）。1 行が `studuino.<部品>[.<method>]` の 1 つの形。
 * - `method`: 部品に続けて呼ぶメソッド（null なら部品そのものが値）。`=` で終わるものは代入
 *   （`studuino.dc_motor_m1.speed = 200`）
 * - `arg`: 数の引数（`{name, default}`）
 * - `fields`: そのメソッドで決まるメニューの値（`forward` → `DIRECTION: normal`）
 * - `type`: 変換器のブロックの種類
 * @type {Array<object>}
 */
const PART_CALLS = Object.freeze([
    { opcode: O.dcMotorSpeed, kind: 'dc_motor', method: 'speed=', arg: { name: 'SPEED', default: 100 } },
    { opcode: O.dcMotorDirection, kind: 'dc_motor', method: 'forward', fields: { DIRECTION: 'normal' } },
    { opcode: O.dcMotorDirection, kind: 'dc_motor', method: 'backward', fields: { DIRECTION: 'reverse' } },
    { opcode: O.dcMotorStop, kind: 'dc_motor', method: 'brake', fields: { MODE: 'brake' } },
    { opcode: O.dcMotorStop, kind: 'dc_motor', method: 'coast', fields: { MODE: 'coast' } },
    { opcode: O.servo, kind: 'servo_motor', method: 'angle=', arg: { name: 'ANGLE', default: 90 } },
    { opcode: O.servoReserve, kind: 'servo_motor', method: 'reserve', arg: { name: 'ANGLE', default: 90 } },
    { opcode: O.led, kind: 'led', method: 'on', fields: { STATE: 'on' } },
    { opcode: O.led, kind: 'led', method: 'off', fields: { STATE: 'off' } },
    { opcode: O.buzzerOn, kind: 'buzzer', method: 'on', arg: { name: 'PITCH', default: 440 } },
    { opcode: O.buzzerOff, kind: 'buzzer', method: 'off' },
    { opcode: O.lightSensor, kind: 'light_sensor', method: null, type: 'value' },
    { opcode: O.soundSensor, kind: 'sound_sensor', method: null, type: 'value' },
    { opcode: O.irPhotoreflector, kind: 'ir_photoreflector', method: null, type: 'value' },
    { opcode: O.temperatureSensor, kind: 'temperature_sensor', method: null, type: 'value' },
    { opcode: O.touchSensorPressed, kind: 'touch_sensor', method: 'pressed?', type: 'value_boolean' },
    { opcode: O.buttonPressed, kind: 'push_switch', method: 'pressed?', type: 'value_boolean' },
]);

/**
 * 予約したサーボモーターをまとめて動かす呼び出し（#2352）。部品ではなく `studuino.` のメソッド:
 * `studuino.move_reserved_servo_motors`（すぐ）/ `studuino.move_reserved_servo_motors(1)`（1 秒で）。
 * 秒の書き方は通常モードの `studuino.bend_arm(90, 1)` と同じく、うしろの数。
 */
const MOVE_RESERVED_SERVO_MOTORS_METHOD = 'move_reserved_servo_motors';

/** ポートが空のブロックを書き出すときのポート（教科書のロボットカーの配線。ほかはその種類の最初のポート）。 */
const FALLBACK_PORTS = Object.freeze({
    servo_motor: 'D10',
    dc_motor: 'M1',
    led: 'A0',
    buzzer: 'A3',
    light_sensor: 'A6',
    sound_sensor: 'A7',
    ir_photoreflector: 'A4',
    temperature_sensor: 'A3',
    touch_sensor: 'A2',
    push_switch: 'A0',
});

/**
 * 部品を呼ぶメソッドの名前（`light_sensor` と `A6` → `light_sensor_a6`）。
 * @param {string} kind - 部品の内部の名前
 * @param {string} port - ポート名
 * @returns {string} メソッドの名前
 */
const partMethodName = (kind, port) => `${kind}_${String(port).toLowerCase()}`;

const PART_BY_METHOD = new Map();
PART_KINDS.forEach((kind) => {
    PORT_NAMES.forEach((port) => PART_BY_METHOD.set(partMethodName(kind, port), { kind, port }));
});

/**
 * メソッドの名前を部品とポートに分ける（`light_sensor_a6` → `{kind: 'light_sensor', port: 'A6'}`）。
 * ポートに合わない組み合わせ（`led_a6`）も分ける（合うかは `isPartAllowedAtPort`）。
 * @param {string} name - メソッドの名前
 * @returns {?{kind: string, port: string}} 部品とポート。部品の呼び出しでなければ null
 */
const parsePartMethodName = (name) => PART_BY_METHOD.get(name) || null;

/**
 * 部品の呼び出しになりうるメソッドの名前の一覧（変換器が登録する）。
 * @returns {Array<string>} メソッドの名前
 */
const allPartMethodNames = () => [...PART_BY_METHOD.keys()];

/**
 * ポートにその部品をつなげるか（docs の「ポートごとに選べる部品」）。
 * @param {string} kind - 部品の内部の名前
 * @param {string} port - ポート名
 * @returns {boolean} つなげるなら true
 */
const isPartAllowedAtPort = (kind, port) =>
    Object.prototype.hasOwnProperty.call(PARTS_BY_PORT, port) && PARTS_BY_PORT[port].includes(kind);

/**
 * ポートの設定から `class Studuino ... end` を作る。ポートの表の順に 1 行ずつ書き、
 * はじめの値の補正値は書かない。
 * @param {object} settings - ポートの設定（normalizeSettings したもの）
 * @param {string} indent - 字下げ
 * @returns {string} class の Ruby（最後に改行）
 */
const studuinoClassCode = (settings, indent = '  ') => {
    const lines = [`class ${STUDUINO_CLASS_NAME}`];
    const ports = (settings && settings.ports) || {};
    const calibration = (settings && settings.calibration) || {};
    PORT_NAMES.forEach((port) => {
        const kind = ports[port];
        if (!kind) return;
        let line = `${indent}${kind} :${port}`;
        const cal = PART_CALIBRATIONS[kind];
        const values = cal && calibration[cal.key];
        if (values && Object.prototype.hasOwnProperty.call(values, port) && values[port] !== cal.range.default) {
            line += `, calibration: ${values[port]}`;
        }
        lines.push(line);
    });
    lines.push('end');
    return `${lines.join('\n')}\n`;
};

export {
    STUDUINO_CLASS_NAME,
    STUDUINO_RECEIVER,
    PART_KINDS,
    PART_CALIBRATIONS,
    MENU_FORM,
    STUDUINO_OPCODES,
    PART_CALLS,
    MOVE_RESERVED_SERVO_MOTORS_METHOD,
    FALLBACK_PORTS,
    partMethodName,
    parsePartMethodName,
    allPartMethodNames,
    isPartAllowedAtPort,
    studuinoClassCode,
};
