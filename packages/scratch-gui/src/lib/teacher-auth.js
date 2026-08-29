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
 * Whether this browser can show Google's own sign-in prompt (FedCM).
 *
 * Without it — Safari, older Firefox, embedded webviews, anything with
 * third-party sign-in blocked — `prompt()` has nothing to show and the user
 * would sit in front of a button that never reacts. There we skip the prompt
 * and offer Google's rendered button straight away instead of waiting on a
 * timer, which raced with the prompt the user was still reading.
 * @returns {boolean} true when the browser mediates the Google prompt itself
 */
export const isGoogleBrowserPromptSupported = () => typeof window !== 'undefined' && 'IdentityCredential' in window;

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
 * Whether a Google login is waiting for the user right now.
 * @returns {boolean} true while an attempt owns the sign-in UI
 */
export const isGoogleLoginInFlight = () => activeGoogleLogin !== null;

/**
 * Put Google's own button in front of the user for the login already running.
 *
 * The dismissal signal is not guaranteed to arrive — a browser prompt can also
 * be closed in ways GIS never reports — so pressing our login button again
 * ("nothing happened, let me try that once more") is treated as the request
 * for the button. Safe to call when no login is in flight.
 */
export const revealGoogleSignInButton = () => {
    if (activeGoogleLogin) {
        activeGoogleLogin.handOver('retry');
    }
};

/**
 * Perform Google interactive login via One Tap plus an in-place button.
 *
 * The button is rendered into `container` (a node owned by the calling modal)
 * rather than into a fixed overlay under `document.body`, so unmounting the
 * modal takes the button with it.
 *
 * There is only ever one Google entry point on screen. The caller shows its own
 * login button; this function asks for the button to take its place — never to
 * sit next to it — through `onFallbackVisible`:
 *
 * - browser prompt available: try the prompt, and swap in the rendered button
 *   only once the prompt is dismissed without a credential (`'dismissed'`);
 * - browser prompt unavailable: swap it in immediately (`'unsupported'`),
 *   since nothing is going to appear on its own.
 *
 * Dismissal is the one prompt moment that survives the FedCM migration, so it
 * is the only one consulted — `isNotDisplayed()` / `isSkippedMoment()` are not.
 * @see https://developers.google.com/identity/gsi/web/guides/fedcm-migration
 * @param {object} [options] - login options
 * @param {HTMLElement} [options.container] - node to render the sign-in button
 *   into. Without it only the browser prompt is offered.
 * @param {Function} [options.onFallbackVisible] - called once with the reason
 *   the button took over: `'dismissed'` or `'unsupported'`.
 * @returns {Promise<string>} Google ID token
 */
export const loginWithGoogle = async ({ container, onFallbackVisible } = {}) => {
    await loadGoogleIdentity();

    // Supersede any previous attempt (its promise is rejected by abort()).
    cancelGoogleLogin();

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

        let handedOver = false;
        const handOverToButton = (why) => {
            if (handedOver || !mount) {
                return;
            }
            handedOver = true;
            if (onFallbackVisible) {
                onFallbackVisible(why);
            }
        };

        const session = {
            abort: () => {
                cleanup();
                reject(new Error('Google Sign-In cancelled'));
            },
            handOver: handOverToButton,
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

        if (container) {
            mount = document.createElement('div');
            mount.setAttribute('data-testid', 'google-signin-button');
            container.appendChild(mount);
            google.accounts.id.renderButton(mount, {
                theme: 'outline',
                size: 'large',
            });
        }

        if (mount && !isGoogleBrowserPromptSupported()) {
            // Nothing would come up, so do not ask and do not make the user wait.
            handOverToButton('unsupported');
            return;
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
                handOverToButton('dismissed');
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
