/**
 * 「なまえ」の札（#2133）: 部分の探し方と札の置き方（純粋関数）。
 */
import { HINT_TARGETS } from '../../../../src/lib/lessons/hint-targets';
import { PART_NAMES, computePartNameLayout, findPartNameRects } from '../../../../src/lib/lessons/part-names';

const rect = (left, top, right, bottom) => ({ left, top, right, bottom });
const overlaps = (a, b) =>
    Math.min(a.left + a.width, b.left + b.width) > Math.max(a.left, b.left) &&
    Math.min(a.top + a.height, b.top + b.height) > Math.max(a.top, b.top);
const overlapsRect = (a, r) =>
    Math.min(a.left + a.width, r.right) > Math.max(a.left, r.left) &&
    Math.min(a.top + a.height, r.bottom) > Math.max(a.top, r.top);

// 1300×600 の授業のパソコンでの、部分のおおよその場所（中くらいのステージ）
const VIEWPORT = { width: 1300, height: 600 };
const PARTS_1300 = [
    { label: 'taskBar', rect: rect(0, 48, 1300, 88), sides: ['below-center'] },
    { label: 'hint', rect: rect(1040, 56, 1092, 80), sides: ['below', 'left'], small: true },
    { label: 'codeTab', rect: rect(0, 88, 92, 120), sides: ['below', 'right'], small: true },
    { label: 'costumesTab', rect: rect(92, 88, 214, 120), sides: ['below', 'right'], small: true },
    { label: 'soundsTab', rect: rect(214, 88, 290, 120), sides: ['below', 'right'], small: true },
    { label: 'greenFlag', rect: rect(830, 92, 862, 124), sides: ['below', 'left'], small: true },
    { label: 'stop', rect: rect(866, 92, 898, 124), sides: ['below', 'right'], small: true },
    { label: 'palette', rect: rect(0, 120, 310, 600), sides: ['inside'] },
    { label: 'codeArea', rect: rect(310, 120, 820, 600), sides: ['inside'] },
    { label: 'stage', rect: rect(826, 128, 1306, 488), sides: ['inside'] },
    { label: 'spriteList', rect: rect(826, 492, 1200, 600), sides: ['inside'] },
    { label: 'backdrop', rect: rect(1200, 492, 1300, 600), sides: ['inside'] },
];
const SIZES = Object.fromEntries(PARTS_1300.map((p) => [p.label, { width: 12 + 14 * p.label.length, height: 22 }]));

describe('part names: data', () => {
    test('there are names for the 9 parts of the editor (tabs, flag and stop count as one part each)', () => {
        expect(PART_NAMES.map((p) => p.target)).toEqual([
            HINT_TARGETS.TASK_BAR,
            HINT_TARGETS.HINT_BUTTON,
            HINT_TARGETS.CODE_TAB,
            HINT_TARGETS.COSTUMES_TAB,
            HINT_TARGETS.SOUNDS_TAB,
            HINT_TARGETS.GREEN_FLAG,
            HINT_TARGETS.STOP_BUTTON,
            HINT_TARGETS.PALETTE,
            HINT_TARGETS.CODE_AREA,
            HINT_TARGETS.STAGE,
            HINT_TARGETS.SPRITE_LIST,
            HINT_TARGETS.BACKDROP,
        ]);
        expect(new Set(PART_NAMES.map((p) => p.label)).size).toBe(PART_NAMES.length);
    });
});

describe('findPartNameRects', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('parts that are not on the screen are left out', () => {
        expect(findPartNameRects(document)).toEqual([]);
        const bar = document.createElement('div');
        bar.setAttribute('data-testid', 'lesson-task-bar');
        bar.getBoundingClientRect = () => ({ ...rect(0, 48, 1300, 88), width: 1300, height: 40 });
        document.body.appendChild(bar);
        expect(findPartNameRects(document)).toEqual([
            { label: 'taskBar', rect: rect(0, 48, 1300, 88), sides: ['below-center'], small: false },
        ]);
    });
});

describe('computePartNameLayout', () => {
    const layout = computePartNameLayout({ parts: PARTS_1300, sizes: SIZES, viewport: VIEWPORT });

    test('places every label at 1300×600', () => {
        expect(layout.map((l) => l.label)).toEqual(PARTS_1300.map((p) => p.label));
    });

    test('labels stay on the screen', () => {
        layout.forEach((l) => {
            expect(l.left).toBeGreaterThanOrEqual(4);
            expect(l.top).toBeGreaterThanOrEqual(4);
            expect(l.left + l.width).toBeLessThanOrEqual(VIEWPORT.width - 4);
            expect(l.top + l.height).toBeLessThanOrEqual(VIEWPORT.height - 4);
        });
    });

    test('labels do not overlap each other', () => {
        layout.forEach((a, i) =>
            layout.slice(i + 1).forEach((b) =>
                expect({ a: a.label, b: b.label, hit: overlaps(a, b) }).toEqual({
                    a: a.label,
                    b: b.label,
                    hit: false,
                }),
            ),
        );
    });

    test('labels do not cover the small parts (buttons and tabs) of other labels', () => {
        const small = PARTS_1300.filter((p) => p.small);
        layout.forEach((l) =>
            small
                .filter((p) => p.label !== l.label)
                .forEach((p) =>
                    expect({ label: l.label, on: p.label, hit: overlapsRect(l, p.rect) }).toEqual({
                        label: l.label,
                        on: p.label,
                        hit: false,
                    }),
                ),
        );
    });

    test('a small part gets its label right below it, a wide part inside its top left corner', () => {
        const at = Object.fromEntries(layout.map((l) => [l.label, l]));
        expect(at.codeTab).toMatchObject({ left: 4, top: 124 });
        expect(at.codeArea).toMatchObject({ left: 314 });
        expect(at.codeArea.top).toBeGreaterThanOrEqual(124);
    });

    test('labels move away from the rects to avoid (the hint balloon)', () => {
        const balloon = rect(310, 120, 700, 400);
        const avoided = computePartNameLayout({
            parts: PARTS_1300,
            sizes: SIZES,
            viewport: VIEWPORT,
            avoid: [balloon],
        });
        const codeArea = avoided.find((l) => l.label === 'codeArea');
        expect(overlapsRect(codeArea, balloon)).toBe(false);
    });

    test('a label is clamped into the screen even when its part sticks out', () => {
        const [placed] = computePartNameLayout({
            parts: [{ label: 'stage', rect: rect(1200, -50, 1400, 100), sides: ['inside'] }],
            sizes: { stage: { width: 80, height: 22 } },
            viewport: VIEWPORT,
        });
        expect(placed.left + placed.width).toBeLessThanOrEqual(1296);
        expect(placed.top).toBeGreaterThanOrEqual(4);
    });

    test('labels whose size is unknown are not placed', () => {
        expect(computePartNameLayout({ parts: PARTS_1300, sizes: {}, viewport: VIEWPORT })).toEqual([]);
    });
});
