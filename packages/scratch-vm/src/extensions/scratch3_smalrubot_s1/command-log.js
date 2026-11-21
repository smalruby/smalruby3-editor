/**
 * The record of the commands the Studuino blocks sent and the sensor values they read (#2193).
 *
 * The lessons judge "done" with it (#2158 Q6 = A): the same entries are recorded
 * whether a real board is connected or not (the practice board), so a challenge
 * is judged by the same facts on both.
 *
 * An entry is a plain object:
 *
 *   {seq, t, board, kind, port, value, speed?, sensor?}
 *
 * - `seq`: a number that grows by 1 for every entry (it is not reset by `clear`).
 * - `t`: milliseconds since the record was cleared (or made).
 * - `board`: 'device' (the real board) or 'practice' (the practice board).
 * - `kind`: 'led' | 'motor' | 'servo' | 'servoCalibration' | 'sensorRead'.
 * - `port`: 'A0' / 'A1' (led), 'M1' / 'M2' (motor), 'D10' (servo), 'A2' / 'A4' / 'A5' / 'A6' / 'A7' (sensorRead).
 * - `value`: 'on' / 'off' (led), 'normal' / 'reverse' / 'stop' (motor), degrees (servo, servoCalibration),
 *   the value read (sensorRead).
 * - `speed`: the speed in % (motor. 0 when stopped).
 * - `sensor`: 'touch' | 'irPhotoreflector' | 'light' | 'sound' (sensorRead).
 *
 * The record keeps the latest `max` entries (older ones are dropped). Every new
 * entry is sent with the runtime event `STUDUINO_COMMAND_LOG`, and clearing it
 * with `STUDUINO_COMMAND_LOG_CLEAR`. It is never saved in the project.
 */

const ENTRY_EVENT = 'STUDUINO_COMMAND_LOG';
const CLEAR_EVENT = 'STUDUINO_COMMAND_LOG_CLEAR';
const DEFAULT_MAX_ENTRIES = 1000;

class StuduinoCommandLog {
    /**
     * @returns {string} - the runtime event sent with every new entry.
     */
    static get ENTRY_EVENT() {
        return ENTRY_EVENT;
    }

    /**
     * @returns {string} - the runtime event sent when the record is cleared.
     */
    static get CLEAR_EVENT() {
        return CLEAR_EVENT;
    }

    /**
     * @returns {number} - the number of entries kept by default.
     */
    static get DEFAULT_MAX_ENTRIES() {
        return DEFAULT_MAX_ENTRIES;
    }

    /**
     * @param {Runtime} runtime - the runtime to send the events with.
     * @param {object} [options] - options.
     * @param {number} [options.max] - the number of entries to keep.
     * @param {function(): number} [options.now] - the clock in milliseconds (for tests).
     */
    constructor(runtime, { max = DEFAULT_MAX_ENTRIES, now = () => Date.now() } = {}) {
        this.runtime = runtime;
        this.max = max;
        this.now = now;
        this.entries = [];
        this.seq = 0;
        this.startedAt = this.now();
    }

    emit(eventName, data) {
        if (this.runtime && typeof this.runtime.emit === 'function') {
            this.runtime.emit(eventName, data);
        }
    }

    /**
     * Add an entry.
     * @param {string} board - 'device' or 'practice'.
     * @param {object} fact - `{kind, port, value}` and `speed` / `sensor` when they apply.
     * @returns {object} - a copy of the entry.
     */
    record(board, fact) {
        this.seq += 1;
        const entry = Object.assign({ seq: this.seq, t: this.now() - this.startedAt, board }, fact);
        this.entries.push(entry);
        if (this.entries.length > this.max) {
            this.entries.splice(0, this.entries.length - this.max);
        }
        const copy = Object.assign({}, entry);
        this.emit(ENTRY_EVENT, copy);
        return copy;
    }

    /**
     * @param {number} [limit] - only the latest `limit` entries.
     * @returns {Array<object>} - copies of the entries, oldest first.
     */
    getEntries(limit) {
        let entries = this.entries;
        if (typeof limit === 'number' && limit >= 0) {
            entries = limit === 0 ? [] : entries.slice(-limit);
        }
        return entries.map((entry) => Object.assign({}, entry));
    }

    /**
     * Remove all entries and start the time (`t`) again from 0.
     */
    clear() {
        this.entries = [];
        this.startedAt = this.now();
        this.emit(CLEAR_EVENT);
    }
}

module.exports = StuduinoCommandLog;
