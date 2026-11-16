/**
 * 「確認が必要な課題」の帯（クラス一覧の上・EPIC #1956 Q4・#1959）。Google Classroom のホームの
 * 「最近期限超過」にあたる。返却していない提出がある課題を、クラス名・課題名・数と［開く］で並べる。
 *
 * 数は課題の一覧の各課題の `unreturnedCount`（#1972）。提出の一覧は問い合わせない。
 * `unreturnedCount` を返さない古い API では数がそろわないので、帯を出さない（`reviewItems` が null）。
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage } from 'react-intl';
import { reviewItems } from '../../lib/classroom-class-list-summary.js';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';

/** 帯に並べる課題の数の上限（1 行に収めるため）。 */
const MAX_SHOWN = 3;

/**
 * One item of the band.
 * @param {object} props - component props
 * @param {object} props.classroom - the assignment
 * @param {number} props.count - unreturned submissions
 * @param {object} props.group - its class
 * @param {boolean} props.isLoading - whether a request is in flight
 * @param {Function} props.onOpen - opens the assignment (its members, where submissions are returned)
 * @returns {React.ReactElement} the item
 */
const ReviewItem = ({ classroom, count, group, isLoading, onOpen }) => {
    const id = classroom.classroomId;
    const handleOpen = useCallback(() => onOpen(id), [onOpen, id]);
    const assignmentName = classroom.assignmentName || classroom.className || '';
    return (
        <li className={styles.reviewBandItem} data-testid={`classroom-review-item-${id}`}>
            <span className={styles.reviewBandName} title={`${group.name}・${assignmentName}`}>
                <b>{group.name}</b>
                {'・'}
                {assignmentName}
            </span>
            <span className={styles.reviewBandCount}>
                <FormattedMessage
                    defaultMessage="Not returned {count}"
                    description="Number of submissions not returned yet, in the needs-review band of the class list"
                    id="gui.classroom.classList.reviewUnreturned"
                    values={{ count }}
                />
            </span>
            <ClassroomButton
                className={styles.reviewBandOpen}
                dataTestId={`classroom-review-open-${id}`}
                disabled={isLoading}
                variant="text"
                onClick={handleOpen}
            >
                <FormattedMessage
                    defaultMessage="Open"
                    description="Button in the needs-review band that opens the assignment's members, where submissions are returned"
                    id="gui.classroom.classList.reviewOpen"
                />
            </ClassroomButton>
        </li>
    );
};

ReviewItem.propTypes = {
    classroom: PropTypes.object.isRequired,
    count: PropTypes.number.isRequired,
    group: PropTypes.object.isRequired,
    isLoading: PropTypes.bool,
    onOpen: PropTypes.func.isRequired,
};

/**
 * The band. Hidden when the counts are not all there (an older API) or there is no assignment.
 * @param {object} props - component props
 * @param {Array<object>} props.classrooms - the teacher's assignments (`GET /classrooms`)
 * @param {Array<object>} props.groups - the teacher's classes
 * @param {boolean} props.isLoading - whether a request is in flight
 * @param {?Function} props.onOpenAssignment - (classroomId) opens the assignment's members
 * @returns {?React.ReactElement} the band
 */
const TeacherReviewBand = ({ classrooms, groups, isLoading, onOpenAssignment }) => {
    const items = onOpenAssignment ? reviewItems(classrooms, groups) : null;
    if (!items) return null;
    const shown = items.slice(0, MAX_SHOWN);
    const more = items.length - shown.length;

    return (
        <section
            aria-labelledby="classroom-review-title"
            className={styles.reviewBand}
            data-testid="classroom-review-band"
        >
            <h3 className={styles.reviewBandTitle} id="classroom-review-title">
                <FormattedMessage
                    defaultMessage="Needs review"
                    description="Title of the band above the class cards listing assignments with submissions not returned"
                    id="gui.classroom.classList.reviewTitle"
                />
            </h3>
            {shown.length === 0 ? (
                <span className={styles.reviewBandMuted} data-testid="classroom-review-none">
                    <FormattedMessage
                        defaultMessage="Every submission has been returned."
                        description="Needs-review band when no assignment has a submission waiting to be returned"
                        id="gui.classroom.classList.reviewNone"
                    />
                </span>
            ) : (
                <ul className={styles.reviewBandList}>
                    {shown.map((c) => (
                        <ReviewItem
                            key={c.classroom.classroomId}
                            classroom={c.classroom}
                            count={c.count}
                            group={c.group}
                            isLoading={isLoading}
                            onOpen={onOpenAssignment}
                        />
                    ))}
                    {more > 0 ? (
                        <li className={styles.reviewBandMuted}>
                            <FormattedMessage
                                defaultMessage="+{count} more"
                                description="How many more assignments need review than the band shows"
                                id="gui.classroom.classList.reviewMore"
                                values={{ count: more }}
                            />
                        </li>
                    ) : null}
                </ul>
            )}
        </section>
    );
};

TeacherReviewBand.propTypes = {
    classrooms: PropTypes.arrayOf(PropTypes.object).isRequired,
    groups: PropTypes.arrayOf(PropTypes.object).isRequired,
    isLoading: PropTypes.bool,
    onOpenAssignment: PropTypes.func,
};

export default TeacherReviewBand;
