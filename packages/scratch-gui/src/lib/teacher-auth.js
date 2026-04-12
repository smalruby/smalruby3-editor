/**
 * Teacher authentication abstraction.
 *
 * Provides a unified API for Google and Microsoft teacher authentication:
 * - Login (interactive)
 * - Silent re-authentication (on 401)
 * - Logout (clear sessions)
 * - Page-reload cleanup
 */
import { loadGoogleIdentity } from './google-script-loader.js';
import {
    requestMicrosoftIdToken,
    refreshMicrosoftIdToken,
    isMicrosoftAuthAvailable,
    clearMicrosoftAuth,
} from './microsoft-auth.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REAUTH_TIMEOUT_MS = 5000;

/**
 * Perform Google interactive login via One Tap or button fallback.
 * @returns {Promise<string>} Google ID token
 */
export const loginWithGoogle = async () => {
    await loadGoogleIdentity();

    return new Promise((resolve, reject) => {
        let signInContainer = null;
        let signInObserver = null;

        const cleanup = () => {
            if (signInObserver) {
                signInObserver.disconnect();
                signInObserver = null;
            }
            if (signInContainer && signInContainer.parentNode) {
                signInContainer.parentNode.removeChild(signInContainer);
            }
            signInContainer = null;
        };

        /* global google */
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response) => {
                cleanup();
                if (response.credential) {
                    resolve(response.credential);
                } else {
                    reject(new Error('Google Sign-In failed'));
                }
            },
        });

        google.accounts.id.prompt((notification) => {
            if (
                notification.isNotDisplayed() ||
                notification.isSkippedMoment()
            ) {
                signInContainer = document.createElement('div');
                signInContainer.style.cssText =
                    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;';
                document.body.appendChild(signInContainer);
                google.accounts.id.renderButton(signInContainer, {
                    theme: 'outline',
                    size: 'large',
                });
                signInObserver = new MutationObserver(() => {
                    if (!document.body.contains(signInContainer)) {
                        signInObserver.disconnect();
                        signInObserver = null;
                    }
                });
                signInObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                });
            }
        });
    });
};

/**
 * Perform Google silent re-authentication via One Tap auto_select.
 * @returns {Promise<string|null>} New ID token or null if failed
 */
export const silentReauthGoogle = async () => {
    try {
        await loadGoogleIdentity();
        const newToken = await Promise.race([
            new Promise((resolve, reject) => {
                google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    auto_select: true,
                    callback: (response) => {
                        if (response.credential) {
                            resolve(response.credential);
                        } else {
                            reject(new Error('Silent reauth failed'));
                        }
                    },
                });
                google.accounts.id.prompt((notification) => {
                    if (
                        notification.isNotDisplayed() ||
                        notification.isSkippedMoment()
                    ) {
                        reject(
                            new Error('Silent reauth not available'),
                        );
                    }
                    if (notification.isDismissedMoment()) {
                        reject(new Error('User dismissed reauth'));
                    }
                    if (
                        notification.isDisplayMoment() &&
                        !notification.isNotDisplayed()
                    ) {
                        google.accounts.id.cancel();
                        reject(
                            new Error('One Tap displayed, not silent'),
                        );
                    }
                });
            }),
            new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error('Silent reauth timeout')),
                    REAUTH_TIMEOUT_MS,
                ),
            ),
        ]);
        return newToken;
    } catch {
        try {
            google.accounts.id.cancel();
        } catch {
            // google may not be loaded
        }
        return null;
    }
};

/**
 * Perform Microsoft silent re-authentication with forceRefresh.
 * @returns {Promise<string|null>} New ID token or null if failed
 */
export const silentReauthMicrosoft = async () => {
    try {
        return await refreshMicrosoftIdToken();
    } catch {
        return null;
    }
};

/**
 * Attempt silent re-authentication based on the auth provider.
 * @param {string|null} provider - 'google' | 'microsoft' | null
 * @returns {Promise<string|null>} New ID token or null
 */
export const attemptSilentReauth = async (provider) => {
    if (provider === 'microsoft') {
        return silentReauthMicrosoft();
    }
    return silentReauthGoogle();
};

/**
 * Clear auth session for the given provider.
 * @param {string|null} provider - 'google' | 'microsoft' | null
 */
export const clearAuthSession = (provider) => {
    if (provider === 'microsoft') {
        clearMicrosoftAuth();
    }
};

/**
 * Clean up stale auth sessions on page reload.
 * Called at module init time — clears MSAL sessionStorage if no
 * cached token exists (prevents stale silent acquisition).
 */
export const cleanupOnReload = () => {
    clearMicrosoftAuth();
};

export { requestMicrosoftIdToken, isMicrosoftAuthAvailable };
