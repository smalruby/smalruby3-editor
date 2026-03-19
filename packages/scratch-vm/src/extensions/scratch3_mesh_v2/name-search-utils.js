/**
 * Mesh V2 Name Search Utilities
 *
 * Provides hiragana-to-hex conversion for cross-domain group search.
 * The mapping is the same as MESH_ID_LABEL_CHARACTERS in index.js.
 */

const MESH_ID_LABEL_CHARACTERS = {
    0: 'い',
    1: 'し',
    2: 'か',
    3: 'た',
    4: 'う',
    5: 'ん',
    6: 'て',
    7: 'と',
    8: 'の',
    9: 'つ',
    a: 'は',
    b: 'こ',
    c: 'に',
    d: 'な',
    e: 'く',
    f: 'き'
};

// Build reverse mapping: hiragana → hex
const MESH_ID_LABEL_REVERSE = {};
Object.entries(MESH_ID_LABEL_CHARACTERS).forEach(([hex, hiragana]) => {
    MESH_ID_LABEL_REVERSE[hiragana] = hex;
});

/**
 * Convert a hiragana string to hex prefix.
 * @param {string} hiraganaStr - Hiragana string (e.g., 'しかたうんて').
 * @returns {string|null} Hex prefix (e.g., '123456'), or null if invalid.
 */
const hiraganaToHex = hiraganaStr => {
    if (!hiraganaStr || typeof hiraganaStr !== 'string' || hiraganaStr.length === 0) {
        return null;
    }
    const hexChars = [];
    for (const char of hiraganaStr) {
        const hex = MESH_ID_LABEL_REVERSE[char];
        if (hex === undefined) return null;
        hexChars.push(hex);
    }
    return hexChars.join('');
};

module.exports = {
    MESH_ID_LABEL_CHARACTERS,
    MESH_ID_LABEL_REVERSE,
    hiraganaToHex
};
