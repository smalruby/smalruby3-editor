/**
 * The grading tab of a class (teacher side, 「採点」, EPIC #2421 / #2424).
 *
 * It opens on the gradebook (`TeacherGradebook`: assignments × seats). Pressing an
 * assignment opens its own grading (this file, `view: 'assignment'`), after Google
 * Classroom's 「生徒の提出物」: the seats and their grades on the left, the counts
 * (not submitted, AI drafts, confirmed, returned) and two tabs on the right:
 * ［基準］ (the description, the rubric and the grading criteria) and ［生徒］ (the
 * chosen seat's grade, the AI's reason, the comment and［作品を開く］).
 *
 * The footer is a numbered flow: 1 load → 2 rubric → 3 grade everyone → 4 confirm →
 * 5 draft comments → 6 return. A lesson assignment without work keeps its own flow
 * (1 load the progress → 2 check the points → 3 export, #1778). Only the step the
 * teacher is on is the primary button (R2); the others stay usable. The two CSVs of
 * the assignment sit in an 「書き出し ▾」 menu. The AI never decides: every grade is
 * editable, and a grade the AI proposed stays a draft until the teacher confirms.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import { formatClassLabel } from '../../lib/classroom-class-label.js';
import {
    describeEvalResult,
    describeEvalRunning,
    runningStepOf,
} from '../../lib/classroom-evaluation/eval-status.js';
import {
    currentLessonOnlyStep,
    isLessonOnlyAssignment,
    lessonScoreOf,
} from '../../lib/classroom-evaluation/evaluation-utils.js';
import {
    assignmentCounts,
    currentGradingStep,
    gradebookCell,
    isDraftGrade,
} from '../../lib/classroom-evaluation/gradebook.js';
import { buildLessonPayload, lessonDraftFromSaved } from '../../lib/classroom-lesson-settings.js';
import { findCourse } from '../../lib/lessons/courses.js';
import Spinner from '../spinner/spinner.jsx';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';
import LessonScoringField from './lesson-scoring-field.jsx';
import { breadcrumbMessages } from './teacher-breadcrumbs.jsx';
import TeacherEvaluationDetail, { detailMessages } from './teacher-evaluation-detail.jsx';
import TeacherGradebook, {
    GradebookSwitch,
    TeacherOverallPlaceholder,
    gradebookMessages,
} from './teacher-gradebook.jsx';
import TeacherGradingRubric, { TeacherGradingGroupPrompt } from './teacher-grading-rubric.jsx';
import { TeacherScreen } from './teacher-view-layout.jsx';

const evalMessages = defineMessages({
    // Asking before work is lost (#1923 C4). Separate sentences: what is
    // lost (grades / comments / both), the AI still working, then the question.
    lostGrades: {
        defaultMessage: 'Grades that could not be saved will be lost.',
        description: 'Grading screen: leave question — only grades whose save failed would be lost (#1923, #2424)',
        id: 'gui.classroom.evaluation.lostGrades',
    },
    lostComments: {
        defaultMessage: 'Comments you have not returned will be lost.',
        description: 'Grading screen: leave question — only comment drafts not returned would be lost (#1923)',
        id: 'gui.classroom.evaluation.lostComments',
    },
    lostBoth: {
        defaultMessage: 'Grades that could not be saved and comments you have not returned will be lost.',
        description:
            'Grading screen: leave question — grades not saved and comments not returned would be lost (#1923, #2424)',
        id: 'gui.classroom.evaluation.lostBoth',
    },
    leaveBusy: {
        defaultMessage: 'Something is still running. Leaving stops it.',
        description:
            'Grading screen: leave question while loading, the AI or returning is running; leaving stops it (#1923, #1950)',
        id: 'gui.classroom.evaluation.leaveBusy',
    },
    askBack: {
        defaultMessage: 'Go back?',
        description: 'Grading screen: leave question when going back to the class list (#1923)',
        id: 'gui.classroom.evaluation.askBack',
    },
    askLeave: {
        defaultMessage: 'Leave this screen?',
        description: 'Grading screen: leave question when closing, logging out or going elsewhere (#1923)',
        id: 'gui.classroom.evaluation.askLeave',
    },
    askReload: {
        defaultMessage: 'Load again?',
        description: 'Grading screen: question before loading the submissions again over grades not exported (#1923)',
        id: 'gui.classroom.evaluation.askReload',
    },
    leaveStay: {
        defaultMessage: 'Keep grading',
        description: 'Grading screen: button that closes the leave question and stays (#1923)',
        id: 'gui.classroom.evaluation.leaveCancel',
    },
    leaveExport: {
        defaultMessage: 'Export grades (CSV)',
        description: 'Grading screen: button in the leave question that exports the grades CSV first (#1923)',
        id: 'gui.classroom.evaluation.leaveExport',
    },
    leaveYesBack: {
        defaultMessage: 'Go back',
        description: 'Grading screen: button that goes back and drops the work not saved (#1923)',
        id: 'gui.classroom.evaluation.leaveConfirmYes',
    },
    leaveYesLeave: {
        defaultMessage: 'Leave',
        description: 'Grading screen: button that leaves (close, log out, notification) and drops the work (#1923)',
        id: 'gui.classroom.evaluation.leaveConfirmLeave',
    },
    leaveYesReload: {
        defaultMessage: 'Load again',
        description:
            'Grading screen: button that loads the submissions again and drops the grades not exported (#1923)',
        id: 'gui.classroom.evaluation.leaveConfirmReload',
    },
    // A gradebook cell is a button: its name says whose grade of which assignment (#1962).
    cellName: {
        defaultMessage: 'Seat {seat}, {name}: {grade}',
        description:
            'Grading table: accessible name of a cell button, e.g. "Seat 4, Maze: A" ({grade} is "Not graded" ' +
            'when there is no grade, #1962)',
        id: 'gui.classroom.evaluation.cellName',
    },
    cellNameWithState: {
        defaultMessage: 'Seat {seat}, {name}: {grade} ({state})',
        description:
            'Grading table: accessible name of a cell button with its state, e.g. "Seat 4, Maze: A (Needs check, ' +
            'Comment written)" (#1962)',
        id: 'gui.classroom.evaluation.cellNameWithState',
    },
    notGraded: {
        defaultMessage: 'Not graded',
        description: 'Grading table: read out for a cell that has no grade yet (shown as —, #1962)',
        id: 'gui.classroom.evaluation.notGraded',
    },
    commentMark: {
        defaultMessage: 'Comment written',
        description: 'Grading table: tooltip of the mark on a cell that has a comment to the student (#1962)',
        id: 'gui.classroom.evaluation.commentMark',
    },
    lessonHead: {
        defaultMessage: 'Lesson (auto)',
        description:
            'Grading table: header of the lesson score column, next to the work column. "auto" tells that it is ' +
            'scored from the progress, not by the AI (EPIC #1592 / #1778)',
        id: 'gui.classroom.evaluation.lessonHead',
    },
    hint: {
        defaultMessage: 'AI grades are drafts. You make the final call.',
        description: 'One-line explanation of the grading screen',
        id: 'gui.classroom.evaluation.hint',
    },
    hintMore: {
        defaultMessage: 'More',
        description: 'Show the details of the grading screen explanation',
        id: 'gui.classroom.evaluation.hintMore',
    },
    hintLess: {
        defaultMessage: 'Less',
        description: 'Hide the details of the grading screen explanation',
        id: 'gui.classroom.evaluation.hintLess',
    },
    hintDetail: {
        defaultMessage:
            'Grading a few students by hand first calibrates the AI to your standard. Term grades are never shown to students; only the positive comments are returned.',
        description: 'Details of the grading screen explanation (opened with More)',
        id: 'gui.classroom.evaluation.hintDetail',
    },
    lessonScoringOf: {
        defaultMessage: 'Lesson points of {name}',
        description: 'Grading screen: label of the lesson points field of one assignment (#1778)',
        id: 'gui.classroom.evaluation.lessonScoringOf',
    },
});

/* 厳しさの選択肢。閉じた設定の 1 行でも、いまの値として同じ言葉を出す。 */
const STRICTNESS_MESSAGES = defineMessages({
    lenient: {
        defaultMessage: 'Lenient',
        description: 'Strictness option',
        id: 'gui.classroom.evaluation.strictnessLenient',
    },
    standard: {
        defaultMessage: 'Standard',
        description: 'Strictness option',
        id: 'gui.classroom.evaluation.strictnessStandard',
    },
    strict: {
        defaultMessage: 'Strict',
        description: 'Strictness option',
        id: 'gui.classroom.evaluation.strictnessStrict',
    },
});

/* One numbered step of the footer flow. */
/* While its step runs, the button shows a spinner and short words (#2419). The step name stays
   laid under them (hidden), so the button keeps its width and the step row does not jump. */
const StepButton = ({ children, current, dataTestId, disabled, number, running = null, onClick }) => (
    <ClassroomButton
        ariaBusy={running ? true : null}
        ariaCurrent={current ? 'step' : null}
        dataTestId={dataTestId}
        disabled={disabled}
        variant={current ? 'primary' : 'secondary'}
        onClick={onClick}
    >
        <span className={styles.evalStepNumber}>{number}</span>
        {running ? (
            <span className={styles.evalStepLabel}>
                <span aria-hidden="true" className={styles.evalStepLabelHidden}>
                    {children}
                </span>
                <span className={styles.evalStepRunning} data-testid={`${dataTestId}-running`}>
                    <Spinner small className={styles.evalSpinner} level="info-blue" />
                    {running}
                </span>
            </span>
        ) : (
            children
        )}
    </ClassroomButton>
);

StepButton.propTypes = {
    children: PropTypes.node.isRequired,
    current: PropTypes.bool.isRequired,
    dataTestId: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    number: PropTypes.number.isRequired,
    /** The short words while this step runs (null = not running). */
    running: PropTypes.node,
    onClick: PropTypes.func.isRequired,
};

/* What is being done now (spinner, words and a thin bar when the count is known), or the
   short result once it ends (#2419). `role="status"` reads it out. */
const EvalStatus = ({ evalProgress, evalResult, openingWork, savingName }) => {
    const intl = useIntl();
    const running = describeEvalRunning({ progress: evalProgress, openingWork, savingName });
    if (running) {
        const percent = running.ratio === null ? null : Math.round(running.ratio * 100);
        return (
            <div aria-busy="true" className={styles.evalProgress} data-testid="classroom-eval-progress" role="status">
                <div className={styles.evalProgressLine}>
                    <Spinner small className={styles.evalSpinner} level="info-blue" />
                    <span data-testid="classroom-eval-progress-text">
                        {intl.formatMessage(running.message, running.values)}
                    </span>
                </div>
                {percent !== null && (
                    <div
                        aria-hidden="true"
                        className={styles.evalProgressBar}
                        data-percent={percent}
                        data-testid="classroom-eval-progress-bar"
                    >
                        <div className={styles.evalProgressBarValue} style={{ width: `${percent}%` }} />
                    </div>
                )}
            </div>
        );
    }
    const result = describeEvalResult(evalResult);
    if (!result) return null;
    return (
        <div
            className={classNames(styles.evalProgress, styles.evalResult, {
                [styles.evalResultFailed]: result.failed,
            })}
            data-failed={result.failed}
            data-testid="classroom-eval-result"
            role="status"
        >
            {intl.formatMessage(result.message, result.values)}
        </div>
    );
};

EvalStatus.propTypes = {
    evalProgress: PropTypes.object,
    evalResult: PropTypes.object,
    openingWork: PropTypes.bool,
    savingName: PropTypes.string,
};

/* 「書き出し ▾」: the two CSV exports. Opens upward (it lives in the footer). */
const ExportMenu = ({ disabled, onExportAuditCsv, onExportEvaluationCsv }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleOutside = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [open]);
    // A busy run disables the toggle; don't leave the list floating over it.
    useEffect(() => {
        if (disabled) setOpen(false);
    }, [disabled]);

    const handleToggle = useCallback(() => setOpen((prev) => !prev), []);
    const handleEvaluation = useCallback(() => {
        setOpen(false);
        onExportEvaluationCsv();
    }, [onExportEvaluationCsv]);
    const handleAudit = useCallback(() => {
        setOpen(false);
        onExportAuditCsv();
    }, [onExportAuditCsv]);

    return (
        <div className={styles.evalExportMenu} ref={rootRef}>
            <ClassroomButton
                ariaExpanded={open}
                ariaHasPopup="menu"
                dataTestId="classroom-eval-export-menu"
                disabled={disabled}
                onClick={handleToggle}
            >
                <FormattedMessage
                    defaultMessage="Export"
                    description="Menu button that holds the CSV exports of the grading screen"
                    id="gui.classroom.evaluation.export"
                />
                {' ▾'}
            </ClassroomButton>
            {open && (
                <div className={styles.evalExportList} role="menu">
                    <button
                        className={styles.evalExportItem}
                        data-testid="classroom-eval-export"
                        role="menuitem"
                        type="button"
                        onClick={handleEvaluation}
                    >
                        <FormattedMessage
                            defaultMessage="Grades (CSV)"
                            description="Export the grades CSV (record for the teacher)"
                            id="gui.classroom.evaluation.exportCsv"
                        />
                    </button>
                    <button
                        className={styles.evalExportItem}
                        data-testid="classroom-eval-export-audit"
                        role="menuitem"
                        type="button"
                        onClick={handleAudit}
                    >
                        <FormattedMessage
                            defaultMessage="Audit data (CSV)"
                            description="Export the engineer-audit CSV (signals and AI reasons)"
                            id="gui.classroom.evaluation.exportAuditCsv"
                        />
                    </button>
                </div>
            )}
        </div>
    );
};

ExportMenu.propTypes = {
    disabled: PropTypes.bool,
    onExportAuditCsv: PropTypes.func.isRequired,
    onExportEvaluationCsv: PropTypes.func.isRequired,
};

/**
 * The seat × assignment shown in the right column (#1962): the one the teacher
 * pressed if it is still in the table, otherwise the first submitted cell (row by
 * row), so the fields are there as soon as the table is loaded.
 * @param {object} args - what the table shows
 * @param {Array<number>} args.seats - seat numbers in the table
 * @param {Array<string>} args.workIds - classroomIds of the work columns, left to right
 * @param {Function} args.getCell - (seat, classroomId) → cell
 * @param {?{seat: number, classroomId: string}} args.chosen - what the teacher pressed
 * @returns {?{seat: number, classroomId: string}} the cell to show, or null when nothing was submitted
 */
export const pickDetailCell = ({ seats, workIds, getCell, chosen }) => {
    const submitted = (seat, id) => {
        const cell = getCell(seat, id);
        return !!(cell && cell.submitted);
    };
    if (chosen && seats.includes(chosen.seat) && workIds.includes(chosen.classroomId)) {
        if (submitted(chosen.seat, chosen.classroomId)) return chosen;
    }
    for (const seat of seats) {
        for (const id of workIds) {
            if (submitted(seat, id)) return { seat, classroomId: id };
        }
    }
    return null;
};

/**
 * The previous / next seat that submitted the same assignment (‹ › in the right column).
 * @param {Array<number>} seats - seat numbers in the table, top to bottom
 * @param {Function} getCell - (seat, classroomId) → cell
 * @param {string} classroomId - the assignment column
 * @param {number} seat - the seat shown now
 * @returns {{prev: ?number, next: ?number}} the neighbouring seats, null at the ends
 */
export const neighbourSeats = (seats, getCell, classroomId, seat) => {
    const withWork = seats.filter((n) => {
        const cell = getCell(n, classroomId);
        return !!(cell && cell.submitted);
    });
    const i = withWork.indexOf(seat);
    return {
        prev: i > 0 ? withWork[i - 1] : null,
        next: i >= 0 && i < withWork.length - 1 ? withWork[i + 1] : null,
    };
};

/* 「レッスンの点」の欄（#1778）。変えるとすぐ課題の設定に保存する（保存は hook）。 */
const LessonScoringPanel = ({ disabled, lesson, saving, onChangeLessonScoring }) => {
    const intl = useIntl();
    const course = findCourse(lesson.lessonSetting.courseId);
    const draft = course ? lessonDraftFromSaved(lesson.lessonSetting, course) : null;
    const handleChange = useCallback(
        (next) => onChangeLessonScoring(lesson.classroomId, buildLessonPayload(next).scoring),
        [lesson.classroomId, onChangeLessonScoring],
    );
    if (!draft || draft.challengeIds.length === 0) return null;
    return (
        <div className={styles.evalScoringRow} data-testid={`classroom-eval-lesson-scoring-${lesson.classroomId}`}>
            <LessonScoringField
                savesRightAway
                className={styles.evalScoringField}
                title={intl.formatMessage(evalMessages.lessonScoringOf, { name: lesson.assignmentName })}
                disabled={disabled || saving}
                draft={draft}
                onChange={handleChange}
            />
        </div>
    );
};

LessonScoringPanel.propTypes = {
    disabled: PropTypes.bool,
    lesson: PropTypes.object.isRequired,
    saving: PropTypes.bool,
    onChangeLessonScoring: PropTypes.func.isRequired,
};

const assignmentMessages = defineMessages({
    lessonOnlyHint: {
        defaultMessage: 'Lesson assignments are scored automatically from the progress. AI grading is not used.',
        description:
            'Grading screen: one-line explanation when only lesson assignments without work are selected (#1778)',
        id: 'gui.classroom.evaluation.lessonOnlyHint',
    },
    backToBook: {
        defaultMessage: '‹ Gradebook',
        description: 'Assignment grading: button that goes back to the gradebook (#2424)',
        id: 'gui.classroom.evaluation.backToBook',
    },
    countNotSubmitted: {
        defaultMessage: 'Not submitted',
        description: 'Assignment grading: count of seats that did not submit (#2424)',
        id: 'gui.classroom.evaluation.countNotSubmitted',
    },
    countDrafts: {
        defaultMessage: 'AI drafts',
        description: 'Assignment grading: count of grades the AI proposed, not confirmed (#2424)',
        id: 'gui.classroom.evaluation.countDrafts',
    },
    countConfirmed: {
        defaultMessage: 'Confirmed',
        description: 'Assignment grading: count of confirmed grades (#2424)',
        id: 'gui.classroom.evaluation.countConfirmed',
    },
    countReturned: {
        defaultMessage: 'Returned',
        description: 'Assignment grading: count of works whose comment was returned (#2424)',
        id: 'gui.classroom.evaluation.countReturned',
    },
    tabRubric: {
        defaultMessage: 'Rubric',
        description: 'Assignment grading: tab with the description, the rubric and the criteria (#2424)',
        id: 'gui.classroom.evaluation.tabRubric',
    },
    tabStudent: {
        defaultMessage: 'Student',
        description: "Assignment grading: tab with the chosen seat's grade, reason and comment (#2424)",
        id: 'gui.classroom.evaluation.tabStudent',
    },
    description: {
        defaultMessage: 'Assignment description',
        description: 'Assignment grading: label of the description given to the AI (#2424)',
        id: 'gui.classroom.evaluation.description',
    },
    noDescription: {
        defaultMessage: 'No description is written. The AI grades from the name and the works.',
        description: 'Assignment grading: the assignment has no description (#2424)',
        id: 'gui.classroom.evaluation.noDescription',
    },
    rubricTitle: {
        defaultMessage: 'Rubric',
        description: 'Assignment grading: heading of the S/A/B/C rubric (#2424)',
        id: 'gui.classroom.evaluation.rubricTitle',
    },
    noRubric: {
        defaultMessage:
            'This assignment has no rubric yet. Making one from a few works will come here. Until then the AI ' +
            'grades with the grading criteria below.',
        description: 'Assignment grading: the assignment has no rubric (the rubric maker comes in #2425)',
        id: 'gui.classroom.evaluation.noRubric',
    },
    notSubmitted: {
        defaultMessage: 'Not submitted',
        description: 'Assignment grading: the seat list entry of a seat that did not submit (#2424)',
        id: 'gui.classroom.evaluation.notSubmitted',
    },
    seatListName: {
        defaultMessage: 'Seats',
        description: 'Assignment grading: accessible name of the seat list (#2424)',
        id: 'gui.classroom.evaluation.seatListName',
    },
    notLoaded: {
        defaultMessage: 'Load the submissions to see the works and grade them.',
        description: 'Assignment grading: the submissions are not loaded yet (#2424)',
        id: 'gui.classroom.evaluation.notLoaded',
    },
    saving: {
        defaultMessage: 'Saving…',
        description: 'Assignment grading: the grades are being saved (#2424)',
        id: 'gui.classroom.evaluation.saving',
    },
    saveFailedShort: {
        defaultMessage: 'Not saved',
        description: 'Assignment grading: saving the grades failed (#2424)',
        id: 'gui.classroom.evaluation.saveFailedShort',
    },
    confirmedBadge: {
        defaultMessage: 'Confirmed',
        description: 'Assignment grading: the grades of this assignment are confirmed (#2424)',
        id: 'gui.classroom.evaluation.confirmedBadge',
    },
    unconfirmedNote: {
        defaultMessage: 'A grade changed, so the grades are no longer confirmed. Press [Confirm] again.',
        description:
            'Assignment grading: a grade was changed after confirming; the confirmation was taken back (#2424)',
        id: 'gui.classroom.evaluation.unconfirmedNote',
    },
    addedScripts: {
        defaultMessage: 'Scripts added to the starter',
        description: 'Assignment grading: label of the scripts the student added to the starter (#2424)',
        id: 'gui.classroom.evaluation.addedScripts',
    },
    noAddedScripts: {
        defaultMessage: 'Nothing that runs was added to the starter.',
        description: 'Assignment grading: the student added no running script to the starter (#2424)',
        id: 'gui.classroom.evaluation.noAddedScripts',
    },
    groupOf: {
        defaultMessage: 'Group: {name}',
        description: 'Assignment grading: the group of works this seat is in (same added operations, #2424)',
        id: 'gui.classroom.evaluation.groupOf',
    },
    stepRubric: {
        defaultMessage: 'Make Rubric',
        description: 'Step 2 of grading an assignment: look at / make the rubric (#2424)',
        id: 'gui.classroom.evaluation.stepRubric',
    },
    stepGrade: {
        defaultMessage: 'Grade Everyone',
        description: 'Step 3 of grading an assignment: the AI grades every submission (#2424)',
        id: 'gui.classroom.evaluation.stepGrade',
    },
    stepConfirm: {
        defaultMessage: 'Confirm',
        description: 'Step 4 of grading an assignment: the teacher confirms the grades (#2424)',
        id: 'gui.classroom.evaluation.stepConfirm',
    },
    stepReturn: {
        defaultMessage: 'Return',
        description: 'Step 6 of grading an assignment: return the comment drafts to the students (#2424)',
        id: 'gui.classroom.evaluation.stepReturn',
    },
});

const EMPTY_LESSON_SCORES = {};
const EMPTY_GRADINGS = {};
const runAction = (action) => action();
const NOTHING_UNSAVED = { grades: false, comments: false };
const pad = (seat) => String(seat).padStart(2, '0');

/* 左の席の一覧の 1 行: 出席番号と評価（AI の案は点線で薄く）、印（! ↩ 💬）、レッスンの点。 */
const SeatRow = ({
    cell,
    classroomId,
    comment,
    grading,
    isLesson = false,
    lessonName,
    lessonScore = null,
    seatNumber,
    selected,
    onSelect,
}) => {
    const intl = useIntl();
    const handleClick = useCallback(() => onSelect(seatNumber, classroomId), [onSelect, seatNumber, classroomId]);
    // 読み込む前は、保存した評価だけを出す（作品はまだ無い）。
    const saved = cell ? null : gradebookCell(grading, seatNumber);
    const submitted = !!(cell && cell.submitted);
    const grade = cell ? cell.grade : saved && saved.grade;
    const draft = cell
        ? !!(cell.grade && isDraftGrade(grading, { source: cell.gradeEdited ? 'teacher' : 'ai' }))
        : !!(saved && saved.draft);
    const hasComment = (comment || '').trim() !== '';
    const states = [
        cell && cell.needsReview && intl.formatMessage(detailMessages.needsReview),
        cell && cell.returned && intl.formatMessage(detailMessages.returned),
        hasComment && intl.formatMessage(evalMessages.commentMark),
        draft && intl.formatMessage(detailMessages.aiDraft),
    ].filter(Boolean);
    let gradeText = grade || intl.formatMessage(evalMessages.notGraded);
    if (cell && !submitted) gradeText = intl.formatMessage(assignmentMessages.notSubmitted);
    const nameValues = { seat: seatNumber, name: lessonName, grade: gradeText };
    const name = states.length
        ? intl.formatMessage(evalMessages.cellNameWithState, {
              ...nameValues,
              state: states.join(/^ja/.test(intl.locale || '') ? '・' : ', '),
          })
        : intl.formatMessage(evalMessages.cellName, nameValues);
    return (
        <li>
            <button
                aria-label={name}
                aria-pressed={selected}
                className={classNames(styles.evalSeatRow, {
                    [styles.evalSeatRowSelected]: selected,
                    [styles.evalCellNeedsReview]: cell && cell.needsReview,
                })}
                data-testid={`classroom-eval-cell-button-${seatNumber}-${classroomId}`}
                type="button"
                onClick={handleClick}
            >
                <span className={styles.evalSeatRowNumber}>{pad(seatNumber)}</span>
                <span className={styles.evalSeatRowMarks} aria-hidden="true">
                    {cell && cell.needsReview && <span className={styles.evalCellMark}>{'!'}</span>}
                    {cell && cell.returned && <span className={styles.evalCellMark}>{'↩'}</span>}
                    {hasComment && <span className={styles.evalCellMark}>{'💬'}</span>}
                </span>
                {isLesson && (
                    <span className={styles.evalSeatRowLesson}>{lessonScore === null ? '—' : lessonScore}</span>
                )}
                {cell && !submitted ? (
                    <span className={styles.evalSeatRowMissing}>
                        {intl.formatMessage(assignmentMessages.notSubmitted)}
                    </span>
                ) : !isLesson || submitted || grade ? (
                    <span
                        className={classNames(styles.evalGradePill, {
                            [styles.evalGradePillEmpty]: !grade,
                            [styles.evalGradePillDraft]: draft,
                        })}
                        data-draft={draft}
                    >
                        {grade || '—'}
                    </span>
                ) : null}
            </button>
        </li>
    );
};

SeatRow.propTypes = {
    cell: PropTypes.object,
    classroomId: PropTypes.string.isRequired,
    comment: PropTypes.string,
    grading: PropTypes.object,
    /** A lesson assignment: the lesson score is shown too. */
    isLesson: PropTypes.bool,
    lessonName: PropTypes.string,
    /** null = no record */
    lessonScore: PropTypes.number,
    seatNumber: PropTypes.number.isRequired,
    selected: PropTypes.bool,
    onSelect: PropTypes.func.isRequired,
};

/* 右の上の人数（Google Classroom の「生徒の提出物」）。 */
const Counts = ({ counts }) => {
    const intl = useIntl();
    const items = [
        ['notSubmitted', assignmentMessages.countNotSubmitted],
        ['drafts', assignmentMessages.countDrafts],
        ['confirmed', assignmentMessages.countConfirmed],
        ['returned', assignmentMessages.countReturned],
    ];
    return (
        <div className={styles.evalCounts} data-testid="classroom-eval-counts">
            {items.map(([key, message]) => (
                <div className={styles.evalCount} data-testid={`classroom-eval-count-${key}`} key={key}>
                    <b className={styles.evalCountValue}>{counts[key] === null ? '—' : counts[key]}</b>
                    <span className={styles.evalCountLabel}>{intl.formatMessage(message)}</span>
                </div>
            ))}
        </div>
    );
};

Counts.propTypes = {
    counts: PropTypes.object.isRequired,
};

const TeacherEvaluation = ({
    chosenCell: chosenCellProp = null,
    comments,
    currentId = null,
    error,
    errorTitle,
    evalGroup,
    evalLessons,
    evalProgress,
    evalResult = null,
    getCell,
    gradeSaveState = null,
    gradings = EMPTY_GRADINGS,
    innerTab: innerTabProp = null,
    lessonScores = EMPTY_LESSON_SCORES,
    loaded: loadedProp = null,
    rubricAxes,
    rubricDone = false,
    rubricTools = null,
    scoringChecked = false,
    scoringSavingId = null,
    seats,
    strictness,
    tabs,
    leaveRequest = null,
    unconfirmedByEdit = false,
    unsavedWork = NOTHING_UNSAVED,
    view = 'assignment',
    onBack,
    onShowClassList,
    onCancelLeave,
    onChangeLessonScoring,
    onChangeRubricAxis,
    onCheckScoring,
    onConfirmGrades = null,
    onConfirmLeave,
    onExportAuditCsv,
    onExportEvaluationCsv,
    onLoadSubmissions,
    onChooseCell = null,
    onOpenAssignment = null,
    onOpenWork = null,
    openingWork = false,
    onRequestLeave = runAction,
    onReturnComments,
    onRunAi,
    onSetCellGrade,
    onSetCellReason,
    onSetComment,
    onSetInnerTab = null,
    onSetStrictness,
    onShowGradebook = null,
    onShowOverall = null,
    onVisitRubric = null,
}) => {
    const intl = useIntl();
    const busy = !!evalProgress;
    const runningStep = runningStepOf(evalProgress);
    const runningLabel = (stepName) =>
        runningStep && runningStep.step === stepName ? intl.formatMessage(runningStep.label) : null;
    const savingLesson = scoringSavingId ? evalLessons.find((l) => l.classroomId === scoringSavingId) : null;
    const lesson = currentId ? evalLessons.find((l) => l.classroomId === currentId) || null : null;
    const grading = currentId ? gradings[currentId] || null : null;
    const loaded = loadedProp === null ? seats.length > 0 : loadedProp;
    const lessonOnly = !!lesson && isLessonOnlyAssignment(lesson, lessonScores);
    const lessonStep = currentLessonOnlyStep({ loaded, checked: scoringChecked });
    const hasGrades =
        !!lesson &&
        seats.some((seat) => {
            const cell = getCell(seat, lesson.classroomId);
            return !!(cell && cell.submitted && cell.grade);
        });
    const hasComments =
        !!lesson && seats.some((seat) => (comments[`${seat}:${lesson.classroomId}`] || '').trim() !== '');
    const confirmed = !!(grading && grading.confirmedAt);
    const step = currentGradingStep({ loaded, rubricDone, hasGrades, confirmed, hasComments });
    const scoringLessons =
        onChangeLessonScoring && lesson && lesson.hasLesson && lesson.lessonSetting ? [lesson] : [];
    const scoringRef = useRef(null);
    const handleCheckScoring = useCallback(() => {
        if (onCheckScoring) onCheckScoring();
        const node = scoringRef.current;
        if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' });
    }, [onCheckScoring]);
    // 選んだ席は container（use-teacher-evaluation）が持つ（作品を開いて戻っても同じ席・#1990）。
    const [ownChosenCell, setOwnChosenCell] = useState(null);
    const chosenCell = onChooseCell ? chosenCellProp : ownChosenCell;
    const setChosenCell = onChooseCell || setOwnChosenCell;
    const [ownInnerTab, setOwnInnerTab] = useState('rubric');
    const innerTab = onSetInnerTab ? innerTabProp || 'rubric' : ownInnerTab;
    const setInnerTab = onSetInnerTab || setOwnInnerTab;
    const workIds = lesson && !lessonOnly ? [lesson.classroomId] : [];
    // 押した席が一覧にあればその席（出していない席でも）、無ければ最初の提出。
    const detailCell =
        chosenCell && lesson && chosenCell.classroomId === lesson.classroomId && seats.includes(chosenCell.seat)
            ? chosenCell
            : pickDetailCell({ seats, workIds, getCell, chosen: null });
    const detailNeighbours = detailCell
        ? neighbourSeats(seats, getCell, detailCell.classroomId, detailCell.seat)
        : { prev: null, next: null };
    const listRef = useRef(null);
    const handleSelectCell = useCallback(
        (seat, classroomId) => {
            setChosenCell({ seat, classroomId });
            setInnerTab('student');
        },
        [setChosenCell, setInnerTab],
    );
    // ‹ › で選んだ席が一覧の枠の外なら、枠の中だけをスクロールして見せる。
    const handleSelectSeat = useCallback(
        (seat, classroomId) => {
            setChosenCell({ seat, classroomId });
            const frame = listRef.current;
            const button =
                frame && frame.querySelector(`[data-testid="classroom-eval-cell-button-${seat}-${classroomId}"]`);
            if (button && typeof button.scrollIntoView === 'function') button.scrollIntoView({ block: 'nearest' });
        },
        [setChosenCell],
    );
    const handleTabRubric = useCallback(() => setInnerTab('rubric'), [setInnerTab]);
    const handleTabStudent = useCallback(() => setInnerTab('student'), [setInnerTab]);
    const [hintOpen, setHintOpen] = useState(false);
    const handleHintToggle = useCallback(() => setHintOpen((prev) => !prev), []);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const handleSettingsToggle = useCallback(() => setSettingsOpen((prev) => !prev), []);
    const handleStrictnessChange = useCallback((e) => onSetStrictness(e.target.value), [onSetStrictness]);
    const handleAxisChange = useCallback(
        (e) =>
            onChangeRubricAxis(
                parseInt(e.currentTarget.dataset.index, 10),
                e.currentTarget.dataset.field,
                e.target.value,
            ),
        [onChangeRubricAxis],
    );
    // Every way out asks first when comments not returned or grades not saved would be
    // lost (#1923 C4). The container decides (requestLeave).
    const handleLeave = useCallback(() => onRequestLeave(onBack, 'back'), [onRequestLeave, onBack]);
    // 「クラス管理」 in the header path goes to the class cards, asking the same way.
    const handleLeaveToClassList = useCallback(
        () => onRequestLeave(onShowClassList || onBack, 'back'),
        [onRequestLeave, onShowClassList, onBack],
    );
    // Loading again replaces the table: ask the same way once something is loaded.
    const handleLoad = useCallback(
        () => (loaded ? onRequestLeave(onLoadSubmissions, 'reload') : onLoadSubmissions()),
        [loaded, onRequestLeave, onLoadSubmissions],
    );
    const handleRunGrade = useCallback(() => onRunAi('grade'), [onRunAi]);
    const handleRunComment = useCallback(() => onRunAi('comment'), [onRunAi]);
    const handleVisitRubric = useCallback(() => {
        if (onVisitRubric) onVisitRubric();
        else setInnerTab('rubric');
    }, [onVisitRubric, setInnerTab]);
    const handleConfirm = useCallback(() => {
        if (onConfirmGrades) onConfirmGrades();
    }, [onConfirmGrades]);

    /* 離れる確認（#1923 C4）: 手順のボタンの代わりに、確認の文と［採点を続ける］［採点結果を書き出す］
       ［戻る］を出す。離れると消えて取り消せないので、確定のボタンは赤（R4）。 */
    const leaveKind = leaveRequest ? leaveRequest.kind : null;
    // What is lost now (not when asked, #1923 FYI1). Loading again keeps the comment drafts.
    const lostGrades = unsavedWork.grades;
    const lostComments = leaveKind !== 'reload' && unsavedWork.comments;
    let lostMessage = null;
    if (lostGrades && lostComments) lostMessage = evalMessages.lostBoth;
    else if (lostGrades) lostMessage = evalMessages.lostGrades;
    else if (lostComments) lostMessage = evalMessages.lostComments;
    const leaveSentences = [
        busy && leaveKind !== 'reload' ? evalMessages.leaveBusy : null,
        lostMessage,
        { back: evalMessages.askBack, leave: evalMessages.askLeave, reload: evalMessages.askReload }[leaveKind] ||
            evalMessages.askBack,
    ].filter(Boolean);
    // Japanese sentences follow each other without a space.
    const sentenceGap = /^ja/.test(intl.locale || '') ? '' : ' ';
    const leaveFooter = leaveRequest ? (
        <>
            <ClassroomButton autoFocus dataTestId="classroom-eval-leave-cancel" onClick={onCancelLeave}>
                {intl.formatMessage(evalMessages.leaveStay)}
            </ClassroomButton>
            <p
                className={classNames(styles.confirmNote, styles.evalLeaveConfirm)}
                data-kind={leaveKind}
                data-lost={[lostGrades && 'grades', lostComments && 'comments'].filter(Boolean).join(' ')}
                data-testid="classroom-eval-leave-confirm-message"
                role="alert"
            >
                {leaveSentences.map((message) => intl.formatMessage(message)).join(sentenceGap)}
            </p>
            {lesson && (
                <ClassroomButton
                    dataTestId="classroom-eval-leave-export"
                    disabled={busy || !loaded}
                    onClick={onExportEvaluationCsv}
                >
                    {intl.formatMessage(evalMessages.leaveExport)}
                </ClassroomButton>
            )}
            <ClassroomButton dataTestId="classroom-eval-leave-confirm" variant="danger" onClick={onConfirmLeave}>
                {intl.formatMessage(
                    {
                        back: evalMessages.leaveYesBack,
                        leave: evalMessages.leaveYesLeave,
                        reload: evalMessages.leaveYesReload,
                    }[leaveKind] || evalMessages.leaveYesBack,
                )}
            </ClassroomButton>
        </>
    ) : null;

    const arrow = (
        <span aria-hidden="true" className={styles.evalStepArrow}>
            {'→'}
        </span>
    );
    const assignmentFooter = lessonOnly ? (
        <div className={styles.evalSteps} data-testid="classroom-eval-steps">
            <StepButton
                current={lessonStep === 'load'}
                dataTestId="classroom-eval-load"
                running={runningLabel('load')}
                disabled={busy || !lesson}
                number={1}
                onClick={handleLoad}
            >
                <FormattedMessage
                    defaultMessage="Load Progress"
                    description="Step 1 of grading lesson assignments without work: load the progress (#1778)"
                    id="gui.classroom.evaluation.loadProgress"
                />
            </StepButton>
            {arrow}
            <StepButton
                current={lessonStep === 'check'}
                dataTestId="classroom-eval-check-points"
                disabled={busy || !loaded}
                number={2}
                onClick={handleCheckScoring}
            >
                <FormattedMessage
                    defaultMessage="Check Points"
                    description="Step 2 of grading lesson assignments without work: check the lesson points (#1778)"
                    id="gui.classroom.evaluation.checkPoints"
                />
            </StepButton>
            {arrow}
            <StepButton
                current={lessonStep === 'export'}
                dataTestId="classroom-eval-export-lesson"
                disabled={busy || !loaded}
                number={3}
                onClick={onExportEvaluationCsv}
            >
                <FormattedMessage
                    defaultMessage="Export"
                    description="Step 3 of grading lesson assignments without work: export the grades CSV (#1778)"
                    id="gui.classroom.evaluation.exportLesson"
                />
            </StepButton>
        </div>
    ) : (
        <div className={styles.evalSteps} data-testid="classroom-eval-steps">
            <StepButton
                current={step === 'load'}
                dataTestId="classroom-eval-load"
                running={runningLabel('load')}
                disabled={busy || !lesson}
                number={1}
                onClick={handleLoad}
            >
                <FormattedMessage
                    defaultMessage="Load Submissions"
                    description="Step 1 of grading: load & analyze submissions"
                    id="gui.classroom.evaluation.load"
                />
            </StepButton>
            {arrow}
            <StepButton
                current={step === 'rubric'}
                dataTestId="classroom-eval-rubric"
                disabled={busy || !loaded}
                number={2}
                onClick={handleVisitRubric}
            >
                {intl.formatMessage(assignmentMessages.stepRubric)}
            </StepButton>
            {arrow}
            <StepButton
                current={step === 'grade'}
                dataTestId="classroom-eval-run-grade"
                running={runningLabel('grade')}
                disabled={busy || !loaded}
                number={3}
                onClick={handleRunGrade}
            >
                {intl.formatMessage(assignmentMessages.stepGrade)}
            </StepButton>
            {arrow}
            <StepButton
                current={step === 'confirm'}
                dataTestId="classroom-eval-confirm"
                running={runningLabel('confirm')}
                disabled={busy || !loaded || !hasGrades || !onConfirmGrades}
                number={4}
                onClick={handleConfirm}
            >
                {intl.formatMessage(assignmentMessages.stepConfirm)}
            </StepButton>
            {arrow}
            <StepButton
                current={step === 'comment'}
                dataTestId="classroom-eval-run-comment"
                running={runningLabel('comment')}
                disabled={busy || !loaded}
                number={5}
                onClick={handleRunComment}
            >
                <FormattedMessage
                    defaultMessage="Draft Comments"
                    description="Step 3 of grading: run AI comment drafts"
                    id="gui.classroom.evaluation.runComment"
                />
            </StepButton>
            {arrow}
            <StepButton
                current={step === 'return'}
                dataTestId="classroom-eval-return-comments"
                running={runningLabel('return')}
                disabled={busy || !loaded}
                number={6}
                onClick={onReturnComments}
            >
                {intl.formatMessage(assignmentMessages.stepReturn)}
            </StepButton>
        </div>
    );
    const cancelButton = (
        <ClassroomButton className={styles.evalCancel} dataTestId="classroom-evaluation-cancel" onClick={handleLeave}>
            <FormattedMessage
                defaultMessage="Cancel"
                description="Cancel button of the evaluation screen (returns to the class list)"
                id="gui.classroom.evaluation.cancel"
            />
        </ClassroomButton>
    );
    const footer =
        leaveFooter ||
        (view === 'assignment' && lesson ? (
            <>
                {lessonOnly ? null : (
                    <ExportMenu
                        disabled={busy || !loaded}
                        onExportAuditCsv={onExportAuditCsv}
                        onExportEvaluationCsv={onExportEvaluationCsv}
                    />
                )}
                {assignmentFooter}
            </>
        ) : (
            cancelButton
        ));

    /* 説明の 1 行はタブの行の右に置き（#1962）、表の枠を広げる。 */
    const hintText = intl.formatMessage(
        view === 'assignment' && lessonOnly ? assignmentMessages.lessonOnlyHint : evalMessages.hint,
    );
    const hintLine =
        view === 'assignment' && lessonOnly ? (
            <span className={styles.evalHintText} data-testid="classroom-eval-lesson-only-hint" title={hintText}>
                {hintText}
            </span>
        ) : (
            <>
                <span className={styles.evalHintText} data-testid="classroom-eval-hint-text" title={hintText}>
                    {hintText}
                </span>
                <button
                    aria-expanded={hintOpen}
                    className={styles.evalHintToggle}
                    data-testid="classroom-eval-hint-toggle"
                    type="button"
                    onClick={handleHintToggle}
                >
                    {intl.formatMessage(hintOpen ? evalMessages.hintLess : evalMessages.hintMore)}
                </button>
            </>
        );
    const hintDetail =
        !(view === 'assignment' && lessonOnly) && hintOpen ? (
            <span className={styles.evalHintDetail} data-testid="classroom-eval-hint-detail">
                {intl.formatMessage(evalMessages.hintDetail)}
            </span>
        ) : null;
    const tabsWithHint = React.isValidElement(tabs) ? React.cloneElement(tabs, { end: hintLine }) : tabs;

    const status = (
        <EvalStatus
            evalProgress={evalProgress}
            evalResult={evalResult}
            openingWork={openingWork}
            savingName={savingLesson ? savingLesson.assignmentName : null}
        />
    );

    let body;
    if (view !== 'assignment' || !lesson) {
        body = (
            <>
                <div className={styles.gradebookTopRow}>
                    {onShowGradebook && onShowOverall ? (
                        <GradebookSwitch
                            view={view === 'overall' ? 'overall' : 'book'}
                            onShowGradebook={onShowGradebook}
                            onShowOverall={onShowOverall}
                        />
                    ) : null}
                    {view !== 'overall' && (
                        <span className={styles.evalSettingsNote}>
                            {intl.formatMessage(gradebookMessages.openHint)}
                        </span>
                    )}
                </div>
                {status}
                {view === 'overall' ? (
                    <TeacherOverallPlaceholder />
                ) : (
                    <TeacherGradebook
                        gradings={gradings}
                        lessons={evalLessons}
                        onOpenAssignment={onOpenAssignment || runAction}
                    />
                )}
            </>
        );
    } else {
        const counts = assignmentCounts({
            seats,
            getCell: (seat) => getCell(seat, lesson.classroomId),
            grading,
            loaded,
        });
        const rubricLevels = (grading && grading.rubric && grading.rubric.levels) || [];
        const detailInfo = detailCell ? getCell(detailCell.seat, detailCell.classroomId) : null;
        const rubricPane = (
            <div className={styles.evalPaneBody} data-testid="classroom-eval-rubric-pane">
                {rubricTools ? (
                    // The［基準］tab of #2425: description, representatives, fairness, rubric.
                    <TeacherGradingRubric busy={busy} lesson={lesson} tools={rubricTools} onOpenWork={onOpenWork} />
                ) : (
                    <>
                        <div className={styles.evalPaneLabel}>
                            {intl.formatMessage(assignmentMessages.description)}
                        </div>
                        <p className={styles.evalDescription} data-testid="classroom-eval-description">
                            {lesson.assignmentText || intl.formatMessage(assignmentMessages.noDescription)}
                        </p>
                        <div className={styles.evalPaneLabel}>
                            {intl.formatMessage(assignmentMessages.rubricTitle)}
                        </div>
                        {rubricLevels.length > 0 ? (
                            <table className={styles.evalRubricTable} data-testid="classroom-eval-rubric-levels">
                                <tbody>
                                    {rubricLevels.map((level) => (
                                        <tr key={level.grade}>
                                            <th scope="row">
                                                <span className={styles.evalGradePill}>{level.grade}</span>
                                            </th>
                                            <td>{level.text}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className={styles.evalSettingsNote} data-testid="classroom-eval-no-rubric">
                                {intl.formatMessage(assignmentMessages.noRubric)}
                            </p>
                        )}
                    </>
                )}
                {/* 採点の観点・厳しさ（基準が無いときに AI が使う）。あまり変えないので 1 行に畳む（R3）。 */}
                <div className={styles.evalSection} data-testid="classroom-eval-settings-summary">
                    <span className={styles.assignmentNameLabel}>
                        <FormattedMessage
                            defaultMessage="Grading criteria:"
                            description="Label of the rubric axes (what the AI grades on)"
                            id="gui.classroom.evaluation.rubric"
                        />
                    </span>
                    <span className={styles.evalSettingsValue}>
                        {rubricAxes
                            .map((axis) => axis.name)
                            .filter((name) => name)
                            .join('・')}
                    </span>
                    <span className={styles.assignmentNameLabel}>
                        <FormattedMessage
                            defaultMessage="Strictness:"
                            description="Strictness selector label"
                            id="gui.classroom.evaluation.strictness"
                        />
                    </span>
                    <span className={styles.evalSettingsValue}>
                        {STRICTNESS_MESSAGES[strictness]
                            ? intl.formatMessage(STRICTNESS_MESSAGES[strictness])
                            : strictness}
                    </span>
                    <button
                        aria-expanded={settingsOpen}
                        className={styles.evalHintToggle}
                        data-testid="classroom-eval-settings-toggle"
                        disabled={busy}
                        type="button"
                        onClick={handleSettingsToggle}
                    >
                        {settingsOpen ? (
                            <FormattedMessage
                                defaultMessage="Done"
                                description="Close the grading settings (criteria and strictness)"
                                id="gui.classroom.evaluation.settingsDone"
                            />
                        ) : (
                            <FormattedMessage
                                defaultMessage="Change"
                                description="Open the grading settings (criteria and strictness)"
                                id="gui.classroom.evaluation.settingsChange"
                            />
                        )}
                    </button>
                </div>
                {settingsOpen && (
                    <div className={styles.evalSection} data-testid="classroom-eval-settings">
                        {/* R1: 名前と説明の欄が何かを、いつも見える見出しで示す。 */}
                        <div className={classNames(styles.evalRubricRow, styles.evalRubricHeader)}>
                            <span className={styles.evalRubricName}>
                                <FormattedMessage
                                    defaultMessage="Criterion"
                                    description="Column header of the grading criterion name fields"
                                    id="gui.classroom.evaluation.axisNameHeader"
                                />
                            </span>
                            <span className={styles.evalRubricDescription}>
                                <FormattedMessage
                                    defaultMessage="What it looks for"
                                    description="Column header of the grading criterion description fields"
                                    id="gui.classroom.evaluation.axisDescriptionHeader"
                                />
                            </span>
                        </div>
                        {rubricAxes.map((axis, i) => (
                            <div className={styles.evalRubricRow} key={i}>
                                <input
                                    className={styles.evalRubricName}
                                    data-field="name"
                                    data-index={i}
                                    data-testid={`classroom-eval-axis-name-${i}`}
                                    maxLength={50}
                                    type="text"
                                    value={axis.name}
                                    onChange={handleAxisChange}
                                />
                                <input
                                    className={styles.evalRubricDescription}
                                    data-field="description"
                                    data-index={i}
                                    data-testid={`classroom-eval-axis-desc-${i}`}
                                    maxLength={300}
                                    type="text"
                                    value={axis.description}
                                    onChange={handleAxisChange}
                                />
                            </div>
                        ))}
                        <label className={styles.evalStrictnessRow}>
                            <FormattedMessage
                                defaultMessage="Strictness:"
                                description="Strictness selector label"
                                id="gui.classroom.evaluation.strictness"
                            />
                            <select
                                className={styles.groupSelect}
                                data-testid="classroom-eval-strictness"
                                value={strictness}
                                onChange={handleStrictnessChange}
                            >
                                {Object.keys(STRICTNESS_MESSAGES).map((value) => (
                                    <option key={value} value={value}>
                                        {intl.formatMessage(STRICTNESS_MESSAGES[value])}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                )}
            </div>
        );
        const added = detailInfo && detailInfo.submitted ? detailInfo.added : null;
        const studentPane = loaded ? (
            <>
                {rubricTools && (
                    <TeacherGradingGroupPrompt
                        prompt={rubricTools.groupPrompt}
                        onApply={rubricTools.handleApplyGroupChange}
                        onDismiss={rubricTools.handleDismissGroupChange}
                    />
                )}
                <TeacherEvaluationDetail
                    cell={detailInfo && detailInfo.submitted ? detailInfo : null}
                    classroomId={detailCell ? detailCell.classroomId : null}
                    comment={detailCell ? comments[`${detailCell.seat}:${detailCell.classroomId}`] : null}
                    lessonName={lesson.assignmentName}
                    nextSeat={detailNeighbours.next}
                    openingWork={openingWork}
                    prevSeat={detailNeighbours.prev}
                    seatNumber={detailCell ? detailCell.seat : null}
                    onOpenWork={onOpenWork}
                    onSelectSeat={handleSelectSeat}
                    onSetCellGrade={onSetCellGrade}
                    onSetCellReason={onSetCellReason}
                    onSetComment={onSetComment}
                />
                {added && (
                    <div className={styles.evalPaneBody} data-testid="classroom-eval-added">
                        <div className={styles.evalPaneLabel}>
                            {intl.formatMessage(assignmentMessages.addedScripts)}
                            {detailInfo.groupName && (
                                <span className={styles.evalGroupName} data-testid="classroom-eval-group">
                                    {intl.formatMessage(assignmentMessages.groupOf, { name: detailInfo.groupName })}
                                </span>
                            )}
                        </div>
                        {added.length > 0 ? (
                            <pre className={styles.evalAddedCode}>{added.join('\n\n')}</pre>
                        ) : (
                            <p className={styles.evalSettingsNote}>
                                {intl.formatMessage(assignmentMessages.noAddedScripts)}
                            </p>
                        )}
                    </div>
                )}
            </>
        ) : (
            <p className={styles.evalSettingsNote} data-testid="classroom-eval-not-loaded">
                {intl.formatMessage(assignmentMessages.notLoaded)}
            </p>
        );
        body = (
            <>
                <div className={styles.gradebookTopRow}>
                    {onShowGradebook && (
                        <ClassroomButton dataTestId="classroom-eval-back-to-book" onClick={onShowGradebook}>
                            {intl.formatMessage(assignmentMessages.backToBook)}
                        </ClassroomButton>
                    )}
                    <h3 className={styles.evalAssignmentTitle} data-testid="classroom-eval-assignment-title">
                        {lesson.assignmentName}
                    </h3>
                    {confirmed && (
                        <span className={styles.evalReturnedBadge} data-testid="classroom-eval-confirmed">
                            {intl.formatMessage(assignmentMessages.confirmedBadge)}
                        </span>
                    )}
                    {gradeSaveState && (
                        <span
                            className={classNames(styles.evalSettingsNote, {
                                [styles.evalSaveFailed]: gradeSaveState === 'failed',
                            })}
                            data-state={gradeSaveState}
                            data-testid="classroom-eval-save-state"
                        >
                            {intl.formatMessage(
                                gradeSaveState === 'failed'
                                    ? assignmentMessages.saveFailedShort
                                    : assignmentMessages.saving,
                            )}
                        </span>
                    )}
                    {unconfirmedByEdit && !confirmed && (
                        <span className={styles.evalSettingsNote} data-testid="classroom-eval-unconfirmed">
                            {intl.formatMessage(assignmentMessages.unconfirmedNote)}
                        </span>
                    )}
                </div>
                {/* レッスンの点（#1778）。変えるとすぐ保存し、表の点も変わる。 */}
                {scoringLessons.length > 0 && (
                    <div data-testid="classroom-eval-lesson-scoring" ref={scoringRef}>
                        {scoringLessons.map((l) => (
                            <LessonScoringPanel
                                disabled={busy}
                                key={l.classroomId}
                                lesson={l}
                                saving={scoringSavingId === l.classroomId}
                                onChangeLessonScoring={onChangeLessonScoring}
                            />
                        ))}
                    </div>
                )}
                {status}
                <div className={styles.evalWorkspace}>
                    <div className={styles.evalSeatListFrame} ref={listRef}>
                        {lesson.hasLesson && (
                            <div className={styles.evalSeatListHead}>
                                {intl.formatMessage(evalMessages.lessonHead)}
                            </div>
                        )}
                        <ul
                            aria-label={intl.formatMessage(assignmentMessages.seatListName)}
                            className={styles.evalSeatList}
                            data-testid="classroom-eval-seat-list"
                        >
                            {seats.map((seat) => (
                                <SeatRow
                                    cell={loaded ? getCell(seat, lesson.classroomId) || { submitted: false } : null}
                                    classroomId={lesson.classroomId}
                                    comment={comments[`${seat}:${lesson.classroomId}`]}
                                    grading={grading}
                                    key={seat}
                                    isLesson={!!lesson.hasLesson}
                                    lessonName={lesson.assignmentName}
                                    lessonScore={
                                        lesson.hasLesson
                                            ? lessonScoreOf(lessonScores, lesson.classroomId, seat)
                                            : null
                                    }
                                    seatNumber={seat}
                                    selected={!!detailCell && detailCell.seat === seat}
                                    onSelect={handleSelectCell}
                                />
                            ))}
                        </ul>
                    </div>
                    <div className={styles.evalPane}>
                        <Counts counts={counts} />
                        {lessonOnly ? null : (
                            <div className={styles.evalInnerTabs} role="tablist">
                                <button
                                    aria-selected={innerTab === 'rubric'}
                                    className={classNames(styles.evalInnerTab, {
                                        [styles.evalInnerTabOn]: innerTab === 'rubric',
                                    })}
                                    data-testid="classroom-eval-tab-rubric"
                                    role="tab"
                                    type="button"
                                    onClick={handleTabRubric}
                                >
                                    {intl.formatMessage(assignmentMessages.tabRubric)}
                                </button>
                                <button
                                    aria-selected={innerTab === 'student'}
                                    className={classNames(styles.evalInnerTab, {
                                        [styles.evalInnerTabOn]: innerTab === 'student',
                                    })}
                                    data-testid="classroom-eval-tab-student"
                                    role="tab"
                                    type="button"
                                    onClick={handleTabStudent}
                                >
                                    {intl.formatMessage(assignmentMessages.tabStudent)}
                                </button>
                            </div>
                        )}
                        {lessonOnly ? null : (
                            <div className={styles.evalPaneScroll} role="tabpanel">
                                {innerTab === 'student' ? studentPane : rubricPane}
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    }

    const crumbs = [
        {
            label: <FormattedMessage {...breadcrumbMessages.top} />,
            onClick: handleLeaveToClassList,
            testId: 'classroom-breadcrumb-class-list',
        },
        {
            label: evalGroup ? (
                formatClassLabel(evalGroup)
            ) : (
                <FormattedMessage
                    defaultMessage="Grading"
                    description="Breadcrumb label of the evaluation view"
                    id="gui.classroom.breadcrumbs.evaluation"
                />
            ),
        },
    ];
    // In an assignment's grading, the class goes back to the gradebook.
    if (view === 'assignment' && lesson && onShowGradebook) {
        crumbs[1].onClick = onShowGradebook;
        crumbs[1].testId = 'classroom-breadcrumb-gradebook';
    }
    if (view === 'assignment' && lesson) crumbs.push({ label: lesson.assignmentName });

    return (
        <TeacherScreen
            breadcrumbs={crumbs}
            className={`${styles.teacherView} ${styles.evaluationScreen}`}
            error={error}
            errorTitle={errorTitle}
            footer={footer}
            hint={
                tabs ? (
                    hintDetail
                ) : (
                    <>
                        {hintLine}
                        {hintDetail}
                    </>
                )
            }
            tabs={tabsWithHint}
            testId="classroom-phase-teacher-evaluation"
        >
            {body}
        </TeacherScreen>
    );
};

TeacherEvaluation.propTypes = {
    /** The seat × assignment shown in［生徒］, when the container keeps it (#1990). */
    chosenCell: PropTypes.shape({ seat: PropTypes.number, classroomId: PropTypes.string }),
    comments: PropTypes.object.isRequired,
    /** The assignment open in view 'assignment'. */
    currentId: PropTypes.string,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    evalGroup: PropTypes.object,
    /** Every assignment of the class, newest first. */
    evalLessons: PropTypes.arrayOf(PropTypes.object).isRequired,
    evalProgress: PropTypes.object,
    /** The short result of the last step (#2419). */
    evalResult: PropTypes.object,
    getCell: PropTypes.func.isRequired,
    /** 'pending' | 'failed' while the open assignment's grades are not saved. */
    gradeSaveState: PropTypes.oneOf(['pending', 'failed']),
    /** classroomId → saved grading (null = none, undefined = still reading). */
    gradings: PropTypes.object,
    /** The tab of the right column, when the container keeps it: 'rubric' | 'student'. */
    innerTab: PropTypes.oneOf(['rubric', 'student']),
    /** A leave waiting for the teacher's answer (#1923 C4): {kind: 'back'|'leave'|'reload'}. */
    leaveRequest: PropTypes.shape({
        kind: PropTypes.oneOf(['back', 'leave', 'reload']),
    }),
    lessonScores: PropTypes.object,
    /** The submissions of the open assignment are loaded (default: there are seats). */
    loaded: PropTypes.bool,
    /** A work is being opened from the right column (#1980). */
    openingWork: PropTypes.bool,
    rubricAxes: PropTypes.arrayOf(PropTypes.object).isRequired,
    /** The rubric step is done (there is a rubric, or the teacher looked at it). */
    rubricDone: PropTypes.bool,
    /** The［基準］tab's state and handlers (useGradingRubric, #2425). */
    rubricTools: PropTypes.object,
    scoringChecked: PropTypes.bool,
    scoringSavingId: PropTypes.string,
    /** The seats of the open assignment. */
    seats: PropTypes.arrayOf(PropTypes.number).isRequired,
    strictness: PropTypes.string.isRequired,
    /** クラスの中のタブの行（［採点］が選ばれた `TeacherClassTabs`）。 */
    tabs: PropTypes.node,
    /** A grade changed after confirming, so the confirmation was taken back. */
    unconfirmedByEdit: PropTypes.bool,
    /** What leaving would lose now (#1923 C4): {grades, comments}. */
    unsavedWork: PropTypes.shape({
        comments: PropTypes.bool,
        grades: PropTypes.bool,
    }),
    /** 'book' (gradebook) | 'assignment' (one assignment) | 'overall' (#2426). */
    view: PropTypes.oneOf(['book', 'assignment', 'overall']),
    onBack: PropTypes.func.isRequired,
    /** ヘッダーの「クラス管理」。無ければ onBack。 */
    onShowClassList: PropTypes.func,
    onCancelLeave: PropTypes.func,
    onChangeLessonScoring: PropTypes.func,
    onChangeRubricAxis: PropTypes.func.isRequired,
    onCheckScoring: PropTypes.func,
    /** Confirm the grades of the open assignment (step 4). */
    onConfirmGrades: PropTypes.func,
    onConfirmLeave: PropTypes.func,
    onExportAuditCsv: PropTypes.func.isRequired,
    onExportEvaluationCsv: PropTypes.func.isRequired,
    onLoadSubmissions: PropTypes.func.isRequired,
    /** ({seat, classroomId}) → choose the cell; with chosenCell, the container keeps the choice (#1990). */
    onChooseCell: PropTypes.func,
    /** (classroomId, seat?) → open an assignment's grading from the gradebook. */
    onOpenAssignment: PropTypes.func,
    /**
     * (seat, classroomId) → opens the work in the editor (#1980). It does not ask: the grading
     * screen stays as it was behind the editor (#1990).
     */
    onOpenWork: PropTypes.func,
    /** (action, kind) → runs action, or asks first when work would be lost (#1923 C4). */
    onRequestLeave: PropTypes.func,
    onReturnComments: PropTypes.func.isRequired,
    onRunAi: PropTypes.func.isRequired,
    onSetCellGrade: PropTypes.func.isRequired,
    onSetCellReason: PropTypes.func.isRequired,
    onSetComment: PropTypes.func.isRequired,
    /** ('rubric'|'student') → choose the right column's tab, when the container keeps it. */
    onSetInnerTab: PropTypes.func,
    onSetStrictness: PropTypes.func.isRequired,
    onShowGradebook: PropTypes.func,
    onShowOverall: PropTypes.func,
    /** Step 2: look at the rubric (#2425 makes it). */
    onVisitRubric: PropTypes.func,
};

export default TeacherEvaluation;
