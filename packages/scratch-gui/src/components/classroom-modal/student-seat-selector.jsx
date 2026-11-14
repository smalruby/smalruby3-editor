import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useId, useState } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import {
    SEAT_IDLE_HINT_MS,
    decideSeatAction,
    isSeatIdleCounting,
    parseSeatNumberInput,
    seatGuideFor,
} from '../../lib/classroom-seat-selection.js';
import styles from './classroom-modal.css';
import ClassroomStatusIcon from './classroom-status-icon.jsx';
import ErrorDisplay from './error-display.jsx';
import KickRequestConfirmDialog from './kick-request-confirm-dialog.jsx';

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
        defaultMessage:
            'Seat {seatNumber} is in use. You are already waiting for the teacher, so please wait a little.',
        description: 'Error shown when the typed seat is taken and a kick request is already pending',
        id: 'gui.classroom.studentSeat.alreadyRequested',
    },
    inUse: {
        defaultMessage: 'In use',
        description:
            'Small label inside an occupied seat button. The button can still be pressed to ask the teacher to free the seat',
        id: 'gui.classroom.studentSeat.inUse',
    },
});

// A non-interactive copy of an occupied seat button, so the guide shows
// exactly what to press (#1796).
const OccupiedSeatSample = ({ label }) => (
    <span aria-hidden="true" className={`${styles.seatButton} ${styles.seatTaken} ${styles.seatGuideSample}`}>
        <span className={styles.seatButtonTop}>
            <span className={styles.seatButtonNumber}>{'03'}</span>
            <ClassroomStatusIcon size={12} status="occupied" />
        </span>
        <span className={styles.seatInUseLabel}>{label}</span>
    </span>
);

OccupiedSeatSample.propTypes = {
    label: PropTypes.string.isRequired,
};

const padSeat = (n) => String(n).padStart(2, '0');

/**
 * Becomes true after the student has not picked a seat for
 * SEAT_IDLE_HINT_MS (#1198). The count restarts each time `waiting` turns
 * true again, i.e. each time the grid comes back (#1796).
 * @param {boolean} waiting - the grid is shown and nothing else is pending.
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
    previousSeat,
    onSelectSeat,
    onConfirmJoin,
    onDismissKickedNotice,
    onDismissKickRequestRejectedNotice,
    onRequestKick,
    onConfirmKickRequest,
    onCancelKickRequest,
    onIdleGuide,
}) => {
    const intl = useIntl();
    const [seatInput, setSeatInput] = useState('');
    const [seatInputError, setSeatInputError] = useState(null);
    // Seat the student typed; highlighted in the grid even when it is taken.
    const [typedSeat, setTypedSeat] = useState(null);
    const [numberFormOpen, setNumberFormOpen] = useState(false);
    const counting = isSeatIdleCounting({ selectedSeat, kickRequestDialogSeat, kickRequestPending });
    const idle = useSeatIdleHint(counting);
    const { guide, flashTaken } = seatGuideFor({ previousSeat, takenSeats, idle, counting });
    // The 30-second guide came up (the occupied seats glow): tell the GA count once each time (#1831).
    useEffect(() => {
        if (flashTaken) onIdleGuide?.();
    }, [flashTaken]);

    const inUseLabel = intl.formatMessage(messages.inUse);
    // Screen readers learn which seat was used last time from the heading line.
    const previousNoteId = useId();

    const handleOpenNumberForm = useCallback(() => setNumberFormOpen(true), []);

    const handleReselect = useCallback(() => {
        setTypedSeat(null);
        onSelectSeat(null);
    }, [onSelectSeat]);

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
        <div className={styles.studentSeatLayout} data-testid="classroom-phase-student-seat">
            <div className={styles.studentMain} data-testid="classroom-seat-main">
                {selectedSeat ? (
                    // Tapping a seat goes straight to this confirmation, with Join
                    // right under the number instead of far up in the right
                    // column (#1305 S1). One main action per step (R2).
                    <div className={styles.seatConfirmStep} data-testid="classroom-seat-confirm">
                        <div data-testid="classroom-selected-seat" style={{ display: 'none' }}>
                            {selectedSeat}
                        </div>
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
                        <div className={styles.seatConfirmButtons}>
                            <button
                                className={styles.secondaryButton}
                                data-testid="classroom-seat-reselect"
                                disabled={isLoading}
                                onClick={handleReselect}
                                type="button"
                            >
                                <FormattedMessage
                                    defaultMessage="Choose again"
                                    description="Button on the seat confirmation that goes back to the seat buttons"
                                    id="gui.classroom.studentSeat.reselect"
                                />
                            </button>
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-confirm-seat"
                                disabled={isLoading}
                                onClick={onConfirmJoin}
                                type="button"
                            >
                                <FormattedMessage
                                    defaultMessage="Join"
                                    description="Confirm join button"
                                    id="gui.classroom.studentSeat.join"
                                />
                            </button>
                        </div>
                    </div>
                ) : (
                    <React.Fragment>
                        {/* The previous seat shares the heading line so 40 seats still
                            fit in 1300x600 (#1796). */}
                        <div className={styles.seatHeading} data-testid="classroom-seat-heading">
                            <div className={styles.phaseTitle}>
                                <FormattedMessage
                                    defaultMessage="Select your seat number"
                                    description="Seat selection prompt"
                                    id="gui.classroom.studentSeat.prompt"
                                />
                            </div>
                            {previousSeat && (
                                <div
                                    className={styles.seatPreviousNote}
                                    data-testid="classroom-seat-previous"
                                    id={previousNoteId}
                                >
                                    <FormattedMessage
                                        defaultMessage="Last time you were number {seatNumber}"
                                        description="Shown next to the seat selection heading: the seat this PC joined the same class with last time. The seat is highlighted but never picked automatically"
                                        id="gui.classroom.studentSeat.previousSeat"
                                        values={{ seatNumber: padSeat(previousSeat) }}
                                    />
                                </div>
                            )}
                        </div>
                        <div className={styles.seatGrid} data-testid="classroom-seat-grid">
                            {Array.from({ length: seatCount }, (_, i) => i + 1).map((n) => {
                                const isTaken = takenSeats.includes(n);
                                const isTyped = typedSeat === n;
                                const isPrevious = previousSeat === n;
                                const isFlashing = isTaken && flashTaken;
                                // Taken seats become tappable when an onRequestKick handler is
                                // provided AND we're not already waiting on a different one.
                                const canRequestKick = isTaken && onRequestKick && !kickRequestPending;
                                return (
                                    <button
                                        className={[
                                            styles.seatButton,
                                            isTaken ? styles.seatTaken : '',
                                            isTyped ? styles.seatTyped : '',
                                            isPrevious ? styles.seatPrevious : '',
                                            isFlashing ? styles.seatFlash : '',
                                        ].join(' ')}
                                        aria-describedby={isPrevious ? previousNoteId : null}
                                        data-flash={isFlashing ? '1' : '0'}
                                        data-occupied={isTaken ? '1' : '0'}
                                        data-previous={isPrevious ? '1' : '0'}
                                        data-seat={n}
                                        data-taken={canRequestKick ? '1' : '0'}
                                        data-typed={isTyped ? '1' : '0'}
                                        data-testid={`classroom-seat-${n}`}
                                        disabled={isTaken && !canRequestKick}
                                        key={n}
                                        onClick={handleSeatClick}
                                    >
                                        <span className={styles.seatButtonTop}>
                                            <span className={styles.seatButtonNumber}>{n}</span>
                                            {/* The "In use" text names the seat; the icon is
                                                decoration, so it is not read twice. */}
                                            {isTaken && (
                                                <span aria-hidden="true" className={styles.seatButtonIcon}>
                                                    <ClassroomStatusIcon size={12} status="occupied" />
                                                </span>
                                            )}
                                        </span>
                                        {isTaken && <span className={styles.seatInUseLabel}>{inUseLabel}</span>}
                                    </button>
                                );
                            })}
                        </div>
                        {/* Typing the number is only the fallback for a student who
                            cannot find it among the buttons (#1305 S1). */}
                        {numberFormOpen ? (
                            <form
                                className={styles.seatNumberForm}
                                data-testid="classroom-seat-number-form"
                                onSubmit={handleSeatInputSubmit}
                            >
                                <input
                                    aria-label={intl.formatMessage(messages.numberInputLabel)}
                                    autoFocus
                                    className={styles.seatNumberInput}
                                    data-testid="classroom-seat-number-input"
                                    inputMode="numeric"
                                    onChange={handleSeatInputChange}
                                    placeholder={intl.formatMessage(messages.numberInputPlaceholder, { seatCount })}
                                    type="text"
                                    value={seatInput}
                                />
                                <button
                                    className={styles.secondaryButton}
                                    data-testid="classroom-seat-number-submit"
                                    type="submit"
                                >
                                    <FormattedMessage
                                        defaultMessage="Use this number"
                                        description="Button next to the seat number input"
                                        id="gui.classroom.studentSeat.numberSubmit"
                                    />
                                </button>
                            </form>
                        ) : (
                            <button
                                className={`${styles.linkButton} ${styles.seatNumberToggle}`}
                                data-testid="classroom-seat-number-toggle"
                                onClick={handleOpenNumberForm}
                                type="button"
                            >
                                <FormattedMessage
                                    defaultMessage="Can't find your number?"
                                    description="Link under the seat buttons that opens the seat number input"
                                    id="gui.classroom.studentSeat.numberToggle"
                                />
                            </button>
                        )}
                        {seatInputError && (
                            <div className={styles.errorText} data-testid="classroom-seat-number-error">
                                {seatInputError}
                            </div>
                        )}
                    </React.Fragment>
                )}
                {/* The right column is already full with banners, and a long error
                    (e.g. network unreachable with the API host) would overflow
                    600px there (#1221). */}
                <ErrorDisplay error={error} errorTitle={errorTitle} />
            </div>
            <div className={styles.studentNotices} data-testid="classroom-seat-notices">
                {guide && (
                    <div
                        className={styles.seatIdleGuide}
                        data-testid="classroom-seat-idle-guide"
                        data-variant={guide}
                    >
                        <OccupiedSeatSample label={inUseLabel} />
                        <div className={styles.seatIdleGuideText}>
                            {guide === 'previousTaken' ? (
                                <FormattedMessage
                                    defaultMessage="Press it even if it is in use. Your teacher can free the seat for you."
                                    description="Guide next to the seat grid shown at once when the seat this PC joined last time is now in use (the number is already shown next to the heading)"
                                    id="gui.classroom.studentSeat.previousTakenGuide"
                                />
                            ) : (
                                <FormattedMessage
                                    defaultMessage="If your number is 'In use', you can still press it. Your teacher can free the seat for you."
                                    description="Guide next to the seat grid shown after 30 seconds without a pick, encouraging the student to press an occupied seat"
                                    id="gui.classroom.studentSeat.idleGuide"
                                />
                            )}
                        </div>
                    </div>
                )}
                {kickedNotice && (
                    <div className={styles.kickedBanner} data-testid="classroom-kicked-banner">
                        <div className={styles.kickedBannerText}>
                            <strong>
                                <FormattedMessage
                                    defaultMessage="You were removed from this assignment by your teacher."
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
                    <div className={styles.kickRequestPendingBanner} data-testid="kick-request-pending-banner">
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
                    <div className={styles.kickRequestRejectedBanner} data-testid="kick-request-rejected-banner">
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
    // the 30-second guide came up (the GA seat_idle_guide, #1831)
    onIdleGuide: PropTypes.func,
    onConfirmJoin: PropTypes.func.isRequired,
    onConfirmKickRequest: PropTypes.func,
    onDismissKickRequestRejectedNotice: PropTypes.func,
    onDismissKickedNotice: PropTypes.func,
    onRequestKick: PropTypes.func,
    onSelectSeat: PropTypes.func.isRequired,
    previousSeat: PropTypes.number,
    seatCount: PropTypes.number.isRequired,
    selectedSeat: PropTypes.number,
    takenSeats: PropTypes.arrayOf(PropTypes.number),
};

export default StudentSeatSelector;
