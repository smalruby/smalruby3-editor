/**
 * @file
 * Utility functions related to localization specific to the GUI
 */

const wideLocales = [
    'ab',
    'ca',
    'de',
    'el',
    'it',
    'ja',
    'ja-Hira',
    'ko',
    'hu',
    'ru',
    'vi'
];

/**
 * Identify the languages where translations are too long to fit in fixed width parts of the gui.
 * @param {string} locale The current locale.
 * @returns {bool} true if translations in this language are too long
 */

const isWideLocale = locale => (
    wideLocales.indexOf(locale) !== -1
);

// === Smalruby: Start of Japanese locale check ===
/**
 * Check whether the given locale is a Japanese locale.
 * Furigana and DNCL modes are only available in Japanese locales.
 * @param {string} locale - The locale string (e.g. 'ja', 'ja-Hira', 'en').
 * @returns {boolean} True if the locale is Japanese.
 */
const isJapaneseLocale = locale =>
    locale === 'ja' || locale === 'ja-Hira';
// === Smalruby: End of Japanese locale check ===

export {
    wideLocales,
    isWideLocale,
    isJapaneseLocale
};
