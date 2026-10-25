/**
 * Google Classroom Authentication
 *
 * Provides access tokens for Google Classroom API via Google Identity Services.
 * Uses a separate tokenClient from Google Drive to keep scopes independent.
 * Classroom scopes require separate OAuth consent screen approval.
 */
import { loadAllGoogleScripts } from './google-script-loader';

export const CLASSROOM_SCOPE_LIST = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
    // Required to create course work (= post an assignment). Google shows one
    // checkbox per scope, so a teacher can grant the read-only ones and leave
    // this one off — the posting call then fails inside Google (issue #1175).
    'https://www.googleapis.com/auth/classroom.coursework.students',
];

const CLASSROOM_SCOPES = CLASSROOM_SCOPE_LIST.join(' ');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

let _tokenClient = null;
let _accessToken = null;
let _tokenExpiresAt = 0;
let _initPromise = null;

/**
 * Generate a cryptographically random state string for CSRF protection.
 * @returns {string} Random 32-character hex string.
 */
const _generateState = () => {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Check if the current access token is still valid.
 * @returns {boolean} True if token exists and is not expired.
 */
const _isTokenValid = () => {
    if (!_accessToken || !_tokenExpiresAt) {
        return false;
    }
    // 60s buffer to avoid edge cases
    return _tokenExpiresAt > Date.now() + 60000;
};

/**
 * Initialize GIS tokenClient for Google Classroom scopes.
 * @returns {Promise<void>} Resolves when initialization is complete.
 */
const _initialize = () => {
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        if (!CLIENT_ID) {
            throw new Error('GOOGLE_CLIENT_ID is not configured.');
        }

        await loadAllGoogleScripts();

        _tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: CLASSROOM_SCOPES,
            callback: '', // set dynamically in requestClassroomAccessToken
        });
    })();

    return _initPromise;
};

/**
 * Ask Google Identity Services for a token.
 * @param {string} prompt - GIS prompt mode ('' = silent when already granted).
 * @returns {Promise<object>} The GIS token response.
 */
const _requestToken = (prompt) =>
    new Promise((resolve, reject) => {
        const expectedState = _generateState();

        _tokenClient.callback = (response) => {
            if (response.error) {
                reject(new Error(`Google Classroom authentication failed: ${response.error}`));
                return;
            }
            if (response.state !== expectedState) {
                const mismatch = new Error('OAuth state mismatch: potential CSRF attack detected');
                // Flagged so callers never downgrade a possible CSRF into a
                // routine "permission was not granted" message.
                mismatch.isStateMismatch = true;
                reject(mismatch);
                return;
            }
            resolve(response);
        };

        _tokenClient.requestAccessToken({ prompt, state: expectedState });
    });

/**
 * Check that the token response carries every scope we need. Older GIS builds
 * may not expose the helper; assume granted then so we never block a teacher on
 * a check we cannot perform.
 * @param {object} response - GIS token response.
 * @returns {boolean} True when all classroom scopes were granted.
 */
const _hasAllScopes = (response) => {
    const oauth2 = window.google && window.google.accounts && window.google.accounts.oauth2;
    if (!oauth2 || typeof oauth2.hasGrantedAllScopes !== 'function') return true;
    return oauth2.hasGrantedAllScopes(response, ...CLASSROOM_SCOPE_LIST);
};

/**
 * Store a fully-granted token for reuse.
 * @param {object} response - GIS token response.
 * @returns {string} The access token.
 */
const _cacheToken = (response) => {
    _accessToken = response.access_token;
    // expires_in is in seconds
    _tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000;
    return _accessToken;
};

/**
 * Build the error raised when the teacher did not grant every scope.
 * @param {Error} [cause] - Underlying GIS failure, when there was one.
 * @returns {Error} Error carrying the googlePermissionDenied reason.
 */
const _permissionDeniedError = (cause) => {
    const err = new Error('Google Classroom permission was not granted. Please allow every requested permission.');
    // Same key the backend uses for a Google 403 so the UI translates both the
    // client-side (unticked scope) and server-side denial identically.
    err.googleReason = 'googlePermissionDenied';
    if (cause) err.cause = cause;
    return err;
};

/**
 * Request an access token with Google Classroom scopes.
 * Returns cached token if still valid, otherwise triggers OAuth consent.
 * @returns {Promise<string>} Access token string.
 */
export const requestClassroomAccessToken = async () => {
    await _initialize();

    if (_isTokenValid()) {
        return _accessToken;
    }

    const response = await _requestToken('');
    if (_hasAllScopes(response)) {
        return _cacheToken(response);
    }

    // The teacher unticked at least one scope on the consent screen. Ask again
    // with an explicit consent prompt so they can grant the missing one; a
    // silent re-request would just hand back the same partial grant.
    let retry;
    try {
        retry = await _requestToken('consent');
    } catch (err) {
        // This second popup opens after the first consent round trip, so the
        // original click no longer counts as user activation and the browser
        // may refuse to open it; the teacher can also close or decline it.
        // All of those are still "the permission was not granted" — report
        // them as such instead of surfacing GIS's raw English error, which is
        // exactly the opaque message issue #1175 is about. A state mismatch is
        // a possible CSRF and must never be downgraded.
        if (err && err.isStateMismatch) throw err;
        throw _permissionDeniedError(err);
    }
    if (_hasAllScopes(retry)) {
        return _cacheToken(retry);
    }

    throw _permissionDeniedError();
};

/**
 * Return the cached access token, or null when there is none that is still
 * valid. Never contacts Google and never opens a consent popup — used by
 * checks that must stay invisible, such as the pre-flight that decides whether
 * the Google Classroom share button can work (issue #1184).
 * @returns {?string} Cached access token, or null.
 */
export const getCachedClassroomAccessToken = () => (_isTokenValid() ? _accessToken : null);

/**
 * Clear the cached access token (e.g., on 401 from backend).
 */
export const clearClassroomAccessToken = () => {
    _accessToken = null;
    _tokenExpiresAt = 0;
};
