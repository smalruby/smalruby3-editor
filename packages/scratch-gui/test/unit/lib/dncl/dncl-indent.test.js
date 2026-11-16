import { indentOffset, indentWidth } from '../../../../src/lib/dncl/dncl-indent';

describe('indentWidth', () => {
    test('a tab is 4 columns, a full-width space 2, a space 1', () => {
        expect(indentWidth('  ')).toBe(2);
        expect(indentWidth('\t')).toBe(4);
        expect(indentWidth('　 ')).toBe(3);
    });
});

describe('indentOffset', () => {
    test('finds the indent character that starts at a width', () => {
        expect(indentOffset('        x = 1', 4)).toBe(4);
        expect(indentOffset('\t\tx = 1', 4)).toBe(1);
        expect(indentOffset('　　x = 1', 2)).toBe(1);
    });

    test('is null when the indent does not reach it', () => {
        expect(indentOffset('  x = 1', 4)).toBeNull();
        expect(indentOffset('', 0)).toBeNull();
    });
});
