/**
 * Pure helpers for the term-end evaluation flow (evaluation set UI).
 *
 * The evaluation set is a matrix of seat × lesson. Each cell holds
 * {submitted, grade, reason, needsReview, signals, pseudocode, comment}.
 * These helpers combine per-lesson grades into an overall grade, and render
 * the two CSV artifacts:
 *   - 評価 CSV: the teacher's term-end record (seat × lessons + overall)
 *   - 検証用 CSV: per-submission audit sheet (signals + pseudocode + AI
 *     proposal) an IT engineer can review from a spreadsheet
 */
import { csvField, csvLines } from '../classroom-download-utils.js';

const GRADE_ORDER = ['C', 'B', 'A', 'S'];

/**
 * Combine per-lesson grades into an overall grade — the additive
 * "improvement-oriented" rule from the Tamayu pipeline: S=2, A=1, B/C=0,
 * summed, then total>=2 → S, ==1 → A, ==0 → B. A single graded lesson keeps
 * its own grade (a lone C stays C).
 * @param {Array<?string>} grades - Grades of the lessons the seat submitted
 *   to (null/undefined entries = not graded, ignored)
 * @returns {?string} Overall grade, or null when nothing is graded
 */
const combineOverall = (grades) => {
    const graded = (grades || []).filter((g) => GRADE_ORDER.includes(g));
    if (graded.length === 0) return null;
    if (graded.length === 1) return graded[0];
    const score = graded.reduce((sum, g) => sum + (g === 'S' ? 2 : g === 'A' ? 1 : 0), 0);
    if (score >= 2) return 'S';
    if (score === 1) return 'A';
    return 'B';
};

/**
 * Render rows into CSV text with a BOM so Excel opens UTF-8 correctly. Uses the
 * shared, formula-injection-safe writer of the other classroom CSVs (#1603):
 * an assignment name or an AI reason starting with = + - @ is not run as a
 * formula when the teacher opens the file.
 * @param {Array<Array>} rows - Rows of cell values
 * @returns {string} CSV text (U+FEFF prefix + CRLF rows)
 */
const toCsv = (rows) => csvLines(rows);

/**
 * The columns of the grading table and CSV (#1603). Each assignment has a
 * work column (the AI-assisted grade), and a lesson assignment also has a
 * 「レッスン」 column (the machine score from its progress) right after it.
 * A lesson assignment whose students submit no work has only the lesson
 * column. The two scores stay separate (EPIC #1592 D10 ③).
 * @param {Array<object>} lessons - [{classroomId, assignmentName, hasLesson}]
 * @param {object} [lessonScores] - classroomId → lessonScoresBySeat result (null = cannot be scored)
 * @returns {Array<{lesson: object, kind: 'work'|'lesson'}>} columns in order
 */
const evaluationColumns = (lessons, lessonScores = {}) => {
    const columns = [];
    for (const lesson of lessons) {
        const info = lessonScores[lesson.classroomId];
        if (!(lesson.hasLesson && info && info.submitWork === false)) columns.push({ lesson, kind: 'work' });
        if (lesson.hasLesson) columns.push({ lesson, kind: 'lesson' });
    }
    return columns;
};

/**
 * The lesson score of a seat (null when it has no record or cannot be scored).
 * @param {object} lessonScores - classroomId → lessonScoresBySeat result
 * @param {string} classroomId - assignment
 * @param {number} seatNumber - seat
 * @returns {?number} score
 */
const lessonScoreOf = (lessonScores, classroomId, seatNumber) => {
    const info = lessonScores && lessonScores[classroomId];
    const score = info ? info.scores[seatNumber] : null;
    return typeof score === 'number' ? score : null;
};

/**
 * Build the term-end evaluation CSV.
 * @param {Array<object>} lessons - [{classroomId, assignmentName, hasLesson}]
 * @param {Array<number>} seats - Sorted seat numbers
 * @param {Function} getCell - (seatNumber, classroomId) => cell or null
 * @param {object} [lessonScores] - classroomId → lessonScoresBySeat result (#1603)
 * @returns {string} CSV text
 */
const buildEvaluationCsv = (lessons, seats, getCell, lessonScores = {}) => {
    const columns = evaluationColumns(lessons, lessonScores);
    const header = ['出席番号'];
    for (const { lesson, kind } of columns) {
        if (kind === 'lesson') {
            header.push(`${lesson.assignmentName}:レッスンの点`);
        } else {
            header.push(
                `${lesson.assignmentName}:提出`,
                `${lesson.assignmentName}:評価`,
                `${lesson.assignmentName}:評価理由`,
            );
        }
    }
    header.push('総合評価');

    const rows = [header];
    for (const seatNumber of seats) {
        const row = [seatNumber];
        const grades = [];
        for (const { lesson, kind } of columns) {
            if (kind === 'lesson') {
                row.push(lessonScoreOf(lessonScores, lesson.classroomId, seatNumber));
                continue;
            }
            const cell = getCell(seatNumber, lesson.classroomId);
            row.push(cell && cell.submitted ? '○' : '×');
            row.push(cell?.grade || '');
            row.push(cell?.reason || '');
            if (cell?.grade) grades.push(cell.grade);
        }
        row.push(combineOverall(grades) || '');
        rows.push(row);
    }
    return toCsv(rows);
};

/**
 * Build the engineer-audit CSV (one row per submission, pseudocode inline).
 * @param {Array<object>} lessons - [{classroomId, assignmentName}]
 * @param {Array<number>} seats - Sorted seat numbers
 * @param {Function} getCell - (seatNumber, classroomId) => cell or null
 * @returns {string} CSV text
 */
const buildAuditCsv = (lessons, seats, getCell) => {
    const rows = [['出席番号', '課題', '提出', 'AI評価', '評価理由', '要確認', '機械シグナル', '擬似コード']];
    for (const seatNumber of seats) {
        for (const lesson of lessons) {
            const cell = getCell(seatNumber, lesson.classroomId);
            rows.push([
                seatNumber,
                lesson.assignmentName,
                cell && cell.submitted ? '○' : '×',
                cell?.grade || '',
                cell?.reason || '',
                cell?.needsReview ? '要確認' : '',
                cell?.signals ? JSON.stringify(cell.signals) : '',
                cell?.pseudocode || '',
            ]);
        }
    }
    return toCsv(rows);
};

/**
 * Split an array into chunks of at most `size` items.
 * @param {Array} items - Source array
 * @param {number} size - Max chunk size
 * @returns {Array<Array>} Chunks
 */
const chunk = (items, size) => {
    const chunks = [];
    for (let i = 0; i < (items || []).length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

/** Default rubric axes offered when the teacher has not customized any. */
const DEFAULT_RUBRIC_AXES = [
    { name: '動くこと', description: 'スクリプトがイベントに接続されて（◆）実行され、意図した動作をする' },
    { name: '課題の要件', description: '課題で求められた内容（ブロック・動き）が実現できている' },
    { name: '工夫', description: '課題の要件を超えた自分なりの工夫・追加がある' },
];

export {
    GRADE_ORDER,
    combineOverall,
    buildEvaluationCsv,
    evaluationColumns,
    lessonScoreOf,
    buildAuditCsv,
    chunk,
    csvField,
    toCsv,
    DEFAULT_RUBRIC_AXES,
};
