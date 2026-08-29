/**
 * Admin API client (EPIC #1073 S2).
 *
 * The id_token lives in module memory only — never in localStorage — so a
 * stray XSS cannot exfiltrate a long-lived credential (N1). A page reload
 * simply requires signing in again, which is acceptable for an operator
 * tool.
 */
const ADMIN_API_ENDPOINT = process.env.ADMIN_API_ENDPOINT || '';

let idToken = null;

/**
 * Store the verified Google id_token for subsequent requests.
 * @param {string|null} token - the id_token (null clears it)
 */
const setIdToken = token => {
    idToken = token;
};

/** @returns {boolean} whether a token is held */
const hasIdToken = () => Boolean(idToken);

/**
 * Expose the held token to sibling API clients (the bug-report read view) —
 * still module memory only, never persisted.
 * @returns {string|null} the current id_token
 */
const getIdToken = () => idToken;

/**
 * Perform an authenticated request against the admin API.
 * @param {string} method - HTTP method
 * @param {string} path - API path (starting with /admin/)
 * @param {object} [body] - JSON body for mutations
 * @returns {Promise<object|null>} parsed JSON (null on 204)
 */
const request = async (method, path, body) => {
    const response = await fetch(`${ADMIN_API_ENDPOINT}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
        },
        ...(body ? {body: JSON.stringify(body)} : {})
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        // Google ID tokens expire after ~1 hour: broadcast 401s so the app
        // shell can prompt for a reload (no listener is attached while the
        // login probe itself runs, so a bad first login stays a plain error).
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
 * Authorization probe: 200 = allowlisted admin, 403 = authenticated but not
 * an admin, 401 = bad/expired token.
 * @returns {Promise<object>} {email, name, stage}
 */
const fetchMe = () => request('GET', '/admin/me');

export {ADMIN_API_ENDPOINT, setIdToken, hasIdToken, getIdToken, request, fetchMe};

// --- みんなの課題 management (S3 #1083) ---

/**
 * Report queue: reported items grouped, most-reported first.
 * @returns {Promise<object>} {queue: [{sharedId, count, reports, item}]}
 */
const fetchSharedReports = () => request('GET', '/admin/shared-assignments/reports');

/**
 * Fleet-wide shared assignment list.
 * @param {object} [filters] - {status?, q?, visibility?}
 * @returns {Promise<object>} {items}
 */
const fetchSharedAssignments = (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.q) params.set('q', filters.q);
    if (filters.visibility) params.set('visibility', filters.visibility);
    const qs = params.toString();
    return request('GET', `/admin/shared-assignments${qs ? `?${qs}` : ''}`);
};

/**
 * Shared assignment detail (pages with presigned image URLs).
 * @param {string} sharedId - shared assignment id
 * @returns {Promise<object>} detail
 */
const fetchSharedAssignment = sharedId => request('GET', `/admin/shared-assignments/${sharedId}`);

/**
 * Moderation action: flip publication status (audited server-side).
 * @param {string} sharedId - shared assignment id
 * @param {string} status - 'published' | 'unlisted'
 * @returns {Promise<object>} updated summary
 */
const setSharedStatus = (sharedId, status) =>
    request('PATCH', `/admin/shared-assignments/${sharedId}`, {status});

/**
 * Admin 推薦 (#1110): mark / unmark a shared assignment as recommended.
 * Recommending notifies the author through the notification center (#1111);
 * withdrawal is silent. Audited server-side.
 * @param {string} sharedId - shared assignment id
 * @param {boolean} recommended - true = recommend, false = withdraw
 * @returns {Promise<object>} updated summary
 */
const setSharedRecommendation = (sharedId, recommended) =>
    request(recommended ? 'POST' : 'DELETE', `/admin/shared-assignments/${sharedId}/recommend`);

export {
    fetchSharedReports,
    fetchSharedAssignments,
    fetchSharedAssignment,
    setSharedStatus,
    setSharedRecommendation
};

// --- クラス・課題管理 + 期限切れ復元 (S4 #1084) ---

/**
 * Fleet-wide classroom list (quota rows filtered server-side).
 * @param {string} [q] - join code (exact) or class/assignment name (substring)
 * @returns {Promise<object>} {items}
 */
const fetchClassrooms = q =>
    request('GET', `/admin/classrooms${q ? `?q=${encodeURIComponent(q)}` : ''}`);

/**
 * Classroom detail with member/submission counts.
 * @param {string} classroomId - classroom id
 * @returns {Promise<object>} detail
 */
const fetchClassroom = classroomId => request('GET', `/admin/classrooms/${classroomId}`);

/**
 * Flip a classroom between active and archived (audited server-side).
 * @param {string} classroomId - classroom id
 * @param {string} status - 'active' | 'archived'
 * @returns {Promise<object>} updated summary
 */
const setClassroomStatus = (classroomId, status) =>
    request('PATCH', `/admin/classrooms/${classroomId}`, {status});

/**
 * Fleet-wide overview aggregation for the dashboard (creation trend, content
 * richness, theme keywords, みんなの課題 candidates).
 * @returns {Promise<object>} {summary, creationTrend, richnessDistribution, candidates, themeKeywords}
 */
const fetchClassroomOverview = () => request('GET', '/admin/classrooms/overview');

/**
 * Browse ddb-archive snapshots of deleted classrooms, narrowed by facets.
 * q is optional now — omit it to browse everything and classify with the
 * returned facets (削除時期 / 先生).
 * @param {object} [filters] - {q?, month?, teacher?}
 * @returns {Promise<object>} {items, total, facets:{byMonth, byTeacher}}
 */
const fetchRestoreCandidates = (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.month) params.set('month', filters.month);
    if (filters.teacher) params.set('teacher', filters.teacher);
    const qs = params.toString();
    return request('GET', `/admin/classrooms/restore-candidates${qs ? `?${qs}` : ''}`);
};

/**
 * Dry-run summary for one restore ({alive:true} when the classroom still
 * exists — the teacher UI handles that case).
 * @param {string} classroomId - classroom id
 * @returns {Promise<object>} plan summary
 */
const fetchRestorePlan = classroomId =>
    request('GET', `/admin/classrooms/${classroomId}/restore-plan`);

/**
 * Execute the restore (rehydrates group/classroom/members/submissions with
 * fresh TTLs; audited server-side).
 * @param {string} classroomId - classroom id
 * @returns {Promise<object>} {restored, missingFiles, classroom}
 */
const executeRestore = classroomId =>
    request('POST', `/admin/classrooms/${classroomId}/restore`);

/**
 * お知らせ送信 (notification center #1111): notify the teacher who owns the
 * classroom. The recipient is resolved server-side from the classroomId —
 * teacher subs never reach the SPA. Audited server-side.
 * @param {string} classroomId - classroom id
 * @param {object} payload - notice content
 * @param {string} payload.title - short heading (max 100 chars)
 * @param {string} payload.message - body text (max 1000 chars)
 * @returns {Promise<object>} {notificationId}
 */
const sendNotification = (classroomId, {title, message}) =>
    request('POST', '/admin/notifications', {classroomId, title, message});

/**
 * 共有推奨 (#1106): flag / unflag an assignment as "worth sharing to
 * みんなの課題". Flagging notifies the owning teacher (#1111) and lights the
 * banner in their editing view; withdrawal is silent. Audited server-side.
 * @param {string} classroomId - classroom id
 * @param {boolean} recommended - true = flag, false = withdraw
 * @returns {Promise<object>} updated classroom summary
 */
const setSharingRecommendation = (classroomId, recommended) =>
    request(recommended ? 'POST' : 'DELETE', `/admin/classrooms/${classroomId}/recommend-sharing`);

export {
    fetchClassrooms,
    fetchClassroom,
    setClassroomStatus,
    fetchClassroomOverview,
    fetchRestoreCandidates,
    fetchRestorePlan,
    executeRestore,
    sendNotification,
    setSharingRecommendation
};
