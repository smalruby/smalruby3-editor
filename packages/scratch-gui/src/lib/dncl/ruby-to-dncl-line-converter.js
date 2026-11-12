// === Smalruby: This file is Smalruby-specific (Ruby→DNCL line converter) ===
import { isDoBlockLine } from './dncl-validator';
import { skipString } from './paren-utils';
import { convertBuiltins } from './ruby-to-dncl-builtins';
import { ID, processSegments } from './ruby-to-dncl-identifier';

/**
 * A Ruby expression of a control-flow line (condition, loop bound, return
 * value) as DNCL, built-ins included: `@a.to_i > 3` → `整数(a) > 3`. The
 * DNCL → Ruby side converts built-ins in these places too. (Issue #1686)
 * @param {string} expr - The Ruby expression.
 * @returns {string} The DNCL expression.
 */
const toDnclExpr = (expr) => convertBuiltins(processSegments(expr));

/**
 * Whether a Ruby condition has `&&` / `||` / `and` / `or` outside brackets
 * and strings.
 * @param {string} condition - The Ruby condition.
 * @returns {boolean} True if a logical operator joins its top-level terms.
 */
const hasTopLevelLogical = (condition) => {
    let depth = 0;
    let i = 0;
    while (i < condition.length) {
        const ch = condition[i];
        if (ch === '"' || ch === "'") {
            i = skipString(condition, i, ch);
            continue;
        }
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (depth === 0 && /^(&&|\|\||\s(and|or)\s)/.test(condition.slice(i))) return true;
        i++;
    }
    return false;
};

/**
 * The DNCL condition of `until condition`: `condition でない`. `でない`
 * negates the condition up to the nearest `かつ` / `または`, so a condition
 * joined by them is put in parentheses: `until a > 10 && b` is
 * `(a > 10 かつ b) でない`, not `a > 10 かつ b でない` (= `a > 10 && !b`).
 * (Issue #1662)
 * @param {string} condition - The Ruby condition.
 * @returns {string} The DNCL condition.
 */
const untilCondition = (condition) => {
    const dncl = toDnclExpr(condition);
    return hasTopLevelLogical(condition) ? `(${dncl}) でない` : `${dncl} でない`;
};

/**
 * Convert a single Ruby line to DNCL.
 *
 * `blockStack` is a stack of block-context strings (`'if'`, `'loop'`,
 * `'func'`, `'do'`) used to translate `end` to the right DNCL terminator. The
 * caller (`rubyToDncl`) owns the stack so for-loop detection (which lives
 * outside this function) can interleave its own entries on the same stack.
 * @param {string} line - A single line of Ruby code.
 * @param {Array<string|object>} blockStack - Mutable block-context stack.
 * @returns {string|null} The converted DNCL line, or `null` for ask/answer
 *   sentinel lines that the caller must combine with the next line.
 */
const convertLine = (line, blockStack) => {
    if (line.trim() === '') return line;

    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    const trimmed = line.trim();

    // Comment
    if (trimmed.startsWith('#')) {
        return line;
    }

    // ask("") or ask_and_wait("") — will be combined with next line
    if (trimmed === 'ask("")' || trimmed === 'ask_and_wait("")') {
        return null; // sentinel: combine with next line
    }

    // if condition → もし condition ならば
    const ifMatch = trimmed.match(/^if\s+(.+)$/);
    if (ifMatch) {
        blockStack.push('if');
        const condition = toDnclExpr(ifMatch[1]);
        return `${indent}もし ${condition} ならば`;
    }

    // elsif condition → そうでなくもし condition ならば
    const elsifMatch = trimmed.match(/^elsif\s+(.+)$/);
    if (elsifMatch) {
        const condition = toDnclExpr(elsifMatch[1]);
        return `${indent}そうでなくもし ${condition} ならば`;
    }

    // else → そうでなければ
    if (trimmed === 'else') {
        return `${indent}そうでなければ`;
    }

    // while condition → condition の間
    // `while x do` / `until x do` is how the generator writes an empty loop (issue #1655): drop `do`.
    const whileMatch = trimmed.match(/^while\s+(.+?)(?:\s+do)?$/);
    if (whileMatch) {
        blockStack.push('loop');
        const condition = toDnclExpr(whileMatch[1]);
        return `${indent}${condition} の間`;
    }

    // until condition → condition でない の間
    const untilMatch = trimmed.match(/^until\s+(.+?)(?:\s+do)?$/);
    if (untilMatch) {
        blockStack.push('loop');
        return `${indent}${untilCondition(untilMatch[1])} の間`;
    }

    // wait until condition → an empty loop. DNCL has no "wait until", and
    // the loop waits the same way. (Issue #1662)
    const waitUntilMatch = trimmed.match(/^wait\s+until\s+(.+)$/);
    if (waitUntilMatch) {
        return `${indent}${untilCondition(waitUntilMatch[1])} の間\n${indent}を繰り返す`;
    }

    // N.times do → i を 1 から N まで 1 ずつ増やしながら
    const timesMatch = trimmed.match(/^(.+?)\.times\s+do$/);
    if (timesMatch) {
        blockStack.push('loop');
        const count = toDnclExpr(timesMatch[1]);
        return `${indent}_ を 1 から ${count} まで 1 ずつ増やしながら`;
    }

    // (from..to).step(step) do |var| → ascending for loop
    const forAscMatch = trimmed.match(
        new RegExp(`^\\((.+?)\\.\\.(.+?)\\)\\.step\\((.+?)\\)\\s+do\\s+\\|([${ID}]+)\\|$`),
    );
    if (forAscMatch) {
        blockStack.push('loop');
        const [, from, to, step, loopVar] = forAscMatch;
        const fromDncl = toDnclExpr(from);
        const toDncl = toDnclExpr(to);
        const stepDncl = toDnclExpr(step);
        return `${indent}${loopVar} を ${fromDncl} から ${toDncl} まで ${stepDncl} ずつ増やしながら`;
    }

    // from.step(to, -step) do |var| → descending for loop
    const forDescMatch = trimmed.match(new RegExp(`^(.+?)\\.step\\((.+?),\\s*-(.+?)\\)\\s+do\\s+\\|([${ID}]+)\\|$`));
    if (forDescMatch) {
        blockStack.push('loop');
        const [, from, to, step, loopVar] = forDescMatch;
        const fromDncl = toDnclExpr(from);
        const toDncl = toDnclExpr(to);
        const stepDncl = toDnclExpr(step);
        return `${indent}${loopVar} を ${fromDncl} から ${toDncl} まで ${stepDncl} ずつ減らしながら`;
    }

    // def name(params) → 関数 name(params)
    const defMatch = trimmed.match(new RegExp(`^def\\s+([${ID}]+)\\(([^)]*)\\)$`));
    if (defMatch) {
        blockStack.push('func');
        return `${indent}関数 ${defMatch[1]}(${defMatch[2]})`;
    }

    // Any other `xxx do` / `xxx do |x|` has no DNCL form and is shown as it is,
    // but its `end` must not take the closer of the block around it (issue #1665).
    if (isDoBlockLine(trimmed)) {
        blockStack.push('do');
        return convertBuiltins(processSegments(line));
    }

    // return expr → 返す expr
    const returnMatch = trimmed.match(/^return\s+(.+)$/);
    if (returnMatch) {
        const expr = toDnclExpr(returnMatch[1]);
        return `${indent}返す ${expr}`;
    }

    // end → depends on block context
    if (trimmed === 'end') {
        const blockType = blockStack.pop() || 'if';
        if (blockType === 'loop') {
            return `${indent}を繰り返す`;
        }
        if (blockType === 'func') {
            return `${indent}と定義する`;
        }
        return `${indent}を実行する`;
    }

    // General line: process segments first (var refs, operators),
    // then convert builtins (which produce Japanese keywords)
    let converted = processSegments(line);
    converted = convertBuiltins(converted);

    return converted;
};

/**
 * Try to detect a while-based for-loop pattern:
 *   `@var` = from  (pending assignment)
 *   while `@var` <= to  OR  while `@var` >= to
 *
 * If detected, return for-loop info; the step is unknown until `end` is
 * reached.
 * @param {object} pending - The buffered assignment.
 * @param {string} whileLine - The current `while` line (trimmed).
 * @param {string} whileIndent - The indent of the while line.
 * @returns {object|null} For-loop info or null if not a for-loop pattern.
 */
const detectForLoopPattern = (pending, whileLine, whileIndent) => {
    if (!pending) return null;
    if (pending.indent !== whileIndent) return null;

    // Match: while @var <= expr  or  while @var >= expr
    const whileMatch = whileLine.match(new RegExp(`^while\\s+(@[${ID}]+)\\s*(<=|>=)\\s*(.+?)(?:\\s+do)?$`));
    if (!whileMatch) return null;
    if (whileMatch[1] !== pending.varRef) return null;

    const ascending = whileMatch[2] === '<=';
    return {
        varName: pending.varName,
        varRef: pending.varRef,
        from: pending.expr,
        to: toDnclExpr(whileMatch[3]),
        ascending,
        indent: whileIndent,
        headerIndex: -1, // will be set by caller
    };
};

const indentOf = (line) => line.match(/^(\s*)/)[1];

/**
 * A pattern that finds where a Ruby line assigns to the variable with `=`,
 * `+=`, `-=` and the other assignment operators, also in a multiple assignment.
 * @param {string} varRef - The Ruby variable.
 * @returns {RegExp} The pattern.
 */
const assignmentPattern = (varRef) =>
    new RegExp(`(?<![${ID}@$])${varRef}(?![${ID}?!])\\s*(?:\\*\\*|\\|\\||&&|[-+*/%])?=(?![=~>])`);

// One term the DNCL → Ruby side can put after a unary minus (`-1`, `-@s`).
const SIMPLE_STEP = new RegExp(`^(?:\\d+(?:\\.\\d+)?|@[${ID}]+(?:\\.to_[if])?)$`);
// A step of numbers and variables only, with no calls that could change things.
const PURE_STEP = new RegExp(`^(?:\\s|\\d+(?:\\.\\d+)?|@[${ID}]+(?:\\.to_[if])?|[-+*/%()])+$`);

/**
 * The increment of a counting loop at the end of its body: `+=` / `-=` a
 * step (`+= -1` too), or the variable set to itself plus or minus one term.
 * @param {string} trimmed - The Ruby line (trimmed, without its comment).
 * @param {string} varRef - The Ruby loop variable.
 * @returns {?{step: string, ascending: boolean}} The step (as Ruby, without
 *   its sign) and whether it counts up, or null when the line is not such an
 *   increment.
 */
const parseIncrement = (trimmed, varRef) => {
    let sign;
    let rhs;
    const compound = trimmed.match(new RegExp(`^(@[${ID}]+)\\s*([-+])=\\s*(.+)$`));
    const plain = trimmed.match(new RegExp(`^(@[${ID}]+)\\s*=\\s*(@[${ID}]+)\\s*([-+])\\s*(.+)$`));
    if (compound && compound[1] === varRef) {
        sign = compound[2];
        rhs = compound[3].trim();
    } else if (plain && plain[1] === varRef && plain[2] === varRef && SIMPLE_STEP.test(plain[4].trim())) {
        // `@i = @i - 1 + 2` is not `@i -= 1 + 2`, so only one term.
        sign = plain[3];
        rhs = plain[4].trim();
    } else {
        return null;
    }
    const negated = rhs.match(/^-\s*(.+)$/);
    if (negated) {
        // `+= -X` is how DNCL → Ruby writes `X ずつ減らしながら`; X must be one term.
        if (!SIMPLE_STEP.test(negated[1])) return null;
        return { step: negated[1], ascending: sign === '-' };
    }
    if (sign === '-' && !SIMPLE_STEP.test(rhs)) return null;
    if (!PURE_STEP.test(rhs)) return null;
    return { step: rhs, ascending: sign === '+' };
};

/**
 * Whether the `while` loop found by `detectForLoopPattern` can be written as
 * a DNCL counting loop (`i を 1 から 10 まで 1 ずつ増やしながら`): the last
 * line of its body adds a step to the variable, the step goes the way of the
 * condition (`<=` up, `>=` down), and nothing else in the body changes the
 * variable or the step. Any other `while` stays a `の間` loop. (Issue #1695)
 * @param {Array<string>} lines - The Ruby lines (without their comments).
 * @param {number} whileIndex - The index of the `while` line.
 * @param {object} info - The result of `detectForLoopPattern`.
 * @returns {?{incIndex: number, step: string}} The index of the increment
 *   line and the step as DNCL, or null when the loop is not a counting loop.
 */
const findCountingLoopStep = (lines, whileIndex, info) => {
    const whileIndent = info.indent.length;
    let endIndex = -1;
    for (let k = whileIndex + 1; k < lines.length; k++) {
        if (lines[k].trim() === '') continue;
        if (indentOf(lines[k]).length <= whileIndent) {
            if (lines[k].trim() === 'end' && indentOf(lines[k]).length === whileIndent) endIndex = k;
            break;
        }
    }
    const incIndex = endIndex - 1;
    if (incIndex <= whileIndex || lines[incIndex].trim() === '') return null;
    const firstBody = lines.slice(whileIndex + 1, endIndex).find((line) => line.trim() !== '');
    if (indentOf(lines[incIndex]) !== indentOf(firstBody)) return null;

    const inc = parseIncrement(lines[incIndex].trim(), info.varRef);
    if (!inc || inc.ascending !== info.ascending) return null;

    const stepVars = inc.step.match(new RegExp(`@[${ID}]+`, 'g')) || [];
    if (stepVars.includes(info.varRef)) return null;
    const watched = [info.varRef, ...stepVars].map(assignmentPattern);
    const body = lines.slice(whileIndex + 1, incIndex);
    if (body.some((line) => watched.some((re) => re.test(line)))) return null;

    return { incIndex, step: toDnclExpr(inc.step) };
};

export { convertLine, detectForLoopPattern, findCountingLoopStep, toDnclExpr };
