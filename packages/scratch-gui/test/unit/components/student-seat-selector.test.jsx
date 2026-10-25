/* eslint-env jest */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { IntlProvider } from 'react-intl';
import StudentSeatSelector from '../../../src/components/classroom-modal/student-seat-selector.jsx';

const renderSelector = (props = {}) => {
    const handlers = {
        onSelectSeat: jest.fn(),
        onRequestKick: jest.fn(),
        onConfirmJoin: jest.fn(),
    };
    const utils = render(
        <IntlProvider locale="en">
            <StudentSeatSelector seatCount={10} takenSeats={[3]} {...handlers} {...props} />
        </IntlProvider>,
    );
    return { ...utils, ...handlers };
};

const typeSeat = (value) => {
    fireEvent.change(screen.getByTestId('classroom-seat-number-input'), { target: { value } });
    fireEvent.click(screen.getByTestId('classroom-seat-number-submit'));
};

describe('StudentSeatSelector number input (#1198)', () => {
    test('a free seat number selects the seat', () => {
        const { onSelectSeat, onRequestKick } = renderSelector();
        typeSeat('5');
        expect(onSelectSeat).toHaveBeenCalledWith(5);
        expect(onRequestKick).not.toHaveBeenCalled();
    });

    test('an occupied seat number opens the kick request', () => {
        const { onSelectSeat, onRequestKick } = renderSelector();
        typeSeat('3');
        expect(onRequestKick).toHaveBeenCalledWith(3);
        expect(onSelectSeat).not.toHaveBeenCalled();
    });

    test('the typed seat is highlighted in the grid', () => {
        renderSelector();
        typeSeat('3');
        expect(screen.getByTestId('classroom-seat-3')).toHaveAttribute('data-typed', '1');
    });

    test('an out-of-range number shows an error', () => {
        const { onSelectSeat, onRequestKick } = renderSelector();
        typeSeat('11');
        expect(screen.getByTestId('classroom-seat-number-error')).toHaveTextContent('1 to 10');
        expect(onSelectSeat).not.toHaveBeenCalled();
        expect(onRequestKick).not.toHaveBeenCalled();
    });

    test('an occupied seat while a request is pending asks to wait', () => {
        const { onRequestKick } = renderSelector({
            kickRequestPending: { requestId: 'r1', joinCode: 'ABC', seatNumber: 3 },
        });
        typeSeat('3');
        expect(onRequestKick).not.toHaveBeenCalled();
        expect(screen.getByTestId('classroom-seat-number-error')).toBeInTheDocument();
    });

    test('an occupied seat without a kick request handler does not claim a pending request', () => {
        renderSelector({ onRequestKick: undefined });
        typeSeat('3');
        expect(screen.queryByTestId('classroom-seat-number-error')).not.toBeInTheDocument();
    });

    test('the placeholder shows the seat range through i18n', () => {
        renderSelector();
        expect(screen.getByTestId('classroom-seat-number-input')).toHaveAttribute('placeholder', '1-10');
    });
});

describe('StudentSeatSelector guide and confirmation (#1198)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('the guide is shown from the start and emphasized after 30 seconds idle', () => {
        renderSelector();
        const guide = screen.getByTestId('classroom-seat-guide');
        expect(guide).toHaveAttribute('data-idle', '0');
        act(() => {
            jest.advanceTimersByTime(29000);
        });
        expect(guide).toHaveAttribute('data-idle', '0');
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(guide).toHaveAttribute('data-idle', '1');
    });

    test('no emphasis once a seat is selected', () => {
        renderSelector({ selectedSeat: 5 });
        act(() => {
            jest.advanceTimersByTime(60000);
        });
        expect(screen.getByTestId('classroom-seat-guide')).toHaveAttribute('data-idle', '0');
    });

    test('a selected seat shows the large confirmation', () => {
        renderSelector({ selectedSeat: 5 });
        expect(screen.getByTestId('classroom-seat-confirm-message')).toHaveTextContent('number 05');
    });

    test('no confirmation without a selected seat', () => {
        renderSelector();
        expect(screen.queryByTestId('classroom-seat-confirm-message')).not.toBeInTheDocument();
    });

    test('the pending banner tells the student they may keep working', () => {
        renderSelector({ kickRequestPending: { requestId: 'r1', joinCode: 'ABC', seatNumber: 3 } });
        expect(screen.getByTestId('kick-request-pending-note')).toHaveTextContent('keep using Smalruby');
    });
});

describe('StudentSeatSelector two-column layout (#1221)', () => {
    const within = (columnId, testId) => screen.getByTestId(columnId).contains(screen.getByTestId(testId));

    test('the number input, guide and grid sit in the main column', () => {
        renderSelector();
        expect(within('classroom-seat-main', 'classroom-seat-number-form')).toBe(true);
        expect(within('classroom-seat-main', 'classroom-seat-guide')).toBe(true);
        expect(within('classroom-seat-main', 'classroom-seat-grid')).toBe(true);
    });

    test('the kicked and pending banners sit in the notices column', () => {
        renderSelector({
            kickedNotice: { className: '1年1組' },
            kickRequestPending: { requestId: 'r1', joinCode: 'ABC', seatNumber: 3 },
        });
        expect(within('classroom-seat-notices', 'classroom-kicked-banner')).toBe(true);
        expect(within('classroom-seat-notices', 'kick-request-pending-banner')).toBe(true);
    });

    test('the rejected banner sits in the notices column', () => {
        renderSelector({ kickRequestRejectedNotice: { seatNumber: 3 } });
        expect(within('classroom-seat-notices', 'kick-request-rejected-banner')).toBe(true);
    });

    test('the confirmation and the join button sit in the actions column', () => {
        renderSelector({ selectedSeat: 5 });
        expect(within('classroom-seat-actions', 'classroom-seat-confirm-message')).toBe(true);
        expect(within('classroom-seat-actions', 'classroom-confirm-seat')).toBe(true);
    });

    test('the join error sits in the main column, below the grid', () => {
        renderSelector({ selectedSeat: 5, error: 'Could not connect to the server.' });
        expect(within('classroom-seat-main', 'classroom-error')).toBe(true);
        expect(within('classroom-seat-actions', 'classroom-error')).toBe(false);
    });
});
