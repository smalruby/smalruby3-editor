// 入出力の設定（ポートの設定のモーダル・#2215・S2）の純粋な関数。モーダルは設定の下書きを
// この関数で変え、［割り当て］で VM の setStuduinoSettings に渡す。表の正は VM の studuino-settings.js。
import {
    DC_MOTOR_CALIBRATION,
    PARTS_BY_PORT,
    SERVO_CALIBRATION,
} from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';

/** 左の列（出力: サーボモーター・DC モーター）。 */
const OUTPUT_PORTS = Object.freeze(['D2', 'D4', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'M1', 'M2']);

/** 右の列（入力・出力: センサー・LED・ブザー・ボタン）。 */
const INPUT_PORTS = Object.freeze(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']);

/** 部品の並び（ドロップダウンの順）。 */
const PART_ORDER = Object.freeze([
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
 * そのポートで選べる部品（ドロップダウンの順）。
 * @param {string} port - ポート名。
 * @returns {string[]} 部品の内部の名前。
 */
const partsForPort = (port) => {
    const parts = PARTS_BY_PORT[port] || [];
    return PART_ORDER.filter((kind) => parts.includes(kind));
};

/**
 * ポートの補正値の種類（そのポートにその部品をつないだときだけ補正値を持つ）。
 * @param {string} port - ポート名。
 * @param {?string} kind - つないだ部品。
 * @returns {?{key: string, range: object}} `calibration` のキーと範囲。補正値が無ければ null。
 */
const calibrationFor = (port, kind) => {
    if (kind === 'dc_motor' && port.startsWith('M')) return { key: 'dcMotor', range: DC_MOTOR_CALIBRATION };
    if (kind === 'servo_motor' && port.startsWith('D')) return { key: 'servoMotor', range: SERVO_CALIBRATION };
    return null;
};

const withoutCalibration = (calibration, port) => {
    const dcMotor = { ...calibration.dcMotor };
    const servoMotor = { ...calibration.servoMotor };
    delete dcMotor[port];
    delete servoMotor[port];
    return { dcMotor, servoMotor };
};

/**
 * ポートの部品を変える。選べない部品・空は「つながない」。部品を変えたら、そのポートの補正値は
 * はじめの値にもどす（前の部品の補正値を黙って引き継がない）。
 * @param {object} settings - 設定（下書き）。
 * @param {string} port - ポート名。
 * @param {?string} kind - 部品の内部の名前。空なら「つながない」。
 * @returns {object} 新しい設定。
 */
const setPortPart = (settings, port, kind) => {
    const ports = { ...settings.ports };
    const valid = Boolean(kind) && partsForPort(port).includes(kind);
    const next = valid ? kind : null;
    if ((ports[port] || null) === next) return settings;
    if (valid) {
        ports[port] = kind;
    } else {
        delete ports[port];
    }
    return { ...settings, ports, calibration: withoutCalibration(settings.calibration, port) };
};

/**
 * すべてのポートを「つながない」にする（補正値も消す）。
 * @param {object} settings - 設定（下書き）。
 * @returns {object} 新しい設定。
 */
const clearAllPorts = (settings) => ({
    ...settings,
    ports: {},
    calibration: { dcMotor: {}, servoMotor: {} },
});

/**
 * ポートの補正値を読む（持っていなければはじめの値）。
 * @param {object} settings - 設定。
 * @param {string} port - ポート名。
 * @returns {?number} 補正値。そのポートの部品が補正値を持たなければ null。
 */
const getCalibration = (settings, port) => {
    const info = calibrationFor(port, settings.ports[port]);
    if (!info) return null;
    const value = settings.calibration[info.key][port];
    return typeof value === 'number' ? value : info.range.default;
};

/**
 * ポートの補正値を変える。範囲に収めて整数に丸める。はじめの値なら持たない。
 * 数でない入力（入力の途中の空など）は変えない。
 * @param {object} settings - 設定（下書き）。
 * @param {string} port - ポート名。
 * @param {*} value - 入力された値。
 * @returns {object} 新しい設定。
 */
const setCalibration = (settings, port, value) => {
    const info = calibrationFor(port, settings.ports[port]);
    if (!info) return settings;
    if (value === '' || value === null || typeof value === 'undefined') return settings;
    const n = Number(value);
    if (!Number.isFinite(n)) return settings;
    const v = Math.round(Math.min(info.range.max, Math.max(info.range.min, n)));
    const group = { ...settings.calibration[info.key] };
    if (v === info.range.default) {
        delete group[port];
    } else {
        group[port] = v;
    }
    return { ...settings, calibration: { ...settings.calibration, [info.key]: group } };
};

export {
    INPUT_PORTS,
    OUTPUT_PORTS,
    PART_ORDER,
    calibrationFor,
    clearAllPorts,
    getCalibration,
    partsForPort,
    setCalibration,
    setPortPart,
};
