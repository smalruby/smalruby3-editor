import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

import ErrorDisplay from './error-display.jsx';
import KickRequestConfirmDialog from './kick-request-confirm-dialog.jsx';

import styles from './classroom-modal.css';

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
    kickRequestError,
    onSelectSeat,
    onConfirmJoin,
    onDismissKickedNotice,
    onRequestKick,
    onConfirmKickRequest,
    onCancelKickRequest,
}) => {
    const handleSeatClick = useCallback(
        (e) => {
            const n = parseInt(e.currentTarget.dataset.seat, 10);
            const taken = e.currentTarget.dataset.taken === '1';
            if (taken) {
                // Tapping an occupied seat asks the teacher to free it.
                if (onRequestKick) onRequestKick(n);
                return;
            }
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
        <div data-testid="classroom-phase-student-seat">
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
                </div>
            )}
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Select your seat number"
                    description="Seat selection prompt"
                    id="gui.classroom.studentSeat.prompt"
                />
            </div>
            <div className={styles.seatGrid} data-testid="classroom-seat-grid">
                {Array.from({ length: seatCount }, (_, i) => i + 1).map(n => {
                    const isTaken = takenSeats.includes(n);
                    const isSelected = selectedSeat === n;
                    // Taken seats become tappable when an onRequestKick handler is
                    // provided AND we're not already waiting on a different one.
                    // We still let the student tap their own pending seat (it just
                    // does nothing — we suppress in container) to avoid confusion.
                    const canRequestKick = isTaken && onRequestKick && !kickRequestPending;
                    return (
                        <button
                            className={`${styles.seatButton} ${isTaken ? styles.seatTaken : ''} ${isSelected ? styles.seatSelected : ''}`}
                            data-seat={n}
                            data-taken={canRequestKick ? '1' : '0'}
                            data-testid={`classroom-seat-${n}`}
                            disabled={isTaken && !canRequestKick}
                            key={n}
                            onClick={handleSeatClick}
                        >
                            {n}
                        </button>
                    );
                })}
            </div>
            <div data-testid="classroom-selected-seat" style={{ display: 'none' }}>
                {selectedSeat}
            </div>
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
    onCancelKickRequest: PropTypes.func,
    onConfirmJoin: PropTypes.func.isRequired,
    onConfirmKickRequest: PropTypes.func,
    onDismissKickedNotice: PropTypes.func,
    onRequestKick: PropTypes.func,
    onSelectSeat: PropTypes.func.isRequired,
    seatCount: PropTypes.number.isRequired,
    selectedSeat: PropTypes.number,
    takenSeats: PropTypes.arrayOf(PropTypes.number),
};

export default StudentSeatSelector;
