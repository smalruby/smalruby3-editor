/**
 * KXTJ3 API based on ROHM's Arduino sample software (v1.1)
 * ref: https://www.rohm.co.jp/sensor-shield-support/kxtj3-1057
 */


const KXTJ3_DEVICE_ADDRESS_0F = 0x0F;
const KXTJ3_DEVICE_ADDRESS_0E = 0x0E;
 
const KXTJ3_XOUT_L = 0x06;
const KXTJ3_WHO_AM_I = 0x0F;
const KXTJ3_CNTL1 = 0x1B;
const KXTJ3_DATA_CNTL = 0x21;
 
const KXTJ3_CNTL1_GSEL_2G = (0 << 2);
const KXTJ3_CNTL1_GSEL_4G = (2 << 2);
const KXTJ3_CNTL1_GSEL_8G = (4 << 2);
const KXTJ3_CNTL1_GSEL_16G = (1 << 2);
const KXTJ3_CNTL1_RES_LOWPOWER = (0 << 6);
// const KXTJ3_CNTL1_RES_HIGHRESO = (1 << 6);
const KXTJ3_CNTL1_PC1 = (1 << 7);
const KXTJ3_DATA_CNTL_OSA_50HZ = (2 << 0);

const KXTJ3_WAI_VAL = (0x35);
const KXTJ3_DATA_CNTL_VAL = KXTJ3_DATA_CNTL_OSA_50HZ;

const KXTJ3_CNTL1_EN16GMASK = 0x04;
const KXTJ3_CNTL1_GSELMASK = 0x18;
const KXTJ3_CNTL1_GSEL_14BIT = 0x18;
const KXTJ3_CNTL1_RES_MASK = 0x40;
const KXTJ3_DATA_CNTL_ODRCHECK = 4;
const KXTJ3_DATA_CNTL_OSAA_CLEAR = 0x07;

 
const KXTJ3_GSENS_2G = 2;
const KXTJ3_GSENS_4G = 4;
const KXTJ3_GSENS_8G = 8;
const KXTJ3_GSENS_16G = 16;
 
const KXTJ3_READ_DATA_SIZE = 6;
const KXTJ3_DIVIDE_SHIFT = 15;

/**
 * This class represents KXTJ3 device.
 */
export default class KXTJ3 {

    /**
     * Construct the device with an I2C address.
     * @param {AkadakoBoard} board Connecting AkaDako board.
     * @param {boolean} isAddressLow True when use lower address (0x0F).
     */
    constructor (board, isAddressLow) {

        /**
         * Connecting akadako board
         * @type {import('./akadako-board').default}
         */
        this.board = board;

        /**
         * I2C address for this device.
         * @type {number}
         */
        this.address = KXTJ3_DEVICE_ADDRESS_0E;
        if (isAddressLow) {
            this.address = KXTJ3_DEVICE_ADDRESS_0F;
        }

        /**
         * Value of register control1.
         * @type {number}
         */
        this.regCtrl1 = 0;
    }

    /**
     * Check if the connected device is KXTJ3.
     * @param {AkadakoBoard} board - connecting akadako board
     * @returns {Promise<boolean>} A Promise which resolves true if the device is KXTJ3, false otherwise.
     */
    static async isConnected (board) {
        try {
            const kxtj3 = new KXTJ3(board);
            await kxtj3.initDevice();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Initialize the device.
     * @param {number} range Range of gravity sensing. [ 2 | 4 | 8 | 16 ]
     */
    async init (range) {
        const ctrl1 = await this.initDevice(range);
        this.setupParameters(ctrl1);
        await this.start();
    }

    /**
     * Set initial settings for the device.
     * @param {number} range Range of gravity sensing. [ 2 | 4 | 8 | 16 ]
     * @returns {Promise<number | string>} Resolves control register 1 or error message.
     */
    async initDevice (range){
        if (KXTJ3_WAI_VAL !== (await this.read(KXTJ3_WHO_AM_I, 1))[0]) throw new Error('not KXTJ3');
        let gSelection = 0;
        switch (range) {
        case 2:
            gSelection = KXTJ3_CNTL1_GSEL_2G;
            break;

        case 4:
            gSelection = KXTJ3_CNTL1_GSEL_4G;
            break;
        
        case 16:
            gSelection = KXTJ3_CNTL1_GSEL_16G;
            break;

        default:
            gSelection = KXTJ3_CNTL1_GSEL_8G;
            break;
        }
        const ctrl1Value = (KXTJ3_CNTL1_RES_LOWPOWER | gSelection);
        await this.write(KXTJ3_CNTL1, [ctrl1Value]);
        await this.write(KXTJ3_DATA_CNTL, [KXTJ3_DATA_CNTL_VAL]);
        const data = await this.read(KXTJ3_CNTL1, 1);
        return data[0];
    }

    /**
     * Setup parameters to use device.
     * @param {number} ctrl1 Value of control 1 register of the device.
     */
    setupParameters (ctrl1) {
        this.regCtrl1 = ctrl1;
        const resolution = (ctrl1 & KXTJ3_CNTL1_RES_MASK);
        const gSelection = (ctrl1 & KXTJ3_CNTL1_GSELMASK);
        const en16g = (ctrl1 & KXTJ3_CNTL1_EN16GMASK);
        const outputDataRate = (KXTJ3_DATA_CNTL_OSAA_CLEAR & KXTJ3_DATA_CNTL_VAL);
        if (resolution === KXTJ3_CNTL1_RES_LOWPOWER) {
            if ((gSelection === KXTJ3_CNTL1_GSEL_14BIT) || (outputDataRate > KXTJ3_DATA_CNTL_ODRCHECK)) {
                throw new Error('KXTJ3 setting parameter error');
            }
        }
        let gSense;
        if (en16g === KXTJ3_CNTL1_GSEL_16G) {
            gSense = KXTJ3_GSENS_16G;
        } else {
            switch (gSelection) {
            case KXTJ3_CNTL1_GSEL_2G:
                gSense = KXTJ3_GSENS_2G;
                break;
            case KXTJ3_CNTL1_GSEL_4G:
                gSense = KXTJ3_GSENS_4G;
                break;
            default:
                gSense = KXTJ3_GSENS_8G;
                break;
            }
        }
        this.gDivide = (1 << KXTJ3_DIVIDE_SHIFT) / gSense;
    }

    /**
     * Start sensing.
     */
    async start () {
        await this.write(KXTJ3_CNTL1, [this.regCtrl1 | KXTJ3_CNTL1_PC1]);
    }

    /**
     * Stop sensing.
     */
    async stop () {
        await this.write(KXTJ3_CNTL1, [this.regCtrl1 & ~KXTJ3_CNTL1_PC1]);
    }

    /**
     * Return latest acceleration data.
     * @returns {Promise<{x: number, y: number, z: number}>} a Promise which resolves acceleration
     */
    async getAcceleration (){
        const data = await this.read(KXTJ3_XOUT_L, KXTJ3_READ_DATA_SIZE);
        const dataView = new DataView(new Uint8Array(data).buffer);
        const acceleration = {};
        acceleration.x = 9.8 * dataView.getInt16(0, true) / this.gDivide;
        acceleration.y = 9.8 * dataView.getInt16(2, true) / this.gDivide;
        acceleration.z = 9.8 * dataView.getInt16(4, true) / this.gDivide;
        return acceleration;
    }

    /**
     * Read multiple bytes from the register.
     * @param {number} register - register to read
     * @param {number} readLength - byte size to read
     * @returns {Promise<number>} a Promise which resolves read value
     */
    read (register, readLength) {
        return this.board.i2cReadOnce(this.address, register, readLength);
    }

    /**
     * Write these bytes starting at the register.
     * @param {number} register - starting register
     * @param {Array<number>} data - array of uint8t to be written
     */
    write (register, data) {
        this.board.i2cWrite(this.address, register, data);
    }

}
