/**
 * Teacher fullscreen class management modal.
 *
 * Separate from the student ClassroomModal. Renders a fullscreen overlay
 * with a sidebar (class list) and a main area that shows phase content.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import Modal from '../../containers/modal.jsx';

import ClassCodeDisplay from '../classroom-modal/class-code-display.jsx';
import ErrorDisplay from '../classroom-modal/error-display.jsx';
import GoogleCourseList from '../classroom-modal/google-course-list.jsx';
import TeacherClassDetail from '../classroom-modal/teacher-class-detail.jsx';
import TeacherCreateForm from '../classroom-modal/teacher-create-form.jsx';
import TeacherPostAssignment from '../classroom-modal/teacher-post-assignment.jsx';

import styles from './classroom-teacher-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Class Management',
        description: 'Title for the teacher class management modal',
        id: 'gui.menuBar.classroomManagement',
    },
});

const ClassroomTeacherModal = ({ containerProps, onClose }) => {
    const intl = useIntl();
    const {
        phase,
        classrooms,
        selectedClassroom,
        members,
        error,
        errorTitle,
        isLoading,
        selectedMember,
        codeDisplayClassroom,
        codeDisplayFullscreen,
        downloadProgress,
        googleCourses,
        selectedGoogleCourse,
        onTeacherLogin,
        onTeacherLogout,
        onShowCreateForm,
        onCreateClassroom,
        onSelectClassroom,
        onBackToDashboard,
        onDeleteClassroom,
        onDeleteMember,
        onRefreshDetail,
        onSelectMember,
        onOpenSubmission,
        onReturnSubmission,
        onDownloadAll,
        onShowCodeDisplay,
        onCloseCodeDisplay,
        onCopyInviteLink,
        onToggleCodeFullscreen,
        onShowPostAssignment,
        onPostAssignment,
        onGoogleClassroomImport,
        onSelectGoogleCourse,
        onConfirmGoogleImport,
    } = containerProps;

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

    const renderMain = () => {
        // Fullscreen code display overlay (portal)
        if (codeDisplayFullscreen && codeDisplayClassroom) {
            return (
                <ClassCodeDisplay
                    classroom={codeDisplayClassroom}
                    isFullscreen
                    onClose={onCloseCodeDisplay}
                    onCopyInviteLink={onCopyInviteLink}
                    onToggleFullscreen={onToggleCodeFullscreen}
                />
            );
        }

        if (phase === 'teacher-login') {
            return (
                <div
                    className={styles.loginArea}
                    data-testid="classroom-phase-teacher-login"
                >
                    <h2>
                        <FormattedMessage
                            defaultMessage="Sign in with Google"
                            description="Prompt for teacher Google sign in"
                            id="gui.classroom.management.loginPrompt"
                        />
                    </h2>
                    <p>
                        <FormattedMessage
                            defaultMessage="Sign in with your Google account to manage classrooms."
                            description="Teacher login description"
                            id="gui.classroom.management.loginDescription"
                        />
                    </p>
                    <button
                        className={styles.loginButton}
                        data-testid="classroom-google-login"
                        onClick={onTeacherLogin}
                    >
                        <FormattedMessage
                            defaultMessage="Sign in with Google"
                            description="Google sign in button"
                            id="gui.classroom.management.loginButton"
                        />
                    </button>
                    <ErrorDisplay error={error} errorTitle={errorTitle} />
                </div>
            );
        }

        if (phase === 'teacher-class-detail' && selectedClassroom) {
            return (
                <TeacherClassDetail
                    codeDisplayClassroom={codeDisplayClassroom}
                    codeDisplayFullscreen={false}
                    downloadProgress={downloadProgress}
                    error={error}
                    errorTitle={errorTitle}
                    isLoading={isLoading}
                    members={members}
                    noBackButton
                    selectedClassroom={selectedClassroom}
                    selectedMember={selectedMember}
                    onCloseCodeDisplay={onCloseCodeDisplay}
                    onCopyInviteLink={onCopyInviteLink}
                    onDeleteClassroom={onDeleteClassroom}
                    onDeleteMember={handleDeleteMember}
                    onDownloadAll={onDownloadAll}
                    onOpenSubmission={onOpenSubmission}
                    onRefresh={onRefreshDetail}
                    onReturnSubmission={onReturnSubmission}
                    onSelectMember={onSelectMember}
                    onShowCodeDisplay={onShowCodeDisplay}
                    onShowPostAssignment={onShowPostAssignment}
                    onToggleCodeFullscreen={onToggleCodeFullscreen}
                />
            );
        }

        if (phase === 'teacher-create') {
            return (
                <TeacherCreateForm
                    error={error}
                    errorTitle={errorTitle}
                    importSource={selectedGoogleCourse}
                    isLoading={isLoading}
                    noBackButton
                    onBack={onBackToDashboard}
                    onCreate={onCreateClassroom}
                />
            );
        }

        if (phase === 'teacher-google-courses') {
            return (
                <div data-testid="classroom-phase-teacher-google-courses">
                    <div className={styles.mainPhaseTitle}>
                        <FormattedMessage
                            defaultMessage="Google Classroom Courses"
                            description="Google Classroom courses list title"
                            id="gui.classroom.management.googleCoursesTitle"
                        />
                    </div>
                    {isLoading && (
                        <div data-testid="classroom-loading">{'...'}</div>
                    )}
                    <ErrorDisplay error={error} errorTitle={errorTitle} />
                    {googleCourses.length === 0 && !isLoading ? (
                        <div>
                            <FormattedMessage
                                defaultMessage="No courses found"
                                description="No Google Classroom courses"
                                id="gui.classroom.management.noCourses"
                            />
                        </div>
                    ) : (
                        <GoogleCourseList
                            courses={googleCourses}
                            selectedCourseId={selectedGoogleCourse?.courseId}
                            onSelect={onSelectGoogleCourse}
                        />
                    )}
                    <div className={styles.mainFooter}>
                        <button
                            className={styles.loginButton}
                            data-testid="classroom-google-import-confirm"
                            disabled={!selectedGoogleCourse || isLoading}
                            onClick={onConfirmGoogleImport}
                        >
                            <FormattedMessage
                                defaultMessage="Import"
                                description="Import Google Classroom course"
                                id="gui.classroom.management.importButton"
                            />
                        </button>
                    </div>
                </div>
            );
        }

        if (phase === 'teacher-post-assignment') {
            return (
                <TeacherPostAssignment
                    error={error}
                    errorTitle={errorTitle}
                    isLoading={isLoading}
                    noBackButton
                    selectedClassroom={selectedClassroom}
                    onBack={onBackToDashboard}
                    onPostAssignment={onPostAssignment}
                />
            );
        }

        // Default: dashboard (no class selected)
        return (
            <div className={styles.mainEmpty}>
                <FormattedMessage
                    defaultMessage="Select a classroom from the sidebar"
                    description="Prompt to select a classroom in teacher management"
                    id="gui.classroom.teacherDetail.selectClassroom"
                />
            </div>
        );
    };

    return (
        <Modal
            contentLabel={intl.formatMessage(messages.title)}
            fullScreen
            id="classroomTeacherModal"
            onRequestClose={onClose}
        >
            <div
                className={styles.layout}
                data-testid="classroom-teacher-modal"
            >
                {/* Sidebar: visible when logged in */}
                {phase !== 'teacher-login' && (
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarHeader}>
                            <FormattedMessage
                                defaultMessage="Your Classrooms"
                                description="Teacher sidebar title"
                                id="gui.classroom.management.sidebarTitle"
                            />
                        </div>
                        <ul className={styles.sidebarList}>
                            {isLoading && classrooms.length === 0 && (
                                <li className={styles.sidebarItem}>
                                    <FormattedMessage
                                        defaultMessage="Loading..."
                                        description="Loading indicator in sidebar"
                                        id="gui.classroom.management.loading"
                                    />
                                </li>
                            )}
                            {classrooms.map((c) => (
                                <li
                                    className={classNames(
                                        styles.sidebarItem,
                                        selectedClassroom &&
                                            selectedClassroom.classroomId ===
                                                c.classroomId &&
                                            styles.sidebarItemSelected,
                                    )}
                                    data-classroom-id={c.classroomId}
                                    data-testid={`classroom-sidebar-item-${c.classroomId}`}
                                    key={c.classroomId}
                                    onClick={handleSelectClassroom}
                                >
                                    <span className={styles.sidebarItemName}>
                                        {c.className}
                                    </span>
                                    <span className={styles.sidebarItemMeta}>
                                        {`${c.studentCount} · ${c.joinCode.toLowerCase()}`}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className={styles.sidebarFooter}>
                            <button
                                className={classNames(
                                    styles.sidebarButton,
                                    styles.sidebarButtonPrimary,
                                )}
                                data-testid="classroom-create"
                                onClick={onShowCreateForm}
                            >
                                <FormattedMessage
                                    defaultMessage="Create Classroom"
                                    description="Create new classroom button in sidebar"
                                    id="gui.classroom.management.create"
                                />
                            </button>
                            <button
                                className={styles.sidebarButton}
                                data-testid="classroom-google-import"
                                onClick={onGoogleClassroomImport}
                            >
                                <FormattedMessage
                                    defaultMessage="Import from Google Classroom"
                                    description="Import from Google Classroom button in sidebar"
                                    id="gui.classroom.management.googleImport"
                                />
                            </button>
                            <button
                                className={classNames(
                                    styles.sidebarButton,
                                    styles.sidebarButtonDanger,
                                )}
                                data-testid="classroom-teacher-logout"
                                onClick={onTeacherLogout}
                            >
                                <FormattedMessage
                                    defaultMessage="Logout"
                                    description="Teacher logout button in sidebar"
                                    id="gui.classroom.management.logout"
                                />
                            </button>
                        </div>
                    </aside>
                )}
                {/* Main area */}
                <main className={styles.main}>{renderMain()}</main>
            </div>
        </Modal>
    );
};

ClassroomTeacherModal.propTypes = {
    containerProps: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default ClassroomTeacherModal;
