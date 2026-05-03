// === Smalruby: This file is Smalruby-specific (fullwidth-to-halfwidth auto-correct for Ruby tab) ===

/**
 * Default auto-correct settings — all conversions enabled.
 */
const defaultSettings = {
    fullwidthNumbers: true,
    fullwidthAlpha: true,
    fullwidthSymbols: true,
    fullwidthSpace: true,
    replaceInStrings: true,
};

// Fullwidth ASCII symbols mapped to halfwidth equivalents.
// Range U+FF01..U+FF5E corresponds to '!'(0x21)..'~'(0x7E).
// Numbers (FF10-FF19) and letters (FF21-FF3A, FF41-FF5A) are handled separately.
const FULLWIDTH_SYMBOL_MAP = {};
for (let i = 0xff01; i <= 0xff5e; i++) {
    const half = String.fromCharCode(i - 0xff01 + 0x21);
    const full = String.fromCharCode(i);
    // Skip digits 0-9
    if (half >= '0' && half <= '9') continue;
    // Skip uppercase A-Z
    if (half >= 'A' && half <= 'Z') continue;
    // Skip lowercase a-z
    if (half >= 'a' && half <= 'z') continue;
    FULLWIDTH_SYMBOL_MAP[full] = half;
}

// Extra symbols commonly produced by Japanese IME that fall outside FF01-FF5E.
const EXTRA_SYMBOL_MAP = {
    '\u201C': '"', // " left double quotation mark
    '\u201D': '"', // " right double quotation mark
    '\u2018': "'", // ' left single quotation mark
    '\u2019': "'", // ' right single quotation mark
    '\u2212': '-', // − minus sign
};

/**
 * Build a regex that matches fullwidth characters according to the given settings.
 * @param {object} settings - The auto-correct settings.
 * @returns {RegExp|null} A regex, or null if nothing to match.
 */
const buildPattern = (settings) => {
    const parts = [];
    if (settings.fullwidthNumbers) {
        parts.push('\uFF10-\uFF19'); // ０-９
    }
    if (settings.fullwidthAlpha) {
        parts.push('\uFF21-\uFF3A'); // Ａ-Ｚ
        parts.push('\uFF41-\uFF5A'); // ａ-ｚ
    }
    if (settings.fullwidthSymbols) {
        // All fullwidth symbols (excluding digits and letters handled above)
        parts.push('\uFF01-\uFF0F'); // ！ to ／
        parts.push('\uFF1A-\uFF20'); // ： to ＠
        parts.push('\uFF3B-\uFF40'); // ［ to ｀
        parts.push('\uFF5B-\uFF5E'); // ｛ to ～
        // Extra symbols from Japanese IME
        parts.push('\u201C\u201D'); // "" smart double quotes
        parts.push('\u2018\u2019'); // '' smart single quotes
        parts.push('\u2212'); // − minus sign
    }
    if (settings.fullwidthSpace) {
        parts.push('\u3000'); // ideographic space
    }
    if (parts.length === 0) return null;
    return new RegExp(`[${parts.join('')}]`, 'g');
};

/**
 * Replace a single fullwidth character with its halfwidth equivalent.
 * @param {string} ch - A single fullwidth character.
 * @param {object} settings - The auto-correct settings.
 * @returns {string} The halfwidth equivalent, or the original character.
 */
const replaceChar = (ch, settings) => {
    const code = ch.charCodeAt(0);

    // Fullwidth digits ０(FF10) - ９(FF19)
    if (code >= 0xff10 && code <= 0xff19) {
        if (!settings.fullwidthNumbers) return ch;
        return String.fromCharCode(code - 0xff10 + 0x30);
    }

    // Fullwidth uppercase Ａ(FF21) - Ｚ(FF3A)
    if (code >= 0xff21 && code <= 0xff3a) {
        if (!settings.fullwidthAlpha) return ch;
        return String.fromCharCode(code - 0xff21 + 0x41);
    }

    // Fullwidth lowercase ａ(FF41) - ｚ(FF5A)
    if (code >= 0xff41 && code <= 0xff5a) {
        if (!settings.fullwidthAlpha) return ch;
        return String.fromCharCode(code - 0xff41 + 0x61);
    }

    // Ideographic space
    if (code === 0x3000) {
        if (!settings.fullwidthSpace) return ch;
        return ' ';
    }

    // Fullwidth symbols (FF01-FF5E range)
    if (settings.fullwidthSymbols && FULLWIDTH_SYMBOL_MAP[ch]) {
        return FULLWIDTH_SYMBOL_MAP[ch];
    }

    // Extra symbols (smart quotes, minus sign, etc.)
    if (settings.fullwidthSymbols && EXTRA_SYMBOL_MAP[ch]) {
        return EXTRA_SYMBOL_MAP[ch];
    }

    return ch;
};

/**
 * Find string literal regions in Ruby source code using a simple state machine.
 * Returns an array of [start, end] pairs (inclusive of quote delimiters).
 * Handles double-quoted and single-quoted strings with escape sequences.
 * @param {string} code - Ruby source code.
 * @returns {Array<[number, number]>} Array of [start, end] index pairs.
 */
const findStringRegions = (code) => {
    const regions = [];
    let i = 0;
    while (i < code.length) {
        const ch = code[i];
        if (ch === '"' || ch === "'" || ch === '\u201C' || ch === '\u2018') {
            // Map opening smart quotes to their closing counterpart
            const closeQuote = ch === '\u201C' ? '\u201D' : ch === '\u2018' ? '\u2019' : ch;
            const start = i;
            i++; // skip opening quote
            while (i < code.length) {
                if (code[i] === '\\') {
                    i += 2; // skip escaped character
                    continue;
                }
                if (code[i] === closeQuote) {
                    break;
                }
                i++;
            }
            // i is now at closing quote or end of string
            regions.push([start, i]);
            i++; // skip closing quote (or move past end)
        } else if (ch === '#') {
            // Skip comment to end of line
            while (i < code.length && code[i] !== '\n') {
                i++;
            }
        } else {
            i++;
        }
    }
    return regions;
};

/**
 * Check if a given index falls inside any string region.
 * @param {number} index - Character index in the source.
 * @param {Array<[number, number]>} regions - String regions.
 * @returns {boolean} True if inside a string literal.
 */
const isInString = (index, regions) => {
    for (const [start, end] of regions) {
        // Exclude both quote delimiters so they remain eligible for conversion
        if (index > start && index < end) {
            return true;
        }
    }
    return false;
};

/**
 * Check if a character at the given index is escaped (preceded by an odd number of backslashes).
 * @param {string} code - The source code.
 * @param {number} index - The character index.
 * @returns {boolean} True if the character is escaped.
 */
const isEscaped = (code, index) => {
    let backslashes = 0;
    let j = index - 1;
    while (j >= 0 && code[j] === '\\') {
        backslashes++;
        j--;
    }
    return backslashes % 2 === 1;
};

/**
 * Apply fullwidth-to-halfwidth auto-correction to Ruby source code.
 * @param {string} code - The Ruby source code.
 * @param {object} settings - The auto-correct settings.
 * @returns {string} The corrected source code.
 */
const autoCorrect = (code, settings) => {
    if (!code) return code;

    const pattern = buildPattern(settings);
    if (!pattern) return code;

    // Pre-compute string regions if we need to skip strings
    const stringRegions = settings.replaceInStrings ? null : findStringRegions(code);

    const result = code.replace(pattern, (match, offset) => {
        // If replaceInStrings is off, skip characters inside string literals
        if (stringRegions && isInString(offset, stringRegions)) {
            return match;
        }

        // If replaceInStrings is on but char is escaped inside a string, keep it
        if (settings.replaceInStrings && isEscaped(code, offset)) {
            return match;
        }

        return replaceChar(match, settings);
    });

    return result;
};

export { autoCorrect, defaultSettings };
