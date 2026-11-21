/**
 * The practice board: a board inside the browser that receives the Studuino
 * blocks' commands while no real board is connected (#2191, E8 = A).
 *
 * It has the same operations as the real board (`SmalrubotS1`): `led`,
 * `getMotorSpeed` / `setMotorSpeed`, `setArmCalibration`, `action`, `dcMotor`,
 * `bendArm`, `getSensorValue` and `stopAll`, and returns the same types.
 * It never writes to a serial port.
 *
 * Its state is a plain object (see `getState()`). Every change is sent with
 * the runtime event `STUDUINO_PRACTICE_BOARD_STATE` and the latest state is
 * also kept on `runtime.studuinoPracticeBoardState`, so the GUI panel (#2192)
 * and the record of commands and sensor values (#2193) only have to read it.
 */

const STATE_EVENT = 'STUDUINO_PRACTICE_BOARD_STATE';

const DEFAULT_DC_MOTOR_POWER_RATIO = 50;
const DEFAULT_ARM_DEGREE = 90;

// The ports are the fixed S1 layout (E3 = A).
const LED_PORT_BY_POSITION = { left: 'A0', right: 'A1' };
const MOTOR_PORT_BY_POSITION = { left: 'M1', right: 'M2' };
const SERVO_PORT = 'D10';
const POSITION_BY_MOTOR_PORT = { M1: 'left', M2: 'right' };
const MOTOR_DIRECTIONS = ['normal', 'reverse', 'stop'];
// Old values (`left` / `right`) and the textbook names (`ir_a4` / `ir_a5`) are the same sensors (#2189).
const SENSOR_PORT_BY_POSITION = {
    touch: 'A2',
    left: 'A4',
    ir_a4: 'A4',
    right: 'A5',
    ir_a5: 'A5',
    light: 'A6',
    sound: 'A7',
};
const SENSOR_PORTS = ['A2', 'A4', 'A5', 'A6', 'A7'];

// The direction of M1 (left) and M2 (right) for each action, as the real board does.
const MOTOR_DIRECTIONS_BY_ACTION = {
    forward: ['normal', 'normal'],
    backward: ['reverse', 'reverse'],
    left: ['reverse', 'normal'],
    right: ['normal', 'reverse'],
    stop: ['stop', 'stop'],
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

class StuduinoPracticeBoard {
    /**
     * @returns {string} - the runtime event sent on every change of the state.
     */
    static get STATE_EVENT() {
        return STATE_EVENT;
    }

    /**
     * @param {Runtime} runtime - the runtime to send the state with.
     */
    constructor(runtime) {
        this.runtime = runtime;
        // 'practice' while no real board is connected, 'device' while it is.
        this.mode = 'practice';
        this.dcMotorPowerRatios = {
            left: DEFAULT_DC_MOTOR_POWER_RATIO,
            right: DEFAULT_DC_MOTOR_POWER_RATIO,
        };
        this.leds = { A0: false, A1: false };
        this.motors = {
            M1: { direction: 'stop', speed: DEFAULT_DC_MOTOR_POWER_RATIO },
            M2: { direction: 'stop', speed: DEFAULT_DC_MOTOR_POWER_RATIO },
        };
        this.servo = { degree: DEFAULT_ARM_DEGREE, calibration: 0 };
        this.sensors = {};
        SENSOR_PORTS.forEach((port) => {
            this.sensors[port] = 0;
        });
    }

    /**
     * The arm's angle, read by the bendArm block to start its interpolation.
     * @returns {number} - degrees (0-180).
     */
    get armDegree() {
        return this.servo.degree;
    }

    /**
     * @returns {object} - a copy of the state. The shape is described in docs/extension-smalrubot-s1/README.md.
     */
    getState() {
        return {
            mode: this.mode,
            leds: Object.assign({}, this.leds),
            motors: {
                M1: Object.assign({}, this.motors.M1),
                M2: Object.assign({}, this.motors.M2),
            },
            servo: { [SERVO_PORT]: Object.assign({}, this.servo) },
            sensors: Object.assign({}, this.sensors),
        };
    }

    emitState() {
        const state = this.getState();
        if (this.runtime) {
            this.runtime.studuinoPracticeBoardState = state;
            if (typeof this.runtime.emit === 'function') {
                this.runtime.emit(STATE_EVENT, state);
            }
        }
        return state;
    }

    /**
     * @param {string} mode - 'practice' or 'device'.
     */
    setMode(mode) {
        if (this.mode === mode) {
            return;
        }
        this.mode = mode;
        this.emitState();
    }

    /**
     * Change a sensor value (the GUI panel's sliders and buttons).
     * @param {string} portOrPosition - a port ('A2', 'A4', 'A5', 'A6', 'A7') or a menu value ('light', 'ir_a4', ...).
     * @param {number|string} value - the new value.
     * @returns {boolean} - true when the value was changed.
     */
    setSensorValue(portOrPosition, value) {
        const port = SENSOR_PORT_BY_POSITION[portOrPosition] || portOrPosition;
        const number = Number(value);
        if (!Object.prototype.hasOwnProperty.call(this.sensors, port) || !Number.isFinite(number)) {
            return false;
        }
        if (this.sensors[port] !== number) {
            this.sensors[port] = number;
            this.emitState();
        }
        return true;
    }

    led(position, state) {
        const port = LED_PORT_BY_POSITION[position] || LED_PORT_BY_POSITION.right;
        const on = !!state;
        if (this.leds[port] !== on) {
            this.leds[port] = on;
            this.emitState();
        }
        return Promise.resolve();
    }

    getMotorSpeed(position) {
        return this.dcMotorPowerRatios[position];
    }

    setMotorSpeed(position, speedRatio) {
        // Like the real board, the speed is used from the next action (forward, backward, ...).
        this.dcMotorPowerRatios[position] = clamp(speedRatio, 0, 100);
    }

    setArmCalibration(degree) {
        const calibration = clamp(degree, -15, 15);
        if (this.servo.calibration !== calibration) {
            this.servo.calibration = calibration;
            this.emitState();
        }
        return Promise.resolve();
    }

    action(direction) {
        const directions = MOTOR_DIRECTIONS_BY_ACTION[direction];
        if (!directions) {
            return Promise.reject(new Error(`Could not action: reason=<Invalid direction> direction=<${direction}>`));
        }
        const [left, right] = directions;
        this.motors.M1.direction = left;
        this.motors.M2.direction = right;
        if (direction !== 'stop') {
            this.motors.M1.speed = this.dcMotorPowerRatios.left;
            this.motors.M2.speed = this.dcMotorPowerRatios.right;
        }
        this.emitState();
        return Promise.resolve();
    }

    /**
     * Turn one DC motor, as the real board does.
     * @param {string} port - 'M1' or 'M2'.
     * @param {string} direction - 'normal', 'reverse' or 'stop'.
     * @returns {Promise} - resolved when done, rejected for an unknown port or direction.
     */
    dcMotor(port, direction) {
        const position = POSITION_BY_MOTOR_PORT[port];
        if (!position || !MOTOR_DIRECTIONS.includes(direction)) {
            return Promise.reject(
                new Error(
                    `Could not dcMotor: reason=<Invalid port or direction> port=<${port}> direction=<${direction}>`,
                ),
            );
        }
        this.motors[port].direction = direction;
        if (direction !== 'stop') {
            this.motors[port].speed = this.dcMotorPowerRatios[position];
        }
        this.emitState();
        return Promise.resolve();
    }

    bendArm(degree) {
        if (degree < 0) {
            degree = 0;
        } else if (degree > 180) {
            degree = 180;
        } else {
            degree = Math.round(degree);
        }
        if (this.servo.degree !== degree) {
            this.servo.degree = degree;
            this.emitState();
        }
        return Promise.resolve();
    }

    getSensorValue(position) {
        const port = SENSOR_PORT_BY_POSITION[position];
        return Promise.resolve(port ? this.sensors[port] : 0);
    }

    stopAll() {
        return this.led('left', false)
            .then(() => this.led('right', false))
            .then(() => this.action('stop'));
    }
}

module.exports = StuduinoPracticeBoard;
