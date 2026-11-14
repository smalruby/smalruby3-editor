/**
 * メニューバーの「提出する」ボタン (#1795)。
 *
 * 参加中はいつも出して、提出の入口を見える場所に 1 つにまとめる（docs/classroom/ui-ux.md の
 * 「メニューバー」）。未提出は白地に青い字の「提出する」、提出済み・返却済みは緑の「提出済み ✓」
 * 「返却済み ✓」。どれも押すと提出確認を開く（提出済み・返却済みからは再提出の流れ）。
 * 作品を提出しないレッスンの課題では出さない（menuSubmitKind）。
 */
import PropTypes from 'prop-types';
import React, { useCallback, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import useMenuSubmitKind from '../../containers/use-menu-submit-kind.js';
import { MENU_SUBMIT_KINDS } from '../../lib/classroom-menu-submit.js';
import { dismissSubmitReminder, requestStudentSubmit } from '../../reducers/classroom.js';
import ClassroomSubmitReminderBalloon from './classroom-submit-reminder-balloon.jsx';
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
 * 「提出しよう」の吹き出し (#1835) が出る時は、ボタンの下に出す（スマホのドロワーは開いたときだけ
 * ここが描かれるので、☰ を開いたときに出る）。
 * @param {object} props - component props
 * @param {string} [props.placement] - 'menu-bar' か 'drawer'
 * @param {Function} [props.onAfterClick] - 押したあと（ドロワーを閉じる）
 * @param {boolean} [props.reminderAllowed] - 吹き出しを出してよいか（ドロワーは開いているときだけ）
 * @returns {?React.ReactElement} the button
 */
const ClassroomMenuSubmitButton = ({ placement = 'menu-bar', onAfterClick, reminderAllowed = true }) => {
    const wrapRef = useRef(null);
    const dispatch = useDispatch();
    const classroom = useSelector((state) => state.scratchGui.classroom);
    const kind = useMenuSubmitKind();
    const reminderVisible =
        reminderAllowed && !!(classroom && classroom.submitReminderVisible) && kind === MENU_SUBMIT_KINDS.SUBMIT;
    const handleDismissReminder = useCallback((reason) => dispatch(dismissSubmitReminder(reason)), [dispatch]);
    const handleClick = useCallback(() => {
        dispatch(requestStudentSubmit());
        if (onAfterClick) onAfterClick();
    }, [dispatch, onAfterClick]);
    if (!kind) return null;
    return (
        <div
            ref={wrapRef}
            className={
                placement === 'drawer'
                    ? `${styles.menuSubmitWrap} ${styles.menuSubmitWrapDrawer}`
                    : styles.menuSubmitWrap
            }
        >
            <ClassroomMenuSubmitButtonView
                kind={kind}
                placement={placement}
                submitting={!!(classroom && classroom.studentSubmitting)}
                onClick={handleClick}
            />
            {reminderVisible ? (
                <ClassroomSubmitReminderBalloon
                    anchorRef={wrapRef}
                    placement={placement}
                    onDismiss={handleDismissReminder}
                />
            ) : null}
        </div>
    );
};

ClassroomMenuSubmitButton.propTypes = {
    onAfterClick: PropTypes.func,
    reminderAllowed: PropTypes.bool,
    placement: PropTypes.oneOf(['menu-bar', 'drawer']),
};

export default ClassroomMenuSubmitButton;
export { ClassroomMenuSubmitButtonView };
