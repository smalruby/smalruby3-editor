import { lineNumberSeparator } from '../../../../src/lib/dncl/dncl-line-number';

// The separator between DNCL line numbers and the code (Issue #1718).
describe('lineNumberSeparator', () => {
    const lines = (...pairs) => pairs.map(([label, ws]) => ({ label, ws }));

    test('no numbered line takes nothing off', () => {
        expect(lineNumberSeparator([])('(1)')).toBe(0);
    });

    test('the least indented line gives the separator', () => {
        const separator = lineNumberSeparator(lines(['(1)', ' '], ['(2)', '     '], ['(3)', ' ']));
        expect(separator('(2)')).toBe(1);
    });

    test('labels of different widths with one space each keep one separator', () => {
        const separator = lineNumberSeparator(lines(['(00-1)', ' '], ['(01)', ' '], ['(02)', '   ']));
        expect(separator('(00-1)')).toBe(1);
        expect(separator('(01)')).toBe(1);
    });

    test('labels padded to the same column take off up to that column', () => {
        const separator = lineNumberSeparator(lines(['(9)', '  '], ['(10)', ' '], ['(11)', '     ']));
        expect(separator('(9)')).toBe(2);
        expect(separator('(10)')).toBe(1);
    });

    test('all lines indented (a part of a block) take off the whole indent', () => {
        const separator = lineNumberSeparator(lines(['(5)', '    '], ['(6)', '        ']));
        expect(separator('(6)')).toBe(4);
    });
});
