import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

/**
 * The line of a UTF-8 byte offset, by walking the source (the way it was found before the table of
 * new lines): 1 + the `\n`s that end at or before the offset.
 * @param {string} source - The source.
 * @param {number} byteOffset - The byte offset.
 * @returns {number} The line.
 */
const referenceLine = (source, byteOffset) => {
    const bytes = new TextEncoder().encode(source);
    let line = 1;
    for (let b = 0; b < bytes.length && b < byteOffset; b++) {
        if (bytes[b] === 0x0a) line++;
    }
    return line;
};

describe('RubyToBlocksConverter/_getLineForOffset', () => {
    test('gives the same line as walking the source, for every byte offset', () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        const source = 'say("こんにちは")\n\n@a = "😀"\nmove(10)\n';
        converter._context.sourceCode = source;
        const length = new TextEncoder().encode(source).length;
        for (let offset = -1; offset <= length + 2; offset++) {
            expect([offset, converter._getLineForOffset(offset)]).toEqual([offset, referenceLine(source, offset)]);
        }
    });

    test('follows a change of the source', () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        converter._context.sourceCode = 'a\nb\n';
        expect(converter._getLineForOffset(2)).toBe(2);
        converter._context.sourceCode = 'ab\n';
        expect(converter._getLineForOffset(2)).toBe(1);
    });

    test('is line 1 without a source or an offset', () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        expect(converter._getLineForOffset(3)).toBe(1);
        converter._context.sourceCode = 'a\nb';
        expect(converter._getLineForOffset(undefined)).toBe(1);
    });
});
