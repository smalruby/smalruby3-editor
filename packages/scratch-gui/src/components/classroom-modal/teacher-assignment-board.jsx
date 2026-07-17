/**
 * Assignment board — the main view inside a class (Google Classroom style):
 * assignments without a topic listed first, then one section per topic,
 * newest (sortDate) first. Rows edit their topic / sort date in place, and
 * the chip bar manages the class's topic list (rename/remove cascade to the
 * assignments on the server).
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { buildAssignmentSections } from '../../lib/classroom-group-utils.js';
import { formatClassLabel } from '../../lib/classroom-class-label.js';
import { daysUntil, retentionLevel } from '../../lib/classroom-retention.js';
import ErrorDisplay from './error-display.jsx';
import TeacherBreadcrumbs from './teacher-breadcrumbs.jsx';

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

const AssignmentRow = ({ classroom, topics, isLoading, onSelectClassroom, onUpdateAssignmentMeta }) => {
    const intl = useIntl();
    const handleOpen = useCallback(
        () => onSelectClassroom(classroom.classroomId),
        [onSelectClassroom, classroom.classroomId],
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

    return (
        <li className={styles.boardRow} data-testid={`classroom-board-row-${classroom.classroomId}`}>
            <button
                className={styles.boardRowMain}
                data-testid={`classroom-board-open-${classroom.classroomId}`}
                type="button"
                onClick={handleOpen}
            >
                <span className={styles.boardRowName}>{classroom.assignmentName || classroom.className}</span>
                <span className={styles.boardRowCode}>{classroom.joinCode}</span>
            </button>
            {retention === 'none' ? null : (
                <span
                    className={
                        retention === 'warning' ? styles.expiryBadgeWarning : styles.expiryBadgeNotice
                    }
                    data-testid={`classroom-board-expiry-${classroom.classroomId}`}
                    title={intl.formatMessage(
                        {
                            defaultMessage: 'Kept until {date}',
                            description: 'Retention deadline shown on an archived assignment row',
                            id: 'gui.classroom.board.archivedExpires',
                        },
                        { date: new Date(classroom.expiresAt).toLocaleDateString() },
                    )}
                >
                    {intl.formatMessage(
                        {
                            defaultMessage: '{days} days left',
                            description: 'Days-until-deletion badge on an assignment row',
                            id: 'gui.classroom.board.expiryBadge',
                        },
                        { days: daysUntil(classroom.expiresAt) },
                    )}
                </span>
            )}
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
        </li>
    );
};

AssignmentRow.propTypes = {
    classroom: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onSelectClassroom: PropTypes.func.isRequired,
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

    // Reuse picker: every assignment (any class), newest first, filterable.
    const reuseCandidates = (allClassrooms || [])
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

    return (
        <div className={styles.assignmentBoard} data-testid="classroom-board">
            <TeacherBreadcrumbs
                items={[
                    {
                        label: intl.formatMessage({
                            defaultMessage: 'Class list',
                            description: 'Breadcrumb link back to the class list',
                            id: 'gui.classroom.breadcrumbs.classList',
                        }),
                        onClick: onShowClassList,
                        testId: 'classroom-breadcrumb-class-list',
                    },
                    {
                        label: intl.formatMessage({
                            defaultMessage: 'Assignments',
                            description: 'Breadcrumb label of the assignment board',
                            id: 'gui.classroom.breadcrumbs.assignments',
                        }),
                    },
                ]}
            />
            <div className={styles.boardHeader}>
                <h2 className={styles.boardTitle}>{formatClassLabel(group)}</h2>
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
            <ErrorDisplay error={error} errorTitle={errorTitle} />
            {showInlineCreate ? (
                <form
                    className={`${styles.boardPopover} ${styles.boardInlineCreate}`}
                    onSubmit={handleSubmitInlineCreate}
                >
                    <input
                        autoFocus
                        data-testid="classroom-board-create-name"
                        disabled={isLoading}
                        maxLength={50}
                        placeholder={intl.formatMessage({
                            defaultMessage: 'Assignment name (e.g. Move the cat)',
                            description: 'Placeholder of the inline assignment name input',
                            id: 'gui.classroom.board.createNamePlaceholder',
                        })}
                        type="text"
                        value={newAssignmentName}
                        onChange={handleNewAssignmentNameChange}
                    />
                    <button
                        data-testid="classroom-board-create-submit"
                        disabled={isLoading || newAssignmentName.trim().length === 0}
                        type="submit"
                    >
                        <FormattedMessage
                            defaultMessage="Create"
                            description="Submit button of the inline assignment creation form"
                            id="gui.classroom.board.createSubmit"
                        />
                    </button>
                    <button
                        className={styles.popoverCancel}
                        data-testid="classroom-board-create-cancel"
                        type="button"
                        onClick={handleToggleInlineCreate}
                    >
                        <FormattedMessage
                            defaultMessage="Cancel"
                            description="Cancel button of the inline assignment creation form"
                            id="gui.classroom.board.createCancel"
                        />
                    </button>
                </form>
            ) : null}
            {showReuse ? (
                <div
                    className={`${styles.boardPopover} ${styles.boardSection}`}
                    data-testid="classroom-board-reuse-view"
                >
                    <div className={styles.reuseFilter}>
                        <FormattedMessage
                            defaultMessage="Copy an existing assignment into this class:"
                            description="Explanation above the reuse picker"
                            id="gui.classroom.board.reuseHint"
                        />
                        <select
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
                            {(allGroups || []).map((g) => (
                                <option key={g.groupId} value={g.groupId}>
                                    {formatClassLabel(g)}
                                </option>
                            ))}
                        </select>
                        <button
                            className={styles.popoverCancel}
                            data-testid="classroom-board-reuse-cancel"
                            type="button"
                            onClick={handleToggleReuse}
                        >
                            <FormattedMessage
                                defaultMessage="Cancel"
                                description="Close the reuse picker without copying"
                                id="gui.classroom.board.reuseCancel"
                            />
                        </button>
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
                </div>
            ) : null}
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
                                isLoading={isLoading}
                                topics={topics}
                                onSelectClassroom={onSelectClassroom}
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
        </div>
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
};

export default TeacherAssignmentBoard;
