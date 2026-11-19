// === Smalruby: This file is Smalruby-specific (the checks of the words of the Japanese mode) ===
import { DNCL_KEYWORDS, RUBY_LITERALS } from './dncl-keywords';
import { codeOfLine, commentIndex, stringEndAt } from './dncl-trailing-comment';
import { findMatchingClose, NAME_PATTERN } from './paren-utils';

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
        : `「${name}」は定義されていない関数です。「関数 ${name}(…):」で定義してください。`;

/**
 * A line that starts with a Ruby keyword that jumps in a loop (`break`,
 * `next`, `redo`, `retry`), alone or with a modifier (`break if i == 5`;
 * issue #1716). The Japanese mode has no such statement, and the keyword
 * would be taken for a variable (`@break if` in Ruby), which changes the
 * program. A variable with the name is not taken: assigned (`next = 1`,
 * `next ← 1`, `next += 1`), followed by an operator (`next < 10 の間`,
 * `next == 1`, `next and x`, `next かつ x`) or counted by a loop (`next を 1 から …`).
 */
const LOOP_JUMP_RE =
    /^(break|next|redo|retry)(?=$|\s+(?![-+*/%<>=!&|^]|←|を(?:\s|$)|(?:and|or|かつ|または)(?:\s|$)|の間$|でない(?:\s|$)))/;

// A name as ja-notation reads it (`佐々木` is one name; Issue #1714).
const NAME_AT_RE = new RegExp(NAME_PATTERN, 'uy');
// A trailing `?` / `!` is a Ruby predicate or bang method (`stop!`).
const LONE_IDENT_RE = new RegExp(`^${NAME_PATTERN}[?!]?$`, 'u');
const TRAILING_IDENT_RE = new RegExp(`${NAME_PATTERN}$`, 'u');

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
 * The id of the error for a number written in a Ruby notation that
 * 共通テスト用プログラム表記 does not use (issue #1745): a hex / binary /
 * octal prefix (`0x5`, `0b101`, `0o17`), `_` between digits (`1_000`), an
 * exponent (`1e3`, `1.5e-3`) and the rational / imaginary suffixes (`3r`,
 * `2i`). The examples of the common test write numbers only as `123` and
 * `0.5`. The letters in such a number would be taken for a name and get an
 * `@` (`0@x5`), which is broken Ruby, so such DNCL makes no Ruby. The editor
 * shows the error in the language of the UI by this id and the `name` of
 * the error (the number as written).
 */
const UNSUPPORTED_NUMBER_ERROR_ID = 'unsupportedNumber';

/**
 * The message of the unsupported number error.
 * @param {string} name - The number as written.
 * @returns {string} The message.
 */
const unsupportedNumberMessage = (name) =>
    `「${name}」は日本語モードでは書けない数の書き方です（16 進数、_ の区切り、指数表記など）。` +
    '「1000」「0.5」のように書いてください。Ruby モードでは書けます。';

/**
 * The id of the error for `@` / `$` written in the Japanese (issue #1674): the names of the
 * Japanese have no `@` / `$` (the Ruby gets them), so such DNCL makes no Ruby. The editor
 * shows the error in the language of the UI by this id and the `name` of the error (the
 * character), at the character.
 */
const FORBIDDEN_PREFIX_ERROR_ID = 'forbiddenPrefix';

/**
 * The id of the error for Ruby that has no form in the Japanese mode and is
 * not a command or a number (`case` / `when`, a hash `{}`, a symbol `:a`, a
 * modifier `unless`; issue #1740). Ruby → Japanese would keep it as Ruby,
 * which the Japanese reads back as something else (`@`, `{`), so it is told
 * on its Ruby line instead. The `name` is its keyword, or its text.
 */
const UNSUPPORTED_NOTATION_ERROR_ID = 'unsupportedNotation';

/**
 * The message of the unsupported notation error.
 * @param {string} name - The keyword or the text of the Ruby.
 * @returns {string} The message.
 */
const unsupportedNotationMessage = (name) => `「${name}」は日本語モードでは書けません。Ruby モードでは書けます。`;

/**
 * The id of the error for a variable or a list of the stage (`$a`) in the Ruby
 * (issue #1706). The Japanese mode is written for a program that runs alone,
 * as on a terminal, and has no stage: Ruby → Japanese does not write them and
 * tells them where they are. The `name` is the variable (`$a`).
 */
const STAGE_VARIABLE_ERROR_ID = 'stageVariable';

/**
 * The message of the stage variable error.
 * @param {string} name - The variable (`$a`).
 * @returns {string} The message.
 */
const stageVariableMessage = (name) =>
    `ステージの変数（${name}）は日本語モードでは書けません。Ruby モードでは書けます。`;

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
 * The names of the functions the source defines (`関数 name(...)`), CJK names
 * too (Issue #643): calls of them are not Ruby commands.
 * @param {string} source - The Japanese source.
 * @returns {Set<string>} The function names.
 */
const findFunctionNames = (source) => {
    const ident = NAME_PATTERN;
    const re = new RegExp(`^関数\\s+(${ident})\\s*\\(`, 'u');
    const names = new Set();
    for (const line of source.split('\n')) {
        const m = line.trim().match(re);
        if (m) names.add(m[1]);
    }
    return names;
};

/**
 * The names the source declares as variables: assigned (`a ← 1`, `a = 1`,
 * `a += 1`), counted by a loop (`i を 1 から …`) or a function parameter.
 * @param {string} source - The Japanese (its line numbers and `｜` marks blanked out).
 * @returns {Set<string>} The names.
 */
const findDeclaredNames = (source) => {
    const names = new Set();
    const ident = NAME_PATTERN;
    const assign = new RegExp(`^(${ident})\\s*(?:←|[-+*/]?=(?!=))`, 'u');
    const loop = new RegExp(`^(${ident})\\s+を\\s`, 'u');
    const params = new RegExp(`^関数\\s+${ident}\\s*\\(([^)]*)\\)`, 'u');
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
 * @param {string} source - The Japanese (its line numbers and `｜` marks blanked out).
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
            NAME_AT_RE.lastIndex = i;
            const name = NAME_AT_RE.exec(code);
            if (!name) {
                i++;
                continue;
            }
            const start = i;
            i += name[0].length;
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

export {
    codeWithoutStrings,
    findUnsupportedCommands,
    FORBIDDEN_PREFIX_ERROR_ID,
    isDoBlockLine,
    isPostTestLoopLine,
    isRubyCommandName,
    POST_TEST_LOOP_ERROR_ID,
    POST_TEST_LOOP_MESSAGE,
    STAGE_VARIABLE_ERROR_ID,
    stageVariableMessage,
    UNSUPPORTED_COMMAND_ERROR_ID,
    unsupportedCommandMessage,
    UNSUPPORTED_NOTATION_ERROR_ID,
    UNSUPPORTED_NUMBER_ERROR_ID,
    unsupportedNotationMessage,
    unsupportedNumberMessage,
};
