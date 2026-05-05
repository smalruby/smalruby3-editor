/**
 * Google Classroom Authentication
 *
 * Provides access tokens for Google Classroom API via Google Identity Services.
 * Uses a separate tokenClient from Google Drive to keep scopes independent.
 * Classroom scopes require separate OAuth consent screen approval.
 */
import { loadAllGoogleScripts } from './google-script-loader';

const CLASSROOM_SCOPES = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.students',
].join(' ');

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
 * Request an access token with Google Classroom scopes.
 * Returns cached token if still valid, otherwise triggers OAuth consent.
 * @returns {Promise<string>} Access token string.
 */
export const requestClassroomAccessToken = async () => {
    await _initialize();

    if (_isTokenValid()) {
        return _accessToken;
    }

    return new Promise((resolve, reject) => {
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
            _accessToken = response.access_token;
            // expires_in is in seconds
            _tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000;
            resolve(response.access_token);
        };

        _tokenClient.requestAccessToken({
            prompt: '',
            state: expectedState,
        });
    });
};

/**
 * Clear the cached access token (e.g., on 401 from backend).
 */
export const clearClassroomAccessToken = () => {
    _accessToken = null;
    _tokenExpiresAt = 0;
};
