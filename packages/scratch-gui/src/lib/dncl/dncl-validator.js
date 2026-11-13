// === Smalruby: This file is Smalruby-specific (DNCL source validator) ===
import { DNCL_KEYWORDS, RUBY_LITERALS } from './dncl-keywords';
import { findFunctionNames } from './dncl-state';
import { codeOfLine, commentIndex, stringEndAt } from './dncl-trailing-comment';
import { findMatchingClose } from './paren-utils';

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
    // `繰り返し、` alone, or with the body on the same line (`繰り返し、a ← a + 1 を、…`).
    /^繰り返し\s*(?:[、，,].*)?$/,
    /^を[、，,]?\s*.+(?:になる|でなくなる)まで実行する$/,
];

/**
 * Whether a (trimmed, comment-less) line is a line of the post-test loop.
 * @param {string} trimmed - The trimmed line without its comment.
 * @returns {boolean} True for a line of the post-test loop.
 */
const isPostTestLoopLine = (trimmed) => POST_TEST_LOOP_LINE_RES.some((re) => re.test(trimmed));

/**
 * A line that opens a `do ... end` block (`with_screen_refresh do`, `loop do`,
 * `when_flag_clicked do`, `list.each do |x|`, ...). Such a block has no DNCL
 * form, so it is shown as Ruby in the DNCL and closed by `を実行する`
 * (issue #1665). A `do` in a string is not at the end of the line, so it is
 * not taken.
 */
const DO_BLOCK_RE = /(?:^|[\s)])do(?:\s*\|[^|]*\|)?$/;

/**
 * Whether the line opens a `do ... end` block (see `DO_BLOCK_RE`). A comment
 * at the end of the line (`move(1) # what to do`) is cut off first, so a
 * `do` in it is not taken; a `#` in a string (`"..."` / `'...'` / `「...」`)
 * is not a comment (`codeOfLine`, Issue #1696).
 * @param {string} line - A trimmed line of Ruby or DNCL.
 * @returns {boolean} True when the line opens a `do` block.
 */
const isDoBlockLine = (line) => DO_BLOCK_RE.test(codeOfLine(line));

/**
 * The id of the error for a Ruby command or method call that the Japanese mode
 * does not have (`move(2)`, `bounce_if_on_edge`, `with_screen_refresh do`,
 * `[1, 2].each do |x|`; issue #1679). Its name would be taken for a variable
 * and get an `@` (`@move(2)`), which is broken Ruby, so such DNCL makes no
 * Ruby. The editor shows the error in the language of the UI by this id and
 * the `name` of the error.
 */
const UNSUPPORTED_COMMAND_ERROR_ID = 'unsupportedCommand';

/**
 * Whether the name of an unsupported command is a Ruby one (it starts with an
 * ASCII letter or `_`, like `move`). Another name (a Japanese one) is a
 * function the program forgot to define, or one a problem of the common test
 * says is given (`差分(...)`), so the error asks to define it instead of
 * pointing to the Ruby mode.
 * @param {string} name - The name of the command.
 * @returns {boolean} True for a Ruby name.
 */
const isRubyCommandName = (name) => /^[A-Za-z_]/.test(name);

/**
 * The message of the unsupported command error.
 * @param {string} name - The name of the command.
 * @returns {string} The message.
 */
const unsupportedCommandMessage = (name) =>
    isRubyCommandName(name)
        ? `「${name}」は日本語モードでは書けない命令です。Ruby モードでは書けます。`
        : `「${name}」は定義されていない関数です。「関数 ${name}(…)」で定義してください。`;

/**
 * A line that starts with a Ruby keyword that jumps in a loop (`break`,
 * `next`, `redo`, `retry`), alone or with a modifier (`break if i == 5`;
 * issue #1716). The Japanese mode has no such statement, and the keyword
 * would be taken for a variable (`@break if` in Ruby), which changes the
 * program. A variable with the name (`next = 1`, `next ← 1`, `next += 1`) is
 * not taken.
 */
const LOOP_JUMP_RE = /^(break|next|redo|retry)(?=$|\s+(?![-+*/]?=(?!=)|←))/;

const IDENT_HEAD_RE = /[a-zA-Z_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
const IDENT_TAIL_RE = /[a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
// A trailing `?` / `!` is a Ruby predicate or bang method (`stop!`).
const LONE_IDENT_RE =
    /^[a-zA-Z_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF][a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]*[?!]?$/;
const TRAILING_IDENT_RE =
    /[a-zA-Z_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF][a-zA-Z0-9_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]*$/;

/**
 * The code of a line before its comment, with every string (`"..."`,
 * `'...'`, `「...」`) blanked out by spaces so that the columns stay.
 * @param {string} line - A line of DNCL.
 * @returns {string} The code without strings and comment.
 */
const codeWithoutStrings = (line) => {
    const comment = commentIndex(line);
    const code = comment === -1 ? line : line.substring(0, comment);
    let out = '';
    let i = 0;
    while (i < code.length) {
        const end = stringEndAt(code, i);
        if (end !== -1) {
            out += ' '.repeat(end - i);
            i = end;
            continue;
        }
        out += code[i];
        i++;
    }
    return out;
};

/**
 * The command of a `do` block line: the name just before `do` and the
 * arguments of the command (`with_screen_refresh do` → `with_screen_refresh`,
 * `[1, 2].each do |x|` → `each`, `self.when(:clicked) do` → `when`).
 * @param {string} code - The line without strings and comment.
 * @returns {?object} `{name, index}`, or null when there is no name.
 */
const doBlockCommand = (code) => {
    let head = code.replace(/\s*do(?:\s*\|[^|]*\|)?\s*$/, '');
    if (head.endsWith(')')) {
        // The `(` whose `)` ends the head.
        for (let open = head.lastIndexOf('('); open >= 0; open = head.lastIndexOf('(', open - 1)) {
            if (findMatchingClose(head, open) === head.length - 1) {
                head = head.substring(0, open);
                break;
            }
        }
    }
    const m = head.match(TRAILING_IDENT_RE);
    return m ? { name: m[0], index: m.index } : null;
};

/**
 * The names the source declares as variables: assigned (`a ← 1`, `a = 1`,
 * `a += 1`), counted by a loop (`i を 1 から …`) or a function parameter.
 * @param {string} source - DNCL source after the DNCLv2 pre-processor.
 * @returns {Set<string>} The names.
 */
const findDeclaredNames = (source) => {
    const names = new Set();
    const ident =
        '[a-zA-Z_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF][a-zA-Z0-9_\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]*';
    const assign = new RegExp(`^(${ident})\\s*(?:←|[-+*/]?=(?!=))`);
    const loop = new RegExp(`^(${ident})\\s+を\\s`);
    const params = new RegExp(`^関数\\s+${ident}\\s*\\(([^)]*)\\)`);
    for (const line of source.split('\n')) {
        const trimmed = line.trim();
        const m = trimmed.match(assign) || trimmed.match(loop);
        if (m) names.add(m[1]);
        const p = trimmed.match(params);
        if (p) {
            p[1]
                .split(',')
                .map((name) => name.trim())
                .forEach((name) => names.add(name));
        }
    }
    return names;
};

/**
 * Find the Ruby commands and method calls the Japanese mode does not have
 * (issue #1679): a name called with `(` (not after `.`), a lowercase name
 * alone on a line that the source does not declare as a variable, the
 * command of a `do` block, and a keyword that jumps in a loop at the head of a
 * line (`break if i == 5`, issue #1716). The names the Japanese mode has
 * are the DNCL keywords and built-in functions, the Ruby names the converter
 * passes as they are (`puts`, `say`, `rand`, ...) and the functions the
 * source defines. A variable (a name not called) is not taken, so a
 * variable may have the name of a command.
 * @param {string} source - DNCL source after the DNCLv2 pre-processor.
 * @returns {Array<object>} Errors with `line`, `column`, `id`, `name` and
 *   `message`.
 */
const findUnsupportedCommands = (source) => {
    const functionNames = findFunctionNames(source);
    const known = (name) => DNCL_KEYWORDS.has(name) || RUBY_LITERALS.has(name) || functionNames.has(name);
    const declared = findDeclaredNames(source);
    const errors = [];
    source.split('\n').forEach((line, lineIndex) => {
        const code = codeWithoutStrings(line);
        const trimmed = code.trim();
        if (trimmed === '' || isPostTestLoopLine(trimmed)) return;
        const found = [];
        const add = (name, index) => {
            if (!known(name)) found.push({ name, index });
        };
        // A keyword that jumps in a loop is a command even with a modifier,
        // and even when the source has a variable with its name.
        const jump = trimmed.match(LOOP_JUMP_RE);
        if (jump) add(jump[1], code.indexOf(trimmed));
        // A name alone on a line is a command without arguments, unless it
        // is a variable: an uppercase name, or one the source assigns.
        if (!jump && LONE_IDENT_RE.test(trimmed) && /^[a-z_]/.test(trimmed) && !declared.has(trimmed)) {
            add(trimmed, code.indexOf(trimmed));
        }
        let i = 0;
        while (i < code.length) {
            if (!IDENT_HEAD_RE.test(code[i])) {
                i++;
                continue;
            }
            const start = i;
            while (i < code.length && IDENT_TAIL_RE.test(code[i])) i++;
            // A Ruby predicate or bang method keeps its `?` / `!`
            // (`key_pressed?("space")`, `touching?("_edge_")`).
            const end = (code[i] === '?' || code[i] === '!') && code[i + 1] === '(' ? i + 1 : i;
            // After `.` it is a method of a value (`.to_i`, `.length`); after
            // `@` / `$` it is told as a forbidden character; after `:` a symbol.
            if (code[end] === '(' && !/[.@$:]/.test(code[start - 1] || '')) {
                add(code.substring(start, end), start);
            }
            i = end;
        }
        if (found.length === 0 && isDoBlockLine(trimmed) && !/^(?:while|until)\s/.test(trimmed)) {
            const command = doBlockCommand(code.trimEnd());
            if (command) add(command.name, command.index);
        }
        found.forEach(({ name, index }) =>
            errors.push({
                line: lineIndex + 1,
                column: index + 1,
                id: UNSUPPORTED_COMMAND_ERROR_ID,
                name,
                message: unsupportedCommandMessage(name),
            }),
        );
    });
    return errors;
};

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
        // The code before the comment, with the strings blanked out: a `#`
        // in a string (`"#"`, `'#'`, `「#」`) is text, not a comment, so an
        // `@` after it is still found, and an `@` in a string or in the
        // comment is not (Issue #1709). The columns stay as written.
        const code = codeWithoutStrings(lines[i]);
        for (let j = 0; j < code.length; j++) {
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
    return errors.concat(findUnsupportedCommands(source)).sort((a, b) => a.line - b.line || a.column - b.column);
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
    { re: { test: isDoBlockLine }, name: '「〜 do」', closer: 'を実行する' },
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

export {
    findDnclBlockErrors,
    findUnsupportedCommands,
    isDoBlockLine,
    isPostTestLoopLine,
    isRubyCommandName,
    POST_TEST_LOOP_ERROR_ID,
    POST_TEST_LOOP_MESSAGE,
    UNSUPPORTED_COMMAND_ERROR_ID,
    validateDncl,
};
