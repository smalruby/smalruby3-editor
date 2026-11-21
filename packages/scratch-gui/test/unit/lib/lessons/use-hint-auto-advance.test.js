/* eslint-env jest */
/**
 * ヒントのページを自分で次へ進める hook と、まちがった場所の一言。VM は作り物（読むだけなので、ブロックの
 * 入れ物・ターゲット・getOpcodeFunction があればよい）。
 */
import { act, renderHook } from '@testing-library/react';
import { HINT_FOCUS } from '../../../../src/lib/lessons/hint-targets';
import { useHintAutoAdvance } from '../../../../src/lib/lessons/use-hint-auto-advance';

const makeVm = () => {
    const blocks = {};
    const container = {
        _blocks: blocks,
        getBlock: (id) => blocks[id],
        resetCache: jest.fn(),
    };
    const sprite = { id: 'cat', isStage: false, isOriginal: true, currentCostume: 0, blocks: container };
    const runtime = {
        targets: [{ id: 'stage', isStage: true, currentCostume: 0 }, sprite],
        flyoutBlocks: { getBlock: () => null, resetCache: jest.fn() },
        getOpcodeFunction: () => () => {},
    };
    return { vm: { runtime, editingTarget: sprite }, blocks, sprite };
};

const tipMessage = { id: 'tip', defaultMessage: 'tip' };
const makeCurrent = (steps, { autoAdvanceHints = true, wrongPlaceTip = null } = {}) => ({
    lesson: { autoAdvanceHints },
    challenge: { steps, wrongPlaceTip },
});
const makeHint = (steps, index = 0, extra = {}) => ({
    visible: true,
    minimized: false,
    lastResort: false,
    index,
    step: steps[index],
    session: 1,
    ...extra,
});

describe('useHintAutoAdvance', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    const steps = [{ advanceOn: { placed: 'motion_movesteps' } }, { advanceOn: null }];

    test('goes on to the next page once the block is placed', () => {
        const { vm, blocks } = makeVm();
        const onNext = jest.fn();
        renderHook(() =>
            useHintAutoAdvance({
                vm,
                current: makeCurrent(steps),
                hint: makeHint(steps),
                activeTab: 'code',
                onNext,
                onShow: jest.fn(),
            }),
        );
        act(() => jest.advanceTimersByTime(1000));
        expect(onNext).not.toHaveBeenCalled();
        blocks.a = { id: 'a', opcode: 'motion_movesteps', parent: null, inputs: {} };
        act(() => jest.advanceTimersByTime(1000));
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    test('does nothing in a lesson without autoAdvanceHints', () => {
        const { vm, blocks } = makeVm();
        const onNext = jest.fn();
        renderHook(() =>
            useHintAutoAdvance({
                vm,
                current: makeCurrent(steps, { autoAdvanceHints: false }),
                hint: makeHint(steps),
                activeTab: 'code',
                onNext,
                onShow: jest.fn(),
            }),
        );
        blocks.a = { id: 'a', opcode: 'motion_movesteps', parent: null, inputs: {} };
        act(() => jest.advanceTimersByTime(1000));
        expect(onNext).not.toHaveBeenCalled();
    });

    test('waits while a number is being typed into a block', () => {
        const { vm, blocks } = makeVm();
        const onNext = jest.fn();
        const input = document.createElement('input');
        input.className = 'blocklyHtmlInput';
        document.body.appendChild(input);
        renderHook(() =>
            useHintAutoAdvance({
                vm,
                current: makeCurrent(steps),
                hint: makeHint(steps),
                activeTab: 'code',
                onNext,
                onShow: jest.fn(),
            }),
        );
        blocks.a = { id: 'a', opcode: 'motion_movesteps', parent: null, inputs: {} };
        act(() => jest.advanceTimersByTime(1000));
        expect(onNext).not.toHaveBeenCalled();
        input.remove();
        act(() => jest.advanceTimersByTime(400));
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    test('a press on the pointed thing advances a focusClicked page', () => {
        const { vm } = makeVm();
        const onNext = jest.fn();
        document.body.innerHTML = '<button class="sound-editor_round-button_x"><img></button>';
        const button = document.querySelector('button');
        button.getBoundingClientRect = () => ({ left: 0, top: 0, right: 40, bottom: 40, width: 40, height: 40 });
        const pages = [{ focus: { kind: HINT_FOCUS.SOUND_PLAY }, advanceOn: { focusClicked: true } }, {}];
        renderHook(() =>
            useHintAutoAdvance({
                vm,
                current: makeCurrent(pages),
                hint: makeHint(pages),
                activeTab: 'sounds',
                onNext,
                onShow: jest.fn(),
            }),
        );
        act(() => jest.advanceTimersByTime(1000));
        expect(onNext).not.toHaveBeenCalled();
        act(() => {
            button.querySelector('img').dispatchEvent(new Event('pointerdown', { bubbles: true }));
        });
        act(() => jest.advanceTimersByTime(400));
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    test('a click on the block in the code area shows the tip (and the hint if it was made small)', () => {
        const { vm, blocks, sprite } = makeVm();
        blocks.m = { id: 'm', opcode: 'motion_movesteps', topLevel: true, parent: null, inputs: {}, fields: {} };
        const onShow = jest.fn();
        const tip = { click: 'codeArea', blocks: ['motion_movesteps'], message: tipMessage };
        const { result } = renderHook(() =>
            useHintAutoAdvance({
                vm,
                current: makeCurrent(steps, { autoAdvanceHints: false, wrongPlaceTip: tip }),
                hint: makeHint(steps, 0, { visible: false, minimized: true }),
                activeTab: 'code',
                onNext: jest.fn(),
                onShow,
            }),
        );
        expect(result.current).toBeNull();
        const run = (thread) => act(() => vm.runtime.getOpcodeFunction('motion_movesteps')({}, { thread }));
        // パレットで押したもの（スプライトのブロックに無い）は一言を出さない
        run({ topBlock: 'p', stackClick: true, target: sprite });
        expect(result.current).toBeNull();
        run({ topBlock: 'm', stackClick: true, target: sprite });
        expect(result.current).toBe(tipMessage);
        expect(onShow).toHaveBeenCalledTimes(1);
    });
});
