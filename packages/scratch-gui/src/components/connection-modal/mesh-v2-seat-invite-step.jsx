// "出席番号でつながる": shown instead of the first screen when a group chose the
// student's seat but the student is not in it yet (findInvitingGroup).
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
    title: {
        defaultMessage: "No. {host}'s group is calling you",
        description: 'Title of the screen telling a late student that a seat group waits for them',
        id: 'gui.connection.meshV2Seat.inviteTitle',
    },
    description: {
        defaultMessage: 'They have been waiting for you (No. {seat}). Join to start together right away.',
        description: 'Explains that the group chose the student and waits for them',
        id: 'gui.connection.meshV2Seat.inviteDescription',
    },
    group: {
        defaultMessage: 'Group of No. {seats}',
        description: 'Name of the group that calls the student',
        id: 'gui.connection.meshV2Seat.inviteGroup',
    },
    host: {
        defaultMessage: 'Host, joined',
        description: 'Status of the host seat of the calling group',
        id: 'gui.connection.meshV2Seat.inviteStatusHost',
    },
    me: {
        defaultMessage: 'You (not joined yet)',
        description: 'Status of the own seat in the calling group',
        id: 'gui.connection.meshV2Seat.inviteStatusMe',
    },
    joined: {
        defaultMessage: 'Joined',
        description: 'Status of a seat already in the calling group',
        id: 'gui.connection.meshV2Seat.inviteStatusJoined',
    },
    waiting: {
        defaultMessage: 'Not here yet',
        description: 'Status of a present seat not in the calling group yet',
        id: 'gui.connection.meshV2Seat.inviteStatusWaiting',
    },
    absent: {
        defaultMessage: 'Absent',
        description: 'Status of a seat whose student is not in the class',
        id: 'gui.connection.meshV2Seat.inviteStatusAbsent',
    },
    elsewhere: {
        defaultMessage: 'In another group',
        description: 'Status of a seat that is in another group',
        id: 'gui.connection.meshV2Seat.inviteStatusElsewhere',
    },
    join: {
        defaultMessage: 'Join the group',
        description: 'Button to join the group that calls the student',
        id: 'gui.connection.meshV2Seat.inviteJoin',
    },
    skip: {
        defaultMessage: 'Connect another way without joining',
        description: 'Button to go to the first mesh screen without joining the calling group',
        id: 'gui.connection.meshV2Seat.inviteSkip',
    },
});

const STATUS_MARK = {
    [SEAT_STATUS.ME]: '→',
    [SEAT_STATUS.JOINED]: '✓',
    [SEAT_STATUS.WAITING]: '…',
    [SEAT_STATUS.ABSENT]: '—',
    [SEAT_STATUS.ELSEWHERE]: '⚠',
};

const statusMessage = (entry) => {
    if (entry.status === SEAT_STATUS.ME) return messages.me;
    if (entry.status === SEAT_STATUS.JOINED) return entry.host ? messages.host : messages.joined;
    if (entry.status === SEAT_STATUS.ABSENT) return messages.absent;
    if (entry.status === SEAT_STATUS.ELSEWHERE) return messages.elsewhere;
    return messages.waiting;
};

const MeshV2SeatInviteStep = ({ hostSeat, mySeat, statuses, onJoin, onSkip }) => (
    <Box className={styles.body} data-testid="meshV2-seat-invite">
        <div className={styles.title}>
            <FormattedMessage {...messages.title} values={{ host: hostSeat }} />
        </div>
        <div className={styles.sub}>
            <FormattedMessage {...messages.description} values={{ seat: mySeat }} />
        </div>
        <div className={styles.inviteGroup}>
            <FormattedMessage
                {...messages.group}
                values={{ seats: statuses.map((entry) => entry.seat).join(SEAT_SEPARATOR) }}
            />
        </div>
        <div className={styles.memberList}>
            {statuses.map((entry) => (
                <div
                    key={entry.seat}
                    className={classNames(styles.member, styles[`member-${entry.status}`], {
                        [styles.memberInvited]: entry.status === SEAT_STATUS.ME,
                    })}
                    data-status={entry.status}
                    data-testid={`meshV2-seat-invite-status-${entry.seat}`}
                >
                    <span className={styles.memberMark}>{entry.host ? '★' : STATUS_MARK[entry.status]}</span>
                    <span className={styles.memberSeat}>{entry.seat}</span>
                    <span>
                        <FormattedMessage {...statusMessage(entry)} />
                    </span>
                </div>
            ))}
        </div>
        <button
            className={classNames(styles.primary, styles.inviteJoin)}
            data-testid="meshV2-seat-invite-join"
            onClick={onJoin}
        >
            <FormattedMessage {...messages.join} />
        </button>
        <div className={styles.inviteSkipRow}>
            <button className={styles.inviteSkip} data-testid="meshV2-seat-invite-skip" onClick={onSkip}>
                <FormattedMessage {...messages.skip} />
            </button>
        </div>
    </Box>
);

MeshV2SeatInviteStep.propTypes = {
    hostSeat: PropTypes.number.isRequired,
    mySeat: PropTypes.number.isRequired,
    onJoin: PropTypes.func.isRequired,
    onSkip: PropTypes.func.isRequired,
    statuses: PropTypes.arrayOf(
        PropTypes.shape({
            seat: PropTypes.number,
            status: PropTypes.string,
            host: PropTypes.bool,
        }),
    ).isRequired,
};

export default MeshV2SeatInviteStep;
