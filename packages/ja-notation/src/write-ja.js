// SPDX-License-Identifier: MIT
// ja-notation: write the Japanese of a JaAST in the standard form (e of
// docs/ruby-editor/converter-roadmap.md, 2 章). See ../LICENSE.
//
// The standard form (the form of 共通テスト用プログラム表記): a block is
// opened by a line that ends with `:` and holds the lines indented under it
// (4 spaces a level), `and` / `or` / `not`, `％`, `値 を返す`. Only one form is
// written, whatever form the JaAST was read from.
//
// The indent ends a block, so its closing line (`を実行する`, `を繰り返す`,
// `と定義する`) is not written, except where the indent cannot tell where it
// ends, and the reader takes the closing line as well:
// - the block, or any branch of it, has no line (`もし a ならば:` and nothing
//   under it): the next branch or line would be read as its body;
// - the closing line has a comment, so the comment keeps its place;
// - a comment line follows it: the reader puts a comment not deeper than the
//   block after it (Issue #2556), but the closing line shows the end plainly.
//
// The comments are written with the comment mark of the settings (`//` or `#`).
import { each, run } from './run.js';
import { settingsOf, writeComment } from './settings.js';

/** The spaces of one level of indent. */
const INDENT = '    ';

/** The closing line of each block. */
const CLOSERS = { If: 'を実行する', While: 'を繰り返す', For: 'を繰り返す', FunctionDef: 'と定義する' };

/**
 * How strongly each operator of the Japanese binds (higher binds tighter), as
 * `parse` reads them.
 */
const PRECEDENCE = {
    '..': 1,
    '...': 1,
    or: 2,
    and: 3,
    not: 4,
    '==': 5,
    '!=': 5,
    '<': 5,
    '<=': 5,
    '>': 5,
    '>=': 5,
    '+': 6,
    '-': 6,
    '*': 7,
    '/': 7,
    '÷': 7,
    '%': 7,
    sign: 8,
};

/** The precedence of a value (a name, number, call, index, ...). */
const PRIMARY = 10;

/** Operators that are not chained: an operand of the same kind needs parentheses on both sides. */
const NON_ASSOCIATIVE = new Set(['..', '...', '==', '!=', '<', '<=', '>', '>=']);

/** How the operators are written. */
const WRITTEN = { '%': '％' };

/**
 * How strongly an expression binds.
 * @param {object} e - The JaAST expression.
 * @returns {number} Its precedence.
 */
const precedenceOf = (e) => {
    if (e.type === 'Binary') return PRECEDENCE[e.operator] || PRIMARY;
    if (e.type === 'Unary') return e.operator === 'not' ? PRECEDENCE.not : PRECEDENCE.sign;
    return PRIMARY;
};

/**
 * Write an expression.
 * @param {object} e - The JaAST expression.
 * @yields {object} The writings of its parts (./run.js).
 * @returns {string} The Japanese.
 */
const expression = function* (e) {
    switch (e.type) {
        case 'Number':
            return e.value;
        case 'String':
            return e.raw;
        case 'Boolean':
            return e.value ? '真' : '偽';
        case 'Name':
            return e.name;
        case 'RubyCode':
            return e.text;
        case 'Index':
            return `${yield operand(e.target, PRIMARY)}[${yield expression(e.index)}]`;
        case 'ArrayLiteral':
            return `[${(yield each(e.elements, expression)).join(', ')}]`;
        case 'Call':
            return `${e.name}(${(yield each(e.args, expression)).join(', ')})`;
        case 'Unary':
            return yield unary(e);
        case 'Binary':
            return yield binary(e);
        default:
            throw new Error(`ja-notation: cannot write ${e.type}`);
    }
};

/**
 * Write an operand, in parentheses when it binds less than its place needs.
 * @param {object} e - The JaAST expression.
 * @param {number} needed - The precedence the place needs.
 * @yields {object} The writing of the expression (./run.js).
 * @returns {string} The Japanese.
 */
const operand = function* (e, needed) {
    const text = yield expression(e);
    return precedenceOf(e) < needed ? `(${text})` : text;
};

/**
 * A sign or `not`.
 * @param {object} e - The Unary.
 * @yields {object} The writing of its operand (./run.js).
 * @returns {string} The Japanese.
 */
const unary = function* (e) {
    // `parens`: the operand was written in parentheses (`!(a > 10)`), which are
    // kept so a student does not read `not a > 10` as `(not a) > 10`.
    if (e.operator === 'not') return `not ${yield operand(e.operand, e.parens ? PRIMARY : PRECEDENCE.not)}`;
    // `- -5` and `-(-a)` are written with parentheses.
    const inner =
        e.operand.type === 'Unary' ? `(${yield expression(e.operand)})` : yield operand(e.operand, PRECEDENCE.sign);
    return `${e.operator}${inner}`;
};

/**
 * Whether an expression is a minus before something other than a number.
 * @param {object} e - The JaAST expression.
 * @returns {boolean} Whether it is.
 */
const isNegated = (e) => e.type === 'Unary' && e.operator === '-' && e.operand.type !== 'Number';

/**
 * A binary operator: the left side may be of the same precedence (the
 * operators are read from the left), the right side binds tighter.
 * @param {object} e - The Binary.
 * @yields {object} The writings of its sides (./run.js).
 * @returns {string} The Japanese.
 */
const binary = function* (e) {
    // The left sides of a long chain (`a and b and ... and z`) are followed in
    // a loop, so the text is not made again and again through the chain.
    const needsOf = (b) => {
        const own = PRECEDENCE[b.operator];
        return { own, left: NON_ASSOCIATIVE.has(b.operator) ? own + 1 : own };
    };
    const chain = [e];
    let current = e;
    while (current.left.type === 'Binary' && precedenceOf(current.left) >= needsOf(current).left) {
        current = current.left;
        chain.push(current);
    }
    let text = yield operand(current.left, needsOf(current).left);
    // A negated name or expression before `÷` is written in parentheses (`(-a) ÷ 2`,
    // `(-a) * 3 ÷ 2`), so a student does not read it as `-(a ÷ 2)`. A negative number
    // stays as it is (`-7 ÷ 2`).
    const own = PRECEDENCE[current.operator];
    const beforeQuotient = chain.some((b) => b.operator === '÷' && PRECEDENCE[b.operator] === own);
    if (beforeQuotient && isNegated(current.left)) text = `(${text})`;
    for (let i = chain.length - 1; i >= 0; i--) {
        const b = chain[i];
        const right = yield operand(b.right, needsOf(b).own + 1);
        text =
            b.operator === '..' || b.operator === '...'
                ? `${text}${b.operator}${right}`
                : `${text} ${WRITTEN[b.operator] || b.operator} ${right}`;
    }
    return text;
};

/** The text of the inputs. */
const INPUTS = { external: '【外部からの入力】', integer: '【整数を入力】', string: '【文字列を入力】' };

/** Writes the lines of one program. */
class JaWriter {
    /**
     * @param {object} program - The JaAST.
     */
    constructor(program) {
        this.blank = Array.isArray(program.blankLines) ? new Set(program.blankLines) : null;
        this.settings = settingsOf(program);
        // `{kind: 'line' | 'blank' | 'close', text, keep, comment}` per line.
        this.entries = [];
    }

    /**
     * Push a line.
     * @param {number} depth - The indent level.
     * @param {string} text - The line.
     * @param {?string} comment - Its comment.
     * @param {object} [more] - More about the entry (`kind`, `keep`, `isComment`).
     */
    push(depth, text, comment, more = {}) {
        const withComment =
            typeof comment === 'string' && comment !== '' ? `${text} ${writeComment(comment, this.settings)}` : text;
        this.entries.push({ kind: 'line', text: `${INDENT.repeat(depth)}${withComment}`, ...more });
    }

    /**
     * The blank lines between two lines of the source.
     * @param {number} from - The first line that may be blank.
     * @param {number} to - The last line that may be blank.
     */
    gap(from, to) {
        for (let line = from; line <= to; line++) {
            if (!this.blank || this.blank.has(line)) this.entries.push({ kind: 'blank', text: '' });
        }
    }

    /**
     * Write statements.
     * @param {Array<object>} body - The statements.
     * @param {number} depth - The indent level.
     * @param {?number} after - The line before the first statement (for the blank lines).
     * @yields {object} The writings of the statements (./run.js).
     * @returns {?number} The last line the statements take.
     */
    *body(body, depth, after) {
        let last = after;
        for (const s of body) {
            if (typeof s.line === 'number' && typeof last === 'number') this.gap(last + 1, s.line - 1);
            yield this.statement(s, depth);
            const end = s.closeLine || s.endLine || s.line;
            if (typeof end === 'number') last = end;
        }
        return last;
    }

    /**
     * Write one statement.
     * @param {object} s - The statement.
     * @param {number} depth - The indent level.
     * @yields {object} The writings of its parts (./run.js).
     */
    *statement(s, depth) {
        switch (s.type) {
            case 'If':
                yield this.ifStatement(s, depth);
                return;
            case 'While':
                yield this.block(s, depth, `${yield expression(s.condition)} の間繰り返す:`);
                return;
            case 'For': {
                const way = s.direction === 'down' ? '減らしながら' : '増やしながら';
                const head =
                    `${s.variable.name} を ${yield expression(s.from)} から ${yield expression(s.to)} まで ` +
                    `${yield expression(s.step)} ずつ${way}繰り返す:`;
                yield this.block(s, depth, head);
                return;
            }
            case 'FunctionDef':
                yield this.block(s, depth, `関数 ${s.name}(${s.params.join(', ')}):`);
                return;
            case 'Comment':
                this.push(depth, writeComment(s.text, this.settings), null, { isComment: true });
                return;
            case 'RubyCode':
                this.rubyCode(s, depth);
                return;
            default:
                this.push(depth, yield this.simple(s), s.comment);
        }
    }

    /**
     * The text of a statement of one line.
     * @param {object} s - The statement.
     * @yields {object} The writings of its expressions (./run.js).
     * @returns {string} The Japanese.
     */
    *simple(s) {
        switch (s.type) {
            case 'Assign':
                return `${yield expression(s.target)} = ${yield expression(s.value)}`;
            case 'OpAssign':
                return `${yield expression(s.target)} ${s.operator}= ${yield expression(s.value)}`;
            case 'MultiAssign':
                return `${(yield each(s.targets, expression)).join(', ')} = ${(yield each(s.values, expression)).join(', ')}`;
            case 'Input':
                return `${yield expression(s.target)} = ${INPUTS[s.kind]}`;
            case 'ExpressionStatement':
                return yield expression(s.expression);
            case 'Return':
                return s.value ? `${yield expression(s.value)} を返す` : '返す';
            case 'Append':
                return `${yield expression(s.target)} に ${yield expression(s.value)} を追加する`;
            default:
                throw new Error(`ja-notation: cannot write ${s.type}`);
        }
    }

    /**
     * Ruby that has no Japanese form, as it is written: its lines after the
     * first keep their indent from the column the code starts at.
     * @param {object} s - The RubyCode statement.
     * @param {number} depth - The indent level.
     */
    rubyCode(s, depth) {
        const lines = s.text.split('\n');
        const column = s.indent || 0;
        lines.forEach((line, i) => {
            const text = i === 0 ? line : line.replace(new RegExp(`^ {0,${column}}`), '');
            const comment = i === lines.length - 1 ? s.comment : null;
            if (text.trim() === '') this.entries.push({ kind: 'blank', text: '' });
            else this.push(depth, text, comment);
        });
    }

    /**
     * Whether a body has a line that is not a comment.
     * @param {Array<object>} body - The statements.
     * @returns {boolean} True if it has.
     */
    static hasLine(body) {
        return body.some((s) => s.type !== 'Comment');
    }

    /**
     * A block with one body.
     * @param {object} s - The statement.
     * @param {number} depth - The indent level.
     * @param {string} head - The opening line.
     * @yields {object} The writings of its body (./run.js).
     */
    *block(s, depth, head) {
        this.push(depth, head, s.comment);
        const last = yield this.body(s.body, depth + 1, s.line);
        this.close(s, depth, last, !JaWriter.hasLine(s.body));
    }

    /**
     * `もし`, with its branches.
     * @param {object} s - The If.
     * @param {number} depth - The indent level.
     * @yields {object} The writings of its parts (./run.js).
     */
    *ifStatement(s, depth) {
        let empty = false;
        let last = null;
        for (let i = 0; i < s.branches.length; i++) {
            const branch = s.branches[i];
            if (i > 0) this.gap(last + 1, branch.line - 1);
            const word = i === 0 ? 'もし' : 'そうでなくもし';
            const condition = yield expression(branch.condition);
            this.push(depth, `${word} ${condition} ならば:`, i === 0 ? s.comment : branch.comment);
            last = yield this.body(branch.body, depth + 1, branch.line);
            if (!JaWriter.hasLine(branch.body)) empty = true;
        }
        if (s.elseBody) {
            if (typeof last === 'number' && typeof s.elseLine === 'number') this.gap(last + 1, s.elseLine - 1);
            this.push(depth, 'そうでなければ:', s.elseComment);
            last = yield this.body(s.elseBody, depth + 1, s.elseLine);
            if (!JaWriter.hasLine(s.elseBody)) empty = true;
        }
        this.close(s, depth, last, empty);
    }

    /**
     * The closing line of a block (decided in `lines`, as it depends on the
     * line after it).
     * @param {object} s - The block statement.
     * @param {number} depth - The indent level.
     * @param {?number} last - The last line of its body.
     * @param {boolean} empty - Whether the block or a branch of it has no line.
     */
    close(s, depth, last, empty) {
        if (typeof last === 'number' && typeof s.closeLine === 'number') this.gap(last + 1, s.closeLine - 1);
        const keep = empty || (typeof s.closeComment === 'string' && s.closeComment !== '');
        this.push(depth, CLOSERS[s.type], s.closeComment, { kind: 'close', keep });
    }

    /**
     * The lines, with the closing lines that are needed.
     * @returns {Array<string>} The lines.
     */
    lines() {
        return this.entries
            .filter((entry, k) => {
                if (entry.kind !== 'close' || entry.keep) return true;
                const next = this.entries.slice(k + 1).find((e) => e.kind !== 'blank');
                return Boolean(next && next.isComment);
            })
            .map((entry) => entry.text);
    }
}

/**
 * Write a JaAST as Japanese in the standard form.
 * @param {object} program - The JaAST. When it has `blankLines` (the lines of
 *   the source with nothing on them), those blank lines are kept; else every
 *   line between two statements is taken as blank. `lineCount` keeps the blank
 *   lines at the end.
 * @returns {string} The Japanese.
 */
const writeJa = (program) => {
    const writer = new JaWriter(program);
    const last = run(writer.body(program.body, 0, 0));
    if (typeof program.lineCount === 'number') writer.gap((last || 0) + 1, program.lineCount);
    return writer.lines().join('\n');
};

export { writeJa };
