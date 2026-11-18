/* global process */
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const log = require('../../util/log');
const debugLogger = require('../../util/debug-logger');
const debug = debugLogger(process.env.DEBUG);
const formatMessage = require('format-message');
const Cast = require('../../util/cast');
const Timer = require('../../util/timer');

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
            case 'left':
                commandName = 'get_ir_photoreflector_value';
                pin = PORT_A4;
                break;
            case 'right':
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
        return 'Studuino';
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
     * @returns {Array} - text and values for each sensor positions menu element
     */
    get SENSOR_POSITIONS_MENU() {
        return [
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.left',
                    default: 'left(A4)',
                    description: 'label for "left" sensor in position picker for Smalrubot S1 extension',
                }),
                value: 'left',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.right',
                    default: 'right(A5)',
                    description: 'label for "right" sensor in position picker for Smalrubot S1 extension',
                }),
                value: 'right',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.touch',
                    default: 'touch(A2)',
                    description: 'label for "touch" sensor in position picker for Smalrubot S1 extension',
                }),
                value: 'touch',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.light',
                    default: 'light(A6)',
                    description: 'label for "light" sensor in position picker for Smalrubot S1 extension',
                }),
                value: 'light',
            },
            {
                text: formatMessage({
                    id: 'smalrubotS1.sensorPositionsMenu.sound',
                    default: 'sound(A7)',
                    description: 'label for "sound" sensor in position picker for Smalrubot S1 extension',
                }),
                value: 'sound',
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
    }

    get smalrubot() {
        try {
            if (!this._smalrubot) {
                this._smalrubot = new SmalrubotS1(this.runtime);
            }
        } catch (e) {
            log.error(e);
        }
        return this._smalrubot;
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo() {
        return {
            id: Scratch3SmalrubotS1Blocks.EXTENSION_ID,
            name: Scratch3SmalrubotS1Blocks.EXTENSION_NAME,
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
                        default: '[POSITION] sensor value',
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
            },
        };
    }

    action(args) {
        try {
            debug(() => `action: args=<${JSON.stringify(args, null, 2)}>`);

            if (!this.smalrubot) {
                return;
            }

            this.smalrubot.action(args.ACTION);
        } catch (error) {
            log.error(error);
        }
    }

    actionAndStopAfter(args, util) {
        try {
            if (!this.smalrubot) {
                return;
            }

            if (util.stackTimerNeedsInit()) {
                debug(() => `actionAndStopAfter: args=<${JSON.stringify(args, null, 2)}>`);

                const duration = Math.max(0, 1000 * Cast.toNumber(args.SECS));
                util.startStackTimer(duration);
                this.runtime.requestRedraw();

                this.smalrubot.action(args.ACTION);

                util.yield();
            } else if (util.stackTimerFinished()) {
                if (args.ACTION !== 'stop') {
                    this.smalrubot.action('stop');
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
                if (!this.smalrubot || !this.isConnected()) {
                    return;
                }

                const timeElapsed = util.stackFrame.timer.timeElapsed();
                if (timeElapsed < util.stackFrame.duration * 1000) {
                    const frac = timeElapsed / (util.stackFrame.duration * 1000);
                    const d = frac * (util.stackFrame.endDegree - util.stackFrame.startDegree);
                    this.smalrubot.bendArm(util.stackFrame.startDegree + d);
                    util.yield();
                } else {
                    this.smalrubot.bendArm(util.stackFrame.endDegree);
                }
            } else {
                debug(() => `bendArm: args=<${JSON.stringify(args, null, 2)}>`);

                if (!this.smalrubot || !this.isConnected()) {
                    return;
                }

                util.stackFrame.timer = new Timer();
                util.stackFrame.timer.start();
                util.stackFrame.duration = Cast.toNumber(args.SECS);
                util.stackFrame.startDegree = this.smalrubot.armDegree;
                util.stackFrame.endDegree = Cast.toNumber(args.DEGREE);
                if (util.stackFrame.duration <= 0) {
                    this.smalrubot.bendArm(util.stackFrame.endDegree);
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

            if (!this.smalrubot) {
                return Promise.resolve(0);
            }

            return this.smalrubot.getSensorValue(args.POSITION);
        } catch (error) {
            log.error(error);
        }
        return Promise.resolve(0);
    }

    turnLedOn(args) {
        try {
            debug(() => `turnLedOn: args=<${JSON.stringify(args, null, 2)}>`);

            if (!this.smalrubot) {
                return Promise.resolve();
            }

            return this.smalrubot.led(args.POSITION, true);
        } catch (error) {
            log.error(error);
        }
        return Promise.resolve();
    }

    turnLedOff(args) {
        try {
            debug(() => `turnLedOff: args=<${JSON.stringify(args, null, 2)}>`);

            if (!this.smalrubot) {
                return Promise.resolve();
            }

            return this.smalrubot.led(args.POSITION, false);
        } catch (error) {
            log.error(error);
        }
        return Promise.resolve();
    }

    getMotorSpeed(args) {
        try {
            debug(() => `getMotorSpeed: args=<${JSON.stringify(args, null, 2)}>`);

            if (!this.smalrubot) {
                return 0;
            }

            return this.smalrubot.getMotorSpeed(args.POSITION);
        } catch (error) {
            log.error(error);
        }
        return 0;
    }

    setMotorSpeed(args) {
        try {
            debug(() => `setMotorSpeed: args=<${JSON.stringify(args, null, 2)}>`);

            if (!this.smalrubot) {
                return;
            }

            this.smalrubot.setMotorSpeed(args.POSITION, Cast.toNumber(args.SPEED));
        } catch (error) {
            log.error(error);
        }
    }

    setArmCalibration(args) {
        try {
            debug(() => `setArmCalibration: args=<${JSON.stringify(args, null, 2)}>`);

            if (!this.smalrubot) {
                return Promise.resolve();
            }

            return this.smalrubot.setArmCalibration(Cast.toNumber(args.DEGREE));
        } catch (error) {
            log.error(error);
        }
        return Promise.resolve();
    }

    isConnected() {
        debug(() => `isConnected`);

        return this.smalrubot ? this.smalrubot.isConnected() : false;
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
        if (!this.smalrubot) {
            return;
        }

        this.smalrubot.stopAll();
    }
}

module.exports = Scratch3SmalrubotS1Blocks;
