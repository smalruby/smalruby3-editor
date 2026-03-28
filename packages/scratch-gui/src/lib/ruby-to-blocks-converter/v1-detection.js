// === Smalruby: This file is Smalruby-specific (v1 book code detection) ===

/**
 * Regular expression to detect v1-specific Ruby code patterns from published books.
 * These patterns are valid in v2 mode but produce different code after round-trip.
 */
 
const V1_CODE_PATTERN = /self\.when\(\s*:|(?<!\.)(?:play_drum|rest)\(|self\.instrument\b|(?<!\.)pen_(?:down|clear)\b|self\.color\s*[+-]?=/;

/**
 * Detect whether Ruby code contains v1-specific patterns from published books.
 * @param {string} code - Ruby source code to check.
 * @returns {boolean} True if v1 patterns are found.
 */
const containsV1Code = code => {
    if (!code || typeof code !== 'string') return false;
    return V1_CODE_PATTERN.test(code);
};

export {containsV1Code, V1_CODE_PATTERN};
