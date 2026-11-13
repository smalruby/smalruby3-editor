/**
 * The「レッスン」section of the assignment's description tab (EPIC #1592 /
 * #1598): course, lessons / challenges, required (★), completion condition
 * and whether work is also submitted. Folded to a 1-line summary of the
 * current values (R3); opening it floats the details over the pages column
 * so［課題を保存］stays visible (R6). Scoring lives in「詳しい設定」
 * (lesson-scoring-field.jsx).
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import {
    completionRange,
    completionTarget,
    createLessonDraft,
    droppedChallengeIds,
    missingChallengeIds,
    lessonChanges,
    lessonCounts,
    setChallengeChecked,
    setChallengeRequired,
    setCompletion,
    setLessonChecked,
} from '../../lib/classroom-lesson-settings.js';
import { COURSES, findCourse } from '../../lib/lessons/courses.js';
import styles from './classroom-modal.css';
import LessonNumberInput from './lesson-number-input.jsx';
import PanelCloseButton from './panel-close-button.jsx';

export const lessonMessages = defineMessages({
    title: {
        defaultMessage: 'Lesson',
        description: 'Assignment editor: title of the lesson section',
        id: 'gui.classroom.lessonSettings.title',
    },
    summaryNone: {
        defaultMessage: "Don't use lessons",
        description: 'Assignment editor: lesson summary when no lesson is linked',
        id: 'gui.classroom.lessonSettings.summaryNone',
    },
    summary: {
        defaultMessage: 'Course: {course} · {challenges} · Condition: {condition} · Submit: {submit}',
        description: 'Assignment editor: 1-line summary of the lesson settings (current values)',
        id: 'gui.classroom.lessonSettings.summary',
    },
    challengeCount: {
        defaultMessage: '{count} (★ {required})',
        description: 'Assignment editor: lesson summary — number of chosen challenges and required ones',
        id: 'gui.classroom.lessonSettings.challengeCount',
    },
    conditionAll: {
        defaultMessage: 'All',
        description: 'Assignment editor: completion condition — all chosen challenges',
        id: 'gui.classroom.lessonSettings.conditionAll',
    },
    conditionCount: {
        defaultMessage: '{count}',
        description: 'Assignment editor: lesson summary — completion condition of n challenges',
        id: 'gui.classroom.lessonSettings.conditionCount',
    },
    submitYes: {
        defaultMessage: 'Yes',
        description: 'Assignment editor: lesson summary — work is also submitted',
        id: 'gui.classroom.lessonSettings.submitYes',
    },
    submitNo: {
        defaultMessage: 'No',
        description: 'Assignment editor: lesson summary — work is not submitted',
        id: 'gui.classroom.lessonSettings.submitNo',
    },
    unknownCourse: {
        defaultMessage: 'Unknown course',
        description: 'Assignment editor: name shown for a course that does not exist in this version',
        id: 'gui.classroom.lessonSettings.unknownCourse',
    },
    sentenceAll: {
        defaultMessage: 'All {total}',
        description: 'Completion condition shown to students: all chosen challenges',
        id: 'gui.classroom.lessonSettings.sentenceAll',
    },
    sentenceCount: {
        defaultMessage: '{target} of {total}',
        description: 'Completion condition shown to students: n of the chosen challenges',
        id: 'gui.classroom.lessonSettings.sentenceCount',
    },
    sentenceRequired: {
        defaultMessage: '{sentence} (including {required} ★)',
        description: 'Completion condition shown to students, with the number of required challenges',
        id: 'gui.classroom.lessonSettings.sentenceRequired',
    },
    requiredMarkLabel: {
        defaultMessage: 'Make {challenge} required',
        description: 'Assignment editor: accessible name of the required (★) button of one challenge',
        id: 'gui.classroom.lessonSettings.requiredMarkLabel',
    },
    countLabel: {
        defaultMessage: 'Number of challenges to complete',
        description: 'Assignment editor: accessible name of the n field of the completion condition',
        id: 'gui.classroom.lessonSettings.countLabel',
    },
    requiredMark: {
        defaultMessage: 'Make required',
        description: 'Assignment editor: button that marks a challenge as required (★)',
        id: 'gui.classroom.lessonSettings.requiredMark',
    },
});

/**
 * The completion condition as students read it, e.g.「6 つのうち 4 つ（★ 2 つをふくむ）」.
 * @param {object} intl - react-intl intl object
 * @param {?object} draft - lesson draft
 * @returns {string} sentence ('' without a lesson)
 */
export const formatCompletionSentence = (intl, draft) => {
    if (!draft) return '';
    const { selected, required } = lessonCounts(draft);
    const sentence =
        draft.completion.type === 'count'
            ? intl.formatMessage(lessonMessages.sentenceCount, { target: completionTarget(draft), total: selected })
            : intl.formatMessage(lessonMessages.sentenceAll, { total: selected });
    return required > 0 ? intl.formatMessage(lessonMessages.sentenceRequired, { sentence, required }) : sentence;
};

const NO_COURSE = '';

/**
 * Where the open panel goes. At 1300x600 the editor's columns are only about
 * 200px tall, too short for the challenge list, so the panel reaches up over
 * the assignment name and tabs (to the top of the scrolling body) and stops
 * left of［課題を保存］so the save button stays visible (R6).
 * @param {HTMLElement} root - the lesson section
 * @returns {?{top: number, right: number, maxHeight: number}} offsets from the positioned columns
 */
const panelPlacement = (root) => {
    const base = root && root.offsetParent;
    if (!base) return null;
    const baseRect = base.getBoundingClientRect();
    const editor = root.closest('[data-testid="classroom-description-editor"]');
    const save = editor && editor.querySelector('[data-testid="classroom-assignment-save"]');
    const scroller = root.closest('main') || editor;
    const topLimit = scroller ? scroller.getBoundingClientRect().top + 8 : baseRect.top;
    const right = save ? baseRect.right - save.getBoundingClientRect().left + 12 : 0;
    const top = Math.min(0, Math.round(topLimit - baseRect.top));
    // The panel is as tall as its content (#1770) but never taller than the
    // columns plus the part it reaches up over, so it stays above the bottom.
    return { top, right: Math.max(0, Math.round(right)), maxHeight: Math.round(baseRect.height - top) };
};

const LessonSettingsField = ({ autoOpen, disabled, draft, saved, onAutoOpened, onChange, onClose }) => {
    const intl = useIntl();
    const [open, setOpen] = useState(Boolean(autoOpen));
    // ［＋ 作成 ▾］→「レッスン」(#1780): the panel opens by itself once.
    useEffect(() => {
        if (!autoOpen) return;
        setOpen(true);
        if (onAutoOpened) onAutoOpened();
    }, [autoOpen, onAutoOpened]);
    // Every way of closing (✕・外・Escape・the toggle) ends here, so the
    // editor can ask about the page description (#1780).
    const wasOpenRef = useRef(open);
    useEffect(() => {
        if (wasOpenRef.current && !open && onClose) onClose();
        wasOpenRef.current = open;
    }, [open, onClose]);
    const rootRef = useRef(null);
    const toggleRef = useRef(null);
    const [placement, setPlacement] = useState(null);
    const handleToggle = useCallback(() => setOpen((v) => !v), []);
    // ✕ (#1770): the panel unmounts, so keep the keyboard user on the toggle.
    const handleClose = useCallback(() => {
        setOpen(false);
        if (toggleRef.current) toggleRef.current.focus();
    }, []);
    useLayoutEffect(() => {
        if (!open) return () => {};
        const place = () => setPlacement(panelPlacement(rootRef.current));
        place();
        window.addEventListener('resize', place);
        return () => window.removeEventListener('resize', place);
    }, [open]);
    // Same as「詳しい設定」: a click outside or Escape closes the floating
    // panel; Escape is stopped here so it does not close the modal too.
    useEffect(() => {
        if (!open) return () => {};
        const handleDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const handleKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setOpen(false);
            // The panel unmounts; keep the keyboard user on the toggle.
            if (toggleRef.current) toggleRef.current.focus();
        };
        document.addEventListener('mousedown', handleDown);
        document.addEventListener('keydown', handleKey, true);
        return () => {
            document.removeEventListener('mousedown', handleDown);
            document.removeEventListener('keydown', handleKey, true);
        };
    }, [open]);

    const course = draft ? findCourse(draft.courseId) : null;
    const changed = lessonChanges(draft, saved);
    const counts = lessonCounts(draft);
    const range = completionRange(draft);
    const dropped = droppedChallengeIds(draft, saved);
    const missing = draft && saved && saved.courseId === draft.courseId ? missingChallengeIds(saved, course) : [];

    const handleCourseChange = useCallback(
        (e) => onChange(e.target.value === NO_COURSE ? null : createLessonDraft(e.target.value)),
        [onChange],
    );
    const handleLessonChange = useCallback(
        (e) => onChange(setLessonChecked(draft, course, e.target.value, e.target.checked)),
        [draft, course, onChange],
    );
    const handleChallengeChange = useCallback(
        (e) => onChange(setChallengeChecked(draft, course, e.target.value, e.target.checked)),
        [draft, course, onChange],
    );
    const handleRequiredClick = useCallback(
        (e) => {
            const id = e.currentTarget.value;
            onChange(setChallengeRequired(draft, id, !draft.requiredChallengeIds.includes(id)));
        },
        [draft, onChange],
    );
    const handleCompletionTypeChange = useCallback(
        (e) => onChange(setCompletion(draft, e.target.value)),
        [draft, onChange],
    );
    const handleCountCommit = useCallback(
        (value) => onChange(setCompletion(draft, 'count', value)),
        [draft, onChange],
    );
    const handleSubmitChange = useCallback(
        (e) => onChange({ ...draft, submitWork: e.target.value === 'submit' }),
        [draft, onChange],
    );

    const summaryValue = (key, text) => (
        <span
            className={changed[key] ? styles.assignmentAdvancedChanged : null}
            data-changed={changed[key] ? 'true' : null}
            data-testid={`classroom-lesson-summary-${key}`}
        >
            {text}
        </span>
    );
    const courseName = course ? intl.formatMessage(course.name) : intl.formatMessage(lessonMessages.unknownCourse);
    const summary = draft ? (
        <FormattedMessage
            {...lessonMessages.summary}
            values={{
                course: summaryValue('course', courseName),
                challenges: summaryValue(
                    'challenges',
                    intl.formatMessage(lessonMessages.challengeCount, {
                        count: counts.selected,
                        required: counts.required,
                    }),
                ),
                condition: summaryValue(
                    'completion',
                    draft.completion.type === 'count'
                        ? intl.formatMessage(lessonMessages.conditionCount, { count: completionTarget(draft) })
                        : intl.formatMessage(lessonMessages.conditionAll),
                ),
                submit: summaryValue(
                    'submit',
                    intl.formatMessage(draft.submitWork ? lessonMessages.submitYes : lessonMessages.submitNo),
                ),
            }}
        />
    ) : (
        summaryValue('course', intl.formatMessage(lessonMessages.summaryNone))
    );
    const settingClass = (key) => (changed[key] ? styles.assignmentAdvancedSettingChanged : null);

    return (
        <div className={styles.lessonSettings} data-testid="classroom-lesson-settings" ref={rootRef}>
            <button
                aria-expanded={open}
                className={styles.assignmentAdvancedToggle}
                data-testid="classroom-lesson-toggle"
                ref={toggleRef}
                type="button"
                onClick={handleToggle}
            >
                <span className={styles.assignmentAdvancedTitle}>
                    {open ? '▾ ' : '▸ '}
                    <FormattedMessage {...lessonMessages.title} />
                    {changed.any && (
                        <span className={styles.assignmentAdvancedUnsaved} data-testid="classroom-lesson-unsaved">
                            <FormattedMessage
                                defaultMessage="Not saved yet"
                                description="Assignment editor: mark on the advanced settings when a coloured value is not saved yet"
                                id="gui.classroom.assignmentEditor.advancedUnsaved"
                            />
                        </span>
                    )}
                </span>
                <span className={styles.assignmentAdvancedSummary} data-testid="classroom-lesson-summary">
                    {summary}
                </span>
            </button>
            {draft && !course && (
                <p className={styles.lessonWarning} data-testid="classroom-lesson-unknown-course">
                    <FormattedMessage
                        defaultMessage="This course is not in this version of Smalruby. The setting is kept as it is; choose another course to change it."
                        description="Assignment editor: warning for a lesson whose course does not exist (e.g. a copied shared assignment)"
                        id="gui.classroom.lessonSettings.unknownCourseWarning"
                    />
                </p>
            )}
            {missing.length > 0 && (
                <p className={styles.lessonWarning} data-testid="classroom-lesson-missing-challenges">
                    <FormattedMessage
                        defaultMessage="{count} saved challenges are not in this version of Smalruby. They are not counted and are removed when you save."
                        description="Assignment editor: warning for saved challenge ids that the course no longer has"
                        id="gui.classroom.lessonSettings.missingChallenges"
                        values={{ count: missing.length }}
                    />
                </p>
            )}
            {open && (
                <div className={styles.lessonPanel} data-testid="classroom-lesson-panel" style={placement}>
                    <PanelCloseButton testId="classroom-lesson-close" onClick={handleClose} />
                    <label className={classNames(styles.lessonCourseRow, settingClass('course'))}>
                        <span className={styles.assignmentStartFromPreviousLabel}>
                            <FormattedMessage
                                defaultMessage="Course"
                                description="Assignment editor: label of the lesson course select"
                                id="gui.classroom.lessonSettings.course"
                            />
                        </span>
                        <select
                            className={styles.assignmentPeerViewSelect}
                            data-testid="classroom-lesson-course"
                            disabled={disabled}
                            value={draft ? draft.courseId : NO_COURSE}
                            onChange={handleCourseChange}
                        >
                            <option value={NO_COURSE}>{intl.formatMessage(lessonMessages.summaryNone)}</option>
                            {COURSES.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {intl.formatMessage(c.name)}
                                </option>
                            ))}
                            {draft && !course && (
                                <option value={draft.courseId}>
                                    {intl.formatMessage(lessonMessages.unknownCourse)}
                                </option>
                            )}
                        </select>
                    </label>
                    {course && (
                        <React.Fragment>
                            <p className={styles.lessonHint}>
                                <FormattedMessage
                                    defaultMessage="Check a lesson to add all its challenges, then remove the ones you don't need. Students see only the chosen challenges, in the lesson order."
                                    description="Assignment editor: how to choose lessons and challenges"
                                    id="gui.classroom.lessonSettings.challengesHint"
                                />
                            </p>
                            {/* The challenge list grows with the course, so only
                                this frame scrolls (R6 list exception). */}
                            <div
                                className={classNames(styles.lessonChallengeList, settingClass('challenges'))}
                                data-testid="classroom-lesson-challenges"
                            >
                                {course.lessons.map((lesson, lessonIndex) => {
                                    const ids = lesson.challenges.map((c) => c.id);
                                    const chosen = ids.filter((id) => draft.challengeIds.includes(id)).length;
                                    return (
                                        <div className={styles.lessonGroup} key={lesson.id}>
                                            <label className={styles.lessonGroupRow}>
                                                <input
                                                    checked={chosen === ids.length}
                                                    data-testid={`classroom-lesson-lesson-${lesson.id}`}
                                                    disabled={disabled}
                                                    ref={(el) => {
                                                        if (el) el.indeterminate = chosen > 0 && chosen < ids.length;
                                                    }}
                                                    type="checkbox"
                                                    value={lesson.id}
                                                    onChange={handleLessonChange}
                                                />
                                                <span>
                                                    {`${lessonIndex + 1}. `}
                                                    {intl.formatMessage(lesson.name)}
                                                </span>
                                            </label>
                                            {lesson.challenges.map((challenge) => {
                                                const selected = draft.challengeIds.includes(challenge.id);
                                                const required = draft.requiredChallengeIds.includes(challenge.id);
                                                return (
                                                    <div className={styles.lessonChallengeRow} key={challenge.id}>
                                                        <label className={styles.lessonChallengeLabel}>
                                                            <input
                                                                checked={selected}
                                                                data-testid={`classroom-lesson-challenge-${challenge.id}`}
                                                                disabled={disabled}
                                                                type="checkbox"
                                                                value={challenge.id}
                                                                onChange={handleChallengeChange}
                                                            />
                                                            <span>
                                                                {`${lessonIndex + 1}-${challenge.number} `}
                                                                {intl.formatMessage(challenge.name)}
                                                            </span>
                                                        </label>
                                                        <button
                                                            aria-label={intl.formatMessage(
                                                                lessonMessages.requiredMarkLabel,
                                                                {
                                                                    challenge: `${lessonIndex + 1}-${challenge.number} ${intl.formatMessage(challenge.name)}`,
                                                                },
                                                            )}
                                                            aria-pressed={required}
                                                            className={classNames(styles.lessonRequiredButton, {
                                                                [styles.lessonRequiredButtonOn]: required,
                                                            })}
                                                            data-testid={`classroom-lesson-required-${challenge.id}`}
                                                            disabled={disabled || !selected}
                                                            type="button"
                                                            value={challenge.id}
                                                            onClick={handleRequiredClick}
                                                        >
                                                            {required ? '★ ' : '☆ '}
                                                            {intl.formatMessage(lessonMessages.requiredMark)}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className={classNames(styles.lessonOptionRow, settingClass('completion'))}>
                                <span className={styles.assignmentStartFromPreviousLabel}>
                                    <FormattedMessage
                                        defaultMessage="Completion condition"
                                        description="Assignment editor: label of the lesson completion condition"
                                        id="gui.classroom.lessonSettings.completion"
                                    />
                                </span>
                                <label className={styles.lessonRadio}>
                                    <input
                                        checked={draft.completion.type !== 'count'}
                                        data-testid="classroom-lesson-completion-all"
                                        disabled={disabled}
                                        name="classroom-lesson-completion"
                                        type="radio"
                                        value="all"
                                        onChange={handleCompletionTypeChange}
                                    />
                                    <FormattedMessage {...lessonMessages.conditionAll} />
                                </label>
                                <label className={styles.lessonRadio}>
                                    <input
                                        checked={draft.completion.type === 'count'}
                                        data-testid="classroom-lesson-completion-count"
                                        disabled={disabled || counts.selected === 0}
                                        name="classroom-lesson-completion"
                                        type="radio"
                                        value="count"
                                        onChange={handleCompletionTypeChange}
                                    />
                                    <FormattedMessage
                                        defaultMessage="{count} (including the required ones)"
                                        description="Assignment editor: completion condition of n challenges including the required ones"
                                        id="gui.classroom.lessonSettings.completionCount"
                                        values={{
                                            count: (
                                                <LessonNumberInput
                                                    ariaLabel={intl.formatMessage(lessonMessages.countLabel)}
                                                    className={styles.lessonCountInput}
                                                    disabled={disabled || draft.completion.type !== 'count'}
                                                    max={range.max}
                                                    min={range.min}
                                                    testId="classroom-lesson-completion-count-value"
                                                    value={
                                                        draft.completion.type === 'count'
                                                            ? completionTarget(draft)
                                                            : counts.selected
                                                    }
                                                    onCommit={handleCountCommit}
                                                />
                                            ),
                                        }}
                                    />
                                </label>
                                <span className={styles.lessonSentence} data-testid="classroom-lesson-sentence">
                                    <FormattedMessage
                                        defaultMessage="Students see: {sentence}"
                                        description="Assignment editor: the completion condition as students see it"
                                        id="gui.classroom.lessonSettings.sentencePreview"
                                        values={{ sentence: formatCompletionSentence(intl, draft) }}
                                    />
                                </span>
                            </div>
                            <div className={classNames(styles.lessonOptionRow, settingClass('submit'))}>
                                <span className={styles.assignmentStartFromPreviousLabel}>
                                    <FormattedMessage
                                        defaultMessage="Submitting work"
                                        description="Assignment editor: label of whether students also submit work after the lesson"
                                        id="gui.classroom.lessonSettings.submit"
                                    />
                                </span>
                                <label className={styles.lessonRadio}>
                                    <input
                                        checked={!draft.submitWork}
                                        data-testid="classroom-lesson-submit-no"
                                        disabled={disabled}
                                        name="classroom-lesson-submit"
                                        type="radio"
                                        value="lesson"
                                        onChange={handleSubmitChange}
                                    />
                                    <FormattedMessage
                                        defaultMessage="No submission (lesson only)"
                                        description="Assignment editor: students only do the lesson"
                                        id="gui.classroom.lessonSettings.submitNone"
                                    />
                                </label>
                                <label className={styles.lessonRadio}>
                                    <input
                                        checked={!!draft.submitWork}
                                        data-testid="classroom-lesson-submit-yes"
                                        disabled={disabled}
                                        name="classroom-lesson-submit"
                                        type="radio"
                                        value="submit"
                                        onChange={handleSubmitChange}
                                    />
                                    <FormattedMessage
                                        defaultMessage="Also submit work at the end"
                                        description="Assignment editor: students also submit a project after meeting the condition"
                                        id="gui.classroom.lessonSettings.submitWork"
                                    />
                                </label>
                            </div>
                        </React.Fragment>
                    )}
                    {saved && dropped.length > 0 && (
                        <p className={styles.lessonNotice} data-testid="classroom-lesson-dropped-notice">
                            <FormattedMessage
                                defaultMessage="Progress students already sent stays, but challenges that are no longer chosen are not counted."
                                description="Assignment editor: notice when saved challenges are removed from the lesson setting"
                                id="gui.classroom.lessonSettings.droppedNotice"
                            />
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

LessonSettingsField.propTypes = {
    // Open the panel by itself (then onAutoOpened is called once).
    autoOpen: PropTypes.bool,
    disabled: PropTypes.bool,
    // The editor draft (null = no lesson). Shape: lib/classroom-lesson-settings.js.
    draft: PropTypes.object,
    // The stored `lesson` field, to mark unsaved changes.
    saved: PropTypes.object,
    onAutoOpened: PropTypes.func,
    onChange: PropTypes.func.isRequired,
    // Called after the panel closes, however it was closed.
    onClose: PropTypes.func,
};

export default LessonSettingsField;
