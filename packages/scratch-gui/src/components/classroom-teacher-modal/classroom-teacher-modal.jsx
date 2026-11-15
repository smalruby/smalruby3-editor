/**
 * Teacher fullscreen class management modal.
 *
 * Separate from the student ClassroomModal. Renders a fullscreen overlay
 * with a sidebar (class list) and a main area that shows phase content.
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import Modal from '../../containers/modal.jsx';
import { formatClassLabel } from '../../lib/classroom-class-label.js';
import TeacherAssignmentBoard from '../classroom-modal/teacher-assignment-board.jsx';
import TeacherBreadcrumbs, {
    BreadcrumbSlotContext,
    breadcrumbMessages,
} from '../classroom-modal/teacher-breadcrumbs.jsx';
import TeacherClassDetail from '../classroom-modal/teacher-class-detail.jsx';
import TeacherClassList from '../classroom-modal/teacher-class-list.jsx';
import TeacherClassTabs from '../classroom-modal/teacher-class-tabs.jsx';
import TeacherEvaluation from '../classroom-modal/teacher-evaluation.jsx';
import TeacherPostAssignment from '../classroom-modal/teacher-post-assignment.jsx';
import ClassroomTutorial from '../classroom-tutorial/classroom-tutorial.jsx';
import Spinner from '../spinner/spinner.jsx';
import styles from './classroom-teacher-modal.css';
import TeacherAvatarMenu from './teacher-avatar-menu.jsx';
import TeacherGoogleCoursesPhase from './teacher-google-courses-phase.jsx';
import TeacherHeader from './teacher-header.jsx';
import TeacherLoginPhase from './teacher-login-phase.jsx';
import TeacherNotificationsList from './teacher-notifications-list.jsx';
import TeacherNotifications from './teacher-notifications.jsx';

const messagesBreadcrumbs = defineMessages({
    assignments: {
        defaultMessage: 'Assignments',
        description: 'Breadcrumb link back to the assignment board',
        id: 'gui.classroom.breadcrumbs.assignments',
    },
    shareGc: {
        defaultMessage: 'Share to Google Classroom',
        description: 'Breadcrumb label of the Google Classroom share view',
        id: 'gui.classroom.breadcrumbs.shareGc',
    },
});

const messages = { title: breadcrumbMessages.top };

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
        downloadProgress,
        googleCourses,
        googleCourseAccess,
        isVerifyingGoogleCourseAccess,
        onVerifyGoogleCourseAccess,
        selectedGoogleCourse,
        googleSignInRef,
        googleFallbackReason,
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
        onSetHiddenFromPeers,
        onDownloadAll,
        onDownloadClassAll,
        onCopyInviteLink,
        onShowPostAssignment,
        onBackToDetail,
        onPostAssignment,
        onShowGoogleCourses,
        onLoadGoogleCourses,
        onSelectGoogleCourse,
        onConfirmGoogleImport,
        onUpdateAssignmentName,
        kickRequestsBySeat,
        lessonProgress,
        onApproveKickRequest,
        onRejectKickRequest,
        assignmentEditorPages,
        assignmentStarterMode,
        assignmentStarterSource,
        assignmentHasExistingStarter,
        assignmentIsSaving,
        assignmentPeerView,
        assignmentMeshGroupLimit,
        assignmentSavedSettings,
        assignmentLessonDraft,
        assignmentSavedLesson,
        onAssignmentAddPage,
        onAssignmentRemovePage,
        onAssignmentMovePage,
        onAssignmentChangePageText,
        onAssignmentAttachPageImage,
        onAssignmentRemovePageImage,
        onAssignmentUseCurrentProject,
        onAssignmentUseFile,
        onAssignmentRemoveStarter,
        onAssignmentChangePeerView,
        onAssignmentChangeMeshGroupLimit,
        onAssignmentChangeLesson,
        assignmentLessonPanelAutoOpen,
        assignmentDescriptionQuestion,
        onAssignmentLessonPanelClose,
        onAssignmentLessonPanelAutoOpened,
        onAssignmentAnswerDescriptionQuestion,
        onAssignmentSave,
        groups,
        teacherEmail,
        selectedGroup,
        onSelectGroup,
        onShowClassList,
        onCreateClassWithAssignment,
        onUpdateGroupTopics,
        onUpdateAssignmentMeta,
        onLoadAssignmentSummary,
        onCreateAssignmentInClass,
        onReuseAssignment,
        onDetailTabChange,
        detailEntry,
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

    // A class opens on［ストリーム］(B5). Coming back from an assignment of the
    // same class returns to the tab the teacher left (e.g.［授業］); another
    // class or the class list starts on the stream again.
    const [boardTab, setBoardTab] = useState({ groupId: null, tab: 'stream' });
    const selectedGroupId = selectedGroup ? selectedGroup.groupId : null;
    const handleBoardTabChange = useCallback(
        (tab) => setBoardTab({ groupId: selectedGroupId, tab }),
        [selectedGroupId],
    );
    // Leaving the class (the class list clears selectedGroup) forgets the tab.
    useEffect(() => {
        if (!selectedGroupId) setBoardTab({ groupId: null, tab: 'stream' });
    }, [selectedGroupId]);

    // Opening a class scopes the board to its assignments (GC style).
    const scopedClassrooms = selectedGroup
        ? classrooms.filter((c) => c.groupId === selectedGroup.groupId)
        : classrooms;
    const scopedArchivedClassrooms = selectedGroup
        ? (archivedClassrooms || []).filter((c) => c.groupId === selectedGroup.groupId)
        : archivedClassrooms || [];

    // パンくずでボードへ戻る crumb はクラス名（ボードは［ストリーム］［授業］のタブを持つ
    // クラスの画面）。クラスに属さない古い課題だけ従来の「課題一覧」。
    const classCrumbLabel = selectedGroup
        ? formatClassLabel(selectedGroup)
        : intl.formatMessage(messagesBreadcrumbs.assignments);
    // The assignment's own name in the header path (#1956 Q12:「課題詳細」→ 課題名).
    const assignmentCrumbLabel = selectedClassroom
        ? selectedClassroom.assignmentName || selectedClassroom.className || ''
        : '';
    // The header path starts at 「クラス管理」, which always goes back to the class cards.
    const topCrumb = {
        label: intl.formatMessage(messages.title),
        onClick: onShowClassList,
        testId: 'classroom-breadcrumb-class-list',
    };

    // ［ストリーム］［授業］ from the grading screen: back to this class's board on that tab.
    // Leaving the grading screen asks first when work would be lost (#1948).
    const evalGroup = evaluation ? evaluation.evalGroup : null;
    const handleEvaluationTab = useCallback(
        (tab) => {
            if (!evaluation || !evalGroup || tab === 'grading') return;
            evaluation.handleRequestLeave(() => {
                evaluation.handleBackFromEvaluation();
                setBoardTab({ groupId: evalGroup.groupId, tab });
                onSelectGroup(evalGroup);
            }, 'leave');
        },
        [evaluation, evalGroup, onSelectGroup],
    );
    // The grading screen's cancel goes back to where it was opened (#1958 Q1): the class
    // when it was opened from the class's［採点］tab, the class cards from a card.
    const [gradingOpenedFrom, setGradingOpenedFrom] = useState('list');
    const handleShowGradingFromClass = useCallback(
        (group) => {
            setGradingOpenedFrom('class');
            evaluation.handleShowEvaluation(group);
        },
        [evaluation],
    );
    const handleShowGradingFromList = useCallback(
        (group) => {
            setGradingOpenedFrom('list');
            evaluation.handleShowEvaluation(group);
        },
        [evaluation],
    );
    const handleBackFromEvaluation = useCallback(() => {
        if (!evaluation) return;
        evaluation.handleBackFromEvaluation();
        if (gradingOpenedFrom === 'class' && evalGroup) onSelectGroup(evalGroup);
    }, [evaluation, gradingOpenedFrom, evalGroup, onSelectGroup]);
    const handleShowClassListFromEvaluation = useCallback(() => {
        if (evaluation) evaluation.handleBackFromEvaluation();
        onShowClassList();
    }, [evaluation, onShowClassList]);

    // The header's slot that the screens' paths are carried to (portal target).
    const [crumbSlot, setCrumbSlot] = useState(null);

    // After a link in the header path or the［採点］tab moves to another screen, the
    // pressed button is gone: put the focus on the new screen (main) instead of the
    // page (#1958 FYI1). When the button is still there (e.g. the grading screen asks
    // first), the focus stays where that screen put it.
    const mainRef = useRef(null);
    const handleNavClickCapture = useCallback((event) => {
        const button = event.target && event.target.closest ? event.target.closest('button') : null;
        if (!button) return;
        const isPathLink = !!button.closest('[data-testid="classroom-breadcrumbs"]');
        const isGradingTab = button.getAttribute('data-tab') === 'grading';
        if (!isPathLink && !isGradingTab) return;
        setTimeout(() => {
            if (button.isConnected && document.activeElement !== document.body) return;
            if (mainRef.current) mainRef.current.focus({ preventScroll: true });
        }, 0);
    }, []);

    const renderMain = () => {
        if (phase === 'teacher-login') {
            return (
                <TeacherLoginPhase
                    error={error}
                    errorTitle={errorTitle}
                    googleFallbackReason={googleFallbackReason}
                    googleSignInRef={googleSignInRef}
                    isMicrosoftAuthAvailable={isMicrosoftAuthAvailable}
                    onGoogleLogin={onGoogleLogin}
                    onMicrosoftLogin={onMicrosoftLogin}
                />
            );
        }

        if (phase === 'teacher-notifications' && notificationsCenter) {
            return (
                <div className={styles.mainRelative}>
                    {/* ポリシー: ヘッダーの「クラス管理」でいつでもトップ
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
                        onShowEvaluation={evaluation ? handleShowGradingFromList : null}
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
                        leaveRequest={evaluation.leaveRequest}
                        lessonScores={evaluation.lessonScores}
                        rubricAxes={evaluation.rubricAxes}
                        scoringChecked={evaluation.scoringChecked}
                        scoringSavingId={evaluation.scoringSavingId}
                        seats={evaluation.seats}
                        selectedLessonIds={evaluation.selectedLessonIds}
                        strictness={evaluation.strictness}
                        tabs={
                            evaluation.evalGroup ? (
                                <TeacherClassTabs selected="grading" onSelect={handleEvaluationTab} />
                            ) : null
                        }
                        unsavedWork={evaluation.unsavedWork}
                        onBack={handleBackFromEvaluation}
                        onShowClassList={handleShowClassListFromEvaluation}
                        onCancelLeave={evaluation.handleCancelLeave}
                        onConfirmLeave={evaluation.handleConfirmLeave}
                        onRequestLeave={evaluation.handleRequestLeave}
                        onChangeLessonScoring={evaluation.handleChangeLessonScoring}
                        onChangeRubricAxis={evaluation.handleChangeRubricAxis}
                        onCheckScoring={evaluation.handleCheckScoring}
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
                <div className={styles.mainFill}>
                    <TeacherBreadcrumbs
                        items={[
                            topCrumb,
                            {
                                label: classCrumbLabel,
                                onClick: onBackToDashboard,
                                testId: 'classroom-breadcrumb-assignments',
                            },
                            { label: assignmentCrumbLabel, testId: 'classroom-breadcrumb-assignment-name' },
                        ]}
                    />
                    <TeacherClassDetail
                        assignmentEditor={{
                            editorPages: assignmentEditorPages,
                            starterMode: assignmentStarterMode,
                            starterSource: assignmentStarterSource,
                            hasExistingStarter: assignmentHasExistingStarter,
                            isSaving: assignmentIsSaving,
                            peerView: assignmentPeerView,
                            meshGroupLimit: assignmentMeshGroupLimit,
                            savedSettings: assignmentSavedSettings,
                            lessonDraft: assignmentLessonDraft,
                            savedLesson: assignmentSavedLesson,
                            onAddPage: onAssignmentAddPage,
                            onAttachPageImage: onAssignmentAttachPageImage,
                            onChangePageText: onAssignmentChangePageText,
                            onMovePage: onAssignmentMovePage,
                            onRemovePage: onAssignmentRemovePage,
                            onRemovePageImage: onAssignmentRemovePageImage,
                            onRemoveStarter: onAssignmentRemoveStarter,
                            onChangePeerView: onAssignmentChangePeerView,
                            onChangeMeshGroupLimit: onAssignmentChangeMeshGroupLimit,
                            onChangeLesson: onAssignmentChangeLesson,
                            lessonPanelAutoOpen: assignmentLessonPanelAutoOpen,
                            descriptionQuestion: assignmentDescriptionQuestion,
                            onLessonPanelClose: onAssignmentLessonPanelClose,
                            onLessonPanelAutoOpened: onAssignmentLessonPanelAutoOpened,
                            onAnswerDescriptionQuestion: onAssignmentAnswerDescriptionQuestion,
                            onSave: onAssignmentSave,
                            onUseCurrentProject: onAssignmentUseCurrentProject,
                            onUseFile: onAssignmentUseFile,
                        }}
                        downloadProgress={downloadProgress}
                        error={error}
                        errorActionHandler={errorActionHandler}
                        errorActionLabel={errorActionLabel}
                        errorTitle={errorTitle}
                        googleCourseAccess={googleCourseAccess}
                        group={selectedGroup}
                        isLoading={isLoading}
                        isVerifyingGoogleCourseAccess={isVerifyingGoogleCourseAccess}
                        kickRequestsBySeat={kickRequestsBySeat}
                        lessonProgress={lessonProgress}
                        members={members}
                        noBackButton
                        selectedClassroom={selectedClassroom}
                        selectedMember={selectedMember}
                        onApproveKickRequest={onApproveKickRequest}
                        onCopyInviteLink={onCopyInviteLink}
                        onDeleteClassroom={onDeleteClassroom}
                        onDeleteMember={onDeleteMember}
                        detailEntry={detailEntry}
                        onDetailTabChange={onDetailTabChange}
                        onDownloadAll={onDownloadAll}
                        onOpenSubmission={onOpenSubmission}
                        onRefresh={onRefreshDetail}
                        onRejectKickRequest={onRejectKickRequest}
                        onReturnSubmission={onReturnSubmission}
                        onSetHiddenFromPeers={onSetHiddenFromPeers}
                        onSelectMember={onSelectMember}
                        shared={shared}
                        onOpenShareSuggestion={handleOpenShareSuggestion}
                        onShowPostAssignment={authProvider === 'google' ? onShowPostAssignment : null}
                        onVerifyGoogleCourseAccess={authProvider === 'google' ? onVerifyGoogleCourseAccess : null}
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
                    <TeacherBreadcrumbs
                        items={[
                            topCrumb,
                            {
                                label: classCrumbLabel,
                                onClick: onBackToDashboard,
                                testId: 'classroom-breadcrumb-assignments',
                            },
                            {
                                label: assignmentCrumbLabel,
                                onClick: onBackToDetail,
                                testId: 'classroom-breadcrumb-assignment-detail',
                            },
                            { label: intl.formatMessage(messagesBreadcrumbs.shareGc) },
                        ]}
                    />
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
                        key={selectedGroup.groupId}
                        allClassrooms={classrooms}
                        allGroups={groups || []}
                        archivedClassrooms={scopedArchivedClassrooms}
                        classrooms={scopedClassrooms}
                        downloadProgress={downloadProgress}
                        error={error}
                        errorTitle={errorTitle}
                        group={selectedGroup}
                        initialTab={boardTab.groupId === selectedGroup.groupId ? boardTab.tab : 'stream'}
                        isLoading={isLoading}
                        shared={shared}
                        onCreateAssignmentInClass={onCreateAssignmentInClass}
                        onDownloadClassAll={onDownloadClassAll}
                        onLoadAssignmentSummary={onLoadAssignmentSummary}
                        onRestoreClassroom={onRestoreClassroom}
                        onReuseAssignment={onReuseAssignment}
                        onSelectClassroom={onSelectClassroom}
                        onShowClassList={onShowClassList}
                        onShowGrading={evaluation ? handleShowGradingFromClass : null}
                        onTabChange={handleBoardTabChange}
                        onUpdateAssignmentMeta={onUpdateAssignmentMeta}
                        onUpdateGroup={onUpdateGroup}
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
                            'Let\'s start by creating a "Class"!\nCreate one class per lesson, e.g. "Lesson 3: Make a Chat App".\nClick the "Create a class" button.'
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
            headerClassName={styles.modalHeaderHidden}
            id="classroomTeacherModal"
            onRequestClose={onClose}
        >
            <div
                className={styles.layout}
                data-testid="classroom-teacher-modal"
                onClickCapture={handleNavClickCapture}
            >
                {/* 紫のヘッダー（#1956 Q2）:「← エディタに戻る｜クラス管理 › クラス名 › 課題名」。
                    右は通知ベル → アバターメニュー（#1111 レビュー）。共有 Modal のヘッダーは
                    隠し、この画面のヘッダーを置く（upstream の Modal を変えないため）。 */}
                <TeacherHeader slotRef={setCrumbSlot} onBackToEditor={onClose}>
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
                </TeacherHeader>
                <BreadcrumbSlotContext.Provider value={crumbSlot}>
                    <main className={styles.main} ref={mainRef} tabIndex={-1}>
                        {renderMain()}
                    </main>
                </BreadcrumbSlotContext.Provider>
            </div>
        </Modal>
    );
};

ClassroomTeacherModal.propTypes = {
    containerProps: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default ClassroomTeacherModal;
