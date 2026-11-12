// === Smalruby: This file is Smalruby-specific (Ruby→DNCL builtin conversion) ===
import {
    findMatchingClose,
    isWrappedInParens,
    replaceCall,
    skipString,
    splitArgsAtTopLevel,
    stripIntegerDivisionToI,
} from './paren-utils';
import { ID } from './ruby-to-dncl-identifier';

/**
 * Strip a single layer of fully-enclosing parens from `expr`. Returns the
 * inner expression if `expr` is exactly `(...)` with the open paren at
 * position 0 matching the close paren at the very end. Otherwise returns
 * `expr` unchanged.
 *
 * Used by `flattenPlusChain` to recurse into parenthesized `+` sub-chains
 * such as `((a + b) + c)` → `[a, b, c]`.
 * @param {string} expr - The expression to unwrap.
 * @returns {string} The expression without its single outer paren pair.
 */
const stripOuterParens = (expr) => {
    const trimmed = expr.trim();
    if (trimmed.length < 2 || trimmed[0] !== '(') return trimmed;
    const close = findMatchingClose(trimmed, 0);
    if (close !== trimmed.length - 1) return trimmed;
    return trimmed.substring(1, close);
};

/**
 * Flatten a left-associative `+` expression into its operand list. Walks
 * top-level `+` operators (respecting parens and string literals) and
 * recurses into parenthesized sub-chains. So:
 *   `"a" + "b" + "c"` → `["a", "b", "c"]`
 *   `((a + b) + c) + d` → `[a, b, c, d]`
 * @param {string} expr - The expression to flatten.
 * @returns {Array<string>} The list of operands (each trimmed).
 */
const flattenPlusChain = (expr) => {
    const operands = [];
    let current = '';
    let depth = 0;
    let i = 0;
    while (i < expr.length) {
        const ch = expr[i];
        if (ch === '"' || ch === "'") {
            const end = skipString(expr, i, ch);
            current += expr.substring(i, end);
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
        if (ch === '+' && depth === 0) {
            operands.push(current.trim());
            current = '';
            i++;
            continue;
        }
        current += ch;
        i++;
    }
    operands.push(current.trim());

    // If we found no top-level `+`, the expression is a single operand.
    // Try recursing into outer parens to catch cases like `((a + b) + c)`.
    if (operands.length === 1) {
        const stripped = stripOuterParens(operands[0]);
        if (stripped !== operands[0]) {
            return flattenPlusChain(stripped);
        }
        return operands;
    }

    // Multi-operand: recurse into each parenthesized operand to fully flatten.
    return operands.flatMap((op) => {
        const stripped = stripOuterParens(op);
        if (stripped === op) return [op];
        const nested = flattenPlusChain(stripped);
        // Only flatten if the stripped form actually had a top-level `+` chain;
        // otherwise (e.g. just parens around a single value), keep the parens.
        return nested.length > 1 ? nested : [op];
    });
};

/**
 * Check whether `op` is a string literal OR ends in `.to_s`. These are
 * the only operand shapes that the DNCL → Ruby conversion of `表示する`
 * with multiple args produces, so finding a `+` chain made entirely of
 * these shapes is strong evidence that the chain was generated from a
 * `表示する(a, b, c)` and should be flattened back to comma-separated args.
 *
 * Operands like `@x + 1` (numeric arithmetic) do NOT match, so we leave
 * `puts(@x + 1)` as `表示する(x + 1)` instead of `表示する(x, 1)`.
 * @param {string} op - A trimmed operand from `flattenPlusChain`.
 * @returns {boolean} True if the operand looks like a display fragment.
 */
const isDisplayFragment = (op) => {
    const trimmed = op.trim();
    if (trimmed.length === 0) return false;
    // String literal: starts with `"` or `'` and the closing quote matches the end.
    if (trimmed[0] === '"' || trimmed[0] === "'") {
        const end = skipString(trimmed, 0, trimmed[0]);
        return end === trimmed.length;
    }
    // Ends with `.to_s` (e.g. `@a.to_s`, `1.to_s`, `(@a + @b).to_s`,
    // `rand(1..10).to_s`).
    return /\.to_s$/.test(trimmed);
};

/**
 * Convert a `puts` / `say` argument list into a DNCL `表示する(...)`
 * argument list. The single message arg is flattened into comma-separated
 * args ONLY if every operand of the top-level `+` chain looks like a
 * display fragment (string literal or `X.to_s`). Otherwise the args are
 * passed through unchanged so e.g. `puts(@x + 1)` becomes
 * `表示する(x + 1)`, not `表示する(x, 1)`.
 * @param {string} args - The args inside `puts(` or `say(` (after `say`'s
 *   trailing-duration argument has already been stripped).
 * @returns {string} The DNCL display args, ready to drop into `表示する(...)`.
 */
const flattenDisplayArgs = (args) => {
    const topLevel = splitArgsAtTopLevel(args);
    if (topLevel.length !== 1) {
        // Multi-arg comma form (e.g. `puts(a, b, c)`) — pass through.
        return args;
    }
    const operands = flattenPlusChain(topLevel[0]);
    if (operands.length <= 1) return args;
    // Only flatten if every operand looks like it was generated from a
    // `表示する(a, b, c)` multi-arg form (string literal or X.to_s).
    if (!operands.every(isDisplayFragment)) return args;
    // Unwrap trailing `.to_s` on each operand so `表示する(a.to_s, b)` becomes
    // `表示する(a, b)`.
    const unwrapped = operands.map((op) => {
        const m = op.match(/^(.+)\.to_s$/);
        if (!m) return op;
        // `(a + 1).to_s` came from `表示する(a + 1, ...)`: the parentheses are
        // only there for `.to_s`, so they are dropped. (Issue #1672)
        return isWrappedInParens(m[1]) ? m[1].slice(1, -1).trim() : m[1];
    });
    return unwrapped.join(', ');
};

/**
 * Replace `p(...)` calls only when `p` is standalone (not part of another
 * identifier like `map`, `top`). Uses balanced-paren matching with
 * recursive args processing for same-name nesting.
 * @param {string} text - Source text.
 * @returns {string} Text with `p(...)` calls converted to `表示する(...)`.
 */
const replaceStandalonePCall = (text) => {
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
        if (ch === 'p' && text[i + 1] === '(') {
            const prevChar = i > 0 ? text[i - 1] : '';
            const isStandalone = !prevChar || !/[a-zA-Z_]/.test(prevChar);
            if (isStandalone) {
                const closePos = findMatchingClose(text, i + 1);
                if (closePos !== -1) {
                    const rawArgs = text.substring(i + 2, closePos);
                    // Recurse so `p(p(x))` fully converts, then flatten any `+` chain.
                    const args = replaceStandalonePCall(rawArgs);
                    result += `表示する(${flattenDisplayArgs(args)})`;
                    i = closePos + 1;
                    continue;
                }
            }
        }
        result += ch;
        i++;
    }
    return result;
};

/** DNCL built-ins written as a method with no arguments in Ruby. */
const POSTFIX_METHODS = {
    to_i: '整数',
    to_s: '文字列',
    round: '四捨五入',
    floor: '切り捨て',
    ceil: '切り上げ',
    abs: '絶対値',
    length: '要素数',
};

const POSTFIX_METHOD_RE = new RegExp(`^\\.(${Object.keys(POSTFIX_METHODS).join('|')})(?![${ID}?!])`);
const ID_CHAR_RE = new RegExp(`[${ID}]`);

/**
 * Map the position of each `)` / `]` in `text` (outside strings) to the
 * position of its opening bracket.
 * @param {string} text - The text to scan.
 * @returns {Map<number, number>} Close position → open position.
 */
const bracketOpenings = (text) => {
    const openings = new Map();
    const stack = [];
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"' || ch === "'") {
            i = skipString(text, i, ch);
            continue;
        }
        if (ch === '(' || ch === '[') stack.push(i);
        else if ((ch === ')' || ch === ']') && stack.length > 0) openings.set(i, stack.pop());
        i++;
    }
    return openings;
};

/**
 * Convert `receiver.to_i` / `.to_s` / `.round` / `.floor` / `.ceil` / `.abs` /
 * `.length` to `整数(receiver)` etc. The receiver is the operand right before
 * the method: a name, a number, a call like `rand(1..10)`, an index like
 * `Data[1]`, or a `( ... )` group, whose parentheses are dropped as they are
 * only there for the method (`(a + 1).to_i` → `整数(a + 1)`). DNCL → Ruby
 * puts them back (`toReceiver` in dncl-builtins.js). A string literal
 * receiver (`"x".to_s`) is left as it is. (Issue #1686)
 * @param {string} text - Ruby-form text (identifiers already converted).
 * @returns {string} Text with the methods converted to DNCL built-ins.
 */
const replacePostfixMethods = (text) => {
    let s = text;
    let i = 0;
    while (i < s.length) {
        const ch = s[i];
        if (ch === '"' || ch === "'") {
            i = skipString(s, i, ch);
            continue;
        }
        const match = ch === '.' ? s.substring(i).match(POSTFIX_METHOD_RE) : null;
        if (!match) {
            i++;
            continue;
        }
        const openings = bracketOpenings(s);
        let j = i - 1;
        while (j >= 0) {
            const c = s[j];
            if ((c === ')' || c === ']') && openings.has(j)) {
                j = openings.get(j) - 1;
            } else if (ID_CHAR_RE.test(c)) {
                j--;
            } else if (c === '.' && /\d/.test(s[j - 1] || '') && /\d/.test(s[j + 1] || '')) {
                j--;
            } else {
                break;
            }
        }
        const start = j + 1;
        const end = i + match[0].length;
        if (start === i) {
            i = end;
            continue;
        }
        const receiver = s.substring(start, i);
        const arg = isWrappedInParens(receiver) ? receiver.slice(1, -1).trim() : receiver;
        const replacement = `${POSTFIX_METHODS[match[1]]}(${arg})`;
        s = s.substring(0, start) + replacement + s.substring(end);
        i = start + replacement.length;
    }
    return s;
};

/**
 * Convert Ruby built-in method calls back to DNCL. Uses balanced-paren
 * matching for prefix-call forms so nested same-name calls work.
 *
 * The postfix-with-args form (`.include?`) still uses a regex; same-name
 * nesting on it is a known limitation. Postfix-no-args forms (`.to_i`,
 * `.length` etc.) go through `replacePostfixMethods`.
 * @param {string} line - A line of code.
 * @returns {string} Line with DNCL functions.
 */
const convertBuiltins = (line) => {
    let result = line;

    // say(args, N) → 表示する(args). Strip the trailing duration argument
    // (any number) but only at the top-level comma to handle nested calls.
    // Single-arg `+` chains are flattened so `say("a"+"b"+"c", 1)` becomes
    // `表示する("a", "b", "c")` — see `flattenDisplayArgs`.
    result = replaceCall(result, 'say', (args) => {
        const parts = splitArgsAtTopLevel(args);
        if (parts.length >= 2) {
            const last = parts[parts.length - 1].trim();
            if (/^\d+(?:\.\d+)?$/.test(last)) {
                const messageArgs = parts.slice(0, -1).join(', ');
                return `表示する(${flattenDisplayArgs(messageArgs)})`;
            }
        }
        return `表示する(${flattenDisplayArgs(args)})`;
    });

    // puts(args) / print(args) → 表示する(args). Single-arg `+` chains are
    // flattened (e.g. `puts(a.to_s + "は" + b.to_s)` → `表示する(a, "は", b)`).
    result = replaceCall(result, 'puts', (args) => `表示する(${flattenDisplayArgs(args)})`);
    result = replaceCall(result, 'print', (args) => `表示する(${flattenDisplayArgs(args)})`);

    // p(args) — only match standalone `p(` to avoid `map(`, etc.
    result = replaceStandalonePCall(result);

    // Math.sqrt(expr) → 平方根(expr)
    result = replaceCall(result, 'Math.sqrt', (expr) => `平方根(${expr})`);

    // expr.include?(sub) → 含む(expr, sub)
    // NOTE: same-name nesting (s.include?(t.include?(x))) is not handled by
    // this regex (postfix-with-args form). This is a known limitation.
    result = result.replace(
        new RegExp(`("[^"]*"|[${ID}]+)\\.include\\?\\(([^)]*)\\)`, 'g'),
        (_, expr, sub) => `含む(${expr}, ${sub})`,
    );

    // `(A / B).to_i` first becomes the DNCL quotient `A ÷ B` — the inverse of
    // the `÷` wrap performed during DNCL → Ruby conversion. Any other
    // `(式).to_i` is left for `整数(式)` below. (Issue #1701)
    result = stripIntegerDivisionToI(result);

    // Postfix-no-args methods (`.to_i`, `.to_s`, `.round`, ...). The
    // receiver may be a call, an index or a `( ... )` group (#1686).
    result = replacePostfixMethods(result);

    // rand(n) → 乱数(n)
    result = replaceCall(result, 'rand', (n) => `乱数(${n})`);

    return result;
};

export { convertBuiltins };
