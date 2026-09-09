/**
 * Assignment board — the main view inside a class (Google Classroom style):
 * assignments without a topic listed first, then one section per topic,
 * newest (sortDate) first. Rows edit their topic / sort date in place, and
 * the chip bar manages the class's topic list (rename/remove cascade to the
 * assignments on the server).
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { buildAssignmentSections } from '../../lib/classroom-group-utils.js';
import { formatClassLabel } from '../../lib/classroom-class-label.js';
import { retentionLevel } from '../../lib/classroom-retention.js';
import ErrorDisplay from './error-display.jsx';
import SharedAssignmentCatalog from './shared-assignment-catalog.jsx';
import TeacherShareStep from './teacher-share-step.jsx';
import TeacherPasscodeImport from './teacher-passcode-import.jsx';
import ClassroomButton from './classroom-button.jsx';
import { TeacherScreen, TeacherSubView } from './teacher-view-layout.jsx';

import styles from './classroom-modal.css';

const TopicChip = ({ topic, isLoading, onRename, onRemove }) => {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(topic);

    const handleStartEdit = useCallback(() => {
        setName(topic);
        setEditing(true);
    }, [topic]);
    const handleChange = useCallback((e) => setName(e.target.value), []);
    const handleCommit = useCallback(() => {
        setEditing(false);
        const trimmed = name.trim();
        if (trimmed && trimmed !== topic) {
            onRename(topic, trimmed);
        }
    }, [name, topic, onRename]);
    const handleKeyDown = useCallback(
        (e) => {
            // Enter commits and Escape cancels an IME conversion; neither must
            // end the inline edit. React's SyntheticKeyboardEvent omits
            // isComposing, so read the native event (keyCode 229 as fallback).
            if ((e.nativeEvent && e.nativeEvent.isComposing) || e.keyCode === 229) return;
            if (e.key === 'Enter') handleCommit();
            if (e.key === 'Escape') setEditing(false);
        },
        [handleCommit],
    );
    const handleRemove = useCallback(() => onRemove(topic), [onRemove, topic]);

    if (editing) {
        return (
            <input
                autoFocus
                className={styles.topicChipInput}
                data-testid={`classroom-topic-rename-input-${topic}`}
                maxLength={50}
                type="text"
                value={name}
                onBlur={handleCommit}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
            />
        );
    }
    return (
        <span className={styles.topicChip} data-testid={`classroom-topic-chip-${topic}`}>
            <button
                className={styles.topicChipName}
                data-testid={`classroom-topic-rename-${topic}`}
                disabled={isLoading}
                type="button"
                onClick={handleStartEdit}
            >
                {topic}
            </button>
            <button
                aria-label="remove"
                className={styles.topicChipRemove}
                data-testid={`classroom-topic-remove-${topic}`}
                disabled={isLoading}
                type="button"
                onClick={handleRemove}
            >
                {'×'}
            </button>
        </span>
    );
};

TopicChip.propTypes = {
    isLoading: PropTypes.bool,
    onRemove: PropTypes.func.isRequired,
    onRename: PropTypes.func.isRequired,
    topic: PropTypes.string.isRequired,
};

const AssignmentRow = ({
    classroom,
    topics,
    isLoading,
    downloadProgress,
    downloadingId,
    onSelectClassroom,
    onUpdateAssignmentMeta,
    onDownloadAssignment,
    onShare,
}) => {
    const intl = useIntl();
    const handleOpen = useCallback(
        () => onSelectClassroom(classroom.classroomId),
        [onSelectClassroom, classroom.classroomId],
    );
    const handleShare = useCallback(() => onShare(classroom), [onShare, classroom]);
    const handleDownload = useCallback(
        () => onDownloadAssignment(classroom),
        [onDownloadAssignment, classroom],
    );
    const handleTopicChange = useCallback(
        (e) => {
            onUpdateAssignmentMeta(classroom.classroomId, { topic: e.target.value || null });
        },
        [onUpdateAssignmentMeta, classroom.classroomId],
    );
    const handleDateChange = useCallback(
        (e) => {
            if (e.target.value) {
                onUpdateAssignmentMeta(classroom.classroomId, {
                    sortDate: new Date(`${e.target.value}T00:00:00`).toISOString(),
                });
            }
        },
        [onUpdateAssignmentMeta, classroom.classroomId],
    );

    const dateValue = (classroom.sortDate || classroom.createdAt || '').slice(0, 10);
    // Retention alert (issue #1052): make the auto-delete deadline visible
    // before it hits, so "expired" never looks like a mysterious archive.
    const retention = retentionLevel(classroom.expiresAt);

    const isDownloading = downloadingId === classroom.classroomId && !!downloadProgress;

    return (
        <li
            className={styles.boardRowItem}
            data-testid={`classroom-board-row-${classroom.classroomId}`}
        >
            <div className={styles.boardRowControls}>
                <button
                    className={styles.boardRowMain}
                    data-testid={`classroom-board-open-${classroom.classroomId}`}
                    type="button"
                    onClick={handleOpen}
                >
                    <span className={styles.boardRowName}>
                        {classroom.assignmentName || classroom.className}
                    </span>
                    {/* 共有推奨マーク (#1106): 運営が共有をおすすめした課題。 */}
                    {classroom.recommendedForSharing ? (
                        <span
                            className={styles.boardRowShareSuggested}
                            data-testid={`classroom-board-share-suggested-${classroom.classroomId}`}
                        >
                            <FormattedMessage
                                defaultMessage="Sharing recommended"
                                description="Per-row mark on an assignment the operators recommended sharing (#1106)"
                                id="gui.classroom.board.shareSuggested"
                            />
                        </span>
                    ) : null}
                    <span className={styles.boardRowCode}>{classroom.joinCode}</span>
                </button>
                <select
                    aria-label={intl.formatMessage({
                        defaultMessage: 'Topic',
                        description: 'Label of the topic selector on an assignment row',
                        id: 'gui.classroom.board.topicLabel',
                    })}
                    className={styles.boardRowTopic}
                    data-testid={`classroom-board-topic-${classroom.classroomId}`}
                    disabled={isLoading}
                    value={classroom.topic || ''}
                    onChange={handleTopicChange}
                >
                    <option value="">
                        {intl.formatMessage({
                            defaultMessage: '(no topic)',
                            description: 'Option for an assignment without a topic',
                            id: 'gui.classroom.board.noTopic',
                        })}
                    </option>
                    {topics.map((t) => (
                        <option key={t} value={t}>
                            {t}
                        </option>
                    ))}
                </select>
                <input
                    className={styles.boardRowDate}
                    data-testid={`classroom-board-date-${classroom.classroomId}`}
                    disabled={isLoading}
                    type="date"
                    value={dateValue}
                    onChange={handleDateChange}
                />
                {/* 共有導線はここ（ボード各行）に一本化（#1109・課題詳細からは廃止）。
                    深さは クラス > 課題 > 共有 に収まる。中身（説明ページ or スターター
                    プロジェクト）がある課題だけに表示する（無いと共有APIがエラーになるため）。 */}
                {onShare && classroom.hasAssignment ? (
                    <button
                        className={styles.boardRowShare}
                        data-testid={`classroom-board-share-${classroom.classroomId}`}
                        disabled={isLoading}
                        type="button"
                        onClick={handleShare}
                    >
                        <FormattedMessage
                            defaultMessage="Share"
                            description="Per-row button that opens the share settings step"
                            id="gui.classroom.shared.shareRow"
                        />
                    </button>
                ) : null}
            </div>
            {/* 期限が近い課題は「あと N 日」バッジをやめ、課題詳細と同じ自動削除
                メッセージ + 全作品ダウンロードを行に表示する（issue #1052/#1049）。 */}
            {retention === 'none' ? null : (
                <div
                    className={
                        retention === 'warning'
                            ? styles.boardRowRetentionWarning
                            : styles.boardRowRetention
                    }
                    data-testid={`classroom-board-expiry-${classroom.classroomId}`}
                >
                    <span className={styles.boardRowRetentionMark}>{'⚠'}</span>
                    <span className={styles.boardRowRetentionText}>
                        <FormattedMessage
                            defaultMessage={
                                'This assignment and its submissions will be deleted ' +
                                'automatically on {date}. Download them to keep a copy.'
                            }
                            description="Inline retention warning on an assignment row"
                            id="gui.classroom.teacherDetail.retentionBanner"
                            values={{
                                date: new Date(classroom.expiresAt).toLocaleDateString(),
                            }}
                        />
                    </span>
                    <button
                        className={styles.boardRowRetentionDownload}
                        data-testid={`classroom-board-download-${classroom.classroomId}`}
                        disabled={isLoading || !!downloadProgress}
                        type="button"
                        onClick={handleDownload}
                    >
                        {isDownloading ? (
                            `${downloadProgress.current}/${downloadProgress.total}`
                        ) : (
                            <FormattedMessage
                                defaultMessage="Download All"
                                description="Download all submissions button"
                                id="gui.classroom.teacherDetail.downloadAll"
                            />
                        )}
                    </button>
                </div>
            )}
        </li>
    );
};

AssignmentRow.propTypes = {
    classroom: PropTypes.object.isRequired,
    downloadingId: PropTypes.string,
    downloadProgress: PropTypes.shape({ current: PropTypes.number, total: PropTypes.number }),
    isLoading: PropTypes.bool,
    onDownloadAssignment: PropTypes.func.isRequired,
    onSelectClassroom: PropTypes.func.isRequired,
    onShare: PropTypes.func,
    onUpdateAssignmentMeta: PropTypes.func.isRequired,
    topics: PropTypes.arrayOf(PropTypes.string).isRequired,
};

const TeacherAssignmentBoard = ({
    allClassrooms,
    allGroups,
    archivedClassrooms,
    classrooms,
    downloadProgress,
    error,
    errorTitle,
    group,
    isLoading,
    onCreateAssignmentInClass,
    onDownloadClassAll,
    onRestoreClassroom,
    onReuseAssignment,
    onSelectClassroom,
    onShowClassList,
    onUpdateAssignmentMeta,
    onUpdateGroupTopics,
    shared,
}) => {
    const intl = useIntl();
    const [newTopic, setNewTopic] = useState('');
    const [showInlineCreate, setShowInlineCreate] = useState(false);
    const [newAssignmentName, setNewAssignmentName] = useState('');
    const [showReuse, setShowReuse] = useState(false);
    const [reuseFilterGroupId, setReuseFilterGroupId] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const topics = Array.isArray(group.topics) ? group.topics : [];
    const sections = buildAssignmentSections(classrooms, topics);
    // Archived assignments of this class (issue #1051), newest first. Shown
    // in a collapsed section so an accidental archive is always recoverable.
    const archivedRows = (archivedClassrooms || [])
        .slice()
        .sort((a, b) =>
            String(b.sortDate || b.createdAt || '').localeCompare(String(a.sortDate || a.createdAt || '')),
        );

    const handleToggleArchived = useCallback(() => setShowArchived((v) => !v), []);
    const handleRestore = useCallback(
        (e) => onRestoreClassroom(e.currentTarget.dataset.classroomId),
        [onRestoreClassroom],
    );
    // Class-wide bulk download (issue #1055): active + archived assignments —
    // both are TTL-bound, and the point is saving everything before expiry.
    const handleDownloadClassAll = useCallback(
        () => onDownloadClassAll(group, [...classrooms, ...(archivedClassrooms || [])]),
        [onDownloadClassAll, group, classrooms, archivedClassrooms],
    );
    // Per-assignment download from a near-deadline row (issue #1052): reuse the
    // class-wide zipper with a single assignment. Track which row is downloading
    // so only that row's button shows progress (download runs one at a time).
    const [downloadingId, setDownloadingId] = useState(null);
    useEffect(() => {
        if (!downloadProgress) setDownloadingId(null);
    }, [downloadProgress]);
    const handleDownloadAssignment = useCallback(
        (classroom) => {
            setDownloadingId(classroom.classroomId);
            onDownloadClassAll(group, [classroom]);
        },
        [onDownloadClassAll, group],
    );

    const handleToggleInlineCreate = useCallback(() => {
        setShowReuse(false);
        setShowInlineCreate((v) => !v);
    }, []);
    const handleNewAssignmentNameChange = useCallback((e) => setNewAssignmentName(e.target.value), []);
    const handleSubmitInlineCreate = useCallback(
        (e) => {
            e.preventDefault();
            const trimmed = newAssignmentName.trim();
            if (!trimmed || isLoading) return;
            onCreateAssignmentInClass(group, trimmed);
            setNewAssignmentName('');
            setShowInlineCreate(false);
        },
        [newAssignmentName, isLoading, onCreateAssignmentInClass, group],
    );
    const handleToggleReuse = useCallback(() => {
        setShowInlineCreate(false);
        setShowReuse((v) => !v);
    }, []);
    const handleReuseFilterChange = useCallback((e) => setReuseFilterGroupId(e.target.value), []);
    const handleReuseCopy = useCallback(
        (e) => {
            const sourceId = e.currentTarget.dataset.classroomId;
            const source = (allClassrooms || []).find((c) => c.classroomId === sourceId);
            if (source) {
                onReuseAssignment(source, group);
                setShowReuse(false);
            }
        },
        [allClassrooms, onReuseAssignment, group],
    );

    // 再利用の対象はアクティブなクラス・課題のみ（レビュー指摘）。アーカイブ済みの
    // クラス（組）に属する課題や、アーカイブ済みの課題は候補・フィルタから除外する。
    const activeGroupIds = new Set(
        (allGroups || []).filter((g) => g.status !== 'archived').map((g) => g.groupId),
    );
    const reuseGroups = (allGroups || []).filter((g) => g.status !== 'archived');
    // Reuse picker: active assignments (of active classes), newest first, filterable.
    const reuseCandidates = (allClassrooms || [])
        .filter((c) => c.status !== 'archived' && activeGroupIds.has(c.groupId))
        .filter((c) => !reuseFilterGroupId || c.groupId === reuseFilterGroupId)
        .sort((a, b) =>
            String(b.sortDate || b.createdAt || '').localeCompare(String(a.sortDate || a.createdAt || '')),
        );
    const groupLabelFor = (groupId) => {
        const g = (allGroups || []).find((x) => x.groupId === groupId);
        return g ? formatClassLabel(g) : '';
    };

    const handleNewTopicChange = useCallback((e) => setNewTopic(e.target.value), []);
    const handleAddTopic = useCallback(() => {
        const trimmed = newTopic.trim();
        if (!trimmed) return;
        onUpdateGroupTopics(group.groupId, { action: 'add', name: trimmed });
        setNewTopic('');
    }, [newTopic, onUpdateGroupTopics, group.groupId]);
    const handleRenameTopic = useCallback(
        (name, to) => onUpdateGroupTopics(group.groupId, { action: 'rename', name, to }),
        [onUpdateGroupTopics, group.groupId],
    );
    const handleRemoveTopic = useCallback(
        (name) => onUpdateGroupTopics(group.groupId, { action: 'remove', name }),
        [onUpdateGroupTopics, group.groupId],
    );

    // 画面遷移サブビュー（#1108）: 作成/再利用/共有/合言葉/カタログ。開いている間は
    // 上部アクションバーを隠し、パンくずに現在地を出す。「課題一覧」で元に戻る。
    const subView = showInlineCreate
        ? 'create'
        : showReuse
          ? 'reuse'
          : shared && shared.shareTarget
            ? 'share'
            : shared && shared.showPasscodeImport
              ? 'passcode'
              : shared && shared.showCatalog
                ? 'catalog'
                : null;
    // 各 id の descriptor は元の使用箇所と一致させる（react-intl は同一 id で
    // defaultMessage/description の不一致を許さない）。
    const subViewMessages = {
        create: {
            defaultMessage: 'Create an assignment',
            description: 'Button on the board to create a new assignment',
            id: 'gui.classroom.board.create',
        },
        reuse: {
            defaultMessage: 'Reuse an assignment',
            description: 'Button on the board to reuse (duplicate) an existing assignment',
            id: 'gui.classroom.board.reuse',
        },
        share: {
            defaultMessage: 'Share this assignment',
            description: 'Share step title',
            id: 'gui.classroom.shared.shareStepTitle',
        },
        passcode: {
            defaultMessage: 'Import by passcode',
            description: 'Passcode import step title',
            id: 'gui.classroom.shared.passcodeImportTitle',
        },
        catalog: {
            defaultMessage: 'Find in みんなの課題',
            description: 'Button that opens the shared assignment catalog',
            id: 'gui.classroom.shared.openCatalog',
        },
    };
    const handleBoardHome = useCallback(() => {
        setShowInlineCreate(false);
        setShowReuse(false);
        if (shared) {
            if (shared.shareTarget) shared.handleCloseShareForm();
            if (shared.showPasscodeImport) shared.handleClosePasscodeImport();
            if (shared.showCatalog) shared.handleCloseCatalog();
        }
    }, [shared]);

    return (
        <TeacherScreen
            breadcrumbs={[
                    {
                        label: intl.formatMessage({
                            defaultMessage: 'Class list',
                            description: 'Breadcrumb link back to the class list',
                            id: 'gui.classroom.breadcrumbs.classList',
                        }),
                        onClick: onShowClassList,
                        testId: 'classroom-breadcrumb-class-list',
                    },
                    // サブビュー中は「課題一覧」を戻るリンクにし、現在地の crumb を足す。
                    subView
                        ? {
                              label: intl.formatMessage({
                                  defaultMessage: 'Assignments',
                                  description: 'Breadcrumb label of the assignment board',
                                  id: 'gui.classroom.breadcrumbs.assignments',
                              }),
                              onClick: handleBoardHome,
                              testId: 'classroom-breadcrumb-assignments',
                          }
                        : {
                              label: intl.formatMessage({
                                  defaultMessage: 'Assignments',
                                  description: 'Breadcrumb label of the assignment board',
                                  id: 'gui.classroom.breadcrumbs.assignments',
                              }),
                          },
                ...(subView ? [{ label: intl.formatMessage(subViewMessages[subView]) }] : []),
            ]}
            testId="classroom-board"
        >
            {!subView && (
            <React.Fragment>
            {/* クラス名は独立行にして省略されないようにする（レビュー指摘）。
                下に画面の説明、その下にアクションボタン行を置く。 */}
            <h2 className={styles.boardTitle}>{formatClassLabel(group)}</h2>
            <p className={styles.boardHint}>
                <FormattedMessage
                    defaultMessage="Create and organize this class's assignments here. Open an assignment to check submissions or grade."
                    description="Short description of what the assignment board (課題一覧) is for"
                    id="gui.classroom.board.hint"
                />
            </p>
            <div className={styles.boardHeader}>
                <button
                    className={styles.boardCreateButton}
                    data-testid="classroom-board-create"
                    disabled={isLoading}
                    type="button"
                    onClick={handleToggleInlineCreate}
                >
                    <FormattedMessage
                        defaultMessage="Create an assignment"
                        description="Button on the board to create a new assignment"
                        id="gui.classroom.board.create"
                    />
                </button>
                <button
                    className={styles.boardReuseButton}
                    data-testid="classroom-board-reuse"
                    disabled={isLoading}
                    type="button"
                    onClick={handleToggleReuse}
                >
                    <FormattedMessage
                        defaultMessage="Reuse an assignment"
                        description="Button on the board to reuse (duplicate) an existing assignment"
                        id="gui.classroom.board.reuse"
                    />
                </button>
                {/* 並び順（レビュー指摘）: 作る → 再利用 → みんなの課題からさがす →
                    合言葉で取り込み → 全課題の提出物をダウンロード。 */}
                {shared ? (
                    <button
                        className={styles.boardReuseButton}
                        data-testid="classroom-board-shared-catalog"
                        disabled={isLoading}
                        type="button"
                        onClick={shared.handleOpenCatalog}
                    >
                        <FormattedMessage
                            defaultMessage="Find in みんなの課題"
                            description="Button that opens the shared assignment catalog"
                            id="gui.classroom.shared.openCatalog"
                        />
                    </button>
                ) : null}
                {shared ? (
                    <button
                        className={styles.boardReuseButton}
                        data-testid="classroom-board-passcode-import"
                        disabled={isLoading}
                        type="button"
                        onClick={shared.handleOpenPasscodeImport}
                    >
                        <FormattedMessage
                            defaultMessage="Import by passcode"
                            description="Button that opens the passcode import step"
                            id="gui.classroom.shared.passcodeImport"
                        />
                    </button>
                ) : null}
                {onDownloadClassAll ? (
                    <button
                        className={styles.boardReuseButton}
                        data-testid="classroom-board-download-class"
                        disabled={isLoading || !!downloadProgress}
                        type="button"
                        onClick={handleDownloadClassAll}
                    >
                        {downloadProgress ? (
                            `${downloadProgress.current}/${downloadProgress.total}`
                        ) : (
                            <FormattedMessage
                                defaultMessage="Download all submissions"
                                description="Button that downloads every assignment's submissions as one zip"
                                id="gui.classroom.board.downloadClass"
                            />
                        )}
                    </button>
                ) : null}
            </div>
            </React.Fragment>
            )}
            <ErrorDisplay error={error} errorTitle={errorTitle} />
            {shared && shared.lastImported ? (
                <p className={styles.sharedFormSuccess} data-testid="shared-import-success">
                    <FormattedMessage
                        defaultMessage={'Imported "{name}" into this class. A new join code was issued.'}
                        description="Confirmation after importing a shared assignment"
                        id="gui.classroom.shared.imported"
                        values={{ name: shared.lastImported.assignmentName }}
                    />
                </p>
            ) : null}
            {shared && shared.shareTarget ? (
                <TeacherShareStep
                    classroom={shared.shareTarget}
                    isLoading={isLoading}
                    lastShared={shared.lastShared}
                    onCancel={shared.handleCloseShareForm}
                    onShare={shared.handleShareAssignment}
                />
            ) : shared && shared.showPasscodeImport ? (
                <TeacherPasscodeImport
                    error={shared.passcodeError}
                    group={group}
                    isLoading={isLoading}
                    lookup={shared.passcodeLookup}
                    onCancel={shared.handleClosePasscodeImport}
                    onImport={shared.handleImportByPasscode}
                    onLookup={shared.handleLookupPasscode}
                />
            ) : shared && shared.showCatalog ? (
                <SharedAssignmentCatalog group={group} isLoading={isLoading} shared={shared} />
            ) : showInlineCreate ? (
                // 課題を作る（#1108: popover → 画面遷移。フッター キャンセル左/作成右）
                <TeacherSubView
                    as="form"
                    footer={
                        <>
                            <ClassroomButton
                                dataTestId="classroom-board-create-cancel"
                                onClick={handleToggleInlineCreate}
                            >
                                <FormattedMessage
                                    defaultMessage="Cancel"
                                    description="Cancel button of the assignment create screen"
                                    id="gui.classroom.board.createCancel"
                                />
                            </ClassroomButton>
                            <ClassroomButton
                                dataTestId="classroom-board-create-submit"
                                disabled={isLoading || newAssignmentName.trim().length === 0}
                                type="submit"
                                variant="primary"
                            >
                                <FormattedMessage
                                    defaultMessage="Create"
                                    description="Submit button of the assignment create screen"
                                    id="gui.classroom.board.createSubmit"
                                />
                            </ClassroomButton>
                        </>
                    }
                    testId="classroom-board-create-view"
                    title={
                        <FormattedMessage
                            defaultMessage="Create an assignment"
                            description="Button on the board to create a new assignment"
                            id="gui.classroom.board.create"
                        />
                    }
                    onSubmit={handleSubmitInlineCreate}
                >
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            <FormattedMessage
                                defaultMessage="Assignment name:"
                                description="Label for the assignment name on the create screen"
                                id="gui.classroom.board.createNameLabel"
                            />
                        </label>
                        <input
                            autoFocus
                            className={styles.input}
                            data-testid="classroom-board-create-name"
                            disabled={isLoading}
                            maxLength={50}
                            placeholder={intl.formatMessage({
                                defaultMessage: 'Assignment name (e.g. Move the cat)',
                                description: 'Placeholder of the assignment name input',
                                id: 'gui.classroom.board.createNamePlaceholder',
                            })}
                            type="text"
                            value={newAssignmentName}
                            onChange={handleNewAssignmentNameChange}
                        />
                    </div>
                </TeacherSubView>
            ) : showReuse ? (
                // 課題を再利用（#1108: popover → 画面遷移。コピーは候補ごと、キャンセル左）
                <TeacherSubView
                    footer={
                        <>
                            <ClassroomButton
                                dataTestId="classroom-board-reuse-cancel"
                                onClick={handleToggleReuse}
                            >
                                <FormattedMessage
                                    defaultMessage="Cancel"
                                    description="Close the reuse picker without copying"
                                    id="gui.classroom.board.reuseCancel"
                                />
                            </ClassroomButton>
                            <span />
                        </>
                    }
                    hint={
                        <FormattedMessage
                            defaultMessage="Copy an existing assignment into this class:"
                            description="Explanation above the reuse picker"
                            id="gui.classroom.board.reuseHint"
                        />
                    }
                    testId="classroom-board-reuse-view"
                    title={
                        <FormattedMessage
                            defaultMessage="Reuse an assignment"
                            description="Button on the board to reuse (duplicate) an existing assignment"
                            id="gui.classroom.board.reuse"
                        />
                    }
                >
                    <div className={styles.formGroup}>
                        <select
                            className={styles.input}
                            data-testid="classroom-board-reuse-filter"
                            disabled={isLoading}
                            value={reuseFilterGroupId}
                            onChange={handleReuseFilterChange}
                        >
                            <option value="">
                                {intl.formatMessage({
                                    defaultMessage: 'All classes',
                                    description: 'Reuse filter option showing every class',
                                    id: 'gui.classroom.board.reuseFilterAll',
                                })}
                            </option>
                            {reuseGroups.map((g) => (
                                <option key={g.groupId} value={g.groupId}>
                                    {formatClassLabel(g)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <ul className={styles.boardRows}>
                        {reuseCandidates.map((c) => (
                            <li key={c.classroomId} className={styles.boardRow}>
                                <span className={styles.boardRowMain}>
                                    <span className={styles.boardRowName}>
                                        {c.assignmentName || c.className}
                                    </span>
                                    <span className={styles.boardRowCode}>{groupLabelFor(c.groupId)}</span>
                                </span>
                                <button
                                    className={styles.reuseRowCopy}
                                    data-classroom-id={c.classroomId}
                                    data-testid={`classroom-board-reuse-copy-${c.classroomId}`}
                                    disabled={isLoading}
                                    type="button"
                                    onClick={handleReuseCopy}
                                >
                                    <FormattedMessage
                                        defaultMessage="Copy into this class"
                                        description="Button that duplicates the assignment into the current class"
                                        id="gui.classroom.board.reuseCopy"
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                </TeacherSubView>
            ) : (
                <React.Fragment>
            <div className={styles.boardTopics}>
                {topics.map((topic) => (
                    <TopicChip
                        key={topic}
                        isLoading={isLoading}
                        topic={topic}
                        onRemove={handleRemoveTopic}
                        onRename={handleRenameTopic}
                    />
                ))}
                <input
                    className={styles.topicAddInput}
                    data-testid="classroom-topic-add-input"
                    disabled={isLoading}
                    maxLength={50}
                    placeholder={intl.formatMessage({
                        defaultMessage: 'New topic',
                        description: 'Placeholder of the new topic input',
                        id: 'gui.classroom.board.newTopicPlaceholder',
                    })}
                    type="text"
                    value={newTopic}
                    onChange={handleNewTopicChange}
                />
                <button
                    className={styles.topicAddButton}
                    data-testid="classroom-topic-add"
                    disabled={isLoading || newTopic.trim().length === 0}
                    type="button"
                    onClick={handleAddTopic}
                >
                    <FormattedMessage
                        defaultMessage="Add topic"
                        description="Button to add a topic to the class"
                        id="gui.classroom.board.addTopic"
                    />
                </button>
            </div>
            {sections.length === 0 ? (
                <p className={styles.boardEmpty} data-testid="classroom-board-empty">
                    <FormattedMessage
                        defaultMessage={'No assignments yet. Press "Create an assignment" to add one.'}
                        description="Empty state of the assignment board"
                        id="gui.classroom.board.empty"
                    />
                </p>
            ) : null}
            {sections.map((section) => (
                <div
                    key={section.topic || '__none__'}
                    className={styles.boardSection}
                    data-testid={`classroom-board-section-${section.topic || 'none'}`}
                >
                    {section.topic ? <h3 className={styles.boardSectionTitle}>{section.topic}</h3> : null}
                    <ul className={styles.boardRows}>
                        {section.classrooms.map((classroom) => (
                            <AssignmentRow
                                key={classroom.classroomId}
                                classroom={classroom}
                                downloadingId={downloadingId}
                                downloadProgress={downloadProgress}
                                isLoading={isLoading}
                                topics={topics}
                                onDownloadAssignment={handleDownloadAssignment}
                                onSelectClassroom={onSelectClassroom}
                                onShare={shared ? shared.handleOpenShareFor : null}
                                onUpdateAssignmentMeta={onUpdateAssignmentMeta}
                            />
                        ))}
                    </ul>
                </div>
            ))}
            {archivedRows.length > 0 ? (
                <div className={styles.boardSection} data-testid="classroom-board-archived-section">
                    <button
                        className={styles.archivedToggle}
                        data-testid="classroom-board-archived-toggle"
                        type="button"
                        onClick={handleToggleArchived}
                    >
                        {showArchived ? '▼ ' : '▶ '}
                        {intl.formatMessage(
                            {
                                defaultMessage: 'Archived assignments ({count})',
                                description: 'Toggle of the archived assignments section on the board',
                                id: 'gui.classroom.board.archivedToggle',
                            },
                            { count: archivedRows.length },
                        )}
                    </button>
                    {showArchived ? (
                        <ul className={styles.boardRows} data-testid="classroom-board-archived-list">
                            {archivedRows.map((classroom) => (
                                <li
                                    key={classroom.classroomId}
                                    className={styles.boardRow}
                                    data-testid={`classroom-board-archived-row-${classroom.classroomId}`}
                                >
                                    <span className={styles.boardRowMain}>
                                        <span className={styles.boardRowName}>
                                            {classroom.assignmentName || classroom.className}
                                        </span>
                                        <span className={styles.boardRowCode}>
                                            {classroom.expiresAt
                                                ? intl.formatMessage(
                                                      {
                                                          defaultMessage: 'Kept until {date}',
                                                          description:
                                                              'Retention deadline shown on an archived assignment row',
                                                          id: 'gui.classroom.board.archivedExpires',
                                                      },
                                                      {
                                                          date: new Date(
                                                              classroom.expiresAt,
                                                          ).toLocaleDateString(),
                                                      },
                                                  )
                                                : null}
                                        </span>
                                    </span>
                                    <button
                                        className={styles.reuseRowCopy}
                                        data-classroom-id={classroom.classroomId}
                                        data-testid={`classroom-board-restore-${classroom.classroomId}`}
                                        disabled={isLoading}
                                        type="button"
                                        onClick={handleRestore}
                                    >
                                        <FormattedMessage
                                            defaultMessage="Restore"
                                            description="Button that restores an archived assignment"
                                            id="gui.classroom.board.restore"
                                        />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            ) : null}
                </React.Fragment>
            )}
        </TeacherScreen>
    );
};

TeacherAssignmentBoard.propTypes = {
    allClassrooms: PropTypes.arrayOf(PropTypes.object),
    allGroups: PropTypes.arrayOf(PropTypes.object),
    archivedClassrooms: PropTypes.arrayOf(PropTypes.object),
    classrooms: PropTypes.arrayOf(PropTypes.object).isRequired,
    downloadProgress: PropTypes.shape({
        current: PropTypes.number,
        total: PropTypes.number,
    }),
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onCreateAssignmentInClass: PropTypes.func.isRequired,
    onDownloadClassAll: PropTypes.func,
    onRestoreClassroom: PropTypes.func,
    onReuseAssignment: PropTypes.func.isRequired,
    onSelectClassroom: PropTypes.func.isRequired,
    onShowClassList: PropTypes.func.isRequired,
    onUpdateAssignmentMeta: PropTypes.func.isRequired,
    onUpdateGroupTopics: PropTypes.func.isRequired,
    shared: PropTypes.object,
};

export default TeacherAssignmentBoard;
