// === Smalruby: This file is Smalruby-specific (DNCL source validator) ===

/**
 * The id of the error for the post-test loop (issue #1626). The Japanese mode
 * follows 共通テスト用プログラム表記, which has only the pre-test loops
 * (`〜の間繰り返す` / `〜ずつ増やしながら繰り返す`), so a loop whose body runs
 * once before the condition is checked cannot be written in it. The editor
 * shows the error in the language of the UI by this id.
 */
const POST_TEST_LOOP_ERROR_ID = 'postTestLoop';

const POST_TEST_LOOP_MESSAGE =
    '後判定の繰り返し（先に 1 回動かしてから条件を確かめる繰り返し）は日本語では書けません。' +
    '最初の 1 回をループの前に書いてから、「〜の間繰り返す」にしてください。Ruby モードでは書けます。';

// `begin` / `end while 〜` / `end until 〜` (the Ruby of the post-test loop,
// shown as it is by rubyToDncl), and `繰り返し、… を、〜になるまで実行する`
// (the post-test loop of the old DNCL of 情報関係基礎).
const POST_TEST_LOOP_LINE_RES = [
    /^begin$/,
    /^end\s+(?:while|until)(?:\s|\(|$)/,
    /^繰り返し[、，,]?$/,
    /^を[、，,]?\s*.+(?:になる|でなくなる)まで実行する$/,
];

/**
 * Whether a (trimmed, comment-less) line is a line of the post-test loop.
 * @param {string} trimmed - The trimmed line without its comment.
 * @returns {boolean} True for a line of the post-test loop.
 */
const isPostTestLoopLine = (trimmed) => POST_TEST_LOOP_LINE_RES.some((re) => re.test(trimmed));

/**
 * Validate DNCL source for forbidden characters. DNCL variables cannot use
 * `@` or `$` prefixes.
 * @param {string} source - The DNCL source code.
 * @returns {Array<object>} Array of error objects with `line`, `column`,
 *   and `message`.
 */
const validateDncl = (source) => {
    const errors = [];
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments
        const commentIdx = line.indexOf('#');
        const code = commentIdx >= 0 ? line.substring(0, commentIdx) : line;
        // Check for @ or $ outside strings
        let inString = false;
        let quote = null;
        for (let j = 0; j < code.length; j++) {
            if (inString) {
                if (code[j] === '\\') {
                    j++;
                    continue;
                }
                if (code[j] === quote) {
                    inString = false;
                }
                continue;
            }
            if (code[j] === '"' || code[j] === "'") {
                inString = true;
                quote = code[j];
                continue;
            }
            if (code[j] === '@' || code[j] === '$') {
                errors.push({
                    line: i + 1,
                    column: j + 1,
                    message: `日本語モードでは変数に「${code[j]}」は使えません`,
                });
            }
        }
        if (isPostTestLoopLine(code.trim())) {
            errors.push({
                line: i + 1,
                column: 1,
                id: POST_TEST_LOOP_ERROR_ID,
                message: POST_TEST_LOOP_MESSAGE,
            });
        }
    }
    return errors;
};

// Block openers of the DNCL the line converter reads (after the DNCLv2
// pre-processor), with the closer each needs and how the error names it.
// The patterns are looser than the converter's so that an opener it would
// not read (a CJK loop variable) is not taken for a missing opener.
const BLOCK_KINDS = [
    {
        re: /^もし\s+.+\s+(?:なら|ならば)$/,
        name: '「もし〜ならば」',
        closer: 'を実行する',
        isIf: true,
    },
    { re: /\sずつ増やしながら$/, name: '「〜ずつ増やしながら」', closer: 'を繰り返す' },
    { re: /\sずつ減らしながら$/, name: '「〜ずつ減らしながら」', closer: 'を繰り返す' },
    { re: /^.+\sの間$/, name: '「〜の間」', closer: 'を繰り返す' },
    { re: /^関数\s+\S+?\s*\(/, name: '「関数」', closer: 'と定義する' },
];

const CLOSERS = new Set(['を実行する', 'を繰り返す', 'と定義する']);

const continuationName = (body) => {
    if (body === 'そうでなければ') return '「そうでなければ」';
    if (/^そうでなくもし\s+.+\s+(?:なら|ならば)$/.test(body)) {
        return '「そうでなくもし〜ならば」';
    }
    return null;
};

/**
 * Read the block structure of the lines: each code line is an opener, a
 * continuation of `もし` (`そうでなくもし` / `そうでなければ`), a closer or
 * none of them, as the line converter reads it (whole trimmed line).
 * @param {string} source - DNCL source after the DNCLv2 pre-processor.
 * @returns {Array<object>} `{line, opener?, continuation?, closer?}` per
 *   structural line.
 */
const readBlockLines = (source) => {
    const result = [];
    source.split('\n').forEach((text, i) => {
        const body = text.trim();
        if (body === '' || body.startsWith('#')) return;
        const line = i + 1;
        if (CLOSERS.has(body)) {
            result.push({ line, closer: body });
            return;
        }
        const continuation = continuationName(body);
        if (continuation) {
            result.push({ line, continuation });
            return;
        }
        const opener = BLOCK_KINDS.find((kind) => kind.re.test(body));
        if (opener) result.push({ line, opener });
    });
    return result;
};

/**
 * Whether the blocks are balanced as Ruby reads the converted code: every
 * closer becomes `end` and closes the innermost block whatever its kind,
 * and `elsif` / `else` must be directly inside an `if`.
 * @param {Array<object>} blockLines - From `readBlockLines`.
 * @returns {boolean} True when the Ruby has no missing or extra `end`.
 */
const isBalancedAsRuby = (blockLines) => {
    const stack = [];
    for (const entry of blockLines) {
        if (entry.opener) stack.push(entry.opener);
        else if (entry.continuation) {
            if (stack.length === 0 || !stack[stack.length - 1].isIf) return false;
        } else {
            if (stack.length === 0) return false;
            stack.pop();
        }
    }
    return stack.length === 0;
};

const unclosedError = (open) => ({
    line: open.line,
    column: 1,
    message: `${open.opener.name}を「${open.opener.closer}」で閉じてください`,
});

/**
 * Find a missing or extra closer of a DNCL block and say it in the words of
 * DNCL (Issue #1419). Without this the converted Ruby fails with a missing
 * or extra `end`, which a DNCL student (and a generative AI asked to fix
 * the DNCL) should not be told about.
 *
 * Only a structure that breaks the converted Ruby is reported: a block
 * closed by the closer of another kind (`もし … を繰り返す`) still converts,
 * and the editor takes it, so it is not an error here either.
 * @param {string} source - DNCL source after the DNCLv2 pre-processor.
 * @returns {Array<object>} Errors with `line`, `column` and `message`.
 */
const findDnclBlockErrors = (source) => {
    const blockLines = readBlockLines(source);
    if (isBalancedAsRuby(blockLines)) return [];
    const errors = [];
    const stack = [];
    // Close the blocks opened after `index`: they were left open.
    const closeAbove = (index) => {
        while (stack.length > index + 1) errors.push(unclosedError(stack.pop()));
    };
    for (const entry of blockLines) {
        if (entry.opener) {
            stack.push(entry);
        } else if (entry.continuation) {
            const index = stack.map((open) => open.opener.isIf).lastIndexOf(true);
            if (index < 0) {
                errors.push({
                    line: entry.line,
                    column: 1,
                    message: `${entry.continuation}の前に「もし〜ならば」がありません`,
                });
            } else {
                closeAbove(index);
            }
        } else if (stack.length === 0) {
            errors.push({
                line: entry.line,
                column: 1,
                message: `「${entry.closer}」で閉じるものがありません`,
            });
        } else {
            const index = stack.map((open) => open.opener.closer).lastIndexOf(entry.closer);
            if (index < 0) {
                const top = stack.pop();
                errors.push({
                    line: entry.line,
                    column: 1,
                    message: `${top.opener.name}は「${entry.closer}」ではなく「${top.opener.closer}」で閉じてください`,
                });
            } else {
                closeAbove(index);
                stack.pop();
            }
        }
    }
    while (stack.length > 0) errors.push(unclosedError(stack.pop()));
    return errors.sort((a, b) => a.line - b.line);
};

export { findDnclBlockErrors, isPostTestLoopLine, POST_TEST_LOOP_ERROR_ID, POST_TEST_LOOP_MESSAGE, validateDncl };
