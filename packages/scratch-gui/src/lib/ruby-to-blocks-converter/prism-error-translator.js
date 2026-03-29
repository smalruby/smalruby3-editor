// === Smalruby: This file is Smalruby-specific (Prism parser error message translator) ===

/**
 * Message definitions for prism error translations.
 * Not using defineMessages because these contain literal { } characters
 * that conflict with ICU message format parsing.
 * Translations are managed directly in locale files (ja.js, ja-Hira.js).
 */
const messages = {
    expectedCloseArgs: {
        defaultMessage: '`)` is missing.\nAdd `)` to close the arguments.',
        id: 'gui.smalruby3.prismError.expectedCloseArgs'
    },
    expectedCloseArray: {
        defaultMessage: '`]` is missing.\nAdd `]` to close the array.',
        id: 'gui.smalruby3.prismError.expectedCloseArray'
    },
    expectedCloseHash: {
        defaultMessage: '`}` is missing.\nAdd `}` to close the hash.',
        id: 'gui.smalruby3.prismError.expectedCloseHash'
    },
    expectedBlockEndBrace: {
        defaultMessage: '`}` is missing.\nAdd `}` to close the block that begins with `{`.',
        id: 'gui.smalruby3.prismError.expectedBlockEndBrace'
    },
    expectedBlockEndDo: {
        defaultMessage: '`end` is missing.\nAdd `end` to close the block that begins with `do`.',
        id: 'gui.smalruby3.prismError.expectedBlockEndDo'
    },
    expectedEndForDef: {
        defaultMessage: '`end` is missing for `def`.\nAdd `end` to close the `def` statement.',
        id: 'gui.smalruby3.prismError.expectedEndForDef'
    },
    expectedEndForClass: {
        defaultMessage: '`end` is missing for `class`.\nAdd `end` to close the `class` statement.',
        id: 'gui.smalruby3.prismError.expectedEndForClass'
    },
    expectedEndForWhile: {
        defaultMessage: '`end` is missing for `while`.\nAdd `end` to close the `while` statement.',
        id: 'gui.smalruby3.prismError.expectedEndForWhile'
    },
    expectedEndForUntil: {
        defaultMessage: '`end` is missing for `until`.\nAdd `end` to close the `until` statement.',
        id: 'gui.smalruby3.prismError.expectedEndForUntil'
    },
    expectedEndForCase: {
        defaultMessage: '`end` is missing for `case`.\nAdd `end` to close the `case` statement.',
        id: 'gui.smalruby3.prismError.expectedEndForCase'
    },
    expectedEndForBegin: {
        defaultMessage: '`end` is missing for `begin`.\nAdd `end` to close the `begin` statement.',
        id: 'gui.smalruby3.prismError.expectedEndForBegin'
    },
    expectedEndForModule: {
        defaultMessage: '`end` is missing for `module`.\nAdd `end` to close the `module` statement.',
        id: 'gui.smalruby3.prismError.expectedEndForModule'
    },
    expectedEndForConditional: {
        defaultMessage: '`end` is missing.\nAdd `end` to close the conditional clause (if/unless).',
        id: 'gui.smalruby3.prismError.expectedEndForConditional'
    },
    expectedEndForElse: {
        defaultMessage: '`end` is missing for `else`.\nAdd `end` to close the `else` clause.',
        id: 'gui.smalruby3.prismError.expectedEndForElse'
    },
    unterminatedString: {
        defaultMessage: 'The string is not closed.\nAdd a closing `"` or `\'` to terminate the string.',
        id: 'gui.smalruby3.prismError.unterminatedString'
    },
    unexpectedEndOfInput: {
        defaultMessage: 'The code ended unexpectedly.\nCheck for missing `end`, `)`, `]`, or `}`.',
        id: 'gui.smalruby3.prismError.unexpectedEndOfInput'
    },
    unexpectedEnd: {
        defaultMessage: 'Extra `end` found.\nRemove the unnecessary `end`.',
        id: 'gui.smalruby3.prismError.unexpectedEnd'
    },
    cannotParseExpression: {
        defaultMessage: 'Cannot understand this expression.\nCheck the spelling and syntax.',
        id: 'gui.smalruby3.prismError.cannotParseExpression'
    },
    expectedHashRocket: {
        defaultMessage: '`=>` is missing between the hash key and value.\nAdd `=>` or use the `key:` syntax.',
        id: 'gui.smalruby3.prismError.expectedHashRocket'
    },
    expectedThenOrSemicolon: {
        defaultMessage: '`then`, `;`, or a newline is missing.\nAdd `then` or put the body on the next line.',
        id: 'gui.smalruby3.prismError.expectedThenOrSemicolon'
    },
    expectedBlockParamPipe: {
        defaultMessage: '`|` is missing.\nAdd `|` to close the block parameters.',
        id: 'gui.smalruby3.prismError.expectedBlockParamPipe'
    },
    expectedCloseParams: {
        defaultMessage: '`)` is missing.\nAdd `)` to close the parameters.',
        id: 'gui.smalruby3.prismError.expectedCloseParams'
    },
    unexpectedLocalVariableOrMethod: {
        defaultMessage: 'Unexpected variable or method found where the code should have ended.\nCheck for missing `end` or extra statements.',
        id: 'gui.smalruby3.prismError.unexpectedLocalVariableOrMethod'
    }
};

/** Map from prism's `expected an 'end' to close the 'X' statement` keyword to message key */
const endStatementMap = {
    def: 'expectedEndForDef',
    class: 'expectedEndForClass',
    while: 'expectedEndForWhile',
    until: 'expectedEndForUntil',
    case: 'expectedEndForCase',
    begin: 'expectedEndForBegin',
    module: 'expectedEndForModule'
};

/**
 * Translation rules: each rule has a pattern (regex) and a message key.
 */
const rules = [
    {
        pattern: /expected a `\)` to close the arguments$/,
        key: 'expectedCloseArgs'
    },
    {
        pattern: /expected a `\]` to close the array$/,
        key: 'expectedCloseArray'
    },
    {
        pattern: /^expected a `\}` to close the hash literal$/,
        key: 'expectedCloseHash'
    },
    {
        pattern: /^expected a block beginning with `\{` to end with `\}`$/,
        key: 'expectedBlockEndBrace'
    },
    {
        pattern: /^expected a block beginning with `do` to end with `end`$/,
        key: 'expectedBlockEndDo'
    },
    {
        pattern: /^expected an `end` to close the `(\w+)` statement$/,
        key: null, // resolved dynamically via endStatementMap
        dynamic: true
    },
    {
        pattern: /^expected an `end` to close the conditional clause$/,
        key: 'expectedEndForConditional'
    },
    {
        pattern: /^expected an `end` to close the `else` clause$/,
        key: 'expectedEndForElse'
    },
    {
        pattern: /^unterminated string meets end of file$/,
        key: 'unterminatedString'
    },
    {
        pattern: /^unexpected end-of-input, assuming it is closing the parent/,
        key: 'unexpectedEndOfInput'
    },
    {
        pattern: /^unexpected 'end', ignoring it$/,
        key: 'unexpectedEnd'
    },
    {
        pattern: /^cannot parse the expression$/,
        key: 'cannotParseExpression'
    },
    {
        pattern: /^expected a `=>` between the hash key and value$/,
        key: 'expectedHashRocket'
    },
    {
        pattern: /^expected `then` or `;` or '\\n'$/,
        key: 'expectedThenOrSemicolon'
    },
    {
        pattern: /^expected the block parameters to end with `\|`$/,
        key: 'expectedBlockParamPipe'
    },
    {
        pattern: /expected a `\)` to close the parameters$/,
        key: 'expectedCloseParams'
    },
    {
        pattern: /^unexpected local variable or method, expecting end-of-input$/,
        key: 'unexpectedLocalVariableOrMethod'
    }
];

/**
 * Translates Prism parser error messages using pattern matching.
 * Falls back to the original English message if no pattern matches.
 */
class PrismErrorTranslator {
    /**
     * @param {Function} [translatorFn] - Optional i18n translator function
     *   with signature (message) => string.
     *   If not provided, uses defaultMessage directly.
     */
    constructor (translatorFn) {
        this._translator = translatorFn || (message => message.defaultMessage);
    }

    /**
     * Translate a prism error message.
     * @param {string} errorMessage - The original English error message from prism.
     * @returns {string} The translated message, or the original if no match.
     */
    translate (errorMessage) {
        for (const rule of rules) {
            const match = errorMessage.match(rule.pattern);
            if (match) {
                if (rule.dynamic) {
                    const keyword = match[1];
                    const key = endStatementMap[keyword];
                    if (key && messages[key]) {
                        return this._translator(messages[key]);
                    }
                    // Unknown keyword - fall through to return original
                    return errorMessage;
                }
                return this._translator(messages[rule.key]);
            }
        }
        return errorMessage;
    }
}

export default PrismErrorTranslator;
