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
import TeacherAssignmentEditor from '../classroom-modal/teacher-assignment-editor.jsx';
import TeacherClassDetail from '../classroom-modal/teacher-class-detail.jsx';
import TeacherCreateForm from '../classroom-modal/teacher-create-form.jsx';
import TeacherEvaluation from '../classroom-modal/teacher-evaluation.jsx';
import TeacherGroupManage from '../classroom-modal/teacher-group-manage.jsx';
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
        kickRequestsBySeat,
        onApproveKickRequest,
        onRejectKickRequest,
        onAddCoTeacher,
        onRemoveCoTeacher,
        assignmentEditorPages,
        assignmentStarterMode,
        assignmentStarterSource,
        assignmentHasExistingStarter,
        assignmentIsSaving,
        onShowAssignmentEditor,
        onAssignmentAddPage,
        onAssignmentRemovePage,
        onAssignmentMovePage,
        onAssignmentChangePageText,
        onAssignmentAttachPageImage,
        onAssignmentRemovePageImage,
        onAssignmentUseCurrentProject,
        onAssignmentUseFile,
        onAssignmentRemoveStarter,
        onAssignmentSave,
        onAssignmentCancel,
        onAssignmentApplyTemplate,
        groups,
        onShowGroupManage,
        onBackFromGroupManage,
        onCreateGroup,
        onUpdateGroup,
        onAssignClassToGroup,
        onDuplicateClassroom,
        evaluation,
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

        if (phase === 'teacher-group-manage') {
            return (
                <div className={styles.mainRelative}>
                    <TeacherGroupManage
                        error={error}
                        errorTitle={errorTitle}
                        groups={groups || []}
                        isLoading={isLoading}
                        onBack={onBackFromGroupManage}
                        onCreateGroup={onCreateGroup}
                        onShowEvaluation={evaluation?.handleShowEvaluation}
                        onUpdateGroup={onUpdateGroup}
                    />
                </div>
            );
        }

        if (phase === 'teacher-evaluation' && evaluation) {
            return (
                <div className={styles.mainRelative}>
                    <TeacherEvaluation
                        comments={evaluation.comments}
                        error={error}
                        errorTitle={errorTitle}
                        evalGroup={evaluation.evalGroup}
                        evalLessons={evaluation.evalLessons}
                        evalProgress={evaluation.evalProgress}
                        getCell={evaluation.getCell}
                        rubricAxes={evaluation.rubricAxes}
                        seats={evaluation.seats}
                        selectedLessonIds={evaluation.selectedLessonIds}
                        strictness={evaluation.strictness}
                        onBack={evaluation.handleBackFromEvaluation}
                        onChangeRubricAxis={evaluation.handleChangeRubricAxis}
                        onExportAuditCsv={evaluation.handleExportAuditCsv}
                        onExportEvaluationCsv={evaluation.handleExportEvaluationCsv}
                        onLoadSubmissions={evaluation.handleLoadSubmissions}
                        onReturnComments={evaluation.handleReturnComments}
                        onRunAi={evaluation.handleRunAi}
                        onSetCellGrade={evaluation.handleSetCellGrade}
                        onSetCellReason={evaluation.handleSetCellReason}
                        onSetComment={evaluation.handleSetComment}
                        onSetStrictness={evaluation.handleSetStrictness}
                        onToggleLesson={evaluation.handleToggleLesson}
                    />
                </div>
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
                        groups={groups}
                        isLoading={isLoading}
                        kickRequestsBySeat={kickRequestsBySeat}
                        members={members}
                        noBackButton
                        selectedClassroom={selectedClassroom}
                        selectedMember={selectedMember}
                        onAddCoTeacher={onAddCoTeacher}
                        onAssignClassToGroup={onAssignClassToGroup}
                        onDuplicateClassroom={onDuplicateClassroom}
                        onApproveKickRequest={onApproveKickRequest}
                        onRemoveCoTeacher={onRemoveCoTeacher}
                        onCloseCodeDisplay={onCloseCodeDisplay}
                        onCopyInviteLink={onCopyInviteLink}
                        onDeleteClassroom={onDeleteClassroom}
                        onDeleteMember={onDeleteMember}
                        onDownloadAll={onDownloadAll}
                        onOpenSubmission={onOpenSubmission}
                        onRefresh={onRefreshDetail}
                        onRejectKickRequest={onRejectKickRequest}
                        onReturnSubmission={onReturnSubmission}
                        onSelectMember={onSelectMember}
                        onShowAssignmentEditor={onShowAssignmentEditor}
                        onShowCodeDisplay={onShowCodeDisplay}
                        onShowPostAssignment={authProvider === 'google' ? onShowPostAssignment : null}
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

        if (phase === 'teacher-assignment-edit' && selectedClassroom) {
            return (
                <div className={styles.mainRelative}>
                    <TeacherAssignmentEditor
                        editorPages={assignmentEditorPages}
                        error={error}
                        errorTitle={errorTitle}
                        hasExistingStarter={assignmentHasExistingStarter}
                        isSaving={assignmentIsSaving}
                        selectedClassroom={selectedClassroom}
                        starterMode={assignmentStarterMode}
                        starterSource={assignmentStarterSource}
                        onAddPage={onAssignmentAddPage}
                        onAttachPageImage={onAssignmentAttachPageImage}
                        onApplyTemplate={onAssignmentApplyTemplate}
                        onCancel={onAssignmentCancel}
                        onChangePageText={onAssignmentChangePageText}
                        onMovePage={onAssignmentMovePage}
                        onRemovePage={onAssignmentRemovePage}
                        onRemovePageImage={onAssignmentRemovePageImage}
                        onRemoveStarter={onAssignmentRemoveStarter}
                        onSave={onAssignmentSave}
                        onUseCurrentProject={onAssignmentUseCurrentProject}
                        onUseFile={onAssignmentUseFile}
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
                        groups={groups}
                        isLoading={isLoading}
                        selectedClassroom={selectedClassroom}
                        onSelectClassroom={onSelectClassroom}
                        onShowCreateForm={onShowCreateForm}
                        onShowGroupManage={onShowGroupManage}
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
