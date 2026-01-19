/**
 * Google API Dynamic Script Loader
 *
 * This module provides functions to dynamically load Google API scripts
 * only when needed (on first use of Google Drive functionality).
 * This improves initial page load performance by avoiding unnecessary script loads.
 */

/**
 * Load a script dynamically
 * @param {string} src - The script source URL
 * @param {string} id - Unique identifier for the script tag
 * @returns {Promise<void>} Promise that resolves when script is loaded, rejects on error
 */
const loadScript = (src, id) => new Promise((resolve, reject) => {
    // Check if script is already loaded
    if (document.getElementById(id)) {
        resolve();
        return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;

    script.onload = () => {
        resolve();
    };

    script.onerror = () => {
        reject(new Error(`Failed to load script: ${src}`));
    };

    document.head.appendChild(script);
});

/**
 * Load Google API Client Library (gapi)
 * Required for Google Picker API
 * @returns {Promise<void>} Promise that resolves when API is loaded
 */
export const loadGoogleAPI = () => loadScript(
    'https://apis.google.com/js/api.js',
    'google-api-script'
);

/**
 * Load Google Identity Services (GIS)
 * Required for OAuth 2.0 authentication
 * @returns {Promise<void>} Promise that resolves when GIS is loaded
 */
export const loadGoogleIdentity = () => loadScript(
    'https://accounts.google.com/gsi/client',
    'google-identity-script'
);

/**
 * Load all required Google scripts
 * This is the main entry point for loading Google APIs
 * @returns {Promise<void>} Promise that resolves when all scripts are loaded
 */
export const loadAllGoogleScripts = async () => {
    try {
        // Load both scripts in parallel
        await Promise.all([
            loadGoogleAPI(),
            loadGoogleIdentity()
        ]);
    } catch (error) {
        console.error('Failed to load Google scripts:', error);
        throw error;
    }
};

/**
 * Check if Google API is loaded
 * @returns {boolean} True if Google API is loaded
 */
export const isGoogleAPILoaded = () => typeof window.gapi !== 'undefined';

/**
 * Check if Google Identity Services is loaded
 * @returns {boolean} True if Google Identity Services is loaded
 */
export const isGoogleIdentityLoaded = () => typeof window.google !== 'undefined';

/**
 * Check if all required Google scripts are loaded
 * @returns {boolean} True if all scripts are loaded
 */
export const areAllGoogleScriptsLoaded = () =>
    isGoogleAPILoaded() && isGoogleIdentityLoaded();
