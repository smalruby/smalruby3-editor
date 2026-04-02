/**
 * acceleration sensor ADX345 API
 */


// register addresses
const ADXL345_ADDR = 0x53;
const ADXL345_ID = 0xE5;
const DATA_FORMAT = 0x31;
const POWER_CTL = 0x2D;
const DATA_X0 = 0x32;
const FULL_RES_16G = 0x0B;
const MEASURE = 0x08;

/**
 * This class is representing a ADXL345.
 */
export default class ADXL345 {
    /**
     * Constructor of ADXL345 instance.
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
        this.address = ADXL345_ADDR;

        /**
         * Timeout for readings in milliseconds.
         * @type {number}
         */
        this.timeout = 200;

        /**
         * Scale factor for raw data of acceleration
         */
        this.scale = {
            x: 0.0392266, // =((4/1000)*9.80665)
            y: 0.0392266,
            z: 0.0392266
        };
    }

    /**
     * Check if the connected device is ADXL345.
     * @param {AkadakoBoard} board - connecting akadako board
     * @returns {Promise<boolean>} A Promise which resolves true if the device is ADXL345, false otherwise.
     */
    static async isConnected (board) {
        try {
            const adxl345 = new ADXL345(board);
            await adxl345.readID();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Initialize the sensor
     * @returns {Promise} a Promise which resolves when the sensor was initialized
     */
    init () {
        return this.readID()
            .then(id => {
                if (id !== ADXL345_ID) return Promise.reject(new Error(`0x${this.address.toString(16)} is not ADXL345`));
                this.board.i2cWrite(this.address, DATA_FORMAT, FULL_RES_16G);
                this.board.i2cWrite(this.address, POWER_CTL, MEASURE);
            });
    }

    /**
     * Read ID of a ADXL345
     * @returns {Promise} a Promise which resolves ID
     */
    readID () {
        return this.board.i2cReadOnce(this.address, 0x00, 1, this.timeout)
            .then(data => data[0]);
    }

    /**
     * Return latest acceleration data
     * @returns {promise<{x: number, y: number, z: number}>} a Promise which resolves acceleration
     */
    getAcceleration () {
        return this.board.i2cReadOnce(this.address, DATA_X0, 6, this.timeout)
            .then(data => {
                const dataView = new DataView(new Uint8Array(data).buffer);
                const acceleration = {};
                acceleration.x = dataView.getInt16(0, true) * this.scale.x;
                acceleration.y = dataView.getInt16(2, true) * this.scale.y;
                acceleration.z = dataView.getInt16(4, true) * this.scale.z;
                return acceleration;
            });
    }
}
