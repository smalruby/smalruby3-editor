// SPDX-License-Identifier: MIT
// ja-notation: write the Ruby text of a RubyAST (./build-ruby.js), and which
// Japanese line each Ruby line comes from. See ./LICENSE.

/** How strongly each operator binds (higher binds tighter). */
const PRECEDENCE = {
    '!': 90,
    '+@': 90,
    '**': 85,
    '-@': 80,
    '*': 70,
    '/': 70,
    '%': 70,
    '+': 60,
    '-': 60,
    '<': 50,
    '<=': 50,
    '>': 50,
    '>=': 50,
    '==': 45,
    '!=': 45,
    AndNode: 40,
    OrNode: 30,
    RangeNode: 20,
};

/** The precedence of a value that is not an operator. */
const PRIMARY = 100;

/** Operators whose operands of the same precedence need parentheses on both sides. */
const NON_ASSOCIATIVE = new Set(['<', '<=', '>', '>=', '==', '!=', 'RangeNode']);

/**
 * How strongly a node binds.
 * @param {object} node - The node.
 * @returns {number} Its precedence.
 */
const precedenceOf = (node) => {
    if (node.type === 'CallNode' && node.receiver !== null && PRECEDENCE[node.name]) return PRECEDENCE[node.name];
    if (PRECEDENCE[node.type]) return PRECEDENCE[node.type];
    return PRIMARY;
};

/** Writes the Ruby of expressions and of statements of one line. */
const TEXT = {
    /**
     * Write an expression.
     * @param {object} node - The RubyAST expression.
     * @returns {string} The Ruby.
     */
    expression(node) {
        switch (node.type) {
            case 'IntegerNode':
            case 'FloatNode':
                return node.text;
            case 'StringNode':
                return node.raw;
            case 'TrueNode':
                return 'true';
            case 'FalseNode':
                return 'false';
            case 'NilNode':
                return 'nil';
            case 'InstanceVariableReadNode':
            case 'LocalVariableReadNode':
            case 'ConstantReadNode':
                return node.name;
            case 'ArrayNode':
                return `[${node.elements.map((x) => this.expression(x)).join(', ')}]`;
            case 'AndNode':
                return this.binary(node, '&&', node.left, node.right, 'AndNode');
            case 'OrNode':
                return this.binary(node, '||', node.left, node.right, 'OrNode');
            case 'RangeNode':
                return this.binary(node, node.exclusive ? '...' : '..', node.left, node.right, 'RangeNode');
            case 'CallNode':
                return this.callNode(node);
            default:
                throw new Error(`ja-notation: cannot write ${node.type}`);
        }
    },

    /**
     * An operand of an operator, in parentheses when it binds more weakly.
     * @param {object} child - The operand.
     * @param {number} parent - The precedence of the operator.
     * @param {boolean} strict - Whether the same precedence needs parentheses too.
     * @returns {string} The Ruby.
     */
    operand(child, parent, strict) {
        const text = this.expression(child);
        const own = precedenceOf(child);
        return own < parent || (strict && own === parent) ? `(${text})` : text;
    },

    /**
     * A binary operator.
     * @param {object} node - The node.
     * @param {string} symbol - The operator as written.
     * @param {object} left - The left side.
     * @param {object} right - The right side.
     * @param {string} key - The key in `PRECEDENCE`.
     * @returns {string} The Ruby.
     */
    binary(node, symbol, left, right, key) {
        const own = PRECEDENCE[key];
        const strict = NON_ASSOCIATIVE.has(key);
        return `${this.operand(left, own, strict)} ${symbol} ${this.operand(right, own, true)}`;
    },

    /**
     * A call: an operator, an index, a method or a function.
     * @param {object} node - The CallNode.
     * @returns {string} The Ruby.
     */
    callNode(node) {
        const { receiver, name } = node;
        const args = node.arguments;
        if (receiver === null)
            return args === null ? name : `${name}(${args.map((x) => this.expression(x)).join(', ')})`;
        if (name === '-@' || name === '+@') {
            const sign = name[0];
            // `-5` is a number to Ruby, and `-5.abs` is `(-5).abs`: only a variable
            // is written right after the sign.
            const plain = receiver.type === 'InstanceVariableReadNode' || receiver.type === 'LocalVariableReadNode';
            return plain ? `${sign}${this.expression(receiver)}` : `${sign}(${this.expression(receiver)})`;
        }
        if (name === '!') return `!${this.operand(receiver, PRECEDENCE['!'], false)}`;
        if (PRECEDENCE[name]) {
            return this.binary(node, name, receiver, args[0], name);
        }
        const target = this.operand(receiver, PRIMARY, false);
        if (name === '[]') return `${target}[${this.expression(args[0])}]`;
        if (name === '[]=') return `${target}[${this.expression(args[0])}] = ${this.expression(args[1])}`;
        return args.length === 0
            ? `${target}.${name}`
            : `${target}.${name}(${args.map((x) => this.expression(x)).join(', ')})`;
    },

    /**
     * The Ruby of a statement that is one line.
     * @param {object} node - The RubyAST statement.
     * @returns {string} The Ruby.
     */
    simpleStatement(node) {
        switch (node.type) {
            case 'InstanceVariableWriteNode':
            case 'LocalVariableWriteNode':
                return `${node.name} = ${this.expression(node.value)}`;
            case 'InstanceVariableOperatorWriteNode':
            case 'LocalVariableOperatorWriteNode':
                return `${node.name} ${node.operator}= ${this.expression(node.value)}`;
            case 'IndexOperatorWriteNode':
                return `${this.operand(node.receiver, PRIMARY, false)}[${this.expression(node.index)}] ${node.operator}= ${this.expression(
                    node.value,
                )}`;
            case 'MultiWriteNode':
                return `${node.targets.map((t) => (t.name ? t.name : this.simpleTarget(t))).join(', ')} = ${node.values
                    .map((x) => this.expression(x))
                    .join(', ')}`;
            case 'ReturnNode':
                return node.value ? `return ${this.expression(node.value)}` : 'return';
            case 'CommentLine':
                return node.text;
            default:
                return this.expression(node);
        }
    },

    /**
     * An index as the target of a multiple assignment (`A[i], b = 1, 2`).
     * @param {object} node - The `[]=` call without a value.
     * @returns {string} The Ruby.
     */
    simpleTarget(node) {
        return `${this.operand(node.receiver, PRIMARY, false)}[${this.expression(node.arguments[0])}]`;
    },
};

/** Writes lines and keeps the Japanese line of each. */
class LineWriter {
    constructor() {
        this.lines = [];
        this.jaLines = [];
        this.lastJaLine = 0;
    }

    /**
     * Put blank lines for the Japanese lines up to `line` not written yet, so
     * the blank lines of the Japanese stay.
     * @param {number} line - The last Japanese line to fill.
     */
    fill(line) {
        while (this.lastJaLine < line) {
            this.lastJaLine++;
            this.lines.push('');
            this.jaLines.push(this.lastJaLine);
        }
    }

    /**
     * Write a line.
     * @param {number} depth - The block depth.
     * @param {string} text - The Ruby.
     * @param {number} jaLine - The Japanese line.
     * @param {string} [comment] - The comment at its end.
     */
    line(depth, text, jaLine, comment) {
        this.lines.push(`${'  '.repeat(depth)}${text}${typeof comment === 'undefined' ? '' : ` ${comment}`}`);
        this.jaLines.push(jaLine);
    }

    /**
     * Write a statement that starts on a Japanese line.
     * @param {number} depth - The block depth.
     * @param {string} text - The Ruby.
     * @param {object} node - The node (its `jaLine`, `jaEndLine`, `comment`).
     */
    statement(depth, text, node) {
        this.fill(node.jaLine - 1);
        this.line(depth, text, node.jaLine, node.comment);
        this.lastJaLine = Math.max(this.lastJaLine, node.jaEndLine || node.jaLine);
    }

    /**
     * Write `end` (and what comes just before it) of a block.
     * @param {number} depth - The depth of the block.
     * @param {object} node - The block (its `closeLine`, `closeAfter`).
     * @param {Array<object>} [before] - Statements written just before `end`.
     */
    end(depth, node, before = []) {
        // A block that ends by its indent ends after the blank lines before
        // the next code, as it is closed when that code is read.
        this.fill(node.closeAfter);
        before.forEach((s) => this.line(depth + 1, TEXT.simpleStatement(s), node.closeLine, s.comment));
        this.line(depth, 'end', node.closeLine);
    }
}

/**
 * Write statements.
 * @param {LineWriter} out - Where to write.
 * @param {Array<object>} statements - The statements.
 * @param {number} depth - The block depth.
 */
const writeStatements = (out, statements, depth) => {
    statements.forEach((node) => {
        switch (node.type) {
            case 'IfNode': {
                out.statement(depth, `if ${TEXT.expression(node.predicate)}`, node);
                writeStatements(out, node.statements, depth + 1);
                let next = node.subsequent;
                while (next) {
                    if (next.type === 'IfNode') {
                        out.statement(depth, `elsif ${TEXT.expression(next.predicate)}`, next);
                    } else {
                        out.statement(depth, 'else', next);
                    }
                    writeStatements(out, next.statements, depth + 1);
                    next = next.type === 'IfNode' ? next.subsequent : null;
                }
                out.end(depth, node);
                break;
            }
            case 'WhileNode':
            case 'UntilNode': {
                const keyword = node.type === 'WhileNode' ? 'while' : 'until';
                out.statement(depth, `${keyword} ${TEXT.expression(node.predicate)}`, node);
                const body = node.increment ? node.statements.slice(0, -1) : node.statements;
                writeStatements(out, body, depth + 1);
                out.end(depth, node, node.increment ? [node.increment] : []);
                break;
            }
            case 'DefNode':
                out.statement(depth, `def ${node.name}(${node.parameters.join(', ')})`, node);
                writeStatements(out, node.statements, depth + 1);
                out.end(depth, node);
                break;
            default:
                out.statement(depth, TEXT.simpleStatement(node), node);
        }
    });
};

/**
 * Write the Ruby of a RubyAST.
 * @param {object} program - The `ProgramNode`.
 * @param {number} [jaLineCount] - How many lines the Japanese has, so its
 *   blank lines at the end stay.
 * @returns {{ruby: string, jaLines: Array<number>}} The Ruby, and for each of
 *   its lines (index 0 is line 1) the Japanese line it comes from.
 */
const writeRuby = (program, jaLineCount = 0) => {
    const out = new LineWriter();
    writeStatements(out, program.statements, 0);
    out.fill(jaLineCount);
    return { ruby: out.lines.join('\n'), jaLines: out.jaLines };
};

export { writeRuby };
