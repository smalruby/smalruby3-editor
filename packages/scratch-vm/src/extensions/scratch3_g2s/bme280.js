/**
 * BME280 API
 * humidity, pressure and temperature sensor
 * This code refer to
 * https://github.com/Seeed-Studio/Grove_BME280
 * https://github.com/adafruit/Adafruit_BME280_Library
 */

import Long from 'long';

/**
 * default I2C address
 * @enum {number}
 */
const BME280_ADDRESS = 0x76; // Primary I2C Address for Seeed Grove module

const CHIP_ID_BMP280 = 0x58;
const CHIP_ID_BME280 = 0x60;

// registers


const BME280_REG_DIG_T1 = 0x88;
const BME280_REG_DIG_T2 = 0x8A;
const BME280_REG_DIG_T3 = 0x8C;

const BME280_REG_DIG_P1 = 0x8E;
const BME280_REG_DIG_P2 = 0x90;
const BME280_REG_DIG_P3 = 0x92;
const BME280_REG_DIG_P4 = 0x94;
const BME280_REG_DIG_P5 = 0x96;
const BME280_REG_DIG_P6 = 0x98;
const BME280_REG_DIG_P7 = 0x9A;
const BME280_REG_DIG_P8 = 0x9C;
const BME280_REG_DIG_P9 = 0x9E;

const BME280_REG_DIG_H1 = 0xA1;
const BME280_REG_DIG_H2 = 0xE1;
const BME280_REG_DIG_H3 = 0xE3;
const BME280_REG_DIG_H4 = 0xE4;
const BME280_REG_DIG_H5 = 0xE5;
const BME280_REG_DIG_H6 = 0xE7;

const BME280_REG_CHIP_ID = 0xD0;
// const BME280_REG_VERSION = 0xD1;
// const BME280_REG_SOFTRESET = 0xE0;

// const BME280_REG_CAL26 = 0xE1;

const BME280_REG_CONTROLHUMID = 0xF2;
const BME280_REG_CONTROL = 0xF4;
const BME280_REG_CONFIG = 0xF5;
const BME280_REG_PRESSUREDATA = 0xF7;
const BME280_REG_TEMPDATA = 0xFA;
const BME280_REG_HUMIDITYDATA = 0xFD;

/**
 * This class is representing a ADXL345.
 */
export default class BME280 {
    /**
     * Constructor of BME280 instance.
     * @param {AkaDakoBoard} board - connecting AkaDako board
     */
    constructor (board) {

        /**
         * Connecting AkaDako board
         * @type {import('./akadako-board').default}
         */
        this.board = board;

        /**
         * I2C address
         * @type {number}
         */
        this.address = BME280_ADDRESS;

        /**
         * Timeout for readings in milliseconds.
         * @type {number}
         */
        this.timeout = 2000;

        /**
         * temperature with high resolution,
         * This is stored as an attribute to used for humidity and pressure
         * @type {number}
         */
        this.tFine = 0;

        /**
         * The time [millisecond] when the temperature was updated.
         * @type {number}
         */
        this.tUpdatedTime = 0;

        /**
         * Interval time [millisecond] for temperature updating.
         * @type {number}
         */
        this.tUpdateIntervalTime = 1000;
    }

    /**
     * Read an 8-bit from the register.
     * @param {number} register - register to read
     * @returns {Promise<number>} a Promise which resolves read value
     */
    read8 (register) {
        return this.board.i2cReadOnce(this.address, register, 1, this.timeout)
            .then(data => data[0]);
    }

    /**
     * Read a Uint16 as big endian from the register.
     * @param {number} register - starting register
     * @returns {Promise<number>} a Promise which resolves read value
     */
    readUint16BE (register) {
        return this.board.i2cReadOnce(this.address, register, 2, this.timeout)
            .then(data => {
                const dataView = new DataView(new Uint8Array(data).buffer);
                const value = dataView.getUint16(0, false);
                return value;
            });
    }

    /**
     * Read a Uint16 as little endian from the register.
     * @param {number} register - starting register
     * @returns {Promise<number>} a Promise which resolves read value
     */
    readUint16LE (register) {
        return this.board.i2cReadOnce(this.address, register, 2, this.timeout)
            .then(data => {
                const dataView = new DataView(new Uint8Array(data).buffer);
                const value = dataView.getUint16(0, true);
                return value;
            });
    }

    /**
     * Read a Int16 as little endian from the register.
     * @param {number} register - starting register
     * @returns {Promise<number>} a Promise which resolves read value
     */
    readInt16LE (register) {
        return this.board.i2cReadOnce(this.address, register, 2, this.timeout)
            .then(data => {
                const dataView = new DataView(new Uint8Array(data).buffer);
                const value = dataView.getInt16(0, true);
                return value;
            });
    }

    /**
     * Read value in 24-bit from the register.
     * @param {number} register - starting register
     * @returns {Promise<number>} a Promise which resolves read value
     */
    read24 (register) {
        return this.board.i2cReadOnce(this.address, register, 3, this.timeout)
            .then(data => (data[0] << 16) | (data[1] << 8) | data[0]);
    }

    /**
     * Write an 8-bit at the register.
     * @param {number} register - register to write
     * @param {number} value - written 8-bit value
     * @returns {Promise} a Promise which resolves when wrote
     */
    write8 (register, value) {
        return this.board.i2cWrite(this.address, register, value);
    }

    /**
     * Initialize the sensor
     * @returns {Promise} a Promise which resolves when the sensor was initialized
     */
    async init () {
        const chipID = await this.read8(BME280_REG_CHIP_ID);
        if ((chipID !== CHIP_ID_BME280) && (chipID !== CHIP_ID_BMP280)) {
            return Promise.reject(new Error(
                `I2C 0x${BME280_ADDRESS.toString(16)} (chip ID 0x${chipID.toString(16)}) ` +
                `is not a BME280 or BMP280`));
        }

        this.dig_T1 = await this.readUint16LE(BME280_REG_DIG_T1, true);
        this.dig_T2 = await this.readInt16LE(BME280_REG_DIG_T2, true);
        this.dig_T3 = await this.readInt16LE(BME280_REG_DIG_T3, true);

        this.dig_P1 = await this.readUint16LE(BME280_REG_DIG_P1, true);
        this.dig_P2 = await this.readInt16LE(BME280_REG_DIG_P2, true);
        this.dig_P3 = await this.readInt16LE(BME280_REG_DIG_P3, true);
        this.dig_P4 = await this.readInt16LE(BME280_REG_DIG_P4, true);
        this.dig_P5 = await this.readInt16LE(BME280_REG_DIG_P5, true);
        this.dig_P6 = await this.readInt16LE(BME280_REG_DIG_P6, true);
        this.dig_P7 = await this.readInt16LE(BME280_REG_DIG_P7, true);
        this.dig_P8 = await this.readInt16LE(BME280_REG_DIG_P8, true);
        this.dig_P9 = await this.readInt16LE(BME280_REG_DIG_P9, true);

        this.dig_H1 = await this.read8(BME280_REG_DIG_H1);
        this.dig_H2 = await this.readUint16LE(BME280_REG_DIG_H2, true);
        this.dig_H3 = await this.read8(BME280_REG_DIG_H3);
        this.dig_H4 = (await this.read8(BME280_REG_DIG_H4) << 4) | (0x0F & await this.read8(BME280_REG_DIG_H4 + 1));
        this.dig_H5 = (await this.read8(BME280_REG_DIG_H5 + 1) << 4) |
            (0x0F & (await this.read8(BME280_REG_DIG_H5) >> 4));
        this.dig_H6 = await this.read8(BME280_REG_DIG_H6);

        await this.write8(BME280_REG_CONTROLHUMID, 0x01); // humidity-oversampling:x1
        await this.write8(BME280_REG_CONTROL, 0x4F); // temperature-oversampling:x2, pressure-oversampling:x8
        await this.write8(BME280_REG_CONFIG, 0x40); // standby-duration:125ms
    }

    /**
     * Read temperature from the sensor
     * @returns {Promise<number>} a Promise which resolves temperature [degree]
     */
    async readTemperature () {
        if ((Date.now() - this.tUpdatedTime) > this.tUpdateIntervalTime) {
            // update temperature
            let adc = await this.read24(BME280_REG_TEMPDATA);
            if (adc === 0x800000) {
            // value in case temperature measurement was disabled
                return 0;
            }
            adc >>= 4;
            const var1 = (((adc / 8) - (this.dig_T1 * 2)) * this.dig_T2) / 2048;
            const var2 = (adc / 16) - this.dig_T1;
            const var3 = (((var2 * var2) / 4096) * (this.dig_T3)) / 16384;

            this.tFine = var1 + var3;
            this.tUpdatedTime = Date.now();
        }
        const temp = ((this.tFine * 5) + 128) / 256;
        return temp / 100;
    }


    /**
     * Read pressure from the sensor
     * @returns {Promise<number>} a Promise which resolves pressure [Pa]
     */
    async readPressure () {
        await this.readTemperature();
        let adc = await this.read24(BME280_REG_PRESSUREDATA);
        if (adc === 0x800000) {
            // value in case pressure measurement was disabled
            return 0;
        }
        adc >>= 4;

        let var1 = (Long.fromValue(this.tFine)).subtract(128000);
        let var2 = var1.multiply(var1).multiply(this.dig_P6);
        var2 = var2.add((var1.multiply(this.dig_P5)).multiply(131072));
        var2 = var2.add(Long.fromValue(this.dig_P4).multiply(34359738368));
        var1 = ((var1.multiply(var1).multiply(this.dig_P3))
            .divide(256))
            .add((var1.multiply(this.dig_P2).multiply(4096)));
        const var3 = (Long.fromValue(1)).multiply(140737488355328);
        var1 = var3.add(var1).multiply(this.dig_P1)
            .divide(8589934592);

        if (var1.equals(0)) {
            return 0; // avoid exception caused by division by zero
        }

        let var4 = Long.fromValue(1048576).subtract(adc);
        var4 = (var4.multiply(2147483648)
            .subtract(var2)
            .multiply(3125))
            .divide(var1);
        var1 = Long.fromValue(this.dig_P9)
            .multiply(var4.divide(8192))
            .multiply(var4.divide(8192))
            .divide(33554432);
        var2 = Long.fromValue(this.dig_P8)
            .multiply(var4)
            .divide(524288);
        var4 = var4
            .add(var1)
            .add(var2)
            .divide(256)
            .add(Long.fromValue(this.dig_P7).multiply(16));

        const P = var4.divide(256.0);
        return P.toNumber();
    }


    /**
     * Read humidity from the sensor
     * @returns {Promise<number>} a Promise which resolves humidity [%]
     */
    async readHumidity () {
        await this.readTemperature();
        const adc = await this.readUint16BE(BME280_REG_HUMIDITYDATA);
        if (adc === 0x8000) {
            // value in case pressure measurement was disabled
            return 0;
        }

        const var1 = this.tFine - 76800;
        let var2 = (adc * 16384);
        let var3 = (this.dig_H4 * 1048576);
        let var4 = this.dig_H5 * var1;
        let var5 = (((var2 - var3) - var4) + 16384) / 32768;
        var2 = (var1 * this.dig_H6) / 1024;
        var3 = (var1 * this.dig_H3) / 2048;
        var4 = ((var2 * (var3 + 32768)) / 1024) + 2097152;
        var2 = ((var4 * this.dig_H2) + 8192) / 16384;
        var3 = var5 * var2;
        var4 = ((var3 / 32768) * (var3 / 32768)) / 128;
        var5 = var3 - ((var4 * this.dig_H1) / 16);
        var5 = (var5 < 0 ? 0 : var5);
        var5 = (var5 > 419430400 ? 419430400 : var5);
        const H = var5 / 4096;

        return H / 1024.0;
    }
}
