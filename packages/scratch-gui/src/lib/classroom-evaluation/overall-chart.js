/**
 * The charts of the overall grade screen (#2458, EPIC #2438 F7 / F8): the 100% stacked
 * band of S/A/B/C, the dots of every seat's weighted average with the cut lines, and
 * moving a cut line (by dragging it or with the keys).
 *
 * The count and the S+A+B target come from `gradeDistribution` (the same numbers as the
 * distribution of each assignment). Pure module: no I/O.
 */
import { gradeDistribution } from './grade-distribution.js';
import { GRADES } from './gradebook.js';

/** A cut moves by 0.1, the step of the cut fields. */
const CUT_STEP = 0.1;

/** The dots within 1/40 of the axis are stacked on each other. */
const DOT_BINS = 40;

const roundStep = (value) => Math.round(value / CUT_STEP) * CUT_STEP;
// 2.6000000000000001 → 2.6: the value is shown in the field as typed.
const tidy = (value) => Math.round(value * 1000) / 1000;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * The distribution of the overall grades (the seats with no average are not counted).
 * @param {Array<{grade: string}>} rows - the rows of `computeOverall`
 * @returns {object} the distribution of `gradeDistribution` (with `sab`)
 */
const overallDistribution = (rows) => {
    const counts = { S: 0, A: 0, B: 0, C: 0 };
    for (const row of rows || []) {
        if (GRADES.includes(row.grade)) counts[row.grade]++;
    }
    return gradeDistribution(counts);
};

/**
 * The segments of the 100% stacked band, S first. The share is not rounded so the
 * band adds up to 100%.
 * @param {{counts: object, graded: number}} distribution - the distribution
 * @returns {Array<{grade: string, count: number, share: number}>} the segments
 */
const stackedSegments = ({ counts, graded }) =>
    GRADES.map((grade) => ({
        grade,
        count: counts[grade] || 0,
        share: graded > 0 ? ((counts[grade] || 0) / graded) * 100 : 0,
    }));

/**
 * The horizontal axis: from the lowest points to the highest (未提出 too, when it counts).
 * @param {object} points - grade → points as numbers (`none` may be null)
 * @returns {{min: number, max: number}} the axis
 */
const chartDomain = (points) => {
    const values = ['S', 'A', 'B', 'C', 'none'].map((k) => points[k]).filter((v) => typeof v === 'number');
    const min = Math.min(...values);
    const max = Math.max(...values);
    return max > min ? { min, max } : { min, max: min + 1 };
};

/**
 * Where a value is on the axis (0 = left end, 1 = right end).
 * @param {number} value - an average or a cut
 * @param {{min: number, max: number}} domain - the axis
 * @returns {number} 0..1
 */
const toFraction = (value, domain) => clamp((value - domain.min) / (domain.max - domain.min), 0, 1);

/**
 * The value at a place of the axis, on the step of the cut fields.
 * @param {number} fraction - 0..1
 * @param {{min: number, max: number}} domain - the axis
 * @returns {number} the value
 */
const cutFromFraction = (fraction, domain) =>
    tidy(roundStep(domain.min + clamp(fraction, 0, 1) * (domain.max - domain.min)));

/**
 * Keep a moved cut between its neighbours (S ≥ A ≥ B) and on the axis.
 * @param {string} key - 'S' | 'A' | 'B'
 * @param {number} value - the wanted value
 * @param {{S: number, A: number, B: number}} cuts - the other cuts as numbers
 * @param {{min: number, max: number}} domain - the axis
 * @returns {number} the value to set
 */
const clampCut = (key, value, cuts, domain) => {
    const upper = { S: domain.max, A: cuts.S, B: cuts.A }[key];
    const lower = { S: cuts.A, A: cuts.B, B: domain.min }[key];
    return tidy(clamp(roundStep(value), Math.max(lower, domain.min), Math.min(upper, domain.max)));
};

/**
 * Move a cut by one step (the arrow keys of the line).
 * @param {string} key - 'S' | 'A' | 'B'
 * @param {{S: number, A: number, B: number}} cuts - the cuts as numbers
 * @param {number} steps - +1 / -1
 * @param {{min: number, max: number}} domain - the axis
 * @returns {number} the value to set
 */
const stepCut = (key, cuts, steps, domain) => clampCut(key, cuts[key] + steps * CUT_STEP, cuts, domain);

/**
 * The dots: one per seat with an average, at its average; the dots that fall on the
 * same place (1/40 of the axis) are stacked (`level` 0 = on the axis).
 * @param {Array<{seatNumber: number, average: ?number, grade: string}>} rows - the rows of `computeOverall`
 * @param {{min: number, max: number}} domain - the axis
 * @returns {Array<{seatNumber: number, average: number, grade: string, fraction: number, level: number}>}
 *   the dots, from the left
 */
const dotLayout = (rows, domain) => {
    const sorted = (rows || [])
        .filter((row) => typeof row.average === 'number')
        .slice()
        .sort((a, b) => a.average - b.average || a.seatNumber - b.seatNumber);
    const levels = {};
    return sorted.map((row) => {
        const fraction = toFraction(row.average, domain);
        const bin = Math.min(DOT_BINS - 1, Math.floor(fraction * DOT_BINS));
        const level = levels[bin] || 0;
        levels[bin] = level + 1;
        return { seatNumber: row.seatNumber, average: row.average, grade: row.grade, fraction, level };
    });
};

export {
    CUT_STEP,
    chartDomain,
    clampCut,
    cutFromFraction,
    dotLayout,
    overallDistribution,
    stackedSegments,
    stepCut,
    toFraction,
};
