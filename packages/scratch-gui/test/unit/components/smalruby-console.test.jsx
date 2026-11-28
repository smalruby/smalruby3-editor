/* eslint-env jest */
// The console shown in place of the stage, and its button (#1758).
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EventEmitter } from 'events';
import React from 'react';
import { IntlProvider } from 'react-intl';
import { SmalrubyConsoleButton } from '../../../src/components/smalruby-console/smalruby-console-button.jsx';
import { SmalrubyConsoleSlot } from '../../../src/components/smalruby-console/smalruby-console-slot.jsx';
import { PRINT_EVENT, SmalrubyConsole } from '../../../src/components/smalruby-console/smalruby-console.jsx';
import en from '../../../src/locales/en';

const makeVm = (loaded = true) => {
    const vm = new EventEmitter();
    vm.runtime = new EventEmitter();
    vm.extensionManager = { isExtensionLoaded: (id) => loaded && id === 'smalrubyConsole' };
    return vm;
};

const renderConsole = (props) => {
    const handlers = {
        onAddLine: jest.fn(),
        onClear: jest.fn(),
        onClose: jest.fn(),
        onQuestionAnswered: jest.fn(),
        onShow: jest.fn(),
    };
    const vm = makeVm();
    const { withSlot, ...rest } = props || {};
    const view = render(
        <IntlProvider locale="en" messages={en}>
            <div data-testid="stage">
                <SmalrubyConsole
                    inColumn={Boolean(withSlot)}
                    lines={[]}
                    question={null}
                    visible
                    vm={vm}
                    {...handlers}
                    {...rest}
                />
            </div>
            {withSlot ? <SmalrubyConsoleSlot width={480} /> : null}
        </IntlProvider>,
    );
    return { ...handlers, view, vm };
};

describe('SmalrubyConsole', () => {
    test('shows the lines, the typed answers told apart', () => {
        renderConsole({
            lines: [
                { text: 'こんにちは', kind: 'output' },
                { text: '3', kind: 'input' },
            ],
        });
        const lines = screen.getAllByTestId('smalruby-console-line');
        expect(lines.map((line) => line.textContent)).toEqual(['こんにちは', '3']);
        expect(lines.map((line) => line.dataset.kind)).toEqual(['output', 'input']);
    });

    test('adds a line for each line the program prints, and clears them on the green flag', () => {
        const { onAddLine, onClear, vm } = renderConsole();
        act(() => vm.runtime.emit(PRINT_EVENT, 'a'));
        expect(onAddLine).toHaveBeenCalledWith('a', 'output');
        act(() => vm.runtime.emit('PROJECT_START'));
        expect(onClear).toHaveBeenCalled();
    });

    test('keeps the lines while hidden', () => {
        const { onAddLine, vm } = renderConsole({ visible: false });
        expect(screen.queryByTestId('smalruby-console')).toBeNull();
        act(() => vm.runtime.emit(PRINT_EVENT, 'a'));
        expect(onAddLine).toHaveBeenCalledWith('a', 'output');
    });

    test('takes the answer with Enter and shows it as a line', () => {
        const { onAddLine, onQuestionAnswered } = renderConsole({ question: '' });
        const input = screen.getByTestId('smalruby-console-input');
        expect(input).toHaveFocus();
        fireEvent.change(input, { target: { value: 'ruby' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onAddLine).toHaveBeenCalledWith('ruby', 'input');
        expect(onQuestionAnswered).toHaveBeenCalledWith('ruby');
    });

    test('shows the words of the question of 聞いて待つ', () => {
        renderConsole({ question: 'What is your name?' });
        expect(screen.getByText('What is your name?')).toBeInTheDocument();
    });

    test('has no field while the program does not wait for an answer', () => {
        renderConsole();
        expect(screen.queryByTestId('smalruby-console-input')).toBeNull();
    });

    test('covers the stage with a button back to it, outside the Japanese tab', () => {
        renderConsole();
        expect(screen.getByTestId('stage')).toContainElement(screen.getByTestId('smalruby-console'));
        expect(screen.getByTestId('smalruby-console-close')).toBeInTheDocument();
    });

    test('fills the right column of the Japanese tab, without the button back to the stage', () => {
        renderConsole({ withSlot: true });
        const slot = screen.getByTestId('smalruby-console-slot');
        expect(slot).toContainElement(screen.getByTestId('smalruby-console'));
        expect(screen.getByTestId('stage')).not.toContainElement(screen.getByTestId('smalruby-console'));
        expect(screen.queryByTestId('smalruby-console-close')).toBeNull();
    });

    test('comes out in the Japanese tab while the program waits for an answer, even if hidden', () => {
        const { onShow } = renderConsole({ withSlot: true, visible: false, question: '' });
        expect(onShow).toHaveBeenCalled();
    });

    test('stays hidden outside the Japanese tab while the program waits (the stage asks)', () => {
        const { onShow } = renderConsole({ visible: false, question: '', withSlot: true, inColumn: false });
        expect(onShow).not.toHaveBeenCalled();
    });
});

describe('SmalrubyConsoleButton', () => {
    const renderButton = (props) =>
        render(
            <IntlProvider locale="en" messages={en}>
                <SmalrubyConsoleButton isOpen={false} onToggle={jest.fn()} unread={0} vm={makeVm()} {...props} />
            </IntlProvider>,
        );

    test('is not shown without the console extension', () => {
        renderButton({ vm: makeVm(false) });
        expect(screen.queryByTestId('smalruby-console-button')).toBeNull();
    });

    test('is always shown in the Japanese tab, even without the console extension (B07)', () => {
        renderButton({ vm: makeVm(false), alwaysShown: true });
        expect(screen.getByTestId('smalruby-console-button')).toHaveAccessibleName('Show the console');
    });

    test('shows the lines printed while the console is hidden', () => {
        renderButton({ unread: 3 });
        expect(screen.getByTestId('smalruby-console-button')).toHaveAccessibleName('Show the console');
        expect(screen.getByTestId('smalruby-console-button-unread')).toHaveTextContent('3');
    });

    test('hides the console while open', () => {
        const onToggle = jest.fn();
        renderButton({ isOpen: true, unread: 3, onToggle });
        const button = screen.getByTestId('smalruby-console-button');
        expect(button).toHaveAccessibleName('Hide the console');
        expect(screen.queryByTestId('smalruby-console-button-unread')).toBeNull();
        fireEvent.click(button);
        expect(onToggle).toHaveBeenCalled();
    });
});
