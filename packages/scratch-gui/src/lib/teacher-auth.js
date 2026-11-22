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

// Width of Google's rendered button, in px. Kept in step with the sign-in
// buttons we draw next to it (sign-in-button.css), so they line up.
const GOOGLE_BUTTON_WIDTH_PX = 240;

// The login attempt currently owning the GIS sign-in UI, or null.
// Only one may exist at a time so the rendered button can never accumulate
// (#1149: repeated login attempts used to stack up overlays under <body>).
let activeGoogleLogin = null;

/**
 * Abort the in-flight Google login, if any.
 *
 * Removes the rendered sign-in button, closes One Tap and settles the pending
 * promise with a rejection so the caller never holds an unresolved promise.
 * Safe to call when no login is in flight.
 */
export const cancelGoogleLogin = () => {
    if (activeGoogleLogin) {
        activeGoogleLogin.abort();
    }
};

/**
 * Perform Google interactive login through Google's own sign-in button.
 *
 * The button is rendered into `container` (a node owned by the calling modal)
 * rather than into a fixed overlay under `document.body`, so unmounting the
 * modal takes the button with it (#1149).
 *
 * Google's button is the entry point from the start, and the One Tap prompt is
 * not used. Chrome stops showing the prompt for a while after the user closes
 * it once (FedCM cooldown), and it does not tell the page, so a button that
 * asked for the prompt did nothing on the first press. A press on Google's own
 * button always opens Google's sign-in (FedCM button mode in Chrome, a popup
 * elsewhere), so one press is enough.
 * @param {object} [options] - login options
 * @param {HTMLElement} [options.container] - node to render the sign-in button
 *   into. Without it no button is rendered.
 * @param {Function} [options.onButtonVisible] - called once Google's button has
 *   been rendered, so the caller can show it in place of its own button.
 * @returns {Promise<string>} Google ID token
 */
export const loginWithGoogle = async ({ container, onButtonVisible } = {}) => {
    await loadGoogleIdentity();

    // Supersede any previous attempt (its promise is rejected by abort()).
    cancelGoogleLogin();

    // The login UI may have gone away while the script loaded; a button
    // rendered into a detached node could never be pressed.
    if (container && !container.isConnected) {
        throw new Error('Google Sign-In cancelled');
    }

    return new Promise((resolve, reject) => {
        let mount = null;

        const cleanup = () => {
            if (activeGoogleLogin === session) {
                activeGoogleLogin = null;
            }
            if (mount && mount.parentNode) {
                mount.parentNode.removeChild(mount);
            }
            mount = null;
            try {
                google.accounts.id.cancel();
            } catch {
                // GIS may be unavailable (e.g. script blocked); nothing to close.
            }
        };

        const session = {
            abort: () => {
                cleanup();
                reject(new Error('Google Sign-In cancelled'));
            },
        };
        activeGoogleLogin = session;

        /* global google */
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            use_fedcm_for_button: true,
            callback: (response) => {
                cleanup();
                if (response && response.credential) {
                    resolve(response.credential);
                } else {
                    reject(new Error('Google Sign-In failed'));
                }
            },
        });

        if (container) {
            mount = document.createElement('div');
            mount.setAttribute('data-testid', 'google-signin-button');
            container.appendChild(mount);
            google.accounts.id.renderButton(mount, {
                // The shape our sign-in buttons copy (sign-in-button.css).
                theme: 'outline',
                size: 'large',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: GOOGLE_BUTTON_WIDTH_PX,
            });
            if (onButtonVisible) {
                onButtonVisible();
            }
        }
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
                    use_fedcm_for_prompt: true,
                    callback: (response) => {
                        if (response && response.credential) {
                            resolve(response.credential);
                        } else {
                            reject(new Error('Silent reauth failed'));
                        }
                    },
                });
                // FedCM-safe: dismissal is the only moment that keeps working
                // once FedCM is mandatory, so it is the sole failure signal.
                // Everything else (prompt not shown at all, user ignoring the
                // prompt) is covered by the REAUTH_TIMEOUT_MS race below.
                google.accounts.id.prompt((notification) => {
                    const dismissed =
                        notification &&
                        typeof notification.isDismissedMoment === 'function' &&
                        notification.isDismissedMoment();
                    if (!dismissed) return;
                    const reason =
                        typeof notification.getDismissedReason === 'function'
                            ? notification.getDismissedReason()
                            : null;
                    if (reason !== 'credential_returned') {
                        reject(new Error('Silent reauth dismissed'));
                    }
                });
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Silent reauth timeout')), REAUTH_TIMEOUT_MS),
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
