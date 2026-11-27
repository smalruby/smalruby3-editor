/**
 * The shape tags of a work (「形の札」): what the program does, read from its
 * structure without the AI.
 *
 * Grading a class sends the works to the AI in chunks, and the same kind of
 * work could get different grades. The teacher grades by shape instead
 * (「明るさで切りかえて、モーターも動かしている → S」), so the screen shows
 * each work's shape as tags and lets the teacher give one grade to every work
 * with the same tags. The tags are about the robot lessons (計測・制御):
 *
 *   - 明るさで〜を切りかえ / 片側だけ / どちらも同じ / もしの中が空: what a 「もし」
 *     on the sensor does in its two branches (and which parts it switches),
 *   - ずっとの外: the 「もし」 is checked once, not in a loop,
 *   - センサー以外の値で判定: the variable compared is not set from a sensor,
 *   - 〜を書きかえ続ける: another script keeps setting the sensor variable to a number,
 *   - しきい値 N（スターターのまま）: the number compared, marked when it is the starter's,
 *   - LED / モーター / サーボ: the parts the work moves.
 *
 * A work that uses no robot block gets the name of its group of operations
 * (grouping.js) instead, so other assignments still fall into kinds.
 *
 * Pure module: works on the pseudocode text of `analyzeProject`.
 */
import { groupName, operationsOf } from './grouping.js';
import { robotOperationsOf } from './robot-humanize.js';
import { runningScripts, splitScripts } from './starter-diff.js';

const TAG = {
    oneSide: '片側だけ',
    same: 'どちらも同じ',
    emptyIf: 'もしの中が空',
    outsideLoop: 'ずっとの外',
    notSensor: 'センサー以外の値で判定',
    noSensor: 'センサーを使わない',
    noParts: '動かす部品なし',
    unchanged: 'スターターのまま',
};
const PART_TAGS = { led: 'LED', motor: 'モーター', servo: 'サーボ' };
const PART_ORDER = ['led', 'motor', 'servo'];
const STARTER_SUFFIX = '（スターターのまま）';
const THRESHOLD_PREFIX = 'しきい値 ';
const NOTE_ORDER = [TAG.oneSide, TAG.same, TAG.emptyIf, TAG.outsideLoop, TAG.notSensor];
const NUMBER = /-?\d+(?:\.\d+)?/;
// The number next to a comparison (`明るさ1 > 50` is 50, not the 1 of the name).
const COMPARED_NUMBER = /[<>=]\s*(-?\d+(?:\.\d+)?)|(?:^|[\s(])(-?\d+(?:\.\d+)?)\s*[<>=]/;
// Not light sensors: a condition on these is 「センサーで切りかえ」, not 「明るさ」.
const OTHER_SENSOR = /タッチセンサー|音センサー|赤外線センサー/;

/**
 * The tag of a switch: what decides it and the parts it switches
 * (「明るさでサーボを切りかえ」「明るさで LED・モーターを切りかえ」).
 * @param {string} source - 'light' | 'sensor'
 * @param {string[]} parts - switched parts, in PART_ORDER
 * @returns {string} the tag
 */
const switchTag = (source, parts) => {
    const names = parts.map((p) => PART_TAGS[p]).join('・');
    const by = source === 'light' ? '明るさで' : 'センサーで';
    return `${by}${/^[A-Za-z]/.test(names) ? ' ' : ''}${names}${/[A-Za-z]$/.test(names) ? ' ' : ''}を切りかえ`;
};
const SWITCH_TAG = /^(明るさ|センサー)で.*を切りかえ$/;

/**
 * Lines of one script with their depth (4 spaces per level).
 * @param {string} script - script text from runningScripts (relative indentation)
 * @returns {Array<{depth: number, text: string}>} lines
 */
const linesOf = (script) =>
    String(script)
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => ({ depth: Math.floor((line.length - line.trimStart().length) / 4), text: line.trim() }));

/**
 * `変数 X を Y にする` → {name, value}.
 * @param {string} text - one line
 * @returns {?{name: string, value: string}} the assignment or null
 */
const assignmentOf = (text) => {
    const m = /^変数 (.+?) を (.+) にする$/.exec(text);
    return m ? { name: m[1], value: m[2] } : null;
};

/**
 * The robot parts a line moves (LED / motor / servo; reading a sensor is not moving).
 * @param {string} text - one line
 * @returns {string[]} parts
 */
const movedParts = (text) =>
    robotOperationsOf(text)
        .map((op) => op.part)
        .filter((part) => PART_ORDER.includes(part));

/**
 * The numbers the starter compares with (its loose `( > 50)` blocks and
 * conditions): a work still using one of them did not choose its own.
 * @param {string} starterPseudocode - pseudocode of the starter
 * @returns {Set<number>} numbers
 */
const starterThresholds = (starterPseudocode) => {
    const found = new Set();
    const text = String(starterPseudocode || '');
    for (const m of text.matchAll(/\(([^()\n]*[<>=][^()\n]*)\)/g)) {
        const n = COMPARED_NUMBER.exec(m[1]);
        if (n) found.add(Number(n[1] || n[2]));
    }
    return found;
};

/**
 * Read the `もし` blocks of the running scripts.
 * @param {string[]} scripts - running scripts
 * @returns {object} what was found
 */
const readScripts = (scripts) => {
    const parts = new Set();
    const sensorVars = new Map(); // name → light sensor (true) or other sensor (false)
    const otherVars = new Set(); // set from something else (a motor speed, a number…)
    const loopConstants = []; // {name, script}: set to a number inside 「ずっと」
    const conditions = [];
    scripts.forEach((script, index) => {
        const lines = linesOf(script);
        lines.forEach((line, i) => {
            for (const part of movedParts(line.text)) parts.add(part);
            const assignment = assignmentOf(line.text);
            const inLoop = lines.slice(0, i).some((p) => p.text === 'ずっと' && p.depth < line.depth);
            if (assignment) {
                const ops = robotOperationsOf(assignment.value);
                if (ops.some((op) => op.part === 'sensor')) {
                    sensorVars.set(assignment.name, !OTHER_SENSOR.test(assignment.value));
                } else if (ops.length > 0) {
                    otherVars.add(assignment.name);
                } else if (inLoop && NUMBER.test(assignment.value) && !/[^-\d.\s]/.test(assignment.value)) {
                    loopConstants.push({ name: assignment.name, script: index });
                }
            }
            const cond = /^もし \((.+)\) なら(…でなければ)?$/.exec(line.text);
            if (!cond) return;
            const thenActs = [];
            const elseActs = [];
            let j = i + 1;
            for (; j < lines.length && lines[j].depth > line.depth; j++) {
                if (movedParts(lines[j].text).length > 0) thenActs.push(lines[j].text);
            }
            if (j < lines.length && lines[j].depth === line.depth && lines[j].text === 'でなければ:') {
                for (j += 1; j < lines.length && lines[j].depth > line.depth; j++) {
                    if (movedParts(lines[j].text).length > 0) elseActs.push(lines[j].text);
                }
            }
            conditions.push({ text: cond[1], inLoop, thenActs, elseActs, script: index });
        });
    });
    return { parts, sensorVars, otherVars, loopConstants, conditions };
};

/**
 * What a condition compares: a light sensor, another sensor, something else, or nothing.
 * @param {string} text - the condition
 * @param {object} read - readScripts result
 * @returns {?string} 'light' | 'sensor' | 'other' | null
 */
const sourceOf = (text, read) => {
    if (/センサー/.test(text)) return OTHER_SENSOR.test(text) ? 'sensor' : 'light';
    for (const [name, light] of read.sensorVars) if (text.includes(name)) return light ? 'light' : 'sensor';
    for (const name of read.otherVars) if (text.includes(name)) return 'other';
    return null;
};

/**
 * The shape tags of a work, and the key works of the same shape share.
 * @param {object} args - inputs
 * @param {string} args.pseudocode - pseudocode of the work (`analyzeProject`)
 * @param {string[]} [args.added] - scripts it added to the starter (starter-diff)
 * @param {string} [args.starterPseudocode] - pseudocode of the starter
 * @returns {{tags: string[], key: string}} tags in display order; the key leaves
 *   out threshold numbers (other than the starter's), so works that differ only
 *   in the number they chose are one shape
 */
const shapeOf = ({ pseudocode, added, starterPseudocode = '' }) => {
    if (Array.isArray(added) && added.length === 0) return { tags: [TAG.unchanged], key: TAG.unchanged };
    const scripts = runningScripts(pseudocode);
    const read = readScripts(scripts);
    const sensed = read.conditions
        .map((c) => ({ ...c, source: sourceOf(c.text, read) }))
        .filter((c) => c.source !== null);
    const hasRobot =
        read.parts.size > 0 ||
        sensed.length > 0 ||
        splitScripts(pseudocode).some((s) => s.lines.some((l) => robotOperationsOf(l).length > 0));
    if (!hasRobot) {
        const ops = operationsOf(added || scripts);
        const name = groupName(ops, false);
        return { tags: [name], key: `ops:${ops.map((op) => op.operation).join(' / ')}` };
    }
    const notes = new Set();
    let switchSource = null;
    const switchedParts = new Set();
    let threshold = null;
    for (const c of sensed) {
        if (c.source === 'other') {
            notes.add(TAG.notSensor);
        }
        if (!c.inLoop) notes.add(TAG.outsideLoop);
        const thenKey = [...new Set(c.thenActs)].sort().join('\n');
        const elseKey = [...new Set(c.elseActs)].sort().join('\n');
        if (!thenKey && !elseKey) notes.add(TAG.emptyIf);
        else if (!thenKey || !elseKey) notes.add(TAG.oneSide);
        else if (thenKey === elseKey) notes.add(TAG.same);
        else {
            if (!switchSource || c.source === 'light') switchSource = c.source === 'sensor' ? 'sensor' : 'light';
            for (const act of [...c.thenActs, ...c.elseActs])
                for (const part of movedParts(act)) switchedParts.add(part);
        }
        if (threshold === null) {
            const n = COMPARED_NUMBER.exec(c.text);
            if (n) threshold = Number(n[1] || n[2]);
        }
    }
    const rewritten = [];
    for (const { name, script } of read.loopConstants) {
        if (!read.sensorVars.has(name)) continue;
        if (sensed.some((c) => c.script !== script && c.text.includes(name)))
            rewritten.push(`${name}を書きかえ続ける`);
    }
    const tags = [];
    if (switchSource)
        tags.push(
            switchTag(
                switchSource,
                PART_ORDER.filter((p) => switchedParts.has(p)),
            ),
        );
    for (const note of NOTE_ORDER) if (notes.has(note)) tags.push(note);
    for (const tag of new Set(rewritten)) tags.push(tag);
    let thresholdTag = null;
    if (threshold !== null) {
        const fromStarter = starterThresholds(starterPseudocode).has(threshold);
        thresholdTag = `${THRESHOLD_PREFIX}${threshold}${fromStarter ? STARTER_SUFFIX : ''}`;
        tags.push(thresholdTag);
    }
    // Parts the switch already names are not repeated: 「明るさで LED を切りかえ / モーター」
    // reads as 「LED を切りかえて、モーターも動かす」.
    for (const part of PART_ORDER) if (read.parts.has(part) && !switchedParts.has(part)) tags.push(PART_TAGS[part]);
    if (sensed.length === 0) tags.push(read.parts.size > 0 ? TAG.noSensor : TAG.noParts);
    const keyTags = tags.filter((t) => t !== thresholdTag || t.endsWith(STARTER_SUFFIX));
    return { tags, key: keyTags.join(' / ') };
};

/**
 * The kind of a tag, for its color: what the work does well, what to look at,
 * a part it moves, or a number.
 * @param {string} tag - a tag
 * @returns {string} 'good' | 'note' | 'part' | 'number'
 */
const tagKind = (tag) => {
    if (SWITCH_TAG.test(tag)) return 'good';
    if (Object.values(PART_TAGS).includes(tag)) return 'part';
    if (tag.startsWith(THRESHOLD_PREFIX) && !tag.endsWith(STARTER_SUFFIX)) return 'number';
    return 'note';
};

/**
 * Works grouped by shape, largest group first.
 * @param {Array<{seatNumber: number, tags: string[], key: string}>} works - submitted works with their shape
 * @returns {Array<{key: string, tags: string[], seatNumbers: number[]}>} groups; the tags are the
 *   first work's, without the threshold number when the works chose different ones
 */
const groupByShape = (works) => {
    const groups = new Map();
    for (const work of works || []) {
        if (!work || typeof work.key !== 'string') continue;
        if (!groups.has(work.key)) groups.set(work.key, { key: work.key, tagLists: [], seatNumbers: [] });
        const group = groups.get(work.key);
        group.tagLists.push(work.tags || []);
        group.seatNumbers.push(work.seatNumber);
    }
    return [...groups.values()]
        .map(({ key, tagLists, seatNumbers }) => {
            const same = (tag) => tagLists.every((list) => list.includes(tag));
            return {
                key,
                tags: tagLists[0].filter((tag) => tagKind(tag) !== 'number' || same(tag)),
                seatNumbers: [...seatNumbers].sort((a, b) => a - b),
            };
        })
        .sort((a, b) => b.seatNumbers.length - a.seatNumbers.length || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
};

export { TAG, groupByShape, shapeOf, starterThresholds, tagKind };
