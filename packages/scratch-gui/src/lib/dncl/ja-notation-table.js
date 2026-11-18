// === Smalruby: This file is Smalruby-specific (the Smalruby table of ja-notation) ===
//
// What the names and functions of the Japanese mode become in Smalruby's Ruby,
// given to the ja-notation library (src/lib/ja-notation/, MIT), which has no
// rule of its own. The output is the Ruby the current conversion
// (`dnclToRuby`) makes, so the two can be compared (J1 of
// docs/ruby-editor/converter-roadmap.md). Not used by the editor yet.
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
 * The function table.
 *
 * `表示する` with more than one argument shows them joined in one bubble: each
 * argument that is not a string literal is made a string (`.to_s`), so the `+`
 * is a join of strings, not an addition.
 */
const functions = {
    表示する: {
        build: (args, ruby) => {
            if (args.length <= 1) return ruby.send(null, 'puts', args);
            const terms = args.map((arg) => (ruby.isString(arg) ? arg : ruby.send(arg, 'to_s')));
            const joined = terms.slice(1).reduce((left, term) => ruby.send(left, '+', [term]), terms[0]);
            return ruby.send(null, 'puts', [joined]);
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
    四捨五入: methodOfArgument('round'),
    切り捨て: methodOfArgument('floor'),
    切り上げ: methodOfArgument('ceil'),
    絶対値: methodOfArgument('abs'),
    乱数: { build: (args, ruby) => ruby.send(null, 'rand', args) },
    平方根: { build: (args, ruby) => ruby.send(ruby.constant('Math'), 'sqrt', args) },
};

/**
 * An input: the question (`ask("")`), then the answer, made an integer for
 * `【整数を入力】`.
 * @param {string} kind - `external`, `integer` or `string`.
 * @param {object} ruby - The helpers of ja-notation.
 * @returns {{before: Array<object>, value: object}} The Ruby.
 */
const input = (kind, ruby) => {
    const answer = ruby.send(null, 'answer', null);
    return {
        before: [ruby.send(null, 'ask', [ruby.string('')])],
        value: kind === 'integer' ? ruby.send(answer, 'to_i') : answer,
    };
};

/** The options of ja-notation for Smalruby. */
const SMALRUBY_JA_NOTATION = {
    variable,
    functions,
    input,
    passthrough: RUBY_LITERALS,
};

export { SMALRUBY_JA_NOTATION };
