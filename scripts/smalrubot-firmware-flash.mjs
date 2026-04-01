#!/usr/bin/env node
/**
 * SmalrubotS1 Firmware Flash Tool — Node.js CLI
 *
 * Flashes firmware to Studuino (ATmega168) boards via serial port.
 * Works on macOS, Windows, and Linux.
 *
 * Usage:
 *   node scripts/smalrubot-firmware-flash.mjs <serial-port> [hex-file]
 *
 * Examples:
 *   node scripts/smalrubot-firmware-flash.mjs /dev/tty.usbserial-110
 *   node scripts/smalrubot-firmware-flash.mjs /dev/tty.usbserial-110 firmware.hex
 *   node scripts/smalrubot-firmware-flash.mjs COM3
 *
 * If hex-file is omitted, the bundled sr_studu v1.1.0 firmware is used.
 *
 * Prerequisites:
 *   npm install serialport   (in the monorepo root)
 */

import { SerialPort } from 'serialport';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Board Configuration ---

const SMALRUBOT_S1 = {
    baudRate: 115200,
    pageSize: 128,
    signature: new Uint8Array([0x1e, 0x94, 0x06]), // ATmega168
    timeout: 400,
};

// --- STK500v1 Protocol Constants ---

const CMD = {
    GET_SYNC: 0x30,
    READ_SIGN: 0x75,
    SET_DEVICE: 0x42,
    ENTER_PROGMODE: 0x50,
    LEAVE_PROGMODE: 0x51,
    LOAD_ADDRESS: 0x55,
    PROG_PAGE: 0x64,
};

const RESP = {
    INSYNC: 0x14,
    OK: 0x10,
};

const EOP = 0x20;

// --- Intel HEX Parser ---

function parseIntelHex(hexText) {
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
}

// --- STK500v1 Protocol for Node.js SerialPort ---

class STK500v1 {
    constructor(port, options = {}) {
        this.port = port;
        this.debug = options.debug || false;
        this._buf = [];
        this._pending = null;
        this._dataHandler = null;
    }

    _startReader() {
        this._dataHandler = chunk => {
            for (const b of chunk) this._buf.push(b);
            if (this.debug) {
                const hex = Array.from(chunk)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join(' ');
                process.stderr.write(`  RX [${hex}] buf=${this._buf.length}\n`);
            }
            if (this._pending && this._buf.length >= this._pending.count) {
                clearTimeout(this._pending.timerId);
                const { count, resolve } = this._pending;
                this._pending = null;
                resolve(new Uint8Array(this._buf.splice(0, count)));
            }
        };
        this.port.on('data', this._dataHandler);
    }

    _stopReader() {
        if (this._dataHandler) {
            this.port.removeListener('data', this._dataHandler);
            this._dataHandler = null;
        }
    }

    _recv(count, timeout) {
        return new Promise((resolve, reject) => {
            if (this._buf.length >= count) {
                return resolve(new Uint8Array(this._buf.splice(0, count)));
            }
            const timerId = setTimeout(() => {
                this._pending = null;
                reject(
                    new Error(
                        `Receive timeout ${timeout}ms (expected=${count}, received=${this._buf.length})`,
                    ),
                );
            }, timeout);
            this._pending = { count, resolve, reject, timerId };
        });
    }

    _flushRecv() {
        this._buf = [];
    }

    _write(data) {
        return new Promise((resolve, reject) => {
            const buf = Buffer.from(data);
            if (this.debug) {
                const hex = Array.from(buf)
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join(' ');
                process.stderr.write(`TX [${hex}]\n`);
            }
            this.port.write(buf, err => {
                if (err) return reject(err);
                this.port.drain(drainErr => {
                    if (drainErr) return reject(drainErr);
                    resolve();
                });
            });
        });
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

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
        const sig = Array.from(resp.subarray(1, 4))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
        console.log(`  Signature OK: [${sig}]`);
    }

    async setDevice(pageSize, timeout) {
        const pagesizehigh = (pageSize >> 8) & 0xff;
        const pagesizelow = pageSize & 0xff;
        const params = [
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            pagesizehigh, pagesizelow,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
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
            throw new Error(
                `progPage error [0x${resp[0].toString(16)} 0x${resp[1].toString(16)}]`,
            );
        }
    }

    async leaveProgrammingMode(timeout) {
        await this._cmd([CMD.LEAVE_PROGMODE], timeout);
    }

    async flash(hexData, board, onProgress) {
        const { pageSize, signature, timeout } = board;

        this._startReader();

        try {
            // Stage 1: sync immediately after open (macOS/PL2303: open triggers reset)
            console.log('  Syncing (after open)...');
            let synced = false;
            try {
                await this.sync(3, timeout);
                synced = true;
                console.log('  Sync OK (after open)');
            } catch (_) {
                // open didn't trigger reset, will not attempt DTR reset for Node.js
                // (Node.js serialport open already handles DTR)
            }

            if (!synced) {
                // Retry with longer wait
                console.log('  Retrying sync...');
                await this._delay(1500);
                await this.sync(3, timeout);
                console.log('  Sync OK (retry)');
            }

            // Additional sync rounds for stability
            await this.sync(3, timeout);
            await this.sync(3, timeout);

            console.log('  Verifying signature...');
            await this.verifySignature(signature, timeout);

            await this.setDevice(pageSize, timeout);
            await this.enterProgrammingMode(timeout);

            let addr = 0;
            let page = 0;
            const totalPages = Math.ceil(hexData.length / pageSize);

            while (addr < hexData.length) {
                page++;
                const end = Math.min(addr + pageSize, hexData.length);
                const pageData = hexData.slice(addr, end);

                await this.loadAddress(addr, timeout);
                await this.progPage(pageData, timeout);

                if (onProgress) onProgress(addr + pageData.length, hexData.length);

                const pct = Math.floor(((addr + pageData.length) / hexData.length) * 100);
                process.stdout.write(`\r  Page ${page}/${totalPages} (${pct}%)`);

                addr += pageData.length;
                await this._delay(4);
            }
            process.stdout.write('\n');

            await this.leaveProgrammingMode(timeout);
            console.log(`  Flash complete (${addr} bytes, ${page} pages)`);
        } finally {
            this._stopReader();
        }
    }
}

// --- Main ---

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1 || args.includes('--help') || args.includes('-h')) {
        console.log(`SmalrubotS1 Firmware Flash Tool

Usage:
  node scripts/smalrubot-firmware-flash.mjs <serial-port> [hex-file]

Arguments:
  serial-port   Serial port path (e.g., /dev/tty.usbserial-110, COM3)
  hex-file      Intel HEX file path (optional, uses bundled v1.1.0 firmware if omitted)

Examples:
  node scripts/smalrubot-firmware-flash.mjs /dev/tty.usbserial-110
  node scripts/smalrubot-firmware-flash.mjs /dev/tty.usbserial-110 my-firmware.hex
  node scripts/smalrubot-firmware-flash.mjs COM3`);
        process.exit(args.length < 1 ? 1 : 0);
    }

    const portPath = args[0];
    let hexText;

    if (args.length >= 2) {
        const hexPath = args[1];
        if (!fs.existsSync(hexPath)) {
            console.error(`Error: File not found: ${hexPath}`);
            process.exit(1);
        }
        hexText = fs.readFileSync(hexPath, 'utf-8');
        console.log(`HEX file: ${hexPath}`);
    } else {
        // Use bundled firmware
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const bundledHexPath = path.join(
            __dirname,
            '../packages/scratch-gui/src/lib/smalrubot-firmware.hex.js',
        );
        if (fs.existsSync(bundledHexPath)) {
            // Extract hex data from the JS module
            const jsContent = fs.readFileSync(bundledHexPath, 'utf-8');
            const match = jsContent.match(/`([\s\S]*?)`/);
            if (match) {
                hexText = match[1];
            }
        }
        if (!hexText) {
            console.error('Error: Bundled firmware not found. Provide a hex file path.');
            process.exit(1);
        }
        console.log('Using bundled sr_studu v1.1.0 firmware');
    }

    const hexData = parseIntelHex(hexText);
    console.log(`HEX parsed: ${hexData.length} bytes`);
    console.log(`Opening port: ${portPath} (${SMALRUBOT_S1.baudRate} baud)`);

    const port = new SerialPort({
        path: portPath,
        baudRate: SMALRUBOT_S1.baudRate,
        autoOpen: false,
    });

    try {
        await new Promise((resolve, reject) => {
            port.open(err => {
                if (err) return reject(new Error(`Port open failed: ${err.message}`));
                resolve();
            });
        });
        console.log('Port opened, starting flash...');

        const flasher = new STK500v1(port, { debug: false });
        await flasher.flash(hexData, SMALRUBOT_S1);

        console.log('\n✓ Flash successful!');
    } catch (err) {
        console.error(`\n✗ Flash failed: ${err.message}`);
        process.exitCode = 1;
    } finally {
        await new Promise(resolve => port.close(() => resolve()));
        console.log('Port closed');
    }
}

main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
