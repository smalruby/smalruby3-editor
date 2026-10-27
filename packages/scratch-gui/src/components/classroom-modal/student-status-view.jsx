import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';

import ErrorDisplay from './error-display.jsx';
import StudentContinueChoice from './student-continue-choice.jsx';
import StudentPeerViewButton from './student-peer-view-button.jsx';

import { formatStudentClassName } from '../../lib/classroom-class-label.js';
import styles from './classroom-modal.css';

const StudentStatusView = ({
    classroomState,
    continueOptions,
    hasAssignment,
    loadedChoice,
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
    onStartSubmit,
}) => (
    <div data-testid="classroom-phase-student-status">
        <div className={styles.phaseTitle}>
            <FormattedMessage
                defaultMessage="Your Classroom"
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
                <span
                    className={styles.statusValue}
                    data-testid="classroom-status-class-name"
                >
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
                <span
                    className={styles.statusValue}
                    data-testid="classroom-status-seat-number"
                >
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
                    <span
                        className={styles.statusValue}
                        data-testid="classroom-status-assignment"
                    >
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
                    <span
                        className={styles.statusValue}
                        data-testid="classroom-status-joined-at"
                    >
                        {new Date(classroomState.joinedAt).toLocaleString(
                            [],
                            {
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            },
                        )}
                    </span>
                </div>
            )}
            <div className={styles.statusRow}>
                <span className={styles.statusLabel}>
                    <FormattedMessage
                        defaultMessage="Submission Status"
                        description="Submission status label"
                        id="gui.classroom.studentStatus.submissionStatus"
                    />
                </span>
                <span
                    className={styles.statusValue}
                    data-testid="classroom-submit-status"
                >
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
                <button
                    className={styles.refreshButton}
                    data-testid="classroom-student-refresh"
                    disabled={isLoading}
                    onClick={onRefreshStudentStatus}
                >
                    {'↻'}
                </button>
            </div>
            {classroomState.submissionStatus === 'returned' && teacherComment && (
                <div
                    className={styles.teacherCommentBox}
                    data-testid="classroom-status-teacher-comment"
                >
                    <span className={styles.statusLabel}>
                        <FormattedMessage
                            defaultMessage="Teacher's Comment"
                            description="Teacher comment label"
                            id="gui.classroom.studentStatus.teacherComment"
                        />
                    </span>
                    <span className={styles.teacherCommentText}>
                        {teacherComment}
                    </span>
                </div>
            )}
        </div>
        {!classroomState.submissionStatus && (
            <div className={styles.formFieldHint}>
                <FormattedMessage
                    defaultMessage="Click 'Submit Assignment' when your project is ready."
                    description="Hint for students who haven't submitted yet"
                    id="gui.classroom.studentStatus.submitHint"
                />
            </div>
        )}
        {/* Load a submitted project later on (#1201); the starter lives in "View Assignment". */}
        <StudentContinueChoice
            continueOptions={continueOptions}
            isLoading={isLoading}
            loadedChoice={loadedChoice}
            titleKind="load"
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
        </div>
        <ErrorDisplay
            actionLabel={errorActionLabel}
            error={error}
            errorTitle={errorTitle}
            onAction={errorActionHandler}
        />
    </div>
);

StudentStatusView.propTypes = {
    classroomState: PropTypes.object.isRequired,
    continueOptions: PropTypes.object,
    error: PropTypes.string,
    errorActionHandler: PropTypes.func,
    errorActionLabel: PropTypes.string,
    errorTitle: PropTypes.string,
    hasAssignment: PropTypes.bool,
    isLoading: PropTypes.bool,
    loadedChoice: PropTypes.string,
    onLeaveClassroom: PropTypes.func.isRequired,
    onLoadSubmission: PropTypes.func,
    onOpenAssignment: PropTypes.func,
    onRefreshStudentStatus: PropTypes.func.isRequired,
    onStartSubmit: PropTypes.func.isRequired,
    teacherComment: PropTypes.string,
};

export default StudentStatusView;
