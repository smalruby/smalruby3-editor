/**
 * "From your teacher last time" recap.
 *
 * Shown right after joining when the lesson belongs to a group (組) and the
 * same seat received a returned comment in a prior lesson of that group.
 * Bridges the gap between weekly lessons (and long holidays) with a
 * personalized positive note, in the same bubble as the returned comment
 * on the welcome back screen (#1963).
 */
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import StudentTeacherNote from './student-teacher-note.jsx';

const StudentPreviousComment = ({ previousComment }) => {
    if (!previousComment || !previousComment.teacherComment) return null;
    const context = previousComment.assignmentName ? (
        <FormattedMessage
            defaultMessage="Last time: {assignmentName}"
            description="Next to 「From your teacher」: the earlier assignment the comment was returned on"
            id="gui.classroom.previousComment.context"
            values={{ assignmentName: previousComment.assignmentName }}
        />
    ) : (
        <FormattedMessage
            defaultMessage="Last time"
            description="Next to 「From your teacher」 when the earlier assignment has no name"
            id="gui.classroom.previousComment.contextNoName"
        />
    );
    return (
        <StudentTeacherNote
            context={context}
            dataTestId="classroom-previous-comment"
            text={previousComment.teacherComment}
            textTestId="classroom-previous-comment-text"
        />
    );
};

StudentPreviousComment.propTypes = {
    previousComment: PropTypes.shape({
        assignmentName: PropTypes.string,
        teacherComment: PropTypes.string,
    }),
};

export default StudentPreviousComment;
