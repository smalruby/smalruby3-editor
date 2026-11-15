import {
    CLASS_COLOR_TEXT,
    CLASS_COLORS,
    classColorEntryFor,
    classColorFor,
    classColorStyle,
    hashString,
} from '../../../src/lib/classroom-class-color.js';
import { getColorsForMode } from '../../../src/lib/settings/color-mode/index.js';

const luminance = (hex) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255);
    const [r, g, b] = channels.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

const toHsl = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return { h: 0, s: 0 };
    const d = max - min;
    const l = (max + min) / 2;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h * 60, s };
};

describe('classroom class color', () => {
    test('every class color is readable with white text (4.5:1 or more)', () => {
        CLASS_COLORS.forEach(({ key, color }) => {
            expect({ key, ratio: contrast(color, CLASS_COLOR_TEXT) >= 4.5 }).toEqual({ key, ratio: true });
        });
    });

    test('colors are distinct', () => {
        const colors = CLASS_COLORS.map((entry) => entry.color.toUpperCase());
        expect(new Set(colors).size).toBe(colors.length);
    });

    test('each source is the Scratch category tertiary color in the original mode', () => {
        const palette = getColorsForMode('default');
        CLASS_COLORS.forEach(({ key, source }) => {
            expect(palette[key].colourTertiary.toUpperCase()).toBe(source.toUpperCase());
        });
    });

    test('a darkened color keeps the hue of its category', () => {
        CLASS_COLORS.forEach(({ source, color }) => {
            const a = toHsl(source);
            const b = toHsl(color);
            expect(Math.abs(a.h - b.h)).toBeLessThan(3);
        });
    });

    test('red categories are not used (red is only for urgent things, R4)', () => {
        const keys = CLASS_COLORS.map((entry) => entry.key);
        expect(keys).not.toContain('more');
        expect(keys).not.toContain('data_lists');
    });

    test('the same class id always gives the same color', () => {
        expect(classColorFor('g-abc123')).toBe(classColorFor('g-abc123'));
        expect(classColorEntryFor('g-abc123')).toBe(classColorEntryFor('g-abc123'));
    });

    test('pins the color for known ids so the order of CLASS_COLORS stays stable', () => {
        expect(hashString('')).toBe(0x811c9dc5);
        expect(hashString('a')).toBe(0xe40c292c);
        const id = 'class-1';
        expect(classColorFor(id)).toBe(CLASS_COLORS[hashString(id) % CLASS_COLORS.length].color);
    });

    test('spreads ids over several colors', () => {
        const used = new Set();
        for (let i = 0; i < 64; i++) used.add(classColorFor(`group-${i}`));
        expect(used.size).toBeGreaterThanOrEqual(CLASS_COLORS.length - 1);
    });

    test('number ids give the same color as their string form', () => {
        expect(classColorFor(42)).toBe(classColorFor('42'));
    });

    test('a missing id falls back to the first color (the action blue)', () => {
        expect(classColorFor(null)).toBe('#3373CC');
        expect(classColorFor(undefined)).toBe('#3373CC');
        expect(classColorFor('')).toBe('#3373CC');
    });

    test('classColorStyle gives the background and white text', () => {
        expect(classColorStyle('g-1')).toEqual({ backgroundColor: classColorFor('g-1'), color: '#FFFFFF' });
    });
});
