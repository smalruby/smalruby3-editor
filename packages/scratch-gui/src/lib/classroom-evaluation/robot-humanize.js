/**
 * Japanese phrases for the robot blocks (アーテックロボ = smalrubotS1) in the
 * grading pseudocode (#2423).
 *
 * The analyzer has no label for extension blocks, so a robot block came out
 * as its raw opcode (`[smalrubotS1_bendArm] SECS=1, DEGREE=100`). A teacher
 * reading 35 works cannot read that quickly. These phrases follow the
 * Japanese block text (locales `smalrubotS1.*`) but are shortened to what a
 * grader needs: what moves and how.
 *
 * Pure module: no VM, no DOM, no I/O.
 */

const ROBOT_PREFIX = 'smalrubotS1_';

/** Menu value → word, from the `smalrubotS1.*Menu.*` locale texts. */
const SIDE = { left: '左', right: '右' };
const ACTION = {
    forward: '進む',
    backward: '下がる',
    left: '左に曲がる',
    right: '右に曲がる',
    stop: '止まる',
};
const MOTOR_DIRECTION = { normal: '正転させる', reverse: '逆転させる', stop: '止める' };
const SENSOR = {
    left: '左のセンサー',
    right: '右のセンサー',
    touch: 'タッチセンサー',
    light: '光センサー',
    sound: '音センサー',
    ir_a4: '赤外線センサー（A4）',
    ir_a5: '赤外線センサー（A5）',
};

/**
 * Look a menu value up, keeping an unknown value as it is.
 * @param {object} table - value → word
 * @param {string} value - menu value
 * @returns {string} the word
 */
const word = (table, value) => table[value] || value;

/**
 * The phrase of each robot block (opcode without the `smalrubotS1_` prefix).
 * Each takes the resolved arguments ({NAME: text}).
 */
const ROBOT_PHRASES = {
    action: (a) => `モーターで${word(ACTION, a.ACTION)}`,
    actionAndStopAfter: (a) => `モーターで${word(ACTION, a.ACTION)}（${a.SECS} 秒で止まる）`,
    bendArm: (a) => `サーボを ${a.DEGREE} 度に曲げる（${a.SECS} 秒）`,
    setArmCalibration: (a) => `サーボを ${a.DEGREE} 度調整する`,
    turnLedOn: (a) => `${word(SIDE, a.POSITION)}の LED を点ける`,
    turnLedOff: (a) => `${word(SIDE, a.POSITION)}の LED を消す`,
    getSensorValue: (a) => `${word(SENSOR, a.POSITION)}の値`,
    getMotorSpeed: (a) => `${word(SIDE, a.POSITION)}のモーターの速さ`,
    setMotorSpeed: (a) => `${word(SIDE, a.POSITION)}のモーターの速さを ${a.SPEED} % にする`,
    controlMotor: (a) => `モーター ${a.MOTOR} を${word(MOTOR_DIRECTION, a.DIRECTION)}`,
    controlMotorAndStopAfter: (a) =>
        `モーター ${a.MOTOR} を${word(MOTOR_DIRECTION, a.DIRECTION)}（${a.SECS} 秒で止まる）`,
};

/**
 * The Japanese phrase of a robot block.
 * @param {string} opcode - full opcode (e.g. `smalrubotS1_bendArm`)
 * @param {object} args - argument name → resolved text
 * @returns {?string} the phrase, or null when the block is not a known robot block
 */
const humanizeRobotBlock = (opcode, args) => {
    if (typeof opcode !== 'string' || !opcode.startsWith(ROBOT_PREFIX)) return null;
    const phrase = ROBOT_PHRASES[opcode.slice(ROBOT_PREFIX.length)];
    if (!phrase) return null;
    const resolved = new Proxy(args || {}, {
        get: (target, name) => (name in target ? target[name] : '?'),
    });
    return phrase(resolved);
};

// `[smalrubotS1_bendArm] SECS=1, DEGREE=100` — the analyzer's raw fallback.
// The arguments are `KEY=value` pairs (menu values and numbers have no spaces),
// so a reporter inside a sentence keeps the words after it:
// `変数 明るさ を [smalrubotS1_getSensorValue] POSITION=left にする`.
const RAW_ROBOT_RE = /\[(smalrubotS1_\w+)\](?: ([A-Z][A-Z0-9_]*=[^\s,]*(?:, [A-Z][A-Z0-9_]*=[^\s,]*)*))?/g;

/**
 * Parse the `K=V, K=V` arguments of the raw fallback form. A value may itself
 * hold commas (a nested reporter), so it splits only before `NAME=`.
 * @param {string} text - the arguments text
 * @returns {object} argument name → text
 */
const parseRawArgs = (text) => {
    const args = {};
    if (!text) return args;
    for (const part of text.split(/, (?=[A-Z][A-Z0-9_]*=)/)) {
        const at = part.indexOf('=');
        if (at > 0) args[part.slice(0, at)] = part.slice(at + 1);
    }
    return args;
};

/**
 * Rewrite raw robot blocks in already rendered pseudocode into phrases, so a
 * pseudocode saved before the phrases existed compares equal to a new one.
 * Unknown robot opcodes stay as they are.
 * @param {string} pseudocode - pseudocode text
 * @returns {string} the text with known robot blocks humanized
 */
const humanizePseudocode = (pseudocode) =>
    String(pseudocode || '').replace(RAW_ROBOT_RE, (whole, opcode, argsText) => {
        const phrase = humanizeRobotBlock(opcode, parseRawArgs(argsText));
        return phrase === null ? whole : phrase;
    });

/**
 * What a robot phrase does, for grouping works (numbers and sides ignored).
 * Each entry: [pattern, part, operation name]. A line may match several
 * (a sensor read inside a condition).
 */
const ROBOT_OPERATION_PATTERNS = [
    [/サーボを .+ 度に曲げる/, 'servo', 'サーボを曲げる'],
    [/サーボを .+ 度調整する/, 'servo', 'サーボを調整する'],
    [/LED を点ける/, 'led', 'LED を点ける'],
    [/LED を消す/, 'led', 'LED を消す'],
    [/モーターの速さを .+ にする/, 'motor', 'モーターの速さを変える'],
    [/モーターの速さ(?!を)/, 'motor', 'モーターの速さを調べる'],
    [/センサー(（A\d）)?の値/, 'sensor', 'センサーの値を調べる'],
];

/**
 * The robot operations a pseudocode line does.
 * @param {string} line - one pseudocode line
 * @returns {Array<{part: string, operation: string}>} part is 'motor' | 'servo' | 'led' | 'sensor'
 */
const robotOperationsOf = (line) => {
    const text = humanizePseudocode(line);
    const found = [];
    const drive = text.match(/モーターで(\S+?)(（.+ 秒で止まる）)?$/);
    if (drive) {
        found.push({ part: 'motor', operation: `モーターで${drive[1]}${drive[2] ? '（時間で止まる）' : ''}` });
    }
    const motor = text.match(/モーター \S+ を(\S+?)(（.+ 秒で止まる）)?$/);
    if (motor) {
        found.push({ part: 'motor', operation: `モーターを${motor[1]}${motor[2] ? '（時間で止まる）' : ''}` });
    }
    for (const [pattern, part, operation] of ROBOT_OPERATION_PATTERNS) {
        if (pattern.test(text)) found.push({ part, operation });
    }
    const raw = text.match(/\[smalrubotS1_(\w+)\]/);
    if (raw) found.push({ part: 'robot', operation: raw[1] });
    return found;
};

export { humanizeRobotBlock, humanizePseudocode, robotOperationsOf, ROBOT_PREFIX };
