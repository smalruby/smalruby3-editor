/**
 * Microsoft Authentication via MSAL.js
 *
 * Provides ID tokens for teacher login using Microsoft Entra ID.
 * Uses `@azure/msal-browser` for popup-based authentication.
 *
 * The popup redirects to a dedicated /auth-redirect.html page (not the main app).
 * That page runs a bundled script (auth-redirect.js) that calls
 * broadcastResponseToMainFrame() to send the auth response back
 * to this parent window via BroadcastChannel.
 */
import { PublicClientApplication } from '@azure/msal-browser';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';

/** Dedicated redirect page for popup auth (must not load the full SPA). */
const POPUP_REDIRECT_URI = `${
    typeof window === 'undefined' ? '' : window.location.origin
}/auth-redirect.html`;

let _msalInstance = null;
let _initPromise = null;

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

        _msalInstance = new PublicClientApplication({
            auth: {
                clientId: MICROSOFT_CLIENT_ID,
                authority: 'https://login.microsoftonline.com/common',
                redirectUri: POPUP_REDIRECT_URI,
            },
            cache: {
                cacheLocation: 'sessionStorage',
            },
        });

        await _msalInstance.initialize();
        return _msalInstance;
    })();

    return _initPromise;
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
                redirectUri: POPUP_REDIRECT_URI,
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
        redirectUri: POPUP_REDIRECT_URI,
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
                onRedirectNavigate: () => false,
            });
        }
    } catch {
        // Ignore errors during cleanup
    }
};
