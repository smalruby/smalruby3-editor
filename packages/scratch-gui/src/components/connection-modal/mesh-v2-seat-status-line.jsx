// "出席番号でつながる" screen 5: one line on the connected screen showing who is
// in the group ("3 ✓ 7 ✓ 12 … 20 欠席"). Renders nothing for a group without seat info.
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { SEAT_STATUS, describeSeatStatuses, groupSeats } from '../../lib/mesh-v2-seat-connect.js';
import { getMeshV2Extension, useSeatSnapshot } from '../../lib/mesh-v2-seat-snapshot.js';
import styles from './mesh-v2-seat-connect.css';

const POLL_MS = 5000;

const messages = defineMessages({
    label: {
        defaultMessage: 'Who is here',
        description: 'Label of the seat progress line on the connected mesh screen',
        id: 'gui.connection.meshV2Seat.progress',
    },
    absent: {
        defaultMessage: 'absent',
        description: 'Short label of an absent seat in the progress line',
        id: 'gui.connection.meshV2Seat.progressAbsent',
    },
});

const MARK = {
    [SEAT_STATUS.ME]: '✓',
    [SEAT_STATUS.JOINED]: '✓',
    [SEAT_STATUS.WAITING]: '…',
    [SEAT_STATUS.ELSEWHERE]: '⚠',
};

const MeshV2SeatStatusLine = ({ joinCode, mySeat, vm }) => {
    const { classSeats, groups } = useSeatSnapshot({ vm, joinCode, intervalMs: POLL_MS });
    const ext = getMeshV2Extension(vm);
    const groupId = ext && typeof ext.getConnectedGroupId === 'function' ? ext.getConnectedGroupId() : null;
    const group = (groups || []).find((g) => g.id === groupId);
    const seats = group ? groupSeats(group) : [];
    if (!classSeats || seats.length === 0) return null;
    const statuses = describeSeatStatuses({
        groups,
        groupId,
        chosenSeats: seats,
        presentSeats: classSeats.presentSeats,
        mySeat,
    });
    return (
        <div className={styles.progress} data-testid="meshV2-seat-progress">
            <FormattedMessage {...messages.label} />
            {statuses.map((entry) => (
                <span
                    key={entry.seat}
                    className={classNames(styles.tag, styles[`tag-${entry.status}`])}
                    data-status={entry.status}
                >
                    {entry.seat}{' '}
                    {entry.status === SEAT_STATUS.ABSENT ? (
                        <FormattedMessage {...messages.absent} />
                    ) : (
                        MARK[entry.status]
                    )}
                </span>
            ))}
        </div>
    );
};

MeshV2SeatStatusLine.propTypes = {
    joinCode: PropTypes.string,
    mySeat: PropTypes.number.isRequired,
    vm: PropTypes.object.isRequired,
};

export default MeshV2SeatStatusLine;
