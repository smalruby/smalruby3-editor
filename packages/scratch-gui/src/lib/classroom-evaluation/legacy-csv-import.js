/**
 * Bring grades back from the old 「採点結果」 CSV (#2431).
 *
 * Before the per-assignment grading (EPIC #2421), grades and reasons lived only
 * on the grading screen and in the CSV the teacher exported
 * (`buildEvaluationCsv`): 出席番号, then per assignment `<課題名>:提出` /
 * `<課題名>:評価` / `<課題名>:評価理由` (or `<課題名>:レッスンの点`), then
 * 総合評価. Reading that file back is the only way to show past grades in the
 * gradebook. The lesson points and the overall grade are not imported: the
 * points are on the server, and the overall grade has its own screen now.
 *
 * Pure module: no I/O.
 */

const GRADES = ['S', 'A', 'B', 'C'];

/**
 * Parse CSV text into rows. Handles a UTF-8 BOM, CRLF / LF, quoted fields with
 * "" escapes and newlines inside quotes.
 * @param {string} text - CSV text
 * @returns {Array<Array<string>>} rows of fields (blank lines dropped)
 */
const parseCsv = (text) => {
    const src = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (quoted) {
            if (ch === '"') {
                if (src[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src[i + 1] === '\n') i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += ch;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((f) => f.trim() !== ''));
};

/**
 * Undo the formula guard of the CSV writer (`csvField` puts a ' before a
 * leading = + - @ tab or CR).
 * @param {string} value - a field
 * @returns {string} the text the teacher typed
 */
const unguard = (value) => (/^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value);

/**
 * Split a header like `02_LED:評価` into the assignment name and the column
 * kind. The name may itself contain ':', so split on the last one.
 * @param {string} header - a header cell
 * @returns {?{name: string, kind: string}} null for 出席番号 / 総合評価 / unknown
 */
const splitHeader = (header) => {
    const text = String(header || '').trim();
    const at = text.lastIndexOf(':');
    if (at <= 0) return null;
    const kind = text.slice(at + 1);
    if (!['提出', '評価', '評価理由', 'レッスンの点'].includes(kind)) return null;
    return { name: text.slice(0, at), kind };
};

/**
 * Read the old grading-result CSV.
 * @param {string} text - the file's text
 * @returns {{assignments: Array<{name: string, grades: object}>, skipped: Array<string>,
 *   error: ?string}} grades: seat (string) → {grade, reason}; skipped: the
 *   assignment names that had only lesson points
 */
const parseLegacyGradingCsv = (text) => {
    const rows = parseCsv(text);
    if (rows.length === 0) return { assignments: [], skipped: [], error: 'empty' };
    const header = rows[0].map((h) => String(h).trim());
    if (header[0] !== '出席番号') return { assignments: [], skipped: [], error: 'not-grading-csv' };
    const columns = new Map();
    const lessonOnly = new Set();
    header.forEach((cell, index) => {
        const parsed = splitHeader(cell);
        if (!parsed) return;
        if (parsed.kind === 'レッスンの点') {
            lessonOnly.add(parsed.name);
            return;
        }
        const entry = columns.get(parsed.name) || {};
        if (parsed.kind === '評価') entry.grade = index;
        if (parsed.kind === '評価理由') entry.reason = index;
        columns.set(parsed.name, entry);
    });
    const assignments = [];
    for (const [name, entry] of columns) {
        if (typeof entry.grade !== 'number') continue;
        const grades = {};
        for (const row of rows.slice(1)) {
            const seat = parseInt(String(row[0] || '').trim(), 10);
            if (!Number.isInteger(seat) || seat < 1) continue;
            const grade = String(row[entry.grade] || '')
                .trim()
                .toUpperCase();
            if (!GRADES.includes(grade)) continue;
            const reason = typeof entry.reason === 'number' ? unguard(String(row[entry.reason] || '')).trim() : '';
            grades[String(seat)] = { grade, reason };
        }
        assignments.push({ name, grades });
    }
    if (assignments.length === 0 && lessonOnly.size === 0) {
        return { assignments: [], skipped: [], error: 'not-grading-csv' };
    }
    return {
        assignments,
        skipped: [...lessonOnly].filter((name) => !columns.has(name)),
        error: null,
    };
};

/**
 * Match the CSV's assignments to this class's assignments by name, for the
 * preview before importing.
 * @param {Array<{name: string, grades: object}>} csvAssignments - parseLegacyGradingCsv().assignments
 * @param {Array<{classroomId: string, assignmentName: string, hasGrades?: boolean}>} classAssignments
 *   - the class's assignments; hasGrades = already graded on the new screen
 * @returns {{matches: Array<{classroomId: string, name: string, count: number, overwrite: boolean,
 *   grades: object}>, unmatched: Array<string>}} matches with at least one grade;
 *   unmatched = CSV names not found (or found more than once) in the class
 */
const planLegacyImport = (csvAssignments, classAssignments) => {
    const byName = new Map();
    for (const a of classAssignments || []) {
        const key = String(a.assignmentName || '').trim();
        byName.set(key, [...(byName.get(key) || []), a]);
    }
    const matches = [];
    const unmatched = [];
    for (const csv of csvAssignments || []) {
        const count = Object.keys(csv.grades || {}).length;
        if (count === 0) continue;
        const found = byName.get(csv.name.trim()) || [];
        if (found.length !== 1) {
            unmatched.push(csv.name);
            continue;
        }
        matches.push({
            classroomId: found[0].classroomId,
            name: csv.name,
            count,
            overwrite: !!found[0].hasGrades,
            grades: csv.grades,
        });
    }
    return { matches, unmatched };
};

/**
 * The PUT /classrooms/{id}/grading body for one imported assignment. Past
 * grades are the teacher's and already settled, so they are confirmed (decided
 * with the teacher on #2431).
 * @param {object} grades - seat → {grade, reason}
 * @param {string} confirmedAt - ISO time of the import
 * @returns {{grades: object, confirmedAt: string}} the request body
 */
const legacyGradingBody = (grades, confirmedAt) => ({
    grades: Object.fromEntries(
        Object.entries(grades || {}).map(([seat, g]) => [
            seat,
            { grade: g.grade, reason: (g.reason || '').slice(0, 300), source: 'teacher' },
        ]),
    ),
    confirmedAt,
});

export { parseCsv, parseLegacyGradingCsv, planLegacyImport, legacyGradingBody };
