/**
 * ヒントの吹き出しが指す場所（DOM の探し方）と置き方（純粋関数）。
 */
import { COURSES } from '../../../../src/lib/lessons/courses';
import {
    HINT_SIDES,
    HINT_TARGETS,
    clampHintPosition,
    computeHintPlacement,
    findHintAvoidRects,
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

    // ルビータブは 4 つめのタブ。SP はサイドレールのボタン（#2142）
    test('the Ruby tab is the 4th desktop tab, or the side rail button on SP', () => {
        const list = document.createElement('ul');
        [rect(0, 88, 92, 120), rect(92, 88, 214, 120), rect(214, 88, 290, 120), rect(290, 88, 372, 120)].forEach(
            (r) => {
                const li = document.createElement('li');
                li.className = 'gui_tab_abc';
                li.getBoundingClientRect = () => r;
                list.appendChild(li);
            },
        );
        document.body.appendChild(list);
        expect(findHintTargetRect(HINT_TARGETS.RUBY_TAB, document)).toEqual(rect(290, 88, 372, 120));
        addEl('x', rect(0, 300, 48, 348), { 'data-testid': 'mobile-side-rail-ruby' });
        expect(findHintTargetRect(HINT_TARGETS.RUBY_TAB, document)).toEqual(rect(0, 300, 48, 348));
    });

    // 「なまえ」の札でも使う場所（#2133）
    test('the stop button, the code tab, the task bar and the hint button are found', () => {
        addEl('stop-all_stop-all-button_abc', rect(0, 0, 10, 10));
        expect(findHintTargetRect(HINT_TARGETS.STOP_BUTTON, document)).toBeNull();
        addEl('stop-all_stop-all_abc', rect(940, 60, 970, 90));
        expect(findHintTargetRect(HINT_TARGETS.STOP_BUTTON, document)).toEqual(rect(940, 60, 970, 90));
        const list = document.createElement('ul');
        [rect(0, 88, 100, 120), rect(100, 88, 200, 120)].forEach((r) => {
            const li = document.createElement('li');
            li.className = 'gui_tab_abc';
            li.getBoundingClientRect = () => r;
            list.appendChild(li);
        });
        document.body.appendChild(list);
        expect(findHintTargetRect(HINT_TARGETS.CODE_TAB, document)).toEqual(rect(0, 88, 100, 120));
        addEl('', rect(0, 48, 1300, 88), { 'data-testid': 'lesson-task-bar' });
        addEl('', rect(1000, 56, 1050, 80), { 'data-testid': 'lesson-task-bar-hint' });
        expect(findHintTargetRect(HINT_TARGETS.TASK_BAR, document)).toEqual(rect(0, 48, 1300, 88));
        expect(findHintTargetRect(HINT_TARGETS.HINT_BUTTON, document)).toEqual(rect(1000, 56, 1050, 80));
    });

    test('the extension button is found by the data-testid of the Smalruby component', () => {
        addEl('extension-button_extension-button-container_abc', rect(0, 540, 60, 600), {
            'data-testid': 'extension-button',
        });
        expect(findHintTargetRect(HINT_TARGETS.EXTENSION_BUTTON, document)).toEqual(rect(0, 540, 60, 600));
    });

    test('the practice partner panel (or its open button) is found and is avoided (#1643)', () => {
        expect(findHintAvoidRects(document)).toEqual([]);
        addEl('', rect(1180, 540, 1260, 570), { 'data-testid': 'lesson-practice-partner-open' });
        expect(findHintTargetRect(HINT_TARGETS.PRACTICE_PARTNER, document)).toEqual(rect(1180, 540, 1260, 570));
        expect(findHintAvoidRects(document)).toEqual([]);
        addEl('', rect(746, 132, 922, 331), { 'data-testid': 'lesson-practice-partner' });
        expect(findHintTargetRect(HINT_TARGETS.PRACTICE_PARTNER, document)).toEqual(rect(746, 132, 922, 331));
        expect(findHintAvoidRects(document)).toEqual([rect(746, 132, 922, 331)]);
    });

    test('the role buttons in the task bar are found by their data-testid (not the note under them)', () => {
        expect(findHintTargetRect(HINT_TARGETS.ROLE_PICKER, document)).toBeNull();
        addEl('', rect(880, 46, 1040, 66), { 'data-testid': 'lesson-task-bar-role-buttons' });
        expect(findHintTargetRect(HINT_TARGETS.ROLE_PICKER, document)).toEqual(rect(880, 46, 1040, 66));
    });

    test('the balloon pointing at the role buttons may cover the practice partner panel (it sits right under them)', () => {
        addEl('', rect(746, 132, 922, 331), { 'data-testid': 'lesson-practice-partner' });
        expect(findHintAvoidRects(document, HINT_TARGETS.ROLE_PICKER)).toEqual([]);
        expect(findHintAvoidRects(document, HINT_TARGETS.PALETTE)).toEqual([rect(746, 132, 922, 331)]);
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
        'stop-all_stop-all_': ['stop-all/stop-all.css', 'stop-all'],
    };

    // タブは並び順（nth-child）で探す。ルビータブ（Smalruby が足したタブ）が 4 つめのままかを見張る（#2142）
    test('the tabs are Code, Costumes, Sounds and Ruby in this order in gui.jsx', () => {
        const gui = fs.readFileSync(path.join(srcDir, 'components/gui/gui.jsx'), 'utf8');
        const ids = ['gui.gui.codeTab', 'gui.gui.costumesTab', 'gui.gui.soundsTab', 'gui.smalruby3.gui.rubyTab'];
        const at = ids.map((id) => gui.indexOf(`id="${id}"`));
        at.forEach((i) => expect(i).toBeGreaterThan(0));
        expect([...at].sort((x, y) => x - y)).toEqual(at);
        const tabList = gui.slice(gui.indexOf('<TabList'), gui.indexOf('</TabList>'));
        expect(tabList.match(/<Tab\b/g)).toHaveLength(4);
    });

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

    // 1300×600 のチャットのレッスン 3: 練習相手のパネル（コードエリアの右上）に吹き出しをかぶせない（#1643）
    describe('with the practice partner panel to avoid (#1643)', () => {
        const panel = rect(746, 132, 922, 331);
        const vp = { width: 1300, height: 600, top: 80 };
        const overlaps = (p, b, r) =>
            p.left < r.right && p.left + b.width > r.left && p.top < r.bottom && p.top + b.height > r.top;

        test('a wide balloon right of the palette slides left a little over the palette rather than the panel', () => {
            const palette = rect(0, 117, 311, 563);
            const big = { width: 480, height: 374 };
            const placed = computeHintPlacement({
                target: palette,
                balloon: big,
                viewport: vp,
                sides: preferredSides('palette'),
                avoid: [panel],
            });
            expect(overlaps(placed, big, panel)).toBe(false);
            expect(placed.side).toBe(HINT_SIDES.RIGHT);
            expect(placed.left).toBe(746 - 12 - 480);
        });

        test('a balloon left of the sprite list moves left of the panel', () => {
            const sprites = rect(930, 404, 1212, 600);
            const b = { width: 352, height: 312 };
            const placed = computeHintPlacement({
                target: sprites,
                balloon: b,
                viewport: vp,
                sides: preferredSides('sprite-list'),
                avoid: [panel],
            });
            expect(overlaps(placed, b, panel)).toBe(false);
            expect(placed.side).toBe(HINT_SIDES.LEFT);
            expect(placed.left + b.width).toBeLessThanOrEqual(746);
        });

        test('pointing at the panel puts the balloon to its left, not over it', () => {
            const placed = computeHintPlacement({
                target: panel,
                balloon,
                viewport: vp,
                sides: preferredSides(HINT_TARGETS.PRACTICE_PARTNER),
                avoid: [panel],
            });
            expect(placed.side).toBe(HINT_SIDES.LEFT);
            expect(overlaps(placed, balloon, panel)).toBe(false);
        });

        test('a balloon without a target (centered) moves off the panel too', () => {
            const b = { width: 352, height: 212 };
            const placed = computeHintPlacement({ target: null, balloon: b, viewport: vp, avoid: [panel] });
            expect(placed.side).toBe(HINT_SIDES.CENTER);
            expect(overlaps(placed, b, panel)).toBe(false);
        });

        // 1440×900 のチャットのレッスン 4-3 のヒント 1（ステージを指す・図のある高い吹き出し）: パネルをよけて
        // 下にずらすと、ステージの真ん中の高さは吹き出しの上の端より上になる。しっぽを角に寄せて描くと、
        // 閉じるボタンにかぶる白いひし形になるので、しっぽは出さない
        test('no arrow when the balloon slid off the target so the arrow could only sit at a corner', () => {
            const stage = rect(1070, 132, 1432, 404);
            const partnerPanel = rect(886, 140, 1062, 339);
            const big = { width: 480, height: 476 };
            const placed = computeHintPlacement({
                target: stage,
                balloon: big,
                viewport: { width: 1440, height: 900, top: 88 },
                sides: preferredSides('stage'),
                avoid: [partnerPanel],
            });
            expect(placed.side).toBe(HINT_SIDES.LEFT);
            expect(placed.top).toBeGreaterThan((132 + 404) / 2);
            expect(placed.arrow).toBeNull();
        });

        // 1300×600 のチャットのレッスン 4-3 のヒント 8（旗を指す）: 旗は練習相手のパネルの上にあるので、吹き出しは
        // 旗の左に置かれ、パネルをよけて左へずれる。しっぽの高さ（y = 14）は辺の中だが、ヘッダーの帯（上から 38px）の
        // 中で、閉じるボタンの横に白いひし形が出るので、しっぽは出さない
        test('no arrow when a sideways arrow would sit in the header band', () => {
            const flag = rect(930, 86, 962, 118);
            const partnerPanel = rect(750, 130, 1290, 400);
            const tall = { width: 352, height: 485, header: 38, closeLeft: 318 };
            const placed = computeHintPlacement({
                target: flag,
                balloon: tall,
                viewport: { width: 1300, height: 600, top: 80 },
                sides: preferredSides(HINT_TARGETS.GREEN_FLAG),
                avoid: [partnerPanel],
            });
            expect(placed.side).toBe(HINT_SIDES.LEFT);
            expect(placed.top).toBe(88);
            expect(placed.arrow).toBeNull();
        });

        test('a sideways arrow just below the header band is still drawn', () => {
            const target = rect(930, 140, 962, 172);
            const placed = computeHintPlacement({
                target,
                balloon: { width: 352, height: 300, header: 38, closeLeft: 318 },
                viewport: { width: 1300, height: 600, top: 80 },
                sides: [HINT_SIDES.LEFT],
            });
            expect(placed.side).toBe(HINT_SIDES.LEFT);
            expect(placed.top).toBe(88);
            expect(placed.arrow).toEqual({ x: 340, y: 68 });
        });

        test('no arrow when an arrow on the top edge would sit on the close button', () => {
            // 下に置いた吹き出しを画面の右に収めた結果、しっぽ（上の辺・ヘッダーの色）が閉じるボタンにかかる
            const target = rect(1250, 40, 1290, 80);
            const b = { width: 352, height: 200, header: 38, closeLeft: 318 };
            const placed = computeHintPlacement({ target, balloon: b, viewport, sides: [HINT_SIDES.BOTTOM] });
            expect(placed.side).toBe(HINT_SIDES.BOTTOM);
            expect(placed.left).toBe(1300 - 352 - 8);
            expect(placed.arrow).toBeNull();
            // 閉じるボタンの左なら出す
            const left = computeHintPlacement({
                target: rect(1150, 40, 1190, 80),
                balloon: b,
                viewport,
                sides: [HINT_SIDES.BOTTOM],
            });
            expect(left.arrow).toEqual({ x: 230, y: 12 });
        });

        test('without anything to avoid the placement is as before', () => {
            const target = rect(0, 100, 310, 600);
            expect(computeHintPlacement({ target, balloon, viewport, avoid: [] })).toEqual(
                computeHintPlacement({ target, balloon, viewport }),
            );
        });
    });

    test('no arrow when the target is beside the balloon edge, not along it', () => {
        // 下に置いた吹き出しを画面の左に収めた結果、指す場所の真ん中が吹き出しの右の端より右にある
        const target = rect(700, 40, 760, 80);
        const narrow = { width: 375, height: 667 };
        const placed = computeHintPlacement({ target, balloon, viewport: narrow, sides: [HINT_SIDES.BOTTOM] });
        expect(placed.side).toBe(HINT_SIDES.BOTTOM);
        expect(placed.arrow).toBeNull();
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

    test('with no target, the balloon is centered in the area below the task bar', () => {
        const placed = computeHintPlacement({
            target: null,
            balloon: { width: 300, height: 200 },
            viewport: { left: 0, top: 80, width: 1300, height: 600 },
        });
        expect(placed.side).toBe(HINT_SIDES.CENTER);
        // 横は (1300 - 300) / 2、縦はバーの下（80〜600）の真ん中 80 + (520 - 200) / 2
        expect(placed.left).toBe(500);
        expect(placed.top).toBe(240);
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

    test('pointing at the role buttons in the task bar puts the balloon below the bar, arrow up at the buttons', () => {
        const viewport = { left: 0, top: 80, width: 1300, height: 600 };
        const placed = computeHintPlacement({
            target: rect(880, 46, 1040, 66),
            balloon: { width: 352, height: 200 },
            viewport,
            sides: preferredSides(HINT_TARGETS.ROLE_PICKER),
        });
        expect(placed.side).toBe(HINT_SIDES.BOTTOM);
        // バーの下（80 + 8）から。しっぽは役のボタンの真ん中（x = 960）を指す
        expect(placed.top).toBe(88);
        expect(placed.left + placed.arrow.x).toBe(960);
    });

    test('on a wide screen (1440x900) the arrow still points at the role buttons', () => {
        const placed = computeHintPlacement({
            target: rect(920, 58, 1086, 77),
            balloon: { width: 352, height: 212 },
            viewport: { left: 0, top: 88, width: 1440, height: 900 },
            sides: preferredSides(HINT_TARGETS.ROLE_PICKER),
            avoid: [],
        });
        expect(placed.side).toBe(HINT_SIDES.BOTTOM);
        expect(placed.arrow).not.toBeNull();
        expect(placed.left + placed.arrow.x).toBe(1003);
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
