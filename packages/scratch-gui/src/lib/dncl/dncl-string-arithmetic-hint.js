// === Smalruby: This file is Smalruby-specific (warn on arithmetic with strings in the Japanese mode) ===
//
// `+` joins strings and `-` / `*` / `/` are for numbers, and they are worked
// out from the left. So in
//   表示する("残り" + a - 1 + "日")
// the `- 1` is taken from the string `"残り" + a`, and the program shows only
// a number. It is the order the program is written in (Ruby reads it the
// same way), so it is not changed; the editor warns on such lines instead,
// so that the number part is put in parentheses: `"残り" + (a - 1) + "日"`.
//
// See Issue #1465.
import { codeOfLine, stringEndAt } from './dncl-trailing-comment';
import { findMatchingClose, isNameChar, isWholeWordAt } from './paren-utils';

/** Operators that work on numbers only (besides `-`). */
const MULTIPLICATIVE = new Set(['*', '/', '%', '÷', '×']);

/** Minus signs (the hyphen and the ones that come from copied text). */
const MINUS = new Set(['-', '−', '–']);

/**
 * Characters after which a new expression starts, so a `+` chain before them
 * does not reach the operators after them (`a = "x", b - 1`).
 */
const EXPRESSION_BREAK = new Set([',', '=', '<', '>', '!', '≦', '≧', '≠', ':', '：', '←']);

/** Words after which a new expression starts. */
const BREAK_WORDS = ['かつ', 'または', 'でない', 'and', 'or', 'not', 'ならば', 'なら', 'の間'];

/**
 * The word at `code[i]` after which a new expression starts, if any.
 * @param {string} code - The code.
 * @param {number} i - The index.
 * @returns {string|undefined} The word, or undefined.
 */
const breakWordAt = (code, i) => BREAK_WORDS.find((word) => isWholeWordAt(code, i, word));

/** The built-in that makes a string (`文字列(x)` is `x.to_s`). */
const TO_STRING = '文字列';

/**
 * A new state for an expression inside one pair of brackets (or the line).
 * @param {boolean} [call] - The brackets hold the arguments of a call (`f(...)`).
 * @returns {{joinsString: boolean, lastIsString: boolean, pending: boolean, expectOperand: boolean, call: boolean}}
 *   `joinsString`: a string has been joined with `+` in this expression;
 *   `lastIsString`: the last operand is a string; `pending`: a number-only
 *   operator waits for its right operand; `expectOperand`: the next `-` is a sign;
 *   `call`: the brackets are the arguments of a call.
 */
const newFrame = (call = false) => ({
    joinsString: false,
    lastIsString: false,
    pending: false,
    expectOperand: true,
    call,
});

/** A method called on an operand (`.to_s`, `.length`, `.to_i`). */
const METHOD_RE = /^\.([\p{L}_][\p{L}\p{N}_]*[?!]?)/u;

/**
 * Whether the code of a line does arithmetic other than `+` with a string:
 * a `-` after a `+` chain that has a string in it (`"a" + b - 1`), or
 * `-` / `*` / `/` / `%` / `÷` right next to a string (`"a" * 2`, `x - 文字列(1)`).
 * A string is a literal (`"..."`, `'...'`, `「...」`), `文字列(...)` or
 * `... .to_s`. Parentheses start a new expression, so `"a" + (b - 1)` is fine.
 * @param {string} code - The code of a DNCL line (without its comment).
 * @returns {boolean} True when the line should be warned.
 */
const hasStringArithmetic = (code) => {
    const stack = [newFrame()];
    const top = () => stack[stack.length - 1];
    // An operand ends at `end`; `isString` tells whether it is a string.
    // The last method called on it decides instead: `.to_s` makes it a string
    // (`(a).to_s`), any other is not known to return one (`"12".to_i`).
    const operand = (isString, end) => {
        const frame = top();
        let string = isString;
        let next = end;
        for (let method = METHOD_RE.exec(code.slice(next)); method; method = METHOD_RE.exec(code.slice(next))) {
            string = method[1] === 'to_s';
            next += method[0].length;
        }
        if (string && frame.pending) return { warn: true };
        frame.pending = false;
        frame.lastIsString = string;
        if (string) frame.joinsString = true;
        frame.expectOperand = false;
        return { warn: false, next };
    };
    let i = 0;
    while (i < code.length) {
        const ch = code[i];
        const stringEnd = stringEndAt(code, i);
        if (stringEnd !== -1) {
            const result = operand(true, stringEnd);
            if (result.warn) return true;
            i = result.next;
            continue;
        }
        if (isWholeWordAt(code, i, TO_STRING) && code[i + TO_STRING.length] === '(') {
            const close = findMatchingClose(code, i + TO_STRING.length);
            if (close !== -1) {
                const result = operand(true, close + 1);
                if (result.warn) return true;
                i = result.next;
                continue;
            }
        }
        const breakWord = breakWordAt(code, i);
        if (breakWord) {
            stack[stack.length - 1] = newFrame();
            i += breakWord.length;
            continue;
        }
        if (ch === '(' || ch === '[') {
            // `f(` is a call; `(` after an operator or a space groups an expression.
            const before = code[i - 1];
            stack.push(newFrame(ch === '(' && (isNameChar(before) || before === ')' || before === ']')));
            i++;
            continue;
        }
        if ((ch === ')' || ch === ']') && stack.length > 1) {
            const inner = stack.pop();
            // `("a" + b)` is a string; an index `x[1]` or a call `f("a")` is not known to be one.
            const result = operand(ch === ')' && !inner.call && inner.joinsString, i + 1);
            if (result.warn) return true;
            i = result.next;
            continue;
        }
        const frame = top();
        if (EXPRESSION_BREAK.has(ch)) {
            stack[stack.length - 1] = newFrame();
            i++;
            continue;
        }
        if (ch === '+') {
            frame.expectOperand = true;
            i++;
            continue;
        }
        if (MINUS.has(ch)) {
            if (!frame.expectOperand) {
                if (frame.joinsString) return true;
                frame.pending = true;
                frame.expectOperand = true;
            }
            i++;
            continue;
        }
        if (MULTIPLICATIVE.has(ch)) {
            if (frame.lastIsString) return true;
            frame.pending = true;
            frame.expectOperand = true;
            // `//` is one operator.
            i += ch === '/' && code[i + 1] === '/' ? 2 : 1;
            continue;
        }
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        // A name or a number.
        let end = i + 1;
        while (end < code.length && /[\p{L}\p{N}_.@$]/u.test(code[end]) && !code.startsWith('.to_s', end)) end++;
        const result = operand(false, end);
        if (result.warn) return true;
        i = result.next;
    }
    return false;
};

/**
 * The 0-based rows of the lines that do arithmetic other than `+` with a
 * string (see `hasStringArithmetic`).
 * @param {Array<string>} lines - The DNCL lines.
 * @returns {Array<number>} The rows to warn on.
 */
const stringArithmeticRows = (lines) =>
    lines.reduce((rows, line, row) => (hasStringArithmetic(codeOfLine(line)) ? [...rows, row] : rows), []);

export { hasStringArithmetic, stringArithmeticRows };
