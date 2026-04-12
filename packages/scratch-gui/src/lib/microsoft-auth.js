/**
 * Microsoft Authentication via MSAL.js
 *
 * Provides ID tokens for teacher login using Microsoft Entra ID.
 * Uses `@azure/msal-browser` for popup-based authentication.
 *
 * IMPORTANT: Call `handleMsalPopupRedirect()` at app startup (before React renders).
 * When MSAL completes authentication in a popup, the popup redirects back to the app.
 * This function detects the popup context, sends the auth result to the parent window,
 * and closes the popup — preventing the full app from loading inside it.
 */
import { PublicClientApplication } from '@azure/msal-browser';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';

let _msalInstance = null;
let _initPromise = null;

/**
 * Get or create the MSAL instance (singleton).
 * @returns {PublicClientApplication} The MSAL instance (may not be initialized yet).
 */
const _getMsalInstance = () => {
    if (!_msalInstance) {
        _msalInstance = new PublicClientApplication({
            auth: {
                clientId: MICROSOFT_CLIENT_ID,
                authority: 'https://login.microsoftonline.com/common',
                redirectUri: window.location.origin,
            },
            cache: {
                cacheLocation: 'sessionStorage',
            },
        });
    }
    return _msalInstance;
};

/**
 * Initialize MSAL instance (async, cached).
 * @returns {Promise<PublicClientApplication>} The initialized MSAL instance.
 */
const _initialize = () => {
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        if (!MICROSOFT_CLIENT_ID) {
            throw new Error('MICROSOFT_CLIENT_ID is not configured.');
        }

        const instance = _getMsalInstance();
        await instance.initialize();
        return instance;
    })();

    return _initPromise;
};

/**
 * Synchronously detect if this page is loaded inside an MSAL popup redirect.
 *
 * After Microsoft auth completes, the popup navigates to the redirect URI
 * with auth response params in the URL hash (code=...&state=...).
 * This check is synchronous so it can be used to skip React rendering entirely.
 * @returns {boolean} True if this page is in an MSAL popup redirect context.
 */
export const isMsalPopupRedirect = () => {
    if (!MICROSOFT_CLIENT_ID) return false;
    if (typeof window === 'undefined') return false;
    // MSAL popup: opened by parent window, URL hash contains auth response
    const hash = window.location.hash;
    return Boolean(window.opener && hash && hash.includes('code=') && hash.includes('state='));
};

/**
 * Handle MSAL popup redirect at app startup.
 *
 * Call this when `isMsalPopupRedirect()` returns true. Initializes MSAL,
 * processes the auth response in the URL hash, sends the result to the
 * parent window via postMessage, and closes the popup.
 */
export const handleMsalPopupRedirect = async () => {
    try {
        const instance = await _initialize();
        await instance.handleRedirectPromise();
    } catch {
        // If handling fails, close the popup to avoid getting stuck
        window.close();
    }
};

/**
 * Request a Microsoft ID token via popup login.
 * @returns {Promise<string>} The ID token string.
 */
export const requestMicrosoftIdToken = async () => {
    const msalInstance = await _initialize();

    // Try silent acquisition first (cached account)
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
        try {
            const result = await msalInstance.acquireTokenSilent({
                scopes: ['openid', 'profile'],
                account: accounts[0],
            });
            if (result.idToken) {
                return result.idToken;
            }
        } catch {
            // Silent acquisition failed, fall through to popup
        }
    }

    // Interactive login via popup
    const result = await msalInstance.loginPopup({
        scopes: ['openid', 'profile'],
        prompt: 'select_account',
    });

    if (!result.idToken) {
        throw new Error(
            'Microsoft authentication failed: no ID token received',
        );
    }

    return result.idToken;
};

/**
 * Check if Microsoft auth is configured.
 * @returns {boolean} True if MICROSOFT_CLIENT_ID is set.
 */
export const isMicrosoftAuthAvailable = () => Boolean(MICROSOFT_CLIENT_ID);

/**
 * Clear the cached Microsoft session.
 */
export const clearMicrosoftAuth = async () => {
    if (!_msalInstance) return;
    try {
        const instance = await _initialize();
        const accounts = instance.getAllAccounts();
        for (const account of accounts) {
            await instance.logout({
                account,
                onRedirectNavigate: () => false, // prevent navigation
            });
        }
    } catch {
        // Ignore errors during cleanup
    }
};
