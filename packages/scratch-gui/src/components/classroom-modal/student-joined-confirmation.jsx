import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import { formatStudentClassName } from '../../lib/classroom-class-label.js';
import styles from './classroom-modal.css';
import ErrorDisplay from './error-display.jsx';
import StudentContinueChoice from './student-continue-choice.jsx';
import StudentPreviousComment from './student-previous-comment.jsx';

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

/**
 * 「はじめる」 of a lesson assignment: opens the lessons library with the
 * assignment's challenges only (#1599).
 * @param {object} props - component props
 * @param {Function} props.onStartLesson - opens the lessons library
 * @returns {React.ReactElement} the button row
 */
const StartLessonButton = ({ onStartLesson }) => (
    <div className={styles.buttonRow}>
        <button className={styles.primaryButton} data-testid="classroom-joined-start-lesson" onClick={onStartLesson}>
            <FormattedMessage
                defaultMessage="Start"
                description="Close button after joining"
                id="gui.classroom.studentJoined.start"
            />
        </button>
    </div>
);

StartLessonButton.propTypes = {
    onStartLesson: PropTypes.func.isRequired,
};

export { LessonNextSteps, StartLessonButton };

const StudentJoinedConfirmation = ({
    continueOptions,
    error,
    errorTitle,
    isLoading,
    joinedInfo,
    lessonStartOnly = false,
    loadedChoice,
    startChoice,
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
        {/* Where to start: the starter and earlier submissions (#1201). Nothing
            is loaded until the student presses one. */}
        {/* A lesson assignment without a starter starts in the lessons library (#1599). */}
        {!lessonStartOnly && (
            <StudentContinueChoice
                continueOptions={continueOptions}
                isLoading={isLoading}
                loadedChoice={loadedChoice}
                recommend={startChoice?.recommend}
                showStarter={!!startChoice?.showStarter}
                startNotice={startChoice?.notice}
                onKeepCurrent={onClose}
                onLoadStarter={onLoadStarter}
                onLoadSubmission={onLoadSubmission}
            />
        )}
        <ErrorDisplay error={error} errorTitle={errorTitle} />
        {studentLesson && onStartLesson && <StartLessonButton onStartLesson={onStartLesson} />}
        {/* With choices, each choice starts (incl. "as it is"), so no separate Start button. */}
        {!studentLesson && !continueOptions && !startChoice?.showStarter && (
            <div className={styles.buttonRow}>
                <button className={styles.primaryButton} data-testid="classroom-joined-close" onClick={onClose}>
                    <FormattedMessage
                        defaultMessage="Start"
                        description="Close button after joining"
                        id="gui.classroom.studentJoined.start"
                    />
                </button>
            </div>
        )}
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
    // A lesson assignment without a starter: no start choices (#1599)
    lessonStartOnly: PropTypes.bool,
    loadedChoice: PropTypes.string,
    // normalized lesson setting of the joined assignment (null = not a lesson assignment)
    studentLesson: PropTypes.shape({ submitWork: PropTypes.bool }),
    startChoice: PropTypes.shape({
        showStarter: PropTypes.bool,
        recommend: PropTypes.string,
        notice: PropTypes.string,
    }),
    onClose: PropTypes.func.isRequired,
    onLoadStarter: PropTypes.func,
    onLoadSubmission: PropTypes.func,
    onStartLesson: PropTypes.func,
};

export default StudentJoinedConfirmation;
