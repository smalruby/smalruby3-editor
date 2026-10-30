// "出席番号でつながる" screen 3: wait for the chosen seats.
// Presentational only: the statuses come from describeSeatStatuses (lib/mesh-v2-seat-connect.js).
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { SEAT_STATUS } from '../../lib/mesh-v2-seat-connect.js';
import { SEAT_SEPARATOR } from '../../lib/mesh-v2-seat-label.js';
import Box from '../box/box.jsx';
import styles from './mesh-v2-seat-connect.css';

const messages = defineMessages({
    titleSeats: {
        defaultMessage: 'Group of No. {seats}',
        description: 'Title of the seat number waiting screen',
        id: 'gui.connection.meshV2Seat.waitTitle',
    },
    autoStart: {
        defaultMessage: 'It starts by itself when everyone is here.',
        description: 'Explains that the waiting screen closes when everyone arrives',
        id: 'gui.connection.meshV2Seat.autoStart',
    },
    waitingHost: {
        defaultMessage: 'Waiting for the host, No. {host}',
        description: 'Shown to a student who waits for the host to make the group',
        id: 'gui.connection.meshV2Seat.waitingHost',
    },
    me: {
        defaultMessage: 'You',
        description: 'Status of the own seat while waiting',
        id: 'gui.connection.meshV2Seat.statusMe',
    },
    meHost: {
        defaultMessage: 'You (host)',
        description: 'Status of the own seat when hosting',
        id: 'gui.connection.meshV2Seat.statusMeHost',
    },
    joined: {
        defaultMessage: 'Joined',
        description: 'Status of a seat that joined the group',
        id: 'gui.connection.meshV2Seat.statusJoined',
    },
    waiting: {
        defaultMessage: 'Waiting',
        description: 'Status of a seat not connected yet',
        id: 'gui.connection.meshV2Seat.statusWaiting',
    },
    absent: {
        defaultMessage: 'Absent, not waiting',
        description: 'Status of a seat whose student is not in the class',
        id: 'gui.connection.meshV2Seat.statusAbsent',
    },
    elsewhere: {
        defaultMessage: 'In another group',
        description: 'Status of a seat that is in another group',
        id: 'gui.connection.meshV2Seat.statusElsewhere',
    },
    elsewhereWarning: {
        defaultMessage: 'No. {seat} is in the group of No. {seats}. You may have chosen different numbers.',
        description: 'Warning when a chosen seat is in another group',
        id: 'gui.connection.meshV2Seat.elsewhereWarning',
    },
    removeSeat: {
        defaultMessage: 'Remove No. {seat}',
        description: 'Button to stop waiting for a seat that is in another group',
        id: 'gui.connection.meshV2Seat.removeSeat',
    },
    rechoose: {
        defaultMessage: 'Choose again',
        description: 'Button to go back to the seat picker',
        id: 'gui.connection.meshV2Seat.rechoose',
    },
    keepWaiting: {
        defaultMessage: 'Keep waiting',
        description: 'Button to dismiss the warning and keep waiting',
        id: 'gui.connection.meshV2Seat.keepWaiting',
    },
    allArrived: {
        defaultMessage: 'Everyone is here!',
        description: 'Shown when every chosen seat has joined',
        id: 'gui.connection.meshV2Seat.allArrived',
    },
    aloneConfirm: {
        defaultMessage: 'Everyone you chose is absent. Start by yourself?',
        description: 'Asks before starting when every other chosen seat is absent',
        id: 'gui.connection.meshV2Seat.aloneConfirm',
    },
    startAlone: {
        defaultMessage: 'Start by myself',
        description: 'Button to start alone',
        id: 'gui.connection.meshV2Seat.startAlone',
    },
    cancel: {
        defaultMessage: 'Cancel',
        description: 'Button to stop waiting',
        id: 'gui.connection.meshV2Seat.cancel',
    },
    startNow: {
        defaultMessage: 'Start without waiting',
        description: 'Button to start with the members who are here',
        id: 'gui.connection.meshV2Seat.startNow',
    },
    error: {
        defaultMessage: 'Could not connect.',
        description: 'Shown when creating or joining the group failed',
        id: 'gui.connection.meshV2Seat.error',
    },
    retry: {
        defaultMessage: 'Try again',
        description: 'Button to try connecting again',
        id: 'gui.connection.meshV2Seat.retry',
    },
});

const STATUS_MARK = {
    [SEAT_STATUS.ME]: '★',
    [SEAT_STATUS.JOINED]: '✓',
    [SEAT_STATUS.WAITING]: '…',
    [SEAT_STATUS.ABSENT]: '—',
    [SEAT_STATUS.ELSEWHERE]: '⚠',
};

const statusMessage = (entry) => {
    if (entry.status === SEAT_STATUS.ME) return entry.host ? messages.meHost : messages.me;
    if (entry.status === SEAT_STATUS.JOINED) return messages.joined;
    if (entry.status === SEAT_STATUS.ABSENT) return messages.absent;
    if (entry.status === SEAT_STATUS.ELSEWHERE) return messages.elsewhere;
    return messages.waiting;
};

const MeshV2SeatWaitStep = ({
    allArrived,
    aloneConfirm,
    chosenSeats,
    connected,
    error,
    hostSeat,
    statuses,
    warning,
    onCancel,
    onConfirmAlone,
    onDismissAlone,
    onKeepWaiting,
    onRechoose,
    onRemoveSeat,
    onRetry,
    onStartNow,
}) => {
    const handleRemove = React.useCallback(() => onRemoveSeat(warning.seat), [onRemoveSeat, warning]);
    const handleKeep = React.useCallback(() => onKeepWaiting(warning.seat), [onKeepWaiting, warning]);
    return (
        <Box className={styles.body} data-testid="meshV2-seat-wait">
            <div className={styles.title}>
                <FormattedMessage {...messages.titleSeats} values={{ seats: chosenSeats.join(SEAT_SEPARATOR) }} />
            </div>
            <div className={styles.sub} data-testid="meshV2-seat-wait-note">
                {!connected && hostSeat ? (
                    <FormattedMessage {...messages.waitingHost} values={{ host: hostSeat }} />
                ) : (
                    <FormattedMessage {...messages.autoStart} />
                )}
            </div>
            <div className={styles.memberList}>
                {statuses.map((entry) => (
                    <div
                        key={entry.seat}
                        className={classNames(styles.member, styles[`member-${entry.status}`])}
                        data-status={entry.status}
                        data-testid={`meshV2-seat-status-${entry.seat}`}
                    >
                        <span className={styles.memberMark}>{STATUS_MARK[entry.status]}</span>
                        <span className={styles.memberSeat}>{entry.seat}</span>
                        <span>
                            <FormattedMessage {...statusMessage(entry)} />
                        </span>
                    </div>
                ))}
            </div>
            {allArrived && (
                <div className={styles.arrived} data-testid="meshV2-seat-all-arrived">
                    <FormattedMessage {...messages.allArrived} />
                </div>
            )}
            {warning && !allArrived && (
                <div className={styles.warning} data-testid="meshV2-seat-elsewhere-warning">
                    <div>
                        <FormattedMessage
                            {...messages.elsewhereWarning}
                            values={{ seat: warning.seat, seats: (warning.groupSeats || []).join(SEAT_SEPARATOR) }}
                        />
                    </div>
                    <div className={styles.warningActions}>
                        <button className={styles.secondary} data-testid="meshV2-seat-remove" onClick={handleRemove}>
                            <FormattedMessage {...messages.removeSeat} values={{ seat: warning.seat }} />
                        </button>
                        <button className={styles.secondary} data-testid="meshV2-seat-rechoose" onClick={onRechoose}>
                            <FormattedMessage {...messages.rechoose} />
                        </button>
                        <button
                            className={styles.secondary}
                            data-testid="meshV2-seat-keep-waiting"
                            onClick={handleKeep}
                        >
                            <FormattedMessage {...messages.keepWaiting} />
                        </button>
                    </div>
                </div>
            )}
            {aloneConfirm && (
                <div className={styles.confirm} data-testid="meshV2-seat-alone-confirm">
                    <FormattedMessage {...messages.aloneConfirm} />
                    <button className={styles.primary} data-testid="meshV2-seat-start-alone" onClick={onConfirmAlone}>
                        <FormattedMessage {...messages.startAlone} />
                    </button>
                    <button className={styles.secondary} onClick={onDismissAlone}>
                        <FormattedMessage {...messages.cancel} />
                    </button>
                </div>
            )}
            {error && (
                <div className={styles.warning} data-testid="meshV2-seat-error">
                    <FormattedMessage {...messages.error} />
                    <button className={styles.secondary} data-testid="meshV2-seat-retry" onClick={onRetry}>
                        <FormattedMessage {...messages.retry} />
                    </button>
                </div>
            )}
            <div className={classNames(styles.footer, styles.footerSplit)}>
                <button className={styles.secondary} data-testid="meshV2-seat-wait-cancel" onClick={onCancel}>
                    <FormattedMessage {...messages.cancel} />
                </button>
                <button
                    className={styles.primary}
                    data-testid="meshV2-seat-start-now"
                    disabled={allArrived}
                    onClick={onStartNow}
                >
                    <FormattedMessage {...messages.startNow} />
                </button>
            </div>
        </Box>
    );
};

MeshV2SeatWaitStep.propTypes = {
    allArrived: PropTypes.bool,
    aloneConfirm: PropTypes.bool,
    chosenSeats: PropTypes.arrayOf(PropTypes.number).isRequired,
    connected: PropTypes.bool,
    error: PropTypes.bool,
    hostSeat: PropTypes.number,
    onCancel: PropTypes.func.isRequired,
    onConfirmAlone: PropTypes.func.isRequired,
    onDismissAlone: PropTypes.func.isRequired,
    onKeepWaiting: PropTypes.func.isRequired,
    onRechoose: PropTypes.func.isRequired,
    onRemoveSeat: PropTypes.func.isRequired,
    onRetry: PropTypes.func.isRequired,
    onStartNow: PropTypes.func.isRequired,
    statuses: PropTypes.arrayOf(
        PropTypes.shape({
            seat: PropTypes.number,
            status: PropTypes.string,
            host: PropTypes.bool,
        }),
    ).isRequired,
    warning: PropTypes.shape({
        seat: PropTypes.number,
        groupSeats: PropTypes.arrayOf(PropTypes.number),
    }),
};

export default MeshV2SeatWaitStep;
