/**
 * メニューバーの「提出する」ボタン (#1795)。
 *
 * 参加中はいつも出して、提出の入口を見える場所に 1 つにまとめる（docs/classroom/ui-ux.md の
 * 「メニューバー」）。未提出はオレンジの「提出する」、提出済み・返却済みは緑の「提出済み ✓」
 * 「返却済み ✓」。どれも押すと提出確認を開く（提出済み・返却済みからは再提出の流れ）。
 * 作品を提出しないレッスンの課題では出さない（menuSubmitKind）。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import { MENU_SUBMIT_KINDS, menuSubmitKind } from '../../lib/classroom-menu-submit.js';
import { assignmentProgress } from '../../lib/lessons/assignment-progress.js';
import { requestStudentSubmit, selectStudentLesson } from '../../reducers/classroom.js';
import styles from './student-screen-parts.css';

const messages = defineMessages({
    submit: {
        defaultMessage: 'Submit',
        description: 'Menu bar button of a joined student who has not submitted yet: opens the submit confirmation',
        id: 'gui.menuBar.classroomSubmit',
    },
    submitted: {
        defaultMessage: 'Submitted ✓',
        description: 'Menu bar button of a student who has submitted: pressing it submits again',
        id: 'gui.menuBar.classroomSubmitted',
    },
    returned: {
        defaultMessage: 'Returned ✓',
        description: 'Menu bar button of a student whose work the teacher returned: pressing it submits again',
        id: 'gui.menuBar.classroomReturned',
    },
    submitAgain: {
        defaultMessage: 'Submit again',
        description: 'Tooltip of the submitted / returned menu bar button: pressing it submits the project again',
        id: 'gui.menuBar.classroomSubmitAgain',
    },
});

/**
 * ボタンの見た目だけ（テスト・スマホの上部バー用に状態を外から渡せる）。
 * @param {object} props - component props
 * @param {string} props.kind - MENU_SUBMIT_KINDS のどれか
 * @param {boolean} [props.compact] - スマホの上部バーに置く小さい版
 * @param {Function} props.onClick - 押したとき
 * @returns {React.ReactElement} the button
 */
const ClassroomMenuSubmitButtonView = ({ kind, compact = false, onClick }) => {
    const intl = useIntl();
    const handleClick = useCallback(
        (e) => {
            // メニューバーのクラスのボタン（クラスの画面を開く）に押したことを伝えない。
            e.stopPropagation();
            onClick();
        },
        [onClick],
    );
    const again = kind !== MENU_SUBMIT_KINDS.SUBMIT;
    return (
        <button
            className={
                compact ? `${styles.menuSubmitButton} ${styles.menuSubmitButtonCompact}` : styles.menuSubmitButton
            }
            data-kind={kind}
            data-testid="classroom-menu-submit"
            title={again ? intl.formatMessage(messages.submitAgain) : null}
            type="button"
            onClick={handleClick}
        >
            {intl.formatMessage(messages[kind])}
        </button>
    );
};

ClassroomMenuSubmitButtonView.propTypes = {
    compact: PropTypes.bool,
    kind: PropTypes.oneOf(Object.values(MENU_SUBMIT_KINDS)).isRequired,
    onClick: PropTypes.func.isRequired,
};

/**
 * 参加中の生徒の状態から出し分ける版。参加していないときは何も描かない。
 * @param {object} props - component props
 * @param {boolean} [props.compact] - スマホの上部バーに置く小さい版
 * @returns {?React.ReactElement} the button
 */
const ClassroomMenuSubmitButton = ({ compact = false }) => {
    const dispatch = useDispatch();
    const classroom = useSelector((state) => state.scratchGui.classroom);
    const lesson = useSelector(selectStudentLesson);
    const records = useSelector((state) => state.scratchGui.lessonMode.progress);
    const lessonStatus = useMemo(() => assignmentProgress(lesson, records), [lesson, records]);
    const joined = !!(classroom && classroom.role === 'student' && classroom.sessionToken && classroom.seatNumber);
    const kind = menuSubmitKind({
        joined,
        submissionStatus: classroom ? classroom.submissionStatus : null,
        lesson,
        lessonStatus,
    });
    const handleClick = useCallback(() => dispatch(requestStudentSubmit()), [dispatch]);
    if (!kind) return null;
    return <ClassroomMenuSubmitButtonView compact={compact} kind={kind} onClick={handleClick} />;
};

ClassroomMenuSubmitButton.propTypes = {
    compact: PropTypes.bool,
};

export default ClassroomMenuSubmitButton;
export { ClassroomMenuSubmitButtonView };
