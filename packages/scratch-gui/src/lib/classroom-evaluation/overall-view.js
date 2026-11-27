/**
 * What the overall grade screen (「総合評価」, EPIC #2421 / #2426) shows, from the
 * assignments of the class, their saved gradings and the teacher's settings.
 *
 * - Columns: the included assignments, the newest first (the order of the gradebook).
 * - An assignment is included by default when it has a grade; the teacher can
 *   leave it out or put it in. Weight 1 by default.
 * - Each grade becomes points, the weighted average is cut into S / A / B / C
 *   (`computeOverall`). A seat without a grade gets the points of 未提出 (0 by default).
 * - Only confirmed assignments (`grading.confirmedAt`) can be exported: an
 *   included assignment not confirmed (or still being read) blocks the CSV.
 *
 * Pure module: no I/O.
 */
import { gradebookSeats } from './gradebook.js';
import { overallCsvRows } from './grading-csv.js';
import { DEFAULT_CUTS, DEFAULT_POINTS, computeOverall } from './overall-grade.js';

const DEFAULT_WEIGHT = 1;

/**
 * The settings before the teacher changes anything.
 * Values may be strings (what is typed in the number fields); `normalizeSettings` reads them.
 * @returns {{included: object, weights: object, points: object, cuts: object}} the settings
 */
const defaultOverallSettings = () => ({
    included: {},
    weights: {},
    points: { ...DEFAULT_POINTS },
    cuts: { ...DEFAULT_CUTS },
});

const toNumber = (value, fallback) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value !== 'string' || value.trim() === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

/**
 * Read typed settings as numbers: a field left empty or not a number falls back to the default.
 * @param {?object} settings - the settings (strings or numbers)
 * @returns {{points: object, cuts: object}} the points and cuts as numbers
 */
const normalizeSettings = (settings) => {
    const s = settings || {};
    const points = {};
    for (const key of Object.keys(DEFAULT_POINTS)) {
        points[key] = toNumber(s.points && s.points[key], DEFAULT_POINTS[key]);
    }
    const cuts = {};
    for (const key of Object.keys(DEFAULT_CUTS)) {
        cuts[key] = toNumber(s.cuts && s.cuts[key], DEFAULT_CUTS[key]);
    }
    return { points, cuts };
};

const hasGrades = (grading) => Object.keys((grading && grading.grades) || {}).length > 0;

/**
 * Whether an assignment is in the overall grade. Without the teacher's choice, an
 * assignment with grades is in, one without is out.
 * @param {?object} settings - the settings
 * @param {string} classroomId - the assignment
 * @param {?object} grading - its saved grading
 * @returns {boolean} true when included
 */
const isIncluded = (settings, classroomId, grading) => {
    const choice = settings && settings.included ? settings.included[classroomId] : null;
    if (typeof choice === 'boolean') return choice;
    return hasGrades(grading);
};

/**
 * The weight of an assignment (default 1, also when left empty; a negative weight is 0).
 * @param {?object} settings - the settings
 * @param {string} classroomId - the assignment
 * @returns {number} the weight
 */
const weightOf = (settings, classroomId) => {
    const w = toNumber(settings && settings.weights ? settings.weights[classroomId] : null, DEFAULT_WEIGHT);
    return w > 0 ? w : 0;
};

/**
 * Seat → grade of one assignment (drafts included: the table shows them as provisional).
 * @param {?object} grading - the saved grading
 * @returns {object} "<seat>" → 'S'|'A'|'B'|'C'
 */
const gradesBySeat = (grading) => {
    const out = {};
    for (const [seat, entry] of Object.entries((grading && grading.grades) || {})) {
        if (entry && typeof entry.grade === 'string') out[seat] = entry.grade;
    }
    return out;
};

/**
 * Everything the overall screen shows.
 * @param {object} input - the class
 * @param {Array<object>} input.lessons - the assignments, newest first ({classroomId, assignmentName})
 * @param {object} input.gradings - classroomId → saved grading (null = none; missing key = still reading)
 * @param {?object} input.settings - the teacher's settings
 * @returns {{columns: Array<object>, unconfirmed: Array<object>, loading: Array<object>,
 *   rows: Array<object>, canExport: boolean}} columns = included assignments
 *   ({classroomId, name, weight, grades, grading}); unconfirmed / loading = included
 *   assignments that block the export; rows = computeOverall per seat (seats ascending)
 */
const overallView = ({ lessons, gradings, settings }) => {
    const all = gradings || {};
    const { points, cuts } = normalizeSettings(settings);
    const columns = (lessons || [])
        .filter((lesson) => isIncluded(settings, lesson.classroomId, all[lesson.classroomId]))
        .map((lesson) => {
            const grading = all[lesson.classroomId] || null;
            return {
                classroomId: lesson.classroomId,
                name: lesson.assignmentName || '',
                weight: weightOf(settings, lesson.classroomId),
                grades: gradesBySeat(grading),
                grading,
            };
        });
    const loading = columns.filter((c) => !(c.classroomId in all));
    const unconfirmed = columns.filter((c) => c.classroomId in all && !(c.grading && c.grading.confirmedAt));
    const seats = gradebookSeats(all);
    const rows = computeOverall({
        assignments: columns.map((c) => ({ id: c.classroomId, weight: c.weight, grades: c.grades })),
        points,
        cuts,
        seats,
    });
    const canExport =
        columns.length > 0 &&
        loading.length === 0 &&
        unconfirmed.length === 0 &&
        rows.length > 0 &&
        columns.some((c) => c.weight > 0);
    return { columns, unconfirmed, loading, rows, canExport };
};

/**
 * The rows of the overall CSV (each assignment's grade, 平均, 総合), or null when it cannot be exported.
 * @param {object} view - the result of `overallView`
 * @returns {?Array<Array>} the rows
 */
const overallExportRows = (view) => {
    if (!view || !view.canExport) return null;
    return overallCsvRows({
        assignments: view.columns.map((c) => ({ id: c.classroomId, name: c.name, grades: c.grades })),
        overall: view.rows,
    });
};

export {
    DEFAULT_WEIGHT,
    defaultOverallSettings,
    isIncluded,
    normalizeSettings,
    overallExportRows,
    overallView,
    weightOf,
};
