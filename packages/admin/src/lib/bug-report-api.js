/**
 * Bug-report API client (EPIC #1073 S5, decision D) — READ-ONLY.
 *
 * The bug-report feature itself is unchanged; the admin console only adds a
 * viewing surface. This client therefore exposes GET endpoints exclusively —
 * status changes and developer replies stay on the existing workflow. The
 * admin's Google id_token is accepted by the bug-report Lambda as an
 * additional audience (decision F), and the operator must be registered in
 * the BugReportAdmins email registry.
 */
import {getIdToken} from './admin-api.js';

const BUG_REPORT_API_ENDPOINT = process.env.BUG_REPORT_API_ENDPOINT || '';

/**
 * Perform an authenticated GET against the bug-report API.
 * @param {string} path - API path (starting with /admin/)
 * @returns {Promise<object>} parsed JSON
 */
const get = async path => {
    const response = await fetch(`${BUG_REPORT_API_ENDPOINT}${path}`, {
        method: 'GET',
        headers: {Authorization: `Bearer ${getIdToken()}`}
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        // Same session-expiry broadcast as admin-api (the token is shared).
        if (response.status === 401 && typeof window !== 'undefined') {
            window.dispatchEvent(new Event('smalruby-admin:unauthorized'));
        }
        const error = new Error(data.error || `API error ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return data;
};

/**
 * All bug reports, newest first (optionally filtered by status).
 * @param {string} [status] - open | in_progress | resolved | wont_fix
 * @returns {Promise<object>} {reports}
 */
const fetchBugReports = status =>
    get(`/admin/bug-reports${status ? `?status=${encodeURIComponent(status)}` : ''}`);

/**
 * One report with presigned download URLs (project / thumbnail / screenshots).
 * @param {string} reportId - report id
 * @returns {Promise<object>} report detail
 */
const fetchBugReport = reportId => get(`/admin/bug-reports/${reportId}`);

export {BUG_REPORT_API_ENDPOINT, fetchBugReports, fetchBugReport};
