import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import { formatStudentClassName } from '../../lib/classroom-class-label.js';
import { READ_WAIT_GOAL_CHARS, readWaitSeconds } from '../../lib/classroom-read-wait.js';
import styles from './classroom-modal.css';
import ErrorDisplay from './error-display.jsx';
import StudentAssignmentGoal from './student-assignment-goal.jsx';
import StudentPreviousComment from './student-previous-comment.jsx';
import StudentStartMethod from './student-start-method.jsx';
import useReadCountdown from './use-read-countdown.js';

const StudentJoinedConfirmation = ({
    continueOptions,
    error,
    errorTitle,
    isLoading,
    joinedInfo,
    startMethod,
    studentLesson = null,
    onClose,
    onLoadStarter,
    onLoadSubmission,
    onStartLesson,
    onTrack,
}) => {
    // A lesson assignment without pages starts here, so the goal card is read before 「はじめる」 like the
    // assignment panel's last page (「よく読もう… 3」). Other assignments have nothing to read here.
    const readWait = studentLesson ? readWaitSeconds({ textLength: READ_WAIT_GOAL_CHARS }) : 0;
    const waitLeft = useReadCountdown(readWait, readWait > 0);
    return (
        <div data-testid="classroom-phase-student-joined">
            <div className={styles.successArea}>
                <div className={styles.successDetails} data-testid="classroom-joined-details">
                    <span data-testid="classroom-joined-class-name">
                        {formatStudentClassName(joinedInfo.className, joinedInfo.classYear)}
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
                    <div className={styles.successAssignment} data-testid="classroom-joined-assignment">
                        {joinedInfo.assignmentName}
                    </div>
                )}
            </div>
            {/* No "what to do next" text: the step band at the top tells where the
            student is (#1792). A lesson assignment shows its goal card: how many
            challenges to clear and when to submit (#1599). */}
            {studentLesson && (
                <div data-testid="classroom-joined-lesson-notice">
                    <StudentAssignmentGoal dataTestId="classroom-joined-goal" lesson={studentLesson} />
                </div>
            )}
            <StudentPreviousComment previousComment={joinedInfo.previousComment} />
            <ErrorDisplay error={error} errorTitle={errorTitle} />
            {/* One main button: the way to start decided by decideStartMethod (#1793).
            The other ways sit under 「ほかの始め方」. Nothing is loaded until the
            student presses one. A lesson assignment starts in the lessons library. */}
            <StudentStartMethod
                continueOptions={continueOptions}
                isLoading={isLoading}
                method={startMethod}
                onKeepCurrent={onClose}
                onLoadStarter={onLoadStarter}
                onLoadSubmission={onLoadSubmission}
                onStartLesson={onStartLesson}
                onTrack={onTrack}
                waitSeconds={waitLeft}
            />
        </div>
    );
};

StudentJoinedConfirmation.propTypes = {
    continueOptions: PropTypes.object,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    joinedInfo: PropTypes.shape({
        assignmentName: PropTypes.string,
        className: PropTypes.string,
        classYear: PropTypes.number,
        seatNumber: PropTypes.number,
        previousComment: PropTypes.object,
    }).isRequired,
    // normalized lesson setting of the joined assignment (null = not a lesson assignment)
    studentLesson: PropTypes.shape({
        challengeIds: PropTypes.arrayOf(PropTypes.string),
        submitWork: PropTypes.bool,
    }),
    // decideStartMethod の結果 (#1793)
    startMethod: PropTypes.shape({
        main: PropTypes.string.isRequired,
        others: PropTypes.arrayOf(PropTypes.string),
    }).isRequired,
    onClose: PropTypes.func.isRequired,
    onLoadStarter: PropTypes.func,
    onLoadSubmission: PropTypes.func,
    onStartLesson: PropTypes.func,
    // sends a classroom_student GA event (#1831)
    onTrack: PropTypes.func,
};

export default StudentJoinedConfirmation;
