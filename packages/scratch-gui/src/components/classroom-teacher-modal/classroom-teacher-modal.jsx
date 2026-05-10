/**
 * Teacher fullscreen class management modal.
 *
 * Separate from the student ClassroomModal. Renders a fullscreen overlay
 * with a sidebar (class list) and a main area that shows phase content.
 */
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';

import Modal from '../../containers/modal.jsx';

import ClassCodeDisplay from '../classroom-modal/class-code-display.jsx';
import TeacherClassDetail from '../classroom-modal/teacher-class-detail.jsx';
import TeacherCreateForm from '../classroom-modal/teacher-create-form.jsx';
import TeacherPostAssignment from '../classroom-modal/teacher-post-assignment.jsx';
import ClassroomTutorial from '../classroom-tutorial/classroom-tutorial.jsx';
import Spinner from '../spinner/spinner.jsx';

import TeacherGoogleCoursesPhase from './teacher-google-courses-phase.jsx';
import TeacherLoginPhase from './teacher-login-phase.jsx';
import TeacherSidebar from './teacher-sidebar.jsx';

import styles from './classroom-teacher-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Class Management',
        description: 'Title for the teacher class management modal',
        id: 'gui.classroom.management.title',
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
        errorActionLabel,
        errorActionHandler,
        isLoading,
        selectedMember,
        codeDisplayClassroom,
        codeDisplayFullscreen,
        downloadProgress,
        googleCourses,
        selectedGoogleCourse,
        onGoogleLogin,
        onMicrosoftLogin,
        isMicrosoftAuthAvailable,
        authProvider,
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
        onBackToDetail,
        onPostAssignment,
        onShowGoogleCourses,
        onLoadGoogleCourses,
        onSelectGoogleCourse,
        onConfirmGoogleImport,
        onUpdateAssignmentName,
        onUpdateStudentCount,
    } = containerProps;

    const renderMain = () => {
        // Fullscreen code display overlay
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
                <TeacherLoginPhase
                    error={error}
                    errorTitle={errorTitle}
                    isMicrosoftAuthAvailable={isMicrosoftAuthAvailable}
                    onGoogleLogin={onGoogleLogin}
                    onMicrosoftLogin={onMicrosoftLogin}
                />
            );
        }

        if (phase === 'teacher-class-detail' && selectedClassroom) {
            return (
                <div className={styles.mainRelative}>
                    <TeacherClassDetail
                        codeDisplayClassroom={codeDisplayClassroom}
                        codeDisplayFullscreen={false}
                        downloadProgress={downloadProgress}
                        error={error}
                        errorActionHandler={errorActionHandler}
                        errorActionLabel={errorActionLabel}
                        errorTitle={errorTitle}
                        isLoading={isLoading}
                        members={members}
                        noBackButton
                        selectedClassroom={selectedClassroom}
                        selectedMember={selectedMember}
                        onCloseCodeDisplay={onCloseCodeDisplay}
                        onCopyInviteLink={onCopyInviteLink}
                        onDeleteClassroom={onDeleteClassroom}
                        onDeleteMember={onDeleteMember}
                        onDownloadAll={onDownloadAll}
                        onOpenSubmission={onOpenSubmission}
                        onRefresh={onRefreshDetail}
                        onReturnSubmission={onReturnSubmission}
                        onSelectMember={onSelectMember}
                        onShowCodeDisplay={onShowCodeDisplay}
                        onShowPostAssignment={
                            authProvider === 'google'
                                ? onShowPostAssignment
                                : null
                        }
                        onToggleCodeFullscreen={onToggleCodeFullscreen}
                        onUpdateAssignmentName={onUpdateAssignmentName}
                        onUpdateStudentCount={onUpdateStudentCount}
                    />
                </div>
            );
        }

        if (phase === 'teacher-create') {
            return (
                <div className={styles.mainRelative}>
                    <TeacherCreateForm
                        error={error}
                        errorTitle={errorTitle}
                        importSource={selectedGoogleCourse}
                        isLoading={isLoading}
                        noBackButton
                        onBack={onBackToDashboard}
                        onCreate={onCreateClassroom}
                        onImportFromGC={
                            authProvider === 'google'
                                ? onShowGoogleCourses
                                : null
                        }
                    />
                </div>
            );
        }

        if (phase === 'teacher-google-courses') {
            return (
                <TeacherGoogleCoursesPhase
                    error={error}
                    errorTitle={errorTitle}
                    googleCourses={googleCourses}
                    isLoading={isLoading}
                    selectedGoogleCourse={selectedGoogleCourse}
                    onBack={onShowCreateForm}
                    onConfirmGoogleImport={onConfirmGoogleImport}
                    onLoadGoogleCourses={onLoadGoogleCourses}
                    onSelectGoogleCourse={onSelectGoogleCourse}
                />
            );
        }

        if (phase === 'teacher-post-assignment') {
            return (
                <TeacherPostAssignment
                    error={error}
                    errorTitle={errorTitle}
                    isLoading={isLoading}
                    selectedClassroom={selectedClassroom}
                    onBack={onBackToDetail}
                    onPostAssignment={onPostAssignment}
                />
            );
        }

        // Default: dashboard (no class selected)
        if (isLoading) {
            return (
                <div className={styles.mainEmpty} data-testid="classroom-phase-teacher-dashboard">
                    <Spinner large level="primary" />
                </div>
            );
        }
        return (
            <div className={styles.mainEmpty} data-testid="classroom-phase-teacher-dashboard">
                <ClassroomTutorial name="classCreation">
                    <FormattedMessage
                        defaultMessage={
                            'Let\'s start by creating a "Class"!\nCreate one class per lesson, e.g. "Lesson 3: Make a Chat App".\nClick the "Create Classroom" button in the sidebar on the left.'
                        }
                        description="Tutorial: class creation onboarding after first login"
                        id="gui.classroom.tutorial.classCreation"
                    />
                </ClassroomTutorial>
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
                    <TeacherSidebar
                        classrooms={classrooms}
                        isLoading={isLoading}
                        selectedClassroom={selectedClassroom}
                        onSelectClassroom={onSelectClassroom}
                        onShowCreateForm={onShowCreateForm}
                        onTeacherLogout={onTeacherLogout}
                    />
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
