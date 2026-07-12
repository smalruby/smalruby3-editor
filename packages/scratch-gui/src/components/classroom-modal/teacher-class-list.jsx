/**
 * Class list — the teacher's post-login landing view (Google Classroom
 * style): one card per class (学級), opening a class scopes the workspace to
 * its assignments. Also hosts the combined "class + first assignment"
 * creation form (teacher interview: one screen, two records).
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

const ClassCard = ({ group, assignmentCount, isLoading, onSelectGroup, onShowEvaluation }) => {
    const intl = useIntl();
    const handleOpen = useCallback(() => onSelectGroup(group), [onSelectGroup, group]);
    const handleEvaluate = useCallback(() => onShowEvaluation(group), [onShowEvaluation, group]);

    return (
        <li className={styles.classCard} data-testid={`classroom-class-card-${group.groupId}`}>
            <button
                className={styles.classCardMain}
                data-testid={`classroom-class-open-${group.groupId}`}
                disabled={isLoading}
                type="button"
                onClick={handleOpen}
            >
                <span className={styles.classCardName}>{group.name}</span>
                <span className={styles.classCardMeta}>
                    {intl.formatMessage(
                        {
                            defaultMessage: '{year} school year',
                            description: 'School year label on a class card',
                            id: 'gui.classroom.classList.yearLabel',
                        },
                        { year: group.year },
                    )}
                    {' ・ '}
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
        </li>
    );
};

ClassCard.propTypes = {
    assignmentCount: PropTypes.number.isRequired,
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onSelectGroup: PropTypes.func.isRequired,
    onShowEvaluation: PropTypes.func.isRequired,
};

const TeacherClassList = ({
    classrooms,
    error,
    errorTitle,
    groups,
    isLoading,
    onCreateClassWithAssignment,
    onSelectGroup,
    onShowEvaluation,
}) => {
    const intl = useIntl();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [name, setName] = useState('');
    const [year, setYear] = useState(String(currentSchoolYear()));
    const [studentCount, setStudentCount] = useState('');
    const [assignmentName, setAssignmentName] = useState('');

    const handleToggleCreateForm = useCallback(() => setShowCreateForm((v) => !v), []);
    const handleNameChange = useCallback((e) => setName(e.target.value), []);
    const handleYearChange = useCallback((e) => setYear(e.target.value), []);
    const handleStudentCountChange = useCallback((e) => setStudentCount(e.target.value), []);
    const handleAssignmentNameChange = useCallback((e) => setAssignmentName(e.target.value), []);

    const canSubmit =
        name.trim().length > 0 &&
        assignmentName.trim().length > 0 &&
        parseInt(studentCount, 10) > 0 &&
        parseInt(year, 10) >= 2000;

    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault();
            if (!canSubmit || isLoading) return;
            onCreateClassWithAssignment({
                name: name.trim(),
                year: parseInt(year, 10),
                studentCount: parseInt(studentCount, 10),
                assignmentName: assignmentName.trim(),
            });
        },
        [canSubmit, isLoading, onCreateClassWithAssignment, name, year, studentCount, assignmentName],
    );

    const activeGroups = groups.filter((g) => g.status !== 'archived');
    const countFor = (groupId) => classrooms.filter((c) => c.groupId === groupId).length;

    return (
        <div className={styles.classList} data-testid="classroom-phase-teacher-class-list">
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
            {showCreateForm ? (
                <form className={styles.classListCreateForm} onSubmit={handleSubmit}>
                    <input
                        data-testid="classroom-class-create-name"
                        disabled={isLoading}
                        maxLength={50}
                        placeholder={intl.formatMessage({
                            defaultMessage: 'Class name (e.g. Year 2 Class 1)',
                            description: 'Placeholder for the class name input',
                            id: 'gui.classroom.classList.namePlaceholder',
                        })}
                        type="text"
                        value={name}
                        onChange={handleNameChange}
                    />
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
                        data-testid="classroom-class-create-count"
                        disabled={isLoading}
                        max={50}
                        min={1}
                        placeholder={intl.formatMessage({
                            defaultMessage: 'Number of students',
                            description: 'Placeholder for the student count input',
                            id: 'gui.classroom.classList.countPlaceholder',
                        })}
                        type="number"
                        value={studentCount}
                        onChange={handleStudentCountChange}
                    />
                    <input
                        data-testid="classroom-class-create-assignment"
                        disabled={isLoading}
                        maxLength={50}
                        placeholder={intl.formatMessage({
                            defaultMessage: 'First assignment name (e.g. Move the cat)',
                            description: 'Placeholder for the first assignment name input',
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
                        <FormattedMessage
                            defaultMessage="Create class and assignment"
                            description="Submit button of the combined class creation form"
                            id="gui.classroom.classList.createSubmit"
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
            <ul className={styles.classCards} data-testid="classroom-class-list">
                {activeGroups.map((group) => (
                    <ClassCard
                        key={group.groupId}
                        assignmentCount={countFor(group.groupId)}
                        group={group}
                        isLoading={isLoading}
                        onSelectGroup={onSelectGroup}
                        onShowEvaluation={onShowEvaluation}
                    />
                ))}
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
    onSelectGroup: PropTypes.func.isRequired,
    onShowEvaluation: PropTypes.func.isRequired,
};

export default TeacherClassList;
