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
 *   full replacement text.
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
            result += transform(args);
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
 * Wrap every top-level `/` in `line` with `.to_i` so that DNCL division
 * truncates like Ruby integer-division. Skips occurrences inside string
 * literals and inside the `//` integer-divide alias (which is handled
 * elsewhere). Operands are determined by walking outward across balanced
 * parens / brackets and stopping at lower-precedence boundaries (operators,
 * commas, assignment, statement edges).
 *
 * Examples:
 *   `a / b`             → `(a / b).to_i`
 *   `(a + b) / c`       → `((a + b) / c).to_i`
 *   `a + b / c`         → `a + (b / c).to_i`
 *   `Data[i + 1] / 2`   → `(Data[i + 1] / 2).to_i`
 *   `a / b * c`         → `(a / b).to_i * c`
 * @param {string} line - A Ruby-form line (post DNCL transforms).
 * @returns {string} The line with every `/` wrapped in `.to_i`.
 */
const wrapIntegerDivisions = (line) => {
    // Operator characters that, if they appear as the FIRST char of the
    // captured left operand, indicate we walked into a no-op sequence —
    // skip wrapping in that case. `(` / `[` / `{` are NOT boundaries because
    // a parenthesized / indexed expression is a valid left operand.
    const INVALID_LEFT_FIRST = new Set([
        '+',
        '-',
        '*',
        '/',
        '%',
        '<',
        '>',
        '=',
        '!',
        '&',
        '|',
        '?',
        ':',
        ',',
        ';',
        '\n',
    ]);

    // Walk LEFT from `endExclusive - 1` in `s` to find the start of the
    // operand. Skips balanced (), [], {} and string literals.
    const findLeftOperandStart = (s, endExclusive) => {
        let i = endExclusive - 1;
        while (i >= 0 && /\s/.test(s[i])) i--;
        if (i < 0) return null;
        while (i >= 0) {
            const ch = s[i];
            if (ch === ')' || ch === ']' || ch === '}') {
                const close = ch;
                const open = close === ')' ? '(' : close === ']' ? '[' : '{';
                let depth = 1;
                i--;
                while (i >= 0 && depth > 0) {
                    const c = s[i];
                    if (c === '"' || c === "'") {
                        // Skip string backwards.
                        i--;
                        while (i >= 0 && s[i] !== c) {
                            if (i > 0 && s[i - 1] === '\\') i--;
                            i--;
                        }
                        i--;
                        continue;
                    }
                    if (c === close) depth++;
                    else if (c === open) depth--;
                    i--;
                }
                // i is one before the matching open; continue back to absorb
                // any preceding identifier (function/array name) or chained dot.
                continue;
            }
            if (/[\w@$.]/.test(ch)) {
                i--;
                continue;
            }
            // Stop at boundary or whitespace before boundary.
            break;
        }
        // i is one before the operand's first char.
        let start = i + 1;
        // Trim leading whitespace.
        while (start < endExclusive && /\s/.test(s[start])) start++;
        return start;
    };

    // Walk RIGHT from `startInclusive` in `s` to find the index just past
    // the end of the operand. Skips balanced parens / strings.
    const findRightOperandEnd = (s, startInclusive) => {
        let i = startInclusive;
        while (i < s.length && /\s/.test(s[i])) i++;
        if (i >= s.length) return null;
        // Optional unary +/- sign.
        if (s[i] === '+' || s[i] === '-') i++;
        while (i < s.length) {
            const ch = s[i];
            if (ch === '(' || ch === '[' || ch === '{') {
                const open = ch;
                const close = open === '(' ? ')' : open === '[' ? ']' : '}';
                let depth = 1;
                i++;
                while (i < s.length && depth > 0) {
                    const c = s[i];
                    if (c === '"' || c === "'") {
                        i = skipString(s, i, c);
                        continue;
                    }
                    if (c === open) depth++;
                    else if (c === close) depth--;
                    i++;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                i = skipString(s, i, ch);
                continue;
            }
            if (/[\w@$.]/.test(ch)) {
                i++;
                continue;
            }
            break;
        }
        return i;
    };

    // Iteratively wrap each `/` (left-to-right). After each wrap, the
    // result string changes length so we re-scan from the start.
    let s = line;
    let i = 0;
    while (i < s.length) {
        const ch = s[i];
        if (ch === '"' || ch === "'") {
            i = skipString(s, i, ch);
            continue;
        }
        if (ch === '#') {
            // Rest of line is a comment.
            break;
        }
        if (ch === '/' && s[i - 1] !== '/' && s[i + 1] !== '/') {
            // Skip if this `/` is already inside a `(... / ...).to_i` we
            // produced earlier — detect by checking the trailing `.to_i`.
            // We only care that the left/right operand isn't itself a
            // freshly-generated wrapper.
            const leftStart = findLeftOperandStart(s, i);
            const rightEnd = findRightOperandEnd(s, i + 1);
            if (leftStart === null || rightEnd === null || leftStart >= i) {
                i++;
                continue;
            }
            const leftOperand = s.substring(leftStart, i).trimEnd();
            const rightOperand = s.substring(i + 1, rightEnd).trimStart();
            // Skip if leftOperand is empty or starts with a non-operand char.
            if (!leftOperand || INVALID_LEFT_FIRST.has(leftOperand[0])) {
                i++;
                continue;
            }
            // Already wrapped? Detect the surrounding `(... / ...).to_i` shape
            // produced by an earlier pass (or by the `//` rewrite upstream) so we
            // don't emit `((... / ...).to_i).to_i`.
            const CLOSE_PAREN_TO_I = ').to_i';
            if (
                leftStart > 0 &&
                s[leftStart - 1] === '(' &&
                s.substring(rightEnd, rightEnd + CLOSE_PAREN_TO_I.length) === CLOSE_PAREN_TO_I
            ) {
                i = rightEnd + CLOSE_PAREN_TO_I.length;
                continue;
            }
            // The right operand may have divisions of its own (`a / (b / 2)`);
            // scanning resumes after the replacement, so wrap them here.
            const replacement = `(${leftOperand} / ${wrapIntegerDivisions(rightOperand)}).to_i`;
            s = s.substring(0, leftStart) + replacement + s.substring(rightEnd);
            // Resume scanning AFTER the inserted `.to_i` so we don't re-process
            // the same `/`.
            i = leftStart + replacement.length;
            continue;
        }
        i++;
    }
    return s;
};

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

/**
 * Whether the `(` at `pos` opens the arguments of a call (`f(`, `rand(`,
 * `表示する(`), not a group.
 * @param {string} text - The text.
 * @param {number} pos - Position of the `(`.
 * @returns {boolean} True if it is a call's parenthesis.
 */
const isCallParen = (text, pos) => pos > 0 && CALL_NAME_CHAR_RE.test(text[pos - 1]);

const TO_I_SUFFIX = '.to_i';

/**
 * Whether the group closed at `close` is followed by `.to_i` (and not by a
 * longer name such as `.to_int`).
 * @param {string} text - The text.
 * @param {number} close - Position of the `)`.
 * @returns {boolean} True if `.to_i` follows.
 */
const isFollowedByToI = (text, close) =>
    text.startsWith(TO_I_SUFFIX, close + 1) && !/\w/.test(text[close + 1 + TO_I_SUFFIX.length] || '');

/**
 * Whether `s[i]` is a single `/` (not part of `//`).
 * @param {string} s - The text.
 * @param {number} i - The position.
 * @returns {boolean} True if it is a single `/`.
 */
const isSingleSlash = (s, i) => s[i] === '/' && s[i - 1] !== '/' && s[i + 1] !== '/';

/**
 * Stand-in for a `/` that is the ordinary division (see `markRealDivisions`),
 * so `wrapIntegerDivisions` leaves it alone. A private-use character, which
 * no source contains.
 */
const REAL_DIVISION_MARK = '\uE000';

/**
 * Mark the `/` that are the ordinary division in DNCL → Ruby: those inside
 * `整数(...)`, which has become `( ... ).to_i` by now. `整数(a / 2 * 3)`
 * truncates `a / 2 * 3` once at the end, as Ruby `(@a / 2 * 3).to_i` does,
 * so that `(式).to_i` written in Ruby comes back with the same value.
 * Elsewhere `/` stays the integer division of DNCL (`a / 2` → `(a / 2).to_i`).
 * Plain groups inside are part of the same expression (`整数((a / 2) * 3)`),
 * but the arguments of a call and an index are not (`整数(Data[i / 2])` keeps
 * the index an integer). `÷` is the explicit integer quotient, so it is not
 * marked. (Issue #1701)
 * @param {string} line - A Ruby-form line before `wrapIntegerDivisions`.
 * @returns {string} The line with those `/` replaced by `REAL_DIVISION_MARK`.
 */
const markRealDivisions = (line) => {
    // Each open bracket: 'real' (a group followed by `.to_i`), 'pass' (a
    // plain group) or 'stop' (call arguments, an index, a hash).
    const stack = [];
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
        if (ch === '(') {
            const close = findMatchingClose(line, i);
            if (close === -1 || isCallParen(line, i)) stack.push('stop');
            else stack.push(isFollowedByToI(line, close) ? 'real' : 'pass');
        } else if (ch === '[' || ch === '{') {
            stack.push('stop');
        } else if (ch === ')' || ch === ']' || ch === '}') {
            stack.pop();
        } else if (isSingleSlash(line, i)) {
            let real = false;
            for (let k = stack.length - 1; k >= 0 && stack[k] !== 'stop'; k--) {
                if (stack[k] === 'real') {
                    real = true;
                    break;
                }
            }
            result += real ? REAL_DIVISION_MARK : ch;
            i++;
            continue;
        }
        result += ch;
        i++;
    }
    return result;
};

/**
 * Put back the `/` marked by `markRealDivisions`.
 * @param {string} line - The line with marks.
 * @returns {string} The line with `/` again.
 */
const unmarkRealDivisions = (line) => line.split(REAL_DIVISION_MARK).join('/');

/**
 * Whether `s` has a `/` that is the ordinary division in Ruby: one that is not
 * inside a `( ... ).to_i` group, the arguments of a call or an index.
 * @param {string} s - Ruby-form text.
 * @returns {boolean} True if such a `/` is there.
 */
const hasRealDivision = (s) => {
    let i = 0;
    while (i < s.length) {
        const ch = s[i];
        if (ch === '"' || ch === "'") {
            i = skipString(s, i, ch);
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') {
            const close = findMatchingBracket(s, i);
            if (close === -1) return false;
            const opaque = ch !== '(' || isCallParen(s, i) || isFollowedByToI(s, close);
            if (!opaque && hasRealDivision(s.substring(i + 1, close))) return true;
            i = close + 1;
            continue;
        }
        if (isSingleSlash(s, i)) return true;
        i++;
    }
    return false;
};

/**
 * Whether `inner` (of `(inner).to_i`) is exactly one division `A / B` that
 * DNCL `A / B` means: `A` and `B` are single operands with no ordinary
 * division of their own. `a / 2 * 3`, `a * 3 / 2` and `(a / 2) / 3` are not.
 * @param {string} inner - Ruby-form text between the parentheses.
 * @returns {boolean} True if `.to_i` can be dropped.
 */
const isSingleIntegerDivision = (inner) => {
    const slashes = [];
    let depth = 0;
    let i = 0;
    while (i < inner.length) {
        const ch = inner[i];
        if (ch === '"' || ch === "'") {
            i = skipString(inner, i, ch);
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;
        else if (depth === 0 && isSingleSlash(inner, i)) slashes.push(i);
        i++;
    }
    if (slashes.length !== 1) return false;
    const left = inner.substring(0, slashes[0]).trim();
    const right = inner.substring(slashes[0] + 1).trim();
    const isOperand = (operand) => isSingleOperand(operand) && !hasRealDivision(operand);
    return isOperand(left) && isOperand(right);
};

/**
 * Inverse of `wrapIntegerDivisions`: drop `.to_i` from `(A / B).to_i`, as
 * DNCL `/` is already the integer division. Only a group that is exactly one
 * division is dropped (`isSingleIntegerDivision`); any other `(式).to_i` is
 * left for the `.to_i → 整数()` rewrite, and the `/` in it is the ordinary
 * division there (`markRealDivisions`), so the value stays the same
 * (`(a / 2 * 3).to_i` → `整数(a / 2 * 3)`, not `a / 2 * 3` = `(a / 2).to_i * 3`).
 * Inside such a group, an inner `(A / B).to_i` is kept as well, as `A / B`
 * there would be the ordinary division. (Issue #1701)
 *
 * Examples:
 *   `(a / b).to_i`              → `a / b`
 *   `((a + b) / 2).to_i`        → `(a + b) / 2`
 *   `((a / 2).to_i / 3).to_i`   → `a / 2 / 3`
 *   `(a / (b / 2).to_i).to_i`   → `a / (b / 2)`
 *   `(a / 2).to_i.to_s`         → `(a / 2).to_s`
 *   `(a / 2 * 3).to_i`          → `(a / 2 * 3).to_i` (becomes `整数(a / 2 * 3)`)
 *   `((a / 2).to_i * 3).to_i`   → unchanged (becomes `整数(整数(a / 2) * 3)`)
 * @param {string} line - Ruby-form line.
 * @param {boolean} [inToI] - Whether `line` is inside a kept `( ... ).to_i`.
 * @returns {string} Line with redundant int-division `.to_i` wrappers stripped.
 */
const stripIntegerDivisionToI = (line, inToI = false) => {
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
            if (ch !== '(' || isCallParen(line, i)) {
                // Arguments and indexes are expressions of their own.
                result += ch + stripIntegerDivisionToI(inner, false) + line[close];
                i = close + 1;
                continue;
            }
            if (isFollowedByToI(line, close)) {
                const end = close + 1 + TO_I_SUFFIX.length;
                if (!inToI && isSingleIntegerDivision(inner)) {
                    const stripped = stripIntegerDivisionToI(inner, false);
                    // A method after it (`(a / 2).to_i.to_s`) applies to the
                    // whole division (Issue #1686), and so does a `/` before
                    // it (`a / (b / 2)`, not `a / b / 2`).
                    const before = result.trimEnd();
                    const keepParens = line[end] === '.' || before.endsWith('/');
                    result += keepParens ? `(${stripped})` : stripped;
                } else {
                    result += `(${stripIntegerDivisionToI(inner, true)}).to_i`;
                }
                i = end;
                continue;
            }
            result += `(${stripIntegerDivisionToI(inner, inToI)})`;
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
    isSingleOperand,
    isWrappedInParens,
    skipString,
    findMatchingClose,
    replaceCall,
    splitArgsAtTopLevel,
    wrapIntegerDivisions,
    markRealDivisions,
    unmarkRealDivisions,
    stripIntegerDivisionToI,
};
