/**
 * VL53L0X API converted from Cpp code for Arduino.
 * ref: https://github.com/pololu/vl53l0x-arduino
 */


/* eslint-disable camelcase */

// register addresses from API vl53l0x_device.h (ordered as listed there)
// enum regAddr
const SYSRANGE_START = 0x00;

const SYSTEM_THRESH_HIGH = 0x0C;
const SYSTEM_THRESH_LOW = 0x0E;

const SYSTEM_SEQUENCE_CONFIG = 0x01;
const SYSTEM_RANGE_CONFIG = 0x09;
const SYSTEM_INTERMEASUREMENT_PERIOD = 0x04;

const SYSTEM_INTERRUPT_CONFIG_GPIO = 0x0A;

const GPIO_HV_MUX_ACTIVE_HIGH = 0x84;

const SYSTEM_INTERRUPT_CLEAR = 0x0B;

const RESULT_INTERRUPT_STATUS = 0x13;
const RESULT_RANGE_STATUS = 0x14;

const RESULT_CORE_AMBIENT_WINDOW_EVENTS_RTN = 0xBC;
const RESULT_CORE_RANGING_TOTAL_EVENTS_RTN = 0xC0;
const RESULT_CORE_AMBIENT_WINDOW_EVENTS_REF = 0xD0;
const RESULT_CORE_RANGING_TOTAL_EVENTS_REF = 0xD4;
const RESULT_PEAK_SIGNAL_RATE_REF = 0xB6;

const ALGO_PART_TO_PART_RANGE_OFFSET_MM = 0x28;

const I2C_SLAVE_DEVICE_ADDRESS = 0x8A;

const MSRC_CONFIG_CONTROL = 0x60;

const PRE_RANGE_CONFIG_MIN_SNR = 0x27;
const PRE_RANGE_CONFIG_VALID_PHASE_LOW = 0x56;
const PRE_RANGE_CONFIG_VALID_PHASE_HIGH = 0x57;
const PRE_RANGE_MIN_COUNT_RATE_RTN_LIMIT = 0x64;

const FINAL_RANGE_CONFIG_MIN_SNR = 0x67;
const FINAL_RANGE_CONFIG_VALID_PHASE_LOW = 0x47;
const FINAL_RANGE_CONFIG_VALID_PHASE_HIGH = 0x48;
const FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT = 0x44;

const PRE_RANGE_CONFIG_SIGMA_THRESH_HI = 0x61;
const PRE_RANGE_CONFIG_SIGMA_THRESH_LO = 0x62;

const PRE_RANGE_CONFIG_VCSEL_PERIOD = 0x50;
const PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI = 0x51;
const PRE_RANGE_CONFIG_TIMEOUT_MACROP_LO = 0x52;

const SYSTEM_HISTOGRAM_BIN = 0x81;
const HISTOGRAM_CONFIG_INITIAL_PHASE_SELECT = 0x33;
const HISTOGRAM_CONFIG_READOUT_CTRL = 0x55;

const FINAL_RANGE_CONFIG_VCSEL_PERIOD = 0x70;
const FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI = 0x71;
const FINAL_RANGE_CONFIG_TIMEOUT_MACROP_LO = 0x72;
const CROSSTALK_COMPENSATION_PEAK_RATE_MCPS = 0x20;

const MSRC_CONFIG_TIMEOUT_MACROP = 0x46;

const SOFT_RESET_GO2_SOFT_RESET_N = 0xBF;
const IDENTIFICATION_MODEL_ID = 0xC0;
const IDENTIFICATION_REVISION_ID = 0xC2;

const OSC_CALIBRATE_VAL = 0xF8;

const GLOBAL_CONFIG_VCSEL_WIDTH = 0x32;
const GLOBAL_CONFIG_SPAD_ENABLES_REF_0 = 0xB0;
const GLOBAL_CONFIG_SPAD_ENABLES_REF_1 = 0xB1;
const GLOBAL_CONFIG_SPAD_ENABLES_REF_2 = 0xB2;
const GLOBAL_CONFIG_SPAD_ENABLES_REF_3 = 0xB3;
const GLOBAL_CONFIG_SPAD_ENABLES_REF_4 = 0xB4;
const GLOBAL_CONFIG_SPAD_ENABLES_REF_5 = 0xB5;

const GLOBAL_CONFIG_REF_EN_START_SELECT = 0xB6;
const DYNAMIC_SPAD_NUM_REQUESTED_REF_SPAD = 0x4E;
const DYNAMIC_SPAD_REF_EN_START_OFFSET = 0x4F;
const POWER_MANAGEMENT_GO1_POWER_FORCE = 0x80;

const VHV_CONFIG_PAD_SCL_SDA__EXTSUP_HV = 0x89;

const ALGO_PHASECAL_LIM = 0x30;
const ALGO_PHASECAL_CONFIG_TIMEOUT = 0x30;

// enum vcselPeriodType
const VcselPeriodPreRange = 0;
const VcselPeriodFinalRange = 1;

/**
 * Decode VCSEL (vertical cavity surface emitting laser) pulse period in PCLKs
 * from register value
 * based on VL53L0X_decode_vcsel_period()
 * @param {number} reg_val - register value
 * @returns {number} decoded value
 */
const decodeVcselPeriod = reg_val => (((reg_val) + 1) << 1);

// Encode VCSEL pulse period register value from period in PCLKs
// based on VL53L0X_encode_vcsel_period()
const encodeVcselPeriod = period_pclks => (((period_pclks) >> 1) - 1);

// Calculate macro period in *nanoseconds* from VCSEL period in PCLKs
// based on VL53L0X_calc_macro_period_ps()
// PLL_period_ps = 1655; macro_period_vclks = 2304
const calcMacroPeriod = vcsel_period_pclks => (((2304 * (vcsel_period_pclks) * 1655) + 500) / 1000);

/**
 * This class is representing a VL53L0X distance sensor.
 */
export default class VL53L0X {

    /**
     * Constructor of VL53L0X instance.
     * @param {AkadakoBoard} board - connecting akadako board
     * @param {number?} address - I2C address of the sensor
     */
    constructor (board, address) {

        /**
         * Connecting akadako board
         * @type {import('./akadako-board').default}
         */
        this.board = board;

        /**
         * I2C address for this module
         */
        this.address = 0x29; // default address
        if (address) {
            this.address = address;
        }

        /**
         * read by init and used when starting measurement;
         * is StopVariable field of VL53L0X_DevData_t structure in API
         * @type {number}
         */
        this.stop_variable = 0;

        /**
         * Timeout for IO in milliseconds.
         * @type {number}
         */
        this.io_timeout = 500;

        /**
         * Did a timeout occur in a sequence.
         * @type {boolean}
         */
        this.did_timeout = false;

        /**
         * @type {number}
         */
        this.measurement_timing_budget_us = 0;
    }

    /**
     * Change address for this module
     * @param {number} new_addr - I2C address to set
     */
    setAddress (new_addr) {
        this.writeReg(I2C_SLAVE_DEVICE_ADDRESS, new_addr);
        this.address = new_addr;
    }

    /**
     * Initialize sensor using sequence based on VL53L0X_DataInit(),
     * VL53L0X_StaticInit(), and VL53L0X_PerformRefCalibration().
     * @param {boolean} io2v8 - set 2V8 mode if it was true
     * @returns {Promise<boolean>} a Promise which resolves boolean if the initialization was succeeded.
     */
    async init (io2v8) {
        // check model ID register (value specified in datasheet)
        const id = await this.readReg(IDENTIFICATION_MODEL_ID);
        if (id !== 0xEE) {
            return false;
        }

        // VL53L0X_DataInit() begin

        // sensor uses 1V8 mode for I/O by default; switch to 2V8 mode if necessary
        if (io2v8) {
            this.writeReg(VHV_CONFIG_PAD_SCL_SDA__EXTSUP_HV,
                await this.readReg(VHV_CONFIG_PAD_SCL_SDA__EXTSUP_HV) | 0x01); // set bit 0
        }

        // "Set I2C standard mode"
        this.writeReg(0x88, 0x00);

        this.writeReg(0x80, 0x01);
        this.writeReg(0xFF, 0x01);
        this.writeReg(0x00, 0x00);
        this.stop_variable = await this.readReg(0x91);
        this.writeReg(0x00, 0x01);
        this.writeReg(0xFF, 0x00);
        this.writeReg(0x80, 0x00);

        // disable SIGNAL_RATE_MSRC (bit 1) and SIGNAL_RATE_PRE_RANGE (bit 4) limit checks
        this.writeReg(MSRC_CONFIG_CONTROL, await this.readReg(MSRC_CONFIG_CONTROL) | 0x12);

        // set final range signal rate limit to 0.25 MCPS (million counts per second)
        this.setSignalRateLimit(0.25);

        this.writeReg(SYSTEM_SEQUENCE_CONFIG, 0xFF);

        // VL53L0X_DataInit() end

        // VL53L0X_StaticInit() begin

        const info = {count: 0, isAperture: false};
        if (!await this.getSpadInfo(info)) {
            return false;
        }

        // The SPAD map (RefGoodSpadMap) is read by VL53L0X_get_info_from_device() in
        // the API, but the same data seems to be more easily readable from
        // GLOBAL_CONFIG_SPAD_ENABLES_REF_0 through _6, so read it from there
        const refSpadMap = await this.readMulti(GLOBAL_CONFIG_SPAD_ENABLES_REF_0, 6);

        // -- VL53L0X_set_reference_spads() begin (assume NVM values are valid)

        this.writeReg(0xFF, 0x01);
        this.writeReg(DYNAMIC_SPAD_REF_EN_START_OFFSET, 0x00);
        this.writeReg(DYNAMIC_SPAD_NUM_REQUESTED_REF_SPAD, 0x2C);
        this.writeReg(0xFF, 0x00);
        this.writeReg(GLOBAL_CONFIG_REF_EN_START_SELECT, 0xB4);

        const firstSpadToEnable = info.isAperture ? 12 : 0; // 12 is the first aperture spad
        let spadsEnabled = 0;

        for (let i = 0; i < 48; i++) {
            if (i < firstSpadToEnable || spadsEnabled === info.count) {
                // This bit is lower than the first one that should be enabled, or
                // (reference_spad_count) bits have already been enabled, so zero this bit
                refSpadMap[i / 8] &= ~(1 << (i % 8));
            } else if ((refSpadMap[i / 8] >> (i % 8)) & 0x1) {
                spadsEnabled++;
            }
        }

        this.writeMulti(GLOBAL_CONFIG_SPAD_ENABLES_REF_0, refSpadMap, 6);

        // -- VL53L0X_set_reference_spads() end

        // -- VL53L0X_load_tuning_settings() begin
        // DefaultTuningSettings from vl53l0x_tuning.h

        this.writeReg(0xFF, 0x01);
        this.writeReg(0x00, 0x00);

        this.writeReg(0xFF, 0x00);
        this.writeReg(0x09, 0x00);
        this.writeReg(0x10, 0x00);
        this.writeReg(0x11, 0x00);

        this.writeReg(0x24, 0x01);
        this.writeReg(0x25, 0xFF);
        this.writeReg(0x75, 0x00);

        this.writeReg(0xFF, 0x01);
        this.writeReg(0x4E, 0x2C);
        this.writeReg(0x48, 0x00);
        this.writeReg(0x30, 0x20);

        this.writeReg(0xFF, 0x00);
        this.writeReg(0x30, 0x09);
        this.writeReg(0x54, 0x00);
        this.writeReg(0x31, 0x04);
        this.writeReg(0x32, 0x03);
        this.writeReg(0x40, 0x83);
        this.writeReg(0x46, 0x25);
        this.writeReg(0x60, 0x00);
        this.writeReg(0x27, 0x00);
        this.writeReg(0x50, 0x06);
        this.writeReg(0x51, 0x00);
        this.writeReg(0x52, 0x96);
        this.writeReg(0x56, 0x08);
        this.writeReg(0x57, 0x30);
        this.writeReg(0x61, 0x00);
        this.writeReg(0x62, 0x00);
        this.writeReg(0x64, 0x00);
        this.writeReg(0x65, 0x00);
        this.writeReg(0x66, 0xA0);

        this.writeReg(0xFF, 0x01);
        this.writeReg(0x22, 0x32);
        this.writeReg(0x47, 0x14);
        this.writeReg(0x49, 0xFF);
        this.writeReg(0x4A, 0x00);

        this.writeReg(0xFF, 0x00);
        this.writeReg(0x7A, 0x0A);
        this.writeReg(0x7B, 0x00);
        this.writeReg(0x78, 0x21);

        this.writeReg(0xFF, 0x01);
        this.writeReg(0x23, 0x34);
        this.writeReg(0x42, 0x00);
        this.writeReg(0x44, 0xFF);
        this.writeReg(0x45, 0x26);
        this.writeReg(0x46, 0x05);
        this.writeReg(0x40, 0x40);
        this.writeReg(0x0E, 0x06);
        this.writeReg(0x20, 0x1A);
        this.writeReg(0x43, 0x40);

        this.writeReg(0xFF, 0x00);
        this.writeReg(0x34, 0x03);
        this.writeReg(0x35, 0x44);

        this.writeReg(0xFF, 0x01);
        this.writeReg(0x31, 0x04);
        this.writeReg(0x4B, 0x09);
        this.writeReg(0x4C, 0x05);
        this.writeReg(0x4D, 0x04);

        this.writeReg(0xFF, 0x00);
        this.writeReg(0x44, 0x00);
        this.writeReg(0x45, 0x20);
        this.writeReg(0x47, 0x08);
        this.writeReg(0x48, 0x28);
        this.writeReg(0x67, 0x00);
        this.writeReg(0x70, 0x04);
        this.writeReg(0x71, 0x01);
        this.writeReg(0x72, 0xFE);
        this.writeReg(0x76, 0x00);
        this.writeReg(0x77, 0x00);

        this.writeReg(0xFF, 0x01);
        this.writeReg(0x0D, 0x01);

        this.writeReg(0xFF, 0x00);
        this.writeReg(0x80, 0x01);
        this.writeReg(0x01, 0xF8);

        this.writeReg(0xFF, 0x01);
        this.writeReg(0x8E, 0x01);
        this.writeReg(0x00, 0x01);
        this.writeReg(0xFF, 0x00);
        this.writeReg(0x80, 0x00);

        // -- VL53L0X_load_tuning_settings() end

        // "Set interrupt config to new sample ready"
        // -- VL53L0X_SetGpioConfig() begin

        this.writeReg(SYSTEM_INTERRUPT_CONFIG_GPIO, 0x04);
        this.writeReg(GPIO_HV_MUX_ACTIVE_HIGH, (await this.readReg(GPIO_HV_MUX_ACTIVE_HIGH)) & ~0x10); // active low
        this.writeReg(SYSTEM_INTERRUPT_CLEAR, 0x01);

        // -- VL53L0X_SetGpioConfig() end

        this.measurement_timing_budget_us = await this.getMeasurementTimingBudget();

        // "Disable MSRC and TCC by default"
        // MSRC = Minimum Signal Rate Check
        // TCC = Target CentreCheck
        // -- VL53L0X_SetSequenceStepEnable() begin

        this.writeReg(SYSTEM_SEQUENCE_CONFIG, 0xE8);

        // -- VL53L0X_SetSequenceStepEnable() end

        // "Recalculate timing budget"
        await this.setMeasurementTimingBudget(this.measurement_timing_budget_us);

        // VL53L0X_StaticInit() end

        // VL53L0X_PerformRefCalibration() begin (VL53L0X_perform_ref_calibration())

        // -- VL53L0X_perform_vhv_calibration() begin

        this.writeReg(SYSTEM_SEQUENCE_CONFIG, 0x01);
        if (!await this.performSingleRefCalibration(0x40)) {
            return false;
        }

        // -- VL53L0X_perform_vhv_calibration() end

        // -- VL53L0X_perform_phase_calibration() begin

        this.writeReg(SYSTEM_SEQUENCE_CONFIG, 0x02);
        if (!await this.performSingleRefCalibration(0x00)) {
            return false;
        }

        // -- VL53L0X_perform_phase_calibration() end

        // "restore the previous Sequence Config"
        this.writeReg(SYSTEM_SEQUENCE_CONFIG, 0xE8);

        // VL53L0X_PerformRefCalibration() end

        return true;
    }

    /**
     * Write an 8-bit at the register.
     * @param {number} register - register to write
     * @param {number} value - written 8-bit value
     */
    writeReg (register, value) {
        this.board.i2cWrite(this.address, register, value);
    }
    
    /**
     * Write a 16-bit at the register.
     * @param {number} register - register to write
     * @param {number} value - written 16-bit value
     */
    writeReg16Bit (register, value) {
        const data = [
            (value >> 8) & 0xFF,
            value & 0xFF
        ];
        this.board.i2cWrite(this.address, register, data);
    }

    /**
     * Write a 32-bit at the register.
     * @param {number} register - register to write
     * @param {number} value - written 32-bit value
     */
    writeReg32Bit (register, value) {
        const data = [
            (value >> 24) & 0xFF,
            (value >> 16) & 0xFF,
            (value >> 8) & 0xFF,
            value & 0xFF
        ];
        this.board.i2cWrite(this.address, register, data);
    }

    /**
     * Read an 8-bit from the register.
     * @param {number} register - register to read
     * @returns {Promise<number>} a Promise which resolves read value
     */
    readReg (register) {
        return this.board.i2cReadOnce(this.address, register, 1, this.io_timeout)
            .then(data => data[0]);
    }

    /**
     * Read a 16-bit from the register.
     * @param {number} register - starting register
     * @returns {Promise<number>} a Promise which resolves read value
     */
    readReg16Bit (register) {
        return this.board.i2cReadOnce(this.address, register, 2, this.io_timeout)
            .then(data => {
                const value = (data[0] << 8) | data[1];
                return value;
            });
    }

    /**
     * Read a 32-bit from the register.
     * @param {number} register - starting register
     * @returns {Promise<number>} a Promise which resolves read value
     */
    readReg32Bit (register) {
        return this.board.i2cReadOnce(this.address, register, 4, this.io_timeout)
            .then(data => {
                const value =
                      (data[0] << 24) |
                      (data[1] << 16) |
                      (data[2] << 8) |
                      data[3];
                return value;
            });
    }

    /**
     * Write these bytes starting at the register.
     * @param {number} register - starting register
     * @param {Array<number>} data - array of uint8t to be written
     */
    writeMulti (register, data) {
        this.board.i2cWrite(this.address, register, data);
    }

    /**
     * Read bytes of the length from the register.
     * @param {number} register - starting register
     * @param {number} bytesToRead - byte length to read
     * @returns {Promise<Array<number>>} a Promise which resolves read bytes
     */
    readMulti (register, bytesToRead) {
        return this.board.i2cReadOnce(this.address, register, bytesToRead, this.io_timeout);
    }

    /**
     * Record the current time to check an upcoming timeout against
     */
    startTimeout () {
        /**
         * Starting time to count timeout for IO.
         */
        this.timeout_start_ms = Date.now();
    }

    /**
     * Check if timeout is enabled (set to nonzero value) and has expired.
     * @returns {boolean} true when the timeout has expired
     */
    checkTimeoutExpired () {
        return this.io_timeout > 0 && ((Date.now() - this.timeout_start_ms) > this.io_timeout);
    }
    

    // Set the return signal rate limit check value in units of MCPS (mega counts
    // per second). "This represents the amplitude of the signal reflected from the
    // target and detected by the device"; setting this limit presumably determines
    // the minimum measurement necessary for the sensor to report a valid reading.
    // Setting a lower limit increases the potential range of the sensor but also
    // seems to increase the likelihood of getting an inaccurate reading because of
    // unwanted reflections from objects other than the intended target.
    // Defaults to 0.25 MCPS as initialized by the ST API and this library.
    setSignalRateLimit (limitMCPS) {
        if (limitMCPS < 0 || limitMCPS > 511.99) {
            return false;
        }

        // Q9.7 fixed point format (9 integer bits, 7 fractional bits)
        this.writeReg16Bit(FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT, limitMCPS * (1 << 7));
        return true;
    }

    // Get the return signal rate limit check value in MCPS
    async getSignalRateLimit () {
        return (await this.readReg16Bit(FINAL_RANGE_CONFIG_MIN_COUNT_RATE_RTN_LIMIT)) / (1 << 7);
    }

    // Set the measurement timing budget in microseconds, which is the time allowed
    // for one measurement; the ST API and this library take care of splitting the
    // timing budget among the sub-steps in the ranging sequence. A longer timing
    // budget allows for more accurate measurements. Increasing the budget by a
    // factor of N decreases the range measurement standard deviation by a factor of
    // sqrt(N). Defaults to about 33 milliseconds; the minimum is 20 ms.
    // based on VL53L0X_set_measurement_timing_budget_micro_seconds()
    async setMeasurementTimingBudget (budget_us) {
        const enables = {tcc: false, msrc: false, dss: false, pre_range: false, final_range: false};
        const timeouts = {pre_range_vcsel_period_pclks: 0,
            final_range_vcsel_period_pclks: 0,
            msrc_dss_tcc_mclks: 0,
            pre_range_mclks: 0,
            final_range_mclks: 0,
            msrc_dss_tcc_us: 0,
            pre_range_us: 0,
            final_range_us: 0};

        const StartOverhead = 1910;
        const EndOverhead = 960;
        const MsrcOverhead = 660;
        const TccOverhead = 590;
        const DssOverhead = 690;
        const PreRangeOverhead = 660;
        const FinalRangeOverhead = 550;

        const MinTimingBudget = 20000;

        if (budget_us < MinTimingBudget) {
            return false;
        }

        let used_budget_us = StartOverhead + EndOverhead;

        await this.getSequenceStepEnables(enables);
        await this.getSequenceStepTimeouts(enables, timeouts);

        if (enables.tcc) {
            used_budget_us += (timeouts.msrc_dss_tcc_us + TccOverhead);
        }

        if (enables.dss) {
            used_budget_us += 2 * (timeouts.msrc_dss_tcc_us + DssOverhead);
        } else if (enables.msrc) {
            used_budget_us += (timeouts.msrc_dss_tcc_us + MsrcOverhead);
        }

        if (enables.pre_range) {
            used_budget_us += (timeouts.pre_range_us + PreRangeOverhead);
        }

        if (enables.final_range) {
            used_budget_us += FinalRangeOverhead;

            // "Note that the final range timeout is determined by the timing
            // budget and the sum of all other timeouts within the sequence.
            // If there is no room for the final range timeout, then an error
            // will be set. Otherwise the remaining time will be applied to
            // the final range."

            if (used_budget_us > budget_us) {
                // "Requested timeout too big."
                return false;
            }

            const final_range_timeout_us = budget_us - used_budget_us;

            // set_sequence_step_timeout() begin
            // (SequenceStepId == VL53L0X_SEQUENCESTEP_FINAL_RANGE)

            // "For the final range timeout, the pre-range timeout
            //  must be added. To do this both final and pre-range
            //  timeouts must be expressed in macro periods MClks
            //  because they have different vcsel periods."

            let final_range_timeout_mclks =
             this.timeoutMicrosecondsToMclks(
                 final_range_timeout_us,
                 timeouts.final_range_vcsel_period_pclks);

            if (enables.pre_range) {
                final_range_timeout_mclks += timeouts.pre_range_mclks;
            }

            this.writeReg16Bit(FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI,
                this.encodeTimeout(final_range_timeout_mclks));

            // set_sequence_step_timeout() end

            this.measurement_timing_budget_us = budget_us; // store for internal reuse
        }
        return true;
    }

    // Get the measurement timing budget in microseconds
    // based on VL53L0X_get_measurement_timing_budget_micro_seconds()
    // in us
    async getMeasurementTimingBudget () {
        const enables = {tcc: false, msrc: false, dss: false, pre_range: false, final_range: false};
        const timeouts = {pre_range_vcsel_period_pclks: 0,
            final_range_vcsel_period_pclks: 0,
            msrc_dss_tcc_mclks: 0,
            pre_range_mclks: 0,
            final_range_mclks: 0,
            msrc_dss_tcc_us: 0,
            pre_range_us: 0,
            final_range_us: 0};

        const StartOverhead = 1910;
        const EndOverhead = 960;
        const MsrcOverhead = 660;
        const TccOverhead = 590;
        const DssOverhead = 690;
        const PreRangeOverhead = 660;
        const FinalRangeOverhead = 550;

        // "Start and end overhead times always present"
        let budget_us = StartOverhead + EndOverhead;

        await this.getSequenceStepEnables(enables);
        await this.getSequenceStepTimeouts(enables, timeouts);

        if (enables.tcc) {
            budget_us += (timeouts.msrc_dss_tcc_us + TccOverhead);
        }

        if (enables.dss) {
            budget_us += 2 * (timeouts.msrc_dss_tcc_us + DssOverhead);
        } else if (enables.msrc) {
            budget_us += (timeouts.msrc_dss_tcc_us + MsrcOverhead);
        }

        if (enables.pre_range) {
            budget_us += (timeouts.pre_range_us + PreRangeOverhead);
        }

        if (enables.final_range) {
            budget_us += (timeouts.final_range_us + FinalRangeOverhead);
        }

        this.measurement_timing_budget_us = budget_us; // store for internal reuse
        return budget_us;
    }

    // Set the VCSEL (vertical cavity surface emitting laser) pulse period for the
    // given period type (pre-range or final range) to the given value in PCLKs.
    // Longer periods seem to increase the potential range of the sensor.
    // Valid values are (even numbers only):
    //  pre:  12 to 18 (initialized default: 14)
    //  final: 8 to 14 (initialized default: 10)
    // based on VL53L0X_set_vcsel_pulse_period()
    async setVcselPulsePeriod (type, period_pclks) {
        const vcsel_period_reg = encodeVcselPeriod(period_pclks);

        const enables = {tcc: false, msrc: false, dss: false, pre_range: false, final_range: false};
        const timeouts = {pre_range_vcsel_period_pclks: 0,
            final_range_vcsel_period_pclks: 0,
            msrc_dss_tcc_mclks: 0,
            pre_range_mclks: 0,
            final_range_mclks: 0,
            msrc_dss_tcc_us: 0,
            pre_range_us: 0,
            final_range_us: 0};

        await this.getSequenceStepEnables(enables);
        await this.getSequenceStepTimeouts(enables, timeouts);

        // "Apply specific settings for the requested clock period"
        // "Re-calculate and apply timeouts, in macro periods"

        // "When the VCSEL period for the pre or final range is changed,
        // the corresponding timeout must be read from the device using
        // the current VCSEL period, then the new VCSEL period can be
        // applied. The timeout then must be written back to the device
        // using the new VCSEL period.
        //
        // For the MSRC timeout, the same applies - this timeout being
        // dependant on the pre-range vcsel period."


        if (type === VcselPeriodPreRange) {
            // "Set phase check limits"
            switch (period_pclks) {
            case 12:
                this.writeReg(PRE_RANGE_CONFIG_VALID_PHASE_HIGH, 0x18);
                break;

            case 14:
                this.writeReg(PRE_RANGE_CONFIG_VALID_PHASE_HIGH, 0x30);
                break;

            case 16:
                this.writeReg(PRE_RANGE_CONFIG_VALID_PHASE_HIGH, 0x40);
                break;

            case 18:
                this.writeReg(PRE_RANGE_CONFIG_VALID_PHASE_HIGH, 0x50);
                break;

            default:
                // invalid period
                return false;
            }
            this.writeReg(PRE_RANGE_CONFIG_VALID_PHASE_LOW, 0x08);

            // apply new VCSEL period
            this.writeReg(PRE_RANGE_CONFIG_VCSEL_PERIOD, vcsel_period_reg);

            // update timeouts

            // set_sequence_step_timeout() begin
            // (SequenceStepId == VL53L0X_SEQUENCESTEP_PRE_RANGE)

            const new_pre_range_timeout_mclks =
      this.timeoutMicrosecondsToMclks(timeouts.pre_range_us, period_pclks);

            this.writeReg16Bit(PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI,
                this.encodeTimeout(new_pre_range_timeout_mclks));

            // set_sequence_step_timeout() end

            // set_sequence_step_timeout() begin
            // (SequenceStepId == VL53L0X_SEQUENCESTEP_MSRC)

            const new_msrc_timeout_mclks =
      this.timeoutMicrosecondsToMclks(timeouts.msrc_dss_tcc_us, period_pclks);

            this.writeReg(MSRC_CONFIG_TIMEOUT_MACROP,
                (new_msrc_timeout_mclks > 256) ? 255 : (new_msrc_timeout_mclks - 1));

            // set_sequence_step_timeout() end
        } else if (type === VcselPeriodFinalRange) {
            switch (period_pclks) {
            case 8:
                this.writeReg(FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, 0x10);
                this.writeReg(FINAL_RANGE_CONFIG_VALID_PHASE_LOW, 0x08);
                this.writeReg(GLOBAL_CONFIG_VCSEL_WIDTH, 0x02);
                this.writeReg(ALGO_PHASECAL_CONFIG_TIMEOUT, 0x0C);
                this.writeReg(0xFF, 0x01);
                this.writeReg(ALGO_PHASECAL_LIM, 0x30);
                this.writeReg(0xFF, 0x00);
                break;

            case 10:
                this.writeReg(FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, 0x28);
                this.writeReg(FINAL_RANGE_CONFIG_VALID_PHASE_LOW, 0x08);
                this.writeReg(GLOBAL_CONFIG_VCSEL_WIDTH, 0x03);
                this.writeReg(ALGO_PHASECAL_CONFIG_TIMEOUT, 0x09);
                this.writeReg(0xFF, 0x01);
                this.writeReg(ALGO_PHASECAL_LIM, 0x20);
                this.writeReg(0xFF, 0x00);
                break;

            case 12:
                this.writeReg(FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, 0x38);
                this.writeReg(FINAL_RANGE_CONFIG_VALID_PHASE_LOW, 0x08);
                this.writeReg(GLOBAL_CONFIG_VCSEL_WIDTH, 0x03);
                this.writeReg(ALGO_PHASECAL_CONFIG_TIMEOUT, 0x08);
                this.writeReg(0xFF, 0x01);
                this.writeReg(ALGO_PHASECAL_LIM, 0x20);
                this.writeReg(0xFF, 0x00);
                break;

            case 14:
                this.writeReg(FINAL_RANGE_CONFIG_VALID_PHASE_HIGH, 0x48);
                this.writeReg(FINAL_RANGE_CONFIG_VALID_PHASE_LOW, 0x08);
                this.writeReg(GLOBAL_CONFIG_VCSEL_WIDTH, 0x03);
                this.writeReg(ALGO_PHASECAL_CONFIG_TIMEOUT, 0x07);
                this.writeReg(0xFF, 0x01);
                this.writeReg(ALGO_PHASECAL_LIM, 0x20);
                this.writeReg(0xFF, 0x00);
                break;

            default:
                // invalid period
                return false;
            }

            // apply new VCSEL period
            this.writeReg(FINAL_RANGE_CONFIG_VCSEL_PERIOD, vcsel_period_reg);

            // update timeouts

            // set_sequence_step_timeout() begin
            // (SequenceStepId == VL53L0X_SEQUENCESTEP_FINAL_RANGE)

            // "For the final range timeout, the pre-range timeout
            //  must be added. To do this both final and pre-range
            //  timeouts must be expressed in macro periods MClks
            //  because they have different vcsel periods."

            let new_final_range_timeout_mclks =
                this.timeoutMicrosecondsToMclks(timeouts.final_range_us, period_pclks);

            if (enables.pre_range) {
                new_final_range_timeout_mclks += timeouts.pre_range_mclks;
            }

            this.writeReg16Bit(FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI,
                this.encodeTimeout(new_final_range_timeout_mclks));

            // set_sequence_step_timeout end
        } else {
            // invalid type
            return false;
        }

        // "Finally, the timing budget must be re-applied"

        await this.setMeasurementTimingBudget(this.measurement_timing_budget_us);

        // "Perform the phase calibration. This is needed after changing on vcsel period."
        // VL53L0X_perform_phase_calibration() begin

        const sequence_config = await this.readReg(SYSTEM_SEQUENCE_CONFIG);
        this.writeReg(SYSTEM_SEQUENCE_CONFIG, 0x02);
        await this.performSingleRefCalibration(0x0);
        this.writeReg(SYSTEM_SEQUENCE_CONFIG, sequence_config);

        // VL53L0X_perform_phase_calibration() end

        return true;
    }

    // Get the VCSEL pulse period in PCLKs for the given period type.
    // based on VL53L0X_get_vcsel_pulse_period()
    async getVcselPulsePeriod (type) {
        if (type === VcselPeriodPreRange) {
            return decodeVcselPeriod(await this.readReg(PRE_RANGE_CONFIG_VCSEL_PERIOD));
        } else if (type === VcselPeriodFinalRange) {
            return decodeVcselPeriod(await this.readReg(FINAL_RANGE_CONFIG_VCSEL_PERIOD));
        }
        return 255;
    }

    /**
     * Start continuous ranging measurements. If period_ms (optional) is 0 or not
     * given, continuous back-to-back mode is used (the sensor takes measurements as
     * often as possible); otherwise, continuous timed mode is used, with the given
     * inter-measurement period in milliseconds determining how often the sensor
     * takes a measurement.
     * based on VL53L0X_StartMeasurement()
     * @param {number} period_ms - interval time between measurements
     */
    async startContinuous (period_ms) {
        this.writeReg(0x80, 0x01);
        this.writeReg(0xFF, 0x01);
        this.writeReg(0x00, 0x00);
        this.writeReg(0x91, this.stop_variable);
        this.writeReg(0x00, 0x01);
        this.writeReg(0xFF, 0x00);
        this.writeReg(0x80, 0x00);

        if (period_ms) {
            // continuous timed mode

            // VL53L0X_SetInterMeasurementPeriodMilliSeconds() begin

            const osc_calibrate_val = await this.readReg16Bit(OSC_CALIBRATE_VAL);

            if (osc_calibrate_val !== 0) {
                period_ms *= osc_calibrate_val;
            }

            this.writeReg32Bit(SYSTEM_INTERMEASUREMENT_PERIOD, period_ms);

            // VL53L0X_SetInterMeasurementPeriodMilliSeconds() end

            this.writeReg(SYSRANGE_START, 0x04); // VL53L0X_REG_SYSRANGE_MODE_TIMED
        } else {
            // continuous back-to-back mode
            this.writeReg(SYSRANGE_START, 0x02); // VL53L0X_REG_SYSRANGE_MODE_BACKTOBACK
        }
    }

    /**
     * Stop continuous measurements
     * based on VL53L0X_StopMeasurement()
     */
    stopContinuous () {
        this.writeReg(SYSRANGE_START, 0x01); // VL53L0X_REG_SYSRANGE_MODE_SINGLESHOT

        this.writeReg(0xFF, 0x01);
        this.writeReg(0x00, 0x00);
        this.writeReg(0x91, 0x00);
        this.writeReg(0x00, 0x01);
        this.writeReg(0xFF, 0x00);
    }

    /**
     * Returns a range reading in millimeters when continuous mode is active
     * (readRangeSingleMillimeters() also calls this function after starting a
     * single-shot range measurement)
     * @returns {Promise<number>} a Promise which resolves range for continuous mode
     */
    async readRangeContinuousMillimeters () {
        this.startTimeout();
        while ((await this.readReg(RESULT_INTERRUPT_STATUS) & 0x07) === 0) {
            if (this.checkTimeoutExpired()) {
                this.did_timeout = true;
                return Promise.reject(new Error(`timeout read RESULT_INTERRUPT_STATUS: ${this.io_timeout}ms`));
            }
        }

        // assumptions: Linearity Corrective Gain is 1000 (default);
        // fractional ranging is not enabled
        const range = await this.readReg16Bit(RESULT_RANGE_STATUS + 10);

        this.writeReg(SYSTEM_INTERRUPT_CLEAR, 0x01);

        return range;
    }

    /**
     * Performs a single-shot range measurement and returns the reading in millimeters
     * based on VL53L0X_PerformSingleRangingMeasurement()
     * @returns {Promise<number>} a Promise which resolves range for single-shot mode
     */
    async readRangeSingleMillimeters () {
        this.writeReg(0x80, 0x01);
        this.writeReg(0xFF, 0x01);
        this.writeReg(0x00, 0x00);
        this.writeReg(0x91, this.stop_variable);
        this.writeReg(0x00, 0x01);
        this.writeReg(0xFF, 0x00);
        this.writeReg(0x80, 0x00);

        this.writeReg(SYSRANGE_START, 0x01);

        // "Wait until start bit has been cleared"
        this.startTimeout();
        while (await this.readReg(SYSRANGE_START) & 0x01) {
            if (this.checkTimeoutExpired()) {
                this.did_timeout = true;
                return Promise.reject(new Error(`timeout read SYSRANGE_START: ${this.io_timeout}ms`));
            }
        }

        return this.readRangeContinuousMillimeters();
    }

    /**
     * Return whether a timeout did occur and clear the timeout flag.
     * @returns {boolean} whether a timeout occur or not
     */
    timeoutOccurred () {
        const tmp = this.did_timeout;
        this.did_timeout = false;
        return tmp;
    }

    /**
     * Get reference SPAD (single photon avalanche diode) count and type
     * based on VL53L0X_get_info_from_device(),
     * but only gets reference SPAD count and type
     * @param {object} info - info of SPAD
     * @param {number} info.count - SPAD count
     * @param {boolean} info.isAperture - SPAD is aperture type or not
     * @returns {Promise<boolean>} whether the info has got or not
     */
    async getSpadInfo (info) {
        this.writeReg(0x80, 0x01);
        this.writeReg(0xFF, 0x01);
        this.writeReg(0x00, 0x00);

        this.writeReg(0xFF, 0x06);
        this.writeReg(0x83, await this.readReg(0x83) | 0x04);
        this.writeReg(0xFF, 0x07);
        this.writeReg(0x81, 0x01);

        this.writeReg(0x80, 0x01);

        this.writeReg(0x94, 0x6b);
        this.writeReg(0x83, 0x00);
        this.startTimeout();
        while (await this.readReg(0x83) === 0x00) {
            if (this.checkTimeoutExpired()) {
                return false;
            }
        }
        this.writeReg(0x83, 0x01);
        const tmp = await this.readReg(0x92);

        info.count = tmp & 0x7f;
        info.isAperture = ((tmp >> 7) & 0x01) === 0x01;

        this.writeReg(0x81, 0x00);
        this.writeReg(0xFF, 0x06);
        this.writeReg(0x83, await this.readReg(0x83) & ~0x04);
        this.writeReg(0xFF, 0x01);
        this.writeReg(0x00, 0x01);

        this.writeReg(0xFF, 0x00);
        this.writeReg(0x80, 0x00);

        return true;
    }

    /**
     * Get sequence step enables
     * based on VL53L0X_GetSequenceStepEnables()
     * @param {Promise<object>} enables - reading buffer for sequence step enables
     */
    async getSequenceStepEnables (enables) {
        const sequence_config = await this.readReg(SYSTEM_SEQUENCE_CONFIG);

        enables.tcc = (sequence_config >> 4) & 0x1;
        enables.dss = (sequence_config >> 3) & 0x1;
        enables.msrc = (sequence_config >> 2) & 0x1;
        enables.pre_range = (sequence_config >> 6) & 0x1;
        enables.final_range = (sequence_config >> 7) & 0x1;
    }

    // Get sequence step timeouts
    // based on get_sequence_step_timeout(),
    // but gets all timeouts instead of just the requested one, and also stores
    // intermediate values
    async getSequenceStepTimeouts (enables, timeouts) {
        timeouts.pre_range_vcsel_period_pclks = await this.getVcselPulsePeriod(VcselPeriodPreRange);

        timeouts.msrc_dss_tcc_mclks = await this.readReg(MSRC_CONFIG_TIMEOUT_MACROP) + 1;
        timeouts.msrc_dss_tcc_us =
    this.timeoutMclksToMicroseconds(timeouts.msrc_dss_tcc_mclks,
        timeouts.pre_range_vcsel_period_pclks);

        // eslint-disable-next-line require-atomic-updates
        timeouts.pre_range_mclks =
    this.decodeTimeout(await this.readReg16Bit(PRE_RANGE_CONFIG_TIMEOUT_MACROP_HI));
        timeouts.pre_range_us =
    this.timeoutMclksToMicroseconds(timeouts.pre_range_mclks,
        timeouts.pre_range_vcsel_period_pclks);

        // eslint-disable-next-line require-atomic-updates
        timeouts.final_range_vcsel_period_pclks = await this.getVcselPulsePeriod(VcselPeriodFinalRange);

        // eslint-disable-next-line require-atomic-updates
        timeouts.final_range_mclks =
    this.decodeTimeout(await this.readReg16Bit(FINAL_RANGE_CONFIG_TIMEOUT_MACROP_HI));

        if (enables.pre_range) {
            timeouts.final_range_mclks -= timeouts.pre_range_mclks;
        }

        timeouts.final_range_us =
    this.timeoutMclksToMicroseconds(timeouts.final_range_mclks,
        timeouts.final_range_vcsel_period_pclks);
    }

    // Decode sequence step timeout in MCLKs from register value
    // based on VL53L0X_decode_timeout()
    // Note: the original function returned a uint32_t, but the return value is
    // always stored in a uint16_t.
    decodeTimeout (reg_val) {
        // format: "(LSByte * 2^MSByte) + 1"
        return ((reg_val & 0x00FF) <<
         ((reg_val & 0xFF00) >> 8)) + 1;
    }

    // Encode sequence step timeout register value from timeout in MCLKs
    // based on VL53L0X_encode_timeout()
    encodeTimeout (timeout_mclks) {
        // format: "(LSByte * 2^MSByte) + 1"

        let ls_byte = 0;
        let ms_byte = 0;

        if (timeout_mclks > 0) {
            ls_byte = timeout_mclks - 1;

            while ((ls_byte & 0xFFFFFF00) > 0) {
                ls_byte >>= 1;
                ms_byte++;
            }

            return (ms_byte << 8) | (ls_byte & 0xFF);
        }
        return 0;
    }

    // Convert sequence step timeout from MCLKs to microseconds with given VCSEL period in PCLKs
    // based on VL53L0X_calc_timeout_us()
    timeoutMclksToMicroseconds (timeout_period_mclks, vcsel_period_pclks) {
        const macro_period_ns = calcMacroPeriod(vcsel_period_pclks);

        return ((timeout_period_mclks * macro_period_ns) + 500) / 1000;
    }

    // Convert sequence step timeout from microseconds to MCLKs with given VCSEL period in PCLKs
    // based on VL53L0X_calc_timeout_mclks()
    timeoutMicrosecondsToMclks (timeout_period_us, vcsel_period_pclks) {
        const macro_period_ns = calcMacroPeriod(vcsel_period_pclks);

        return (((timeout_period_us * 1000) + (macro_period_ns / 2)) / macro_period_ns);
    }

    // based on VL53L0X_perform_single_ref_calibration()
    async performSingleRefCalibration (vhv_init_byte) {
        this.writeReg(SYSRANGE_START, 0x01 | vhv_init_byte); // VL53L0X_REG_SYSRANGE_MODE_START_STOP

        this.startTimeout();
        while ((await this.readReg(RESULT_INTERRUPT_STATUS) & 0x07) === 0) {
            if (this.checkTimeoutExpired()) {
                return false;
            }
        }

        this.writeReg(SYSTEM_INTERRUPT_CLEAR, 0x01);

        this.writeReg(SYSRANGE_START, 0x00);

        return true;
    }

    /**
     * Set the range profile.
     * @param {string} rangeProfile profile ID {'LONG_RANGE' | 'HIGH_SPEED' | 'HIGH_ACCURACY'}
     * @returns {Promise} a Promise which resolves the settings was done.
     */
    async setRangeProfile (rangeProfile) {
        switch (rangeProfile) {
        case 'LONG_RANGE':
            // lower the return signal rate limit (default is 0.25 MCPS)
            this.setSignalRateLimit(0.1);
            // set timing budget to 33 ms (near the default value)
            await this.setMeasurementTimingBudget(33000);
            // increase laser pulse periods (defaults are 14 and 10 PCLKs)
            await this.setVcselPulsePeriod(VcselPeriodPreRange, 18);
            await this.setVcselPulsePeriod(VcselPeriodFinalRange, 14);
            break;
        
        case 'HIGH_SPEED':
            this.setSignalRateLimit(0.25);
            // reduce timing budget to 20 ms (default is about 33 ms)
            await this.setMeasurementTimingBudget(20000);
            await this.setVcselPulsePeriod(VcselPeriodPreRange, 14);
            await this.setVcselPulsePeriod(VcselPeriodFinalRange, 10);
            break;

        case 'HIGH_ACCURACY':
            this.setSignalRateLimit(0.25);
            // increase timing budget to 200 ms
            await this.setMeasurementTimingBudget(200000);
            await this.setVcselPulsePeriod(VcselPeriodPreRange, 14);
            await this.setVcselPulsePeriod(VcselPeriodFinalRange, 10);
            break;

        default:
            // set the default profile
            this.setSignalRateLimit(0.25);
            await this.setMeasurementTimingBudget(30000);
            await this.setVcselPulsePeriod(VcselPeriodPreRange, 14);
            await this.setVcselPulsePeriod(VcselPeriodFinalRange, 10);
            break;
        }

    }
}
