/**
 * 名前の札（「ガイド」）（#2133）: 部分の探し方と札の置き方（純粋関数）。
 */
import { HINT_TARGETS, findHintTargetRect } from '../../../../src/lib/lessons/hint-targets';
import {
    PART_NAMES,
    clickPartNameTarget,
    computePartNameLayout,
    findPartNameClickTarget,
    findPartNameRects,
} from '../../../../src/lib/lessons/part-names';

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
    { label: 'rubyTab', rect: rect(290, 88, 372, 120), sides: ['below', 'right'], small: true },
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
    test('there are names for the 9 parts of the editor (the 4 tabs with Ruby, flag and stop count as one part each)', () => {
        expect(PART_NAMES.map((p) => p.target)).toEqual([
            HINT_TARGETS.TASK_BAR,
            HINT_TARGETS.HINT_BUTTON,
            HINT_TARGETS.CODE_TAB,
            HINT_TARGETS.COSTUMES_TAB,
            HINT_TARGETS.SOUNDS_TAB,
            HINT_TARGETS.RUBY_TAB,
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
        // 小さな部分の札は、しっぽの入るすき間（10）を空ける
        expect(at.codeTab).toMatchObject({ left: 4, top: 130 });
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

    test('small labels are speech bubbles whose tail points at the middle of their part', () => {
        const at = Object.fromEntries(layout.map((l) => [l.label, l]));
        PARTS_1300.forEach((p) => {
            const l = at[p.label];
            if (!p.small) {
                expect({ label: p.label, small: l.small, arrow: l.arrow }).toEqual({
                    label: p.label,
                    small: false,
                    arrow: null,
                });
                return;
            }
            expect({ label: p.label, small: l.small, hasArrow: l.arrow !== null }).toEqual({
                label: p.label,
                small: true,
                hasArrow: true,
            });
            const box = { left: l.left, top: l.top, right: l.left + l.width, bottom: l.top + l.height };
            // しっぽの辺は札が部分のどちら側にあるかで決まる
            const side = l.arrow.side;
            if (side === 'top') expect(box.top).toBeGreaterThanOrEqual(p.rect.bottom);
            if (side === 'bottom') expect(box.bottom).toBeLessThanOrEqual(p.rect.top);
            if (side === 'left') expect(box.left).toBeGreaterThanOrEqual(p.rect.right);
            if (side === 'right') expect(box.right).toBeLessThanOrEqual(p.rect.left);
            // しっぽは札の辺の上（角から 10 離す）
            const len = side === 'top' || side === 'bottom' ? l.width : l.height;
            expect(l.arrow.offset).toBeGreaterThanOrEqual(10);
            expect(l.arrow.offset).toBeLessThanOrEqual(len - 10);
        });
        // コードタブ（0〜92）の札は下に置き、しっぽはタブの真ん中（x = 46）を指す
        expect(at.codeTab.arrow).toEqual({ side: 'top', offset: 46 - at.codeTab.left });
    });

    test('a tail follows the side the label was put on', () => {
        const place = (sides) =>
            computePartNameLayout({
                parts: [{ label: 'greenFlag', rect: rect(600, 300, 632, 332), sides, small: true }],
                sizes: { greenFlag: { width: 60, height: 22 } },
                viewport: VIEWPORT,
            })[0];
        // 左に置くと、しっぽは札の右の辺から出て旗の真ん中（y = 316）を指す
        const left = place(['left']);
        expect(left.left + left.width).toBe(590);
        expect(left.arrow).toEqual({ side: 'right', offset: 316 - left.top });
        const right = place(['right']);
        expect(right.left).toBe(642);
        expect(right.arrow).toEqual({ side: 'left', offset: 316 - right.top });
        const below = place(['below']);
        expect(below.top).toBe(342);
        expect(below.arrow).toEqual({ side: 'top', offset: 616 - below.left });
    });

    test('a small label does not cover its own part when there is room beside it', () => {
        // 下は画面の外。札は旗にかぶせず、横に置いてしっぽで指す
        const [placed] = computePartNameLayout({
            parts: [{ label: 'greenFlag', rect: rect(1200, 560, 1232, 592), sides: ['below', 'left'], small: true }],
            sizes: { greenFlag: { width: 60, height: 22 } },
            viewport: VIEWPORT,
        });
        expect(overlapsRect(placed, rect(1200, 560, 1232, 592))).toBe(false);
        expect(placed.arrow).not.toBeNull();
    });

    test('a small label that has to sit on its own part has no tail', () => {
        const [placed] = computePartNameLayout({
            parts: [{ label: 'stop', rect: rect(0, 0, 1300, 600), sides: ['below', 'right'], small: true }],
            sizes: { stop: { width: 60, height: 22 } },
            viewport: VIEWPORT,
        });
        expect(placed.arrow).toBeNull();
    });
});

describe('clicking a small label', () => {
    const addEl = (tag, attrs, r) => {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        el.getBoundingClientRect = () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top });
        return el;
    };
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('finds the same element the hint balloon and the frame point at', () => {
        const list = addEl('ul', { role: 'tablist' }, rect(0, 88, 372, 120));
        ['code', 'costumes', 'sounds', 'ruby'].forEach((name, i) =>
            list.appendChild(
                addEl('li', { role: 'tab', class: `gui_tab_abc12 ${name}` }, rect(i * 92, 88, i * 92 + 90, 120)),
            ),
        );
        document.body.appendChild(list);
        const flagButton = addEl('button', {}, rect(830, 92, 862, 124));
        flagButton.appendChild(addEl('img', { class: 'green-flag_green-flag_x1y2z' }, rect(830, 92, 862, 124)));
        document.body.appendChild(flagButton);
        const stopButton = addEl('button', {}, rect(866, 92, 898, 124));
        stopButton.appendChild(addEl('img', { class: 'stop-all_stop-all_x1y2z' }, rect(866, 92, 898, 124)));
        document.body.appendChild(stopButton);
        document.body.appendChild(
            addEl('button', { 'data-testid': 'lesson-task-bar-hint' }, rect(1040, 56, 1092, 80)),
        );
        const targets = Object.fromEntries(PART_NAMES.map((p) => [p.label, p.target]));
        PART_NAMES.filter((p) => p.small).forEach(({ label }) => {
            const el = findPartNameClickTarget(label, document);
            expect({ label, found: el !== null }).toEqual({ label, found: true });
            const r = el.getBoundingClientRect();
            expect(findHintTargetRect(targets[label], document)).toEqual(rect(r.left, r.top, r.right, r.bottom));
        });
    });

    test('the SP side rail buttons come first', () => {
        const tab = addEl('li', { role: 'tab', class: 'gui_tab_abc12' }, rect(0, 88, 92, 120));
        document.body.appendChild(tab);
        const rail = addEl('button', { 'data-testid': 'mobile-side-rail-code' }, rect(0, 60, 48, 108));
        document.body.appendChild(rail);
        expect(findPartNameClickTarget('codeTab', document)).toBe(rail);
    });

    test('presses the button that holds the green flag picture, and the tab itself', () => {
        const button = addEl('button', {}, rect(830, 92, 862, 124));
        const img = addEl('img', { class: 'green-flag_green-flag_x1y2z' }, rect(830, 92, 862, 124));
        button.appendChild(img);
        document.body.appendChild(button);
        const onFlag = jest.fn();
        button.addEventListener('click', onFlag);
        expect(clickPartNameTarget('greenFlag', document)).toBe(true);
        expect(onFlag).toHaveBeenCalledTimes(1);

        const list = addEl('ul', { role: 'tablist' }, rect(0, 88, 372, 120));
        const tab = addEl('li', { role: 'tab', class: 'gui_tab_abc12' }, rect(0, 88, 92, 120));
        list.appendChild(tab);
        document.body.appendChild(list);
        const onTab = jest.fn();
        tab.addEventListener('click', onTab);
        expect(clickPartNameTarget('codeTab', document)).toBe(true);
        expect(onTab).toHaveBeenCalledTimes(1);
    });

    test('wide parts and parts that are not on the screen are not pressed', () => {
        expect(findPartNameClickTarget('palette', document)).toBeNull();
        expect(clickPartNameTarget('stop', document)).toBe(false);
        // 見えない（大きさが 0 の）部品は押さない
        document.body.appendChild(addEl('button', { 'data-testid': 'lesson-task-bar-hint' }, rect(0, 0, 0, 0)));
        expect(clickPartNameTarget('hint', document)).toBe(false);
    });
});
