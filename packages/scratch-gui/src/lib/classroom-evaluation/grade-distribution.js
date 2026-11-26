/**
 * The grade distribution of an assignment (#2457, EPIC #2438 F5 / F6): how many
 * seats have S/A/B/C, and the S+A and S shares against the school's targets.
 *
 * The share is of the seats with a grade (the seats that submitted, F5); the seats
 * that did not submit are only counted, apart. The targets are kept here so the
 * overall grade's chart uses the same numbers and they can be changed in one place.
 */
import { GRADES, gradeCounts } from './gradebook.js';

/**
 * The targets (percent, F6): S is aimed at 5–25% of the graded seats, and S+A at
 * 75% or more. Out of them, the band turns to the attention colour.
 */
const GRADE_TARGETS = Object.freeze({ sMin: 5, sMax: 25, saMin: 75 });

const percentOf = (count, total) => (total > 0 ? Math.round((count / total) * 100) : null);

/**
 * The distribution from the counts of each grade.
 * The `ok` checks use the rounded share the teacher sees, so a shown "5%" is never
 * marked as below the 5–25% aim (1 S of 21 is 4.76%).
 * With no grade yet, there is no share and nothing to warn about.
 * @param {{S: number, A: number, B: number, C: number}} counts - seats per grade
 * @param {{sMin: number, sMax: number, saMin: number}} [targets] - the targets in percent
 * @returns {{counts: object, graded: number,
 *     sa: {count: number, percent: ?number, ok: boolean},
 *     s: {count: number, percent: ?number, ok: boolean}}} the distribution
 */
const gradeDistribution = (counts, targets = GRADE_TARGETS) => {
    const graded = GRADES.reduce((sum, grade) => sum + (counts[grade] || 0), 0);
    const saCount = (counts.S || 0) + (counts.A || 0);
    const sCount = counts.S || 0;
    const saPercent = percentOf(saCount, graded);
    const sPercent = percentOf(sCount, graded);
    return {
        counts: { S: counts.S || 0, A: counts.A || 0, B: counts.B || 0, C: counts.C || 0 },
        graded,
        sa: {
            count: saCount,
            percent: saPercent,
            ok: saPercent === null || saPercent >= targets.saMin,
        },
        s: {
            count: sCount,
            percent: sPercent,
            ok: sPercent === null || (sPercent >= targets.sMin && sPercent <= targets.sMax),
        },
    };
};

/**
 * The distribution on the assignment's grading screen, from the grades shown now
 * (the teacher's unsaved changes included), like the counts above it.
 * Before the submissions are loaded, the saved grades are counted and who did not
 * submit is unknown.
 * @param {object} args - what is known
 * @param {Array<number>} args.seats - the seats of the assignment
 * @param {Function} args.getCell - (seat) → loaded cell or null
 * @param {?object} args.grading - the assignment's grading
 * @param {boolean} args.loaded - the submissions are loaded
 * @returns {object} the distribution of `gradeDistribution` and `notSubmitted` (?number)
 */
const assignmentDistribution = ({ seats, getCell, grading, loaded }) => {
    if (!loaded) {
        return { ...gradeDistribution(gradeCounts(grading && grading.grades)), notSubmitted: null };
    }
    const counts = { S: 0, A: 0, B: 0, C: 0 };
    let notSubmitted = 0;
    for (const seat of seats || []) {
        const cell = getCell(seat);
        if (!cell || !cell.submitted) {
            notSubmitted++;
            continue;
        }
        if (GRADES.includes(cell.grade)) counts[cell.grade]++;
    }
    return { ...gradeDistribution(counts), notSubmitted };
};

export { GRADE_TARGETS, assignmentDistribution, gradeDistribution };
