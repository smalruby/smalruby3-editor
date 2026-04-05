import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';

import ErrorDisplay from './error-display.jsx';
import GoogleCourseList from './google-course-list.jsx';
import StudentJoinForm from './student-join-form.jsx';
import TeacherClassDetail from './teacher-class-detail.jsx';
import TeacherCreateForm from './teacher-create-form.jsx';
import TeacherPostAssignment from './teacher-post-assignment.jsx';

import styles from './classroom-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Classroom',
        description: 'Title for the classroom modal',
        id: 'gui.classroom.title',
    },
});

const ClassroomModal = ({
    phase,
    classrooms,
    selectedClassroom,
    members,
    seatCount,
    takenSeats,
    selectedSeat,
    joinedInfo,
    error,
    errorTitle,
    isLoading,
    onSelectTeacher,
    onSelectStudent,
    onTeacherLogin,
    onShowCreateForm,
    onCreateClassroom,
    onSelectClassroom,
    onBackToDashboard,
    onBackToRoleSelect,
    onJoinWithCode,
    onSelectSeat,
    onConfirmJoin,
    onClose,
    onDeleteClassroom,
    onDeleteMember,
    onLeaveClassroom,
    onOpenSubmission,
    onRefreshDetail,
    onReturnSubmission,
    onDownloadAll,
    downloadProgress,
    onStartSubmit,
    onConfirmSubmit,
    onCancelSubmit,
    submitProgress,
    teacherComment,
    onRefreshStudentStatus,
    thumbnailDataUrl,
    onTeacherLogout,
    classroomState,
    selectedMember,
    onSelectMember,
    onShowCodeDisplay,
    onCopyInviteLink,
    codeDisplayClassroom,
    codeDisplayFullscreen,
    onToggleCodeFullscreen,
    onCloseCodeDisplay,
    googleCourses,
    selectedGoogleCourse,
    onGoogleClassroomImport,
    onSelectGoogleCourse,
    onConfirmGoogleImport,
    onPostAssignment,
    onShowPostAssignment,
}) => {
    const intl = useIntl();

    const handleSelectClassroom = useCallback(
        (e) => {
            onSelectClassroom(e.currentTarget.dataset.classroomId);
        },
        [onSelectClassroom],
    );

    const handleDeleteMember = useCallback(
        (e) => {
            onDeleteMember(e.currentTarget.dataset.memberId);
        },
        [onDeleteMember],
    );

    const handleSelectSeat = useCallback(
        (e) => {
            onSelectSeat(parseInt(e.currentTarget.dataset.seat, 10));
        },
        [onSelectSeat],
    );

    // Student mode: regular modal
    return (
        <Modal
            className={
                phase === 'teacher-class-detail' || phase === 'teacher-code-display'
                    ? styles.modalContentWide
                    : styles.modalContent
            }
            contentLabel={intl.formatMessage(messages.title)}
            id="classroomModal"
            onRequestClose={onClose}
        >
            <Box className={styles.body} data-testid="classroom-modal">
                {/* Phase: role-select */}
                {phase === 'role-select' && (
                    <div data-testid="classroom-phase-role-select">
                        <div className={styles.phaseTitle}>
                            <FormattedMessage
                                defaultMessage="How do you use the classroom?"
                                description="Prompt for selecting teacher or student role"
                                id="gui.classroom.roleSelect.prompt"
                            />
                        </div>
                        <div className={styles.roleButtons}>
                            <button
                                className={styles.roleButton}
                                data-testid="classroom-role-teacher"
                                onClick={onSelectTeacher}
                            >
                                <FormattedMessage
                                    defaultMessage="Teacher"
                                    description="Button for teacher role"
                                    id="gui.classroom.roleSelect.teacher"
                                />
                            </button>
                            <button
                                className={styles.roleButton}
                                data-testid="classroom-role-student"
                                onClick={onSelectStudent}
                            >
                                <FormattedMessage
                                    defaultMessage="Student"
                                    description="Button for student role"
                                    id="gui.classroom.roleSelect.student"
                                />
                            </button>
                        </div>
                        <ErrorDisplay error={error} errorTitle={errorTitle} />
                    </div>
                )}

                {/* Phase: teacher-login */}
                {phase === 'teacher-login' && (
                    <div data-testid="classroom-phase-teacher-login">
                        <button
                            className={styles.backLink}
                            data-testid="classroom-back"
                            onClick={onBackToDashboard}
                        >
                            {'<'}{' '}
                            <FormattedMessage
                                defaultMessage="Back"
                                description="Back button"
                                id="gui.classroom.back"
                            />
                        </button>
                        <div className={styles.phaseTitle}>
                            <FormattedMessage
                                defaultMessage="Sign in with Google"
                                description="Prompt for teacher Google sign in"
                                id="gui.classroom.teacherLogin.prompt"
                            />
                        </div>
                        <div className={styles.description}>
                            <FormattedMessage
                                defaultMessage="Sign in with your Google account to manage classrooms."
                                description="Teacher login description"
                                id="gui.classroom.teacherLogin.description"
                            />
                        </div>
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-google-login"
                                onClick={onTeacherLogin}
                            >
                                <FormattedMessage
                                    defaultMessage="Sign in with Google"
                                    description="Google sign in button"
                                    id="gui.classroom.teacherLogin.button"
                                />
                            </button>
                        </div>
                        <ErrorDisplay error={error} errorTitle={errorTitle} />
                    </div>
                )}

                {/* Phase: teacher-dashboard */}
                {phase === 'teacher-dashboard' && (
                    <div
                        className={styles.dashboardLayout}
                        data-testid="classroom-phase-teacher-dashboard"
                    >
                        <div className={styles.dashboardHeader}>
                            <div className={styles.phaseTitle} style={{ marginBottom: 0 }}>
                                <FormattedMessage
                                    defaultMessage="Your Classrooms"
                                    description="Teacher dashboard title"
                                    id="gui.classroom.teacherDashboard.title"
                                />
                            </div>
                        </div>
                        <div className={styles.dashboardBody}>
                            {isLoading && (
                                <div className={styles.loading} data-testid="classroom-loading">
                                    <FormattedMessage
                                        defaultMessage="Loading..."
                                        description="Loading indicator"
                                        id="gui.classroom.loading"
                                    />
                                </div>
                            )}
                            {!isLoading && classrooms.length === 0 && (
                                <div
                                    className={styles.description}
                                    data-testid="classroom-empty-message"
                                >
                                    <FormattedMessage
                                        defaultMessage="No classrooms yet. Create one to get started!"
                                        description="Empty classrooms message"
                                        id="gui.classroom.teacherDashboard.empty"
                                    />
                                </div>
                            )}
                            {!isLoading && classrooms.length > 0 && (
                                <ul className={styles.classList} data-testid="classroom-list">
                                    {classrooms.map(c => (
                                        <li
                                            className={styles.classItem}
                                            data-testid={`classroom-item-${c.classroomId}`}
                                            key={c.classroomId}
                                        >
                                            <div className={styles.classItemMain}>
                                                <span
                                                    className={styles.classItemName}
                                                    data-testid={`classroom-item-name-${c.classroomId}`}
                                                >
                                                    {c.className}
                                                </span>
                                                <span
                                                    className={styles.classItemCode}
                                                    data-testid={`classroom-item-code-${c.classroomId}`}
                                                >
                                                    {c.joinCode.toLowerCase()}
                                                </span>
                                            </div>
                                            <div className={styles.classItemMeta}>
                                                <span className={styles.classItemMetaText}>
                                                    {c.studentCount}
                                                    <FormattedMessage
                                                        defaultMessage=" students"
                                                        description="Student count suffix in class list"
                                                        id="gui.classroom.teacherDashboard.studentCountSuffix"
                                                    />
                                                </span>
                                                {c.createdAt && (
                                                    <span className={styles.classItemMetaText}>
                                                        {new Date(c.createdAt).toLocaleDateString()}
                                                    </span>
                                                )}
                                                {c.expiresAt && (
                                                    <span className={styles.classItemMetaText}>
                                                        <FormattedMessage
                                                            defaultMessage="Expires: {date}"
                                                            description="Expiry date in class list"
                                                            id="gui.classroom.teacherDashboard.expiresAt"
                                                            values={{ date: new Date(c.expiresAt).toLocaleDateString() }}
                                                        />
                                                    </span>
                                                )}
                                                <span style={{ flex: 1 }} />
                                                <button
                                                    className={styles.secondaryButton}
                                                    data-classroom-id={c.classroomId}
                                                    data-testid={`classroom-item-details-${c.classroomId}`}
                                                    onClick={handleSelectClassroom}
                                                >
                                                    <FormattedMessage
                                                        defaultMessage="Details"
                                                        description="View classroom details button"
                                                        id="gui.classroom.teacherDashboard.details"
                                                    />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className={styles.dashboardFooter}>
                            <ErrorDisplay error={error} errorTitle={errorTitle} />
                            <div className={styles.buttonRow}>
                                <button
                                    className={styles.secondaryButton}
                                    data-testid="classroom-teacher-logout"
                                    onClick={onTeacherLogout}
                                >
                                    <FormattedMessage
                                        defaultMessage="Logout"
                                        description="Teacher logout button"
                                        id="gui.classroom.teacherDashboard.logout"
                                    />
                                </button>
                                <button
                                    className={styles.primaryButton}
                                    data-testid="classroom-create"
                                    onClick={onShowCreateForm}
                                >
                                    <FormattedMessage
                                        defaultMessage="Create Classroom"
                                        description="Create new classroom button"
                                        id="gui.classroom.teacherDashboard.create"
                                    />
                                </button>
                                <button
                                    className={styles.secondaryButton}
                                    data-testid="classroom-google-import"
                                    onClick={onGoogleClassroomImport}
                                >
                                    <FormattedMessage
                                        defaultMessage="Import from Google Classroom"
                                        description="Import classroom from Google Classroom"
                                        id="gui.classroom.googleImport"
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Phase: teacher-google-courses */}
                {phase === 'teacher-google-courses' && (
                    <div
                        className={styles.phaseContainer}
                        data-testid="classroom-phase-teacher-google-courses"
                    >
                        <button
                            className={styles.backButton}
                            data-testid="classroom-back"
                            onClick={onBackToDashboard}
                        >
                            {'< '}
                            <FormattedMessage
                                defaultMessage="Back"
                                description="Back button"
                                id="gui.classroom.back"
                            />
                        </button>
                        <div className={styles.phaseTitle}>
                            <FormattedMessage
                                defaultMessage="Google Classroom Courses"
                                description="Google Classroom courses list title"
                                id="gui.classroom.googleCourses.title"
                            />
                        </div>
                        {isLoading && (
                            <div
                                className={styles.loading}
                                data-testid="classroom-loading"
                            >
                                {'...'}
                            </div>
                        )}
                        <ErrorDisplay error={error} errorTitle={errorTitle} />
                        {googleCourses.length === 0 && !isLoading ? (
                            <div className={styles.emptyMessage}>
                                <FormattedMessage
                                    defaultMessage="No courses found"
                                    description="No Google Classroom courses"
                                    id="gui.classroom.googleCourses.empty"
                                />
                            </div>
                        ) : (
                            <GoogleCourseList
                                courses={googleCourses}
                                selectedCourseId={selectedGoogleCourse?.courseId}
                                onSelect={onSelectGoogleCourse}
                            />
                        )}
                        <div className={styles.footerButtons}>
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-google-import-confirm"
                                disabled={!selectedGoogleCourse || isLoading}
                                onClick={onConfirmGoogleImport}
                            >
                                <FormattedMessage
                                    defaultMessage="Import"
                                    description="Import Google Classroom course"
                                    id="gui.classroom.googleCourses.import"
                                />
                            </button>
                        </div>
                    </div>
                )}

                {/* Phase: teacher-post-assignment */}
                {phase === 'teacher-post-assignment' && (
                    <TeacherPostAssignment
                        error={error}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        selectedClassroom={selectedClassroom}
                        onBack={onBackToDashboard}
                        onPostAssignment={onPostAssignment}
                    />
                )}

                {/* Phase: teacher-create */}
                {phase === 'teacher-create' && (
                    <TeacherCreateForm
                        error={error}
                        errorTitle={errorTitle}
                        importSource={selectedGoogleCourse}
                        isLoading={isLoading}
                        onBack={onBackToDashboard}
                        onCreate={onCreateClassroom}
                    />
                )}

                {/* Phase: teacher-class-detail */}
                {phase === 'teacher-class-detail' && selectedClassroom && (
                    <TeacherClassDetail
                        codeDisplayClassroom={codeDisplayClassroom}
                        codeDisplayFullscreen={codeDisplayFullscreen}
                        error={error}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        members={members}
                        selectedClassroom={selectedClassroom}
                        selectedMember={selectedMember}
                        onBack={onBackToDashboard}
                        onCloseCodeDisplay={onCloseCodeDisplay}
                        onCopyInviteLink={onCopyInviteLink}
                        onDeleteClassroom={onDeleteClassroom}
                        onDeleteMember={handleDeleteMember}
                        onOpenSubmission={onOpenSubmission}
                        onRefresh={onRefreshDetail}
                        onReturnSubmission={onReturnSubmission}
                        onDownloadAll={onDownloadAll}
                        downloadProgress={downloadProgress}
                        onSelectMember={onSelectMember}
                        onShowCodeDisplay={onShowCodeDisplay}
                        onShowPostAssignment={onShowPostAssignment}
                        onToggleCodeFullscreen={onToggleCodeFullscreen}
                    />
                )}

                {/* Phase: student-join */}
                {phase === 'student-join' && (
                    <StudentJoinForm
                        error={error}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        onBack={onBackToRoleSelect}
                        onJoin={onJoinWithCode}
                    />
                )}

                {/* Phase: student-seat */}
                {phase === 'student-seat' && (
                    <div data-testid="classroom-phase-student-seat">
                        <div className={styles.phaseTitle}>
                            <FormattedMessage
                                defaultMessage="Select your seat number"
                                description="Seat selection prompt"
                                id="gui.classroom.studentSeat.prompt"
                            />
                        </div>
                        <div className={styles.seatGrid} data-testid="classroom-seat-grid">
                            {Array.from({ length: seatCount }, (_, i) => i + 1).map(n => {
                                const isTaken = takenSeats.includes(n);
                                const isSelected = selectedSeat === n;
                                return (
                                    <button
                                        className={`${styles.seatButton} ${isTaken ? styles.seatTaken : ''} ${isSelected ? styles.seatSelected : ''}`}
                                        data-seat={n}
                                        data-testid={`classroom-seat-${n}`}
                                        disabled={isTaken}
                                        key={n}
                                        onClick={handleSelectSeat}
                                    >
                                        {n}
                                    </button>
                                );
                            })}
                        </div>
                        <div
                            data-testid="classroom-selected-seat"
                            style={{ display: 'none' }}
                        >
                            {selectedSeat}
                        </div>
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-confirm-seat"
                                disabled={!selectedSeat || isLoading}
                                onClick={onConfirmJoin}
                            >
                                <FormattedMessage
                                    defaultMessage="Join"
                                    description="Confirm join button"
                                    id="gui.classroom.studentSeat.join"
                                />
                            </button>
                        </div>
                        <ErrorDisplay error={error} errorTitle={errorTitle} />
                    </div>
                )}

                {/* Phase: student-joined */}
                {phase === 'student-joined' && joinedInfo && (
                    <div data-testid="classroom-phase-student-joined">
                        <div className={styles.successArea}>
                            <div
                                className={styles.successText}
                                data-testid="classroom-joined-success"
                            >
                                <FormattedMessage
                                    defaultMessage="Joined successfully!"
                                    description="Success message after joining classroom"
                                    id="gui.classroom.studentJoined.success"
                                />
                            </div>
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
                                        values={{ seatNumber: joinedInfo.seatNumber }}
                                    />
                                </span>
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
                )}

                {/* Phase: student-status (already joined) */}
                {phase === 'student-status' && classroomState && (
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
                                    {classroomState.className}
                                </span>
                            </div>
                            <div className={styles.statusRow}>
                                <span className={styles.statusLabel}>
                                    <FormattedMessage
                                        defaultMessage="Seat"
                                        description="Seat number label"
                                        id="gui.classroom.studentStatus.seat"
                                    />
                                </span>
                                <span
                                    className={styles.statusValue}
                                    data-testid="classroom-status-seat-number"
                                >
                                    {classroomState.seatNumber}
                                </span>
                            </div>
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
                                        {new Date(classroomState.joinedAt).toLocaleString()}
                                    </span>
                                </div>
                            )}
                            <div className={styles.statusRow}>
                                <span className={styles.statusLabel}>
                                    <FormattedMessage
                                        defaultMessage="Submission"
                                        description="Submission status label"
                                        id="gui.classroom.studentStatus.submission"
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
                                                <span>{` (${new Date(classroomState.lastSubmittedAt).toLocaleTimeString()})`}</span>
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
                                                <span>{` (${new Date(classroomState.lastSubmittedAt).toLocaleTimeString()})`}</span>
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
                                            defaultMessage="Comment"
                                            description="Teacher comment label"
                                            id="gui.classroom.studentStatus.comment"
                                        />
                                    </span>
                                    <span className={styles.teacherCommentText}>
                                        {teacherComment}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-submit-button"
                                disabled={isLoading}
                                onClick={onStartSubmit}
                            >
                                {classroomState.submissionStatus ? (
                                    <FormattedMessage
                                        defaultMessage="Resubmit"
                                        description="Resubmit button"
                                        id="gui.classroom.studentStatus.resubmit"
                                    />
                                ) : (
                                    <FormattedMessage
                                        defaultMessage="Submit"
                                        description="Submit button"
                                        id="gui.classroom.studentStatus.submit"
                                    />
                                )}
                            </button>
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
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-status-close"
                                onClick={onClose}
                            >
                                <FormattedMessage
                                    defaultMessage="Close"
                                    description="Close button"
                                    id="gui.classroom.studentStatus.close"
                                />
                            </button>
                        </div>
                        <ErrorDisplay error={error} errorTitle={errorTitle} />
                    </div>
                )}

                {/* Phase: student-submit-confirm */}
                {phase === 'student-submit-confirm' && (
                    <div data-testid="classroom-phase-submit-confirm">
                        <div className={styles.phaseTitle}>
                            <FormattedMessage
                                defaultMessage="Submit your project"
                                description="Submit confirmation title"
                                id="gui.classroom.submitConfirm.title"
                            />
                        </div>
                        {thumbnailDataUrl && (
                            <div className={styles.thumbnailPreview}>
                                <img
                                    alt="Project thumbnail"
                                    className={styles.thumbnailImage}
                                    data-testid="classroom-submit-preview"
                                    src={thumbnailDataUrl}
                                />
                            </div>
                        )}
                        <div className={styles.description}>
                            <FormattedMessage
                                defaultMessage="Are you sure you want to submit your current project?"
                                description="Submit confirmation message"
                                id="gui.classroom.submitConfirm.message"
                            />
                        </div>
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.secondaryButton}
                                data-testid="classroom-submit-cancel"
                                onClick={onCancelSubmit}
                            >
                                <FormattedMessage
                                    defaultMessage="Cancel"
                                    description="Cancel submit button"
                                    id="gui.classroom.submitConfirm.cancel"
                                />
                            </button>
                            <button
                                className={styles.primaryButton}
                                data-testid="classroom-submit-confirm"
                                disabled={isLoading}
                                onClick={onConfirmSubmit}
                            >
                                {isLoading && submitProgress ? (
                                    `${submitProgress.label} (${submitProgress.current}/${submitProgress.total})`
                                ) : isLoading ? (
                                    <FormattedMessage
                                        defaultMessage="Submitting..."
                                        description="Submitting progress"
                                        id="gui.classroom.submitConfirm.submitting"
                                    />
                                ) : (
                                    <FormattedMessage
                                        defaultMessage="Submit"
                                        description="Confirm submit button"
                                        id="gui.classroom.submitConfirm.submit"
                                    />
                                )}
                            </button>
                        </div>
                        <ErrorDisplay error={error} errorTitle={errorTitle} />
                    </div>
                )}
            </Box>
        </Modal>
    );
};

ClassroomModal.propTypes = {
    classrooms: PropTypes.arrayOf(PropTypes.object),
    classroomState: PropTypes.object,
    codeDisplayClassroom: PropTypes.object,
    codeDisplayFullscreen: PropTypes.bool,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    joinedInfo: PropTypes.shape({
        className: PropTypes.string,
        seatNumber: PropTypes.number,
    }),
    members: PropTypes.arrayOf(PropTypes.object),
    onBackToDashboard: PropTypes.func.isRequired,
    onBackToRoleSelect: PropTypes.func.isRequired,
    onCancelSubmit: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onCloseCodeDisplay: PropTypes.func.isRequired,
    onConfirmJoin: PropTypes.func.isRequired,
    onConfirmSubmit: PropTypes.func.isRequired,
    onCopyInviteLink: PropTypes.func.isRequired,
    onCreateClassroom: PropTypes.func.isRequired,
    onDeleteClassroom: PropTypes.func.isRequired,
    onDeleteMember: PropTypes.func.isRequired,
    onDownloadAll: PropTypes.func.isRequired,
    downloadProgress: PropTypes.shape({
        current: PropTypes.number,
        total: PropTypes.number,
    }),
    onJoinWithCode: PropTypes.func.isRequired,
    onLeaveClassroom: PropTypes.func.isRequired,
    onOpenSubmission: PropTypes.func.isRequired,
    onRefreshDetail: PropTypes.func.isRequired,
    onRefreshStudentStatus: PropTypes.func.isRequired,
    onReturnSubmission: PropTypes.func.isRequired,
    onSelectClassroom: PropTypes.func.isRequired,
    onSelectMember: PropTypes.func.isRequired,
    onSelectSeat: PropTypes.func.isRequired,
    onSelectStudent: PropTypes.func.isRequired,
    onSelectTeacher: PropTypes.func.isRequired,
    onShowCodeDisplay: PropTypes.func.isRequired,
    onShowCreateForm: PropTypes.func.isRequired,
    onShowPostAssignment: PropTypes.func,
    onStartSubmit: PropTypes.func.isRequired,
    onTeacherLogin: PropTypes.func.isRequired,
    onTeacherLogout: PropTypes.func.isRequired,
    onToggleCodeFullscreen: PropTypes.func.isRequired,
    googleCourses: PropTypes.arrayOf(
        PropTypes.shape({
            courseId: PropTypes.string,
            name: PropTypes.string,
            section: PropTypes.string,
            studentCount: PropTypes.number,
        }),
    ),
    selectedGoogleCourse: PropTypes.shape({
        courseId: PropTypes.string,
        name: PropTypes.string,
    }),
    onGoogleClassroomImport: PropTypes.func,
    onSelectGoogleCourse: PropTypes.func,
    onConfirmGoogleImport: PropTypes.func,
    onPostAssignment: PropTypes.func,
    phase: PropTypes.string.isRequired,
    seatCount: PropTypes.number,
    selectedClassroom: PropTypes.object,
    selectedMember: PropTypes.string,
    selectedSeat: PropTypes.number,
    takenSeats: PropTypes.arrayOf(PropTypes.number),
    submitProgress: PropTypes.shape({
        current: PropTypes.number,
        total: PropTypes.number,
        label: PropTypes.string,
    }),
    teacherComment: PropTypes.string,
    thumbnailDataUrl: PropTypes.string,
};

ClassroomModal.defaultProps = {
    classrooms: [],
    codeDisplayClassroom: null,
    codeDisplayFullscreen: false,
    error: null,
    errorTitle: null,
    isLoading: false,
    joinedInfo: null,
    members: [],
    seatCount: 0,
    selectedClassroom: null,
    selectedMember: null,
    selectedSeat: null,
    takenSeats: [],
};

export default ClassroomModal;
