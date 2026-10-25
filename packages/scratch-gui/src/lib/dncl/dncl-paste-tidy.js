// === Smalruby: This file is Smalruby-specific (tidy DNCL code pasted into the Japanese mode) ===
//
// 共通テスト 例題 (https://nodai2hitc.github.io/ictl_example/) are written
// with line numbers (`(00)`, `(00-1)`) and `//` comments (`n = 1 // 生徒番号`).
// In Smalruby DNCL `//` is always the integer-division operator; the
// language never treats it as a comment. Only text that is obviously copied
// from such a sample (it has line numbers) is tidied, once, at paste time:
//   - line numbers are removed (wrapped statements are joined first, since
//     only numbered lines may continue onto the next line)
//   - a `//` followed by neither a variable nor any operator becomes `#`
// Anything else is left as typed; a `//` comment then fails to convert and
// the error marker tells the user to use `#` (see `hasDoubleSlash`).
//
// See Issue #1192.

import {skipString} from './paren-utils';

/**
 * A line-number prefix and the whitespace after it: the DNCLv2 form
 * (`(00)` / `(00-1)`, as the pre-processor strips it) or `1:`, as listings
 * that number their lines are copied. Leading whitespace is allowed because
 * a pasted selection often starts mid-indent. `1:` needs a space (or the end
 * of the line) after it so that `10:30` is not taken for a line number.
 */
const LINE_NUMBER_RE = /^\s*(?:\(\d+(?:-\d+)*\)\s*|\d+:(?:\s+|$))/;

/**
 * Operators that make the text after a `//` look like code: ASCII
 * operators, the DNCL symbols and the `かつ` / `または` keywords (which the
 * converter only accepts between spaces).
 */
const OPERATOR_RE = /[+\-*/%=<>!&|÷×≦≧≠]|(?:^|\s)(?:かつ|または)(?=\s|$)/;

/** An identifier as the DNCL converter accepts it (ASCII + kana + kanji). */
const NAME_RE = /[a-zA-Z_぀-ゟ゠-ヿ一-鿿][a-zA-Z0-9_぀-ゟ゠-ヿ一-鿿]*/g;

/**
 * Split a line into the code part and the trailing `#` comment, ignoring
 * `#` inside string literals.
 * @param {string} line - The source line.
 * @returns {number} Index of the comment `#`, or `line.length` when none.
 */
const commentStart = line => {
    let i = 0;
    while (i < line.length) {
        const ch = line[i];
        if (ch === '"' || ch === "'") {
            i = skipString(line, i, ch);
            continue;
        }
        if (ch === '#') return i;
        i++;
    }
    return line.length;
};

/**
 * Indices of every `//` outside string literals and before any `#` comment.
 * @param {string} line - The source line.
 * @returns {Array<number>} Index of the first `/` of each `//`.
 */
const slashIndices = line => {
    const result = [];
    const end = commentStart(line);
    let i = 0;
    while (i < end) {
        const ch = line[i];
        if (ch === '"' || ch === "'") {
            i = skipString(line, i, ch);
            continue;
        }
        if (ch === '/' && line[i + 1] === '/') {
            result.push(i);
            i += 2;
            continue;
        }
        i++;
    }
    return result;
};

/**
 * Remove string literals from a line so names inside them are not counted.
 * @param {string} line - The source line.
 * @returns {string} The line with every string literal replaced by a space.
 */
const withoutStrings = line => {
    let out = '';
    let i = 0;
    while (i < line.length) {
        const ch = line[i];
        if (ch === '"' || ch === "'") {
            i = skipString(line, i, ch);
            out += ' ';
            continue;
        }
        out += ch;
        i++;
    }
    return out;
};

/**
 * Names used as code in `source`: identifiers outside strings and comments,
 * not counting what follows a `//` (that part is what we are deciding on).
 * @param {string} source - Program text.
 * @returns {Set<string>} The names.
 */
const collectNames = source => {
    const names = new Set();
    for (const line of source.split('\n')) {
        const slashes = slashIndices(line);
        const end = slashes.length > 0 ? slashes[0] : commentStart(line);
        for (const name of withoutStrings(line.substring(0, end)).match(NAME_RE) || []) {
            names.add(name);
        }
    }
    return names;
};

/**
 * Net bracket depth of a line, ignoring string literals and `#` comments.
 * @param {string} line - The source line.
 * @returns {number} Opening brackets minus closing brackets.
 */
const bracketDepth = line => {
    let depth = 0;
    const code = withoutStrings(line.substring(0, commentStart(line)));
    for (const ch of code) {
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        if (ch === ')' || ch === ']' || ch === '}') depth--;
    }
    return depth;
};

/**
 * Whether the `//` at index `i` of `line` looks like code (the
 * integer-division operator) rather than a 共通テスト comment. It is a
 * comment only when what follows is neither a variable nor contains any
 * operator (`n = 1 // 生徒番号`). Code-like are:
 *   - a number or an ASCII name (`10 // 3`, `x // y`)
 *   - a Japanese word the program uses as a variable (`合計 // 個数` with
 *     `個数 = 3` in the pasted text or the editor)
 *   - any operator after the `//` (`合計 // 個数 + 1`)
 *   - a `//` inside brackets, where a comment cannot be (`(合計 // 個数)`)
 * `a = 合計 // 個数` alone cannot be told apart from `n = 1 // 生徒番号`, so
 * it becomes a comment; that is a known limitation.
 * @param {string} line - The source line.
 * @param {number} i - Index of the first `/` of the `//`.
 * @param {Set<string>} names - Names the program uses (see `collectNames`).
 * @returns {boolean} True when the `//` is the integer-division operator.
 */
const isDivisionSlash = (line, i, names) => {
    const rest = line.substring(i + 2, commentStart(line)).trim();
    if (rest === '') return false;
    if (/^[\x21-\x7e]/.test(rest)) return true;
    const m = rest.match(/^[a-zA-Z_぀-ゟ゠-ヿ一-鿿][a-zA-Z0-9_぀-ゟ゠-ヿ一-鿿]*/);
    if (m !== null && names.has(m[0])) return true;
    if (OPERATOR_RE.test(withoutStrings(rest))) return true;
    return bracketDepth(line.substring(0, i)) > 0;
};

/**
 * Turn the first comment-like `//` of a line into `#`.
 * @param {string} line - The source line.
 * @param {Set<string>} names - Names the program uses.
 * @returns {string} The line with the `//` comment converted.
 */
const convertSlashComment = (line, names) => {
    for (const i of slashIndices(line)) {
        if (!isDivisionSlash(line, i, names)) {
            return `${line.substring(0, i)}#${line.substring(i + 2)}`;
        }
    }
    return line;
};

/**
 * Join statements that 共通テスト samples wrap onto unnumbered lines, e.g.
 *   `(10)  ｜ 表示する(i, "人目の待ち時間：",`
 *   `      ⎿          Kaishi[i] - Touchaku[i], "分間")`
 * The pre-processor only joins such lines while the line number is still
 * there, so they have to be joined before the number is removed. A `⎿` on
 * a continuation line closes a block after the statement, so it replaces
 * the innermost `｜` of the joined line (`  ⎿ 表示する(...)`).
 * @param {Array<string>} lines - Source lines (line numbers not removed yet).
 * @returns {Array<string>} The lines with wrapped statements joined.
 */
const joinContinuationLines = lines => {
    const result = [];
    let i = 0;
    while (i < lines.length) {
        let line = lines[i];
        let closeCount = 0;
        let depth = LINE_NUMBER_RE.test(line) ? bracketDepth(line) : 0;
        while (depth > 0 && i + 1 < lines.length && !LINE_NUMBER_RE.test(lines[i + 1])) {
            i++;
            const m = lines[i].match(/^([\s｜|⎿]*)(.*)$/);
            closeCount += (m[1].match(/⎿/g) || []).length;
            const rest = m[2].trim();
            line = `${line.replace(/\s+$/, '')} ${rest}`;
            depth += bracketDepth(rest);
        }
        if (closeCount > 0) {
            const prefix = line.match(LINE_NUMBER_RE)[0];
            const m = line.substring(prefix.length).match(/^([\s｜|⎿]*)(.*)$/);
            const markers = m[1].split('');
            for (let k = markers.length - 1; k >= 0 && closeCount > 0; k--) {
                if (markers[k] === '｜' || markers[k] === '|') {
                    markers[k] = '⎿';
                    closeCount--;
                }
            }
            line = `${prefix}${markers.join('')}${'⎿'.repeat(closeCount)}${closeCount > 0 ? ' ' : ''}${m[2]}`;
        }
        result.push(line);
        i++;
    }
    return result;
};

/**
 * Tidy DNCL code pasted into the Japanese (DNCL) mode editor. Only text
 * with line numbers (copied from a 共通テスト sample) is changed: the line
 * numbers are removed and `//` comments become `#` comments. Text without
 * line numbers comes back unchanged, `//` included.
 * @param {string} text - The pasted text.
 * @param {string} [context] - The rest of the program (the editor content),
 *   used to tell variable names after `//` from comment text.
 * @returns {string} The tidied text.
 */
const tidyPastedDncl = (text, context = '') => {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    if (!lines.some(line => LINE_NUMBER_RE.test(line))) return text;
    const stripped = joinContinuationLines(lines).map(line => line.replace(LINE_NUMBER_RE, ''));
    const names = collectNames(`${stripped.join('\n')}\n${context}`);
    return stripped.map(line => convertSlashComment(line, names)).join(eol);
};

/**
 * Whether a line has a `//` outside string literals and `#` comments. Used
 * to explain a conversion error on such a line: `//` is integer division in
 * Smalruby, so a `//` comment typed or pasted without line numbers fails.
 * @param {string} line - The source line.
 * @returns {boolean} True when the line has a `//`.
 */
const hasDoubleSlash = line => slashIndices(line).length > 0;

/**
 * Prefix `hint` to the message of each conversion error whose DNCL line has
 * a `//` (see `hasDoubleSlash`).
 * @param {Array<object>} errors - Errors with a 0-based DNCL `row` and `text`.
 * @param {Array<string>} lines - The DNCL source lines.
 * @param {string} hint - The message telling the user to use `#`.
 * @returns {Array<object>} The errors, with the hint added where it applies.
 */
const withDoubleSlashHint = (errors, lines, hint) =>
    errors.map(err =>
        err.row >= 0 && err.row < lines.length && hasDoubleSlash(lines[err.row])
            ? {...err, text: `${hint}\n${err.text}`}
            : err,
    );

export {hasDoubleSlash, tidyPastedDncl, withDoubleSlashHint};
