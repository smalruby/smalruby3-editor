/**
 * CSV rows of the grading work (#2423): one CSV per assignment
 * (出席番号・評価・根拠・まとまり・確定) and the overall CSV (出席番号・each
 * assignment・平均・総合).
 *
 * The functions return rows (arrays of cells); `gradingCsvText` renders them
 * with the shared classroom CSV writer (UTF-8 BOM, CRLF, and a leading
 * = + - @ quoted so a reason typed by the teacher never runs as a formula).
 *
 * Pure module: no I/O.
 */
import { csvLines } from '../classroom-download-utils.js';

const ASSIGNMENT_HEADER = ['出席番号', '評価', '根拠', 'まとまり', '確定'];

/**
 * Rows of one assignment's CSV.
 * @param {Array<{seatNumber: number, grade?: string, reason?: string, groupName?: string,
 *   confirmed?: boolean}>} rows - one per seat
 * @returns {Array<Array>} header + rows sorted by seat; 確定 is 「○」 or empty
 */
const assignmentCsvRows = (rows) => [
    ASSIGNMENT_HEADER,
    ...[...(rows || [])]
        .sort((a, b) => a.seatNumber - b.seatNumber)
        .map((r) => [r.seatNumber, r.grade || '', r.reason || '', r.groupName || '', r.confirmed ? '○' : '']),
];

/**
 * Rows of the overall CSV.
 * @param {object} input - the table
 * @param {Array<{id: string, name: string, grades: object}>} input.assignments - grades: seat → grade
 * @param {Array<{seatNumber: number, average: ?number, grade: string}>} input.overall - computeOverall result
 * @returns {Array<Array>} header + one row per seat in `overall` order
 */
const overallCsvRows = ({ assignments, overall }) => {
    const list = assignments || [];
    return [
        ['出席番号', ...list.map((a) => a.name), '平均', '総合'],
        ...(overall || []).map((o) => [
            o.seatNumber,
            ...list.map((a) => (a.grades && a.grades[o.seatNumber]) || ''),
            o.average === null || typeof o.average === 'undefined' ? '' : o.average,
            o.grade || '',
        ]),
    ];
};

/**
 * Render rows as CSV text (BOM + CRLF, formula-safe).
 * @param {Array<Array>} rows - rows of cells
 * @returns {string} CSV text
 */
const gradingCsvText = (rows) => csvLines(rows);

export { assignmentCsvRows, overallCsvRows, gradingCsvText, ASSIGNMENT_HEADER };
