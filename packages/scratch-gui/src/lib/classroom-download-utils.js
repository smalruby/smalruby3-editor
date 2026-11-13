/**
 * Pure helpers for the class-level bulk download (issue #1055).
 *
 * The per-assignment download already exists (use-teacher-submissions
 * handleDownloadAll); these helpers add what the class-wide zip needs:
 * filesystem-safe folder names (unique per assignment) and a submission
 * status CSV so teachers can archive a whole class before the retention
 * deadline in one click.
 */

/**
 * Make a name safe to use as a zip entry (folder/file) name.
 * @param {string} name - raw name (assignment name, student name, ...)
 * @returns {string} sanitized non-empty name
 */
export const sanitizeEntryName = (name) => {
    const cleaned = String(name || '')
        .replace(/[\\/:*?"<>|]/g, '_')
        .trim();
    return cleaned || 'untitled';
};

/**
 * Assign a unique folder name to every assignment. Duplicate display names
 * get a numeric suffix so two "ねこあつめ" assignments do not merge.
 * @param {Array<object>} assignments - classroom items ({classroomId, assignmentName, className})
 * @returns {Map<string, string>} classroomId -> folder name
 */
export const assignmentFolderNames = (assignments) => {
    const used = new Map();
    const byId = new Map();
    for (const a of assignments || []) {
        const base = sanitizeEntryName(a.assignmentName || a.className);
        const count = (used.get(base) || 0) + 1;
        used.set(base, count);
        byId.set(a.classroomId, count === 1 ? base : `${base} (${count})`);
    }
    return byId;
};

/**
 * What the 「全作品ダウンロード」 zip of one assignment holds (#1603).
 * A lesson assignment always gets a zip with its 提出状況.csv (the progress
 * is worth saving even when no work is submitted — submitWork=false);
 * other assignments keep their old zip (seat folders only, none when nothing
 * is submitted).
 * @param {boolean} hasLesson - the assignment has a lesson
 * @param {number} submittedCount - submissions with a project file
 * @returns {?{statusCsv: boolean}} the plan, or null when there is nothing to download
 */
export const assignmentZipPlan = (hasLesson, submittedCount) => {
    if (hasLesson) return { statusCsv: true };
    return submittedCount > 0 ? { statusCsv: false } : null;
};

/**
 * Human-readable submission status for the CSV.
 * @param {object} member - enriched member row
 * @returns {string} Japanese status label
 */
export const submissionStatusLabel = (member) => {
    if (!member.hasSubmission) return '未提出';
    return member.submissionStatus === 'returned' ? '返却済み' : '提出済み';
};

/**
 * Escape one CSV field (quote when needed, double inner quotes, and keep a
 * string from being read as a formula).
 * @param {*} value - cell value (null/undefined become empty)
 * @returns {string} escaped field
 */
export const csvField = (value) => {
    let text = value === null || typeof value === 'undefined' ? '' : String(value);
    // Names are typed by students: a leading = + - @ (or tab / CR) would run
    // as a formula when the teacher opens the file in a spreadsheet.
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

/**
 * Join rows into Excel-friendly CSV text.
 * @param {Array<Array<*>>} lines - rows of cells (the first is the header)
 * @returns {string} CSV text (U+FEFF BOM + CRLF rows)
 */
export const csvLines = (lines) => `${'\ufeff'}${lines.map((row) => row.map(csvField).join(',')).join('\r\n')}`;

/**
 * Build the submission status CSV for the class-wide zip.
 *
 * When any assignment has a lesson (EPIC #1592 / #1603), the lesson columns
 * come after the existing ones: 課題クリア・できた数・得点（レッスンの点）, then
 * one column per challenge (できた時刻か「前」か空). The challenge columns are
 * last because their number changes with the assignments in the file, so the
 * fixed columns stay in the same place. Rows of assignments without a lesson
 * leave them empty.
 * @param {Array<object>} rows - [{assignmentName, seat, name, projectName, submittedAt, status,
 *   lesson?: {cleared, done, score, times}}]
 * @param {?Array<{id: string, name: string}>} [challengeColumns] - lesson challenge columns
 *   (null / omitted when no assignment has a lesson: the CSV keeps its old columns)
 * @returns {string} CSV text (U+FEFF BOM + CRLF rows, Excel-friendly)
 */
export const buildSubmissionsCsv = (rows, challengeColumns = null) => {
    const header = ['課題名', '出席番号', '名前', '作品名', '提出日時', '状態'];
    const withLesson = Array.isArray(challengeColumns);
    if (withLesson) header.push('課題クリア', 'できた数', '得点', ...challengeColumns.map((c) => c.name));
    return csvLines([
        header,
        ...(rows || []).map((r) => {
            const cells = [r.assignmentName, r.seat, r.name, r.projectName, r.submittedAt, r.status];
            if (!withLesson) return cells;
            const lesson = r.lesson;
            if (!lesson) return [...cells, '', '', '', ...challengeColumns.map(() => '')];
            return [
                ...cells,
                lesson.cleared,
                lesson.done,
                lesson.score,
                ...challengeColumns.map((c) =>
                    Object.prototype.hasOwnProperty.call(lesson.times, c.id) ? lesson.times[c.id] : '',
                ),
            ];
        }),
    ]);
};
