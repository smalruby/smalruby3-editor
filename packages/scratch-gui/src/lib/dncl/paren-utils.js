// === Smalruby: This file is Smalruby-specific (DNCL paren utilities) ===

/**
 * Find the end of a string literal starting at position `start`.
 * Handles escape sequences (`\\X`) by skipping the escaped character.
 * Returns the position immediately after the closing quote, or the end of
 * the line if the string is unterminated.
 * @param {string} line - The source line.
 * @param {number} start - Starting position (at the opening quote).
 * @param {string} quote - The quote character (`"` or `'`).
 * @returns {number} The position after the closing quote.
 */
const skipString = (line, start, quote) => {
    let i = start + 1;
    while (i < line.length) {
        if (line[i] === '\\') {
            i += 2;
            continue;
        }
        if (line[i] === quote) {
            return i + 1;
        }
        i++;
    }
    return i;
};

/**
 * Find the matching close paren for an open paren at `openParenPos`.
 * Skips parens inside string literals (single or double quoted).
 * @param {string} text - The text to scan.
 * @param {number} openParenPos - Position of the open paren `(`.
 * @returns {number} Position of the matching close paren, or -1 if unmatched.
 */
const findMatchingClose = (text, openParenPos) => {
    let depth = 1;
    let i = openParenPos + 1;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            i = skipString(text, i, ch);
            continue;
        }
        if (ch === '(') {
            depth++;
        } else if (ch === ')') {
            depth--;
            if (depth === 0) return i;
        }
        i++;
    }
    return -1;
};

/**
 * Replace `name(...)` calls with the result of `transform(args)`.
 * Uses balanced-paren matching so nested function calls don't confuse the
 * boundary. Skips occurrences inside string literals.
 *
 * Args are processed recursively before being passed to `transform`, so
 * nested same-name calls (e.g. `f(f(x))`) are handled in a single call.
 * @param {string} text - Source text.
 * @param {string} name - Function name to match (e.g. `表示する`).
 * @param {Function} transform - Receives the raw args string (after
 *   recursive processing of any same-name calls inside) and returns the
 *   full replacement text. Its second argument is the text before the
 *   call, as already transformed (to look at a `-` before the call).
 * @returns {string} Text with all occurrences of `name(...)` transformed.
 */
const replaceCall = (text, name, transform) => {
    let result = '';
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            const end = skipString(text, i, ch);
            result += text.substring(i, end);
            i = end;
            continue;
        }
        if (text.startsWith(name, i) && text[i + name.length] === '(') {
            const openPos = i + name.length;
            const closePos = findMatchingClose(text, openPos);
            if (closePos === -1) {
                result += ch;
                i++;
                continue;
            }
            const rawArgs = text.substring(openPos + 1, closePos);
            // Recursively process so nested same-name calls (f(f(x))) work.
            const args = replaceCall(rawArgs, name, transform);
            result += transform(args, result);
            i = closePos + 1;
            continue;
        }
        result += ch;
        i++;
    }
    return result;
};

/**
 * Split function args by top-level commas (depth 0). Skips commas inside
 * nested parens or string literals.
 * @param {string} args - The args string between the outer parens.
 * @returns {Array<string>} Array of trimmed argument strings.
 */
const splitArgsAtTopLevel = (args) => {
    const parts = [];
    let depth = 0;
    let current = '';
    let i = 0;
    while (i < args.length) {
        const ch = args[i];
        if (ch === '"' || ch === "'") {
            const end = skipString(args, i, ch);
            current += args.substring(i, end);
            i = end;
            continue;
        }
        if (ch === '(') {
            depth++;
            current += ch;
            i++;
            continue;
        }
        if (ch === ')') {
            depth--;
            current += ch;
            i++;
            continue;
        }
        if (ch === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
            i++;
            continue;
        }
        current += ch;
        i++;
    }
    if (current.length > 0 || parts.length > 0) {
        parts.push(current.trim());
    }
    return parts;
};

/**
 * Whether `ch` can be part of a DNCL name: a letter of any script (so kanji
 * and kana too), a digit or `_`. (Issue #1711)
 * @param {string} ch - The character.
 * @returns {boolean} True for a name character.
 */
const isNameChar = (ch) => typeof ch === 'string' && /[\p{L}\p{N}_]/u.test(ch);

/**
 * Whether `word` stands on its own at `line[i]`: no name character
 * (`isNameChar`) right before or after it, so it is not part of a name
 * (`bandwidth`, `フラグor`, `かつお`, `たかつき`), so the conversions agree
 * on what a name is (Issue #1697).
 * @param {string} line - The line.
 * @param {number} i - Index to test.
 * @param {string} word - The keyword.
 * @returns {boolean} True when `word` is a whole word at `i`.
 */
const isWholeWordAt = (line, i, word) =>
    line.startsWith(word, i) && !isNameChar(line[i - 1]) && !isNameChar(line[i + word.length]);

/**
 * Find the matching close bracket for the `[` / `{` / `(` at `openPos`.
 * Skips brackets inside string literals.
 * @param {string} text - The text to scan.
 * @param {number} openPos - Position of the open bracket.
 * @returns {number} Position of the matching close bracket, or -1 if unmatched.
 */
const findMatchingBracket = (text, openPos) => {
    const open = text[openPos];
    const close = open === '(' ? ')' : open === '[' ? ']' : '}';
    let depth = 1;
    let i = openPos + 1;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            i = skipString(text, i, ch);
            continue;
        }
        if (ch === open) {
            depth++;
        } else if (ch === close) {
            depth--;
            if (depth === 0) return i;
        }
        i++;
    }
    return -1;
};

/** A character a function / method name can end with, right before its `(`. */
const CALL_NAME_CHAR_RE = /[\w?!\u3040-\u30FF\u4E00-\u9FFF]/;

const TO_I_SUFFIX = '.to_i';

/** Operators with the precedence of `÷` (a `*` / `/` / `%` chain). */
const QUOTIENT_CHAIN_OPS = new Set(['*', '**', '/', '%', '÷']);

/**
 * The operators of `text` outside brackets and strings, in order. `**` is
 * one operator. `!` / `?` count only when they do not end a method name
 * (`a.empty?`).
 * @param {string} text - Ruby-form text.
 * @returns {Array<{op: string, pos: number}>} The operators.
 */
const topLevelOperators = (text) => {
    const ops = [];
    let depth = 0;
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            i = skipString(text, i, ch);
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') {
            depth++;
        } else if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
        } else if (depth === 0) {
            if (ch === '*' && text[i + 1] === '*') {
                ops.push({ op: '**', pos: i });
                i += 2;
                continue;
            }
            const nameEnd = (ch === '!' || ch === '?') && /[\w)\]]/.test(text[i - 1] || '');
            if ('+-*/%<>=!&|^~?:÷'.includes(ch) && !nameEnd) ops.push({ op: ch, pos: i });
        }
        i++;
    }
    return ops;
};

/**
 * Where `inner` (of `(inner).to_i`) is one quotient `X ÷ B` of DNCL: a
 * `*` / `/` / `%` chain whose last operator is `/`, with a single operand
 * after it. `a / 2`, `(a + b) / 2`, `a * 3 / 2` and `a / 2 / 3` are
 * (`a ÷ 2`, `(a + b) ÷ 2`, `a * 3 ÷ 2`, `a / 2 ÷ 3`); `a / 2 * 3`,
 * `a / 2 + 1` and `-a / 2` are not.
 * @param {string} inner - Ruby-form text between the parentheses.
 * @returns {number} Position of that last `/`, or -1 if it is not one.
 */
const quotientSlashPos = (inner) => {
    const ops = topLevelOperators(inner);
    if (ops.length === 0 || !ops.every(({ op }) => QUOTIENT_CHAIN_OPS.has(op))) return -1;
    const last = ops[ops.length - 1];
    if (last.op !== '/' || inner.substring(0, ops[0].pos).trim() === '') return -1;
    return isSingleOperand(inner.substring(last.pos + 1).trim()) ? last.pos : -1;
};

/**
 * Inverse of `wrapIntegerDivisions`: Ruby `(X / B).to_i` becomes DNCL
 * `X ÷ B` when it is one quotient (`quotientSlashPos`). Any other
 * `(式).to_i` is left for the `.to_i → 整数()` rewrite, and a `/` without
 * `.to_i` stays `/` (the ordinary division in both). (Issue #1701)
 *
 * Examples:
 *   `(a / b).to_i`              → `a ÷ b`
 *   `((a + b) / 2).to_i`        → `(a + b) ÷ 2`
 *   `((a / 2).to_i / 3).to_i`   → `a ÷ 2 ÷ 3`
 *   `a * (b / 2).to_i`          → `a * (b ÷ 2)`
 *   `(a / 2).to_i.to_s`         → `(a ÷ 2).to_s`
 *   `(a / 2 * 3).to_i`          → unchanged (becomes `整数(a / 2 * 3)`)
 * @param {string} line - Ruby-form line.
 * @returns {string} Line with the quotients written with `÷`.
 */
const stripIntegerDivisionToI = (line) => {
    let result = '';
    let i = 0;
    while (i < line.length) {
        const ch = line[i];
        if (ch === '"' || ch === "'") {
            const end = skipString(line, i, ch);
            result += line.substring(i, end);
            i = end;
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') {
            const close = findMatchingBracket(line, i);
            if (close === -1) {
                result += ch;
                i++;
                continue;
            }
            const inner = line.substring(i + 1, close);
            const end = close + 1 + TO_I_SUFFIX.length;
            const isGroup = ch === '(' && !(i > 0 && CALL_NAME_CHAR_RE.test(line[i - 1]));
            const toI = isGroup && line.startsWith(TO_I_SUFFIX, close + 1) && !/\w/.test(line[end] || '');
            const slash = toI ? quotientSlashPos(inner) : -1;
            if (slash !== -1) {
                const quotient = stripIntegerDivisionToI(
                    `${inner.substring(0, slash).trimEnd()} ÷ ${inner.substring(slash + 1).trimStart()}`,
                );
                // A method after it (`(a / 2).to_i.to_s`, Issue #1686) applies to
                // the whole quotient, and so does a `*` / `/` / `%` / `÷` before
                // it (`a * (b ÷ 2)`, not `a * b ÷ 2` = `(a * b) ÷ 2`).
                const keepParens = line[end] === '.' || /[*/%÷]$/.test(result.trimEnd());
                result += keepParens ? `(${quotient})` : quotient;
                i = end;
                continue;
            }
            result += ch + stripIntegerDivisionToI(inner) + line[close];
            i = close + 1;
            continue;
        }
        result += ch;
        i++;
    }
    return result;
};

/**
 * Whether `text` is one pair of parentheses around everything, like
 * `(a > 1 && b)`. `(a) && (b)` is not: its first `(` closes early.
 * @param {string} text - The expression.
 * @returns {boolean} True if the outer parentheses enclose the whole text.
 */
const isWrappedInParens = (text) => text.startsWith('(') && findMatchingClose(text, 0) === text.length - 1;

/** Characters that may appear outside brackets in a single operand (identifier, `@var`, `obj.method?`, `!x`). */
const OPERAND_CHAR_RE = /[\w@.?!\u3040-\u30FF\u4E00-\u9FFF]/;

/**
 * Whether `text` is a single operand that needs no parentheses when it is
 * negated: a variable, a literal, a call like `f(a, b)` or `A[i]`, or a
 * whole `( ... )` group. `a > 1` or `a + b` are not (they have an operator
 * outside brackets), so `!` in front of them would bind to `a` only.
 * @param {string} text - The expression (trimmed).
 * @returns {boolean} True if `!text` negates the whole expression.
 */
const isSingleOperand = (text) => {
    if (text === '') return false;
    let depth = 0;
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            i = skipString(text, i, ch);
            continue;
        }
        if (ch === '(' || ch === '[') {
            depth++;
        } else if (ch === ')' || ch === ']') {
            depth--;
        } else if (depth === 0 && !OPERAND_CHAR_RE.test(ch)) {
            return false;
        }
        i++;
    }
    return depth === 0;
};

export {
    isNameChar,
    isWholeWordAt,
    isSingleOperand,
    isWrappedInParens,
    skipString,
    findMatchingClose,
    replaceCall,
    splitArgsAtTopLevel,
    stripIntegerDivisionToI,
};
