import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';

import ErrorDisplay from './error-display.jsx';
import GoogleCourseList from './google-course-list.jsx';
import StudentJoinForm from './student-join-form.jsx';
import StudentJoinedConfirmation from './student-joined-confirmation.jsx';
import StudentSeatSelector from './student-seat-selector.jsx';
import StudentStatusView from './student-status-view.jsx';
import StudentSubmitConfirm from './student-submit-confirm.jsx';
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
    errorActionHandler,
    errorActionLabel,
    errorTitle,
    isLoading,
    onSelectTeacher,
    onSelectStudent,
    onTeacherLogin,
    onShowCreateForm,
    onCreateClassroom,
    onSelectClassroom,
    onBackToDashboard,
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
                        errorActionHandler={errorActionHandler}
                        errorActionLabel={errorActionLabel}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        noBackButton
                        onJoin={onJoinWithCode}
                    />
                )}

                {/* Phase: student-seat */}
                {phase === 'student-seat' && (
                    <StudentSeatSelector
                        error={error}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        seatCount={seatCount}
                        selectedSeat={selectedSeat}
                        takenSeats={takenSeats}
                        onConfirmJoin={onConfirmJoin}
                        onSelectSeat={onSelectSeat}
                    />
                )}

                {/* Phase: student-joined */}
                {phase === 'student-joined' && joinedInfo && (
                    <StudentJoinedConfirmation
                        joinedInfo={joinedInfo}
                        onClose={onClose}
                    />
                )}

                {/* Phase: student-status (already joined) */}
                {phase === 'student-status' && classroomState && (
                    <StudentStatusView
                        classroomState={classroomState}
                        error={error}
                        errorActionHandler={errorActionHandler}
                        errorActionLabel={errorActionLabel}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        teacherComment={teacherComment}
                        onLeaveClassroom={onLeaveClassroom}
                        onRefreshStudentStatus={onRefreshStudentStatus}
                        onStartSubmit={onStartSubmit}
                    />
                )}

                {/* Phase: student-submit-confirm */}
                {phase === 'student-submit-confirm' && (
                    <StudentSubmitConfirm
                        error={error}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        submitProgress={submitProgress}
                        thumbnailDataUrl={thumbnailDataUrl}
                        onCancelSubmit={onCancelSubmit}
                        onConfirmSubmit={onConfirmSubmit}
                    />
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
    errorActionHandler: PropTypes.func,
    errorActionLabel: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    joinedInfo: PropTypes.shape({
        assignmentName: PropTypes.string,
        className: PropTypes.string,
        seatNumber: PropTypes.number,
    }),
    members: PropTypes.arrayOf(PropTypes.object),
    onBackToDashboard: PropTypes.func.isRequired,
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
    onSelectStudent: PropTypes.func,
    onSelectTeacher: PropTypes.func,
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
