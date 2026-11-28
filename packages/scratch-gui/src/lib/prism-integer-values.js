// === Smalruby: This file is Smalruby-specific (read the integers of a prism tree again from the source) ===
import { forEachNode } from './ruby-to-blocks-converter/node-walk';

// `@ruby/prism` (1.9.0 to 2.1.0) reads the value of an integer literal as a signed 32-bit number
// (`readVarInt()` of `deserialize.js` adds `(byte & 0x7f) << shift`), so 2^31 and more turn
// negative (`3000000000` was -1294967296, issue #2048). An integer below 2^31 is read right.

// The texts that can be 2^31 or more: 10 digits or more (decimal and octal), 8 hexadecimal digits
// or 32 binary digits. A source without any of them has no integer that prism reads wrong, and the
// tree is not walked.
const LONG_INTEGER_PATTERN = /\d[\d_]{9}|0[xX][\da-fA-F_]{8}|0[bB][01_]{32}/;

// An integer literal of Ruby: a sign, a base prefix, and the digits with `_` between them.
const INTEGER_LITERAL_PATTERN = /^([+-]?)(0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|0[dD][\d_]+|0[0-7_]+|[\d_]+)$/;

/**
 * The value of the text of a Ruby integer literal (e.g. `3_000_000_000`, `-0x80000000`).
 * A value beyond `Number.MAX_SAFE_INTEGER` is the nearest number: the numbers of Scratch are
 * floating point numbers, and a BigInt cannot be in the JSON of a project.
 * @param {string} text - The text of the literal.
 * @returns {?number} The value, or null when the text is not an integer literal.
 */
const integerValueOfText = (text) => {
    const match = INTEGER_LITERAL_PATTERN.exec(text.trim());
    if (!match) return null;
    const [, sign, body] = match;
    let digits = body.replace(/_/g, '');
    if (/^0[dD]/.test(digits)) {
        digits = digits.slice(2);
    } else if (/^0[0-7]/.test(digits)) {
        digits = `0o${digits.slice(1)}`;
    }
    if (digits === '' || /^0[xXbBoO]$/.test(digits)) return null;
    const value = BigInt(digits);
    return Number(sign === '-' ? -value : value);
};

/**
 * Put the right value in every integer literal of a prism tree, read again from the source.
 * prism reads 2^31 and more wrong (see above). The tree is walked only when the source may have
 * such an integer.
 * @param {object} root - The root node of the prism tree (`parseResult.value`).
 * @param {string} source - The source that was parsed.
 */
const fixIntegerValues = (root, source) => {
    if (!root || typeof source !== 'string' || !LONG_INTEGER_PATTERN.test(source)) return;
    // The offsets of prism are of the UTF-8 bytes of the source.
    const bytes = new TextEncoder().encode(source);
    const decoder = new TextDecoder();
    forEachNode(root, {
        enter(node, type) {
            if (type !== 'IntegerNode' || !node.location) return;
            const { startOffset, length } = node.location;
            const text = decoder.decode(bytes.subarray(startOffset, startOffset + length));
            const value = integerValueOfText(text);
            if (value !== null) node.value = value;
        },
    });
};

/**
 * Wrap the parse function of prism, so that the integers of the tree are right.
 * @param {function(string, object): object} parse - The parse function of prism.
 * @returns {function(string, object): object} The parse function that fixes the integers.
 */
const withFixedIntegers =
    (parse) =>
    (source, options = {}) => {
        const result = parse(source, options);
        if (result) fixIntegerValues(result.value, source);
        return result;
    };

export { integerValueOfText, fixIntegerValues, withFixedIntegers };
