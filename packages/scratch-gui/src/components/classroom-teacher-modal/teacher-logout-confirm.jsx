/**
 * ログアウトの前の確認（#1990）。メンバーのタブで返却していないコメントがあるときに出す。
 *
 * クラス管理は閉じても隠して残すので、コメントの下書きはログアウトだけで消える。
 * メニューバーの「ログアウト」・アバターのメニューの「ログアウト」のどちらからでも、
 * 消える前にここで聞く（採点の画面の下書きは、採点の画面の確認が先に聞く）。
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import ClassroomButton from '../classroom-modal/classroom-button.jsx';
import modalStyles from '../classroom-modal/classroom-modal.css';
import styles from './classroom-teacher-modal.css';

const TeacherLogoutConfirm = ({ onCancel, onConfirm }) => (
    <div
        className={classNames(modalStyles.confirmNote, styles.logoutConfirm)}
        data-testid="classroom-teacher-logout-confirm-box"
    >
        <p
            className={styles.logoutConfirmMessage}
            data-testid="classroom-teacher-logout-confirm-message"
            role="alert"
        >
            <FormattedMessage
                defaultMessage="The comments you have not returned will be lost. Log out?"
                description="Class management: question before logging out over comments typed on the members tab (#1990)"
                id="gui.classroom.teacherLogoutConfirm.message"
            />
        </p>
        <div className={modalStyles.buttonRow}>
            <ClassroomButton autoFocus dataTestId="classroom-teacher-logout-cancel" onClick={onCancel}>
                <FormattedMessage
                    defaultMessage="Stay"
                    description="Class management: closes the logout question and keeps the comments (#1990)"
                    id="gui.classroom.teacherLogoutConfirm.stay"
                />
            </ClassroomButton>
            <ClassroomButton dataTestId="classroom-teacher-logout-confirm" variant="danger" onClick={onConfirm}>
                <FormattedMessage
                    defaultMessage="Log out"
                    description="Class management: logs out and drops the comments not returned (#1990)"
                    id="gui.classroom.teacherLogoutConfirm.logout"
                />
            </ClassroomButton>
        </div>
    </div>
);

TeacherLogoutConfirm.propTypes = {
    onCancel: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
};

export default TeacherLogoutConfirm;
