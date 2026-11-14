/**
 * The mark next to the student's class label in the menu bar.
 *
 * An ordinary assignment shows nothing here: the submit button next to the
 * label carries its state (#1795). A lesson
 * assignment (EPIC #1592 / #1599) shows the lesson progress instead:
 * ○ (nothing done yet), "2/4" (done / condition, capped) or ✓ (cleared).
 * When it also asks for a work submission and the work was submitted, the
 * submitted icon follows the ✓ (decided by recommendation).
 */
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import { ASSIGNMENT_MARKS, assignmentMenuMark, assignmentProgress } from '../../lib/lessons/assignment-progress.js';
import { selectStudentLesson } from '../../reducers/classroom.js';
import styles from './classroom-modal.css';
import ClassroomStatusIcon, { getSubmissionStatus } from './classroom-status-icon.jsx';

const messages = defineMessages({
    notStarted: {
        defaultMessage: 'Lesson: not started',
        description: 'Menu bar mark of a lesson assignment: no challenge done yet (shown as ○)',
        id: 'gui.menuBar.classroomLessonNotStarted',
    },
    inProgress: {
        defaultMessage: 'Lesson: {done} of {total} done',
        description: 'Menu bar mark of a lesson assignment in progress (shown as "2/4")',
        id: 'gui.menuBar.classroomLessonInProgress',
    },
    cleared: {
        defaultMessage: 'Lesson: assignment cleared',
        description: 'Menu bar mark of a cleared lesson assignment (shown as ✓)',
        id: 'gui.menuBar.classroomLessonCleared',
    },
});

const LessonMark = ({ mark, status }) => {
    const intl = useIntl();
    let label;
    if (mark.kind === ASSIGNMENT_MARKS.CLEARED) label = intl.formatMessage(messages.cleared);
    else if (mark.kind === ASSIGNMENT_MARKS.NOT_STARTED) label = intl.formatMessage(messages.notStarted);
    else label = intl.formatMessage(messages.inProgress, { done: status.cappedCount, total: status.conditionCount });
    return (
        <span className={styles.menuLessonMarks}>
            <span
                aria-label={label}
                className={styles.menuLessonMark}
                data-kind={mark.kind}
                data-testid="classroom-menu-lesson-mark"
                role="img"
                title={label}
            >
                {mark.text}
            </span>
            {mark.submitted ? <ClassroomStatusIcon badge status="submitted" /> : null}
        </span>
    );
};

LessonMark.propTypes = {
    mark: PropTypes.shape({
        kind: PropTypes.string.isRequired,
        text: PropTypes.string.isRequired,
        submitted: PropTypes.bool.isRequired,
    }).isRequired,
    status: PropTypes.shape({
        cappedCount: PropTypes.number.isRequired,
        conditionCount: PropTypes.number.isRequired,
    }).isRequired,
};

const ClassroomMenuStatus = () => {
    const lesson = useSelector(selectStudentLesson);
    const records = useSelector((state) => state.scratchGui.lessonMode.progress);
    const submissionStatus = useSelector((state) =>
        state.scratchGui.classroom ? state.scratchGui.classroom.submissionStatus : null,
    );
    const submission = getSubmissionStatus(submissionStatus);
    const status = useMemo(() => assignmentProgress(lesson, records), [lesson, records]);
    // An ordinary assignment shows its state on the 「提出する」/「提出済み ✓」 button
    // right next to it (#1795), so the icon would only repeat it (and take the
    // room the button needs on an iPad menu bar).
    if (!status) return null;
    const mark = assignmentMenuMark(status, {
        submitted: lesson.submitWork && (submission === 'submitted' || submission === 'returned'),
    });
    return <LessonMark mark={mark} status={status} />;
};

export default ClassroomMenuStatus;
