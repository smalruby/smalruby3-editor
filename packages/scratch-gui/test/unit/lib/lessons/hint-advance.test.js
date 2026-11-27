/**
 * ヒントのページを自分で次へ進める判定（レッスン 0）と、まちがった場所での操作の一言。
 */
import { COURSES } from '../../../../src/lib/lessons/courses';
import {
    ADVANCE_KINDS,
    canAutoAdvance,
    isStepAdvanced,
    isWrongPlaceClick,
    takeHintObservation,
} from '../../../../src/lib/lessons/hint-advance';

const obs = (over = {}) => ({
    activeTab: 'code',
    paletteClicks: [],
    paletteClickCount: 0,
    focusClicks: 0,
    blocks: [],
    scripts: [],
    costume: 1,
    stageCostume: 0,
    spriteCount: 1,
    ...over,
});

describe('isStepAdvanced', () => {
    test('without advanceOn it never advances', () => {
        expect(isStepAdvanced(null, obs(), obs())).toBe(false);
        expect(isStepAdvanced({ unknown: 1 }, obs(), obs())).toBe(false);
    });

    test('click: a click on the block in the palette after the page was shown', () => {
        const adv = { click: 'palette', block: 'motion_movesteps' };
        const base = obs({ paletteClicks: ['motion_movesteps'], paletteClickCount: 1 });
        // ページを出す前に押したものは数えない
        expect(isStepAdvanced(adv, base, base)).toBe(false);
        expect(isStepAdvanced(adv, obs({ paletteClicks: ['motion_movesteps', 'motion_turnright'] }), base)).toBe(
            false,
        );
        expect(isStepAdvanced(adv, obs({ paletteClicks: ['motion_movesteps', 'motion_movesteps'] }), base)).toBe(
            true,
        );
    });

    test('placed: one more of the block in the code area', () => {
        const adv = { placed: 'motion_movesteps' };
        const base = obs({ blocks: [{ opcode: 'motion_movesteps', inputs: {} }] });
        expect(isStepAdvanced(adv, base, base)).toBe(false);
        expect(
            isStepAdvanced(adv, obs({ blocks: [...base.blocks, { opcode: 'motion_movesteps', inputs: {} }] }), base),
        ).toBe(true);
    });

    test('together: the blocks got into one script (not when they already were)', () => {
        const adv = { together: ['motion_movesteps', 'motion_turnright'] };
        const apart = obs({ scripts: [['motion_movesteps'], ['motion_turnright']] });
        const joined = obs({ scripts: [['motion_movesteps', 'motion_turnright']] });
        expect(isStepAdvanced(adv, joined, apart)).toBe(true);
        expect(isStepAdvanced(adv, apart, apart)).toBe(false);
        // もどるで開いたページ: もうできているので、すぐには進まない
        expect(isStepAdvanced(adv, joined, joined)).toBe(false);
    });

    test('tab, costume, sprites, backdrop', () => {
        expect(isStepAdvanced({ tab: 'costumes' }, obs({ activeTab: 'costumes' }), obs())).toBe(true);
        expect(isStepAdvanced({ tab: 'costumes' }, obs({ activeTab: 'sounds' }), obs())).toBe(false);
        expect(isStepAdvanced({ costume: 2 }, obs({ costume: 2 }), obs())).toBe(true);
        expect(isStepAdvanced({ spriteAdded: true }, obs({ spriteCount: 2 }), obs())).toBe(true);
        expect(isStepAdvanced({ spriteAdded: true }, obs(), obs())).toBe(false);
        expect(isStepAdvanced({ backdropChanged: true }, obs({ stageCostume: 3 }), obs())).toBe(true);
        expect(isStepAdvanced({ backdropChanged: true }, obs(), obs())).toBe(false);
    });

    test('field: the value of the input is no longer the given one', () => {
        const adv = { field: { opcode: 'motion_turnright', input: 'DEGREES', ne: 15 } };
        const base = obs({ blocks: [{ opcode: 'motion_turnright', inputs: { DEGREES: '15' } }] });
        expect(isStepAdvanced(adv, base, base)).toBe(false);
        expect(
            isStepAdvanced(adv, obs({ blocks: [{ opcode: 'motion_turnright', inputs: { DEGREES: '90' } }] }), base),
        ).toBe(true);
    });

    test('focusClicked: the pointed thing was pressed after the page was shown', () => {
        expect(isStepAdvanced({ focusClicked: true }, obs({ focusClicks: 3 }), obs({ focusClicks: 2 }))).toBe(true);
        expect(isStepAdvanced({ focusClicked: true }, obs({ focusClicks: 2 }), obs({ focusClicks: 2 }))).toBe(false);
    });
});

describe('canAutoAdvance', () => {
    const lesson = { autoAdvanceHints: true };
    const hint = { visible: true, minimized: false, lastResort: false, index: 0, step: { advanceOn: { tab: 'x' } } };

    test('only in a lesson that opts in, on a step with advanceOn that is not the last step', () => {
        expect(canAutoAdvance({ lesson, hint, stepCount: 2 })).toBe(true);
        expect(canAutoAdvance({ lesson: { autoAdvanceHints: false }, hint, stepCount: 2 })).toBe(false);
        expect(canAutoAdvance({ lesson, hint: { ...hint, step: {} }, stepCount: 2 })).toBe(false);
        // 最後の手順のページからは「うまく動かないときは」へ進めない
        expect(canAutoAdvance({ lesson, hint, stepCount: 1 })).toBe(false);
        expect(canAutoAdvance({ lesson, hint: { ...hint, lastResort: true }, stepCount: 2 })).toBe(false);
    });

    test('also when the hint is made small, but not when it is closed', () => {
        expect(canAutoAdvance({ lesson, hint: { ...hint, visible: false, minimized: true }, stepCount: 2 })).toBe(
            true,
        );
        expect(canAutoAdvance({ lesson, hint: { ...hint, visible: false, minimized: false }, stepCount: 2 })).toBe(
            false,
        );
    });
});

describe('isWrongPlaceClick', () => {
    const tip = { click: 'codeArea', blocks: ['motion_movesteps'], message: {} };

    test('a click on the block in the code area', () => {
        expect(isWrongPlaceClick(tip, { opcode: 'motion_movesteps', stackClick: true, palette: false })).toBe(true);
    });

    test('not a click in the palette, not another block, not a script started by a hat', () => {
        expect(isWrongPlaceClick(tip, { opcode: 'motion_movesteps', stackClick: true, palette: true })).toBe(false);
        expect(isWrongPlaceClick(tip, { opcode: 'motion_turnright', stackClick: true, palette: false })).toBe(false);
        expect(isWrongPlaceClick(tip, { opcode: 'motion_movesteps', stackClick: false, palette: false })).toBe(false);
        expect(isWrongPlaceClick(null, { opcode: 'motion_movesteps', stackClick: true, palette: false })).toBe(false);
    });
});

describe('takeHintObservation', () => {
    const block = (id, opcode, extra = {}) => ({ id, opcode, parent: null, inputs: {}, fields: {}, ...extra });
    const makeVm = () => {
        const blocks = {
            a: block('a', 'event_whenflagclicked', { next: 'b' }),
            b: block('b', 'motion_turnright', { parent: 'a', inputs: { DEGREES: { shadow: 's1' } } }),
            s1: block('s1', 'math_number', { parent: 'b', shadow: true, fields: { NUM: { value: '90' } } }),
            c: block('c', 'motion_movesteps'),
        };
        const container = { _blocks: blocks, getBlock: (id) => blocks[id] };
        const sprite = { isStage: false, isOriginal: true, currentCostume: 1, blocks: container };
        const stage = { isStage: true, isOriginal: true, currentCostume: 2 };
        return { editingTarget: sprite, runtime: { targets: [stage, sprite] } };
    };

    test('collects the blocks, the scripts, the costumes and the sprites', () => {
        const o = takeHintObservation(makeVm(), { activeTab: 'code', paletteClicks: ['x'], focusClicks: 1 });
        expect(o.activeTab).toBe('code');
        expect(o.paletteClickCount).toBe(1);
        expect(o.focusClicks).toBe(1);
        expect(o.blocks).toEqual([
            { opcode: 'event_whenflagclicked', inputs: {} },
            { opcode: 'motion_turnright', inputs: { DEGREES: '90' } },
            { opcode: 'motion_movesteps', inputs: {} },
        ]);
        expect(o.scripts).toEqual([['event_whenflagclicked', 'motion_turnright'], ['motion_movesteps']]);
        expect(o.costume).toBe(2);
        expect(o.stageCostume).toBe(2);
        expect(o.spriteCount).toBe(1);
    });

    test('does not crash without a VM', () => {
        expect(takeHintObservation(null).blocks).toEqual([]);
    });
});

describe('the advanceOn of the courses', () => {
    test('every advanceOn has exactly one known kind, and only lessons with autoAdvanceHints use it', () => {
        COURSES.forEach((course) =>
            [...(course.warmupLessons || []), ...course.lessons].forEach((lesson) =>
                lesson.challenges.forEach((challenge) =>
                    challenge.steps
                        .filter((step) => step.advanceOn)
                        .forEach((step) => {
                            expect(lesson.autoAdvanceHints).toBe(true);
                            expect(Object.keys(step.advanceOn).filter((k) => ADVANCE_KINDS.includes(k))).toHaveLength(
                                1,
                            );
                        }),
                ),
            ),
        );
    });
});
