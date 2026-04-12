/**
 * MSAL popup redirect handler (broadcastResponseToMainFrame).
 *
 * This is a webpack entry point bundled as auth-redirect.js.
 * It runs on auth-redirect.html inside the MSAL popup after Microsoft
 * authentication completes.
 *
 * The popup's sessionStorage is separate from the parent window's,
 * so handleRedirectPromise() cannot work here (no cached request).
 * Instead, we use broadcastResponseToMainFrame() to send the raw
 * auth response (URL hash) to the parent via BroadcastChannel.
 * The parent's MSAL instance then processes it with its own cache.
 */
import {broadcastResponseToMainFrame} from '@azure/msal-browser/redirect-bridge';

(async () => {
    try {
        await broadcastResponseToMainFrame();
    } catch {
        // eslint-disable-next-line no-console
        console.error('[auth-redirect] broadcastResponseToMainFrame failed');
    }
})();
