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

const openNumberForm = () => fireEvent.click(screen.getByTestId('classroom-seat-number-toggle'));

const typeSeat = (value) => {
    openNumberForm();
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
        openNumberForm();
        expect(screen.getByTestId('classroom-seat-number-input')).toHaveAttribute('placeholder', '1-10');
    });
});

describe('StudentSeatSelector one way to pick a seat (#1305 S1)', () => {
    test('the number input is closed until the student cannot find the number', () => {
        renderSelector();
        expect(screen.queryByTestId('classroom-seat-number-form')).not.toBeInTheDocument();
        expect(screen.getByTestId('classroom-seat-grid')).toBeInTheDocument();
        openNumberForm();
        expect(screen.getByTestId('classroom-seat-number-form')).toBeInTheDocument();
        expect(screen.queryByTestId('classroom-seat-number-toggle')).not.toBeInTheDocument();
    });

    test('no join button before a seat is picked', () => {
        renderSelector();
        expect(screen.queryByTestId('classroom-confirm-seat')).not.toBeInTheDocument();
    });

    test('tapping a free seat goes straight to the confirmation', () => {
        const { onSelectSeat } = renderSelector();
        fireEvent.click(screen.getByTestId('classroom-seat-5'));
        expect(onSelectSeat).toHaveBeenCalledWith(5);
    });

    test('the confirmation replaces the grid and puts Join right under the number', () => {
        renderSelector({ selectedSeat: 5 });
        expect(screen.queryByTestId('classroom-seat-grid')).not.toBeInTheDocument();
        expect(screen.queryByTestId('classroom-seat-number-toggle')).not.toBeInTheDocument();
        const confirm = screen.getByTestId('classroom-seat-confirm');
        expect(confirm).toContainElement(screen.getByTestId('classroom-seat-confirm-message'));
        expect(confirm).toContainElement(screen.getByTestId('classroom-confirm-seat'));
        expect(confirm).toContainElement(screen.getByTestId('classroom-seat-reselect'));
    });

    test('Join confirms the picked seat', () => {
        const { onConfirmJoin } = renderSelector({ selectedSeat: 5 });
        fireEvent.click(screen.getByTestId('classroom-confirm-seat'));
        expect(onConfirmJoin).toHaveBeenCalled();
    });

    test('Choose again goes back to the seat buttons', () => {
        const { onSelectSeat } = renderSelector({ selectedSeat: 5 });
        fireEvent.click(screen.getByTestId('classroom-seat-reselect'));
        expect(onSelectSeat).toHaveBeenCalledWith(null);
    });

    test('Join and Choose again are disabled while joining', () => {
        renderSelector({ selectedSeat: 5, isLoading: true });
        expect(screen.getByTestId('classroom-confirm-seat')).toBeDisabled();
        expect(screen.getByTestId('classroom-seat-reselect')).toBeDisabled();
    });
});

describe('StudentSeatSelector guide and confirmation (#1198)', () => {
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

    test('the number input and grid sit in the main column', () => {
        renderSelector();
        openNumberForm();
        expect(within('classroom-seat-main', 'classroom-seat-number-form')).toBe(true);
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

    test('the confirmation and the join button sit in the main column (#1305)', () => {
        renderSelector({ selectedSeat: 5 });
        expect(within('classroom-seat-main', 'classroom-seat-confirm-message')).toBe(true);
        expect(within('classroom-seat-main', 'classroom-confirm-seat')).toBe(true);
        expect(screen.queryByTestId('classroom-seat-actions')).not.toBeInTheDocument();
    });

    test('the join error sits in the main column, below the confirmation', () => {
        renderSelector({ selectedSeat: 5, error: 'Could not connect to the server.' });
        expect(within('classroom-seat-main', 'classroom-error')).toBe(true);
        expect(within('classroom-seat-notices', 'classroom-error')).toBe(false);
    });
});

describe('StudentSeatSelector occupied seats and guide (#1796)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const rerenderWith = (rerender, props) =>
        rerender(
            <IntlProvider locale="en">
                <StudentSeatSelector
                    seatCount={10}
                    takenSeats={[3]}
                    onConfirmJoin={jest.fn()}
                    onRequestKick={jest.fn()}
                    onSelectSeat={jest.fn()}
                    {...props}
                />
            </IntlProvider>,
        );

    const wait = (ms) =>
        act(() => {
            jest.advanceTimersByTime(ms);
        });

    test('no always-visible guide above the grid', () => {
        renderSelector();
        expect(screen.queryByTestId('classroom-seat-guide')).not.toBeInTheDocument();
        expect(screen.queryByTestId('classroom-seat-idle-guide')).not.toBeInTheDocument();
    });

    test('an occupied seat looks pressable and says it is in use', () => {
        const { onRequestKick } = renderSelector();
        const seat = screen.getByTestId('classroom-seat-3');
        expect(seat).not.toBeDisabled();
        expect(seat).toHaveAttribute('data-occupied', '1');
        expect(seat).toHaveTextContent('In use');
        fireEvent.click(seat);
        expect(onRequestKick).toHaveBeenCalledWith(3);
    });

    test('after 30 seconds the guide appears on the right and occupied seats glow once', () => {
        renderSelector();
        wait(29000);
        expect(screen.queryByTestId('classroom-seat-idle-guide')).not.toBeInTheDocument();
        expect(screen.getByTestId('classroom-seat-3')).toHaveAttribute('data-flash', '0');
        wait(1000);
        const guide = screen.getByTestId('classroom-seat-idle-guide');
        expect(guide).toHaveAttribute('data-variant', 'idle');
        expect(screen.getByTestId('classroom-seat-notices')).toContainElement(guide);
        expect(guide).toHaveTextContent('you can still press it');
        expect(screen.getByTestId('classroom-seat-3')).toHaveAttribute('data-flash', '1');
        expect(screen.getByTestId('classroom-seat-4')).toHaveAttribute('data-flash', '0');
    });

    test('no guide when no seat is occupied', () => {
        renderSelector({ takenSeats: [] });
        wait(60000);
        expect(screen.queryByTestId('classroom-seat-idle-guide')).not.toBeInTheDocument();
    });

    test('the count restarts when the grid comes back from the confirmation', () => {
        const { rerender } = renderSelector();
        wait(20000);
        rerenderWith(rerender, { selectedSeat: 5 });
        wait(20000);
        rerenderWith(rerender, {});
        wait(29000);
        expect(screen.queryByTestId('classroom-seat-idle-guide')).not.toBeInTheDocument();
        wait(1000);
        expect(screen.getByTestId('classroom-seat-idle-guide')).toBeInTheDocument();
    });

    test('no guide while a kick request is pending', () => {
        renderSelector({ kickRequestPending: { requestId: 'r1', joinCode: 'ABC', seatNumber: 3 } });
        wait(60000);
        expect(screen.queryByTestId('classroom-seat-idle-guide')).not.toBeInTheDocument();
    });

    test('the previous seat is highlighted next to the heading but not picked', () => {
        const { onSelectSeat } = renderSelector({ previousSeat: 5 });
        expect(screen.getByTestId('classroom-seat-previous')).toHaveTextContent('Last time you were number 05');
        expect(screen.getByTestId('classroom-seat-heading')).toContainElement(
            screen.getByTestId('classroom-seat-previous'),
        );
        expect(screen.getByTestId('classroom-seat-5')).toHaveAttribute('data-previous', '1');
        expect(screen.getByTestId('classroom-seat-4')).toHaveAttribute('data-previous', '0');
        expect(onSelectSeat).not.toHaveBeenCalled();
        expect(screen.queryByTestId('classroom-seat-idle-guide')).not.toBeInTheDocument();
    });

    test('an occupied previous seat shows its guide at once', () => {
        renderSelector({ previousSeat: 3 });
        const guide = screen.getByTestId('classroom-seat-idle-guide');
        expect(guide).toHaveAttribute('data-variant', 'previousTaken');
        expect(guide).toHaveTextContent('Press it even if it is in use');
    });

    test('no previous line without a previous seat', () => {
        renderSelector();
        expect(screen.queryByTestId('classroom-seat-previous')).not.toBeInTheDocument();
    });
});

describe('KickRequestConfirmDialog wording (#1796)', () => {
    test('asks to free the seat with the teacher as the main button', () => {
        renderSelector({ kickRequestDialogSeat: 3, onConfirmKickRequest: jest.fn(), onCancelKickRequest: jest.fn() });
        expect(screen.getByTestId('kick-request-confirm-dialog')).toHaveTextContent('free seat 03');
        expect(screen.getByTestId('kick-request-submit')).toHaveTextContent('Ask the teacher');
        expect(screen.getByTestId('kick-request-cancel')).toHaveTextContent('Cancel');
    });
});
