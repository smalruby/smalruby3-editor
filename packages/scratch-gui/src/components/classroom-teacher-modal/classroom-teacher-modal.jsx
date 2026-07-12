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
import TeacherAssignmentBoard from '../classroom-modal/teacher-assignment-board.jsx';
import TeacherClassDetail from '../classroom-modal/teacher-class-detail.jsx';
import TeacherClassList from '../classroom-modal/teacher-class-list.jsx';
import TeacherEvaluation from '../classroom-modal/teacher-evaluation.jsx';
import TeacherPostAssignment from '../classroom-modal/teacher-post-assignment.jsx';
import TeacherBreadcrumbs from '../classroom-modal/teacher-breadcrumbs.jsx';
import ClassroomTutorial from '../classroom-tutorial/classroom-tutorial.jsx';
import Spinner from '../spinner/spinner.jsx';

import TeacherGoogleCoursesPhase from './teacher-google-courses-phase.jsx';
import TeacherLoginPhase from './teacher-login-phase.jsx';

import styles from './classroom-teacher-modal.css';

const messagesBreadcrumbs = defineMessages({
    classList: {
        defaultMessage: 'Class list',
        description: 'Breadcrumb link back to the class list',
        id: 'gui.classroom.breadcrumbs.classList',
    },
    assignments: {
        defaultMessage: 'Assignments',
        description: 'Breadcrumb link back to the assignment board',
        id: 'gui.classroom.breadcrumbs.assignments',
    },
    assignmentDetail: {
        defaultMessage: 'Assignment detail',
        description: 'Breadcrumb label of the assignment detail view',
        id: 'gui.classroom.breadcrumbs.assignmentDetail',
    },
});

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
        kickRequestsBySeat,
        onApproveKickRequest,
        onRejectKickRequest,
        assignmentEditorPages,
        assignmentStarterMode,
        assignmentStarterSource,
        assignmentHasExistingStarter,
        assignmentIsSaving,
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
        groups,
        teacherEmail,
        selectedGroup,
        onSelectGroup,
        onShowClassList,
        onCreateClassWithAssignment,
        onUpdateGroupTopics,
        onUpdateAssignmentMeta,
        onCreateAssignmentInClass,
        onReuseAssignment,
        onDetailTabChange,
        onBackFromGroupManage,
        onCreateGroup,
        onUpdateGroup,
        evaluation,
    } = containerProps;

    // Opening a class scopes the board to its assignments (GC style).
    const scopedClassrooms = selectedGroup
        ? classrooms.filter((c) => c.groupId === selectedGroup.groupId)
        : classrooms;

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

        if (phase === 'teacher-class-list') {
            return (
                <div className={styles.mainRelative}>
                    <TeacherClassList
                        classrooms={classrooms}
                        error={error}
                        errorTitle={errorTitle}
                        groups={groups || []}
                        isLoading={isLoading}
                        onCreateClassWithAssignment={onCreateClassWithAssignment}
                        onOpenUngrouped={onSelectClassroom}
                        onSelectGroup={onSelectGroup}
                        onShowEvaluation={evaluation?.handleShowEvaluation}
                        onShowGoogleCourses={authProvider === 'google' ? onShowGoogleCourses : null}
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
                    <div className={styles.detailBreadcrumbs}>
                        <TeacherBreadcrumbs
                            items={[
                                {
                                    label: intl.formatMessage(messagesBreadcrumbs.classList),
                                    onClick: onShowClassList,
                                    testId: 'classroom-breadcrumb-class-list',
                                },
                                {
                                    label: intl.formatMessage(messagesBreadcrumbs.assignments),
                                    onClick: onBackToDashboard,
                                    testId: 'classroom-breadcrumb-assignments',
                                },
                                { label: intl.formatMessage(messagesBreadcrumbs.assignmentDetail) },
                            ]}
                        />
                    </div>
                    <TeacherClassDetail
                        assignmentEditor={{
                            editorPages: assignmentEditorPages,
                            starterMode: assignmentStarterMode,
                            starterSource: assignmentStarterSource,
                            hasExistingStarter: assignmentHasExistingStarter,
                            isSaving: assignmentIsSaving,
                            onAddPage: onAssignmentAddPage,
                            onAttachPageImage: onAssignmentAttachPageImage,
                            onCancel: onAssignmentCancel,
                            onChangePageText: onAssignmentChangePageText,
                            onMovePage: onAssignmentMovePage,
                            onRemovePage: onAssignmentRemovePage,
                            onRemovePageImage: onAssignmentRemovePageImage,
                            onRemoveStarter: onAssignmentRemoveStarter,
                            onSave: onAssignmentSave,
                            onUseCurrentProject: onAssignmentUseCurrentProject,
                            onUseFile: onAssignmentUseFile,
                        }}
                        codeDisplayClassroom={codeDisplayClassroom}
                        codeDisplayFullscreen={false}
                        downloadProgress={downloadProgress}
                        error={error}
                        errorActionHandler={errorActionHandler}
                        errorActionLabel={errorActionLabel}
                        errorTitle={errorTitle}
                        group={selectedGroup}
                        isLoading={isLoading}
                        kickRequestsBySeat={kickRequestsBySeat}
                        members={members}
                        noBackButton
                        selectedClassroom={selectedClassroom}
                        selectedMember={selectedMember}
                        onApproveKickRequest={onApproveKickRequest}
                        onCloseCodeDisplay={onCloseCodeDisplay}
                        onCopyInviteLink={onCopyInviteLink}
                        onDeleteClassroom={onDeleteClassroom}
                        onDeleteMember={onDeleteMember}
                        onDetailTabChange={onDetailTabChange}
                        onDownloadAll={onDownloadAll}
                        onOpenSubmission={onOpenSubmission}
                        onRefresh={onRefreshDetail}
                        onRejectKickRequest={onRejectKickRequest}
                        onReturnSubmission={onReturnSubmission}
                        onSelectMember={onSelectMember}
                        onShowCodeDisplay={onShowCodeDisplay}
                        onShowPostAssignment={authProvider === 'google' ? onShowPostAssignment : null}
                        onToggleCodeFullscreen={onToggleCodeFullscreen}
                        onUpdateAssignmentName={onUpdateAssignmentName}
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
                    importedCourseIds={(groups || [])
                        .filter((g) => g.status !== 'archived')
                        .map((g) => g.googleClassroomCourseId)
                        .filter(Boolean)}
                    isLoading={isLoading}
                    selectedGoogleCourse={selectedGoogleCourse}
                    onBack={onShowClassList}
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

        // Default: dashboard. Inside a class this is the assignment board
        // (topic sections, newest first); without a class it stays the
        // legacy empty prompt.
        if (selectedGroup) {
            return (
                <div className={styles.mainRelative}>
                    <TeacherAssignmentBoard
                        allClassrooms={classrooms}
                        allGroups={groups || []}
                        classrooms={scopedClassrooms}
                        error={error}
                        errorTitle={errorTitle}
                        group={selectedGroup}
                        isLoading={isLoading}
                        onCreateAssignmentInClass={onCreateAssignmentInClass}
                        onReuseAssignment={onReuseAssignment}
                        onSelectClassroom={onSelectClassroom}
                        onShowClassList={onShowClassList}
                        onUpdateAssignmentMeta={onUpdateAssignmentMeta}
                        onUpdateGroupTopics={onUpdateGroupTopics}
                    />
                </div>
            );
        }
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
                {/* Logout lives in the title bar (top-right, before the
                    close ×) so it is reachable from every teacher view. */}
                {phase !== 'teacher-login' && teacherEmail ? (
                    <span className={styles.titleBarEmail} data-testid="classroom-teacher-email">
                        {teacherEmail}
                    </span>
                ) : null}
                {phase !== 'teacher-login' && (
                    <button
                        className={styles.titleBarLogout}
                        data-testid="classroom-teacher-logout"
                        type="button"
                        onClick={onTeacherLogout}
                    >
                        <FormattedMessage
                            defaultMessage="Logout"
                            description="Logout button in the class management title bar"
                            id="gui.classroom.management.titleBarLogout"
                        />
                    </button>
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
