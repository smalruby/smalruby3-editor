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

// The remainder operator as the Japanese tab writes it.
const JAPANESE_REMAINDER = '\uFF05';

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
 * Whether `ch` is a `/`, half-width or full-width.
 * @param {string} ch - A character.
 * @returns {boolean} True for `/` and `／`.
 */
const isSlash = (ch) => ch === '/' || ch === '\uFF0F';

/**
 * Find the string literals and the comments of the source with a simple state
 * machine. A string region is `[start, end]` (the indexes of its quotes); a
 * comment region is `[start, end]` from the first character after its mark to
 * the end of its line, so the mark itself can still be made half-width
 * (`＃` → `#`) but what is written after it stays as it is: a comment is
 * a sentence, and its `，` and `（` are meant (Issue #1731, S10).
 *
 * A comment starts with `#` (or `＃`). With `slashComments`, `//` (or `／／`)
 * starts one too (the Japanese tab, when its settings say so). With
 * `japanese`, `「…」` is a string as well and a string ends at the end of its
 * line, as the Japanese tab reads it.
 * @param {string} code - The source code.
 * @param {object} [options] - How the source is read.
 * @param {boolean} [options.japanese] - Whether it is the Japanese tab's code.
 * @param {boolean} [options.slashComments] - Whether `//` starts a comment.
 * @returns {{strings: Array<[number, number]>, comments: Array<[number, number]>}} The regions.
 */
const findRegions = (code, options = {}) => {
    const strings = [];
    const comments = [];
    const closeOf = (ch) => {
        if (ch === '"' || ch === "'") return ch;
        if (ch === '\u201C') return '\u201D';
        if (ch === '\u2018') return '\u2019';
        if (options.japanese && ch === '\u300C') return '\u300D';
        return null;
    };
    let i = 0;
    while (i < code.length) {
        const ch = code[i];
        const closeQuote = closeOf(ch);
        if (closeQuote) {
            const start = i;
            i++; // skip opening quote
            while (i < code.length) {
                // A `\` in a 「…」 is text (the Japanese tab takes it as it is).
                if (code[i] === '\\' && closeQuote !== '\u300D') {
                    i += 2; // skip escaped character
                    continue;
                }
                if (code[i] === closeQuote) {
                    break;
                }
                if (options.japanese && code[i] === '\n') {
                    break;
                }
                i++;
            }
            // i is now at closing quote or end of string
            strings.push([start, i]);
            i++; // skip closing quote (or move past end)
        } else if (ch === '#' || ch === '\uFF03' || (options.slashComments && isSlash(ch) && isSlash(code[i + 1]))) {
            const start = i + (ch === '#' || ch === '\uFF03' ? 1 : 2);
            i = start;
            while (i < code.length && code[i] !== '\n') {
                i++;
            }
            comments.push([start, i]);
        } else {
            i++;
        }
    }
    return { strings, comments };
};

/**
 * Check if a given index falls inside any comment region.
 * @param {number} index - Character index in the source.
 * @param {Array<[number, number]>} regions - Comment regions.
 * @returns {boolean} True if inside a comment.
 */
const isInComment = (index, regions) => regions.some(([start, end]) => index >= start && index < end);

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
 * Apply fullwidth-to-halfwidth auto-correction to Ruby source code (or the
 * Japanese tab's code). What is written in a comment stays as it is, and so
 * does the `％` of the Japanese tab.
 * @param {string} code - The Ruby source code.
 * @param {object} settings - The auto-correct settings.
 * @param {object} [options] - How the source is read (see `findRegions`).
 * @returns {string} The corrected source code.
 */
const autoCorrect = (code, settings, options = {}) => {
    if (!code) return code;

    const pattern = buildPattern(settings);
    if (!pattern) return code;

    const regions = findRegions(code, options);

    const result = code.replace(pattern, (match, offset) => {
        if (isInComment(offset, regions.comments)) {
            return match;
        }

        // The Japanese tab writes the remainder as `％` (docs/smalruby-dncl-spec.ja.md),
        // so it stays as it is, not to go back and forth (Issue #2557, B17-1).
        if (options.japanese && match === JAPANESE_REMAINDER) {
            return match;
        }

        // If replaceInStrings is off, skip characters inside string literals
        if (!settings.replaceInStrings && isInString(offset, regions.strings)) {
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
