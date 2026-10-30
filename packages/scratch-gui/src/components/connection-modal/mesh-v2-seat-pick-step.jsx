// "出席番号でつながる" screen 2: choose the seats to connect with.
// Presentational only: the grid comes from seatPickerState (lib/mesh-v2-seat-connect.js).
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { SEAT_SEPARATOR } from '../../lib/mesh-v2-seat-label.js';
import Box from '../box/box.jsx';
import styles from './mesh-v2-seat-connect.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Choose the numbers to connect with',
        description: 'Title of the seat number picker in the mesh connection modal',
        id: 'gui.connection.meshV2Seat.pickTitle',
    },
    pickNote: {
        defaultMessage: 'You are No. {seat}. You cannot remove your own number.',
        description: 'Note under the seat picker title',
        id: 'gui.connection.meshV2Seat.pickNote',
    },
    back: {
        defaultMessage: 'Back',
        description: 'Button to go back to the first mesh screen',
        id: 'gui.connection.meshV2Seat.back',
    },
    absent: {
        defaultMessage: 'Absent',
        description: 'Label of a seat whose student is not in the class',
        id: 'gui.connection.meshV2Seat.absent',
    },
    busy: {
        defaultMessage: 'In use',
        description: 'Label of a seat already in another mesh group',
        id: 'gui.connection.meshV2Seat.busy',
    },
    me: {
        defaultMessage: 'You',
        description: 'Label of the own seat in the seat picker',
        id: 'gui.connection.meshV2Seat.me',
    },
    limit: {
        defaultMessage: 'Up to {limit}',
        description: 'Shown when the mesh group size limit is reached',
        id: 'gui.connection.meshV2Seat.limit',
    },
    selectAll: {
        defaultMessage: 'Select everyone',
        description: 'Button to choose every seat (assignments without a limit)',
        id: 'gui.connection.meshV2Seat.selectAll',
    },
    summary: {
        defaultMessage: 'Chosen: {seats} / Host: No. {host}',
        description: 'Summary of the chosen seats and who hosts',
        id: 'gui.connection.meshV2Seat.summary',
    },
    next: {
        defaultMessage: 'Connect',
        description: 'Button to start waiting for the chosen seats',
        id: 'gui.connection.meshV2Seat.connect',
    },
    joinBusy: {
        defaultMessage: 'No. {seat} is already in a group. Join that group?',
        description: 'Asks whether to join the group of a seat that is in use',
        id: 'gui.connection.meshV2Seat.joinBusyConfirm',
    },
    join: {
        defaultMessage: 'Join',
        description: 'Button to join the group of a seat in use',
        id: 'gui.connection.meshV2Seat.join',
    },
    cancel: {
        defaultMessage: 'Cancel',
        description: 'Button to close the join question',
        id: 'gui.connection.meshV2Seat.cancel',
    },
});

const MeshV2SeatPickStep = ({
    picker,
    hostSeat,
    mySeat,
    chosenSeats,
    onBack,
    onToggle,
    onSelectAll,
    onJoinGroup,
    onNext,
}) => {
    const [busySeat, setBusySeat] = React.useState(null);
    const handleClick = React.useCallback(
        (event) => {
            const seat = Number(event.currentTarget.dataset.seat);
            const entry = picker.seats.find((s) => s.seat === seat);
            if (!entry) return;
            if (entry.busyGroupId && !entry.chosen) {
                setBusySeat(entry);
                return;
            }
            onToggle(seat);
        },
        [picker, onToggle],
    );
    const handleJoin = React.useCallback(() => {
        const entry = busySeat;
        setBusySeat(null);
        if (entry) onJoinGroup(entry.busyGroupId);
    }, [busySeat, onJoinGroup]);
    const handleCloseBusy = React.useCallback(() => setBusySeat(null), []);

    return (
        <Box className={styles.body} data-testid="meshV2-seat-pick">
            <div className={styles.title}>
                <FormattedMessage {...messages.title} />
            </div>
            <div className={styles.sub}>
                <FormattedMessage {...messages.pickNote} values={{ seat: mySeat }} />
            </div>
            <div className={styles.grid}>
                {picker.seats.map((entry) => (
                    <button
                        key={entry.seat}
                        className={classNames(styles.seat, {
                            [styles.seatChosen]: entry.chosen,
                            [styles.seatMe]: entry.me,
                            [styles.seatAbsent]: entry.absent,
                            [styles.seatBusy]: !!entry.busyGroupId,
                        })}
                        data-seat={entry.seat}
                        data-testid={`meshV2-seat-${entry.seat}`}
                        disabled={entry.disabled}
                        onClick={handleClick}
                    >
                        <span className={styles.seatNumber}>{entry.seat}</span>
                        <span className={styles.seatLabel}>
                            {entry.me && <FormattedMessage {...messages.me} />}
                            {!entry.me && entry.busyGroupId && <FormattedMessage {...messages.busy} />}
                            {!entry.me && !entry.busyGroupId && entry.absent && (
                                <FormattedMessage {...messages.absent} />
                            )}
                        </span>
                    </button>
                ))}
            </div>
            {busySeat && (
                <div className={styles.confirm} data-testid="meshV2-seat-busy-confirm">
                    <FormattedMessage {...messages.joinBusy} values={{ seat: busySeat.seat }} />
                    <button className={styles.primary} data-testid="meshV2-seat-busy-join" onClick={handleJoin}>
                        <FormattedMessage {...messages.join} />
                    </button>
                    <button className={styles.secondary} onClick={handleCloseBusy}>
                        <FormattedMessage {...messages.cancel} />
                    </button>
                </div>
            )}
            <div className={styles.footer}>
                <div className={styles.summary} data-testid="meshV2-seat-summary">
                    <FormattedMessage
                        {...messages.summary}
                        values={{ seats: chosenSeats.join(SEAT_SEPARATOR), host: hostSeat }}
                    />
                    {picker.limitReached && (
                        <span className={styles.limit}>
                            <FormattedMessage {...messages.limit} values={{ limit: picker.limit }} />
                        </span>
                    )}
                </div>
                <button className={styles.secondary} data-testid="meshV2-seat-back" onClick={onBack}>
                    <FormattedMessage {...messages.back} />
                </button>
                {picker.canSelectAll && (
                    <button className={styles.secondary} data-testid="meshV2-seat-select-all" onClick={onSelectAll}>
                        <FormattedMessage {...messages.selectAll} />
                    </button>
                )}
                <button className={styles.primary} data-testid="meshV2-seat-connect" onClick={onNext}>
                    <FormattedMessage {...messages.next} />
                </button>
            </div>
        </Box>
    );
};

MeshV2SeatPickStep.propTypes = {
    chosenSeats: PropTypes.arrayOf(PropTypes.number).isRequired,
    hostSeat: PropTypes.number,
    mySeat: PropTypes.number.isRequired,
    onBack: PropTypes.func.isRequired,
    onJoinGroup: PropTypes.func.isRequired,
    onNext: PropTypes.func.isRequired,
    onSelectAll: PropTypes.func.isRequired,
    onToggle: PropTypes.func.isRequired,
    picker: PropTypes.shape({
        canSelectAll: PropTypes.bool,
        limit: PropTypes.number,
        limitReached: PropTypes.bool,
        seats: PropTypes.arrayOf(PropTypes.object),
    }).isRequired,
};

export default MeshV2SeatPickStep;
