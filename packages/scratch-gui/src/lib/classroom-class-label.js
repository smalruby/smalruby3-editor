/**
 * Shared display format for a class (学級), spec'd by the teacher review:
 * 「%クラス名% %年度%年度 / %セクション%」 — the section part only when set.
 * Students see the same without the section. Truncation of long names is
 * the caller's job (CSS ellipsis), not this function's.
 */

/**
 * Teacher-facing label for a class.
 * @param {object} group - class summary ({name, year, section})
 * @returns {string} e.g. 技術 2026年度 / 2年1組
 */
const formatClassLabel = (group) => {
    if (!group) return '';
    const base = `${group.name} ${group.year}年度`;
    return group.section ? `${base} / ${group.section}` : base;
};

/**
 * Student-facing class name. Pre-v2 (develop) sessions have no classYear —
 * show the stored className unchanged for compatibility.
 * @param {string} className - class name from join/lookup
 * @param {number|null} classYear - school year from join/lookup (v2 only)
 * @returns {string} e.g. 技術 2026年度
 */
const formatStudentClassName = (className, classYear) => {
    if (!className) return '';
    return typeof classYear === 'number' ? `${className} ${classYear}年度` : className;
};

/**
 * Best-effort teacher email from an OIDC ID token (Google/Microsoft JWT).
 * Dev-bypass tokens are opaque strings — returns null, callers hide the
 * label.
 * @param {string} idToken - raw ID token
 * @returns {string|null} email claim or null
 */
const teacherEmailFromToken = (idToken) => {
    if (typeof idToken !== 'string') return null;
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.email === 'string' ? payload.email : null;
    } catch (_e) {
        return null;
    }
};

export { formatClassLabel, formatStudentClassName, teacherEmailFromToken };
