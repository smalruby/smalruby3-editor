/**
 * Assignment board — the main view inside a class (Google Classroom style):
 * the［ストリーム］［授業］tabs, the［＋ 作成 ▾］menu, and the assignments under
 * topic headings ("no topic" first, then the class's topics), newest
 * (sortDate) first. Rows open in place (one at a time); their ⋮ edits the
 * topic / sort date, and a topic heading's ⋮ renames or removes the topic
 * (cascading to the assignments on the server).
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { DEFAULT_MESH_GROUP_LIMIT } from '../../lib/classroom-assignment-utils.js';
import { buildAssignmentSections } from '../../lib/classroom-group-utils.js';
import { formatClassLabel } from '../../lib/classroom-class-label.js';
import { retentionLevel } from '../../lib/classroom-retention.js';
import { buildStreamEvents } from '../../lib/classroom-stream.js';
import ErrorDisplay from './error-display.jsx';
import MeshGroupLimitField from './mesh-group-limit-field.jsx';
import SharedAssignmentCatalog from './shared-assignment-catalog.jsx';
import TeacherShareStep from './teacher-share-step.jsx';
import TeacherPasscodeImport from './teacher-passcode-import.jsx';
import ClassroomButton from './classroom-button.jsx';
import { TeacherScreen, TeacherSubView } from './teacher-view-layout.jsx';

import styles from './classroom-modal.css';

/**
 * A small dropdown: a toggle button and a list shown under it. Closes on an
 * outside click, on Escape, and after an item runs (items call `close`).
 * @param {object} props - component props
 * @param {Function} props.children - (close) => menu items
 * @param {string} props.buttonClassName - class of the toggle button
 * @param {React.ReactNode} props.label - contents of the toggle button
 * @param {string} props.ariaLabel - accessible name of the toggle (icon-only buttons)
 * @param {boolean} props.alignRight - open the list toward the left edge of the button
 * @param {boolean} props.disabled - disable the toggle
 * @param {string} props.testId - data-testid of the toggle; the list gets `${testId}-list`
 * @returns {React.ReactElement} the menu
 */
const BoardMenu = ({ alignRight, ariaLabel, buttonClassName, children, disabled, label, testId }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const close = useCallback(() => setOpen(false), []);
    const handleToggle = useCallback(() => setOpen((v) => !v), []);
    useEffect(() => {
        if (!open) return () => {};
        const handleDown = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleDown);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleDown);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);
    return (
        <div className={styles.boardMenu} ref={ref}>
            <button
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={ariaLabel}
                className={buttonClassName}
                data-testid={testId}
                disabled={disabled}
                type="button"
                onClick={handleToggle}
            >
                {label}
            </button>
            {open ? (
                <div
                    className={alignRight ? styles.boardMenuListRight : styles.boardMenuList}
                    data-testid={`${testId}-list`}
                    role="menu"
                >
                    {children(close)}
                </div>
            ) : null}
        </div>
    );
};

BoardMenu.propTypes = {
    alignRight: PropTypes.bool,
    ariaLabel: PropTypes.string,
    buttonClassName: PropTypes.string,
    children: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    label: PropTypes.node.isRequired,
    testId: PropTypes.string.isRequired,
};

/**
 * One item of a BoardMenu: runs the action and closes the menu.
 * @param {object} props - component props
 * @param {React.ReactNode} props.children - item label
 * @param {Function} props.close - closes the menu
 * @param {boolean} props.disabled - disable the item
 * @param {Function} props.onSelect - action of the item
 * @param {string} props.testId - data-testid
 * @returns {React.ReactElement} the item
 */
const BoardMenuItem = ({ children, close, disabled, onSelect, testId }) => {
    const handleClick = useCallback(() => {
        close();
        onSelect();
    }, [close, onSelect]);
    return (
        <button
            className={styles.boardMenuItem}
            data-testid={testId}
            disabled={disabled}
            role="menuitem"
            type="button"
            onClick={handleClick}
        >
            {children}
        </button>
    );
};

BoardMenuItem.propTypes = {
    children: PropTypes.node.isRequired,
    close: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    onSelect: PropTypes.func.isRequired,
    testId: PropTypes.string.isRequired,
};

/**
 * Heading of a topic section. Named topics have a ⋮ menu to rename (inline)
 * or remove the topic (Google Classroom keeps these on the topic heading).
 * @param {object} props - component props
 * @param {boolean} props.isLoading - disable while a request runs
 * @param {Function} props.onRemove - (topic) => void
 * @param {Function} props.onRename - (topic, newName) => void
 * @param {?string} props.topic - topic name; null for "no topic"
 * @returns {React.ReactElement} the heading
 */
const TopicHeading = ({ topic, isLoading, onRename, onRemove }) => {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(topic || '');

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
    const key = topic || 'none';

    if (editing) {
        // R1: the field keeps a visible label while the name is being edited.
        return (
            <div className={styles.boardSectionHeading}>
                <label className={styles.boardRowMetaLabel} htmlFor={`classroom-topic-rename-input-${topic}`}>
                    <FormattedMessage
                        defaultMessage="Topic"
                        description="Label of the topic selector on an assignment row"
                        id="gui.classroom.board.topicLabel"
                    />
                </label>
                <input
                    autoFocus
                    className={styles.topicRenameInput}
                    data-testid={`classroom-topic-rename-input-${topic}`}
                    id={`classroom-topic-rename-input-${topic}`}
                    maxLength={50}
                    type="text"
                    value={name}
                    onBlur={handleCommit}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                />
            </div>
        );
    }
    return (
        <div className={styles.boardSectionHeading}>
            <h3 className={styles.boardSectionTitle} data-testid={`classroom-board-section-title-${key}`}>
                {topic || (
                    <FormattedMessage
                        defaultMessage="No topic"
                        description="Heading of the section of assignments without a topic"
                        id="gui.classroom.board.noTopicSection"
                    />
                )}
            </h3>
            {topic ? (
                <BoardMenu
                    alignRight
                    ariaLabel={topic}
                    buttonClassName={styles.boardKebab}
                    disabled={isLoading}
                    label="⋮"
                    testId={`classroom-topic-menu-${topic}`}
                >
                    {(close) => (
                        <React.Fragment>
                            <BoardMenuItem
                                close={close}
                                testId={`classroom-topic-rename-${topic}`}
                                onSelect={handleStartEdit}
                            >
                                <FormattedMessage
                                    defaultMessage="Rename"
                                    description="Topic heading menu: rename the topic"
                                    id="gui.classroom.board.topicRename"
                                />
                            </BoardMenuItem>
                            <BoardMenuItem
                                close={close}
                                testId={`classroom-topic-remove-${topic}`}
                                onSelect={handleRemove}
                            >
                                <FormattedMessage
                                    defaultMessage="Delete"
                                    description="Topic heading menu: delete the topic (assignments stay, without a topic)"
                                    id="gui.classroom.board.topicRemove"
                                />
                            </BoardMenuItem>
                        </React.Fragment>
                    )}
                </BoardMenu>
            ) : null}
        </div>
    );
};

TopicHeading.propTypes = {
    isLoading: PropTypes.bool,
    onRemove: PropTypes.func.isRequired,
    onRename: PropTypes.func.isRequired,
    topic: PropTypes.string,
};

/**
 * "Add topic" dialog of the［＋ 作成 ▾］menu: one name, Cancel and Add.
 * @param {object} props - component props
 * @param {boolean} props.isLoading - disable while a request runs
 * @param {Function} props.onAdd - (name) => void
 * @param {Function} props.onCancel - closes the dialog
 * @returns {React.ReactElement} the dialog
 */
const TopicAddDialog = ({ isLoading, onAdd, onCancel }) => {
    const intl = useIntl();
    const [name, setName] = useState('');
    const handleChange = useCallback((e) => setName(e.target.value), []);
    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed) onAdd(trimmed);
        },
        [name, onAdd],
    );
    const title = intl.formatMessage({
        defaultMessage: 'Add topic',
        description: 'Title of the add-topic dialog',
        id: 'gui.classroom.board.topicDialogTitle',
    });
    return (
        <div className={styles.boardDialogOverlay}>
            <form
                aria-label={title}
                aria-modal="true"
                className={styles.boardDialog}
                data-testid="classroom-topic-add-dialog"
                role="dialog"
                onSubmit={handleSubmit}
            >
                <h3 className={styles.boardDialogTitle}>{title}</h3>
                <label className={styles.label} htmlFor="classroom-topic-add-input">
                    <FormattedMessage
                        defaultMessage="Topic"
                        description="Label of the topic selector on an assignment row"
                        id="gui.classroom.board.topicLabel"
                    />
                </label>
                <input
                    autoFocus
                    className={styles.input}
                    data-testid="classroom-topic-add-input"
                    disabled={isLoading}
                    id="classroom-topic-add-input"
                    maxLength={50}
                    placeholder={intl.formatMessage({
                        defaultMessage: 'e.g. Unit 1: Animation',
                        description: 'Placeholder (an example) of the topic name in the add-topic dialog',
                        id: 'gui.classroom.board.topicNamePlaceholder',
                    })}
                    type="text"
                    value={name}
                    onChange={handleChange}
                />
                <div className={styles.boardDialogFooter}>
                    <ClassroomButton dataTestId="classroom-topic-add-cancel" onClick={onCancel}>
                        <FormattedMessage
                            defaultMessage="Cancel"
                            description="Cancel button of the assignment create screen"
                            id="gui.classroom.board.createCancel"
                        />
                    </ClassroomButton>
                    <ClassroomButton
                        dataTestId="classroom-topic-add"
                        disabled={isLoading || name.trim().length === 0}
                        type="submit"
                        variant="primary"
                    >
                        <FormattedMessage
                            defaultMessage="Add"
                            description="Button to add a topic to the class"
                            id="gui.classroom.board.addTopic"
                        />
                    </ClassroomButton>
                </div>
            </form>
        </div>
    );
};

TopicAddDialog.propTypes = {
    isLoading: PropTypes.bool,
    onAdd: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};

const formatShortDate = (intl, iso) => intl.formatDate(new Date(iso), { month: 'numeric', day: 'numeric' });

const AssignmentRow = ({
    classroom,
    topics,
    isLoading,
    isOpen,
    downloadProgress,
    downloadingId,
    summary,
    onSelectClassroom,
    onToggle,
    onUpdateAssignmentMeta,
    onDownloadAssignment,
    onShare,
}) => {
    const intl = useIntl();
    const handleOpen = useCallback(
        () => onSelectClassroom(classroom.classroomId),
        [onSelectClassroom, classroom.classroomId],
    );
    const handleToggle = useCallback(() => onToggle(classroom), [onToggle, classroom]);
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

    const id = classroom.classroomId;
    const dateIso = classroom.sortDate || classroom.createdAt || '';
    const dateValue = dateIso.slice(0, 10);
    // Red only when the teacher must act now (R4・B4): 7 days or less left.
    // Further deadlines are a grey line inside the opened row.
    const urgent = retentionLevel(classroom.expiresAt) === 'warning';
    const isDownloading = downloadingId === id && !!downloadProgress;
    const loaded = summary && summary.data;

    return (
        <li
            className={isOpen ? styles.boardRowItemOpen : styles.boardRowItem}
            data-testid={`classroom-board-row-${id}`}
        >
            <div className={styles.boardRowControls}>
                <button
                    aria-expanded={isOpen}
                    className={styles.boardRowMain}
                    data-testid={`classroom-board-row-toggle-${id}`}
                    type="button"
                    onClick={handleToggle}
                >
                    <span className={styles.boardRowName}>
                        {classroom.assignmentName || classroom.className}
                    </span>
                    {/* 共有推奨マーク (#1106): 運営が共有をおすすめした課題。 */}
                    {classroom.recommendedForSharing ? (
                        <span
                            className={styles.boardRowShareSuggested}
                            data-testid={`classroom-board-share-suggested-${id}`}
                        >
                            <FormattedMessage
                                defaultMessage="Sharing recommended"
                                description="Per-row mark on an assignment the operators recommended sharing (#1106)"
                                id="gui.classroom.board.shareSuggested"
                            />
                        </span>
                    ) : null}
                    {/* Trailing items stay at the right end whether or not the red
                        mark is shown, so the lesson date does not jump between rows. */}
                    <span className={styles.boardRowTrailing}>
                        {urgent ? (
                            // R5: the mark carries a visible label, not only a tooltip.
                            <span
                                className={styles.boardRowExpiryMark}
                                data-testid={`classroom-board-expiry-mark-${id}`}
                            >
                                {'⚠ '}
                                <FormattedMessage
                                    defaultMessage="Kept until {date}"
                                    description="Retention deadline shown on an archived assignment row"
                                    id="gui.classroom.board.archivedExpires"
                                    values={{ date: formatShortDate(intl, classroom.expiresAt) }}
                                />
                            </span>
                        ) : null}
                        {dateValue ? (
                            <span className={styles.boardRowMeta} data-testid={`classroom-board-row-date-${id}`}>
                                <span className={styles.boardRowMetaLabel}>
                                    <FormattedMessage
                                        defaultMessage="Lesson date"
                                        description="Label of the lesson date on an assignment row"
                                        id="gui.classroom.board.lessonDateLabel"
                                    />
                                </span>
                                {formatShortDate(intl, dateIso)}
                            </span>
                        ) : null}
                    </span>
                </button>
                <BoardMenu
                    alignRight
                    ariaLabel={intl.formatMessage({
                        defaultMessage: 'Assignment options',
                        description: 'Accessible name of the ⋮ menu on an assignment row',
                        id: 'gui.classroom.board.rowMenu',
                    })}
                    buttonClassName={styles.boardKebab}
                    disabled={isLoading}
                    label="⋮"
                    testId={`classroom-board-row-menu-${id}`}
                >
                    {(close) => (
                        <div className={styles.boardRowMenuBody}>
                            <label className={styles.boardRowMenuField}>
                                <span className={styles.boardRowMetaLabel}>
                                    <FormattedMessage
                                        defaultMessage="Topic"
                                        description="Label of the topic selector on an assignment row"
                                        id="gui.classroom.board.topicLabel"
                                    />
                                </span>
                                <select
                                    className={styles.boardRowTopic}
                                    data-testid={`classroom-board-topic-${id}`}
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
                            </label>
                            <label className={styles.boardRowMenuField}>
                                <span className={styles.boardRowMetaLabel}>
                                    <FormattedMessage
                                        defaultMessage="Lesson date"
                                        description="Label of the lesson date on an assignment row"
                                        id="gui.classroom.board.lessonDateLabel"
                                    />
                                </span>
                                <input
                                    className={styles.boardRowDate}
                                    data-testid={`classroom-board-date-${id}`}
                                    disabled={isLoading}
                                    type="date"
                                    value={dateValue}
                                    onChange={handleDateChange}
                                />
                            </label>
                            {/* 共有導線はボード各行（の ⋮）に一本化（#1109）。中身（説明ページ or
                                スターター）がある課題だけ（無いと共有APIがエラーになるため）。 */}
                            {onShare && classroom.hasAssignment ? (
                                <BoardMenuItem
                                    close={close}
                                    disabled={isLoading}
                                    testId={`classroom-board-share-${id}`}
                                    onSelect={handleShare}
                                >
                                    <FormattedMessage
                                        defaultMessage="Share"
                                        description="Per-row button that opens the share settings step"
                                        id="gui.classroom.shared.shareRow"
                                    />
                                </BoardMenuItem>
                            ) : null}
                        </div>
                    )}
                </BoardMenu>
            </div>
            {isOpen ? (
                <div className={styles.boardRowDetail} data-testid={`classroom-board-row-detail-${id}`}>
                    <div className={styles.boardRowDetailMeta}>
                        <span className={styles.boardRowMeta} data-testid={`classroom-board-row-code-${id}`}>
                            <span className={styles.boardRowMetaLabel}>
                                <FormattedMessage
                                    defaultMessage="Join code"
                                    description="Label of the join code inside an opened assignment row"
                                    id="gui.classroom.board.joinCodeLabel"
                                />
                            </span>
                            <span className={styles.boardRowCode}>{classroom.joinCode}</span>
                        </span>
                        {!urgent && classroom.expiresAt ? (
                            <span
                                className={styles.boardRowRetentionGrey}
                                data-testid={`classroom-board-retention-${id}`}
                            >
                                <FormattedMessage
                                    defaultMessage="Kept until {date}"
                                    description="Retention deadline shown on an archived assignment row"
                                    id="gui.classroom.board.archivedExpires"
                                    values={{ date: formatShortDate(intl, classroom.expiresAt) }}
                                />
                            </span>
                        ) : null}
                        <span className={styles.boardRowMeta} data-testid={`classroom-board-row-counts-${id}`}>
                            {loaded ? (
                                <FormattedMessage
                                    defaultMessage="Submitted {submitted} · Joined {joined} of {capacity}"
                                    description="Counts inside an opened assignment row"
                                    id="gui.classroom.board.rowCounts"
                                    values={{
                                        submitted: summary.data.submitted,
                                        joined: summary.data.joined,
                                        capacity: summary.data.capacity,
                                    }}
                                />
                            ) : summary && summary.failed ? (
                                '-'
                            ) : (
                                <FormattedMessage
                                    defaultMessage="Loading…"
                                    description="Shown while the counts of an opened assignment row load"
                                    id="gui.classroom.board.rowLoading"
                                />
                            )}
                        </span>
                    </div>
                    {loaded && summary.data.descriptionLine ? (
                        <p
                            className={styles.boardRowDescription}
                            data-testid={`classroom-board-row-description-${id}`}
                        >
                            {summary.data.descriptionLine}
                        </p>
                    ) : null}
                    {urgent ? (
                        <div
                            className={styles.boardRowRetentionWarning}
                            data-testid={`classroom-board-expiry-${id}`}
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
                                data-testid={`classroom-board-download-${id}`}
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
                    ) : null}
                    <div className={styles.boardRowDetailFooter}>
                        <ClassroomButton
                            dataTestId={`classroom-board-open-${id}`}
                            variant="primary"
                            onClick={handleOpen}
                        >
                            <FormattedMessage
                                defaultMessage="Open assignment"
                                description="Button inside an opened assignment row that goes to the assignment detail"
                                id="gui.classroom.board.openAssignment"
                            />
                        </ClassroomButton>
                    </div>
                </div>
            ) : null}
        </li>
    );
};

AssignmentRow.propTypes = {
    classroom: PropTypes.object.isRequired,
    downloadingId: PropTypes.string,
    downloadProgress: PropTypes.shape({ current: PropTypes.number, total: PropTypes.number }),
    isLoading: PropTypes.bool,
    isOpen: PropTypes.bool,
    onDownloadAssignment: PropTypes.func.isRequired,
    onSelectClassroom: PropTypes.func.isRequired,
    onShare: PropTypes.func,
    onToggle: PropTypes.func.isRequired,
    onUpdateAssignmentMeta: PropTypes.func.isRequired,
    summary: PropTypes.shape({
        data: PropTypes.shape({
            capacity: PropTypes.number,
            descriptionLine: PropTypes.string,
            joined: PropTypes.number,
            submitted: PropTypes.number,
        }),
        failed: PropTypes.bool,
    }),
    topics: PropTypes.arrayOf(PropTypes.string).isRequired,
};

/**
 * One entry of the stream (B5). The whole entry is a button that opens the
 * assignment: on［授業］, or in the archived section (with［復元］) when the
 * assignment is archived.
 * @param {object} props - component props
 * @param {object} props.event - entry from buildStreamEvents
 * @param {Function} props.onOpen - (event) => void
 * @returns {React.ReactElement} the entry
 */
const StreamItem = ({ event, onOpen }) => {
    const intl = useIntl();
    const handleClick = useCallback(() => onOpen(event), [onOpen, event]);
    const name = event.classroom.assignmentName || event.classroom.className;
    const date = formatShortDate(intl, event.date);
    let text;
    if (event.type === 'expiring') {
        text = (
            <FormattedMessage
                defaultMessage={'The assignment "{name}" will be deleted automatically on {date}'}
                description="Stream entry: an assignment is auto-deleted within 7 days"
                id="gui.classroom.board.streamExpiring"
                values={{ name, date }}
            />
        );
    } else if (event.type === 'archived') {
        text = (
            <FormattedMessage
                defaultMessage={'Archived the assignment "{name}"'}
                description="Stream entry: the teacher archived an assignment"
                id="gui.classroom.board.streamArchived"
                values={{ name }}
            />
        );
    } else {
        text = (
            <FormattedMessage
                defaultMessage={'Created the assignment "{name}"'}
                description="Stream entry: the teacher created an assignment"
                id="gui.classroom.board.streamCreated"
                values={{ name }}
            />
        );
    }
    return (
        <li>
            <button
                className={event.type === 'expiring' ? styles.streamItemUrgent : styles.streamItem}
                data-testid={`classroom-board-stream-item-${event.key}`}
                type="button"
                onClick={handleClick}
            >
                {/* R4: red only for the entry the teacher has to act on now. */}
                {event.type === 'expiring' ? <span className={styles.streamItemMark}>{'⚠'}</span> : null}
                <span className={styles.streamItemText}>{text}</span>
                {/* R1: the date says what it is (the expiring entry has it in its text). */}
                {event.type === 'expiring' ? null : (
                    <span className={styles.streamItemDate} data-testid={`classroom-board-stream-date-${event.key}`}>
                        <span className={styles.boardRowMetaLabel}>
                            {event.type === 'archived' ? (
                                <FormattedMessage
                                    defaultMessage="Archived"
                                    description="Label of the date on a stream entry: the day the assignment was archived"
                                    id="gui.classroom.board.streamArchivedDateLabel"
                                />
                            ) : (
                                <FormattedMessage
                                    defaultMessage="Created"
                                    description="Label of the date on a stream entry: the day the assignment was created"
                                    id="gui.classroom.board.streamCreatedDateLabel"
                                />
                            )}
                        </span>
                        {date}
                    </span>
                )}
            </button>
        </li>
    );
};

StreamItem.propTypes = {
    event: PropTypes.shape({
        classroom: PropTypes.object.isRequired,
        date: PropTypes.string.isRequired,
        key: PropTypes.string.isRequired,
        type: PropTypes.oneOf(['created', 'archived', 'expiring']).isRequired,
    }).isRequired,
    onOpen: PropTypes.func.isRequired,
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
    initialTab,
    isLoading,
    onCreateAssignmentInClass,
    onDownloadClassAll,
    onLoadAssignmentSummary,
    onRestoreClassroom,
    onReuseAssignment,
    onSelectClassroom,
    onShowClassList,
    onTabChange,
    onUpdateAssignmentMeta,
    onUpdateGroupTopics,
    shared,
}) => {
    const intl = useIntl();
    // ［ストリーム］［授業］(Google Classroom). A class opens on the stream (B5);
    // the parent passes initialTab to come back to［授業］after an assignment.
    const [tab, setTabState] = useState(initialTab || 'stream');
    const setTab = useCallback(
        (next) => {
            setTabState(next);
            if (onTabChange) onTabChange(next);
        },
        [onTabChange],
    );
    const [showTopicDialog, setShowTopicDialog] = useState(false);
    const [showInlineCreate, setShowInlineCreate] = useState(false);
    const [newAssignmentName, setNewAssignmentName] = useState('');
    const [newMeshGroupLimit, setNewMeshGroupLimit] = useState(DEFAULT_MESH_GROUP_LIMIT);
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

    // 作成・再利用の画面は、開くとき・閉じるとき（キャンセル・作成・コピー・パンくず・
    // 画面の切り替え）のどちらでも入力を既定値に戻す。次に開いたときに前回の値が残らないように。
    const resetSubViewForms = useCallback(() => {
        setNewAssignmentName('');
        setNewMeshGroupLimit(DEFAULT_MESH_GROUP_LIMIT);
        setReuseFilterGroupId('');
    }, []);
    const handleToggleInlineCreate = useCallback(() => {
        resetSubViewForms();
        setShowReuse(false);
        setShowInlineCreate((v) => !v);
    }, [resetSubViewForms]);
    const handleNewAssignmentNameChange = useCallback((e) => setNewAssignmentName(e.target.value), []);
    const handleSubmitInlineCreate = useCallback(
        (e) => {
            e.preventDefault();
            const trimmed = newAssignmentName.trim();
            if (!trimmed || isLoading) return;
            onCreateAssignmentInClass(group, trimmed, { meshGroupLimit: newMeshGroupLimit });
            resetSubViewForms();
            setShowInlineCreate(false);
        },
        [newAssignmentName, newMeshGroupLimit, isLoading, onCreateAssignmentInClass, group, resetSubViewForms],
    );
    const handleToggleReuse = useCallback(() => {
        resetSubViewForms();
        setShowInlineCreate(false);
        setShowReuse((v) => !v);
    }, [resetSubViewForms]);
    const handleReuseFilterChange = useCallback((e) => setReuseFilterGroupId(e.target.value), []);
    const handleReuseCopy = useCallback(
        (e) => {
            const sourceId = e.currentTarget.dataset.classroomId;
            const source = (allClassrooms || []).find((c) => c.classroomId === sourceId);
            if (source) {
                onReuseAssignment(source, group);
                resetSubViewForms();
                setShowReuse(false);
            }
        },
        [allClassrooms, onReuseAssignment, group, resetSubViewForms],
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

    const handleOpenTopicDialog = useCallback(() => setShowTopicDialog(true), []);
    const handleCloseTopicDialog = useCallback(() => setShowTopicDialog(false), []);
    const handleAddTopic = useCallback(
        (name) => {
            onUpdateGroupTopics(group.groupId, { action: 'add', name });
            setShowTopicDialog(false);
        },
        [onUpdateGroupTopics, group.groupId],
    );
    const handleSelectStream = useCallback(() => setTab('stream'), [setTab]);
    const handleSelectClasswork = useCallback(() => setTab('classwork'), [setTab]);

    // Accordion (B7): one open row at a time. Its counts and description are
    // loaded when it opens (not with the list) and kept for this board.
    const [openId, setOpenId] = useState(null);
    const [summaries, setSummaries] = useState({});
    const summariesRef = useRef(summaries);
    summariesRef.current = summaries;
    const handleToggleRow = useCallback(
        (classroom) => {
            const id = classroom.classroomId;
            setOpenId((current) => (current === id ? null : id));
            // Load once per row, but retry a row whose last load failed ("-").
            const known = summariesRef.current[id];
            if (!onLoadAssignmentSummary || (known && !known.failed)) return;
            setSummaries((prev) => ({ ...prev, [id]: { loading: true } }));
            Promise.resolve(onLoadAssignmentSummary(classroom))
                .then((data) =>
                    setSummaries((prev) => ({ ...prev, [id]: data ? { data } : { failed: true } })),
                )
                .catch(() => setSummaries((prev) => ({ ...prev, [id]: { failed: true } })));
        },
        [onLoadAssignmentSummary],
    );
    // Stream entries open their assignment on［授業］: an active one as the open
    // row, an archived one in the expanded archived section (its［復元］).
    const streamEvents = tab === 'stream' ? buildStreamEvents(classrooms, archivedClassrooms) : [];
    const [scrollTargetId, setScrollTargetId] = useState(null);
    const handleOpenStreamEvent = useCallback(
        (event) => {
            const target = event.classroom;
            setTab('classwork');
            if (event.archived) {
                setShowArchived(true);
                setScrollTargetId(`classroom-board-archived-row-${target.classroomId}`);
            } else {
                if (openId !== target.classroomId) handleToggleRow(target);
                setScrollTargetId(`classroom-board-row-${target.classroomId}`);
            }
        },
        [setTab, openId, handleToggleRow],
    );
    useEffect(() => {
        if (!scrollTargetId) return;
        const el = document.querySelector(`[data-testid="${scrollTargetId}"]`);
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
        setScrollTargetId(null);
    }, [scrollTargetId]);
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
    // パンくずの末尾（現在地）に出すタブ名。タブのボタンと同じ descriptor。
    const tabMessages = {
        stream: {
            defaultMessage: 'Stream',
            description: 'Tab of a class: the stream (announcements), like Google Classroom',
            id: 'gui.classroom.board.tabStream',
        },
        classwork: {
            defaultMessage: 'Classwork',
            description: 'Tab of a class: the assignment list, like Google Classroom',
            id: 'gui.classroom.board.tabClasswork',
        },
    };
    const handleBoardHome = useCallback(() => {
        resetSubViewForms();
        setShowInlineCreate(false);
        setShowReuse(false);
        if (shared) {
            if (shared.shareTarget) shared.handleCloseShareForm();
            if (shared.showPasscodeImport) shared.handleClosePasscodeImport();
            if (shared.showCatalog) shared.handleCloseCatalog();
        }
    }, [shared, resetSubViewForms]);

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
                    // 現在地は「クラス > タブ（またはサブビュー）」。サブビュー中はクラス名を
                    // ボードへ戻るリンクにする（testid は歴史的経緯で ...-assignments のまま）。
                    subView
                        ? {
                              label: formatClassLabel(group),
                              onClick: handleBoardHome,
                              testId: 'classroom-breadcrumb-assignments',
                          }
                        : { label: formatClassLabel(group) },
                { label: intl.formatMessage(subView ? subViewMessages[subView] : tabMessages[tab]) },
            ]}
            className={styles.boardScreen}
            testId="classroom-board"
        >
            {!subView && (
                <React.Fragment>
                    {/* クラス名は独立行（省略しない）。その下に［ストリーム］［授業］のタブ。 */}
                    <h2 className={styles.boardTitle}>{formatClassLabel(group)}</h2>
                    <div className={styles.boardTabs} role="tablist">
                        <button
                            aria-selected={tab === 'stream'}
                            className={tab === 'stream' ? styles.boardTabActive : styles.boardTab}
                            data-testid="classroom-board-tab-stream"
                            role="tab"
                            type="button"
                            onClick={handleSelectStream}
                        >
                            <FormattedMessage {...tabMessages.stream} />
                        </button>
                        <button
                            aria-selected={tab === 'classwork'}
                            className={tab === 'classwork' ? styles.boardTabActive : styles.boardTab}
                            data-testid="classroom-board-tab-classwork"
                            role="tab"
                            type="button"
                            onClick={handleSelectClasswork}
                        >
                            <FormattedMessage {...tabMessages.classwork} />
                        </button>
                    </div>
                    {tab === 'classwork' ? (
                        // R2: 主ボタンは［＋ 作成 ▾］1 つ。作り方は毎回選んでもらう（先生ごとに
                        // 使う作り方が違うため決め打ちしない）。まれな一括 DL は「…」へ。
                        <div className={styles.boardHeader}>
                            <BoardMenu
                                buttonClassName={styles.boardCreateButton}
                                disabled={isLoading}
                                label={
                                    <FormattedMessage
                                        defaultMessage="+ Create ▾"
                                        description="Create menu button on the classwork tab (Google Classroom style)"
                                        id="gui.classroom.board.createMenu"
                                    />
                                }
                                testId="classroom-board-create-menu"
                            >
                                {(close) => (
                                    <React.Fragment>
                                        <BoardMenuItem
                                            close={close}
                                            testId="classroom-board-create"
                                            onSelect={handleToggleInlineCreate}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Assignment"
                                                description="Create menu item: a new assignment"
                                                id="gui.classroom.board.createAssignmentItem"
                                            />
                                        </BoardMenuItem>
                                        <BoardMenuItem
                                            close={close}
                                            testId="classroom-board-reuse"
                                            onSelect={handleToggleReuse}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Reuse an assignment"
                                                description="Button on the board to reuse (duplicate) an existing assignment"
                                                id="gui.classroom.board.reuse"
                                            />
                                        </BoardMenuItem>
                                        {shared ? (
                                            <BoardMenuItem
                                                close={close}
                                                testId="classroom-board-shared-catalog"
                                                onSelect={shared.handleOpenCatalog}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Find in みんなの課題"
                                                    description="Button that opens the shared assignment catalog"
                                                    id="gui.classroom.shared.openCatalog"
                                                />
                                            </BoardMenuItem>
                                        ) : null}
                                        {shared ? (
                                            <BoardMenuItem
                                                close={close}
                                                testId="classroom-board-passcode-import"
                                                onSelect={shared.handleOpenPasscodeImport}
                                            >
                                                <FormattedMessage
                                                    defaultMessage="Import by passcode"
                                                    description="Button that opens the passcode import step"
                                                    id="gui.classroom.shared.passcodeImport"
                                                />
                                            </BoardMenuItem>
                                        ) : null}
                                        <hr className={styles.boardMenuSeparator} />
                                        <BoardMenuItem
                                            close={close}
                                            testId="classroom-board-create-topic"
                                            onSelect={handleOpenTopicDialog}
                                        >
                                            <FormattedMessage
                                                defaultMessage="Topic"
                                                description="Label of the topic selector on an assignment row"
                                                id="gui.classroom.board.topicLabel"
                                            />
                                        </BoardMenuItem>
                                    </React.Fragment>
                                )}
                            </BoardMenu>
                            {onDownloadClassAll ? (
                                <div className={styles.boardHeaderEnd}>
                                    <BoardMenu
                                        alignRight
                                        ariaLabel={intl.formatMessage({
                                            defaultMessage: 'More',
                                            description: 'Accessible name of the … menu on the classwork tab',
                                            id: 'gui.classroom.board.moreMenu',
                                        })}
                                        buttonClassName={styles.boardKebab}
                                        label="…"
                                        testId="classroom-board-more-menu"
                                    >
                                        {(close) => (
                                            <BoardMenuItem
                                                close={close}
                                                disabled={isLoading || !!downloadProgress}
                                                testId="classroom-board-download-class"
                                                onSelect={handleDownloadClassAll}
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
                                            </BoardMenuItem>
                                        )}
                                    </BoardMenu>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </React.Fragment>
            )}
            {!subView && tab === 'stream' ? (
                // R6 exception: no main action here, so only this frame scrolls when
                // the class has many entries.
                <div className={styles.boardList} data-testid="classroom-board-stream">
                    {streamEvents.length === 0 ? (
                        <p className={styles.boardEmpty} data-testid="classroom-board-stream-empty">
                            <FormattedMessage
                                defaultMessage="Nothing here yet. Assignments you create are listed here."
                                description="Empty state of the stream tab of a class"
                                id="gui.classroom.board.streamEmpty"
                            />
                        </p>
                    ) : (
                        <ul className={styles.streamItems}>
                            {streamEvents.map((event) => (
                                <StreamItem key={event.key} event={event} onOpen={handleOpenStreamEvent} />
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}
            {showTopicDialog ? (
                <TopicAddDialog
                    isLoading={isLoading}
                    onAdd={handleAddTopic}
                    onCancel={handleCloseTopicDialog}
                />
            ) : null}
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
                    <MeshGroupLimitField
                        disabled={isLoading}
                        testId="classroom-board-create-mesh-group-limit"
                        value={newMeshGroupLimit}
                        onChange={setNewMeshGroupLimit}
                    />
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
            ) : tab === 'stream' ? null : (
                // R6: only this list frame scrolls (its length follows the number of
                // assignments); the tabs and［＋ 作成 ▾］stay visible above it.
                <div className={styles.boardList} data-testid="classroom-board-list">
            {sections.length === 0 ? (
                <p className={styles.boardEmpty} data-testid="classroom-board-empty">
                    <FormattedMessage
                        defaultMessage={'No assignments yet. Choose "+ Create" → "Assignment" to add one.'}
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
                    <TopicHeading
                        isLoading={isLoading}
                        topic={section.topic}
                        onRemove={handleRemoveTopic}
                        onRename={handleRenameTopic}
                    />
                    <ul className={styles.boardRows}>
                        {section.classrooms.map((classroom) => (
                            <AssignmentRow
                                key={classroom.classroomId}
                                classroom={classroom}
                                downloadingId={downloadingId}
                                downloadProgress={downloadProgress}
                                isLoading={isLoading}
                                isOpen={openId === classroom.classroomId}
                                summary={summaries[classroom.classroomId]}
                                topics={topics}
                                onDownloadAssignment={handleDownloadAssignment}
                                onSelectClassroom={onSelectClassroom}
                                onShare={shared ? shared.handleOpenShareFor : null}
                                onToggle={handleToggleRow}
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
    initialTab: PropTypes.oneOf(['stream', 'classwork']),
    isLoading: PropTypes.bool,
    onCreateAssignmentInClass: PropTypes.func.isRequired,
    onDownloadClassAll: PropTypes.func,
    onLoadAssignmentSummary: PropTypes.func,
    onRestoreClassroom: PropTypes.func,
    onReuseAssignment: PropTypes.func.isRequired,
    onSelectClassroom: PropTypes.func.isRequired,
    onShowClassList: PropTypes.func.isRequired,
    onTabChange: PropTypes.func,
    onUpdateAssignmentMeta: PropTypes.func.isRequired,
    onUpdateGroupTopics: PropTypes.func.isRequired,
    shared: PropTypes.object,
};

export default TeacherAssignmentBoard;
