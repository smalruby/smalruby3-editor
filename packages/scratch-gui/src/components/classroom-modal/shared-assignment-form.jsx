/**
 * Share form for みんなの課題 (EPIC #1066, S2): publishes the currently open
 * assignment (pages + starter) to the nationwide shared library. Collects
 * the school attributes (D5), the supplement URL with explicit guidance on
 * what belongs there (D4), the minimal author profile (D6), and the CC BY
 * 4.0 consent (D2).
 */
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import {
    SCHOOL_LEVELS,
    SUBJECTS_BY_LEVEL,
    gradesForLevel,
    parseTags,
} from '../../lib/shared-assignment-taxonomy.js';
import { detectSharedAuthorProfile, persistSharedAuthorProfile } from '../../lib/shared-author-profile.js';

import styles from './classroom-modal.css';

const schoolLevelMessages = {
    elementary: {
        defaultMessage: 'Elementary school',
        description: 'School level choice: elementary',
        id: 'gui.classroom.shared.levelElementary',
    },
    'junior-high': {
        defaultMessage: 'Junior high school',
        description: 'School level choice: junior high',
        id: 'gui.classroom.shared.levelJuniorHigh',
    },
    high: {
        defaultMessage: 'High school',
        description: 'School level choice: high school',
        id: 'gui.classroom.shared.levelHigh',
    },
    other: {
        defaultMessage: 'Other',
        description: 'School level choice: other',
        id: 'gui.classroom.shared.levelOther',
    },
};

const SharedAssignmentForm = ({ selectedClassroom, isLoading, onCancel, onShare }) => {
    const intl = useIntl();
    const savedProfile = detectSharedAuthorProfile();
    const [title, setTitle] = useState(
        selectedClassroom.assignmentName || selectedClassroom.className || '',
    );
    const [summary, setSummary] = useState('');
    const [schoolLevel, setSchoolLevel] = useState('junior-high');
    const [grades, setGrades] = useState([]);
    const [subject, setSubject] = useState('');
    const [tagsText, setTagsText] = useState('');
    const [lessonCount, setLessonCount] = useState('');
    const [supplementUrl, setSupplementUrl] = useState('');
    const [authorName, setAuthorName] = useState(savedProfile.authorName);
    const [authorAffiliation, setAuthorAffiliation] = useState(savedProfile.authorAffiliation);
    const [consent, setConsent] = useState(false);

    const handleTitleChange = useCallback((e) => setTitle(e.target.value), []);
    const handleSummaryChange = useCallback((e) => setSummary(e.target.value), []);
    const handleLevelChange = useCallback((e) => {
        setSchoolLevel(e.target.value);
        // Grades and the subject vocabulary depend on the level.
        setGrades([]);
        setSubject('');
    }, []);
    const handleGradeToggle = useCallback((e) => {
        const grade = parseInt(e.target.value, 10);
        setGrades((prev) => (prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]));
    }, []);
    const handleSubjectChange = useCallback((e) => setSubject(e.target.value), []);
    const handleTagsChange = useCallback((e) => setTagsText(e.target.value), []);
    const handleLessonCountChange = useCallback((e) => setLessonCount(e.target.value), []);
    const handleUrlChange = useCallback((e) => setSupplementUrl(e.target.value), []);
    const handleAuthorNameChange = useCallback((e) => setAuthorName(e.target.value), []);
    const handleAffiliationChange = useCallback((e) => setAuthorAffiliation(e.target.value), []);
    const handleConsentChange = useCallback((e) => setConsent(e.target.checked), []);

    const subjects = SUBJECTS_BY_LEVEL[schoolLevel] || [];
    const urlLooksValid = supplementUrl.trim() === '' || supplementUrl.trim().startsWith('https://');
    const canSubmit =
        title.trim().length > 0 &&
        subject.trim().length > 0 &&
        authorName.trim().length > 0 &&
        urlLooksValid &&
        consent &&
        !isLoading;

    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault();
            if (!canSubmit) return;
            persistSharedAuthorProfile({ authorName: authorName.trim(), authorAffiliation: authorAffiliation.trim() });
            onShare({
                classroomId: selectedClassroom.classroomId,
                title: title.trim(),
                summary: summary.trim() || null,
                schoolLevel,
                grades: [...grades].sort((a, b) => a - b),
                subject: subject.trim(),
                tags: parseTags(tagsText),
                lessonCount: lessonCount ? parseInt(lessonCount, 10) : null,
                supplementUrl: supplementUrl.trim() || null,
                authorName: authorName.trim(),
                authorAffiliation: authorAffiliation.trim() || null,
                licenseConsent: true,
            });
        },
        [
            canSubmit, onShare, selectedClassroom.classroomId, title, summary, schoolLevel,
            grades, subject, tagsText, lessonCount, supplementUrl, authorName, authorAffiliation,
        ],
    );

    return (
        <form className={styles.sharedForm} data-testid="shared-form" onSubmit={handleSubmit}>
            <h3 className={styles.sharedFormTitle}>
                <FormattedMessage
                    defaultMessage="Share this assignment with teachers nationwide"
                    description="Title of the shared assignment form"
                    id="gui.classroom.shared.formTitle"
                />
            </h3>
            <p className={styles.sharedFormHint}>
                <FormattedMessage
                    defaultMessage="The assignment pages and starter project are published as a snapshot. Submissions and student data are never shared."
                    description="Explanation of what sharing publishes"
                    id="gui.classroom.shared.formHint"
                />
            </p>

            <input
                data-testid="shared-form-title"
                disabled={isLoading}
                maxLength={50}
                placeholder={intl.formatMessage({
                    defaultMessage: 'Title (required)',
                    description: 'Placeholder of the shared assignment title',
                    id: 'gui.classroom.shared.titlePlaceholder',
                })}
                type="text"
                value={title}
                onChange={handleTitleChange}
            />
            <input
                data-testid="shared-form-summary"
                disabled={isLoading}
                maxLength={100}
                placeholder={intl.formatMessage({
                    defaultMessage: 'Short description shown on the catalog card (optional)',
                    description: 'Placeholder of the shared assignment summary',
                    id: 'gui.classroom.shared.summaryPlaceholder',
                })}
                type="text"
                value={summary}
                onChange={handleSummaryChange}
            />

            <div className={styles.sharedFormRow}>
                <select
                    data-testid="shared-form-level"
                    disabled={isLoading}
                    value={schoolLevel}
                    onChange={handleLevelChange}
                >
                    {SCHOOL_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                            {intl.formatMessage(schoolLevelMessages[level.value])}
                        </option>
                    ))}
                </select>
                {subjects.length > 0 ? (
                    <select
                        data-testid="shared-form-subject"
                        disabled={isLoading}
                        value={subject}
                        onChange={handleSubjectChange}
                    >
                        <option value="">
                            {intl.formatMessage({
                                defaultMessage: 'Subject (required)',
                                description: 'Placeholder option of the subject selector',
                                id: 'gui.classroom.shared.subjectPlaceholder',
                            })}
                        </option>
                        {subjects.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        data-testid="shared-form-subject-free"
                        disabled={isLoading}
                        maxLength={20}
                        placeholder={intl.formatMessage({
                            defaultMessage: 'Subject (required)',
                            description: 'Placeholder option of the subject selector',
                            id: 'gui.classroom.shared.subjectPlaceholder',
                        })}
                        type="text"
                        value={subject}
                        onChange={handleSubjectChange}
                    />
                )}
                <input
                    data-testid="shared-form-lesson-count"
                    disabled={isLoading}
                    max={20}
                    min={1}
                    placeholder={intl.formatMessage({
                        defaultMessage: 'Lessons',
                        description: 'Placeholder of the expected lesson count',
                        id: 'gui.classroom.shared.lessonCountPlaceholder',
                    })}
                    type="number"
                    value={lessonCount}
                    onChange={handleLessonCountChange}
                />
            </div>

            <div className={styles.sharedFormGrades}>
                <span className={styles.sharedFormLabel}>
                    <FormattedMessage
                        defaultMessage="Grades (optional)"
                        description="Label of the grade checkboxes"
                        id="gui.classroom.shared.gradesLabel"
                    />
                </span>
                {gradesForLevel(schoolLevel).map((grade) => (
                    <label key={grade} className={styles.sharedFormGrade}>
                        <input
                            checked={grades.includes(grade)}
                            data-testid={`shared-form-grade-${grade}`}
                            disabled={isLoading}
                            type="checkbox"
                            value={grade}
                            onChange={handleGradeToggle}
                        />
                        {intl.formatMessage(
                            {
                                defaultMessage: 'Grade {grade}',
                                description: 'Grade checkbox label',
                                id: 'gui.classroom.shared.gradeN',
                            },
                            { grade },
                        )}
                    </label>
                ))}
            </div>

            <input
                data-testid="shared-form-tags"
                disabled={isLoading}
                placeholder={intl.formatMessage({
                    defaultMessage: 'Tags, comma separated — e.g. 甲子園, メッシュ (up to 5)',
                    description: 'Placeholder of the tags input',
                    id: 'gui.classroom.shared.tagsPlaceholder',
                })}
                type="text"
                value={tagsText}
                onChange={handleTagsChange}
            />

            <div className={styles.sharedFormUrlBlock}>
                <input
                    data-testid="shared-form-url"
                    disabled={isLoading}
                    maxLength={500}
                    placeholder={intl.formatMessage({
                        defaultMessage: 'Supplement URL (optional, https only)',
                        description: 'Placeholder of the supplement URL input',
                        id: 'gui.classroom.shared.urlPlaceholder',
                    })}
                    type="url"
                    value={supplementUrl}
                    onChange={handleUrlChange}
                />
                <p className={styles.sharedFormUrlHint} data-testid="shared-form-url-hint">
                    <FormattedMessage
                        defaultMessage="Link to material that shows how to run the lesson — a lesson plan, slides, or a study report. We recommend a Google Drive / Google Docs link set to “anyone with the link can view”."
                        description="Guidance describing what the supplement URL should contain (D4)"
                        id="gui.classroom.shared.urlHint"
                    />
                </p>
                {urlLooksValid ? null : (
                    <p className={styles.sharedFormUrlError} data-testid="shared-form-url-error">
                        <FormattedMessage
                            defaultMessage="The URL must start with https://"
                            description="Error when the supplement URL is not https"
                            id="gui.classroom.shared.urlError"
                        />
                    </p>
                )}
            </div>

            <div className={styles.sharedFormRow}>
                <input
                    data-testid="shared-form-author-name"
                    disabled={isLoading}
                    maxLength={30}
                    placeholder={intl.formatMessage({
                        defaultMessage: 'Display name (required — shown as the author credit)',
                        description: 'Placeholder of the author display name',
                        id: 'gui.classroom.shared.authorNamePlaceholder',
                    })}
                    type="text"
                    value={authorName}
                    onChange={handleAuthorNameChange}
                />
                <input
                    data-testid="shared-form-author-affiliation"
                    disabled={isLoading}
                    maxLength={50}
                    placeholder={intl.formatMessage({
                        defaultMessage: 'Affiliation (optional — e.g. Shimane / public junior high)',
                        description: 'Placeholder of the author affiliation',
                        id: 'gui.classroom.shared.affiliationPlaceholder',
                    })}
                    type="text"
                    value={authorAffiliation}
                    onChange={handleAffiliationChange}
                />
            </div>

            <label className={styles.sharedFormConsent}>
                <input
                    checked={consent}
                    data-testid="shared-form-consent"
                    disabled={isLoading}
                    type="checkbox"
                    onChange={handleConsentChange}
                />
                <FormattedMessage
                    defaultMessage="I publish this assignment under the CC BY 4.0 license and allow other teachers to use and adapt it in their lessons (credited to my display name)."
                    description="CC BY 4.0 consent checkbox (D2)"
                    id="gui.classroom.shared.consent"
                />
            </label>

            <div className={styles.sharedFormActions}>
                <button
                    data-testid="shared-form-cancel"
                    disabled={isLoading}
                    type="button"
                    onClick={onCancel}
                >
                    <FormattedMessage
                        defaultMessage="Cancel"
                        description="Cancel button of the share form"
                        id="gui.classroom.shared.cancel"
                    />
                </button>
                <button
                    className={styles.sharedFormSubmit}
                    data-testid="shared-form-submit"
                    disabled={!canSubmit}
                    type="submit"
                >
                    <FormattedMessage
                        defaultMessage="Share"
                        description="Submit button of the share form"
                        id="gui.classroom.shared.submit"
                    />
                </button>
            </div>
        </form>
    );
};

SharedAssignmentForm.propTypes = {
    isLoading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    onShare: PropTypes.func.isRequired,
    selectedClassroom: PropTypes.object.isRequired,
};

export default SharedAssignmentForm;
