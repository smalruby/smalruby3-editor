// === Smalruby: This file is Smalruby-specific (DNCL→Ruby builtin conversion) ===
import { convertNegation } from './dncl-identifier-converter';
import { isSingleOperand, replaceCall, skipString, splitArgsAtTopLevel } from './paren-utils';

/**
 * Check whether an argument string is exactly a string literal — either
 * `"..."` or `'...'`. Used by `表示する` multi-arg conversion to decide
 * whether to wrap with `.to_s`.
 * @param {string} arg - The argument expression (will be trimmed).
 * @returns {boolean} True if the argument is a single string literal.
 */
const isStringLiteral = (arg) => {
    const trimmed = arg.trim();
    if (trimmed.length < 2) return false;
    const first = trimmed[0];
    if (first !== '"' && first !== "'") return false;
    const end = skipString(trimmed, 0, first);
    return end === trimmed.length;
};

/**
 * The argument of a built-in that becomes a method call on it (`整数(式)` →
 * `式.to_i`, `文字列(式)` → `式.to_s`, ...), as the receiver of that method.
 * An argument that is an expression is put in parentheses, so the method
 * applies to the whole argument (`a + 1` → `(a + 1)`; `a + 1.to_i` would
 * convert `1` only). `でない` is converted before that, as it negates the
 * argument it ends (`x でない` → `(!x)`; `!x.to_s` would negate the string).
 * A variable, call, index, `( ... )` group or number is left as it is.
 * (Issues #1672, #1686)
 * @param {string} arg - The argument (DNCL text, may contain `でない`).
 * @returns {string} The argument, in parentheses if it is an expression.
 */
const toReceiver = (arg) => {
    const expr = convertNegation(arg.trim());
    const single = /^-\d+(\.\d+)?$/.test(expr) || (isSingleOperand(expr) && !expr.startsWith('!'));
    return single ? expr : `(${expr})`;
};

/**
 * One non-string argument of a multi-argument `表示する`, as a `.to_s`
 * term of the `+` chain (`a + 1` → `(a + 1).to_s`). (Issue #1672)
 * @param {string} arg - The argument (DNCL text, may contain `でない`).
 * @returns {string} The argument followed by `.to_s`.
 */
const toDisplayTerm = (arg) => `${toReceiver(arg)}.to_s`;

/**
 * Convert DNCL built-in function calls to Ruby equivalents. Uses balanced
 * paren matching so nested calls (e.g. `表示する(乱数(1..10))`) are
 * correctly delimited.
 *
 * `replaceCall` recurses into args before transforming so same-name nesting
 * (e.g. `乱数(乱数(...))`) is handled in a single call.
 * @param {string} text - Text that may contain DNCL function calls.
 * @returns {string} Text with functions converted to Ruby.
 */
const convertBuiltinFunctions = (text) => {
    let result = text;

    // 表示する(args) → puts(...)
    // - 1 arg: puts(arg) — single-bubble display
    // - N args: puts(arg1' + arg2' + ...) — concatenated into one bubble.
    //   String literals are kept as-is; non-string args are wrapped in `.to_s`
    //   so that the `+` chain converts to `operator_join` blocks (Ruby
    //   block-block `+` would otherwise route to `operator_add` / math add).
    //   An expression argument is parenthesized first (`toDisplayTerm`).
    result = replaceCall(result, '表示する', (args) => {
        const parts = splitArgsAtTopLevel(args);
        if (parts.length <= 1) {
            return `puts(${args})`;
        }
        const wrapped = parts.map((p) => (isStringLiteral(p) ? p.trim() : toDisplayTerm(p)));
        return `puts(${wrapped.join(' + ')})`;
    });

    // 含む(str, sub) → str.include?(sub) — only the 2-arg form is valid;
    // any other arity is left unchanged so we don't emit malformed Ruby.
    result = replaceCall(result, '含む', (args) => {
        const parts = splitArgsAtTopLevel(args);
        if (parts.length === 2) {
            return `${toReceiver(parts[0])}.include?(${parts[1]})`;
        }
        return `含む(${args})`;
    });

    // 要素数(Name) → Name.length
    result = replaceCall(result, '要素数', (args) => `${toReceiver(args)}.length`);

    // 整数(expr) → expr.to_i — an expression is parenthesized (`toReceiver`),
    // and so are the arguments of the other method-call built-ins below.
    result = replaceCall(result, '整数', (args) => `${toReceiver(args)}.to_i`);

    // 文字列(expr) → expr.to_s
    result = replaceCall(result, '文字列', (args) => `${toReceiver(args)}.to_s`);

    // 乱数(n) → rand(n)
    result = replaceCall(result, '乱数', (args) => `rand(${args})`);

    // Math functions
    result = replaceCall(result, '四捨五入', (args) => `${toReceiver(args)}.round`);
    result = replaceCall(result, '切り捨て', (args) => `${toReceiver(args)}.floor`);
    result = replaceCall(result, '切り上げ', (args) => `${toReceiver(args)}.ceil`);
    result = replaceCall(result, '絶対値', (args) => `${toReceiver(args)}.abs`);
    result = replaceCall(result, '平方根', (args) => `Math.sqrt(${args})`);

    return result;
};

/**
 * The built-in functions `convertBuiltinFunctions` converts. The question to a
 * generative AI in Japanese mode lists an example of each (genai-dncl-prompt.js,
 * #1402), so a function added here is also offered there.
 */
const DNCL_BUILTIN_NAMES = [
    '表示する',
    '含む',
    '要素数',
    '整数',
    '文字列',
    '乱数',
    '四捨五入',
    '切り捨て',
    '切り上げ',
    '絶対値',
    '平方根',
];

export { DNCL_BUILTIN_NAMES, convertBuiltinFunctions };
