// SPDX-License-Identifier: MIT
// ja-notation: read the Ruby syntax tree of prism into a JaAST (d of
// docs/ruby-editor/converter-roadmap.md, 2 章). See ../LICENSE.
//
// The JaAST it makes is the one `parse` makes from the Japanese of the same
// program, so the Ruby the library builds from it (`buildRuby`) is the Ruby
// read here: the counting loop of `buildRuby` (`i = 1`, `while i <= 10`, ...,
// `i += 1`) is read back as `For`, the quotient `(a / b).to_i` as `÷`.
//
// What the names and calls of a Ruby system are in the Japanese is given by
// the caller (`options`, see `readRuby`). Ruby that has no Japanese form is
// kept as `RubyCode` (the Ruby as written), and the calls the Japanese does
// not have are told as errors (`unknown-command`), with the numbers written
// in a Ruby notation (`bad-number`) and the post-test loop (`post-test-loop`).
// The lines of the JaAST are the lines of the Ruby. The settings are read from
// the comments at the top (./settings.js), and what they change is changed
// back on the tree: with indexes from 1, `@A[i - 1]` is read as `A[i]`.
import { callOf, childrenOf, field, hasFlag, SourceIndex, statementsOf, typeOf, unwrap } from './prism-reader.js';
import { indexToJa, readSettings } from './settings.js';

/** The binary operators of Ruby that are the same in the Japanese. */
const BINARY_OPERATORS = new Set(['+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=']);

/** The operators of an assignment that changes the value (`i += 1`). */
const OP_ASSIGN_OPERATORS = new Set(['+', '-', '*', '/', '%']);

/** The kinds of node that give a value to a variable. */
const VARIABLE_WRITES = {
    InstanceVariableWriteNode: 'instance',
    LocalVariableWriteNode: 'local',
    ConstantWriteNode: 'constant',
};

/** The kinds of node that change a variable (to tell a counting loop). */
const WRITE_TYPES = new Set([
    'InstanceVariableWriteNode',
    'InstanceVariableOperatorWriteNode',
    'InstanceVariableOrWriteNode',
    'InstanceVariableAndWriteNode',
    'InstanceVariableTargetNode',
]);

/** The statements that hold a body (they take the comments of their own lines). */
const BLOCK_TYPES = new Set(['If', 'While', 'For', 'FunctionDef']);

/**
 * The nodes of a variable of the stage (`$a`, a variable or a list of the
 * stage in Smalruby). The Japanese mode is written for a program that runs
 * alone, as on a terminal, and has no stage: it does not write them (Issue #1706).
 */
const STAGE_VARIABLE_TYPES = new Set([
    'GlobalVariableReadNode',
    'GlobalVariableWriteNode',
    'GlobalVariableOperatorWriteNode',
    'GlobalVariableOrWriteNode',
    'GlobalVariableAndWriteNode',
    'GlobalVariableTargetNode',
]);

/** The keywords that jump in a loop: the Japanese has no such statement. */
const JUMPS = { BreakNode: 'break', NextNode: 'next', RedoNode: 'redo', RetryNode: 'retry' };

/** Reads one program. */
class RubyReader {
    /**
     * @param {object} result - The result of the prism parse (`value`, `comments`, `errors`).
     * @param {string} source - The Ruby source.
     * @param {object} options - See `readRuby`.
     */
    constructor(result, source, options) {
        this.index = new SourceIndex(source);
        this.options = options;
        this.calls = options.calls || {};
        this.passthrough = options.passthrough || new Set();
        this.errors = [];
        // Where each error is (character index), to tell whether a RubyCode has one in it.
        this.errorStarts = [];
        // The errors told already (code and place), so a node read twice is told once.
        this.told = new Set();
        // Ruby prism could not read has nodes of its recovery: only its first error is told.
        this.hasSyntaxErrors = (result.errors || []).length > 0;
        this.rawDepth = 0;
        this.functions = new Set();
        this.collectFunctions(result.value);
        this.readComments(result.comments || []);
        this.settings = this.readSettings(result);
    }

    /**
     * The settings the comments at the top of the Ruby say (before its first
     * statement), so the Japanese is written by them (./settings.js).
     * @param {object} result - The result of the prism parse.
     * @returns {object} The settings.
     */
    readSettings(result) {
        const first = statementsOf(field(result.value, 'statements'))[0];
        const before = first ? this.lineOf(first) : Infinity;
        return readSettings(this.ownComments.filter((entry) => entry.line < before).map((entry) => entry.text));
    }

    /**
     * Note the names of the methods the program defines (anywhere).
     * @param {object} root - The root node.
     */
    collectFunctions(root) {
        const stack = [root];
        while (stack.length > 0) {
            const node = stack.pop();
            if (typeOf(node) === 'DefNode' && field(node, 'receiver') === null)
                this.functions.add(field(node, 'name'));
            stack.push(...childrenOf(node));
        }
    }

    /**
     * Sort the comments into the comments alone on their line and the ones at
     * the end of a line of code.
     * @param {Array<object>} comments - The comments of prism.
     */
    readComments(comments) {
        this.ownComments = [];
        this.lineComments = new Map();
        comments.forEach((comment) => {
            const { start, end } = this.index.span(comment.location);
            const { line, column } = this.index.place(start);
            const text = this.index.source.substring(start, end).replace(/\s+$/, '');
            const entry = { line, start, text, used: false };
            if (this.index.lineText(line).substring(0, column).trim() === '') this.ownComments.push(entry);
            else this.lineComments.set(line, entry);
        });
    }

    /**
     * Take the comments at the end of the lines (joined), or undefined.
     * @param {number} from - The first line.
     * @param {number} [to] - The last line.
     * @returns {?string} The comments (null when there are none).
     */
    takeComments(from, to = from) {
        const texts = [];
        for (let line = from; line <= to; line++) {
            const entry = this.lineComments.get(line);
            if (entry && !entry.used) {
                entry.used = true;
                texts.push(entry.text);
            }
        }
        return texts.length > 0 ? texts.join(' ') : null;
    }

    /**
     * Mark the comments inside a span as written (they are in a `RubyCode`).
     * @param {number} start - The start (character index).
     * @param {number} end - The end.
     */
    useCommentsIn(start, end) {
        const inside = (entry) => entry.start >= start && entry.start < end;
        this.ownComments.forEach((entry) => {
            if (inside(entry)) entry.used = true;
        });
        this.lineComments.forEach((entry) => {
            if (inside(entry)) entry.used = true;
        });
    }

    /**
     * The span of a node (character indexes).
     * @param {object} node - The node.
     * @returns {{start: number, end: number}} The span.
     */
    span(node) {
        return this.index.span(field(node, 'location'));
    }

    /**
     * The first line of a node (or of a location).
     * @param {object} node - The node or location.
     * @returns {number} The line.
     */
    lineOf(node) {
        const loc = typeof node.startOffset === 'number' ? node : field(node, 'location');
        return this.index.place(this.index.charAt(loc.startOffset)).line;
    }

    /**
     * The last line of a node.
     * @param {object} node - The node.
     * @returns {number} The line.
     */
    endLineOf(node) {
        const { start, end } = this.span(node);
        return this.index.place(Math.max(start, end - 1)).line;
    }

    /**
     * The text of a node.
     * @param {object} node - The node.
     * @returns {string} The Ruby.
     */
    text(node) {
        return this.index.text(field(node, 'location'));
    }

    /**
     * Note an error at a node or a location.
     * @param {string} code - `unknown-command`, `bad-number`, `post-test-loop`, `no-ja-form`,
     *   `stage-variable` or `ruby-syntax`.
     * @param {string} message - The message.
     * @param {object} at - The node or location.
     * @param {object} [detail] - More (`name`).
     */
    fail(code, message, at, detail = {}) {
        const loc = typeof at.startOffset === 'number' ? at : field(at, 'location');
        const start = this.index.charAt(loc.startOffset);
        const key = `${code}:${start}`;
        if (this.told.has(key)) return;
        this.told.add(key);
        const { line, column } = this.index.place(start);
        this.errors.push({ code, message, line, column, ...detail });
        this.errorStarts.push(start);
    }

    /**
     * Note a variable of the stage (`$a`; Issue #1706), at its name.
     * @param {object} node - A node of `STAGE_VARIABLE_TYPES`.
     */
    failStageVariable(node) {
        const name = field(node, 'name');
        const at = field(node, 'nameLoc') || node;
        this.fail('stage-variable', `ステージの変数（${name}）は日本語では書けません`, at, { name });
    }

    /**
     * Note Ruby with no Japanese form that no other error tells (`case`, a
     * hash, a symbol, a modifier `unless`; Issue #1740): kept as it is
     * written, it would be read back as Japanese that makes no sense (`@`,
     * `{`), so it is told where it is. A node led by a keyword is told at the
     * keyword (`unless` of `puts(1) unless x`) and named by it; any other by
     * its text (its first line, cut at 20 characters).
     * @param {object} node - The node.
     */
    failNoForm(node) {
        const fields = node.toJSON();
        const keyword = Object.keys(fields)
            .filter((key) => /(?:^k|K)eywordLoc$/.test(key) && !/^(?:end|then)/.test(key) && fields[key])
            .map((key) => fields[key])
            .sort((a, b) => a.startOffset - b.startOffset)[0];
        const text = keyword ? this.index.text(keyword) : this.text(node).split('\n')[0].trimEnd();
        const name = [...text].length > 20 ? `${[...text].slice(0, 20).join('')}…` : text;
        this.fail('no-ja-form', `「${name}」は日本語では書けません`, keyword || node, { name });
    }

    /**
     * Note a call the Japanese does not have.
     * @param {object} call - The call (`callOf`).
     */
    failCall(call) {
        const at = field(call.node, 'messageLoc') || call.node;
        this.fail('unknown-command', `「${call.name}」は日本語では書けない命令です`, at, { name: call.name });
    }

    /**
     * Ruby with no Japanese form, kept as it is written. Its parts are still
     * read, so the calls and numbers in it are told, and when none of them
     * is, the Ruby itself is (`no-ja-form`).
     * @param {object} node - The node.
     * @returns {object} The RubyCode.
     */
    raw(node) {
        const { start, end } = this.span(node);
        this.useCommentsIn(start, end);
        // An error already told at this Ruby (a call the Japanese does not
        // have, `break`, the post-test loop) says why it is kept.
        const told = this.errorStarts.some((at) => at >= start && at < end);
        // The Ruby inside it is a part of it: only the outermost is told.
        this.rawDepth += 1;
        this.scan(node);
        this.rawDepth -= 1;
        if (!told && this.rawDepth === 0 && !this.hasSyntaxErrors) this.failNoForm(node);
        const { line, column } = this.index.place(start);
        return { type: 'RubyCode', text: this.index.source.substring(start, end), line, column, indent: column };
    }

    /**
     * Read the parts of a node only for their errors.
     * @param {object} node - The node.
     */
    scan(node) {
        childrenOf(node).forEach((child) => {
            const type = typeOf(child);
            if (type === 'StatementsNode') this.statements(statementsOf(child), null);
            else if (type === 'BlockNode') this.scan(child);
            else if (type) this.expression(child);
        });
    }

    /**
     * A JaAST statement with its place.
     * @param {object} node - The prism node it comes from.
     * @param {object} fields - The fields.
     * @param {object} [where] - `line` / `endLine` (the node's own by default).
     * @returns {object} The statement.
     */
    at(node, fields, where = {}) {
        const line = where.line || this.lineOf(node);
        return { ...fields, line, column: 0, endLine: where.endLine || this.endLineOf(node) };
    }

    /**
     * Statements, with the comments alone on their lines between them.
     * @param {Array<object>} nodes - The prism statements.
     * @param {?{from: number, to: number}} range - The lines the body has (null
     *   when the statements are only read for their errors).
     * @returns {Array<object>} The JaAST statements.
     */
    statements(nodes, range) {
        const out = [];
        for (let i = 0; i < nodes.length; i++) {
            const pair = this.countingLoop(nodes[i], nodes[i + 1]) || this.input(nodes[i], nodes[i + 1]);
            if (pair) {
                out.push(pair);
                i++;
                continue;
            }
            const alone = this.inputAlone(nodes[i]);
            if (alone) {
                out.push(alone);
                continue;
            }
            const statement = this.statement(nodes[i]);
            if (!BLOCK_TYPES.has(statement.type)) {
                const comment = this.takeComments(statement.line, statement.endLine);
                if (comment) statement.comment = comment;
            }
            out.push(statement);
        }
        if (!range) return out;
        this.ownComments.forEach((entry) => {
            if (entry.used || entry.line < range.from || entry.line > range.to) return;
            entry.used = true;
            out.push({ type: 'Comment', text: entry.text, line: entry.line, column: 0, endLine: entry.line });
        });
        return out.sort((a, b) => a.line - b.line);
    }

    /**
     * One statement.
     * @param {object} node - The prism statement.
     * @returns {object} The JaAST statement.
     */
    statement(node) {
        const type = typeOf(node);
        switch (type) {
            case 'IfNode':
                return this.ifStatement(node);
            case 'WhileNode':
            case 'UntilNode':
                return this.loopStatement(node, type === 'UntilNode');
            case 'DefNode':
                return this.functionDef(node);
            case 'ReturnNode': {
                const args = field(node, 'arguments');
                const values = args ? field(args, 'arguments') : [];
                if (values.length > 1) return this.rawStatement(node);
                return this.at(node, { type: 'Return', value: values[0] ? this.expression(values[0]) : null });
            }
            case 'MultiWriteNode':
                return this.multiAssign(node);
            case 'GlobalVariableWriteNode':
            case 'GlobalVariableOperatorWriteNode':
            case 'GlobalVariableOrWriteNode':
            case 'GlobalVariableAndWriteNode':
                this.failStageVariable(node);
                return this.rawStatement(node);
            case 'InstanceVariableOperatorWriteNode':
            case 'LocalVariableOperatorWriteNode':
            case 'ConstantOperatorWriteNode':
            case 'IndexOperatorWriteNode':
                return this.opAssign(node);
            default:
                break;
        }
        if (VARIABLE_WRITES[type]) {
            const target = this.target(node);
            if (!target) return this.rawStatement(node);
            return this.at(node, { type: 'Assign', target, value: this.expression(field(node, 'value')) });
        }
        if (JUMPS[type]) {
            this.fail('unknown-command', `「${JUMPS[type]}」は日本語では書けない命令です`, node, {
                name: JUMPS[type],
            });
            return this.rawStatement(node);
        }
        const call = callOf(node);
        if (call && call.name === '[]=' && call.receiver && call.args && call.args.length === 2 && !call.block) {
            const target = this.indexOf(call.receiver, call.args[0]);
            return this.at(node, { type: 'Assign', target, value: this.expression(call.args[1]) });
        }
        if (call && call.block) return this.blockCall(call);
        const append = this.append(node, call);
        if (append) return append;
        const expression = this.expression(node);
        if (expression.type === 'RubyCode') return this.at(node, { ...expression, type: 'RubyCode' });
        return this.at(node, { type: 'ExpressionStatement', expression });
    }

    /**
     * `A.push(値)` / `A << 値` of an array variable: `A に 値 を追加する` (Issue #1759).
     * @param {object} node - The statement.
     * @param {?object} call - The call of the statement.
     * @returns {?object} The Append statement, or null when it is not one.
     */
    append(node, call) {
        if (!call || (call.name !== 'push' && call.name !== '<<') || !call.receiver || call.block) return null;
        if (!call.args || call.args.length !== 1) return null;
        // `$a.push(1)`: the list of the stage is told, not the call (Issue #1706).
        if (STAGE_VARIABLE_TYPES.has(typeOf(call.receiver))) {
            this.failStageVariable(call.receiver);
            return this.rawStatement(node);
        }
        const target = this.expression(call.receiver);
        if (target.type !== 'Name') return null;
        return this.at(node, { type: 'Append', target, value: this.expression(call.args[0]) });
    }

    /**
     * A statement with no Japanese form.
     * @param {object} node - The node.
     * @returns {object} The RubyCode statement.
     */
    rawStatement(node) {
        return this.at(node, this.raw(node));
    }

    /**
     * The target of a variable write, or null when the variable has no Japanese name.
     * @param {object} node - The write (or target) node.
     * @returns {?object} The Name.
     */
    target(node) {
        const type = typeOf(node);
        const name = field(node, 'name');
        if (type.startsWith('Local')) return { type: 'Name', name, line: this.lineOf(node), column: 0 };
        // With no table, a name in capitals is a constant (`A = 3`, as `buildRuby` writes it).
        if (type.startsWith('Constant') && !this.options.variable) {
            return { type: 'Name', name, line: this.lineOf(node), column: 0 };
        }
        if (!type.startsWith('InstanceVariable')) return null;
        const ja = this.options.variable ? this.options.variable(name) : name;
        return ja ? { type: 'Name', name: ja, line: this.lineOf(node), column: 0 } : null;
    }

    /**
     * An element of an array.
     * @param {object} receiver - The array.
     * @param {object} index - The index.
     * @returns {object} The Index.
     */
    indexOf(receiver, index) {
        const target = this.expression(receiver);
        const ja = indexToJa(this.expression(index), this.settings);
        return { type: 'Index', target, index: ja, line: target.line, column: target.column };
    }

    /**
     * `a, b = 1, 2`.
     * @param {object} node - The MultiWriteNode.
     * @returns {object} The statement.
     */
    multiAssign(node) {
        const lefts = field(node, 'lefts');
        const value = field(node, 'value');
        const targets = lefts.map((left) => {
            const type = typeOf(left);
            if (/^(?:InstanceVariable|LocalVariable|Constant)TargetNode$/.test(type)) return this.target(left);
            if (STAGE_VARIABLE_TYPES.has(type)) {
                this.failStageVariable(left);
                return null;
            }
            // `@a[0], @a[1] = @a[1], @a[0]`: an element of an array (Issue #2237).
            if (type === 'IndexTargetNode') {
                const args = field(left, 'arguments');
                const indexes = args ? field(args, 'arguments') : [];
                if (indexes.length !== 1 || field(left, 'block')) return null;
                return this.indexOf(field(left, 'receiver'), indexes[0]);
            }
            return null;
        });
        const plain =
            field(node, 'rest') === null &&
            field(node, 'rights').length === 0 &&
            targets.every(Boolean) &&
            typeOf(value) === 'ArrayNode' &&
            field(value, 'openingLoc') === null;
        if (!plain) return this.rawStatement(node);
        const values = field(value, 'elements').map((element) => this.expression(element));
        return this.at(node, { type: 'MultiAssign', targets, values });
    }

    /**
     * `i += 1`, `A[i] += 1`.
     * @param {object} node - The operator write.
     * @returns {object} The statement.
     */
    opAssign(node) {
        const operator = field(node, 'binaryOperator');
        if (!OP_ASSIGN_OPERATORS.has(operator)) return this.rawStatement(node);
        let target;
        if (typeOf(node) === 'IndexOperatorWriteNode') {
            const args = field(node, 'arguments');
            const indexes = args ? field(args, 'arguments') : [];
            if (indexes.length !== 1 || field(node, 'block')) return this.rawStatement(node);
            target = this.indexOf(field(node, 'receiver'), indexes[0]);
        } else {
            target = this.target(node);
        }
        if (!target) return this.rawStatement(node);
        return this.at(node, { type: 'OpAssign', target, operator, value: this.expression(field(node, 'value')) });
    }

    /**
     * `if`, `elsif`, `else`. A modifier (`x if a`) has no Japanese form.
     * @param {object} node - The IfNode.
     * @returns {object} The If.
     */
    ifStatement(node) {
        const end = field(node, 'endKeywordLoc');
        if (!end) return this.rawStatement(node);
        const closeLine = this.lineOf(end);
        const line = this.lineOf(node);
        const parts = [];
        let current = node;
        while (current && typeOf(current) === 'IfNode') {
            parts.push({ node: current, line: this.lineOf(field(current, 'ifKeywordLoc') || current) });
            current = field(current, 'subsequent');
        }
        const elseNode = current && typeOf(current) === 'ElseNode' ? current : null;
        const elseLine = elseNode ? this.lineOf(field(elseNode, 'elseKeywordLoc')) : null;
        const statement = { type: 'If', branches: [], elseBody: null, elseLine, line, column: 0, endLine: closeLine };
        const ends = [...parts.slice(1).map((part) => part.line), elseLine || closeLine, closeLine];
        parts.forEach((part, i) => {
            const predicate = field(part.node, 'predicate');
            const condition = this.expression(predicate);
            const comment = this.takeComments(part.line, this.endLineOf(predicate));
            const range = { from: part.line + 1, to: ends[i] - 1 };
            const branch = { condition, body: this.statements(statementsOf(field(part.node, 'statements')), range) };
            branch.line = part.line;
            if (i === 0 && comment) statement.comment = comment;
            if (i > 0 && comment) branch.comment = comment;
            statement.branches.push(branch);
        });
        if (elseNode) {
            const elseComment = this.takeComments(elseLine);
            if (elseComment) statement.elseComment = elseComment;
            const range = { from: elseLine + 1, to: closeLine - 1 };
            statement.elseBody = this.statements(statementsOf(field(elseNode, 'statements')), range);
        }
        statement.closeLine = closeLine;
        const closeComment = this.takeComments(closeLine);
        if (closeComment) statement.closeComment = closeComment;
        return statement;
    }

    /**
     * `while` / `until`. `until c` is `not c の間繰り返す`, and `wait until c`
     * (a loop with only `wait`) an empty loop, which waits the same way.
     * `begin ... end while c` (the post-test loop) has no Japanese form.
     * @param {object} node - The WhileNode or UntilNode.
     * @param {boolean} until - Whether it is an `until`.
     * @returns {object} The While (or the RubyCode).
     */
    loopStatement(node, until) {
        const predicate = field(node, 'predicate');
        if (hasFlag(node, 'isBeginModifier')) {
            const message = '後判定の繰り返しは日本語では書けません';
            const body = statementsOf(field(node, 'statements'));
            this.fail('post-test-loop', message, body[0] || node);
            this.fail('post-test-loop', message, field(node, 'keywordLoc'));
            return this.rawStatement(node);
        }
        const negate = (condition) => ({
            type: 'Unary',
            operator: 'not',
            operand: condition,
            line: condition.line,
            column: condition.column,
        });
        const closing = field(node, 'closingLoc');
        if (!closing) {
            const body = statementsOf(field(node, 'statements'));
            const call = body.length === 1 ? callOf(body[0]) : null;
            const isWait = call && call.name === 'wait' && !call.receiver && call.isVariableCall;
            if (!until || !isWait) return this.rawStatement(node);
            const line = this.lineOf(node);
            return {
                type: 'While',
                condition: negate(this.expression(predicate)),
                body: [],
                line,
                column: 0,
                endLine: line,
            };
        }
        const line = this.lineOf(field(node, 'keywordLoc'));
        const closeLine = this.lineOf(closing);
        const condition = this.expression(predicate);
        const comment = this.takeComments(line, this.endLineOf(predicate));
        const range = { from: line + 1, to: closeLine - 1 };
        const statement = {
            type: 'While',
            condition: until ? negate(condition) : condition,
            body: this.statements(statementsOf(field(node, 'statements')), range),
            line,
            column: 0,
            endLine: closeLine,
            closeLine,
        };
        if (comment) statement.comment = comment;
        const closeComment = this.takeComments(closeLine);
        if (closeComment) statement.closeComment = closeComment;
        return statement;
    }

    /**
     * `def name(a, b)`. Only plain parameters have a Japanese form.
     * @param {object} node - The DefNode.
     * @returns {object} The FunctionDef.
     */
    functionDef(node) {
        const parameters = field(node, 'parameters');
        const body = field(node, 'body');
        const end = field(node, 'endKeywordLoc');
        const plain =
            field(node, 'receiver') === null &&
            end !== null &&
            (body === null || typeOf(body) === 'StatementsNode') &&
            (parameters === null ||
                ['optionals', 'posts', 'keywords'].every((key) => field(parameters, key).length === 0)) &&
            (parameters === null || ['rest', 'keywordRest', 'block'].every((key) => field(parameters, key) === null));
        if (!plain) return this.rawStatement(node);
        const params = parameters ? field(parameters, 'requireds').map((p) => field(p, 'name')) : [];
        if (params.some((p) => typeof p !== 'string')) return this.rawStatement(node);
        const line = this.lineOf(node);
        const closeLine = this.lineOf(end);
        const comment = this.takeComments(line);
        const statement = {
            type: 'FunctionDef',
            name: field(node, 'name'),
            params,
            body: this.statements(statementsOf(body), { from: line + 1, to: closeLine - 1 }),
            line,
            column: 0,
            endLine: closeLine,
            closeLine,
        };
        if (comment) statement.comment = comment;
        const closeComment = this.takeComments(closeLine);
        if (closeComment) statement.closeComment = closeComment;
        return statement;
    }

    /**
     * A call with a block. `n.times do`, `(a..b).step(s) do |i|` and
     * `a.step(b, -s) do |i|` are counting loops; any other has no Japanese form.
     * @param {object} call - The call.
     * @returns {object} The statement.
     */
    blockCall(call) {
        const loop = this.iteratorLoop(call);
        if (loop) return loop;
        if (!this.isKnownCall(call)) this.failCall(call);
        return this.rawStatement(call.node);
    }

    /**
     * The counting loop of a Ruby iterator, or null.
     * @param {object} call - The call.
     * @returns {?object} The For.
     */
    iteratorLoop(call) {
        const block = call.block;
        if (typeOf(block) !== 'BlockNode' || !call.receiver || !call.args) return null;
        const body = field(block, 'body');
        if (body !== null && typeOf(body) !== 'StatementsNode') return null;
        const blockParams = field(block, 'parameters');
        const params = blockParams && field(blockParams, 'parameters');
        const names = params ? field(params, 'requireds').map((p) => field(p, 'name')) : [];
        let variable = null;
        let from;
        let to;
        let step;
        let direction = 'up';
        const one = { type: 'Number', value: '1', line: 0, column: 0 };
        if (call.name === 'times' && call.args.length === 0 && !blockParams) {
            variable = '_';
            from = one;
            to = this.expression(call.receiver);
            step = one;
        } else if (call.name === 'step' && names.length === 1 && !params.rest) {
            const range = unwrap(call.receiver);
            if (call.args.length === 1 && typeOf(range) === 'RangeNode' && !hasFlag(range, 'isExcludeEnd')) {
                if (!field(range, 'left') || !field(range, 'right')) return null;
                from = this.expression(field(range, 'left'));
                to = this.expression(field(range, 'right'));
                step = this.expression(call.args[0]);
            } else if (call.args.length === 2) {
                const negated = this.negatedOperand(call.args[1]);
                if (!negated) return null;
                from = this.expression(call.receiver);
                to = this.expression(call.args[0]);
                step = negated;
                direction = 'down';
            } else {
                return null;
            }
            variable = names[0];
        } else {
            return null;
        }
        const line = this.lineOf(call.node);
        const closeLine = this.endLineOf(call.node);
        const comment = this.takeComments(line);
        const statement = {
            type: 'For',
            variable: { type: 'Name', name: variable, line, column: 0 },
            from,
            to,
            step,
            direction,
            body: this.statements(statementsOf(body), { from: line + 1, to: closeLine - 1 }),
            line,
            column: 0,
            endLine: closeLine,
            closeLine,
        };
        if (comment) statement.comment = comment;
        const closeComment = this.takeComments(closeLine);
        if (closeComment) statement.closeComment = closeComment;
        return statement;
    }

    /**
     * The JaAST of `X` when the node is `-X` (or a negative number), else null.
     * @param {object} node - The node.
     * @returns {?object} The expression of `X`.
     */
    negatedOperand(node) {
        const type = typeOf(node);
        if ((type === 'IntegerNode' || type === 'FloatNode') && this.text(node).startsWith('-')) {
            const number = this.expression(node);
            return number.operand;
        }
        const call = callOf(node);
        if (call && call.name === '-@' && call.receiver) return this.expression(call.receiver);
        return null;
    }

    /**
     * The variable or element a statement gives a value to, and the value
     * (`x = v`, `A[i] = v`), or null.
     * @param {object} node - The statement.
     * @returns {?{target: object, value: object}} The target (`{write}` for an element) and the value.
     */
    assignmentOf(node) {
        if (VARIABLE_WRITES[typeOf(node)]) return { target: this.target(node), value: field(node, 'value') };
        const write = callOf(node);
        if (write && write.name === '[]=' && write.receiver && write.args && write.args.length === 2) {
            return { target: { write }, value: write.args[1] };
        }
        return null;
    }

    /**
     * The Input of an assignment whose value is the input, of the kind the
     * caller tells.
     * @param {{target: object, value: object}} assignment - The assignment (`assignmentOf`).
     * @param {function(object, object): ?string} kindOf - The kind of input the value is.
     * @param {number} line - The first line of the Input.
     * @param {number} endLine - The last line of the Input.
     * @returns {?object} The Input, or null.
     */
    inputOf(assignment, kindOf, line, endLine) {
        let target = assignment && assignment.target;
        const kind = target && kindOf(assignment.value, this.helpers());
        if (!kind) return null;
        if (target.write) target = this.indexOf(target.write.receiver, target.write.args[0]);
        const statement = { type: 'Input', target, kind, line, column: 0, endLine };
        const comment = this.takeComments(line, endLine);
        if (comment) statement.comment = comment;
        return statement;
    }

    /**
     * `x = 【外部からの入力】`: the question of an input and the assignment of
     * its answer on the next line, as the caller tells them (`options.input`).
     * @param {object} node - The statement.
     * @param {object} [next] - The statement after it.
     * @returns {?object} The Input, or null.
     */
    input(node, next) {
        const input = this.options.input;
        const call = callOf(node);
        if (!input || !input.isQuestion || !next || !call || !input.isQuestion(call, this.helpers())) return null;
        if (this.lineOf(next) !== this.endLineOf(node) + 1) return null;
        return this.inputOf(
            this.assignmentOf(next),
            (value, helpers) => input.kindOf(value, helpers),
            this.lineOf(node),
            this.endLineOf(next),
        );
    }

    /**
     * `x = 【外部からの入力】` on one line: an assignment of a value that is the
     * input by itself, as the caller tells (`options.input.kindOfAlone`).
     * @param {object} node - The statement.
     * @returns {?object} The Input, or null.
     */
    inputAlone(node) {
        const input = this.options.input;
        if (!input || !input.kindOfAlone) return null;
        return this.inputOf(
            this.assignmentOf(node),
            (value, helpers) => input.kindOfAlone(value, helpers),
            this.lineOf(node),
            this.endLineOf(node),
        );
    }

    /**
     * `i = 1` and `while i <= 10 ... i += 1 end` on the lines after it: the
     * counting loop `buildRuby` writes. Only an instance variable counts, the
     * last line of the body adds a step to it the way the condition goes
     * (`<=` up, `>=` down), and nothing else in the body changes the variable
     * or the step. Any other `while` stays a `の間` loop.
     * @param {object} init - The statement.
     * @param {object} [loop] - The statement after it.
     * @returns {?object} The For, or null.
     */
    countingLoop(init, loop) {
        if (!loop || typeOf(init) !== 'InstanceVariableWriteNode' || typeOf(loop) !== 'WhileNode') return null;
        if (hasFlag(loop, 'isBeginModifier') || !field(loop, 'closingLoc')) return null;
        if (this.lineOf(loop) !== this.endLineOf(init) + 1) return null;
        const name = field(init, 'name');
        const condition = callOf(field(loop, 'predicate'));
        if (!condition || (condition.name !== '<=' && condition.name !== '>=')) return null;
        if (!condition.args || condition.args.length !== 1) return null;
        if (typeOf(condition.receiver) !== 'InstanceVariableReadNode' || field(condition.receiver, 'name') !== name) {
            return null;
        }
        const body = statementsOf(field(loop, 'statements'));
        const last = body[body.length - 1];
        const closeLine = this.lineOf(field(loop, 'closingLoc'));
        if (!last) return null;
        // A comment line after the increment would come before the end of the loop.
        if (this.ownComments.some((c) => c.line > this.endLineOf(last) && c.line < closeLine)) return null;
        const increment = this.increment(last, name);
        if (!increment || increment.up !== (condition.name === '<=')) return null;
        const watched = new Set([name, ...this.instanceVariablesOf(increment.step)]);
        if (this.instanceVariablesOf(increment.step).includes(name)) return null;
        if (body.slice(0, -1).some((node) => this.writesAny(node, watched))) return null;
        const target = this.target(init);
        if (!target) return null;
        const line = this.lineOf(init);
        const whileLine = this.lineOf(loop);
        const statement = {
            type: 'For',
            variable: target,
            from: this.expression(field(init, 'value')),
            to: this.expression(condition.args[0]),
            step: increment.negativeNumber
                ? this.expression(increment.step).operand
                : this.expression(increment.step),
            direction: increment.up ? 'up' : 'down',
            body: null,
            line,
            column: 0,
            endLine: closeLine,
            closeLine,
        };
        const comment = this.takeComments(line, this.endLineOf(field(loop, 'predicate')));
        if (comment) statement.comment = comment;
        statement.body = this.statements(body.slice(0, -1), { from: whileLine + 1, to: closeLine - 1 });
        const closeComment = this.takeComments(this.lineOf(last), closeLine);
        if (closeComment) statement.closeComment = closeComment;
        return statement;
    }

    /**
     * The step of an increment of the variable: `+=` / `-=` a step, or the
     * variable set to itself plus or minus one term. A negated step (`+= -1`,
     * how `buildRuby` writes `ずつ減らしながら`) counts the other way.
     * @param {object} node - The statement.
     * @param {string} name - The variable.
     * @returns {?{step: object, up: boolean}} The step (a prism node), or null.
     */
    increment(node, name) {
        let sign;
        let rhs;
        const type = typeOf(node);
        if (type === 'InstanceVariableOperatorWriteNode' && field(node, 'name') === name) {
            sign = field(node, 'binaryOperator');
            rhs = field(node, 'value');
        } else if (type === 'InstanceVariableWriteNode' && field(node, 'name') === name) {
            const call = callOf(field(node, 'value'));
            if (!call || (call.name !== '+' && call.name !== '-') || !call.args || call.args.length !== 1)
                return null;
            if (typeOf(call.receiver) !== 'InstanceVariableReadNode' || field(call.receiver, 'name') !== name) {
                return null;
            }
            if (!this.isSimpleStep(call.args[0])) return null;
            sign = call.name;
            rhs = call.args[0];
        } else {
            return null;
        }
        if (sign !== '+' && sign !== '-') return null;
        const negatedCall = callOf(rhs);
        let step = rhs;
        let up = sign === '+';
        if (negatedCall && negatedCall.name === '-@' && negatedCall.receiver) {
            step = negatedCall.receiver;
            // `- -1` is not a step of a counting loop the Japanese writes.
            if (/^(?:Integer|Float)Node$/.test(typeOf(step)) && this.text(step).startsWith('-')) return null;
            up = !up;
        } else if (/^(?:Integer|Float)Node$/.test(typeOf(rhs)) && this.text(rhs).startsWith('-')) {
            return { step: rhs, up: !up, negativeNumber: true };
        }
        if (!this.isPureStep(step)) return null;
        return { step, up };
    }

    /**
     * One term: a number, an instance variable, or one made a number (`.to_i` / `.to_f`).
     * @param {object} node - The node.
     * @returns {boolean} True if it is.
     */
    isSimpleStep(node) {
        const type = typeOf(node);
        if (type === 'IntegerNode' || type === 'FloatNode') return !this.text(node).startsWith('-');
        if (type === 'InstanceVariableReadNode') return true;
        const call = callOf(node);
        return Boolean(
            call &&
            (call.name === 'to_i' || call.name === 'to_f') &&
            call.args &&
            call.args.length === 0 &&
            typeOf(call.receiver) === 'InstanceVariableReadNode',
        );
    }

    /**
     * A step of numbers and instance variables only, with no calls that could change things.
     * @param {object} node - The node.
     * @returns {boolean} True if it is.
     */
    isPureStep(node) {
        const type = typeOf(node);
        if (type === 'IntegerNode' || type === 'FloatNode' || type === 'InstanceVariableReadNode') return true;
        if (type === 'ParenthesesNode') {
            const body = statementsOf(field(node, 'body'));
            return body.length === 1 && this.isPureStep(body[0]);
        }
        const call = callOf(node);
        if (!call || !call.receiver || !call.args || call.block) return false;
        if ((call.name === 'to_i' || call.name === 'to_f') && call.args.length === 0) {
            return this.isPureStep(call.receiver);
        }
        if (['+', '-', '*', '/', '%'].includes(call.name) && call.args.length === 1) {
            return this.isPureStep(call.receiver) && this.isPureStep(call.args[0]);
        }
        return call.name === '-@' && call.args.length === 0 && this.isPureStep(call.receiver);
    }

    /**
     * The instance variables a node reads.
     * @param {object} node - The node.
     * @returns {Array<string>} The names.
     */
    instanceVariablesOf(node) {
        const names = [];
        const stack = [node];
        while (stack.length > 0) {
            const current = stack.pop();
            if (typeOf(current) === 'InstanceVariableReadNode') names.push(field(current, 'name'));
            stack.push(...childrenOf(current));
        }
        return names;
    }

    /**
     * Whether a node (or a node in it) gives a value to one of the instance variables.
     * @param {object} node - The node.
     * @param {Set<string>} names - The names.
     * @returns {boolean} True if it does.
     */
    writesAny(node, names) {
        const stack = [node];
        while (stack.length > 0) {
            const current = stack.pop();
            if (WRITE_TYPES.has(typeOf(current)) && names.has(field(current, 'name'))) return true;
            stack.push(...childrenOf(current));
        }
        return false;
    }

    /**
     * The helpers the tables of the caller read Ruby with.
     * @returns {object} The helpers.
     */
    helpers() {
        if (!this.helperSet) {
            this.helperSet = {
                expression: (node) => this.expression(node),
                call: (name, args) => ({ type: 'Call', name, args, line: 0, column: 0 }),
                callOf,
                typeOf,
                unwrap,
                text: (node) => this.text(node),
            };
        }
        return this.helperSet;
    }

    /**
     * Whether the Japanese has a call: a name of the caller's system, or a
     * function the program defines.
     * @param {object} call - The call.
     * @returns {boolean} True if it has.
     */
    isKnownCall(call) {
        if (call.receiver) return false;
        return this.functions.has(call.name) || this.passthrough.has(call.name);
    }

    /**
     * An expression.
     * @param {object} node - The prism node.
     * @returns {object} The JaAST expression.
     */
    expression(node) {
        const where = { line: this.lineOf(node), column: this.index.place(this.span(node).start).column };
        const type = typeOf(node);
        switch (type) {
            case 'IntegerNode':
            case 'FloatNode':
                return this.number(node, where);
            case 'RationalNode':
            case 'ImaginaryNode': {
                const text = this.text(node);
                this.fail('bad-number', `「${text}」は日本語では書けない数です`, node, { name: text });
                return { type: 'Number', value: text, ...where };
            }
            case 'StringNode': {
                const text = this.text(node);
                if (!/^["']/.test(text)) return this.raw(node);
                return { type: 'String', raw: text, ...where };
            }
            case 'TrueNode':
            case 'FalseNode':
                return { type: 'Boolean', value: type === 'TrueNode', ...where };
            case 'InstanceVariableReadNode': {
                const name = this.options.variable ? this.options.variable(field(node, 'name')) : field(node, 'name');
                return name ? { type: 'Name', name, ...where } : this.raw(node);
            }
            case 'LocalVariableReadNode':
                return { type: 'Name', name: field(node, 'name'), ...where };
            case 'GlobalVariableReadNode':
                this.failStageVariable(node);
                return this.raw(node);
            case 'ConstantReadNode':
                // With no table, a name in capitals is a constant (see `target`).
                return this.options.variable ? this.raw(node) : { type: 'Name', name: field(node, 'name'), ...where };
            case 'ArrayNode':
                if (field(node, 'openingLoc') === null || !/^\[/.test(this.text(node))) return this.raw(node);
                return {
                    type: 'ArrayLiteral',
                    elements: field(node, 'elements').map((element) => this.expression(element)),
                    ...where,
                };
            case 'ParenthesesNode': {
                const body = statementsOf(field(node, 'body'));
                if (body.length !== 1) return this.raw(node);
                return this.expression(body[0]);
            }
            case 'RangeNode':
                if (!field(node, 'left') || !field(node, 'right')) return this.raw(node);
                return this.binary(
                    hasFlag(node, 'isExcludeEnd') ? '...' : '..',
                    field(node, 'left'),
                    field(node, 'right'),
                    where,
                );
            case 'AndNode':
                return this.binary('and', field(node, 'left'), field(node, 'right'), where);
            case 'OrNode':
                return this.binary('or', field(node, 'left'), field(node, 'right'), where);
            case 'CallNode':
                return this.callExpression(node, where);
            default:
                return this.raw(node);
        }
    }

    /**
     * A number, as written. A negative one is a sign and the number, as the
     * Japanese reads `-5`. A notation the Japanese does not have (`0x5`,
     * `1_000`, `1e3`, `017`, which is octal in Ruby) is told.
     * @param {object} node - The IntegerNode or FloatNode.
     * @param {object} where - The place.
     * @returns {object} The Number (or Unary).
     */
    number(node, where) {
        const text = this.text(node);
        const negative = text.startsWith('-');
        const digits = negative ? text.substring(1) : text;
        if (!/^\d+(?:\.\d+)?$/.test(digits) || /^0\d/.test(digits)) {
            const loc = field(node, 'location');
            const at = negative ? { startOffset: loc.startOffset + 1, length: loc.length - 1 } : loc;
            this.fail('bad-number', `「${digits}」は日本語では書けない数です`, at, { name: digits });
        }
        const number = { type: 'Number', value: digits, ...where };
        return negative ? { type: 'Unary', operator: '-', operand: number, ...where } : number;
    }

    /**
     * A binary operator.
     * @param {string} operator - The operator of the Japanese.
     * @param {object} left - The prism left side.
     * @param {object} right - The prism right side.
     * @param {object} where - The place.
     * @returns {object} The Binary.
     */
    binary(operator, left, right, where) {
        // A long chain (`a && b && ... && z`, thousands of terms) is as deep as
        // its terms on the left: the left side is followed in a loop, not by
        // recursion, so it does not run out of the stack.
        const chain = [{ operator, right, where }];
        let base = left;
        for (;;) {
            const step = this.binaryStep(base);
            if (!step) break;
            chain.push(step);
            base = step.left;
        }
        let result = this.expression(base);
        for (let i = chain.length - 1; i >= 0; i--) {
            const step = chain[i];
            result = {
                type: 'Binary',
                operator: step.operator,
                left: result,
                right: this.expression(step.right),
                ...step.where,
            };
        }
        return result;
    }

    /**
     * The operator, sides and place of a node that is a binary operator, or null.
     * @param {object} node - The node.
     * @returns {?object} `{operator, left, right, where}` (prism sides).
     */
    binaryStep(node) {
        const type = typeOf(node);
        const where = () => ({ line: this.lineOf(node), column: this.index.place(this.span(node).start).column });
        if (type === 'AndNode' || type === 'OrNode') {
            const operator = type === 'AndNode' ? 'and' : 'or';
            return { operator, left: field(node, 'left'), right: field(node, 'right'), where: where() };
        }
        const call = callOf(node);
        if (
            call &&
            !call.block &&
            call.receiver &&
            call.args &&
            call.args.length === 1 &&
            BINARY_OPERATORS.has(call.name)
        ) {
            return { operator: call.name, left: call.receiver, right: call.args[0], where: where() };
        }
        return null;
    }

    /**
     * A sign or `not`. A minus before a quotient is written as the Japanese
     * reads it (`-a ÷ 2` is `-(a ÷ 2)`): the sign on the left of `÷`.
     * @param {string} operator - `-`, `+` or `not`.
     * @param {object} operand - The JaAST operand.
     * @param {object} where - The place.
     * @returns {object} The expression.
     */
    unary(operator, operand, where) {
        if (operator === '-' && operand.type === 'Binary' && operand.operator === '÷') {
            return { ...operand, left: { type: 'Unary', operator, operand: operand.left, ...where } };
        }
        return { type: 'Unary', operator, operand, ...where };
    }

    /**
     * A call: an operator, an index, the quotient, a call of the caller's
     * table, a function of the program, or one the Japanese does not have.
     * @param {object} node - The CallNode.
     * @param {object} where - The place.
     * @returns {object} The expression.
     */
    callExpression(node, where) {
        const call = callOf(node);
        const { name, receiver, args } = call;
        if (call.block || !args) {
            if (!this.isKnownCall(call)) this.failCall(call);
            return this.raw(node);
        }
        if (receiver && args.length === 0) {
            if (name === '!') {
                const negated = this.unary('not', this.expression(receiver), where);
                if (typeOf(receiver) === 'ParenthesesNode') negated.parens = true;
                return negated;
            }
            if (name === '-@' || name === '+@') return this.unary(name[0], this.expression(receiver), where);
        }
        if (receiver && args.length === 1 && BINARY_OPERATORS.has(name)) {
            return this.binary(name, receiver, args[0], where);
        }
        if (receiver && args.length === 1 && name === '[]') return { ...this.indexOf(receiver, args[0]), ...where };
        const quotient = name === 'to_i' && receiver && args.length === 0 ? callOf(unwrap(receiver)) : null;
        if (quotient && quotient.name === '/' && quotient.receiver && quotient.args && quotient.args.length === 1) {
            const left = this.expression(quotient.receiver);
            // `(-a / 2).to_i` is not `-a ÷ 2`, which the Japanese reads as `-(a ÷ 2)`.
            if (!(left.type === 'Unary' && left.operator === '-')) {
                return { type: 'Binary', operator: '÷', left, right: this.expression(quotient.args[0]), ...where };
            }
        }
        const table = this.calls[name];
        const read = table ? table(call, this.helpers()) : null;
        if (read) return { ...read, ...where };
        if (!receiver && this.functions.has(name)) {
            if (call.isVariableCall) return { type: 'Name', name, ...where };
            return { type: 'Call', name, args: args.map((arg) => this.expression(arg)), ...where };
        }
        if (!receiver && this.passthrough.has(name)) {
            if (!call.hasParens && args.length === 0) return { type: 'Name', name, ...where };
            return { type: 'Call', name, args: args.map((arg) => this.expression(arg)), ...where };
        }
        this.failCall(call);
        if (receiver) return this.raw(node);
        if (call.isVariableCall) return { type: 'Name', name, ...where };
        return { type: 'Call', name, args: args.map((arg) => this.expression(arg)), ...where };
    }

    /**
     * Read the program.
     * @param {object} result - The result of the prism parse.
     * @returns {object} The Program.
     */
    program(result) {
        (result.errors || []).slice(0, 1).forEach((error) => {
            this.fail('ruby-syntax', error.message, error.location);
        });
        const lineCount = this.index.lineCount;
        const body = this.statements(statementsOf(field(result.value, 'statements')), { from: 1, to: lineCount });
        // A comment no statement took (one at the end of a line of an expression
        // over lines) is kept on its own line rather than lost.
        this.lineComments.forEach((entry) => {
            if (entry.used) return;
            body.push({ type: 'Comment', text: entry.text, line: entry.line, column: 0, endLine: entry.line });
        });
        body.sort((a, b) => a.line - b.line);
        const blankLines = [];
        for (let line = 1; line <= lineCount; line++) {
            if (this.index.lineText(line).trim() === '') blankLines.push(line);
        }
        return { type: 'Program', settings: this.settings, body, lineCount, blankLines };
    }
}

/**
 * Read a Ruby program into a JaAST.
 * @param {object} result - What the prism parse function gives (`value`, `comments`, `errors`).
 * @param {string} source - The Ruby source.
 * @param {object} [options] - What the Ruby of a system is in the Japanese.
 * @param {function(string): ?string} [options.variable] - The Japanese name of
 *   an instance variable (`@x` → `x`), or null when it has none. Without it,
 *   the local variables and the constants (`A`) are the names.
 * @param {object} [options.calls] - `{method: (call, helpers) => ?JaAST}`: the
 *   Japanese of a call (`puts(x)` → `表示する(x)`), or null when it is not one.
 *   `call` is `{name, receiver, args, hasParens, node}` (prism nodes); the
 *   helpers read them (`expression`, `call`, `callOf`, `typeOf`, `unwrap`, `text`).
 * @param {object} [options.input] - The inputs: `isQuestion(call, helpers)` and
 *   `kindOf(valueNode, helpers)` read a question with the assignment of its answer
 *   on the next line (`ask("")` / `x = answer`), `kindOfAlone(valueNode, helpers)`
 *   an assignment whose value is the input by itself (`x = gets`). The kinds are
 *   `external` / `integer` / `string`, or null when it is not one.
 * @param {Set<string>} [options.passthrough] - Names of the Ruby system the Japanese writes as they are.
 * @returns {{program: object, errors: Array<object>}} The JaAST (`lineCount` and
 *   `blankLines` say how the Ruby is laid out) and the errors
 *   (`{code, message, line, column, name?}`, the column 0-based).
 */
const readRuby = (result, source, options = {}) => {
    const reader = new RubyReader(result, source, options);
    const program = reader.program(result);
    const errors = reader.errors.sort((a, b) => a.line - b.line || a.column - b.column);
    return { program, errors };
};

export { readRuby };
