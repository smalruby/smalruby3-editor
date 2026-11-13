/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import LessonProgressConfirm, {
    CONFIRM_STEPS,
} from '../../../src/components/lesson-progress-confirm/lesson-progress-confirm.jsx';

jest.mock('../../../src/containers/modal.jsx', () => {
    const FakeModal = ({ children }) => <div data-testid="fake-modal">{children}</div>;
    return FakeModal;
});

const items = [
    { id: 'a', name: { id: 'name.a', defaultMessage: 'Challenge A' }, completedAt: '2026-11-01T01:00:00.000Z' },
];
const handlers = {
    onBack: jest.fn(),
    onClear: jest.fn(),
    onClose: jest.fn(),
    onMine: jest.fn(),
    onNotMine: jest.fn(),
};

const ui = (step) => (
    <IntlProvider locale="en">
        <LessonProgressConfirm items={items} step={step} {...handlers} />
    </IntlProvider>
);

describe('LessonProgressConfirm', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should focus the first button when opened and when the step changes', () => {
        const { rerender } = render(ui(CONFIRM_STEPS.ASK));
        act(() => {
            jest.runOnlyPendingTimers();
        });
        expect(screen.getByTestId('lesson-progress-confirm-not-mine')).toHaveFocus();

        rerender(ui(CONFIRM_STEPS.CONFIRM_CLEAR));
        act(() => {
            jest.runOnlyPendingTimers();
        });
        expect(screen.getByTestId('lesson-progress-confirm-back')).toHaveFocus();

        rerender(ui(CONFIRM_STEPS.ASK));
        act(() => {
            jest.runOnlyPendingTimers();
        });
        expect(screen.getByTestId('lesson-progress-confirm-not-mine')).toHaveFocus();
    });

    test('should list the records with their names', () => {
        render(ui(CONFIRM_STEPS.ASK));
        expect(screen.getByTestId('lesson-progress-confirm-list')).toHaveTextContent('Challenge A');
    });
});
