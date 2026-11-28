// === Smalruby: This file is Smalruby-specific (the words of the errors of ja-notation) ===
//
// ja-notation (packages/ja-notation/, MIT) says why it cannot read the Japanese
// with a `code` and the details of the error (the name, the block). The
// editor keeps the words the students see (the 標準の形 ones of #2041 and the
// ids the UI translates): this file turns each error of ja-notation into them.
import { codeOfLine } from './dncl-trailing-comment';
import {
    findUnsupportedCommands,
    isPostTestLoopLine,
    codeWithoutStrings,
    FORBIDDEN_PREFIX_ERROR_ID,
    forbiddenPrefixMessage,
    POST_TEST_LOOP_ERROR_ID,
    POST_TEST_LOOP_MESSAGE,
    STAGE_VARIABLE_ERROR_ID,
    stageVariableMessage,
    UNSUPPORTED_NOTATION_ERROR_ID,
    UNSUPPORTED_NUMBER_ERROR_ID,
    UNSUPPORTED_COMMAND_ERROR_ID,
    unsupportedCommandMessage,
    unsupportedNotationMessage,
    unsupportedNumberMessage,
} from './dncl-validator';

/**
 * The id of the error for Ruby that prism cannot read, so it has no Japanese.
 * Its words are in Japanese: the Japanese tab is offered only in the Japanese locales.
 */
const RUBY_SYNTAX_ERROR_ID = 'rubySyntax';

/**
 * How the errors name each block: in the DNCL-like form (closed by a line of
 * its own) and in the standard form (opened with `:`), and its closing line.
 */
const BLOCK_NAMES = {
    If: { name: '「もし〜ならば」', standard: '「もし〜ならば:」', closer: 'を実行する' },
    up: { name: '「〜ずつ増やしながら」', standard: '「〜ずつ増やしながら繰り返す:」', closer: 'を繰り返す' },
    down: { name: '「〜ずつ減らしながら」', standard: '「〜ずつ減らしながら繰り返す:」', closer: 'を繰り返す' },
    While: { name: '「〜の間」', standard: '「〜の間繰り返す:」', closer: 'を繰り返す' },
    FunctionDef: { name: '「関数」', standard: '「関数 〜(…):」', closer: 'と定義する' },
};

/** How the errors name `そうでなくもし` / `そうでなければ`. */
const BRANCH_NAMES = { elsif: '「そうでなくもし〜ならば」', else: '「そうでなければ」' };

/**
 * The words of a block error (Issue #1419; the standard form is told to
 * indent, Issue #2035), or null when the error is not one.
 * @param {object} error - An error of ja-notation.
 * @returns {?string} The message.
 */
const blockMessage = (error) => {
    if (error.code === 'unclosed' || error.code === 'empty-block') {
        const names = BLOCK_NAMES[error.opener === 'For' ? error.direction : error.opener];
        if (!names) return null;
        return error.colon || error.code === 'empty-block'
            ? `${names.standard}の中の行を字下げしてください`
            : `${names.name}を「${names.closer}」で閉じてください`;
    }
    if (error.block === 'closer-kind') {
        // A closer of another kind of block (W3 of #1731).
        const names = BLOCK_NAMES[error.opener === 'For' ? error.direction : error.opener];
        if (!names) return null;
        return `${error.colon ? names.standard : names.name}は「${error.word}」ではなく「${names.closer}」で閉じてください`;
    }
    if (error.block === 'stray-closer') return `「${error.word}」で閉じるものがありません`;
    if (error.block === 'stray-branch') {
        const name = BRANCH_NAMES[error.branch];
        return error.colon
            ? `${name.replace(/」$/, ':」')}は、「もし〜ならば:」と同じ字下げで書いてください`
            : `${name}の前に「もし〜ならば」がありません`;
    }
    return null;
};

/**
 * An error said in the words of the Japanese mode (`{line, column, message}`,
 * the 1-based column, with `id` and `name` for the errors the UI translates).
 * @param {object} error - An error of ja-notation.
 * @returns {?object} The error, or null when it is not one of the words of
 *   the Japanese mode (a Ruby command, a number, Ruby with no Japanese form,
 *   a variable of the stage, `@`, the post-test loop).
 */
const wordError = (error) => {
    const at = { line: error.line, column: error.column + 1 };
    switch (error.code) {
        case 'forbidden':
            return {
                ...at,
                id: FORBIDDEN_PREFIX_ERROR_ID,
                name: error.name,
                message: forbiddenPrefixMessage(error.name),
            };
        case 'bad-number':
            return {
                ...at,
                id: UNSUPPORTED_NUMBER_ERROR_ID,
                name: error.name,
                message: unsupportedNumberMessage(error.name),
            };
        case 'post-test-loop':
            return { line: error.line, column: 1, id: POST_TEST_LOOP_ERROR_ID, message: POST_TEST_LOOP_MESSAGE };
        case 'no-ja-form':
            return {
                ...at,
                id: UNSUPPORTED_NOTATION_ERROR_ID,
                name: error.name,
                message: unsupportedNotationMessage(error.name),
            };
        case 'stage-variable':
            return {
                ...at,
                id: STAGE_VARIABLE_ERROR_ID,
                name: error.name,
                message: stageVariableMessage(error.name),
            };
        case 'unknown-command':
            return {
                ...at,
                id: UNSUPPORTED_COMMAND_ERROR_ID,
                name: error.name,
                message: unsupportedCommandMessage(error.name),
            };
        default:
            return null;
    }
};

/**
 * The lines with their line numbers and `｜` / `⎿` marks blanked out, so the
 * check of the Ruby commands reads the code where it is.
 * @param {string} source - The Japanese source.
 * @returns {Array<string>} The lines.
 */
const plainLines = (source) =>
    source.split('\n').map((line) => {
        const label = line.match(/^\s*\(\d+(?:-\d+)*\)/);
        const rest = label ? ' '.repeat(label[0].length) + line.substring(label[0].length) : line;
        return rest.replace(/^[\s｜|│⎿└]*/, (prefix) => ' '.repeat(prefix.length));
    });

/**
 * The words for a line ja-notation cannot read: a Ruby command written in the
 * Japanese (`with_screen_refresh do`, `[1, 2].each do |x|`, `break if ...`,
 * `range(...)`; Issue #1679) or a line of the post-test loop is told as such,
 * as the Ruby → Japanese direction tells it, rather than as a line that cannot
 * be read. The commands are looked for in the whole program, as a line inside
 * a block that cannot be read is not built.
 * @param {string} source - The Japanese source.
 * @param {Array<object>} errors - The syntax errors of ja-notation.
 * @returns {Array<object>} The errors in the words of the Japanese mode.
 */
const unreadLineWords = (source, errors) => {
    const lines = plainLines(source);
    const found = findUnsupportedCommands(lines.join('\n'));
    errors.forEach((error) => {
        const text = lines[error.line - 1];
        if (typeof text === 'string' && isPostTestLoopLine(codeWithoutStrings(text).trim())) {
            found.push({ line: error.line, column: 1, id: POST_TEST_LOOP_ERROR_ID, message: POST_TEST_LOOP_MESSAGE });
        }
    });
    return found;
};

/** The closing lines of the DNCL-like form. */
const CLOSERS = new Set(['を実行する', 'を繰り返す', 'と定義する']);

/**
 * The block a line of the DNCL-like form opens, as `BLOCK_NAMES` names it, or null.
 * @param {string} code - The trimmed line without its comment.
 * @returns {?object} The names of the block.
 */
const openerOf = (code) => {
    if (/^もし\s*.+?\s*(?:なら|ならば)$/.test(code)) return { ...BLOCK_NAMES.If, isIf: true };
    if (/ずつ増やしながら(?:\s*繰り返す)?$/.test(code)) return BLOCK_NAMES.up;
    if (/ずつ減らしながら(?:\s*繰り返す)?$/.test(code)) return BLOCK_NAMES.down;
    if (/^.+?\s*の間(?:\s*繰り返す)?$/.test(code)) return BLOCK_NAMES.While;
    if (/^関数\s+\S+?\s*\(/.test(code) || /\)\s*を定義する$/.test(code)) return BLOCK_NAMES.FunctionDef;
    return null;
};

/**
 * The block errors of a program written in the DNCL-like form only (every
 * block closed by a line of its own), found by the kind of each closing line
 * (Issue #1419): a closing line closes the nearest open block it is the
 * closer of, and the blocks left open inside it are told, so a student who
 * forgot one `を実行する` is told about that `もし`. ja-notation tells the same
 * (a closing line of another kind of block, W3 of #1731), and this is used
 * only to say the errors of a program it tells, in the words of the blocks.
 * @param {Array<string>} lines - The lines (line numbers and marks blanked out).
 * @returns {?Array<object>} The errors, or null when a block of the program
 *   is opened with `:` (the standard form, whose errors ja-notation says).
 */
const closerFormBlockErrors = (lines) => {
    const codes = lines.map((line) => codeOfLine(line).trim());
    if (codes.some((code) => /[:：]$/.test(code))) return null;
    const errors = [];
    const stack = [];
    const unclosed = (open) => ({
        line: open.line,
        column: 1,
        message: `${open.names.name}を「${open.names.closer}」で閉じてください`,
    });
    const closeAbove = (index) => {
        while (stack.length > index + 1) errors.push(unclosed(stack.pop()));
    };
    codes.forEach((code, i) => {
        const line = i + 1;
        if (code === '') return;
        if (CLOSERS.has(code)) {
            if (stack.length === 0) {
                errors.push({ line, column: 1, message: `「${code}」で閉じるものがありません` });
                return;
            }
            const index = stack.map((open) => open.names.closer).lastIndexOf(code);
            if (index < 0) {
                const top = stack.pop();
                errors.push({
                    line,
                    column: 1,
                    message: `${top.names.name}は「${code}」ではなく「${top.names.closer}」で閉じてください`,
                });
            } else {
                closeAbove(index);
                stack.pop();
            }
            return;
        }
        const branch =
            code === 'そうでなければ'
                ? BRANCH_NAMES.else
                : /^そうでなくもし\s*.+?\s*(?:なら|ならば)$/.test(code)
                  ? BRANCH_NAMES.elsif
                  : null;
        if (branch) {
            const index = stack.map((open) => Boolean(open.names.isIf)).lastIndexOf(true);
            if (index < 0) errors.push({ line, column: 1, message: `${branch}の前に「もし〜ならば」がありません` });
            else closeAbove(index);
            return;
        }
        const names = openerOf(code);
        if (names) stack.push({ line, names });
    });
    while (stack.length > 0) errors.push(unclosed(stack.pop()));
    return errors;
};

/**
 * Turn the errors of ja-notation into the errors the Japanese mode shows.
 *
 * As before the switch to ja-notation, the errors in the words of the
 * Japanese mode (a Ruby command, a number, `@` / `$`, the post-test loop) are
 * told alone when there are any; otherwise the block errors and the lines
 * that cannot be read are told, a block error on column 1.
 * @param {string} source - The Japanese source.
 * @param {Array<object>} errors - The errors of `jaToRuby`.
 * @returns {Array<object>} `{line, column, message}` (and `id` / `name`),
 *   sorted by line and column.
 */
const jaNotationErrors = (source, errors) => {
    const words = errors.map(wordError).filter(Boolean);
    const syntax = errors.filter((error) => error.code === 'syntax');
    if (syntax.length > 0) words.push(...unreadLineWords(source, syntax));
    const seen = new Set();
    // The block errors of a program of the DNCL-like form are said by the kinds of its closing lines.
    const byCloser =
        words.length === 0 && errors.every((error) => blockMessage(error) && !error.colon)
            ? closerFormBlockErrors(plainLines(source))
            : null;
    const told =
        words.length > 0
            ? words
            : byCloser && byCloser.length > 0
              ? byCloser
              : errors.map((error) => {
                    const block = blockMessage(error);
                    return block
                        ? { line: error.line, column: 1, message: block }
                        : { line: error.line, column: error.column + 1, message: error.message };
                });
    return told
        .filter((error) => {
            const key = `${error.line}:${error.column}:${error.id}:${error.message}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => a.line - b.line || a.column - b.column);
};

/**
 * The errors of Ruby → Japanese (ja-notation's `rubyToJa`, on Ruby lines) in
 * the words of the Japanese mode, as the Japanese → Ruby direction says them.
 * @param {Array<object>} errors - The errors of `rubyToJa`.
 * @returns {Array<object>} `{line, column, message}` (and `id` / `name`), sorted.
 */
const rubyErrorWords = (errors) => {
    // Ruby that prism cannot read (Japanese typed in the Ruby tab) is told by its syntax errors
    // only: the names of its words would each be told as a command or function of the Japanese
    // mode, which the Ruby tab does not have (Issue #2547).
    const syntax = errors.filter((error) => error.code === 'ruby-syntax');
    return (syntax.length > 0 ? syntax : errors)
        .map((error) => {
            if (error.code === 'ruby-syntax') {
                return {
                    line: error.line,
                    column: error.column + 1,
                    id: RUBY_SYNTAX_ERROR_ID,
                    message: `Ruby のプログラムに誤りがあるので、日本語にできません（${error.message}）`,
                };
            }
            return wordError(error);
        })
        .filter(Boolean)
        .sort((a, b) => a.line - b.line || a.column - b.column);
};

export { jaNotationErrors, RUBY_SYNTAX_ERROR_ID, rubyErrorWords };
