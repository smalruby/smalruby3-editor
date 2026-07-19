/**
 * Google Sign-In (GIS) integration for the admin SPA (EPIC #1073, decision
 * B: admin-dedicated OAuth client ID).
 *
 * Dev bypass: `?devlogin=<DEV_BYPASS_TOKEN>` skips GIS entirely (stg only —
 * the API rejects the bypass token in prod).
 */
const ADMIN_GOOGLE_CLIENT_ID = process.env.ADMIN_GOOGLE_CLIENT_ID || '';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

/**
 * Read the dev bypass token from the URL (one-shot).
 * @returns {string|null} the token or null
 */
const getDevLoginToken = () => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('devlogin');
};

/**
 * Load the GIS script and render the Google Sign-In button.
 * @param {HTMLElement} buttonContainer - where to render the button
 * @param {function(string): void} onCredential - receives the Google id_token string
 * @returns {Promise<void>} resolves once the button is rendered
 */
const initGoogleSignIn = (buttonContainer, onCredential) =>
    new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = GSI_SRC;
        script.async = true;
        script.onload = () => {
            const google = window.google;
            if (!google || !google.accounts || !ADMIN_GOOGLE_CLIENT_ID) {
                reject(new Error('Google Sign-In is not available'));
                return;
            }
            google.accounts.id.initialize({
                client_id: ADMIN_GOOGLE_CLIENT_ID,
                callback: response => onCredential(response.credential)
            });
            google.accounts.id.renderButton(buttonContainer, {theme: 'outline', size: 'large'});
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
        document.head.appendChild(script);
    });

export {ADMIN_GOOGLE_CLIENT_ID, getDevLoginToken, initGoogleSignIn};
