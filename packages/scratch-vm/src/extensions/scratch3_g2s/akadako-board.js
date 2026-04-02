import {EventEmitter} from 'events';
import bindTransport from 'firmata-io';
import SerialPort from '@serialport/stream';
import WSABinding from 'web-serial-binding';
import MidiDakoTransport from './mididako-transport';
import {getSettings} from './akadako-board-settings';
import {
    FIRMATA_7BIT_MASK,
    COLOR_ORDER,
    PIXEL_COMMAND,
    PIXEL_CONFIG,
    PIXEL_SET_PIXEL,
    PIXEL_SHOW
} from './node-pixel-constants';
import Servo from './servo';
import throttledQueue from 'throttled-queue';

const Firmata = bindTransport.Firmata;

const BOARD_VERSION_QUERY = 0x0F;

const ULTRASONIC_DISTANCE_QUERY = 0x01;

const WATER_TEMPERATURE_QUERY = 0x02;

const DEVICE_ENABLE = 0x03;

/**
 * Returns a Promise which will reject after the delay time passed.
 * @param {number} delay - waiting time to reject in milliseconds
 * @returns {Promise<string>} Promise which will reject with reason after the delay.
 */
const timeoutReject = delay => new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout ${delay}ms`)), delay));

/**
 * Decode int16 value from 7bit encoded two bytes array.
 * @param {Uint8Array} bytes encoded array
 * @returns {number} decoded value
 */
const decodeInt16FromTwo7bitBytes = bytes => {
    const lsb = (bytes[0] | (bytes[1] << 7)) & 0xFF;
    const msb = ((bytes[1] >> 1) | ((bytes[1] >> 6) ? 0b11000000 : 0)); // two's complement
    const dataView = new DataView((new Uint8Array([lsb, msb])).buffer);
    const result = dataView.getInt16(0, true);
    return result;
};

// eslint-disable-next-line prefer-const
export let DEBUG = false;

/**
 * Gamma values table for NeoPixel.
 * @type {Array<number>}
 */
const neoPixelGammaTable = ((steps, gamma) => {
    const gammaTable = new Array(steps);
    for (let i = 0; i < steps; i++) {
        gammaTable[i] = Math.floor((Math.pow((i / 255.0), gamma) * 255) + 0.5);
    }
    return gammaTable;
})(256, 2.8);

/**
 * Convert colors to gamma corrected value for NeoPixel.
 * @param {Array<number>} colors - color values [red, green, blue]
 * @param {Array<number>} gammaTable - gamma values
 * @returns {number} value for NeoPixel
 */
const neoPixelColorValue = (colors, gammaTable) => {
    // colors are assumed to be an array of [r, g, b] bytes
    // colorValue returns a packed value able to be pushed to firmata rather than
    // text values.
    // if gammaTable is passed then it should use the supplied gamma
    // correction table to correct the received value.

    // before sending, account for gamma correction.
    const gammaCorrectedColor = Object.assign({}, colors);
    gammaCorrectedColor[0] = gammaTable[gammaCorrectedColor[0]];
    gammaCorrectedColor[1] = gammaTable[gammaCorrectedColor[1]];
    gammaCorrectedColor[2] = gammaTable[gammaCorrectedColor[2]];
    return (
        (gammaCorrectedColor[0] << 16) +
        (gammaCorrectedColor[1] << 8) +
        (gammaCorrectedColor[2])
    );
};

/**
 * This class represents a board communicating with Firmata protocol.
 */
class AkaDakoBoard extends EventEmitter {

    /**
     * Event name for reporting that this board has been released.
     * @const {string}
     */
    static get RELEASED () {
        return 'RELEASED';
    }

    /**
     * Construct a AkaDako board object.
     * @param {Runtime} runtime - the Scratch runtime
     */
    constructor (runtime) {
        super();

        this.name = 'AkaDakoBoard';

        /**
         * Version of the connected board.
         * @type {{type: number, major: number, minor: number}}
         */
        this.version = null;

        /**
         * The Scratch runtime to register event listeners.
         * @type {Runtime}
         * @private
         */
        this.runtime = runtime;

        /**
         * State of this board
         * @type {string}
         */
        this.state = 'disconnect';

        /**
         * The Firmata for reading/writing peripheral data.
         * @type {Firmata}
         * @private
         */
        this.firmata = null;

        /**
         * ID of the extension which requested to open port.
         * @type {string}
         */
        this.extensionId = null;

        /**
         * Waiting time to connect the board in milliseconds.
         * @type {number}
         */
        this.connectingWaitingTime = 1000;

        /**
         * shortest interval time between message sending
         * @type {number}
         */
        this.sendingInterval = 10;

        /**
         * Waiting time for response of I2C reading in milliseconds.
         * @type {number}
         */
        this.i2cReadWaitingTime = 100;

        /**
         * Waiting time for response of OneWire reading in milliseconds.
         * @type {number}
         */
        this.oneWireReadWaitingTime = 100;

        /**
         * Waiting time for response of ultrasonic distance sensor reading in milliseconds.
         * @type {number}
         */
        this.ultrasonicDistanceWaitingTime = 1000;

        /**
         * Waiting time for response of query board version in milliseconds.
         * @type {number}
         */
        this.boardVersionWaitingTime = 200;

        /**
         * Waiting time for response of water temperature sensor reading in milliseconds.
         * @type {number}
         */
        this.getWaterTempWaitingTime = 2000;

        /**
         * Port information of the connected serial port.
         * @type {object}
         */
        this.portInfo = null;

        /**
         * Parameters of the NeoPixel strips.
         * @type {Array<object>}
         */
        this.neoPixel = [];

        /**
         * Throttled queue for NeoPixel.
         * @type {ThrottledQueue}
         */
        this.neoPixelThrottledQueue = throttledQueue(1, 10);

        /**
         * Default length for NeoPixel module.
         * @type {number}
         */
        this.defaultNeoPixelLength = 3;

        /**
         * Servo motors on this board.
         * @type {Array<Servo>}
         */
        this.servo = [];
    }

    /**
     * Setup default settings for Firmata
     * @param {Firmata} firmata set it up
     */
    setupFirmata (firmata) {
        // Setup firmata
        firmata.once('open', () => {
            if (this.firmata !== firmata) return;
            this.state = 'connect';
            this.emit('connect');
        });
        firmata.once('close', () => {
            if (this.firmata !== firmata) return;
            if (this.state === 'disconnect') return;
            this.releaseBoard();
        });
        firmata.once('disconnect', error => {
            if (this.firmata !== firmata) return;
            if (this.state === 'disconnect') return;
            this.handleDisconnectError(error);
        });
        firmata.once('error', error => {
            if (this.firmata !== firmata) return;
            if (this.state === 'disconnect') return;
            this.handleDisconnectError(error);
        });
        if (DEBUG) {
            if (this.firmata !== firmata) return;
            firmata.transport.addListener('data', data => {
                // eslint-disable-next-line no-console
                console.log(data);
            });
        }
        firmata.clearSysexResponse(WATER_TEMPERATURE_QUERY);
        firmata.sysexResponse(WATER_TEMPERATURE_QUERY, data => {
            const pin = data[0];
            firmata.emit(`water-temp-reply-${pin}`, data.slice(1));
        });
        firmata.clearSysexResponse(ULTRASONIC_DISTANCE_QUERY);
        firmata.sysexResponse(ULTRASONIC_DISTANCE_QUERY, data => {
            const pin = data[0];
            firmata.emit(`ultrasonic-distance-reply-${pin}`, data.slice(1));
        });
        firmata.clearSysexResponse(BOARD_VERSION_QUERY);
        firmata.sysexResponse(BOARD_VERSION_QUERY, data => {
            firmata.emit(`board-version-reply`, data);
        });
        this.firmata = firmata;
    }

    /**
     * Ask user to open serial port for firmata and return it.
     * @param {object} options - serial port options
     * @returns {SerialPort} opened serial port
     */
    async openSerialPort (options) {
        let nativePort = null;
        const permittedPorts = await navigator.serial.getPorts();
        if ((permittedPorts !== null) && (Array.isArray(permittedPorts)) && (permittedPorts.length > 0)) {
            nativePort = permittedPorts[0];
        } else {
            nativePort = await navigator.serial.requestPort(options);
        }
        SerialPort.Binding = WSABinding;
        const port = new SerialPort(nativePort, {
            baudRate: 57600, // default baud rate for firmata
            autoOpen: true
        });
        this.portInfo = port.path.getInfo();
        return port;
    }

    /**
     * Return connected AkaDako board using WebSerial
     * @param {object} options - serial port options
     * @returns {Promise<AkaDakoBoard>} a Promise which resolves a connected AkaDako board or reject with reason
     */
    async connectSerial (options) {
        if (this.firmata) return Promise.resolve(this); // already opened
        this.state = 'portRequesting';
        const port = await this.openSerialPort(options);
        const request = new Promise(resolve => {
            const firmata = new Firmata(
                port,
                {reportVersionTimeout: 500},
                async () => {
                    this.setupFirmata(firmata);
                    await this.boardVersion();
                    this.onBoardReady();
                    resolve(this);
                });
        });
        return Promise.race([request, timeoutReject(this.connectingWaitingTime)])
            .catch(reason => {
                this.releaseBoard();
                return Promise.reject(reason);
            });
    }

    /**
     * Request MidiDako MIDIport and return it as a Firmata transport
     * @param {Array<{manufacturer: string, name: string}>} filters selecting rules for MIDIPort
     * @returns {Promise<MidiDakoTransport>} MIDI transport for Firmata
     */
    async openMIDIPort (filters) {
        const midiAccess = await navigator.requestMIDIAccess({sysex: true})
            .catch(() => Promise.reject(new Error(`no available MIDI Access`)));
        const findPort = async (portType, portFilters, retries = 3, delayMs = 700) => {
            const availablePorts = [];
            for (const filter of portFilters) {
                const ports = (portType === 'input') ? midiAccess.inputs : midiAccess.outputs;
                ports.forEach(port => {
                    if ((!filter.manufacturer || filter.manufacturer.test(port.manufacturer)) &&
                (!filter.name || filter.name.test(port.name))) {
                        availablePorts.push(port);
                    }
                });
                if (availablePorts.length > 0) {
                    return availablePorts[0];
                }
            }
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
                return findPort(portType, portFilters, retries - 1, delayMs);
            }
            return Promise.reject(new Error(`no available MIDIPort for the filters`));
        };
        let inputPort = null;
        let outputPort = null;
        if (filters) {
            inputPort = await findPort('input', filters);
            if (!inputPort) {
                midiAccess.inputs.forEach(port => {
                    // eslint-disable-next-line no-console
                    console.log(`    {manufacturer:"${port.manufacturer}", name:"${port.name}"}\n`);
                });
                return Promise.reject(new Error(`no available MIDIInput for the filters`));
            }
            outputPort = await findPort('output', filters);
            if (!outputPort) {
                midiAccess.outputs.forEach(port => {
                    // eslint-disable-next-line no-console
                    console.log(`    {manufacturer:"${port.manufacturer}", name:"${port.name}"}\n`);
                });
                return Promise.reject(new Error(`no available MIDIOutput for the filters`));
            }
        } else {
            const inputs = midiAccess.inputs.values();
            const outputs = midiAccess.outputs.values();
            let result = inputs.next();
            if (result.done) return Promise.reject(new Error('no MIDIInput'));
            inputPort = result.value;
            result = outputs.next();
            if (result.done) return Promise.reject(new Error('no MIDIOutput'));
            outputPort = result.value;
        }
        this.portInfo = {manufacturer: inputPort.manufacturer, name: inputPort.name};
        const transport = new MidiDakoTransport(inputPort, outputPort);
        await transport.close();
        await transport.open();
        return transport;
    }

    /**
     * Return connected AkaDako board using WebMIDI
     * @param {Array<{manufacturer: string, name: string}>} filters - selecting rules for MIDIPort
     * @returns {Promise<AkaDakoBoard>} a Promise which resolves a connected AkaDako board or reject with reason
     */
    async connectMIDI (filters) {
        if (this.firmata) return Promise.resolve(this); // already opened
        this.state = 'portRequesting';
        const port = await this.openMIDIPort(filters);
        const request = new Promise(resolve => {
            const {pins, analogPins} = getSettings();
            const firmata = new Firmata(
                port,
                {
                    reportVersionTimeout: 500,
                    skipCapabilities: true,
                    pins: pins,
                    analogPins: analogPins
                },
                async () => {
                    this.setupFirmata(firmata);
                    await this.boardVersion();
                    // eslint-disable-next-line require-atomic-updates
                    firmata.firmware = {
                        name: String(this.version.type),
                        version: {
                            major: this.version.major,
                            minor: this.version.minor
                        }
                    };
                    firmata.queryAnalogMapping(() => {
                        this.onBoardReady();
                        resolve(this);
                    });
                });
                // make the firmata initialize
                // firmata version is fixed for MidiDako
            firmata.version.major = 2;
            firmata.version.minor = 3;
            firmata.emit('reportversion'); // skip version query
            firmata.emit('queryfirmware'); // skip firmware query
        });
        return Promise.race([request, timeoutReject(this.connectingWaitingTime)])
            .catch(reason => {
                this.releaseBoard();
                return Promise.reject(reason);
            });
    }

    /**
     * Called when a board was ready.
     */
    onBoardReady () {
        // eslint-disable-next-line no-console
        console.log(
            `${this.version.type}.${String(this.version.major)}.${String(this.version.minor)}` +
            ` on: ${JSON.stringify(this.portInfo)}`
        );
        const digitalPins = [6, 9, 10, 11]; // Pin config is fixed at least to STEAM Tool
        // Set up to report digital inputs.
        digitalPins.forEach(pin => {
            this.firmata.pinMode(pin, this.firmata.MODES.INPUT);
            this.firmata.reportDigitalPin(pin, 1);
        });
        this.firmata.analogPins.forEach((pin, analogIndex) => {
            this.firmata.pinMode(analogIndex, this.firmata.MODES.ANALOG);
            this.firmata.reportAnalogPin(analogIndex, 1);
        });
        this.firmata.i2cConfig();
        this.state = 'ready';
        this.emit('ready');
    }

    /**
     * Whether a board is connected.
     * @returns {boolean} true if a board is connected
     */
    isConnected () {
        return (this.state === 'connect' || this.state === 'ready');
    }

    /**
     * Whether the board is ready to operate.
     * @returns {boolean} true if the board is ready
     */
    isReady () {
        return this.state === 'ready';
    }

    /**
     * Release resources of the board then emit released-event.
     */
    releaseBoard () {
        this.state = 'disconnect';
        this.neoPixel = [];
        if (this.firmata) {
            if (this.firmata.transport) {
                this.firmata.transport.close();
            }
            this.firmata.removeAllListeners();
            this.firmata = null;
        }

        if (this.transport) {
            this.transport.close();
            this.transport = null;
        }

        this.oneWireDevices = null;
        this.extensionId = null;
        this.emit('disconnect');
        this.emit(AkaDakoBoard.RELEASED);
    }

    /**
     * Disconnect current connected board.
     */
    disconnect () {
        if (this.state === 'disconnect') return;
        if (this.firmata && this.firmata.transport.isOpen) {
            this.firmata.reset(); // notify disconnection to board
        }
        this.releaseBoard();
    }

    /**
     * Handle an error resulting from losing connection to a peripheral.
     * This could be due to:
     * - unplug the connector
     * - being powered down
     * Disconnect the device, and if the extension using this object has a
     * reset callback, call it.
     * @param {string} error - cause of the error
     * @returns {undefined}
     */
    handleDisconnectError (error) {
        if (this.state === 'disconnect') return;
        error = error ? error : 'Firmata was disconnected by device';
        // eslint-disable-next-line no-console
        console.error(error);
        this.runtime.emit(this.runtime.constructor.PERIPHERAL_CONNECTION_LOST_ERROR, {
            message: `Scratch lost connection to`,
            extensionId: this.extensionId
        });
        this.disconnect();
    }

    /**
     * Query the version information of the connected board and set the version data.
     * @param {?number} timeout - waiting time for the response
     * @returns {Promise<string>} A Promise which resolves version info.
     */
    boardVersion (timeout) {
        if (this.version) return Promise.resolve(`${this.version.type}.${this.version.major}.${this.version.minor}`);
        const firmata = this.firmata;
        timeout = timeout ? timeout : this.boardVersionWaitingTime;
        const event = `board-version-reply`;
        const request = new Promise(resolve => {
            firmata.once(event,
                data => {
                    const value = Firmata.decode([data[0], data[1]]);
                    this.version = {
                        type: (value >> 10) & 0x0F,
                        major: (value >> 6) & 0x0F,
                        minor: value & 0x3F
                    };
                    resolve(`${this.version.type}.${this.version.major}.${this.version.minor}`);
                });
            firmata.sysexCommand([BOARD_VERSION_QUERY]);
        });
        return Promise.race([request, timeoutReject(timeout)])
            .catch(reason => {
                firmata.removeAllListeners(event);
                return Promise.reject(reason);
            });
    }

    /**
     * Enable a device on the board.
     * @param {number} deviceID ID to be enabled.
     * @returns {Promise} A Promise which resolves when the message was sent.
     */
    enableDevice (deviceID) {
        const message = [DEVICE_ENABLE, deviceID];
        return new Promise(resolve => {
            this.firmata.sysexCommand(message);
            setTimeout(() => resolve(), this.sendingInterval);
        });
    }

    /**
     * Asks the board to set the pin to a certain mode.
     * @param {number} pin - The pin you want to change the mode of.
     * @param {number} mode - The mode you want to set. Must be one of board.MODES
     * @returns {undefined}
     */
    pinMode (pin, mode) {
        return this.firmata.pinMode(pin, mode);
    }

    /**
     * Return digital level of the pin.
     * @param {number} pin - number of the pin
     * @returns {number} digital level
     */
    getDigitalValue (pin) {
        return this.pins[pin].value;
    }

    /**
     * Set input bias of the connector.
     * @param {number} pin - number of the pin
     * @param {boolean} pullUp - input bias of the pin [none | pullUp]
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    setInputBias (pin, pullUp) {
        this.pins[pin].inputBias = (pullUp ? this.MODES.PULLUP : this.MODES.INPUT);
        return new Promise(resolve => {
            this.pinMode(pin, this.pins[pin].inputBias);
            setTimeout(() => resolve(), this.sendingInterval);
        });
    }

    /**
     * Return analog level of the pin.
     * @param {number} analogPin - number as an analog pin
     * @returns {number} analog level
     */
    getAnalogValue (analogPin) {
        const pin = this.firmata.analogPins[analogPin];
        return this.pins[pin].value;
    }

    /**
     * Asks the board to write a value to a digital pin
     * @param {number} pin - The pin you want to write a value to.
     * @param {number} value - The value you want to write. Must be board.HIGH or board.LOW
     * @param {boolean} enqueue - When true, the local state is updated but the command is not sent to the board
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    digitalWrite (pin, value, enqueue) {
        if (this.firmata.pins[pin].value === value) {
            // to avoid chattering of the relay
            return new Promise(resolve => {
                setTimeout(() => resolve(), this.sendingInterval);
            });
        }
        this.firmata.pinMode(pin, this.firmata.MODES.OUTPUT);
        return new Promise(resolve => {
            this.firmata.digitalWrite(pin, value, enqueue);
            setTimeout(() => resolve(), this.sendingInterval);
        });
    }

    /**
     * Set PWM to the value on the pin
     * @param {number} pin - pin number to set
     * @param {number} value - PWM level
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    pwmWrite (pin, value) {
        return new Promise(resolve => {
            this.firmata.pwmWrite(pin, value);
            setTimeout(() => resolve(), this.sendingInterval);
        });
    }

    /**
     * Return servo object on the pin
     * @param {number} pin - pin number of the servo
     * @returns {Servo?} servo which is connected on the pin
     */
    getServo (pin) {
        if (this.version.type === 2) {
            // STEAM Tool
            if (pin === 6 || pin === 9) {
                // These pins are used for on-board buttons in the STEAM tool.
                return null;
            }
        }
        let servo = this.servo[pin];
        if (!servo) {
            servo = new Servo(this, pin);
            this.servo[pin] = servo;
        }
        return servo;
    }

    /**
     * Asks the board to move a servo
     * @param {...*} args - the pin and value for servo write
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    servoWrite (...args) {
        return new Promise(resolve => {
            this.firmata.servoWrite(...args);
            setTimeout(() => resolve(), this.sendingInterval);
        });
    }

    /**
     * Write multiple bytes to an I2C module
     * @param {number} address - address of the I2C device.
     * @param {number} register - register to write
     * @param {Array<number>} inBytes - bytes to be wrote
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    i2cWrite (address, register, inBytes) {
        return new Promise(resolve => {
            this.firmata.i2cWrite(address, register, inBytes);
            setTimeout(() => resolve(), this.sendingInterval);
        });
    }

    /**
     * Read multiple bytes from an I2C module
     * @param {number} address - address of the I2C device
     * @param {number} register - register to write
     * @param {number} readLength - byte size to read
     * @param {number} timeout - time to abort [milliseconds]
     * @returns {Promise<Array<number>>} a Promise which resolves read data
     */
    i2cReadOnce (address, register, readLength, timeout) {
        timeout = timeout ? timeout : this.i2cReadWaitingTime;
        const firmata = this.firmata;
        const request = new Promise(resolve => {
            firmata.i2cReadOnce(
                address,
                register,
                readLength,
                data => {
                    resolve(data);
                }
            );
        });
        return Promise.race([request, timeoutReject(timeout)])
            .catch(reason => {
                firmata.removeAllListeners(`I2C-reply-${address}-${register}`);
                return Promise.reject(reason);
            });
    }

    /**
     * Resets all devices on the OneWire bus.
     * @param {number} pin pin number to reset
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    sendOneWireReset (pin) {
        return new Promise(resolve => {
            this.firmata.sendOneWireReset(pin);
            setTimeout(() => resolve(), this.sendingInterval);
        });
    }

    /**
     * Return found IDs on the OneWire bus.
     * @param {number} pin - pin number to search
     * @returns {Promise<Array<number>>} a Promise which resolves found device IDs
     */
    searchOneWireDevices (pin) {
        return new Promise((resolve, reject) => {
            if (this.firmata.pins[pin].mode !== this.firmata.MODES.ONEWIRE) {
                this.firmata.sendOneWireConfig(pin, true);
                return this.firmata.sendOneWireSearch(pin, (error, founds) => {
                    if (error) return reject(error);
                    if (founds.length < 1) return reject(new Error('no device'));
                    this.firmata.pinMode(pin, this.firmata.MODES.ONEWIRE);
                    this.oneWireDevices = founds;
                    this.firmata.sendOneWireDelay(pin, 1);
                    resolve(this.oneWireDevices);
                });
            }
            resolve(this.oneWireDevices);
        });
    }

    /**
     * Write bytes to the first OneWire module on the pin
     * @param {number} pin - pin number of the bus
     * @param {Array<number>} data - bytes to be wrote
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    oneWireWrite (pin, data) {
        return this.searchOneWireDevices(pin)
            .then(devices => {
                this.firmata.sendOneWireWrite(pin, devices[0], data);
            });
    }

    /**
     * Read bytes from the first OneWire module on the pin.
     * @param {number} pin - pin number of the bus
     * @param {number} length - byte size to read
     * @param {number} timeout - time to abort [milliseconds]
     * @returns {Promise<Array<number>>} a Promise which resolves read data
     */
    oneWireRead (pin, length, timeout) {
        timeout = timeout ? timeout : this.oneWireReadWaitingTime;
        const request = this.searchOneWireDevices(pin)
            .then(devices =>
                new Promise((resolve, reject) => {
                    this.firmata.sendOneWireRead(pin, devices[0], length, (readError, data) => {
                        if (readError) return reject(readError);
                        resolve(data);
                    });
                }));
        return Promise.race([request, timeoutReject(timeout)]);
    }

    /**
     * Write then read from the first OneWire module on the pin.
     * @param {number} pin - pin number of the bus
     * @param {Array<number>} data - bytes to read
     * @param {number} readLength - byte size to read
     * @param {number} timeout - time to abort [milliseconds]
     * @returns {Promise<Array<number>>} a Promise which resolves read data
     */
    oneWireWriteAndRead (pin, data, readLength, timeout) {
        timeout = timeout ? timeout : this.oneWireReadWaitingTime;
        const request = this.searchOneWireDevices(pin)
            .then(devices =>
                new Promise((resolve, reject) => {
                    this.firmata.sendOneWireWriteAndRead(
                        pin,
                        devices[0],
                        data,
                        readLength,
                        (readError, readData) => {
                            if (readError) return reject(readError);
                            resolve(readData);
                        });
                }));
        return Promise.race([request, timeoutReject(timeout)]);
    }

    /**
     * Configure a NeoPixel module which have several LEDs.
     * @param {number} pin - pin number of the module
     * @param {number} length - amount of LEDs
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    neoPixelConfigStrip (pin, length) {
        this.pins[pin].mode = PIXEL_COMMAND;
        const oldStrip = this.neoPixel.find(aStrip => aStrip.pin === pin);
        if(oldStrip === null || oldStrip === undefined) {
            this.neoPixel = this.neoPixel.filter(aStrip => aStrip.pin !== pin);
            this.neoPixel.push({pin: pin, length: length});
        } else {
            this.neoPixel = this.neoPixel.filter(aStrip => aStrip.pin !== pin);
            this.neoPixel.push(Object.assign(oldStrip, {length: length}));
        }
        const message = [];
        message[0] = PIXEL_COMMAND;
        message[1] = PIXEL_CONFIG;
        for (const aStrip of this.neoPixel) {
            message.push((COLOR_ORDER.GRB << 5) | aStrip.pin);
            message.push(aStrip.length & FIRMATA_7BIT_MASK);
            message.push((aStrip.length >> 7) & FIRMATA_7BIT_MASK);
        }
        return this.neoPixelThrottledQueue(()=>{this.firmata.sysexCommand(message)});
    }

    /**
     * Set color to an LED on the current NeoPixel module.
     * LED does not change the actual color until neoPixelShow() was sent.
     * This method will configure a new module with default length if it hasn't done yet.
     * @param {number} pin - pin number of the module
     * @param {Array<numbers>} color - color value to be set [r, g, b]
     * @param {number} index - index of LED to be set, -1 for all LEDs
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    async neoPixelSetColor (pin, color, index=0) {
        let address = 0;
        let prevStrip = true;
        for (const aStrip of this.neoPixel) {
            if (aStrip.pin === pin) {
                address += Math.max(0, index % aStrip.length);
                prevStrip = false;
            }
            if (prevStrip) {
                address += aStrip.length;
            }
        }
        if (prevStrip) {
            // A module at the pin has not configured yet.
            await this.neoPixelConfigStrip(pin, this.defaultNeoPixelLength);
        }
        const strip = this.neoPixel.find(aStrip => aStrip.pin === pin);
        strip.colors = strip.colors || Array(strip.length);
        strip.colors[index] = color;
        const colorValue = neoPixelColorValue(color, neoPixelGammaTable);
        const message = new Array(8);
        message[0] = (PIXEL_COMMAND);
        message[1] = (PIXEL_SET_PIXEL);
        message[2] = (address & FIRMATA_7BIT_MASK);
        message[3] = ((address >> 7) & FIRMATA_7BIT_MASK);
        message[4] = (colorValue & FIRMATA_7BIT_MASK);
        message[5] = ((colorValue >> 7) & FIRMATA_7BIT_MASK);
        message[6] = ((colorValue >> 14) & FIRMATA_7BIT_MASK);
        message[7] = ((colorValue >> 21) & FIRMATA_7BIT_MASK);
        return this.neoPixelThrottledQueue(()=>{this.firmata.sysexCommand(message)});
    }

    /**
     * Set color to all LED on the current NeoPixel module.
     * LED does not change the actual color until neoPixelShow() was sent.
     * This method will configure a new module with default length if it hasn't done yet.
     * @param {number} pin - pin number of the module
     * @param {(color: [number, number, number] | null, index: number, oldColors: [number, number, number][]) => [number, number, number] | null} colorMapFn - color calculation function, if null then skip setting color
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    async neoPixelFillColor(pin, colorMapFn) {
        const strip = this.neoPixel.find(aStrip => aStrip.pin === pin);
        const length = strip ? strip.length : this.defaultNeoPixelLength;
        const oldColors = (strip && strip.colors) || Array(length);
        if(oldColors.length < length) {
            oldColors[length - 1] = null;
        }
        if(length < oldColors.length) {
            oldColors.splice(length);
        }
        const newColors = [...oldColors].map(colorMapFn);
        for (let index = 0; index < length; index++) {
            const color = newColors[index];
            if(color !== null && color !== undefined) {
                await this.neoPixelSetColor(pin, color, index);
            }
        }
    }

    /**
     * Turn off the all LEDs on the NeoPixel module on the pin.
     * @param {number} pin - pin number of the module
     */
    async neoPixelClear (pin) {
        await this.neoPixelFillColor(pin, () => [0, 0, 0]);
        await this.neoPixelShow();
    }

    /**
     * Clear all strips.
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    async neoPixelClearAll () {
        for(const aStrip of this.neoPixel) {
            await this.neoPixelFillColor(aStrip.pin, () => [0, 0, 0]);
        }
        await this.neoPixelShow();
    }
    /**
     * Update color of LEDs on the all of NeoPixel modules.
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    neoPixelShow () {
        const message = new Array(2);
        message[0] = PIXEL_COMMAND;
        message[1] = PIXEL_SHOW;
        return this.neoPixelThrottledQueue(()=>{this.firmata.sysexCommand(message)});
    }


    /**
     * Get colors of the js memory for NeoPixel.
     * @param {number} pin - pin number of the module
     * @returns {Array<number>} colors of the NeoPixel
     */
    neoPixelGetColors(pin) {
        const strip = this.neoPixel.find(aStrip => aStrip.pin === pin);
        if(strip === null || strip === undefined) return;
        if(strip.colors === null || strip.colors === undefined) {
            strip.colors = Array(strip.length);
        };
        if(strip.length < strip.colors.length) {
            strip.colors = strip.colors.slice(0, strip.length);
        }

        if(typeof this.neoPixelColorsBuffer === 'undefined') {
            this.neoPixelColorsBuffer = new Array(strip.length);
        }
        return this.neoPixelColorsBuffer;
    }

    /**
     * Measure distance by ultrasonic sensor
     * @param {number} pin - trigger pin of the sensor
     * @param {number} timeout - waiting time for the response
     * @returns {Promise<number>} a Promise which resolves value from the sensor
     */
    getDistanceByUltrasonic (pin, timeout) {
        const firmata = this.firmata;
        timeout = timeout ? timeout : this.ultrasonicDistanceWaitingTime;
        firmata.pinMode(pin, firmata.MODES.PING_READ);
        const event = `ultrasonic-distance-reply-${pin}`;
        const request = new Promise((resolve, reject) => {
            firmata.once(event,
                data => {
                    if (data.length === 0) return reject(new Error('not available'));
                    const value = decodeInt16FromTwo7bitBytes(data);
                    resolve(value);
                });
            firmata.sysexCommand([ULTRASONIC_DISTANCE_QUERY, pin]);
        });
        return Promise.race([request, timeoutReject(timeout)])
            .catch(reason => {
                firmata.removeAllListeners(event);
                return Promise.reject(reason);
            });
    }

    /**
     * Get water temperature.
     * @param {number} pin - trigger pin of the sensor
     * @param {?number} timeout - waiting time for the response
     * @returns {Promise<number>} a Promise which resolves value from the sensor
     */
    getWaterTemp (pin, timeout) {
        const firmata = this.firmata;
        timeout = timeout ? timeout : this.getWaterTempWaitingTime;
        const event = `water-temp-reply-${pin}`;
        const request = new Promise((resolve, reject) => {
            firmata.once(event,
                data => {
                    if (data.length === 0) return reject(new Error('not available'));
                    const value = decodeInt16FromTwo7bitBytes(data);
                    resolve(value);
                });
            firmata.sysexCommand([WATER_TEMPERATURE_QUERY, pin]);
        });
        return Promise.race([request, timeoutReject(timeout)])
            .catch(reason => {
                firmata.removeAllListeners(event);
                return Promise.reject(reason);
            });
    }

    /**
     * State of the all pins
     */
    get pins () {
        return this.firmata.pins;
    }

    /**
     * All pin mode types
     * @types {object<string, number>}
     */
    get MODES () {
        return this.firmata.MODES;
    }

    /**
     * Value for hight in digital signal
     * @types {number}
     */
    get HIGH () {
        return this.firmata.HIGH;
    }

    /**
     * Value for low in digital signal
     * @types {number}
     */
    get LOW () {
        return this.firmata.LOW;
    }

    /**
     * Resolution values for ADC, DAC, PWA.
     * @types {object<string, number>}
     */
    get RESOLUTION () {
        return this.firmata.RESOLUTION;
    }
}

export default AkaDakoBoard;
