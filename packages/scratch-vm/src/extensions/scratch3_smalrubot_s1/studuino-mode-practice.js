/**
 * Studuino モードの練習用の基板（#2355・S16）。
 *
 * Studuino モードの部品のブロックをブラウザで動かしたとき（ブロックやスクリプトをクリックしたとき・
 * 練習用の基板のパネルの［旗のスクリプトを試す］）に、命令を受けて状態を変える。実機（つないで動かす
 * ファームウェア）には送らない（部品のブロックは書きこんで動かすためのもので、ファームウェアのコマンドとは
 * 対応しないため）。
 *
 * - ポートは入出力の設定（getStuduinoSettings）で割り当てたものだけを持つ。割り当てていないポートや、
 *   別の部品を割り当てたポートへの命令は何もしない（書きこみでは使えないブロックになるもの）。
 * - 値は Studuino IR の決まり（docs/studuino-mode/README.md の「文の op と C++ の書き出し」）に合わせて、
 *   範囲に収めてから四捨五入する（DC モーターの速さ 0〜255・サーボ 0〜180 度・ブザー 130〜4186 Hz）。
 * - 状態が変わるたびに runtime のイベント STUDUINO_MODE_PRACTICE_STATE で送り、
 *   runtime.studuinoModePracticeState にも置く（GUI のパネルが読む）。
 * - 通常モードの練習用の基板（practice-board.js・S1 の決まった配線）とは別のもの。通常モードを変えないよう
 *   状態もイベントも分けている。
 */
const Cast = require('../../util/cast');
const Timer = require('../../util/timer');
const { getStuduinoSettings, PORT_NAMES, STUDUINO_SETTINGS_CHANGED } = require('./studuino-settings');

const STATE_EVENT = 'STUDUINO_MODE_PRACTICE_STATE';

/** アナログのセンサーの値の範囲（Studuino の analogRead と同じ）。 */
const ANALOG_RANGE = Object.freeze({ min: 0, max: 1023 });
/** Studuino IR と同じ範囲（Lambda の C++ の sr_clamp と同じ数）。 */
const DC_MOTOR_SPEED_RANGE = Object.freeze({ min: 0, max: 255 });
const SERVO_RANGE = Object.freeze({ min: 0, max: 180 });
const BUZZER_PITCH_RANGE = Object.freeze({ min: 130, max: 4186 });

const ANALOG_PARTS = ['light_sensor', 'sound_sensor', 'ir_photoreflector', 'temperature_sensor'];
const BUTTON_PARTS = ['touch_sensor', 'push_switch'];

/** サーボモーターのはじめの角度（Arduino の Servo は attach すると 90 度になる）。 */
const DEFAULT_SERVO_DEGREE = 90;

/**
 * 範囲に収めてから四捨五入する（Studuino IR の sr_round(sr_clamp(x, min, max))）。
 * 数でない値は 0 とみなす。
 * @param {*} value - 値
 * @param {{min: number, max: number}} range - 範囲
 * @returns {number} 整数
 */
const clampRound = (value, range) => {
    const n = Number(value);
    const x = Number.isFinite(n) ? n : 0;
    return Math.round(Math.min(range.max, Math.max(range.min, x)));
};

/**
 * 部品のはじめの状態。
 * @param {string} part - 部品の内部の名前
 * @returns {object} 状態（part を含む）
 */
const initialPartState = (part) => {
    switch (part) {
        case 'dc_motor':
            // 速さはライブラリの 0〜255。DCMotorPower を呼ぶまでは 0
            return { part, direction: 'stop', speed: 0 };
        case 'servo_motor':
            return { part, degree: DEFAULT_SERVO_DEGREE };
        case 'led':
            return { part, on: false };
        case 'buzzer':
            return { part, on: false, pitch: 0 };
        case 'touch_sensor':
        case 'push_switch':
            return { part, pressed: false };
        default:
            return { part, value: 0 };
    }
};

class StuduinoModePracticeBoard {
    /**
     * @returns {string} 状態が変わるたびに送る runtime のイベント
     */
    static get STATE_EVENT() {
        return STATE_EVENT;
    }

    /**
     * @param {Runtime} runtime - VM の runtime（設定を読み、状態を送る）
     */
    constructor(runtime) {
        this.runtime = runtime;
        /** ポート → 部品の状態（部品を変えたら、はじめの状態にもどす）。 */
        this.parts = {};
        /** 予約したサーボモーターの角度（ポート → 角度）。旗のスクリプトの中で積み重なる（#2352）。 */
        this.reservations = {};
        if (runtime && typeof runtime.on === 'function') {
            // 入出力の設定を変えたら、パネルに出すポートが変わる
            runtime.on(STUDUINO_SETTINGS_CHANGED, () => this.emitState());
            // 旗のスクリプトを動かしはじめたら予約は空（電源を入れたときと同じ）
            runtime.on('PROJECT_START', () => {
                this.reservations = {};
            });
        }
    }

    /**
     * @returns {object} getStuduinoSettings の戻り値
     */
    settings() {
        return getStuduinoSettings(this.runtime);
    }

    /**
     * そのポートに部品を割り当てていれば、その状態（無ければ作る）。割り当てていなければ null。
     * @param {string} port - ポート名
     * @param {string|string[]} parts - 受け付ける部品
     * @returns {?object} 部品の状態（書きかえてよい）
     */
    partAt(port, parts) {
        const part = this.settings().ports[port];
        const accepted = Array.isArray(parts) ? parts : [parts];
        if (!part || !accepted.includes(part)) return null;
        if (!this.parts[port] || this.parts[port].part !== part) {
            this.parts[port] = initialPartState(part);
        }
        return this.parts[port];
    }

    /**
     * パネルに出す状態。割り当てたポートだけを、ポートの表の順に並べる。
     * @returns {{ports: Array<object>, reservations: object}} 状態のコピー
     */
    getState() {
        const settings = this.settings();
        const ports = PORT_NAMES.filter((port) => settings.ports[port]).map((port) => {
            const part = settings.ports[port];
            const state =
                this.parts[port] && this.parts[port].part === part ? this.parts[port] : initialPartState(part);
            return Object.assign({ port }, state);
        });
        return { ports, reservations: Object.assign({}, this.reservations) };
    }

    emitState() {
        const state = this.getState();
        if (this.runtime) {
            this.runtime.studuinoModePracticeState = state;
            if (typeof this.runtime.emit === 'function') this.runtime.emit(STATE_EVENT, state);
        }
        return state;
    }

    /**
     * 状態を変えて、変わったときだけ送る。
     * @param {?object} state - 部品の状態（null なら何もしない）
     * @param {object} changes - 変える値
     */
    update(state, changes) {
        if (!state) return;
        const changed = Object.keys(changes).some((key) => state[key] !== changes[key]);
        if (!changed) return;
        Object.assign(state, changes);
        this.emitState();
    }

    /**
     * センサー・ボタンの値を変える（GUI のパネルのスライダーとボタン）。
     * @param {string} port - ポート名
     * @param {number|boolean} value - アナログのセンサーは 0〜1023、タッチセンサー・ボタンは押したか
     * @returns {boolean} 割り当てたセンサーなら true
     */
    setInput(port, value) {
        const analog = this.partAt(port, ANALOG_PARTS);
        if (analog) {
            this.update(analog, { value: clampRound(value, ANALOG_RANGE) });
            return true;
        }
        const button = this.partAt(port, BUTTON_PARTS);
        if (button) {
            this.update(button, { pressed: Boolean(value) });
            return true;
        }
        return false;
    }

    /**
     * @param {string} port - ポート名
     * @param {string} kind - 部品（light_sensor など）
     * @returns {number} センサーの値（割り当てていなければ 0）
     */
    readSensor(port, kind) {
        const state = this.partAt(port, kind);
        return state ? state.value : 0;
    }

    /**
     * @param {string} port - ポート名
     * @param {string} kind - 部品（touch_sensor / push_switch）
     * @returns {boolean} 押したか（割り当てていなければ偽）
     */
    readButton(port, kind) {
        const state = this.partAt(port, kind);
        return state ? state.pressed : false;
    }

    dcMotorSpeed(port, speed) {
        this.update(this.partAt(port, 'dc_motor'), { speed: clampRound(speed, DC_MOTOR_SPEED_RANGE) });
    }

    /**
     * @param {string} port - ポート名
     * @param {string} direction - normal / reverse（知らない値は何もしない）
     */
    dcMotorDirection(port, direction) {
        if (direction !== 'normal' && direction !== 'reverse') return;
        this.update(this.partAt(port, 'dc_motor'), { direction });
    }

    /**
     * @param {string} port - ポート名
     * @param {string} mode - brake / coast（知らない値は何もしない）
     */
    dcMotorStop(port, mode) {
        if (mode !== 'brake' && mode !== 'coast') return;
        this.update(this.partAt(port, 'dc_motor'), { direction: mode });
    }

    servo(port, angle) {
        this.update(this.partAt(port, 'servo_motor'), { degree: clampRound(angle, SERVO_RANGE) });
    }

    /**
     * @param {string} port - ポート名
     * @returns {?number} いまの角度（サーボモーターを割り当てていなければ null）
     */
    servoDegree(port) {
        const state = this.partAt(port, 'servo_motor');
        return state ? state.degree : null;
    }

    /**
     * 角度を予約する（動かさない）。
     * @param {string} port - ポート名
     * @param {number} angle - 角度
     */
    reserveServo(port, angle) {
        if (!this.partAt(port, 'servo_motor')) return;
        this.reservations[port] = clampRound(angle, SERVO_RANGE);
        this.emitState();
    }

    /**
     * 予約を取り出して空にする。
     * @returns {object} ポート → 角度
     */
    takeReservations() {
        const reservations = this.reservations;
        this.reservations = {};
        if (Object.keys(reservations).length > 0) this.emitState();
        return reservations;
    }

    led(port, state) {
        if (state !== 'on' && state !== 'off') return;
        this.update(this.partAt(port, 'led'), { on: state === 'on' });
    }

    buzzerOn(port, pitch) {
        this.update(this.partAt(port, 'buzzer'), { on: true, pitch: clampRound(pitch, BUZZER_PITCH_RANGE) });
    }

    buzzerOff(port) {
        this.update(this.partAt(port, 'buzzer'), { on: false });
    }

    /**
     * 止めるボタン: 仕事を行う部分を止める（LED・ブザーを消し、DC モーターを止める）。サーボの角度は残す。
     */
    stopAll() {
        let changed = Object.keys(this.reservations).length > 0;
        this.reservations = {};
        Object.values(this.parts).forEach((state) => {
            if (state.part === 'led' && state.on) {
                state.on = false;
                changed = true;
            } else if (state.part === 'buzzer' && state.on) {
                state.on = false;
                changed = true;
            } else if (state.part === 'dc_motor' && (state.direction === 'normal' || state.direction === 'reverse')) {
                state.direction = 'stop';
                changed = true;
            }
        });
        if (changed) this.emitState();
    }
}

/**
 * 部品のブロックの実行（opcode → 関数）。`ext` は拡張機能（`ext.studuinoPractice` が練習用の基板）。
 * 値のブロックの戻り値は、Studuino で動かしたときと同じ型（数・真偽）にする。
 * ここに無い opcode は何もしない（値のブロックは 0 / 偽）。
 */
const PRACTICE_HANDLERS = {
    studuinoDcMotorSpeed: (ext, args) => ext.studuinoPractice.dcMotorSpeed(args.PORT, Cast.toNumber(args.SPEED)),
    studuinoDcMotorDirection: (ext, args) => ext.studuinoPractice.dcMotorDirection(args.PORT, args.DIRECTION),
    studuinoDcMotorStop: (ext, args) => ext.studuinoPractice.dcMotorStop(args.PORT, args.MODE),
    studuinoServo: (ext, args) => ext.studuinoPractice.servo(args.PORT, Cast.toNumber(args.ANGLE)),
    // 角度を予約する・予約したサーボモーターをまとめて動かす（#2352）
    studuinoServoReserve: (ext, args) => ext.studuinoPractice.reserveServo(args.PORT, Cast.toNumber(args.ANGLE)),
    studuinoServoMoveReserved: (ext) => {
        const reservations = ext.studuinoPractice.takeReservations();
        Object.keys(reservations).forEach((port) => ext.studuinoPractice.servo(port, reservations[port]));
    },
    // M 秒で動かす: いまの角度から予約の角度へ、たった時間の割合で近づける（Studuino IR と同じ直線）
    studuinoServoMoveReservedIn: (ext, args, util) => {
        const board = ext.studuinoPractice;
        // util が無い呼び方（テストなど）では待たずに動かす
        const frame = util ? util.stackFrame : {};
        if (!frame.studuinoMove) {
            const targets = board.takeReservations();
            const ports = Object.keys(targets);
            if (ports.length === 0) return;
            const duration = Math.max(0, Cast.toNumber(args.SECS));
            const starts = {};
            ports.forEach((port) => {
                starts[port] = board.servoDegree(port);
            });
            if (duration <= 0 || !util) {
                ports.forEach((port) => board.servo(port, targets[port]));
                return;
            }
            const timer = new Timer();
            timer.start();
            frame.studuinoMove = { duration, starts, targets, timer };
            util.yield();
            return;
        }
        const { duration, starts, targets, timer } = frame.studuinoMove;
        const ratio = Math.min(1, timer.timeElapsed() / 1000 / duration);
        Object.keys(targets).forEach((port) => {
            const start = starts[port] === null ? targets[port] : starts[port];
            board.servo(port, start + (targets[port] - start) * ratio);
        });
        if (ratio < 1) util.yield();
    },
    studuinoLed: (ext, args) => ext.studuinoPractice.led(args.PORT, args.STATE),
    studuinoBuzzerOn: (ext, args) => ext.studuinoPractice.buzzerOn(args.PORT, Cast.toNumber(args.PITCH)),
    studuinoBuzzerOff: (ext, args) => ext.studuinoPractice.buzzerOff(args.PORT),
    studuinoLightSensor: (ext, args) => ext.studuinoPractice.readSensor(args.PORT, 'light_sensor'),
    studuinoSoundSensor: (ext, args) => ext.studuinoPractice.readSensor(args.PORT, 'sound_sensor'),
    studuinoIrPhotoreflector: (ext, args) => ext.studuinoPractice.readSensor(args.PORT, 'ir_photoreflector'),
    studuinoTemperatureSensor: (ext, args) => ext.studuinoPractice.readSensor(args.PORT, 'temperature_sensor'),
    studuinoTouchSensorPressed: (ext, args) => ext.studuinoPractice.readButton(args.PORT, 'touch_sensor'),
    studuinoButtonPressed: (ext, args) => ext.studuinoPractice.readButton(args.PORT, 'push_switch'),
};

module.exports = StuduinoModePracticeBoard;
module.exports.PRACTICE_HANDLERS = PRACTICE_HANDLERS;
module.exports.clampRound = clampRound;
module.exports.ANALOG_RANGE = ANALOG_RANGE;
module.exports.DC_MOTOR_SPEED_RANGE = DC_MOTOR_SPEED_RANGE;
module.exports.SERVO_RANGE = SERVO_RANGE;
module.exports.BUZZER_PITCH_RANGE = BUZZER_PITCH_RANGE;
