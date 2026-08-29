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

// How long to wait for the browser's own Google prompt (One Tap / FedCM) to
// produce a credential before offering the in-modal button instead. Long
// enough that the button does not flash in front of a prompt the user is
// already reading, short enough that a silent failure is not a dead end.
const FALLBACK_REVEAL_MS = 4000;

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
 * Perform Google interactive login via One Tap plus an in-place button.
 *
 * The button is rendered into `container` (a node owned by the calling modal)
 * rather than into a fixed overlay under `document.body`, so unmounting the
 * modal takes the button with it.
 *
 * It starts hidden: when the browser shows its own Google prompt, a second
 * "Sign in as ..." button next to our own login button is just confusing. The
 * button is revealed only once that prompt is known to be no help — it was
 * dismissed without returning a credential, or nothing happened within
 * `FALLBACK_REVEAL_MS`. The reveal is driven by a timer and `isDismissedMoment()`
 * rather than by `isNotDisplayed()` / `isSkippedMoment()`, which stop working
 * once FedCM becomes mandatory.
 * @see https://developers.google.com/identity/gsi/web/guides/fedcm-migration
 * @param {object} [options] - login options
 * @param {HTMLElement} [options.container] - node to render the sign-in button
 *   into. Without it only the browser prompt is offered.
 * @param {Function} [options.onFallbackVisible] - called once when the button
 *   is revealed, so the caller can explain what it is for.
 * @returns {Promise<string>} Google ID token
 */
export const loginWithGoogle = async ({ container, onFallbackVisible } = {}) => {
    await loadGoogleIdentity();

    // Supersede any previous attempt (its promise is rejected by abort()).
    cancelGoogleLogin();

    return new Promise((resolve, reject) => {
        let mount = null;
        let revealTimer = null;

        const cleanup = () => {
            if (activeGoogleLogin === session) {
                activeGoogleLogin = null;
            }
            if (revealTimer !== null) {
                clearTimeout(revealTimer);
                revealTimer = null;
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
            use_fedcm_for_prompt: true,
            callback: (response) => {
                cleanup();
                if (response && response.credential) {
                    resolve(response.credential);
                } else {
                    reject(new Error('Google Sign-In failed'));
                }
            },
        });

        const revealFallback = () => {
            if (revealTimer !== null) {
                clearTimeout(revealTimer);
                revealTimer = null;
            }
            if (!mount || !mount.hidden) {
                return;
            }
            mount.hidden = false;
            if (onFallbackVisible) {
                onFallbackVisible();
            }
        };

        if (container) {
            mount = document.createElement('div');
            mount.setAttribute('data-testid', 'google-signin-button');
            // Rendered up front (GIS needs a node in the document) but hidden
            // until the browser prompt turns out not to help.
            mount.hidden = true;
            container.appendChild(mount);
            google.accounts.id.renderButton(mount, {
                theme: 'outline',
                size: 'large',
            });
            revealTimer = setTimeout(revealFallback, FALLBACK_REVEAL_MS);
        }

        google.accounts.id.prompt((notification) => {
            // `isDismissedMoment()` is the one moment method that survives the
            // FedCM migration. A dismissal that returned a credential is the
            // success path — the callback above already settled the promise.
            const dismissed =
                notification &&
                typeof notification.isDismissedMoment === 'function' &&
                notification.isDismissedMoment();
            if (!dismissed) {
                return;
            }
            const reason =
                typeof notification.getDismissedReason === 'function' ? notification.getDismissedReason() : null;
            if (reason !== 'credential_returned') {
                revealFallback();
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
