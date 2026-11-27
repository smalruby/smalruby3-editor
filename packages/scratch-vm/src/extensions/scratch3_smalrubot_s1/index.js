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
const StuduinoModePracticeBoard = require('./studuino-mode-practice');
const studuinoBlocks = require('./studuino-blocks');

/**
 * Icon png to be displayed at the left edge of each extension block, encoded as a data URI.
 * The background is transparent so the icon does not stand out on the block.
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
        return this.writeCommand('set_servomotor_calibration', SERVO_MOTOR_PORT, degree).then(() => {
            // Send the current angle again so the arm moves to the adjusted position right away (#2202).
            // Without it, nothing moves until the arm is bent to a different angle.
            if (typeof this.armDegree !== 'number') {
                return Promise.resolve();
            }
            return this.writeCommand('servo_motor', SERVO_MOTOR_PORT, this.armDegree);
        });
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
         * The practice board of the Studuino mode (#2355): the part blocks of the Studuino mode drive it
         * when they run in the browser. It is separate from the practice board above (the fixed S1 layout).
         * @type {StuduinoModePracticeBoard}
         */
        this.studuinoPractice = new StuduinoModePracticeBoard(this.runtime);
        this.studuinoPractice.emitState();

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
     * @returns {string} - the runtime event sent on every change of the Studuino mode's practice board.
     */
    static get STUDUINO_MODE_PRACTICE_STATE_EVENT() {
        return StuduinoModePracticeBoard.STATE_EVENT;
    }

    /**
     * @returns {object} - a copy of the Studuino mode's practice board state (for the GUI panel).
     */
    getStuduinoPracticeState() {
        return this.studuinoPractice.getState();
    }

    /**
     * Change a sensor or a button of the Studuino mode's practice board (for the GUI panel).
     * @param {string} port - a port assigned to a sensor ('A6').
     * @param {number|boolean} value - 0-1023 for an analog sensor, pressed or not for a touch sensor / button.
     * @returns {boolean} - true when the port has a sensor.
     */
    setStuduinoPracticeInput(port, value) {
        return this.studuinoPractice.setInput(port, value);
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
                // Studuino モードの部品のブロック（#2216）。通常モードのパレットには出さない
                ...studuinoBlocks.blockInfos(formatMessage),
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
                ...studuinoBlocks.menuInfos(formatMessage),
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
        this.studuinoPractice.stopAll();

        if (this._smalrubot) {
            this._smalrubot.stopAll();
        }
        return stopped;
    }
}

// Studuino モードの部品のブロックの実行と、ポートの動的メニュー（#2216）
Object.assign(
    Scratch3SmalrubotS1Blocks.prototype,
    studuinoBlocks.makeMethods(() => formatMessage),
);

module.exports = Scratch3SmalrubotS1Blocks;
