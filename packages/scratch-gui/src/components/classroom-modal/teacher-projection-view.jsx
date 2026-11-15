/**
 * The［⛶ 映す］screen of an assignment (#1956 Q9・Q13): what the teacher puts on the
 * projector at the start of a lesson. Only the join code, the seats and the numbers
 * of joined / submitted (cleared for a lesson), large enough to read from the back of
 * the classroom (`$font-size-projection-*`). Students' names are never shown — a seat
 * is its number only.
 *
 * It is drawn over the whole page (portal) while the assignment detail stays mounted
 * underneath, so the detail's 30-second refresh keeps changing the seats here too.
 * Esc and［閉じる］go back. The stream's［⛶ 全画面で映す］opens the same screen.
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { summarizeAssignmentRow } from '../../lib/classroom-assignment-utils.js';
import { formatClassLabel } from '../../lib/classroom-class-label.js';
import { SEAT_STATES, clearedSummary, seatMemberId } from '../../lib/classroom-lesson-progress.js';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';
import SeatColorLegend, {
    LESSON_SEAT_COLOR_ITEMS,
    MEMBER_SEAT_COLOR_ITEMS,
    SEAT_COLOR_MARKS,
    memberSeatColorKind,
} from './seat-color-legend.jsx';

export const projectionMessages = defineMessages({
    open: {
        defaultMessage: 'Project',
        description:
            'Button right of the assignment detail tabs: shows the join code and the seats large for the projector',
        id: 'gui.classroom.projection.open',
    },
    title: {
        defaultMessage: 'Screen for the projector',
        description: 'Accessible name of the projector screen (join code, seats and counts)',
        id: 'gui.classroom.projection.title',
    },
    close: {
        defaultMessage: 'Close',
        description: 'Button that closes the projector screen and goes back to the assignment',
        id: 'gui.classroom.projection.close',
    },
    hint: {
        defaultMessage: 'Choose "Class" in the menu and type this code',
        description: 'Projector screen: how students join, under the join code',
        id: 'gui.classroom.projection.hint',
    },
    joined: {
        defaultMessage: 'Joined {joined} / {capacity}',
        description: 'Projector screen: students who joined, of the seats',
        id: 'gui.classroom.projection.joined',
    },
    submitted: {
        defaultMessage: 'Submitted {count}',
        description: 'Projector screen: students who submitted',
        id: 'gui.classroom.projection.submitted',
    },
    cleared: {
        defaultMessage: 'Cleared {count}',
        description: 'Projector screen of a lesson assignment: students who cleared the lesson',
        id: 'gui.classroom.projection.cleared',
    },
});

// The colour of a lesson seat: the lesson state, with「未参加」as the empty seat.
const lessonSeatKind = (tile) => (tile.state === SEAT_STATES.NOT_JOINED ? 'empty' : tile.state);

const SEAT_CLASSES = {
    empty: 'projectionSeatEmpty',
    joined: 'projectionSeatJoined',
    submitted: 'projectionSeatSubmitted',
    returned: 'projectionSeatReturned',
    notStarted: 'projectionSeatNotStarted',
    inProgress: 'projectionSeatJoined',
    cleared: 'projectionSeatSubmitted',
};

/**
 * The colour of each seat (1 … studentCount) of the screen.
 * @param {object} params - inputs
 * @param {number} params.studentCount - the number of seats
 * @param {object} params.memberMap - memberId → member record
 * @param {?Array<object>} params.lessonTiles - lesson seat tiles (lesson assignments), else null
 * @returns {Array<{number: number, kind: string}>} the seats in order
 */
const projectionSeats = ({ studentCount, memberMap, lessonTiles }) =>
    Array.from({ length: studentCount }, (_, i) => ({
        number: i + 1,
        kind:
            lessonTiles && lessonTiles[i]
                ? lessonSeatKind(lessonTiles[i])
                : memberSeatColorKind(memberMap[seatMemberId(i + 1)] || null),
    }));

const TeacherProjectionView = ({ classroom, group, lessonTiles, members, submitsWork, onClose }) => {
    const intl = useIntl();
    // Esc goes back to the assignment only (stopped here so it does not close the modal too).
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            e.preventDefault();
            onClose();
        };
        document.addEventListener('keydown', handleKey, true);
        return () => document.removeEventListener('keydown', handleKey, true);
    }, [onClose]);

    const memberMap = React.useMemo(() => {
        const map = {};
        for (const m of members) map[m.memberId] = m;
        return map;
    }, [members]);
    const studentCount = classroom.studentCount || 0;
    const seats = projectionSeats({ studentCount, memberMap, lessonTiles });
    const summary = summarizeAssignmentRow({ members, studentCount });
    const cleared = lessonTiles ? clearedSummary(lessonTiles).cleared : null;
    const showSubmitted = !lessonTiles || submitsWork;
    const className = group ? formatClassLabel(group) : classroom.className;

    return ReactDOM.createPortal(
        <div
            aria-label={intl.formatMessage(projectionMessages.title)}
            aria-modal="true"
            className={styles.projection}
            data-testid="classroom-projection"
            role="dialog"
        >
            <div className={styles.projectionHeader}>
                <span className={styles.projectionTitle} data-testid="classroom-projection-title">
                    {classroom.assignmentName ? `${className} › ${classroom.assignmentName}` : className}
                </span>
                {/* The teacher is looking at the projector: the focus starts here so Enter goes back. */}
                <ClassroomButton autoFocus dataTestId="classroom-projection-close" onClick={onClose}>
                    <FormattedMessage {...projectionMessages.close} />
                </ClassroomButton>
            </div>
            <div className={styles.projectionTop}>
                <div className={styles.projectionCodeBlock}>
                    <span className={styles.projectionLabel}>
                        <FormattedMessage
                            defaultMessage="Join Code"
                            description="Join code label"
                            id="gui.classroom.joinCode.label"
                        />
                    </span>
                    <span className={styles.projectionCode} data-testid="classroom-projection-code">
                        {String(classroom.joinCode || '').toLowerCase()}
                    </span>
                    <span className={styles.projectionHint}>
                        <FormattedMessage {...projectionMessages.hint} />
                    </span>
                </div>
                <div className={styles.projectionCounts} data-testid="classroom-projection-counts">
                    <span
                        className={classNames(styles.projectionCount, styles.projectionCountJoined)}
                        data-testid="classroom-projection-joined"
                    >
                        <FormattedMessage
                            {...projectionMessages.joined}
                            values={{ joined: summary.joined, capacity: summary.capacity }}
                        />
                    </span>
                    {lessonTiles ? (
                        <span
                            className={classNames(styles.projectionCount, styles.projectionCountDone)}
                            data-testid="classroom-projection-cleared"
                        >
                            <FormattedMessage {...projectionMessages.cleared} values={{ count: cleared }} />
                        </span>
                    ) : null}
                    {showSubmitted ? (
                        <span
                            className={classNames(styles.projectionCount, styles.projectionCountDone)}
                            data-testid="classroom-projection-submitted"
                        >
                            <FormattedMessage
                                {...projectionMessages.submitted}
                                values={{ count: summary.submitted }}
                            />
                        </span>
                    ) : null}
                </div>
            </div>
            <SeatColorLegend
                className={styles.projectionLegend}
                items={lessonTiles ? LESSON_SEAT_COLOR_ITEMS : MEMBER_SEAT_COLOR_ITEMS}
                testId="classroom-projection-legend"
            />
            <div
                className={styles.projectionSeats}
                data-testid="classroom-projection-seats"
                style={{ gridTemplateRows: `repeat(${Math.max(1, Math.ceil(studentCount / 10))}, 1fr)` }}
            >
                {seats.map((seat) => (
                    <span
                        className={classNames(styles.projectionSeat, styles[SEAT_CLASSES[seat.kind]])}
                        data-seat-color={seat.kind}
                        data-testid={`classroom-projection-seat-${seat.number}`}
                        key={seat.number}
                    >
                        {seat.number}
                        {SEAT_COLOR_MARKS[seat.kind] ? (
                            <span aria-hidden="true" className={styles.projectionSeatMark}>
                                {SEAT_COLOR_MARKS[seat.kind]}
                            </span>
                        ) : null}
                    </span>
                ))}
            </div>
        </div>,
        document.body,
    );
};

TeacherProjectionView.propTypes = {
    /** The assignment (joinCode, studentCount, assignmentName, className). */
    classroom: PropTypes.object.isRequired,
    /** The class it belongs to (for「技術 2026年度 2年1組」); null for old data. */
    group: PropTypes.object,
    /** Lesson seat tiles (`seatTile`) of a lesson assignment; null for an ordinary one. */
    lessonTiles: PropTypes.arrayOf(PropTypes.shape({ state: PropTypes.string.isRequired })),
    members: PropTypes.arrayOf(PropTypes.object).isRequired,
    /** A lesson assignment that also takes the work (shows「提出」too). */
    submitsWork: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
};

export { lessonSeatKind, projectionSeats };
export default TeacherProjectionView;
