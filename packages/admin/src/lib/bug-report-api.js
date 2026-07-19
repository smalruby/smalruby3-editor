/**
 * Bug-report API client (EPIC #1073 S5, decision D — extended 2026-07-19).
 *
 * The bug-report backend is unchanged: the admin console talks to the
 * EXISTING bug-report admin API. Originally view-only, the console now also
 * uses the existing PATCH endpoint for status changes and developer replies
 * (owner-requested spec addition). The admin's Google id_token is accepted
 * by the bug-report Lambda as an additional audience (decision F), and the
 * operator must be registered in the BugReportAdmins email registry.
 */
import {getIdToken} from './admin-api.js';

const BUG_REPORT_API_ENDPOINT = process.env.BUG_REPORT_API_ENDPOINT || '';

/**
 * Perform an authenticated request against the bug-report API.
 * @param {string} method - HTTP method
 * @param {string} path - API path (starting with /admin/)
 * @param {object} [body] - JSON body for mutations
 * @returns {Promise<object>} parsed JSON
 */
const request = async (method, path, body) => {
    const response = await fetch(`${BUG_REPORT_API_ENDPOINT}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getIdToken()}`
        },
        ...(body ? {body: JSON.stringify(body)} : {})
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
    request('GET', `/admin/bug-reports${status ? `?status=${encodeURIComponent(status)}` : ''}`);

/**
 * One report with presigned download URLs (project / thumbnail / screenshots).
 * @param {string} reportId - report id
 * @returns {Promise<object>} report detail
 */
const fetchBugReport = reportId => request('GET', `/admin/bug-reports/${reportId}`);

/**
 * Update the status and/or developer reply (existing bug-report admin API).
 * Server side effects: the report is un-hidden for the reporter; a terminal
 * status (resolved / wont_fix) starts the auto-delete TTL, reopening clears
 * it.
 * @param {string} reportId - report id
 * @param {object} updates - {status?, developerReply?} (send only changes)
 * @returns {Promise<object>} updated report
 */
const updateBugReport = (reportId, updates) =>
    request('PATCH', `/admin/bug-reports/${reportId}`, updates);

export {BUG_REPORT_API_ENDPOINT, fetchBugReports, fetchBugReport, updateBugReport};
