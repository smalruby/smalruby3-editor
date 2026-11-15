/**
 * The right column of the grading screen (#1962・#1956 Q10): the seat chosen in the
 * gradebook table, with its grade, reason and comment under visible labels (R1).
 * The table shows only the grades so 40 seats × several assignments fit; the
 * longer fields live here, one seat at a time. ‹ › at the top right move to the
 * previous / next seat that submitted the same assignment (at the top so they stay
 * visible when the column is low and scrolls).
 */
import PropTypes from 'prop-types';
import React, { useCallback, useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { GRADE_ORDER } from '../../lib/classroom-evaluation/evaluation-utils.js';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';

const GRADES = [...GRADE_ORDER].reverse(); // S, A, B, C

export const detailMessages = defineMessages({
    fieldGrade: {
        defaultMessage: 'Grade',
        description: 'Grading screen: label of the grade (S/A/B/C) field of the chosen seat',
        id: 'gui.classroom.evaluation.fieldGrade',
    },
    fieldReason: {
        defaultMessage: 'Reason (teacher only)',
        description: 'Grading screen: label of the reason field of the chosen seat (the student does not see it)',
        id: 'gui.classroom.evaluation.fieldReason',
    },
    fieldComment: {
        defaultMessage: 'Comment to the student',
        description: 'Grading screen: label of the comment field of the chosen seat (returned to the student)',
        id: 'gui.classroom.evaluation.fieldComment',
    },
    title: {
        defaultMessage: 'Seat {seat}',
        description: 'Grading screen: heading of the right column, the seat chosen in the table (#1962)',
        id: 'gui.classroom.evaluation.detailTitle',
    },
    prev: {
        defaultMessage: 'Previous seat',
        description: 'Grading screen: accessible name of ‹ (the previous seat that submitted, #1962)',
        id: 'gui.classroom.evaluation.detailPrev',
    },
    next: {
        defaultMessage: 'Next seat',
        description: 'Grading screen: accessible name of › (the next seat that submitted, #1962)',
        id: 'gui.classroom.evaluation.detailNext',
    },
    empty: {
        defaultMessage: 'No work has been submitted.',
        description: 'Grading screen: right column when no seat submitted the chosen assignments (#1962)',
        id: 'gui.classroom.evaluation.detailEmpty',
    },
    aiDraft: {
        defaultMessage: 'AI draft',
        description: 'Grading screen: tag next to a grade the AI proposed and the teacher has not changed (#1962)',
        id: 'gui.classroom.evaluation.aiDraft',
    },
    needsReview: {
        defaultMessage: 'Check',
        description: 'Grading screen: tag of a cell the AI was unsure about',
        id: 'gui.classroom.evaluation.needsReview',
    },
    needsReviewTitle: {
        defaultMessage: 'The AI was unsure about this one.',
        description: 'Grading screen: tooltip of the "Check" tag',
        id: 'gui.classroom.evaluation.needsReviewTitle',
    },
    returned: {
        defaultMessage: 'Returned',
        description: 'Grading screen: tag of a cell whose comment was returned to the student',
        id: 'gui.classroom.evaluation.returned',
    },
});

const pad = (seat) => String(seat).padStart(2, '0');

const TeacherEvaluationDetail = ({
    cell,
    classroomId,
    comment,
    lessonName,
    nextSeat,
    prevSeat,
    seatNumber,
    onSelectSeat,
    onSetCellGrade,
    onSetCellReason,
    onSetComment,
}) => {
    const intl = useIntl();
    const gradeId = useId();
    const reasonId = useId();
    const commentId = useId();
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
    const handlePrev = useCallback(() => onSelectSeat(prevSeat, classroomId), [onSelectSeat, prevSeat, classroomId]);
    const handleNext = useCallback(() => onSelectSeat(nextSeat, classroomId), [onSelectSeat, nextSeat, classroomId]);

    if (!cell) {
        return (
            <aside className={styles.evalDetail} data-testid="classroom-eval-detail">
                <p className={styles.evalDetailEmpty} data-testid="classroom-eval-detail-empty">
                    {intl.formatMessage(detailMessages.empty)}
                </p>
            </aside>
        );
    }
    return (
        <aside className={styles.evalDetail} data-testid="classroom-eval-detail">
            <div className={styles.evalDetailHeader}>
                <h3 className={styles.evalDetailTitle} data-testid="classroom-eval-detail-title">
                    {intl.formatMessage(detailMessages.title, { seat: pad(seatNumber) })}
                </h3>
                <div className={styles.evalDetailNav}>
                    <ClassroomButton
                        ariaLabel={intl.formatMessage(detailMessages.prev)}
                        dataTestId="classroom-eval-detail-prev"
                        disabled={prevSeat === null}
                        variant="text"
                        onClick={handlePrev}
                    >
                        {prevSeat === null ? '‹' : `‹ ${pad(prevSeat)}`}
                    </ClassroomButton>
                    <ClassroomButton
                        ariaLabel={intl.formatMessage(detailMessages.next)}
                        dataTestId="classroom-eval-detail-next"
                        disabled={nextSeat === null}
                        variant="text"
                        onClick={handleNext}
                    >
                        {nextSeat === null ? '›' : `${pad(nextSeat)} ›`}
                    </ClassroomButton>
                </div>
            </div>
            <span className={styles.evalDetailLesson} data-testid="classroom-eval-detail-lesson">
                {lessonName}
            </span>
            <div className={styles.evalDetailGradeRow}>
                <label className={styles.evalDetailLabel} htmlFor={gradeId}>
                    {intl.formatMessage(detailMessages.fieldGrade)}
                </label>
                <select
                    className={styles.evalGradeSelect}
                    data-testid={`classroom-eval-grade-${seatNumber}-${classroomId}`}
                    id={gradeId}
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
                {cell.grade && !cell.manual && (
                    <span className={styles.evalTag} data-testid="classroom-eval-detail-ai-draft">
                        {intl.formatMessage(detailMessages.aiDraft)}
                    </span>
                )}
                {cell.needsReview && (
                    <span
                        className={styles.evalNeedsReviewBadge}
                        title={intl.formatMessage(detailMessages.needsReviewTitle)}
                    >
                        {intl.formatMessage(detailMessages.needsReview)}
                    </span>
                )}
                {cell.returned && (
                    <span className={styles.evalReturnedBadge}>{intl.formatMessage(detailMessages.returned)}</span>
                )}
            </div>
            <label className={styles.evalDetailLabel} htmlFor={reasonId}>
                {intl.formatMessage(detailMessages.fieldReason)}
            </label>
            <textarea
                className={styles.evalReasonInput}
                data-testid={`classroom-eval-reason-${seatNumber}-${classroomId}`}
                id={reasonId}
                rows={2}
                value={cell.reason || ''}
                onChange={handleReasonChange}
            />
            <label className={styles.evalDetailLabel} htmlFor={commentId}>
                {intl.formatMessage(detailMessages.fieldComment)}
            </label>
            <textarea
                className={styles.evalCommentInput}
                data-testid={`classroom-eval-comment-${seatNumber}-${classroomId}`}
                id={commentId}
                rows={3}
                value={comment || ''}
                onChange={handleCommentChange}
            />
        </aside>
    );
};

TeacherEvaluationDetail.propTypes = {
    /** The chosen cell (`getCell`), or null when nothing was submitted. */
    cell: PropTypes.object,
    classroomId: PropTypes.string,
    comment: PropTypes.string,
    lessonName: PropTypes.string,
    nextSeat: PropTypes.number,
    prevSeat: PropTypes.number,
    seatNumber: PropTypes.number,
    onSelectSeat: PropTypes.func.isRequired,
    onSetCellGrade: PropTypes.func.isRequired,
    onSetCellReason: PropTypes.func.isRequired,
    onSetComment: PropTypes.func.isRequired,
};

export default TeacherEvaluationDetail;
