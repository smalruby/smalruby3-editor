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
import {
    buildAiSettingsUpdate,
    changedAiSettings,
    draftFromGroup,
    isDraftSavable,
} from '../../lib/classroom-genai-settings.js';
import ClassAiSettings from './class-ai-settings.jsx';
import ClassAiStudentPreview from './class-ai-student-preview.jsx';
import ClassroomButton from './classroom-button.jsx';
import { TeacherScreen, TeacherSubView } from './teacher-view-layout.jsx';

import styles from './classroom-modal.css';

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
                    onChange={setAiDraft}
                />
                {confirmingArchive ? (
                    <p
                        className={styles.classSettingsArchiveConfirm}
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
                        className={styles.classSettingsArchiveConfirm}
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
                <div className={styles.formFooter}>
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
                                variant="danger"
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

// Brand names stay as they are in every language; only "other" is translated.
const GENAI_SERVICE_NAMES = { chatgpt: 'ChatGPT', gemini: 'Gemini' };

/**
 * Short name of the generative AI a class uses, for the card summary.
 * @param {object} intl - react-intl object
 * @param {?object} genai - the class's stored genai settings
 * @returns {?string} the name, or null when the class does not use one
 */
const genaiServiceName = (intl, genai) => {
    if (!genai || genai.enabled !== true || !genai.service) return null;
    return (
        GENAI_SERVICE_NAMES[genai.service] ||
        intl.formatMessage({
            defaultMessage: 'Other',
            description: 'Generative AI name on a class card when the school chose its own service',
            id: 'gui.classroom.classList.genaiOther',
        })
    );
};

const ClassCard = ({
    group,
    assignmentCount,
    isLoading,
    onRestoreGroup,
    onSelectGroup,
    onShowEvaluation,
    onShowSettings,
}) => {
    const intl = useIntl();
    const handleOpen = useCallback(() => onSelectGroup(group), [onSelectGroup, group]);
    const handleEvaluate = useCallback(() => onShowEvaluation(group), [onShowEvaluation, group]);
    const handleSettings = useCallback(() => onShowSettings(group.groupId), [onShowSettings, group.groupId]);
    const handleRestore = useCallback(() => onRestoreGroup(group.groupId), [onRestoreGroup, group.groupId]);
    const isArchived = group.status === 'archived';
    const genaiName = genaiServiceName(intl, group.genai);

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
                {/* 小さな要約（L2）: 課題の数・生徒の人数・使う生成 AI。 */}
                <span className={styles.classCardMeta} data-testid={`classroom-class-summary-${group.groupId}`}>
                    <span>
                        {intl.formatMessage(
                            {
                                defaultMessage: '{count} assignments',
                                description: 'Assignment count on a class card',
                                id: 'gui.classroom.classList.assignmentCount',
                            },
                            { count: assignmentCount },
                        )}
                    </span>
                    {typeof group.studentCount === 'number' ? (
                        <span>
                            {intl.formatMessage(
                                {
                                    defaultMessage: '{count} students',
                                    description: 'Student count (seat numbers) on a class card',
                                    id: 'gui.classroom.classList.studentCount',
                                },
                                { count: group.studentCount },
                            )}
                        </span>
                    ) : null}
                    {genaiName ? (
                        <span>
                            {intl.formatMessage(
                                {
                                    defaultMessage: 'Generative AI: {service}',
                                    description: 'Generative AI used in the class, on a class card',
                                    id: 'gui.classroom.classList.genaiSummary',
                                },
                                { service: genaiName },
                            )}
                        </span>
                    ) : null}
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
            {isArchived ? (
                <button
                    className={styles.classCardEvaluate}
                    data-testid={`classroom-class-restore-${group.groupId}`}
                    disabled={isLoading}
                    type="button"
                    onClick={handleRestore}
                >
                    <FormattedMessage
                        defaultMessage="Restore"
                        description="Button on an archived class card to restore it"
                        id="gui.classroom.classList.restore"
                    />
                </button>
            ) : (
                <button
                    className={styles.classCardEvaluate}
                    data-testid={`classroom-class-evaluate-${group.groupId}`}
                    disabled={isLoading}
                    type="button"
                    onClick={handleEvaluate}
                >
                    <FormattedMessage
                        defaultMessage="Grade"
                        description="Button on a class card to open term-end evaluation"
                        id="gui.classroom.classList.evaluate"
                    />
                </button>
            )}
            {/* アーカイブ済みは「元に戻す」だけ。設定ボタンは出さない（レビュー指摘）。 */}
            {isArchived ? null : (
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
            )}
        </li>
    );
};

ClassCard.propTypes = {
    assignmentCount: PropTypes.number.isRequired,
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onRestoreGroup: PropTypes.func,
    onSelectGroup: PropTypes.func.isRequired,
    onShowEvaluation: PropTypes.func.isRequired,
    onShowSettings: PropTypes.func.isRequired,
};

/**
 * "Create a class" — a small dialog over the class list, the same shape as
 * Google Classroom's: the class fields only, with fixed Cancel / Create
 * buttons. Assignments are created inside the class (［＋ 作成 ▾］).
 * @param {object} props - component props
 * @param {boolean} props.isLoading - whether a request is in flight
 * @param {Function} props.onCancel - closes the dialog
 * @param {Function} props.onCreate - called with {name, year, section, studentCount}
 * @returns {React.ReactElement} the dialog
 */
const CreateClassDialog = ({ isLoading, onCancel, onCreate }) => {
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

    // The dialog unmounts when closed, so it opens with the defaults again.
    const handleOpenCreate = useCallback(() => setShowCreateForm(true), []);
    const handleCloseCreate = useCallback(() => setShowCreateForm(false), []);
    const handleShowSettings = useCallback((groupId) => setSettingsGroupId(groupId), []);
    const handleOpenUngrouped = useCallback(
        (e) => onOpenUngrouped(e.currentTarget.dataset.classroomId),
        [onOpenUngrouped],
    );
    const handleCloseSettings = useCallback(() => setSettingsGroupId(null), []);
    const handleToggleArchived = useCallback(() => setShowArchived((v) => !v), []);
    const handleRestoreGroup = useCallback(
        (groupId) => onUpdateGroup(groupId, { status: 'active' }),
        [onUpdateGroup],
    );

    const activeGroups = groups.filter((g) => g.status !== 'archived');
    // Archived classes stay reachable (issue #1051): a collapsed section at
    // the bottom lists them with a restore button, so an accidental archive
    // is self-recoverable instead of a support inquiry.
    const archivedGroups = groups.filter((g) => g.status === 'archived');
    const countFor = (groupId) => classrooms.filter((c) => c.groupId === groupId).length;
    // develop-compat safety net: assignments that do not belong to any class
    // yet (e.g. a co-teacher logs in before the owner's account migrated, or
    // migration failed). They must never be hidden — list them directly.
    const knownGroupIds = new Set(groups.map((g) => g.groupId));
    const ungrouped = classrooms.filter((c) => !c.groupId || !knownGroupIds.has(c.groupId));
    const settingsGroup = groups.find((g) => g.groupId === settingsGroupId);

    const classListCrumb = {
        label: intl.formatMessage({
            defaultMessage: 'Class list',
            description: 'Breadcrumb link back to the class list',
            id: 'gui.classroom.breadcrumbs.classList',
        }),
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
                        label: intl.formatMessage({
                            defaultMessage: 'Settings',
                            description: 'Button on a class card to open its settings',
                            id: 'gui.classroom.classList.settings',
                        }),
                    },
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

    return (
        <TeacherScreen
            breadcrumbs={[
                {
                    label: intl.formatMessage({
                        defaultMessage: 'Class list',
                        description: 'Breadcrumb label of the class list (current view)',
                        id: 'gui.classroom.breadcrumbs.classList',
                    }),
                },
            ]}
            className={`${styles.classList} ${styles.classListLanding}`}
            error={error}
            errorTitle={errorTitle}
            hint={
                <FormattedMessage
                    defaultMessage="A class is one homeroom (e.g. Year 2 Class 1). Open a class to manage its assignments."
                    description="Hint below the class list title"
                    id="gui.classroom.classList.hint"
                />
            }
            testId="classroom-phase-teacher-class-list"
            title={
                <FormattedMessage
                    defaultMessage="Your classes"
                    description="Title of the class list (post-login landing view)"
                    id="gui.classroom.classList.title"
                />
            }
        >
            {/* 主ボタン（L1）: 通常の青。読み込み中は押せない理由を横に出す。 */}
            <div className={styles.classListActions}>
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
                {isLoading ? (
                    <span className={styles.classListLoading} data-testid="classroom-class-list-loading" role="status">
                        <FormattedMessage
                            defaultMessage="Loading…"
                            description="Shown next to the create button while the class list is busy"
                            id="gui.classroom.classList.loading"
                        />
                    </span>
                ) : null}
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
            </div>
            {/* 件数で長さが変わる一覧は、この枠の中だけでスクロールする（R6）。
                「クラスを作成」は枠の外なので常に見える。 */}
            <div className={styles.classListScroll} data-testid="classroom-class-list-scroll">
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
                    {activeGroups.map((group) => (
                        <ClassCard
                            key={group.groupId}
                            assignmentCount={countFor(group.groupId)}
                            group={group}
                            isLoading={isLoading}
                            onSelectGroup={onSelectGroup}
                            onShowEvaluation={onShowEvaluation}
                            onShowSettings={handleShowSettings}
                        />
                    ))}
                </ul>
                {archivedGroups.length > 0 ? (
                    <div className={styles.archivedSection}>
                        <button
                            className={styles.archivedToggle}
                            data-testid="classroom-show-archived"
                            type="button"
                            onClick={handleToggleArchived}
                        >
                            {showArchived ? '▼ ' : '▶ '}
                            {intl.formatMessage(
                                {
                                    defaultMessage: 'Archived classes ({count})',
                                    description: 'Toggle of the archived classes section in the class list',
                                    id: 'gui.classroom.classList.showArchived',
                                },
                                { count: archivedGroups.length },
                            )}
                        </button>
                        {showArchived ? (
                            <ul className={styles.classCards} data-testid="classroom-archived-class-list">
                                {archivedGroups.map((group) => (
                                    <ClassCard
                                        key={group.groupId}
                                        assignmentCount={countFor(group.groupId)}
                                        group={group}
                                        isLoading={isLoading}
                                        onRestoreGroup={handleRestoreGroup}
                                        onSelectGroup={onSelectGroup}
                                        onShowEvaluation={onShowEvaluation}
                                        onShowSettings={handleShowSettings}
                                    />
                                ))}
                            </ul>
                        ) : null}
                    </div>
                ) : null}
            </div>
            {showCreateForm ? (
                <CreateClassDialog
                    isLoading={isLoading}
                    onCancel={handleCloseCreate}
                    onCreate={onCreateClassWithAssignment}
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
    onShowEvaluation: PropTypes.func.isRequired,
    onShowGoogleCourses: PropTypes.func,
    onUpdateGroup: PropTypes.func.isRequired,
};

export default TeacherClassList;
