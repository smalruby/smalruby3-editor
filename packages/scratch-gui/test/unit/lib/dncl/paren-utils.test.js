import { findMatchingClose, isNameChar, isWholeWordAt, skipString } from '../../../../src/lib/dncl/paren-utils';

describe('paren-utils', () => {
    describe('skipString', () => {
        test('skips a simple string', () => {
            // start at opening quote, returns position after closing quote
            expect(skipString('"abc"def', 0, '"')).toBe(5);
        });

        test('handles escaped quotes', () => {
            // \" should not end the string
            expect(skipString('"a\\"b"x', 0, '"')).toBe(6);
        });

        test('returns end position for unterminated string', () => {
            expect(skipString('"unterm', 0, '"')).toBe(7);
        });

        test('works with single quotes', () => {
            expect(skipString("'abc'", 0, "'")).toBe(5);
        });
    });

    describe('findMatchingClose', () => {
        test('finds simple close paren', () => {
            // text[0] is '(', match at index 4
            expect(findMatchingClose('(abc)', 0)).toBe(4);
        });

        test('finds close paren past nested parens', () => {
            // outer '(' at 0, matching ')' at 8
            expect(findMatchingClose('(a(b)c)x', 0)).toBe(6);
        });

        test('handles parens inside strings', () => {
            // The ')' inside "()" is skipped; outer match at end
            expect(findMatchingClose('("a)b")', 0)).toBe(6);
        });

        test('returns -1 for unmatched', () => {
            expect(findMatchingClose('(abc', 0)).toBe(-1);
        });

        test('returns -1 if depth never reaches 0', () => {
            expect(findMatchingClose('((abc)', 0)).toBe(-1);
        });
    });

    describe('isNameChar', () => {
        test('letters of any script, digits and _ are name characters', () => {
            for (const ch of ['a', 'Z', '0', '_', '合', 'か', 'カ', 'ー', '々']) expect(isNameChar(ch)).toBe(true);
        });

        test('operators, spaces and brackets are not', () => {
            for (const ch of ['÷', '/', ' ', '(', ')', '[', ',', '、', undefined]) expect(isNameChar(ch)).toBe(false);
        });
    });
});
