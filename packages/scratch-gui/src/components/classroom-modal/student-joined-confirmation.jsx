import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';

import StudentPreviousComment from './student-previous-comment.jsx';

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
        <StudentPreviousComment previousComment={joinedInfo.previousComment} />
        <div className={styles.joinHintBox}>
            <div className={styles.joinHintTitle}>
                <FormattedMessage
                    defaultMessage="What to do next"
                    description="Next steps hint title after joining"
                    id="gui.classroom.studentJoined.nextStepsTitle"
                />
            </div>
            <div className={styles.joinHintText}>
                <FormattedMessage
                    defaultMessage="1. Close this dialog and create your project{br}2. When you're done, click the assignment name in the menu bar to submit"
                    description="Next steps hint after joining"
                    id="gui.classroom.studentJoined.nextSteps"
                    values={{ br: <br /> }}
                />
            </div>
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
        previousComment: PropTypes.object,
    }).isRequired,
    onClose: PropTypes.func.isRequired,
};

export default StudentJoinedConfirmation;
