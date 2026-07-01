import {normalizeColorString, CSS_NAMED_COLORS} from
    '../../../../src/lib/ruby-to-blocks-converter/color-utils';

describe('ruby-to-blocks-converter/color-utils normalizeColorString', () => {
    test('keeps 6-digit hex but lowercases it', () => {
        expect(normalizeColorString('#e36e1a')).toEqual('#e36e1a');
        expect(normalizeColorString('#FF0000')).toEqual('#ff0000');
        expect(normalizeColorString('  #AaBbCc  ')).toEqual('#aabbcc');
    });

    test('expands shorthand #rgb', () => {
        expect(normalizeColorString('#f00')).toEqual('#ff0000');
        expect(normalizeColorString('#0F0')).toEqual('#00ff00');
        expect(normalizeColorString('#abc')).toEqual('#aabbcc');
    });

    test('resolves CSS named colors case-insensitively', () => {
        expect(normalizeColorString('red')).toEqual('#ff0000');
        expect(normalizeColorString('Blue')).toEqual('#0000ff');
        expect(normalizeColorString('LIME')).toEqual('#00ff00');
        expect(normalizeColorString('green')).toEqual('#008000');
        expect(normalizeColorString('rebeccapurple')).toEqual('#663399');
    });

    test('parses rgb() / rgba() functional notation, ignoring alpha', () => {
        expect(normalizeColorString('rgb(255, 0, 0)')).toEqual('#ff0000');
        expect(normalizeColorString('rgb(0,128,0)')).toEqual('#008000');
        expect(normalizeColorString('rgba(255, 255, 255, 0.5)')).toEqual('#ffffff');
    });

    test('returns null for non-color strings and out-of-range values', () => {
        expect(normalizeColorString('10')).toBeNull();
        expect(normalizeColorString('notacolor')).toBeNull();
        expect(normalizeColorString('#0')).toBeNull();
        expect(normalizeColorString('43066f')).toBeNull();
        expect(normalizeColorString('#43066f0')).toBeNull();
        expect(normalizeColorString('rgb(300, 0, 0)')).toBeNull();
        expect(normalizeColorString('')).toBeNull();
        expect(normalizeColorString(null)).toBeNull();
        expect(normalizeColorString(undefined)).toBeNull(); // eslint-disable-line no-undefined
    });

    test('coerces string-like values (e.g. converter Primitive)', () => {
        const primitiveLike = {toString: () => 'red'};
        expect(normalizeColorString(primitiveLike)).toEqual('#ff0000');
    });

    test('CSS_NAMED_COLORS values are all #rrggbb', () => {
        Object.values(CSS_NAMED_COLORS).forEach(hex => {
            expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        });
    });
});
