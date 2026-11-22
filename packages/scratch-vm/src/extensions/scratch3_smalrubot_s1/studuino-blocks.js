/**
 * Studuino モードの部品のブロック（#2216・S1・S2）。
 *
 * opcode・引数の名前・メニューの値は docs/studuino-mode/README.md の「部品のブロック」の表が正で、
 * 構文木の生成（scratch-gui の lib/studuino-ir）と Ruby（lib/studuino-ruby）が同じ約束を使う。
 *
 * - 通常モードのパレットには出さない（E5）。どのブロックも `hideFromPalette: true` にし、
 *   Studuino モードのパレット（scratch-gui の lib/studuino-mode.js）が、割り当てた部品の
 *   ブロックだけを XML で並べる。
 * - [ポート] のメニューは、その部品を割り当てたポートだけを「光センサー (A6)」の形で出す（S2）。
 *   値はポート名（`A6`）。
 * - 緑の旗は書きこみ（S13）。ブロックやスクリプトをクリックしたとき・練習用の基板のパネルの
 *   ［旗のスクリプトを試す］では、Studuino モードの練習用の基板（studuino-mode-practice.js）を動かす（#2355・S16）。
 */
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const { getStuduinoSettings, PORT_NAMES } = require('./studuino-settings');
const { PRACTICE_HANDLERS } = require('./studuino-mode-practice');

/** 部品の内部の名前 → 表示の名前（formatMessage の id と英語の既定）。 */
const PART_LABELS = {
    servo_motor: { id: 'smalrubotS1.studuino.part.servoMotor', default: 'servo motor' },
    dc_motor: { id: 'smalrubotS1.studuino.part.dcMotor', default: 'DC motor' },
    led: { id: 'smalrubotS1.studuino.part.led', default: 'LED' },
    buzzer: { id: 'smalrubotS1.studuino.part.buzzer', default: 'buzzer' },
    light_sensor: { id: 'smalrubotS1.studuino.part.lightSensor', default: 'light sensor' },
    sound_sensor: { id: 'smalrubotS1.studuino.part.soundSensor', default: 'sound sensor' },
    ir_photoreflector: { id: 'smalrubotS1.studuino.part.irPhotoreflector', default: 'IR photoreflector' },
    temperature_sensor: { id: 'smalrubotS1.studuino.part.temperatureSensor', default: 'temperature sensor' },
    touch_sensor: { id: 'smalrubotS1.studuino.part.touchSensor', default: 'touch sensor' },
    push_switch: { id: 'smalrubotS1.studuino.part.pushSwitch', default: 'button' },
};

/** 部品ごとのポートのメニューの名前（getInfo の menus のキー・動的メニューのメソッド名）。 */
const PORT_MENU_BY_PART = {
    servo_motor: 'studuinoServoMotorPorts',
    dc_motor: 'studuinoDcMotorPorts',
    led: 'studuinoLedPorts',
    buzzer: 'studuinoBuzzerPorts',
    light_sensor: 'studuinoLightSensorPorts',
    sound_sensor: 'studuinoSoundSensorPorts',
    ir_photoreflector: 'studuinoIrPhotoreflectorPorts',
    temperature_sensor: 'studuinoTemperatureSensorPorts',
    touch_sensor: 'studuinoTouchSensorPorts',
    push_switch: 'studuinoPushSwitchPorts',
};

/**
 * 部品のブロックの定義（opcode・部品・種類・引数の既定）。ブロックの見た目の文言は blockInfos で付ける。
 * `part` はパレットに出すかどうか（その部品を 1 つ以上割り当てたか）の判定にも使う。
 */
const STUDUINO_PART_BLOCKS = [
    { opcode: 'studuinoDcMotorSpeed', part: 'dc_motor', blockType: BlockType.COMMAND },
    { opcode: 'studuinoDcMotorDirection', part: 'dc_motor', blockType: BlockType.COMMAND },
    { opcode: 'studuinoDcMotorStop', part: 'dc_motor', blockType: BlockType.COMMAND },
    { opcode: 'studuinoServo', part: 'servo_motor', blockType: BlockType.COMMAND },
    // 角度を予約して、予約したサーボモーターをまとめて動かす（#2352・S6）。動かす 2 つはポートを持たない
    { opcode: 'studuinoServoReserve', part: 'servo_motor', blockType: BlockType.COMMAND },
    { opcode: 'studuinoServoMoveReserved', part: 'servo_motor', noPort: true, blockType: BlockType.COMMAND },
    { opcode: 'studuinoServoMoveReservedIn', part: 'servo_motor', noPort: true, blockType: BlockType.COMMAND },
    { opcode: 'studuinoLed', part: 'led', blockType: BlockType.COMMAND },
    { opcode: 'studuinoBuzzerOn', part: 'buzzer', blockType: BlockType.COMMAND },
    { opcode: 'studuinoBuzzerOff', part: 'buzzer', blockType: BlockType.COMMAND },
    { opcode: 'studuinoLightSensor', part: 'light_sensor', blockType: BlockType.REPORTER },
    { opcode: 'studuinoSoundSensor', part: 'sound_sensor', blockType: BlockType.REPORTER },
    { opcode: 'studuinoIrPhotoreflector', part: 'ir_photoreflector', blockType: BlockType.REPORTER },
    { opcode: 'studuinoTemperatureSensor', part: 'temperature_sensor', blockType: BlockType.REPORTER },
    { opcode: 'studuinoTouchSensorPressed', part: 'touch_sensor', blockType: BlockType.BOOLEAN },
    { opcode: 'studuinoButtonPressed', part: 'push_switch', blockType: BlockType.BOOLEAN },
];

/** 数の引数の既定（パレットの影の値）。DC モーターの速さはライブラリの 0〜255。 */
const DEFAULTS = {
    SPEED: 100,
    ANGLE: 90,
    PITCH: 440,
    SECS: 1,
};

/**
 * 設定のうち、その部品を割り当てたポート（ポートの表の順）。
 * @param {object} settings - getStuduinoSettings の戻り値
 * @param {string} part - 部品の内部の名前
 * @returns {string[]} ポート名
 */
const portsForPart = (settings, part) => PORT_NAMES.filter((port) => settings.ports[port] === part);

/**
 * [ポート] のメニューの項目（「光センサー (A6)」の形）。割り当てが無いときも Blockly のメニューが
 * 空にならないよう、空の値の項目を 1 つ返す（その値のブロックは構文木の生成で使えないブロックになる）。
 * @param {object} settings - getStuduinoSettings の戻り値
 * @param {string} part - 部品の内部の名前
 * @param {Function} formatMessage - 文言の関数
 * @returns {Array<{text: string, value: string}>} メニューの項目
 */
const portMenuItems = (settings, part, formatMessage) => {
    const label = formatMessage(PART_LABELS[part]);
    const ports = portsForPart(settings, part);
    if (ports.length === 0) return [{ text: label, value: '' }];
    return ports.map((port) => ({ text: `${label} (${port})`, value: port }));
};

/**
 * Studuino モードのパレットに出すブロックの opcode（割り当てた部品のブロックだけ・表の順）。
 * @param {object} settings - getStuduinoSettings の戻り値
 * @returns {Array<{opcode: string, part: string, ports: string[], hasPort: boolean}>} 出すブロックと、
 *   その部品のポート。`hasPort` は [ポート] の引数を持つか（予約したサーボを動かすブロックは持たない）
 */
const paletteBlocks = (settings) =>
    STUDUINO_PART_BLOCKS.map((b) => ({ ...b, ports: portsForPart(settings, b.part) }))
        .filter((b) => b.ports.length > 0)
        .map(({ opcode, part, ports, noPort }) => ({ opcode, part, ports, hasPort: !noPort }));

/**
 * getInfo の blocks に足すブロックの定義。
 * @param {Function} formatMessage - 文言の関数
 * @returns {object[]} ブロックの定義
 */
const blockInfos = (formatMessage) => {
    const port = (part) => ({ type: ArgumentType.STRING, menu: PORT_MENU_BY_PART[part], defaultValue: '' });
    const number = (name) => ({ type: ArgumentType.NUMBER, defaultValue: DEFAULTS[name] });
    const text = {
        studuinoDcMotorSpeed: {
            id: 'smalrubotS1.studuino.dcMotorSpeed',
            default: 'set [PORT] speed to [SPEED]',
            arguments: { PORT: port('dc_motor'), SPEED: number('SPEED') },
        },
        studuinoDcMotorDirection: {
            id: 'smalrubotS1.studuino.dcMotorDirection',
            default: 'turn [PORT] [DIRECTION]',
            arguments: {
                PORT: port('dc_motor'),
                DIRECTION: { type: ArgumentType.STRING, menu: 'studuinoDcMotorDirections', defaultValue: 'normal' },
            },
        },
        studuinoDcMotorStop: {
            id: 'smalrubotS1.studuino.dcMotorStop',
            default: 'stop [PORT] with [MODE]',
            arguments: {
                PORT: port('dc_motor'),
                MODE: { type: ArgumentType.STRING, menu: 'studuinoDcMotorStopModes', defaultValue: 'brake' },
            },
        },
        studuinoServo: {
            id: 'smalrubotS1.studuino.servo',
            default: 'set [PORT] to [ANGLE] degrees',
            arguments: { PORT: port('servo_motor'), ANGLE: number('ANGLE') },
        },
        studuinoServoReserve: {
            id: 'smalrubotS1.studuino.servoReserve',
            default: 'reserve [PORT] at [ANGLE] degrees',
            arguments: { PORT: port('servo_motor'), ANGLE: number('ANGLE') },
        },
        studuinoServoMoveReserved: {
            id: 'smalrubotS1.studuino.servoMoveReserved',
            default: 'move reserved servos',
            arguments: {},
        },
        studuinoServoMoveReservedIn: {
            id: 'smalrubotS1.studuino.servoMoveReservedIn',
            default: 'move reserved servos in [SECS] seconds',
            arguments: { SECS: number('SECS') },
        },
        studuinoLed: {
            id: 'smalrubotS1.studuino.led',
            default: 'turn [PORT] [STATE]',
            arguments: {
                PORT: port('led'),
                STATE: { type: ArgumentType.STRING, menu: 'studuinoLedStates', defaultValue: 'on' },
            },
        },
        studuinoBuzzerOn: {
            id: 'smalrubotS1.studuino.buzzerOn',
            default: 'play [PORT] at [PITCH] Hz',
            arguments: { PORT: port('buzzer'), PITCH: number('PITCH') },
        },
        studuinoBuzzerOff: {
            id: 'smalrubotS1.studuino.buzzerOff',
            default: 'stop [PORT]',
            arguments: { PORT: port('buzzer') },
        },
        studuinoLightSensor: {
            id: 'smalrubotS1.studuino.lightSensor',
            default: '[PORT]',
            arguments: { PORT: port('light_sensor') },
        },
        studuinoSoundSensor: {
            id: 'smalrubotS1.studuino.soundSensor',
            default: '[PORT]',
            arguments: { PORT: port('sound_sensor') },
        },
        studuinoIrPhotoreflector: {
            id: 'smalrubotS1.studuino.irPhotoreflector',
            default: '[PORT]',
            arguments: { PORT: port('ir_photoreflector') },
        },
        studuinoTemperatureSensor: {
            id: 'smalrubotS1.studuino.temperatureSensor',
            default: '[PORT]',
            arguments: { PORT: port('temperature_sensor') },
        },
        studuinoTouchSensorPressed: {
            id: 'smalrubotS1.studuino.touchSensorPressed',
            default: '[PORT] pressed?',
            arguments: { PORT: port('touch_sensor') },
        },
        studuinoButtonPressed: {
            id: 'smalrubotS1.studuino.buttonPressed',
            default: '[PORT] pressed?',
            arguments: { PORT: port('push_switch') },
        },
    };
    return STUDUINO_PART_BLOCKS.map((b) => ({
        opcode: b.opcode,
        blockType: b.blockType,
        text: formatMessage({
            id: text[b.opcode].id,
            default: text[b.opcode].default,
            description: `${b.opcode} block text (Studuino mode)`,
        }),
        arguments: text[b.opcode].arguments,
        // 通常モードのパレットには出さない（E5）。Studuino モードのパレットが XML で並べる
        hideFromPalette: true,
    }));
};

/**
 * getInfo の menus に足すメニュー。ポートのメニューは動的（メソッド名の文字列）。
 * @param {Function} formatMessage - 文言の関数
 * @returns {object} メニュー
 */
const menuInfos = (formatMessage) => {
    const menus = {
        studuinoDcMotorDirections: {
            acceptReporters: false,
            items: [
                {
                    text: formatMessage({ id: 'smalrubotS1.studuino.direction.normal', default: 'forward' }),
                    value: 'normal',
                },
                {
                    text: formatMessage({ id: 'smalrubotS1.studuino.direction.reverse', default: 'backward' }),
                    value: 'reverse',
                },
            ],
        },
        studuinoDcMotorStopModes: {
            acceptReporters: false,
            items: [
                { text: formatMessage({ id: 'smalrubotS1.studuino.stop.brake', default: 'brake' }), value: 'brake' },
                { text: formatMessage({ id: 'smalrubotS1.studuino.stop.coast', default: 'coast' }), value: 'coast' },
            ],
        },
        studuinoLedStates: {
            acceptReporters: false,
            items: [
                { text: formatMessage({ id: 'smalrubotS1.studuino.led.on', default: 'on' }), value: 'on' },
                { text: formatMessage({ id: 'smalrubotS1.studuino.led.off', default: 'off' }), value: 'off' },
            ],
        },
    };
    Object.values(PORT_MENU_BY_PART).forEach((name) => {
        menus[name] = { acceptReporters: false, items: name };
    });
    return menus;
};

/**
 * 拡張機能のクラスに足すメソッド（ブロックの実行と動的メニュー）。
 * @param {Function} getFormatMessage - いまの文言の関数を返す関数
 * @returns {object} メソッド（`this.runtime` を使う）
 */
const makeMethods = (getFormatMessage) => {
    const methods = {};
    Object.entries(PORT_MENU_BY_PART).forEach(([part, name]) => {
        methods[name] = function () {
            return portMenuItems(getStuduinoSettings(this.runtime), part, getFormatMessage());
        };
    });
    STUDUINO_PART_BLOCKS.forEach((b) => {
        // ブラウザでは練習用の基板（studuino-mode-practice.js）を動かす（#2355）。書きこみは緑の旗。
        // 練習用の基板で動かせないブロックは何もしない（値のブロックは 0 / 偽）
        const fallback =
            b.blockType === BlockType.REPORTER ? 0 : b.blockType === BlockType.BOOLEAN ? false : undefined;
        methods[b.opcode] = function (args, util) {
            const handler = PRACTICE_HANDLERS[b.opcode];
            if (!handler || !this.studuinoPractice) return fallback;
            const value = handler(this, args || {}, util);
            return typeof value === 'undefined' ? fallback : value;
        };
    });
    return methods;
};

module.exports = {
    STUDUINO_PART_BLOCKS,
    PORT_MENU_BY_PART,
    PART_LABELS,
    DEFAULTS,
    portsForPart,
    portMenuItems,
    paletteBlocks,
    blockInfos,
    menuInfos,
    makeMethods,
};
