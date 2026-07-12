/**
 * Term-end evaluation screen (teacher side).
 *
 * seat × lesson matrix with AI-proposed grades. The AI never decides:
 * every proposal is editable, needsReview cells are highlighted, and the
 * exported CSVs (record + engineer audit) are the teacher's artifacts.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';

import ErrorDisplay from './error-display.jsx';

import { GRADE_ORDER, combineOverall } from '../../lib/classroom-evaluation/evaluation-utils.js';

import { formatClassLabel } from '../../lib/classroom-class-label.js';
import TeacherBreadcrumbs from './teacher-breadcrumbs.jsx';
import styles from './classroom-modal.css';

const GRADES = [...GRADE_ORDER].reverse(); // S, A, B, C

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

const TeacherEvaluation = ({
    comments,
    error,
    errorTitle,
    evalGroup,
    evalLessons,
    evalProgress,
    getCell,
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

    const handleLessonToggle = useCallback(
        (e) => onToggleLesson(e.currentTarget.dataset.classroomId),
        [onToggleLesson],
    );
    const handleStrictnessChange = useCallback((e) => onSetStrictness(e.target.value), [onSetStrictness]);
    const handleAxisChange = useCallback(
        (e) => onChangeRubricAxis(parseInt(e.currentTarget.dataset.index, 10), e.currentTarget.dataset.field, e.target.value),
        [onChangeRubricAxis],
    );
    const handleRunGrade = useCallback(() => onRunAi('grade'), [onRunAi]);
    const handleRunComment = useCallback(() => onRunAi('comment'), [onRunAi]);

    return (
        <div
            className={`${styles.teacherView} ${styles.evaluationScreen}`}
            data-testid="classroom-phase-teacher-evaluation"
        >
            <TeacherBreadcrumbs
                items={[
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
                                defaultMessage="Evaluation"
                                description="Breadcrumb label of the evaluation view"
                                id="gui.classroom.breadcrumbs.evaluation"
                            />
                        ),
                    },
                ]}
            />
            <h2 className={styles.teacherViewTitle}>{evalGroup ? formatClassLabel(evalGroup) : ''}</h2>
            <p className={styles.assignmentEditorHint}>
                <FormattedMessage
                    defaultMessage="AI proposals are drafts — you decide. Grading a few students by hand first calibrates the AI to your standard. Term grades are never shown to students; only the positive comments are returned."
                    description="Evaluation screen explanation"
                    id="gui.classroom.evaluation.hint"
                />
            </p>

            <ErrorDisplay error={error} errorTitle={errorTitle} />

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
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-eval-load"
                    disabled={busy || selectedLessons.length === 0}
                    onClick={onLoadSubmissions}
                >
                    <FormattedMessage
                        defaultMessage="Load Submissions"
                        description="Load & analyze submissions button"
                        id="gui.classroom.evaluation.load"
                    />
                </button>
            </div>

            {/* Rubric */}
            <div className={styles.evalSection}>
                <span className={styles.assignmentNameLabel}>
                    <FormattedMessage
                        defaultMessage="Rubric:"
                        description="Rubric section label"
                        id="gui.classroom.evaluation.rubric"
                    />
                </span>
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
                        <option value="lenient">
                            {intl.formatMessage({
                                defaultMessage: 'Lenient',
                                description: 'Strictness option',
                                id: 'gui.classroom.evaluation.strictnessLenient',
                            })}
                        </option>
                        <option value="standard">
                            {intl.formatMessage({
                                defaultMessage: 'Standard',
                                description: 'Strictness option',
                                id: 'gui.classroom.evaluation.strictnessStandard',
                            })}
                        </option>
                        <option value="strict">
                            {intl.formatMessage({
                                defaultMessage: 'Strict',
                                description: 'Strictness option',
                                id: 'gui.classroom.evaluation.strictnessStrict',
                            })}
                        </option>
                    </select>
                </label>
            </div>

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
                                {selectedLessons.map((lesson) => (
                                    <th key={lesson.classroomId}>{lesson.assignmentName}</th>
                                ))}
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
                                        <td className={styles.evalSeatCell}>
                                            {String(seatNumber).padStart(2, '0')}
                                        </td>
                                        {selectedLessons.map((lesson) => (
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
                                        ))}
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

            {/* Actions */}
            <div className={styles.buttonRow}>
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-eval-run-grade"
                    disabled={busy || !loaded}
                    onClick={handleRunGrade}
                >
                    <FormattedMessage
                        defaultMessage="Run AI Grading"
                        description="Run AI grade proposals"
                        id="gui.classroom.evaluation.runGrade"
                    />
                </button>
                <button
                    className={styles.secondaryButton}
                    data-testid="classroom-eval-run-comment"
                    disabled={busy || !loaded}
                    onClick={handleRunComment}
                >
                    <FormattedMessage
                        defaultMessage="Draft Student Comments"
                        description="Run AI comment drafts"
                        id="gui.classroom.evaluation.runComment"
                    />
                </button>
                <button
                    className={styles.secondaryButton}
                    data-testid="classroom-eval-export"
                    disabled={busy || !loaded}
                    onClick={onExportEvaluationCsv}
                >
                    <FormattedMessage
                        defaultMessage="Evaluation CSV"
                        description="Export evaluation CSV"
                        id="gui.classroom.evaluation.exportCsv"
                    />
                </button>
                <button
                    className={styles.secondaryButton}
                    data-testid="classroom-eval-export-audit"
                    disabled={busy || !loaded}
                    onClick={onExportAuditCsv}
                >
                    <FormattedMessage
                        defaultMessage="Audit CSV"
                        description="Export engineer-audit CSV"
                        id="gui.classroom.evaluation.exportAuditCsv"
                    />
                </button>
                <button
                    className={styles.secondaryButton}
                    data-testid="classroom-eval-return-comments"
                    disabled={busy || !loaded}
                    onClick={onReturnComments}
                >
                    <FormattedMessage
                        defaultMessage="Return Comments"
                        description="Return comment drafts to students"
                        id="gui.classroom.evaluation.returnComments"
                    />
                </button>
            </div>
        </div>
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
