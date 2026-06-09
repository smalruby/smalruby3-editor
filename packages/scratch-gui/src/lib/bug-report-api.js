/**
 * Bug Report API Client
 *
 * Communicates with smalruby-bug-report (AWS Lambda) so users can report
 * program bugs with their current project attached, and check the developer's
 * reply later. Mirrors the request/retry conventions of classroom-api.js.
 */

const BUG_REPORT_API_ENDPOINT = process.env.BUG_REPORT_API_ENDPOINT || '';

class BugReportAPI {
    /**
     * Whether the bug report API endpoint is configured.
     * @returns {boolean} True if the endpoint is set
     */
    static isConfigured() {
        return !!BUG_REPORT_API_ENDPOINT;
    }

    /**
     * Create a bug report and obtain presigned upload URLs for the attached
     * project, thumbnail and block screenshots.
     * @param {string} idToken - Google/Microsoft ID token
     * @param {object} report - Report fields
     * @param {string} report.description - What went wrong (required)
     * @param {string} [report.projectName] - Project title
     * @param {number} [report.screenshotCount] - Number of block screenshots (0-20)
     * @param {string} [report.userAgent] - Browser user agent
     * @param {object} [report.appContext] - Editor context (rubyVersion, mode, url, locale)
     * @returns {Promise<object>} {reportId, uploadUrl, thumbnailUploadUrl, screenshotUploadUrls, createdAt}
     */
    async createReport(idToken, report) {
        return this._request('POST', '/bug-reports', report, idToken);
    }

    /**
     * List the caller's own bug reports (status + developer reply only).
     * @param {string} idToken - Google/Microsoft ID token
     * @returns {Promise<object>} {reports: Array}
     */
    async listMyReports(idToken) {
        return this._request('GET', '/bug-reports', null, idToken);
    }

    /**
     * Hide or unhide one of the caller's own reports from their list. Does not
     * delete — sets the server-side hiddenByOwner flag (the report stays for
     * the developers).
     * @param {string} idToken - Google/Microsoft ID token
     * @param {string} reportId - Report ID (must be owned by the caller)
     * @param {boolean} hidden - true to hide, false to unhide
     * @returns {Promise<object>} {reportId, hiddenByOwner}
     */
    async setReportHidden(idToken, reportId, hidden) {
        return this._request('PATCH', `/bug-reports/${reportId}`, { hidden }, idToken);
    }

    /**
     * Upload data to a presigned S3 URL.
     * @param {string} url - Presigned URL
     * @param {ArrayBuffer|Blob|string} data - Data to upload
     * @param {string} contentType - MIME type
     * @returns {Promise<void>}
     */
    async uploadToPresignedUrl(url, data, contentType) {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: data,
        });
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
    }

    // --- Admin (used by the future admin dashboard; the /bug-report skill
    // accesses DynamoDB/S3 directly with AWS credentials). ---

    /**
     * List all reports (admin only).
     * @param {string} idToken - Admin ID token
     * @param {string} [status] - Optional status filter
     * @returns {Promise<object>} {reports: Array}
     */
    async listReports(idToken, status) {
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        return this._request('GET', `/admin/bug-reports${query}`, null, idToken);
    }

    /**
     * Get a report's detail with download URLs (admin only).
     * @param {string} idToken - Admin ID token
     * @param {string} reportId - Report ID
     * @returns {Promise<object>} Report detail + projectUrl/thumbnailUrl/screenshotUrls
     */
    async getReport(idToken, reportId) {
        return this._request('GET', `/admin/bug-reports/${reportId}`, null, idToken);
    }

    /**
     * Update a report's status and/or developer reply (admin only).
     * @param {string} idToken - Admin ID token
     * @param {string} reportId - Report ID
     * @param {object} updates - {status, developerReply}
     * @returns {Promise<object>} Updated fields
     */
    async updateReport(idToken, reportId, updates) {
        return this._request('PATCH', `/admin/bug-reports/${reportId}`, updates, idToken);
    }

    /**
     * List administrators (admin only).
     * @param {string} idToken - Admin ID token
     * @returns {Promise<object>} {admins: Array}
     */
    async listAdmins(idToken) {
        return this._request('GET', '/admin/admins', null, idToken);
    }

    /**
     * Add an administrator by email (admin only).
     * @param {string} idToken - Admin ID token
     * @param {string} email - Email to grant admin
     * @returns {Promise<object>} {email}
     */
    async addAdmin(idToken, email) {
        return this._request('POST', '/admin/admins', { email }, idToken);
    }

    /**
     * Remove an administrator by email (admin only).
     * @param {string} idToken - Admin ID token
     * @param {string} email - Email to revoke
     * @returns {Promise<object>} {email}
     */
    async removeAdmin(idToken, email) {
        return this._request('DELETE', `/admin/admins/${encodeURIComponent(email)}`, null, idToken);
    }

    /**
     * Internal request helper with 429 backoff.
     * @param {string} method - HTTP method
     * @param {string} path - API path
     * @param {object|null} body - Request body
     * @param {string} [authToken] - Bearer token
     * @returns {Promise<object|null>} Response data
     * @private
     */
    async _request(method, path, body, authToken) {
        const url = `${BUG_REPORT_API_ENDPOINT}${path}`;
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
        }

        const options = { method, headers };
        if (body && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        const maxRetries = 3;
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            const response = await fetch(url, options);

            if (response.status === 204) return null;

            if (response.status === 429 && attempt < maxRetries) {
                const delay = 500 * Math.pow(2, attempt);
                const jitter = Math.random() * 200;
                await new Promise((r) => setTimeout(r, delay + jitter));
                continue;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                lastError = new Error(errorData.error || `API error ${response.status}`);
                lastError.status = response.status;
                lastError.body = errorData;
                throw lastError;
            }

            return response.json().catch(() => null);
        }

        throw lastError;
    }
}

const isBugReportConfigured = BugReportAPI.isConfigured;

export { BugReportAPI, isBugReportConfigured, BUG_REPORT_API_ENDPOINT };
export default new BugReportAPI();
