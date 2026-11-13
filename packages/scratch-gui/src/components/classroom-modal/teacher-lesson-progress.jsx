import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    CELL_KINDS,
    SORT_ORDERS,
    challengeHeadText,
    columnTotals,
    progressTableRows,
    sortProgressRows,
} from '../../lib/classroom-lesson-progress.js';
import { DEFAULT_MODE, getColorsForMode } from '../../lib/settings/color-mode';
import styles from './classroom-modal.css';
import { lessonSeatMessages } from './lesson-seat-tile.jsx';

const messages = defineMessages({
    done: {
        defaultMessage: 'Done',
        description: 'Lesson progress table legend: ✓ = the challenge is done',
        id: 'gui.classroom.lessonProgress.legendDone',
    },
    before: {
        defaultMessage: 'Done before',
        description: 'Lesson progress table legend:「前」= done before the assignment started',
        id: 'gui.classroom.lessonProgress.legendBefore',
    },
    current: {
        defaultMessage: 'Now',
        description: 'Lesson progress table legend: ▶ = the student is on this challenge now',
        id: 'gui.classroom.lessonProgress.legendCurrent',
    },
    stuck: {
        defaultMessage: '10+ min',
        description: 'Lesson progress table legend: ! = on this challenge for 10 minutes or more',
        id: 'gui.classroom.lessonProgress.legendStuck',
    },
    todo: {
        defaultMessage: 'Not yet',
        description: 'Lesson progress table legend: ・ = not done yet',
        id: 'gui.classroom.lessonProgress.legendTodo',
    },
    required: {
        defaultMessage: '★ Required',
        description: 'Lesson progress table legend: ★ in a column header = a required challenge',
        id: 'gui.classroom.lessonProgress.legendRequired',
    },
    sortLabel: {
        defaultMessage: 'Sort',
        description: 'Label of the sort order selector of the lesson progress table',
        id: 'gui.classroom.lessonProgress.sortLabel',
    },
    sortSeat: {
        defaultMessage: 'By seat',
        description: 'Sort order of the lesson progress table: seat number',
        id: 'gui.classroom.lessonProgress.sortSeat',
    },
    sortProgress: {
        defaultMessage: 'Most done first',
        description: 'Sort order of the lesson progress table: most challenges done first',
        id: 'gui.classroom.lessonProgress.sortProgress',
    },
    sortStuck: {
        defaultMessage: 'Longest on a challenge first',
        description: 'Sort order of the lesson progress table: longest time on the current challenge first',
        id: 'gui.classroom.lessonProgress.sortStuck',
    },
    seat: {
        defaultMessage: 'Seat',
        description: 'Header of the seat column of the lesson progress table',
        id: 'gui.classroom.lessonProgress.seat',
    },
    doneCount: {
        defaultMessage: 'Done',
        description: 'Header of the「done / condition」column of the lesson progress table',
        id: 'gui.classroom.lessonProgress.doneCount',
    },
    state: {
        defaultMessage: 'State',
        description: 'Header of the state column (cleared / in progress / not started) of the lesson progress table',
        id: 'gui.classroom.lessonProgress.state',
    },
    totalsRow: {
        defaultMessage: 'Done by',
        description: 'Label of the header row with how many students did each challenge',
        id: 'gui.classroom.lessonProgress.totalsRow',
    },
    totalsTitle: {
        defaultMessage: '{done} of {rows} did it · {current} on it now (small blue number)',
        description: 'Tooltip of a cell of the「done by」row of the lesson progress table',
        id: 'gui.classroom.lessonProgress.totalsTitle',
    },
    clearedCount: {
        defaultMessage: 'Cleared {count}',
        description: 'The「done by」row: how many students cleared the assignment',
        id: 'gui.classroom.lessonProgress.clearedCount',
    },
    lessonLabel: {
        defaultMessage: 'Lesson {number}',
        description: 'Lesson group header of the lesson progress table',
        id: 'gui.classroom.lessonProgress.lessonLabel',
    },
    stateCleared: {
        defaultMessage: 'Cleared',
        description: 'Lesson progress table state: the assignment is cleared',
        id: 'gui.classroom.lessonProgress.stateCleared',
    },
    stateInProgress: {
        defaultMessage: 'In progress',
        description: 'Lesson progress table state: some challenges done',
        id: 'gui.classroom.lessonProgress.stateInProgress',
    },
    stateNotStarted: {
        defaultMessage: 'Not started',
        description: 'Lesson progress table state: no challenge done yet',
        id: 'gui.classroom.lessonProgress.stateNotStarted',
    },
    leftSeat: {
        defaultMessage: 'Left',
        description: 'Lesson progress table: the student of this row has left the seat (the record stays)',
        id: 'gui.classroom.lessonProgress.leftSeat',
    },
    empty: {
        defaultMessage: 'No student has joined yet',
        description: 'Lesson progress table: no row to show',
        id: 'gui.classroom.lessonProgress.empty',
    },
    unknownCourse: {
        defaultMessage: "This course isn't in this version of Smalruby, so its progress can't be shown.",
        description: 'Lesson progress tab: the course of the assignment does not exist here',
        id: 'gui.classroom.lessonProgress.unknownCourse',
    },
    minutes: {
        defaultMessage: '{minutes} min',
        description: 'Tooltip of a ▶ / ! cell of the lesson progress table: minutes on the challenge',
        id: 'gui.classroom.lessonProgress.minutes',
    },
});

const CELL_SYMBOLS = {
    [CELL_KINDS.DONE]: '✓',
    [CELL_KINDS.BEFORE]: '前',
    [CELL_KINDS.CURRENT]: '▶',
    [CELL_KINDS.STUCK]: '!',
    [CELL_KINDS.TODO]: '・',
};

const CELL_CLASSES = {
    [CELL_KINDS.DONE]: 'lessonCellDone',
    [CELL_KINDS.BEFORE]: 'lessonCellBefore',
    [CELL_KINDS.CURRENT]: 'lessonCellCurrent',
    [CELL_KINDS.STUCK]: 'lessonCellStuck',
    [CELL_KINDS.TODO]: 'lessonCellTodo',
};

const LEGEND = [
    [CELL_KINDS.DONE, messages.done],
    [CELL_KINDS.BEFORE, messages.before],
    [CELL_KINDS.CURRENT, messages.current],
    [CELL_KINDS.STUCK, messages.stuck],
    [CELL_KINDS.TODO, messages.todo],
];

const SORT_MESSAGES = { seat: messages.sortSeat, progress: messages.sortProgress, stuck: messages.sortStuck };

// The challenge colour band = the card colour of the lessons library (the
// most used block category, `challenge.card.category`). Same keys as the
// library's CATEGORY_STYLES (lessons-library.jsx).
const CATEGORY_COLOR_KEYS = {
    motion: 'motion',
    looks: 'looks',
    sound: 'sounds',
    events: 'event',
    control: 'control',
    sensing: 'sensing',
    operators: 'operators',
    variables: 'data',
    lists: 'data_lists',
    extensions: 'pen',
};

const bandColor = (challenge) => {
    const key = challenge.card && CATEGORY_COLOR_KEYS[challenge.card.category];
    const colors = key && getColorsForMode(DEFAULT_MODE)[key];
    return colors ? colors.colourPrimary : null;
};

const STATE_CLASSES = {
    cleared: 'lessonStateCleared',
    inProgress: 'lessonStateInProgress',
    notStarted: 'lessonStateNotStarted',
};

const STATE_MESSAGES = {
    cleared: messages.stateCleared,
    inProgress: messages.stateInProgress,
    notStarted: messages.stateNotStarted,
};

/**
 * The 「進み具合」 tab of a lesson assignment (#1602): seat × challenge table.
 * The header (vertical challenge names and the 「できた人」 row, whose top
 * line is the challenge colour; lessons are separated by a line) and the seat
 * column stay fixed; only the seat rows scroll inside the table frame. The
 * header is kept low so 12+ seat rows show at 1300×600 (#1767 M1).
 * @param {object} props - component props
 * @param {?object} props.ctx - lessonProgressContext (null when the course is unknown here)
 * @param {string} [props.status] - 'loading' | 'error' (first fetch) | 'ready'
 * @param {Array<object>} props.members - members of the assignment
 * @param {object} props.rowsByMember - progressRowsByMember of the fetched progress
 * @param {number} props.studentCount - number of seats
 * @param {?string} props.selectedMember - selected member id
 * @param {Function} props.onSelectSeat - called with the member id when a seat is pressed
 *   (the seat detail on the right; its lesson contents come with #1603)
 * @param {number} [props.now] - current time (ms epoch; tests)
 * @returns {React.ReactElement} the tab
 */
const TeacherLessonProgress = ({
    ctx,
    status,
    members,
    rowsByMember,
    studentCount,
    selectedMember,
    onSelectSeat,
    now,
}) => {
    const intl = useIntl();
    const [order, setOrder] = useState('seat');
    const handleOrderChange = useCallback((e) => setOrder(e.target.value), []);
    const handleSeatClick = useCallback(
        (e) => {
            const memberId = e.currentTarget.dataset.memberId;
            if (memberId && onSelectSeat) onSelectSeat(memberId);
        },
        [onSelectSeat],
    );
    const at = typeof now === 'number' ? now : Date.now();
    const rows = useMemo(
        () => (ctx ? progressTableRows(members, rowsByMember, studentCount, ctx, at) : []),
        [ctx, members, rowsByMember, studentCount, at],
    );
    const sorted = useMemo(() => sortProgressRows(rows, order), [rows, order]);

    if (status === 'loading' || status === 'error') {
        return (
            <p className={styles.lessonProgressNotice} data-testid={`classroom-lesson-progress-${status}`}>
                {intl.formatMessage(status === 'loading' ? lessonSeatMessages.loading : lessonSeatMessages.loadError)}
            </p>
        );
    }

    if (!ctx) {
        return (
            <p className={styles.lessonProgressNotice} data-testid="classroom-lesson-progress-unknown-course">
                {intl.formatMessage(messages.unknownCourse)}
            </p>
        );
    }

    const totals = columnTotals(rows, ctx);
    const clearedCount = rows.filter((r) => r.progress.cleared).length;
    const extraColumns = 2;

    return (
        <div className={styles.lessonProgress} data-testid="classroom-lesson-progress">
            <div className={styles.lessonProgressToolbar}>
                <div className={styles.lessonProgressLegend} data-testid="classroom-lesson-progress-legend">
                    {LEGEND.map(([kind, message]) => (
                        <span className={styles.statusLegendItem} key={kind}>
                            <span className={classNames(styles.lessonCell, styles[CELL_CLASSES[kind]])}>
                                {CELL_SYMBOLS[kind]}
                            </span>
                            {intl.formatMessage(message)}
                        </span>
                    ))}
                    <span className={classNames(styles.statusLegendItem, styles.lessonRequiredMark)}>
                        {intl.formatMessage(messages.required)}
                    </span>
                </div>
                <label className={styles.lessonProgressSort}>
                    {intl.formatMessage(messages.sortLabel)}
                    {': '}
                    <select data-testid="classroom-lesson-progress-sort" value={order} onChange={handleOrderChange}>
                        {SORT_ORDERS.map((o) => (
                            <option key={o} value={o}>
                                {intl.formatMessage(SORT_MESSAGES[o])}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {/* Only this frame scrolls (the seats are a list: R6 exception). */}
            <div className={styles.lessonProgressFrame} data-testid="classroom-lesson-progress-frame">
                <table className={styles.lessonProgressTable}>
                    <thead>
                        <tr>
                            <th className={styles.lessonProgressSeatCol}>{intl.formatMessage(messages.seat)}</th>
                            {ctx.columns.map((column) => {
                                const name = intl.formatMessage(column.challenge.name);
                                const lessonLabel = `${intl.formatMessage(messages.lessonLabel, {
                                    number: column.lessonIndex + 1,
                                })} ${intl.formatMessage(column.lesson.name)}`;
                                const label = `${column.lessonIndex + 1}-${column.challenge.number} ${name}（${lessonLabel}）`;
                                return (
                                    <th
                                        className={classNames(
                                            styles.lessonProgressChallengeHead,
                                            column.lessonStart && styles.lessonProgressLessonStart,
                                        )}
                                        data-testid={`classroom-lesson-progress-head-${column.id}`}
                                        key={column.id}
                                        title={column.required ? `★ ${label}` : label}
                                    >
                                        <span
                                            className={classNames(
                                                styles.lessonProgressChallengeName,
                                                column.required && styles.lessonRequiredMark,
                                            )}
                                        >
                                            {challengeHeadText(column, name, intl.locale)}
                                        </span>
                                    </th>
                                );
                            })}
                            <th className={styles.lessonProgressBottomHead}>
                                {intl.formatMessage(messages.doneCount)}
                            </th>
                            <th className={styles.lessonProgressBottomHead}>{intl.formatMessage(messages.state)}</th>
                        </tr>
                        <tr className={styles.lessonProgressTotalsRow} data-testid="classroom-lesson-progress-totals">
                            <th className={styles.lessonProgressSeatCol}>{intl.formatMessage(messages.totalsRow)}</th>
                            {ctx.columns.map((column) => {
                                // The challenge colour band is the line above this cell.
                                const color = bandColor(column.challenge);
                                return (
                                    <th
                                        className={classNames(column.lessonStart && styles.lessonProgressLessonStart)}
                                        data-testid={`classroom-lesson-progress-total-${column.id}`}
                                        key={column.id}
                                        style={color ? { borderTopColor: color } : null}
                                        title={intl.formatMessage(messages.totalsTitle, {
                                            done: totals[column.id].done,
                                            rows: rows.length,
                                            current: totals[column.id].current,
                                        })}
                                    >
                                        <span className={styles.lessonProgressTotalDone}>
                                            {totals[column.id].done}
                                        </span>
                                        {totals[column.id].current > 0 ? (
                                            <sup
                                                className={styles.lessonProgressTotalCurrent}
                                                data-testid={`classroom-lesson-progress-current-${column.id}`}
                                            >
                                                {totals[column.id].current}
                                            </sup>
                                        ) : null}
                                    </th>
                                );
                            })}
                            <th colSpan={extraColumns}>
                                {intl.formatMessage(messages.clearedCount, { count: clearedCount })}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 ? (
                            <tr>
                                <td
                                    className={styles.lessonProgressEmpty}
                                    colSpan={ctx.columns.length + 1 + extraColumns}
                                >
                                    {intl.formatMessage(messages.empty)}
                                </td>
                            </tr>
                        ) : null}
                        {sorted.map((row) => (
                            <tr
                                className={classNames(
                                    selectedMember === row.memberId && styles.lessonProgressSelected,
                                )}
                                data-testid={`classroom-lesson-progress-row-${row.memberId}`}
                                key={row.memberId}
                            >
                                <th className={styles.lessonProgressSeatCol}>
                                    <button
                                        className={styles.lessonProgressSeatButton}
                                        data-member-id={row.memberId}
                                        data-testid={`classroom-lesson-progress-seat-${row.memberId}`}
                                        type="button"
                                        onClick={handleSeatClick}
                                    >
                                        {String(row.seatNumber).padStart(2, '0')}
                                    </button>
                                    {row.joined ? null : (
                                        <span className={styles.lessonProgressLeft}>
                                            {intl.formatMessage(messages.leftSeat)}
                                        </span>
                                    )}
                                </th>
                                {ctx.columns.map((column) => {
                                    const kind = row.progress.cells[column.id];
                                    const current = row.progress.current;
                                    const minutes =
                                        current && current.challengeId === column.id
                                            ? intl.formatMessage(messages.minutes, {
                                                  minutes: Math.floor(current.elapsedMs / 60000),
                                              })
                                            : null;
                                    return (
                                        <td
                                            className={classNames(
                                                column.lessonStart && styles.lessonProgressLessonStart,
                                            )}
                                            key={column.id}
                                        >
                                            <span
                                                className={classNames(styles.lessonCell, styles[CELL_CLASSES[kind]])}
                                                data-kind={kind}
                                                data-testid={`classroom-lesson-progress-cell-${row.memberId}-${column.id}`}
                                                title={minutes}
                                            >
                                                {CELL_SYMBOLS[kind]}
                                            </span>
                                        </td>
                                    );
                                })}
                                <td className={styles.lessonProgressDoneCell}>
                                    {`${row.progress.shown} / ${row.progress.target}`}
                                </td>
                                <td>
                                    <span
                                        className={classNames(
                                            styles.lessonStatePill,
                                            styles[STATE_CLASSES[row.progress.state]],
                                        )}
                                    >
                                        {intl.formatMessage(STATE_MESSAGES[row.progress.state])}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

TeacherLessonProgress.propTypes = {
    ctx: PropTypes.object,
    status: PropTypes.oneOf(['loading', 'error', 'ready']),
    members: PropTypes.arrayOf(PropTypes.object).isRequired,
    now: PropTypes.number,
    rowsByMember: PropTypes.object.isRequired,
    selectedMember: PropTypes.string,
    studentCount: PropTypes.number.isRequired,
    onSelectSeat: PropTypes.func,
};

// The parent re-renders on every keystroke of the assignment name; the table
// only changes with the fetched progress (#1767 FYI1).
export default React.memo(TeacherLessonProgress);
