/**
 * The 「ゴール」 card of a lesson assignment: 「チャレンジを N つクリア（★ M つはかならず）」, the
 * lessons the challenges come from and, when work is also submitted, that the student then makes
 * their own program and submits it. Sits above the start buttons of the assignment panel and the
 * joined confirmation, and in the teacher's student-view preview (assignmentGoal builds the data).
 */
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { assignmentGoal } from '../../lib/classroom-assignment-goal.js';
import styles from './classroom-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Goal',
        description: 'Title of the goal card of a lesson assignment',
        id: 'gui.classroom.assignmentGoal.title',
    },
    count: {
        defaultMessage: '{target, plural, one {Clear # challenge} other {Clear # challenges}}',
        description: 'Goal card: how many challenges clear the lesson assignment',
        id: 'gui.classroom.assignmentGoal.count',
    },
    required: {
        defaultMessage: '(be sure to do the {required} marked ★)',
        description: 'Goal card: after the count, how many of them are required (★)',
        id: 'gui.classroom.assignmentGoal.required',
    },
    noCount: {
        defaultMessage: 'Go through the lessons and meet the goal',
        description: 'Goal card when the number of challenges is not known',
        id: 'gui.classroom.assignmentGoal.noCount',
    },
    lessons: {
        defaultMessage: 'Lessons: {lessons}',
        description: 'Goal card: the lessons of the assignment challenges',
        id: 'gui.classroom.assignmentGoal.lessons',
    },
    lesson: {
        defaultMessage: 'Lesson {number} “{name}”',
        description: 'Goal card: one lesson in the list',
        id: 'gui.classroom.assignmentGoal.lesson',
    },
    submit: {
        defaultMessage: 'Then make your own program and submit it',
        description: 'Goal card of a lesson assignment that also asks for a work submission',
        id: 'gui.classroom.assignmentGoal.submit',
    },
    cleared: {
        defaultMessage: 'Then the assignment is cleared!',
        description: 'Goal card of a lesson assignment without a work submission',
        id: 'gui.classroom.assignmentGoal.cleared',
    },
});

/**
 * @param {object} intl - react-intl
 * @param {Array<object>} lessons - assignmentGoal lessons
 * @returns {string} the lessons in one line
 */
const lessonsLine = (intl, lessons) =>
    lessons
        .map((l) => intl.formatMessage(messages.lesson, { number: l.number, name: intl.formatMessage(l.name) }))
        .join(String(intl.locale).startsWith('ja') ? '、' : ', ');

const StudentAssignmentGoal = ({ compact = false, dataTestId = 'classroom-assignment-goal', lesson }) => {
    const intl = useIntl();
    const goal = useMemo(() => assignmentGoal(lesson), [lesson]);
    const isJapanese = String(intl.locale).startsWith('ja');
    if (!goal) return null;
    return (
        <section
            aria-labelledby={`${dataTestId}-title`}
            className={compact ? `${styles.assignmentGoal} ${styles.assignmentGoalCompact}` : styles.assignmentGoal}
            data-testid={dataTestId}
        >
            <h3 className={styles.assignmentGoalTitle} id={`${dataTestId}-title`}>
                {intl.formatMessage(messages.title)}
            </h3>
            <div className={styles.assignmentGoalBody}>
                <p className={styles.assignmentGoalCount} data-testid={`${dataTestId}-count`}>
                    {goal.target > 0 ? (
                        <>
                            {intl.formatMessage(messages.count, { target: goal.target })}
                            {/* 「（★ …）」 follows the count directly in Japanese, after a space in English */}
                            {goal.required > 0 && !isJapanese && ' '}
                            {goal.required > 0 && (
                                <span>{intl.formatMessage(messages.required, { required: goal.required })}</span>
                            )}
                        </>
                    ) : (
                        intl.formatMessage(messages.noCount)
                    )}
                </p>
                {!compact && goal.lessons.length > 0 && (
                    <p className={styles.assignmentGoalLessons} data-testid={`${dataTestId}-lessons`}>
                        {intl.formatMessage(messages.lessons, { lessons: lessonsLine(intl, goal.lessons) })}
                    </p>
                )}
                <p className={styles.assignmentGoalNext} data-testid={`${dataTestId}-next`}>
                    {intl.formatMessage(goal.submitWork ? messages.submit : messages.cleared)}
                </p>
            </div>
        </section>
    );
};

StudentAssignmentGoal.propTypes = {
    // one line (the count and the next step side by side, no lessons): the assignment panel, where a long
    // page with an image must still fit 1300x600 with the start buttons (the lessons library shows the lessons)
    compact: PropTypes.bool,
    // data-testid of the card (its parts are `<dataTestId>-count` / `-lessons` / `-next`)
    dataTestId: PropTypes.string,
    // the lesson setting (normalizeAssignmentLesson, or the teacher's draft)
    lesson: PropTypes.shape({
        challengeIds: PropTypes.arrayOf(PropTypes.string),
        submitWork: PropTypes.bool,
    }),
};

export default StudentAssignmentGoal;
