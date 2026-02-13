const KeyOptions = [
    'space',
    'left arrow',
    'right arrow',
    'down arrow',
    'up arrow',
    'any',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9'
];

/**
 * scratch-vm/src/engine/variable.jsからコピー
 * @constant
 */
const Variable = {
    SCALAR_TYPE: '',
    LIST_TYPE: 'list',
    BROADCAST_MESSAGE_TYPE: 'broadcast_msg'
};

/**
 * Pattern to match local variables created by RubyToBlocksConverter.
 * Format: _%rubyIdentifier%_%scopeIndex%_
 * Examples: _text_1_, _foo_bar_2_, _高尾_3_
 *
 * This pattern matches:
 * - Underscore prefix
 * - Ruby identifier (starts with lowercase letter, underscore, or non-ASCII letter)
 * - Underscore + number (scope index) + underscore suffix
 * @constant
 */
const LOCAL_VARIABLE_PATTERN = /^_(?![A-Z])[\p{L}_][\p{L}\p{N}_]*_\d+_$/u;

export {
    KeyOptions,
    Variable,
    LOCAL_VARIABLE_PATTERN
};
