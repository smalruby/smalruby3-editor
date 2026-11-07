/**
 * Google Sign-In (GIS) integration for the admin SPA (EPIC #1073, decision
 * B: admin-dedicated OAuth client ID).
 *
 * Dev bypass: `?devlogin=<DEV_BYPASS_TOKEN>` skips GIS entirely (stg only —
 * the API rejects the bypass token in prod). The token is taken out of the
 * address bar right after it is read (#1393), so a reload signs out.
 */
const ADMIN_GOOGLE_CLIENT_ID = process.env.ADMIN_GOOGLE_CLIENT_ID || '';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

// undefined = the URL has not been read yet. Kept in module memory because the
// URL no longer carries the token once it has been read.
let devLoginToken;

/**
 * Take the dev bypass token out of the address bar, so it does not end up in
 * screenshots, browser history or URLs people share (#1393). The other params
 * and the hash stay.
 * @param {URL} url - the current URL, already parsed
 */
const stripDevLoginFromUrl = url => {
    url.searchParams.delete('devlogin');
    try {
        window.history.replaceState(window.history.state, '', url.toString());
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to remove devlogin from the URL:', e);
    }
};

/**
 * Read the dev bypass token from the URL. The first call removes it from the
 * URL; later calls return the same value from memory.
 * @returns {string|null} the token or null
 */
const getDevLoginToken = () => {
    if (typeof window === 'undefined') return null;
    if (typeof devLoginToken === 'undefined') {
        const url = new URL(window.location.href);
        devLoginToken = url.searchParams.get('devlogin') || null;
        if (url.searchParams.has('devlogin')) stripDevLoginFromUrl(url);
    }
    return devLoginToken;
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
