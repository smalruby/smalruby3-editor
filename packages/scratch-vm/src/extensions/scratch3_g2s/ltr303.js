/**
 * acceleration sensor LTR303 API
 */

const ADDR = 0x29;
const ID_REG = 0x86;
const ID = 0xA0;

/**
 * This class is representing a LTR303.
 */
export default class LTR303 {
    /**
     * Constructor of LTR303 instance.
     * @param {AkadakoBoard} board - connecting akadako board
     */
    constructor (board) {

        /**
         * Connecting akadako board
         * @type {import('./akadako-board').default}
         */
        this.board = board;

        /**
         * I2C address
         * @type {number}
         */
        this.address = ADDR;

        /**
         * Timeout for readings in milliseconds.
         * @type {number}
         */
        this.timeout = 200;
    }

    /**
     * Initialize the sensor
     * @returns {Promise} a Promise which resolves when the sensor was initialized
     */
    async init () {
        const id = await this.readID();
        if (id !== ID) return Promise.reject(new Error(`0x${this.address.toString(16)} is not LTR303`));
    }

    /**
     * Read ID of a LTR303
     * @returns {Promise} a Promise which resolves ID
     */
    async readID () {
        const partID = await this.board.i2cReadOnce(ADDR, ID_REG, 1, this.timeout);
        return partID[0] & 0xF0;
    }

    /**
     * Return value of brightness.
     * @returns {promise<number>} a Promise which resolves brightness
     */
    async getBrightness () {
        await this.board.i2cWrite(this.address, 0x80, 1);
        const ch1data = await this.board.i2cReadOnce(this.address, 0x88, 2, this.timeout);
        const ch1 = ch1data[0] | (ch1data[1] << 8);
        const ch0data = await this.board.i2cReadOnce(this.address, 0x8A, 2, this.timeout);
        const ch0 = ch0data[0] | (ch0data[1] << 8);
        const ratio = ch1 / (ch0 + ch1);
        let lux = 0;
        if (ratio < 0.45) {
            lux = ((1.7743 * ch0) + (1.1059 * ch1));
        } else if (ratio < 0.64 && ratio >= 0.45) {
            lux = ((4.2785 * ch0) - (1.9548 * ch1));
        } else if (ratio < 0.85 && ratio >= 0.64) {
            lux = ((0.5926 * ch0) + (0.1185 * ch1));
        }
        return Math.round(lux * 10) / 10;
    }
}
