// This file is Smalruby-specific (Koshien "Test AI" iframe URL building).

/**
 * Base URL of the Koshien WEB game viewer used by the "Test AI" modal.
 * @type {string}
 */
export const KOSHIEN_TEST_BASE_URL = 'https://smalruby-koshien-web.netlab.jp/';

/**
 * Maximum length (in characters) we allow for the Koshien "Test AI" viewer URL.
 * The AI source is base64-encoded and percent-encoded into the `player1` query
 * parameter, so a complex AI (e.g. a 10KB path-finding program) easily produces
 * a URL of tens of KB, which browsers / servers / iframes reject. Above this
 * threshold we stop embedding the AI in the URL and offer a download fallback
 * instead. Kept conservative so simple AIs keep using the URL path unchanged.
 * @type {number}
 */
export const MAX_KOSHIEN_TEST_URL_LENGTH = 8000;

/**
 * UTF-8 safe base64 encode (btoa only handles latin1).
 * @param {string} text - The text to encode.
 * @returns {string} Base64-encoded UTF-8 bytes.
 */
const base64EncodeUtf8 = (text) => {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

/**
 * Encode an AI program (Ruby source) into the value the Koshien game viewer
 * expects for its `player1` / `player2` query parameters: `data:<base64(utf8)>`.
 * The viewer decodes this back to the raw Ruby source.
 * @param {string} code - The Ruby AI program source.
 * @returns {string} The `data:<base64>` parameter value.
 */
export const encodeAiToPlayerParam = (code) => `data:${base64EncodeUtf8(code)}`;

/**
 * Build the Koshien "Test AI" viewer URL, passing the given AI program as
 * `player1` so the user's own AI is played (player2 stays the default AI).
 * When `code` is empty/blank, the base URL is returned unchanged so the viewer
 * falls back to its default AI (the previous behavior).
 * @param {string} code - The Ruby AI program source for player1.
 * @param {string} [baseUrl] - The viewer base URL.
 * @returns {string} The viewer URL with the `player1` query parameter set.
 */
export const buildKoshienTestUrl = (code, baseUrl = KOSHIEN_TEST_BASE_URL) => {
    if (!code || !code.trim()) {
        return baseUrl;
    }
    const url = new URL(baseUrl);
    url.searchParams.set('player1', encodeAiToPlayerParam(code));
    return url.toString();
};

/**
 * Whether the given viewer URL exceeds the practical URL length limit and would
 * therefore fail to load.
 * @param {string} url - The fully built viewer URL.
 * @returns {boolean} True if the URL is too long to load reliably.
 */
export const isKoshienTestUrlTooLong = (url) => url.length > MAX_KOSHIEN_TEST_URL_LENGTH;

/**
 * Decide how to open the Koshien "Test AI" viewer for the given AI program.
 *
 * Short AIs are embedded into the `player1` query parameter as before. When the
 * resulting URL would be too long to load, the AI is dropped from the URL so the
 * viewer still opens (with its default AI) and the caller is told to surface a
 * download fallback (export the AI as a `.rb` file and load it into the viewer
 * manually).
 * @param {string} code - The Ruby AI program source for player1.
 * @param {string} [baseUrl] - The viewer base URL.
 * @returns {{url: string, tooLong: boolean}} The viewer URL to load and whether
 *   the AI was too long to embed (so the download fallback should be shown).
 */
export const buildKoshienTestPlan = (code, baseUrl = KOSHIEN_TEST_BASE_URL) => {
    const fullUrl = buildKoshienTestUrl(code, baseUrl);
    const tooLong = Boolean(code && code.trim()) && isKoshienTestUrlTooLong(fullUrl);
    return {
        url: tooLong ? buildKoshienTestUrl('', baseUrl) : fullUrl,
        tooLong,
    };
};
