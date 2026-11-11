/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonHint from '../../../src/components/lesson-hint/lesson-hint.jsx';
import { HINT_TARGETS } from '../../../src/lib/lessons/hint-targets';
import en from '../../../src/locales/en';
import ja from '../../../src/locales/ja';

const title = { id: 'gui.lessons.challenge.blocks-l1-click-say.step2', defaultMessage: 'ドラッグしよう' };
const debug = [
    { id: 'gui.lessons.challenge.blocks-l1-click-say.debug1', defaultMessage: 'd1' },
    { id: 'gui.lessons.challenge.blocks-l1-click-say.debug2', defaultMessage: 'd2' },
];

const makeScratchBlocks = () => {
    const main = { id: 'main' };
    const workspace = {
        scale: 0.8,
        cleanUp: jest.fn(),
        getTopBlocks: () => [],
        getBlocksBoundingBox: () => ({ left: 0, top: 0, right: 100, bottom: 50 }),
        translate: jest.fn(),
        dispose: jest.fn(),
    };
    return {
        workspace,
        main,
        getMainWorkspace: () => main,
        inject: jest.fn(() => workspace),
        common: { setMainWorkspace: jest.fn() },
        Events: { disable: jest.fn(), enable: jest.fn() },
        utils: { xml: { textToDom: jest.fn((xml) => `dom:${xml}`) } },
        Xml: { domToWorkspace: jest.fn() },
        svgResize: jest.fn(),
        Theme: function Theme() {},
    };
};

const renderHint = (props = {}, { locale = 'en', messages = en } = {}) => {
    const handlers = { onClose: jest.fn(), onInsertCode: jest.fn(), onNext: jest.fn(), onPrev: jest.fn() };
    const utils = render(
        <IntlProvider locale={locale} messages={messages}>
            <LessonHint count={7} index={1} target={HINT_TARGETS.PALETTE} title={title} {...handlers} {...props} />
        </IntlProvider>,
    );
    return { ...utils, ...handlers };
};

// jsdom は layout をしないので、指す場所の矩形を要素ごとに差し替える
const addTarget = (className, rect) => {
    const el = document.createElement('div');
    el.className = className;
    el.getBoundingClientRect = () => ({ ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top });
    document.body.appendChild(el);
    return el;
};

describe('LessonHint', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        // portal の後始末を先にしてから、テストが足した指す場所の要素を消す
        cleanup();
        jest.useRealTimers();
        document.body.innerHTML = '';
    });

    test('shows the title, the position and the buttons (in the body via a portal)', () => {
        const { getByTestId } = renderHint();
        const balloon = getByTestId('lesson-hint');
        expect(balloon.parentElement).toBe(document.body);
        expect(getByTestId('lesson-hint-title')).toHaveTextContent(
            'Go back to the "Code" tab and drag the "when this sprite clicked" block into the code area.',
        );
        expect(getByTestId('lesson-hint-position')).toHaveTextContent('Hint 2 of 7');
        expect(getByTestId('lesson-hint-prev')).not.toBeDisabled();
        expect(getByTestId('lesson-hint-next')).not.toBeDisabled();
        expect(balloon.getAttribute('data-target')).toBe('palette');
    });

    test('shows Japanese text', () => {
        const { getByTestId } = renderHint({}, { locale: 'ja', messages: ja });
        expect(getByTestId('lesson-hint-position')).toHaveTextContent('ヒント 2 / 7');
        expect(getByTestId('lesson-hint-next')).toHaveTextContent('進める');
        expect(getByTestId('lesson-hint-prev')).toHaveTextContent('もどる');
    });

    test('back is disabled on the first hint and next on the last', () => {
        const first = renderHint({ index: 0 });
        expect(first.getByTestId('lesson-hint-prev')).toBeDisabled();
        expect(first.getByTestId('lesson-hint-next')).not.toBeDisabled();
        first.unmount();
        const last = renderHint({ index: 6 });
        // 最後のページは「進める」の代わりに「おわり」（押すと閉じる）
        expect(last.queryByTestId('lesson-hint-next')).not.toBeInTheDocument();
        expect(last.getByTestId('lesson-hint-finish')).not.toBeDisabled();
        expect(last.getByTestId('lesson-hint-finish')).toHaveTextContent('Finish');
        fireEvent.click(last.getByTestId('lesson-hint-finish'));
        expect(last.onClose).toHaveBeenCalledTimes(1);
        expect(last.onNext).not.toHaveBeenCalled();
    });

    test('the finish button says おわり in Japanese', () => {
        const { getByTestId } = renderHint({ index: 6 }, { locale: 'ja', messages: ja });
        expect(getByTestId('lesson-hint-finish')).toHaveTextContent('おわり');
    });

    test('the buttons call their handlers', () => {
        const { getByTestId, onClose, onNext, onPrev } = renderHint();
        fireEvent.click(getByTestId('lesson-hint-next'));
        fireEvent.click(getByTestId('lesson-hint-prev'));
        fireEvent.click(getByTestId('lesson-hint-close'));
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onPrev).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('the last-resort page shows the debug tips and the insert button', () => {
        const { getByTestId, queryByTestId, onInsertCode } = renderHint({
            index: 6,
            lastResort: true,
            debug,
            hasCode: true,
            title: null,
            target: null,
        });
        expect(getByTestId('lesson-hint-debug-title')).toHaveTextContent('If it does not work');
        expect(getByTestId('lesson-hint-debug').querySelectorAll('li')).toHaveLength(2);
        expect(queryByTestId('lesson-hint-title')).not.toBeInTheDocument();
        expect(getByTestId('lesson-hint-insert-code')).toHaveTextContent('See the correct program');
        // 場所が無いので画面の真ん中
        expect(getByTestId('lesson-hint').getAttribute('data-side')).toBe('center');
        // 押すとすぐには入れず、確認を出す
        fireEvent.click(getByTestId('lesson-hint-insert-code'));
        expect(onInsertCode).not.toHaveBeenCalled();
        expect(getByTestId('lesson-hint-insert-code-confirm')).toHaveTextContent(
            'Replace your program with the correct program? The program you made will be deleted.',
        );
    });

    test('"No" on the confirmation does nothing and brings the button back', () => {
        const { getByTestId, queryByTestId, onInsertCode, onClose } = renderHint({
            index: 6,
            lastResort: true,
            debug,
            hasCode: true,
            title: null,
            target: null,
        });
        fireEvent.click(getByTestId('lesson-hint-insert-code'));
        fireEvent.click(getByTestId('lesson-hint-insert-code-no'));
        expect(onInsertCode).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        expect(queryByTestId('lesson-hint-insert-code-confirm')).not.toBeInTheDocument();
        expect(getByTestId('lesson-hint-insert-code')).toBeInTheDocument();
    });

    test('"Yes" on the confirmation inserts the program', () => {
        const { getByTestId, queryByTestId, onInsertCode } = renderHint({
            index: 6,
            lastResort: true,
            debug,
            hasCode: true,
            title: null,
            target: null,
        });
        fireEvent.click(getByTestId('lesson-hint-insert-code'));
        fireEvent.click(getByTestId('lesson-hint-insert-code-yes'));
        expect(onInsertCode).toHaveBeenCalledTimes(1);
        expect(queryByTestId('lesson-hint-insert-code-confirm')).not.toBeInTheDocument();
    });

    test('the confirmation is in Japanese', () => {
        const { getByTestId } = renderHint(
            { index: 6, lastResort: true, debug, hasCode: true, title: null, target: null },
            { locale: 'ja', messages: ja },
        );
        expect(getByTestId('lesson-hint-insert-code')).toHaveTextContent('正解のプログラムを確認する');
        fireEvent.click(getByTestId('lesson-hint-insert-code'));
        expect(getByTestId('lesson-hint-insert-code-confirm')).toHaveTextContent(
            '正解のプログラムで置き換えますか？あなたが作成したプログラムは消えます。',
        );
        expect(getByTestId('lesson-hint-insert-code-yes')).toHaveTextContent('はい');
        expect(getByTestId('lesson-hint-insert-code-no')).toHaveTextContent('いいえ');
    });

    test('the insert errors still show under the button after "Yes"', () => {
        const { getByTestId } = renderHint({
            index: 6,
            lastResort: true,
            debug,
            hasCode: true,
            title: null,
            target: null,
            insertErrors: ['音「Owl」は存在しません。'],
        });
        expect(getByTestId('lesson-hint-insert-code-error')).toHaveTextContent('音「Owl」は存在しません。');
    });

    test('without code there is no insert button', () => {
        const { queryByTestId } = renderHint({ index: 6, lastResort: true, debug, hasCode: false, title: null });
        expect(queryByTestId('lesson-hint-insert-code')).not.toBeInTheDocument();
    });

    test('a spotlight hint darkens around the target, but not when the target is not on screen', () => {
        const blocks = addTarget('blocks_blocks_x', { left: 0, top: 0, right: 800, bottom: 600 });
        const flyout = document.createElement('div');
        flyout.className = 'blocklyFlyout';
        flyout.getBoundingClientRect = () => ({
            left: 0,
            top: 100,
            right: 300,
            bottom: 600,
            width: 300,
            height: 500,
        });
        blocks.appendChild(flyout);

        const lit = renderHint({ spotlight: true });
        const hole = lit.getByTestId('lesson-hint-spotlight');
        expect(hole.style.left).toBe('-4px');
        expect(hole.style.width).toBe('308px');
        expect(lit.getByTestId('lesson-hint').getAttribute('data-side')).toBe('right');
        lit.unmount();

        const notLit = renderHint({ spotlight: false });
        expect(notLit.queryByTestId('lesson-hint-spotlight')).not.toBeInTheDocument();
        notLit.unmount();

        const noPlace = renderHint({ spotlight: true, target: HINT_TARGETS.KEYBOARD });
        expect(noPlace.queryByTestId('lesson-hint-spotlight')).not.toBeInTheDocument();
        expect(noPlace.getByTestId('lesson-hint').getAttribute('data-side')).toBe('center');
    });

    test('re-measures when the target appears later (tab switch)', () => {
        const { getByTestId } = renderHint({ spotlight: true });
        expect(getByTestId('lesson-hint').getAttribute('data-side')).toBe('center');
        addTarget('blocks_blocks_x', { left: 0, top: 0, right: 800, bottom: 600 }).appendChild(
            (() => {
                const el = document.createElement('div');
                el.className = 'blocklyToolbox';
                el.getBoundingClientRect = () => ({
                    left: 0,
                    top: 100,
                    right: 60,
                    bottom: 600,
                    width: 60,
                    height: 500,
                });
                return el;
            })(),
        );
        act(() => {
            jest.advanceTimersByTime(400);
        });
        expect(getByTestId('lesson-hint').getAttribute('data-side')).toBe('right');
        expect(getByTestId('lesson-hint-spotlight')).toBeInTheDocument();
    });

    test('draws the blocks in a read-only workspace and gives the editor workspace back', () => {
        const scratchBlocks = makeScratchBlocks();
        const { getByTestId, unmount } = renderHint({
            scratchBlocks,
            blocksXml: '<xml><block type="looks_nextcostume"></block></xml>',
            mediaPath: './static/blocks-media/default/',
        });
        const div = getByTestId('lesson-hint-blocks');
        expect(scratchBlocks.inject).toHaveBeenCalledTimes(1);
        expect(scratchBlocks.inject.mock.calls[0][0]).toBe(div);
        expect(scratchBlocks.inject.mock.calls[0][1]).toEqual(
            expect.objectContaining({ readOnly: true, media: './static/blocks-media/default/' }),
        );
        expect(scratchBlocks.common.setMainWorkspace).toHaveBeenCalledWith(scratchBlocks.main);
        expect(scratchBlocks.Xml.domToWorkspace).toHaveBeenCalledWith(
            'dom:<xml><block type="looks_nextcostume"></block></xml>',
            scratchBlocks.workspace,
        );
        expect(scratchBlocks.Events.enable).toHaveBeenCalled();
        // 中身の大きさ（100×50 を 0.8 倍 + 余白 8px）に合わせて広げる
        expect(div.style.width).toBe('96px');
        expect(div.style.height).toBe('56px');
        expect(scratchBlocks.workspace.translate).toHaveBeenCalledWith(8, 8);
        unmount();
        expect(scratchBlocks.workspace.dispose).toHaveBeenCalledTimes(1);
    });

    test('disposes the read-only workspace when drawing fails, and still shows the text', () => {
        const scratchBlocks = makeScratchBlocks();
        scratchBlocks.Xml.domToWorkspace = jest.fn(() => {
            throw new Error('bad xml');
        });
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { getByTestId, unmount } = renderHint({
            scratchBlocks,
            blocksXml: '<xml><block type="nope"></block></xml>',
            mediaPath: './static/blocks-media/default/',
        });
        expect(getByTestId('lesson-hint-title')).toBeInTheDocument();
        expect(scratchBlocks.Events.enable).toHaveBeenCalledTimes(1);
        expect(scratchBlocks.common.setMainWorkspace).toHaveBeenCalledWith(scratchBlocks.main);
        expect(scratchBlocks.workspace.dispose).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalled();
        unmount();
        // 捨てたワークスペースをもう一度 dispose しない
        expect(scratchBlocks.workspace.dispose).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    describe('dragging', () => {
        // jsdom には PointerEvent が無い（fireEvent が clientX を持たない Event になる）ので、MouseEvent から作る
        beforeAll(() => {
            if (typeof window.PointerEvent === 'undefined') {
                class PointerEvent extends window.MouseEvent {
                    constructor(type, init = {}) {
                        super(type, init);
                        this.pointerId = init.pointerId;
                        this.pointerType = init.pointerType || 'mouse';
                    }
                }
                window.PointerEvent = PointerEvent;
            }
        });

        // jsdom は layout をしないので、吹き出しの大きさと画面の大きさを決めておく
        const setup = (props = {}) => {
            window.innerWidth = 1000;
            window.innerHeight = 600;
            const utils = renderHint({ target: HINT_TARGETS.KEYBOARD, ...props });
            const balloon = utils.getByTestId('lesson-hint');
            balloon.getBoundingClientRect = () => {
                const left = parseFloat(balloon.style.left) || 0;
                const top = parseFloat(balloon.style.top) || 0;
                return { left, top, right: left + 300, bottom: top + 200, width: 300, height: 200 };
            };
            act(() => {
                jest.advanceTimersByTime(400);
            });
            return { ...utils, balloon, handle: utils.getByTestId('lesson-hint-drag-handle') };
        };
        const drag = (handle, from, to, pointerType = 'mouse') => {
            fireEvent.pointerDown(handle, { clientX: from.x, clientY: from.y, button: 0, pointerType, pointerId: 1 });
            fireEvent.pointerMove(window, { clientX: to.x, clientY: to.y, buttons: 1, pointerType, pointerId: 1 });
            fireEvent.pointerUp(window, { clientX: to.x, clientY: to.y, pointerType, pointerId: 1 });
        };

        test('moves the balloon by the drag (mouse) and hides the tail', () => {
            const { balloon, handle } = setup();
            // 場所が無いので真ん中: (1000-300)/2, (600-200)/2
            expect(balloon.style.left).toBe('350px');
            expect(balloon.style.top).toBe('200px');
            drag(handle, { x: 400, y: 210 }, { x: 300, y: 110 });
            expect(balloon.style.left).toBe('250px');
            expect(balloon.style.top).toBe('100px');
            expect(balloon.getAttribute('data-dragged')).toBe('true');
        });

        test('a balloon that pointed at a place loses its tail once dragged, but the spotlight stays', () => {
            const blocks = addTarget('blocks_blocks_x', { left: 0, top: 0, right: 800, bottom: 600 });
            const flyout = document.createElement('div');
            flyout.className = 'blocklyFlyout';
            flyout.getBoundingClientRect = () => ({
                left: 0,
                top: 100,
                right: 300,
                bottom: 600,
                width: 300,
                height: 500,
            });
            blocks.appendChild(flyout);
            const { balloon, handle, getByTestId } = setup({ target: HINT_TARGETS.PALETTE, spotlight: true });
            expect(balloon.querySelector('[data-balloon-arrow]')).not.toBeNull();
            drag(handle, { x: 400, y: 210 }, { x: 450, y: 260 });
            expect(balloon.querySelector('[data-balloon-arrow]')).toBeNull();
            expect(getByTestId('lesson-hint-spotlight')).toBeInTheDocument();
        });

        test('moves the balloon by touch too', () => {
            const { balloon, handle } = setup();
            drag(handle, { x: 400, y: 210 }, { x: 420, y: 260 }, 'touch');
            expect(balloon.style.left).toBe('370px');
            expect(balloon.style.top).toBe('250px');
        });

        test('cannot be dragged off the screen', () => {
            const { balloon, handle } = setup();
            drag(handle, { x: 400, y: 210 }, { x: -500, y: -500 });
            expect(balloon.style.left).toBe('8px');
            expect(balloon.style.top).toBe('8px');
            drag(handle, { x: 10, y: 10 }, { x: 5000, y: 5000 });
            expect(balloon.style.left).toBe('692px');
            expect(balloon.style.top).toBe('392px');
        });

        test('keeps the dragged position on the next page', () => {
            const { balloon, handle, rerender } = setup();
            drag(handle, { x: 400, y: 210 }, { x: 300, y: 110 });
            rerender(
                <IntlProvider locale="en" messages={en}>
                    <LessonHint
                        count={7}
                        index={2}
                        target={HINT_TARGETS.KEYBOARD}
                        title={title}
                        onClose={jest.fn()}
                        onInsertCode={jest.fn()}
                        onNext={jest.fn()}
                        onPrev={jest.fn()}
                    />
                </IntlProvider>,
            );
            act(() => {
                jest.advanceTimersByTime(400);
            });
            expect(balloon.style.left).toBe('250px');
            expect(balloon.style.top).toBe('100px');
        });

        test('a press with a few pixels of jitter does not move the balloon (the tail stays)', () => {
            const { balloon, handle } = setup();
            drag(handle, { x: 400, y: 210 }, { x: 402, y: 211 });
            expect(balloon.style.left).toBe('350px');
            expect(balloon.getAttribute('data-dragged')).toBe('false');
        });

        test('a mouse released where no pointerup came (outside the window) ends the drag', () => {
            const { balloon, handle } = setup();
            fireEvent.pointerDown(handle, {
                clientX: 400,
                clientY: 210,
                button: 0,
                pointerType: 'mouse',
                pointerId: 1,
            });
            fireEvent.pointerMove(window, {
                clientX: 300,
                clientY: 110,
                buttons: 1,
                pointerType: 'mouse',
                pointerId: 1,
            });
            expect(balloon.style.left).toBe('250px');
            // ボタンを押していない move（pointerup を取りこぼした）では動かさず、ドラッグを終える
            fireEvent.pointerMove(window, {
                clientX: 200,
                clientY: 50,
                buttons: 0,
                pointerType: 'mouse',
                pointerId: 1,
            });
            fireEvent.pointerMove(window, {
                clientX: 100,
                clientY: 50,
                buttons: 1,
                pointerType: 'mouse',
                pointerId: 1,
            });
            expect(balloon.style.left).toBe('250px');
            expect(balloon.style.top).toBe('100px');
        });

        test('pressing the close button in the header does not start a drag', () => {
            const { balloon, getByTestId, onClose } = setup();
            const close = getByTestId('lesson-hint-close');
            fireEvent.pointerDown(close, { clientX: 600, clientY: 210, button: 0, pointerId: 1 });
            fireEvent.pointerMove(window, { clientX: 100, clientY: 100, pointerId: 1 });
            fireEvent.pointerUp(window, { clientX: 100, clientY: 100, pointerId: 1 });
            fireEvent.click(close);
            expect(balloon.style.left).toBe('350px');
            expect(balloon.getAttribute('data-dragged')).toBe('false');
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    test('shows a note when the blocks could not be converted', () => {
        const { getByTestId, queryByTestId } = renderHint({ blocksError: true });
        expect(getByTestId('lesson-hint-blocks-error')).toBeInTheDocument();
        expect(queryByTestId('lesson-hint-blocks')).not.toBeInTheDocument();
    });
});
