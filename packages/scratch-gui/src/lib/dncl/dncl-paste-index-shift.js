// === Smalruby: This file is Smalruby-specific (shift 1-based array indexes pasted into DNCL mode) ===
//
// Smalruby DNCL arrays start at index 0 (Issue #1357), but some 共通テスト
// problems say "the index starts at 1". When such a program is pasted into
// the Japanese (DNCL) mode editor, these helpers let the editor offer to
// shift every array index of the pasted text down by 1, show what it
// rewrote, and point at the lines that probably assume 1-based indexes
// (loop ranges, `i = 1`, ...) without rewriting them (Issue #1366).

const ID =
    '[A-Za-z_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF][\\w\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]*';
const ID_CHAR_RE = /[\w぀-ゟ゠-ヿ一-鿿]/;
const ID_RE = new RegExp(ID, 'g');

/**
 * A note saying the indexes start at 1: `添字は1から始まる`, `添え字は１から`,
 * `インデックスは 1 から` (full-width digits are normalized first).
 */
const NOTE_RE = /(?:添え?字|インデックス)[^0-9\n]{0,15}?1\s*から/;

const ASSIGN_ONE_RE = new RegExp(`^(${ID})\\s*(?:=|←)\\s*1$`);
const LOOP_RE = new RegExp(`^(${ID})\\s*を\\s*(.+?)\\s*から\\s*(.+?)\\s*まで`);
const LENGTH_RE = new RegExp(`^要素数\\(\\s*${ID}\\s*\\)$`);
const LESS_EQUAL_RE = new RegExp(
    `(?<![\\w\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF])(${ID})\\s*(?:<=|≦)\\s*(要素数\\(\\s*${ID}\\s*\\)|${ID})`,
    'g',
);

/**
 * Mask string literals (`"..."`, `'...'`, `「...」`) with spaces, keeping the
 * quotes and the length, and find where the `#` comment starts.
 * @param {string} line - A DNCL source line.
 * @returns {{code: string, comment: number}} The masked line and the index
 *   of the comment `#` (`line.length` when there is none).
 */
const scanLine = (line) => {
    let code = '';
    let quote = null;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
            if (ch === '\\' && quote !== '」' && i + 1 < line.length) {
                code += '  ';
                i++;
            } else {
                code += ch === quote ? ch : ' ';
                if (ch === quote) quote = null;
            }
            continue;
        }
        if (ch === '#') return { code: code + ' '.repeat(line.length - i), comment: i };
        if (ch === '"' || ch === "'") quote = ch;
        if (ch === '「') quote = '」';
        code += ch;
    }
    return { code, comment: line.length };
};

/**
 * Whether the pasted text has a note saying that array indexes start at 1.
 * Only comments are looked at (`# 配列の添字は1から始まる`, and `//` comments
 * of a sample that was not tidied).
 * @param {string} text - The pasted text.
 * @returns {boolean} True when such a note is found.
 */
const hasOneBasedIndexNote = (text) =>
    text.split(/\r?\n/).some((line) => {
        const { code, comment } = scanLine(line);
        const slash = code.indexOf('//');
        const start = slash >= 0 && slash < comment ? slash : comment;
        const note = line.substring(start).replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
        return NOTE_RE.test(note);
    });

/**
 * Index of the bracket matching the `[` at `open`, in masked code.
 * @param {string} code - Masked code.
 * @param {number} open - Index of the `[`.
 * @returns {number} Index of the matching `]`, or -1.
 */
const matchingBracket = (code, open) => {
    let depth = 0;
    for (let i = open; i < code.length; i++) {
        const ch = code[i];
        if (ch === '[' || ch === '(') depth++;
        else if (ch === ']' || ch === ')') {
            depth--;
            if (depth === 0) return ch === ']' ? i : -1;
        }
    }
    return -1;
};

/**
 * Split the inside of brackets at top-level commas.
 * @param {string} code - Masked text between the brackets.
 * @returns {Array<{start: number, end: number}>} The ranges of the parts.
 */
const splitArgs = (code) => {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < code.length; i++) {
        const ch = code[i];
        if (ch === '[' || ch === '(') depth++;
        else if (ch === ']' || ch === ')') depth--;
        else if (ch === ',' && depth === 0) {
            parts.push({ start, end: i });
            start = i + 1;
        }
    }
    parts.push({ start, end: code.length });
    return parts;
};

/**
 * Shift one index expression down by 1: `3` → `2`, `i + 1` → `i`,
 * `i - 1` → `i - 2`, anything else → `expr - 1`.
 * @param {string} expr - The index expression (trimmed).
 * @returns {string} The shifted expression.
 */
const shiftIndex = (expr) => {
    if (/^\d+$/.test(expr)) return String(Number(expr) - 1);
    const plus = expr.match(/^(.*\S)\s*\+\s*1$/);
    if (plus && !/[([]$/.test(plus[1])) return plus[1];
    const minus = expr.match(/^(.*\S)(\s*-\s*)(\d+)$/);
    if (minus && !/[([]$/.test(minus[1])) return `${minus[1]}${minus[2]}${Number(minus[3]) + 1}`;
    return `${expr} - 1`;
};

/**
 * Rewrite the array accesses of a piece of code (recursively, so nested
 * accesses such as `A[B[i]]` are shifted too).
 * @param {string} text - The original text.
 * @param {string} code - The same text with strings masked (same length).
 * @param {number} base - Where `text` starts in the output line.
 * @returns {{out: string, changes: Array<object>}} The rewritten text and
 *   the accesses changed, with `start`/`end` offsets in the output line
 *   (and `negative: true` when an index became negative).
 */
const rewrite = (text, code, base) => {
    let out = '';
    const changes = [];
    let i = 0;
    let chained = false;
    let chainReported = false;
    let chainText = 0;
    let chainOut = 0;
    let chainNegative = false;
    while (i < text.length) {
        const afterName = i > 0 && ID_CHAR_RE.test(code[i - 1]);
        if (code[i] === '[' && (afterName || chained)) {
            const close = matchingBracket(code, i);
            if (close < 0) break;
            if (chained) {
                // `A[i][j]`: the whole chain is one change.
                if (chainReported) changes.pop();
            } else {
                let n = 0;
                while (i - n > 0 && ID_CHAR_RE.test(code[i - n - 1])) n++;
                chainText = i - n;
                chainOut = out.length - n;
                chainNegative = false;
            }
            const innerText = text.substring(i + 1, close);
            const innerCode = code.substring(i + 1, close);
            const parts = splitArgs(innerCode);
            let inner = '';
            const innerChanges = [];
            const innerBase = base + out.length + 1;
            for (let k = 0; k < parts.length; k++) {
                const part = parts[k];
                const partText = innerText.substring(part.start, part.end);
                const lead = partText.match(/^\s*/)[0];
                const body = partText.trim();
                const trail = partText.substring(lead.length + body.length);
                const bodyCode = innerCode.substr(part.start + lead.length, body.length);
                const sub = rewrite(body, bodyCode, innerBase + inner.length + lead.length);
                // Leave keys that are strings (`X["a"]`) and empty brackets alone.
                const shift = body !== '' && !/["'「]/.test(bodyCode);
                // `A[0]` becomes `A[-1]`, which is never right in DNCL.
                if (shift && /^0+$/.test(body)) chainNegative = true;
                inner += lead + (shift ? shiftIndex(sub.out) : sub.out) + trail;
                innerChanges.push(...sub.changes);
                if (k < parts.length - 1) inner += ',';
            }
            out += `[${inner}]`;
            changes.push(...innerChanges);
            const before = text.substring(chainText, close + 1);
            const after = out.substring(chainOut);
            // Only accesses that were actually rewritten are reported
            // (`X["a"]` and `X[]` stay as they are).
            chainReported = after !== before;
            if (chainReported) {
                const change = { start: base + chainOut, end: base + out.length, before, after };
                if (chainNegative) change.negative = true;
                changes.push(change);
            }
            i = close + 1;
            chained = code[i] === '[';
            continue;
        }
        chained = false;
        out += text[i];
        i++;
    }
    if (i < text.length) out += text.substring(i);
    return { out, changes };
};

/**
 * Shift every array index of `text` down by 1. Array literals
 * (`Nissu = [4, 1, 3]`), strings and comments are left as they are.
 * @param {string} text - The pasted text.
 * @returns {{text: string, changes: Array<object>}} The rewritten text and
 *   the accesses changed, each with the 1-based `line`, the 0-based
 *   `start`/`end` columns in the rewritten line, and the `before` / `after`
 *   access text. Nested accesses are listed before the access around them.
 *   An access whose index became negative (`A[0]` → `A[-1]`, a sign that the
 *   code was already 0-based there) also has `negative: true`.
 */
const shiftArrayIndexes = (text) => {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const changes = [];
    const lines = text.split(/\r?\n/).map((line, idx) => {
        const { code, comment } = scanLine(line);
        const result = rewrite(line.substring(0, comment), code.substring(0, comment), 0);
        for (const change of result.changes) changes.push({ line: idx + 1, ...change });
        return result.out + line.substring(comment);
    });
    return { text: lines.join(eol), changes };
};

/**
 * Names used inside array index brackets (`i` in `Akibi[i + 1]`).
 * @param {Array<string>} codes - Masked code of each line.
 * @returns {Set<string>} The names.
 */
const collectIndexNames = (codes) => {
    const names = new Set();
    for (const code of codes) {
        for (let i = 1; i < code.length; i++) {
            if (code[i] !== '[' || !(ID_CHAR_RE.test(code[i - 1]) || code[i - 1] === ']')) continue;
            const close = matchingBracket(code, i);
            if (close < 0) continue;
            for (const name of code.substring(i + 1, close).match(ID_RE) || []) names.add(name);
        }
    }
    return names;
};

/**
 * Find the lines that probably assume 1-based indexes but are not rewritten
 * by `shiftArrayIndexes`:
 *   - `assignOne`: a variable set to 1 (`tantou = 1`)
 *   - `loopFromOne`: a counting loop from 1 (`i を 1 から n まで ...`)
 *   - `loopFromN`: a counting loop from 2 or more whose variable is used as
 *     an index (`buin を 2 から buinsu まで ...`, skipping the first element)
 *   - `loopToLength`: a counting loop up to `要素数(X)`
 *   - `lessEqual`: an index variable compared to a count with `<=`
 *     (`i <= 要素数(X)`, `i <= n`)
 * @param {string} text - DNCL source code (e.g. the pasted text).
 * @returns {Array<object>} One entry per line, with the 1-based `line`, the
 *   0-based `start` / `end` columns of the statement, its `text`, the
 *   `reasons` (the kinds above) and `usedAsIndex` (whether the variable is
 *   used as an array index, so the hint is more likely right).
 */
const findOneBasedSuspects = (text) => {
    const lines = text.split(/\r?\n/);
    const codes = lines.map((line) => scanLine(line).code);
    const indexNames = collectIndexNames(codes);
    const suspects = [];
    codes.forEach((code, idx) => {
        const prefix = code.match(/^[\s｜|⎿]*/)[0];
        const stmt = code.substring(prefix.length).trimEnd();
        if (stmt === '') return;
        const reasons = [];
        let name = null;
        const assign = stmt.match(ASSIGN_ONE_RE);
        if (assign) {
            reasons.push('assignOne');
            name = assign[1];
        }
        const loop = stmt.match(LOOP_RE);
        if (loop) {
            const [, loopVar, from, to] = loop;
            name = loopVar;
            if (from === '1') reasons.push('loopFromOne');
            else if (/^\d+$/.test(from) && Number(from) > 1 && indexNames.has(loopVar)) reasons.push('loopFromN');
            if (LENGTH_RE.test(to)) reasons.push('loopToLength');
        }
        for (const [, left, right] of stmt.matchAll(LESS_EQUAL_RE)) {
            if (indexNames.has(left) || right.startsWith('要素数')) {
                reasons.push('lessEqual');
                name = name || left;
                break;
            }
        }
        if (reasons.length === 0) return;
        suspects.push({
            line: idx + 1,
            start: prefix.length,
            end: prefix.length + stmt.length,
            text: lines[idx].substring(prefix.length, prefix.length + stmt.length),
            reasons,
            usedAsIndex: name !== null && indexNames.has(name),
        });
    });
    return suspects;
};

export { findOneBasedSuspects, hasOneBasedIndexNote, shiftArrayIndexes };
