/**
 * Class list — the teacher's post-login landing view (Google Classroom
 * style): one card per class (学級). Hosts the combined "class + optional
 * first assignment" creation form and per-card inline settings (name /
 * year / section / student count / class-level co-teachers / archive).
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import { formatClassLabel } from '../../lib/classroom-class-label.js';
import ErrorDisplay from './error-display.jsx';
import TeacherBreadcrumbs from './teacher-breadcrumbs.jsx';

import styles from './classroom-modal.css';

/** Default school year: before April it is still the previous year's term. */
const currentSchoolYear = () => {
    const now = new Date();
    return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

// Inline settings editor shown in place of a card (recommended UX: no nested modal).
const ClassSettingsForm = ({ group, isLoading, onCancel, onUpdateGroup }) => {
    const intl = useIntl();
    const [name, setName] = useState(group.name);
    const [year, setYear] = useState(String(group.year));
    const [section, setSection] = useState(group.section || '');
    const [studentCount, setStudentCount] = useState(
        typeof group.studentCount === 'number' ? String(group.studentCount) : '',
    );
    const [coTeachers, setCoTeachers] = useState(group.coTeacherEmails || []);
    const [newCoTeacher, setNewCoTeacher] = useState('');

    const handleNameChange = useCallback((e) => setName(e.target.value), []);
    const handleYearChange = useCallback((e) => setYear(e.target.value), []);
    const handleSectionChange = useCallback((e) => setSection(e.target.value), []);
    const handleCountChange = useCallback((e) => setStudentCount(e.target.value), []);
    const handleNewCoTeacherChange = useCallback((e) => setNewCoTeacher(e.target.value), []);
    const handleAddCoTeacher = useCallback(() => {
        const email = newCoTeacher.trim().toLowerCase();
        if (!email || coTeachers.includes(email)) return;
        setCoTeachers((prev) => [...prev, email]);
        setNewCoTeacher('');
    }, [newCoTeacher, coTeachers]);
    const handleRemoveCoTeacher = useCallback((e) => {
        const email = e.currentTarget.dataset.email;
        setCoTeachers((prev) => prev.filter((x) => x !== email));
    }, []);
    const handleToggleArchive = useCallback(() => {
        onUpdateGroup(group.groupId, {
            status: group.status === 'archived' ? 'active' : 'archived',
        });
        onCancel();
    }, [group, onUpdateGroup, onCancel]);

    const canSave = name.trim().length > 0 && parseInt(year, 10) >= 2000;
    const handleSave = useCallback(
        (e) => {
            e.preventDefault();
            if (!canSave || isLoading) return;
            const updates = {
                name: name.trim(),
                year: parseInt(year, 10),
                section: section.trim() || null,
                coTeacherEmails: coTeachers,
            };
            const count = parseInt(studentCount, 10);
            if (count > 0) {
                updates.studentCount = count;
            }
            onUpdateGroup(group.groupId, updates);
            onCancel();
        },
        [canSave, isLoading, name, year, section, studentCount, coTeachers, onUpdateGroup, group.groupId, onCancel],
    );

    return (
        <form
            className={styles.classSettingsForm}
            data-testid={`classroom-class-settings-${group.groupId}`}
            onSubmit={handleSave}
        >
            <input
                data-testid="classroom-class-settings-name"
                disabled={isLoading}
                maxLength={50}
                placeholder={intl.formatMessage({
                    defaultMessage: 'Class name (required, e.g. Technology)',
                    description: 'Placeholder for the class name in settings',
                    id: 'gui.classroom.classSettings.namePlaceholder',
                })}
                type="text"
                value={name}
                onChange={handleNameChange}
            />
            <div className={styles.classSettingsRow}>
                <input
                    data-testid="classroom-class-settings-year"
                    disabled={isLoading}
                    max={2100}
                    min={2000}
                    type="number"
                    value={year}
                    onChange={handleYearChange}
                />
                <input
                    data-testid="classroom-class-settings-section"
                    disabled={isLoading}
                    maxLength={50}
                    placeholder={intl.formatMessage({
                        defaultMessage: 'Section (optional, e.g. Year 2 Class 1)',
                        description: 'Placeholder for the class section input',
                        id: 'gui.classroom.classSettings.sectionPlaceholder',
                    })}
                    type="text"
                    value={section}
                    onChange={handleSectionChange}
                />
                <input
                    data-testid="classroom-class-settings-count"
                    disabled={isLoading}
                    max={50}
                    min={1}
                    placeholder={intl.formatMessage({
                        defaultMessage: 'Students',
                        description: 'Placeholder for the student count in settings',
                        id: 'gui.classroom.classSettings.countPlaceholder',
                    })}
                    type="number"
                    value={studentCount}
                    onChange={handleCountChange}
                />
            </div>
            <div className={styles.classSettingsCoTeachers}>
                <span className={styles.classSettingsLabel}>
                    <FormattedMessage
                        defaultMessage="Co-teachers (class-wide)"
                        description="Label of the class-level co-teacher list"
                        id="gui.classroom.classSettings.coTeachersLabel"
                    />
                </span>
                {coTeachers.map((email) => (
                    <span key={email} className={styles.topicChip}>
                        <span className={styles.coTeacherChipEmail}>{email}</span>
                        <button
                            aria-label="remove"
                            className={styles.topicChipRemove}
                            data-email={email}
                            data-testid={`classroom-class-settings-remove-co-teacher-${email}`}
                            disabled={isLoading}
                            type="button"
                            onClick={handleRemoveCoTeacher}
                        >
                            {'×'}
                        </button>
                    </span>
                ))}
                <input
                    data-testid="classroom-class-settings-co-teacher-input"
                    disabled={isLoading}
                    placeholder={intl.formatMessage({
                        defaultMessage: 'Co-teacher email',
                        description: 'Placeholder for the co-teacher email input',
                        id: 'gui.classroom.classSettings.coTeacherPlaceholder',
                    })}
                    type="email"
                    value={newCoTeacher}
                    onChange={handleNewCoTeacherChange}
                />
                <button
                    className={styles.topicAddButton}
                    data-testid="classroom-class-settings-add-co-teacher"
                    disabled={isLoading || newCoTeacher.trim().length === 0}
                    type="button"
                    onClick={handleAddCoTeacher}
                >
                    <FormattedMessage
                        defaultMessage="Add"
                        description="Button to add a co-teacher email"
                        id="gui.classroom.classSettings.addCoTeacher"
                    />
                </button>
            </div>
            <div className={styles.classSettingsActions}>
                <button
                    data-testid="classroom-class-settings-archive"
                    disabled={isLoading}
                    type="button"
                    onClick={handleToggleArchive}
                >
                    {group.status === 'archived' ? (
                        <FormattedMessage
                            defaultMessage="Unarchive"
                            description="Button to unarchive a class"
                            id="gui.classroom.classSettings.unarchive"
                        />
                    ) : (
                        <FormattedMessage
                            defaultMessage="Archive"
                            description="Button to archive a class"
                            id="gui.classroom.classSettings.archive"
                        />
                    )}
                </button>
                <span className={styles.classSettingsSpacer} />
                <button
                    data-testid="classroom-class-settings-cancel"
                    disabled={isLoading}
                    type="button"
                    onClick={onCancel}
                >
                    <FormattedMessage
                        defaultMessage="Cancel"
                        description="Cancel button of the class settings form"
                        id="gui.classroom.classSettings.cancel"
                    />
                </button>
                <button
                    className={styles.classSettingsSave}
                    data-testid="classroom-class-settings-save"
                    disabled={!canSave || isLoading}
                    type="submit"
                >
                    <FormattedMessage
                        defaultMessage="Save"
                        description="Save button of the class settings form"
                        id="gui.classroom.classSettings.save"
                    />
                </button>
            </div>
        </form>
    );
};

ClassSettingsForm.propTypes = {
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    onUpdateGroup: PropTypes.func.isRequired,
};

const ClassCard = ({ group, assignmentCount, isLoading, onSelectGroup, onShowEvaluation, onShowSettings }) => {
    const intl = useIntl();
    const handleOpen = useCallback(() => onSelectGroup(group), [onSelectGroup, group]);
    const handleEvaluate = useCallback(() => onShowEvaluation(group), [onShowEvaluation, group]);
    const handleSettings = useCallback(() => onShowSettings(group.groupId), [onShowSettings, group.groupId]);

    return (
        <li className={styles.classCard} data-testid={`classroom-class-card-${group.groupId}`}>
            <button
                className={styles.classCardMain}
                data-testid={`classroom-class-open-${group.groupId}`}
                disabled={isLoading}
                type="button"
                onClick={handleOpen}
            >
                <span className={styles.classCardName}>{formatClassLabel(group)}</span>
                <span className={styles.classCardMeta}>
                    {intl.formatMessage(
                        {
                            defaultMessage: '{count} assignments',
                            description: 'Assignment count on a class card',
                            id: 'gui.classroom.classList.assignmentCount',
                        },
                        { count: assignmentCount },
                    )}
                </span>
                <span className={styles.classCardBadges}>
                    {group.googleClassroomCourseId ? (
                        <span className={styles.classCardBadge}>
                            <FormattedMessage
                                defaultMessage="Google Classroom"
                                description="Badge shown when a class is linked to a Google Classroom course"
                                id="gui.classroom.classList.gcBadge"
                            />
                        </span>
                    ) : null}
                    {group.role === 'co-teacher' ? (
                        <span className={styles.classCardBadge}>
                            <FormattedMessage
                                defaultMessage="Co-managed"
                                description="Badge shown when the teacher co-manages this class"
                                id="gui.classroom.classList.coTeacherBadge"
                            />
                        </span>
                    ) : null}
                    {group.status === 'archived' ? (
                        <span className={styles.classCardBadge}>
                            <FormattedMessage
                                defaultMessage="Archived"
                                description="Badge for an archived class"
                                id="gui.classroom.classList.archivedBadge"
                            />
                        </span>
                    ) : null}
                </span>
            </button>
            <button
                className={styles.classCardEvaluate}
                data-testid={`classroom-class-evaluate-${group.groupId}`}
                disabled={isLoading}
                type="button"
                onClick={handleEvaluate}
            >
                <FormattedMessage
                    defaultMessage="Evaluate"
                    description="Button on a class card to open term-end evaluation"
                    id="gui.classroom.classList.evaluate"
                />
            </button>
            <button
                className={styles.classCardEvaluate}
                data-testid={`classroom-class-settings-open-${group.groupId}`}
                disabled={isLoading}
                type="button"
                onClick={handleSettings}
            >
                <FormattedMessage
                    defaultMessage="Settings"
                    description="Button on a class card to open its settings"
                    id="gui.classroom.classList.settings"
                />
            </button>
        </li>
    );
};

ClassCard.propTypes = {
    assignmentCount: PropTypes.number.isRequired,
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onSelectGroup: PropTypes.func.isRequired,
    onShowEvaluation: PropTypes.func.isRequired,
    onShowSettings: PropTypes.func.isRequired,
};

const TeacherClassList = ({
    classrooms,
    error,
    errorTitle,
    groups,
    isLoading,
    onCreateClassWithAssignment,
    onOpenUngrouped,
    onSelectGroup,
    onShowEvaluation,
    onShowGoogleCourses,
    onUpdateGroup,
}) => {
    const intl = useIntl();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [settingsGroupId, setSettingsGroupId] = useState(null);
    const [name, setName] = useState('');
    const [year, setYear] = useState(String(currentSchoolYear()));
    const [section, setSection] = useState('');
    const [studentCount, setStudentCount] = useState('');
    const [assignmentName, setAssignmentName] = useState('');

    const handleToggleCreateForm = useCallback(() => setShowCreateForm((v) => !v), []);
    const handleNameChange = useCallback((e) => setName(e.target.value), []);
    const handleYearChange = useCallback((e) => setYear(e.target.value), []);
    const handleSectionChange = useCallback((e) => setSection(e.target.value), []);
    const handleStudentCountChange = useCallback((e) => setStudentCount(e.target.value), []);
    const handleAssignmentNameChange = useCallback((e) => setAssignmentName(e.target.value), []);
    const handleShowSettings = useCallback((groupId) => setSettingsGroupId(groupId), []);
    const handleOpenUngrouped = useCallback(
        (e) => onOpenUngrouped(e.currentTarget.dataset.classroomId),
        [onOpenUngrouped],
    );
    const handleCloseSettings = useCallback(() => setSettingsGroupId(null), []);

    // The first assignment is optional: a class can be created on its own.
    const canSubmit = name.trim().length > 0 && parseInt(studentCount, 10) > 0 && parseInt(year, 10) >= 2000;

    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault();
            if (!canSubmit || isLoading) return;
            onCreateClassWithAssignment({
                name: name.trim(),
                year: parseInt(year, 10),
                section: section.trim() || null,
                studentCount: parseInt(studentCount, 10),
                assignmentName: assignmentName.trim() || null,
            });
        },
        [canSubmit, isLoading, onCreateClassWithAssignment, name, year, section, studentCount, assignmentName],
    );

    const activeGroups = groups.filter((g) => g.status !== 'archived');
    const countFor = (groupId) => classrooms.filter((c) => c.groupId === groupId).length;
    // develop-compat safety net: assignments that do not belong to any class
    // yet (e.g. a co-teacher logs in before the owner's account migrated, or
    // migration failed). They must never be hidden — list them directly.
    const knownGroupIds = new Set(groups.map((g) => g.groupId));
    const ungrouped = classrooms.filter((c) => !c.groupId || !knownGroupIds.has(c.groupId));

    return (
        <div className={styles.classList} data-testid="classroom-phase-teacher-class-list">
            <TeacherBreadcrumbs
                items={[
                    {
                        label: intl.formatMessage({
                            defaultMessage: 'Class list',
                            description: 'Breadcrumb label of the class list (current view)',
                            id: 'gui.classroom.breadcrumbs.classList',
                        }),
                    },
                ]}
            />
            <h2 className={styles.classListTitle}>
                <FormattedMessage
                    defaultMessage="Your classes"
                    description="Title of the class list (post-login landing view)"
                    id="gui.classroom.classList.title"
                />
            </h2>
            <p className={styles.classListHint}>
                <FormattedMessage
                    defaultMessage="A class is one homeroom (e.g. Year 2 Class 1). Open a class to manage its assignments."
                    description="Hint below the class list title"
                    id="gui.classroom.classList.hint"
                />
            </p>
            <ErrorDisplay error={error} errorTitle={errorTitle} />
            <button
                className={styles.classListCreateButton}
                data-testid="classroom-class-create"
                disabled={isLoading}
                type="button"
                onClick={handleToggleCreateForm}
            >
                <FormattedMessage
                    defaultMessage="Create a class"
                    description="Button that opens the combined class creation form"
                    id="gui.classroom.classList.create"
                />
            </button>
            {onShowGoogleCourses ? (
                <button
                    className={styles.classListImportButton}
                    data-testid="classroom-class-import-gc"
                    disabled={isLoading}
                    type="button"
                    onClick={onShowGoogleCourses}
                >
                    <FormattedMessage
                        defaultMessage="Import from Google Classroom"
                        description="Button on the class list to import a GC course as a class"
                        id="gui.classroom.classList.importGc"
                    />
                </button>
            ) : null}
            {showCreateForm ? (
                <form
                    className={`${styles.boardPopover} ${styles.classListCreateForm}`}
                    onSubmit={handleSubmit}
                >
                    <input
                        data-testid="classroom-class-create-name"
                        disabled={isLoading}
                        maxLength={50}
                        placeholder={intl.formatMessage({
                            defaultMessage: 'Class name (required, e.g. Technology)',
                            description: 'Placeholder for the class name input',
                            id: 'gui.classroom.classList.namePlaceholder',
                        })}
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                    />
                    <div className={styles.classSettingsRow}>
                        <input
                            data-testid="classroom-class-create-year"
                            disabled={isLoading}
                            max={2100}
                            min={2000}
                            type="number"
                            value={year}
                            onChange={handleYearChange}
                        />
                        <input
                            data-testid="classroom-class-create-section"
                            disabled={isLoading}
                            maxLength={50}
                            placeholder={intl.formatMessage({
                                defaultMessage: 'Section (optional, e.g. Year 2 Class 1)',
                                description: 'Placeholder for the class section input',
                                id: 'gui.classroom.classList.sectionPlaceholder',
                            })}
                            type="text"
                            value={section}
                            onChange={handleSectionChange}
                        />
                        <input
                            data-testid="classroom-class-create-count"
                            disabled={isLoading}
                            max={50}
                            min={1}
                            placeholder={intl.formatMessage({
                                defaultMessage: 'Number of students (required)',
                                description: 'Placeholder for the student count input',
                                id: 'gui.classroom.classList.countPlaceholder',
                            })}
                            type="number"
                            value={studentCount}
                            onChange={handleStudentCountChange}
                        />
                    </div>
                    <input
                        data-testid="classroom-class-create-assignment"
                        disabled={isLoading}
                        maxLength={50}
                        placeholder={intl.formatMessage({
                            defaultMessage: 'First assignment name (optional — leave empty to create just the class)',
                            description: 'Placeholder for the optional first assignment name input',
                            id: 'gui.classroom.classList.assignmentPlaceholder',
                        })}
                        type="text"
                        value={assignmentName}
                        onChange={handleAssignmentNameChange}
                    />
                    <button
                        data-testid="classroom-class-create-submit"
                        disabled={!canSubmit || isLoading}
                        type="submit"
                    >
                        {assignmentName.trim() ? (
                            <FormattedMessage
                                defaultMessage="Create class and assignment"
                                description="Submit button when a first assignment is given"
                                id="gui.classroom.classList.createSubmit"
                            />
                        ) : (
                            <FormattedMessage
                                defaultMessage="Create the class only"
                                description="Submit button when no first assignment is given"
                                id="gui.classroom.classList.createClassOnly"
                            />
                        )}
                    </button>
                    <button
                        className={styles.popoverCancel}
                        data-testid="classroom-class-create-cancel"
                        type="button"
                        onClick={handleToggleCreateForm}
                    >
                        <FormattedMessage
                            defaultMessage="Cancel"
                            description="Cancel button of the class creation form"
                            id="gui.classroom.classList.createCancel"
                        />
                    </button>
                </form>
            ) : null}
            {activeGroups.length === 0 && !showCreateForm ? (
                <p className={styles.classListEmpty} data-testid="classroom-class-list-empty">
                    <FormattedMessage
                        defaultMessage={'No classes yet. Press "Create a class" to get started.'}
                        description="Empty state of the class list"
                        id="gui.classroom.classList.empty"
                    />
                </p>
            ) : null}
            {ungrouped.length > 0 ? (
                <div className={styles.ungroupedSection} data-testid="classroom-ungrouped-list">
                    <p className={styles.classListHint}>
                        <FormattedMessage
                            defaultMessage="Assignments not in any of your classes (shared with you or not yet migrated):"
                            description="Heading of the ungrouped assignments fallback list"
                            id="gui.classroom.classList.ungroupedHint"
                        />
                    </p>
                    <ul className={styles.classCards}>
                        {ungrouped.map((c) => (
                            <li key={c.classroomId} className={styles.classCard}>
                                <button
                                    className={styles.classCardMain}
                                    data-classroom-id={c.classroomId}
                                    data-testid={`classroom-ungrouped-open-${c.classroomId}`}
                                    disabled={isLoading}
                                    type="button"
                                    onClick={handleOpenUngrouped}
                                >
                                    <span className={styles.classCardName}>
                                        {c.assignmentName || c.className}
                                    </span>
                                    <span className={styles.classCardMeta}>{c.className}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            <ul className={styles.classCards} data-testid="classroom-class-list">
                {activeGroups.map((group) =>
                    settingsGroupId === group.groupId ? (
                        <li key={group.groupId} className={styles.classCard}>
                            <ClassSettingsForm
                                group={group}
                                isLoading={isLoading}
                                onCancel={handleCloseSettings}
                                onUpdateGroup={onUpdateGroup}
                            />
                        </li>
                    ) : (
                        <ClassCard
                            key={group.groupId}
                            assignmentCount={countFor(group.groupId)}
                            group={group}
                            isLoading={isLoading}
                            onSelectGroup={onSelectGroup}
                            onShowEvaluation={onShowEvaluation}
                            onShowSettings={handleShowSettings}
                        />
                    ),
                )}
            </ul>
        </div>
    );
};

TeacherClassList.propTypes = {
    classrooms: PropTypes.arrayOf(PropTypes.object).isRequired,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    groups: PropTypes.arrayOf(PropTypes.object).isRequired,
    isLoading: PropTypes.bool,
    onCreateClassWithAssignment: PropTypes.func.isRequired,
    onOpenUngrouped: PropTypes.func.isRequired,
    onSelectGroup: PropTypes.func.isRequired,
    onShowEvaluation: PropTypes.func.isRequired,
    onShowGoogleCourses: PropTypes.func,
    onUpdateGroup: PropTypes.func.isRequired,
};

export default TeacherClassList;
