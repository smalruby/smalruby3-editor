// This file is Smalruby-specific (Koshien "Test AI" iframe URL building).

/**
 * Base URL of the Koshien WEB game viewer used by the "Test AI" modal.
 * @type {string}
 */
export const KOSHIEN_TEST_BASE_URL = 'https://smalruby-koshien-web.netlab.jp/';

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
