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

export {ADMIN_API_ENDPOINT, setIdToken, hasIdToken, request, fetchMe};
