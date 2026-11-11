/**
 * @file
 * Utility function to detect locale from the browser setting or paramenter on the URL.
 */

import queryString from 'query-string';

/**
 * look for language setting in the browser. Check against supported locales.
 * If there's a parameter in the URL, override the browser setting
 * @param {Array.string} supportedLocales An array of supported locale codes.
 * @returns {string} the preferred locale
 */
// === Smalruby: Start of case-insensitive locale matching ===
/**
 * Find a supported locale without regard to case and return its canonical spelling
 * (e.g. 'ja-hira' -> 'ja-Hira'). Lowercasing alone never matches mixed-case codes.
 * @param {Array.<string>} supportedLocales An array of supported locale codes.
 * @param {string} candidate The locale code to look up.
 * @returns {string|undefined} the supported locale code, or undefined if unsupported
 */
const findSupportedLocale = (supportedLocales, candidate) => {
    const lower = candidate.toLowerCase();
    return supportedLocales.find(l => l.toLowerCase() === lower);
};
// === Smalruby: End of case-insensitive locale matching ===

const detectLocale = supportedLocales => {
    let locale = 'en'; // default
    // === Smalruby: Start of case-insensitive locale matching ===
    const browserLocale = window.navigator.userLanguage || window.navigator.language;
    // try to set locale from browserLocale
    const browserMatch = findSupportedLocale(supportedLocales, browserLocale) ||
        findSupportedLocale(supportedLocales, browserLocale.split('-')[0]);
    if (browserMatch) {
        locale = browserMatch;
    }
    // === Smalruby: End of case-insensitive locale matching ===

    const queryParams = queryString.parse(location.search);
    // Flatten potential arrays and remove falsy values
    const potentialLocales = [].concat(queryParams.locale, queryParams.lang).filter(l => l);
    if (!potentialLocales.length) {
        return locale;
    }

    // === Smalruby: Start of case-insensitive locale matching ===
    const urlLocale = findSupportedLocale(supportedLocales, potentialLocales[0]);
    if (urlLocale) {
        return urlLocale;
    }
    // === Smalruby: End of case-insensitive locale matching ===

    return locale;
};

export {
    detectLocale
};
