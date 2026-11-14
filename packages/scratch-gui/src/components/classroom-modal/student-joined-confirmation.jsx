import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import { formatStudentClassName } from '../../lib/classroom-class-label.js';
import styles from './classroom-modal.css';
import ErrorDisplay from './error-display.jsx';
import StudentPreviousComment from './student-previous-comment.jsx';
import StudentStartMethod from './student-start-method.jsx';

/**
 * The one-line notice of a lesson assignment (#1599): tell right after joining
 * that it is a lesson assignment and when to submit, so students do not ask
 * "where is the submit button?".
 * @param {object} props - component props
 * @param {object} props.lesson - normalized lesson setting
 * @returns {React.ReactElement} the text
 */
const LessonNextSteps = ({ lesson }) =>
    lesson.submitWork ? (
        <FormattedMessage
            defaultMessage="This is a lesson assignment. Go through the lessons; once you meet the goal, make your own program and submit it."
            description="Next steps after joining a lesson assignment that also asks for a work submission"
            id="gui.classroom.studentJoined.lessonNextSteps"
        />
    ) : (
        <FormattedMessage
            defaultMessage="This is a lesson assignment. Go through the lessons; once you meet the goal, the assignment is cleared."
            description="Next steps after joining a lesson assignment (no work submission)"
            id="gui.classroom.studentJoined.lessonNextStepsNoSubmit"
        />
    );

LessonNextSteps.propTypes = {
    lesson: PropTypes.shape({ submitWork: PropTypes.bool }).isRequired,
};

export { LessonNextSteps };

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
}) => (
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
            student is (#1792). A lesson assignment keeps its one-line notice of
            when to submit (#1599). */}
        {studentLesson && (
            <div className={styles.joinHintText} data-testid="classroom-joined-lesson-notice">
                <LessonNextSteps lesson={studentLesson} />
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
        />
    </div>
);

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
    studentLesson: PropTypes.shape({ submitWork: PropTypes.bool }),
    // decideStartMethod の結果 (#1793)
    startMethod: PropTypes.shape({
        main: PropTypes.string.isRequired,
        others: PropTypes.arrayOf(PropTypes.string),
    }).isRequired,
    onClose: PropTypes.func.isRequired,
    onLoadStarter: PropTypes.func,
    onLoadSubmission: PropTypes.func,
    onStartLesson: PropTypes.func,
};

export default StudentJoinedConfirmation;
