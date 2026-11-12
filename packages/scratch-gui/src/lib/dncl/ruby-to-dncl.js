// === Smalruby: This file is Smalruby-specific (Ruby to DNCL reverse transpiler) ===
import { splitTrailingComment } from './dncl-trailing-comment';
import { isPostTestLoopLine, POST_TEST_LOOP_ERROR_ID, POST_TEST_LOOP_MESSAGE } from './dncl-validator';
import { ID, processSegments } from './ruby-to-dncl-identifier';
import { convertLine, detectForLoopPattern, toDnclExpr } from './ruby-to-dncl-line-converter';

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
    const push = (text, comment) => {
        dnclLines.push(text);
        comments.push(comment);
    };
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
                        expr: toDnclExpr(exprRaw),
                    },
                    nextTrimmed,
                    nextIndent,
                );
                if (forInfo) {
                    // This is a for-loop! Output header placeholder, skip the while line
                    forInfo.headerIndex = dnclLines.length;
                    blockStack.push({ type: 'for', info: forInfo });
                    // `@i = 1` and `while @i <= 3` become one header line.
                    push('__FOR_HEADER_PLACEHOLDER__', `${parts[i].comment}${parts[i + 1].comment}`);
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
                let incComment = '';
                if (incMatch && incMatch[1] === info.varName) {
                    // Remove the increment line from output
                    dnclLines.pop();
                    incComment = comments.pop();
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
                push(`${indent}を繰り返す`, `${incComment}${parts[i].comment}`);
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
                    push(`${answerIndent}${varPart} = 【${input}】`, `${parts[i].comment}${parts[i + 1].comment}`);
                    skipNext = true;
                    continue;
                }
            }
            // Fallback: just output as-is
            push(line, parts[i].comment);
            continue;
        }

        push(result, parts[i].comment);
    }

    return {
        dncl: dnclLines.map((line, k) => `${line}${comments[k]}`).join('\n'),
        errors,
    };
};

export { rubyToDncl };
