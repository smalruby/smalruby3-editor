// === Smalruby: This file is Smalruby-specific (Ruby to DNCL reverse transpiler) ===
import { DNCL_KEYWORDS, RUBY_LITERALS } from './dncl-keywords';
import { splitTrailingComment } from './dncl-trailing-comment';
import {
    codeWithoutStrings,
    findUnsupportedCommands,
    findUnsupportedNumbers,
    isPostTestLoopLine,
    POST_TEST_LOOP_ERROR_ID,
    POST_TEST_LOOP_MESSAGE,
    UNSUPPORTED_COMMAND_ERROR_ID,
    unsupportedCommandMessage,
} from './dncl-validator';
import { ID, processSegments } from './ruby-to-dncl-identifier';
import { convertLine, detectForLoopPattern, findCountingLoopStep, toDnclExpr } from './ruby-to-dncl-line-converter';

/**
 * The column of a command in its Ruby line: the first `name` that is not a
 * part of a longer name or a variable (`@name`, `@_var_name_`).
 * @param {string} line - The Ruby line.
 * @param {string} name - The name of the command.
 * @returns {number} The 1-based column, or 1 when it is not found.
 */
const rubyColumn = (line, name) => {
    const escaped = name.replace(/[?!]/g, '\\$&');
    const m = line.match(new RegExp(`(?<![${ID}@$])${escaped}(?![${ID}?!])`));
    return m ? m.index + 1 : 1;
};

/** Ruby keywords: never a method of the program. */
const RUBY_KEYWORDS = new Set([
    'alias',
    'and',
    'begin',
    'break',
    'case',
    'class',
    'def',
    'defined?',
    'do',
    'else',
    'elsif',
    'end',
    'ensure',
    'false',
    'for',
    'if',
    'in',
    'module',
    'next',
    'nil',
    'not',
    'or',
    'redo',
    'rescue',
    'retry',
    'return',
    'self',
    'super',
    'then',
    'true',
    'undef',
    'unless',
    'until',
    'when',
    'while',
    'yield',
]);

const NAME_RE = new RegExp(`[${ID}]`);
const NAME_HEAD_RE = new RegExp(`[a-z_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]`);

/**
 * The names a Ruby source has as local variables or methods it defines:
 * assigned (`b = 1`, `b += 1`), a parameter of a block (`do |i|`) or of a
 * method (`def f(x)`), and the name of a method (`def f`). Such a bare name
 * stays as it is in the Japanese mode (or goes back to a variable, as an
 * assigned local does today), so it is not an unknown method.
 * @param {Array<string>} lines - The Ruby lines without their comments.
 * @returns {Set<string>} The names.
 */
const findRubyLocalNames = (lines) => {
    const names = new Set();
    const assign = new RegExp(`^([${ID}]+(?:\\s*,\\s*[${ID}]+)*)\\s*(?:[-+*/%]|\\|\\||&&)?=(?![=~>])`);
    const def = new RegExp(`^def\\s+([${ID}]+[?!]?)\\s*(?:\\(([^)]*)\\)|(.*))?$`);
    const splitParams = (text) =>
        (text || '')
            .split(',')
            .map((name) =>
                name
                    .trim()
                    .replace(/^[*&]+/, '')
                    .replace(/\s*=.*$/, ''),
            )
            .filter((name) => name !== '');
    for (const line of lines) {
        const code = codeWithoutStrings(line);
        const trimmed = code.trim();
        const a = trimmed.match(assign);
        // `a, b = 1, 2` assigns each name.
        if (a) splitParams(a[1]).forEach((name) => names.add(name));
        const d = trimmed.match(def);
        if (d) {
            names.add(d[1]);
            splitParams(d[2] || d[3]).forEach((name) => names.add(name));
        }
        for (const m of code.matchAll(/\|([^|]*)\|/g)) {
            splitParams(m[1]).forEach((name) => names.add(name));
        }
    }
    return names;
};

/**
 * The bare names of a Ruby line that are not called with `(`: not after
 * `@` / `$` / `.` / `:`, not a constant (uppercase), not a hash key (`a: 1`).
 * @param {string} code - The Ruby line without strings and comment.
 * @returns {Array<object>} `{name, index}` per name.
 */
const bareNamesOf = (code) => {
    const found = [];
    let i = 0;
    while (i < code.length) {
        if (!NAME_RE.test(code[i])) {
            i++;
            continue;
        }
        const start = i;
        while (i < code.length && NAME_RE.test(code[i])) i++;
        let end = i;
        // A predicate or bang method keeps its `?` / `!` (but `!=` is an operator).
        if ((code[end] === '?' || code[end] === '!') && code[end + 1] !== '=') end++;
        i = end;
        const before = code[start - 1] || '';
        if (/[@$.:]/.test(before) || !NAME_HEAD_RE.test(code[start])) continue;
        if (code[end] === '(' || (code[end] === ':' && code[end + 1] !== ':')) continue;
        found.push({ name: code.substring(start, end), index: start });
    }
    return found;
};

/**
 * Find the Smalruby methods written without parentheses in an expression
 * (`@a = 1 + x_position`, `puts(costume_number)`; issue #1694). In the
 * Japanese mode such a name has the form of a variable, so `dnclToRuby`
 * puts `@` on it (`@x_position`): the program reads a variable instead of
 * the method, with no error. Only Ruby knows it is not a variable (it has
 * no `@`), so it is told here as a command the Japanese mode does not have.
 * A local variable, a parameter, a method the source defines and the names
 * the Japanese mode has (`answer`, `rand`, ...) are not taken, nor a name
 * the converter turned into DNCL words (`wait until`).
 * @param {Array<string>} lines - The Ruby lines without their comments.
 * @param {Array<string>} dnclLines - The DNCL lines.
 * @param {Array<number>} origins - The index of the Ruby line of each DNCL line.
 * @param {Map<number, number>} folded - The Ruby lines written in the DNCL
 *   line of another Ruby line (the `while` and the increment of a counting
 *   loop are in the header made from its `@i = 1`), to the index of that line.
 * @returns {Array<object>} Errors with `line`, `column`, `id`, `name` and `message`.
 */
const findBareMethods = (lines, dnclLines, origins, folded) => {
    const locals = findRubyLocalNames(lines);
    const known = (name) =>
        RUBY_KEYWORDS.has(name) || RUBY_LITERALS.has(name) || DNCL_KEYWORDS.has(name) || locals.has(name);
    const dnclNamesByLine = new Map();
    dnclLines.forEach((text, k) => {
        const names = dnclNamesByLine.get(origins[k]) || new Set();
        text.split('\n').forEach((dnclLine) =>
            bareNamesOf(codeWithoutStrings(dnclLine)).forEach(({ name }) => names.add(name)),
        );
        dnclNamesByLine.set(origins[k], names);
    });
    const errors = [];
    lines.forEach((line, index) => {
        const inDncl = dnclNamesByLine.get(folded.has(index) ? folded.get(index) : index);
        if (!inDncl) return;
        bareNamesOf(codeWithoutStrings(line)).forEach(({ name, index: column }) => {
            if (known(name) || !inDncl.has(name)) return;
            errors.push({
                line: index + 1,
                column: column + 1,
                id: UNSUPPORTED_COMMAND_ERROR_ID,
                name,
                message: unsupportedCommandMessage(name),
            });
        });
    });
    return errors;
};

/**
 * Transpile Ruby source code to DNCL.
 * @param {string} source - The Ruby source code.
 * @returns {object} An object with `dncl` (the transpiled DNCL code) and
 *   `errors` (code that cannot be written in DNCL, with `line` / `column` of
 *   the Ruby source, `id` and `message`). The DNCL of such code is left as
 *   Ruby, so `dnclToRuby` tells the same errors on the DNCL lines.
 */
const rubyToDncl = (source) => {
    // Stack of block contexts. String entries (`'if'`, `'loop'`, `'func'`)
    // are pushed by `convertLine`; object entries `{ type: 'for', info }`
    // are pushed here for while-based for-loop detection.
    const blockStack = [];

    // A `# comment` at the end of a line is taken off so `if @a > 0 # c` is
    // still an `if`, and put back at the end of the DNCL line; otherwise
    // `ならば` would land inside the comment (Issue #1696). `comments[k]` is
    // the comment of the DNCL line `dnclLines[k]`.
    const parts = source.split('\n').map(splitTrailingComment);
    const lines = parts.map((part) => part.code);
    const dnclLines = [];
    const comments = [];
    // The index of the Ruby line each DNCL line comes from.
    const origins = [];
    const push = (text, comment, origin) => {
        dnclLines.push(text);
        comments.push(comment);
        origins.push(origin);
    };
    const errors = [];
    // Ruby lines put in the DNCL line of another one (see `findBareMethods`).
    const folded = new Map();
    let skipNext = false;

    for (let i = 0; i < lines.length; i++) {
        if (skipNext) {
            skipNext = false;
            continue;
        }

        const line = lines[i];
        const trimmed = line.trim();
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';

        // Check if this is an assignment that could be a for-loop init
        const assignMatch = trimmed.match(new RegExp(`^(@[${ID}]+)\\s*=\\s*(.+)$`));
        if (assignMatch && !trimmed.includes('answer')) {
            const varRef = assignMatch[1];
            const exprRaw = assignMatch[2].trim();

            // Peek at next line for while pattern
            if (i + 1 < lines.length) {
                const nextTrimmed = lines[i + 1].trim();
                const nextIndentMatch = lines[i + 1].match(/^(\s*)/);
                const nextIndent = nextIndentMatch ? nextIndentMatch[1] : '';

                const forInfo = detectForLoopPattern(
                    {
                        indent,
                        varName: processSegments(varRef),
                        varRef,
                        expr: toDnclExpr(exprRaw),
                    },
                    nextTrimmed,
                    nextIndent,
                );
                const counting = forInfo && findCountingLoopStep(lines, i + 1, forInfo);
                if (counting) {
                    // `@i = 1` and `while @i <= 3` become one header line, and the
                    // increment at the end of the body goes into it. Any other
                    // `while` stays `i = 1` / `i <= 3 の間` (Issue #1695).
                    const direction = forInfo.ascending ? '増やしながら' : '減らしながら';
                    blockStack.push({ type: 'for', info: forInfo, incIndex: counting.incIndex, incComment: '' });
                    push(
                        `${indent}${forInfo.varName} を ${forInfo.from} から ${forInfo.to} まで ${counting.step} ずつ${direction}`,
                        `${parts[i].comment}${parts[i + 1].comment}`,
                        i,
                    );
                    folded.set(i + 1, i);
                    folded.set(counting.incIndex, i);
                    skipNext = true;
                    continue;
                }
            }
        }

        // The increment of a counting loop is in its header: keep only its comment.
        const forTop = blockStack.find((entry) => typeof entry === 'object' && entry.incIndex === i);
        if (forTop) {
            forTop.incComment = parts[i].comment;
            continue;
        }

        // Handle `end` for for-loop BEFORE calling convertLine
        // (convertLine would pop from blockStack and misidentify the block type)
        if (trimmed === 'end' && blockStack.length > 0) {
            const top = blockStack[blockStack.length - 1];
            if (typeof top === 'object' && top.type === 'for' && top.info.indent === indent) {
                blockStack.pop();
                push(`${indent}を繰り返す`, `${top.incComment}${parts[i].comment}`, i);
                continue;
            }
        }

        // The Japanese mode has no post-test loop (`begin ... end while / until`,
        // issue #1626): 共通テスト用プログラム表記 has only the pre-test loops.
        if (isPostTestLoopLine(trimmed)) {
            errors.push({ line: i + 1, column: 1, id: POST_TEST_LOOP_ERROR_ID, message: POST_TEST_LOOP_MESSAGE });
        }

        const result = convertLine(line, blockStack);

        // Handle ask("") or ask_and_wait("") + next line assignment → 入力
        if (result === null) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                const answerMatch = nextLine.match(/^(\s*)(.+?)\s*=\s*answer(\.to_i)?\s*$/);
                if (answerMatch) {
                    const answerIndent = answerMatch[1];
                    const varPart = processSegments(answerMatch[2]);
                    // `answer.to_i` is what 【整数を入力】 generates (Issue #1186).
                    const input = answerMatch[3] ? '整数を入力' : '外部からの入力';
                    push(`${answerIndent}${varPart} = 【${input}】`, `${parts[i].comment}${parts[i + 1].comment}`, i);
                    skipNext = true;
                    continue;
                }
            }
            // Fallback: just output as-is
            push(line, parts[i].comment, i);
            continue;
        }

        push(result, parts[i].comment, i);
    }

    // Without the comments (put back below), so a word in one is not a command.
    const dncl = dnclLines.join('\n');
    // A command the Japanese mode does not have (issue #1679) is found in the
    // DNCL, where `dnclToRuby` will find it again, and told on its Ruby line.
    // One entry may hold several DNCL lines (`wait_until` → `の間` + `を繰り返す`).
    const lineOrigins = dnclLines.flatMap((text, k) => text.split('\n').map(() => origins[k]));
    findUnsupportedCommands(dncl).forEach((err) => {
        const index = lineOrigins[err.line - 1];
        errors.push({ ...err, line: index + 1, column: rubyColumn(lines[index], err.name) });
    });
    // A number in a notation the Japanese mode does not have (`0x5`, `1_000`,
    // `1e3`; issue #1745) stays as it is in the DNCL, where `dnclToRuby`
    // tells it again; it is told here on its Ruby line. So is an octal `017`,
    // which the DNCL would read as 17.
    errors.push(...findUnsupportedNumbers(lines.join('\n'), { ruby: true }));
    // A method without parentheses in an expression (issue #1694); a name
    // already told above (a name alone on a line) is not told again.
    findBareMethods(lines, dnclLines, origins, folded).forEach((err) => {
        const told = errors.some(
            (e) => e.id === UNSUPPORTED_COMMAND_ERROR_ID && e.line === err.line && e.name === err.name,
        );
        if (!told) errors.push(err);
    });

    return {
        dncl: dnclLines.map((line, k) => `${line}${comments[k]}`).join('\n'),
        errors: errors.sort((a, b) => a.line - b.line || a.column - b.column),
    };
};

export { rubyToDncl };
