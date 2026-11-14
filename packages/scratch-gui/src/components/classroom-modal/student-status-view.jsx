import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { formatStudentClassName } from '../../lib/classroom-class-label.js';
import { canSubmitAssignment } from '../../lib/lessons/assignment-progress.js';
import {
    AssignmentDoneCount,
    AssignmentDots,
    AssignmentRemaining,
    UnknownChallengesNote,
    messages as bandMessages,
} from '../lesson-assignment-band/lesson-assignment-band.jsx';
import styles from './classroom-modal.css';
import ErrorDisplay from './error-display.jsx';
import StudentContinueChoice from './student-continue-choice.jsx';
import StudentPeerViewButton from './student-peer-view-button.jsx';

const RefreshButton = ({ isLoading, onRefreshStudentStatus }) => (
    <button
        className={styles.refreshButton}
        data-testid="classroom-student-refresh"
        disabled={isLoading}
        onClick={onRefreshStudentStatus}
    >
        {'↻'}
    </button>
);

RefreshButton.propTypes = {
    isLoading: PropTypes.bool,
    onRefreshStudentStatus: PropTypes.func.isRequired,
};

/**
 * 「進み具合」 row of a lesson assignment (#1599): circles (★ = required),
 * "4 / 6 done" and "2 more to clear" / "✓ Assignment cleared".
 * @param {object} props - component props
 * @param {object} props.lessonStatus - assignmentProgress() result
 * @param {React.ReactNode} props.children - trailing element (the refresh button)
 * @returns {React.ReactElement} the row
 */
const LessonProgressRow = ({ lessonStatus, children }) => (
    <div className={styles.statusRow} data-testid="classroom-status-lesson-progress">
        <span className={styles.statusLabel}>
            <FormattedMessage
                defaultMessage="Progress"
                description="Lesson progress label on the student status view of a lesson assignment"
                id="gui.classroom.studentStatus.lessonProgress"
            />
        </span>
        <span className={`${styles.statusValue} ${styles.lessonProgressValue}`}>
            <AssignmentDots challenges={lessonStatus.challenges} />
            <AssignmentDoneCount status={lessonStatus} />
            {/* With challenges this build does not know, "n more" can mislead: ask
                for a reload in its place (one line, so 1300x600 still fits). */}
            {lessonStatus.unknownCount > 0 && !lessonStatus.cleared ? (
                <UnknownChallengesNote testId="classroom-status-lesson-unknown" />
            ) : (
                <AssignmentRemaining status={lessonStatus} />
            )}
        </span>
        {children}
    </div>
);

LessonProgressRow.propTypes = {
    children: PropTypes.node,
    lessonStatus: PropTypes.object.isRequired,
};

const ContinueLessonButton = ({ className, isLoading, onStartLesson }) => (
    <button
        className={className}
        data-testid="classroom-continue-lesson-button"
        disabled={isLoading}
        onClick={onStartLesson}
    >
        <FormattedMessage
            defaultMessage="Continue the lesson"
            description="Opens the lessons library with the lesson assignment's challenges (student status view)"
            id="gui.classroom.studentStatus.continueLesson"
        />
    </button>
);

ContinueLessonButton.propTypes = {
    className: PropTypes.string,
    isLoading: PropTypes.bool,
    onStartLesson: PropTypes.func,
};

const StudentStatusView = ({
    classroomState,
    continueOptions,
    hasAssignment,
    lessonStatus = null,
    loadedChoice,
    studentLesson = null,
    teacherComment,
    isLoading,
    error,
    errorTitle,
    errorActionLabel,
    errorActionHandler,
    onOpenAssignment,
    onRefreshStudentStatus,
    onLeaveClassroom,
    onLoadSubmission,
    onStartLesson,
    onStartSubmit,
}) => {
    const intl = useIntl();
    const lesson = lessonStatus && studentLesson ? studentLesson : null;
    // Lesson assignment: the submission row and the submit button are only
    // for one that also asks for a work submission; the button appears once
    // the goal is met (#1599).
    const showSubmissionRow = !lesson || lesson.submitWork;
    // Also when the lesson has challenges this build does not know yet: the
    // goal cannot be met here, and the student must still be able to submit.
    const lessonSubmitReady = !!lesson && canSubmitAssignment(lesson, lessonStatus);
    const showSubmitButton = !lesson || lessonSubmitReady;
    return (
        <div data-testid="classroom-phase-student-status">
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Your Assignment"
                    description="Student status title"
                    id="gui.classroom.studentStatus.title"
                />
            </div>
            <div className={styles.statusCard}>
                <div className={styles.statusRow}>
                    <span className={styles.statusLabel}>
                        <FormattedMessage
                            defaultMessage="Class"
                            description="Class name label"
                            id="gui.classroom.studentStatus.class"
                        />
                    </span>
                    <span className={styles.statusValue} data-testid="classroom-status-class-name">
                        {formatStudentClassName(classroomState.className, classroomState.classYear)}
                    </span>
                </div>
                <div className={styles.statusRow}>
                    <span className={styles.statusLabel}>
                        <FormattedMessage
                            defaultMessage="Seat Number"
                            description="Seat number label"
                            id="gui.classroom.studentStatus.seatNumber"
                        />
                    </span>
                    <span className={styles.statusValue} data-testid="classroom-status-seat-number">
                        {String(classroomState.seatNumber).padStart(2, '0')}
                    </span>
                </div>
                {classroomState.assignmentName && (
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>
                            <FormattedMessage
                                defaultMessage="Assignment"
                                description="Assignment name label"
                                id="gui.classroom.studentStatus.assignment"
                            />
                        </span>
                        <span className={styles.statusValue} data-testid="classroom-status-assignment">
                            {classroomState.assignmentName}
                        </span>
                    </div>
                )}
                {classroomState.joinedAt && (
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>
                            <FormattedMessage
                                defaultMessage="Joined"
                                description="Joined at label"
                                id="gui.classroom.studentStatus.joinedAt"
                            />
                        </span>
                        <span className={styles.statusValue} data-testid="classroom-status-joined-at">
                            {new Date(classroomState.joinedAt).toLocaleString([], {
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    </div>
                )}
                {lesson && (
                    <LessonProgressRow lessonStatus={lessonStatus}>
                        {showSubmissionRow ? null : (
                            <RefreshButton isLoading={isLoading} onRefreshStudentStatus={onRefreshStudentStatus} />
                        )}
                    </LessonProgressRow>
                )}
                {showSubmissionRow && (
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>
                            <FormattedMessage
                                defaultMessage="Submission Status"
                                description="Submission status label"
                                id="gui.classroom.studentStatus.submissionStatus"
                            />
                        </span>
                        <span className={styles.statusValue} data-testid="classroom-submit-status">
                            {classroomState.submissionStatus === 'returned' ? (
                                <React.Fragment>
                                    {'↩ '}
                                    <FormattedMessage
                                        defaultMessage="Returned"
                                        description="Returned status"
                                        id="gui.classroom.studentStatus.returned"
                                    />
                                    {classroomState.lastSubmittedAt && (
                                        <span>{` (${new Date(classroomState.lastSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}</span>
                                    )}
                                </React.Fragment>
                            ) : classroomState.submissionStatus === 'submitted' ? (
                                <React.Fragment>
                                    {'✓ '}
                                    <FormattedMessage
                                        defaultMessage="Submitted"
                                        description="Submitted status"
                                        id="gui.classroom.studentStatus.submitted"
                                    />
                                    {classroomState.lastSubmittedAt && (
                                        <span>{` (${new Date(classroomState.lastSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}</span>
                                    )}
                                </React.Fragment>
                            ) : (
                                <FormattedMessage
                                    defaultMessage="Not submitted"
                                    description="Not submitted status"
                                    id="gui.classroom.studentStatus.notSubmitted"
                                />
                            )}
                        </span>
                        <RefreshButton isLoading={isLoading} onRefreshStudentStatus={onRefreshStudentStatus} />
                    </div>
                )}
                {classroomState.submissionStatus === 'returned' && teacherComment && (
                    <div className={styles.teacherCommentBox} data-testid="classroom-status-teacher-comment">
                        <span className={styles.statusLabel}>
                            <FormattedMessage
                                defaultMessage="Teacher's Comment"
                                description="Teacher comment label"
                                id="gui.classroom.studentStatus.teacherComment"
                            />
                        </span>
                        <span className={styles.teacherCommentText}>{teacherComment}</span>
                    </div>
                )}
            </div>
            {/* Like the usual "submit when ready" hint: only until the first submission. */}
            {lessonSubmitReady && !classroomState.submissionStatus && (
                <div className={styles.formFieldHint} data-testid="classroom-status-lesson-submit-guide">
                    {intl.formatMessage(bandMessages.submitGuide)}
                </div>
            )}
            {/* Load a submitted project later on (#1201); the starter lives in "View Assignment". */}
            <StudentContinueChoice
                continueOptions={continueOptions}
                isLoading={isLoading}
                loadedChoice={loadedChoice}
                onLoadSubmission={onLoadSubmission}
            />
            <div className={styles.statusFooter}>
                <button
                    className={styles.secondaryButton}
                    data-testid="classroom-leave"
                    disabled={isLoading}
                    onClick={onLeaveClassroom}
                >
                    <FormattedMessage
                        defaultMessage="Leave Classroom"
                        description="Leave classroom button"
                        id="gui.classroom.studentStatus.leave"
                    />
                </button>
                {hasAssignment && onOpenAssignment && (
                    <button
                        className={styles.secondaryButton}
                        data-testid="classroom-view-assignment-button"
                        disabled={isLoading}
                        onClick={onOpenAssignment}
                    >
                        <FormattedMessage
                            defaultMessage="View Assignment"
                            description="Open the assignment panel from the student status view"
                            id="gui.classroom.studentAssignment.viewButton"
                        />
                    </button>
                )}
                <StudentPeerViewButton disabled={isLoading} />
                {lesson && (
                    <ContinueLessonButton
                        className={lessonSubmitReady ? styles.secondaryButton : styles.primaryButton}
                        isLoading={isLoading}
                        onStartLesson={onStartLesson}
                    />
                )}
                {showSubmitButton && (
                    <button
                        className={styles.primaryButton}
                        data-testid="classroom-submit-button"
                        disabled={isLoading}
                        onClick={onStartSubmit}
                    >
                        {classroomState.submissionStatus ? (
                            <FormattedMessage
                                defaultMessage="Resubmit Assignment"
                                description="Resubmit button"
                                id="gui.classroom.studentStatus.resubmit"
                            />
                        ) : (
                            <FormattedMessage
                                defaultMessage="Submit Assignment"
                                description="Submit button"
                                id="gui.classroom.studentStatus.submit"
                            />
                        )}
                    </button>
                )}
            </div>
            <ErrorDisplay
                actionLabel={errorActionLabel}
                error={error}
                errorTitle={errorTitle}
                onAction={errorActionHandler}
            />
        </div>
    );
};

StudentStatusView.propTypes = {
    classroomState: PropTypes.object.isRequired,
    continueOptions: PropTypes.object,
    error: PropTypes.string,
    errorActionHandler: PropTypes.func,
    errorActionLabel: PropTypes.string,
    errorTitle: PropTypes.string,
    hasAssignment: PropTypes.bool,
    isLoading: PropTypes.bool,
    // assignmentProgress() of the joined lesson assignment (null when not a lesson assignment)
    lessonStatus: PropTypes.object,
    loadedChoice: PropTypes.string,
    // normalized lesson setting of the joined assignment
    studentLesson: PropTypes.shape({ submitWork: PropTypes.bool }),
    onLeaveClassroom: PropTypes.func.isRequired,
    onLoadSubmission: PropTypes.func,
    onOpenAssignment: PropTypes.func,
    onRefreshStudentStatus: PropTypes.func.isRequired,
    onStartLesson: PropTypes.func,
    onStartSubmit: PropTypes.func.isRequired,
    teacherComment: PropTypes.string,
};

export default StudentStatusView;
