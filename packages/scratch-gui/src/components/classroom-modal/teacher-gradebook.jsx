/**
 * The gradebook of a class (「採点簿」, EPIC #2421 / #2424): the first screen of the
 * class's［採点］tab, after Google Classroom's gradebook. A column per assignment
 * (the newest on the left), a row per seat, S/A/B/C in the cells. A grade the AI
 * proposed and the teacher has not confirmed is drawn dashed and faint. The top row
 * counts S/A/B/C of each assignment. Pressing a column's name opens that
 * assignment's grading; pressing a cell opens it with that seat chosen.
 *
 * The table scrolls inside its own frame (R6: 40 seats × many assignments), the
 * seat column stays put on the left.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import {
    GRADES,
    columnStatus,
    gradeCounts,
    gradebookCell,
    gradebookSeats,
} from '../../lib/classroom-evaluation/gradebook.js';
import styles from './classroom-modal.css';

export const gradebookMessages = defineMessages({
    book: {
        defaultMessage: 'Gradebook',
        description: 'Grading tab: switch to the gradebook (assignments × seats, #2424)',
        id: 'gui.classroom.gradebook.book',
    },
    overall: {
        defaultMessage: 'Overall grade',
        description: 'Grading tab: switch to the overall grade of the term (#2424 / #2426)',
        id: 'gui.classroom.gradebook.overall',
    },
    openHint: {
        defaultMessage: 'Press an assignment name to grade it.',
        description: 'Gradebook: one-line hint next to the switch (#2424)',
        id: 'gui.classroom.gradebook.openHint',
    },
    seat: {
        defaultMessage: 'Seat',
        description: 'Gradebook: header of the seat column',
        id: 'gui.classroom.gradebook.seat',
    },
    countsRow: {
        defaultMessage: 'Count',
        description: 'Gradebook: label of the top row that counts S/A/B/C of each assignment (#2424)',
        id: 'gui.classroom.gradebook.countsRow',
    },
    stateNone: {
        defaultMessage: 'Not graded',
        description: 'Gradebook: state of an assignment nobody has graded yet (#2424)',
        id: 'gui.classroom.gradebook.stateNone',
    },
    stateDraft: {
        defaultMessage: '{drafts} AI drafts, not confirmed',
        description: 'Gradebook: state of an assignment graded but not confirmed (#2424)',
        id: 'gui.classroom.gradebook.stateDraft',
    },
    stateConfirmed: {
        defaultMessage: 'Confirmed {graded}',
        description: 'Gradebook: state of an assignment whose grades the teacher confirmed (#2424)',
        id: 'gui.classroom.gradebook.stateConfirmed',
    },
    stateRubric: {
        defaultMessage: 'Rubric',
        description: 'Gradebook: shown in the state of an assignment that has a rubric (#2424)',
        id: 'gui.classroom.gradebook.stateRubric',
    },
    stateLoading: {
        defaultMessage: 'Loading…',
        description: 'Gradebook: state of an assignment whose saved grades are being read (#2424)',
        id: 'gui.classroom.gradebook.stateLoading',
    },
    cellName: {
        defaultMessage: 'Seat {seat}, {name}: {grade}',
        description: 'Gradebook: accessible name of a cell button (#2424)',
        id: 'gui.classroom.gradebook.cellName',
    },
    cellNameDraft: {
        defaultMessage: 'Seat {seat}, {name}: {grade} (AI draft)',
        description: 'Gradebook: accessible name of a cell with an AI grade not confirmed (#2424)',
        id: 'gui.classroom.gradebook.cellNameDraft',
    },
    noGrade: {
        defaultMessage: 'No grade',
        description: 'Gradebook: read out for a cell without a grade (#2424)',
        id: 'gui.classroom.gradebook.noGrade',
    },
    legendDraft: {
        defaultMessage: 'Dashed: AI draft (not confirmed)',
        description: 'Gradebook: legend of the dashed, faint grades (R5, #2424)',
        id: 'gui.classroom.gradebook.legendDraft',
    },
    empty: {
        defaultMessage: 'No assignment is graded yet. Press an assignment name to start.',
        description: 'Gradebook: shown under the header row when no assignment has grades (#2424)',
        id: 'gui.classroom.gradebook.empty',
    },
    noAssignments: {
        defaultMessage: 'This class has no assignments yet.',
        description: 'Gradebook: the class has no assignment to grade (#2424)',
        id: 'gui.classroom.gradebook.noAssignments',
    },
    overallSoon: {
        defaultMessage:
            'The overall grade combines the confirmed grades of the assignments. It will be set here soon.',
        description: 'Grading tab: placeholder of the overall grade screen until it is built (#2426)',
        id: 'gui.classroom.gradebook.overallSoon',
    },
});

/* 採点簿の上の切りかえ: ［採点簿］［総合評価］。 */
export const GradebookSwitch = ({ view, onShowGradebook, onShowOverall }) => {
    const intl = useIntl();
    return (
        <div className={styles.gradebookSwitch} role="group">
            <button
                aria-pressed={view === 'book'}
                className={classNames(styles.gradebookSwitchButton, {
                    [styles.gradebookSwitchButtonOn]: view === 'book',
                })}
                data-testid="classroom-gradebook-switch-book"
                type="button"
                onClick={onShowGradebook}
            >
                {intl.formatMessage(gradebookMessages.book)}
            </button>
            <button
                aria-pressed={view === 'overall'}
                className={classNames(styles.gradebookSwitchButton, {
                    [styles.gradebookSwitchButtonOn]: view === 'overall',
                })}
                data-testid="classroom-gradebook-switch-overall"
                type="button"
                onClick={onShowOverall}
            >
                {intl.formatMessage(gradebookMessages.overall)}
            </button>
        </div>
    );
};

GradebookSwitch.propTypes = {
    view: PropTypes.oneOf(['book', 'overall']).isRequired,
    onShowGradebook: PropTypes.func.isRequired,
    onShowOverall: PropTypes.func.isRequired,
};

/* 列の見出し: 状態（未採点 / AI の案 / 確定）と、押すと課題の採点を開く課題名。 */
const ColumnHead = ({ grading, lesson, loading, onOpen }) => {
    const intl = useIntl();
    const handleClick = useCallback(() => onOpen(lesson.classroomId), [onOpen, lesson.classroomId]);
    let state;
    if (loading) {
        state = intl.formatMessage(gradebookMessages.stateLoading);
    } else {
        const status = columnStatus(grading);
        state = {
            none: () => intl.formatMessage(gradebookMessages.stateNone),
            draft: () => intl.formatMessage(gradebookMessages.stateDraft, { drafts: status.drafts }),
            confirmed: () => intl.formatMessage(gradebookMessages.stateConfirmed, { graded: status.graded }),
        }[status.kind]();
        if (status.hasRubric) state = `${intl.formatMessage(gradebookMessages.stateRubric)}・${state}`;
    }
    return (
        <th
            className={styles.gradebookColHead}
            data-testid={`classroom-gradebook-col-${lesson.classroomId}`}
            scope="col"
        >
            <span className={styles.gradebookColState}>{state}</span>
            <button
                className={styles.gradebookColName}
                data-testid={`classroom-gradebook-open-${lesson.classroomId}`}
                title={lesson.assignmentName}
                type="button"
                onClick={handleClick}
            >
                {lesson.assignmentName}
            </button>
        </th>
    );
};

ColumnHead.propTypes = {
    grading: PropTypes.object,
    lesson: PropTypes.object.isRequired,
    /** The saved grading is still being read. */
    loading: PropTypes.bool,
    onOpen: PropTypes.func.isRequired,
};

const BookCell = ({ grading, lesson, seat, onOpen }) => {
    const intl = useIntl();
    const handleClick = useCallback(() => onOpen(lesson.classroomId, seat), [onOpen, lesson.classroomId, seat]);
    const cell = gradebookCell(grading, seat);
    const values = {
        seat,
        name: lesson.assignmentName,
        grade: cell ? cell.grade : intl.formatMessage(gradebookMessages.noGrade),
    };
    return (
        <td className={styles.gradebookCell} data-testid={`classroom-gradebook-cell-${seat}-${lesson.classroomId}`}>
            <button
                aria-label={intl.formatMessage(
                    cell && cell.draft ? gradebookMessages.cellNameDraft : gradebookMessages.cellName,
                    values,
                )}
                className={styles.evalCellButton}
                data-draft={cell ? cell.draft : null}
                type="button"
                onClick={handleClick}
            >
                {cell ? (
                    <span
                        className={classNames(styles.evalGradePill, {
                            [styles.evalGradePillDraft]: cell.draft,
                        })}
                    >
                        {cell.grade}
                    </span>
                ) : (
                    <span className={styles.gradebookNoGrade}>{'—'}</span>
                )}
            </button>
        </td>
    );
};

BookCell.propTypes = {
    grading: PropTypes.object,
    lesson: PropTypes.object.isRequired,
    seat: PropTypes.number.isRequired,
    onOpen: PropTypes.func.isRequired,
};

/**
 * The gradebook table.
 * @param {object} props - the assignments, their saved gradings and the open handler
 * @param {object} props.gradings - classroomId → saved grading
 * @param {Array<object>} props.lessons - the assignments, newest first
 * @param {Function} props.onOpenAssignment - (classroomId, seat?) → open the assignment's grading
 * @returns {React.ReactElement} the table (or a note when the class has no assignment)
 */
const TeacherGradebook = ({ gradings, lessons, onOpenAssignment }) => {
    const intl = useIntl();
    if (lessons.length === 0) {
        return (
            <p className={styles.gradebookNote} data-testid="classroom-gradebook-no-assignments">
                {intl.formatMessage(gradebookMessages.noAssignments)}
            </p>
        );
    }
    const seats = gradebookSeats(gradings);
    return (
        <div className={styles.gradebookArea}>
            <div className={styles.evalMatrixWrapper}>
                <table className={styles.evalMatrix} data-testid="classroom-gradebook">
                    <thead>
                        <tr>
                            <th className={styles.evalSeatHead} scope="col">
                                {intl.formatMessage(gradebookMessages.seat)}
                            </th>
                            {lessons.map((lesson) => (
                                <ColumnHead
                                    grading={gradings[lesson.classroomId]}
                                    key={lesson.classroomId}
                                    lesson={lesson}
                                    loading={!(lesson.classroomId in gradings)}
                                    onOpen={onOpenAssignment}
                                />
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className={styles.gradebookCountsRow}>
                            <th className={styles.evalSeatCell} scope="row">
                                {intl.formatMessage(gradebookMessages.countsRow)}
                            </th>
                            {lessons.map((lesson) => {
                                const grading = gradings[lesson.classroomId];
                                const counts = gradeCounts(grading && grading.grades);
                                const total = GRADES.reduce((sum, g) => sum + counts[g], 0);
                                return (
                                    <td
                                        data-testid={`classroom-gradebook-counts-${lesson.classroomId}`}
                                        key={lesson.classroomId}
                                    >
                                        {total === 0 ? '—' : GRADES.map((g) => `${g}${counts[g]}`).join(' ')}
                                    </td>
                                );
                            })}
                        </tr>
                        {seats.map((seat) => (
                            <tr key={seat}>
                                <th className={styles.evalSeatCell} scope="row">
                                    {String(seat).padStart(2, '0')}
                                </th>
                                {lessons.map((lesson) => (
                                    <BookCell
                                        grading={gradings[lesson.classroomId]}
                                        key={lesson.classroomId}
                                        lesson={lesson}
                                        seat={seat}
                                        onOpen={onOpenAssignment}
                                    />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {seats.length === 0 && (
                    <p className={styles.gradebookNote} data-testid="classroom-gradebook-empty">
                        {intl.formatMessage(gradebookMessages.empty)}
                    </p>
                )}
            </div>
            <p className={styles.gradebookLegend}>
                <span aria-hidden="true" className={classNames(styles.evalGradePill, styles.evalGradePillDraft)}>
                    {'A'}
                </span>
                {intl.formatMessage(gradebookMessages.legendDraft)}
            </p>
        </div>
    );
};

TeacherGradebook.propTypes = {
    /** classroomId → saved grading (null = none; a missing key = still reading) */
    gradings: PropTypes.object.isRequired,
    /** The assignments of the class, newest first. */
    lessons: PropTypes.arrayOf(PropTypes.object).isRequired,
    /** (classroomId, seat?) → open the assignment's grading */
    onOpenAssignment: PropTypes.func.isRequired,
};

/* 総合評価（#2426 がつくる）までの仮の画面。 */
export const TeacherOverallPlaceholder = () => (
    <p className={styles.gradebookNote} data-testid="classroom-gradebook-overall">
        <FormattedMessage {...gradebookMessages.overallSoon} />
    </p>
);

export default TeacherGradebook;
