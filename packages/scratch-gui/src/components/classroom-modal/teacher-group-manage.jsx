/**
 * Group (組) management screen for teachers.
 *
 * Create a group (name + school year) and manage existing ones (rename,
 * archive / unarchive). Groups organize lesson classrooms over the year;
 * students never see them.
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

/** Default school year: before April it is still the previous year's term. */
const currentSchoolYear = () => {
    const now = new Date();
    return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

const GroupRow = ({ group, isLoading, onShowEvaluation, onUpdateGroup }) => {
    const intl = useIntl();
    const [editName, setEditName] = useState(group.name);

    const handleNameChange = useCallback((e) => setEditName(e.target.value), []);
    const handleShowEvaluation = useCallback(() => onShowEvaluation(group), [onShowEvaluation, group]);
    const handleNameBlur = useCallback(() => {
        const trimmed = editName.trim();
        if (trimmed && trimmed !== group.name) {
            onUpdateGroup(group.groupId, { name: trimmed });
        } else {
            setEditName(group.name);
        }
    }, [editName, group, onUpdateGroup]);
    const handleToggleArchive = useCallback(() => {
        onUpdateGroup(group.groupId, {
            status: group.status === 'archived' ? 'active' : 'archived',
        });
    }, [group, onUpdateGroup]);

    return (
        <li className={styles.groupRow} data-testid={`classroom-group-row-${group.groupId}`}>
            <input
                className={styles.groupRowNameInput}
                data-testid={`classroom-group-name-${group.groupId}`}
                disabled={isLoading}
                maxLength={50}
                type="text"
                value={editName}
                onBlur={handleNameBlur}
                onChange={handleNameChange}
            />
            <span className={styles.groupRowYear} data-testid={`classroom-group-year-${group.groupId}`}>
                {intl.formatMessage(
                    {
                        defaultMessage: '{year} school year',
                        description: 'School year label in the group list',
                        id: 'gui.classroom.groups.yearLabel',
                    },
                    { year: group.year },
                )}
            </span>
            {group.status === 'archived' && (
                <span className={styles.groupRowArchivedBadge}>
                    <FormattedMessage
                        defaultMessage="Archived"
                        description="Badge on archived groups"
                        id="gui.classroom.groups.archivedBadge"
                    />
                </span>
            )}
            {onShowEvaluation && group.status === 'active' && (
                <button
                    className={styles.secondaryButton}
                    data-testid={`classroom-group-evaluate-${group.groupId}`}
                    disabled={isLoading}
                    onClick={handleShowEvaluation}
                >
                    <FormattedMessage
                        defaultMessage="Evaluate"
                        description="Open the term-end evaluation screen for a group"
                        id="gui.classroom.groups.evaluate"
                    />
                </button>
            )}
            <button
                className={styles.secondaryButton}
                data-testid={`classroom-group-archive-${group.groupId}`}
                disabled={isLoading}
                onClick={handleToggleArchive}
            >
                {group.status === 'archived' ? (
                    <FormattedMessage
                        defaultMessage="Restore"
                        description="Unarchive a group"
                        id="gui.classroom.groups.unarchive"
                    />
                ) : (
                    <FormattedMessage
                        defaultMessage="Archive"
                        description="Archive a group"
                        id="gui.classroom.groups.archive"
                    />
                )}
            </button>
        </li>
    );
};

GroupRow.propTypes = {
    group: PropTypes.shape({
        groupId: PropTypes.string.isRequired,
        name: PropTypes.string,
        year: PropTypes.number,
        status: PropTypes.string,
    }).isRequired,
    isLoading: PropTypes.bool,
    onShowEvaluation: PropTypes.func,
    onUpdateGroup: PropTypes.func.isRequired,
};

const TeacherGroupManage = ({
    error,
    errorTitle,
    groups,
    isLoading,
    onBack,
    onCreateGroup,
    onShowEvaluation,
    onUpdateGroup,
}) => {
    const intl = useIntl();
    const [newName, setNewName] = useState('');
    const [newYear, setNewYear] = useState(String(currentSchoolYear()));

    const handleNameChange = useCallback((e) => setNewName(e.target.value), []);
    const handleYearChange = useCallback((e) => setNewYear(e.target.value), []);
    const handleCreate = useCallback(() => {
        const name = newName.trim();
        const year = parseInt(newYear, 10);
        if (!name || isNaN(year)) return;
        onCreateGroup(name, year);
        setNewName('');
    }, [newName, newYear, onCreateGroup]);

    return (
        <div data-testid="classroom-phase-teacher-group-manage">
            <h2 className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Manage Groups (Classes)"
                    description="Group management screen title"
                    id="gui.classroom.groups.title"
                />
            </h2>
            <p className={styles.assignmentEditorHint}>
                <FormattedMessage
                    defaultMessage="A group is one school class (e.g. Year 2 Class 1). Assign each lesson to a group to organize the year and enable the previous-comment recap for students."
                    description="Group management explanation"
                    id="gui.classroom.groups.hint"
                />
            </p>

            <ErrorDisplay error={error} errorTitle={errorTitle} />

            <div className={styles.groupCreateRow}>
                <input
                    className={styles.groupRowNameInput}
                    data-testid="classroom-group-create-name"
                    disabled={isLoading}
                    maxLength={50}
                    placeholder={intl.formatMessage({
                        defaultMessage: 'Group name (e.g. Year 2 Class 1)',
                        description: 'Placeholder for the new group name',
                        id: 'gui.classroom.groups.namePlaceholder',
                    })}
                    type="text"
                    value={newName}
                    onChange={handleNameChange}
                />
                <input
                    className={styles.groupCreateYearInput}
                    data-testid="classroom-group-create-year"
                    disabled={isLoading}
                    max={2100}
                    min={2000}
                    type="number"
                    value={newYear}
                    onChange={handleYearChange}
                />
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-group-create-submit"
                    disabled={isLoading || !newName.trim()}
                    onClick={handleCreate}
                >
                    <FormattedMessage
                        defaultMessage="Create Group"
                        description="Create group button"
                        id="gui.classroom.groups.create"
                    />
                </button>
            </div>

            <ul className={styles.groupList} data-testid="classroom-group-list">
                {groups.length === 0 && (
                    <li className={styles.groupListEmpty}>
                        <FormattedMessage
                            defaultMessage="No groups yet"
                            description="Empty group list message"
                            id="gui.classroom.groups.empty"
                        />
                    </li>
                )}
                {groups.map((group) => (
                    <GroupRow
                        group={group}
                        isLoading={isLoading}
                        key={group.groupId}
                        onShowEvaluation={onShowEvaluation}
                        onUpdateGroup={onUpdateGroup}
                    />
                ))}
            </ul>

            <div className={styles.buttonRow}>
                <button
                    className={styles.secondaryButton}
                    data-testid="classroom-group-manage-back"
                    onClick={onBack}
                >
                    <FormattedMessage
                        defaultMessage="Back"
                        description="Back from group management"
                        id="gui.classroom.groups.back"
                    />
                </button>
            </div>
        </div>
    );
};

TeacherGroupManage.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    groups: PropTypes.arrayOf(PropTypes.object).isRequired,
    isLoading: PropTypes.bool,
    onBack: PropTypes.func.isRequired,
    onCreateGroup: PropTypes.func.isRequired,
    onShowEvaluation: PropTypes.func,
    onUpdateGroup: PropTypes.func.isRequired,
};

export default TeacherGroupManage;
