// === Smalruby: This file is Smalruby-specific (tidy DNCL code pasted into the Japanese mode) ===
//
// 共通テスト 例題 (https://nodai2hitc.github.io/ictl_example/) are written
// with line numbers (`(00)`, `(00-1)`) and `//` comments (`n = 1 // 生徒番号`).
// In Smalruby DNCL `//` is the integer-division operator, so the language
// itself never treats `//` as a comment. Instead, code pasted into the
// Japanese (DNCL) mode editor is tidied once, at paste time:
//   - line numbers are removed (wrapped statements are joined first, since
//     only numbered lines may continue onto the next line)
//   - a `//` whose right-hand side is not a variable name becomes `#`
//
// See Issue #1192.

import {skipString} from './paren-utils';

/**
 * The DNCLv2 line-number prefix (`(00)` / `(00-1)`) and the whitespace
 * after it, as the pre-processor strips it. Leading whitespace is allowed
 * because a pasted selection often starts mid-indent.
 */
const LINE_NUMBER_RE = /^\s*\(\d+(?:-\d+)*\)\s*/;

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
 * Whether the text after a `//` is the right operand of an integer division.
 * ASCII operands (`10 // 3`, `a // b`, `x // (n + 1)`) always are. A
 * Japanese word is a division only when the program uses it as a name
 * elsewhere (`a = 合計 // 個数` with `個数 = 3` above); otherwise it is the
 * description of a 共通テスト comment (`n = 1 // 生徒番号`). Nothing after
 * the `//` is a comment too.
 * @param {string} rest - The text after `//`.
 * @param {Set<string>} names - Names the program uses (see `collectNames`).
 * @returns {boolean} True when the `//` is the integer-division operator.
 */
const isDivisionOperand = (rest, names) => {
    const trimmed = rest.trimStart();
    if (trimmed === '') return false;
    if (/^[\x21-\x7e]/.test(trimmed)) return true;
    const m = trimmed.match(/^[a-zA-Z_぀-ゟ゠-ヿ一-鿿][a-zA-Z0-9_぀-ゟ゠-ヿ一-鿿]*/);
    return m !== null && names.has(m[0]);
};

/**
 * Turn the first comment-like `//` of a line into `#`.
 * @param {string} line - The source line.
 * @param {Set<string>} names - Names the program uses.
 * @returns {string} The line with the `//` comment converted.
 */
const convertSlashComment = (line, names) => {
    for (const i of slashIndices(line)) {
        if (!isDivisionOperand(line.substring(i + 2), names)) {
            return `${line.substring(0, i)}#${line.substring(i + 2)}`;
        }
    }
    return line;
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
            const m = line.match(/^(\s*\(\d+(?:-\d+)*\)\s*)([\s｜|⎿]*)(.*)$/);
            const markers = m[2].split('');
            for (let k = markers.length - 1; k >= 0 && closeCount > 0; k--) {
                if (markers[k] === '｜' || markers[k] === '|') {
                    markers[k] = '⎿';
                    closeCount--;
                }
            }
            line = `${m[1]}${markers.join('')}${'⎿'.repeat(closeCount)}${closeCount > 0 ? ' ' : ''}${m[3]}`;
        }
        result.push(line);
        i++;
    }
    return result;
};

/**
 * Tidy DNCL code pasted into the Japanese (DNCL) mode editor: remove the
 * 共通テスト line numbers and turn `//` comments into `#` comments. Text
 * with neither (ordinary Smalruby code) comes back unchanged.
 * @param {string} text - The pasted text.
 * @param {string} [context] - The rest of the program (the editor content),
 *   used to tell variable names after `//` from comment text.
 * @returns {string} The tidied text.
 */
const tidyPastedDncl = (text, context = '') => {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const hasLineNumbers = lines.some(line => LINE_NUMBER_RE.test(line));
    if (!hasLineNumbers && !lines.some(line => slashIndices(line).length > 0)) {
        return text;
    }
    const joined = hasLineNumbers ? joinContinuationLines(lines) : lines;
    const stripped = hasLineNumbers ? joined.map(line => line.replace(LINE_NUMBER_RE, '')) : joined;
    const names = collectNames(`${stripped.join('\n')}\n${context}`);
    return stripped.map(line => convertSlashComment(line, names)).join(eol);
};

export {tidyPastedDncl};
