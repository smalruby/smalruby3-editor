// === Smalruby: This file is Smalruby-specific (Ruby to DNCL reverse transpiler) ===
import {
    findUnsupportedCommands,
    isPostTestLoopLine,
    POST_TEST_LOOP_ERROR_ID,
    POST_TEST_LOOP_MESSAGE,
} from './dncl-validator';
import { ID, processSegments } from './ruby-to-dncl-identifier';
import { convertLine, detectForLoopPattern } from './ruby-to-dncl-line-converter';

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

    const lines = source.split('\n');
    const dnclLines = [];
    // The index of the Ruby line each DNCL line comes from.
    const origins = [];
    const errors = [];
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
                        expr: processSegments(exprRaw),
                    },
                    nextTrimmed,
                    nextIndent,
                );
                if (forInfo) {
                    // This is a for-loop! Output header placeholder, skip the while line
                    forInfo.headerIndex = dnclLines.length;
                    blockStack.push({ type: 'for', info: forInfo });
                    dnclLines.push('__FOR_HEADER_PLACEHOLDER__');
                    origins.push(i);
                    skipNext = true;
                    continue;
                }
            }
        }

        // Handle `end` for for-loop BEFORE calling convertLine
        // (convertLine would pop from blockStack and misidentify the block type)
        if (trimmed === 'end' && blockStack.length > 0) {
            const top = blockStack[blockStack.length - 1];
            if (typeof top === 'object' && top.type === 'for' && top.info.indent === indent) {
                blockStack.pop();
                const info = top.info;
                // Check last body line for increment: varName += step
                const lastLine = dnclLines.length > 0 ? dnclLines[dnclLines.length - 1].trim() : '';
                const incMatch = lastLine.match(/^(.+?)\s*\+=\s*(.+)$/);
                if (incMatch && incMatch[1] === info.varName) {
                    // Remove the increment line from output
                    dnclLines.pop();
                    origins.pop();
                    const stepExpr = incMatch[2].trim();

                    // Determine step value and direction
                    let step;
                    let ascending = info.ascending;
                    const negMatch = stepExpr.match(/^-(.+)$/);
                    if (negMatch) {
                        step = negMatch[1];
                        ascending = false;
                    } else {
                        step = stepExpr;
                    }

                    const direction = ascending ? '増やしながら' : '減らしながら';
                    const header = `${indent}${info.varName} を ${info.from} から ${info.to} まで ${step} ずつ${direction}`;
                    dnclLines[info.headerIndex] = header;
                }
                dnclLines.push(`${indent}を繰り返す`);
                origins.push(i);
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
                    dnclLines.push(`${answerIndent}${varPart} = 【${input}】`);
                    origins.push(i);
                    skipNext = true;
                    continue;
                }
            }
            // Fallback: just output as-is
            dnclLines.push(line);
            origins.push(i);
            continue;
        }

        dnclLines.push(result);
        origins.push(i);
    }

    const dncl = dnclLines.join('\n');
    // A command the Japanese mode does not have (issue #1679) is found in the
    // DNCL, where `dnclToRuby` will find it again, and told on its Ruby line.
    // One entry may hold several DNCL lines (`wait_until` → `の間` + `を繰り返す`).
    const lineOrigins = dnclLines.flatMap((text, k) => text.split('\n').map(() => origins[k]));
    findUnsupportedCommands(dncl).forEach((err) => {
        const index = lineOrigins[err.line - 1];
        errors.push({ ...err, line: index + 1, column: rubyColumn(lines[index], err.name) });
    });

    return {
        dncl,
        errors: errors.sort((a, b) => a.line - b.line || a.column - b.column),
    };
};

export { rubyToDncl };
