// === Smalruby: This file is Smalruby-specific (DNCL 0-based array index hints) ===
import { parse } from '@smalruby/ja-notation';

// Smalruby DNCL arrays start at index 0, like the 共通テスト notation by
// default. A program written for a problem that says "the index starts at 1"
// reads past the end of an array, but the Scratch VM silently returns an
// empty value there, so the user gets wrong output and no error (Issue
// #1357). These hints point at the accesses that run past the end so the
// editor can tell the user that indices start at 0.

/**
 * The integer an expression of the JaAST is, when it is written as one
 * (`3`, `-3`), or null.
 * @param {object} node - The expression.
 * @returns {?number} The integer.
 */
const integerOf = (node) => {
    if (node.type === 'Number' && /^\d+$/.test(node.value)) return Number(node.value);
    if (node.type === 'Unary' && node.operator === '-') {
        const value = integerOf(node.operand);
        return value === null ? null : -value;
    }
    return null;
};

/**
 * The statements of a body and of the blocks in it, in the order they are written.
 * @param {Array<object>} body - The statements.
 * @returns {Array<object>} All the statements.
 */
const allStatements = (body) =>
    body.flatMap((s) => [
        s,
        ...allStatements(s.body || []),
        ...(s.branches || []).flatMap((b) => allStatements(b.body)),
        ...allStatements(s.elseBody || []),
    ]);

/**
 * The names a statement assigns to.
 * @param {object} s - The statement.
 * @returns {Array<object>} The assignments: `{name, value}` (`value` is the
 *   expression assigned, or null when it is not one).
 */
const assignmentsOf = (s) => {
    const named = (target, value) => (target && target.type === 'Name' ? [{ name: target.name, value }] : []);
    switch (s.type) {
        case 'Assign':
            return named(s.target, s.value);
        case 'OpAssign':
        case 'Input':
            return named(s.target, null);
        case 'MultiAssign':
            return s.targets.flatMap((t) => named(t, null));
        case 'For':
            return named(s.variable, null);
        // `A に 値 を追加する` changes the length of the array (Issue #1759).
        case 'Append':
            return named(s.target, null);
        default:
            return [];
    }
};

/**
 * Collect the arrays and integer variables whose value is fixed for the
 * whole program: assigned exactly once, by a literal.
 * @param {object} program - The JaAST.
 * @returns {{lengths: Map<string, number>, constants: Map<string, number>}}
 *   The array lengths and the integer constants by name.
 */
const collectFixedValues = (program) => {
    const assignCounts = new Map();
    const lengths = new Map();
    const constants = new Map();
    for (const s of allStatements(program.body)) {
        for (const { name, value } of assignmentsOf(s)) {
            assignCounts.set(name, (assignCounts.get(name) || 0) + 1);
            if (!value) continue;
            if (value.type === 'ArrayLiteral') lengths.set(name, value.elements.length);
            const integer = integerOf(value);
            if (integer !== null) constants.set(name, integer);
        }
    }
    for (const map of [lengths, constants]) {
        for (const name of map.keys()) {
            if (assignCounts.get(name) !== 1) map.delete(name);
        }
    }
    for (const [name, length] of lengths) {
        if (length === 0) lengths.delete(name);
    }
    return { lengths, constants };
};

/**
 * Drop the values whose names a function parameter shadows: inside the
 * function, such a name holds whatever the caller passes.
 * @param {{lengths: Map<string, number>, constants: Map<string, number>}} fixed
 *   The values from `collectFixedValues`.
 * @param {Set<string>} params - The parameter names in scope.
 * @returns {{lengths: Map<string, number>, constants: Map<string, number>}}
 *   The values that still hold.
 */
const withoutParams = (fixed, params) => {
    if (params.size === 0) return fixed;
    const keep = (map) => new Map([...map].filter(([name]) => !params.has(name)));
    return { lengths: keep(fixed.lengths), constants: keep(fixed.constants) };
};

/**
 * Evaluate a loop bound such as `9`, `n`, `要素数(X)` or `要素数(X) - 1`.
 * @param {object} node - The bound expression.
 * @param {{lengths: Map<string, number>, constants: Map<string, number>}} fixed
 *   The values from `collectFixedValues`.
 * @returns {?number} The value, or null when it is not known statically.
 */
const evaluateBound = (node, fixed) => {
    if (node.type === 'Binary' && (node.operator === '+' || node.operator === '-')) {
        const offset = node.right.type === 'Number' ? integerOf(node.right) : null;
        const base = node.left.type === 'Binary' ? null : evaluateBound(node.left, fixed);
        if (offset === null || base === null) return null;
        return node.operator === '+' ? base + offset : base - offset;
    }
    const integer = integerOf(node);
    if (integer !== null) return integer;
    let value;
    if (node.type === 'Name') value = fixed.constants.get(node.name);
    else if (
        node.type === 'Call' &&
        node.name === '要素数' &&
        node.args.length === 1 &&
        node.args[0].type === 'Name'
    ) {
        value = fixed.lengths.get(node.args[0].name);
    }
    return typeof value === 'number' ? value : null;
};

/**
 * Work out the largest value a counting loop gives its variable.
 * @param {object} from - The start expression.
 * @param {object} to - The end expression.
 * @param {object} step - The step expression.
 * @param {boolean} ascending - Whether the loop counts up.
 * @param {{lengths: Map<string, number>, constants: Map<string, number>}} fixed
 *   The values from `collectFixedValues`.
 * @returns {?number} The largest value, or null when it is not known
 *   statically or the loop never runs.
 */
const loopMaximum = (from, to, step, ascending, fixed) => {
    const start = evaluateBound(from, fixed);
    const end = evaluateBound(to, fixed);
    const by = evaluateBound(step, fixed);
    if (start !== null && end !== null && (ascending ? start > end : start < end)) return null;
    if (!ascending) return start;
    if (end === null || by === null || by <= 0) return null;
    // A step of 1 always ends at `to`; a larger one may stop short of it.
    if (by === 1) return end;
    if (start === null) return null;
    return start + Math.floor((end - start) / by) * by;
};

/**
 * The array accesses of an expression (`X[i]`), the inner ones first, in
 * the order they are written.
 * @param {object} node - The expression.
 * @returns {Array<object>} The Index nodes.
 */
const accessesOf = (node) => {
    if (!node || typeof node !== 'object') return [];
    const children = [node.target, node.index, node.left, node.right, node.operand, node.value]
        .concat(node.args || [], node.elements || [], node.values || [], node.targets || [])
        .filter(Boolean);
    const inner = children.flatMap(accessesOf);
    return node.type === 'Index' ? [...inner, node] : inner;
};

/**
 * Find array accesses that run past the end of the array, which is what a
 * program written with 1-based indices does. Two cases are detected:
 * `X[i]` inside a counting loop whose largest `i` is the length of `X` or
 * more, and `X[n]` with a constant `n` that is the length of `X` or more.
 * Only arrays assigned once by a literal (and bounds known statically) are
 * checked, and names that a function parameter shadows are not used, so the
 * hints never guess. The program is read as the conversion reads it
 * (ja-notation), so a program that cannot be read has no hints, and one
 * whose sentence at the top says the indexes start at 1 has none either (its
 * indexes from 1 are right; ja-notation shifts them for the Ruby).
 * @param {string} source - The DNCL source code.
 * @returns {Array<object>} The hints, each with the 1-based DNCL source
 *   `line`, the `access` text (`Ten[i]`), the `array` name, the
 *   `last` valid index, and a `fixed` access to suggest.
 */
const findArrayIndexHints = (source) => {
    const { program } = parse(source);
    if (!program || program.settings.indexBase === 1) return [];
    const fixed = collectFixedValues(program);
    const hints = [];

    /**
     * Check the accesses of the expressions of one statement.
     * @param {Array<object>} expressions - The expressions.
     * @param {Array<object>} loops - The counting loops around, innermost last.
     * @param {object} visible - The fixed values not shadowed here.
     */
    const check = (expressions, loops, visible) => {
        for (const node of expressions.flatMap(accessesOf)) {
            if (node.target.type !== 'Name') continue;
            const array = node.target.name;
            const length = visible.lengths.get(array);
            if (typeof length !== 'number') continue;
            const index = node.index;
            let hint = null;
            const loop = index.type === 'Name' ? [...loops].reverse().find((l) => l.loopVar === index.name) : null;
            if (loop) {
                // One hint per array and loop is enough to explain the mistake.
                if (loop.max !== null && loop.max >= length && !loop.reported.has(array)) {
                    loop.reported.add(array);
                    hint = `${array}[${index.name} - 1]`;
                }
            } else if (index.type === 'Number' && /^\d+$/.test(index.value) && Number(index.value) >= length) {
                hint = `${array}[${Number(index.value) - 1}]`;
            }
            if (hint) {
                const indexText = index.type === 'Name' ? index.name : index.value;
                hints.push({
                    line: node.line,
                    access: `${array}[${indexText}]`,
                    array,
                    last: length - 1,
                    fixed: hint,
                });
            }
        }
    };

    const walk = (body, loops, params) => {
        const visible = withoutParams(fixed, params);
        for (const s of body) {
            switch (s.type) {
                case 'For': {
                    check([s.from, s.to, s.step], loops, visible);
                    const max = loopMaximum(s.from, s.to, s.step, s.direction === 'up', visible);
                    walk(s.body, [...loops, { loopVar: s.variable.name, max, reported: new Set() }], params);
                    break;
                }
                case 'FunctionDef':
                    walk(s.body, [], new Set([...params, ...s.params]));
                    break;
                case 'If':
                    s.branches.forEach((branch) => {
                        check([branch.condition], loops, visible);
                        walk(branch.body, loops, params);
                    });
                    if (s.elseBody) walk(s.elseBody, loops, params);
                    break;
                case 'While':
                    check([s.condition], loops, visible);
                    walk(s.body, loops, params);
                    break;
                default:
                    check(
                        [s.target, s.value, s.expression, ...(s.targets || []), ...(s.values || [])].filter(Boolean),
                        loops,
                        visible,
                    );
            }
        }
    };
    walk(program.body, [], new Set());
    return hints;
};

export { findArrayIndexHints };
