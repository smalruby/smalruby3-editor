// === Smalruby: This file is Smalruby-specific (layout of the DNCL problem form: line numbers and rules) ===
/**
 * The problem form of the Japanese mode (docs/dncl/design.md, 2 章, Issue #1755).
 *
 * The text in the editor tells the blocks by the indent only. The problem
 * form is how the 共通テスト questions show the same program: a line number
 * `(01)` on the left of every line, and a vertical rule in the indent of
 * every block that ends with an L on its last line. The editor draws it
 * without changing the text, so the line numbers never have to be numbered
 * again by hand.
 */
import { LEADING_INDENT_RE, indentWidth } from './dncl-indent';

/** The rule on a line in a block that goes on below. */
const BAR = 'bar';
/** The rule on the last line of a block. */
const END = 'end';

/** The characters of the rules when the problem form is written as text. */
const RULE_CHARS = { [BAR]: '｜', [END]: '⎿' };

/** How the lines are split, as the reader does. */
const LINE_BREAK = /\r?\n/;

/** The lines that go on to another branch of the same if. */
const BRANCH_PATTERN = /^[ \t\u3000]*(?:そうでなくもし|そうでなければ)/;

/** The closing lines of the DNCL-like form (`を実行する` / `を繰り返す` / `と定義する`). */
const CLOSER_PATTERN = /^[ \t\u3000]*(?:を実行する|を繰り返す|と定義する)[ \t\u3000]*(?:#.*)?$/;

/** A line with only a comment: it does not open or close a block, as for the reader. */
const COMMENT_PATTERN = /^[ \t\u3000]*#/;

/**
 * The number of lines that get a line number: the empty line after the
 * last newline does not count, so the editor and the copy pad the numbers
 * to the same width.
 * @param {string} code - The DNCL text.
 * @returns {number} The number of numbered lines.
 */
const numberedLineCount = (code) => {
    const lines = code.split(LINE_BREAK);
    return lines.length > 1 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
};

/**
 * The label of a line number in the problem form: `(01)`. Newer questions
 * pad the number to 2 digits; a program of 100 lines or more pads to 3 so
 * that the labels line up.
 * @param {number} lineNumber - 1-based line number.
 * @param {number} lineCount - The number of numbered lines of the program.
 * @returns {string} The label.
 */
const problemFormLabel = (lineNumber, lineCount) => {
    const width = Math.max(2, String(lineCount).length);
    return `(${String(lineNumber).padStart(width, '0')})`;
};

/**
 * The width of the indent of a line, or null for a line that does not take
 * part in the blocks: a blank line or a line with only a comment (the reader
 * does not open or close a block there either).
 * @param {string} line - A line of the text.
 * @returns {?number} The width.
 */
const blockIndentWidth = (line) => {
    const indent = line.match(LEADING_INDENT_RE)[0];
    if (indent.length === line.length || COMMENT_PATTERN.test(line)) return null;
    return indentWidth(indent);
};

/**
 * The blocks each line of the text is in, from the indent. Any width of
 * indent is taken (4 spaces in the standard form, 2 in the text from Ruby).
 * @param {Array<?number>} widths - The indent width of each line (null when
 *   the line takes no part in the blocks).
 * @returns {Array<?Array<{id: number, column: number}>>} For each line that
 *   takes part, the blocks from the outside: the id of the block and the
 *   column of its header (where its rule is drawn).
 */
const blocksOfLines = (widths) => {
    // The open blocks, from the outside; the first is the top level. A block
    // has the indent of its header (where its rule is drawn) and of its body.
    const stack = [{ id: 0, header: -1, body: 0 }];
    let nextId = 1;
    return widths.map((width) => {
        if (width === null) return null;
        // As the reader does, a line stays in a block while it is indented
        // deeper than the header of the block, even when it is not as deep
        // as the body.
        while (stack.length > 1 && width <= stack[stack.length - 1].header) stack.pop();
        const top = stack[stack.length - 1];
        if (width > top.body) stack.push({ id: nextId++, header: top.body, body: width });
        return stack.slice(1).map((block) => ({ id: block.id, column: block.header }));
    });
};

/**
 * Lay out the problem form of a DNCL text: the label of each line and the
 * rules to draw in its indent.
 *
 * A line in k blocks gets k rules, at the column of the header of each
 * block. The rule of a block is an L on its last line and a bar on the
 * others. A block followed, at the level of its header, by a line that
 * still belongs to it keeps its bar to the end:
 *   - `そうでなくもし` / `そうでなければ`: only the last branch of an if
 *     ends with an L.
 *   - the closing word of the DNCL-like form (`を実行する` ...): the word
 *     itself ends the block, so the bar stops before it and the closing line
 *     has no rule of the block. An L there would end the block twice, and the
 *     copy read back would close one block too many.
 * A blank line or a line with only a comment gets the bars of the blocks
 * that go on across it.
 * @param {string} code - The DNCL text in the editor.
 * @returns {Array<{lineNumber: number, label: string, indent: number,
 *   rules: Array<{column: number, kind: string}>}>} One entry per line;
 *   `indent` is the number of blocks the line is in.
 */
const layoutProblemForm = (code) => {
    const lines = code.split(LINE_BREAK);
    const lineCount = numberedLineCount(code);
    const blocks = blocksOfLines(lines.map(blockIndentWidth));
    // The next line that takes part in the blocks, after each line.
    const nextLine = new Array(lines.length).fill(-1);
    for (let i = lines.length - 2; i >= 0; i--) {
        nextLine[i] = blocks[i + 1] === null ? nextLine[i + 1] : i + 1;
    }
    const previousBlocks = [];
    let last = [];
    for (let i = 0; i < lines.length; i++) {
        previousBlocks.push(last);
        if (blocks[i] !== null) last = blocks[i];
    }

    return lines.map((line, i) => {
        const next = nextLine[i];
        const nextBlocks = next === -1 ? [] : blocks[next];
        const nextIds = new Set(nextBlocks.map((block) => block.id));
        let rules;
        if (blocks[i] === null) {
            rules = previousBlocks[i]
                .filter((block) => nextIds.has(block.id))
                .map((block) => ({ column: block.column, kind: BAR }));
        } else {
            const nextContinues =
                next !== -1 && (BRANCH_PATTERN.test(lines[next]) || CLOSER_PATTERN.test(lines[next]));
            rules = blocks[i].map((block, level) => {
                const goesOn = nextIds.has(block.id) || (nextContinues && nextBlocks.length === level);
                return { column: block.column, kind: goesOn ? BAR : END };
            });
        }
        return {
            lineNumber: i + 1,
            label: problemFormLabel(i + 1, lineCount),
            indent: rules.length,
            rules,
        };
    });
};

/**
 * The problem form written as text, for copying: the label, a space and the
 * rules (each followed by a space) in front of the line without its indent
 * and without the spaces at its end. A blank line keeps its number and the
 * bars. A text that ends with a newline keeps it (the empty last line gets no
 * number); CRLF stays CRLF.
 * @param {string} code - The DNCL text in the editor.
 * @returns {string} The text of the problem form.
 */
const problemFormText = (code) => {
    const eol = code.includes('\r\n') ? '\r\n' : '\n';
    const lines = code.split(LINE_BREAK);
    const count = numberedLineCount(code);
    const body = lines.slice(0, count).join('\n');
    const text = layoutProblemForm(body)
        .map(({ label, rules }, i) => {
            const marks = rules.map((rule) => RULE_CHARS[rule.kind]);
            const rest = lines[i].replace(LEADING_INDENT_RE, '').replace(/[ \t\u3000]+$/, '');
            return [label, ...marks, rest].filter((part) => part !== '').join(' ');
        })
        .join(eol);
    return count < lines.length ? `${text}${eol}` : text;
};

export { BAR, END, layoutProblemForm, numberedLineCount, problemFormLabel, problemFormText };
