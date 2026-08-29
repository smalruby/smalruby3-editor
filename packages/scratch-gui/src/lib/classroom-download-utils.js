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
 * Human-readable submission status for the CSV.
 * @param {object} member - enriched member row
 * @returns {string} Japanese status label
 */
export const submissionStatusLabel = (member) => {
    if (!member.hasSubmission) return '未提出';
    return member.submissionStatus === 'returned' ? '返却済み' : '提出済み';
};

/**
 * Escape one CSV field (quote when needed, double inner quotes).
 * @param {*} value - cell value (null/undefined become empty)
 * @returns {string} escaped field
 */
const csvField = (value) => {
    const text = value === null || typeof value === 'undefined' ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
};

/**
 * Build the submission status CSV for the class-wide zip.
 * @param {Array<object>} rows - [{assignmentName, seat, name, projectName, submittedAt, status}]
 * @returns {string} CSV text (U+FEFF BOM + CRLF rows, Excel-friendly)
 */
export const buildSubmissionsCsv = (rows) => {
    const header = ['課題名', '出席番号', '名前', '作品名', '提出日時', '状態'];
    const lines = [
        header,
        ...(rows || []).map((r) => [r.assignmentName, r.seat, r.name, r.projectName, r.submittedAt, r.status]),
    ];
    return `${'\ufeff'}${lines.map((row) => row.map(csvField).join(',')).join('\r\n')}`;
};
