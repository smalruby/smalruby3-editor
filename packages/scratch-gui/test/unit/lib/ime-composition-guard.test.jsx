// === Smalruby: This file is Smalruby-specific (IME composition guard regression tests, #1167) ===
/* eslint-env jest */
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';

import bufferedInputHOC from '../../../src/components/forms/buffered-input-hoc.jsx';
import StudentJoinForm from '../../../src/components/classroom-modal/student-join-form.jsx';
import URLLoaderModal from '../../../src/components/url-loader-modal/url-loader-modal.jsx';
import ListMonitorContainer from '../../../src/containers/list-monitor.jsx';
import Prompt from '../../../src/containers/prompt.jsx';
import Question from '../../../src/containers/question.jsx';
import SliderPrompt from '../../../src/containers/slider-prompt.jsx';

jest.mock('../../../src/containers/modal.jsx', () => {
    const FakeModal = ({ children }) => <div data-testid="url-loader-modal">{children}</div>;
    return FakeModal;
});

// A React SyntheticKeyboardEvent does NOT expose `isComposing` (React 18's
// KeyboardEventInterface omits it), so the guards must read it from
// `nativeEvent`. These fakes mirror that shape.
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
        ListMonitor.prototype.handleKeyPress.call(
            self,
            plainEvent({ key: 'ArrowDown', preventDefault: jest.fn() }),
        );
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
