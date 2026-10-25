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
