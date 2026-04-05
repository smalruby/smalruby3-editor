import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';

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

    return (
        <Modal
            className={
                phase === 'teacher-class-detail' ||
                phase === 'teacher-code-display'
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

// Class code display (normal + fullscreen)
const ClassCodeDisplay = ({
    classroom,
    isFullscreen,
    onClose,
    onCopyInviteLink,
    onToggleFullscreen,
}) => {
    const code = classroom.joinCode.toLowerCase();
    const [copied, setCopied] = useState(false);
    const handleCopy = useCallback(() => {
        onCopyInviteLink(classroom);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [classroom, onCopyInviteLink]);

    if (isFullscreen) {
        return ReactDOM.createPortal(
            <div className={styles.codeFullscreenOverlay}>
                <span className={styles.codeFullscreenTitle}>
                    <FormattedMessage
                        defaultMessage="Class Code"
                        description="Title for class code display"
                        id="gui.classroom.codeDisplay.title"
                    />
                </span>
                <button
                    className={styles.codeFullscreenClose}
                    data-testid="classroom-code-display-close"
                    onClick={onClose}
                >
                    {'✕'}
                </button>
                <div className={styles.codeFullscreenCode}>{code}</div>
                <div className={styles.codeFullscreenFooter}>
                    <div className={styles.codeDisplayInfo}>
                        <span>{classroom.className}</span>
                        <span>
                            {classroom.studentCount}
                            <FormattedMessage
                                defaultMessage=" students"
                                description="Student count suffix in class list"
                                id="gui.classroom.teacherDashboard.studentCountSuffix"
                            />
                        </span>
                        {classroom.createdAt && (
                            <span>
                                {new Date(
                                    classroom.createdAt,
                                ).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                    <div className={styles.codeDisplayActions}>
                        <button
                            className={styles.copyLinkButton}
                            data-testid="classroom-code-display-copy-link"
                            onClick={handleCopy}
                        >
                            <svg
                                fill="none"
                                height="16"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                width="16"
                            >
                                <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            {' '}
                            {copied ? (
                                <FormattedMessage
                                    defaultMessage="Copied"
                                    description="Confirmation after copying invite link"
                                    id="gui.classroom.codeDisplay.copied"
                                />
                            ) : (
                                <FormattedMessage
                                    defaultMessage="Copy invite link"
                                    description="Button to copy classroom invite link"
                                    id="gui.classroom.codeDisplay.copyLink"
                                />
                            )}
                        </button>
                        <button
                            className={styles.expandIconButton}
                            data-testid="classroom-code-display-shrink"
                            onClick={onToggleFullscreen}
                        >
                            <svg
                                fill="none"
                                height="16"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                width="16"
                            >
                                <path d="M4 14h6v6" />
                                <path d="M20 10h-6V4" />
                                <path d="M14 10l7-7" />
                                <path d="M3 21l7-7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>,
            document.body,
        );
    }

    return (
        <div
            className={styles.codeDisplay}
            data-testid="classroom-phase-teacher-code-display"
        >
            <button
                className={styles.backLink}
                onClick={onClose}
            >
                {'<'}{' '}
                <FormattedMessage
                    defaultMessage="Back"
                    description="Back button"
                    id="gui.classroom.back"
                />
            </button>
            <div className={styles.codeDisplayTitle}>
                <FormattedMessage
                    defaultMessage="Class Code"
                    description="Title for class code display"
                    id="gui.classroom.codeDisplay.title"
                />
            </div>
            <div className={styles.codeDisplayCode}>{code}</div>
            <div className={styles.codeDisplayFooter}>
                <div className={styles.codeDisplayInfo}>
                    <span>{classroom.className}</span>
                    <span>
                        {classroom.studentCount}
                        <FormattedMessage
                            defaultMessage=" students"
                            description="Student count suffix in class list"
                            id="gui.classroom.teacherDashboard.studentCountSuffix"
                        />
                    </span>
                    {classroom.createdAt && (
                        <span>
                            {new Date(
                                classroom.createdAt,
                            ).toLocaleDateString()}
                        </span>
                    )}
                </div>
                <div className={styles.codeDisplayActions}>
                    <button
                        className={styles.copyLinkButton}
                        data-testid="classroom-code-display-copy-link"
                        onClick={handleCopy}
                    >
                        <svg
                            fill="none"
                            height="16"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            width="16"
                        >
                            <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        {' '}
                        {copied ? (
                            <FormattedMessage
                                defaultMessage="Copied"
                                description="Confirmation after copying invite link"
                                id="gui.classroom.codeDisplay.copied"
                            />
                        ) : (
                            <FormattedMessage
                                defaultMessage="Copy invite link"
                                description="Button to copy classroom invite link"
                                id="gui.classroom.codeDisplay.copyLink"
                            />
                        )}
                    </button>
                    <button
                        className={styles.expandIconButton}
                        data-testid="classroom-code-display-expand"
                        onClick={onToggleFullscreen}
                    >
                        {'⛶'}
                    </button>
                </div>
            </div>
        </div>
    );
};

ClassCodeDisplay.propTypes = {
    classroom: PropTypes.object.isRequired,
    isFullscreen: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onCopyInviteLink: PropTypes.func.isRequired,
    onToggleFullscreen: PropTypes.func.isRequired,
};

// Reusable error display component
const ErrorDisplay = ({ error, errorTitle }) => {
    if (!error) return null;
    if (errorTitle) {
        return (
            <div className={styles.errorBox} data-testid="classroom-error">
                <div className={styles.errorBoxTitle}>{errorTitle}</div>
                <div className={styles.errorBoxMessage}>{error}</div>
            </div>
        );
    }
    return (
        <div className={styles.errorText} data-testid="classroom-error">
            {error}
        </div>
    );
};

ErrorDisplay.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
};

// Teacher class detail with two-pane layout
const TeacherClassDetail = ({
    selectedClassroom,
    members,
    selectedMember,
    isLoading,
    error,
    errorTitle,
    onBack,
    onSelectMember,
    onDeleteMember,
    onDeleteClassroom,
    onOpenSubmission,
    onRefresh,
    onReturnSubmission,
    onDownloadAll,
    downloadProgress,
    onShowCodeDisplay,
    onCloseCodeDisplay,
    onCopyInviteLink,
    onToggleCodeFullscreen,
    onShowPostAssignment,
    codeDisplayClassroom,
    codeDisplayFullscreen,
}) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCodeDisplay, setShowCodeDisplay] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [commentText, setCommentText] = useState('');

    // Reset image index and comment when selected member changes
    useEffect(() => {
        setCurrentImageIndex(0);
        if (selectedMember) {
            const memberMap2 = {};
            for (const m of members) memberMap2[m.memberId] = m;
            const member = memberMap2[selectedMember];
            setCommentText(member?.teacherComment || '');
        } else {
            setCommentText('');
        }
    }, [selectedMember, members]);

    const memberMap = React.useMemo(() => {
        const map = {};
        for (const m of members) {
            map[m.memberId] = m;
        }
        return map;
    }, [members]);

    const handleCellClick = useCallback((e) => {
        const memberId = e.currentTarget.dataset.memberId;
        if (memberId && memberMap[memberId]) {
            onSelectMember(memberId === selectedMember ? null : memberId);
        }
    }, [memberMap, selectedMember, onSelectMember]);

    const handleDeleteClick = useCallback(() => {
        setShowDeleteConfirm(true);
    }, []);

    const handleDeleteConfirm = useCallback(() => {
        setShowDeleteConfirm(false);
        onDeleteClassroom(selectedClassroom.classroomId);
    }, [onDeleteClassroom, selectedClassroom]);

    const handleDeleteCancel = useCallback(() => {
        setShowDeleteConfirm(false);
    }, []);

    const handleOpenClick = useCallback(
        (e) => {
            const projectUrl = e.currentTarget.dataset.projectUrl;
            if (projectUrl) {
                onOpenSubmission(projectUrl);
            }
        },
        [onOpenSubmission],
    );

    const handleReturnClick = useCallback(() => {
        if (!selectedMember || !memberMap[selectedMember]?.submissionId) return;
        onReturnSubmission(memberMap[selectedMember].submissionId, commentText);
    }, [selectedMember, memberMap, commentText, onReturnSubmission]);

    const handleCommentChange = useCallback(e => {
        setCommentText(e.target.value);
    }, []);

    const handlePrevImage = useCallback(() => {
        setCurrentImageIndex(prev => Math.max(0, prev - 1));
    }, []);

    const handleNextImage = useCallback(() => {
        setCurrentImageIndex(prev => {
            const member = memberMap[selectedMember];
            if (!member) return prev;
            const allImages = [member.thumbnailUrl, ...(member.screenshotUrls || [])].filter(Boolean);
            return Math.min(allImages.length - 1, prev + 1);
        });
    }, [memberMap, selectedMember]);

    const handleShowCode = useCallback(() => {
        setShowCodeDisplay(true);
        onShowCodeDisplay(selectedClassroom.classroomId);
    }, [onShowCodeDisplay, selectedClassroom]);

    const handleCloseCode = useCallback(() => {
        setShowCodeDisplay(false);
        onCloseCodeDisplay();
    }, [onCloseCodeDisplay]);

    const isSeated = useCallback(member => {
        if (!member || !member.lastActiveAt) return false;
        const elapsed = Date.now() - new Date(member.lastActiveAt).getTime();
        return elapsed < 60 * 60 * 1000; // 1 hour
    }, []);

    const joinedCount = members.filter(m => !m.left).length;
    const totalCount = selectedClassroom.studentCount;

    // Pre-compute selected member's derived data for the right pane
    const selectedMemberData = React.useMemo(() => {
        if (!selectedMember || !memberMap[selectedMember]) return null;
        const member = memberMap[selectedMember];
        return {
            ...member,
            allImages: [member.thumbnailUrl, ...(member.screenshotUrls || [])].filter(Boolean),
            isReturned: member.submissionStatus === 'returned',
            isSeated: isSeated(member),
        };
    }, [selectedMember, memberMap, isSeated]);

    return (
        <div className={styles.detailLayout} data-testid="classroom-phase-teacher-detail">
            {showCodeDisplay ? (
                codeDisplayFullscreen ? (
                    <ClassCodeDisplay
                        classroom={codeDisplayClassroom || selectedClassroom}
                        isFullscreen
                        onClose={handleCloseCode}
                        onCopyInviteLink={onCopyInviteLink}
                        onToggleFullscreen={onToggleCodeFullscreen}
                    />
                ) : (
                    <div>
                        <ClassCodeDisplay
                            classroom={codeDisplayClassroom || selectedClassroom}
                            onClose={handleCloseCode}
                            onCopyInviteLink={onCopyInviteLink}
                            onToggleFullscreen={onToggleCodeFullscreen}
                        />
                    </div>
                )
            ) : (
                <React.Fragment>
                    <button
                        className={styles.backLink}
                        data-testid="classroom-back"
                        onClick={onBack}
                    >
                        {'<'}{' '}
                        <FormattedMessage
                            defaultMessage="Back"
                            description="Back button"
                            id="gui.classroom.back"
                        />
                    </button>
                    <div className={styles.detailTwoPaneLayout}>
                        {/* Left pane */}
                        <div className={styles.detailLeftPane}>
                            <div
                                className={styles.phaseTitle}
                                data-testid="classroom-detail-name"
                            >
                                {selectedClassroom.className}
                            </div>

                            {/* Join code with expand button */}
                            <div className={styles.joinCodeDisplay}>
                                <span className={styles.joinCodeLabel}>
                                    <FormattedMessage
                                        defaultMessage="Join Code"
                                        description="Join code label"
                                        id="gui.classroom.joinCode.label"
                                    />{': '}
                                </span>
                                <span
                                    className={styles.joinCodeValue}
                                    data-testid="classroom-detail-join-code"
                                >
                                    {selectedClassroom.joinCode.toLowerCase()}
                                </span>
                                <button
                                    className={styles.expandIconButton}
                                    data-testid="classroom-detail-expand-code"
                                    onClick={handleShowCode}
                                >
                                    {'⛶'}
                                </button>
                            </div>
                            {selectedClassroom.expiresAt && (
                                <div className={styles.expiresAtText}>
                                    <FormattedMessage
                                        defaultMessage="Expires: {date}"
                                        description="Expiry date in class detail"
                                        id="gui.classroom.teacherDetail.expiresAt"
                                        values={{ date: new Date(selectedClassroom.expiresAt).toLocaleDateString() }}
                                    />
                                </div>
                            )}

                            {/* Members header + grid */}
                            <div className={styles.membersHeader}>
                                <div className={styles.phaseTitle} style={{ marginBottom: 0 }}>
                                    <FormattedMessage
                                        defaultMessage="Members"
                                        description="Members list title"
                                        id="gui.classroom.members.title"
                                    />
                                </div>
                                <div className={styles.membersHeaderRight}>
                                    <span
                                        className={styles.membersCount}
                                        data-testid="classroom-members-count"
                                    >
                                        {joinedCount} / {totalCount}
                                    </span>
                                    <button
                                        className={styles.refreshButton}
                                        data-testid="classroom-refresh"
                                        disabled={isLoading}
                                        onClick={onRefresh}
                                    >
                                        {'↻'}
                                    </button>
                                </div>
                            </div>
                            <div
                                className={styles.membersGrid}
                                data-testid="classroom-members-grid"
                            >
                                    {Array.from({ length: totalCount }, (_, i) => {
                                        const seatNum = i + 1;
                                        const memberId = `seat-${String(seatNum).padStart(2, '0')}`;
                                        const member = memberMap[memberId];
                                        const isSelected = selectedMember === memberId;
                                        const hasSubmission = member && member.hasSubmission;
                                        const isReturned = member && member.submissionStatus === 'returned';
                                        let cellColorClass = styles.memberCellEmpty;
                                        if (member) {
                                            if (isReturned) {
                                                cellColorClass = styles.memberCellReturned;
                                            } else if (hasSubmission) {
                                                cellColorClass = styles.memberCellSubmitted;
                                            } else {
                                                cellColorClass = styles.memberCellJoined;
                                            }
                                        }
                                        const seated = isSeated(member);
                                        const cellClass = `${styles.memberCell} ${cellColorClass} ${isSelected ? styles.memberCellSelected : ''}`;
                                        let cellLabel = seatNum;
                                        if (isReturned) cellLabel = `↩${seatNum}`;
                                        else if (hasSubmission) cellLabel = `✓${seatNum}`;
                                        return (
                                            <button
                                                className={cellClass}
                                                data-member-id={memberId}
                                                data-testid={`classroom-member-${memberId}`}
                                                key={memberId}
                                                onClick={member ? handleCellClick : null}
                                            >
                                                {seated ? (
                                                    <span className={styles.seatedLabel}>{cellLabel}</span>
                                                ) : cellLabel}
                                            </button>
                                        );
                                    })}
                                </div>

                            {/* Delete classroom */}
                            <div className={styles.detailFooter}>
                                <ErrorDisplay error={error} errorTitle={errorTitle} />
                                {showDeleteConfirm ? (
                                    <div className={styles.deleteConfirmBox}>
                                        <div className={styles.deleteConfirmMessage}>
                                            <FormattedMessage
                                                defaultMessage="Are you sure you want to delete this classroom? All members will be removed."
                                                description="Delete classroom confirmation message"
                                                id="gui.classroom.teacherDetail.deleteConfirm"
                                            />
                                        </div>
                                        <div className={styles.buttonRow}>
                                            <button
                                                className={styles.secondaryButton}
                                                data-testid="classroom-delete-cancel"
                                                onClick={handleDeleteCancel}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Cancel"
                                                    description="Cancel delete classroom button"
                                                    id="gui.classroom.teacherDetail.cancelDelete"
                                                />
                                            </button>
                                            <button
                                                className={styles.dangerButton}
                                                data-testid="classroom-delete-confirm"
                                                onClick={handleDeleteConfirm}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Delete"
                                                    description="Confirm delete classroom button"
                                                    id="gui.classroom.teacherDetail.delete"
                                                />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.detailFooterButtons}>
                                        <button
                                            className={styles.dangerButton}
                                            data-testid="classroom-delete-classroom"
                                            disabled={isLoading}
                                            onClick={handleDeleteClick}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Delete Classroom"
                                                description="Delete classroom button"
                                                id="gui.classroom.teacherDetail.deleteClassroom"
                                            />
                                        </button>
                                        <button
                                            className={styles.secondaryButton}
                                            data-testid="classroom-download-all"
                                            disabled={isLoading || !!downloadProgress}
                                            onClick={onDownloadAll}
                                        >
                                            {downloadProgress ? (
                                                `${downloadProgress.current}/${downloadProgress.total}`
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Download All"
                                                    description="Download all submissions button"
                                                    id="gui.classroom.teacherDetail.downloadAll"
                                                />
                                            )}
                                        </button>
                                        {selectedClassroom.googleClassroomCourseId && (
                                            <button
                                                className={styles.secondaryButton}
                                                data-testid="classroom-post-assignment"
                                                onClick={onShowPostAssignment}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Post Assignment"
                                                    description="Post assignment to Google Classroom"
                                                    id="gui.classroom.postAssignment.title"
                                                />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right pane - member detail */}
                        <div className={styles.detailRightPane}>
                            {selectedMemberData ? (
                                <div
                                    className={styles.memberDetailPanel}
                                    data-testid="classroom-member-detail"
                                >
                                    <div className={styles.memberDetailHeader}>
                                        <span
                                            className={styles.memberDetailSeat}
                                            data-testid="classroom-member-detail-seat"
                                        >
                                            <FormattedMessage
                                                defaultMessage="Seat {number}"
                                                description="Seat number display in member detail"
                                                id="gui.classroom.teacherDetail.seatNumber"
                                                values={{ number: selectedMember.replace('seat-', '') }}
                                            />
                                        </span>
                                        <span data-testid="classroom-member-detail-name">
                                            {selectedMemberData.displayName || '-'}
                                        </span>
                                        {selectedMemberData.hasSubmission && (
                                            <span
                                                className={selectedMemberData.isReturned ? styles.returnedBadge : styles.submissionBadge}
                                                data-testid="classroom-member-detail-submitted"
                                            >
                                                {selectedMemberData.isReturned ? '↩ ' : '✓ '}
                                                {new Date(selectedMemberData.submittedAt).toLocaleTimeString()}
                                            </span>
                                        )}
                                        <span
                                            className={selectedMemberData.isSeated ? styles.seatedBadge : styles.notSeatedBadge}
                                            data-testid="classroom-member-detail-seated"
                                        >
                                            {selectedMemberData.isSeated ? (
                                                <FormattedMessage
                                                    defaultMessage="Seated"
                                                    description="Student is currently seated"
                                                    id="gui.classroom.teacherDetail.seated"
                                                />
                                            ) : (
                                                <FormattedMessage
                                                    defaultMessage="Not seated"
                                                    description="Student is not currently seated"
                                                    id="gui.classroom.teacherDetail.notSeated"
                                                />
                                            )}
                                        </span>
                                        <button
                                            className={styles.deleteButton}
                                            data-member-id={selectedMember}
                                            data-testid="classroom-member-remove"
                                            onClick={onDeleteMember}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Remove"
                                                description="Remove member button"
                                                id="gui.classroom.members.remove"
                                            />
                                        </button>
                                    </div>
                                    {selectedMemberData.hasSubmission && (
                                        <div className={styles.memberDetailBody}>
                                            {/* Image carousel */}
                                            {selectedMemberData.allImages.length > 0 && (
                                                <div className={styles.imageCarousel}>
                                                    {selectedMemberData.allImages.length > 1 && (
                                                        <div className={styles.carouselNav}>
                                                            <button
                                                                className={styles.carouselButton}
                                                                data-testid="classroom-member-detail-prev"
                                                                disabled={currentImageIndex === 0}
                                                                onClick={handlePrevImage}
                                                            >
                                                                {'<'}
                                                            </button>
                                                            <span data-testid="classroom-member-detail-image-index">
                                                                {`${currentImageIndex + 1} / ${selectedMemberData.allImages.length}`}
                                                            </span>
                                                            <button
                                                                className={styles.carouselButton}
                                                                data-testid="classroom-member-detail-next"
                                                                disabled={currentImageIndex >= selectedMemberData.allImages.length - 1}
                                                                onClick={handleNextImage}
                                                            >
                                                                {'>'}
                                                            </button>
                                                        </div>
                                                    )}
                                                    <img
                                                        alt="Submission image"
                                                        className={styles.memberDetailThumbnailLarge}
                                                        data-testid="classroom-member-detail-thumbnail"
                                                        src={selectedMemberData.allImages[currentImageIndex] || selectedMemberData.allImages[0]}
                                                    />
                                                </div>
                                            )}
                                            {selectedMemberData.projectName && (
                                                <span
                                                    className={styles.submissionProjectName}
                                                    data-testid="classroom-member-detail-project-name"
                                                >
                                                    {selectedMemberData.projectName}
                                                </span>
                                            )}
                                            {selectedMemberData.projectUrl && (
                                                <button
                                                    className={styles.primaryButton}
                                                    data-project-url={selectedMemberData.projectUrl}
                                                    data-testid="classroom-member-detail-open"
                                                    disabled={isLoading}
                                                    onClick={handleOpenClick}
                                                >
                                                    <FormattedMessage
                                                        defaultMessage="Open in Smalruby"
                                                        description="Open student submission button"
                                                        id="gui.classroom.teacherDetail.openSubmission"
                                                    />
                                                </button>
                                            )}
                                            {/* Comment + Return */}
                                            <div className={styles.commentSection}>
                                                <textarea
                                                    className={styles.commentInput}
                                                    data-testid="classroom-member-detail-comment"
                                                    maxLength={500}
                                                    placeholder={selectedMemberData.isReturned ? '' : '...'}
                                                    value={commentText}
                                                    onChange={handleCommentChange}
                                                />
                                                <button
                                                    className={styles.returnButton}
                                                    data-testid="classroom-member-detail-return"
                                                    disabled={isLoading || selectedMemberData.isReturned}
                                                    onClick={handleReturnClick}
                                                >
                                                    {selectedMemberData.isReturned ? (
                                                        <FormattedMessage
                                                            defaultMessage="Returned"
                                                            description="Returned status label"
                                                            id="gui.classroom.teacherDetail.returned"
                                                        />
                                                    ) : (
                                                        <FormattedMessage
                                                            defaultMessage="Return"
                                                            description="Return submission button"
                                                            id="gui.classroom.teacherDetail.returnSubmission"
                                                        />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className={styles.memberDetailEmpty}>
                                    <FormattedMessage
                                        defaultMessage="Select a member"
                                        description="Prompt to select a member in class detail"
                                        id="gui.classroom.teacherDetail.selectMember"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </React.Fragment>
            )}
        </div>
    );
};

TeacherClassDetail.propTypes = {
    codeDisplayClassroom: PropTypes.object,
    codeDisplayFullscreen: PropTypes.bool,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    members: PropTypes.arrayOf(PropTypes.object).isRequired,
    onBack: PropTypes.func.isRequired,
    onCloseCodeDisplay: PropTypes.func.isRequired,
    onCopyInviteLink: PropTypes.func.isRequired,
    onDeleteClassroom: PropTypes.func.isRequired,
    onDeleteMember: PropTypes.func.isRequired,
    onDownloadAll: PropTypes.func.isRequired,
    downloadProgress: PropTypes.shape({
        current: PropTypes.number,
        total: PropTypes.number,
    }),
    onOpenSubmission: PropTypes.func.isRequired,
    onRefresh: PropTypes.func.isRequired,
    onReturnSubmission: PropTypes.func.isRequired,
    onSelectMember: PropTypes.func.isRequired,
    onShowCodeDisplay: PropTypes.func.isRequired,
    onShowPostAssignment: PropTypes.func,
    onToggleCodeFullscreen: PropTypes.func.isRequired,
    selectedClassroom: PropTypes.object.isRequired,
    selectedMember: PropTypes.string,
};

// Teacher create classroom form
const TeacherCreateForm = ({ error, errorTitle, importSource, isLoading, onBack, onCreate }) => {
    const defaultName = importSource
        ? `${importSource.name}${importSource.section ? ` (${importSource.section})` : ''}`
        : '';
    const defaultCount = importSource?.studentCount > 0 ? String(importSource.studentCount) : '35';
    const [className, setClassName] = React.useState(defaultName);
    const [studentCount, setStudentCount] = React.useState(defaultCount);

    const handleClassNameChange = useCallback((e) => {
        setClassName(e.target.value);
    }, []);

    const handleStudentCountChange = useCallback((e) => {
        setStudentCount(e.target.value);
    }, []);

    const handleSubmit = useCallback(() => {
        const count = parseInt(studentCount, 10);
        if (className.trim() && count > 0 && count <= 50) {
            onCreate({ className: className.trim(), studentCount: count });
        }
    }, [className, studentCount, onCreate]);

    return (
        <div data-testid="classroom-phase-teacher-create">
            <button
                className={styles.backLink}
                data-testid="classroom-back"
                onClick={onBack}
            >
                {'<'}{' '}
                <FormattedMessage defaultMessage="Back" description="Back button" id="gui.classroom.back" />
            </button>
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Create Classroom"
                    description="Create classroom form title"
                    id="gui.classroom.teacherCreate.title"
                />
            </div>
            <div className={styles.formHint}>
                <FormattedMessage
                    defaultMessage="Create a classroom for each assignment. Example: &quot;Lesson 3: Build a Chat App&quot;"
                    description="Hint explaining classroom = assignment"
                    id="gui.classroom.teacherCreate.hint"
                />
            </div>
            {importSource && (
                <div className={styles.importSourceInfo}>
                    <FormattedMessage
                        defaultMessage="Importing from: {source}"
                        description="Shows Google Classroom import source"
                        id="gui.classroom.teacherCreate.importSource"
                        values={{ source: `${importSource.name}${importSource.section ? ` (${importSource.section})` : ''}` }}
                    />
                </div>
            )}
            <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="classroom-name">
                    <FormattedMessage
                        defaultMessage="Assignment Name"
                        description="Assignment name input label"
                        id="gui.classroom.teacherCreate.assignmentName"
                    />
                </label>
                <input
                    className={styles.input}
                    data-testid="classroom-name-input"
                    id="classroom-name"
                    maxLength={50}
                    type="text"
                    value={className}
                    onChange={handleClassNameChange}
                />
            </div>
            <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="classroom-count">
                    <FormattedMessage
                        defaultMessage="Number of Students"
                        description="Student count input label"
                        id="gui.classroom.teacherCreate.count"
                    />
                </label>
                <input
                    className={styles.input}
                    data-testid="classroom-count-input"
                    id="classroom-count"
                    max={50}
                    min={1}
                    type="number"
                    value={studentCount}
                    onChange={handleStudentCountChange}
                />
            </div>
            <div className={styles.buttonRow}>
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-create-submit"
                    disabled={!className.trim() || isLoading}
                    onClick={handleSubmit}
                >
                    <FormattedMessage
                        defaultMessage="Create"
                        description="Submit create classroom button"
                        id="gui.classroom.teacherCreate.submit"
                    />
                </button>
            </div>
            <div className={styles.formFooterHint}>
                <FormattedMessage
                    defaultMessage="After creating, you can share the assignment link to Google Classroom."
                    description="Hint about posting to Google Classroom after creation"
                    id="gui.classroom.teacherCreate.footerHint"
                />
            </div>
            <ErrorDisplay error={error} errorTitle={errorTitle} />
        </div>
    );
};

TeacherCreateForm.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    importSource: PropTypes.shape({
        name: PropTypes.string,
        section: PropTypes.string,
        studentCount: PropTypes.number,
    }),
    isLoading: PropTypes.bool,
    onBack: PropTypes.func.isRequired,
    onCreate: PropTypes.func.isRequired,
};

// Google Classroom course list (avoids inline arrow in JSX)
const GoogleCourseList = ({ courses, selectedCourseId, onSelect }) => {
    const handleClick = useCallback(
        (e) => {
            const courseId = e.currentTarget.dataset.courseId;
            const course = courses.find(c => c.courseId === courseId);
            if (course) onSelect(course);
        },
        [courses, onSelect],
    );

    return (
        <ul className={styles.classList}>
            {courses.map(course => (
                <li
                    className={`${styles.classItem} ${selectedCourseId === course.courseId ? styles.classItemSelected : ''}`}
                    data-course-id={course.courseId}
                    data-testid={`classroom-google-course-${course.courseId}`}
                    key={course.courseId}
                    onClick={handleClick}
                >
                    <div className={styles.classItemMain}>
                        <span className={styles.classItemName}>
                            {course.name}
                        </span>
                        {course.section && (
                            <span className={styles.classItemCode}>
                                {course.section}
                            </span>
                        )}
                    </div>
                    <div className={styles.classItemMeta}>
                        <span>
                            <FormattedMessage
                                defaultMessage="{count} students"
                                description="Student count"
                                id="gui.classroom.googleCourses.students"
                                values={{ count: course.studentCount }}
                            />
                        </span>
                    </div>
                </li>
            ))}
        </ul>
    );
};

GoogleCourseList.propTypes = {
    courses: PropTypes.arrayOf(
        PropTypes.shape({
            courseId: PropTypes.string,
            name: PropTypes.string,
            section: PropTypes.string,
            studentCount: PropTypes.number,
        }),
    ).isRequired,
    onSelect: PropTypes.func.isRequired,
    selectedCourseId: PropTypes.string,
};

// Teacher: Post assignment to Google Classroom
const TeacherPostAssignment = ({
    error,
    errorTitle,
    isLoading,
    selectedClassroom,
    onBack,
    onPostAssignment,
}) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [posted, setPosted] = useState(false);

    const handlePost = useCallback(async () => {
        if (!title.trim()) return;
        try {
            await onPostAssignment(title.trim(), description.trim());
            setPosted(true);
        } catch {
            // error is shown via parent error state
        }
    }, [title, description, onPostAssignment]);

    const handleTitleChange = useCallback(e => {
        setTitle(e.target.value);
    }, []);

    const handleDescriptionChange = useCallback(e => {
        setDescription(e.target.value);
    }, []);

    return (
        <div
            className={styles.phaseContainer}
            data-testid="classroom-phase-teacher-post-assignment"
        >
            <button
                className={styles.backButton}
                data-testid="classroom-back"
                onClick={onBack}
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
                    defaultMessage="Post Assignment"
                    description="Post assignment to Google Classroom"
                    id="gui.classroom.postAssignment.title"
                />
            </div>
            <div className={styles.detailLabel}>
                {selectedClassroom?.className}
            </div>
            {posted ? (
                <div className={styles.successMessage} data-testid="classroom-post-assignment-success">
                    <FormattedMessage
                        defaultMessage="Assignment posted!"
                        description="Assignment posted successfully"
                        id="gui.classroom.postAssignment.success"
                    />
                </div>
            ) : (
                <>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                            <FormattedMessage
                                defaultMessage="Title"
                                description="Assignment title label"
                                id="gui.classroom.postAssignment.titleLabel"
                            />
                        </label>
                        <input
                            className={styles.formInput}
                            data-testid="classroom-post-assignment-title"
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                            <FormattedMessage
                                defaultMessage="Description (optional)"
                                description="Assignment description label"
                                id="gui.classroom.postAssignment.descriptionLabel"
                            />
                        </label>
                        <textarea
                            className={styles.commentInput}
                            data-testid="classroom-post-assignment-description"
                            rows={3}
                            value={description}
                            onChange={handleDescriptionChange}
                        />
                    </div>
                    <button
                        className={styles.primaryButton}
                        data-testid="classroom-post-assignment-submit"
                        disabled={!title.trim() || isLoading}
                        onClick={handlePost}
                    >
                        <FormattedMessage
                            defaultMessage="Post to Google Classroom"
                            description="Post assignment button"
                            id="gui.classroom.postAssignment.post"
                        />
                    </button>
                </>
            )}
            <ErrorDisplay error={error} errorTitle={errorTitle} />
        </div>
    );
};

TeacherPostAssignment.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    onBack: PropTypes.func.isRequired,
    onPostAssignment: PropTypes.func.isRequired,
    selectedClassroom: PropTypes.shape({
        className: PropTypes.string,
    }),
};

// Student join form
const StudentJoinForm = ({ error, errorTitle, isLoading, onBack, onJoin }) => {
    const [code, setCode] = React.useState('');

    const handleCodeChange = useCallback((e) => {
        setCode(e.target.value.toLowerCase());
    }, []);

    const handleSubmit = useCallback(() => {
        if (code.trim().length === 6) {
            onJoin(code.trim().toUpperCase());
        }
    }, [code, onJoin]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter' && code.trim().length === 6) {
                onJoin(code.trim().toUpperCase());
            }
        },
        [code, onJoin],
    );

    return (
        <div data-testid="classroom-phase-student-join">
            <button
                className={styles.backLink}
                data-testid="classroom-back"
                onClick={onBack}
            >
                {'<'}{' '}
                <FormattedMessage defaultMessage="Back" description="Back button" id="gui.classroom.back" />
            </button>
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Enter Join Code"
                    description="Student join form title"
                    id="gui.classroom.studentJoin.title"
                />
            </div>
            <div className={styles.formGroup}>
                <input
                    className={styles.input}
                    data-testid="classroom-join-code-input"
                    maxLength={6}
                    placeholder="○○○○○○"
                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.2em' }}
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    onKeyDown={handleKeyDown}
                />
            </div>
            <div className={styles.buttonRow}>
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-join-submit"
                    disabled={code.trim().length !== 6 || isLoading}
                    onClick={handleSubmit}
                >
                    {isLoading ? (
                        <FormattedMessage
                            defaultMessage="Loading..."
                            description="Loading indicator"
                            id="gui.classroom.loading"
                        />
                    ) : (
                        <FormattedMessage
                            defaultMessage="Next"
                            description="Submit join code button"
                            id="gui.classroom.studentJoin.next"
                        />
                    )}
                </button>
            </div>
            <ErrorDisplay error={error} errorTitle={errorTitle} />
        </div>
    );
};

StudentJoinForm.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    onBack: PropTypes.func.isRequired,
    onJoin: PropTypes.func.isRequired,
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
