// SPDX-License-Identifier: MIT
// ja-notation: the tokens of one line of Japanese (the standard form of the
// 共通テスト用プログラム表記). See ./LICENSE.

/** The first character of a name: ASCII letters, `_`, hiragana, katakana and kanji. */
const NAME_HEAD_RE = /[A-Za-z_぀-ゟ゠-ヿ一-鿿]/;

/** A character after the first one of a name: the same and the digits. */
const NAME_TAIL_RE = /[A-Za-z0-9_぀-ゟ゠-ヿ一-鿿]/;

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
 * Words of the DNCL-like form (`かつ` / `または` / `でない`). The standard form
 * writes `and` / `or` / `not`; the DNCL-like form is read by another step (J2
 * of docs/ruby-editor/converter-roadmap.md), so these are told apart here.
 */
const DNCL_LIKE_WORDS = new Set(['かつ', 'または', 'でない']);

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
 *   `integer` / `string`), `comment` (`text` from `#` to the end).
 * - `dnclLike`: a mark of the DNCL-like form (`←`, `「...」`, `かつ` / `または` / `でない`).
 * - `forbidden`: `@` or `$`, which Japanese names do not have.
 * - `unknown`: any other character, and a string that is not closed.
 *
 * `column` is the 0-based index in `text` plus `offset`.
 * @param {string} text - The code of the line (without its line number and indent).
 * @param {number} [offset] - What to add to each column.
 * @returns {Array<object>} The tokens.
 */
const tokenize = (text, offset = 0) => {
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
            const end = close === -1 ? i + 1 : close + 1;
            push('dnclLike', i, end);
            i = end;
            continue;
        }
        if (ch === '←') {
            push('dnclLike', i, i + 1);
            i++;
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
        if (NAME_HEAD_RE.test(ch)) {
            let end = i + 1;
            while (end < text.length && NAME_TAIL_RE.test(text[end])) end++;
            // A Ruby predicate or bang method keeps its `?` / `!` (`stop!`,
            // `touching?(...)`), so it is told as a command, not as a name.
            if ((text[end] === '?' || text[end] === '!') && text[end + 1] !== '=') end++;
            const word = text.substring(i, end);
            push(DNCL_LIKE_WORDS.has(word) ? 'dnclLike' : 'name', i, end);
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
        push('unknown', i, i + 1);
        i++;
    }
    return tokens;
};

export { tokenize };
