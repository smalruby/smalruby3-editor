/**
 * "From your teacher last time" recap box.
 *
 * Shown right after joining when the lesson belongs to a group (組) and the
 * same seat received a returned comment in a prior lesson of that group.
 * Bridges the gap between weekly lessons (and long holidays) with a
 * personalized positive note.
 */
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';

import styles from './classroom-modal.css';

const StudentPreviousComment = ({ previousComment }) => {
    if (!previousComment || !previousComment.teacherComment) return null;
    return (
        <div className={styles.previousCommentBox} data-testid="classroom-previous-comment">
            <div className={styles.previousCommentTitle}>
                <FormattedMessage
                    defaultMessage="From your teacher last time ({assignmentName}):"
                    description="Title of the previous returned comment recap box"
                    id="gui.classroom.previousComment.title"
                    values={{ assignmentName: previousComment.assignmentName || '' }}
                />
            </div>
            <div className={styles.previousCommentText} data-testid="classroom-previous-comment-text">
                {previousComment.teacherComment}
            </div>
        </div>
    );
};

StudentPreviousComment.propTypes = {
    previousComment: PropTypes.shape({
        assignmentName: PropTypes.string,
        teacherComment: PropTypes.string,
    }),
};

export default StudentPreviousComment;
