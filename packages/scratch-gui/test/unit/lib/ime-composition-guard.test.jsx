// === Smalruby: This file is Smalruby-specific (IME composition guard regression tests, #1167) ===
/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentJoinForm from '../../../src/components/classroom-modal/student-join-form.jsx';
import bufferedInputHOC from '../../../src/components/forms/buffered-input-hoc.jsx';
import URLLoaderModal from '../../../src/components/url-loader-modal/url-loader-modal.jsx';
import ListMonitorContainer from '../../../src/containers/list-monitor.jsx';
import Prompt from '../../../src/containers/prompt.jsx';
import Question from '../../../src/containers/question.jsx';
import SliderPrompt from '../../../src/containers/slider-prompt.jsx';

// A React SyntheticKeyboardEvent does NOT expose `isComposing` (React 18's
// KeyboardEventInterface omits it), so the guards must read it from
// `nativeEvent`. These fakes mirror that shape.
//
// Scope caveat, measured rather than assumed (see the render-based tests at the
// bottom for the parts that are exercised through real DOM events):
//
//   * `list-monitor` / `student-join-form` / `teacher-*` / `target-selector`
//     are bound to `keydown`, where React does forward `keyCode` — both halves
//     of the guard are live there.
//   * `question` / `prompt` / `slider-prompt` / `buffered-input-hoc` /
//     `url-loader-modal` are bound to `keypress`. Chromium dispatches no
//     `keypress` at all while an IME composition is in flight (the commit key
//     only produces `keydown` with keyCode 229 / isComposing true), and React
//     normalises `keyCode` to 0 on `keypress`. So on Chrome those guards are
//     unreachable; they are insurance for engines that *do* deliver a composing
//     `keypress`. The direct prototype calls below therefore pin the handler
//     contract, not observed Chrome behaviour.
const composingEvent = (over = {}) => ({
    key: 'Enter',
    keyCode: 229,
    nativeEvent: { isComposing: true },
    target: { blur: jest.fn() },
    ...over,
});

const plainEvent = (over = {}) => ({
    key: 'Enter',
    keyCode: 13,
    nativeEvent: { isComposing: false },
    target: { blur: jest.fn() },
    ...over,
});

describe('IME composition guard — upstream containers (#1167)', () => {
    test('Question: Enter while composing does not submit the answer', () => {
        const handleSubmit = jest.fn();
        const self = { handleSubmit };

        Question.prototype.handleKeyPress.call(self, composingEvent());
        expect(handleSubmit).not.toHaveBeenCalled();

        Question.prototype.handleKeyPress.call(self, plainEvent());
        expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    test('Prompt: Enter while composing does not confirm the dialog', () => {
        const handleOk = jest.fn();
        const self = { handleOk };

        Prompt.prototype.handleKeyPress.call(self, composingEvent());
        expect(handleOk).not.toHaveBeenCalled();

        Prompt.prototype.handleKeyPress.call(self, plainEvent());
        expect(handleOk).toHaveBeenCalledTimes(1);
    });

    test('SliderPrompt: Enter while composing does not confirm the dialog', () => {
        const handleOk = jest.fn();
        const self = { handleOk };

        SliderPrompt.prototype.handleKeyPress.call(self, composingEvent());
        expect(handleOk).not.toHaveBeenCalled();

        SliderPrompt.prototype.handleKeyPress.call(self, plainEvent());
        expect(handleOk).toHaveBeenCalledTimes(1);
    });

    test('bufferedInputHOC: Enter while composing neither flushes nor blurs', () => {
        const BufferedInput = bufferedInputHOC('input');
        const handleFlush = jest.fn();
        const self = { handleFlush };

        const composing = composingEvent();
        BufferedInput.prototype.handleKeyPress.call(self, composing);
        expect(handleFlush).not.toHaveBeenCalled();
        expect(composing.target.blur).not.toHaveBeenCalled();

        const plain = plainEvent();
        BufferedInput.prototype.handleKeyPress.call(self, plain);
        expect(handleFlush).toHaveBeenCalledTimes(1);
        expect(plain.target.blur).toHaveBeenCalledTimes(1);
    });

    test('ListMonitor: Enter while composing does not insert a new list item', () => {
        const ListMonitor = ListMonitorContainer.WrappedComponent;
        const handleDeactivate = jest.fn();
        const setState = jest.fn();
        const self = {
            handleDeactivate,
            setState,
            state: { activeIndex: 0 },
            props: { vm: null, targetId: 't1', id: 'v1', value: ['a', 'b'] },
            wrapListIndex: (index, length) => (index + length) % length,
        };

        ListMonitor.prototype.handleKeyPress.call(self, composingEvent());
        expect(handleDeactivate).not.toHaveBeenCalled();
        expect(setState).not.toHaveBeenCalled();

        // Navigation keys still work when the IME is idle.
        ListMonitor.prototype.handleKeyPress.call(self, plainEvent({ key: 'ArrowDown', preventDefault: jest.fn() }));
        expect(handleDeactivate).toHaveBeenCalledTimes(1);
        expect(setState).toHaveBeenCalledWith({ activeIndex: 1, activeValue: 'b' });
    });
});

describe('IME composition guard — Smalruby components (#1167)', () => {
    test('URLLoaderModal: Enter while composing does not open the project', () => {
        const Modal = URLLoaderModal.WrappedComponent;
        const handleOpenClick = jest.fn();
        const self = { handleOpenClick };

        Modal.prototype.handleKeyPress.call(self, composingEvent());
        expect(handleOpenClick).not.toHaveBeenCalled();

        Modal.prototype.handleKeyPress.call(self, plainEvent());
        expect(handleOpenClick).toHaveBeenCalledTimes(1);
    });

    // Rendered end-to-end (real DOM KeyboardEvent) so we also prove that
    // `nativeEvent.isComposing` survives React's synthetic event layer.
    test('StudentJoinForm: a real composing keydown does not submit the join code', () => {
        const onJoin = jest.fn();
        render(
            <IntlProvider locale="en">
                <StudentJoinForm onJoin={onJoin} />
            </IntlProvider>,
        );

        const input = document.querySelector('[data-testid="classroom-join-code-input"]');
        fireEvent.change(input, { target: { value: 'abc234' } });

        fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: true });
        expect(onJoin).not.toHaveBeenCalled();

        fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
        expect(onJoin).toHaveBeenCalledWith('abc234');
    });
});

describe('IME composition guard — real React event plumbing (#1167)', () => {
    // The `keypress`-bound guards can only ever fire on `nativeEvent.isComposing`
    // (React reports keyCode 0 for keypress), so pin exactly that path through a
    // rendered component instead of a hand-built event object.
    test('bufferedInputHOC: a composing keypress does not submit, a plain one does', () => {
        const BufferedInput = bufferedInputHOC('input');
        const onSubmit = jest.fn();
        const { container } = render(<BufferedInput onSubmit={onSubmit} value="hi" />);
        const input = container.querySelector('input');

        // A buffered input only submits a value the user actually edited.
        fireEvent.change(input, { target: { value: 'こんにちは' } });

        fireEvent.keyPress(input, { key: 'Enter', charCode: 13, isComposing: true });
        expect(onSubmit).not.toHaveBeenCalled();

        fireEvent.keyPress(input, { key: 'Enter', charCode: 13 });
        expect(onSubmit).toHaveBeenCalledWith('こんにちは');
    });

    test('React reports keyCode 0 on keypress, so only nativeEvent.isComposing can guard it', () => {
        const seen = [];
        const Probe = () => (
            <input
                onKeyDown={(e) =>
                    seen.push({
                        type: 'keydown',
                        keyCode: e.keyCode,
                        synthetic: e.isComposing,
                        native: e.nativeEvent.isComposing,
                    })
                }
                onKeyPress={(e) =>
                    seen.push({
                        type: 'keypress',
                        keyCode: e.keyCode,
                        synthetic: e.isComposing,
                        native: e.nativeEvent.isComposing,
                    })
                }
            />
        );
        const { container } = render(<Probe />);
        const input = container.querySelector('input');

        fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, isComposing: true });
        fireEvent.keyPress(input, { key: 'Enter', charCode: 13, isComposing: true });

        // `synthetic` is undefined in both: React's KeyboardEventInterface has no
        // isComposing, which is why every guard reads `nativeEvent`.
        expect(seen).toEqual([
            { type: 'keydown', keyCode: 229, synthetic: undefined, native: true },
            { type: 'keypress', keyCode: 0, synthetic: undefined, native: true },
        ]);
    });
});
