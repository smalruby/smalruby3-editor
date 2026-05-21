import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

const StudentSeatSelector = ({
    seatCount,
    takenSeats,
    selectedSeat,
    isLoading,
    error,
    errorTitle,
    kickedNotice,
    onSelectSeat,
    onConfirmJoin,
    onDismissKickedNotice,
}) => {
    const handleSeatClick = useCallback(
        (e) => {
            onSelectSeat(parseInt(e.currentTarget.dataset.seat, 10));
        },
        [onSelectSeat],
    );

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
                    return (
                        <button
                            className={`${styles.seatButton} ${isTaken ? styles.seatTaken : ''} ${isSelected ? styles.seatSelected : ''}`}
                            data-seat={n}
                            data-testid={`classroom-seat-${n}`}
                            disabled={isTaken}
                            key={n}
                            onClick={handleSeatClick}
                        >
                            {n}
                        </button>
                    );
                })}
            </div>
            <div
                data-testid="classroom-selected-seat"
                style={{ display: 'none' }}
            >
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
    onConfirmJoin: PropTypes.func.isRequired,
    onDismissKickedNotice: PropTypes.func,
    onSelectSeat: PropTypes.func.isRequired,
    seatCount: PropTypes.number.isRequired,
    selectedSeat: PropTypes.number,
    takenSeats: PropTypes.arrayOf(PropTypes.number),
};

export default StudentSeatSelector;
