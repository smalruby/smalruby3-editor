/**
 * The overall (term-end) grade from the grades of several assignments (#2423).
 *
 * Each grade becomes points (`points`), the points are averaged with the
 * assignments' weights, and the average is cut into S / A / B / C
 * (`cuts`: the lowest average of each grade). A seat with no grade for an
 * assignment gets `points.none`; when `points.none` is null the assignment
 * is left out of that seat's average instead (it neither helps nor hurts).
 *
 * Pure module: no I/O.
 */

const DEFAULT_POINTS = { S: 3, A: 2, B: 1, C: 0, none: 0 };
const DEFAULT_CUTS = { S: 2.5, A: 1.5, B: 0.5 };

// Compare averages a little loosely: 2.4999999 from float sums is 2.5.
const EPSILON = 1e-9;

/**
 * Cut an average into a grade.
 * @param {number} average - weighted average of points
 * @param {{S: number, A: number, B: number}} cuts - lowest average of each grade
 * @returns {string} 'S' | 'A' | 'B' | 'C'
 */
const gradeForAverage = (average, cuts) => {
    if (average + EPSILON >= cuts.S) return 'S';
    if (average + EPSILON >= cuts.A) return 'A';
    if (average + EPSILON >= cuts.B) return 'B';
    return 'C';
};

/**
 * Compute every seat's overall grade.
 * @param {object} input - the grading table
 * @param {Array<{id: string, weight: number, grades: object}>} input.assignments - grades: seat → 'S'|'A'|'B'|'C'
 * @param {object} [input.points] - grade → points, plus `none` for no grade (null = leave out)
 * @param {object} [input.cuts] - lowest average for S / A / B
 * @param {number[]} input.seats - seat numbers to compute
 * @returns {Array<{seatNumber: number, average: ?number, grade: string, missing: string[]}>}
 *   average rounded to 2 places (null and grade '' when nothing counts); missing = assignment ids without a grade
 */
const computeOverall = ({ assignments, points, cuts, seats }) => {
    const pts = { ...DEFAULT_POINTS, ...(points || {}) };
    const cut = { ...DEFAULT_CUTS, ...(cuts || {}) };
    const list = assignments || [];
    return (seats || []).map((seatNumber) => {
        let sum = 0;
        let weights = 0;
        const missing = [];
        for (const { id, weight, grades } of list) {
            const w = typeof weight === 'number' && weight > 0 ? weight : 0;
            const grade = grades && grades[seatNumber];
            const graded = typeof grade === 'string' && typeof pts[grade] === 'number' && grade !== 'none';
            if (!graded) missing.push(id);
            const value = graded ? pts[grade] : pts.none;
            if (typeof value !== 'number' || w === 0) continue;
            sum += value * w;
            weights += w;
        }
        if (weights === 0) return { seatNumber, average: null, grade: '', missing };
        const average = sum / weights;
        return {
            seatNumber,
            average: Math.round(average * 100) / 100,
            grade: gradeForAverage(average, cut),
            missing,
        };
    });
};

export { computeOverall, gradeForAverage, DEFAULT_POINTS, DEFAULT_CUTS };
