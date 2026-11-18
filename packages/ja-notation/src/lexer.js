// SPDX-License-Identifier: MIT
// ja-notation: the tokens of one line of Japanese (the standard form of the
// 共通テスト用プログラム表記 and the DNCL-like form). See ../LICENSE.

/**
 * The first character of a name: an ASCII letter, `_`, or a letter of any
 * script (`\p{L}`: kana, kanji with the CJK extensions, `々`, `〆`, `ヶ`, full-width
 * letters, Greek, ...), a letter number (`\p{Nl}`: `〇`, `Ⅱ`), and the marks of
 * the kana blocks (`゛`, `・`). Ruby takes any of them in a name, and Ruby →
 * Japanese writes the name as it is (`@佐々木` → `佐々木`), so the Japanese reads
 * back every name it writes (Issue #1714). A full-width letter is a name of its
 * own (`ｘ` is not `x`): Ruby has them as two variables.
 */
const NAME_HEAD_RE = /[A-Za-z_\p{L}\p{Nl}\u3040-\u309F\u30A0-\u30FF]/u;

/**
 * A character after the first one of a name: the same, the digits (`\p{Nd}`,
 * full-width ones too) and the combining marks (`\p{M}`: `か` and `゙`).
 */
const NAME_TAIL_RE = /[A-Za-z0-9_\p{L}\p{Nl}\p{Nd}\p{M}\u3040-\u309F\u30A0-\u30FF]/u;

/**
 * The length (in UTF-16 units) of the character at `text[i]` when it matches
 * a class of the name, else 0: a kanji out of the BMP (`𠮷`) is two units.
 * @param {string} text - The text.
 * @param {number} i - The index.
 * @param {RegExp} re - `NAME_HEAD_RE` or `NAME_TAIL_RE`.
 * @returns {number} 0, 1 or 2.
 */
const nameCharAt = (text, i, re) => {
    const point = text.codePointAt(i);
    if (typeof point !== 'number') return 0;
    const ch = String.fromCodePoint(point);
    return re.test(ch) ? ch.length : 0;
};

/**
 * Whether a character can start a name of the Japanese.
 * @param {string} ch - One character (a code point).
 * @returns {boolean} True if it can.
 */
const isNameHead = (ch) => typeof ch === 'string' && ch !== '' && nameCharAt(ch, 0, NAME_HEAD_RE) === ch.length;

/**
 * Whether a character can be in a name of the Japanese (after its first one).
 * @param {string} ch - One character (a code point).
 * @returns {boolean} True if it can.
 */
const isNameChar = (ch) => typeof ch === 'string' && ch !== '' && nameCharAt(ch, 0, NAME_TAIL_RE) === ch.length;

/**
 * Whether a text is one name of the Japanese (`佐々木`, `x1`), as the lexer reads it.
 * @param {string} text - The text.
 * @returns {boolean} True if it is.
 */
const isName = (text) => {
    if (typeof text !== 'string') return false;
    let i = nameCharAt(text, 0, NAME_HEAD_RE);
    if (i === 0) return false;
    while (i < text.length) {
        const length = nameCharAt(text, i, NAME_TAIL_RE);
        if (length === 0) return false;
        i += length;
    }
    return true;
};

/**
 * Characters that are read as another one. Only how they look differs
 * (full-width / half-width, the minus signs), so reading takes all of them
 * and the parse sees one (docs/dncl/policy.md: 見た目だけの揺れ).
 */
const SAME_AS = {
    '＋': '+',
    '－': '-',
    '−': '-',
    '–': '-',
    '×': '*',
    '＊': '*',
    '／': '/',
    '％': '%',
    '＝': '=',
    '＜': '<',
    '＞': '>',
    '≦': '<=',
    '≧': '>=',
    '≠': '!=',
    '（': '(',
    '）': ')',
    '［': '[',
    '］': ']',
    '，': ',',
    '：': ':',
    // The DNCL-like form assigns with `←`.
    '←': '=',
};

/** Operators of more than one character, longest first. */
const LONG_OPERATORS = ['...', '**', '..', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '//'];

/** Operators of one character. */
const SHORT_OPERATORS = new Set(['+', '-', '*', '/', '%', '<', '>', '=', '(', ')', '[', ']', ',', ':', '÷', '!']);

/** The inputs written between 【 and 】, and what they read. */
const INPUTS = {
    外部からの入力: 'external',
    整数を入力: 'integer',
    文字列を入力: 'string',
};

/**
 * The end of a string literal that starts at `text[start]` (the index after
 * its closing quote), or -1 when it is not closed on the line.
 * @param {string} text - The line.
 * @param {number} start - The index of the opening quote.
 * @returns {number} The index after the closing quote, or -1.
 */
const stringEnd = (text, start) => {
    const quote = text[start];
    let i = start + 1;
    while (i < text.length) {
        if (text[i] === '\\') {
            i += 2;
            continue;
        }
        if (text[i] === quote) return i + 1;
        i++;
    }
    return -1;
};

/**
 * The end of a number that starts at `text[start]`, and whether it is written
 * in a way the Japanese does not have (`0x5`, `1_000`, `1e3`, `2i`): the
 * letters, `_` and exponent signs Ruby would read as a part of it are taken in.
 * @param {string} text - The line.
 * @param {number} start - The index of the first digit.
 * @returns {{end: number, bad: boolean}} The end and whether it is not a plain number.
 */
const numberEnd = (text, start) => {
    let i = start;
    while (i < text.length && /[0-9]/.test(text[i])) i++;
    if (text[i] === '.' && /[0-9]/.test(text[i + 1] || '')) {
        i++;
        while (i < text.length && /[0-9]/.test(text[i])) i++;
    }
    const plainEnd = i;
    for (;;) {
        const ch = text[i] || '';
        if (/[A-Za-z0-9_]/.test(ch)) {
            i++;
        } else if (ch === '.' && /[0-9]/.test(text[i + 1] || '')) {
            i++;
        } else if (/[+-]/.test(ch) && /[eE]/.test(text[i - 1]) && /[0-9]/.test(text[i + 1] || '')) {
            i++;
        } else {
            break;
        }
    }
    return { end: i, bad: i !== plainEnd };
};

/**
 * The operator of more than one character that starts at `text[i]`, or undefined.
 * @param {string} text - The line.
 * @param {number} i - The index.
 * @returns {string|undefined} The operator.
 */
const longOperatorAt = (text, i) => LONG_OPERATORS.find((op) => text.startsWith(op, i));

/**
 * Read one line of code into tokens. A token is `{type, text, column}` and,
 * for some types, `value`:
 *
 * - `number` (`value`: the number as written), `badNumber`, `string` (`text`
 *   is the literal with its quotes), `name`, `op` (`value`: the operator, a
 *   full-width one read as its half-width one), `input` (`value`: `external` /
 *   `integer` / `string`), `comment` (`text` from `#` to the end; a comment
 *   started with `//` when it is the comment mark is read as one with `#`).
 *   The DNCL-like form is read too: `←` is the operator `=`, a 「...」 is a
 *   `string` (its `text` is the `"..."` literal it is read as) and `かつ` /
 *   `または` / `でない` are names.
 * - `forbidden`: `@` or `$`, which Japanese names do not have.
 * - `unknown`: any other character, and a string that is not closed.
 *
 * `column` is the 0-based index in `text` plus `offset`.
 * @param {string} text - The code of the line (without its line number and indent).
 * @param {number} [offset] - What to add to each column.
 * @param {string} [commentMarker] - The comment mark of the settings (`#` or
 *   `//`). With `//`, `//` starts a comment (and `#` still does) instead of
 *   being the integer quotient.
 * @returns {Array<object>} The tokens.
 */
const tokenize = (text, offset = 0, commentMarker = '#') => {
    const tokens = [];
    const push = (type, start, end, extra = {}) =>
        tokens.push({ type, text: text.substring(start, end), column: start + offset, ...extra });
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if (ch === '#') {
            push('comment', i, text.length);
            break;
        }
        if (commentMarker === '//' && text.startsWith('//', i)) {
            // The JaAST keeps every comment with `#` (one form); `writeJa` writes the mark back.
            tokens.push({ type: 'comment', text: `#${text.substring(i + 2)}`, column: i + offset });
            break;
        }
        if (ch === '"' || ch === "'") {
            const end = stringEnd(text, i);
            if (end === -1) {
                push('unknown', i, text.length);
                break;
            }
            push('string', i, end);
            i = end;
            continue;
        }
        if (ch === '「') {
            const close = text.indexOf('」', i + 1);
            if (close === -1) {
                push('unknown', i, text.length);
                break;
            }
            // The text is taken as it is: a `"` or `\` in it stays text.
            const literal = `"${text.substring(i + 1, close).replace(/[\\"]/g, '\\$&')}"`;
            tokens.push({ type: 'string', text: literal, column: i + offset });
            i = close + 1;
            continue;
        }
        if (ch === '【') {
            const close = text.indexOf('】', i + 1);
            const inner = close === -1 ? null : text.substring(i + 1, close);
            if (inner !== null && INPUTS[inner]) {
                push('input', i, close + 1, { value: INPUTS[inner] });
                i = close + 1;
            } else {
                push('unknown', i, close === -1 ? i + 1 : close + 1);
                i = close === -1 ? i + 1 : close + 1;
            }
            continue;
        }
        if (/[0-9]/.test(ch)) {
            const { end, bad } = numberEnd(text, i);
            push(bad ? 'badNumber' : 'number', i, end, bad ? {} : { value: text.substring(i, end) });
            i = end;
            continue;
        }
        const head = nameCharAt(text, i, NAME_HEAD_RE);
        if (head > 0) {
            let end = i + head;
            for (let length = nameCharAt(text, end, NAME_TAIL_RE); length > 0; ) {
                end += length;
                length = nameCharAt(text, end, NAME_TAIL_RE);
            }
            // A Ruby predicate or bang method keeps its `?` / `!` (`stop!`,
            // `touching?(...)`), so it is told as a command, not as a name.
            if ((text[end] === '?' || text[end] === '!') && text[end + 1] !== '=') end++;
            push('name', i, end);
            i = end;
            continue;
        }
        if (ch === '@' || ch === '$') {
            push('forbidden', i, i + 1);
            i++;
            continue;
        }
        const long = longOperatorAt(text, i);
        if (long) {
            push('op', i, i + long.length, { value: long === '//' ? '÷' : long });
            i += long.length;
            continue;
        }
        const same = SAME_AS[ch] || ch;
        if (SHORT_OPERATORS.has(same) || (same.length === 2 && LONG_OPERATORS.includes(same))) {
            push('op', i, i + 1, { value: same });
            i++;
            continue;
        }
        // A character out of the BMP (`😀`) is told whole, not half of it.
        const width = String.fromCodePoint(text.codePointAt(i)).length;
        push('unknown', i, i + width);
        i += width;
    }
    return tokens;
};

export { isName, isNameChar, isNameHead, NAME_HEAD_RE, NAME_TAIL_RE, tokenize };
