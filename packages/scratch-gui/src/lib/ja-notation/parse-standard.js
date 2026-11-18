// SPDX-License-Identifier: MIT
// ja-notation: read the standard form of the Japanese (the form of the
// 共通テスト用プログラム表記: line numbers, `｜` / `⎿` or indentation, `ならば:`,
// `=`, `and` / `or` / `not`) into a JaAST (./ja-ast.js). See ./LICENSE.
//
// The DNCL-like form (`を実行する` / `を繰り返す` closing lines, `←`, `かつ`, 「...」)
// is read by another step (J2 of docs/ruby-editor/converter-roadmap.md); here
// it is reported as an error with the code `dncl-like`.
import { tokenize } from './lexer';

/** The label of a numbered line: `(1)`, `(01)` and `(00-1)` (a line put before `(01)`). */
const LABEL_RE = /^\(\d+(?:-\d+)*\)/;

/** The part before the code of a line: spaces and the `｜` / `⎿` marks. */
const PREFIX_RE = /^[\s｜|⎿]*/;

/**
 * How wide one `｜` / `⎿` mark is. More than any run of spaces, so a line with
 * more marks is always deeper; the spaces after the last mark only compare
 * lines with the same marks.
 */
const MARK_WIDTH = 1000;

/** Words that close a block in the DNCL-like form. */
const DNCL_LIKE_CLOSERS = new Set(['を実行する', 'を繰り返す', 'と定義する', 'を定義する']);

/** The comparison operators. */
const COMPARISONS = new Set(['==', '!=', '<', '<=', '>', '>=']);

/** The operators of assignments that change a variable (`i += 1`). */
const OP_ASSIGNS = { '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%' };

/** Names that are a part of the statement around an expression, never a value in it. */
const STOP_NAMES = new Set(['を', 'から', 'まで', 'ならば', 'なら', 'の間', 'の間繰り返す', 'and', 'or', 'not']);

/**
 * An error of the reading.
 * @param {string} code - What kind of error it is (`syntax`, `dncl-like`, ...).
 * @param {string} message - The message, in Japanese.
 * @param {number} line - The line (1-based).
 * @param {number} column - The column (0-based).
 * @returns {object} The error.
 */
const makeError = (code, message, line, column = 0) => ({ code, message, line, column });

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
 * @returns {Array<object>} `{line, endLine, tokens, comment, width, marks, closeCount, blank}`.
 */
const readLines = (source) => {
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
        const marks = prefix.match(/[｜|⎿]/g) || [];
        const afterMarks = prefix.match(/[^｜|⎿]*$/)[0];
        const width = marks.length === 0 ? indentWidth(prefix) : marks.length * MARK_WIDTH + indentWidth(afterMarks);
        const tokens = tokenize(rest.substring(prefix.length), offset + prefix.length).map((t) => ({
            ...t,
            line: i + 1,
        }));
        return { tokens, width, marks: marks.length, closeCount: marks.filter((c) => c === '⎿').length };
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

/** Reads an expression from tokens (recursive descent, lowest precedence first). */
class ExpressionReader {
    /**
     * @param {Array<object>} tokens - The tokens of the expression.
     * @param {number} line - The line, for errors at the end of the tokens.
     */
    constructor(tokens, line) {
        this.tokens = tokens;
        this.pos = 0;
        this.line = line;
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
        throw new LineError(makeError('syntax', message, token ? token.line : this.line, token ? token.column : 0));
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
     * @returns {object} The expression.
     */
    readAll() {
        const expression = this.readExpression();
        if (this.pos < this.tokens.length) this.fail(this.peek(), `「${this.peek().text}」が読めません`);
        return expression;
    }

    /**
     * An expression: a range (`1..10`) or anything with a weaker operator.
     * @returns {object} The expression.
     */
    readExpression() {
        const left = this.readOr();
        if (this.isOp('..') || this.isOp('...')) {
            const op = this.tokens[this.pos++];
            const right = this.readOr();
            return this.binary(op, left, right);
        }
        return left;
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
     * `or`.
     * @returns {object} The expression.
     */
    readOr() {
        let left = this.readAnd();
        while (this.isName('or')) {
            const op = this.tokens[this.pos++];
            left = this.binary(op, left, this.readAnd());
        }
        return left;
    }

    /**
     * `and`.
     * @returns {object} The expression.
     */
    readAnd() {
        let left = this.readNot();
        while (this.isName('and')) {
            const op = this.tokens[this.pos++];
            left = this.binary(op, left, this.readNot());
        }
        return left;
    }

    /**
     * `not`, weaker than a comparison and stronger than `and` / `or`.
     * @returns {object} The expression.
     */
    readNot() {
        if (this.isName('not')) {
            const op = this.tokens[this.pos++];
            const operand = this.readNot();
            return { type: 'Unary', operator: 'not', operand, line: op.line, column: op.column };
        }
        return this.readComparison();
    }

    /**
     * A comparison.
     * @returns {object} The expression.
     */
    readComparison() {
        const left = this.readAdditive();
        const t = this.peek();
        if (t && t.type === 'op' && COMPARISONS.has(t.value)) {
            this.pos++;
            return this.binary(t, left, this.readAdditive());
        }
        return left;
    }

    /**
     * `+` / `-`.
     * @returns {object} The expression.
     */
    readAdditive() {
        let left = this.readMultiplicative();
        while (this.isOp('+') || this.isOp('-')) {
            const op = this.tokens[this.pos++];
            left = this.binary(op, left, this.readMultiplicative());
        }
        return left;
    }

    /**
     * `*` / `/` / `÷` (and `//`) / `%`.
     * @returns {object} The expression.
     */
    readMultiplicative() {
        let left = this.readUnary();
        while (this.isOp('*') || this.isOp('/') || this.isOp('÷') || this.isOp('%')) {
            const op = this.tokens[this.pos++];
            left = this.binary(op, left, this.readUnary());
        }
        return left;
    }

    /**
     * A sign before a value.
     * @returns {object} The expression.
     */
    readUnary() {
        if (this.isOp('-') || this.isOp('+')) {
            const op = this.tokens[this.pos++];
            const operand = this.readUnary();
            return { type: 'Unary', operator: op.value, operand, line: op.line, column: op.column };
        }
        return this.readPostfix();
    }

    /**
     * A value and the indexes after it (`A[i]`, `A[i][j]`).
     * @returns {object} The expression.
     */
    readPostfix() {
        let value = this.readPrimary();
        while (this.isOp('[')) {
            this.pos++;
            const index = this.readExpression();
            this.expectOp(']');
            value = { type: 'Index', target: value, index, line: value.line, column: value.column };
        }
        return value;
    }

    /**
     * The arguments of a call, after its `(`, up to its `)`.
     * @returns {Array<object>} The arguments.
     */
    readArguments() {
        const args = [];
        if (this.isOp(')')) {
            this.pos++;
            return args;
        }
        for (;;) {
            args.push(this.readExpression());
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
     * @returns {object} The expression.
     */
    readPrimary() {
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
                return { type: 'Call', name: t.text, args: this.readArguments(), ...at };
            }
            return { type: 'Name', name: t.text, ...at };
        }
        if (t.type === 'op' && t.value === '(') {
            this.pos++;
            const inner = this.readExpression();
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
                    elements.push(this.readExpression());
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
const readExpression = (tokens, line) => new ExpressionReader(tokens, line).readAll();

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
 * Read a simple statement (not one that opens a block).
 * @param {Array<object>} tokens - The tokens of the line.
 * @param {number} line - The line.
 * @returns {Array<object>} The statements (`a = 0, b = 1` is two).
 */
const readSimple = (tokens, line) => {
    const first = tokens[0];
    const where = { line, column: first.column };
    if (first.type === 'name' && first.text === '返す') {
        const value = tokens.length > 1 ? readExpression(tokens.slice(1), line) : null;
        return [{ type: 'Return', value, ...where }];
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
 * Read a line that opens or continues a block, or null when it is not one.
 * @param {Array<object>} tokens - The tokens of the line.
 * @param {number} line - The line.
 * @returns {?object} `{kind: 'open' | 'elsif' | 'else', node?, condition?}` or null.
 */
const readBlockLine = (tokens, line) => {
    const last = tokens[tokens.length - 1];
    const colon = last.type === 'op' && last.value === ':';
    const body = colon ? tokens.slice(0, -1) : tokens;
    const first = body[0];
    const where = { line, column: first ? first.column : 0 };
    const needColon = () => {
        if (!colon) {
            throw new LineError(
                makeError('dncl-like', 'ブロックを始める行の終わりに「:」が無い（DNCL 風の形）', line, where.column),
            );
        }
    };
    if (!first) return null;
    const tail = body[body.length - 1];

    if (isName(first, 'もし') || isName(first, 'そうでなくもし')) {
        if (!isName(tail, 'ならば') && !isName(tail, 'なら')) {
            throw new LineError(makeError('syntax', '「もし」の後に「ならば」が要ります', line, where.column));
        }
        needColon();
        const condition = readExpression(body.slice(1, -1), line);
        if (first.text === 'そうでなくもし') return { kind: 'elsif', condition, line };
        return {
            kind: 'open',
            node: { type: 'If', branches: [{ condition, body: [], line }], elseBody: null, elseLine: null, ...where },
        };
    }
    if (isName(first, 'そうでなければ') && body.length === 1) {
        needColon();
        return { kind: 'else', line };
    }
    if (body.length === 1 && DNCL_LIKE_CLOSERS.has(first.text) && first.type === 'name') {
        throw new LineError(makeError('dncl-like', `「${first.text}」で閉じる行（DNCL 風の形）`, line, where.column));
    }
    // A counting loop: `i を 1 から 10 まで 1 ずつ増やしながら繰り返す:`.
    const end = isName(body[1], 'を') && first.type === 'name' ? countingLoopEnd(body) : null;
    if (end) {
        needColon();
        const from = nameAt(body, 'から', 2);
        const to = from === -1 ? -1 : nameAt(body, 'まで', from + 1);
        if (to === -1) throw new LineError(makeError('syntax', '「から」「まで」が要ります', line, where.column));
        return {
            kind: 'open',
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
        needColon();
        const condition = readExpression(body.slice(0, body.length - whileWords), line);
        return { kind: 'open', node: { type: 'While', condition, body: [], ...where } };
    }
    // A function: `関数 名前(a, b):` or `名前(a, b) を定義する:`.
    const define = isName(tail, 'を定義する') && body.length > 1;
    const head = isName(first, '関数') ? body.slice(1) : define ? body.slice(0, -1) : null;
    if (head && head[0] && head[0].type === 'name' && head[1] && head[1].type === 'op' && head[1].value === '(') {
        needColon();
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
        return { kind: 'open', node: { type: 'FunctionDef', name: head[0].text, params, body: [], ...where } };
    }
    return null;
};

/**
 * The first token of the line that marks something this reading does not take
 * (a mark of the DNCL-like form, `@` / `$`, a Ruby number, an unknown character),
 * as an error.
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
        if (t.type === 'dnclLike') return at('dncl-like', `「${t.text}」は DNCL 風の形の書き方`);
        if (t.type === 'forbidden') return at('forbidden', `日本語モードでは変数に「${t.text}」は使えません`);
        if (t.type === 'badNumber') return at('bad-number', `「${t.text}」は日本語モードでは書けない数の書き方です`);
        if (t.type === 'unknown') return at('syntax', `「${t.text}」が読めません`);
    }
    return null;
};

/**
 * Read the standard form of the Japanese into a JaAST.
 * @param {string} source - The Japanese source.
 * @returns {{program: ?object, errors: Array<object>}} The program (null when
 *   there are errors) and the errors (`{code, message, line, column}`).
 */
const parseStandard = (source) => {
    const lines = readLines(source);
    const program = { type: 'Program', settings: {}, body: [], line: 1, column: 0 };
    const errors = [];
    const stack = [];
    let lastCodeLine = 1;
    const currentBody = () => (stack.length > 0 ? stack[stack.length - 1].body : program.body);
    const close = (entry, closeLine, closeAfter) => {
        entry.node.closeLine = closeLine;
        entry.node.closeAfter = closeAfter;
    };
    const emptyBlock = (entry) =>
        errors.push(makeError('empty-block', 'ブロックの中に行がありません', entry.node.line, entry.node.column));

    lines.forEach((entry) => {
        if (entry.blank) return;
        if (entry.tokens.length === 0) {
            currentBody().push({ type: 'Comment', text: entry.comment, line: entry.line, column: 0 });
            return;
        }
        const bad = tokenError(entry.tokens);
        if (bad) {
            errors.push(bad);
            return;
        }
        let block;
        let statements = null;
        try {
            block = readBlockLine(entry.tokens, entry.line);
            if (!block) statements = readSimple(entry.tokens, entry.line);
        } catch (e) {
            if (!(e instanceof LineError)) throw e;
            errors.push(e.error);
            return;
        }
        const continuesIf = block && (block.kind === 'elsif' || block.kind === 'else');
        // Blocks written with indentation end at the first line that is not deeper.
        while (stack.length > 0) {
            const top = stack[stack.length - 1];
            if (!top.hasBody) {
                if (entry.width > top.width) {
                    top.hasBody = true;
                    break;
                }
                emptyBlock(top);
                stack.pop();
                continue;
            }
            if (entry.width > top.width) break;
            if (entry.width === top.width && continuesIf && top.node.type === 'If') break;
            close(top, lastCodeLine, entry.line - 1);
            stack.pop();
        }
        if (continuesIf) {
            const top = stack[stack.length - 1];
            if (!top || top.node.type !== 'If' || top.node.elseBody) {
                errors.push(makeError('syntax', '対応する「もし」がありません', entry.line, entry.tokens[0].column));
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
            });
        } else {
            if (entry.comment !== null) statements[statements.length - 1].comment = entry.comment;
            if (entry.endLine !== entry.line) statements.forEach((s) => (s.endLine = entry.endLine));
            currentBody().push(...statements);
        }
        lastCodeLine = entry.line;
        for (let i = 0; i < entry.closeCount && stack.length > 0; i++) {
            const top = stack.pop();
            if (!top.hasBody && top.body.length === 0) emptyBlock(top);
            close(top, entry.line, entry.line);
        }
    });
    while (stack.length > 0) {
        const top = stack.pop();
        if (top.hasBody) close(top, lastCodeLine, lines.length);
        else emptyBlock(top);
    }
    return errors.length > 0 ? { program: null, errors } : { program, errors };
};

export { parseStandard };
