/**
 * 生徒の作品を開く前の確認（#1983）。エディタに保存していない変更があるときに出す。
 *
 * 入口は、課題の詳細・メンバー詳細の［スモウルビーで開く］と、採点の右の列の［作品を開く］。
 * 開くとエディタの作品は置きかわり、元に戻せないので、クラス管理の中で先に聞く。
 * - own: エディタの作品は先生自身のもの（保存していない変更が消える）
 * - opened: 前にクラス管理から開いた生徒の作品を、先生が変えている（その変更が消える）
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import ClassroomButton from '../classroom-modal/classroom-button.jsx';
import modalStyles from '../classroom-modal/classroom-modal.css';
import styles from './classroom-teacher-modal.css';

const TeacherOpenWorkConfirm = ({ kind, onCancel, onConfirm }) => (
    <div
        className={classNames(modalStyles.confirmNote, styles.logoutConfirm)}
        data-testid="classroom-teacher-open-work-confirm-box"
    >
        <p
            className={styles.logoutConfirmMessage}
            data-kind={kind}
            data-testid="classroom-teacher-open-work-confirm-message"
            role="alert"
        >
            {kind === 'opened' ? (
                <FormattedMessage
                    defaultMessage="You have changed the student's work you opened before. The changes are on that student's work and are not saved anywhere. Opening this work replaces it and the changes will be lost. Open it?"
                    description="Class management: question before opening a student's work when the teacher edited the student's work opened before and did not save (#1983)"
                    id="gui.classroom.teacherOpenWorkConfirm.openedMessage"
                />
            ) : (
                <FormattedMessage
                    defaultMessage="Your own work in the editor has changes that are not saved. Opening the student's work replaces it and the changes will be lost. Open it?"
                    description="Class management: question before opening a student's work over the teacher's own work not saved in the editor (#1983)"
                    id="gui.classroom.teacherOpenWorkConfirm.ownMessage"
                />
            )}
        </p>
        <div className={modalStyles.buttonRow}>
            <ClassroomButton autoFocus dataTestId="classroom-teacher-open-work-cancel" onClick={onCancel}>
                <FormattedMessage
                    defaultMessage="Cancel"
                    description="Class management: closes the question and keeps the work in the editor (#1983)"
                    id="gui.classroom.teacherOpenWorkConfirm.cancel"
                />
            </ClassroomButton>
            <ClassroomButton dataTestId="classroom-teacher-open-work-confirm" variant="danger" onClick={onConfirm}>
                <FormattedMessage
                    defaultMessage="Open"
                    description="Class management: opens the student's work and drops the changes in the editor (#1983)"
                    id="gui.classroom.teacherOpenWorkConfirm.open"
                />
            </ClassroomButton>
        </div>
    </div>
);

TeacherOpenWorkConfirm.propTypes = {
    kind: PropTypes.oneOf(['own', 'opened']).isRequired,
    onCancel: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
};

export default TeacherOpenWorkConfirm;
