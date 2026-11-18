// SPDX-License-Identifier: MIT
// ja-notation: build the Ruby syntax tree (RubyAST) from a JaAST. See ./LICENSE.
//
// The RubyAST is a small tree of plain objects whose `type` names are the node
// names of prism (`CallNode`, `IfNode`, ...), with only the fields the Japanese
// needs. What the names and functions become is not decided here: the caller
// gives a table (`options`), so the library has no rule of one Ruby system.
//
// Every Ruby statement has `jaLine` (the Japanese line it comes from) and may
// have `comment`; a block has `closeLine` / `closeAfter` (see ./ja-ast.js).

/**
 * A call: `receiver.name(args)`, an operator (`name` is `+`, `-@`, `!`, `[]`,
 * ...) or a call without a receiver (`receiver` null). `args` null is a name
 * alone (`answer`), with no parentheses.
 * @param {?object} receiver - The receiver.
 * @param {string} name - The method.
 * @param {?Array<object>} args - The arguments.
 * @returns {object} The CallNode.
 */
const call = (receiver, name, args = []) => ({ type: 'CallNode', receiver, name, arguments: args });

/** The operators that are calls in Ruby. */
const OPERATOR_NAMES = new Set(['+', '-', '*', '/', '%', '**', '==', '!=', '<', '<=', '>', '>=', '-@', '+@', '!']);

/**
 * Whether a node is an operator (needs parentheses to have a method called on it).
 * @param {object} node - The node.
 * @returns {boolean} True if it is.
 */
const isOperator = (node) => {
    if (node.type === 'AndNode' || node.type === 'OrNode' || node.type === 'RangeNode') return true;
    return node.type === 'CallNode' && OPERATOR_NAMES.has(node.name) && node.receiver !== null;
};

/** Helpers the function table builds its Ruby with. */
const RUBY = {
    send: call,
    /**
     * A string literal.
     * @param {string} text - The text.
     * @returns {object} The StringNode.
     */
    string: (text) => ({ type: 'StringNode', raw: JSON.stringify(text) }),
    /**
     * A constant (`Math`).
     * @param {string} name - The name.
     * @returns {object} The ConstantReadNode.
     */
    constant: (name) => ({ type: 'ConstantReadNode', name }),
    /**
     * Whether a node is a string literal.
     * @param {object} node - The node.
     * @returns {boolean} True if it is.
     */
    isString: (node) => node.type === 'StringNode',
    /**
     * Whether a node is one value that a method can be called on as it is
     * (a variable, number, string, call or index), not an operator.
     * @param {object} node - The node.
     * @returns {boolean} True if it is.
     */
    isOperand: (node) => !isOperator(node),
};

/** The binary operators of the Japanese that are the same in Ruby. */
const SAME_OPERATORS = new Set(['+', '-', '*', '/', '%', '==', '!=', '<', '<=', '>', '>=']);

/**
 * Walk the statements of a JaAST (into blocks), calling `visit` on each.
 * @param {Array<object>} body - The statements.
 * @param {function(object): void} visit - Called with each statement.
 */
const walkStatements = (body, visit) => {
    body.forEach((statement) => {
        visit(statement);
        if (statement.type === 'If') {
            statement.branches.forEach((branch) => walkStatements(branch.body, visit));
            if (statement.elseBody) walkStatements(statement.elseBody, visit);
        } else if (statement.body) {
            walkStatements(statement.body, visit);
        }
    });
};

/**
 * Walk the expressions under a node (a statement or an expression).
 * @param {object} node - The node.
 * @param {function(object): void} visit - Called with each expression.
 */
const walkExpressions = (node, visit) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
        node.forEach((child) => walkExpressions(child, visit));
        return;
    }
    if (node.type && !node.body && !node.branches) visit(node);
    Object.entries(node).forEach(([key, value]) => {
        if (key === 'body' || key === 'elseBody') return;
        if (key === 'branches') {
            value.forEach((branch) => walkExpressions(branch.condition, visit));
            return;
        }
        if (value && typeof value === 'object') walkExpressions(value, visit);
    });
};

/**
 * What the whole program says about its names, before any is built: which
 * are arrays, which are given a value, which are functions.
 * @param {object} program - The JaAST.
 * @param {object} functions - The function table.
 * @returns {{arrays: Set<string>, declared: Set<string>, functions: Set<string>}} The names.
 */
const analyze = (program, functions) => {
    const arrays = new Set();
    const declared = new Set();
    const defined = new Set();
    const assigned = (target) => {
        if (target.type === 'Name') declared.add(target.name);
    };
    walkStatements(program.body, (s) => {
        if (s.type === 'Assign' || s.type === 'OpAssign' || s.type === 'Input') assigned(s.target);
        if (s.type === 'Assign' && s.target.type === 'Name' && s.value.type === 'ArrayLiteral') {
            arrays.add(s.target.name);
        }
        if (s.type === 'MultiAssign') s.targets.forEach(assigned);
        if (s.type === 'For') declared.add(s.variable.name);
        if (s.type === 'FunctionDef') {
            defined.add(s.name);
            s.params.forEach((p) => declared.add(p));
        }
        walkExpressions(s, (e) => {
            if (e.type === 'Index' && e.target.type === 'Name') arrays.add(e.target.name);
            const entry = e.type === 'Call' && functions[e.name];
            if (entry && entry.arrayArgument && e.args[0] && e.args[0].type === 'Name') arrays.add(e.args[0].name);
        });
    });
    return { arrays, declared, functions: defined };
};

/** Builds the RubyAST of one program. */
class RubyBuilder {
    /**
     * @param {object} program - The JaAST.
     * @param {object} options - See `buildRuby`.
     */
    constructor(program, options) {
        this.options = options;
        this.functions = options.functions || {};
        this.passthrough = options.passthrough || new Set();
        this.names = analyze(program, this.functions);
        this.params = null;
        this.errors = [];
    }

    /**
     * Note an error.
     * @param {string} code - The code.
     * @param {string} message - The message.
     * @param {object} node - The JaAST node it is at.
     */
    fail(code, message, node) {
        this.errors.push({ code, message, line: node.line, column: node.column });
    }

    /**
     * The Ruby name of a variable of the Japanese.
     * @param {string} name - The Japanese name.
     * @returns {string} The Ruby name (`@x`, `x`, ...).
     */
    variableName(name) {
        if (this.params && this.params.has(name)) return name;
        const naming = this.options.variable || ((n) => n);
        return naming(name, { array: this.names.arrays.has(name) });
    }

    /**
     * A variable read.
     * @param {string} name - The Japanese name.
     * @returns {object} The node.
     */
    read(name) {
        const ruby = this.variableName(name);
        if (ruby.startsWith('@')) return { type: 'InstanceVariableReadNode', name: ruby };
        return { type: 'LocalVariableReadNode', name: ruby };
    }

    /**
     * An expression.
     * @param {object} e - The JaAST expression.
     * @returns {object} The RubyAST expression.
     */
    expression(e) {
        switch (e.type) {
            case 'Number':
                return { type: e.value.includes('.') ? 'FloatNode' : 'IntegerNode', text: e.value };
            case 'String':
                return { type: 'StringNode', raw: e.raw };
            case 'Boolean':
                return { type: e.value ? 'TrueNode' : 'FalseNode' };
            case 'Name':
                return this.name(e);
            case 'Index':
                return call(this.expression(e.target), '[]', [this.expression(e.index)]);
            case 'ArrayLiteral':
                return { type: 'ArrayNode', elements: e.elements.map((x) => this.expression(x)) };
            case 'Call':
                return this.call(e);
            case 'Unary':
                return this.unary(e);
            default:
                return this.binary(e);
        }
    }

    /**
     * A name as a value: a parameter, a function called with no arguments, a
     * name of the Ruby system, or a variable.
     * @param {object} e - The Name.
     * @returns {object} The node.
     */
    name(e) {
        if (this.params && this.params.has(e.name)) return this.read(e.name);
        if (this.names.functions.has(e.name)) return call(null, e.name, null);
        if (this.passthrough.has(e.name)) return call(null, e.name, null);
        return this.read(e.name);
    }

    /**
     * A call of a function.
     * @param {object} e - The Call.
     * @returns {object} The node.
     */
    call(e) {
        const args = e.args.map((a) => this.expression(a));
        const entry = this.functions[e.name];
        if (entry) {
            const built = entry.build(args, RUBY);
            if (built) return built;
            this.fail('bad-arguments', `「${e.name}」の引数の数が違います`, e);
            return call(null, e.name, args);
        }
        if (!this.names.functions.has(e.name) && !this.passthrough.has(e.name)) {
            const message = /^[A-Za-z_]/.test(e.name)
                ? `「${e.name}」は日本語モードでは書けない命令です`
                : `「${e.name}」は定義されていない関数です`;
            this.fail('unknown-command', message, e);
        }
        return call(null, e.name, args);
    }

    /**
     * A sign or `not`. A minus before a number is a negative number.
     * @param {object} e - The Unary.
     * @returns {object} The node.
     */
    unary(e) {
        if (e.operator === '-' && e.operand.type === 'Number') {
            const number = this.expression(e.operand);
            return { ...number, text: `-${number.text}` };
        }
        const operand = this.expression(e.operand);
        if (e.operator === 'not') return call(operand, '!');
        return call(operand, e.operator === '-' ? '-@' : '+@');
    }

    /**
     * A binary operator.
     * @param {object} e - The Binary.
     * @returns {object} The node.
     */
    binary(e) {
        // A minus sign before a quotient is the sign of the quotient:
        // `-a ÷ 2` is `-(a ÷ 2)`, not `(-a) ÷ 2` (they differ for an odd `a`).
        if (e.operator === '÷' && e.left.type === 'Unary' && e.left.operator === '-') {
            return call(this.binary({ ...e, left: e.left.operand }), '-@');
        }
        const left = this.expression(e.left);
        const right = this.expression(e.right);
        if (e.operator === 'and') return { type: 'AndNode', left, right };
        if (e.operator === 'or') return { type: 'OrNode', left, right };
        if (e.operator === '..' || e.operator === '...') {
            return { type: 'RangeNode', left, right, exclusive: e.operator === '...' };
        }
        // The integer quotient `÷` (and `//`): the quotient, as an integer.
        if (e.operator === '÷') return call(call(left, '/', [right]), 'to_i');
        if (SAME_OPERATORS.has(e.operator)) return call(left, e.operator, [right]);
        this.fail('syntax', `「${e.operator}」は使えません`, e);
        return call(left, e.operator, [right]);
    }

    /**
     * The node that gives a value to a target.
     * @param {object} target - The JaAST Name or Index.
     * @param {object} value - The RubyAST value.
     * @returns {object} The node.
     */
    write(target, value) {
        if (target.type === 'Index') {
            return call(this.expression(target.target), '[]=', [this.expression(target.index), value]);
        }
        const name = this.variableName(target.name);
        return { type: name.startsWith('@') ? 'InstanceVariableWriteNode' : 'LocalVariableWriteNode', name, value };
    }

    /**
     * Statements.
     * @param {Array<object>} body - The JaAST statements.
     * @returns {Array<object>} The RubyAST statements.
     */
    statements(body) {
        const out = [];
        body.forEach((s) => {
            const built = this.statement(s);
            const list = Array.isArray(built) ? built : [built];
            list.forEach((node) => {
                if (typeof node.jaLine === 'undefined') node.jaLine = s.line;
                if (typeof s.endLine !== 'undefined' && typeof node.jaEndLine === 'undefined')
                    node.jaEndLine = s.endLine;
            });
            // The comment of the line goes after the last Ruby statement made from it.
            if (typeof s.comment !== 'undefined' && list.length > 0) list[list.length - 1].comment = s.comment;
            out.push(...list);
        });
        return out;
    }

    /**
     * One statement (some become more than one Ruby statement).
     * @param {object} s - The JaAST statement.
     * @returns {object|Array<object>} The RubyAST statement(s).
     */
    statement(s) {
        switch (s.type) {
            case 'Comment':
                return { type: 'CommentLine', text: s.text };
            case 'Assign':
                return this.write(s.target, this.expression(s.value));
            case 'OpAssign':
                return this.opWrite(s.target, s.operator, this.expression(s.value));
            case 'MultiAssign':
                return {
                    type: 'MultiWriteNode',
                    targets: s.targets.map((t) => this.write(t, null)),
                    values: s.values.map((v) => this.expression(v)),
                };
            case 'Input':
                return this.input(s);
            case 'ExpressionStatement':
                return this.expressionStatement(s);
            case 'If':
                return this.ifStatement(s);
            case 'While':
                return this.whileStatement(s);
            case 'For':
                return this.forStatement(s);
            case 'FunctionDef':
                return this.functionDef(s);
            case 'Return':
                return { type: 'ReturnNode', value: s.value ? this.expression(s.value) : null };
            default:
                this.fail('syntax', `「${s.type}」は書けません`, s);
                return [];
        }
    }

    /**
     * An assignment that changes the value (`i += 1`).
     * @param {object} target - The JaAST target.
     * @param {string} operator - The operator (`+`, ...).
     * @param {object} value - The RubyAST value.
     * @returns {object} The node.
     */
    opWrite(target, operator, value) {
        if (target.type === 'Index') {
            return {
                type: 'IndexOperatorWriteNode',
                receiver: this.expression(target.target),
                index: this.expression(target.index),
                operator,
                value,
            };
        }
        const name = this.variableName(target.name);
        const type = name.startsWith('@') ? 'InstanceVariableOperatorWriteNode' : 'LocalVariableOperatorWriteNode';
        return { type, name, operator, value };
    }

    /**
     * An input (`x = 【整数を入力】`), as the table makes it.
     * @param {object} s - The Input.
     * @returns {Array<object>} The statements.
     */
    input(s) {
        const make = this.options.input;
        if (!make) {
            this.fail('syntax', '入力は使えません', s);
            return [];
        }
        const { before, value } = make(s.kind, RUBY);
        return [...before, this.write(s.target, value)];
    }

    /**
     * A statement that is an expression. A name alone is a variable when the
     * program gives it a value or it starts with an uppercase letter, a call
     * when it is a function; else it is a command the Japanese does not have.
     * @param {object} s - The ExpressionStatement.
     * @returns {object} The node.
     */
    expressionStatement(s) {
        const e = s.expression;
        if (
            e.type === 'Name' &&
            !this.names.functions.has(e.name) &&
            !this.passthrough.has(e.name) &&
            !this.names.declared.has(e.name) &&
            !/^[A-Z]/.test(e.name)
        ) {
            this.fail('unknown-command', `「${e.name}」は日本語モードでは書けない命令です`, e);
        }
        return this.expression(e);
    }

    /**
     * `もし`.
     * @param {object} s - The If.
     * @returns {object} The IfNode.
     */
    ifStatement(s) {
        let subsequent = null;
        if (s.elseBody) {
            subsequent = { type: 'ElseNode', statements: this.statements(s.elseBody), jaLine: s.elseLine };
            if (typeof s.elseComment !== 'undefined') subsequent.comment = s.elseComment;
        }
        for (let i = s.branches.length - 1; i >= 0; i--) {
            const branch = s.branches[i];
            const node = {
                type: 'IfNode',
                predicate: this.expression(branch.condition),
                statements: this.statements(branch.body),
                subsequent,
                jaLine: branch.line,
            };
            if (i > 0 && typeof branch.comment !== 'undefined') node.comment = branch.comment;
            subsequent = node;
        }
        return { ...subsequent, closeLine: s.closeLine, closeAfter: s.closeAfter };
    }

    /**
     * `の間繰り返す`. A loop whose condition is a `not` is an `until` loop.
     * @param {object} s - The While.
     * @returns {object} The node.
     */
    whileStatement(s) {
        const negated = s.condition.type === 'Unary' && s.condition.operator === 'not';
        return {
            type: negated ? 'UntilNode' : 'WhileNode',
            predicate: this.expression(negated ? s.condition.operand : s.condition),
            statements: this.statements(s.body),
            closeLine: s.closeLine,
            closeAfter: s.closeAfter,
        };
    }

    /**
     * `i を 1 から 10 まで 1 ずつ増やしながら繰り返す`: the variable is set to
     * the start, and the loop runs while it has not passed the end, adding the
     * step at the end of each time.
     * @param {object} s - The For.
     * @returns {Array<object>} The assignment and the loop.
     */
    forStatement(s) {
        const variable = s.variable;
        const up = s.direction === 'up';
        let step = this.expression(s.step);
        if (!up) {
            step =
                step.type === 'IntegerNode' || step.type === 'FloatNode'
                    ? { ...step, text: step.text.startsWith('-') ? step.text.substring(1) : `-${step.text}` }
                    : call(step, '-@');
        }
        const init = this.write(variable, this.expression(s.from));
        const increment = this.opWrite(variable, '+', step);
        increment.jaLine = s.closeLine;
        const body = this.statements(s.body);
        body.push(increment);
        const loop = {
            type: 'WhileNode',
            predicate: call(this.read(variable.name), up ? '<=' : '>=', [this.expression(s.to)]),
            statements: body,
            closeLine: s.closeLine,
            closeAfter: s.closeAfter,
            jaLine: s.line,
            increment,
        };
        if (typeof s.comment !== 'undefined') loop.comment = s.comment;
        return [init, loop];
    }

    /**
     * `関数 名前(引数):`. Inside, the parameters are local variables.
     * @param {object} s - The FunctionDef.
     * @returns {object} The DefNode.
     */
    functionDef(s) {
        const outer = this.params;
        this.params = new Set(s.params);
        const statements = this.statements(s.body);
        this.params = outer;
        return {
            type: 'DefNode',
            name: s.name,
            parameters: s.params,
            statements,
            closeLine: s.closeLine,
            closeAfter: s.closeAfter,
        };
    }
}

/**
 * Build the RubyAST of a JaAST.
 * @param {object} program - The JaAST (from `parseStandard`).
 * @param {object} [options] - What the names and functions become.
 * @param {function(string, {array: boolean}): string} [options.variable] - The
 *   Ruby name of a variable (`@x` makes an instance variable). Plain by default.
 * @param {object} [options.functions] - `{name: {build(args, ruby), arrayArgument}}`:
 *   `build` makes the Ruby of a call from the Ruby of its arguments (null when
 *   the arguments are wrong); `arrayArgument` says its first argument is an array.
 * @param {function(string, object): {before: Array<object>, value: object}} [options.input] -
 *   The Ruby of an input (`external` / `integer` / `string`).
 * @param {Set<string>} [options.passthrough] - Names of the Ruby system written as they are.
 * @returns {{ruby: ?object, errors: Array<object>}} The `ProgramNode` (null on errors).
 */
const buildRuby = (program, options = {}) => {
    const builder = new RubyBuilder(program, options);
    const statements = builder.statements(program.body);
    if (builder.errors.length > 0) return { ruby: null, errors: builder.errors };
    return { ruby: { type: 'ProgramNode', statements }, errors: [] };
};

export { buildRuby, RUBY };
