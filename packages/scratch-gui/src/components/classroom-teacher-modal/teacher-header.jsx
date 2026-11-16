/**
 * The purple header of class management (#1956 Q2):
 * 「← エディタに戻る｜クラス管理 › クラス名 › 課題名」, the bell and the avatar.
 *
 * The path is not drawn here: each screen draws its own path with
 * `TeacherBreadcrumbs`, which is carried into `slotRef` by a portal. Until a
 * screen draws one (the login screen), 「クラス管理」 alone is shown.
 */
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import backIcon from '../../lib/assets/icon--back.svg';
import { breadcrumbMessages } from '../classroom-modal/teacher-breadcrumbs.jsx';
import styles from './classroom-teacher-modal.css';

const TeacherHeader = ({ children, slotRef, onBackToEditor }) => (
    <header className={styles.header} data-testid="classroom-teacher-header">
        <button
            className={styles.backButton}
            data-testid="classroom-teacher-back-to-editor"
            type="button"
            onClick={onBackToEditor}
        >
            <img alt="" className={styles.backIcon} draggable={false} src={backIcon} />
            <FormattedMessage
                defaultMessage="Back to the editor"
                description="Button at the left of the class management header that closes it and returns to the editor"
                id="gui.classroom.management.backToEditor"
            />
        </button>
        <span aria-hidden="true" className={styles.headerDivider} />
        <div className={styles.headerPath} ref={slotRef} />
        <span className={styles.headerPathDefault}>
            <FormattedMessage {...breadcrumbMessages.top} />
        </span>
        <span className={styles.headerSpacer} />
        {children}
    </header>
);

TeacherHeader.propTypes = {
    /** 右に並べるもの（通知ベル・アバター）。 */
    children: PropTypes.node,
    /** パンくずを運び込む要素を受け取る（`useState` の setter）。 */
    slotRef: PropTypes.func.isRequired,
    onBackToEditor: PropTypes.func.isRequired,
};

export default TeacherHeader;
