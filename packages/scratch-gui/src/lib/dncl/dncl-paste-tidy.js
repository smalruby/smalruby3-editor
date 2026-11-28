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
// Anything else is left as typed. A `//` comment typed without line numbers
// is then read as the quotient (`n = 1 // 生徒番号` is `(1 / @生徒番号).to_i`,
// Issue #1711); the editor warns on such lines and the check of a 生成AI
// answer reports them, both finding them by how they look
// (`slashCommentRows`). The editor also adds the hint to the errors of lines
// with a `//` (`withDoubleSlashHint`).
//
// See Issue #1192.
import { lineNumberSeparator } from './dncl-line-number';
import { BRANCH_PATTERN, CLOSER_PATTERN } from './dncl-problem-form';
import { codeOfLine, commentIndex, stringEndAt } from './dncl-trailing-comment';
import { NAME_PATTERN } from './paren-utils';

/**
 * A line-number prefix and the whitespace after it: the DNCLv2 form
 * (`(00)` / `(00-1)`, as the reader skips it) or `1:`, as listings
 * that number their lines are copied. Leading whitespace is allowed because
 * a pasted selection often starts mid-indent. `1:` needs a space (or the end
 * of the line) after it so that `10:30` is not taken for a line number.
 */
const LINE_NUMBER_RE = /^\s*(?:\(\d+(?:-\d+)*\)\s*|\d+:(?:\s+|$))/;

/**
 * A line number written with spaces in its parentheses (`( 1 )`), as some texts show it
 * (Issue #1756). It is written back as `(1)` before the line numbers are removed.
 */
const SPACED_LABEL_RE = /^(\s*)\(\s+(\d+(?:-\d+)*)\s*\)|^(\s*)\((\d+(?:-\d+)*)\s+\)/;

/**
 * A bare line number (`01`, `1`) and what follows it: the end of the line, or spaces and code
 * that does not go on from a number (`1 + 2` is code). Taken only when every line of the paste
 * has one (see `isBareNumbered`), as a line of code can start with a number.
 */
const BARE_LABEL_RE = /^(\s*)(\d+)(?=\s*$|\s+[^\s\d+\-*/%=<>!÷×,.)\]:：．＋－＊／％＝＜＞])/;

/**
 * The line-number label alone, without the whitespace after it: that
 * whitespace is the indent of the code (Issue #1718).
 */
const LINE_NUMBER_LABEL_RE = /^\s*(?:\(\d+(?:-\d+)*\)|\d+:(?=\s|$))/;

/**
 * Split a numbered line into the whitespace after its label and the code.
 * @param {string} line - A line with a line number.
 * @returns {{label: string, ws: string, code: string}} The label, the
 *   whitespace after it and the code.
 */
const afterLineNumber = (line) => {
    const [prefix] = line.match(LINE_NUMBER_LABEL_RE);
    const label = prefix.trimStart();
    const after = line.substring(prefix.length);
    const ws = after.match(/^\s*/)[0];
    return { label, ws, code: after.substring(ws.length) };
};

/**
 * Whether the code starts with a `｜` / `⎿` indent marker.
 * @param {string} code - The code after the line number and its whitespace.
 * @returns {boolean} True when it starts with a marker.
 */
const startsWithMarker = (code) => /^[｜|│⎿└]/.test(code);

/**
 * Remove the line numbers but keep the indent of code written with
 * indentation only (no `｜` / `⎿`), so that its blocks still close: the
 * separator after the numbers (see `lineNumberSeparator`) is taken off and
 * the rest is kept. Lines starting with a marker lose all the whitespace
 * before it, as before (Issue #1718).
 * @param {Array<string>} lines - The lines (continuation lines joined).
 * @returns {Array<string>} The lines without line numbers.
 */
const removeLineNumbers = (lines) => {
    const separator = lineNumberSeparator(
        lines
            .filter((line) => LINE_NUMBER_RE.test(line))
            .map(afterLineNumber)
            .filter(({ code }) => code !== '' && !startsWithMarker(code)),
    );
    return lines.map((line) => {
        if (!LINE_NUMBER_RE.test(line)) return line;
        const { label, ws, code } = afterLineNumber(line);
        if (code === '' || startsWithMarker(code)) return code;
        return `${ws.substring(Math.min(ws.length, separator(label)))}${code}`;
    });
};

/**
 * Operators that make the text after a `//` look like code: ASCII
 * operators, the DNCL symbols and the `かつ` / `または` keywords between
 * spaces. The converter also takes them without spaces (`(a)かつ(b)`,
 * Issue #1697), but this is only a guess at code, and counting `、かつ` too
 * would turn a comment such as `// 偶数、かつ 正の数` into a division.
 */
const OPERATOR_RE = /[+\-*/%=<>!&|÷×≦≧≠]|(?:^|\s)(?:かつ|または)(?=\s|$)/;

/** A name as the converter (ja-notation) reads it (`佐々木` is one name; Issue #1714). */
const NAME_RE = new RegExp(NAME_PATTERN, 'gu');

/** A name at the start of a text. */
const LEADING_NAME_RE = new RegExp(`^${NAME_PATTERN}`, 'u');

/**
 * Index of the `#` that starts the comment of a line, ignoring `#` inside
 * string literals (`"..."` / `'...'` / `「...」`, Issue #1709).
 * @param {string} line - The source line.
 * @returns {number} Index of the comment `#`, or `line.length` when none.
 */
const commentStart = (line) => {
    const idx = commentIndex(line);
    return idx === -1 ? line.length : idx;
};

/**
 * Indices of every `//` outside string literals (「...」 too) and before any
 * `#` comment.
 * @param {string} line - The source line.
 * @returns {Array<number>} Index of the first `/` of each `//`.
 */
const slashIndices = (line) => {
    const result = [];
    const end = commentStart(line);
    let i = 0;
    while (i < end) {
        const stringEnd = stringEndAt(line, i);
        if (stringEnd !== -1) {
            i = stringEnd;
            continue;
        }
        if (line[i] === '/' && line[i + 1] === '/') {
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
const withoutStrings = (line) => {
    let out = '';
    let i = 0;
    while (i < line.length) {
        const end = stringEndAt(line, i);
        if (end !== -1) {
            i = end;
            out += ' ';
            continue;
        }
        out += line[i];
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
const collectNames = (source) => {
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
const bracketDepth = (line) => {
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
    const m = rest.match(LEADING_NAME_RE);
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
 * The reader only joins such lines while the line number is still
 * there, so they have to be joined before the number is removed. A `⎿` on
 * a continuation line closes a block after the statement, so it replaces
 * the innermost `｜` of the joined line (`  ⎿ 表示する(...)`).
 * @param {Array<string>} lines - Source lines (line numbers not removed yet).
 * @returns {Array<string>} The lines with wrapped statements joined.
 */
const joinContinuationLines = (lines) => {
    const result = [];
    let i = 0;
    while (i < lines.length) {
        let line = lines[i];
        let closeCount = 0;
        let depth = LINE_NUMBER_RE.test(line) ? bracketDepth(line) : 0;
        // Join only the code; the `# comment`s go to the end of the joined
        // line instead of swallowing the rest of the statement (Issue #1710).
        const comments = [];
        if (depth > 0) {
            const code = codeOfLine(line);
            comments.push(line.substring(code.length).trim());
            line = code;
        }
        while (depth > 0 && i + 1 < lines.length && !LINE_NUMBER_RE.test(lines[i + 1])) {
            i++;
            const m = lines[i].match(/^([\s｜|│⎿└]*)(.*)$/);
            closeCount += (m[1].match(/[⎿└]/g) || []).length;
            const rest = codeOfLine(m[2].trim());
            comments.push(m[2].trim().substring(rest.length).trim());
            if (rest !== '') line = `${line} ${rest}`;
            depth += bracketDepth(rest);
        }
        const comment = comments.filter((c) => c !== '').join(' ');
        if (comment !== '') line = `${line} ${comment}`;
        if (closeCount > 0) {
            const prefix = line.match(LINE_NUMBER_RE)[0];
            const m = line.substring(prefix.length).match(/^([\s｜|│⎿└]*)(.*)$/);
            const markers = m[1].split('');
            for (let k = markers.length - 1; k >= 0 && closeCount > 0; k--) {
                if (markers[k] === '｜' || markers[k] === '|' || markers[k] === '│') {
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
 * Whether every line of the paste has a bare line number (`01 a = 1`), a line that goes on
 * from an open bracket of the line above aside (a wrapped statement).
 * @param {Array<string>} lines - The pasted lines.
 * @returns {boolean} True when the lines are numbered that way.
 */
const isBareNumbered = (lines) => {
    let depth = 0;
    let numbered = 0;
    for (const line of lines) {
        if (depth <= 0) {
            if (line.trim() === '') continue;
            if (!BARE_LABEL_RE.test(line)) return false;
            numbered++;
            depth = 0;
        }
        depth += bracketDepth(line);
    }
    return numbered > 0;
};

/**
 * Write the line numbers of other texts (`( 1 )`, and `01` / `1` when every line has one)
 * as `(1)`, the form the rest of the tidying takes (Issue #1756).
 * @param {Array<string>} lines - The pasted lines.
 * @returns {Array<string>} The lines.
 */
const normalizeLineNumbers = (lines) => {
    const spaced = lines.map((line) =>
        line.replace(SPACED_LABEL_RE, (all, s1, n1, s2, n2) => `${s1 || s2 || ''}(${n1 || n2})`),
    );
    if (!isBareNumbered(spaced)) return spaced;
    let depth = 0;
    return spaced.map((line) => {
        const out = depth <= 0 ? line.replace(BARE_LABEL_RE, (all, space, number) => `${space}(${number})`) : line;
        depth = depth <= 0 ? bracketDepth(line) : depth + bracketDepth(line);
        return out;
    });
};

/** The vertical marks of a line (`｜`, and `|` / `│` as other texts write it). */
const BAR_MARKS = new Set(['｜', '|', '│']);

/**
 * Write an `L` that closes a block (the L shape some texts write with the letter) as `⎿`
 * (Issue #1756). An `L` is the L shape only where a mark can be: right under a vertical mark
 * of the line above, or where the code of the line above starts when that line opens a block
 * (`もし x > 0 ならば:` and `L y = 1`). A variable `L` (`L = 1`, `L を 1 から ...`) is kept.
 * @param {Array<string>} lines - The lines (line numbers removed).
 * @returns {Array<string>} The lines.
 */
const markLShapes = (lines) => {
    let above = null;
    return lines.map((line) => {
        let out = line;
        const m = line.match(/^([\s｜|│⎿└]*)L(\s+)(?!を(?:\s|$)|の間)(\S.*)$/);
        if (m && above !== null) {
            const at = m[1].length;
            const code = codeOfLine(above);
            const opens = /[:：]$/.test(code) && code.match(/^[\s｜|│⎿└]*/)[0].length === at;
            if (BAR_MARKS.has(above[at]) || opens) out = `${m[1]}⎿${m[2]}${m[3]}`;
        }
        if (line.trim() !== '') above = out;
        return out;
    });
};

/** The rules at the start of a line (and the spaces between them) and the code after them. */
const LEADING_RULES_RE = /^([\s｜|│⎿└]*)(.*)$/;

/** One level of the indent the rules are written back as (the standard form, as write-ja does). */
const RULE_INDENT = '    ';

/**
 * Write the rules at the start of the lines (`｜ ⎿ 表示する(x)`, as the copy with line numbers
 * and rules writes them) back as the indent (Issue #2549): each rule is one level of 4 spaces.
 * The indent closes a block only when the line that opens it ends with `:`; a block of the
 * DNCL-like form (`もし a ならば` with no `:`) is closed by its word (`を実行する`) or by a `⎿`.
 * So the rules are written back only when every block they draw closes the same way with the
 * indent: its opening line ends with `:`, or it ends at a `そうでなければ` / `を実行する` line
 * of its level. Otherwise, and when a line without rules is indented (it would be read inside a
 * block), the lines are kept as they are (the reader takes the rules too).
 * @param {Array<string>} lines - The lines (line numbers removed).
 * @returns {Array<string>} The lines.
 */
const rulesToIndent = (lines) => {
    const parsed = lines.map((line) => {
        const [, marks, code] = line.match(LEADING_RULES_RE);
        return { depth: (marks.match(/[｜|│⎿└]/g) || []).length, ends: (marks.match(/[⎿└]/g) || []).length, code };
    });
    if (!parsed.some(({ depth }) => depth > 0)) return lines;
    const opensWithColon = (code) => /[:：]$/.test(codeOfLine(code).trimEnd());
    // The opening line of each open block, from the outside.
    const stack = [];
    let previous = '';
    for (let i = 0; i < lines.length; i++) {
        const { depth, ends, code } = parsed[i];
        if (code === '' || code.startsWith('#')) continue;
        if (depth === 0 && /^\s/.test(lines[i])) return lines;
        if (depth > stack.length + 1) return lines;
        if (depth < stack.length) {
            // A block whose bar stops without an L goes on in a branch or ends at its word. The
            // blocks inside it end where their bars stop, which the indent does only after a `:`.
            if (!BRANCH_PATTERN.test(code) && !CLOSER_PATTERN.test(code)) return lines;
            if (!stack.slice(depth + 1).every(opensWithColon)) return lines;
            stack.length = depth;
        }
        if (depth > stack.length) stack.push(previous);
        if (ends > depth) return lines;
        for (let k = 0; k < ends; k++) {
            if (!opensWithColon(stack.pop())) return lines;
        }
        previous = code;
    }
    if (stack.some((opener) => !opensWithColon(opener))) return lines;
    return parsed.map(({ depth, code }) => (code === '' ? '' : `${RULE_INDENT.repeat(depth)}${code}`));
};

/**
 * Tidy DNCL code pasted into the Japanese (DNCL) mode editor. Only text
 * with line numbers (copied from a 共通テスト sample) is changed: the line
 * numbers are removed, the rules (`｜` / `⎿`) become the indent and `//`
 * comments become `#` comments. Text without
 * line numbers comes back unchanged, `//` included.
 * @param {string} text - The pasted text.
 * @param {string} [context] - The rest of the program (the editor content),
 *   used to tell variable names after `//` from comment text.
 * @returns {string} The tidied text.
 */
const tidyPastedDncl = (text, context = '') => {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = normalizeLineNumbers(text.split(/\r?\n/));
    if (!lines.some((line) => LINE_NUMBER_RE.test(line))) {
        const marked = markLShapes(lines);
        return marked.some((line, i) => line !== lines[i]) ? marked.join(eol) : text;
    }
    const stripped = rulesToIndent(markLShapes(removeLineNumbers(joinContinuationLines(lines))));
    const names = collectNames(`${stripped.join('\n')}\n${context}`);
    return stripped.map((line) => convertSlashComment(line, names)).join(eol);
};

/**
 * Whether a line has a `//` outside string literals and `#` comments. Used
 * to explain a conversion error on such a line: `//` is integer division in
 * Smalruby, so a `//` comment typed or pasted without line numbers fails.
 * @param {string} line - The source line.
 * @returns {boolean} True when the line has a `//`.
 */
const hasDoubleSlash = (line) => slashIndices(line).length > 0;

/**
 * Prefix `hint` to the message of each conversion error whose DNCL line has
 * a `//` (see `hasDoubleSlash`).
 * @param {Array<object>} errors - Errors with a 0-based DNCL `row` and `text`.
 * @param {Array<string>} lines - The DNCL source lines.
 * @param {string} hint - The message telling the user to use `#`.
 * @returns {Array<object>} The errors, with the hint added where it applies.
 */
const withDoubleSlashHint = (errors, lines, hint) =>
    errors.map((err) =>
        err.row >= 0 && err.row < lines.length && hasDoubleSlash(lines[err.row])
            ? { ...err, text: `${hint}\n${err.text}` }
            : err,
    );

/**
 * Rows of `lines` with a `//` that looks like a 共通テスト comment rather than
 * the quotient (`a = 1 // 生徒番号`; see `isDivisionSlash`). Such a line
 * converts — `//` is the quotient — but most likely not into what was meant,
 * so the editor warns there and the check of a 生成AI answer tells the AI to
 * use `#` there. A name the
 * program uses as code elsewhere (`個数 = 2` and `a = 合計 // 個数`) makes the
 * `//` the quotient. (Issue #1711)
 * @param {Array<string>} lines - The DNCL source lines.
 * @returns {Array<number>} The 0-based rows.
 */
const slashCommentRows = (lines) => {
    const names = collectNames(lines.join('\n'));
    const rows = [];
    lines.forEach((line, row) => {
        if (slashIndices(line).some((i) => !isDivisionSlash(line, i, names))) rows.push(row);
    });
    return rows;
};

export { hasDoubleSlash, slashCommentRows, tidyPastedDncl, withDoubleSlashHint };
