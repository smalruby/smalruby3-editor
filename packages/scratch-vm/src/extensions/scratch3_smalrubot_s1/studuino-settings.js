/**
 * Studuino モードの状態とポートの設定（#2212・S10）。
 *
 * 作品に 1 つだけ持つ設定（動かし方・ポートごとの部品・補正値）を、プロジェクトの JSON の
 * `extensionStorage`（TurboWarp と同じ形）に入れる。キーは拡張機能の ID（`smalrubotS1`）。
 * 形の正は docs/studuino-mode/README.md の「保存の形」。
 *
 * ここは純粋な関数と、runtime.extensionStorage を読み書きする薄い関数だけを持つ。
 */

/** extensionStorage のキー（拡張機能の ID）。 */
const STORAGE_KEY = 'smalrubotS1';

/** 保存の形の版。形を変えるときに上げる。 */
const STORAGE_VERSION = 1;

/** 動かし方: つないで動かす（通常モード）／Studuino に書きこむ（Studuino モード）。 */
const MODE_NORMAL = 'normal';
const MODE_STUDUINO = 'studuino';

/** 設定が変わったときに runtime が出すイベント。 */
const STUDUINO_SETTINGS_CHANGED = 'STUDUINO_SETTINGS_CHANGED';

const SERVO_PORTS = ['D2', 'D4', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12'];
const DC_MOTOR_PORTS = ['M1', 'M2'];
const ANALOG_SENSORS = ['light_sensor', 'sound_sensor', 'ir_photoreflector', 'temperature_sensor'];
const DIGITAL_PARTS = ['touch_sensor', 'led', 'buzzer'];

/**
 * ポートごとに選べる部品（docs の「ポートごとに選べる部品」。Lambda の検査と同じ表）。
 * @type {Object<string, string[]>}
 */
const PARTS_BY_PORT = Object.freeze({
    ...Object.fromEntries(SERVO_PORTS.map((p) => [p, ['servo_motor']])),
    ...Object.fromEntries(DC_MOTOR_PORTS.map((p) => [p, ['dc_motor']])),
    // A0〜A3 は基板の十字ボタンとつながっている
    ...Object.fromEntries(
        ['A0', 'A1', 'A2', 'A3'].map((p) => [p, [...ANALOG_SENSORS, ...DIGITAL_PARTS, 'push_switch']]),
    ),
    ...Object.fromEntries(['A4', 'A5'].map((p) => [p, [...ANALOG_SENSORS, ...DIGITAL_PARTS]])),
    // A6・A7 はアナログ入力専用のピン
    ...Object.fromEntries(['A6', 'A7'].map((p) => [p, [...ANALOG_SENSORS]])),
});

/** ポートの並び（表示・書き出しの順）。 */
const PORT_NAMES = Object.freeze(Object.keys(PARTS_BY_PORT));

/**
 * 既定のポートの設定 = 教科書のロボットカーの配線（M3 = A）。いまの拡張機能のブロック
 * （ポートが決まっているもの）と練習用の基板もこの配線で動いている。
 */
const DEFAULT_PORTS = Object.freeze({
    M1: 'dc_motor',
    M2: 'dc_motor',
    D10: 'servo_motor',
    A0: 'led',
    A1: 'led',
    A2: 'touch_sensor',
    A4: 'ir_photoreflector',
    A5: 'ir_photoreflector',
    A6: 'light_sensor',
    A7: 'sound_sensor',
});

/** 補正値のはじめの値と範囲。 */
const DC_MOTOR_CALIBRATION = Object.freeze({ default: 100, min: 0, max: 100 });
const SERVO_CALIBRATION = Object.freeze({ default: 0, min: -15, max: 15 });

/**
 * @typedef {object} StuduinoSettings
 * @property {string} mode - `normal` か `studuino`
 * @property {Object<string, string>} ports - ポート名 → 部品の内部の名前（割り当てたポートだけ）
 * @property {{dcMotor: Object<string, number>, servoMotor: Object<string, number>}} calibration
 *   補正値（はじめの値のものは持たない）
 * @property {?number} unknownVersion - 読みこんだ設定が知らない版だったとき、その版（ほかは null）
 */

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * 既定の設定を作る。
 * @returns {StuduinoSettings} 既定の設定
 */
const defaultSettings = () => ({
    mode: MODE_NORMAL,
    ports: { ...DEFAULT_PORTS },
    calibration: { dcMotor: {}, servoMotor: {} },
    unknownVersion: null,
});

const normalizeCalibration = (raw, ports, range) => {
    const out = {};
    if (!isPlainObject(raw)) return out;
    for (const [port, value] of Object.entries(raw)) {
        if (!ports.includes(port)) continue;
        const n = Number(value);
        if (!Number.isFinite(n)) continue;
        const v = Math.round(Math.min(range.max, Math.max(range.min, n)));
        // はじめの値は持たない（保存を小さくする）
        if (v !== range.default) out[port] = v;
    }
    return out;
};

/**
 * 保存された値（`extensionStorage.smalrubotS1`）を設定にする。知らない値は捨て、
 * 範囲の外の補正値は範囲に収める。値が無い（通常の作品）ときは既定の設定。
 * @param {*} raw - 保存された値
 * @returns {StuduinoSettings} 設定
 */
const normalizeSettings = (raw) => {
    const settings = defaultSettings();
    if (!isPlainObject(raw)) return settings;
    if (raw.version !== STORAGE_VERSION) {
        // 知らない版: 読めるところだけ読み、通常モードで開く（GUI が知らせる）
        settings.unknownVersion = typeof raw.version === 'number' ? raw.version : -1;
    }
    if (raw.mode === MODE_STUDUINO && settings.unknownVersion === null) settings.mode = MODE_STUDUINO;
    if (isPlainObject(raw.ports)) {
        settings.ports = {};
        for (const port of PORT_NAMES) {
            const kind = raw.ports[port];
            if (typeof kind === 'string' && PARTS_BY_PORT[port].includes(kind)) settings.ports[port] = kind;
        }
    }
    if (isPlainObject(raw.calibration)) {
        settings.calibration = {
            dcMotor: normalizeCalibration(raw.calibration.dcMotor, DC_MOTOR_PORTS, DC_MOTOR_CALIBRATION),
            servoMotor: normalizeCalibration(raw.calibration.servoMotor, SERVO_PORTS, SERVO_CALIBRATION),
        };
    }
    return settings;
};

const samePorts = (a, b) => {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

/**
 * 既定の設定と同じか（同じなら保存しない。通常の作品の project.json を変えないため）。
 * @param {StuduinoSettings} settings - 設定
 * @returns {boolean} 既定と同じなら true
 */
const isDefaultSettings = (settings) =>
    settings.mode === MODE_NORMAL &&
    samePorts(settings.ports, DEFAULT_PORTS) &&
    Object.keys(settings.calibration.dcMotor).length === 0 &&
    Object.keys(settings.calibration.servoMotor).length === 0;

/**
 * 設定を保存の形にする。既定と同じなら null（保存しない）。
 * @param {StuduinoSettings} settings - 設定
 * @returns {?object} `extensionStorage.smalrubotS1` に入れる値
 */
const toStorage = (settings) => {
    const normalized = normalizeSettings({ ...settings, version: STORAGE_VERSION });
    if (isDefaultSettings(normalized)) return null;
    const ports = {};
    for (const port of PORT_NAMES) {
        if (normalized.ports[port]) ports[port] = normalized.ports[port];
    }
    const storage = { version: STORAGE_VERSION, mode: normalized.mode, ports };
    const { dcMotor, servoMotor } = normalized.calibration;
    if (Object.keys(dcMotor).length > 0 || Object.keys(servoMotor).length > 0) {
        storage.calibration = {};
        if (Object.keys(dcMotor).length > 0) storage.calibration.dcMotor = dcMotor;
        if (Object.keys(servoMotor).length > 0) storage.calibration.servoMotor = servoMotor;
    }
    return storage;
};

/**
 * runtime から設定を読む。
 * @param {Runtime} runtime - VM の runtime
 * @returns {StuduinoSettings} 設定
 */
const getStuduinoSettings = (runtime) =>
    normalizeSettings(runtime && runtime.extensionStorage ? runtime.extensionStorage[STORAGE_KEY] : null);

/**
 * runtime に設定を書く（既定と同じならキーを消す）。変わったら STUDUINO_SETTINGS_CHANGED と
 * PROJECT_CHANGED（保存していない変更）を出す。
 * @param {Runtime} runtime - VM の runtime
 * @param {StuduinoSettings} settings - 設定
 * @returns {StuduinoSettings} 書いたあとの設定
 */
const setStuduinoSettings = (runtime, settings) => {
    if (!runtime.extensionStorage) runtime.extensionStorage = {};
    const before = JSON.stringify(runtime.extensionStorage[STORAGE_KEY] || null);
    const storage = toStorage(settings);
    if (storage) {
        runtime.extensionStorage[STORAGE_KEY] = storage;
    } else {
        delete runtime.extensionStorage[STORAGE_KEY];
    }
    const after = getStuduinoSettings(runtime);
    if (JSON.stringify(storage) !== before) {
        runtime.emit(STUDUINO_SETTINGS_CHANGED, after);
        if (typeof runtime.emitProjectChanged === 'function') runtime.emitProjectChanged();
    }
    return after;
};

module.exports = {
    STORAGE_KEY,
    STORAGE_VERSION,
    MODE_NORMAL,
    MODE_STUDUINO,
    STUDUINO_SETTINGS_CHANGED,
    PARTS_BY_PORT,
    PORT_NAMES,
    DEFAULT_PORTS,
    DC_MOTOR_CALIBRATION,
    SERVO_CALIBRATION,
    defaultSettings,
    normalizeSettings,
    isDefaultSettings,
    toStorage,
    getStuduinoSettings,
    setStuduinoSettings,
};
