/**
 * Term-end grading screen (teacher side, 「採点」).
 *
 * seat × lesson matrix with AI-proposed grades. The AI never decides:
 * every proposal is editable, needsReview cells are highlighted, and the
 * exported CSVs (record + engineer audit) are the teacher's artifacts.
 *
 * The footer is a numbered flow (1 load → 2 AI grading → 3 comment drafts →
 * 4 return, #1304 V1). Only the step the teacher is on is the primary button;
 * the others stay usable (re-run, skip) but look secondary. The two CSVs are
 * rare, so they sit in an 「書き出し ▾」 menu instead of the button row (R2).
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import { formatClassLabel } from '../../lib/classroom-class-label.js';
import {
    GRADE_ORDER,
    combineOverall,
    evaluationColumns,
    lessonScoreOf,
} from '../../lib/classroom-evaluation/evaluation-utils.js';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';
import { TeacherScreen } from './teacher-view-layout.jsx';

const GRADES = [...GRADE_ORDER].reverse(); // S, A, B, C

const evalMessages = defineMessages({
    lessonHead: {
        defaultMessage: 'Lesson',
        description: 'Grading table: header of the lesson score column, next to the work column (EPIC #1592)',
        id: 'gui.classroom.evaluation.lessonHead',
    },
    lessonHeadTitle: {
        defaultMessage: '{name}: lesson score from the progress (out of {total})',
        description: 'Grading table: tooltip of the lesson score column header (EPIC #1592)',
        id: 'gui.classroom.evaluation.lessonHeadTitle',
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

/**
 * Which step of the grading flow the teacher is on (#1304 V1).
 * Comment drafts move on to "return" even without grades: drafting
 * comments without grading is a valid shortcut.
 * @param {object} state - what has been done so far
 * @param {boolean} state.loaded - submissions are loaded
 * @param {boolean} state.hasGrades - at least one submitted cell has a grade
 * @param {boolean} state.hasComments - at least one non-blank comment draft
 * @returns {'load'|'grade'|'comment'|'return'} the current step
 */
export const currentEvalStep = ({ loaded, hasGrades, hasComments }) => {
    if (!loaded) return 'load';
    if (hasComments) return 'return';
    if (hasGrades) return 'comment';
    return 'grade';
};

/* One numbered step of the footer flow. */
const StepButton = ({ children, current, dataTestId, disabled, number, onClick }) => (
    <ClassroomButton
        ariaCurrent={current ? 'step' : null}
        dataTestId={dataTestId}
        disabled={disabled}
        variant={current ? 'primary' : 'secondary'}
        onClick={onClick}
    >
        <span className={styles.evalStepNumber}>{number}</span>
        {children}
    </ClassroomButton>
);

StepButton.propTypes = {
    children: PropTypes.node.isRequired,
    current: PropTypes.bool.isRequired,
    dataTestId: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
    number: PropTypes.number.isRequired,
    onClick: PropTypes.func.isRequired,
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

const GradeCell = ({ cell, classroomId, comment, seatNumber, onSetCellGrade, onSetCellReason, onSetComment }) => {
    const handleGradeChange = useCallback(
        (e) => onSetCellGrade(seatNumber, classroomId, e.target.value),
        [onSetCellGrade, seatNumber, classroomId],
    );
    const handleReasonChange = useCallback(
        (e) => onSetCellReason(seatNumber, classroomId, e.target.value),
        [onSetCellReason, seatNumber, classroomId],
    );
    const handleCommentChange = useCallback(
        (e) => onSetComment(seatNumber, classroomId, e.target.value),
        [onSetComment, seatNumber, classroomId],
    );

    if (!cell || !cell.submitted) {
        return (
            <td className={styles.evalCellEmpty} data-testid={`classroom-eval-cell-${seatNumber}-${classroomId}`}>
                {'×'}
            </td>
        );
    }
    return (
        <td
            className={classNames(styles.evalCell, { [styles.evalCellNeedsReview]: cell.needsReview })}
            data-testid={`classroom-eval-cell-${seatNumber}-${classroomId}`}
        >
            <div className={styles.evalCellRow}>
                <select
                    className={styles.evalGradeSelect}
                    data-testid={`classroom-eval-grade-${seatNumber}-${classroomId}`}
                    value={cell.grade || ''}
                    onChange={handleGradeChange}
                >
                    <option value="">{'—'}</option>
                    {GRADES.map((grade) => (
                        <option key={grade} value={grade}>
                            {grade}
                        </option>
                    ))}
                </select>
                {cell.needsReview && (
                    <span className={styles.evalNeedsReviewBadge} title="AI が判断に迷ったセルです">
                        {'要確認'}
                    </span>
                )}
                {cell.returned && <span className={styles.evalReturnedBadge}>{'返却済'}</span>}
            </div>
            <input
                className={styles.evalReasonInput}
                data-testid={`classroom-eval-reason-${seatNumber}-${classroomId}`}
                placeholder="根拠"
                type="text"
                value={cell.reason || ''}
                onChange={handleReasonChange}
            />
            <textarea
                className={styles.evalCommentInput}
                data-testid={`classroom-eval-comment-${seatNumber}-${classroomId}`}
                placeholder="生徒向けコメント"
                rows={2}
                value={comment || ''}
                onChange={handleCommentChange}
            />
        </td>
    );
};

GradeCell.propTypes = {
    cell: PropTypes.object,
    classroomId: PropTypes.string.isRequired,
    comment: PropTypes.string,
    seatNumber: PropTypes.number.isRequired,
    onSetCellGrade: PropTypes.func.isRequired,
    onSetCellReason: PropTypes.func.isRequired,
    onSetComment: PropTypes.func.isRequired,
};

const EMPTY_LESSON_SCORES = {};

const TeacherEvaluation = ({
    comments,
    error,
    errorTitle,
    evalGroup,
    evalLessons,
    evalProgress,
    getCell,
    lessonScores = EMPTY_LESSON_SCORES,
    rubricAxes,
    seats,
    selectedLessonIds,
    strictness,
    onBack,
    onChangeRubricAxis,
    onExportAuditCsv,
    onExportEvaluationCsv,
    onLoadSubmissions,
    onReturnComments,
    onRunAi,
    onSetCellGrade,
    onSetCellReason,
    onSetComment,
    onSetStrictness,
    onToggleLesson,
}) => {
    const intl = useIntl();
    const busy = !!evalProgress;
    const selectedLessons = evalLessons.filter((l) => selectedLessonIds.includes(l.classroomId));
    const loaded = seats.length > 0;
    // 作品の点とレッスンの点は別の列（#1603・作品の列のすぐ横に「レッスン」）。
    const columns = evaluationColumns(selectedLessons, lessonScores);
    const hasGrades = seats.some((seatNumber) =>
        selectedLessons.some((lesson) => {
            const cell = getCell(seatNumber, lesson.classroomId);
            return !!(cell && cell.submitted && cell.grade);
        }),
    );
    // 表に出ている席 × 選んだ課題だけを数える (読み込み直しても前回の下書きは state に残るため)。
    const hasComments = seats.some((seatNumber) =>
        selectedLessons.some((lesson) => (comments[`${seatNumber}:${lesson.classroomId}`] || '').trim() !== ''),
    );
    const step = currentEvalStep({ loaded, hasGrades, hasComments });
    const [hintOpen, setHintOpen] = useState(false);
    const handleHintToggle = useCallback(() => setHintOpen((prev) => !prev), []);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const handleSettingsToggle = useCallback(() => setSettingsOpen((prev) => !prev), []);

    const handleLessonToggle = useCallback(
        (e) => onToggleLesson(e.currentTarget.dataset.classroomId),
        [onToggleLesson],
    );
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
    const handleRunGrade = useCallback(() => onRunAi('grade'), [onRunAi]);
    const handleRunComment = useCallback(() => onRunAi('comment'), [onRunAi]);

    /* キャンセルは左端。右に「書き出し ▾」と 1〜4 の手順（いまの手順だけ主ボタン）。 */
    const footer = (
        <>
            <ClassroomButton className={styles.evalCancel} dataTestId="classroom-evaluation-cancel" onClick={onBack}>
                <FormattedMessage
                    defaultMessage="Cancel"
                    description="Cancel button of the evaluation screen (returns to the class list)"
                    id="gui.classroom.evaluation.cancel"
                />
            </ClassroomButton>
            <ExportMenu
                disabled={busy || !loaded}
                onExportAuditCsv={onExportAuditCsv}
                onExportEvaluationCsv={onExportEvaluationCsv}
            />
            <div className={styles.evalSteps} data-testid="classroom-eval-steps">
                <StepButton
                    current={step === 'load'}
                    dataTestId="classroom-eval-load"
                    disabled={busy || selectedLessons.length === 0}
                    number={1}
                    onClick={onLoadSubmissions}
                >
                    <FormattedMessage
                        defaultMessage="Load Submissions"
                        description="Step 1 of grading: load & analyze submissions"
                        id="gui.classroom.evaluation.load"
                    />
                </StepButton>
                <span aria-hidden="true" className={styles.evalStepArrow}>
                    {'→'}
                </span>
                <StepButton
                    current={step === 'grade'}
                    dataTestId="classroom-eval-run-grade"
                    disabled={busy || !loaded}
                    number={2}
                    onClick={handleRunGrade}
                >
                    <FormattedMessage
                        defaultMessage="Grade with AI"
                        description="Step 2 of grading: run AI grade proposals"
                        id="gui.classroom.evaluation.runGrade"
                    />
                </StepButton>
                <span aria-hidden="true" className={styles.evalStepArrow}>
                    {'→'}
                </span>
                <StepButton
                    current={step === 'comment'}
                    dataTestId="classroom-eval-run-comment"
                    disabled={busy || !loaded}
                    number={3}
                    onClick={handleRunComment}
                >
                    <FormattedMessage
                        defaultMessage="Draft Comments"
                        description="Step 3 of grading: run AI comment drafts"
                        id="gui.classroom.evaluation.runComment"
                    />
                </StepButton>
                <span aria-hidden="true" className={styles.evalStepArrow}>
                    {'→'}
                </span>
                <StepButton
                    current={step === 'return'}
                    dataTestId="classroom-eval-return-comments"
                    disabled={busy || !loaded}
                    number={4}
                    onClick={onReturnComments}
                >
                    <FormattedMessage
                        defaultMessage="Return Comments"
                        description="Step 4 of grading: return comment drafts to students"
                        id="gui.classroom.evaluation.returnComments"
                    />
                </StepButton>
            </div>
        </>
    );

    return (
        <TeacherScreen
            breadcrumbs={[
                {
                    label: (
                        <FormattedMessage
                            defaultMessage="Class list"
                            description="Breadcrumb link back to the class list"
                            id="gui.classroom.breadcrumbs.classList"
                        />
                    ),
                    onClick: onBack,
                    testId: 'classroom-breadcrumb-class-list',
                },
                {
                    label: (
                        <FormattedMessage
                            defaultMessage="Grading"
                            description="Breadcrumb label of the evaluation view"
                            id="gui.classroom.breadcrumbs.evaluation"
                        />
                    ),
                },
            ]}
            className={`${styles.teacherView} ${styles.evaluationScreen}`}
            error={error}
            errorTitle={errorTitle}
            footer={footer}
            hint={
                <>
                    <FormattedMessage
                        defaultMessage="AI grades are drafts. You make the final call."
                        description="One-line explanation of the grading screen"
                        id="gui.classroom.evaluation.hint"
                    />{' '}
                    <button
                        aria-expanded={hintOpen}
                        className={styles.evalHintToggle}
                        data-testid="classroom-eval-hint-toggle"
                        type="button"
                        onClick={handleHintToggle}
                    >
                        {hintOpen ? (
                            <FormattedMessage
                                defaultMessage="Less"
                                description="Hide the details of the grading screen explanation"
                                id="gui.classroom.evaluation.hintLess"
                            />
                        ) : (
                            <FormattedMessage
                                defaultMessage="More"
                                description="Show the details of the grading screen explanation"
                                id="gui.classroom.evaluation.hintMore"
                            />
                        )}
                    </button>
                    {hintOpen && (
                        <span className={styles.evalHintDetail} data-testid="classroom-eval-hint-detail">
                            <FormattedMessage
                                defaultMessage="Grading a few students by hand first calibrates the AI to your standard. Term grades are never shown to students; only the positive comments are returned."
                                description="Details of the grading screen explanation (opened with More)"
                                id="gui.classroom.evaluation.hintDetail"
                            />
                        </span>
                    )}
                </>
            }
            testId="classroom-phase-teacher-evaluation"
            title={evalGroup ? formatClassLabel(evalGroup) : ''}
        >
            {/* Lesson selection */}
            <div className={styles.evalSection}>
                <span className={styles.assignmentNameLabel}>
                    <FormattedMessage
                        defaultMessage="Lessons:"
                        description="Lesson checkbox list label"
                        id="gui.classroom.evaluation.lessons"
                    />
                </span>
                {evalLessons.map((lesson) => (
                    <label className={styles.evalLessonCheckbox} key={lesson.classroomId}>
                        <input
                            checked={selectedLessonIds.includes(lesson.classroomId)}
                            data-classroom-id={lesson.classroomId}
                            data-testid={`classroom-eval-lesson-${lesson.classroomId}`}
                            disabled={busy}
                            type="checkbox"
                            onChange={handleLessonToggle}
                        />
                        {lesson.assignmentName}
                    </label>
                ))}
            </div>

            {/* 採点の設定（観点・厳しさ）。あまり変えないので、いまの値の 1 行に畳む（R3 / R6）。 */}
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

            {/* Progress */}
            {evalProgress && (
                <div className={styles.evalProgress} data-testid="classroom-eval-progress">
                    {`${evalProgress.label} … (${evalProgress.done}/${evalProgress.total})`}
                </div>
            )}

            {/* Matrix */}
            {loaded && (
                <div className={styles.evalMatrixWrapper}>
                    <table className={styles.evalMatrix} data-testid="classroom-eval-matrix">
                        <thead>
                            <tr>
                                <th>
                                    <FormattedMessage
                                        defaultMessage="Seat"
                                        description="Seat column header"
                                        id="gui.classroom.evaluation.seat"
                                    />
                                </th>
                                {columns.map(({ lesson, kind }) =>
                                    kind === 'lesson' ? (
                                        <th
                                            className={styles.evalLessonHead}
                                            data-testid={`classroom-eval-lesson-head-${lesson.classroomId}`}
                                            key={`${lesson.classroomId}:lesson`}
                                            title={intl.formatMessage(evalMessages.lessonHeadTitle, {
                                                name: lesson.assignmentName,
                                                total:
                                                    lessonScores[lesson.classroomId] &&
                                                    lessonScores[lesson.classroomId].total !== null
                                                        ? lessonScores[lesson.classroomId].total
                                                        : '-',
                                            })}
                                        >
                                            {intl.formatMessage(evalMessages.lessonHead)}
                                        </th>
                                    ) : (
                                        <th key={lesson.classroomId}>{lesson.assignmentName}</th>
                                    ),
                                )}
                                <th>
                                    <FormattedMessage
                                        defaultMessage="Overall"
                                        description="Overall grade column header"
                                        id="gui.classroom.evaluation.overall"
                                    />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {seats.map((seatNumber) => {
                                const grades = selectedLessons.map(
                                    (lesson) => getCell(seatNumber, lesson.classroomId)?.grade,
                                );
                                return (
                                    <tr key={seatNumber}>
                                        <td className={styles.evalSeatCell}>{String(seatNumber).padStart(2, '0')}</td>
                                        {columns.map(({ lesson, kind }) =>
                                            kind === 'lesson' ? (
                                                <td
                                                    className={styles.evalLessonCell}
                                                    data-testid={`classroom-eval-lesson-score-${seatNumber}-${lesson.classroomId}`}
                                                    key={`${lesson.classroomId}:lesson`}
                                                >
                                                    {(() => {
                                                        const score = lessonScoreOf(
                                                            lessonScores,
                                                            lesson.classroomId,
                                                            seatNumber,
                                                        );
                                                        return score === null ? '—' : score;
                                                    })()}
                                                </td>
                                            ) : (
                                                <GradeCell
                                                    cell={getCell(seatNumber, lesson.classroomId)}
                                                    classroomId={lesson.classroomId}
                                                    comment={comments[`${seatNumber}:${lesson.classroomId}`]}
                                                    key={lesson.classroomId}
                                                    seatNumber={seatNumber}
                                                    onSetCellGrade={onSetCellGrade}
                                                    onSetCellReason={onSetCellReason}
                                                    onSetComment={onSetComment}
                                                />
                                            ),
                                        )}
                                        <td
                                            className={styles.evalOverallCell}
                                            data-testid={`classroom-eval-overall-${seatNumber}`}
                                        >
                                            {combineOverall(grades) || '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </TeacherScreen>
    );
};

TeacherEvaluation.propTypes = {
    comments: PropTypes.object.isRequired,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    evalGroup: PropTypes.object,
    evalLessons: PropTypes.arrayOf(PropTypes.object).isRequired,
    evalProgress: PropTypes.object,
    getCell: PropTypes.func.isRequired,
    lessonScores: PropTypes.object,
    rubricAxes: PropTypes.arrayOf(PropTypes.object).isRequired,
    seats: PropTypes.arrayOf(PropTypes.number).isRequired,
    selectedLessonIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    strictness: PropTypes.string.isRequired,
    onBack: PropTypes.func.isRequired,
    onChangeRubricAxis: PropTypes.func.isRequired,
    onExportAuditCsv: PropTypes.func.isRequired,
    onExportEvaluationCsv: PropTypes.func.isRequired,
    onLoadSubmissions: PropTypes.func.isRequired,
    onReturnComments: PropTypes.func.isRequired,
    onRunAi: PropTypes.func.isRequired,
    onSetCellGrade: PropTypes.func.isRequired,
    onSetCellReason: PropTypes.func.isRequired,
    onSetComment: PropTypes.func.isRequired,
    onSetStrictness: PropTypes.func.isRequired,
    onToggleLesson: PropTypes.func.isRequired,
};

export default TeacherEvaluation;
