// === Smalruby: This file is Smalruby-specific (the Smalruby table of ja-notation) ===
//
// What the names and functions of the Japanese mode become in Smalruby's Ruby,
// given to the ja-notation library (packages/ja-notation/, MIT), which has no
// rule of its own. `dnclToRuby` (./dncl-to-ruby.js) converts the Japanese of the
// editor with it (J3 of docs/ruby-editor/converter-roadmap.md).
import { RUBY_LITERALS } from './dncl-keywords';

/**
 * The Ruby name of a variable: a Scratch variable of the sprite (`@name`). A
 * name that starts with an uppercase letter is told apart, as a list when it is
 * used as an array (`@_array_Data_`) and as a variable otherwise (`@_var_A_`).
 * @param {string} name - The Japanese name.
 * @param {{array: boolean}} info - Whether the program uses it as an array.
 * @returns {string} The Ruby name.
 */
const variable = (name, { array }) => {
    if (/^[A-Z]/.test(name)) return array ? `@_array_${name}_` : `@_var_${name}_`;
    return `@${name}`;
};

/**
 * A built-in that becomes a method of its one argument (`整数(x)` → `x.to_i`).
 * @param {string} method - The method.
 * @returns {object} The table entry.
 */
const methodOfArgument = (method) => ({
    build: (args, ruby) => (args.length === 1 ? ruby.send(args[0], method) : null),
});

/**
 * The console of the console extension (`console.puts` / `console.gets`), where
 * the Japanese mode shows and inputs (docs/dncl/design.md, chapter 5).
 * @param {object} ruby - The helpers of ja-notation.
 * @returns {object} The receiver `console`.
 */
const consoleReceiver = (ruby) => ruby.send(null, 'console', null);

/**
 * The function table.
 *
 * `表示する` prints a line in the console. With more than one argument it
 * prints them joined in one line: each argument that is not a string literal
 * is made a string (`.to_s`), so the `+` is a join of strings, not an addition.
 */
const functions = {
    表示する: {
        build: (args, ruby) => {
            if (args.length <= 1) return ruby.send(consoleReceiver(ruby), 'puts', args);
            const terms = args.map((arg) => (ruby.isString(arg) ? arg : ruby.send(arg, 'to_s')));
            const joined = terms.slice(1).reduce((left, term) => ruby.send(left, '+', [term]), terms[0]);
            return ruby.send(consoleReceiver(ruby), 'puts', [joined]);
        },
    },
    含む: {
        build: (args, ruby) => (args.length === 2 ? ruby.send(args[0], 'include?', [args[1]]) : null),
    },
    要素数: { ...methodOfArgument('length'), arrayArgument: true },
    // The integer quotient (`a ÷ b`) is an integer already, so `整数(a ÷ b)` is
    // the quotient itself, as the current conversion writes it.
    整数: {
        build: (args, ruby) => {
            if (args.length !== 1) return null;
            const [arg] = args;
            const isQuotient =
                arg.type === 'CallNode' && arg.name === 'to_i' && arg.receiver && arg.receiver.name === '/';
            return isQuotient ? arg : ruby.send(arg, 'to_i');
        },
    },
    文字列: methodOfArgument('to_s'),
    乱数: { build: (args, ruby) => ruby.send(null, 'rand', args) },
    四捨五入: methodOfArgument('round'),
    切り捨て: methodOfArgument('floor'),
    切り上げ: methodOfArgument('ceil'),
    絶対値: methodOfArgument('abs'),
    平方根: { build: (args, ruby) => ruby.send(ruby.constant('Math'), 'sqrt', args) },
};

/**
 * An input: the answer typed in the console (`console.gets`), made an integer
 * for `【整数を入力】`.
 * @param {string} kind - `external`, `integer` or `string`.
 * @param {object} ruby - The helpers of ja-notation.
 * @returns {{before: Array<object>, value: object}} The Ruby.
 */
const input = (kind, ruby) => {
    const gets = ruby.send(consoleReceiver(ruby), 'gets', null);
    return { before: [], value: kind === 'integer' ? ruby.send(gets, 'to_i') : gets };
};

/** The options of ja-notation for Smalruby. */
const SMALRUBY_JA_NOTATION = {
    variable,
    functions,
    input,
    passthrough: RUBY_LITERALS,
};

// --- Ruby → Japanese (J4): the same table read the other way ---

/**
 * The Japanese name of a Scratch variable of the sprite: `@_array_Data_` and
 * `@_var_A_` are `Data` and `A`, `@x` is `x`.
 * @param {string} name - The Ruby name.
 * @returns {?string} The Japanese name.
 */
const rubyVariable = (name) => {
    const m = name.match(/^@_(?:array|var)_(.+)_$/) || name.match(/^@(.+)$/);
    return m ? m[1] : null;
};

/**
 * The terms of a `+` chain (`a + b + c`, also through parentheses).
 * @param {object} node - The node.
 * @param {object} r - The helpers of ja-notation.
 * @returns {Array<object>} The terms.
 */
const plusTerms = (node, r) => {
    const call = r.callOf(r.unwrap(node));
    if (call && call.name === '+' && call.receiver && call.args && call.args.length === 1) {
        return [...plusTerms(call.receiver, r), ...plusTerms(call.args[0], r)];
    }
    return [node];
};

/**
 * The receiver of `x.to_s`, or null.
 * @param {object} node - The node.
 * @param {object} r - The helpers of ja-notation.
 * @returns {?object} The receiver.
 */
const toSReceiver = (node, r) => {
    const call = r.callOf(node);
    return call && call.name === 'to_s' && call.receiver && call.args && call.args.length === 0
        ? call.receiver
        : null;
};

/**
 * The arguments of `表示する` from those of `puts`: a joined string whose
 * every term is a string literal or made a string (`.to_s`) is the arguments
 * `表示する` with more than one argument writes (`a.to_s + "は"` → `a, "は"`).
 * @param {Array<object>} args - The Ruby arguments.
 * @param {object} r - The helpers of ja-notation.
 * @returns {Array<object>} The Japanese arguments.
 */
const displayArgs = (args, r) => {
    if (args.length === 1) {
        const terms = plusTerms(args[0], r);
        const isString = (term) => r.typeOf(term) === 'StringNode';
        if (terms.length > 1 && terms.every((term) => isString(term) || toSReceiver(term, r))) {
            return terms.map((term) => r.expression(isString(term) ? term : toSReceiver(term, r)));
        }
    }
    return args.map((arg) => r.expression(arg));
};

/**
 * Whether a node is `console` (the receiver of the console blocks).
 * @param {object} node - The node.
 * @param {object} r - The helpers of ja-notation.
 * @returns {boolean} True if it is.
 */
const isConsole = (node, r) => {
    const call = r.callOf(node);
    return Boolean(call && call.name === 'console' && !call.receiver && (!call.args || call.args.length === 0));
};

/**
 * A call without a receiver that is `表示する`: the "say" of Ruby's `puts`,
 * `print`, `p` (the programs of the Japanese mode before the console, and of
 * the Ruby tab). Written again from the Japanese, it prints in the console.
 * @param {object} call - The call.
 * @param {object} r - The helpers of ja-notation.
 * @returns {?object} The Japanese.
 */
const display = (call, r) => (call.receiver ? null : r.call('表示する', displayArgs(call.args, r)));

/**
 * `puts` that is `表示する`: `console.puts(x)` (the console block) or `puts(x)`.
 * @param {object} call - The call.
 * @param {object} r - The helpers of ja-notation.
 * @returns {?object} The Japanese.
 */
const consoleOrDisplay = (call, r) =>
    call.receiver && isConsole(call.receiver, r) ? r.call('表示する', displayArgs(call.args, r)) : display(call, r);

/**
 * A method of one value that is a built-in of one argument (`x.to_i` → `整数(x)`).
 * @param {string} name - The built-in.
 * @returns {function(object, object): ?object} The reading.
 */
const builtinOfReceiver = (name) => (call, r) =>
    call.receiver && call.args.length === 0 ? r.call(name, [r.expression(call.receiver)]) : null;

/** What the calls of Smalruby's Ruby are in the Japanese. */
const rubyCalls = {
    puts: consoleOrDisplay,
    print: display,
    p: display,
    // `say(x, 2)` shows for 2 seconds: the Japanese has no time, so it is dropped.
    say: (call, r) => {
        if (call.receiver) return null;
        const last = call.args[call.args.length - 1];
        const timed = call.args.length >= 2 && /^(?:Integer|Float)Node$/.test(r.typeOf(last));
        return r.call('表示する', displayArgs(timed ? call.args.slice(0, -1) : call.args, r));
    },
    rand: (call, r) =>
        call.receiver
            ? null
            : r.call(
                  '乱数',
                  call.args.map((arg) => r.expression(arg)),
              ),
    to_i: builtinOfReceiver('整数'),
    to_s: builtinOfReceiver('文字列'),
    round: builtinOfReceiver('四捨五入'),
    floor: builtinOfReceiver('切り捨て'),
    ceil: builtinOfReceiver('切り上げ'),
    abs: builtinOfReceiver('絶対値'),
    length: builtinOfReceiver('要素数'),
    'include?': (call, r) =>
        call.receiver && call.args.length === 1
            ? r.call('含む', [r.expression(call.receiver), r.expression(call.args[0])])
            : null,
    sqrt: (call, r) =>
        call.receiver && r.typeOf(call.receiver) === 'ConstantReadNode' && r.text(call.receiver) === 'Math'
            ? r.call(
                  '平方根',
                  call.args.map((arg) => r.expression(arg)),
              )
            : null,
};

/**
 * Whether a call is `answer` (the answer of the last question).
 * @param {object} node - The node.
 * @param {object} r - The helpers of ja-notation.
 * @returns {boolean} True if it is.
 */
const isAnswer = (node, r) => {
    const call = r.callOf(node);
    return Boolean(call && call.name === 'answer' && !call.receiver && call.args && call.args.length === 0);
};

/**
 * Whether a node is `console.gets` (the input block of the console).
 * @param {object} node - The node.
 * @param {object} r - The helpers of ja-notation.
 * @returns {boolean} True if it is.
 */
const isConsoleInput = (node, r) => {
    const call = r.callOf(node);
    return Boolean(
        call &&
        call.name === 'gets' &&
        call.receiver &&
        isConsole(call.receiver, r) &&
        (!call.args || call.args.length === 0),
    );
};

/**
 * An input: `console.gets` (the input block of the console) on its own line, or
 * `ask("")` and the answer on the next line (the programs of the Japanese mode
 * before the console); made an integer for `【整数を入力】`.
 */
const rubyInput = {
    kindOfAlone: (value, r) => {
        if (isConsoleInput(value, r)) return 'external';
        const call = r.callOf(value);
        if (call && call.name === 'to_i' && call.args && call.args.length === 0 && isConsoleInput(call.receiver, r)) {
            return 'integer';
        }
        return null;
    },
    isQuestion: (call, r) =>
        !call.receiver &&
        (call.name === 'ask' || call.name === 'ask_and_wait') &&
        call.args &&
        call.args.length === 1 &&
        r.text(call.args[0]) === '""',
    kindOf: (value, r) => {
        if (isAnswer(value, r)) return 'external';
        const call = r.callOf(value);
        if (call && call.name === 'to_i' && call.args && call.args.length === 0 && isAnswer(call.receiver, r)) {
            return 'integer';
        }
        return null;
    },
};

/** The options of `rubyToJa` (ja-notation) for Smalruby's Ruby. */
const SMALRUBY_RUBY_TO_JA = {
    variable: rubyVariable,
    calls: rubyCalls,
    input: rubyInput,
    passthrough: RUBY_LITERALS,
};

/** The names of the built-in functions of the Japanese mode, in the order the AI prompt shows them. */
const DNCL_BUILTIN_NAMES = Object.keys(functions);

export { DNCL_BUILTIN_NAMES, SMALRUBY_JA_NOTATION, SMALRUBY_RUBY_TO_JA };
