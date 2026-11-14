/**
 * ヒントの吹き出しが指す場所（DOM の探し方）と置き方（純粋関数）。
 */
import { COURSES } from '../../../../src/lib/lessons/courses';
import {
    HINT_SIDES,
    HINT_TARGETS,
    clampHintPosition,
    computeHintPlacement,
    findHintTargetRect,
    hintViewport,
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

    test('the extension button is found by the data-testid of the Smalruby component', () => {
        addEl('extension-button_extension-button-container_abc', rect(0, 540, 60, 600), {
            'data-testid': 'extension-button',
        });
        expect(findHintTargetRect(HINT_TARGETS.EXTENSION_BUTTON, document)).toEqual(rect(0, 540, 60, 600));
    });
});

// upstream の部品は data-testid を持たないので CSS Modules のクラス名の接頭辞（`<css ファイル名>_<クラス名>_`）で
// 探している。upstream がクラス名を変えると静かに壊れる（吹き出しが画面の真ん中に出る）ので、
// 使っている接頭辞の一覧と、そのクラスが css にまだあることを見張る
describe('hint targets: CSS Modules class names of upstream components', () => {
    const fs = require('fs');
    const path = require('path');
    const srcDir = path.resolve(__dirname, '../../../../src');
    const source = fs.readFileSync(path.join(srcDir, 'lib/lessons/hint-targets.js'), 'utf8');
    // 接頭辞 → その css ファイル（src/components からの相対）とクラス名
    const classPrefixes = {
        blocks_blocks_: ['blocks/blocks.css', 'blocks'],
        gui_tab_: ['gui/gui.css', 'tab'],
        'stage_stage-wrapper_': ['stage/stage.css', 'stage-wrapper'],
        'sprite-selector_sprite-selector_': ['sprite-selector/sprite-selector.css', 'sprite-selector'],
        'stage-selector_stage-selector_': ['stage-selector/stage-selector.css', 'stage-selector'],
        'green-flag_green-flag_': ['green-flag/green-flag.css', 'green-flag'],
    };

    test('every class prefix used by the selectors is listed here', () => {
        const used = new Set(Array.from(source.matchAll(/\[class\*="([^"]+)"\]/g), (m) => m[1]));
        expect(Array.from(used).sort()).toEqual(Object.keys(classPrefixes).sort());
    });

    test.each(Object.entries(classPrefixes))(
        '%s: the class is still defined in %s',
        (prefix, [cssFile, className]) => {
            const [fileName] = cssFile.split('/').slice(-1)[0].split('.');
            expect(prefix).toBe(`${fileName}_${className}_`);
            const css = fs.readFileSync(path.join(srcDir, 'components', cssFile), 'utf8');
            expect(css).toMatch(new RegExp(`\\.${className.replace(/-/g, '\\-')}[\\s.:,{\\[]`));
        },
    );
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

describe('hint targets: clampHintPosition (dragging the balloon)', () => {
    const viewport = { width: 1000, height: 600 };
    const balloon = { width: 300, height: 200 };

    test('keeps a position that is already on screen', () => {
        expect(clampHintPosition({ left: 100, top: 50 }, balloon, viewport)).toEqual({ left: 100, top: 50 });
    });

    test('does not let the balloon go off any edge (8px margin)', () => {
        expect(clampHintPosition({ left: -50, top: -20 }, balloon, viewport)).toEqual({ left: 8, top: 8 });
        expect(clampHintPosition({ left: 900, top: 550 }, balloon, viewport)).toEqual({ left: 692, top: 392 });
    });

    test('a balloon bigger than the screen sticks to the top-left margin', () => {
        expect(clampHintPosition({ left: 300, top: 300 }, { width: 1200, height: 700 }, viewport)).toEqual({
            left: 8,
            top: 8,
        });
    });

    test('uses the given margin', () => {
        expect(clampHintPosition({ left: -5, top: 0 }, balloon, viewport, 0)).toEqual({ left: 0, top: 0 });
    });
});

describe('hint targets: the SP side rail is above the balloon', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('hintViewport starts right of the side rail, and is the whole screen without it', () => {
        const win = { innerWidth: 375, innerHeight: 667 };
        expect(hintViewport(document, win)).toEqual({ left: 0, top: 0, width: 375, height: 667 });
        addEl('rail', rect(0, 0, 56, 667), { 'data-testid': 'mobile-side-rail' });
        expect(hintViewport(document, win)).toEqual({ left: 56, top: 0, width: 375, height: 667 });
    });

    test('hintViewport starts below the lesson task bar (the bar is drawn above the balloon)', () => {
        const win = { innerWidth: 1300, innerHeight: 600 };
        addEl('bar', rect(0, 40, 1300, 80), { 'data-testid': 'lesson-task-bar' });
        expect(hintViewport(document, win)).toEqual({ left: 0, top: 80, width: 1300, height: 600 });
    });

    test('placement and dragging keep a tall balloon below the task bar', () => {
        const viewport = { left: 0, top: 80, width: 1300, height: 600 };
        const balloon = { width: 352, height: 480 };
        // ステージ（y = 125〜395）の左に置くと、真ん中に合わせた上の端がバーの下にもぐる
        const placed = computeHintPlacement({
            target: rect(930, 125, 1290, 395),
            balloon,
            viewport,
            sides: [HINT_SIDES.LEFT],
        });
        expect(placed.side).toBe(HINT_SIDES.LEFT);
        expect(placed.top).toBe(88);
        expect(clampHintPosition({ left: 100, top: 10 }, balloon, viewport).top).toBe(88);
        // 収まらないほど高いときは、下を切っても上（ヘッダーと閉じる）を見せる
        expect(clampHintPosition({ left: 100, top: 10 }, { width: 352, height: 700 }, viewport).top).toBe(88);
    });

    test('placement and dragging keep the balloon right of the rail', () => {
        const viewport = { left: 56, width: 375, height: 667 };
        const balloon = { width: 256, height: 200 };
        const placed = computeHintPlacement({
            target: rect(0, 120, 56, 170),
            balloon,
            viewport,
            sides: [HINT_SIDES.BOTTOM],
        });
        expect(placed.left).toBe(64);
        expect(clampHintPosition({ left: 0, top: 100 }, balloon, viewport).left).toBe(64);
        // 場所の無いヒントは、レールの右の範囲の真ん中
        expect(computeHintPlacement({ target: null, balloon, viewport }).left).toBeCloseTo(56 + (375 - 56 - 256) / 2);
    });
});
