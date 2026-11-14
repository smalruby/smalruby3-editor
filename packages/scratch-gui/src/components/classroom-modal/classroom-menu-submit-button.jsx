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
    submitting: {
        defaultMessage: 'Submitting...',
        description: 'Menu bar submit button while the submission is being sent (disabled meanwhile)',
        id: 'gui.menuBar.classroomSubmitting',
    },
    submitAgain: {
        defaultMessage: 'Submit again',
        description: 'Tooltip of the submitted / returned menu bar button: pressing it submits the project again',
        id: 'gui.menuBar.classroomSubmitAgain',
    },
});

/**
 * ボタンの見た目だけ（テスト用に状態を外から渡せる）。
 * @param {object} props - component props
 * @param {string} props.kind - MENU_SUBMIT_KINDS のどれか
 * @param {string} [props.placement] - 'menu-bar'（PC・iPad）か 'drawer'（スマホのドロワーの先頭・高さ 44px 以上）
 * @param {boolean} [props.submitting] - 送信中。押せなくし、字を「提出中...」にする（二重の提出を防ぐ）
 * @param {Function} props.onClick - 押したとき
 * @returns {React.ReactElement} the button
 */
const ClassroomMenuSubmitButtonView = ({ kind, placement = 'menu-bar', submitting = false, onClick }) => {
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
            aria-busy={submitting ? 'true' : null}
            className={
                placement === 'drawer'
                    ? `${styles.menuSubmitButton} ${styles.menuSubmitButtonDrawer}`
                    : styles.menuSubmitButton
            }
            data-kind={kind}
            data-placement={placement}
            data-testid="classroom-menu-submit"
            disabled={submitting}
            title={again && !submitting ? intl.formatMessage(messages.submitAgain) : null}
            type="button"
            onClick={handleClick}
        >
            {intl.formatMessage(submitting ? messages.submitting : messages[kind])}
        </button>
    );
};

ClassroomMenuSubmitButtonView.propTypes = {
    kind: PropTypes.oneOf(Object.values(MENU_SUBMIT_KINDS)).isRequired,
    onClick: PropTypes.func.isRequired,
    placement: PropTypes.oneOf(['menu-bar', 'drawer']),
    submitting: PropTypes.bool,
};

/**
 * 参加中の生徒の状態から出し分ける版。参加していないときは何も描かない。
 * @param {object} props - component props
 * @param {string} [props.placement] - 'menu-bar' か 'drawer'
 * @param {Function} [props.onAfterClick] - 押したあと（ドロワーを閉じる）
 * @returns {?React.ReactElement} the button
 */
const ClassroomMenuSubmitButton = ({ placement = 'menu-bar', onAfterClick }) => {
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
    const handleClick = useCallback(() => {
        dispatch(requestStudentSubmit());
        if (onAfterClick) onAfterClick();
    }, [dispatch, onAfterClick]);
    if (!kind) return null;
    return (
        <ClassroomMenuSubmitButtonView
            kind={kind}
            placement={placement}
            submitting={!!(classroom && classroom.studentSubmitting)}
            onClick={handleClick}
        />
    );
};

ClassroomMenuSubmitButton.propTypes = {
    onAfterClick: PropTypes.func,
    placement: PropTypes.oneOf(['menu-bar', 'drawer']),
};

export default ClassroomMenuSubmitButton;
export { ClassroomMenuSubmitButtonView };
