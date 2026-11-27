/**
 * Group the works of a class by what the students added (#2423).
 *
 * A teacher grading 35 robot works does not need to read 35 programs: most
 * fall into a few kinds (「LED だけ」「モーターとサーボ」…). The signature of a
 * work is the set of operations in the scripts it added to the starter
 * (see starter-diff.js), with numbers, sides and texts ignored, so 「サーボを
 * 90 度に曲げる」 and 「サーボを 120 度に曲げる」 are the same kind of work.
 *
 * Pure module: no VM, no DOM, no I/O.
 */
import { robotOperationsOf } from './robot-humanize.js';
import { OPCODE_LABELS, isHatOpcode } from './sb3-analyzer.js';

const PLACEHOLDER = '…';

/**
 * Order strings by code point, the same on every machine (`localeCompare`
 * depends on the runtime's locale data).
 * @param {string} a - first
 * @param {string} b - second
 * @returns {number} sort order
 */
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Line patterns of the analyzer's labels, most specific (longest literal
 * text) first, so 「{MESSAGE} と {SECS} 秒言う」 wins over 「{MESSAGE} と言う」.
 */
const LABEL_PATTERNS = Object.entries(OPCODE_LABELS)
    .map(([opcode, template]) => {
        const parts = template.split(/\{\w+\}/);
        const source = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)');
        return {
            regex: new RegExp(`^${source}$`),
            operation: parts.join(PLACEHOLDER),
            hat: isHatOpcode(opcode),
            weight: parts.join('').length,
        };
    })
    .sort((a, b) => b.weight - a.weight);

/**
 * The operations one pseudocode line does.
 * @param {string} line - one line (indentation allowed)
 * @returns {Array<{part: string, operation: string, hat: boolean}>} part is
 *   'motor' | 'servo' | 'led' | 'sensor' | 'robot' for robot blocks, else 'other'
 */
const operationsOfLine = (line) => {
    const text = String(line || '').trim();
    if (!text || text === 'でなければ:') return [];
    const found = robotOperationsOf(text).map((op) => ({ ...op, hat: false }));
    if (/^自作ブロック「/.test(text)) return [...found, { part: 'other', operation: '自作ブロック', hat: false }];
    if (/^ブロック定義「/.test(text)) return [...found, { part: 'other', operation: 'ブロック定義', hat: true }];
    const label = LABEL_PATTERNS.find((p) => p.regex.test(text));
    if (label) return [...found, { part: 'other', operation: label.operation, hat: label.hat }];
    // A line that is only a robot block is fully described by the robot op.
    if (found.length > 0) return found;
    return [{ part: 'other', operation: text.replace(/-?\d+(\.\d+)?/g, '#'), hat: false }];
};

/**
 * The operations of the scripts a work added, each once.
 * @param {string[]} added - added scripts (diffFromStarter().added)
 * @param {{withHats: boolean}} [options] - whether to keep event hats
 * @returns {Array<{part: string, operation: string}>} unique operations, sorted by name
 */
const operationsOf = (added, { withHats = false } = {}) => {
    const byName = new Map();
    for (const script of added || []) {
        for (const line of String(script).split('\n')) {
            for (const op of operationsOfLine(line)) {
                if (op.hat && !withHats) continue;
                if (!byName.has(op.operation)) byName.set(op.operation, { part: op.part, operation: op.operation });
            }
        }
    }
    return [...byName.values()].sort((a, b) => byCodePoint(a.operation, b.operation));
};

const PART_ORDER = ['motor', 'servo', 'led'];
const PART_NAMES = { motor: 'モーター', servo: 'サーボ', led: 'LED' };

/**
 * Join Japanese words, putting a space next to Latin words (「サーボと LED」).
 * @param {string[]} words - words in order
 * @param {string} glue - the joining word
 * @returns {string} the joined text
 */
const joinWords = (words, glue) => {
    const spaced = (a, b) => (/[A-Za-z]$/.test(a) || /^[A-Za-z]/.test(b) ? `${a} ${b}` : `${a}${b}`);
    return words.reduce((text, w, i) => (i === 0 ? w : spaced(glue ? spaced(text, glue) : text, w)), '');
};

/**
 * The default name of a group, from the robot parts it moves.
 * @param {Array<{part: string}>} operations - the group's operations
 * @param {boolean} unchanged - the works added nothing running
 * @returns {string} e.g. 「スターターのまま」「LED だけ」「モーターとサーボ」
 */
const groupName = (operations, unchanged) => {
    if (unchanged) return 'スターターのまま';
    const parts = new Set(operations.map((op) => op.part));
    const moved = PART_ORDER.filter((p) => parts.has(p)).map((p) => PART_NAMES[p]);
    let name;
    if (moved.length === 0) name = 'ロボットを動かさない';
    else if (moved.length === 1) name = joinWords([moved[0], 'だけ'], '');
    else name = joinWords(moved, 'と');
    return parts.has('sensor') ? `${name}（センサーを使う）` : name;
};

/**
 * Group works by the set of operations they added.
 * Groups are ordered largest first; two groups that would get the same
 * name have their operations added to the name to tell them apart.
 * @param {Array<{seatNumber: number, added: string[]}>} submissions - works
 * @returns {Array<{key: string, name: string, seatNumbers: number[], operations: string[]}>} groups
 */
const groupSubmissions = (submissions) => {
    const groups = new Map();
    for (const { seatNumber, added } of submissions || []) {
        const operations = operationsOf(added);
        const unchanged = !added || added.length === 0;
        const key = unchanged ? '' : operations.map((op) => op.operation).join(' / ');
        if (!groups.has(key)) {
            groups.set(key, { key, name: groupName(operations, unchanged), seatNumbers: [], ops: operations });
        }
        groups.get(key).seatNumbers.push(seatNumber);
    }
    const list = [...groups.values()];
    const nameCount = {};
    for (const g of list) nameCount[g.name] = (nameCount[g.name] || 0) + 1;
    return list
        .map((g) => {
            const robot = g.ops.filter((op) => op.part !== 'other');
            const detail = (robot.length > 0 ? robot : g.ops).map((op) => op.operation).join('・');
            return {
                key: g.key,
                name: nameCount[g.name] > 1 && detail ? `${g.name}（${detail}）` : g.name,
                seatNumbers: [...g.seatNumbers].sort((a, b) => a - b),
                operations: g.ops.map((op) => op.operation),
            };
        })
        .sort((a, b) => b.seatNumbers.length - a.seatNumbers.length || byCodePoint(a.key, b.key));
};

/**
 * Pick one work per group for the teacher to look at closely.
 *
 * Priority, then cut at `max`:
 *   1. the largest group (what most of the class did — the yardstick),
 *   2. small groups (`small` works or fewer), smallest first — unusual works
 *      are where S candidates and misunderstandings hide, and one look
 *      decides them,
 *   3. the other groups, larger first,
 *   4. 「スターターのまま」 last: its grade is plain without opening it.
 * So small groups are always included unless there are more than `max`
 * groups that rank above them. The first seat of a group represents it.
 * @param {Array<{key: string, name: string, seatNumbers: number[]}>} groups - groupSubmissions result
 * @param {{max: number, small: number}} [options] - at most `max` picks; `small` = size of a small group
 * @returns {Array<{key: string, name: string, seatNumber: number, size: number}>} picks, in priority order
 */
const pickRepresentatives = (groups, { max = 8, small = 2 } = {}) => {
    const list = (groups || []).filter((g) => g.seatNumbers && g.seatNumbers.length > 0);
    const starter = list.filter((g) => g.key === '');
    const rest = list.filter((g) => g.key !== '').sort((a, b) => b.seatNumbers.length - a.seatNumbers.length);
    const [largest, ...others] = rest;
    const smalls = others.filter((g) => g.seatNumbers.length <= small).reverse();
    const middles = others.filter((g) => g.seatNumbers.length > small);
    const ordered = [...(largest ? [largest] : []), ...smalls, ...middles, ...starter];
    return ordered.slice(0, Math.max(0, max)).map((g) => ({
        key: g.key,
        name: g.name,
        seatNumber: Math.min(...g.seatNumbers),
        size: g.seatNumbers.length,
    }));
};

/**
 * Operations few students used — a hint for S (the work goes beyond the
 * class). Event hats count too (a key-press start is a choice of its own).
 * @param {Array<{seatNumber: number, added: string[]}>} submissions - works
 * @param {{threshold: number}} [options] - "few" = used by `threshold` students or fewer
 * @returns {Array<{seatNumber: number, rare: string[]}>} per work, in input order
 */
const rareBlocks = (submissions, { threshold = 2 } = {}) => {
    const list = (submissions || []).map((s) => ({
        seatNumber: s.seatNumber,
        operations: operationsOf(s.added, { withHats: true }).map((op) => op.operation),
    }));
    const users = new Map();
    for (const { operations } of list) {
        for (const op of operations) users.set(op, (users.get(op) || 0) + 1);
    }
    return list.map(({ seatNumber, operations }) => ({
        seatNumber,
        rare: operations.filter((op) => users.get(op) <= threshold),
    }));
};

export { groupSubmissions, pickRepresentatives, rareBlocks, operationsOf, operationsOfLine, groupName };
