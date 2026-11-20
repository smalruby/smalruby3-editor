/* global process */
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const formatMessage = require('format-message');
const Cast = require('../../util/cast');
const Timer = require('../../util/timer');
const StuduinoPracticeBoard = require('./practice-board');
const StuduinoCommandLog = require('./command-log');

/**
 * Icon svg to be displayed at the left edge of each extension block, encoded as a data URI.
 * @type {string}
 */

const blockIconURI =
    'data:image/png;base64,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';

const _PORT_D2 = 0;
const _PORT_D4 = 1;
const _PORT_D7 = 2;
const _PORT_D8 = 3;
const _PORT_D9 = 4;
const PORT_D10 = 5;
const _PORT_D11 = 6;
const _PORT_D12 = 7;

const PORT_M1 = 0;
const PORT_M2 = 1;

const PORT_A0 = 0;
const PORT_A1 = 1;
const PORT_A2 = 2;
const _PORT_A3 = 3;
const PORT_A4 = 4;
const PORT_A5 = 5;
const PORT_A6 = 6;
const PORT_A7 = 7;

const _PIDOPEN = 0;
const PIDLED = 1;
const _PIDBUZZER = 2;
const PIDLIGHTSENSOR = 3;
const PIDSOUNDSENSOR = 4;
const PIDIRPHOTOREFLECTOR = 5;
const _PIDACCELEROMETER = 6;
const PIDTOUCHSENSOR = 7;
const _PIDPUSHSWITCH = 8;

const NORMAL = 0;
const REVERSE = 1;
const _BRAKE = 2;
const COAST = 3;

const ON = 1;
const OFF = 0;

const DEFAULT_DC_MOTOR_POWER_RATIO = 50;

const SERVO_MOTOR_PORT = PORT_D10;

const FPS = 30;

// The DC motor blocks name the motor by its port; the speed is kept per position (M1 = left, M2 = right).
const POSITION_BY_MOTOR_PORT = { M1: 'left', M2: 'right' };
const DC_MOTOR_VALUE_BY_DIRECTION = { normal: NORMAL, reverse: REVERSE, stop: COAST };

class SmalrubotError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SmalrubotError';
    }
}

class Smalrubot {
    static get HIGH() {
        return 255;
    }

    static get LOW() {
        return 0;
    }

    static get WRITE_COMMANDS() {
        return {
            digital_write: '01',
            analog_write: '03',
            servo_toggle: '08',
            servo_write: '09',
            set_neo_pixel_pin: '10',
            set_neo_pixel_num_pixels: '11',
            set_neo_pixel_color: '12',
            show_neo_pixel: '13',

            set_dc_motor_calibration: '20',
            set_servomotor_calibration: '21',
            init_dc_motor_port: '22',
            init_servo_motor_port: '23',
            init_sensor_port: '25',

            dc_motor_power: '42',
            dc_motor_control: '43',
            servo_motor: '44',

            led: '51',
        };
    }

    static get READ_COMMANDS() {
        return {
            digital_read: '02',
            analog_read: '04',

            get_touch_sensor_value: '61',
            get_light_sensor_value: '62',
            get_sound_sensor_value: '63',
            get_ir_photoreflector_value: '64',

            reset_v2: '91',
        };
    }

    constructor(runtime) {
        this.runtime = runtime;

        // Access navigator with fallback for test environments
        // In browser: navigator is available globally
        // In Node.js tests: use global._mockNavigator to avoid Navigator object conversion
        let nav;
        try {
            // Try global._mockNavigator first (for tests)
            nav =
                (typeof global !== 'undefined' && global._mockNavigator) ||
                // Then try native navigator
                (typeof navigator !== 'undefined' && navigator) ||
                {};
        } catch {
            nav = {};
        }

        if ('serial' in nav) {
            this.serial = nav.serial;
        } else {
            this.emitRuntime('PERIPHERAL_REQUEST_ERROR', {
                extensionId: Scratch3SmalrubotS1Blocks.EXTENSION_ID, // eslint-disable-line
            });

            throw new SmalrubotError('Web Serial API is not supported.');
        }

        this.serialPortFilter = {
            usbVendorId: 0x067b,
            usbProductId: 0x2303,
        };

        this.serialPort = null;

        this.options = {
            baudRate: 19200,
            databits: 8,
            stopbits: 1,
            parity: 'none',
            buffersize: 255,
            rtscts: false,
            xon: false,
            xoff: false,
            xany: false,
        };

        this.connectionState = 'disconnected';

        this.writer = null;
        this.writing = false;
        this.writeQueue = [];
        this.encoder = new TextEncoder();

        this.reader = null;
    }

    emitRuntime(eventName, ...args) {
        debug(() => {
            let s = `emitRuntime: eventName=<${eventName}>`;
            if (args.length > 0) {
                s += ` args=<${JSON.stringify(...args)}>`;
            }
            return s;
        });

        return new Promise(() => this.runtime.emit(this.runtime.constructor[eventName], ...args));
    }

    scan() {
        debug(() => 'Smalrubot.scan');

        return Promise.resolve()
            .then(() => {
                if (this.connectionState !== 'disconnected') {
                    debug(() => 'Disconnect before connecting: reason=<Already connected>');
                    return this.disconnect();
                }
                return Promise.resolve();
            })
            .then(() =>
                this.serial.requestPort({
                    filters: [this.serialPortFilter],
                }),
            )
            .then((serialPort) => {
                this.serialPort = serialPort;

                this.setConnectionState('scanned');
            })
            .catch((error) => {
                log.error(error);

                this.emitRuntime('PERIPHERAL_REQUEST_ERROR', {
                    extensionId: Scratch3SmalrubotS1Blocks.EXTENSION_ID, // eslint-disable-line
                });
            });
    }

    connectDirect(serialPort) {
        debug(() => 'Smalrubot.connectDirect');

        return Promise.resolve()
            .then(() => {
                if (this.connectionState !== 'disconnected') {
                    debug(() => 'Disconnect before connecting: reason=<Already connected>');
                    return this.disconnect();
                }
                return Promise.resolve();
            })
            .then(() => {
                this.serialPort = serialPort;
                this.setConnectionState('scanned');
            })
            .then(() => this.connect());
    }

    requestDisconnect() {
        debug(() => 'Smalrubot.requestDisconnect');

        this.setConnectionState('disconnecting');
        return this.disconnect();
    }

    disconnect() {
        debug(() => 'Smalrubot.disconnect');
        log.info('[Disconnect] Starting disconnect sequence');

        if (this.connectionState === 'disconnected') {
            debug(() => 'Already disconnected.');
            log.info('[Disconnect] Already in disconnected state, skipping');
            return Promise.resolve();
        }

        if (!this.serialPort) {
            debug(() => 'Already disconnected.');
            log.info('[Disconnect] No serial port, setting state to disconnected');
            this.setConnectionState('disconnected');
            return Promise.resolve();
        }

        log.info('[Disconnect] Stopping all operations before cleanup');
        return this.stopAll()
            .catch((error) => {
                log.warn('[Disconnect] Error during stopAll (expected during physical disconnect):', error);
            })
            .then(() => {
                log.info('[Disconnect] Starting resource cleanup');
                let promise = Promise.resolve();

                if (this.reader) {
                    log.info('[Disconnect] Canceling reader');
                    promise = promise
                        .then(() => this.reader.cancel())
                        .then(() => {
                            log.info('[Disconnect] Reader canceled successfully');
                            this.reader = null;
                        })
                        .catch((error) => {
                            log.warn('[Disconnect] Error canceling reader (may already be closed):', error);
                            this.reader = null;
                        });
                }

                if (this.writer) {
                    log.info('[Disconnect] Closing writer');
                    promise = promise
                        .then(() => this.writer.close())
                        .then(() => {
                            log.info('[Disconnect] Writer closed successfully');
                            this.writer = null;
                            this.writing = false;
                            this.writeQueue = [];
                        })
                        .catch((error) => {
                            log.warn('[Disconnect] Error closing writer (may be in ERRORED state):', error);
                            this.writer = null;
                            this.writing = false;
                            this.writeQueue = [];
                        });
                }

                log.info('[Disconnect] Closing serial port');
                promise = promise
                    .then(() => this.serialPort.close())
                    .then(() => {
                        log.info('[Disconnect] Serial port closed successfully');
                        this.serialPort = null;
                    })
                    .catch((error) => {
                        // Port may already be closed due to physical disconnection
                        // This is expected behavior and should not prevent state transition
                        log.warn('[Disconnect] Error closing serial port (may already be closed):', error);
                        this.serialPort = null;
                    });

                return promise;
            })
            .then(() => {
                // CRITICAL: Always transition to disconnected state, even if errors occurred
                // This ensures the GUI reflects the actual state and allows reconnection
                log.info('[Disconnect] Setting connection state to disconnected');
                this.setConnectionState('disconnected');
                log.info('[Disconnect] Disconnect sequence completed successfully');
            })
            .catch((error) => {
                // Log any unexpected errors but still ensure state transition
                log.error('[Disconnect] Unexpected error during disconnect:', error);
                log.info('[Disconnect] Ensuring state transition despite errors');
                this.setConnectionState('disconnected');
            });
    }

    isConnected() {
        return this.connectionState === 'connected';
    }

    writeCommand(commandName, pin, value = 0) {
        const command = Smalrubot.WRITE_COMMANDS[commandName];

        debug(() => `writeCommand: command=<${commandName} (${command})> pin=<${pin}> value=<${value}>`);

        try {
            this.throwIfClosed();

            return this.write(
                `${this.normalizeCommand(command)}${this.normalizePin(pin)}${this.normalizeValue(value)}`,
            ).catch((error) => {
                log.error(
                    `Error writing command: reason=<${error}>` +
                        ` command=<${commandName} (${command})> pin=<${pin}>`,
                );
            });
        } catch (error) {
            log.error(`Error writing command: reason=<${error}> command=<${commandName} (${command})> pin=<${pin}>`);
        }
        return Promise.resolve();
    }

    write(message, wrap = true) {
        if (wrap) {
            message = `!${message}.`;
        }
        const bytes = this.encoder.encode(message);

        debug(() => `write: message=<${message}> length=<${bytes.length}> wrap=<${wrap}>`);

        this.writeQueue.push(bytes);

        if (this.writing) {
            debug(() => `Now writing, so only add queue: message=<${message}>`);
            return Promise.resolve();
        }

        this.writing = true;

        const writeLoop = () => {
            const b = this.writeQueue.shift();
            if (b) {
                return this.writer.write(b).then(() => writeLoop());
            }
            this.writing = false;
            return Promise.resolve();
        };
        return writeLoop().catch((error) => {
            this.writing = false;

            throw error;
        });
    }

    readCommand(commandName, pin) {
        const command = Smalrubot.READ_COMMANDS[commandName];

        debug(() => `readCommand: command=<${commandName} (${command})> pin=<${pin}>`);

        try {
            this.throwIfClosed();

            if (!this.sensorValues[pin]) {
                throw Error('Unknown pin');
            }

            const nowMilliseconds = Number(new Date());

            const promise = this.write(
                `${this.normalizeCommand(command)}${this.normalizePin(pin)}${this.normalizeValue(0)}`,
            );

            const sleepSeconds = Math.round(1000 / FPS) / 1000;

            const readCommandLoop = (retryRemaining) => {
                debug(() => `readCommandLoop: retry remaining=<${retryRemaining}>`);

                const updatedAt = this.sensorValues[pin].updatedAt;
                const value = this.sensorValues[pin].value;
                if (updatedAt >= nowMilliseconds) {
                    debug(
                        () =>
                            `Read sensor value: value=<${value}>` +
                            ` updatedAt=<${new Date(updatedAt).toLocaleString()}>`,
                    );
                    return Promise.resolve(value);
                }
                retryRemaining--;
                if (retryRemaining <= 0) {
                    throw Error('timeouted');
                }

                return this.sleep(sleepSeconds).then(() => readCommandLoop(retryRemaining));
            };

            return promise
                .then(() => this.sleep(sleepSeconds))
                .then(() => readCommandLoop(10))
                .catch((error) => {
                    const value = this.sensorValues[pin].value;
                    const updatedAt = this.sensorValues[pin].updatedAt;
                    log.error(
                        `Error reading sensor value, so return 0: reason=<${error}>` +
                            ` current sensor value=<${value}> updatedAt=<${new Date(updatedAt).toLocaleString()}>`,
                    );

                    return Promise.resolve('0');
                });
        } catch (error) {
            log.error(
                `Error reading sensor value, so return 0: reason=<${error}>` +
                    ` command=<${commandName} (${command})> pin=<${pin}>`,
            );
            return Promise.resolve('0');
        }
    }

    setConnectionState(connectionState) {
        const prevConnectionState = this.connectionState;

        debug(() => `Set connection state: from=<${prevConnectionState}> to=<${connectionState}>`);
        log.info(`[SetConnectionState] Transitioning from '${prevConnectionState}' to '${connectionState}'`);

        this.connectionState = connectionState;

        switch (this.connectionState) {
            case 'scanned':
                log.info('[SetConnectionState] Emitting PERIPHERAL_LIST_UPDATE event');
                this.emitRuntime('PERIPHERAL_LIST_UPDATE', { 0: { peripheralId: 0 } });
                break;
            case 'connected':
                log.info('[SetConnectionState] Emitting PERIPHERAL_CONNECTED event');
                this.emitRuntime('PERIPHERAL_CONNECTED');
                break;
            case 'disconnected':
                if (prevConnectionState === 'connecting') {
                    log.info(
                        '[SetConnectionState] Connection failed during connect phase, ' +
                            'emitting PERIPHERAL_REQUEST_ERROR',
                    );
                    this.emitRuntime('PERIPHERAL_REQUEST_ERROR', {
                        extensionId: Scratch3SmalrubotS1Blocks.EXTENSION_ID, // eslint-disable-line
                    });
                } else if (prevConnectionState !== 'disconnecting' && prevConnectionState !== 'disconnected') {
                    log.info(
                        '[SetConnectionState] Unexpected disconnection detected, ' +
                            'emitting PERIPHERAL_CONNECTION_LOST_ERROR',
                    );
                    this.emitRuntime('PERIPHERAL_CONNECTION_LOST_ERROR', {
                        extensionId: Scratch3SmalrubotS1Blocks.EXTENSION_ID, // eslint-disable-line
                    });
                } else {
                    log.info('[SetConnectionState] Normal disconnection, no error events emitted');
                }
                log.info('[SetConnectionState] Emitting PERIPHERAL_DISCONNECTED event');
                this.emitRuntime('PERIPHERAL_DISCONNECTED');
                break;
        }

        // Lets the extension switch between the real board and the practice board (#2191).
        if (typeof this.onConnectionStateChange === 'function') {
            this.onConnectionStateChange(connectionState);
        }
    }

    stopAll() {
        debug(() => 'Smalrubot.stopAll');

        return Promise.resolve();
    }

    sleep(seconds) {
        debug(() => `Sleep: senconds=<${seconds}>`);

        return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }

    throwIfClosed() {
        if (this.connectionState === 'disconnected') {
            throw new SmalrubotError('Serial port closed');
        }
    }

    normalizePin(pin) {
        if (String(pin).match(/^a/i)) {
            pin = this.analogZero + String(pin).substring(1);
        }
        if (Number(pin) > 99) {
            throw new SmalrubotError(`Pin number must be in 0-99: pin=<${pin}>`);
        }
        return this.normalize(pin, 2);
    }

    normalizeCommand(command) {
        if (String(command).length > 2) {
            throw new SmalrubotError(`Commands can only be two digits: command=<${command}>`);
        }
        return this.normalize(command, 2);
    }

    normalizeValue(value) {
        if (String(value).length > 3) {
            throw new SmalrubotError(`Values are limited to three digits: value=<${value}>`);
        }
        return this.normalize(value, 3);
    }

    normalize(value, spaces) {
        const paddingLength = spaces - String(value).length;
        let padding = '';
        for (let i = 0; i < paddingLength; i++) {
            padding += '0';
        }
        return padding + value;
    }

    lineToString(line) {
        return line.replace('\r', '[CR]').replace('\n', '[LF]');
    }
}

class SmalrubotS1 extends Smalrubot {
    constructor(runtime) {
        super(runtime);

        this.dcMotorPowerRatios = {
            left: DEFAULT_DC_MOTOR_POWER_RATIO,
            right: DEFAULT_DC_MOTOR_POWER_RATIO,
        };

        this.resetSensorValues();
    }

    resetSensorValues() {
        const nowMilliseconds = Number(new Date());
        this.sensorValues = {
            // HACK: for reset_v2
            0: {
                value: '0',
                updatedAt: nowMilliseconds,
            },
            [PORT_A2]: {
                value: '0',
                updatedAt: nowMilliseconds,
            },
            [PORT_A4]: {
                value: '0',
                updatedAt: nowMilliseconds,
            },
            [PORT_A5]: {
                value: '0',
                updatedAt: nowMilliseconds,
            },
            [PORT_A6]: {
                value: '0',
                updatedAt: nowMilliseconds,
            },
            [PORT_A7]: {
                value: '0',
                updatedAt: nowMilliseconds,
            },
        };
    }

    updateSensorValues() {
        debug(() => `updateSensorValues`);

        const decoder = new TextDecoder();
        let readBuffer = '';

        const updateSensorValuesLoop = () =>
            this.reader
                .read()
                .then((data) => {
                    const now = new Date();
                    const { value, done } = data;
                    if (done) {
                        debug(() => `Canceled reading`);
                        return Promise.resolve();
                    }

                    if (value) {
                        const s = decoder.decode(value);
                        debug(
                            () =>
                                `reader.read: value=<${JSON.stringify(value, null, 2)}>` +
                                ` decoded=<${this.lineToString(s)}> done=<${done}>`,
                        );
                        readBuffer += s;
                    } else {
                        debug(() => `reader.read: value=<> decoded=<> done=<${done}>`);
                    }
                    debug(() => `readBuffer=<${this.lineToString(readBuffer)}>`);

                    while (readBuffer.includes('\r\n')) {
                        const position = readBuffer.indexOf('\r\n');
                        const line = readBuffer.substring(0, position);
                        readBuffer = readBuffer.substring(position + '\r\n'.length);
                        debug(
                            // eslint-disable-next-line no-loop-func
                            () =>
                                `Got line from readBuffer: line=<${this.lineToString(line)}>` +
                                ` readBuffer=<${this.lineToString(readBuffer)}>`,
                        );

                        if (line.length > 0 && line.match(/^\d+:/)) {
                            const pinAndValue = line.split(/:/);
                            const pin = Number(pinAndValue[0]);
                            if (this.sensorValues[pin]) {
                                this.sensorValues[pin].value = pinAndValue[1];
                                this.sensorValues[pin].updatedAt = Number(now);

                                debug(
                                    () =>
                                        `Updated sensor value: pin=<${pin}>` +
                                        ` value=<${pinAndValue[1]}> updateAt=<${now.toLocaleString()}>`,
                                );
                            } else {
                                log.warn(
                                    `Could not update sensor value: reason=<Unknown pin>` +
                                        ` pin=<${pin}> value=<${pinAndValue[1]}>`,
                                );
                            }
                        } else {
                            log.warn(
                                `Could not update sensor value: reason=<Invalid format>` +
                                    ` line=<${this.lineToString(line)}>`,
                            );
                        }
                    }
                    return updateSensorValuesLoop();
                })
                .catch((error) => {
                    log.error(`[UpdateSensorValues] Error reading from Smalrubot: ${error.name}: ${error.message}`);
                    log.info('[UpdateSensorValues] Physical disconnection detected, initiating disconnect cleanup');

                    this.disconnect();
                });

        return updateSensorValuesLoop();
    }

    connect() {
        debug(() => 'connect');

        if (this.connectionState !== 'scanned') {
            return Promise.reject(new Error('Failed to connect: reason=<Not scan>'));
        }

        let promise = Promise.resolve();
        promise = promise
            .then(() => this.serialPort.open(this.options))
            .then(() => {
                this.setConnectionState('connecting');

                this.writer = this.serialPort.writable.getWriter();
                this.writing = false;
                this.writeQueue = [];

                this.reader = this.serialPort.readable.getReader();

                this.armDegree = 90;

                this.updateSensorValues();

                return this.sleep(2);
            })
            .then(() => this.readCommand('reset_v2', 0))
            .then((value) => {
                const versionAndAnalogZero = value.split(',');
                if (versionAndAnalogZero[0] === 'S1') {
                    this.analogZero = Number(versionAndAnalogZero[1]);
                } else {
                    throw new SmalrubotError('Smalrubot S1 not found.');
                }
            })
            .then(() => this.initDcMotorPort(PORT_M1))
            .then(() => this.initDcMotorPort(PORT_M2))
            .then(() => this.initServoMotorPort(SERVO_MOTOR_PORT))
            .then(() => this.initSensorPort(PORT_A0, PIDLED))
            .then(() => this.initSensorPort(PORT_A1, PIDLED))
            .then(() => this.initSensorPort(PORT_A2, PIDTOUCHSENSOR))
            .then(() => this.initSensorPort(PORT_A4, PIDIRPHOTOREFLECTOR))
            .then(() => this.initSensorPort(PORT_A5, PIDIRPHOTOREFLECTOR))
            .then(() => this.initSensorPort(PORT_A6, PIDLIGHTSENSOR))
            .then(() => this.initSensorPort(PORT_A7, PIDSOUNDSENSOR))
            .then(() => {
                this.setConnectionState('connected');
            });

        promise = promise.catch((error) => {
            log.error(`Error in connect: ${error}`);
            return this.disconnect().then(() => {
                throw error;
            });
        });

        return promise;
    }

    led(position, state) {
        debug(() => `led: position=<${position}> state=<${state}>`);

        const pin = position === 'left' ? PORT_A0 : PORT_A1;
        const value = state ? ON : OFF;
        return this.writeCommand('led', pin, value);
    }

    getMotorSpeed(position) {
        debug(() => `getMotorSpeed: position=<${position}>`);

        return this.dcMotorPowerRatios[position];
    }

    setMotorSpeed(position, speedRatio) {
        debug(() => `setMotorSpeed: position=<${position}> speed=<${speedRatio} %>`);

        if (speedRatio > 100) {
            speedRatio = 100;
        } else if (speedRatio < 0) {
            speedRatio = 0;
        }
        this.dcMotorPowerRatios[position] = speedRatio;
    }

    setArmCalibration(degree) {
        debug(() => `setArmCalibration: degree=<${degree}>`);

        if (degree > 15) {
            degree = 15;
        } else if (degree < -15) {
            degree = -15;
        }
        return this.writeCommand('set_servomotor_calibration', SERVO_MOTOR_PORT, degree);
    }

    action(direction) {
        debug(() => `action: direction=<${direction}>`);

        let leftValue;
        let rightValue;
        switch (direction) {
            case 'forward':
                leftValue = NORMAL;
                rightValue = NORMAL;
                break;
            case 'backward':
                leftValue = REVERSE;
                rightValue = REVERSE;
                break;
            case 'left':
                leftValue = REVERSE;
                rightValue = NORMAL;
                break;
            case 'right':
                leftValue = NORMAL;
                rightValue = REVERSE;
                break;
            case 'stop':
                leftValue = COAST;
                rightValue = COAST;
                break;
            default:
                return Promise.reject(
                    new Error(`Could not action: reason=<Invalid direction> direction=<${direction}>`),
                );
        }

        return Promise.resolve()
            .then(() => {
                if (direction !== 'stop') {
                    return this.applyDcMotorPowers();
                }
                return Promise.resolve();
            })
            .then(() => this.writeCommand('dc_motor_control', PORT_M1, leftValue))
            .then(() => this.writeCommand('dc_motor_control', PORT_M2, rightValue));
    }

    dcMotor(port, direction) {
        debug(() => `dcMotor: port=<${port}> direction=<${direction}>`);

        const position = POSITION_BY_MOTOR_PORT[port];
        const value = DC_MOTOR_VALUE_BY_DIRECTION[direction];
        if (!position || typeof value === 'undefined') {
            return Promise.reject(
                new Error(
                    `Could not dcMotor: reason=<Invalid port or direction> port=<${port}> direction=<${direction}>`,
                ),
            );
        }
        const pin = port === 'M2' ? PORT_M2 : PORT_M1;

        return Promise.resolve()
            .then(() => (direction === 'stop' ? Promise.resolve() : this.applyDcMotorPower(position)))
            .then(() => this.writeCommand('dc_motor_control', pin, value));
    }

    bendArm(degree) {
        if (degree < 0) {
            degree = 0;
        } else if (degree > 180) {
            degree = 180;
        } else {
            degree = Math.round(degree);
        }

        debug(() => `bendArm: degree=<${degree}>`);

        if (this.armDegree === degree) {
            debug(() => `Does not bend arm: reason=<Already bended> degree=<${degree}>`);
            return Promise.resolve();
        }

        this.armDegree = degree;
        return this.writeCommand('servo_motor', SERVO_MOTOR_PORT, degree);
    }

    getSensorValue(position) {
        debug(() => `getSensorValue: position=<${position}>`);

        let commandName;
        let pin;
        switch (position) {
            case 'touch':
                commandName = 'get_touch_sensor_value';
                pin = PORT_A2;
                break;
            // `ir_a4` / `ir_a5` are the textbook names of `left` / `right` (same sensors and ports, #2189).
            case 'left':
            case 'ir_a4':
                commandName = 'get_ir_photoreflector_value';
                pin = PORT_A4;
                break;
            case 'right':
            case 'ir_a5':
                commandName = 'get_ir_photoreflector_value';
                pin = PORT_A5;
                break;
            case 'light':
                commandName = 'get_light_sensor_value';
                pin = PORT_A6;
                break;
            case 'sound':
                commandName = 'get_sound_sensor_value';
                pin = PORT_A7;
                break;
        }

        return this.readCommand(commandName, pin).then((value) => Number(value));
    }

    initDcMotorPort(port) {
        debug(() => `initDcMotorPort: port=<${port}>`);

        return this.writeCommand('init_dc_motor_port', port);
    }

    initServoMotorPort(port) {
        debug(() => `initServoMotorPort: port=<${port}>`);

        return this.writeCommand('init_servo_motor_port', port);
    }

    initSensorPort(port, pid) {
        debug(() => `initSensorPort: port=<${port}> pid=<${pid}>`);

        return this.writeCommand('init_sensor_port', port, pid);
    }

    applyDcMotorPowers() {
        return this.applyDcMotorPower('left').then(() => this.applyDcMotorPower('right'));
    }

    applyDcMotorPower(position) {
        const ratio = this.dcMotorPowerRatios[position];
        const power = Math.round(Smalrubot.HIGH * (ratio / 100));

        debug(() => `applyDcMotorPower: position=<${position}> speed=<${ratio} %> power=<${power}>`);

        let pin = PORT_M1;
        if (position === 'right') {
            pin = PORT_M2;
        }

        return this.writeCommand('dc_motor_power', pin, power);
    }

    stopAll() {
        debug(() => 'SmalrubotS1.stopAll');

        return this.led('left', false)
            .then(() => this.led('right', false))
            .then(() => this.action('stop'));
    }
}

// The ports and names in the command record (#2193): the fixed S1 layout, the same for both boards.
const LOG_LED_PORT_BY_POSITION = { left: 'A0', right: 'A1' };
const LOG_MOTOR_PORT_BY_POSITION = { left: 'M1', right: 'M2' };
const LOG_MOTOR_DIRECTIONS_BY_ACTION = {
    forward: ['normal', 'normal'],
    backward: ['reverse', 'reverse'],
    left: ['reverse', 'normal'],
    right: ['normal', 'reverse'],
    stop: ['stop', 'stop'],
};
const LOG_SENSOR_BY_POSITION = {
    touch: { port: 'A2', kind: 'touch' },
    left: { port: 'A4', kind: 'irPhotoreflector' },
    ir_a4: { port: 'A4', kind: 'irPhotoreflector' },
    right: { port: 'A5', kind: 'irPhotoreflector' },
    ir_a5: { port: 'A5', kind: 'irPhotoreflector' },
    light: { port: 'A6', kind: 'light' },
    sound: { port: 'A7', kind: 'sound' },
};

/**
 * Host for the Smalrubot S1-related blocks
 * @param {Runtime} runtime - the runtime instantiating this block package.
 * @class
 */
class Scratch3SmalrubotS1Blocks {
    /**
     * @returns {string} - the name of this extension.
     */
    static get EXTENSION_NAME() {
        return 'ArtecRobo';
    }

    /**
     * @returns {string} - the ID of this extension.
     */
    static get EXTENSION_ID() {
        return 'smalrubotS1';
    }

    /**
     * @returns {Array} - text and values for each actions menu element
     */
    get ACTIONS_MENU() {
        return [
            {
                text: formatMessage({
                    id: 'smalrubotS1.actionMenu.forward',
                    default: 'forward',
                    description: 'label for "forward" element in action picker for Smalrubot S1 extension',
                }),
                value: 'forward',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.actionMenu.backward',
                    default: 'backward',
                    description: 'label for "backward" element in action picker for Smalrubot S1 extension',
                }),
                value: 'backward',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.actionMenu.turnLeft',
                    default: 'turn left',
                    description: 'label for "turn left" element in action picker for Smalrubot S1 extension',
                }),
                value: 'left',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.actionMenu.turnRight',
                    default: 'turn right',
                    description: 'label for "turn right" element in action picker for Smalrubot S1 extension',
                }),
                value: 'right',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.actionMenu.stop',
                    default: 'stop',
                    description: 'label for "stop" element in action picker for Smalrubot S1 extension',
                }),
                value: 'stop',
            },
        ];
    }

    /**
     * @returns {Array} - text and values for each positions menu element
     */
    get POSITIONS_MENU() {
        return [
            {
                text: formatMessage({
                    id: 'smalrubotS1.positionsMenu.left',
                    default: 'left',
                    description: 'label for "left" element in position picker for Smalrubot S1 extension',
                }),
                value: 'left',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.positionsMenu.right',
                    default: 'right',
                    description: 'label for "right" element in position picker for Smalrubot S1 extension',
                }),
                value: 'right',
            },
        ];
    }

    /**
     * @returns {Array} - text and values for each DC motor menu element
     */
    get MOTORS_MENU() {
        // The values are the port names. They are saved in projects: never rename or remove them.
        return [
            {
                text: 'M1',
                value: 'M1',
            },
            {
                text: 'M2',
                value: 'M2',
            },
        ];
    }

    /**
     * @returns {Array} - text and values for each DC motor direction menu element
     */
    get MOTOR_DIRECTIONS_MENU() {
        // The same names as the command record (`normal` / `reverse` / `stop`).
        return [
            {
                text: formatMessage({
                    id: 'smalrubotS1.motorDirectionsMenu.normal',
                    default: 'turn forward',
                    description: 'label for "normal" (forward rotation) in DC motor direction picker',
                }),
                value: 'normal',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.motorDirectionsMenu.reverse',
                    default: 'turn backward',
                    description: 'label for "reverse" (backward rotation) in DC motor direction picker',
                }),
                value: 'reverse',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.motorDirectionsMenu.stop',
                    default: 'stop',
                    description: 'label for "stop" in DC motor direction picker',
                }),
                value: 'stop',
            },
        ];
    }

    /**
     * @returns {Array} - text and values for each sensor positions menu element
     */
    get SENSOR_POSITIONS_MENU() {
        // The textbook names come first (#2189). The values are saved in projects:
        // never rename or remove them, only add new ones.
        return [
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.light',
                    default: 'light sensor (A6)',
                    description: 'label for "light" sensor in sensor picker for Smalrubot S1 extension',
                }),
                value: 'light',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.irA4',
                    default: 'infrared sensor (photoreflector) (A4)',
                    description:
                        'label for infrared sensor on A4 (same as "left") sensor in sensor picker for Smalrubot S1 extension',
                }),
                value: 'ir_a4',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.irA5',
                    default: 'infrared sensor (photoreflector) (A5)',
                    description:
                        'label for infrared sensor on A5 (same as "right") sensor in sensor picker for Smalrubot S1 extension',
                }),
                value: 'ir_a5',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.touch',
                    default: 'touch sensor (A2)',
                    description: 'label for "touch" sensor in sensor picker for Smalrubot S1 extension',
                }),
                value: 'touch',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.sound',
                    default: 'sound sensor (A7)',
                    description: 'label for "sound" sensor in sensor picker for Smalrubot S1 extension',
                }),
                value: 'sound',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.left',
                    default: 'left sensor (A4)',
                    description: 'label for "left" sensor in sensor picker for Smalrubot S1 extension',
                }),
                value: 'left',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.right',
                    default: 'right sensor (A5)',
                    description: 'label for "right" sensor in sensor picker for Smalrubot S1 extension',
                }),
                value: 'right',
            },
        ];
    }

    constructor(runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;
        this.runtime.on('PROJECT_STOP_ALL', this.stopAll.bind(this));

        this.runtime.registerPeripheralExtension(Scratch3SmalrubotS1Blocks.EXTENSION_ID, this);

        this._smalrubot = null;

        /**
         * The board in the browser that receives the commands while no real board is connected (#2191).
         * @type {StuduinoPracticeBoard}
         */
        this.practiceBoard = new StuduinoPracticeBoard(this.runtime);
        this.practiceBoard.emitState();

        /**
         * The record of the commands sent and the sensor values read, for the lessons (#2193).
         * It is written here in the block methods, so the real board and the practice board make the same entries.
         * @type {StuduinoCommandLog}
         */
        this.commandLog = new StuduinoCommandLog(this.runtime);
        // A new run (green flag) and a new project start a new record.
        this.runtime.on('PROJECT_START', () => this.commandLog.clear());
        this.runtime.on('PROJECT_LOADED', () => this.commandLog.clear());
    }

    /**
     * @returns {string} - the runtime event sent with every new entry of the command record.
     */
    static get COMMAND_LOG_EVENT() {
        return StuduinoCommandLog.ENTRY_EVENT;
    }

    /**
     * @returns {string} - the runtime event sent when the command record is cleared.
     */
    static get COMMAND_LOG_CLEAR_EVENT() {
        return StuduinoCommandLog.CLEAR_EVENT;
    }

    /**
     * The commands sent and the sensor values read (for the lessons' "done" check).
     * @param {number} [limit] - only the latest `limit` entries.
     * @returns {Array<object>} - copies of the entries, oldest first. The shape is in command-log.js.
     */
    getCommandLog(limit) {
        return this.commandLog.getEntries(limit);
    }

    /**
     * Remove all entries of the command record (for example when a lesson challenge starts).
     */
    clearCommandLog() {
        this.commandLog.clear();
    }

    /**
     * Add an entry to the command record. Never throws: the record must not stop the blocks.
     * @param {object} fact - `{kind, port, value}` and `speed` / `sensor` when they apply.
     */
    recordCommand(fact) {
        try {
            this.commandLog.record(this.isConnected() ? 'device' : 'practice', fact);
        } catch (error) {
            log.error(error);
        }
    }

    recordLed(position, on) {
        this.recordCommand({
            kind: 'led',
            port: LOG_LED_PORT_BY_POSITION[position] || 'A1',
            value: on ? 'on' : 'off',
        });
    }

    recordAction(direction) {
        const directions = LOG_MOTOR_DIRECTIONS_BY_ACTION[direction];
        if (!directions) {
            return;
        }
        ['left', 'right'].forEach((position, index) => {
            const value = directions[index];
            const speed = value === 'stop' ? 0 : Number(this.board.getMotorSpeed(position)) || 0;
            this.recordCommand({ kind: 'motor', port: LOG_MOTOR_PORT_BY_POSITION[position], value, speed });
        });
    }

    /**
     * bendArm the board and record the angle.
     * @param {number} degree - degrees.
     * @param {boolean} [onTheWay] - true for an angle on the way of a timed bendArm: it is recorded only when the
     *   angle changes (the arm moves every frame, often by less than 1 degree). The last angle is always recorded.
     */
    bendBoardArm(degree, onTheWay = false) {
        let value = Cast.toNumber(degree);
        value = value < 0 ? 0 : value > 180 ? 180 : Math.round(value);
        if (!onTheWay || this.board.armDegree !== value) {
            this.recordCommand({ kind: 'servo', port: 'D10', value });
        }
        this.board.bendArm(degree);
    }

    recordSensorRead(position, value) {
        const sensor = LOG_SENSOR_BY_POSITION[position];
        if (!sensor) {
            return;
        }
        this.recordCommand({ kind: 'sensorRead', port: sensor.port, sensor: sensor.kind, value: Number(value) });
    }

    /**
     * @returns {string} - the runtime event sent on every change of the practice board's state.
     */
    static get PRACTICE_BOARD_STATE_EVENT() {
        return StuduinoPracticeBoard.STATE_EVENT;
    }

    get smalrubot() {
        try {
            if (!this._smalrubot) {
                this._smalrubot = new SmalrubotS1(this.runtime);
                // Keep the speeds set before the real board was made (they used to be kept on it).
                this._smalrubot.dcMotorPowerRatios = Object.assign({}, this.practiceBoard.dcMotorPowerRatios);
                this._smalrubot.onConnectionStateChange = () => {
                    this.practiceBoard.setMode(this.isConnected() ? 'device' : 'practice');
                };
            }
        } catch (e) {
            log.error(e);
        }
        return this._smalrubot;
    }

    /**
     * The board the blocks talk to: the real board while it is connected, otherwise the practice board.
     * @returns {SmalrubotS1|StuduinoPracticeBoard} - the board.
     */
    get board() {
        return this.isConnected() ? this._smalrubot : this.practiceBoard;
    }

    /**
     * @returns {object} - a copy of the practice board's state (for the GUI panel).
     */
    getPracticeBoardState() {
        return this.practiceBoard.getState();
    }

    /**
     * Change a sensor value of the practice board (for the GUI panel).
     * @param {string} portOrPosition - a port ('A6') or a sensor menu value ('light').
     * @param {number|string} value - the new value.
     * @returns {boolean} - true when the value was changed.
     */
    setPracticeSensorValue(portOrPosition, value) {
        return this.practiceBoard.setSensorValue(portOrPosition, value);
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo() {
        return {
            id: Scratch3SmalrubotS1Blocks.EXTENSION_ID,
            // The kit is ArtecRobo and its board is Studuino (the teacher's text of the kit uses these names).
            name: formatMessage({
                id: 'smalrubotS1.categoryName',
                default: Scratch3SmalrubotS1Blocks.EXTENSION_NAME,
                description: 'Label for the ArtecRobo extension category',
            }),
            blockIconURI: blockIconURI,
            showStatusButton: true,
            blocks: [
                {
                    opcode: 'action',
                    text: formatMessage({
                        id: 'smalrubotS1.action',
                        default: '[ACTION]',
                        description: 'action block text',
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        ACTION: {
                            type: ArgumentType.STRING,
                            menu: 'actions',
                            defaultValue: this.ACTIONS_MENU[0].value,
                        },
                    },
                },
                {
                    opcode: 'actionAndStopAfter',
                    text: formatMessage({
                        id: 'smalrubotS1.actionAndStopAfter',
                        default: '[ACTION] for [SECS] seconds',
                        description: 'actionAndStopAfter block text',
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        ACTION: {
                            type: ArgumentType.STRING,
                            menu: 'actions',
                            defaultValue: this.ACTIONS_MENU[0].value,
                        },
                        SECS: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0.5,
                        },
                    },
                },
                {
                    opcode: 'bendArm',
                    text: formatMessage({
                        id: 'smalrubotS1.bendArm',
                        default: 'bend arm [DEGREE] degrees in [SECS] seconds',
                        description: 'bendArm block text',
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        DEGREE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 90,
                        },
                        SECS: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1,
                        },
                    },
                },
                {
                    opcode: 'getSensorValue',
                    text: formatMessage({
                        id: 'smalrubotS1.getSensorValue',
                        default: 'value of [POSITION]',
                        description: 'getSnsorValue block text',
                    }),
                    blockType: BlockType.REPORTER,
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            menu: 'sensorPositions',
                            defaultValue: this.SENSOR_POSITIONS_MENU[0].value,
                        },
                    },
                },
                {
                    opcode: 'turnLedOn',
                    text: formatMessage({
                        id: 'smalrubotS1.turnLedOn',
                        default: 'turn [POSITION] LED on',
                        description: 'turnLedOn block text',
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            menu: 'positions',
                            defaultValue: this.POSITIONS_MENU[0].value,
                        },
                    },
                },
                {
                    opcode: 'turnLedOff',
                    text: formatMessage({
                        id: 'smalrubotS1.turnLedOff',
                        default: 'turn [POSITION] LED off',
                        description: 'turnLedOff block text',
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            menu: 'positions',
                            defaultValue: this.POSITIONS_MENU[0].value,
                        },
                    },
                },
                {
                    opcode: 'getMotorSpeed',
                    text: formatMessage({
                        id: 'smalrubotS1.getMotorSpeed',
                        default: '[POSITION] DC motor speed (%)',
                        description: 'getMotorSpeed block text',
                    }),
                    blockType: BlockType.REPORTER,
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            menu: 'positions',
                            defaultValue: this.POSITIONS_MENU[0].value,
                        },
                    },
                },
                {
                    opcode: 'setMotorSpeed',
                    text: formatMessage({
                        id: 'smalrubotS1.setMotorSpeed',
                        default: 'set [POSITION] DC motor speed [SPEED] (%)',
                        description: 'setMotorSpeed block text',
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        POSITION: {
                            type: ArgumentType.STRING,
                            menu: 'positions',
                            defaultValue: this.POSITIONS_MENU[0].value,
                        },
                        SPEED: {
                            type: ArgumentType.NUMBER,
                            defaultValue: DEFAULT_DC_MOTOR_POWER_RATIO,
                        },
                    },
                },
                {
                    opcode: 'controlMotor',
                    text: formatMessage({
                        id: 'smalrubotS1.controlMotor',
                        default: 'DC motor [MOTOR] [DIRECTION]',
                        description: 'controlMotor block text',
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        MOTOR: {
                            type: ArgumentType.STRING,
                            menu: 'motors',
                            defaultValue: this.MOTORS_MENU[0].value,
                        },
                        DIRECTION: {
                            type: ArgumentType.STRING,
                            menu: 'motorDirections',
                            defaultValue: this.MOTOR_DIRECTIONS_MENU[0].value,
                        },
                    },
                },
                {
                    opcode: 'controlMotorAndStopAfter',
                    text: formatMessage({
                        id: 'smalrubotS1.controlMotorAndStopAfter',
                        default: 'DC motor [MOTOR] [DIRECTION] for [SECS] seconds',
                        description: 'controlMotorAndStopAfter block text',
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        MOTOR: {
                            type: ArgumentType.STRING,
                            menu: 'motors',
                            defaultValue: this.MOTORS_MENU[0].value,
                        },
                        DIRECTION: {
                            type: ArgumentType.STRING,
                            menu: 'motorDirections',
                            defaultValue: this.MOTOR_DIRECTIONS_MENU[0].value,
                        },
                        SECS: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0.5,
                        },
                    },
                },
                {
                    opcode: 'setArmCalibration',
                    text: formatMessage({
                        id: 'smalrubotS1.setArmCalibration',
                        default: 'Adjust arm [DEGREE] degrees',
                        description: 'setArmCalibration block text',
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        DEGREE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0,
                        },
                    },
                },
            ],
            menus: {
                actions: {
                    acceptReporters: false,
                    items: this.ACTIONS_MENU,
                },
                sensorPositions: {
                    acceptReporters: false,
                    items: this.SENSOR_POSITIONS_MENU,
                },
                positions: {
                    acceptReporters: false,
                    items: this.POSITIONS_MENU,
                },
                motors: {
                    acceptReporters: false,
                    items: this.MOTORS_MENU,
                },
                motorDirections: {
                    acceptReporters: false,
                    items: this.MOTOR_DIRECTIONS_MENU,
                },
            },
        };
    }

    action(args) {
        try {
            debug(() => `action: args=<${JSON.stringify(args, null, 2)}>`);

            this.recordAction(args.ACTION);
            this.board.action(args.ACTION).catch((error) => log.error(error));
        } catch (error) {
            log.error(error);
        }
    }

    actionAndStopAfter(args, util) {
        try {
            if (util.stackTimerNeedsInit()) {
                debug(() => `actionAndStopAfter: args=<${JSON.stringify(args, null, 2)}>`);

                const duration = Math.max(0, 1000 * Cast.toNumber(args.SECS));
                util.startStackTimer(duration);
                this.runtime.requestRedraw();

                this.recordAction(args.ACTION);
                this.board.action(args.ACTION).catch((error) => log.error(error));

                util.yield();
            } else if (util.stackTimerFinished()) {
                if (args.ACTION !== 'stop') {
                    this.recordAction('stop');
                    this.board.action('stop');
                }
            } else {
                util.yield();
            }
        } catch (error) {
            log.error(error);
        }
    }

    recordDcMotor(port, direction) {
        const position = POSITION_BY_MOTOR_PORT[port];
        if (!position || !Object.prototype.hasOwnProperty.call(DC_MOTOR_VALUE_BY_DIRECTION, direction)) {
            return;
        }
        const speed = direction === 'stop' ? 0 : Number(this.board.getMotorSpeed(position)) || 0;
        this.recordCommand({ kind: 'motor', port, value: direction, speed });
    }

    controlMotor(args) {
        try {
            debug(() => `controlMotor: args=<${JSON.stringify(args, null, 2)}>`);

            this.recordDcMotor(args.MOTOR, args.DIRECTION);
            this.board.dcMotor(args.MOTOR, args.DIRECTION).catch((error) => log.error(error));
        } catch (error) {
            log.error(error);
        }
    }

    // One block turns the motor and stops it, so the time does not include a second block's communication.
    controlMotorAndStopAfter(args, util) {
        try {
            if (util.stackTimerNeedsInit()) {
                debug(() => `controlMotorAndStopAfter: args=<${JSON.stringify(args, null, 2)}>`);

                const duration = Math.max(0, 1000 * Cast.toNumber(args.SECS));
                util.startStackTimer(duration);
                this.runtime.requestRedraw();

                this.recordDcMotor(args.MOTOR, args.DIRECTION);
                this.board.dcMotor(args.MOTOR, args.DIRECTION).catch((error) => log.error(error));

                util.yield();
            } else if (util.stackTimerFinished()) {
                if (args.DIRECTION !== 'stop') {
                    this.recordDcMotor(args.MOTOR, 'stop');
                    this.board.dcMotor(args.MOTOR, 'stop').catch((error) => log.error(error));
                }
            } else {
                util.yield();
            }
        } catch (error) {
            log.error(error);
        }
    }

    bendArm(args, util) {
        try {
            if (util.stackFrame.timer) {
                const timeElapsed = util.stackFrame.timer.timeElapsed();
                if (timeElapsed < util.stackFrame.duration * 1000) {
                    const frac = timeElapsed / (util.stackFrame.duration * 1000);
                    const d = frac * (util.stackFrame.endDegree - util.stackFrame.startDegree);
                    this.bendBoardArm(util.stackFrame.startDegree + d, true);
                    util.yield();
                } else {
                    this.bendBoardArm(util.stackFrame.endDegree);
                }
            } else {
                debug(() => `bendArm: args=<${JSON.stringify(args, null, 2)}>`);

                util.stackFrame.timer = new Timer();
                util.stackFrame.timer.start();
                util.stackFrame.duration = Cast.toNumber(args.SECS);
                util.stackFrame.startDegree = this.board.armDegree;
                util.stackFrame.endDegree = Cast.toNumber(args.DEGREE);
                if (util.stackFrame.duration <= 0) {
                    this.bendBoardArm(util.stackFrame.endDegree);
                    return;
                }
                util.yield();
            }
        } catch (error) {
            log.error(error);
        }
    }

    getSensorValue(args) {
        try {
            debug(() => `getSensorValue: args=<${JSON.stringify(args, null, 2)}>`);

            return this.board.getSensorValue(args.POSITION).then((value) => {
                this.recordSensorRead(args.POSITION, value);
                return value;
            });
        } catch (error) {
            log.error(error);
        }
        return Promise.resolve(0);
    }

    turnLedOn(args) {
        try {
            debug(() => `turnLedOn: args=<${JSON.stringify(args, null, 2)}>`);

            this.recordLed(args.POSITION, true);
            return this.board.led(args.POSITION, true);
        } catch (error) {
            log.error(error);
        }
        return Promise.resolve();
    }

    turnLedOff(args) {
        try {
            debug(() => `turnLedOff: args=<${JSON.stringify(args, null, 2)}>`);

            this.recordLed(args.POSITION, false);
            return this.board.led(args.POSITION, false);
        } catch (error) {
            log.error(error);
        }
        return Promise.resolve();
    }

    getMotorSpeed(args) {
        try {
            debug(() => `getMotorSpeed: args=<${JSON.stringify(args, null, 2)}>`);

            return this.board.getMotorSpeed(args.POSITION);
        } catch (error) {
            log.error(error);
        }
        return 0;
    }

    setMotorSpeed(args) {
        try {
            debug(() => `setMotorSpeed: args=<${JSON.stringify(args, null, 2)}>`);

            // The speed is a setting, so both boards keep it: it is still used after connecting or disconnecting.
            const speed = Cast.toNumber(args.SPEED);
            this.practiceBoard.setMotorSpeed(args.POSITION, speed);
            if (this._smalrubot) {
                this._smalrubot.setMotorSpeed(args.POSITION, speed);
            }
        } catch (error) {
            log.error(error);
        }
    }

    setArmCalibration(args) {
        try {
            debug(() => `setArmCalibration: args=<${JSON.stringify(args, null, 2)}>`);

            const degree = Cast.toNumber(args.DEGREE);
            this.recordCommand({ kind: 'servoCalibration', port: 'D10', value: Math.min(15, Math.max(-15, degree)) });
            return this.board.setArmCalibration(degree);
        } catch (error) {
            log.error(error);
        }
        return Promise.resolve();
    }

    isConnected() {
        debug(() => `isConnected`);

        // Use the board only if it was made (by scan / connect): making it without Web Serial reports an error.
        return this._smalrubot ? this._smalrubot.isConnected() : false;
    }

    scan() {
        debug(() => 'scan');

        if (!this.smalrubot) {
            return;
        }

        this.smalrubot.scan();
    }

    connect(id) {
        debug(() => `connect: id=<${id}>`);

        if (!this.smalrubot) {
            return;
        }

        this.smalrubot.connect();
    }

    connectDirect(serialPort) {
        debug(() => `connectDirect: serialPort=<${serialPort}>`);

        if (!this.smalrubot) {
            return Promise.reject(new Error('Smalrubot not initialized'));
        }

        return this.smalrubot.connectDirect(serialPort);
    }

    disconnect() {
        debug(() => 'disconnect');

        if (!this.smalrubot) {
            return;
        }

        this.smalrubot.requestDisconnect();
    }

    stopAll() {
        // The practice board stops too, so a project stopped while connected does not leave it running.
        const stopped = this.practiceBoard.stopAll();

        if (this._smalrubot) {
            this._smalrubot.stopAll();
        }
        return stopped;
    }
}

module.exports = Scratch3SmalrubotS1Blocks;
