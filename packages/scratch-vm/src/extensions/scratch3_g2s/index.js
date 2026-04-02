import BlockType from '../../extension-support/block-type';
import ArgumentType from '../../extension-support/argument-type';
import Cast from '../../util/cast';
import translations from './translations.json';
const blockIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAABDFJREFUeNrsnEFrE0EUgKe2IuIleoiHCt0KLZZc9qC2eNocczJFAnpq8guS/AKpfyDpL9j2pBihKQR6zAoe1FzWg0HbQzelCOZiLuJJcF6cKUNImt3Z3Uln+x5ssl2S92a+fW/mzexLCUFBQUG5ujIXhZJCoWDRN0uzvjuNRsOZKUAKLk/favQwNHUgjx5VCrIpq2A+BLwifXtNj5TGEQhtf57JZHrdbtdV5oEUHnjcCf87m80Sy9Irgh3HIe12W7y0TD3RC6pnQdJ+mZ+USiWSy+W0c721tTViGAaxbZtfegndCarnmqR9E17S6bSW8LhA26EPTKRCKDRA3UXog6ESYIqghAKIggARIAJEgCgIEAEiQASIAFEQIAJEgAgQBQEiQASIAFEQIAK8CgAdeOn3+9oDEPrgqQTocuOHh4fawoO2CwAdGR2ylQk79KjACTzZ9zxPu9KOTqdDWq2WeGlbRo90dRYrLrITMpSVGo3GrswXpauzoJopk8l8oacbRN8H7QN6vKDw3sgqUFlguUX+l0/AYL3nQ+0SPYrsHLyj5+M7QWy4YeoCIwXoE3KbQYbK0KzPm8Lrz7J+qkmD2tA1D7Q01Y2JtO4AvSTaSqoHDpII0FBoy0yyBw6S4HmzBOhqqnvmAE0MYfkkOiUs997HaIrrTjGbifFAU1GK4an2QlUArRmMgVaSAD7lsyRdo8YGkOkejNjUGyD7XR0Pp6aCPnEbJrOtvQeWhfMDBfYOJtjWDyCbCYt8gI9i/81HGDeFyaQY92wctwdWhPRlj6gTbivF2qAfQDb+lIUlVl0hwLowmZTjHAvj9MB9wfu2aWgpW6cyW9uCF+5rBZDecVuYeWF7XaX3cYhg0xFmZFsLgLShFWHiAE8okdlJSQjlImvb5QXI7nJNuLQp838IIvRCsL0pXKpF7YlzAeBMWxrBhJEX/t7ls+FFT9RYmmFOWD/zm1GdsAR0LxpbhTZvCVHBk+2dC/rie8U05wOcyQbhMDPZMJRH80CquxZBmlGneqsjeuFG2iTcA3+PRZAbNoRtEn47Hjpii0ktKw2JYkyqiGMbsxEWHmF9njp7+ykuGobX9bvL5MbKo8Ct+NvvkT9HnzhEU5gZzxf7hZUNuTHu+KO4WVEX2juEt746IEvp34H1do7vkJOfN4kfx/FdnQXwFp48C9yY+bNvHOA4rxxK/v7jsADHSu7hGXlw70hC8zoFuHhpNhMSLQgQASJABIgAURDgrMR3HggJMeR0gRPp069TP/P9149YOtc9vU1fVwN/r9e/FSlAWMemIBmekBAHXV9ygYc/w8X+q8/vwup1x9l4+wGS4cWo2isdwlHt51VHtrZ2STQP2UHH+W88mI1qVG2e9gFf21nsmUI+xAK9OWlXg20qGCE8pDluS4vtIuUl9Q6YXo+goKCgoEyUfwIMABBhRCYQOEdbAAAAAElFTkSuQmCC';

import Long from 'long';

import {AkaDakoConnector, getAkaDakoConnector} from './akadako-connector';
import VL53L0X from './vl53l0x';
import ADXL345 from './adxl345';
import BME280 from './bme280';
import KXTJ3 from './kxtj3';
import LTR303 from './ltr303';
import chroma from 'chroma-js';

/**
 * Returns a Long Integer converted from the value.
 * @param {number|string} valueInput - value to be converted
 * @param {boolean} unsigned - true for unsigned long
 * @returns {Long} converted Long value
 */
const integer64From = (valueInput, unsigned) => {
    if (!valueInput) return (unsigned ? Long.UZERO : Long.ZERO);
    let value = valueInput
    let radix = 10;
    if (typeof value === 'string'){
        value = value.trim();
        if (value.length === 0) return (unsigned ? Long.UZERO : Long.ZERO);
        let sign = '';
        if (value[0] === '-') {
            sign = '-';
            value = value.slice(1).trim();
        }
        if (value.includes('0x')) {
            radix = 16;
            value = value.slice(2);
        }
        if (value.includes('0b')) {
            radix = 2;
            value = value.slice(2);
        }
        return Long.fromString((sign + value), unsigned, radix);
    }
    return Long.fromValue(value, unsigned);
};

/**
 * Make a String separated with ',' from a numeric Array
 * @param {Array} array - numeric array to be converted
 * @returns {string} converted string
 */
const numericArrayToString = array => array.join(', ');

/**
 * Returns a numeric Array made from the string expression.
 * @param {string} stringExp - string to be converted
 * @returns {Array} numeric array from the string
 */
const readAsNumericArray = stringExp => {
    if (typeof stringExp !== 'string') return [Number(stringExp)];
    stringExp = stringExp.trim();
    if (stringExp.length === 0) return [];
    stringExp = stringExp.replaceAll(/[[|\]|"]/g, '');
    const array = [];
    if (stringExp.includes(',')) {
        for (const numberString of stringExp.split(',')) {
            const trimmedNumberString = numberString.trim();
            if (trimmedNumberString.length !== 0) {
                array.push(Number(trimmedNumberString));
            }
        }
    } else {
        for (const item of stringExp.split(/\s+/)) {
            array.push(Number(item));
        }
    }
    return array;
};

/**
 * Formatter which is used for translation.
 * This will be replaced which is used in the runtime.
 * @param {object} messageData - format-message object
 * @returns {string} - message for the locale
 */
let formatMessage = messageData => messageData.defaultMessage;

/**
 * Setup format-message for this extension.
 */
const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    // biome-ignore lint/complexity/useOptionalChain: scratchのbuildはOptionalChainが使えない
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(
            localeSetup.translations[localeSetup.locale],
            translations[localeSetup.locale]
        );
    }
};

const EXTENSION_ID = 'g2s';

/**
 * URL to get this extension as a module.
 * When it was loaded as a module, 'extensionURL' will be replaced a URL which is retrieved from.
 * @type {string}
 */
let extensionURL = 'https://tfabworks.github.io/xcx-g2s/dist/g2s.mjs';


/**
 * Calculate rainbow color.
 * @param {number} idx - index
 * @param {number} length - length
 * @param {number} brightness - brightness
 * @returns {object} color
 */
const getRainbowColor = (idx, length, brightness) => {
    const lightness = brightness;
    const chromacity = 0.15;
    const hue = idx * 360 / length;
    return chroma.oklch(lightness, chromacity, hue).rgb();
}

/**
 * Parse color string or number to RGB array.
 * @param {string | number} color - color string or number
 * @param {number} brightness - brightness
 * @returns {Array<number>} RGB array
 */
const parseColor = (color, brightness) => {
    const rgb = [0, 0, 0];
    if (typeof color === 'string') {
        if(color.includes(',')) {
            const nums = color.split(/\s*,\s*/).map(Cast.toNumber);
            rgb[0] = nums[0] || 0;
            rgb[1] = nums[1] || 0;
            rgb[2] = nums[2] || 0;
        } else if(/^0x[0-9a-fA-F]+$/.test(color)) {
            const colorNumber = Math.round(Cast.toNumber(color));
            if(colorNumber >= 0 && colorNumber <= 0xffffff) {
                rgb[0] = (colorNumber & 0xff0000) >> 16;
                rgb[1] = (colorNumber & 0x00ff00) >> 8;
                rgb[2] = (colorNumber & 0x0000ff) >> 0;
            }
        }
    } else if (typeof color === 'number') {
        const colorNumber = Math.round(Cast.toNumber(color));
        if(colorNumber >= 0 && colorNumber <= 0xffffff) {
            rgb[0] = (colorNumber & 0xff0000) >> 16;
            rgb[1] = (colorNumber & 0x00ff00) >> 8;
            rgb[2] = (colorNumber & 0x0000ff) >> 0;
        }
    } else if(Array.isArray(color)) {
        rgb[0] = Math.round(Cast.toNumber(color[0])) & 0xff;
        rgb[1] = Math.round(Cast.toNumber(color[1])) & 0xff;
        rgb[2] = Math.round(Cast.toNumber(color[2])) & 0xff;
    }
    // 明度を適用する
    for(let i = 0; i < 3; i++) {
        rgb[i] = Math.round(Math.max(0, Math.min(255, rgb[i])) * brightness);
    }
    return rgb;
}

/**
 * Scratch 3.0 blocks for example of Xcratch.
 */
class ExtensionBlocks {

    /**
     * A translation object which is used in this class.
     * @param {FormatObject} formatter - translation object
     */
    static set formatMessage (formatter) {
        formatMessage = formatter;
        if (formatMessage) setupTranslations();
    }

    /**
     * @return {string} - the name of this extension.
     */
    static get EXTENSION_NAME () {
        return formatMessage({
            id: 'g2s.name',
            default: 'AkaDako',
            description: 'name of the extension'
        });
    }

    /**
     * @return {string} - the ID of this extension.
     */
    static get EXTENSION_ID () {
        return EXTENSION_ID;
    }

    /**
     * URL to get this extension.
     * @type {string}
     */
    static get extensionURL () {
        return extensionURL;
    }

    /**
     * Set URL to get this extension.
     * The extensionURL will be changed to the URL of the loading server.
     * @param {string} url - URL
     */
    static set extensionURL (url) {
        extensionURL = url;
    }

    /**
     * Construct a set of blocks for Grove.
     * @param {Runtime} runtime - the Scratch 3.0 runtime.
     */
    constructor (runtime) {
        /**
         * The Scratch 3.0 runtime.
         * @type {Runtime}
         */
        this.runtime = runtime;

        if (runtime.formatMessage) {
            // Replace 'formatMessage' to a formatter which is used in the runtime.
            formatMessage = runtime.formatMessage;
        }

        /**
         * Current connected board object with AkaDako protocol
         * @type {import('./akadako-board').default}
         */
        this.board = null;

        /**
         * Cached sonic distance A.
         * @type {?number}
         */
        this.sonicDistanceA = null;

        /**
         * Last updated time of sonic distance A.
         * @type {number} [milliseconds]
         */
        this.sonicDistanceAUpdatedTime = 0;

        /**
         * Interval time for sonic distance updating A.
         * @type {number} [milliseconds]
         */
        this.sonicDistanceAUpdateIntervalTime = 100;

        /**
         * Cached sonic distance B.
         * @type {?number}
         */
        this.sonicDistanceB = null;

        /**
         * Last updated time of sonic distance B.
         * @type {number} [milliseconds]
         */
        this.sonicDistanceBUpdatedTime = 0;

        /**
         * Interval time for sonic distance updating B.
         * @type {number} [milliseconds]
         */
        this.sonicDistanceBUpdateIntervalTime = 100;

        /**
         * Buffered optical distance values.
         */
        this.opticalDistanceSamples = [];

        /**
         * Size of buffered optical distance values.
         * @type {number}
         */
        this.opticalDistanceSamplesSize = 9;

        /**
         * Default accelerometer
         */
        this.accelerometer = null;

        /**
         * Cached acceleration values.
         * @type {?{x: number y: number z: number}}
         */
        this.acceleration = null;

        /**
         * Last updated time of acceleration.
         * @type {number} [milliseconds]
         */
        this.accelerationUpdatedTime = 0;

        /**
         * Interval time for acceleration updating.
         * @type {number} [milliseconds]
         */
        this.accelerationUpdateIntervalTime = 100;

        /**
         * Brightness sensor
         * @type {LTR303}
         */
        this.brightnessSensor = null;

        /**
         * Cached brightness.
         * @type {?number}
         */
        this.brightness = null;

        /**
         * Last updated time of brightness.
         * @type {number} [milliseconds]
         */
        this.brightnessUpdatedTime = 0;

        /**
         * Interval time for brightness updating.
         * @type {number} [milliseconds]
         */
        this.brightnessUpdateIntervalTime = 100;

        /**
         * Cached water temperature A.
         * @type {?number}
         */
        this.waterTempA = null;

        /**
         * Last updated time of water temperature A.
         * @type {number} [milliseconds]
         */
        this.waterTempAUpdatedTime = 0;

        /**
         * Interval time for water temperature A updating.
         * @type {number} [milliseconds]
         */
        this.waterTempAUpdateIntervalTime = 100;

        /**
         * Cached water temperature B.
         * @type {?number}
         */
        this.waterTempB = null;

        /**
         * Last updated time of water temperature B.
         * @type {number} [milliseconds]
         */
        this.waterTempBUpdatedTime = 0;

        /**
         * Interval time for water temperature B updating.
         * @type {number} [milliseconds]
         */
        this.waterTempBUpdateIntervalTime = 100;

        /**
         * Environment sensor BME280
         * @type {BME280}
         */
        this.envSensor = null;

        /**
         * Cached environment temperature.
         * @type {?number}
         */
        this.envTemperature = null;

        /**
         * Last updated time of environment temperature.
         * @type {number} [milliseconds]
         */
        this.envTemperatureUpdatedTime = 0;

        /**
         * Interval time for environment temperature updating.
         * @type {number} [milliseconds]
         */
        this.envTemperatureUpdateIntervalTime = 100;

        /**
         * Cached environment pressure.
         * @type {?number}
         */
        this.envPressure = null;

        /**
         * Last updated time of environment pressure.
         * @type {number} [milliseconds]
         */
        this.envPressureUpdatedTime = 0;

        /**
         * Interval time for environment pressure updating.
         * @type {number} [milliseconds]
         */
        this.envPressureUpdateIntervalTime = 100;

        /**
         * Cached environment humidity.
         * @type {?number}
         */
        this.envHumidity = null;

        /**
         * Last updated time of environment humidity.
         * @type {number} [milliseconds]
         */
        this.envHumidityUpdatedTime = 0;

        /**
         * Interval time for environment humidity updating.
         * @type {number} [milliseconds]
         */
        this.envHumidityUpdateIntervalTime = 100;

        /**
         * Distance sensor VL53L0X
         * @type {VL53L0X}
         */
        this.vl53l0x = null;

        /**
         * Cached optical distance.
         * @type {?number}
         */
        this.opticalDistance = null;

        /**
         * Last updated time of optical distance.
         * @type {number} [milliseconds]
         */
        this.opticalDistanceUpdatedTime = 0;

        /**
         * Interval time for optical distance updating.
         * @type {number} [milliseconds]
         */
        this.opticalDistanceUpdateIntervalTime = 100;

        /**
         * Busy flag for color LED.
         * @type {boolean}
         */
        this.neoPixelBusy = false;



        /**
         * Manager of AkaDako boards
         * @type {AkaDakoConnector}
         */
        this.boardConnector = getAkaDakoConnector(runtime);
        this.boardConnector.addListener(AkaDakoConnector.BOARD_ADDED, () => this.updateBoard());
        this.boardConnector.addListener(AkaDakoConnector.BOARD_REMOVED, () => this.updateBoard());

        /**
         * state holder of the all pins
         */
        this.pins = [];
        for (const pin of [6, 9, 10, 11, 14, 15, 16, 17]) {
            this.pins[pin] = {};
        }

        // register to call scan()/connect()
        this.runtime.registerPeripheralExtension(EXTENSION_ID, this);

        this.runtime.on('PROJECT_STOP_ALL', async() => {
            await this.resetPinMode();
            await this.neoPixelClearAll();
        });


        /**
         * Threshold value for shake event [m/s^2]
         * @type {number}
         */
        this.shakeEventThreshold = 4.0;

        /**
         * Interval time to check shake event [milliseconds]
         * @type {number}
         */
        this.shakeEventInterval = 200;

        window.addEventListener('beforeunload', _e => {
            this.resetShareServer();
            this.disconnectBoard();
        });
    }

    /**
     * Reset pin mode
     * @returns {undefined}
     */
    async resetPinMode () {
        if (!this.isConnected()) return;
        // デジタルピンのモードをINPUTにリセット
        for (const pin of [6, 9, 10, 11]) {
            if(this.board.pins[pin].mode === this.board.MODES.PWM) {
                await this.board.pwmWrite(pin, 0);
            }
            await this.board.pinMode(pin, this.board.MODES.INPUT);
        }
        // 3ピンが振動モーターとして利用されていた場合はデューティー比を0にリセット
        if(this.board.pins[3].mode === this.board.MODES.PWM) {
            await this.board.pwmWrite(3, 0);
        }
    }

    /**
     * Turn off the all NeoPixel strips.
     */
    neoPixelClearAll () {
        return this.neoPixelOperationWithLock({}, {}, () => this.board.neoPixelClearAll())
    }

    /**
     * Update connected board
     */
    updateBoard () {
        // biome-ignore lint/complexity/useOptionalChain: scratchのbuildはOptionalChainが使えない
        if (this.board && this.board.isConnected()) return;
        const prev = this.board;
        this.board = this.boardConnector.findBoard();
        if (prev === this.board) return;
        this.sonicDistanceAUpdating = false;
        this.sonicDistanceBUpdating = false;
        this.vl53l0x = null;
        this.opticalDistanceUpdating = false;
        this.envSensor = null;
        this.envTemperatureUpdating = false;
        this.envPressureUpdating = false;
        this.envHumidityUpdating = false;
        this.accelerometer = null;
        this.accelerationUpdating = false;
        this.shakeEventUpdating = false;
        this.brightnessSensor = null;
        this.brightnessUpdating = false;
        this.waterTempAUpdating = false;
        this.waterTempBUpdating = false;
        this.neoPixelBusy = false;
    }

    /**
     * Called by the runtime when user wants to scan for a peripheral.
     * @returns {Promise} - a Promise which resolves when a board was connected
     */
    scan () {
        return this.connectBoard();
    }

    /**
     * Called by the runtime when user wants to cancel scanning or the peripheral was disconnected.
     */
    disconnect () {
        this.disconnectBoard();
    }

    /**
     * Return whether the board is ready to use or not.
     * @returns {boolean} true if the board is connected
     */
    isConnected () {
        if (!this.board) return false;
        return this.board.isReady();
    }

    /**
     * Connect a AkaDako board.
     * @returns {Promise<string>} a promise which resolves the result of this command
     */
    connectBoard () {
        // biome-ignore lint/complexity/useOptionalChain: scratchのbuildはOptionalChainが使えない
        if (this.board && this.board.isConnected()) return; // Already connected
        return this.boardConnector.connectedBoard(EXTENSION_ID)
            .then(connectedBoard => {
                this.runtime.emit(this.runtime.constructor.PERIPHERAL_CONNECTED, {
                    name: connectedBoard.name,
                    path: connectedBoard.portInfo
                });
                return `connected to ${JSON.stringify(connectedBoard.portInfo)}`;
            })
            .catch(reason => {
                if (reason) {
                    // eslint-disable-next-line no-console
                    console.log(reason);
                } else {
                    // eslint-disable-next-line no-console
                    console.log("fail to connect AkaDako Board");
                }
                this.runtime.emit(this.runtime.constructor.PERIPHERAL_REQUEST_ERROR, {
                    message: "Scratch lost connection to",
                    extensionId: EXTENSION_ID
                });
                return reason.toString();
            });
    }

    /**
     * Disconnect from the current connected board.
     * @returns {undefined}
     */
    disconnectBoard () {
        if (!this.board) return;
        return this.board.disconnect();
    }

    /**
     * Whether the current state is same as the argument state.
     * @param {object} args - the block's arguments.
     * @param {string} args.STATE - state to detect
     * @returns {boolean} true if the current state is same as the state
     */
    boardStateChanged (args) {
        return (args.STATE === 'connected') === this.isConnected();
    }

    /**
     * Return the version information of the connected board.
     * @returns {string} version info
     */
    boardVersion () {
        if (!this.isConnected()) return '';
        return this.board.boardVersion()
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`boardVersion() was rejected by ${reason}`);
                return Promise.reject(reason);
            });
    }

    /**
     * Whether the current level of the connector is HIGH as digital input.
     * @param {object} args - the block's arguments.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @returns {boolean} true for high
     */
    digitalIsHigh (args) {
        if (!this.isConnected()) return false;
        let pin = null;
        switch (args.CONNECTOR) {
        case 'A':
            pin = 6;
            break;
        case 'B':
            pin = 9;
            break;
        case 'PIR':
            pin = 9;
            break;
        default:
            pin = parseInt(args.CONNECTOR, 10);
            break;
        }
        return !!this.board.getDigitalValue(pin);
    }

    /**
     * The level [0|1] of digital A1 connector
     * @returns {number | string} - digital level or empty string when disconnected
     */
    digitalLevelA1 () {
        if (!this.isConnected()) return '';
        return this.board.getDigitalValue(10);
    }

    /**
     * The level [0|1] of digital A2 connector
     * @returns {number | string} - digital level or empty string when disconnected
     */
    digitalLevelA2 () {
        if (!this.isConnected()) return '';
        return this.board.getDigitalValue(11);
    }

    /**
     * The level [0|1] of digital B1 connector
     * @returns {number | string} - digital level or empty string when disconnected
     */
    digitalLevelB1 () {
        if (!this.isConnected()) return '';
        return this.board.getDigitalValue(6);
    }

    /**
     * The level [0|1] of digital B2 connector
     * @returns {number | string} - digital level or empty string when disconnected
     */
    digitalLevelB2 () {
        if (!this.isConnected()) return '';
        return this.board.getDigitalValue(9);
    }

    /**
     * Detect the edge as digital level of the connector for HAT block.
     * @param {object} args - the block's arguments.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @param {boolean} args.LEVEL - level to detect edge
     * @returns {boolean} is the level same as the current of the connector
     */
    digitalLevelChanged (args) {
        if (!this.isConnected()) return false;
        let pin = null;
        switch (args.CONNECTOR) {
        case 'A':
            pin = 6;
            break;
        case 'B':
            pin = 9;
            break;
        case 'PIR':
            pin = 9;
            break;
        default:
            pin = Number.parseInt(args.CONNECTOR, 10);
            break;
        }
        const rise = Cast.toBoolean(args.LEVEL);
        return rise === !!this.board.pins[pin].value; // Do NOT return Promise for the hat execute correctly.
    }

    /**
     * Set input bias of the connector.
     * @param {object} args - the block's arguments.
     * @param {string} args.PIN - number of the pin
     * @param {string} args.BIAS - input bias of the pin [none | pullUp]
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    inputBiasSet (args) {
        if (!this.isConnected()) return;
        const pin = Number.parseInt(args.PIN, 10);
        const pullUp = args.BIAS === 'pullUp';
        return this.board.setInputBias(pin, pullUp);
    }

    /**
     * Set the connector to the level as digital output.
     * @param {object} args - the block's arguments.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @param {boolean | string | number} args.LEVEL - level to be set
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    digitalLevelSet (args) {
        if (!this.isConnected()) return;
        const pin = Number.parseInt(args.CONNECTOR, 10);
        if (this.board.version.type === 2) {
            // STEAM Tool
            if (pin === 6 || pin === 9) {
                // These pins are used for on-board buttons in the STEAM tool.
                return;
            }
        }
        const value = Cast.toBoolean(args.LEVEL) ? this.board.HIGH : this.board.LOW;
        return this.board.digitalWrite(pin, value);
    }

    /**
     * The level [%] of analog A1 connector
     * @returns {number | string} - analog level or empty string when disconnected
     */
    analogLevelA1 () {
        if (!this.isConnected()) return '';
        const raw = this.board.getAnalogValue(0);
        return Math.round((raw / 1023) * 1000) / 10;
    }

    /**
     * The level [%] of analog A2 connector
     * @returns {number | string} - analog level or empty string when disconnected
     */
    analogLevelA2 () {
        if (!this.isConnected()) return '';
        const raw = this.board.getAnalogValue(1);
        return Math.round((raw / 1023) * 1000) / 10;
    }

    /**
     * The level [%] of analog B1 connector
     * @returns {number | string} - analog level or empty string when disconnected
     */
    analogLevelB1 () {
        if (!this.isConnected()) return '';
        const raw = this.board.getAnalogValue(2);
        return Math.round((raw / 1023) * 1000) / 10;
    }

    /**
     * The level [%] of analog B2 connector
     * @returns {number | string} - analog level or empty string when disconnected
     */
    analogLevelB2 () {
        if (!this.isConnected()) return '';
        const raw = this.board.getAnalogValue(3);
        return Math.round((raw / 1023) * 1000) / 10;
    }

    /**
     * Set the connector to power [%] as PWM.
     * @param {object} args - the block's arguments.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @param {string | number} args.LEVEL - power (%) of PWM
     * @param {number?} args.MIN_INTERVAL - minimum interval between calls [ms] for the same pin, default is 0
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    async analogLevelSet (args) {
        if (!this.isConnected()) return;
        const pin = Number.parseInt(args.CONNECTOR, 10);
        if (this.board.version.type === 2) {
            // STEAM Tool
            if (pin === 6 || pin === 9) {
                // This pin is used for on-board buttons in the STEAM tool.
                return;
            }
        }
        const percent = Math.min(Math.max(Cast.toNumber(args.LEVEL), 0), 100);
        const value = Math.round(this.board.RESOLUTION.PWM * (percent / 100));
        const minInterval = Cast.toNumber(args.MIN_INTERVAL);
        // 前回の同一PINに対する書き込み時刻保存用マップがなければ初期化
        if(typeof this.analogLevelSetLastTimestampMap === 'undefined') {
            this.analogLevelSetLastTimestampMap = new Map()
        }
        // 実行からの最小インターバルが指定されており、かつ同一PINに対する前回の書き込み時刻からの時間がそれ以下であればsleepを入れる
        if(minInterval > 0) {
            const lastTimestamp = this.analogLevelSetLastTimestampMap.get(pin)
            if(typeof lastTimestamp !== 'undefined') {
                const interval = Date.now() - lastTimestamp;
                if(interval < minInterval) {
                    await new Promise(resolve=>setTimeout(resolve, minInterval - interval))
                }
            }
        }
        // 書き込み時刻を保存
        this.analogLevelSetLastTimestampMap.set(pin, Date.now());
        // 書き込み実行
        this.board.pinMode(pin, this.board.MODES.PWM);
        return this.board.pwmWrite(pin, value);
    }

    /**
     * Turn the servo motor to the degrees (-90...90).
     * @param {object} args - the block's arguments.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @param {number} args.ANGLE - degrees to the servo to turn
     * @param {number} args.SPEED - speed of turning
     * @param {BlockUtility} util - utility object provided by the runtime
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    servoTurn (args, util) {
        if (!this.isConnected()) return Promise.resolve();
        const pin = Number.parseInt(args.CONNECTOR, 10);
        const servo = this.board.getServo(pin);
        if (!servo) return Promise.resolve();
        if (servo.isBusy) {
            if (util) {
                util.yield(); // re-try this call after a while.
            }
            return; // Do not return Promise.resolve() to re-try.
        }
        const angle = Cast.toNumber(args.ANGLE);
        const speed = ((typeof args.SPEED) === 'undefined') ? 100 : Cast.toNumber(args.SPEED);
        servo.isBusy = true;
        return servo.turnWithSpeed(angle, speed)
            .finally(() => {
                servo.isBusy = false;
            });
    }

    /**
     * Write data to register
     * @param {object} args - the block's arguments.
     * @param {number} args.ADDRESS - I2C address
     * @param {number} args.REGISTER - register which write to
     * @param {Array<string>} args.DATA - bytes to be written
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    i2cWrite (args) {
        if (!this.isConnected()) return;
        const address = Number(args.ADDRESS);
        const register = Number(args.REGISTER);
        const data = readAsNumericArray(args.DATA);
        return this.board.i2cWrite(address, register, data);
    }

    /**
     * Read data from I2C once.
     * @param {object} args - the block's arguments.
     * @param {number} args.ADDRESS - I2C address
     * @param {number} args.REGISTER - register to read
     * @returns {Promise<string>} a Promise which resolves read data
     */
    i2cReadOnce (args) {
        if (!this.isConnected()) return '';
        const address = Number(args.ADDRESS);
        const register = Number(args.REGISTER);
        const length = Number.parseInt(Cast.toNumber(args.LENGTH), 10);
        return this.board.i2cReadOnce(address, register, length)
            .then(data => numericArrayToString(data))
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`i2cReadOnce(${address}, ${register}, ${length}) was rejected by ${reason}`);
                return '';
            });
    }

    /**
     * Reset OneWire modules on the pin
     * @param {object} args - the block's arguments.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    oneWireReset (args) {
        if (!this.isConnected()) return;
        const pin = Number.parseInt(args.CONNECTOR, 10);
        return this.board.sendOneWireReset(pin);
    }

    /**
     * Writ data to the first OneWire module.
     * @param {object} args - the block's arguments.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @param {Array<string>} args.DATA - bytes to be written
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    oneWireWrite (args) {
        if (!this.isConnected()) return;
        const pin = Number.parseInt(args.CONNECTOR, 10);
        const data = readAsNumericArray(args.DATA);
        return this.board.oneWireWrite(pin, data)
            .catch(error => {
                // eslint-disable-next-line no-console
                console.log(error);
                return error.message ? error.message : error;
            });
    }

    /**
     * Read on OneWire.
     * @param {object} args - the block's arguments.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @returns {Promise<string>} return a Promise which will resolve with read data
     */
    oneWireRead (args) {
        if (!this.isConnected()) return Promise.resolve('');
        const pin = Number.parseInt(args.CONNECTOR, 10);
        const length = Number.parseInt(Cast.toNumber(args.LENGTH), 10);
        return this.board.oneWireRead(pin, length)
            .then(readData => numericArrayToString(readData))
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`oneWireRead(${pin}, ${length}) was rejected by ${reason}`);
                return '';
            });
    }

    /**
     * Write then read on OneWire.
     * @param {object} args - the block's arguments.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {Promise<string>} return a Promise which will resolve with read data
     */
    oneWireWriteAndRead (args) {
        if (!this.isConnected()) return Promise.resolve('');
        const pin = Number.parseInt(args.CONNECTOR, 10);
        const data = readAsNumericArray(args.DATA);
        const readLength = Number.parseInt(Cast.toNumber(args.LENGTH), 10);
        return this.board.oneWireWriteAndRead(pin, data, readLength)
            .then(readData => numericArrayToString(readData))
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`oneWireWriteAndRead(${pin}, ${data}, ${readLength}) was rejected by ${reason}`);
                return '';
            });
    }


    /**
     * Configure a NeoPixel module on the pin.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @param {string} args.CONNECTOR - pin number of the connector
     * @param {string} args.LENGTH - length of LEDs on the module
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    neoPixelConfigStrip (args, util) {
        return this.neoPixelOperationWithLock(args, util, pin => {
            if(pin === null || pin === undefined) return;
            const length = Math.max(0, Math.min(60, Cast.toNumber(Number.parseInt(args.LENGTH, 10))));
            return this.board.neoPixelConfigStrip(pin, length).then(()=>{});
        });
    }

    /**
     * Update color of LEDs on the all of NeoPixel modules.
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    neoPixelShow (args, util) {
        return this.neoPixelOperationWithLock(args, util, () =>
            this.board.neoPixelShow().then(()=>{})
        );
    }

    /**
     * Set color of the LED
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @param {string} args.POSITION - position of the LED on the module start at 1
     * @param {string} args.COLOR - color values [r, g, b]
     * @param {string} args.BRIGHTNESS - brightness fo the LED [%]
     */
    neoPixelSetColor (args, util) {
        return this.neoPixelOperationWithLock(args, util, pin => {
            if(pin === null || pin === undefined) return;
            const index = Cast.toNumber(args.POSITION) - 1;
            const brightness = Math.max(0, Math.min(100, Cast.toNumber(args.BRIGHTNESS))) / 100;
            // -1 は虹色として解釈する
            if(args.COLOR === 'rainbow') {
                const colorFn = (_, i, colors) => {
                    if(i === index) {
                        return getRainbowColor(i, colors.length, brightness);
                    }
                    return null;
                }
                return this.board.neoPixelFillColor(pin, colorFn);
            }
            // 指定された色をセットする
            const color = parseColor(args.COLOR, brightness);
            return this.board.neoPixelSetColor(pin, color, index).then(()=>{});
        });
    }

    /**
     * Fill color of the LED
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @param {number} args.CONNECTOR - pin number of the connector
     * @param {string} args.COLOR - color values [r, g, b]
     * @param {string} args.BRIGHTNESS - brightness fo the LED [%]
     */
    neoPixelFillColor (args, util) {
        return this.neoPixelOperationWithLock(args, util, pin => {
            if(pin === null || pin === undefined) return;
            const brightness = Cast.toNumber(args.BRIGHTNESS) / 100;
            let colorFn = null;
            if(args.COLOR === 'rainbow') {
                colorFn = (_, i, colors) => getRainbowColor(i, colors.length, brightness);
            }
            // 特別な色モードでない場合は全て指定の色にする
            if(colorFn === null) {
                const color = parseColor(args.COLOR, brightness);
                colorFn = () => color;
            }
            return this.board.neoPixelFillColor(pin, colorFn).then(()=>{});
        });
    }

    neoPixelShiftColor(args, util) {
        return this.neoPixelOperationWithLock(args, util, pin => {
            if(pin === null || pin === undefined) return;
            const n = Cast.toNumber(args.N);
            const loopMode = Cast.toBoolean(args.LOOP_MODE);
            // 色をシフトする関数で塗りつぶす
            const colorMapFn = (curColor, i, colors) => {
                const length = colors.length;
                const fromIndex = i - n;
                const fromIndexInLoop = ((fromIndex % length) + length) % length;
                const newColor = loopMode ? colors[fromIndexInLoop] : colors[fromIndex];
                // 色が変化していなければスキップ
                if((newColor === null || newColor === undefined) && (curColor === null || curColor === undefined)) return null;
                if((newColor !== null && newColor !== undefined) && (curColor !== null && curColor !== undefined)) {
                    if(newColor[0] === curColor[0] && newColor[1] === curColor[1] && newColor[2] === curColor[2]) {
                        return null;
                    }
                }
                // 新しい色が null なら [0, 0, 0] をセットする
                return newColor || [0, 0, 0];
            }
            return this.board.neoPixelFillColor(pin, colorMapFn).then(()=>{});
        });
    }

    /**
     * Execute NeoPixel operation with lock
     * @param {object} args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @param {string} args.CONNECTOR - pin number of the connector
     * @param {(pin: number | null) => Promise} operation
     * @returns {Promise} result of operation
     */
    neoPixelOperationWithLock(args, util, operation) {
        if (!this.isConnected()) return;
        let pin = Number.parseInt(args.CONNECTOR, 10);
        if (this.board.version.type === 2) {
            // STEAM Tool
            if (pin === 6 || pin === 9) {
                // These pins are used for on-board buttons in the STEAM tool.
                pin = null
            }
        }
        return operation(pin)
    }

    /**
     * Return color values for NeoPixel.
     * @param {object} args - the block's arguments.
     * @param {string} args.RED - value for red [0...255]
     * @param {string} args.GREEN - value for green [0...255]
     * @param {string} args.BLUE - value for blue [0...255]
     * @returns {string} color value 0xRRGGBB in string
     */
    neoPixelColor (args) {
        const readAsColor = value =>
            Math.round(Math.max(0, Math.min(255, Cast.toNumber(value))))
                .toString(16)
                .padStart(2, '0');
        return `0x${readAsColor(args.RED)}${readAsColor(args.GREEN)}${readAsColor(args.BLUE)}`;
    }

    /**
     * Get color mode
     * @param {object} args - the block's arguments.
     * @returns {string} color mode
     */
    neoPixelColorMode(args) {
        return args.MODE;
    }

    /**
     * Turn off the all LEDs on the NeoPixel module on the pin.
     * @param {object} args - the block's arguments.
     * @param {string} args.CONNECTOR - pin number of the connector
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {Promise} a Promise which resolves when the message was sent
     */
    neoPixelClear (args, util) {
        return this.neoPixelOperationWithLock(args, util, pin => {
            if(pin === null || pin === undefined) return;
            return this.board.neoPixelClear(pin);
        });
    }

    async getOpticalDistanceSensor () {
        if (!this.vl53l0x) {
            let address = 0x08; // STEAM Tool v2.0.1 or later
            if ((this.board.version.type <= 1) ||
            (this.board.version.type === 2 && this.board.version.major === 0 && this.board.version.minor === 0)) {
                address = null;
            }
            const newSensor = new VL53L0X(this.board, address);
            const found = await newSensor.init(true);
            if (!found) {
                // eslint-disable-next-line no-console
                console.log('Distance sensor (laser) is not found.');
                return null;
            }
            await newSensor.setRangeProfile('LONG_RANGE');
            await newSensor.startContinuous();
            this.vl53l0x = newSensor;
        }
        return this.vl53l0x;
    }

    /**
     * Reduce noise of the value of the ToF distance sensor.
     * @param {number} value - value of the ToF distance sensor
     * @returns {number} processed value
     */
    reduceNoiseOfOpticalDistance (value) {
        if (this.opticalDistanceSamples.length >= this.opticalDistanceSamplesSize) {
            this.opticalDistanceSamples.shift();
        }
        this.opticalDistanceSamples.push(value);
        const sorted = [...this.opticalDistanceSamples].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    }

    /**
     * Measure distance using ToF sensor VL53L0X.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {Promise<number | string>} a Promise which resolves distance [cm] or empty string if it was fail
     */
    measureDistanceWithLight (_args, util) {
        if (!this.isConnected()) return Promise.resolve('');
        let measureRequest = Promise.resolve(this.opticalDistance);
        if ((Date.now() - this.opticalDistanceUpdatedTime) > this.opticalDistanceUpdateIntervalTime) {
            if (this.opticalDistanceUpdating) {
                util.yield(); // re-try this call after a while.
                return; // Do not return Promise to re-try.
            }
            this.opticalDistanceUpdating = true;
            measureRequest = measureRequest
                .then(() => this.getOpticalDistanceSensor())
                .then(sensor => sensor.readRangeContinuousMillimeters())
                .then(distance => {
                    // STEAM Tool supplement: - 50[mm]
                    distance = distance - 50;
                    // STEAM Tool limit: 100 - 2000[mm]
                    return Math.max(100, Math.min(distance, 2000));
                })
                .then(distance => {
                    this.opticalDistance = distance;
                    return distance;
                })
                .finally(() => {
                    this.opticalDistanceUpdating = false;
                });
        }
        return measureRequest
            .then(distance => distance / 10) // convert unit [mm] to [cm]
            .then(distance => this.reduceNoiseOfOpticalDistance(distance))
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`measureDistanceWithLight was rejected by ${reason}`);
                this.opticalDistance = null;
                return '';
            });
    }

    /**
     * Measure distance using ultrasonic sensor on Digital A.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {Promise<number | string>} a Promise which resolves distance [cm] or empty string if it was fail
     */
    measureDistanceWithUltrasonicA (_args, util) {
        if (!this.isConnected()) return Promise.resolve('');
        let getter = Promise.resolve(this.sonicDistanceA);
        if ((Date.now() - this.sonicDistanceAUpdatedTime) > this.sonicDistanceAUpdateIntervalTime) {
            if (this.sonicDistanceAUpdating) {
                util.yield(); // re-try this call after a while.
                return; // Do not return Promise to re-try.
            }
            this.sonicDistanceAUpdating = true;
            const pin = 10;
            getter = getter.then(() => this.board.getDistanceByUltrasonic(pin))
                .then(value => {
                    this.sonicDistanceA = value;
                    this.sonicDistanceAUpdatedTime = Date.now();
                    return this.sonicDistanceA;
                })
                .finally(() => {
                    this.sonicDistanceAUpdating = false;
                });
        }
        return getter
            .then(value => Math.min(350, Math.round(value / 10)))
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`ultrasonic distance A was rejected by ${reason}`);
                return '';
            });
    }

    /**
     * Measure distance using ultrasonic sensor on Digital B.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {Promise<number | string>} a Promise which resolves distance [cm] or empty string if it was fail
     */
    measureDistanceWithUltrasonicB (_args, util) {
        if (!this.isConnected()) return Promise.resolve('');
        if (this.board.version.type === 2) {
            // STEAM Tool
            // This pin is used for on-board buttons in the STEAM tool.
            return Promise.resolve('');
        }
        let getter = Promise.resolve(this.sonicDistanceB);
        if ((Date.now() - this.sonicDistanceBUpdatedTime) > this.sonicDistanceBUpdateIntervalTime) {
            if (this.sonicDistanceBUpdating) {
                util.yield(); // re-try this call after a while.
                return; // Do not return Promise to re-try.
            }
            this.sonicDistanceBUpdating = true;
            const pin = 6;
            getter = getter.then(() => this.board.getDistanceByUltrasonic(pin))
                .then(value => {
                    this.sonicDistanceB = value;
                    this.sonicDistanceBUpdatedTime = Date.now();
                    return this.sonicDistanceB;
                })
                .finally(() => {
                    this.sonicDistanceBUpdating = false;
                });
        }
        return getter
            .then(value => Math.min(350, Math.round(value / 10)))
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`ultrasonic distance B was rejected by ${reason}`);
                return '';
            });
    }

    /**
     * Get instance of an accelerometer.
     * @returns {Promise} A Promise which resolves an accelerometer.
     */
    async getAccelerometer () {
        if (!this.accelerometer) {
            let newSensor = null;
            const isKXTJ3Connected = await KXTJ3.isConnected(this.board);
            if (isKXTJ3Connected) {
                newSensor = new KXTJ3(this.board);
            } else {
                const isADXL345Connected = await ADXL345.isConnected(this.board);
                if (isADXL345Connected) {
                    newSensor = new ADXL345(this.board);
                } else {
                    throw new Error('No supported accelerometer found');
                }
            }
            await newSensor.init();
            this.accelerometer = newSensor;
        }
        return this.accelerometer;
    }

    /**
     * Get acceleration [m/s^2] for the axis.
     * @returns {Promise<?{x: number, y: number, z: number}>} a Promise which resolves acceleration
     */
    async getAcceleration () {
        try {
            const sensor = await this.getAccelerometer();
            this.acceleration = await sensor.getAcceleration();
            this.accelerationUpdatedTime = Date.now();
            return this.acceleration;
        } catch (reason) {
            // eslint-disable-next-line no-console
            console.log(`getAcceleration() was rejected by ${reason}`);
            this.acceleration = null;
            return null;
        }
    }

    updateAcceleration (util) {
        let getRequest = Promise.resolve(this.acceleration);
        if ((Date.now() - this.accelerationUpdatedTime) > this.accelerationUpdateIntervalTime) {
            if (this.accelerationUpdating) {
                util.yield(); // re-try this call after a while.
                return; // Do not return Promise to re-try.
            }
            this.accelerationUpdating = true;
            getRequest = getRequest.then(() => this.getAcceleration())
                .finally(() => {
                    this.accelerationUpdating = false;
                });
        }
        return getRequest;
    }

    /**
     * Get acceleration [m/s^2] for axis X.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {?Promise<number | string>} a Promise which resolves acceleration or empty string if it was fail
     */
    getAccelerationX (_args, util) {
        if (!this.isConnected()) return '';
        const updateAcc = this.updateAcceleration(util);
        if ((typeof updateAcc) === 'undefined') return; // re-try thread
        return updateAcc
            .then(acc => {
                if (!acc) return '';
                return (Math.round(acc.x * 100)) / 100;
            });
    }

    /**
     * Get acceleration [m/s^2] for axis Y.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {?Promise<number | string>} a Promise which resolves acceleration or empty string if it was fail
     */
    getAccelerationY (_args, util) {
        if (!this.isConnected()) return '';
        const updateAcc = this.updateAcceleration(util);
        if ((typeof updateAcc) === 'undefined') return; // re-try thread
        return updateAcc
            .then(acc => {
                if (!acc) return '';
                return (Math.round(acc.y * 100)) / 100;
            });
    }

    /**
     * Get acceleration [m/s^2] for axis Z.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {?Promise<number | string>} a Promise which resolves acceleration or empty string if it was fail
     */
    getAccelerationZ (_args, util) {
        if (!this.isConnected()) return '';
        const updateAcc = this.updateAcceleration(util);
        if ((typeof updateAcc) === 'undefined') return; // re-try thread
        return updateAcc
            .then(acc => {
                if (!acc) return '';
                return (Math.round(acc.z * 100)) / 100;
            });
    }

    /**
     * Get absolute acceleration [m/s^2].
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {?Promise<number | string>} a Promise which resolves acceleration or empty string if it was fail
     */
    getAccelerationAbsolute (_args, util) {
        if (!this.isConnected()) return '';
        const updateAcc = this.updateAcceleration(util);
        if ((typeof updateAcc) === 'undefined') return; // re-try thread
        return updateAcc
            .then(acc => {
                if (!acc) return '';
                const absolute = Math.sqrt(
                    (acc.x ** 2) +
                    (acc.y ** 2) +
                    (acc.z ** 2)
                );
                return (Math.round(absolute * 100)) / 100;
            });
    }

    /**
     * Get roll [degree] from accelerometer.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {?Promise<number | string>} a Promise which resolves roll or empty string if it was fail
     */
    getRoll (_args, util) {
        if (!this.isConnected()) return '';
        const updateAcc = this.updateAcceleration(util);
        if ((typeof updateAcc) === 'undefined') return; // re-try thread
        return updateAcc
            .then(acc => {
                if (!acc) return '';
                const roll = Math.atan2(acc.y, acc.z) * 180.0 / Math.PI;
                return (Math.round(roll * 100)) / 100;
            });
    }

    /**
     * Get pitch [degree] from accelerometer.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {?Promise<number |string>} a Promise which resolves pitch or empty string if it was fail
     */
    getPitch (_args, util) {
        if (!this.isConnected()) return '';
        const updateAcc = this.updateAcceleration(util);
        if ((typeof updateAcc) === 'undefined') return; // re-try thread
        return updateAcc
            .then(acc => {
                if (!acc) return '';
                const angle = Math.atan2(
                    acc.x,
                    Math.sqrt((acc.y * acc.y) + (acc.z * acc.z))
                ) * 180.0 / Math.PI;
                let pitch = angle;
                if (acc.z < 0) {
                    pitch = ((angle > 0) ? 180 : -180) - angle;
                }
                return (Math.round(pitch * 100)) / 100;
            });
    }


    /**
     * Get instance of an environment sensor.
     * @returns {Promise} A Promise which resolves a sensor.
     */
    async getEnvSensor () {
        if (!this.envSensor) {
            const newSensor = new BME280(this.board);
            await newSensor.init();
            this.envSensor = newSensor;
        }
        return this.envSensor;
    }

    /**
     * Get temperature [℃] from environment sensor.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {Promise<number | string>} a Promise which resolves temp or empty string if it was fail
     */
    getEvnTemperature (_args, util) {
        if (!this.isConnected()) return Promise.resolve('');
        let getter = Promise.resolve(this.envTemperature);
        if ((Date.now() - this.envTemperatureUpdatedTime) > this.envTemperatureUpdateIntervalTime) {
            if (this.envTemperatureUpdating) {
                util.yield(); // re-try this call after a while.
                return; // Do not return Promise to re-try.
            }
            this.envTemperatureUpdating = true;
            getter = getter
                .then(() => this.getEnvSensor())
                .then(() => this.envSensor.readTemperature())
                .then(envTemperature => {
                    this.envTemperature = envTemperature;
                    this.envTemperatureUpdatedTime = Date.now();
                    return envTemperature;
                })
                .finally(() => {
                    this.envTemperatureUpdating = false;
                });
        }
        return getter
            .then(envTemperature => (Math.round(envTemperature * 100) / 100))
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`getting environment temperature was rejected by ${reason}`);
                this.envTemperature = null;
                this.envSensor = null;
                return '';
            });
    }

    /**
     * Get pressure [hPa] from environment sensor.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {Promise<number | string>} a Promise which resolves pressure or empty string if it was fail
     */
    getEvnPressure (_args, util) {
        let getter = Promise.resolve(this.envPressure);
        if ((Date.now() - this.envPressureUpdatedTime) > this.envPressureUpdateIntervalTime) {
            if (this.envPressureUpdating) {
                util.yield(); // re-try this call after a while.
                return; // Do not return Promise to re-try.
            }
            this.envPressureUpdating = true;
            getter = getter
                .then(() => this.getEnvSensor())
                .then(() => this.envSensor.readPressure())
                .then(envPressure => {
                    this.envPressure = envPressure;
                    this.envPressureUpdatedTime = Date.now();
                    return envPressure;
                })
                .finally(() => {
                    this.envPressureUpdating = false;
                });
        }
        return getter
            .then(envPressure => (Math.round(envPressure * 100) / 10000))
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`getting environment pressure was rejected by ${reason}`);
                this.envPressure = null;
                this.envSensor = null;
                return '';
            });
    }

    /**
     * Get humidity [%] from environment sensor.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {Promise<number | string>} a Promise which resolves value of humidity or empty string if it was fail
     */
    getEnvHumidity (_args, util) {
        let getter = Promise.resolve(this.envHumidity);
        if ((Date.now() - this.envHumidityUpdatedTime) > this.envHumidityUpdateIntervalTime) {
            if (this.envHumidityUpdating) {
                util.yield(); // re-try this call after a while.
                return; // Do not return Promise to re-try.
            }
            this.envHumidityUpdating = true;
            getter = getter
                .then(() => this.getEnvSensor())
                .then(() => this.envSensor.readHumidity())
                .then(envHumidity => {
                    this.envHumidity = envHumidity;
                    this.envHumidityUpdatedTime = Date.now();
                    return envHumidity;
                })
                .finally(() => {
                    this.envHumidityUpdating = false;
                });
        }
        return getter
            .then(envHumidity => (Math.round(envHumidity * 100) / 100))
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`getting environment humidity was rejected by ${reason}`);
                this.envHumidity = null;
                this.envSensor = null;
                return '';
            });
    }

    /**
     * Get instance of a brightness sensor.
     * @returns {Promise} A Promise which resolves a sensor.
     */
    async getBrightnessSensor () {
        if (!this.brightnessSensor) {
            const newSensor = new LTR303(this.board);
            await newSensor.init();
            this.brightnessSensor = newSensor;
        }
        return this.brightnessSensor;
    }

    /**
     * Get brightness [lx] from LTR-303 on I2C
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {Promise<number | string>} a Promise which resolves value of brightness or empty string if it was fail
     */
    getBrightness (_args, util) {
        if (!this.isConnected()) return Promise.resolve('');
        let getter = Promise.resolve(this.brightness);
        if ((Date.now() - this.brightnessUpdatedTime) > this.brightnessUpdateIntervalTime) {
            if (this.brightnessUpdating) {
                util.yield(); // re-try this call after a while.
                return; // Do not return Promise to re-try.
            }
            this.brightnessUpdating = true;
            getter = getter
                .then(() => this.getBrightnessSensor())
                .then(() => this.brightnessSensor.getBrightness())
                .then(brightness => {
                    this.brightness = brightness;
                    this.brightnessUpdatedTime = Date.now();
                    return brightness;
                })
                .finally(() => {
                    this.brightnessUpdating = false;
                });
        }
        return getter
            .then(brightness => Math.min(64000, (Math.round(brightness * 10) / 10))) // Ignore too big value
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`getting brightness was rejected by ${reason}`);
                this.brightness = null;
                this.brightnessSensor = null;
                return '';
            });
    }

    /**
     * Get temperature using DS18B20 on the pin.
     * @param {number} pin - pin number to use
     * @returns {Promise<number>} a Promise which resolves value of temperature [℃]
     */
    getTemperatureDS18B20 (pin) {
        return this.board.sendOneWireReset(pin)
            .then(() => this.board.oneWireWrite(pin, 0x44))
            .then(() => this.board.sendOneWireReset(pin))
            .then(() => this.board.oneWireWriteAndRead(pin, 0xBE, 9))
            .then(readData => {
                const buffer = new Uint8Array(readData).buffer;
                const dataView = new DataView(buffer);
                const rawTemp = dataView.getInt16(0, true);
                return Math.round((rawTemp / 16) * 10) / 10;
            });
    }

    /**
     * Get water temp [℃] by sensor on the pin.
     * @param {number} pin - pin number for the sensor
     * @returns {Promise<number>} a Promise which resolves temperature [℃]
     */
    getWaterTemp (pin) {
        if ((this.board.version.type === 0)) {
            return this.getTemperatureDS18B20(pin);
        }
        // MidiDako v1.0.0 or later
        return this.board.getWaterTemp(pin)
            .then(data => data / 10);
    }

    /**
     * Get water temperature on Digital A1.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {?Promise<number | string>} a Promise which resolves temperature [℃] or empty string if it was fail
     */
    getWaterTemperatureA (_args, util) {
        if (!this.isConnected()) return Promise.resolve('');
        let getter = Promise.resolve(this.waterTempA);
        if ((Date.now() - this.waterTempAUpdatedTime) > this.waterTempAUpdateIntervalTime) {
            if (this.waterTempAUpdating) {
                util.yield(); // re-try this call after a while.
                return; // Do not return Promise to re-try.
            }
            this.waterTempAUpdating = true;
            getter = getter
                .then(() => this.getWaterTemp(10, util)) // Digital A1: 10
                .then(waterTempA => {
                    this.waterTempA = waterTempA;
                    this.waterTempAUpdatedTime = Date.now();
                    return waterTempA;
                })
                .finally(() => {
                    this.waterTempAUpdating = false;
                });
        }
        return getter
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`getting water temperature A was rejected by ${reason}`);
                this.waterTempA = null;
                return '';
            });
    }

    /**
     * Get water temperature on Digital B1.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {?Promise<number | string>} a Promise which resolves temperature [℃] or empty string if it was fail
     */
    getWaterTemperatureB (_args, util) {
        if (!this.isConnected()) return Promise.resolve('');
        let getter = Promise.resolve(this.waterTempB);
        if ((Date.now() - this.waterTempBUpdatedTime) > this.waterTempBUpdateIntervalTime) {
            if (this.waterTempBUpdating) {
                util.yield(); // re-try this call after a while.
                return; // Do not return Promise to re-try.
            }
            this.waterTempBUpdating = true;
            getter = getter
                .then(() => this.getWaterTemp(6, util)) // Digital B1: 6;
                .then(waterTempB => {
                    this.waterTempB = waterTempB;
                    this.waterTempBUpdatedTime = Date.now();
                    return waterTempB;
                })
                .finally(() => {
                    this.waterTempBUpdating = false;
                });
        }
        return getter
            .catch(reason => {
                // eslint-disable-next-line no-console
                console.log(`getting water temperature A was rejected by ${reason}`);
                this.waterTempB = null;
                return '';
            });
    }

    /**
     * Return whether the accelerometer was shaken.
     * @param {object} _args - the block's arguments.
     * @param {BlockUtility} util - utility object provided by the runtime.
     * @returns {boolean} true when the accelerometer was shaken
     */
    whenShaken (_args, util) {
        if (!this.shakeEventUpdating) {
            const updater = this.getAccelerationAbsolute(null, util);
            if (updater) {
                if (((typeof this.prevAccAbsolute) !== 'undefined') && (this.prevAccAbsolute !== null)) {
                    this.shakeEventUpdating = true;
                    setTimeout(() => {
                        updater.then(currentAcc => {
                            if (currentAcc === '') {
                                this.shakeEventUpdating = false;
                                return;
                            }
                            this.shaken = ((currentAcc - this.prevAccAbsolute) > this.shakeEventThreshold);
                            this.prevAccAbsolute = currentAcc;
                            setTimeout(() => {
                                this.shakeEventUpdating = false;
                            }, this.runtime.currentStepTime);
                        })
                            .catch(reason => {
                                this.shakeEventUpdating = false;
                                // eslint-disable-next-line no-console
                                console.log(`promise rejected on whenShake: ${reason}`);
                                return;
                            });
                    }, this.shakeEventInterval);
                } else {
                    updater.then(currentAcc => {
                        if (currentAcc === '') {
                            return;
                        }
                        this.prevAccAbsolute = currentAcc;
                    });
                }
            }
        }
        return !!this.shaken;
    }

    /**
     * Return a number at the index [one-based] in the numeric array.
     * @param {object} args - the block's arguments.
     * @param {string} args.ARRAY - numeric array
     * @returns {string} a number at the index
     */
    numberAtIndex (args) {
        const array = readAsNumericArray(args.ARRAY);
        if (!array.length) return '';
        let index = Cast.toNumber(args.INDEX);
        index = Math.min(array.length, Math.max(1, index));
        index = Math.min(array.length, Math.max(1, index));
        index = Math.floor(index);
        return array[index - 1];
    }

    /**
     * Remove or replace numbers and/or add new numbers at the index in the numeric array.
     * @param {object} args - the block's arguments.
     * @param {string} args.ARRAY - numeric array
     * @param {string} args.INDEX - index to operate
     * @param {string} args.DELETE - count to be deleted
     * @param {string} args.INSERT - numeric array to be inserted
     * @returns {string} the modified numeric array
     */
    spliceNumbers (args) {
        const array = readAsNumericArray(args.ARRAY);
        let index = Cast.toNumber(args.INDEX);
        index = Math.floor(index);
        let deleteCount = Cast.toNumber(args.DELETE);
        deleteCount = Math.min(array.length, Math.max(0, deleteCount));
        deleteCount = Math.floor(deleteCount);
        const newNumbers = readAsNumericArray(args.INSERT);
        array.splice(((index > 0) ? index - 1 : index), deleteCount, ...newNumbers);
        return numericArrayToString(array);
    }

    /**
     * Return the length of the numeric array.
     * @param {object} args - the block's arguments.
     * @param {string} args.ARRAY - numeric array
     * @returns {number} length of the numeric array
     */
    lengthOfNumbers (args) {
        const array = readAsNumericArray(args.ARRAY);
        return array.length;
    }

    /**
     * Read numbers as the type and endian from the array of 8 bit data.
     * @param {object} args - the block's arguments.
     * @param {string} args.ARRAY - numeric array of 8 bit data
     * @param {string} args.ENDIAN - endian [little|big] of the number
     * @param {string} args.TYPE - type [Int16|Uint16] of the number
     * @returns {string} a numeric array of the converted numbers
     */
    readBytesAs (args) {
        try {
            const array = readAsNumericArray(args.ARRAY);
            const buffer = new Uint8Array(array).buffer;
            const dataView = new DataView(buffer);
            const little = (args.ENDIAN === 'little');
            const result = [];
            if (args.TYPE === 'Int16') {
                if (array.length < 2) return '';
                for (let index = 0; index < Math.floor(array.length / 2); index++) {
                    const element = dataView.getInt16(index * 2, little);
                    result[index] = element;
                }
                return numericArrayToString(result);
            }
            if (args.TYPE === 'Uint16') {
                if (array.length < 2) return '';
                for (let index = 0; index < Math.floor(array.length / 2); index++) {
                    const element = dataView.getUint16(index * 2, little);
                    result[index] = element;
                }
                return numericArrayToString(result);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log(error);
        }
        return '';
    }

    /**
     * Do the arithmetic operator with the arguments in 64 bit integer.
     * @param {object} args - the block's arguments.
     * @param {string} args.OP - operator
     * @param {string} args.LEFT - left side value
     * @param {string} args.RIGHT - right side value
     * @returns {string} result of this operation
     */
    int64Operation (args) {
        const op = args.OP;
        const left = integer64From(args.LEFT);
        const right = integer64From(args.RIGHT);
        if (op === '＋') {
            return left.add(right).toString(10);
        }
        if (op === '－') {
            return left.subtract(right).toString(10);
        }
        if (op === '✕') {
            return left.multiply(right).toString(10);
        }
        if (op === '÷') {
            return left.divide(right).toString(10);
        }
        if (op === 'mod') {
            return left.modulo(right).toString(10);
        }
    }

    /**
     * Do the bitwise operation with the arguments in 64 bit integer.
     * @param {object} args - the block's arguments.
     * @param {string} args.OP - operator
     * @param {string} args.LEFT - left side value
     * @param {string} args.RIGHT - right side value
     * @returns {string} result of this operation
     */
    bitOperation (args) {
        const op = args.OP;
        const left = integer64From(args.LEFT);
        const right = integer64From(args.RIGHT);
        if (op === '<<') {
            return left.shiftLeft(right).toString(10);
        }
        if (op === '>>') {
            return left.shiftRight(right).toString(10);
        }
        if (op === '&') {
            return left.and(right).toString(10);
        }
        if (op === '|') {
            return left.or(right).toString(10);
        }
        if (op === '^') {
            return left.xor(right).toString(10);
        }
    }

    /**
     * Returns the bitwise NOT in 64 bit integer.
     * @param {object} args - the block's arguments.
     * @param {string} args.VALUE - value to be operated
     * @returns {string} result of this operation
     */
    bitNot (args) {
        const bits = integer64From(args.VALUE);
        return bits.not().toString();
    }


    /**
     * 赤外線リモコンのコマンドを送信します。
     * 内部的にはアナログA1にデューティー比を送信しています。
     * @param {object} args - ブロックの引数。
     * @param {number} args.CONNECTOR - 赤外線リモコンの接続ポートを示す値。10=アナログA1、999=内蔵。
     * @param {number} args.N - コマンド番号。1から9の整数。
     * @param {...*} argsRest - additional arguments
     * @returns {Promise<void>}
     */
    async sendIrRemote (args, ...argsRest) {
        const n = Cast.toNumber(args.N);
        if (n < 1 || n > 9) {
            throw new Error(`Invalid button number: ${n}. Valid numbers are 1-9`);
        };
        // CONNECTORの値がメニューに存在しない場合はデフォルト(セレクターの最初の選択肢)の値を使用する
        const connectorInput = Cast.toNumber(args.CONNECTOR);
        const connectorValues = this.getIrRemoteMenuConnector().map(item => Cast.toNumber(item.value));
        const CONNECTOR = connectorValues.includes(connectorInput) ? connectorInput : connectorValues[0];
        // 「内蔵」を選択した場合は現在は何もしない
        if (CONNECTOR === 999) {
            await this.board.firmata.sysexCommand([0x03, n]);
            return;
        }
        // デューティー比5%未満でコマンド入力待機の状態となるので。初期化のために1を送る。続いてのデューティー比の変化でコマンドが決定される仕様です。
        // デューティー比の10の桁の数がコマンド番号になります。10%, 20%, 30%, 40%, 50%, 60%, 70%, 80%, 90% の9種類のコマンドが識別できることを確認しています。
        // 同一コネクタに対する analogLevelSet の呼び出し間隔は100ms以上にする必要がある。
        const MIN_INTERVAL = 100;
        await this.analogLevelSet({CONNECTOR, LEVEL: 1, MIN_INTERVAL}); // デューティー比5%未満でコマンド入力待機の状態となるので。初期化のために1を送る。
        await this.analogLevelSet({CONNECTOR, LEVEL: 10 * n, MIN_INTERVAL}); // ボタン1=10%, ボタン2=20%, ...
    }


    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        setupTranslations();
        return {
            id: ExtensionBlocks.EXTENSION_ID,
            name: ExtensionBlocks.EXTENSION_NAME,
            extensionURL: ExtensionBlocks.extensionURL,
            blockIconURI: blockIcon,
            showStatusButton: true,
            blocks: [
                {
                    opcode: 'connectBoard',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.connectBoard',
                        default: 'connect board',
                        description: 'open serial port and connect a board'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'boardStateChanged',
                    blockType: BlockType.HAT,
                    text: formatMessage({
                        id: 'g2s.boardStateChanged',
                        default: 'When board is [STATE]',
                        description: 'catch event when the board state was changed'
                    }),
                    arguments: {
                        STATE: {
                            type: ArgumentType.STRING,
                            menu: 'boardStateMenu'
                        }
                    }
                },
                {
                    opcode: 'disconnectBoard',
                    blockType: BlockType.COMMAND,
                    blockAllThreads: false,
                    text: formatMessage({
                        id: 'g2s.disconnectBoard',
                        default: 'disconnect board',
                        description: 'disconnect the board'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'isConnected',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'g2s.isConnected',
                        default: 'board is connected',
                        description: 'whether a board is connected'
                    }),
                    arguments: {
                    }
                },
                '---',
                {
                    opcode: 'servoTurn',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.servoTurn',
                        default: 'Servo [CONNECTOR] turn [ANGLE] degrees [SPEED] % speed',
                        description: 'turn servo motor'
                    }),
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.STRING,
                            menu: 'servoConnectorMenu'
                        },
                        ANGLE: {
                            type: ArgumentType.ANGLE
                        },
                        SPEED: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '100'
                        }
                    }
                },
                '---',
                {
                    opcode: 'measureDistanceWithUltrasonicA',
                    func: 'measureDistanceWithUltrasonicA',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.measureDistanceWithUltrasonicA',
                        default: 'distance by ultrasonic on Digital A (cm)',
                        description: 'report distance by ultrasonic on Digital A'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'measureDistanceWithUltrasonicB',
                    func: 'measureDistanceWithUltrasonicB',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.measureDistanceWithUltrasonicB',
                        default: 'distance by ultrasonic on Digital B (cm)',
                        description: 'report distance by ultrasonic on Digital B'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'measureDistanceWithLight',
                    func: 'measureDistanceWithLight',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.measureDistanceWithLight',
                        default: 'distance by laser on I2C (cm)',
                        description: 'report distance by light'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'motionSensorValue',
                    func: 'digitalLevelB2',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.motionSensorValue',
                        default: 'value of motion sensor on Tool',
                        description: 'report value of motion sensor on Tool'
                    }),
                    arguments: {
                    }
                },
                '---',
                {
                    opcode: 'getBrightness',
                    func: 'getBrightness',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getBrightness',
                        default: 'light I2C brightness (lx)',
                        description: 'report brightness'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'getAnalogBrightness',
                    func: 'analogLevelB2',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getAnalogBrightness',
                        default: 'light Analog brightness',
                        description: 'report brightness by analog sensor'
                    }),
                    arguments: {
                    }
                },
                '---',
                {
                    opcode: 'getTemperature',
                    func: 'getEvnTemperature',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getTemperature',
                        default: 'environment I2C temperature (°C)',
                        description: 'report temperature'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'getPressure',
                    func: 'getEvnPressure',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getPressure',
                        default: 'environment I2C pressure (hPa)',
                        description: 'report pressure'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'getHumidity',
                    func: 'getEnvHumidity',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getHumidity',
                        default: 'environment I2C humidity (%)',
                        description: 'report humidity'
                    }),
                    arguments: {
                    }
                },
                '---',
                {
                    opcode: 'getWaterTemperatureA',
                    func: 'getWaterTemperatureA',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getWaterTemperatureA',
                        default: 'water temperature on Digital A (°C)',
                        description: 'report water temperature on Digital A'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'getWaterTemperatureB',
                    func: 'getWaterTemperatureB',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getWaterTemperatureB',
                        default: 'water temperature on Digital B (°C)',
                        description: 'report water temperature on Digital B'
                    }),
                    arguments: {
                    }
                },
                '---',
                {
                    opcode: 'whenShaken',
                    blockType: BlockType.HAT,
                    text: formatMessage({
                        id: 'g2s.whenShaken',
                        default: 'When acceleration I2C was shaken',
                        description: 'catch event when the accelerometer was shaken'
                    }),
                    arguments: {
                    }
                },
                '---',
                {
                    opcode: 'getPitch',
                    func: 'getPitch',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getPitch',
                        default: 'acceleration I2C pitch (degree)',
                        description: 'report pitch angle'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'getRoll',
                    func: 'getRoll',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getRoll',
                        default: 'acceleration I2C roll (degree)',
                        description: 'report roll angle'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'getAccelerationX',
                    func: 'getAccelerationX',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getAccelerationX',
                        default: 'acceleration I2C X (m/s^2)',
                        description: 'report acceleration X'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'getAccelerationY',
                    func: 'getAccelerationY',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getAccelerationY',
                        default: 'acceleration I2C Y (m/s^2)',
                        description: 'report acceleration Y'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'getAccelerationZ',
                    func: 'getAccelerationZ',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getAccelerationZ',
                        default: 'acceleration I2C Z (m/s^2)',
                        description: 'report acceleration Z'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'getAccelerationAbsolute',
                    func: 'getAccelerationAbsolute',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.getAccelerationAbsolute',
                        default: 'acceleration I2C Absolute (m/s^2)',
                        description: 'report acceleration absolute'
                    }),
                    arguments: {
                    }
                },
                '---',
                {
                    opcode: 'neoPixelConfigStrip',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.neoPixelConfigStrip',
                        default: 'set color LED [CONNECTOR] length [LENGTH]',
                        description: 'configure color LED on the connector'
                    }),
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.STRING,
                            menu: 'neoPixelConnectorMenu'
                        },
                        LENGTH: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '3'
                        }
                    }
                },
                {
                    opcode: 'neoPixelSetColor',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.neoPixelSetColor',
                        default: 'color LED [CONNECTOR] set [POSITION] color [COLOR] brightness [BRIGHTNESS]',
                        description: 'set color LED color'
                    }),
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.STRING,
                            menu: 'neoPixelConnectorMenu'
                        },
                        POSITION: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1'
                        },
                        COLOR: {
                            type: ArgumentType.STRING,
                            menu: 'neoPixelColorMenuSimple'
                        },
                        BRIGHTNESS: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '50'
                        }
                    }
                },
                {
                    opcode: 'neoPixelFillColor',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.neoPixelFillColor',
                        default: 'color LED [CONNECTOR] set all color [COLOR] brightness [BRIGHTNESS]',
                        description: 'set color LED color'
                    }),
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.STRING,
                            menu: 'neoPixelConnectorMenu'
                        },
                        COLOR: {
                            type: ArgumentType.STRING,
                            menu: 'neoPixelColorMenu'
                        },
                        BRIGHTNESS: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '50'
                        }
                    }
                },
                {
                    opcode: 'neoPixelShiftColor',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.neoPixelShiftColor',
                        default: 'color LED [CONNECTOR] shift color settings by [N] ([LOOP_MODE])',
                        description: 'shift color LED settings'
                    }),
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.STRING,
                            menu: 'neoPixelConnectorMenu'
                        },
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1'
                        },
                        LOOP_MODE: {
                            type: ArgumentType.STRING,
                            defaultValue: 'true',
                            menu: 'neoPixelShiftColorLoopModeMenu'
                        }
                    }
                },
                {
                    opcode: 'neoPixelColor',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'g2s.neoPixelColor',
                        default: 'color LED color R [RED] G [GREEN] B [BLUE]',
                        description: 'color LED color values'
                    }),
                    arguments: {
                        RED: {
                            type: ArgumentType.STRING,
                            defaultValue: '255'
                        },
                        GREEN: {
                            type: ArgumentType.STRING,
                            defaultValue: '255'
                        },
                        BLUE: {
                            type: ArgumentType.STRING,
                            defaultValue: '255'
                        }
                    }
                },
                {
                    opcode: 'neoPixelColorMode',
                    blockType: BlockType.REPORTER,
                    hideFromPalette: true, // 拡張のブロック一覧に表示しない
                    text: formatMessage({
                        id: 'g2s.neoPixelColorMode',
                        default: 'color LED [MODE]',
                        description: 'color LED color mode'
                    }),
                    arguments: {
                        MODE: {
                            type: ArgumentType.STRING,
                            menu: 'neoPixelColorModeMenu'
                        }
                    }
                },
                {
                    opcode: 'neoPixelShow',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.neoPixelShow',
                        default: 'color LED show',
                        description: 'show color LED'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'neoPixelClear',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.neoPixelClear',
                        default: 'color LED [CONNECTOR] clear',
                        description: 'clear color LED'
                    }),
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.STRING,
                            menu: 'neoPixelConnectorMenu'
                        }
                    }
                },
                '---',
                {
                    opcode: 'analogLevelA1',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.analogLevelA1',
                        default: 'value of AnalogA(A1)',
                        description: 'report analog level of the connector'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'analogLevelA2',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.analogLevelA2',
                        default: 'value of AnalogA(A2)',
                        description: 'report analog level of the connector'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'analogLevelB1',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.analogLevelB1',
                        default: 'value of AnalogB(B1)',
                        description: 'report analog level of the connector'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'analogLevelB2',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.analogLevelB2',
                        default: 'value of AnalogB(B2)',
                        description: 'report analog level of the connector'
                    }),
                    arguments: {
                    }
                },
                '---',
                {
                    opcode: 'digitalLevelA1',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.digitalLevelA1',
                        default: 'value of DigitalA(A1)',
                        description: 'report digital level of the connector'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'digitalLevelA2',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.digitalLevelA2',
                        default: 'value of DigitalA(A2)',
                        description: 'report digital level of the connector'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'digitalLevelB1',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.digitalLevelB1',
                        default: 'value of DigitalB(B1)',
                        description: 'report digital level of the connector'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'digitalLevelB2',
                    blockType: BlockType.REPORTER,
                    disableMonitor: false,
                    text: formatMessage({
                        id: 'g2s.digitalLevelB2',
                        default: 'value of DigitalB(B2)',
                        description: 'report digital level of the connector'
                    }),
                    arguments: {
                    }
                },
                '---',
                {
                    opcode: 'digitalLevelSet',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.digitalLevelSet',
                        default: '[CONNECTOR] to digital [LEVEL]',
                        description: 'set digital level of the connector'
                    }),
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.STRING,
                            menu: 'digitalLevelSetConnectorMenu'
                        },
                        LEVEL: {
                            type: ArgumentType.STRING,
                            menu: 'digitalLevelMenu',
                            defaultValue: 'true'
                        }
                    }
                },
                {
                    opcode: 'digitalIsHigh',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'g2s.digitalIsHigh',
                        default: '[CONNECTOR] value is 1',
                        description: 'whether the digital level of the connector is high or not'
                    }),
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.STRING,
                            menu: 'digitalConnectorMenu'
                        }
                    }
                },
                {
                    opcode: 'digitalLevelChanged',
                    blockType: BlockType.HAT,
                    text: formatMessage({
                        id: 'g2s.digitalLevelChanged',
                        default: 'When [CONNECTOR] is [LEVEL]',
                        description: 'catch pulse rise/fall of the connector'
                    }),
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.STRING,
                            menu: 'digitalConnectorMenu'
                        },
                        LEVEL: {
                            type: ArgumentType.STRING,
                            menu: 'digitalLevelMenu',
                            defaultValue: 'true'
                        }
                    }
                },
                {
                    opcode: 'inputBiasSet',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.inputBiasSet',
                        default: '[PIN] bias [BIAS]',
                        description: 'set bias of the connector for g2s'
                    }),
                    arguments: {
                        PIN: {
                            type: ArgumentType.STRING,
                            menu: 'inputPinsMenu'
                        },
                        BIAS: {
                            type: ArgumentType.STRING,
                            menu: 'inputBiasMenu'
                        }
                    }
                },
                '---',
                {
                    opcode: 'analogLevelSet',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.analogLevelSet',
                        default: 'PWM [CONNECTOR] set duty cycle [LEVEL] %',
                        description: 'set analog level of the connector'
                    }),
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.STRING,
                            menu: 'pwmConnectorMenu'
                        },
                        LEVEL: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }
                    }
                },
                '---',
                {
                    opcode: 'sendIrRemote',
                    text: formatMessage({
                        id: 'g2s.sendIrRemote',
                        default: 'Send built-in button [N]',
                        description: 'Execute the built-in button of IR remote control'
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        CONNECTOR: {
                            type: ArgumentType.NUMBER,
                            menu: 'irRemoteMenuConnector',
                        },
                        N: {
                            type: ArgumentType.NUMBER,
                            menu: 'irRemoteMenuN',
                            defaultValue: 1
                        }
                    }
                },
                '---',
                {
                    opcode: 'i2cWrite',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'g2s.i2cWrite',
                        default: 'I2C write on [ADDRESS] register [REGISTER] with [DATA]',
                        description: 'write I2C data to the connector'
                    }),
                    arguments: {
                        ADDRESS: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x00'
                        },
                        REGISTER: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x00'
                        },
                        DATA: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x00, 0x00'
                        }
                    }
                },
                {
                    opcode: 'i2cReadOnce',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'g2s.i2cReadOnce',
                        default: 'I2C read [LENGTH] bytes from [ADDRESS] register [REGISTER]',
                        description: 'read I2C data from the connector'
                    }),
                    arguments: {
                        ADDRESS: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x00'
                        },
                        REGISTER: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x00'
                        },
                        LENGTH: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                // // comment out for future reference
                // '---',
                // {
                //     opcode: 'oneWireReset',
                //     blockType: BlockType.COMMAND,
                //     text: formatMessage({
                //         id: 'g2s.oneWireReset',
                //         default: 'reset OneWire [CONNECTOR]',
                //         description: 'Reset OneWire on the connector'
                //     }),
                //     arguments: {
                //         CONNECTOR: {
                //             type: ArgumentType.STRING,
                //             menu: 'digitalConnectorMenu'
                //         }
                //     }
                // },
                // {
                //     opcode: 'oneWireWrite',
                //     blockType: BlockType.COMMAND,
                //     text: formatMessage({
                //         id: 'g2s.oneWireWrite',
                //         default: 'OneWire [CONNECTOR] write [DATA]',
                //         description: 'write OneWire data to the connector'
                //     }),
                //     arguments: {
                //         CONNECTOR: {
                //             type: ArgumentType.STRING,
                //             menu: 'digitalConnectorMenu'
                //         },
                //         DATA: {
                //             type: ArgumentType.STRING,
                //             defaultValue: '0x00, 0x00'
                //         }
                //     }
                // },
                // {
                //     opcode: 'oneWireRead',
                //     blockType: BlockType.REPORTER,
                //     text: formatMessage({
                //         id: 'g2s.oneWireRead',
                //         default: 'OneWire [CONNECTOR] read [LENGTH] bytes',
                //         description: 'read OneWire data from the device on the connector'
                //     }),
                //     arguments: {
                //         CONNECTOR: {
                //             type: ArgumentType.STRING,
                //             menu: 'digitalConnectorMenu'
                //         },
                //         LENGTH: {
                //             type: ArgumentType.NUMBER,
                //             defaultValue: 1
                //         }
                //     }
                // },
                // {
                //     opcode: 'oneWireWriteAndRead',
                //     blockType: BlockType.REPORTER,
                //     text: formatMessage({
                //         id: 'g2s.oneWireWriteAndRead',
                //         default: 'OneWire [CONNECTOR] write [DATA] then read [LENGTH] bytes',
                //         description: 'write OneWire data then read at the device on the connector'
                //     }),
                //     arguments: {
                //         CONNECTOR: {
                //             type: ArgumentType.STRING,
                //             menu: 'digitalConnectorMenu'
                //         },
                //         DATA: {
                //             type: ArgumentType.STRING,
                //             defaultValue: '0x00, 0x00'
                //         },
                //         LENGTH: {
                //             type: ArgumentType.NUMBER,
                //             defaultValue: 1
                //         }
                //     }
                // },
                '---',
                {
                    opcode: 'numberAtIndex',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'g2s.numberAtIndex',
                        default: 'number of [ARRAY] at [INDEX]',
                        description: 'get a number at the index of the array'
                    }),
                    arguments: {
                        ARRAY: {
                            type: ArgumentType.STRING,
                            defaultValue: '1.0, 1E1, 0xFF'
                        },
                        INDEX: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1'
                        }
                    }
                },
                {
                    opcode: 'spliceNumbers',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'g2s.spliceNumbers',
                        default: '[ARRAY] at [INDEX] delete [DELETE] insert [INSERT]',
                        description: 'splice array'
                    }),
                    arguments: {
                        ARRAY: {
                            type: ArgumentType.STRING,
                            defaultValue: '1.0, 1E1, 0xFF'
                        },
                        INDEX: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1'
                        },
                        DELETE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: '1'
                        },
                        INSERT: {
                            type: ArgumentType.STRING,
                            defaultValue: '-1, 0'
                        }
                    }
                },
                {
                    opcode: 'lengthOfNumbers',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'g2s.lengthOfNumbers',
                        default: 'length of numbers [ARRAY]',
                        description: 'get length of an Array in string'
                    }),
                    arguments: {
                        ARRAY: {
                            type: ArgumentType.STRING,
                            defaultValue: '1.0, 1E1, 0xFF'
                        }
                    }
                },
                {
                    opcode: 'readBytesAs',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'g2s.readBytesAs',
                        default: 'read bytes [ARRAY] as [TYPE] [ENDIAN]',
                        description: 'read typed value from bytes'
                    }),
                    arguments: {
                        ARRAY: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x00, 0xFF, 0xFF, 0x00'
                        },
                        TYPE: {
                            type: ArgumentType.STRING,
                            menu: 'bytesTypeMenu'
                        },
                        ENDIAN: {
                            type: ArgumentType.STRING,
                            menu: 'endianMenu'
                        }
                    }
                },
                {
                    opcode: 'int64Operation',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'g2s.int64Operation',
                        default: 'int64 [LEFT] [OP] [RIGHT]',
                        description: 'bitwise operation'
                    }),
                    arguments: {
                        OP: {
                            type: ArgumentType.STRING,
                            menu: 'int64OperationMenu'
                        },
                        LEFT: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x01'
                        },
                        RIGHT: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x02'
                        }
                    }
                },
                {
                    opcode: 'bitOperation',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'g2s.bitOperation',
                        default: 'bit [LEFT] [OP] [RIGHT]',
                        description: 'bitwise operation'
                    }),
                    arguments: {
                        OP: {
                            type: ArgumentType.STRING,
                            menu: 'bitOperationMenu'
                        },
                        LEFT: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x03'
                        },
                        RIGHT: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x01'
                        }
                    }
                },
                {
                    opcode: 'bitNot',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'g2s.bitNot',
                        default: 'bit NOT [VALUE]',
                        description: 'bitwise NOT'
                    }),
                    arguments: {
                        VALUE: {
                            type: ArgumentType.STRING,
                            defaultValue: '0x01'
                        }
                    }
                },
                {
                    opcode: 'boardVersion',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'g2s.boardVersion',
                        default: 'board version',
                        description: 'version of the board'
                    }),
                    arguments: {
                    }
                }
            ],
            menus: {
                boardStateMenu: {
                    acceptReporters: false,
                    items: this.getBoardStateMenu()
                },
                digitalConnectorMenu: {
                    acceptReporters: false,
                    items: this.getDigitalConnectorMenu()
                },
                digitalLevelSetConnectorMenu: {
                    acceptReporters: false,
                    items: this.getDigitalLevelSetConnectorMenu()
                },
                inputBiasMenu: {
                    acceptReporters: false,
                    items: this.getInputBiasMenu()
                },
                digitalLevelMenu: {
                    acceptReporters: true,
                    items: this.getDigitalLevelMenu()
                },
                inputPinsMenu: {
                    acceptReporters: false,
                    items: this.getInputPinsMenu()
                },
                pwmConnectorMenu: {
                    acceptReporters: false,
                    items: this.getPWMConnectorMenu()
                },
                servoConnectorMenu: {
                    acceptReporters: false,
                    items: this.getServoConnectorMenu()
                },
                neoPixelConnectorMenu: {
                    acceptReporters: false,
                    items: this.getNeoPixelConnectorMenu()
                },
                neoPixelShiftColorLoopModeMenu: {
                    acceptReporters: true,
                    items: this.getNeoPixelShiftColorLoopModeMenu()
                },
                neoPixelColorMenuSimple: {
                    acceptReporters: true,
                    items: this.getNeoPixelColorMenu().filter(item => item.value !== 'rainbow')
                },
                neoPixelColorMenu: {
                    acceptReporters: true,
                    items: this.getNeoPixelColorMenu()
                },
                neoPixelColorModeMenu: {
                    acceptReporters: true,
                    items: this.getNeoPixelColorModeMenu()
                },
                bytesTypeMenu: {
                    acceptReporters: false,
                    items: ['Int16', 'Uint16']
                },
                endianMenu: {
                    acceptReporters: false,
                    items: ['little', 'big']
                },
                int64OperationMenu: {
                    acceptReporters: false,
                    items: ['＋', '－', '✕', '÷', 'mod']
                },
                bitOperationMenu: {
                    acceptReporters: false,
                    items: ['<<', '>>', '&', '|', '^']
                },
                irRemoteMenuConnector: {
                    acceptReporters: false,
                    items: this.getIrRemoteMenuConnector()
                },
                irRemoteMenuN: {
                    acceptReporters: true,
                    items: ['1', '2', '3', '4', '5', '6', '7', '8', '9']
                },
            }
        };
    }

    /**
     * Returns menu items for board state.
     * @returns {Array<object>} menu items
     */
    getBoardStateMenu () {
        return [
            {
                text: formatMessage({
                    id: 'g2s.boardState.connected',
                    default: 'connected'
                }),
                value: 'connected'
            },
            {
                text: formatMessage({
                    id: 'g2s.boardState.disconnected',
                    default: 'disconnected'
                }),
                value: 'disconnected'
            }
        ];
    }

    /**
     * Returns menu items to select digital connectors.
     * @returns {Array<object>} menu items
     */
    getDigitalConnectorMenu () {
        const digitalPrefix = formatMessage({
            id: 'g2s.digitalConnector.prefix',
            default: 'Digital'
        });
        return [
            {
                text: `${digitalPrefix}A (A1)`,
                value: '10'
            },
            {
                text: `${digitalPrefix}A (A2)`,
                value: '11'
            },
            {
                text: `${digitalPrefix}B (B1)`,
                value: '6'
            },
            {
                text: `${digitalPrefix}B (B2)`,
                value: '9'
            },
            {
                text: formatMessage({
                    id: 'g2s.digitalConnectorMenu.buttonAOnTool',
                    default: 'button A on Tool',
                    description: 'label for button A on Tool in digital level get connector menu for g2s'
                }),
                value: 'A'
            },
            {
                text: formatMessage({
                    id: 'g2s.digitalConnectorMenu.buttonBOnTool',
                    default: 'button B on Tool',
                    description: 'label for button B on Tool in digital level get connector menu for g2s'
                }),
                value: 'B'
            },
            {
                text: formatMessage({
                    id: 'g2s.digitalConnectorMenu.motionSensorOnTool',
                    default: 'PIR Motion sensor on Tool',
                    description: 'label for motion sensor on board in digital connector menu for g2s'
                }),
                value: 'PIR'
            }
        ];
    }

    /**
     * Returns menu items to select digital connectors.
     * @returns {Array<object>} menu items
     */
    getDigitalLevelSetConnectorMenu () {
        const digitalPrefix = formatMessage({
            id: 'g2s.digitalConnector.prefix',
            default: 'Digital'
        });
        return [
            {
                text: `${digitalPrefix}A (A1)`,
                value: '10'
            },
            {
                text: `${digitalPrefix}A (A2)`,
                value: '11'
            },
            {
                text: `${digitalPrefix}B (B1)`,
                value: '6'
            },
            {
                text: `${digitalPrefix}B (B2)`,
                value: '9'
            },
            {
                text: formatMessage({
                    id: 'g2s.digitalLevelSetConnectorMenu.relayOnSteamBox',
                    default: 'relay on Tool',
                    description: 'label for relay on STEAM Tool in digital level set connector menu for g2s'
                }),
                value: '4'
            }
        ];
    }

    /**
     * Returns menu items to select PWM connectors.
     * @returns {Array<object>} menu items
     */
    getPWMConnectorMenu () {
        const digitalPrefix = formatMessage({
            id: 'g2s.digitalConnector.prefix',
            default: 'Digital'
        });
        return [
            {
                text: `${digitalPrefix}A (A1)`,
                value: '10'
            },
            {
                text: `${digitalPrefix}A (A2)`,
                value: '11'
            },
            {
                text: `${digitalPrefix}B (B1)`,
                value: '6'
            },
            {
                text: `${digitalPrefix}B (B2)`,
                value: '9'
            },
            {
                text: formatMessage({
                    id: 'g2s.pwmConnectorMenu.vibrationMotorOnSteamBox',
                    default: 'vibration motor on Tool',
                    description: 'label for vibration motor on STEAM Tool in PWM connector menu for g2s'
                }),
                value: '3'
            },
			{
                text: formatMessage({
                    id: 'g2s.digitalLevelSetConnectorMenu.relayOnSteamBox',
                    default: 'relay on Tool',
                    description: 'label for relay on STEAM Tool in digital level set connector menu for g2s'
                }),
                value: '4'
            }
        ];
    }

    getIrRemoteMenuConnector () {
        const digitalPrefix = formatMessage({
            id: 'g2s.digitalConnector.prefix',
            default: 'Digital'
        });
        const onboard = formatMessage({
            id: 'g2s.sendIrRemote.CONNECTOR.onboard',
            default: 'on board'
        });
        return [
            {
                text: `${digitalPrefix}A (A1)`,
                value: '10'
            },
            {
                text: onboard,
                value: '999'
            }
        ];
    }

    /**
     * Returns menu items to select servo connectors.
     * @returns {Array<object>} menu items
     */
    getServoConnectorMenu () {
        const digitalPrefix = formatMessage({
            id: 'g2s.digitalConnector.prefix',
            default: 'Digital'
        });
        return [
            {
                text: `${digitalPrefix}A (A1)`,
                value: '10'
            },
            {
                text: `${digitalPrefix}A (A2)`,
                value: '11'
            },
            {
                text: `${digitalPrefix}B (B1)`,
                value: '6'
            },
            {
                text: `${digitalPrefix}B (B2)`,
                value: '9'
            }
        ];
    }

    /**
     * Returns menu items to set digital level.
     * @returns {Array<object>} menu items
     */
    getDigitalLevelMenu () {
        return [
            {
                text: formatMessage({
                    id: 'g2s.digitalLevelMenu.low',
                    default: '0',
                    description: 'label for low value in digital output menu for g2s'
                }),
                value: 'false'
            },
            {
                text: formatMessage({
                    id: 'g2s.digitalLevelMenu.high',
                    default: '1',
                    description: 'label for high value in digital output menu for g2s'
                }),
                value: 'true'
            }
        ];
    }

    /**
     * Returns menu items to select digital input pin.
     * @returns {Array<object>} menu items
     */
    getInputPinsMenu () {
        const digitalPrefix = formatMessage({
            id: 'g2s.digitalConnector.prefix',
            default: 'Digital'
        });
        return [
            {
                text: `${digitalPrefix}A (A1)`,
                value: '10'
            },
            {
                text: `${digitalPrefix}A (A2)`,
                value: '11'
            },
            {
                text: `${digitalPrefix}B (B1)`,
                value: '6'
            },
            {
                text: `${digitalPrefix}B (B2)`,
                value: '9'
            }
        ];
    }

    /**
     * Returns menu items to set input bias.
     * @returns {Array<object>} menu items
     */
    getInputBiasMenu () {
        return [
            {
                text: formatMessage({
                    id: 'g2s.inputBiasMenu.none',
                    default: 'none',
                    description: 'label for none in input bias menu for g2s'
                }),
                value: 'none'
            },
            {
                text: formatMessage({
                    id: 'g2s.inputBiasMenu.pullUp',
                    default: 'pull up',
                    description: 'label for pull up in input bias menu for g2s'
                }),
                value: 'pullUp'
            }
        ];
    }

    getNeoPixelConnectorMenu () {
        const digitalPrefix = formatMessage({
            id: 'g2s.digitalConnector.prefix',
            default: 'Digital'
        });
        return [
            {
                text: `${digitalPrefix}A (A1)`,
                value: '10'
            },
            {
                text: `${digitalPrefix}A (A2)`,
                value: '11'
            },
            {
                text: `${digitalPrefix}B (B1)`,
                value: '6'
            },
            {
                text: `${digitalPrefix}B (B2)`,
                value: '9'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelConnectorMenu.steamBox',
                    default: 'Tool',
                    description: 'label for STEAM Tool in neoPixel connector menu for g2s'
                }),
                value: '7'
            }
        ];
    }


    getNeoPixelShiftColorLoopModeMenu () {
        return [
            {
                text: formatMessage({
                    id: 'g2s.neoPixelShiftColor.LOOP_MODE.ENABLE_LOOP',
                    default: 'loop',
                }),
                value: 'true',
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelShiftColor.LOOP_MODE.DISABLE_LOOP',
                    default: 'no loop',
                }),
                value: 'false',
            }
        ];
    }

    getNeoPixelColorMenu () {
        return [
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.red',
                    default: 'red'
                }),
                value: '0xff, 0, 0'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.orange',
                    default: 'orange'
                }),
                value: '0xff, 0xa5, 0'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.yellow',
                    default: 'yellow'
                }),
                value: '0xff, 0xff, 0'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.green',
                    default: 'green'
                }),
                value: '0, 0xff, 0'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.blue',
                    default: 'blue'
                }),
                value: '0, 0, 0xff'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.indigo',
                    default: 'indigo'
                }),
                value: '0x4b, 0, 0x82'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.violet',
                    default: 'violet'
                }),
                value: '0xee, 0x82, 0xee'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.purple',
                    default: 'purple'
                }),
                value: '0x80, 0, 0x80'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.white',
                    default: 'white'
                }),
                value: '0xff, 0xff, 0xff'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.black',
                    default: 'black'
                }),
                value: '0, 0, 0'
            },
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMenu.rainbow',
                    default: 'rainbow'
                }),
                value: 'rainbow'
            }
        ];
    }

    getNeoPixelColorModeMenu () {
        return [
            {
                text: formatMessage({
                    id: 'g2s.neoPixelColorMode.rainbow',
                    default: 'rainbow'
                }),
                value: 'rainbow'
            }
        ];
    }
}


export {
    ExtensionBlocks as default,
    ExtensionBlocks as blockClass
};
