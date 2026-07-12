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
import ErrorDisplay from './error-display.jsx';

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
    classrooms,
    error,
    errorTitle,
    group,
    isLoading,
    onSelectClassroom,
    onShowCreateForm,
    onUpdateAssignmentMeta,
    onUpdateGroupTopics,
}) => {
    const intl = useIntl();
    const [newTopic, setNewTopic] = useState('');
    const topics = Array.isArray(group.topics) ? group.topics : [];
    const sections = buildAssignmentSections(classrooms, topics);

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
            <div className={styles.boardHeader}>
                <h2 className={styles.boardTitle}>
                    {group.name}
                    <span className={styles.boardYear}>
                        {intl.formatMessage(
                            {
                                defaultMessage: '{year} school year',
                                description: 'School year shown in the board header',
                                id: 'gui.classroom.board.yearLabel',
                            },
                            { year: group.year },
                        )}
                    </span>
                </h2>
                <button
                    className={styles.boardCreateButton}
                    data-testid="classroom-board-create"
                    disabled={isLoading}
                    type="button"
                    onClick={onShowCreateForm}
                >
                    <FormattedMessage
                        defaultMessage="Create an assignment"
                        description="Button on the board to create a new assignment"
                        id="gui.classroom.board.create"
                    />
                </button>
            </div>
            <ErrorDisplay error={error} errorTitle={errorTitle} />
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
        </div>
    );
};

TeacherAssignmentBoard.propTypes = {
    classrooms: PropTypes.arrayOf(PropTypes.object).isRequired,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onSelectClassroom: PropTypes.func.isRequired,
    onShowCreateForm: PropTypes.func.isRequired,
    onUpdateAssignmentMeta: PropTypes.func.isRequired,
    onUpdateGroupTopics: PropTypes.func.isRequired,
};

export default TeacherAssignmentBoard;
