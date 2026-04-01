/**
 * SmalrubotS1 Firmware Flasher — WebSerial STK500v1 Implementation
 *
 * Flashes firmware to Studuino (ATmega168) boards via WebSerial API.
 * Supported on Windows and ChromeOS Chrome browsers.
 * macOS is NOT supported due to PL2303 USB-Serial chip limitations.
 *
 * Protocol: STK500v1 (Optiboot bootloader)
 * Reference: notes/issues/52/smalruby-integration/firmware-flasher.js
 */
import SR_STUDU_FIRMWARE_HEX from './smalrubot-firmware.hex.js';

// STK500v1 command bytes
const CMD = {
    GET_SYNC: 0x30,
    READ_SIGN: 0x75,
    SET_DEVICE: 0x42,
    ENTER_PROGMODE: 0x50,
    LEAVE_PROGMODE: 0x51,
    LOAD_ADDRESS: 0x55,
    PROG_PAGE: 0x64,
};

// STK500v1 response bytes
const RESP = {
    INSYNC: 0x14,
    OK: 0x10,
};

// Command terminator
const EOP = 0x20;

// SmalrubotS1 (Studuino / ATmega168) board configuration
const SMALRUBOT_S1_BOARD = {
    baudRate: 115200,
    pageSize: 128,
    signature: new Uint8Array([0x1e, 0x94, 0x06]),
    timeout: 400,
    usbFilters: [
        { usbVendorId: 0x067b, usbProductId: 0x2303 }, // Studuino TA
        { usbVendorId: 0x067b, usbProductId: 0x23a3 }, // Studuino GC
        { usbVendorId: 0x067b, usbProductId: 0x23f3 }, // Studuino GS
    ],
};

/**
 * Parse Intel HEX text into a binary Uint8Array.
 * @param {string} hexText - Intel HEX format text.
 * @returns {Uint8Array} Parsed binary data.
 */
const parseIntelHex = hexText => {
    const result = [];
    for (const line of hexText.split(/\r?\n/)) {
        const t = line.trim();
        if (!t.startsWith(':')) continue;
        const byteCount = parseInt(t.slice(1, 3), 16);
        const recordType = parseInt(t.slice(7, 9), 16);
        if (recordType === 0) {
            for (let i = 0; i < byteCount; i++) {
                result.push(parseInt(t.slice(9 + i * 2, 11 + i * 2), 16));
            }
        } else if (recordType === 1) {
            break;
        }
    }
    return new Uint8Array(result);
};

/**
 * Check if the current platform is macOS.
 * @returns {boolean} True if running on macOS.
 */
const isMacOS = () => {
    if (typeof navigator !== 'undefined' && navigator.userAgentData && navigator.userAgentData.platform) {
        return navigator.userAgentData.platform === 'macOS';
    }
    if (typeof navigator !== 'undefined' && navigator.platform) {
        return /Mac/.test(navigator.platform);
    }
    return false;
};

/**
 * Check if firmware flashing is supported on this platform.
 * Requires WebSerial API and a non-macOS platform.
 * @returns {boolean} True if firmware flashing is supported.
 */
const isFirmwareFlashSupported = () => {
    if (typeof navigator === 'undefined') return false;
    if (!navigator.serial) return false;
    if (isMacOS()) return false;
    return true;
};

/**
 * STK500v1 protocol implementation for WebSerial.
 *
 * Design principles:
 * - Fully sequential send→receive (no overlapping)
 * - Response parsing uses for loops (not forEach+return)
 * - Expected byte count based receive with timeout
 */
class STK500v1 {
    /**
     * @param {SerialPort} port - An opened WebSerial port.
     * @param {object} [options] - Options.
     * @param {boolean} [options.debug] - Enable debug logging.
     * @param {Function} [options.logger] - Log function.
     */
    constructor(port, options = {}) {
        this.port = port;
        this.debug = options.debug || false;
        this._log = options.logger || (() => {});
        this._buf = [];
        this._pending = null;
        this._reader = null;
        this._writer = null;
        this._stopped = false;
    }

    // -- Receive --

    _startReader() {
        this._stopped = false;
        this._reader = this.port.readable.getReader();
        (async () => {
            try {
                while (!this._stopped) {
                    const { value, done } = await this._reader.read();
                    if (done) break;
                    if (value) this._onData(value);
                }
            } catch (e) {
                if (!this._stopped && this._pending) {
                    clearTimeout(this._pending.timerId);
                    const { reject } = this._pending;
                    this._pending = null;
                    reject(new Error(`Reader error: ${e.message}`));
                }
            }
        })();
    }

    async _stopReader() {
        this._stopped = true;
        if (this._reader) {
            try {
                await this._reader.cancel();
            } catch (_) {
                // ignore
            }
            this._reader.releaseLock();
            this._reader = null;
        }
    }

    _onData(chunk) {
        for (const b of chunk) this._buf.push(b);
        if (this._pending && this._buf.length >= this._pending.count) {
            clearTimeout(this._pending.timerId);
            const { count, resolve } = this._pending;
            this._pending = null;
            resolve(new Uint8Array(this._buf.splice(0, count)));
        }
    }

    _recv(count, timeout) {
        return new Promise((resolve, reject) => {
            if (this._buf.length >= count) {
                return resolve(new Uint8Array(this._buf.splice(0, count)));
            }
            const timerId = setTimeout(() => {
                this._pending = null;
                reject(new Error(`Receive timeout ${timeout}ms (expected=${count}, received=${this._buf.length})`));
            }, timeout);
            this._pending = { count, resolve, reject, timerId };
        });
    }

    _flushRecv() {
        this._buf = [];
    }

    // -- Send --

    async _write(data) {
        await this._writer.write(data instanceof Uint8Array ? data : new Uint8Array(data));
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // -- STK500v1 Commands --

    async _cmd(cmdBytes, timeout) {
        await this._write(new Uint8Array([...cmdBytes, EOP]));
        const resp = await this._recv(2, timeout);
        if (resp[0] !== RESP.INSYNC) {
            throw new Error(`INSYNC mismatch 0x${resp[0].toString(16)}`);
        }
        if (resp[1] !== RESP.OK) {
            throw new Error(`OK mismatch 0x${resp[1].toString(16)}`);
        }
    }

    async sync(attempts, timeout) {
        for (let i = 1; i <= attempts; i++) {
            this._flushRecv();
            try {
                await this._cmd([CMD.GET_SYNC], timeout);
                return;
            } catch (e) {
                if (i === attempts) {
                    throw new Error(`Sync failed (${attempts} attempts): ${e.message}`);
                }
                await this._delay(100);
            }
        }
    }

    async verifySignature(expectedSig, timeout) {
        await this._write(new Uint8Array([CMD.READ_SIGN, EOP]));
        const resp = await this._recv(5, timeout);
        if (resp[0] !== RESP.INSYNC) {
            throw new Error(`verifySignature INSYNC mismatch 0x${resp[0].toString(16)}`);
        }
        if (resp[4] !== RESP.OK) {
            throw new Error(`verifySignature OK mismatch 0x${resp[4].toString(16)}`);
        }
        if (expectedSig) {
            for (let i = 0; i < 3; i++) {
                if (resp[i + 1] !== expectedSig[i]) {
                    const got = Array.from(resp.subarray(1, 4))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');
                    const exp = Array.from(expectedSig)
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');
                    throw new Error(`Signature mismatch: got [${got}], expected [${exp}]`);
                }
            }
        }
    }

    async setDevice(pageSize, timeout) {
        const pagesizehigh = (pageSize >> 8) & 0xff;
        const pagesizelow = pageSize & 0xff;
        const params = [
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            pagesizehigh,
            pagesizelow,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
        ];
        await this._cmd([CMD.SET_DEVICE, ...params], timeout);
    }

    async enterProgrammingMode(timeout) {
        await this._cmd([CMD.ENTER_PROGMODE], timeout);
    }

    async loadAddress(byteAddr, timeout) {
        const w = byteAddr >> 1;
        await this._cmd([CMD.LOAD_ADDRESS, w & 0xff, (w >> 8) & 0xff], timeout);
    }

    async progPage(pageData, timeout) {
        const size = pageData.length;
        const cmd = new Uint8Array(4 + size + 1);
        cmd[0] = CMD.PROG_PAGE;
        cmd[1] = (size >> 8) & 0xff;
        cmd[2] = size & 0xff;
        cmd[3] = 0x46; // 'F' = Flash
        cmd.set(pageData, 4);
        cmd[4 + size] = EOP;
        await this._write(cmd);
        const resp = await this._recv(2, timeout);
        if (resp[0] !== RESP.INSYNC || resp[1] !== RESP.OK) {
            throw new Error(`progPage error [0x${resp[0].toString(16)} 0x${resp[1].toString(16)}]`);
        }
    }

    async leaveProgrammingMode(timeout) {
        await this._cmd([CMD.LEAVE_PROGMODE], timeout);
    }

    // -- Board Reset --

    async resetBoard() {
        await this.port.setSignals({
            dataTerminalReady: false,
            requestToSend: false,
        });
        await this._delay(250);
        await this.port.setSignals({
            dataTerminalReady: true,
            requestToSend: true,
        });
        await this._delay(50);
        await this._delay(1500); // bootloader startup wait
    }

    // -- Main Flash --

    /**
     * Flash firmware data to the board.
     *
     * Reset strategy (conservative two-stage):
     * 1. Try sync immediately after port.open() (macOS/PL2303: open triggers reset)
     * 2. If that fails, DTR+RTS reset then retry (Windows/Linux)
     * @param {Uint8Array} hexData - Parsed binary firmware data.
     * @param {object} board - Board configuration (SMALRUBOT_S1_BOARD).
     * @param {Function} [onProgress] - Progress callback (written, total).
     * @param {Function} [onStatus] - Status message callback.
     */
    async flash(hexData, board, onProgress, onStatus) {
        const status = msg => {
            if (this.debug) this._log(msg);
            if (onStatus) onStatus(msg);
        };
        const { pageSize, signature, timeout } = board;

        this._writer = this.port.writable.getWriter();
        this._startReader();

        try {
            // Stage 1: sync immediately after open
            status('Syncing (after open)...');
            let synced = false;
            try {
                await this.sync(3, timeout);
                synced = true;
                status('Sync OK (after open)');
            } catch (_) {
                // Stage 2: DTR+RTS reset
                status('Resetting board (DTR+RTS)...');
                await this.resetBoard();
                status('Syncing (after reset)...');
                await this.sync(3, timeout);
                status('Sync OK (after reset)');
                synced = true;
            }

            if (synced) {
                // Additional sync rounds for stability
                await this.sync(3, timeout);
                await this.sync(3, timeout);
            }

            status('Verifying signature...');
            await this.verifySignature(signature, timeout);
            status('Signature OK');

            await this.setDevice(pageSize, timeout);
            await this.enterProgrammingMode(timeout);

            let addr = 0;
            let page = 0;
            const totalPages = Math.ceil(hexData.length / pageSize);

            while (addr < hexData.length) {
                page++;
                const end = Math.min(addr + pageSize, hexData.length);
                const pageData = hexData.slice(addr, end);

                status(`Page ${page}/${totalPages}`);

                await this.loadAddress(addr, timeout);
                await this.progPage(pageData, timeout);
                if (onProgress) {
                    onProgress(addr + pageData.length, hexData.length);
                }

                addr += pageData.length;
                await this._delay(4); // inter-page delay (avrgirl timing)
            }

            await this.leaveProgrammingMode(timeout);
            status(`Flash complete (${addr} bytes, ${page} pages)`);
        } finally {
            await this._stopReader();
            this._writer.releaseLock();
            this._writer = null;
        }
    }
}

/**
 * High-level firmware flasher for SmalrubotS1.
 * Handles port selection, hex parsing, and flashing.
 */
class FirmwareFlasher {
    /**
     * @param {object} [options] - Options.
     * @param {boolean} [options.debug] - Enable debug logging.
     * @param {Function} [options.logger] - Log function.
     */
    constructor(options = {}) {
        this.debug = options.debug || false;
        this._logger =
            options.logger ||
            (msg => {
                // eslint-disable-next-line no-console
                console.log('[FirmwareFlasher]', msg);
            });
    }

    /**
     * Flash the default firmware using a new port selection.
     * @param {Function} [onProgress] - Progress callback (written, total).
     * @param {Function} [onStatus] - Status message callback.
     */
    async flashDefaultFirmware(onProgress = null, onStatus = null) {
        const hexData = parseIntelHex(SR_STUDU_FIRMWARE_HEX);

        const port = await navigator.serial.requestPort({
            filters: SMALRUBOT_S1_BOARD.usbFilters,
        });

        await port.open({ baudRate: SMALRUBOT_S1_BOARD.baudRate });

        const stk = new STK500v1(port, {
            debug: this.debug,
            logger: this._logger,
        });

        try {
            await stk.flash(hexData, SMALRUBOT_S1_BOARD, onProgress, onStatus);
        } finally {
            await port.close();
        }
    }
}

export {
    parseIntelHex,
    isMacOS,
    isFirmwareFlashSupported,
    STK500v1,
    FirmwareFlasher,
    SMALRUBOT_S1_BOARD,
    SR_STUDU_FIRMWARE_HEX,
};
