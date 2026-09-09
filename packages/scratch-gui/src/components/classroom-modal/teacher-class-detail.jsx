import classNames from 'classnames';
import { FormattedMessage, useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import ClassCodeDisplay from './class-code-display.jsx';
import ErrorDisplay from './error-display.jsx';
import TeacherAssignmentEditor from './teacher-assignment-editor.jsx';
import TeacherMemberDetail from './teacher-member-detail.jsx';

import { formatClassLabel } from '../../lib/classroom-class-label.js';
import { retentionLevel } from '../../lib/classroom-retention.js';
import googleClassroomIcon from '../classroom-teacher-modal/google-classroom-icon.png';
import styles from './classroom-modal.css';

const TeacherClassDetail = ({
    selectedClassroom,
    members,
    selectedMember,
    isLoading,
    error,
    errorActionLabel,
    errorActionHandler,
    errorTitle,
    noBackButton,
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
    onUpdateAssignmentName,
    codeDisplayClassroom,
    codeDisplayFullscreen,
    kickRequestsBySeat,
    onApproveKickRequest,
    onRejectKickRequest,
    onDetailTabChange,
    onOpenShareSuggestion,
    assignmentEditor,
    group,
}) => {
    // Destructured with handle-prefixed names for the embedded editor
    // (react/jsx-handler-names requires handler props to look like handlers).
    const descEditor = assignmentEditor || {};
    const handleDescAddPage = descEditor.onAddPage;
    const handleDescAttachPageImage = descEditor.onAttachPageImage;
    const handleDescCancel = descEditor.onCancel;
    const handleDescChangePageText = descEditor.onChangePageText;
    const handleDescMovePage = descEditor.onMovePage;
    const handleDescRemovePage = descEditor.onRemovePage;
    const handleDescRemovePageImage = descEditor.onRemovePageImage;
    const handleDescRemoveStarter = descEditor.onRemoveStarter;
    const handleDescSave = descEditor.onSave;
    const handleDescUseCurrentProject = descEditor.onUseCurrentProject;
    const handleDescUseFile = descEditor.onUseFile;
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const deleteConfirmRef = useRef(null);
    const [showCodeDisplay, setShowCodeDisplay] = useState(false);
    // The description tab is the entry view (teacher review): editing the
    // student-facing pages is the primary task when opening an assignment.
    const [activeTab, setActiveTab] = useState('description');
    const [previewPage, setPreviewPage] = useState(0);
    const [editAssignmentName, setEditAssignmentName] = useState(
        selectedClassroom.assignmentName || '',
    );

    // Sync local state when a different classroom is selected
    useEffect(() => {
        setEditAssignmentName(selectedClassroom.assignmentName || '');
        setShowDeleteConfirm(false);
        setShowCodeDisplay(false);
        setActiveTab('description');
        setPreviewPage(0);
        if (onDetailTabChange) onDetailTabChange('description');
    }, [selectedClassroom.classroomId]);

    const handleTabClick = useCallback(
        (e) => {
            const tab = e.currentTarget.dataset.tab;
            setActiveTab(tab);
            // Attendance/submission polling runs only while the members tab
            // is visible (cost control — teacher review).
            if (onDetailTabChange) onDetailTabChange(tab);
        },
        [onDetailTabChange],
    );
    const handlePreviewPrev = useCallback(() => setPreviewPage((i) => Math.max(0, i - 1)), []);
    const handlePreviewNext = useCallback(() => setPreviewPage((i) => i + 1), []);

    const memberMap = React.useMemo(() => {
        const map = {};
        for (const m of members) {
            map[m.memberId] = m;
        }
        return map;
    }, [members]);

    const handleCellClick = useCallback(
        (e) => {
            const memberId = e.currentTarget.dataset.memberId;
            if (memberId) {
                onSelectMember(memberId);
            }
        },
        [onSelectMember],
    );

    const handleDeleteClick = useCallback(() => {
        setShowDeleteConfirm(true);
    }, []);

    // The confirm box appears at the bottom of a long page — bring it into
    // view so the teacher notices it (review round 3).
    useEffect(() => {
        if (showDeleteConfirm && deleteConfirmRef.current) {
            deleteConfirmRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [showDeleteConfirm]);

    const handleDeleteConfirm = useCallback(() => {
        setShowDeleteConfirm(false);
        onDeleteClassroom(selectedClassroom.classroomId);
    }, [onDeleteClassroom, selectedClassroom]);

    const handleDeleteCancel = useCallback(() => {
        setShowDeleteConfirm(false);
    }, []);

    const handleAssignmentNameChange = useCallback((e) => {
        setEditAssignmentName(e.target.value);
    }, []);

    // The name field is a 2-row textarea (long names wrap), but it is still a
    // single-line value — Enter saves and leaves rather than inserting a break.
    const handleAssignmentNameKeyDown = useCallback((e) => {
        // The Enter that commits an IME conversion must not end the edit.
        // React's SyntheticKeyboardEvent omits isComposing, so read the native
        // event; keyCode 229 covers browsers that do not set isComposing.
        if ((e.nativeEvent && e.nativeEvent.isComposing) || e.keyCode === 229) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        }
    }, []);

    const handleAssignmentNameBlur = useCallback(() => {
        const trimmed = editAssignmentName.trim();
        if (trimmed && trimmed !== (selectedClassroom.assignmentName || '') && onUpdateAssignmentName) {
            onUpdateAssignmentName(trimmed);
        }
    }, [editAssignmentName, selectedClassroom, onUpdateAssignmentName]);




    const intl = useIntl();

    // Retention alert level (issue #1052/#1049): drives the inline warning
    // next to the deadline and the urgent styling on the download button.
    const retention = retentionLevel(selectedClassroom && selectedClassroom.expiresAt);

    const handleShowCode = useCallback(() => {
        setShowCodeDisplay(true);
        onShowCodeDisplay(selectedClassroom.classroomId);
    }, [onShowCodeDisplay, selectedClassroom]);

    const [inviteCopied, setInviteCopied] = useState(false);
    const handleCopyInvite = useCallback(() => {
        onCopyInviteLink(selectedClassroom);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
    }, [onCopyInviteLink, selectedClassroom]);

    const handleCloseCode = useCallback(() => {
        setShowCodeDisplay(false);
        onCloseCodeDisplay();
    }, [onCloseCodeDisplay]);

    const isSeated = useCallback((member) => {
        if (!member || !member.lastActiveAt) return false;
        const elapsed = Date.now() - new Date(member.lastActiveAt).getTime();
        return elapsed < 60 * 60 * 1000; // 1 hour
    }, []);

    const joinedCount = members.filter((m) => !m.left).length;
    const totalCount = selectedClassroom.studentCount;

    return (
        <div
            className={styles.detailLayout}
            data-testid="classroom-phase-teacher-detail"
        >
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
                            classroom={
                                codeDisplayClassroom || selectedClassroom
                            }
                            onClose={handleCloseCode}
                            onCopyInviteLink={onCopyInviteLink}
                            onToggleFullscreen={onToggleCodeFullscreen}
                        />
                    </div>
                )
            ) : (
                <React.Fragment>
                    {!noBackButton && (
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
                    )}
                    <div className={styles.detailTwoPaneLayout}>
                        {/* Left pane */}
                        <div className={styles.detailLeftPane}>
                            <div
                                className={styles.teacherViewTitle}
                                data-testid="classroom-detail-name"
                            >
                                {group ? formatClassLabel(group) : selectedClassroom.className}
                            </div>

                            {/* 課題名（左）と参加コード（右）を均等幅の 2 カラムに
                                分け、各カラムを 2 行に収める。参加コードカードが
                                縦に伸びて全体が崩れるのを防ぐ。 */}
                            <div className={styles.nameCodeRow}>
                                {/* 左: 課題名（ラベルと 2 行入力を横並び・ラベルは縦中央） */}
                                <div className={styles.nameCol}>
                                    <span className={styles.assignmentNameLabel}>
                                        <FormattedMessage
                                            defaultMessage="Assignment Name"
                                            description="Assignment name label in class detail"
                                            id="gui.classroom.teacherDetail.assignmentNameLabel"
                                        />
                                        {': '}
                                    </span>
                                    <textarea
                                        className={styles.assignmentNameInput}
                                        data-testid="classroom-detail-assignment-name"
                                        maxLength={50}
                                        rows={2}
                                        value={editAssignmentName}
                                        onBlur={handleAssignmentNameBlur}
                                        onChange={handleAssignmentNameChange}
                                        onKeyDown={handleAssignmentNameKeyDown}
                                    />
                                </div>

                                {/* 右: 参加コードカード。コードとボタンを 1 つの
                                    flex flow に並べ、同じ行から始めることで 3 つの
                                    ボタンが 2 行に収まる。狭い幅では全画面表示・招待
                                    リンクコピーをアイコンのみ、GC 共有を短縮表示。 */}
                                <div className={styles.joinCodeCard}>
                                    <span className={styles.joinCodeCodePart}>
                                        <span className={styles.joinCodeLabel}>
                                            <FormattedMessage
                                                defaultMessage="Join Code"
                                                description="Join code label"
                                                id="gui.classroom.joinCode.label"
                                            />
                                            {': '}
                                        </span>
                                        <span
                                            className={styles.joinCodeValue}
                                            data-testid="classroom-detail-join-code"
                                        >
                                            {selectedClassroom.joinCode.toLowerCase()}
                                        </span>
                                    </span>
                                    {/* 全画面表示: 幅に関わらずアイコンのみ（tooltip でラベル補足） */}
                                    <button
                                            className={styles.joinCodeAction}
                                            data-testid="classroom-detail-expand-code"
                                            title={intl.formatMessage({
                                                id: 'gui.classroom.joinCode.fullscreen',
                                                defaultMessage: 'Show fullscreen',
                                                description: 'Fullscreen the join code',
                                            })}
                                            type="button"
                                            onClick={handleShowCode}
                                        >
                                            <span className={styles.joinCodeIcon}>{'⛶'}</span>
                                        </button>
                                        {/* 招待リンクをコピー: アイコンのみ。クリックすると
                                            アイコンがチェックに変わり、コピー完了を示す。 */}
                                        <button
                                            className={classNames(styles.joinCodeAction, {
                                                [styles.joinCodeActionCopied]: inviteCopied,
                                            })}
                                            data-testid="classroom-detail-copy-link"
                                            title={intl.formatMessage(
                                                inviteCopied
                                                    ? {
                                                          id: 'gui.classroom.codeDisplay.copied',
                                                          defaultMessage: 'Copied',
                                                          description: 'Confirmation after copying invite link',
                                                      }
                                                    : {
                                                          id: 'gui.classroom.codeDisplay.copyLink',
                                                          defaultMessage: 'Copy invite link',
                                                          description: 'Button to copy classroom invite link',
                                                      },
                                            )}
                                            type="button"
                                            onClick={handleCopyInvite}
                                        >
                                            {inviteCopied ? (
                                                <svg
                                                    className={styles.joinCodeIcon}
                                                    fill="none"
                                                    height="15"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    viewBox="0 0 24 24"
                                                    width="15"
                                                >
                                                    <path d="M20 6L9 17l-5-5" />
                                                </svg>
                                            ) : (
                                                <svg
                                                    className={styles.joinCodeIcon}
                                                    fill="none"
                                                    height="15"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    viewBox="0 0 24 24"
                                                    width="15"
                                                >
                                                    <rect
                                                        height="13"
                                                        rx="2"
                                                        ry="2"
                                                        width="13"
                                                        x="9"
                                                        y="9"
                                                    />
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                </svg>
                                            )}
                                        </button>
                                        {/* Google Classroom linkage lives on the class
                                            (group), so an assignment posts to the group's
                                            course even without its own courseId. ボタンは
                                            幅に関わらず "[アイコン]に共有" の短縮表示で固定。 */}
                                        {(selectedClassroom.googleClassroomCourseId ||
                                            (group && group.googleClassroomCourseId)) &&
                                            (selectedClassroom.googleClassroomAlternateLink ? (
                                                <a
                                                    className={classNames(styles.joinCodeAction, styles.joinCodeActionGc)}
                                                    data-testid="classroom-view-assignment"
                                                    href={selectedClassroom.googleClassroomAlternateLink}
                                                    rel="noopener noreferrer"
                                                    target="_blank"
                                                >
                                                    <img
                                                        alt=""
                                                        className={styles.gcImportIcon}
                                                        src={googleClassroomIcon}
                                                    />
                                                    <span className={styles.joinCodeGcLabel}>
                                                        <FormattedMessage
                                                            defaultMessage="Open"
                                                            description="Short label (icon shows Google Classroom) to open the assignment"
                                                            id="gui.classroom.joinCode.openInGcShort"
                                                        />
                                                    </span>
                                                </a>
                                            ) : (
                                                <button
                                                    className={classNames(styles.joinCodeAction, styles.joinCodeActionGc)}
                                                    data-testid="classroom-post-assignment"
                                                    type="button"
                                                    onClick={onShowPostAssignment}
                                                >
                                                    <img
                                                        alt=""
                                                        className={styles.gcImportIcon}
                                                        src={googleClassroomIcon}
                                                    />
                                                    <span className={styles.joinCodeGcLabel}>
                                                        <FormattedMessage
                                                            defaultMessage="Share join code"
                                                            description="Short label (icon shows Google Classroom) to share the join code"
                                                            id="gui.classroom.joinCode.shareToGcShort"
                                                        />
                                                    </span>
                                                </button>
                                            ))}
                                </div>
                            </div>
                            {/* 保存期限とその警告を1行に統合（issue #1052/#1049）:
                                期限が近いときだけ日付の右に警告を出し、専用バナーを
                                廃して縦の表示領域を確保する。狭い幅では「ダウンロード
                                して保存してください」を省略する（CSS の container query）。 */}
                            {selectedClassroom.expiresAt && (
                                <div
                                    className={classNames(styles.expiresAtText, {
                                        [styles.expiresAtNotice]: retention === 'notice',
                                        [styles.expiresAtWarning]: retention === 'warning',
                                    })}
                                >
                                    <span className={styles.expiresAtDate}>
                                        <FormattedMessage
                                            defaultMessage="Kept until: {date}"
                                            description="Retention deadline in assignment detail"
                                            id="gui.classroom.teacherDetail.expiresAt"
                                            values={{
                                                date: new Date(
                                                    selectedClassroom.expiresAt,
                                                ).toLocaleDateString(),
                                            }}
                                        />
                                    </span>
                                    {retention !== 'none' && (
                                        <span
                                            className={styles.expiresAtAlert}
                                            data-testid="classroom-retention-banner"
                                        >
                                            <span className={styles.expiresAtAlertMark}>{'⚠'}</span>
                                            <FormattedMessage
                                                defaultMessage={
                                                    'Once the deadline passes, this assignment ' +
                                                    'and its submissions are deleted automatically.'
                                                }
                                                description="Inline retention warning next to the deadline"
                                                id="gui.classroom.teacherDetail.retentionInline"
                                            />
                                            <span className={styles.expiresAtHint}>
                                                <FormattedMessage
                                                    defaultMessage="Download them to keep a copy."
                                                    description="Retention hint omitted on narrow widths"
                                                    id="gui.classroom.teacherDetail.retentionInlineHint"
                                                />
                                            </span>
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* 共有推奨バナー (#1106): 運営が「みんなの課題に
                                共有する価値がある」と判断した課題。公開は
                                CC BY 同意を伴う先生本人の共有フローのみ。
                                hasAssignment ゲートはボード行の共有ボタンと同じ
                                (中身が無いと共有 API がエラーになる — 推奨後に
                                先生が説明を空にしたケースもここで吸収)。 */}
                            {selectedClassroom.recommendedForSharing &&
                                selectedClassroom.hasAssignment &&
                                onOpenShareSuggestion && (
                                <div
                                    className={styles.shareSuggestionBanner}
                                    data-testid="classroom-share-suggestion-banner"
                                >
                                    <span className={styles.shareSuggestionText}>
                                        <FormattedMessage
                                            defaultMessage="Why not share this assignment to みんなの課題? Operators picked it as worth sharing with teachers nationwide."
                                            description="Banner prompting the teacher to share an operator-recommended assignment (#1106)"
                                            id="gui.classroom.teacherDetail.shareSuggestion"
                                        />
                                    </span>
                                    <button
                                        className={styles.shareSuggestionButton}
                                        data-testid="classroom-share-suggestion-open"
                                        type="button"
                                        onClick={onOpenShareSuggestion}
                                    >
                                        <FormattedMessage
                                            defaultMessage="Open the share form"
                                            description="Banner CTA that opens the existing share flow (#1106)"
                                            id="gui.classroom.teacherDetail.shareSuggestionOpen"
                                        />
                                    </button>
                                </div>
                            )}

                            {/* Tabs: Description (default) / Members */}
                            <div className={styles.detailTabs} role="tablist">
                                <button
                                    className={classNames(
                                        styles.detailTab,
                                        activeTab === 'description' && styles.detailTabActive,
                                    )}
                                    data-tab="description"
                                    data-testid="classroom-tab-description"
                                    onClick={handleTabClick}
                                >
                                    <FormattedMessage
                                        defaultMessage="Description"
                                        description="Assignment description tab label"
                                        id="gui.classroom.teacherDetail.descriptionTab"
                                    />
                                </button>
                                <button
                                    className={classNames(
                                        styles.detailTab,
                                        activeTab === 'members' && styles.detailTabActive,
                                    )}
                                    data-tab="members"
                                    data-testid="classroom-tab-members"
                                    onClick={handleTabClick}
                                >
                                    <FormattedMessage
                                        defaultMessage="Members"
                                        description="Members list title"
                                        id="gui.classroom.members.title"
                                    />
                                </button>
                                <button
                                    className={classNames(styles.secondaryButton, styles.detailTabsDownload, {
                                        [styles.detailTabsDownloadUrgent]: retention !== 'none',
                                    })}
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
                                {/* 共有導線はボード（課題一覧）の各行「共有」に一本化した
                                    （#1109）。課題詳細タブ行の共有ボタンは廃止。 */}
                            </div>

                            {/* Description tab: the student-facing pages editor.
                                Changes reach students only on save. */}
                            {activeTab === 'description' && assignmentEditor && (
                                <TeacherAssignmentEditor
                                    editorPages={descEditor.editorPages}
                                    embedded
                                    error={null}
                                    errorTitle={null}
                                    hasExistingStarter={descEditor.hasExistingStarter}
                                    isSaving={descEditor.isSaving}
                                    selectedClassroom={selectedClassroom}
                                    starterMode={descEditor.starterMode}
                                    starterSource={descEditor.starterSource}
                                    onAddPage={handleDescAddPage}
                                    onAttachPageImage={handleDescAttachPageImage}
                                    onCancel={handleDescCancel}
                                    onChangePageText={handleDescChangePageText}
                                    onMovePage={handleDescMovePage}
                                    onRemovePage={handleDescRemovePage}
                                    onRemovePageImage={handleDescRemovePageImage}
                                    onRemoveStarter={handleDescRemoveStarter}
                                    onSave={handleDescSave}
                                    onUseCurrentProject={handleDescUseCurrentProject}
                                    onUseFile={handleDescUseFile}
                                />
                            )}

                            {/* Members tab: legend + count/refresh + seat grid */}
                            {activeTab === 'members' && (
                                <React.Fragment>
                            <div className={styles.membersHeader}>
                                <div className={styles.membersLegend}>
                                    <span className={`${styles.legendItem} ${styles.memberCellJoined}`}>
                                        <span className={styles.legendSeated}>
                                            <FormattedMessage defaultMessage="Seated" description="Legend: seated" id="gui.classroom.teacherDetail.legend.seated" />
                                        </span>
                                    </span>
                                    <span className={`${styles.legendItem} ${styles.memberCellSubmitted}`}>
                                        <FormattedMessage defaultMessage="Submitted" description="Legend: submitted" id="gui.classroom.teacherDetail.legend.submitted" />
                                    </span>
                                    <span className={`${styles.legendItem} ${styles.memberCellReturned}`}>
                                        <FormattedMessage defaultMessage="Returned" description="Legend: returned" id="gui.classroom.teacherDetail.legend.returned" />
                                    </span>
                                </div>
                                <div className={styles.membersHeaderRight}>
                                    <span
                                        className={styles.membersCount}
                                        data-testid="classroom-members-count"
                                    >
                                        {joinedCount}
                                        {' / '}
                                        {totalCount}
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
                                {Array.from(
                                    { length: totalCount },
                                    (_, i) => {
                                        const seatNum = i + 1;
                                        const memberId = `seat-${String(seatNum).padStart(2, '0')}`;
                                        const member = memberMap[memberId];
                                        const isSelected =
                                            selectedMember === memberId;
                                        const hasSubmission =
                                            member && member.hasSubmission;
                                        const isReturned =
                                            member &&
                                            member.submissionStatus ===
                                                'returned';
                                        const seated =
                                            member &&
                                            isSeated(member);
                                        let cellColorClass =
                                            styles.memberCellEmpty;
                                        if (member) {
                                            if (isReturned) {
                                                cellColorClass =
                                                    styles.memberCellReturned;
                                            } else if (hasSubmission) {
                                                cellColorClass =
                                                    styles.memberCellSubmitted;
                                            } else {
                                                cellColorClass =
                                                    styles.memberCellJoined;
                                            }
                                        }
                                        const cellClass = classNames(
                                            styles.memberCell,
                                            cellColorClass,
                                            isSelected &&
                                                styles.memberCellSelected,
                                            seated &&
                                                styles.memberCellSeated,
                                        );
                                        const seatKickRequests =
                                            (kickRequestsBySeat && kickRequestsBySeat[seatNum]) || [];
                                        return (
                                            <button
                                                className={cellClass}
                                                data-member-id={memberId}
                                                data-testid={`classroom-member-${memberId}`}
                                                key={memberId}
                                                onClick={handleCellClick}
                                            >
                                                {seatNum}
                                                {seatKickRequests.length > 0 && (
                                                    <span
                                                        className={styles.seatKickRequestBadge}
                                                        data-testid={`classroom-seat-kick-request-${seatNum}`}
                                                        title="退室リクエストあり"
                                                    >
                                                        !
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    },
                                )}
                            </div>
                                </React.Fragment>
                            )}


                            {/* Archive assignment (soft-delete, restorable — issue #1051).
                                data-testids keep the historical "delete" names for E2E stability. */}
                            <div className={styles.detailFooter}>
                                <ErrorDisplay
                                    actionLabel={errorActionLabel}
                                    error={error}
                                    errorTitle={errorTitle}
                                    onAction={errorActionHandler}
                                />
                                {showDeleteConfirm ? (
                                    <div className={styles.deleteConfirmBox} ref={deleteConfirmRef}>
                                        <div
                                            className={
                                                styles.deleteConfirmMessage
                                            }
                                        >
                                            <FormattedMessage
                                                defaultMessage="Archive this assignment? It disappears from the board, but you can restore it anytime from the archived assignments section."
                                                description="Archive assignment confirmation message"
                                                id="gui.classroom.teacherDetail.archiveConfirm"
                                            />
                                        </div>
                                        <div className={styles.buttonRow}>
                                            <button
                                                className={
                                                    styles.secondaryButton
                                                }
                                                data-testid="classroom-delete-cancel"
                                                onClick={handleDeleteCancel}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Cancel"
                                                    description="Cancel archiving the assignment"
                                                    id="gui.classroom.teacherDetail.archiveCancel"
                                                />
                                            </button>
                                            <button
                                                className={
                                                    styles.dangerButton
                                                }
                                                data-testid="classroom-delete-confirm"
                                                onClick={handleDeleteConfirm}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Archive"
                                                    description="Confirm archive assignment button"
                                                    id="gui.classroom.teacherDetail.archive"
                                                />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        className={
                                            styles.detailFooterButtons
                                        }
                                    >
                                        <button
                                            className={styles.dangerButton}
                                            data-testid="classroom-delete-classroom"
                                            disabled={isLoading}
                                            onClick={handleDeleteClick}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Archive the assignment"
                                                description="Archive assignment button (soft-delete, restorable)"
                                                id="gui.classroom.teacherDetail.archiveClassroom"
                                            />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right pane - member detail */}
                        <div className={styles.detailRightPane}>
                            {activeTab === 'description' && assignmentEditor ? (
                                <div className={styles.assignmentPreview} data-testid="classroom-description-preview">
                                    {(() => {
                                        const pages = descEditor.editorPages || [];
                                        const index = Math.min(previewPage, Math.max(0, pages.length - 1));
                                        const page = pages[index];
                                        return (
                                            <React.Fragment>
                                                {/* Pager on top so it is visible without scrolling
                                                    past a tall preview (review round 3). */}
                                                <div className={styles.assignmentPreviewHeader}>
                                                    <div className={styles.assignmentPreviewTitle}>
                                                        <FormattedMessage
                                                            defaultMessage="Student view preview"
                                                            description="Title of the student-view preview pane"
                                                            id="gui.classroom.teacherDetail.previewTitle"
                                                        />
                                                    </div>
                                                    {pages.length > 1 ? (
                                                        <div className={styles.assignmentPreviewPager}>
                                                            <button
                                                                data-testid="classroom-description-preview-prev"
                                                                disabled={index === 0}
                                                                type="button"
                                                                onClick={handlePreviewPrev}
                                                            >
                                                                {'←'}
                                                            </button>
                                                            <span>{`${index + 1} / ${pages.length}`}</span>
                                                            <button
                                                                data-testid="classroom-description-preview-next"
                                                                disabled={index >= pages.length - 1}
                                                                type="button"
                                                                onClick={handlePreviewNext}
                                                            >
                                                                {'→'}
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <div
                                                    className={styles.assignmentPreviewBody}
                                                    data-testid="classroom-description-preview-body"
                                                >
                                                    {/* Image above text — matches the student panel. */}
                                                    {page && (page.previewUrl || page.imageUrl) ? (
                                                        <img
                                                            alt=""
                                                            className={styles.assignmentPreviewImage}
                                                            src={page.previewUrl || page.imageUrl}
                                                        />
                                                    ) : null}
                                                    <p className={styles.assignmentPreviewText}>
                                                        {page ? page.text : ''}
                                                    </p>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })()}
                                </div>
                            ) : (
                            <TeacherMemberDetail
                                isLoading={isLoading}
                                kickRequestsForSelectedSeat={(() => {
                                    if (!selectedMember || !kickRequestsBySeat) return [];
                                    const match = selectedMember.match(/^seat-(\d+)$/);
                                    if (!match) return [];
                                    return kickRequestsBySeat[parseInt(match[1], 10)] || [];
                                })()}
                                memberMap={memberMap}
                                members={members}
                                selectedMember={selectedMember}
                                onApproveKickRequest={onApproveKickRequest}
                                onDeleteMember={onDeleteMember}
                                onOpenSubmission={onOpenSubmission}
                                onRejectKickRequest={onRejectKickRequest}
                                onReturnSubmission={onReturnSubmission}
                            />
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
    downloadProgress: PropTypes.shape({
        current: PropTypes.number,
        total: PropTypes.number,
    }),
    error: PropTypes.string,
    errorActionLabel: PropTypes.string,
    errorActionHandler: PropTypes.func,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    members: PropTypes.arrayOf(PropTypes.object).isRequired,
    noBackButton: PropTypes.bool,
    onBack: PropTypes.func,
    onCloseCodeDisplay: PropTypes.func.isRequired,
    onCopyInviteLink: PropTypes.func.isRequired,
    onDeleteClassroom: PropTypes.func.isRequired,
    onDeleteMember: PropTypes.func.isRequired,
    onDownloadAll: PropTypes.func.isRequired,
    onOpenSubmission: PropTypes.func.isRequired,
    onRefresh: PropTypes.func.isRequired,
    onReturnSubmission: PropTypes.func.isRequired,
    onSelectMember: PropTypes.func.isRequired,
    onShowCodeDisplay: PropTypes.func.isRequired,
    onShowPostAssignment: PropTypes.func,
    onToggleCodeFullscreen: PropTypes.func.isRequired,
    onUpdateAssignmentName: PropTypes.func,
    kickRequestsBySeat: PropTypes.object,
    onApproveKickRequest: PropTypes.func,
    onRejectKickRequest: PropTypes.func,
    onDetailTabChange: PropTypes.func,
    onOpenShareSuggestion: PropTypes.func,
    assignmentEditor: PropTypes.object,
    group: PropTypes.object,
    selectedClassroom: PropTypes.object.isRequired,
    selectedMember: PropTypes.string,
};

export default TeacherClassDetail;
