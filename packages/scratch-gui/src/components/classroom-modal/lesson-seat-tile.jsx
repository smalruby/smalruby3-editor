import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { SEAT_STATES } from '../../lib/classroom-lesson-progress.js';
import styles from './classroom-modal.css';
import ClassroomStatusIcon from './classroom-status-icon.jsx';

export const lessonSeatMessages = defineMessages({
    notStarted: {
        defaultMessage: 'Not started',
        description: 'Lesson seat colour legend: grey = no challenge done yet',
        id: 'gui.classroom.lessonSeat.notStarted',
    },
    inProgress: {
        defaultMessage: 'In progress',
        description: 'Lesson seat colour legend: blue = some challenges done',
        id: 'gui.classroom.lessonSeat.inProgress',
    },
    cleared: {
        defaultMessage: 'Cleared',
        description: 'Lesson seat colour legend: green = the assignment is cleared',
        id: 'gui.classroom.lessonSeat.cleared',
    },
    notJoined: {
        defaultMessage: 'Not joined yet',
        description: 'Lesson seat colour legend: white with a dotted border = no student in the seat',
        id: 'gui.classroom.lessonSeat.notJoined',
    },
    stuck: {
        defaultMessage: '10+ min on the same challenge',
        description: 'Lesson seat legend: the「!」badge = on the same challenge for 10 minutes or more',
        id: 'gui.classroom.lessonSeat.stuck',
    },
    requiredLeft: {
        defaultMessage: '★ {count} left',
        description: 'On a lesson seat tile: how many required (★) challenges are not done yet',
        id: 'gui.classroom.lessonSeat.requiredLeft',
    },
    progress: {
        defaultMessage: '{done} of {target} done',
        description: 'Accessible label of the「done / condition」count on a lesson seat tile',
        id: 'gui.classroom.lessonSeat.progressLabel',
    },
    loading: {
        defaultMessage: 'Loading the lesson progress…',
        description: 'Members / progress tab of a lesson assignment until the first progress fetch ends',
        id: 'gui.classroom.lessonSeat.loading',
    },
    loadError: {
        defaultMessage: "Couldn't load the lesson progress. It is reloaded every 30 seconds.",
        description: 'Members / progress tab of a lesson assignment: the first progress fetch failed',
        id: 'gui.classroom.lessonSeat.loadError',
    },
    clearedSummary: {
        defaultMessage: 'Cleared {cleared} / Joined {joined}',
        description: 'Members tab of a lesson assignment: how many cleared out of the joined students',
        id: 'gui.classroom.lessonSeat.clearedSummary',
    },
});

/**
 * Inside a seat tile of a lesson assignment (#1602): seat number, 「できた数 /
 * 条件の数」 with a thin bar, ★ の残り and 「!」 for 10 minutes or more on the
 * same challenge. The tile colour itself is set by the caller.
 * @param {object} props - component props
 * @param {number} props.seatNumber - seat number
 * @param {object} props.tile - seatTile() result
 * @param {?string} props.presence - presence icon status
 * @param {?string} props.submission - submission icon status (only when work is submitted too)
 * @returns {React.ReactElement} tile content
 */
const LessonSeatTile = ({ seatNumber, tile, presence, submission }) => {
    const intl = useIntl();
    const progress = tile.progress;
    return (
        <React.Fragment>
            <span className={styles.lessonSeatHead}>
                <span className={styles.memberCellNumber}>{seatNumber}</span>
                {presence ? <ClassroomStatusIcon size={10} status={presence} /> : null}
            </span>
            {tile.state === SEAT_STATES.NOT_JOINED ? null : (
                <React.Fragment>
                    <span
                        aria-label={intl.formatMessage(lessonSeatMessages.progress, {
                            done: progress.shown,
                            target: progress.target,
                        })}
                        className={styles.lessonSeatCount}
                        data-testid={`classroom-lesson-seat-count-${seatNumber}`}
                        role="img"
                    >
                        {`${progress.shown} / ${progress.target}`}
                    </span>
                    <span aria-hidden="true" className={styles.lessonSeatMeter}>
                        <span
                            className={styles.lessonSeatMeterFill}
                            style={{
                                width: `${progress.target > 0 ? Math.round((progress.shown / progress.target) * 100) : 0}%`,
                            }}
                        />
                    </span>
                    {progress.requiredLeft > 0 ? (
                        <span
                            className={styles.lessonSeatRequired}
                            data-testid={`classroom-lesson-seat-required-${seatNumber}`}
                        >
                            {intl.formatMessage(lessonSeatMessages.requiredLeft, { count: progress.requiredLeft })}
                        </span>
                    ) : null}
                    {progress.stuck ? (
                        <span
                            aria-label={intl.formatMessage(lessonSeatMessages.stuck)}
                            className={styles.lessonSeatStuck}
                            data-testid={`classroom-lesson-seat-stuck-${seatNumber}`}
                            role="img"
                            title={intl.formatMessage(lessonSeatMessages.stuck)}
                        >
                            {'!'}
                        </span>
                    ) : null}
                    {submission ? (
                        <span className={styles.lessonSeatSubmission}>
                            <ClassroomStatusIcon badge size={10} status={submission} />
                        </span>
                    ) : null}
                </React.Fragment>
            )}
        </React.Fragment>
    );
};

LessonSeatTile.propTypes = {
    presence: PropTypes.string,
    seatNumber: PropTypes.number.isRequired,
    submission: PropTypes.string,
    tile: PropTypes.shape({
        state: PropTypes.string.isRequired,
        progress: PropTypes.object,
    }).isRequired,
};

export default LessonSeatTile;
