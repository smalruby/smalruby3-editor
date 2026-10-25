import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';

import { SEAT_IDLE_HINT_MS, decideSeatAction, parseSeatNumberInput } from '../../lib/classroom-seat-selection.js';

import ClassroomStatusIcon from './classroom-status-icon.jsx';
import ErrorDisplay from './error-display.jsx';
import KickRequestConfirmDialog from './kick-request-confirm-dialog.jsx';

import styles from './classroom-modal.css';

const messages = defineMessages({
    numberInputLabel: {
        defaultMessage: 'Seat number',
        description: 'Accessible label of the seat number input on the seat selection screen',
        id: 'gui.classroom.studentSeat.numberInputLabel',
    },
    numberInputPlaceholder: {
        defaultMessage: '1-{seatCount}',
        description: 'Placeholder of the seat number input showing the range of seat numbers',
        id: 'gui.classroom.studentSeat.numberInputPlaceholder',
    },
    numberError: {
        defaultMessage: 'Type a number from 1 to {seatCount}.',
        description: 'Error shown when the typed seat number is empty, not a number or out of range',
        id: 'gui.classroom.studentSeat.numberError',
    },
    alreadyRequested: {
        defaultMessage: 'Seat {seatNumber} is in use. You are already waiting for the teacher, so please wait a little.',
        description: 'Error shown when the typed seat is taken and a kick request is already pending',
        id: 'gui.classroom.studentSeat.alreadyRequested',
    },
});

const padSeat = (n) => String(n).padStart(2, '0');

/**
 * Becomes true after the student has not picked a seat for
 * SEAT_IDLE_HINT_MS, so the guide can start moving (#1198).
 * @param {boolean} waiting - no seat picked and nothing else to wait for.
 * @returns {boolean} true once the student has been idle long enough.
 */
const useSeatIdleHint = (waiting) => {
    const [idle, setIdle] = useState(false);
    useEffect(() => {
        if (!waiting) {
            setIdle(false);
            return () => {};
        }
        const timer = setTimeout(() => setIdle(true), SEAT_IDLE_HINT_MS);
        return () => clearTimeout(timer);
    }, [waiting]);
    return idle;
};

const StudentSeatSelector = ({
    seatCount,
    takenSeats,
    selectedSeat,
    isLoading,
    error,
    errorTitle,
    kickedNotice,
    kickRequestDialogSeat,
    kickRequestPending,
    kickRequestRejectedNotice,
    kickRequestError,
    onSelectSeat,
    onConfirmJoin,
    onDismissKickedNotice,
    onDismissKickRequestRejectedNotice,
    onRequestKick,
    onConfirmKickRequest,
    onCancelKickRequest,
}) => {
    const intl = useIntl();
    const [seatInput, setSeatInput] = useState('');
    const [seatInputError, setSeatInputError] = useState(null);
    // Seat the student typed; highlighted in the grid even when it is taken.
    const [typedSeat, setTypedSeat] = useState(null);
    const idle = useSeatIdleHint(!selectedSeat && !kickRequestPending && !kickRequestDialogSeat);

    const handleSeatInputChange = useCallback((e) => {
        setSeatInput(e.target.value);
        setSeatInputError(null);
    }, []);

    const handleSeatInputSubmit = useCallback(
        (e) => {
            e.preventDefault();
            const { seat } = parseSeatNumberInput(seatInput, seatCount);
            if (!seat) {
                setTypedSeat(null);
                setSeatInputError(intl.formatMessage(messages.numberError, { seatCount }));
                return;
            }
            setTypedSeat(seat);
            const action = decideSeatAction(seat, takenSeats, kickRequestPending);
            if (action === 'select') {
                onSelectSeat(seat);
            } else if (action === 'requestKick') {
                if (onRequestKick) onRequestKick(seat);
            } else if (action === 'alreadyRequested') {
                setSeatInputError(intl.formatMessage(messages.alreadyRequested, { seatNumber: padSeat(seat) }));
            }
        },
        [intl, seatInput, seatCount, takenSeats, kickRequestPending, onSelectSeat, onRequestKick],
    );

    const handleSeatClick = useCallback(
        (e) => {
            const n = parseInt(e.currentTarget.dataset.seat, 10);
            const taken = e.currentTarget.dataset.taken === '1';
            if (taken) {
                // Tapping an occupied seat asks the teacher to free it.
                if (onRequestKick) onRequestKick(n);
                return;
            }
            setTypedSeat(null);
            onSelectSeat(n);
        },
        [onSelectSeat, onRequestKick],
    );

    // When the confirm dialog is open we hide the grid to avoid mid-tap
    // misclicks on seats that are still rendered behind a modal-ish overlay.
    if (kickRequestDialogSeat) {
        return (
            <div data-testid="classroom-phase-student-seat">
                <KickRequestConfirmDialog
                    error={kickRequestError}
                    isLoading={isLoading}
                    seatNumber={kickRequestDialogSeat}
                    onCancel={onCancelKickRequest}
                    onConfirm={onConfirmKickRequest}
                />
            </div>
        );
    }

    return (
        <div
            className={styles.studentSeatLayout}
            data-testid="classroom-phase-student-seat"
        >
            <div className={styles.studentMain} data-testid="classroom-seat-main">
                <div className={styles.phaseTitle}>
                    <FormattedMessage
                        defaultMessage="Select your seat number"
                        description="Seat selection prompt"
                        id="gui.classroom.studentSeat.prompt"
                    />
                </div>
                <form
                    className={styles.seatNumberForm}
                    data-testid="classroom-seat-number-form"
                    onSubmit={handleSeatInputSubmit}
                >
                    <input
                        aria-label={intl.formatMessage(messages.numberInputLabel)}
                        className={styles.seatNumberInput}
                        data-testid="classroom-seat-number-input"
                        inputMode="numeric"
                        onChange={handleSeatInputChange}
                        placeholder={intl.formatMessage(messages.numberInputPlaceholder, { seatCount })}
                        type="text"
                        value={seatInput}
                    />
                    <button className={styles.secondaryButton} data-testid="classroom-seat-number-submit" type="submit">
                        <FormattedMessage
                            defaultMessage="Use this number"
                            description="Button next to the seat number input"
                            id="gui.classroom.studentSeat.numberSubmit"
                        />
                    </button>
                </form>
                {seatInputError && (
                    <div className={styles.errorText} data-testid="classroom-seat-number-error">
                        {seatInputError}
                    </div>
                )}
                <div
                    className={`${styles.seatGuide} ${idle ? styles.seatGuideIdle : ''}`}
                    data-idle={idle ? '1' : '0'}
                    data-testid="classroom-seat-guide"
                >
                    <FormattedMessage
                        defaultMessage="If your number is already in use, press that number. You can ask the teacher to free the seat, and the teacher will come to check with you."
                        description="Always-visible guide on the seat selection screen explaining how to get an occupied seat back"
                        id="gui.classroom.studentSeat.guide"
                    />
                </div>
                <div className={styles.seatGrid} data-testid="classroom-seat-grid">
                    {Array.from({ length: seatCount }, (_, i) => i + 1).map(n => {
                        const isTaken = takenSeats.includes(n);
                        const isSelected = selectedSeat === n;
                        const isTyped = typedSeat === n && !isSelected;
                        // Taken seats become tappable when an onRequestKick handler is
                        // provided AND we're not already waiting on a different one.
                        // We still let the student tap their own pending seat (it just
                        // does nothing — we suppress in container) to avoid confusion.
                        const canRequestKick = isTaken && onRequestKick && !kickRequestPending;
                        return (
                            <button
                                className={`${styles.seatButton} ${isTaken ? styles.seatTaken : ''} ${isSelected ? styles.seatSelected : ''} ${isTyped ? styles.seatTyped : ''}`}
                                data-seat={n}
                                data-taken={canRequestKick ? '1' : '0'}
                                data-typed={isTyped ? '1' : '0'}
                                data-testid={`classroom-seat-${n}`}
                                disabled={isTaken && !canRequestKick}
                                key={n}
                                onClick={handleSeatClick}
                            >
                                <span className={styles.seatButtonNumber}>{n}</span>
                                {isTaken && (
                                    <ClassroomStatusIcon
                                        size={12}
                                        status="occupied"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className={styles.studentNotices} data-testid="classroom-seat-notices">
                {kickedNotice && (
                    <div className={styles.kickedBanner} data-testid="classroom-kicked-banner">
                        <div className={styles.kickedBannerText}>
                            <strong>
                                <FormattedMessage
                                    defaultMessage="You were removed from this class by your teacher."
                                    description="Banner shown when the teacher kicked the student"
                                    id="gui.classroom.kicked.banner.title"
                                />
                            </strong>
                            <div>
                                <FormattedMessage
                                    defaultMessage="Pick your seat again to rejoin {className}."
                                    description="Banner subtitle prompting the student to re-pick a seat after a kick"
                                    id="gui.classroom.kicked.banner.subtitle"
                                    values={{ className: kickedNotice.className || '' }}
                                />
                            </div>
                        </div>
                        {onDismissKickedNotice && (
                            <button
                                aria-label="dismiss"
                                className={styles.kickedBannerDismiss}
                                data-testid="classroom-kicked-banner-dismiss"
                                onClick={onDismissKickedNotice}
                                type="button"
                            >
                                ×
                            </button>
                        )}
                    </div>
                )}
                {kickRequestPending && (
                    <div
                        className={styles.kickRequestPendingBanner}
                        data-testid="kick-request-pending-banner"
                    >
                        <FormattedMessage
                            defaultMessage="Waiting for the teacher to free seat {seatNumber}..."
                            description="Banner shown while a pending kick request is outstanding"
                            id="gui.classroom.kickRequest.pendingBanner"
                            values={{ seatNumber: String(kickRequestPending.seatNumber).padStart(2, '0') }}
                        />
                        <div className={styles.kickRequestPendingNote} data-testid="kick-request-pending-note">
                            <FormattedMessage
                                defaultMessage="Your request has reached the teacher, who will come to check with you. While you wait, you can keep using Smalruby. When the seat is free, you will join it automatically."
                                description="Note under the pending kick-request banner telling the student they may keep working"
                                id="gui.classroom.kickRequest.pendingNote"
                            />
                        </div>
                    </div>
                )}
                {!kickRequestPending && kickRequestRejectedNotice && (
                    <div
                        className={styles.kickRequestRejectedBanner}
                        data-testid="kick-request-rejected-banner"
                    >
                        <div className={styles.kickRequestRejectedText}>
                            <FormattedMessage
                                defaultMessage="The teacher did not free seat {seatNumber} this time. Try a different seat, or send a new request."
                                description="Banner shown after the teacher rejected (or the TTL expired) the kick request"
                                id="gui.classroom.kickRequest.rejectedBanner"
                                values={{
                                    seatNumber: String(kickRequestRejectedNotice.seatNumber).padStart(2, '0'),
                                }}
                            />
                        </div>
                        {onDismissKickRequestRejectedNotice && (
                            <button
                                aria-label="dismiss"
                                className={styles.kickedBannerDismiss}
                                data-testid="kick-request-rejected-banner-dismiss"
                                onClick={onDismissKickRequestRejectedNotice}
                                type="button"
                            >
                                ×
                            </button>
                        )}
                    </div>
                )}
            </div>
            <div className={styles.studentActions} data-testid="classroom-seat-actions">
                <div data-testid="classroom-selected-seat" style={{ display: 'none' }}>
                    {selectedSeat}
                </div>
                {selectedSeat && (
                    <div className={styles.seatConfirm} data-testid="classroom-seat-confirm-message">
                        <div className={styles.seatConfirmTitle}>
                            <FormattedMessage
                                defaultMessage="You will join as number {seatNumber}"
                                description="Large confirmation shown before joining with the selected seat"
                                id="gui.classroom.studentSeat.confirmTitle"
                                values={{ seatNumber: padSeat(selectedSeat) }}
                            />
                        </div>
                        <div className={styles.seatConfirmNote}>
                            <FormattedMessage
                                defaultMessage="Is this your own number? If you take someone else's seat, that person cannot join. Check it, then press Join."
                                description="Note under the seat confirmation asking the student to double-check the number"
                                id="gui.classroom.studentSeat.confirmNote"
                            />
                        </div>
                    </div>
                )}
                <div className={styles.buttonRow}>
                    <button
                        className={styles.primaryButton}
                        data-testid="classroom-confirm-seat"
                        disabled={!selectedSeat || isLoading}
                        onClick={onConfirmJoin}
                    >
                        <FormattedMessage
                            defaultMessage="Join"
                            description="Confirm join button"
                            id="gui.classroom.studentSeat.join"
                        />
                    </button>
                </div>
                <ErrorDisplay error={error} errorTitle={errorTitle} />
            </div>
        </div>
    );
};

StudentSeatSelector.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    kickedNotice: PropTypes.shape({
        joinCode: PropTypes.string,
        className: PropTypes.string,
        seatNumber: PropTypes.number,
    }),
    kickRequestDialogSeat: PropTypes.number,
    kickRequestError: PropTypes.string,
    kickRequestPending: PropTypes.shape({
        requestId: PropTypes.string,
        joinCode: PropTypes.string,
        seatNumber: PropTypes.number,
    }),
    kickRequestRejectedNotice: PropTypes.shape({
        seatNumber: PropTypes.number,
    }),
    onCancelKickRequest: PropTypes.func,
    onConfirmJoin: PropTypes.func.isRequired,
    onConfirmKickRequest: PropTypes.func,
    onDismissKickRequestRejectedNotice: PropTypes.func,
    onDismissKickedNotice: PropTypes.func,
    onRequestKick: PropTypes.func,
    onSelectSeat: PropTypes.func.isRequired,
    seatCount: PropTypes.number.isRequired,
    selectedSeat: PropTypes.number,
    takenSeats: PropTypes.arrayOf(PropTypes.number),
};

export default StudentSeatSelector;
