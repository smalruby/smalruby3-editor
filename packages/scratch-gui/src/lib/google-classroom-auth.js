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
                reject(new Error('OAuth state mismatch: potential CSRF attack detected'));
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
    const retry = await _requestToken('consent');
    if (_hasAllScopes(retry)) {
        return _cacheToken(retry);
    }

    const err = new Error('Google Classroom permission was not granted. Please allow every requested permission.');
    // Same key the backend uses for a Google 403 so the UI translates both the
    // client-side (unticked scope) and server-side denial identically.
    err.googleReason = 'googlePermissionDenied';
    throw err;
};

/**
 * Clear the cached access token (e.g., on 401 from backend).
 */
export const clearClassroomAccessToken = () => {
    _accessToken = null;
    _tokenExpiresAt = 0;
};
