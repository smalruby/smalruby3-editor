/**
 * The name of a custom block (My Block) and its Ruby method name (issue #2116).
 *
 * The generator joins the words of the block name with `_` (`'1 文字えらぶ %s'` → `1_文字えらぶ`).
 * A name that starts with a digit (`1_文字えらぶ`) or is a reserved word (`end`, `if`) is not a
 * method name that can be called in Ruby, so the generator puts a `_` in front (`_1_文字えらぶ`) and
 * the converter takes it off again. The names that only differ by the `_` in front are handled the
 * same way (`_end` is written `__end`), so every block name comes back as it was.
 * `_1` to `_9` are the numbered parameters of a block in Ruby and cannot be method names, so a
 * name that is one digit from 1 to 9 gets `__` (`1` is written `__1`, `_1` is `___1`).
 */

/**
 * The reserved words of Ruby. A method may be defined with these names, but calling it without
 * a receiver (`end`, `if(1)`) is a syntax error.
 */
const RESERVED_WORDS = new Set([
    '__ENCODING__',
    '__LINE__',
    '__FILE__',
    'BEGIN',
    'END',
    'alias',
    'and',
    'begin',
    'break',
    'case',
    'class',
    'def',
    'defined?',
    'do',
    'else',
    'elsif',
    'end',
    'ensure',
    'false',
    'for',
    'if',
    'in',
    'module',
    'next',
    'nil',
    'not',
    'or',
    'redo',
    'rescue',
    'retry',
    'return',
    'self',
    'super',
    'then',
    'true',
    'undef',
    'unless',
    'until',
    'when',
    'while',
    'yield',
]);

/**
 * Whether a name, without the `_`s in front, cannot be a Ruby method name to call.
 * @param {string} name - The name.
 * @returns {boolean} true when it starts with a digit or is a reserved word.
 */
const needsPrefix = (name) => {
    const base = name.replace(/^_+/, '');
    return /^\d/.test(base) || RESERVED_WORDS.has(base);
};

/**
 * Whether a name, without the `_`s in front, is one digit from 1 to 9 (`_1` is a numbered parameter).
 * @param {string} name - The name.
 * @returns {boolean} true for `1`, `_1`, `__9`, ...
 */
const isOneDigit = (name) => /^_*[1-9]$/.test(name);

/**
 * The prefix that makes a block name a Ruby method name.
 * @param {string} name - The name of the block.
 * @returns {string} `''`, `'_'` or `'__'`.
 */
const prefixOf = (name) => {
    if (isOneDigit(name)) return '__';
    return needsPrefix(name) ? '_' : '';
};

/**
 * The Ruby method name of a custom block name (the words of the proccode joined with `_`).
 * @param {string} blockName - The name of the block, e.g. `1_文字えらぶ`.
 * @returns {string} The method name, e.g. `_1_文字えらぶ`.
 */
const rubyMethodNameOfBlockName = (blockName) => `${prefixOf(blockName)}${blockName}`;

/**
 * The name of the custom block of a Ruby method name (the reverse of `rubyMethodNameOfBlockName`).
 * @param {string} methodName - The method name, e.g. `_1_文字えらぶ`.
 * @returns {string} The name of the block, e.g. `1_文字えらぶ`.
 */
const blockNameOfRubyMethodName = (methodName) => {
    if (isOneDigit(methodName)) return methodName.startsWith('__') ? methodName.slice(2) : methodName;
    return methodName.startsWith('_') && needsPrefix(methodName) ? methodName.slice(1) : methodName;
};

/**
 * The Ruby method name of a proccode (`'1 文字えらぶ %s'` → `_1_文字えらぶ`).
 * @param {string} proccode - The proccode of a procedures_prototype / procedures_call block.
 * @returns {string} The method name (an empty string for an empty proccode).
 */
const rubyMethodNameOfProccode = (proccode) =>
    rubyMethodNameOfBlockName(
        (proccode || '')
            .split(' ')
            .filter((i) => !/^%[sb]$/.test(i))
            .join('_'),
    );

export { blockNameOfRubyMethodName, rubyMethodNameOfBlockName, rubyMethodNameOfProccode };
