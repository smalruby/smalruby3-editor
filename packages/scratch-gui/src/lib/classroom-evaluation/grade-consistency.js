/**
 * Keep the grades of one class consistent when everyone is graded in chunks.
 *
 * Grading everyone sends the works to the AI 10 at a time. Each call is on its
 * own, so the same kind of work could get B in one chunk and S in another (a
 * class of 35 had 7 works that only switched the servo by the light sensor:
 * five got B, the two in the last chunk got S). Two things keep them together:
 *
 *   1. carry-over: after a chunk, a few of its works whose shape is not in the
 *      examples yet (one per shape) are added to the examples of the next
 *      chunks, with the AI's grade and reason, after the teacher's examples;
 *   2. the last check: after every chunk, works of the same shape with
 *      different grades are marked 「要確認」. Nothing is changed by itself.
 *
 * The shape of a work is the scripts it added to (or changed from) the starter
 * (starter-diff.js) with the number literals taken out, so 「サーボを 90 度」
 * and 「サーボを 120 度」 are the same shape but an added 「もし」 is not.
 *
 * Pure module: no VM, no DOM, no I/O.
 */
import { GRADES } from './gradebook.js';
import { LIMITS, UNCHANGED_CODE } from './grading-ai.js';

/** At most this many works of one chunk become examples of the next chunks. */
const CARRY_PER_CHUNK = 3;

/**
 * Number literals, not the digits of a name (A4, D9, 変数1 keep theirs).
 * The leading character is kept by the replacement.
 */
const NUMBER = /(^|[^\p{L}\p{N}_.])-?\d+(?:\.\d+)?/gu;

/**
 * One script with its number literals taken out and its spaces at line ends trimmed.
 * @param {string} script - script text (indentation kept)
 * @returns {string} the normalized script
 */
const normalizeScript = (script) =>
    String(script || '')
        .split('\n')
        .map((line) => line.replace(/\s+$/, '').replace(NUMBER, '$1#'))
        .filter((line) => line.trim())
        .join('\n');

/**
 * The shape of a work: its added scripts, without numbers, each once, in a
 * fixed order. The same signature means the same shape.
 * @param {string[]} added - added scripts (diffFromStarter().added)
 * @returns {string} the signature ('' = nothing added, the starter as it was)
 */
const shapeSignature = (added) => {
    const scripts = new Set((added || []).map(normalizeScript).filter(Boolean));
    return [...scripts].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).join('\n\n');
};

/**
 * The shape of an example from its code (the added scripts joined by a blank
 * line, see worksOf; scripts have no blank line inside).
 * @param {{code: string}} example - a rubric example
 * @returns {string} the signature
 */
const exampleSignature = (example) => {
    const code = String((example && example.code) || '');
    if (!code.trim() || code === UNCHANGED_CODE) return '';
    return shapeSignature(code.split(/\n\s*\n/));
};

/**
 * The examples of the next chunks: the current ones, then (after them) one work
 * per shape of this chunk that no example has yet. Works the AI was not sure
 * of (needsReview) are not used. The teacher's examples stay first and are
 * never pushed out: nothing is added past `limit`.
 * @param {object} args - inputs
 * @param {Array<object>} args.examples - the examples sent so far
 * @param {Array<{seatNumber: number, grade: string, reason: string, needsReview: boolean}>} args.results -
 *   the AI's results of this chunk
 * @param {Array<{seatNumber: number, added: string[]}>} args.works - the works of this chunk
 * @param {object} [args.groupBySeat] - "<seat>" → group name
 * @param {number} [args.limit] - most examples sent (the server's limit)
 * @param {number} [args.perChunk] - most examples added from one chunk
 * @returns {Array<object>} the examples (old + new)
 */
const carryOverExamples = ({
    examples,
    results,
    works,
    groupBySeat = {},
    limit = LIMITS.examples,
    perChunk = CARRY_PER_CHUNK,
}) => {
    const next = [...(examples || [])];
    const known = new Set(next.map(exampleSignature));
    const bySeat = new Map((works || []).map((w) => [w.seatNumber, w]));
    let added = 0;
    for (const result of results || []) {
        if (next.length >= limit || added >= perChunk) break;
        const work = bySeat.get(result && result.seatNumber);
        if (!work || !GRADES.includes(result.grade) || result.needsReview === true) continue;
        const signature = shapeSignature(work.added);
        if (known.has(signature)) continue;
        known.add(signature);
        added++;
        next.push({
            seatNumber: work.seatNumber,
            grade: result.grade,
            reason: String(result.reason || '').slice(0, LIMITS.reason),
            group: String(groupBySeat[String(work.seatNumber)] || '').slice(0, LIMITS.group),
            code: (work.added && work.added.length > 0 ? work.added.join('\n\n') : UNCHANGED_CODE).slice(
                0,
                LIMITS.code,
            ),
        });
    }
    return next;
};

/**
 * Works of the same shape that got different grades.
 * @param {Array<{seatNumber: number, added: string[], grade: ?string}>} works - graded works
 * @returns {Array<{signature: string, seatNumbers: number[], grades: string[]}>} one entry per shape
 *   whose works do not all have the same grade; seats and grades sorted
 */
const inconsistentShapes = (works) => {
    const byShape = new Map();
    for (const work of works || []) {
        if (!work || !GRADES.includes(work.grade)) continue;
        const signature = shapeSignature(work.added);
        if (!byShape.has(signature)) byShape.set(signature, []);
        byShape.get(signature).push(work);
    }
    const found = [];
    for (const [signature, list] of byShape) {
        const grades = [...new Set(list.map((w) => w.grade))];
        if (grades.length < 2) continue;
        found.push({
            signature,
            seatNumbers: list.map((w) => w.seatNumber).sort((a, b) => a - b),
            grades: grades.sort((a, b) => GRADES.indexOf(a) - GRADES.indexOf(b)),
        });
    }
    return found.sort((a, b) => a.seatNumbers[0] - b.seatNumbers[0]);
};

/**
 * The works to mark 「要確認」 after grading everyone: those of a shape whose
 * works got different grades. A grade the teacher gave (manual) is not marked:
 * it is the yardstick, the AI's grades next to it are the ones to look at.
 * @param {Array<{seatNumber: number, added: string[], grade: ?string, manual: boolean}>} works - graded works
 * @returns {number[]} seats to mark, sorted
 */
const seatsToReview = (works) => {
    const manual = new Set((works || []).filter((w) => w && w.manual).map((w) => w.seatNumber));
    const seats = inconsistentShapes(works).flatMap((shape) => shape.seatNumbers);
    return seats.filter((seat) => !manual.has(seat)).sort((a, b) => a - b);
};

export {
    CARRY_PER_CHUNK,
    carryOverExamples,
    exampleSignature,
    inconsistentShapes,
    normalizeScript,
    seatsToReview,
    shapeSignature,
};
