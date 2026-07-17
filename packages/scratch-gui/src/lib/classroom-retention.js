/**
 * Retention (auto-delete) helpers for classroom assignments (issue #1052).
 *
 * Assignments and their submissions are TTL-deleted 90 days after creation
 * (server: CLASSROOM_TTL_DAYS). The API exposes the deadline as `expiresAt`;
 * these helpers turn it into "days left" and an alert level so the UI can
 * warn teachers to download submissions before they disappear.
 *
 * Thresholds (EPIC #1049 D8): 30 days = notice, 7 days = warning — chosen so
 * a once-a-week class still has a lesson or two of margin.
 */
export const RETENTION_NOTICE_DAYS = 30;
export const RETENTION_WARNING_DAYS = 7;

/**
 * Whole days until the retention deadline, clamped at 0.
 * @param {string} expiresAt - ISO date string from the API
 * @param {number} [now] - current time in ms (injectable for tests)
 * @returns {number|null} days left, or null when there is no valid deadline
 */
export const daysUntil = (expiresAt, now = Date.now()) => {
    if (!expiresAt) return null;
    const expires = new Date(expiresAt).getTime();
    if (Number.isNaN(expires)) return null;
    return Math.max(0, Math.ceil((expires - now) / (24 * 60 * 60 * 1000)));
};

/**
 * Alert level for a retention deadline.
 * @param {string} expiresAt - ISO date string from the API
 * @param {number} [now] - current time in ms (injectable for tests)
 * @returns {'none'|'notice'|'warning'} alert level
 */
export const retentionLevel = (expiresAt, now = Date.now()) => {
    const days = daysUntil(expiresAt, now);
    if (days === null) return 'none';
    if (days <= RETENTION_WARNING_DAYS) return 'warning';
    if (days <= RETENTION_NOTICE_DAYS) return 'notice';
    return 'none';
};
