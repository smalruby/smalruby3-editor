import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';

import styles from './classroom-modal.css';

const StudentJoinedConfirmation = ({ joinedInfo, onClose }) => (
    <div data-testid="classroom-phase-student-joined">
        <div className={styles.successArea}>
            <div
                className={styles.successDetails}
                data-testid="classroom-joined-details"
            >
                <span data-testid="classroom-joined-class-name">
                    {joinedInfo.className}
                </span>
                {' / '}
                <span data-testid="classroom-joined-seat-number">
                    <FormattedMessage
                        defaultMessage="Seat {seatNumber}"
                        description="Seat number display"
                        id="gui.classroom.studentJoined.seat"
                        values={{
                            seatNumber: String(joinedInfo.seatNumber).padStart(2, '0'),
                        }}
                    />
                </span>
            </div>
            {joinedInfo.assignmentName && (
                <div
                    className={styles.successAssignment}
                    data-testid="classroom-joined-assignment"
                >
                    {joinedInfo.assignmentName}
                </div>
            )}
        </div>
        <div className={styles.buttonRow}>
            <button
                className={styles.primaryButton}
                data-testid="classroom-joined-close"
                onClick={onClose}
            >
                <FormattedMessage
                    defaultMessage="Start"
                    description="Close button after joining"
                    id="gui.classroom.studentJoined.start"
                />
            </button>
        </div>
    </div>
);

StudentJoinedConfirmation.propTypes = {
    joinedInfo: PropTypes.shape({
        assignmentName: PropTypes.string,
        className: PropTypes.string,
        seatNumber: PropTypes.number,
    }).isRequired,
    onClose: PropTypes.func.isRequired,
};

export default StudentJoinedConfirmation;
