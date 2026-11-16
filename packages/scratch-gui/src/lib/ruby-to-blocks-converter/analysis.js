// === Smalruby: This file is Smalruby-specific (the analysis stage, docs/ruby-editor/converter-stages.md) ===
import { forEachNode, nodeTypeName } from './node-walk';

// The analysis stage: walk the prism tree once (`forEachNode`) before converting, and keep what the
// conversion needs to know in one frozen table (`Analysis`). It is a pure function of the tree and
// the source; it does not read the converter or the VM.
//
// The tables follow what the converter decides now in its pre-passes, so that the conversion can
// read them in place of those pre-passes: `_collectVariableUses` (`variable-utils.js`) for
// `variables` / `locals`, `_countProcedureCallsInNode` (`context-utils.js`) for `procedures`, and
// `_rejectRubyNameOfVariableAndList` for `errors`. One difference is on purpose: the calls inside a
// `case` are counted (issue #2014). The converter does not use this yet.

// Methods that the converter turns into list blocks only (a String has no such block), so calling
// one is evidence that the name is a list (issue #1613). The same as in `variable-utils.js`.
const LIST_ONLY_METHODS = new Set(['push', '<<', 'delete_at', 'clear', 'insert', '[]=']);
// Nodes that set a variable, whose `name` is the Ruby name (`@a`, `$a`, `a`) and `value` the value.
const VARIABLE_WRITE_NODE_TYPES = new Set(
    ['InstanceVariable', 'GlobalVariable', 'LocalVariable'].flatMap((kind) =>
        ['WriteNode', 'OperatorWriteNode', 'OrWriteNode', 'AndWriteNode'].map((suffix) => `${kind}${suffix}`),
    ),
);
const VARIABLE_READ_NODE_TYPES = new Set([
    'InstanceVariableReadNode',
    'GlobalVariableReadNode',
    'LocalVariableReadNode',
]);
// Nodes that read or set an instance or a global variable (`name` is `@a` / `$a`).
const INSTANCE_OR_GLOBAL_NODE_TYPES = new Set(
    ['InstanceVariable', 'GlobalVariable'].flatMap((kind) =>
        ['ReadNode', 'WriteNode', 'OperatorWriteNode', 'OrWriteNode', 'AndWriteNode', 'TargetNode'].map(
            (suffix) => `${kind}${suffix}`,
        ),
    ),
);
const STRING_VALUE_NODE_TYPES = new Set(['StringNode', 'InterpolatedStringNode']);
// Calls whose value is always a String (issue #1659): `gets` / `answer` (no receiver), and `x.to_s`.
const STRING_CALLS_WITHOUT_RECEIVER = new Set(['gets', 'answer']);
// The variables and the values of `a, b = 1, "x"` that the blocks take (issue #1814). The same as
// `_multiWritePairs` in `ast-handlers/assignments.js`.
const MULTI_WRITE_TARGET_TYPES = new Set([
    'LocalVariableTargetNode',
    'InstanceVariableTargetNode',
    'GlobalVariableTargetNode',
]);
const MULTI_WRITE_LITERAL_TYPES = new Set(['IntegerNode', 'FloatNode', 'StringNode', 'TrueNode', 'FalseNode']);
// How the code uses a name. `string` / `notString`: set to a String / to another value.
const EMPTY_USE = Object.freeze({ list: false, scalar: false, hash: false, string: false, notString: false });

// Where a call is counted as a call whose value is used (see `procedures`). The pre-pass of the
// converter looks at the children of each kind of node in its own way; these are the same rules.
const VALUE_WRITE_NODE_TYPES = new Set([
    'LocalVariableWriteNode',
    'InstanceVariableWriteNode',
    'GlobalVariableWriteNode',
]);
const CONDITION_NODE_TYPES = new Set(['IfNode', 'UnlessNode', 'WhileNode', 'UntilNode']);
const STATEMENT_CHILD_KEYS = [
    'statements',
    'body',
    'value',
    'left',
    'right',
    'elements',
    'requireds',
    'parameters',
    'arguments_',
];
const VALUE_CHILD_KEYS = ['value', 'left', 'right', 'body'];
const STATEMENT = 'statement';
const VALUE = 'value';

/**
 * The UTF-8 byte offsets of the new lines of a source, to find the line of a byte offset of prism.
 * @param {string} source - The Ruby source.
 * @returns {function(number): number} The line (1-based) of a byte offset.
 */
const lineFinderOf = (source) => {
    const newlines = [];
    let bytes = 0;
    for (let i = 0; i < source.length; i++) {
        const cp = source.codePointAt(i);
        if (cp === 0x0a) newlines.push(bytes);
        if (cp < 0x80) {
            bytes += 1;
        } else if (cp < 0x800) {
            bytes += 2;
        } else if (cp < 0x10000) {
            bytes += 3;
        } else {
            bytes += 4;
            i++;
        }
    }
    return (byteOffset) => {
        let low = 0;
        let high = newlines.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (newlines[mid] < byteOffset) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }
        return low + 1;
    };
};

/**
 * Whether a prism node is a value that is always a String: a string literal, `gets`, `answer`,
 * `x.to_s`, or `x + "literal"`. The same as `_isStringValueNode` of the converter.
 * @param {object} node - The prism node of the value.
 * @returns {boolean} true if the value is a String.
 */
const isStringValueNode = (node) => {
    const type = nodeTypeName(node);
    if (STRING_VALUE_NODE_TYPES.has(type)) return true;
    if (type !== 'CallNode') return false;
    const name = String(node.name);
    const args = node.arguments_ ? node.arguments_.arguments_ : [];
    if (node.block) return false;
    if (name === '+' && node.receiver && args.length === 1) {
        return STRING_VALUE_NODE_TYPES.has(nodeTypeName(args[0]));
    }
    if (args.length > 0) return false;
    if (name === 'to_s') return true;
    return !node.receiver && STRING_CALLS_WITHOUT_RECEIVER.has(name);
};

/**
 * The variables and the values of a multiple assignment that the blocks take as one assignment
 * for each variable (`a, b = 1, "x"`), or null. The same as `_multiWritePairs` of the converter.
 * @param {object} node - A MultiWriteNode.
 * @returns {?Array<{target: object, value: object}>} The pairs.
 */
const multiWritePairs = (node) => {
    const value = node.value;
    if (node.rest || node.rights.length > 0) return null;
    if (nodeTypeName(value) !== 'ArrayNode' || value.openingLoc) return null;
    if (value.elements.length !== node.lefts.length) return null;
    const pairs = [];
    for (let i = 0; i < node.lefts.length; i++) {
        const target = node.lefts[i];
        if (!MULTI_WRITE_TARGET_TYPES.has(nodeTypeName(target))) return null;
        if (!MULTI_WRITE_LITERAL_TYPES.has(nodeTypeName(value.elements[i]))) return null;
        pairs.push({ target, value: value.elements[i] });
    }
    return pairs;
};

/**
 * The value of a prism string (`unescaped` of a symbol or a string).
 * @param {*} unescaped - The `unescaped` of the node.
 * @returns {string} The string.
 */
const unescapedValue = (unescaped) =>
    String(unescaped && typeof unescaped === 'object' ? unescaped.value : unescaped);

/**
 * The full name of a constant (`Foo`, `Foo::Bar`, `::Foo`), or null.
 * @param {?object} node - A ConstantReadNode or a ConstantPathNode.
 * @returns {?string} The name.
 */
const constantPath = (node) => {
    const type = nodeTypeName(node);
    if (type === 'ConstantReadNode') return String(node.name);
    if (type === 'ConstantPathNode') {
        return node.parent ? `${constantPath(node.parent)}::${node.name}` : `::${node.name}`;
    }
    return null;
};

/**
 * The statements directly in the body of a class or a module.
 * @param {object} node - A ClassNode or a ModuleNode.
 * @returns {Array<object>} The statements.
 */
const bodyStatements = (node) => (node.body && Array.isArray(node.body.body) ? node.body.body : []);

/**
 * Freeze plain objects and arrays deeply. Prism nodes in the tables are left as they are.
 * @param {*} value - A value.
 * @returns {*} The value.
 */
const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    const proto = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
};

/**
 * A read-only view of a Map (a frozen object cannot stop `Map#set`).
 * @param {Map} map - The map.
 * @returns {object} `{get, has, size}`.
 */
const readOnlyMap = (map) =>
    Object.freeze({
        get: (key) => map.get(key),
        has: (key) => map.has(key),
        get size() {
            return map.size;
        },
    });

/**
 * Collect the uses of the variables (`variables`, `locals`). See `_collectVariableUses`.
 * @param {function(object): number} lineOf - The line of a node.
 * @returns {object} `{enter, finish}`.
 */
const variableCollector = (lineOf) => {
    const uses = {};
    const localUses = { 0: {} };
    const unitGroups = { 0: 0 };
    const unitOfNode = new Map();
    const unitOfEntered = new Map();
    const firstUses = {};
    const rubyNames = new Set();
    let nextUnit = 1;

    const mark = (name, use, unit, node) => {
        if (!name) return;
        const key = String(name);
        if (!uses[key]) uses[key] = { ...EMPTY_USE };
        uses[key][use] = true;
        const isInstanceOrGlobal = key[0] === '$' || key[0] === '@';
        if (node && (use === 'list' || use === 'scalar') && isInstanceOrGlobal) {
            if (!firstUses[key]) firstUses[key] = {};
            const line = lineOf(node);
            // The first in the order of the source on the earliest line.
            if (!firstUses[key][use] || line < firstUses[key][use].line) {
                firstUses[key][use] = { line, node };
            }
        }
        if (!isInstanceOrGlobal) {
            if (!localUses[unit][key]) localUses[unit][key] = { ...EMPTY_USE };
            localUses[unit][key][use] = true;
        }
    };

    const enter = (node, type, parent) => {
        const outerUnit = parent ? unitOfEntered.get(parent) : 0;
        let unit = outerUnit;
        // A method is a unit of its own. A block of the script (a call with `do ... end` outside any
        // method or other block) is a unit too, but it sees the locals of the script (unit 0).
        const startsUnit =
            type === 'DefNode' ||
            (type === 'CallNode' && outerUnit === 0 && nodeTypeName(node.block) === 'BlockNode');
        if (startsUnit) {
            unit = nextUnit++;
            unitGroups[unit] = type === 'DefNode' ? unit : 0;
            localUses[unit] = {};
            unitOfNode.set(node, unit);
        }
        unitOfEntered.set(node, unit);

        if (INSTANCE_OR_GLOBAL_NODE_TYPES.has(type)) rubyNames.add(String(node.name));
        if (VARIABLE_WRITE_NODE_TYPES.has(type)) {
            const valueType = nodeTypeName(node.value);
            if (valueType === 'ArrayNode') {
                mark(node.name, 'list', unit, node);
            } else if (valueType === 'HashNode') {
                mark(node.name, 'hash', unit);
            } else {
                mark(node.name, 'scalar', unit, node);
                mark(node.name, isStringValueNode(node.value) ? 'string' : 'notString', unit);
            }
        } else if (type === 'MultiWriteNode') {
            (multiWritePairs(node) || []).forEach(({ target, value }) => {
                mark(target.name, 'scalar', unit, target);
                mark(target.name, isStringValueNode(value) ? 'string' : 'notString', unit);
            });
        } else if (
            type === 'CallNode' &&
            LIST_ONLY_METHODS.has(String(node.name)) &&
            VARIABLE_READ_NODE_TYPES.has(nodeTypeName(node.receiver))
        ) {
            const args = node.arguments_ ? node.arguments_.arguments_ : [];
            const keyType = args.length > 0 ? nodeTypeName(args[0]) : null;
            // `@a[:key] = 1` and `@a["key"] = 1` are a hash.
            if (!(String(node.name) === '[]=' && (keyType === 'SymbolNode' || keyType === 'StringNode'))) {
                mark(node.receiver.name, 'list', unit, node);
            }
        }
    };

    const finish = () => {
        // A local that the script outside the blocks does not use, and that its blocks use as
        // different things, is a separate local in each block (`_localScopeIndex`).
        const kindOf = (use) => {
            if (use.list) return 'list';
            if (use.hash) return 'hash';
            return 'scalar';
        };
        const kindsOfName = {};
        Object.keys(localUses).forEach((unit) => {
            if (Number(unit) === 0 || unitGroups[unit] !== 0) return;
            Object.keys(localUses[unit]).forEach((name) => {
                if (!kindsOfName[name]) kindsOfName[name] = new Set();
                kindsOfName[name].add(kindOf(localUses[unit][name]));
            });
        });
        const splitNames = Object.keys(kindsOfName)
            .filter((name) => kindsOfName[name].size > 1 && !localUses[0][name])
            .sort();

        const conflicts = Object.keys(firstUses)
            .filter((name) => firstUses[name].list && firstUses[name].scalar)
            .map((name) => ({
                kind: 'variableAndList',
                name,
                listLine: firstUses[name].list.line,
                variableLine: firstUses[name].scalar.line,
                node: firstUses[name].scalar.node,
            }))
            .sort((a, b) => a.variableLine - b.variableLine);

        return {
            variables: { uses, firstUses, rubyNames: [...rubyNames].sort() },
            locals: { unitOfNode: readOnlyMap(unitOfNode), uses: localUses, groups: unitGroups, splitNames },
            errors: conflicts,
        };
    };

    return { enter, finish };
};

/**
 * Count the calls whose value is used, by name (`procedures.valueCallCounts`). The converter uses
 * the count of a method made with `def` to name the variables that keep its return values
 * (`@_return_foo_1_`). See `_countProcedureCallsInNode`.
 * @returns {object} `{enter, finish}`.
 */
const valueCallCounter = () => {
    const counts = {};
    // node -> STATEMENT or VALUE; a node without one is not looked at (its children neither).
    const roleOf = new Map();
    const setRole = (child, role) => {
        if (nodeTypeName(child)) roleOf.set(child, role);
    };
    const setRoleOfEach = (children, role) => {
        if (children && typeof children.forEach === 'function') children.forEach((c) => setRole(c, role));
    };
    const argumentsOf = (node) => (node.arguments_ && node.arguments_.arguments_) || null;

    const enter = (node, type, parent) => {
        const role = parent ? roleOf.get(node) : STATEMENT;
        if (!role) return;
        if (role === VALUE) {
            if (type === 'CallNode') {
                const name = node.name && String(node.name);
                if (name) counts[name] = (counts[name] || 0) + 1;
                setRole(node.receiver, VALUE);
                setRoleOfEach(argumentsOf(node), VALUE);
            } else if (type === 'StatementsNode') {
                setRoleOfEach(node.body, VALUE);
            } else {
                VALUE_CHILD_KEYS.forEach((key) => setRole(node[key], VALUE));
            }
            return;
        }
        if (type === 'CallNode') {
            setRoleOfEach(argumentsOf(node), VALUE);
            if (node.block && node.block.body) setRole(node.block.body, STATEMENT);
            setRole(node.receiver, VALUE);
        } else if (CONDITION_NODE_TYPES.has(type)) {
            setRole(node.predicate, VALUE);
            [node.statements, node.subsequent, node.elseClause].forEach((c) => setRole(c, STATEMENT));
        } else if (type === 'CaseNode') {
            // The converter's pre-pass does not look in here (issue #2014): `case x` and `when x`
            // are values, the lines of `when` and `else` are lines.
            setRole(node.predicate, VALUE);
            setRoleOfEach(node.conditions, STATEMENT);
            setRole(node.elseClause, STATEMENT);
        } else if (type === 'WhenNode') {
            setRoleOfEach(node.conditions, VALUE);
            setRole(node.statements, STATEMENT);
        } else if (VALUE_WRITE_NODE_TYPES.has(type)) {
            setRole(node.value, VALUE);
        } else if (type === 'ReturnNode') {
            setRoleOfEach(argumentsOf(node), VALUE);
        } else {
            STATEMENT_CHILD_KEYS.forEach((key) => {
                const child = node[key];
                if (nodeTypeName(child)) {
                    setRole(child, STATEMENT);
                } else if (child && typeof child === 'object') {
                    setRoleOfEach(child, STATEMENT);
                }
            });
        }
    };

    return { enter, finish: () => counts };
};

/**
 * Collect the methods made with `def` (`procedures.definitions`).
 * @param {function(object): number} lineOf - The line of a node.
 * @returns {object} `{enter, leave, finish}`.
 */
const definitionCollector = (lineOf) => {
    const definitions = [];
    const open = [];
    const enter = (node, type) => {
        if (type === 'DefNode') {
            const params = node.parameters;
            const names = (list) => (list || []).map((p) => String(p.name));
            const definition = {
                name: String(node.name),
                line: lineOf(node),
                onSelf: nodeTypeName(node.receiver) === 'SelfNode',
                requireds: names(params && params.requireds),
                optionals: names(params && params.optionals),
                returnsValue: false,
                usesSuper: false,
                node,
            };
            definitions.push(definition);
            open.push(definition);
            return;
        }
        const current = open[open.length - 1];
        if (!current) return;
        if (type === 'ReturnNode' && node.arguments_ && node.arguments_.arguments_.length > 0) {
            current.returnsValue = true;
        } else if (type === 'SuperNode' || type === 'ForwardingSuperNode') {
            current.usesSuper = true;
        }
    };
    const leave = (node, type) => {
        if (type === 'DefNode') open.pop();
    };
    return { enter, leave, finish: () => definitions };
};

/**
 * Collect the classes and the modules (`classes`): the facts that `class-visitor.js` and
 * `module-visitor.js` look at in the body before converting it.
 * @param {function(object): number} lineOf - The line of a node.
 * @returns {object} `{enter, finish}`.
 */
const classCollector = (lineOf) => {
    const classes = [];
    const modules = [];
    const methodsOf = (node) =>
        bodyStatements(node)
            .filter((stmt) => nodeTypeName(stmt) === 'DefNode' && !stmt.receiver)
            .map((stmt) => String(stmt.name));
    const enter = (node, type) => {
        if (type === 'ClassNode') {
            const attrs = {};
            const includes = [];
            bodyStatements(node).forEach((stmt) => {
                if (nodeTypeName(stmt) !== 'CallNode' || stmt.receiver) return;
                const name = String(stmt.name);
                const args = (stmt.arguments_ && stmt.arguments_.arguments_) || [];
                if (name === 'attr_accessor' || name === 'attr_reader' || name === 'attr_writer') {
                    args.forEach((arg) => {
                        if (nodeTypeName(arg) === 'SymbolNode') {
                            attrs[unescapedValue(arg.unescaped)] = name.replace('attr_', '');
                        }
                    });
                } else if (name === 'include' && args.length === 1 && nodeTypeName(args[0]) === 'ConstantReadNode') {
                    includes.push(String(args[0].name));
                }
            });
            const methods = methodsOf(node);
            classes.push({
                name: constantPath(node.constantPath),
                superclass: constantPath(node.superclass),
                line: lineOf(node),
                attrs,
                includes,
                methods,
                hasInitialize: methods.includes('initialize'),
                node,
            });
        } else if (type === 'ModuleNode') {
            modules.push({
                name: constantPath(node.constantPath),
                line: lineOf(node),
                methods: methodsOf(node),
                node,
            });
        }
    };
    return { enter, finish: () => ({ classes, modules }) };
};

/**
 * Analyze a prism tree before converting it: walk it once and decide the facts that the
 * conversion needs. The result is frozen (the conversion must not change it).
 *
 * - `variables`: how the code uses each Ruby name (`@a` / `$a` / `a`): `uses[name]` is
 *   `{list, scalar, hash, string, notString}`; `firstUses[name]` is the earliest line (and node)
 *   where an instance or a global variable is used as a list / a scalar; `rubyNames` the names of
 *   the instance and global variables that the code reads or sets.
 * - `locals`: the units of local variables: `unitOfNode` (the node that starts a unit -> its id),
 *   `uses[unit][name]`, `groups[unit]` (whose locals the unit sees: itself for a method, 0 for a
 *   block of the script) and `splitNames` (locals that are separate in each block of the script).
 * - `procedures`: `valueCallCounts[name]` (calls whose value is used, also in a `case`) and
 *   `definitions` (the methods made with `def`).
 * - `classes`: `classes` and `modules`, with what is directly in their bodies.
 * - `symbols`: every symbol that the code writes (`:name`), the candidates of `$_symbols_`.
 * - `errors`: what is wrong before converting: one `@a` used as both a variable and a list,
 *   earliest line first (the converter reports the first one).
 * @param {object} root - The root prism node (`parse(...).value`).
 * @param {object} options - Options.
 * @param {string} options.source - The Ruby source of the tree (to find the lines).
 * @returns {object} The frozen `Analysis`.
 */
const analyze = (root, { source }) => {
    const findLine = lineFinderOf(source || '');
    const lineOf = (node) =>
        node && node.location && typeof node.location.startOffset === 'number'
            ? findLine(node.location.startOffset)
            : 1;
    const variables = variableCollector(lineOf);
    const calls = valueCallCounter();
    const definitions = definitionCollector(lineOf);
    const classes = classCollector(lineOf);
    const symbols = new Set();

    forEachNode(root, {
        enter(node, type, parent) {
            variables.enter(node, type, parent);
            calls.enter(node, type, parent);
            definitions.enter(node, type, parent);
            classes.enter(node, type, parent);
            if (type === 'SymbolNode') symbols.add(`:${unescapedValue(node.unescaped)}`);
        },
        leave(node, type) {
            definitions.leave(node, type);
        },
    });

    const { variables: variableTable, locals, errors } = variables.finish();
    return deepFreeze({
        variables: variableTable,
        locals,
        procedures: { valueCallCounts: calls.finish(), definitions: definitions.finish() },
        classes: classes.finish(),
        symbols: [...symbols].sort(),
        errors,
    });
};

export { analyze, isStringValueNode, multiWritePairs };
