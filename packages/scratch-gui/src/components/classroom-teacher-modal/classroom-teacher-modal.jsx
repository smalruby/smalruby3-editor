/**
 * Teacher fullscreen class management modal.
 *
 * Separate from the student ClassroomModal. Renders a fullscreen overlay
 * with a sidebar (class list) and a main area that shows phase content.
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
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
import TeacherNotifications from './teacher-notifications.jsx';
import TeacherNotificationsList from './teacher-notifications-list.jsx';
import TeacherAvatarMenu from './teacher-avatar-menu.jsx';

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
    shareGc: {
        defaultMessage: 'Share to Google Classroom',
        description: 'Breadcrumb label of the Google Classroom share view',
        id: 'gui.classroom.breadcrumbs.shareGc',
    },
});

const messages = defineMessages({
    title: {
        defaultMessage: 'Class Management',
        description: 'Title for the teacher class management modal',
        id: 'gui.classroom.management.title',
    },
});

/**
 * 共有ステップ (#1106 バナー CTA) を載せるボードのグループを選ぶ。
 * 優先順: この課題の所属グループ → 現在選択中 → 先頭のアクティブグループ。
 * @param {object} selectedClassroom - 対象の課題 (classroom summary)
 * @param {object|null} selectedGroup - 現在選択中のグループ
 * @param {Array<object>} groups - 先生の全グループ
 * @returns {object|null} 選ばれたグループ (無ければ null)
 */
export const pickShareSuggestionGroup = (selectedClassroom, selectedGroup, groups) =>
    (groups || []).find((g) => g.groupId === selectedClassroom?.groupId) ||
    selectedGroup ||
    (groups || []).find((g) => g.status !== 'archived') ||
    null;

const ClassroomTeacherModal = ({ containerProps, onClose }) => {
    const intl = useIntl();
    const {
        phase,
        classrooms,
        archivedClassrooms,
        onRestoreClassroom,
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
        onDownloadClassAll,
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
        shared,
        notificationsCenter,
    } = containerProps;

    // 共有推奨バナー (#1106) の CTA: 共有ステップはボード内サブビュー
    // (= selectedGroup が必須) なので、必ずグループを選んでから開く。
    // 未グループの課題 (レガシー) や selectedGroup が無い経路でも、この課題の
    // 所属グループ → 現在のグループ → 先頭のアクティブグループの順で拾う
    // (#1110 レビューと同型の「phase を戻さず無反応」欠陥への対処)。
    const handleOpenShareSuggestion = useCallback(() => {
        if (!selectedClassroom || !shared) return;
        const group = pickShareSuggestionGroup(selectedClassroom, selectedGroup, groups);
        if (!group) return; // クラスが無い = 共有ステップを出す場所が無い
        onSelectGroup(group);
        shared.handleOpenShareFor(selectedClassroom);
    }, [selectedClassroom, selectedGroup, groups, shared, onSelectGroup]);

    // Opening a class scopes the board to its assignments (GC style).
    const scopedClassrooms = selectedGroup
        ? classrooms.filter((c) => c.groupId === selectedGroup.groupId)
        : classrooms;
    const scopedArchivedClassrooms = selectedGroup
        ? (archivedClassrooms || []).filter((c) => c.groupId === selectedGroup.groupId)
        : archivedClassrooms || [];

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

        if (phase === 'teacher-notifications' && notificationsCenter) {
            return (
                <div className={styles.mainRelative}>
                    <div className={styles.detailBreadcrumbs}>
                        {/* ポリシー: パンくずの先頭「クラス管理」でいつでもトップ
                            （クラス一覧）へ戻れる（#1111 レビュー）。 */}
                        <TeacherBreadcrumbs
                            items={[
                                {
                                    label: intl.formatMessage(messages.title),
                                    onClick: onShowClassList,
                                    testId: 'classroom-breadcrumb-top',
                                },
                                {
                                    label: intl.formatMessage({
                                        defaultMessage: 'Notifications',
                                        description: 'Breadcrumb label of the notification list page',
                                        id: 'gui.classroom.notifications.title',
                                    }),
                                },
                            ]}
                        />
                    </div>
                    <TeacherNotificationsList
                        notifications={notificationsCenter.notifications}
                        onBack={onShowClassList}
                        onOpenLink={notificationsCenter.handleOpenLink}
                    />
                </div>
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
                        shared={shared}
                        onOpenShareSuggestion={handleOpenShareSuggestion}
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
                                {
                                    label: intl.formatMessage(messagesBreadcrumbs.assignmentDetail),
                                    onClick: onBackToDetail,
                                    testId: 'classroom-breadcrumb-assignment-detail',
                                },
                                { label: intl.formatMessage(messagesBreadcrumbs.shareGc) },
                            ]}
                        />
                    </div>
                    <TeacherPostAssignment
                        error={error}
                        errorTitle={errorTitle}
                        group={selectedGroup}
                        isLoading={isLoading}
                        selectedClassroom={selectedClassroom}
                        onBack={onBackToDetail}
                        onPostAssignment={onPostAssignment}
                    />
                </div>
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
                        archivedClassrooms={scopedArchivedClassrooms}
                        classrooms={scopedClassrooms}
                        downloadProgress={downloadProgress}
                        error={error}
                        errorTitle={errorTitle}
                        group={selectedGroup}
                        isLoading={isLoading}
                        shared={shared}
                        onCreateAssignmentInClass={onCreateAssignmentInClass}
                        onDownloadClassAll={onDownloadClassAll}
                        onRestoreClassroom={onRestoreClassroom}
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
                {/* タイトルバー右上（× の左）: 通知ベル → アバターメニュー。
                    アバターは右上固定でアカウント（メール頭文字）を示し、
                    クリックでログアウト等のメニューを出す（#1111 レビュー）。 */}
                {phase !== 'teacher-login' && notificationsCenter && (
                    <TeacherNotifications
                        isOpen={notificationsCenter.isOpen}
                        notifications={notificationsCenter.notifications}
                        unreadCount={notificationsCenter.unreadCount}
                        onMarkAllRead={notificationsCenter.handleMarkAllRead}
                        onOpenLink={notificationsCenter.handleOpenLink}
                        onShowAll={notificationsCenter.handleShowAll}
                        onToggle={notificationsCenter.handleToggleNotifications}
                    />
                )}
                {phase !== 'teacher-login' && (
                    <TeacherAvatarMenu email={teacherEmail} onLogout={onTeacherLogout} />
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
