// SPDX-License-Identifier: MIT
// ja-notation: read the Japanese into a JaAST (./ja-ast.js). See ../LICENSE.
//
// Both forms are read, into the same JaAST:
// - the standard form (the form of the 共通テスト用プログラム表記): line
//   numbers, `｜` / `⎿` or indentation, `ならば:`, `=`, `and` / `or` / `not`;
// - the DNCL-like form: an opening line without `:` and a line of its own that
//   closes the block (`を実行する` / `を繰り返す` / `と定義する`), `←`,
//   `かつ` / `または`, a `でない` after what it negates, 「...」 and `X を返す`.
// The two may be mixed: a block opened with `:` ends where the indentation
// ends, one opened without `:` ends at its closing line (or a `⎿`).
import { tokenize } from './lexer.js';
import { run } from './run.js';
import { readSettings } from './settings.js';

/** The label of a numbered line: `(1)`, `(01)` and `(00-1)` (a line put before `(01)`). */
const LABEL_RE = /^\(\d+(?:-\d+)*\)/;

/**
 * The part before the code of a line: spaces and the `｜` / `⎿` marks. The marks are
 * also read as `|` / `│` and `└`, how they look in other texts (docs/dncl/policy.md:
 * 見た目だけの揺れ; Issue #1756).
 */
const PREFIX_RE = /^[\s｜|│⎿└]*/;

/** The marks of the left of a line. */
const MARKS_RE = /[｜|│⎿└]/g;

/** The spaces after the last mark of a line. */
const AFTER_MARKS_RE = /[^｜|│⎿└]*$/;

/** The marks that close a block (the L shape). */
const CLOSE_MARKS = new Set(['⎿', '└']);

/**
 * How wide one `｜` / `⎿` mark is. More than any run of spaces, so a line with
 * more marks is always deeper; the spaces after the last mark only compare
 * lines with the same marks.
 */
const MARK_WIDTH = 1000;

/** Words that close a block in the DNCL-like form (a line of their own). */
const CLOSERS = new Set(['を実行する', 'を繰り返す', 'と定義する']);

/** The words of `and` / `or` (the DNCL-like form writes `かつ` / `または`). */
const AND_WORDS = new Set(['and', 'かつ']);
const OR_WORDS = new Set(['or', 'または']);

/** The `not` written after what it negates, in the DNCL-like form. */
const POSTFIX_NOT = 'でない';

/**
 * The operators that go on after a `でない` with the negation as their left
 * side (`a でない == b` is `(not a) == b`, as Ruby reads `!a == b`).
 */
const AFTER_NEGATION = new Set(['==', '!=', '<', '<=', '>', '>=', '+', '-', '*', '/', '÷', '%']);

/**
 * Words of a closing line. `end` (Ruby) is taken too in a block opened without
 * `:`, as the current conversion takes it.
 */
const END_WORD = 'end';

/** The word that ends `A に 値 を追加する` (an element added at the end of an array). */
const APPEND_WORD = 'を追加する';

/** The comparison operators. */
const COMPARISONS = new Set(['==', '!=', '<', '<=', '>', '>=']);

/** The operators of assignments that change a variable (`i += 1`). */
const OP_ASSIGNS = { '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%' };

/** Names that are a part of the statement around an expression, never a value in it. */
const STOP_NAMES = new Set([
    'を',
    'から',
    'まで',
    'ならば',
    'なら',
    'の間',
    'の間繰り返す',
    'を返す',
    APPEND_WORD,
    'and',
    'or',
    'not',
    'かつ',
    'または',
    POSTFIX_NOT,
]);

/**
 * An error of the reading.
 * @param {string} code - What kind of error it is (`syntax`, `unclosed`, ...).
 * @param {string} message - The message, in Japanese.
 * @param {number} line - The line (1-based).
 * @param {number} column - The column (0-based).
 * @param {object} [detail] - What a caller may need to say the error in its own
 *   words: `name` (the token), `opener` / `direction` / `colon` / `word` (the
 *   block of a block error), `block` (`stray-closer`, `closer-indent`,
 *   `closer-kind`, `stray-branch`, `indent`), `expected` (the closing word of the block
 *   of a `closer-kind`) and `branch`.
 * @returns {object} The error.
 */
const makeError = (code, message, line, column = 0, detail = {}) => ({ code, message, line, column, ...detail });

/** Thrown inside the reading of one line, caught at the line. */
class LineError extends Error {
    /**
     * @param {object} error - The error made by `makeError`.
     */
    constructor(error) {
        super(error.message);
        this.error = error;
    }
}

/**
 * The width of an indent: a tab is 4 columns and the full-width space 2.
 * @param {string} text - The indent.
 * @returns {number} Its width.
 */
const indentWidth = (text) => {
    let width = 0;
    for (const ch of text) width += ch === '\t' ? 4 : ch === '　' ? 2 : 1;
    return width;
};

/**
 * How many spaces after each line number separate it from the code; the rest
 * is the indent of the code. Two ways of writing are found: the code starts at
 * the same column on every line (`(9)  x` / `(10) x`), or one space after every
 * label (`(00-1) a` / `(01) b`). When the least indented line of each label
 * length starts its code at one column, the numbers are aligned on it;
 * otherwise the least whitespace is the separator.
 * @param {Array<{label: string, space: number}>} numbered - Numbered lines with code.
 * @returns {function(string): number} The separator after a label.
 */
const makeSeparator = (numbered) => {
    const least = new Map();
    numbered.forEach(({ label, space }) => {
        if (!least.has(label.length) || space < least.get(label.length)) least.set(label.length, space);
    });
    if (least.size === 0) return () => 0;
    const columns = new Set(Array.from(least, ([length, space]) => length + space));
    if (least.size > 1 && columns.size === 1) {
        const column = columns.values().next().value;
        return (label) => Math.max(0, column - label.length);
    }
    const separator = Math.min(...least.values());
    return () => separator;
};

/**
 * The bracket depth a list of tokens leaves open.
 * @param {Array<object>} tokens - The tokens.
 * @returns {number} Opened minus closed brackets.
 */
const openBrackets = (tokens) =>
    tokens.reduce((depth, t) => {
        if (t.type !== 'op') return depth;
        if (t.value === '(' || t.value === '[') return depth + 1;
        if (t.value === ')' || t.value === ']') return depth - 1;
        return depth;
    }, 0);

/**
 * Split the source into logical lines: the line number and the marks are taken
 * off, and a numbered line whose brackets are still open goes on over the
 * unnumbered lines after it (as long statements are wrapped in the examples).
 * @param {string} source - The Japanese source.
 * @param {string} commentMarker - The comment mark of the settings.
 * @returns {Array<object>} `{line, endLine, tokens, comment, width, marks, closeCount, blank}`.
 */
const readLines = (source, commentMarker) => {
    const raw = source.split('\n');
    const labels = raw.map((text) => {
        const m = text.match(LABEL_RE);
        return m ? m[0] : null;
    });
    const numbered = [];
    raw.forEach((text, i) => {
        if (!labels[i]) return;
        const after = text.substring(labels[i].length);
        const space = after.match(/^\s*/)[0].length;
        if (space < after.length) numbered.push({ label: labels[i], space });
    });
    const separator = makeSeparator(numbered);

    const split = (text, i) => {
        let rest = text;
        let offset = 0;
        if (labels[i]) {
            const after = text.substring(labels[i].length);
            const space = after.match(/^\s*/)[0].length;
            offset = labels[i].length + Math.min(space, separator(labels[i]));
            rest = text.substring(offset);
        }
        const prefix = rest.match(PREFIX_RE)[0];
        const marks = prefix.match(MARKS_RE) || [];
        const afterMarks = prefix.match(AFTER_MARKS_RE)[0];
        const width = marks.length === 0 ? indentWidth(prefix) : marks.length * MARK_WIDTH + indentWidth(afterMarks);
        const tokens = tokenize(rest.substring(prefix.length), offset + prefix.length, commentMarker).map((t) => ({
            ...t,
            line: i + 1,
        }));
        return { tokens, width, marks: marks.length, closeCount: marks.filter((c) => CLOSE_MARKS.has(c)).length };
    };

    const lines = [];
    let i = 0;
    while (i < raw.length) {
        const first = split(raw[i], i);
        const entry = { line: i + 1, endLine: i + 1, ...first, comment: null };
        const comments = [];
        const takeComment = (tokens) => {
            const last = tokens[tokens.length - 1];
            if (last && last.type === 'comment') {
                comments.push(last.text);
                return tokens.slice(0, -1);
            }
            return tokens;
        };
        entry.tokens = takeComment(entry.tokens);
        let depth = labels[i] ? openBrackets(entry.tokens) : 0;
        while (depth > 0 && i + 1 < raw.length && !labels[i + 1]) {
            i++;
            const more = split(raw[i], i);
            entry.closeCount += more.closeCount;
            const tokens = takeComment(more.tokens);
            entry.tokens = entry.tokens.concat(tokens);
            entry.endLine = i + 1;
            depth += openBrackets(tokens);
        }
        if (comments.length > 0) entry.comment = comments.join(' ');
        entry.blank = entry.tokens.length === 0 && entry.comment === null;
        lines.push(entry);
        i++;
    }
    return lines;
};

/**
 * The comment lines at the top of the source, before its first line of code
 * (with `#` or `//`, whatever the comment mark is: they say what it is).
 * @param {string} source - The Japanese source.
 * @returns {Array<string>} The comments.
 */
const headerComments = (source) => {
    const comments = [];
    for (const raw of source.split('\n')) {
        const label = raw.match(LABEL_RE);
        const rest = raw.substring(label ? label[0].length : 0);
        const text = rest.substring(rest.match(PREFIX_RE)[0].length).trimEnd();
        if (text === '') continue;
        if (!text.startsWith('#') && !text.startsWith('//')) break;
        comments.push(text);
    }
    return comments;
};

/**
 * Reads an expression from tokens (recursive descent, lowest precedence first).
 * The readings are generators run by `run` (./run.js), so an expression nested
 * thousands deep (parentheses, signs, calls) does not run out of the call stack.
 */
class ExpressionReader {
    /**
     * @param {Array<object>} tokens - The tokens of the expression.
     * @param {number} line - The line, for errors at the end of the tokens.
     */
    constructor(tokens, line) {
        this.tokens = tokens;
        this.pos = 0;
        this.line = line;
        // A value already read (a negation) that the next primary is.
        this.pending = null;
    }

    /**
     * The token at the position, or undefined at the end.
     * @param {number} [ahead] - How far after the position.
     * @returns {object|undefined} The token.
     */
    peek(ahead = 0) {
        return this.tokens[this.pos + ahead];
    }

    /**
     * Whether the token at the position is the operator.
     * @param {string} value - The operator.
     * @returns {boolean} True if it is.
     */
    isOp(value) {
        const t = this.peek();
        return Boolean(t) && t.type === 'op' && t.value === value;
    }

    /**
     * Whether the token at the position is the name.
     * @param {string} name - The name.
     * @returns {boolean} True if it is.
     */
    isName(name) {
        const t = this.peek();
        return Boolean(t) && t.type === 'name' && t.text === name;
    }

    /**
     * Throw an error at a token (or at the end).
     * @param {object|undefined} token - The token.
     * @param {string} message - The message.
     */
    fail(token, message) {
        // A name right after a number (`2倍`) is not read as a product (Issue #1752): the
        // student is told to write the operator between them.
        const before = token ? this.tokens[this.tokens.indexOf(token) - 1] : null;
        const words =
            token &&
            token.type === 'name' &&
            before &&
            before.type === 'number' &&
            before.column + before.text.length === token.column
                ? `「${before.text}${token.text}」は読めません。数と名前の間には、「${before.text} * ${token.text}」のように演算子を書いてください`
                : message;
        throw new LineError(makeError('syntax', words, token ? token.line : this.line, token ? token.column : 0));
    }

    /**
     * Take the operator, or fail.
     * @param {string} value - The operator.
     * @returns {object} The token.
     */
    expectOp(value) {
        if (!this.isOp(value)) this.fail(this.peek(), `「${value}」が要ります`);
        return this.tokens[this.pos++];
    }

    /**
     * Read the whole tokens as one expression.
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readAll() {
        const expression = yield this.readExpression();
        if (this.pos < this.tokens.length) this.fail(this.peek(), `「${this.peek().text}」が読めません`);
        return expression;
    }

    /**
     * An expression: a range (`1..10`) or anything with a weaker operator.
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readExpression() {
        const left = yield this.readOr();
        if (this.isOp('..') || this.isOp('...')) {
            const op = this.tokens[this.pos++];
            const right = yield this.readOr();
            return this.binary(op, left, right);
        }
        return left;
    }

    /**
     * Whether the token at the position is one of the names.
     * @param {Set<string>} names - The names.
     * @returns {boolean} True if it is.
     */
    isNameIn(names) {
        const t = this.peek();
        return Boolean(t) && t.type === 'name' && names.has(t.text);
    }

    /**
     * A binary node at the operator token.
     * @param {object} op - The operator token.
     * @param {object} left - The left side.
     * @param {object} right - The right side.
     * @returns {object} The node.
     */
    binary(op, left, right) {
        return {
            type: 'Binary',
            operator: op.type === 'op' ? op.value : op.text,
            left,
            right,
            line: left.line,
            column: left.column,
        };
    }

    /**
     * `or` (`または`).
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readOr() {
        let left = yield this.readAnd();
        while (this.isNameIn(OR_WORDS)) {
            const op = this.tokens[this.pos++];
            left = { ...this.binary(op, left, yield this.readAnd()), operator: 'or' };
        }
        return left;
    }

    /**
     * `and` (`かつ`).
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readAnd() {
        let left = yield this.readNegated();
        while (this.isNameIn(AND_WORDS)) {
            const op = this.tokens[this.pos++];
            left = { ...this.binary(op, left, yield this.readNegated()), operator: 'and' };
        }
        return left;
    }

    /**
     * A `でない` after what it negates: it takes all before it up to the
     * nearest `かつ` / `または` (`a > 10 でない` is `not (a > 10)`), as `not`
     * does after it.
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readNegated() {
        let operand = yield this.readNot();
        while (this.isName(POSTFIX_NOT)) {
            this.pos++;
            const negated = { type: 'Unary', operator: 'not', operand, line: operand.line, column: operand.column };
            const next = this.peek();
            if (next && next.type === 'op' && AFTER_NEGATION.has(next.value)) {
                this.pending = negated;
                operand = yield this.readNot();
            } else {
                operand = negated;
            }
        }
        return operand;
    }

    /**
     * `not`, weaker than a comparison and stronger than `and` / `or`.
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readNot() {
        if (!this.pending && this.isName('not')) {
            const op = this.tokens[this.pos++];
            const operand = yield this.readNot();
            return { type: 'Unary', operator: 'not', operand, line: op.line, column: op.column };
        }
        return yield this.readComparison();
    }

    /**
     * A comparison.
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readComparison() {
        const left = yield this.readAdditive();
        const t = this.peek();
        if (t && t.type === 'op' && COMPARISONS.has(t.value)) {
            this.pos++;
            return this.binary(t, left, yield this.readAdditive());
        }
        return left;
    }

    /**
     * `+` / `-`.
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readAdditive() {
        let left = yield this.readMultiplicative();
        while (this.isOp('+') || this.isOp('-')) {
            const op = this.tokens[this.pos++];
            left = this.binary(op, left, yield this.readMultiplicative());
        }
        return left;
    }

    /**
     * `*` / `/` / `÷` (and `//`) / `%`.
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readMultiplicative() {
        let left = yield this.readUnary();
        while (this.isOp('*') || this.isOp('/') || this.isOp('÷') || this.isOp('%')) {
            const op = this.tokens[this.pos++];
            left = this.binary(op, left, yield this.readUnary());
        }
        return left;
    }

    /**
     * A sign before a value.
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readUnary() {
        if (!this.pending && (this.isOp('-') || this.isOp('+'))) {
            const op = this.tokens[this.pos++];
            const operand = yield this.readUnary();
            return { type: 'Unary', operator: op.value, operand, line: op.line, column: op.column };
        }
        return yield this.readPostfix();
    }

    /**
     * A value and the indexes after it (`A[i]`, `A[i][j]`).
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readPostfix() {
        let value = yield this.readPrimary();
        while (this.isOp('[')) {
            this.pos++;
            const index = yield this.readExpression();
            this.expectOp(']');
            value = { type: 'Index', target: value, index, line: value.line, column: value.column };
        }
        return value;
    }

    /**
     * The arguments of a call, after its `(`, up to its `)`.
     * @yields {object} The readings of its parts (./run.js).
     * @returns {Array<object>} The arguments.
     */
    *readArguments() {
        const args = [];
        if (this.isOp(')')) {
            this.pos++;
            return args;
        }
        for (;;) {
            args.push(yield this.readExpression());
            if (this.isOp(',')) {
                this.pos++;
                continue;
            }
            this.expectOp(')');
            return args;
        }
    }

    /**
     * A value: a number, string, name, call, `( ... )` or `[ ... ]`.
     * @yields {object} The readings of its parts (./run.js).
     * @returns {object} The expression.
     */
    *readPrimary() {
        if (this.pending) {
            const value = this.pending;
            this.pending = null;
            return value;
        }
        const t = this.peek();
        if (!t) this.fail(t, '式が要ります');
        const at = { line: t.line, column: t.column };
        if (t.type === 'number') {
            this.pos++;
            return { type: 'Number', value: t.value.replace(/^0+(?=\d)/, ''), ...at };
        }
        if (t.type === 'string') {
            this.pos++;
            return { type: 'String', raw: t.text, ...at };
        }
        if (t.type === 'name' && !STOP_NAMES.has(t.text)) {
            this.pos++;
            if (t.text === '真' || t.text === '偽') return { type: 'Boolean', value: t.text === '真', ...at };
            if (this.isOp('(')) {
                this.pos++;
                return { type: 'Call', name: t.text, args: yield this.readArguments(), ...at };
            }
            return { type: 'Name', name: t.text, ...at };
        }
        if (t.type === 'op' && t.value === '(') {
            this.pos++;
            const inner = yield this.readExpression();
            this.expectOp(')');
            return inner;
        }
        if (t.type === 'op' && t.value === '[') {
            this.pos++;
            const elements = [];
            if (this.isOp(']')) {
                this.pos++;
            } else {
                for (;;) {
                    elements.push(yield this.readExpression());
                    if (this.isOp(',')) {
                        this.pos++;
                        continue;
                    }
                    this.expectOp(']');
                    break;
                }
            }
            return { type: 'ArrayLiteral', elements, ...at };
        }
        return this.fail(t, `「${t.text}」が読めません`);
    }
}

/**
 * Read tokens as one expression.
 * @param {Array<object>} tokens - The tokens.
 * @param {number} line - The line, for an error at the end.
 * @returns {object} The expression.
 */
const readExpression = (tokens, line) => run(new ExpressionReader(tokens, line).readAll());

/**
 * Split tokens at the commas outside brackets.
 * @param {Array<object>} tokens - The tokens.
 * @returns {Array<Array<object>>} The pieces.
 */
const splitAtCommas = (tokens) => {
    const pieces = [[]];
    let depth = 0;
    tokens.forEach((t) => {
        if (t.type === 'op' && (t.value === '(' || t.value === '[')) depth++;
        if (t.type === 'op' && (t.value === ')' || t.value === ']')) depth--;
        if (depth === 0 && t.type === 'op' && t.value === ',') {
            pieces.push([]);
            return;
        }
        pieces[pieces.length - 1].push(t);
    });
    return pieces;
};

/**
 * The index of the first assignment operator outside brackets, or -1.
 * @param {Array<object>} tokens - The tokens.
 * @returns {number} The index.
 */
const assignmentAt = (tokens) => {
    let depth = 0;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type !== 'op') continue;
        if (t.value === '(' || t.value === '[') depth++;
        if (t.value === ')' || t.value === ']') depth--;
        if (depth === 0 && (t.value === '=' || OP_ASSIGNS[t.value])) return i;
    }
    return -1;
};

/**
 * Read the target of an assignment: a name or an index.
 * @param {Array<object>} tokens - The tokens before the `=`.
 * @param {number} line - The line.
 * @returns {object} The target.
 */
const readTarget = (tokens, line) => {
    const target = readExpression(tokens, line);
    if (target.type !== 'Name' && target.type !== 'Index') {
        throw new LineError(makeError('syntax', '代入の左側には変数か配列の要素を書きます', line, tokens[0].column));
    }
    return target;
};

/**
 * Read one assignment (`x = 1`, `A[i] = 2`, `i += 1`, `x = 【整数を入力】`).
 * @param {Array<object>} tokens - The tokens of the assignment.
 * @param {number} at - The index of its operator.
 * @param {number} line - The line.
 * @returns {object} The statement.
 */
const readAssignment = (tokens, at, line) => {
    const target = readTarget(tokens.slice(0, at), line);
    const op = tokens[at];
    const rest = tokens.slice(at + 1);
    const where = { line, column: tokens[0].column };
    if (op.value === '=' && rest.length === 1 && rest[0].type === 'input') {
        return { type: 'Input', target, kind: rest[0].value, ...where };
    }
    const value = readExpression(rest, line);
    if (op.value === '=') return { type: 'Assign', target, value, ...where };
    return { type: 'OpAssign', target, operator: OP_ASSIGNS[op.value], value, ...where };
};

/**
 * Read `A に 値 を追加する` (an element added at the end of the array `A`).
 * @param {Array<object>} tokens - The tokens of the line, `を追加する` last.
 * @param {number} line - The line.
 * @returns {object} The Append statement.
 */
const readAppend = (tokens, line) => {
    const column = tokens[0].column;
    const ni = tokens.findIndex((t) => t.type === 'name' && t.text === 'に');
    if (ni === -1) {
        throw new LineError(makeError('syntax', '「配列 に 値 を追加する」の形で書きます', line, column));
    }
    const target = tokens.slice(0, ni);
    if (target.length !== 1 || target[0].type !== 'name' || STOP_NAMES.has(target[0].text)) {
        throw new LineError(makeError('syntax', '要素を追加できるのは配列の変数だけです', line, column));
    }
    const value = tokens.slice(ni + 1, -1);
    if (value.length === 0) {
        throw new LineError(makeError('syntax', `「${APPEND_WORD}」の前に追加する値を書きます`, line, column));
    }
    return {
        type: 'Append',
        target: { type: 'Name', name: target[0].text, line, column: target[0].column },
        value: readExpression(value, line),
        line,
        column,
    };
};

/**
 * Read a simple statement (not one that opens a block).
 * @param {Array<object>} tokens - The tokens of the line.
 * @param {number} line - The line.
 * @returns {Array<object>} The statements (`a = 0, b = 1` is two).
 */
const readSimple = (tokens, line) => {
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    const where = { line, column: first.column };
    if (first.type === 'name' && first.text === '返す') {
        const value = tokens.length > 1 ? readExpression(tokens.slice(1), line) : null;
        return [{ type: 'Return', value, ...where }];
    }
    // `X を返す` (the DNCL-like form).
    if (tokens.length > 1 && last.type === 'name' && last.text === 'を返す') {
        return [{ type: 'Return', value: readExpression(tokens.slice(0, -1), line), ...where }];
    }
    if (
        first.type === 'name' &&
        first.text === '配列変数' &&
        tokens.length === 3 &&
        tokens[1].type === 'name' &&
        tokens[2].type === 'name' &&
        tokens[2].text === 'を初期化する'
    ) {
        const target = { type: 'Name', name: tokens[1].text, line, column: tokens[1].column };
        const value = { type: 'ArrayLiteral', elements: [], line, column: tokens[1].column };
        return [{ type: 'Assign', target, value, ...where }];
    }
    // `A に 値 を追加する`: an element at the end of an array (Issue #1759).
    if (last.type === 'name' && last.text === APPEND_WORD) return [readAppend(tokens, line)];
    const at = assignmentAt(tokens);
    if (at === -1) return [{ type: 'ExpressionStatement', expression: readExpression(tokens, line), ...where }];
    const pieces = splitAtCommas(tokens);
    if (pieces.length > 1 && pieces.every((piece) => piece.length > 0 && assignmentAt(piece) !== -1)) {
        return pieces.map((piece) => readAssignment(piece, assignmentAt(piece), line));
    }
    const left = splitAtCommas(tokens.slice(0, at));
    if (left.length > 1 && tokens[at].value === '=') {
        const values = splitAtCommas(tokens.slice(at + 1)).map((piece) => readExpression(piece, line));
        return [{ type: 'MultiAssign', targets: left.map((piece) => readTarget(piece, line)), values, ...where }];
    }
    return [readAssignment(tokens, at, line)];
};

/**
 * Whether the token is the name.
 * @param {object|undefined} token - The token.
 * @param {string} name - The name.
 * @returns {boolean} True if it is.
 */
const isName = (token, name) => Boolean(token) && token.type === 'name' && token.text === name;

/**
 * The index of the name outside brackets, from `from`, or -1.
 * @param {Array<object>} tokens - The tokens.
 * @param {string} name - The name.
 * @param {number} from - Where to start.
 * @returns {number} The index.
 */
const nameAt = (tokens, name, from) => {
    let depth = 0;
    for (let i = from; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type === 'op' && (t.value === '(' || t.value === '[')) depth++;
        if (t.type === 'op' && (t.value === ')' || t.value === ']')) depth--;
        if (depth === 0 && isName(t, name)) return i;
    }
    return -1;
};

/**
 * How many tokens at the end make the end of a counting loop
 * (`ずつ増やしながら繰り返す`, written in one or more words), and its direction.
 * @param {Array<object>} tokens - The tokens (the `:` taken off).
 * @returns {?{count: number, direction: string}} The end, or null.
 */
const countingLoopEnd = (tokens) => {
    for (let count = 1; count <= 3 && count <= tokens.length; count++) {
        const words = tokens.slice(tokens.length - count);
        if (!words.every((t) => t.type === 'name')) return null;
        const m = words
            .map((t) => t.text)
            .join('')
            .match(/^ずつ(増や|減ら)しながら(?:繰り返す)?$/);
        if (m) return { count, direction: m[1] === '増や' ? 'up' : 'down' };
    }
    return null;
};

/**
 * Whether a token is a reading comma: `,` (also `，`, read as `,`) or `、`.
 * @param {object} token - The token.
 * @returns {boolean} True when it is one.
 */
const isReadingComma = (token) =>
    Boolean(token) &&
    ((token.type === 'op' && token.value === ',') || (token.type === 'unknown' && token.text === '、'));

/**
 * Whether a token is a word of a block line after which a reading comma may
 * be written: `の間`, `ならば` / `なら`, `そうでなければ` and the end of a
 * counting loop (`ずつ増やしながら`, or `増やしながら` after `ずつ`).
 * @param {object} token - The token.
 * @returns {boolean} True when it is one.
 */
const takesReadingComma = (token) =>
    Boolean(token) &&
    token.type === 'name' &&
    (['の間', 'ならば', 'なら', 'そうでなければ'].includes(token.text) || /(?:増や|減ら)しながら$/.test(token.text));

/**
 * The tokens without the reading commas of the block words, as in
 * `x < 3 の間，繰り返す:`, `ずつ増やしながら、繰り返す:` and `ならば，`: the
 * comma is taken only right after such a word and before `繰り返す`, the
 * `:` or the end of the line, so a comma of a value (`f(a, b)`) stays.
 * Writing gives these lines without the comma.
 * @param {Array<object>} tokens - The tokens of the line.
 * @returns {Array<object>} The tokens (the same array when there is no such comma).
 */
const withoutReadingCommas = (tokens) => {
    const dropped = tokens.filter((t, i) => {
        if (!isReadingComma(t) || !takesReadingComma(tokens[i - 1])) return true;
        const next = tokens[i + 1];
        const endsHere = !next || (next.type === 'op' && next.value === ':') || isName(next, '繰り返す');
        return !endsHere;
    });
    return dropped.length === tokens.length ? tokens : dropped;
};

/**
 * Read a line that opens, continues or closes a block, or null when it is not
 * one. `colon` says the line ends with `:` (the standard form): its block ends
 * where the indentation ends. Without it (the DNCL-like form) the block ends
 * at a closing line.
 * @param {Array<object>} tokens - The tokens of the line.
 * @param {number} line - The line.
 * @returns {?object} `{kind: 'open' | 'elsif' | 'else' | 'close', colon, node?, condition?}` or null.
 */
const readBlockLine = (tokens, line) => {
    const last = tokens[tokens.length - 1];
    const colon = last.type === 'op' && last.value === ':';
    const body = colon ? tokens.slice(0, -1) : tokens;
    const first = body[0];
    const where = { line, column: first ? first.column : 0 };
    if (!first) return null;
    const tail = body[body.length - 1];

    if (isName(first, 'もし') || isName(first, 'そうでなくもし')) {
        if (!isName(tail, 'ならば') && !isName(tail, 'なら')) {
            throw new LineError(makeError('syntax', '「もし」の後に「ならば」が要ります', line, where.column));
        }
        const condition = readExpression(body.slice(1, -1), line);
        if (first.text === 'そうでなくもし') return { kind: 'elsif', colon, condition, line };
        return {
            kind: 'open',
            colon,
            node: { type: 'If', branches: [{ condition, body: [], line }], elseBody: null, elseLine: null, ...where },
        };
    }
    if (isName(first, 'そうでなければ') && body.length === 1) {
        return { kind: 'else', colon, line };
    }
    if (body.length === 1 && first.type === 'name' && (CLOSERS.has(first.text) || first.text === END_WORD)) {
        return { kind: 'close', colon, word: first.text, line };
    }
    // A counting loop: `i を 1 から 10 まで 1 ずつ増やしながら繰り返す:`.
    const end = isName(body[1], 'を') && first.type === 'name' ? countingLoopEnd(body) : null;
    if (end) {
        const from = nameAt(body, 'から', 2);
        const to = from === -1 ? -1 : nameAt(body, 'まで', from + 1);
        if (to === -1) throw new LineError(makeError('syntax', '「から」「まで」が要ります', line, where.column));
        return {
            kind: 'open',
            colon,
            node: {
                type: 'For',
                variable: { type: 'Name', name: first.text, line, column: first.column },
                from: readExpression(body.slice(2, from), line),
                to: readExpression(body.slice(from + 1, to), line),
                step: readExpression(body.slice(to + 1, body.length - end.count), line),
                direction: end.direction,
                body: [],
                ...where,
            },
        };
    }
    // A loop with a condition: `x > 1 の間繰り返す:` (also `の間:` and `の間 繰り返す:`).
    let whileWords = 0;
    if (isName(tail, 'の間繰り返す') || isName(tail, 'の間')) whileWords = 1;
    else if (isName(tail, '繰り返す') && isName(body[body.length - 2], 'の間')) whileWords = 2;
    if (whileWords > 0 && body.length > whileWords) {
        const condition = readExpression(body.slice(0, body.length - whileWords), line);
        return { kind: 'open', colon, node: { type: 'While', condition, body: [], ...where } };
    }
    // A function: `関数 名前(a, b):` or `名前(a, b) を定義する:`.
    const define = isName(tail, 'を定義する') && body.length > 1;
    const head = isName(first, '関数') ? body.slice(1) : define ? body.slice(0, -1) : null;
    if (head && head[0] && head[0].type === 'name' && head[1] && head[1].type === 'op' && head[1].value === '(') {
        const close = head[head.length - 1];
        if (close.type !== 'op' || close.value !== ')') {
            throw new LineError(makeError('syntax', '関数の引数の「)」が要ります', line, where.column));
        }
        const params = splitAtCommas(head.slice(2, -1))
            .filter((piece) => piece.length > 0)
            .map((piece) => {
                if (piece.length !== 1 || piece[0].type !== 'name') {
                    throw new LineError(makeError('syntax', '関数の引数には名前を書きます', line, piece[0].column));
                }
                return piece[0].text;
            });
        return {
            kind: 'open',
            colon,
            node: { type: 'FunctionDef', name: head[0].text, params, body: [], ...where },
        };
    }
    return null;
};

/**
 * The first token of the line that marks something this reading does not take
 * (`@` / `$`, a Ruby number, an unknown character), as an error.
 * @param {Array<object>} tokens - The tokens of the line.
 * @returns {?object} The error, or null.
 */
const tokenError = (tokens) => {
    const [first, second] = tokens;
    // A loop that checks its condition after the body (Ruby `begin ... end while`,
    // DNCL `繰り返し、... を ... になるまで実行する`) is not in the Japanese.
    const postTest =
        (isName(first, 'begin') && tokens.length === 1) ||
        (isName(first, 'end') && (isName(second, 'while') || isName(second, 'until'))) ||
        isName(first, '繰り返し');
    if (postTest) {
        return makeError(
            'post-test-loop',
            '後判定の繰り返しは日本語では書けません。最初の 1 回をループの前に書いてから「〜の間繰り返す」にしてください',
            first.line,
            first.column,
        );
    }
    for (const t of tokens) {
        const at = (code, message) => makeError(code, message, t.line, t.column);
        if (t.type === 'forbidden') {
            return { ...at('forbidden', `日本語モードでは変数に「${t.text}」は使えません`), name: t.text };
        }
        if (t.type === 'badNumber') {
            return { ...at('bad-number', `「${t.text}」は日本語モードでは書けない数の書き方です`), name: t.text };
        }
        if (t.type === 'unknown') return at('syntax', `「${t.text}」が読めません`);
    }
    return null;
};

/**
 * The closing word of a block in the DNCL-like form.
 * @param {object} node - The block (`If`, `While`, `For`, `FunctionDef`).
 * @returns {string} `を実行する`, `を繰り返す` or `と定義する`.
 */
const closerOf = (node) => {
    if (node.type === 'If') return 'を実行する';
    if (node.type === 'FunctionDef') return 'と定義する';
    return 'を繰り返す';
};

/**
 * Where in the open blocks is the nearest one a closing word closes, when only
 * blocks closed by a line of their own are inside it (so the word closes it and
 * the blocks inside it were forgotten), or -1.
 * @param {Array<object>} stack - The open blocks (the innermost last).
 * @param {string} word - The closing word.
 * @returns {number} The index in the stack, or -1.
 */
const matchingCloser = (stack, word) => {
    for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].mode !== 'closer') return -1;
        if (closerOf(stack[i].node) === word) return i;
    }
    return -1;
};

/**
 * Read the Japanese (the standard form, the DNCL-like form or both mixed)
 * into a JaAST.
 *
 * Each open block is `indent` (its line ends with `:`; it ends at the first
 * line that is not deeper than it) or `closer` (it ends at a closing line or
 * a `⎿`; the indentation in it does not matter). A block opened with `:`
 * whose next line is not deeper is a `closer` block too.
 * The settings (./settings.js) are read from the comments at the top first:
 * the comment mark changes how the lines are read.
 * @param {string} source - The Japanese source.
 * @returns {{program: ?object, errors: Array<object>}} The program (null when
 *   there are errors) and the errors (`{code, message, line, column}`).
 */
const parse = (source) => {
    const settings = readSettings(headerComments(source));
    const lines = readLines(source, settings.commentMarker);
    const program = { type: 'Program', settings, body: [], line: 1, column: 0 };
    const errors = [];
    const stack = [];
    let lastCodeLine = 1;
    // The indent of the lines outside any block (the first of them).
    let topWidth = null;
    // The indent of a misplaced `そうでなければ:` / `そうでなくもし`: the lines
    // deeper than it are its body, not told again as at another indent.
    let strayWidth = null;
    const currentBody = () => (stack.length > 0 ? stack[stack.length - 1].body : program.body);
    const close = (entry, closeLine, closeAfter) => {
        entry.node.closeLine = closeLine;
        entry.node.closeAfter = closeAfter;
    };
    // The indent of each comment line, so a comment that is not deeper than a
    // block written with indentation goes after it when it ends (Issue #2556).
    const commentWidths = new Map();
    // Take the comments at the end of a block that are not deeper than the
    // block: they are after it, not in its last branch.
    const takeTrailingComments = (entry) => {
        const moved = [];
        if (entry.mode !== 'indent') return moved;
        while (entry.body.length > 0) {
            const last = entry.body[entry.body.length - 1];
            if (last.type !== 'Comment' || commentWidths.get(last) > entry.width) break;
            moved.unshift(entry.body.pop());
        }
        return moved;
    };
    // End a block written with indentation, the comments at its end after it.
    const closeIndented = (top, closeAfter) => {
        const moved = takeTrailingComments(top);
        close(top, lastCodeLine, moved.length > 0 ? moved[0].line - 1 : closeAfter);
        stack.pop();
        currentBody().push(...moved);
    };
    // What a block error says about its block: the kind of the opener (and the
    // direction of a counting loop) and whether it was opened with `:`.
    const openerOf = (entry) => ({
        opener: entry.node.type,
        ...(entry.node.type === 'For' ? { direction: entry.node.direction } : {}),
        colon: entry.colon,
    });
    // A block closed by a line of its own that was not closed.
    const unclosed = (entry) => {
        const word = closerOf(entry.node);
        errors.push(
            makeError('unclosed', `「${word}」で閉じていません`, entry.node.line, entry.node.column, {
                ...openerOf(entry),
                word,
            }),
        );
    };
    const emptyBlock = (entry) =>
        errors.push(
            makeError(
                'empty-block',
                'ブロックの中に行がありません',
                entry.node.line,
                entry.node.column,
                openerOf(entry),
            ),
        );

    // A closing line ends the block `⎿` marks closed just before it said again
    // (Issue #2058): the blocks closed by the `⎿` of the last code line.
    let markClosed = [];
    // Close blocks by the `⎿` marks of a line.
    const closeByMarks = (entry, count) => {
        for (let i = 0; i < count && stack.length > 0; i++) {
            const top = stack.pop();
            if (!top.hasBody && top.body.length === 0) emptyBlock(top);
            close(top, entry.line, entry.line);
            markClosed.push(top);
        }
    };

    lines.forEach((entry) => {
        if (entry.blank) return;
        if (entry.tokens.length === 0) {
            const comment = { type: 'Comment', text: entry.comment, line: entry.line, column: 0 };
            commentWidths.set(comment, entry.width);
            currentBody().push(comment);
            return;
        }
        const tokens = withoutReadingCommas(entry.tokens);
        const bad = tokenError(tokens);
        if (bad) {
            errors.push(bad);
            return;
        }
        let block;
        let statements = null;
        try {
            block = readBlockLine(tokens, entry.line);
            if (!block) statements = readSimple(tokens, entry.line);
        } catch (e) {
            if (!(e instanceof LineError)) throw e;
            errors.push(e.error);
            return;
        }
        const continuesIf = block && (block.kind === 'elsif' || block.kind === 'else');
        const closes = block && block.kind === 'close';
        const closed = markClosed;
        markClosed = [];
        // A closing line right after the `⎿` that closed its block, at the
        // indent of that block, says the same end: it is read as nothing (its
        // comment stays, after the block).
        if (closes && entry.closeCount === 0) {
            const index = closed.findIndex(
                (done) => done.width === entry.width && closerOf(done.node) === block.word,
            );
            if (index >= 0) {
                markClosed = closed.filter((_done, i) => i !== index);
                // A comment line between the `⎿` and this line is after the
                // block: the `end` stays on the `⎿` line, before the comment.
                const body = currentBody();
                if (body[body.length - 1] !== closed[closed.length - 1].node) {
                    if (entry.comment !== null) {
                        body.push({ type: 'Comment', text: entry.comment, line: entry.line, column: 0 });
                    }
                    return;
                }
                // Its `end` is on this line, as when the block is closed by the
                // line alone (Issue #2556): no blank line is left for it. The
                // blocks the same marks closed around it end there too.
                closed.slice(index).forEach((done) => close(done, entry.line, entry.line));
                const done = closed[index].node;
                done.closeOwnLine = true;
                if (entry.comment !== null) done.closeComment = entry.comment;
                lastCodeLine = entry.line;
                return;
            }
        }
        // Blocks written with indentation end at the first line that is not deeper.
        while (stack.length > 0) {
            const top = stack[stack.length - 1];
            if (top.mode === 'closer') break;
            if (!top.hasBody) {
                // A deeper closing line of an empty block closes it (Issue #2058).
                if (entry.width > top.width && closes) break;
                if (entry.width > top.width) {
                    top.hasBody = true;
                    top.bodyWidth = entry.width;
                    break;
                }
                top.mode = 'closer';
                break;
            }
            if (entry.width > top.width) break;
            if (entry.width === top.width && continuesIf && top.node.type === 'If') break;
            // A closing line at the indent of a block opened with `:` closes it.
            if (entry.width === top.width && closes && block.word !== END_WORD) break;
            closeIndented(top, entry.line - 1);
        }
        const column = entry.tokens[0].column;
        // A line is at the indent of the lines of its block (or of the lines
        // outside any block) written with indentation: the indent says which
        // block it is in, so another indent is an error, not read as the
        // nearest (Issue #2555). In a block closed by a line of its own the
        // indent does not matter, and closing lines may be deeper (Issue #2058).
        // The line is still read where it is, so the lines of a block opened at
        // another indent are not told again, nor its closing line as closing
        // nothing.
        if (strayWidth !== null && entry.width <= strayWidth) strayWidth = null;
        if (!closes && !continuesIf && strayWidth === null) {
            const top = stack[stack.length - 1];
            if (!top && topWidth === null) topWidth = entry.width;
            const expected = top ? (top.mode === 'indent' ? top.bodyWidth : entry.width) : topWidth;
            if (entry.width !== expected) {
                errors.push(makeError('syntax', '字下げが合いません', entry.line, column, { block: 'indent' }));
            }
        }
        if (closes) {
            const top = stack[stack.length - 1];
            if (!top) {
                errors.push(
                    makeError('syntax', `「${block.word}」で閉じるブロックがありません`, entry.line, column, {
                        block: 'stray-closer',
                        word: block.word,
                    }),
                );
                return;
            }
            // A closing word may end a block opened with `:` too, at any indent
            // deeper than it: it closes the innermost block (Issue #2058). Only
            // `end` must be in a block opened without `:`.
            if (top.mode === 'indent' && block.word === END_WORD) {
                errors.push(
                    makeError('syntax', `「${block.word}」の字下げが合いません`, entry.line, column, {
                        block: 'closer-indent',
                        word: block.word,
                    }),
                );
                return;
            }
            // The closing word must be the one of the block (Issue #1731, W3): a
            // `もし` closed by `を繰り返す` is told. `end` closes any block, as in Ruby.
            if (block.word !== END_WORD && block.word !== closerOf(top.node)) {
                // A block forgotten to be closed inside the one the word closes (a
                // `もし` in a loop closed by `を繰り返す`) is told as not closed.
                const index = matchingCloser(stack, block.word);
                if (index < 0) {
                    stack.pop();
                    const expected = closerOf(top.node);
                    errors.push(
                        makeError(
                            'syntax',
                            `「${block.word}」ではなく「${expected}」で閉じてください`,
                            entry.line,
                            column,
                            { ...openerOf(top), block: 'closer-kind', word: block.word, expected },
                        ),
                    );
                    return;
                }
                while (stack.length > index + 1) unclosed(stack.pop());
                const found = stack.pop();
                close(found, entry.line, entry.line);
                found.node.closeOwnLine = true;
                lastCodeLine = entry.line;
                return;
            }
            stack.pop();
            close(top, entry.line, entry.line);
            top.node.closeOwnLine = true;
            if (entry.comment !== null) top.node.closeComment = entry.comment;
            lastCodeLine = entry.line;
            // On a `⎿` line (`⎿ を実行する`) the closing word is the end of the
            // first `⎿`; the other marks close the blocks around it.
            closeByMarks(entry, entry.closeCount - 1);
            return;
        }
        if (continuesIf) {
            const top = stack[stack.length - 1];
            // A branch of a `もし` opened with `:` is at the indent of the `もし`. One
            // deeper (even by a space, as after `｜`) is not taken for it, as one
            // shallower is not (Issue #2030): an error on its line is safer than
            // another program.
            const misplaced = top && top.mode === 'indent' && entry.width !== top.width;
            if (!top || top.node.type !== 'If' || top.node.elseBody || misplaced) {
                strayWidth = entry.width;
                errors.push(
                    makeError('syntax', '対応する「もし」がありません', entry.line, column, {
                        block: 'stray-branch',
                        branch: block.kind,
                        colon: block.colon,
                    }),
                );
                return;
            }
            top.hasBody = false;
            if (block.kind === 'elsif') {
                const branch = { condition: block.condition, body: [], line: entry.line };
                if (entry.comment !== null) branch.comment = entry.comment;
                top.node.branches.push(branch);
                top.body = branch.body;
            } else {
                top.node.elseBody = [];
                top.node.elseLine = entry.line;
                if (entry.comment !== null) top.node.elseComment = entry.comment;
                top.body = top.node.elseBody;
            }
        } else if (block) {
            if (entry.comment !== null) block.node.comment = entry.comment;
            currentBody().push(block.node);
            stack.push({
                node: block.node,
                body: block.node.body || block.node.branches[0].body,
                width: entry.width,
                mode: block.colon ? 'indent' : 'closer',
                colon: block.colon,
            });
        } else {
            if (entry.comment !== null) statements[statements.length - 1].comment = entry.comment;
            if (entry.endLine !== entry.line) statements.forEach((s) => (s.endLine = entry.endLine));
            currentBody().push(...statements);
        }
        lastCodeLine = entry.line;
        closeByMarks(entry, entry.closeCount);
    });
    while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.mode === 'indent' && top.hasBody) {
            closeIndented(top, lines.length);
            continue;
        }
        stack.pop();
        if (top.mode === 'indent') {
            emptyBlock(top);
        } else {
            unclosed(top);
        }
    }
    return errors.length > 0 ? { program: null, errors } : { program, errors };
};

export { parse };
