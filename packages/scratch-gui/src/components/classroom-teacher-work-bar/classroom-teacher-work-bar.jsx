/**
 * 先生がクラス管理から作品を開いている間、エディタの上に出す「戻る帯」（#1990）。
 *
 * 「出席番号 3・迷路 の作品を見ています ［‹ 採点に戻る］」。出すのは出席番号と課題名だけ
 * （生徒の名前は出さない）。［戻る］はクラス管理を開いた画面のまま開き直す。
 */
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, useIntl } from 'react-intl';
import ClassroomButton from '../classroom-modal/classroom-button.jsx';
import styles from './classroom-teacher-work-bar.css';

const messages = defineMessages({
    viewing: {
        defaultMessage: 'Viewing the work of seat {seatNumber} · {assignmentName}',
        description:
            'Bar above the editor while the teacher looks at a work opened from class management (#1990): ' +
            'the seat number and the assignment name only (never the student name)',
        id: 'gui.classroom.teacherWorkBar.viewing',
    },
    viewingNoSeat: {
        defaultMessage: 'Viewing a work of {assignmentName}',
        description: 'Bar above the editor (#1990) when the seat number is not known',
        id: 'gui.classroom.teacherWorkBar.viewingNoSeat',
    },
    sessionExpired: {
        defaultMessage: 'Your login has expired. Go back and log in again.',
        description:
            'Bar above the editor (#1990): the teacher login expired while the work was open. Going back ' +
            'opens class management on the login screen; the screen and the drafts come back after logging in',
        id: 'gui.classroom.teacherWorkBar.sessionExpired',
    },
    backToGrading: {
        defaultMessage: '‹ Back to grading',
        description: 'Bar above the editor (#1990): go back to the grading screen the work was opened from',
        id: 'gui.classroom.teacherWorkBar.backToGrading',
    },
    backToAssignment: {
        defaultMessage: '‹ Back to the assignment',
        description: 'Bar above the editor (#1990): go back to the assignment the work was opened from',
        id: 'gui.classroom.teacherWorkBar.backToAssignment',
    },
});

const ClassroomTeacherWorkBar = ({ work, expired = false, onBack }) => {
    const intl = useIntl();
    const assignmentName = work.assignmentName || '';
    const text =
        typeof work.seatNumber === 'number'
            ? intl.formatMessage(messages.viewing, { seatNumber: work.seatNumber, assignmentName })
            : intl.formatMessage(messages.viewingNoSeat, { assignmentName });
    return (
        <div className={styles.bar} data-testid="classroom-teacher-work-bar" role="status">
            <span className={styles.text} data-testid="classroom-teacher-work-bar-text" title={text}>
                {text}
            </span>
            {expired && (
                <span className={styles.expired} data-testid="classroom-teacher-work-bar-expired" role="alert">
                    {intl.formatMessage(messages.sessionExpired)}
                </span>
            )}
            <ClassroomButton className={styles.back} dataTestId="classroom-teacher-work-bar-back" onClick={onBack}>
                {intl.formatMessage(work.from === 'evaluation' ? messages.backToGrading : messages.backToAssignment)}
            </ClassroomButton>
        </div>
    );
};

ClassroomTeacherWorkBar.propTypes = {
    work: PropTypes.shape({
        from: PropTypes.oneOf(['evaluation', 'assignment']),
        seatNumber: PropTypes.number,
        assignmentName: PropTypes.string,
    }).isRequired,
    /** The teacher login expired (not a logout): ask to log in again (#1990). */
    expired: PropTypes.bool,
    onBack: PropTypes.func.isRequired,
};

export default ClassroomTeacherWorkBar;
