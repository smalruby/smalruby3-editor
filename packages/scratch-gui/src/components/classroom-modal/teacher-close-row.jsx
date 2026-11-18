/**
 * The「✕ ＋ 見出し」row on top of a teacher screen that edits one thing (#2089).
 *
 * Google Classroom puts a thin row with ✕ and the title above every edit
 * screen (an assignment, the class settings, …), and ✕ goes back to the list.
 * The class management keeps its purple header (「← エディタに戻る」 and the
 * path) and adds this row under it, so the way back to the list looks the same
 * as in Google Classroom while「← エディタに戻る」stays where it always is.
 *
 * When the screen holds changes that are not saved (`unsaved`), ✕ asks first
 * in the row (no `confirm()`): ［キャンセル］keeps the screen, ［破棄］leaves.
 * Leaving loses the changes and cannot be undone, so［破棄］is red (R4).
 */
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useCallback, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import ClassroomButton from './classroom-button.jsx';
import styles from './classroom-modal.css';

export const closeRowMessages = defineMessages({
    backToAssignments: {
        defaultMessage: 'Back to the assignments',
        description: 'Accessible name of the ✕ on top of an assignment screen: back to the assignment list (授業)',
        id: 'gui.classroom.closeRow.backToAssignments',
    },
    backToClass: {
        defaultMessage: 'Back to the class',
        description: 'Accessible name of the ✕ on top of the class settings: back to the class screen',
        id: 'gui.classroom.closeRow.backToClass',
    },
    backToClassList: {
        defaultMessage: 'Back to the class list',
        description: 'Accessible name of the ✕ on top of the class settings opened from the class list',
        id: 'gui.classroom.closeRow.backToClassList',
    },
    backToAssignment: {
        defaultMessage: 'Back to the assignment',
        description: 'Accessible name of the ✕ on top of the Google Classroom share screen: back to the assignment',
        id: 'gui.classroom.closeRow.backToAssignment',
    },
    discardQuestion: {
        defaultMessage: 'Discard the changes? The changes you have not saved will be lost.',
        description: 'Asked in the ✕ row when the screen has changes that are not saved',
        id: 'gui.classroom.closeRow.discardQuestion',
    },
    discard: {
        defaultMessage: 'Discard',
        description: 'Button in the ✕ row: leave the screen and lose the changes that are not saved',
        id: 'gui.classroom.closeRow.discard',
    },
    cancel: {
        defaultMessage: 'Cancel',
        description: 'Button in the ✕ row: stay on the screen (keep the changes that are not saved)',
        id: 'gui.classroom.closeRow.cancel',
    },
});

const CloseIcon = () => (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
);

const TeacherCloseRow = ({
    children,
    closeLabel,
    heading,
    testId = 'classroom-close-row',
    title,
    unsaved,
    onClose,
}) => {
    const intl = useIntl();
    const [asking, setAsking] = useState(false);
    const closeButtonRef = useRef(null);
    const handleClose = useCallback(() => {
        if (unsaved) {
            setAsking(true);
            return;
        }
        onClose();
    }, [unsaved, onClose]);
    const handleDiscard = useCallback(() => {
        setAsking(false);
        onClose();
    }, [onClose]);
    const handleKeep = useCallback(() => {
        setAsking(false);
        // The buttons of the question are gone: give the focus back to ✕.
        setTimeout(() => closeButtonRef.current && closeButtonRef.current.focus(), 0);
    }, []);
    return (
        <div className={styles.closeRow} data-testid={testId}>
            {onClose ? (
                <button
                    ref={closeButtonRef}
                    aria-label={closeLabel}
                    className={styles.closeRowButton}
                    data-testid={`${testId}-close`}
                    title={closeLabel}
                    type="button"
                    onClick={handleClose}
                >
                    <CloseIcon />
                </button>
            ) : null}
            {title ? (
                <h2 className={styles.closeRowTitle} data-testid={`${testId}-title`}>
                    {title}
                </h2>
            ) : null}
            {heading ? <div className={styles.closeRowHeading}>{heading}</div> : null}
            {asking ? (
                <div className={styles.closeRowEnd}>
                    <p
                        className={classNames(styles.confirmNote, styles.closeRowConfirm)}
                        data-testid={`${testId}-discard-message`}
                        role="alert"
                    >
                        {intl.formatMessage(closeRowMessages.discardQuestion)}
                    </p>
                    <ClassroomButton autoFocus dataTestId={`${testId}-discard-cancel`} onClick={handleKeep}>
                        {intl.formatMessage(closeRowMessages.cancel)}
                    </ClassroomButton>
                    <ClassroomButton dataTestId={`${testId}-discard`} variant="danger" onClick={handleDiscard}>
                        {intl.formatMessage(closeRowMessages.discard)}
                    </ClassroomButton>
                </div>
            ) : children ? (
                <div className={styles.closeRowEnd}>{children}</div>
            ) : null}
        </div>
    );
};

TeacherCloseRow.propTypes = {
    /** What sits at the right end of the row (the join code,［課題を保存］…). */
    children: PropTypes.node,
    /** The accessible name of ✕: where it goes (「課題一覧に戻る」など). */
    closeLabel: PropTypes.string,
    /** A heading that is not plain text (e.g. the editable assignment name). */
    heading: PropTypes.node,
    testId: PropTypes.string,
    /** The heading text (drawn as h2). */
    title: PropTypes.node,
    /** The screen holds changes that are not saved: ✕ asks before leaving. */
    unsaved: PropTypes.bool,
    /** Where ✕ goes. Without it the row has no ✕ (a screen drawn on its own, e.g. in a test). */
    onClose: PropTypes.func,
};

export default TeacherCloseRow;
