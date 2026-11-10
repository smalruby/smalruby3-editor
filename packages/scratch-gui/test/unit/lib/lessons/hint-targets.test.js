/**
 * ヒントの吹き出しが指す場所（DOM の探し方）と置き方（純粋関数）。
 */
import { COURSES } from '../../../../src/lib/lessons/courses';
import {
    HINT_SIDES,
    HINT_TARGETS,
    computeHintPlacement,
    findHintTargetRect,
    preferredSides,
} from '../../../../src/lib/lessons/hint-targets';

const rect = (left, top, right, bottom) => ({ left, top, right, bottom });

// jsdom は layout をしないので getBoundingClientRect を要素ごとに差し替える
const addEl = (className, r, attrs = {}) => {
    const el = document.createElement('div');
    el.className = className;
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.getBoundingClientRect = () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top });
    document.body.appendChild(el);
    return el;
};

describe('hint targets: data', () => {
    test('every hint target in the courses is a known target', () => {
        COURSES.forEach((course) =>
            course.lessons.forEach((lesson) =>
                lesson.challenges.forEach((challenge) =>
                    challenge.steps.forEach((step) => {
                        if (step.target !== null) expect(Object.values(HINT_TARGETS)).toContain(step.target);
                    }),
                ),
            ),
        );
    });

    test('every target but the keyboard has preferred sides', () => {
        Object.values(HINT_TARGETS).forEach((target) => {
            const sides = preferredSides(target);
            if (target === HINT_TARGETS.KEYBOARD) expect(sides).toEqual([]);
            else expect(sides.length).toBeGreaterThan(0);
        });
        expect(preferredSides('unknown')).toEqual([]);
    });
});

describe('findHintTargetRect', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('the keyboard and unknown targets have no place', () => {
        expect(findHintTargetRect(HINT_TARGETS.KEYBOARD, document)).toBeNull();
        expect(findHintTargetRect('unknown', document)).toBeNull();
    });

    test('the palette is the union of the toolbox and the flyout inside the Blocks pane', () => {
        const blocks = addEl('blocks_blocks_abc', rect(0, 0, 800, 600));
        const toolbox = document.createElement('div');
        toolbox.className = 'blocklyToolbox';
        toolbox.getBoundingClientRect = () => rect(0, 50, 60, 600);
        const flyout = document.createElement('div');
        flyout.className = 'blocklyFlyout';
        flyout.getBoundingClientRect = () => rect(60, 50, 310, 600);
        blocks.append(toolbox, flyout);
        // 吹き出しの中のワークスペース（Blocks の外）は数えない
        addEl('blocklyFlyout', rect(500, 500, 600, 600));
        expect(findHintTargetRect(HINT_TARGETS.PALETTE, document)).toEqual(rect(0, 50, 310, 600));
    });

    test('the code area is the workspace svg to the right of the flyout', () => {
        const blocks = addEl('blocks_blocks_abc', rect(0, 0, 800, 600));
        const svg = document.createElement('div');
        svg.className = 'blocklySvg';
        svg.getBoundingClientRect = () => rect(0, 50, 800, 600);
        const flyout = document.createElement('div');
        flyout.className = 'blocklyFlyout';
        flyout.getBoundingClientRect = () => rect(60, 50, 310, 600);
        blocks.append(svg, flyout);
        expect(findHintTargetRect(HINT_TARGETS.CODE_AREA, document)).toEqual(rect(310, 50, 800, 600));
    });

    test('hidden elements (no size) are skipped and the next candidate is used', () => {
        addEl('x', rect(0, 0, 0, 0), { 'data-testid': 'mobile-side-rail-play' });
        addEl('green-flag_green-flag_abc', rect(900, 60, 930, 90));
        expect(findHintTargetRect(HINT_TARGETS.GREEN_FLAG, document)).toEqual(rect(900, 60, 930, 90));
    });

    test('the mobile side rail button wins over the desktop tab when visible', () => {
        addEl('x', rect(0, 100, 48, 148), { 'data-testid': 'mobile-side-rail-costume' });
        const list = document.createElement('ul');
        ['code', 'costumes', 'sounds'].forEach((name) => {
            const li = document.createElement('li');
            li.className = 'gui_tab_abc';
            li.getBoundingClientRect = () => rect(100, 0, 200, 40);
            li.textContent = name;
            list.appendChild(li);
        });
        document.body.appendChild(list);
        expect(findHintTargetRect(HINT_TARGETS.COSTUMES_TAB, document)).toEqual(rect(0, 100, 48, 148));
    });

    test('desktop tabs are picked by their order in the tab list', () => {
        const list = document.createElement('ul');
        [rect(0, 0, 100, 40), rect(100, 0, 200, 40), rect(200, 0, 300, 40)].forEach((r) => {
            const li = document.createElement('li');
            li.className = 'gui_tab_abc';
            li.getBoundingClientRect = () => r;
            list.appendChild(li);
        });
        document.body.appendChild(list);
        expect(findHintTargetRect(HINT_TARGETS.COSTUMES_TAB, document)).toEqual(rect(100, 0, 200, 40));
        expect(findHintTargetRect(HINT_TARGETS.SOUNDS_TAB, document)).toEqual(rect(200, 0, 300, 40));
    });
});

describe('computeHintPlacement', () => {
    const viewport = { width: 1300, height: 600 };
    const balloon = { width: 300, height: 200 };

    test('without a target the balloon is centered with no arrow', () => {
        expect(computeHintPlacement({ target: null, balloon, viewport })).toEqual({
            left: 500,
            top: 200,
            side: HINT_SIDES.CENTER,
            arrow: null,
        });
    });

    test('goes to the right of the palette, with the arrow pointing at its middle', () => {
        const target = rect(0, 100, 310, 600);
        const placed = computeHintPlacement({ target, balloon, viewport, sides: preferredSides('palette') });
        expect(placed.side).toBe(HINT_SIDES.RIGHT);
        expect(placed.left).toBe(322);
        expect(placed.top).toBe(250);
        expect(placed.arrow).toEqual({ x: 12, y: 100 });
    });

    test('falls below when there is no room to the right or left', () => {
        const narrow = { width: 375, height: 667 };
        const target = rect(0, 100, 200, 300);
        const placed = computeHintPlacement({ target, balloon, viewport: narrow, sides: preferredSides('palette') });
        expect(placed.side).toBe(HINT_SIDES.BOTTOM);
        expect(placed.top).toBe(312);
        // 横は画面の中に収める
        expect(placed.left).toBe(8);
        expect(placed.arrow.x).toBe(92);
    });

    test('falls inside when nothing fits, clamped into the viewport', () => {
        const narrow = { width: 375, height: 300 };
        const target = rect(0, 0, 375, 300);
        const placed = computeHintPlacement({ target, balloon, viewport: narrow, sides: preferredSides('palette') });
        expect(placed.side).toBe(HINT_SIDES.INSIDE);
        expect(placed.arrow).toBeNull();
        expect(placed.left).toBe(12);
        expect(placed.top).toBe(12);
    });

    test('to the left of the stage and below a tab', () => {
        const stage = rect(820, 60, 1290, 420);
        const left = computeHintPlacement({ target: stage, balloon, viewport, sides: preferredSides('stage') });
        expect(left.side).toBe(HINT_SIDES.LEFT);
        expect(left.left).toBe(508);
        const tab = rect(100, 40, 200, 80);
        const below = computeHintPlacement({ target: tab, balloon, viewport, sides: preferredSides('costumes-tab') });
        expect(below.side).toBe(HINT_SIDES.BOTTOM);
        expect(below.top).toBe(92);
        expect(below.left).toBe(8);
        expect(below.arrow).toEqual({ x: 142, y: 12 });
    });

    test('the default order is right, left, bottom, top', () => {
        const target = rect(1000, 250, 1100, 350);
        expect(computeHintPlacement({ target, balloon, viewport }).side).toBe(HINT_SIDES.LEFT);
        const atLeft = rect(10, 250, 110, 350);
        expect(computeHintPlacement({ target: atLeft, balloon, viewport }).side).toBe(HINT_SIDES.RIGHT);
    });
});
