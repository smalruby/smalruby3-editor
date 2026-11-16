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

/** The rule on a line in a block that goes on below. */
const BAR = 'bar';
/** The rule on the last line of a block. */
const END = 'end';

/** The characters of the rules when the problem form is written as text. */
const RULE_CHARS = { [BAR]: '｜', [END]: '⎿' };

/** The lines that go on to another branch of the same if. */
const BRANCH_PATTERN = /^[ \t\u3000]*(?:そうでなくもし|そうでなければ)/;

/**
 * The label of a line number in the problem form: `(01)`. Newer questions
 * pad the number to 2 digits; a program of 100 lines or more pads to 3 so
 * that the labels line up.
 * @param {number} lineNumber - 1-based line number.
 * @param {number} lineCount - The number of lines of the program.
 * @returns {string} The label.
 */
const problemFormLabel = (lineNumber, lineCount) => {
    const width = Math.max(2, String(lineCount).length);
    return `(${String(lineNumber).padStart(width, '0')})`;
};

/**
 * The width of the indent of a line, or null for a blank line. A tab counts
 * as 4 spaces, a full-width space as 2 (it takes 2 columns).
 * @param {string} line - A line of the text.
 * @returns {?number} The width.
 */
const indentWidth = (line) => {
    const match = line.match(/^[ \t\u3000]*/)[0];
    if (match.length === line.length) return null;
    let width = 0;
    for (const ch of match) width += ch === '\t' ? 4 : ch === '\u3000' ? 2 : 1;
    return width;
};

/**
 * The blocks each line of the text is in, from the indent. Any width of
 * indent is taken (4 spaces in the standard form, 2 in the text from Ruby).
 * @param {Array<?number>} widths - The indent width of each line (null when blank).
 * @returns {Array<?Array<{id: number, column: number}>>} For each non-blank
 *   line, the blocks from the outside: the id of the block and the column of
 *   its header (where its rule is drawn).
 */
const blocksOfLines = (widths) => {
    // The open indents, from the outside; the first is the top level.
    const stack = [{ id: 0, width: 0 }];
    let nextId = 1;
    return widths.map((width) => {
        if (width === null) return null;
        while (stack.length > 1 && stack[stack.length - 1].width > width) stack.pop();
        if (width > stack[stack.length - 1].width) stack.push({ id: nextId++, width });
        return stack.slice(1).map((block, i) => ({ id: block.id, column: stack[i].width }));
    });
};

/**
 * Lay out the problem form of a DNCL text: the label of each line and the
 * rules to draw in its indent.
 *
 * A line in k blocks gets k rules, at the column of the header of each
 * block. The rule of a block is an L on its last line and a bar on the
 * others. Only the last branch of an if ends with an L: when the next line
 * is `そうでなくもし` / `そうでなければ` at the level of the header, the
 * branch above keeps its bar. A blank line gets the bars of the blocks that
 * go on across it.
 * @param {string} code - The DNCL text in the editor.
 * @returns {Array<{lineNumber: number, label: string, indent: number,
 *   rules: Array<{column: number, kind: string}>}>} One entry per line;
 *   `indent` is the number of blocks the line is in.
 */
const layoutProblemForm = (code) => {
    const lines = code.split('\n');
    const widths = lines.map(indentWidth);
    const blocks = blocksOfLines(widths);
    // The next non-blank line after each line.
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
            // A blank line is in the blocks that go on across it.
            rules = previousBlocks[i]
                .filter((block) => nextIds.has(block.id))
                .map((block) => ({ column: block.column, kind: BAR }));
        } else {
            const nextIsBranch = next !== -1 && BRANCH_PATTERN.test(lines[next]);
            rules = blocks[i].map((block, level) => {
                const goesOn = nextIds.has(block.id) || (nextIsBranch && nextBlocks.length === level);
                return { column: block.column, kind: goesOn ? BAR : END };
            });
        }
        return {
            lineNumber: i + 1,
            label: problemFormLabel(i + 1, lines.length),
            indent: rules.length,
            rules,
        };
    });
};

/**
 * The problem form written as text, for copying: the label, a space and the
 * rules (each followed by a space) in front of the line without its indent.
 * A blank line keeps its number and the bars. A text that ends with a
 * newline keeps it (the empty last line gets no number).
 * @param {string} code - The DNCL text in the editor.
 * @returns {string} The text of the problem form.
 */
const problemFormText = (code) => {
    const endsWithNewline = code.endsWith('\n');
    const body = endsWithNewline ? code.slice(0, -1) : code;
    const lines = body.split('\n');
    const text = layoutProblemForm(body)
        .map(({ label, rules }, i) => {
            const marks = rules.map((rule) => RULE_CHARS[rule.kind]);
            const rest = lines[i].replace(/^[ \t\u3000]+/, '');
            return [label, ...marks, rest].filter((part) => part !== '').join(' ');
        })
        .join('\n');
    return endsWithNewline ? `${text}\n` : text;
};

export { BAR, END, layoutProblemForm, problemFormLabel, problemFormText };
