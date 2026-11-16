import {
    CLASS_COLOR_TEXT,
    CLASS_COLORS,
    classColorEntryFor,
    classColorFor,
    classColorStyle,
    classOrderIndex,
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

    test('the palette is pinned in the order it is handed out', () => {
        expect(CLASS_COLORS.map((entry) => entry.color)).toEqual([
            '#3373CC',
            '#774DCB',
            '#0A8562',
            '#B941B9',
            '#B75C00',
            '#287DA2',
            '#328532',
            '#9D6911',
        ]);
    });

    const groupsOf = (n) =>
        Array.from({ length: n }, (_, i) => ({
            groupId: `g-${String.fromCharCode(122 - i)}`,
            createdAt: new Date(Date.UTC(2026, 3, 1 + i)).toISOString(),
        }));

    test('hands out the colors by creation date, oldest first', () => {
        const groups = groupsOf(8).reverse(); // order of the list does not matter
        expect(classColorFor('g-z', groups)).toBe('#3373CC');
        expect(classColorFor('g-y', groups)).toBe('#774DCB');
        expect(classColorFor('g-x', groups)).toBe('#0A8562');
        expect(classColorFor('g-w', groups)).toBe('#B941B9');
        expect(classColorFor('g-v', groups)).toBe('#B75C00');
        expect(classColorFor('g-u', groups)).toBe('#287DA2');
        expect(classColorFor('g-t', groups)).toBe('#328532');
        expect(classColorFor('g-s', groups)).toBe('#9D6911');
    });

    test('8 classes never share a color, the 9th starts over', () => {
        const groups = groupsOf(9);
        const colors = groups.slice(0, 8).map((group) => classColorFor(group.groupId, groups));
        expect(new Set(colors).size).toBe(8);
        expect(classColorFor('g-r', groups)).toBe('#3373CC');
    });

    test('the same creation date is ordered by id', () => {
        const groups = [
            { groupId: 'b', createdAt: '2026-04-01T00:00:00.000Z' },
            { groupId: 'a', createdAt: '2026-04-01T00:00:00.000Z' },
        ];
        expect(classOrderIndex('a', groups)).toBe(0);
        expect(classColorFor('b', groups)).toBe('#774DCB');
    });

    test('a new class does not change the colors of the older ones', () => {
        const groups = groupsOf(3);
        const before = groups.map((group) => classColorFor(group.groupId, groups));
        const more = [...groups, { groupId: 'g-new', createdAt: '2026-05-01T00:00:00.000Z' }];
        expect(groups.map((group) => classColorFor(group.groupId, more))).toEqual(before);
        expect(classColorFor('g-new', more)).toBe('#B941B9');
    });

    test('archived classes keep their place in the order', () => {
        const groups = groupsOf(3);
        groups[0].status = 'archived';
        expect(classColorFor('g-y', groups)).toBe('#774DCB');
    });

    test('falls back to a hash of the id when the creation date is missing', () => {
        expect(hashString('')).toBe(0x811c9dc5);
        expect(hashString('a')).toBe(0xe40c292c);
        // 'g-abc123' hashes to 0x2862b9f1 (index 1), 'class-1' to 0x22b907e5 (index 5)
        expect(classColorFor('g-abc123')).toBe('#774DCB');
        expect(classColorFor('class-1', [{ groupId: 'class-1' }])).toBe('#287DA2');
        expect(classColorFor('class-1', [{ groupId: 'class-1', createdAt: 'not a date' }])).toBe('#287DA2');
        expect(classColorFor('g-abc123', groupsOf(2))).toBe('#774DCB');
    });

    test('number ids give the same color as their string form', () => {
        expect(classColorFor(42)).toBe('#B941B9');
        expect(classColorFor('42')).toBe('#B941B9');
    });

    test('a missing id falls back to the first color (the action blue)', () => {
        expect(classColorFor(null)).toBe('#3373CC');
        expect(classColorFor(undefined)).toBe('#3373CC');
        expect(classColorFor('')).toBe('#3373CC');
    });

    test('classColorStyle gives the background and white text', () => {
        expect(classColorStyle('g-y', groupsOf(2))).toEqual({ backgroundColor: '#774DCB', color: '#FFFFFF' });
    });
});
