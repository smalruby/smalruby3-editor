// "出席番号でつながる" screen 1: the entry at the top of the first mesh screen,
// shown only to a student in a class. Offers the teacher's group first when the
// assignment has no group limit and the teacher hosts one. The class and its
// groups are read by the first screen (MeshV2InitialStep).
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { findTeacherGroup } from '../../lib/mesh-v2-seat-connect.js';
import styles from './mesh-v2-seat-connect.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Connect by seat number',
        description: 'Button on the first mesh screen to connect by classroom seat numbers',
        id: 'gui.connection.meshV2Seat.entryTitle',
    },
    description: {
        defaultMessage: 'Just choose the numbers of the people to connect with',
        description: 'Description of the connect by seat number button',
        id: 'gui.connection.meshV2Seat.entryDescription',
    },
    teacherTitle: {
        defaultMessage: "Join the teacher's group",
        description: "Button on the first mesh screen to join the teacher's group",
        id: 'gui.connection.meshV2Seat.teacherTitle',
    },
    teacherDescription: {
        defaultMessage: 'Connect with the whole class',
        description: "Description of the join the teacher's group button",
        id: 'gui.connection.meshV2Seat.teacherDescription',
    },
    classNote: {
        defaultMessage: 'In the class "{className}" (seat No. {seat})',
        description: 'Which class and seat the student is connecting as',
        id: 'gui.connection.meshV2Seat.classNote',
    },
});

const MeshV2SeatEntry = ({ classSeats, classroomName, groups, seat, onJoinGroup, onSeatConnect }) => {
    const teacherGroup = classSeats && groups ? findTeacherGroup(groups, classSeats.groupLimit) : null;
    const handleJoinTeacher = React.useCallback(() => {
        if (teacherGroup) onJoinGroup(teacherGroup.id);
    }, [teacherGroup, onJoinGroup]);
    return (
        <div className={styles.entryArea}>
            {/* Side by side when both are shown, so the first screen still fits in 600px. */}
            <div className={styles.entryRow}>
                {teacherGroup && (
                    <button
                        className={styles.entry}
                        data-testid="meshV2-seat-join-teacher"
                        onClick={handleJoinTeacher}
                    >
                        <span className={styles.entryIcon}>★</span>
                        <span className={styles.entryTitle}>
                            <FormattedMessage {...messages.teacherTitle} />
                        </span>
                        <span className={styles.entryDescription}>
                            <FormattedMessage {...messages.teacherDescription} />
                        </span>
                    </button>
                )}
                <button className={styles.entry} data-testid="meshV2-seat-connect-entry" onClick={onSeatConnect}>
                    <span className={styles.entryIcon}>#</span>
                    <span className={styles.entryTitle}>
                        <FormattedMessage {...messages.title} />
                    </span>
                    <span className={styles.entryDescription}>
                        <FormattedMessage {...messages.description} />
                    </span>
                </button>
            </div>
            <div className={styles.classNote} data-testid="meshV2-seat-class-note">
                <FormattedMessage {...messages.classNote} values={{ className: classroomName || '', seat }} />
            </div>
        </div>
    );
};

MeshV2SeatEntry.propTypes = {
    classSeats: PropTypes.shape({
        groupLimit: PropTypes.number,
    }),
    classroomName: PropTypes.string,
    groups: PropTypes.arrayOf(PropTypes.object),
    onJoinGroup: PropTypes.func.isRequired,
    onSeatConnect: PropTypes.func.isRequired,
    seat: PropTypes.number.isRequired,
};

export default MeshV2SeatEntry;
