/**
 * 「確認が必要な課題」の帯（クラス一覧の上・EPIC #1956 Q4・#1959）。Google Classroom のホームの
 * 「最近期限超過」にあたる。返却していない提出がある課題を、クラス名・課題名・数と
 * ［採点を開く］で並べる。
 *
 * 課題の一覧の API は提出の数を返さないので、授業日が最近の課題だけを選んで提出の一覧を問い合わせて
 * 数える（`reviewCandidates` / `countUnreturned`。API は変えない）。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { reviewCandidates } from '../../lib/classroom-class-list-summary.js';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';

/** 帯に並べる課題の数の上限（1 行に収めるため）。 */
const MAX_SHOWN = 3;

/**
 * 候補の課題の返却していない提出の数を、問い合わせて集める。
 * @param {Array<{classroom: object, group: object}>} candidates - 数える課題
 * @param {?Function} onLoadUnreturnedCount - (classroomId) => Promise<number|null>
 * @returns {?object} classroomId → 数（null = 取れなかった）。問い合わせ中は null
 */
const useUnreturnedCounts = (candidates, onLoadUnreturnedCount) => {
    const [counts, setCounts] = useState(null);
    // 一覧が再読み込みされても、同じ課題なら問い合わせ直さない。
    const key = candidates.map((c) => c.classroom.classroomId).join(',');
    useEffect(() => {
        if (!onLoadUnreturnedCount || !key) {
            setCounts({});
            return () => {};
        }
        let cancelled = false;
        setCounts(null);
        const ids = key.split(',');
        Promise.all(ids.map((id) => Promise.resolve(onLoadUnreturnedCount(id)).catch(() => null))).then((values) => {
            if (cancelled) return;
            const next = {};
            ids.forEach((id, i) => {
                next[id] = values[i];
            });
            setCounts(next);
        });
        return () => {
            cancelled = true;
        };
    }, [key, onLoadUnreturnedCount]);
    return counts;
};

/**
 * One item of the band.
 * @param {object} props - component props
 * @param {object} props.classroom - the assignment
 * @param {number} props.count - unreturned submissions
 * @param {object} props.group - its class
 * @param {boolean} props.isLoading - whether a request is in flight
 * @param {Function} props.onOpen - opens grading of the class
 * @returns {React.ReactElement} the item
 */
const ReviewItem = ({ classroom, count, group, isLoading, onOpen }) => {
    const handleOpen = useCallback(() => onOpen(group), [onOpen, group]);
    const id = classroom.classroomId;
    return (
        <li className={styles.reviewBandItem} data-testid={`classroom-review-item-${id}`}>
            <span className={styles.reviewBandName} title={`${group.name}・${classroom.assignmentName || ''}`}>
                <b>{group.name}</b>
                {'・'}
                {classroom.assignmentName || classroom.className}
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
                    defaultMessage="Open grading"
                    description="Button in the needs-review band that opens grading of the class"
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
 * The band. Hidden when no assignment had a lesson recently (nothing to look at) or when
 * grading is not available.
 * @param {object} props - component props
 * @param {Array<object>} props.classrooms - the teacher's assignments (active)
 * @param {Array<object>} props.groups - the teacher's classes
 * @param {boolean} props.isLoading - whether a request is in flight
 * @param {?Function} props.onLoadUnreturnedCount - (classroomId) => Promise<number|null>
 * @param {?Function} props.onShowEvaluation - opens grading of a class
 * @returns {?React.ReactElement} the band
 */
const TeacherReviewBand = ({ classrooms, groups, isLoading, onLoadUnreturnedCount, onShowEvaluation }) => {
    // 「最近」は一覧を開いたときの日付で決める（開いている間に日付が変わっても選び直さない）。
    const [now] = useState(() => Date.now());
    const candidates = onShowEvaluation ? reviewCandidates(classrooms, groups, now) : [];
    const counts = useUnreturnedCounts(candidates, onShowEvaluation ? onLoadUnreturnedCount : null);
    if (candidates.length === 0 || !onLoadUnreturnedCount) return null;

    const items = counts
        ? candidates
              .filter(
                  (c) => typeof counts[c.classroom.classroomId] === 'number' && counts[c.classroom.classroomId] > 0,
              )
              .map((c) => ({ ...c, count: counts[c.classroom.classroomId] }))
        : [];
    const shown = items.slice(0, MAX_SHOWN);
    const more = items.length - shown.length;

    let body;
    if (!counts) {
        body = (
            <span className={styles.reviewBandMuted} role="status">
                <FormattedMessage
                    defaultMessage="Checking…"
                    description="Shown in the needs-review band while the submissions are being counted"
                    id="gui.classroom.classList.reviewChecking"
                />
            </span>
        );
    } else if (shown.length === 0) {
        body = (
            <span className={styles.reviewBandMuted} data-testid="classroom-review-none">
                <FormattedMessage
                    defaultMessage="Every submission from recent lessons has been returned."
                    description="Needs-review band when nothing waits to be returned"
                    id="gui.classroom.classList.reviewNone"
                />
            </span>
        );
    } else {
        body = (
            <ul className={styles.reviewBandList}>
                {shown.map((c) => (
                    <ReviewItem
                        key={c.classroom.classroomId}
                        classroom={c.classroom}
                        count={c.count}
                        group={c.group}
                        isLoading={isLoading}
                        onOpen={onShowEvaluation}
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
        );
    }

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
            {body}
        </section>
    );
};

TeacherReviewBand.propTypes = {
    classrooms: PropTypes.arrayOf(PropTypes.object).isRequired,
    groups: PropTypes.arrayOf(PropTypes.object).isRequired,
    isLoading: PropTypes.bool,
    onLoadUnreturnedCount: PropTypes.func,
    onShowEvaluation: PropTypes.func,
};

export default TeacherReviewBand;
