/**
 * The［形］tab of an assignment's grading: the works grouped by their shape tags
 * (shape-tags.js), with one grade for every work of a shape.
 *
 * The AI grades the class in chunks, and the same kind of work could get
 * different grades. Here the teacher sees each shape once (「明るさでサーボを
 * 切りかえ」「片側だけ / LED」…), how many works have it and the grades they have
 * now, and gives the shape one grade. A shape whose works have different grades
 * is marked, so the teacher looks at those first; a work that differs from its
 * shape (what the tags cannot tell) is opened and changed one by one.
 *
 * `ShapeTags` (the tags of one work) is used by the［生徒］tab too.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { GRADES } from '../../lib/classroom-evaluation/gradebook.js';
import { groupByShape, tagKind } from '../../lib/classroom-evaluation/shape-tags.js';
import ClassroomButton from './classroom-button.jsx';
import modalStyles from './classroom-modal.css';
import styles from './teacher-grading-shapes.css';

const messages = defineMessages({
    lead: {
        defaultMessage:
            'Works are grouped by their shape. Choose a grade for a shape and give it to all of its works at once. Open the works to change one of them.',
        description: 'Shape tab: what the tab does (shape tags)',
        id: 'gui.classroom.gradingShapes.lead',
    },
    count: {
        defaultMessage: '{count} works ({seats})',
        description: 'Shape tab: how many works have this shape, and their seat numbers',
        id: 'gui.classroom.gradingShapes.count',
    },
    now: {
        defaultMessage: 'Now: {grades}',
        description: 'Shape tab: the grades the works of this shape have now',
        id: 'gui.classroom.gradingShapes.now',
    },
    mixed: {
        defaultMessage: 'Same shape, different grades',
        description: 'Shape tab: the works of this shape do not all have the same grade',
        id: 'gui.classroom.gradingShapes.mixed',
    },
    gradeLabel: {
        defaultMessage: 'This shape is',
        description: 'Shape tab: label of the grade chooser of a shape',
        id: 'gui.classroom.gradingShapes.gradeLabel',
    },
    choose: {
        defaultMessage: 'Choose',
        description: 'Shape tab: empty choice of the grade chooser (the works have different grades)',
        id: 'gui.classroom.gradingShapes.choose',
    },
    apply: {
        defaultMessage: 'Give to {count} works',
        description: 'Shape tab: button to give the chosen grade to every work of the shape',
        id: 'gui.classroom.gradingShapes.apply',
    },
    works: {
        defaultMessage: 'Show the works ({count})',
        description: 'Shape tab: open the list of the works of a shape',
        id: 'gui.classroom.gradingShapes.works',
    },
    seat: {
        defaultMessage: 'Seat {seat}',
        description: 'Shape tab: a work in the list of a shape',
        id: 'gui.classroom.gradingShapes.seat',
    },
    noScripts: {
        defaultMessage: '(No script added to the starter)',
        description: 'Shape tab: the work added nothing to the starter',
        id: 'gui.classroom.gradingShapes.noScripts',
    },
    empty: {
        defaultMessage: 'No work to group yet. Load the submissions first.',
        description: 'Shape tab: nothing loaded',
        id: 'gui.classroom.gradingShapes.empty',
    },
    tagsLabel: {
        defaultMessage: 'Shape',
        description: 'Student tab: label of the shape tags of the work',
        id: 'gui.classroom.gradingShapes.tagsLabel',
    },
    sameShape: {
        defaultMessage: 'Same shape:',
        description: 'Student tab: the other works with the same shape tags',
        id: 'gui.classroom.gradingShapes.sameShape',
    },
});

const pad = (n) => String(n).padStart(2, '0');
const KIND_STYLE = { good: 'tagGood', note: 'tagNote', part: 'tagPart', number: 'tagNumber' };

/* The tags of a work (or of a shape), colored by kind. */
const ShapeTags = ({ tags, small = false }) => (
    <span className={classNames(styles.tags, { [styles.tagsSmall]: small })}>
        {tags.map((tag) => (
            <span className={classNames(styles.tag, styles[KIND_STYLE[tagKind(tag)]])} key={tag}>
                {tag}
            </span>
        ))}
    </span>
);

ShapeTags.propTypes = {
    small: PropTypes.bool,
    tags: PropTypes.arrayOf(PropTypes.string).isRequired,
};

const DOT_STYLE = { good: 'dotGood', note: 'dotNote', part: 'dotPart' };

/* The kinds of a work's tags as small dots, for the seat list (the tags are in the［生徒］tab). */
const ShapeDots = ({ tags }) => {
    const kinds = [...new Set(tags.map(tagKind))].filter((kind) => DOT_STYLE[kind]);
    return (
        <span aria-hidden="true" className={styles.dots}>
            {kinds.map((kind) => (
                <span className={classNames(styles.dot, styles[DOT_STYLE[kind]])} key={kind} />
            ))}
        </span>
    );
};

ShapeDots.propTypes = {
    tags: PropTypes.arrayOf(PropTypes.string).isRequired,
};

/* One shape: its tags, works, grades now, and the grade to give them all. */
const ShapeGroup = ({ classroomId, group, index, cells, onSelectSeat, onSetSeatsGrade }) => {
    const intl = useIntl();
    const grades = group.seatNumbers.map((seat) => (cells[seat] && cells[seat].grade) || null);
    const given = [...new Set(grades.filter(Boolean))];
    const mixed = given.length > 1 || (given.length === 1 && grades.some((g) => !g));
    const [choice, setChoice] = useState(mixed ? '' : given[0] || '');
    const handleChoice = useCallback((e) => setChoice(e.target.value), []);
    const handleApply = useCallback(
        () => onSetSeatsGrade(group.seatNumbers, classroomId, choice),
        [onSetSeatsGrade, group.seatNumbers, classroomId, choice],
    );
    const handleOpen = useCallback(
        (e) => onSelectSeat(parseInt(e.currentTarget.dataset.seat, 10), classroomId),
        [onSelectSeat, classroomId],
    );
    const counts = GRADES.map((g) => [g, grades.filter((x) => x === g).length]).filter(([, n]) => n > 0);
    return (
        <li
            className={classNames(styles.group, { [styles.groupMixed]: mixed })}
            data-testid={`classroom-eval-shape-${index}`}
        >
            <div className={styles.groupHead}>
                <div className={styles.groupInfo}>
                    <ShapeTags tags={group.tags} />
                    <div className={styles.groupMeta}>
                        <span>
                            {intl.formatMessage(messages.count, {
                                count: group.seatNumbers.length,
                                seats: group.seatNumbers.map(pad).join('・'),
                            })}
                        </span>
                        {counts.length > 0 && (
                            <span>
                                {intl.formatMessage(messages.now, {
                                    grades: counts.map(([g, n]) => `${g} ${n}`).join('・'),
                                })}
                            </span>
                        )}
                        {mixed && (
                            <span className={styles.mixed} data-testid={`classroom-eval-shape-mixed-${index}`}>
                                {intl.formatMessage(messages.mixed)}
                            </span>
                        )}
                    </div>
                </div>
                <div className={styles.groupAction}>
                    <label className={styles.gradeLabel} htmlFor={`classroom-eval-shape-grade-${index}`}>
                        {intl.formatMessage(messages.gradeLabel)}
                    </label>
                    <select
                        className={modalStyles.evalGradeSelect}
                        data-testid={`classroom-eval-shape-grade-${index}`}
                        id={`classroom-eval-shape-grade-${index}`}
                        value={choice}
                        onChange={handleChoice}
                    >
                        {!choice && <option value="">{intl.formatMessage(messages.choose)}</option>}
                        {GRADES.map((g) => (
                            <option key={g} value={g}>
                                {g}
                            </option>
                        ))}
                    </select>
                    <ClassroomButton
                        dataTestId={`classroom-eval-shape-apply-${index}`}
                        disabled={!choice}
                        variant="primary"
                        onClick={handleApply}
                    >
                        {intl.formatMessage(messages.apply, { count: group.seatNumbers.length })}
                    </ClassroomButton>
                </div>
            </div>
            <details className={styles.works}>
                <summary data-testid={`classroom-eval-shape-works-${index}`}>
                    {intl.formatMessage(messages.works, { count: group.seatNumbers.length })}
                </summary>
                <ul className={styles.workList}>
                    {group.seatNumbers.map((seat) => {
                        const cell = cells[seat] || {};
                        return (
                            <li className={styles.work} key={seat}>
                                <button
                                    className={styles.workHead}
                                    data-seat={seat}
                                    data-testid={`classroom-eval-shape-work-${seat}`}
                                    type="button"
                                    onClick={handleOpen}
                                >
                                    <span>{intl.formatMessage(messages.seat, { seat: pad(seat) })}</span>
                                    <span
                                        className={classNames(modalStyles.evalGradePill, {
                                            [modalStyles.evalGradePillEmpty]: !cell.grade,
                                        })}
                                    >
                                        {cell.grade || '—'}
                                    </span>
                                </button>
                                {cell.shape && <ShapeTags small tags={cell.shape.tags} />}
                                <pre className={styles.code}>
                                    {cell.added && cell.added.length > 0
                                        ? cell.added.join('\n\n')
                                        : intl.formatMessage(messages.noScripts)}
                                </pre>
                            </li>
                        );
                    })}
                </ul>
            </details>
        </li>
    );
};

ShapeGroup.propTypes = {
    cells: PropTypes.object.isRequired,
    classroomId: PropTypes.string.isRequired,
    group: PropTypes.shape({
        key: PropTypes.string,
        seatNumbers: PropTypes.arrayOf(PropTypes.number),
        tags: PropTypes.arrayOf(PropTypes.string),
    }).isRequired,
    index: PropTypes.number.isRequired,
    onSelectSeat: PropTypes.func.isRequired,
    onSetSeatsGrade: PropTypes.func.isRequired,
};

/**
 * The works of the submitted seats, by seat.
 * @param {number[]} seats - seat numbers
 * @param {Function} getCell - (seat, classroomId) → cell
 * @param {string} classroomId - the assignment
 * @returns {object} seat → cell (submitted works with a shape only)
 */
const shapedCells = (seats, getCell, classroomId) => {
    const cells = {};
    for (const seat of seats) {
        const cell = getCell(seat, classroomId);
        if (cell && cell.submitted && cell.shape) cells[seat] = cell;
    }
    return cells;
};

const TeacherGradingShapes = ({ classroomId, getCell, seats, onSelectSeat, onSetSeatsGrade }) => {
    const intl = useIntl();
    const cells = shapedCells(seats, getCell, classroomId);
    const groups = groupByShape(
        Object.entries(cells).map(([seat, cell]) => ({
            seatNumber: parseInt(seat, 10),
            tags: cell.shape.tags,
            key: cell.shape.key,
        })),
    );
    if (groups.length === 0) {
        return <p className={modalStyles.evalSettingsNote}>{intl.formatMessage(messages.empty)}</p>;
    }
    return (
        <div className={styles.shapes} data-testid="classroom-eval-shapes">
            <p className={styles.lead}>{intl.formatMessage(messages.lead)}</p>
            <ul className={styles.groups}>
                {groups.map((group, index) => (
                    <ShapeGroup
                        cells={cells}
                        classroomId={classroomId}
                        group={group}
                        index={index}
                        // A new grade from elsewhere resets the chooser (it starts from the grades).
                        key={`${group.key}:${group.seatNumbers.map((s) => cells[s].grade || '').join(',')}`}
                        onSelectSeat={onSelectSeat}
                        onSetSeatsGrade={onSetSeatsGrade}
                    />
                ))}
            </ul>
        </div>
    );
};

TeacherGradingShapes.propTypes = {
    classroomId: PropTypes.string.isRequired,
    getCell: PropTypes.func.isRequired,
    seats: PropTypes.arrayOf(PropTypes.number).isRequired,
    onSelectSeat: PropTypes.func.isRequired,
    onSetSeatsGrade: PropTypes.func.isRequired,
};

export { ShapeDots, ShapeTags, messages as shapeMessages };
export default TeacherGradingShapes;
