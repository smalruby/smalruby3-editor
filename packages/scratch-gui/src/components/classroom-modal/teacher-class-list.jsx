/**
 * Class list — the teacher's post-login landing view (Google Classroom
 * style): one card per class (学級) with a short summary. Hosts the small
 * "Create a class" dialog (same shape as Google Classroom's: the class fields
 * only — assignments are made inside the class) and the class settings screen
 * (name / year / section / student count / class-level co-teachers /
 * generative AI and Rubytee / archive).
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { formatClassLabel } from '../../lib/classroom-class-label.js';
import { nextLessonFor } from '../../lib/classroom-class-list-summary.js';
import {
    buildAiSettingsUpdate,
    changedAiSettings,
    draftFromGroup,
    isDraftSavable,
    isRubyteeUnconfirmed,
    missingAiConfirmation,
} from '../../lib/classroom-genai-settings.js';
import ClassAiSettings from './class-ai-settings.jsx';
import ClassAiStudentPreview from './class-ai-student-preview.jsx';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';
import ErrorDisplay from './error-display.jsx';
import { breadcrumbMessages } from './teacher-breadcrumbs.jsx';
import ClassCard, { ArchiveClassDialog } from './teacher-class-card.jsx';
import { classTabMessages } from './teacher-class-tabs.jsx';
import TeacherReviewBand from './teacher-review-band.jsx';
import { TeacherScreen, TeacherSubView } from './teacher-view-layout.jsx';

/** Default school year: before April it is still the previous year's term. */
const currentSchoolYear = () => {
    const now = new Date();
    return now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
};

// Shared by the create dialog and the class settings: every field has a
// visible label, and the placeholder only shows an example (R1).
const fieldMessages = defineMessages({
    nameLabel: {
        defaultMessage: 'Class name (required)',
        description: 'Label of the class name field (create dialog and class settings)',
        id: 'gui.classroom.classForm.nameLabel',
    },
    namePlaceholder: {
        defaultMessage: 'e.g. Technology',
        description: 'Example shown in the empty class name field',
        id: 'gui.classroom.classForm.namePlaceholder',
    },
    sectionLabel: {
        defaultMessage: 'Section',
        description: 'Label of the class section field (same word as Google Classroom)',
        id: 'gui.classroom.classForm.sectionLabel',
    },
    sectionPlaceholder: {
        defaultMessage: 'e.g. Class 1, Course A (optional)',
        description: 'Example shown in the empty class section field',
        id: 'gui.classroom.classForm.sectionPlaceholder',
    },
    yearLabel: {
        defaultMessage: 'School year',
        description: 'Label of the class school year field',
        id: 'gui.classroom.classForm.yearLabel',
    },
    countLabel: {
        defaultMessage: 'Number of students (seat numbers)',
        description: 'Label of the class student count field (how many seat numbers the class has)',
        id: 'gui.classroom.classForm.countLabel',
    },
    countPlaceholder: {
        defaultMessage: 'e.g. 40',
        description: 'Example shown in the empty class student count field',
        id: 'gui.classroom.classForm.countPlaceholder',
    },
});

/**
 * The class's basic fields: name, section, school year and student count.
 * @param {object} props - component props
 * @param {string} props.testIdPrefix - data-testid prefix (`<prefix>-name` etc.)
 * @param {object} props.values - {name, section, year, studentCount} as strings
 * @param {Function} props.onNameChange - change handler of the name input
 * @param {Function} props.onSectionChange - change handler of the section input
 * @param {Function} props.onYearChange - change handler of the year input
 * @param {Function} props.onCountChange - change handler of the student count input
 * @param {boolean} props.disabled - whether the inputs are disabled
 * @param {boolean} props.compact - put all four fields in one row (the settings screen, which
 *     must not grow taller); the small create dialog gives the name and section their own rows
 * @param {boolean} props.countRequired - whether the student count is required
 * @param {object} props.nameRef - optional ref to the name input (for focus)
 * @returns {React.ReactElement} the labelled fields
 */
const ClassFields = ({
    compact,
    countRequired,
    disabled,
    nameRef,
    testIdPrefix,
    values,
    onCountChange,
    onNameChange,
    onSectionChange,
    onYearChange,
}) => {
    const intl = useIntl();
    const nameField = (
        <label className={classNames(styles.classField, compact && styles.classFieldWide)}>
            <span className={styles.classFieldLabel}>{intl.formatMessage(fieldMessages.nameLabel)}</span>
            <input
                ref={nameRef}
                data-testid={`${testIdPrefix}-name`}
                disabled={disabled}
                maxLength={50}
                placeholder={intl.formatMessage(fieldMessages.namePlaceholder)}
                required
                type="text"
                value={values.name}
                onChange={onNameChange}
            />
        </label>
    );
    const sectionField = (
        <label className={styles.classField}>
            <span className={styles.classFieldLabel}>{intl.formatMessage(fieldMessages.sectionLabel)}</span>
            <input
                data-testid={`${testIdPrefix}-section`}
                disabled={disabled}
                maxLength={50}
                placeholder={intl.formatMessage(fieldMessages.sectionPlaceholder)}
                type="text"
                value={values.section}
                onChange={onSectionChange}
            />
        </label>
    );
    return (
        <React.Fragment>
            {compact ? null : nameField}
            {compact ? null : sectionField}
            <div className={styles.classSettingsRow}>
                {compact ? nameField : null}
                {compact ? sectionField : null}
                <label className={styles.classField}>
                    <span className={styles.classFieldLabel}>{intl.formatMessage(fieldMessages.yearLabel)}</span>
                    <input
                        data-testid={`${testIdPrefix}-year`}
                        disabled={disabled}
                        max={2100}
                        min={2000}
                        type="number"
                        value={values.year}
                        onChange={onYearChange}
                    />
                </label>
                <label className={styles.classField}>
                    <span className={styles.classFieldLabel}>{intl.formatMessage(fieldMessages.countLabel)}</span>
                    <input
                        data-testid={`${testIdPrefix}-count`}
                        disabled={disabled}
                        max={50}
                        min={1}
                        placeholder={intl.formatMessage(fieldMessages.countPlaceholder)}
                        required={countRequired}
                        type="number"
                        value={values.studentCount}
                        onChange={onCountChange}
                    />
                </label>
            </div>
        </React.Fragment>
    );
};

ClassFields.propTypes = {
    compact: PropTypes.bool,
    countRequired: PropTypes.bool,
    disabled: PropTypes.bool,
    nameRef: PropTypes.object,
    testIdPrefix: PropTypes.string.isRequired,
    values: PropTypes.shape({
        name: PropTypes.string,
        section: PropTypes.string,
        studentCount: PropTypes.string,
        year: PropTypes.string,
    }).isRequired,
    onCountChange: PropTypes.func.isRequired,
    onNameChange: PropTypes.func.isRequired,
    onSectionChange: PropTypes.func.isRequired,
    onYearChange: PropTypes.func.isRequired,
};

// Inline settings editor shown in place of a card (recommended UX: no nested modal).
export const ClassSettingsForm = ({ group, isLoading, onCancel, onUpdateGroup }) => {
    const intl = useIntl();
    const [name, setName] = useState(group.name);
    const [year, setYear] = useState(String(group.year));
    const [section, setSection] = useState(group.section || '');
    const [studentCount, setStudentCount] = useState(
        typeof group.studentCount === 'number' ? String(group.studentCount) : '',
    );
    const [coTeachers, setCoTeachers] = useState(group.coTeacherEmails || []);
    const [newCoTeacher, setNewCoTeacher] = useState('');
    const [aiDraft, setAiDraft] = useState(() => draftFromGroup(group));
    // Archiving asks for confirmation (issue #1051: an accidental one-click
    // archive was the original support inquiry). Unarchiving stays immediate.
    const [confirmingArchive, setConfirmingArchive] = useState(false);
    // Lowering the seat count drops seats from every assignment, so submissions
    // on the removed seats stop showing — warn before that. Raising is silent.
    const [confirmingDecrease, setConfirmingDecrease] = useState(false);
    const originalCount = typeof group.studentCount === 'number' ? group.studentCount : 0;

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
        if (group.status !== 'archived' && !confirmingArchive) {
            setConfirmingArchive(true);
            return;
        }
        onUpdateGroup(group.groupId, {
            status: group.status === 'archived' ? 'active' : 'archived',
        });
        onCancel();
    }, [group, confirmingArchive, onUpdateGroup, onCancel]);
    const handleCancelArchive = useCallback(() => setConfirmingArchive(false), []);

    const canSave = name.trim().length > 0 && parseInt(year, 10) >= 2000 && isDraftSavable(aiDraft);
    // [Save] is off until the required checks are in; say which one, and take the teacher to it (#1427).
    const missingConfirmation = missingAiConfirmation(aiDraft);
    const formRef = useRef(null);
    const handleGoToConfirmation = useCallback(() => {
        const input =
            formRef.current && formRef.current.querySelector(`input[name="${missingConfirmation}Confirmed"]`);
        if (!input) return;
        input.scrollIntoView({ block: 'center' });
        input.focus();
    }, [missingConfirmation]);
    const newCount = parseInt(studentCount, 10);
    const isDecrease = newCount > 0 && originalCount > 0 && newCount < originalCount;

    const doSave = useCallback(() => {
        const updates = {
            name: name.trim(),
            year: parseInt(year, 10),
            section: section.trim() || null,
            coTeacherEmails: coTeachers,
            ...buildAiSettingsUpdate(group, aiDraft),
        };
        const count = parseInt(studentCount, 10);
        if (count > 0) {
            updates.studentCount = count;
        }
        onUpdateGroup(group.groupId, updates);
        onCancel();
    }, [name, year, section, studentCount, coTeachers, aiDraft, onUpdateGroup, group, onCancel]);

    const handleSave = useCallback(
        (e) => {
            e.preventDefault();
            if (!canSave || isLoading) return;
            // Decreasing the seat count needs an explicit confirmation first.
            if (isDecrease && !confirmingDecrease) {
                setConfirmingDecrease(true);
                return;
            }
            doSave();
        },
        [canSave, isLoading, isDecrease, confirmingDecrease, doSave],
    );
    const handleCancelDecrease = useCallback(() => setConfirmingDecrease(false), []);

    return (
        <div className={styles.classSettingsLayout}>
            <form
                className={styles.classSettingsForm}
                ref={formRef}
                data-testid={`classroom-class-settings-${group.groupId}`}
                onSubmit={handleSave}
            >
                <ClassFields
                    compact
                    disabled={isLoading}
                    testIdPrefix="classroom-class-settings"
                    values={{ name, section, year, studentCount }}
                    onCountChange={handleCountChange}
                    onNameChange={handleNameChange}
                    onSectionChange={handleSectionChange}
                    onYearChange={handleYearChange}
                />
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
                <ClassAiSettings
                    changed={changedAiSettings(group, aiDraft)}
                    draft={aiDraft}
                    isLoading={isLoading}
                    rubyteeUnconfirmed={isRubyteeUnconfirmed(group)}
                    onChange={setAiDraft}
                />
                {confirmingArchive ? (
                    <p
                        className={classNames(styles.confirmNote, styles.classSettingsArchiveConfirm)}
                        data-testid="classroom-class-settings-archive-confirm-message"
                    >
                        <FormattedMessage
                            defaultMessage="Archive this class? It will be hidden from the class list, but you can restore it anytime from the archived section."
                            description="Confirmation message before archiving a class"
                            id="gui.classroom.classSettings.archiveConfirmMessage"
                        />
                    </p>
                ) : null}
                {confirmingDecrease ? (
                    <p
                        className={classNames(styles.confirmNote, styles.classSettingsArchiveConfirm)}
                        data-testid="classroom-class-settings-decrease-confirm-message"
                    >
                        <FormattedMessage
                            defaultMessage="Reduce the class to {count} students? Seats {from}–{to} are removed from every assignment in this class, and any work submitted on those seats will no longer be shown."
                            description="Warning before decreasing a class's student count"
                            id="gui.classroom.classSettings.decreaseConfirmMessage"
                            values={{
                                count: newCount,
                                from: newCount + 1,
                                to: originalCount,
                            }}
                        />
                    </p>
                ) : null}
                {/* フッター（レビュー指摘）: 通常は キャンセル左 / アーカイブ・保存 右
                    （アーカイブは保存の左）。アーカイブ押下中は キャンセル・保存を隠し
                    「アーカイブしない / アーカイブする」のみ表示。 */}
                <div className={classNames(styles.formFooter, styles.classSettingsFooter)}>
                    {confirmingArchive ? (
                        <React.Fragment>
                            <ClassroomButton
                                dataTestId="classroom-class-settings-archive-cancel"
                                disabled={isLoading}
                                onClick={handleCancelArchive}
                            >
                                <FormattedMessage
                                    defaultMessage="Keep the class"
                                    description="Button that cancels archiving the class"
                                    id="gui.classroom.classSettings.archiveConfirmNo"
                                />
                            </ClassroomButton>
                            <ClassroomButton
                                dataTestId="classroom-class-settings-archive"
                                disabled={isLoading}
                                variant="primary"
                                onClick={handleToggleArchive}
                            >
                                <FormattedMessage
                                    defaultMessage="Yes, archive"
                                    description="Confirm button that actually archives the class"
                                    id="gui.classroom.classSettings.archiveConfirmYes"
                                />
                            </ClassroomButton>
                        </React.Fragment>
                    ) : (
                        <React.Fragment>
                            <ClassroomButton
                                dataTestId="classroom-class-settings-cancel"
                                disabled={isLoading}
                                onClick={confirmingDecrease ? handleCancelDecrease : onCancel}
                            >
                                {confirmingDecrease ? (
                                    <FormattedMessage
                                        defaultMessage="Keep the count"
                                        description="Button that cancels decreasing the student count"
                                        id="gui.classroom.classSettings.decreaseConfirmNo"
                                    />
                                ) : (
                                    <FormattedMessage
                                        defaultMessage="Cancel"
                                        description="Cancel button of the class settings form"
                                        id="gui.classroom.classSettings.cancel"
                                    />
                                )}
                            </ClassroomButton>
                            <div className={styles.footerRightGroup}>
                                {missingConfirmation ? (
                                    <button
                                        className={styles.classSettingsSaveHint}
                                        data-testid="classroom-class-settings-save-hint"
                                        type="button"
                                        onClick={handleGoToConfirmation}
                                    >
                                        {missingConfirmation === 'genai' ? (
                                            <FormattedMessage
                                                defaultMessage="Check the generative AI's conditions to save"
                                                description="Shown beside the disabled Save button when the generative AI's required check is missing; jumps to it"
                                                id="gui.classroom.classSettings.saveHintGenai"
                                            />
                                        ) : (
                                            <FormattedMessage
                                                defaultMessage="Check Rubytee's conditions to save"
                                                description="Shown beside the disabled Save button when Rubytee's required check is missing; jumps to it"
                                                id="gui.classroom.classSettings.saveHintRubytee"
                                            />
                                        )}
                                    </button>
                                ) : null}
                                <ClassroomButton
                                    dataTestId="classroom-class-settings-archive"
                                    disabled={isLoading}
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
                                </ClassroomButton>
                                <ClassroomButton
                                    dataTestId="classroom-class-settings-save"
                                    disabled={!canSave || isLoading}
                                    type="submit"
                                    variant="primary"
                                >
                                    {confirmingDecrease ? (
                                        <FormattedMessage
                                            defaultMessage="Reduce and save"
                                            description="Confirm button that decreases the student count and saves"
                                            id="gui.classroom.classSettings.decreaseConfirmYes"
                                        />
                                    ) : (
                                        <FormattedMessage
                                            defaultMessage="Save"
                                            description="Save button of the class settings form"
                                            id="gui.classroom.classSettings.save"
                                        />
                                    )}
                                </ClassroomButton>
                            </div>
                        </React.Fragment>
                    )}
                </div>
            </form>
            {/* The students' screen preview uses the room right of the form (#1290). */}
            <ClassAiStudentPreview genai={aiDraft.use} rubytee={aiDraft.rubytee} />
        </div>
    );
};

ClassSettingsForm.propTypes = {
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    onUpdateGroup: PropTypes.func.isRequired,
};

/**
 * "Create a class" — a small dialog over the class list, the same shape as
 * Google Classroom's: the class fields only, with fixed Cancel / Create
 * buttons. Assignments are created inside the class (［＋ 作成 ▾］).
 * @param {object} props - component props
 * @param {string} props.error - error of the last request (shown in the dialog, not behind it)
 * @param {string} props.errorTitle - title of that error
 * @param {boolean} props.isLoading - whether a request is in flight
 * @param {Function} props.onCancel - closes the dialog
 * @param {Function} props.onCreate - called with {name, year, section, studentCount}
 * @returns {React.ReactElement} the dialog
 */
const CreateClassDialog = ({ error, errorTitle, isLoading, onCancel, onCreate }) => {
    const [name, setName] = useState('');
    const [year, setYear] = useState(String(currentSchoolYear()));
    const [section, setSection] = useState('');
    const [studentCount, setStudentCount] = useState('');
    const nameRef = useRef(null);
    useEffect(() => {
        if (nameRef.current) nameRef.current.focus();
    }, []);

    const handleNameChange = useCallback((e) => setName(e.target.value), []);
    const handleYearChange = useCallback((e) => setYear(e.target.value), []);
    const handleSectionChange = useCallback((e) => setSection(e.target.value), []);
    const handleStudentCountChange = useCallback((e) => setStudentCount(e.target.value), []);
    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCancel();
            }
        },
        [onCancel],
    );

    const canSubmit = name.trim().length > 0 && parseInt(studentCount, 10) > 0 && parseInt(year, 10) >= 2000;
    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault();
            if (!canSubmit || isLoading) return;
            onCreate({
                name: name.trim(),
                year: parseInt(year, 10),
                section: section.trim() || null,
                studentCount: parseInt(studentCount, 10),
            });
        },
        [canSubmit, isLoading, onCreate, name, year, section, studentCount],
    );

    return (
        <div className={styles.createClassBackdrop}>
            <form
                aria-labelledby="classroom-class-create-title"
                aria-modal="true"
                className={styles.createClassDialog}
                data-testid="classroom-class-create-dialog"
                role="dialog"
                onKeyDown={handleKeyDown}
                onSubmit={handleSubmit}
            >
                <h3 className={styles.createClassTitle} id="classroom-class-create-title">
                    <FormattedMessage
                        defaultMessage="Create a class"
                        description="Button that opens the class creation dialog"
                        id="gui.classroom.classList.create"
                    />
                </h3>
                <ClassFields
                    countRequired
                    disabled={isLoading}
                    nameRef={nameRef}
                    testIdPrefix="classroom-class-create"
                    values={{ name, section, year, studentCount }}
                    onCountChange={handleStudentCountChange}
                    onNameChange={handleNameChange}
                    onSectionChange={handleSectionChange}
                    onYearChange={handleYearChange}
                />
                <ErrorDisplay error={error} errorTitle={errorTitle} />
                <div className={styles.createClassButtons}>
                    <ClassroomButton dataTestId="classroom-class-create-cancel" onClick={onCancel}>
                        <FormattedMessage
                            defaultMessage="Cancel"
                            description="Cancel button of the class creation form"
                            id="gui.classroom.classList.createCancel"
                        />
                    </ClassroomButton>
                    <ClassroomButton
                        dataTestId="classroom-class-create-submit"
                        disabled={!canSubmit || isLoading}
                        type="submit"
                        variant="primary"
                    >
                        <FormattedMessage
                            defaultMessage="Create"
                            description="Submit button of the class creation dialog"
                            id="gui.classroom.classList.createDialogSubmit"
                        />
                    </ClassroomButton>
                </div>
            </form>
        </div>
    );
};

CreateClassDialog.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    onCreate: PropTypes.func.isRequired,
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
    const [showArchived, setShowArchived] = useState(false);
    const [archivingGroupId, setArchivingGroupId] = useState(null);
    // 次の授業日の「今日」は一覧を開いたときの日付で決める。
    const [now] = useState(() => Date.now());

    // The dialog unmounts when closed, so it opens with the defaults again.
    const handleOpenCreate = useCallback(() => setShowCreateForm(true), []);
    const handleCloseCreate = useCallback(() => setShowCreateForm(false), []);
    const handleShowSettings = useCallback((groupId) => setSettingsGroupId(groupId), []);
    const handleOpenUngrouped = useCallback(
        (e) => onOpenUngrouped(e.currentTarget.dataset.classroomId),
        [onOpenUngrouped],
    );
    const handleCloseSettings = useCallback(() => setSettingsGroupId(null), []);
    // The class name in the header path opens that class.
    const handleOpenSettingsGroup = useCallback(() => {
        const group = groups.find((g) => g.groupId === settingsGroupId);
        if (group) onSelectGroup(group);
    }, [groups, settingsGroupId, onSelectGroup]);
    const handleToggleArchived = useCallback(() => setShowArchived((v) => !v), []);
    const handleRestoreGroup = useCallback(
        (groupId) => onUpdateGroup(groupId, { status: 'active' }),
        [onUpdateGroup],
    );
    const [archiving, setArchiving] = useState(false);
    const titleRef = useRef(null);
    // Where the focus goes when the archive confirmation closes: back to the card's ⋮ when
    // it was cancelled, to the title when the class was archived (its card is gone).
    const focusAfterArchiveRef = useRef(null);
    const handleRequestArchive = useCallback((groupId) => setArchivingGroupId(groupId), []);
    const handleCancelArchive = useCallback(() => {
        focusAfterArchiveRef.current = `classroom-class-menu-${archivingGroupId}`;
        setArchivingGroupId(null);
    }, [archivingGroupId]);
    // Close only when the archive went through; a failure stays in the dialog with its error.
    const handleConfirmArchive = useCallback(async () => {
        if (!archivingGroupId) return;
        setArchiving(true);
        const ok = await onUpdateGroup(archivingGroupId, { status: 'archived' });
        setArchiving(false);
        if (ok === false) return;
        focusAfterArchiveRef.current = 'title';
        setArchivingGroupId(null);
    }, [archivingGroupId, onUpdateGroup]);
    useEffect(() => {
        if (archivingGroupId || !focusAfterArchiveRef.current) return;
        const target = focusAfterArchiveRef.current;
        focusAfterArchiveRef.current = null;
        const el = target === 'title' ? titleRef.current : document.querySelector(`[data-testid="${target}"]`);
        if (el) el.focus();
    }, [archivingGroupId]);
    // Open an assignment of the 「確認が必要な課題」 band on its members (where submissions are returned).
    const handleOpenReviewAssignment = useCallback(
        (classroomId) => onOpenUngrouped(classroomId, { tab: 'members' }),
        [onOpenUngrouped],
    );

    const activeGroups = groups.filter((g) => g.status !== 'archived');
    // Archived classes stay reachable (issue #1051): 「アーカイブ済みのクラス」 next to the
    // title switches the cards to them, each with a restore button, so an accidental
    // archive is self-recoverable instead of a support inquiry.
    const archivedGroups = groups.filter((g) => g.status === 'archived');
    const listingArchived = showArchived && archivedGroups.length > 0;
    // The last archived class was restored: go back to the classes.
    const hasArchived = archivedGroups.length > 0;
    useEffect(() => {
        if (!hasArchived) setShowArchived(false);
    }, [hasArchived]);
    const countFor = (groupId) => classrooms.filter((c) => c.groupId === groupId).length;
    // develop-compat safety net: assignments that do not belong to any class
    // yet (e.g. a co-teacher logs in before the owner's account migrated, or
    // migration failed). They must never be hidden — list them directly.
    const knownGroupIds = new Set(groups.map((g) => g.groupId));
    const ungrouped = classrooms.filter((c) => !c.groupId || !knownGroupIds.has(c.groupId));
    const settingsGroup = groups.find((g) => g.groupId === settingsGroupId);
    const archivingGroup = groups.find((g) => g.groupId === archivingGroupId);

    // The header path starts at 「クラス管理」 (#1956 Q2): here it goes back to the cards.
    const classListCrumb = {
        label: intl.formatMessage(breadcrumbMessages.top),
        onClick: handleCloseSettings,
        testId: 'classroom-breadcrumb-class-list',
    };

    // クラス設定（#1108: インラインカード → 画面遷移）
    if (settingsGroup) {
        return (
            <TeacherScreen
                breadcrumbs={[
                    classListCrumb,
                    {
                        label: formatClassLabel(settingsGroup),
                        onClick: handleOpenSettingsGroup,
                        testId: 'classroom-breadcrumb-assignments',
                    },
                    { label: intl.formatMessage(classTabMessages.settings) },
                ]}
                className={`${styles.classList} ${styles.classSettingsScreen}`}
                error={error}
                errorTitle={errorTitle}
                testId="classroom-phase-teacher-class-list"
            >
                <TeacherSubView title={formatClassLabel(settingsGroup)}>
                    <ClassSettingsForm
                        group={settingsGroup}
                        isLoading={isLoading}
                        onCancel={handleCloseSettings}
                        onUpdateGroup={onUpdateGroup}
                    />
                </TeacherSubView>
            </TeacherScreen>
        );
    }

    const renderCard = (group) => (
        <ClassCard
            key={group.groupId}
            assignmentCount={countFor(group.groupId)}
            group={group}
            groups={groups}
            isLoading={isLoading}
            nextLesson={nextLessonFor(classrooms, group.groupId, now)}
            onRequestArchive={handleRequestArchive}
            onRestoreGroup={handleRestoreGroup}
            onSelectGroup={onSelectGroup}
            onShowEvaluation={onShowEvaluation}
            onShowSettings={handleShowSettings}
        />
    );

    return (
        <TeacherScreen
            breadcrumbs={[{ label: intl.formatMessage(breadcrumbMessages.top) }]}
            className={`${styles.classList} ${styles.classListLanding}`}
            // A failed "Create" must be readable in the dialog, not dimmed behind it.
            error={showCreateForm || archivingGroup ? null : error}
            errorTitle={errorTitle}
            testId="classroom-phase-teacher-class-list"
        >
            {/* 見出しの行: 見出し「クラス」・アーカイブ済み・インポート・主ボタン（L1・R2: 主ボタンは 1 つ）。 */}
            <div className={styles.classListHeading}>
                <h2 className={styles.classListTitle} ref={titleRef} tabIndex={-1}>
                    <FormattedMessage
                        defaultMessage="Classes"
                        description="Title of the class list (post-login landing view)"
                        id="gui.classroom.classList.title"
                    />
                </h2>
                {isLoading ? (
                    <span
                        className={styles.classListLoading}
                        data-testid="classroom-class-list-loading"
                        role="status"
                    >
                        <FormattedMessage
                            defaultMessage="Loading…"
                            description="Shown next to the create button while the class list is busy"
                            id="gui.classroom.classList.loading"
                        />
                    </span>
                ) : null}
                <span className={styles.classListHeadingSpacer} />
                {archivedGroups.length > 0 ? (
                    <ClassroomButton
                        ariaExpanded={listingArchived}
                        dataTestId="classroom-show-archived"
                        variant="text"
                        onClick={handleToggleArchived}
                    >
                        {listingArchived ? (
                            <FormattedMessage
                                defaultMessage="Back to classes"
                                description="Button that leaves the archived classes and shows the active ones again"
                                id="gui.classroom.classList.hideArchived"
                            />
                        ) : (
                            intl.formatMessage(
                                {
                                    defaultMessage: 'Archived classes ({count})',
                                    description: 'Toggle of the archived classes section in the class list',
                                    id: 'gui.classroom.classList.showArchived',
                                },
                                { count: archivedGroups.length },
                            )
                        )}
                    </ClassroomButton>
                ) : null}
                {onShowGoogleCourses ? (
                    <ClassroomButton
                        dataTestId="classroom-class-import-gc"
                        disabled={isLoading}
                        onClick={onShowGoogleCourses}
                    >
                        <FormattedMessage
                            defaultMessage="Import from Google Classroom"
                            description="Button on the class list to import a GC course as a class"
                            id="gui.classroom.classList.importGc"
                        />
                    </ClassroomButton>
                ) : null}
                <ClassroomButton
                    dataTestId="classroom-class-create"
                    disabled={isLoading}
                    variant="primary"
                    onClick={handleOpenCreate}
                >
                    <span aria-hidden="true">{'＋'}</span>
                    <FormattedMessage
                        defaultMessage="Create a class"
                        description="Button that opens the class creation dialog"
                        id="gui.classroom.classList.create"
                    />
                </ClassroomButton>
            </div>
            {listingArchived ? null : (
                <TeacherReviewBand
                    classrooms={classrooms}
                    groups={groups}
                    isLoading={isLoading}
                    onOpenAssignment={handleOpenReviewAssignment}
                />
            )}
            {/* 件数で長さが変わる一覧は、この枠の中だけでスクロールする（R6）。
                「クラスを作成」は枠の外なので常に見える。 */}
            <div className={styles.classListScroll} data-testid="classroom-class-list-scroll">
                {listingArchived ? (
                    <div>
                        <h3 className={styles.archivedHeading}>
                            {intl.formatMessage(
                                {
                                    defaultMessage: 'Archived classes ({count})',
                                    description: 'Toggle of the archived classes section in the class list',
                                    id: 'gui.classroom.classList.showArchived',
                                },
                                { count: archivedGroups.length },
                            )}
                        </h3>
                        <ul className={styles.classCards} data-testid="classroom-archived-class-list">
                            {archivedGroups.map(renderCard)}
                        </ul>
                    </div>
                ) : (
                    <React.Fragment>
                        {activeGroups.length === 0 ? (
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
                                <p className={styles.teacherViewHint}>
                                    <FormattedMessage
                                        defaultMessage="Assignments not in any of your classes (shared with you or not yet migrated):"
                                        description="Heading of the ungrouped assignments fallback list"
                                        id="gui.classroom.classList.ungroupedHint"
                                    />
                                </p>
                                <ul className={styles.ungroupedCards}>
                                    {ungrouped.map((c) => (
                                        <li key={c.classroomId}>
                                            <button
                                                className={styles.ungroupedCard}
                                                data-classroom-id={c.classroomId}
                                                data-testid={`classroom-ungrouped-open-${c.classroomId}`}
                                                disabled={isLoading}
                                                type="button"
                                                onClick={handleOpenUngrouped}
                                            >
                                                <span className={styles.ungroupedCardName}>
                                                    {c.assignmentName || c.className}
                                                </span>
                                                <span className={styles.ungroupedCardMeta}>{c.className}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        {activeGroups.length > 0 ? (
                            <ul className={styles.classCards} data-testid="classroom-class-list">
                                {activeGroups.map(renderCard)}
                            </ul>
                        ) : null}
                    </React.Fragment>
                )}
            </div>
            {showCreateForm ? (
                <CreateClassDialog
                    error={error}
                    errorTitle={errorTitle}
                    isLoading={isLoading}
                    onCancel={handleCloseCreate}
                    onCreate={onCreateClassWithAssignment}
                />
            ) : null}
            {archivingGroup ? (
                <ArchiveClassDialog
                    error={error}
                    errorTitle={errorTitle}
                    group={archivingGroup}
                    isLoading={isLoading || archiving}
                    onCancel={handleCancelArchive}
                    onConfirm={handleConfirmArchive}
                />
            ) : null}
        </TeacherScreen>
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
    onShowEvaluation: PropTypes.func,
    onShowGoogleCourses: PropTypes.func,
    onUpdateGroup: PropTypes.func.isRequired,
};

export default TeacherClassList;
