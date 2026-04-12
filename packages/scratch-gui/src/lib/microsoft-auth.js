/**
 * Microsoft Authentication via MSAL.js
 *
 * Provides ID tokens for teacher login using Microsoft Entra ID.
 * Uses `@azure/msal-browser` for popup-based authentication.
 */
import { PublicClientApplication } from '@azure/msal-browser';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || '';

let _msalInstance = null;
let _initPromise = null;

/**
 * Initialize MSAL instance.
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
                redirectUri: window.location.origin,
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
        throw new Error('Microsoft authentication failed: no ID token received');
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
export const clearMicrosoftAuth = () => {
    if (_msalInstance) {
        const accounts = _msalInstance.getAllAccounts();
        accounts.forEach((account) => {
            _msalInstance.getTokenCache().removeAccount(account);
        });
    }
};
