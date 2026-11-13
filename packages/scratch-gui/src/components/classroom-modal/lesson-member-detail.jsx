import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { CELL_KINDS } from '../../lib/classroom-lesson-progress.js';
import { elapsedMinutes, isSameLocalDay } from '../../lib/classroom-lesson-summary.js';
import styles from './classroom-modal.css';
import { lessonSeatMessages } from './lesson-seat-tile.jsx';

const messages = defineMessages({
    title: {
        defaultMessage: 'Lesson',
        description: 'Seat detail of a lesson assignment: title of the per-challenge list (EPIC #1592)',
        id: 'gui.classroom.lessonDetail.title',
    },
    before: {
        defaultMessage: 'Before {date}',
        description: 'Seat detail of a lesson assignment: the challenge was done before the assignment, on this day',
        id: 'gui.classroom.lessonDetail.before',
    },
    current: {
        defaultMessage: '▶ On it now ({minutes} min)',
        description: 'Seat detail of a lesson assignment: the student is on this challenge now',
        id: 'gui.classroom.lessonDetail.current',
    },
    stuck: {
        defaultMessage: '! On it now ({minutes} min)',
        description: 'Seat detail of a lesson assignment: on this challenge for 10 minutes or more',
        id: 'gui.classroom.lessonDetail.stuck',
    },
    todo: {
        defaultMessage: 'Not yet',
        description: 'Seat detail of a lesson assignment: accessible label of「・」(not done yet)',
        id: 'gui.classroom.lessonDetail.todo',
    },
    required: {
        defaultMessage: 'Required',
        description: 'Seat detail of a lesson assignment: accessible label of ★ (a required challenge)',
        id: 'gui.classroom.lessonDetail.required',
    },
});

/**
 * What a challenge row shows: the time it was done (the date too when it is
 * not today), 「前 11/10」, 「▶ いまやっている（12 分）」 or 「・」.
 * @param {object} intl - react-intl intl object
 * @param {object} row - a seatChallengeDetails row
 * @param {number} now - current time (ms epoch)
 * @returns {string} text
 */
const statusText = (intl, row, now) => {
    if (row.kind === CELL_KINDS.DONE) {
        if (!row.completedAt) return '✓';
        const time = intl.formatTime(row.completedAt, { hour: '2-digit', minute: '2-digit' });
        if (isSameLocalDay(row.completedAt, now)) return time;
        return `${intl.formatDate(row.completedAt, { month: 'numeric', day: 'numeric' })} ${time}`;
    }
    if (row.kind === CELL_KINDS.BEFORE) {
        const date = row.completedAt ? intl.formatDate(row.completedAt, { month: 'numeric', day: 'numeric' }) : '';
        return intl.formatMessage(messages.before, { date }).trim();
    }
    if (row.kind === CELL_KINDS.CURRENT || row.kind === CELL_KINDS.STUCK) {
        const msg = row.kind === CELL_KINDS.STUCK ? messages.stuck : messages.current;
        return intl.formatMessage(msg, { minutes: elapsedMinutes(row.elapsedMs) });
    }
    return '・';
};

const KIND_CLASSES = {
    [CELL_KINDS.DONE]: 'lessonDetailDone',
    [CELL_KINDS.BEFORE]: 'lessonDetailBefore',
    [CELL_KINDS.CURRENT]: 'lessonDetailCurrent',
    [CELL_KINDS.STUCK]: 'lessonDetailStuck',
    [CELL_KINDS.TODO]: 'lessonDetailTodo',
};

/**
 * The lesson part of the seat detail on the right (#1603): 「できた数 / 条件の
 * 数」, ★ の残り and one row per challenge of the setting. Only the list
 * scrolls, so the work part below stays reachable at 1300×600.
 * @param {object} props - component props
 * @param {{progress: object, rows: Array<object>}} props.detail - seatChallengeDetails result
 * @param {number} props.now - current time (ms epoch)
 * @returns {React.ReactElement} the section
 */
const LessonMemberDetail = ({ detail, now }) => {
    const intl = useIntl();
    const { progress, rows } = detail;
    return (
        <div className={styles.lessonDetail} data-testid="classroom-member-lesson-detail">
            <div className={styles.lessonDetailHeader}>
                <span className={styles.lessonDetailTitle}>{intl.formatMessage(messages.title)}</span>
                <span data-testid="classroom-member-lesson-detail-count">
                    {progress.cleared
                        ? intl.formatMessage(lessonSeatMessages.cleared)
                        : `${progress.shown} / ${progress.target}`}
                </span>
                {progress.requiredLeft > 0 ? (
                    <span className={styles.lessonDetailRequiredLeft}>
                        {intl.formatMessage(lessonSeatMessages.requiredLeft, { count: progress.requiredLeft })}
                    </span>
                ) : null}
            </div>
            <ul className={styles.lessonDetailList} data-testid="classroom-member-lesson-detail-list">
                {rows.map((row) => (
                    <li
                        className={classNames(styles.lessonDetailRow, styles[KIND_CLASSES[row.kind]], {
                            [styles.lessonDetailLessonStart]: row.lessonStart,
                        })}
                        data-kind={row.kind}
                        data-testid={`classroom-member-lesson-detail-${row.id}`}
                        key={row.id}
                    >
                        <span className={styles.lessonDetailName} title={intl.formatMessage(row.challenge.name)}>
                            {row.required ? (
                                <span
                                    aria-label={intl.formatMessage(messages.required)}
                                    className={styles.lessonDetailStar}
                                >
                                    {'★'}
                                </span>
                            ) : null}
                            {intl.formatMessage(row.challenge.name)}
                        </span>
                        <span
                            aria-label={row.kind === CELL_KINDS.TODO ? intl.formatMessage(messages.todo) : null}
                            className={styles.lessonDetailStatus}
                        >
                            {statusText(intl, row, now)}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

LessonMemberDetail.propTypes = {
    detail: PropTypes.shape({
        progress: PropTypes.object.isRequired,
        rows: PropTypes.arrayOf(PropTypes.object).isRequired,
    }).isRequired,
    now: PropTypes.number.isRequired,
};

export default LessonMemberDetail;
