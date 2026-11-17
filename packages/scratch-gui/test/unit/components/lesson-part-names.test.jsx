/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonPartNames from '../../../src/components/lesson-part-names/lesson-part-names.jsx';
import { PART_NAMES_DURATION_MS } from '../../../src/lib/lessons/part-names';
import ja from '../../../src/locales/ja';

// jsdom は layout をしないので getBoundingClientRect / offsetWidth を差し替える
const addPart = (testId, r) => {
    const el = document.createElement('button');
    el.setAttribute('data-testid', testId);
    el.getBoundingClientRect = () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top });
    document.body.appendChild(el);
    return el;
};

const renderNames = (props = {}) =>
    render(
        <IntlProvider locale="ja" messages={ja}>
            <LessonPartNames onClose={jest.fn()} {...props} />
        </IntlProvider>,
    );

describe('LessonPartNames', () => {
    let widthSpy;
    let heightSpy;
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.useFakeTimers();
        widthSpy = jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
        heightSpy = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(22);
    });
    afterEach(() => {
        jest.useRealTimers();
        widthSpy.mockRestore();
        heightSpy.mockRestore();
    });

    test('places the labels of the parts on the screen and leaves the others out (in Japanese)', () => {
        addPart('lesson-task-bar', { left: 0, top: 48, right: 1300, bottom: 88 });
        addPart('lesson-task-bar-hint', { left: 1040, top: 56, right: 1092, bottom: 80 });
        const { getByTestId, queryByTestId } = renderNames();
        expect(getByTestId('lesson-part-names-label-taskBar')).toHaveTextContent('課題バー');
        expect(getByTestId('lesson-part-names-label-taskBar')).toHaveAttribute('data-placed', 'true');
        expect(getByTestId('lesson-part-names-label-hint')).toHaveTextContent('ヒント');
        expect(getByTestId('lesson-part-names-label-hint')).toHaveAttribute('data-placed', 'true');
        expect(getByTestId('lesson-part-names-frame-hint')).toBeInTheDocument();
        expect(getByTestId('lesson-part-names-label-soundsTab')).toHaveAttribute('data-placed', 'false');
        expect(queryByTestId('lesson-part-names-frame-soundsTab')).not.toBeInTheDocument();
    });

    // 名前は Scratch Wiki に合わせる。タブの札にはルビータブもある（#2142）
    test('uses the Scratch Wiki names and has a label for the Ruby tab', () => {
        addPart('mobile-side-rail-ruby', { left: 290, top: 88, right: 372, bottom: 120 });
        addPart('mobile-side-rail-play', { left: 830, top: 92, right: 862, bottom: 124 });
        const { getByTestId } = renderNames();
        expect(getByTestId('lesson-part-names-label-rubyTab')).toHaveTextContent('ルビータブ');
        expect(getByTestId('lesson-part-names-label-rubyTab')).toHaveAttribute('data-placed', 'true');
        expect(getByTestId('lesson-part-names-label-greenFlag')).toHaveTextContent('緑の旗');
        expect(getByTestId('lesson-part-names-label-stop')).toHaveTextContent('停止ボタン');
        expect(getByTestId('lesson-part-names-label-palette')).toHaveTextContent('ブロックパレット');
        expect(getByTestId('lesson-part-names-label-codeArea')).toHaveTextContent('スクリプトエリア');
        expect(getByTestId('lesson-part-names-label-spriteList')).toHaveTextContent('スプライトペイン');
    });

    test('when shown by the button, closes after a few seconds', () => {
        const onClose = jest.fn();
        renderNames({ onClose, timed: true });
        act(() => {
            jest.advanceTimersByTime(PART_NAMES_DURATION_MS - 1);
        });
        expect(onClose).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('when shown by the button, closes on a press anywhere but the "Names" button, and on Esc', () => {
        const onClose = jest.fn();
        const toggle = addPart('lesson-task-bar-part-names', { left: 980, top: 56, right: 1030, bottom: 80 });
        renderNames({ onClose, timed: true });
        fireEvent.pointerDown(toggle);
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.pointerDown(document.body);
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    test('when the lesson shows them from the start, they stay (presses go through to the editor)', () => {
        const onClose = jest.fn();
        renderNames({ onClose, timed: false });
        act(() => {
            jest.advanceTimersByTime(PART_NAMES_DURATION_MS * 3);
        });
        fireEvent.pointerDown(document.body);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });
});
