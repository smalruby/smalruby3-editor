import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';

import { peerViewEntryState } from '../../lib/classroom-peer-view.js';
import { closeClassroomModal, openStudentPeerPanel } from '../../reducers/classroom.js';
import styles from './classroom-modal.css';

/**
 * "みんなの作品を見る" in the student's class screen (#1210). Hidden when the
 * assignment does not show classmates' work; with "after submitting" and no
 * submission yet it says so instead of opening. Opening closes the class
 * screen so the floating panel sits next to the student's own blocks.
 * @param {object} props - component props
 * @param {boolean} props.disabled - the class screen is busy
 * @returns {?React.ReactElement} the button, or null when hidden
 */
const StudentPeerViewButton = ({ disabled }) => {
    const dispatch = useDispatch();
    const peerView = useSelector((state) => state.scratchGui.classroom?.studentPeerView || null);
    const hasSubmitted = useSelector((state) => !!state.scratchGui.classroom?.submissionStatus);
    const entry = peerViewEntryState(peerView, hasSubmitted);
    const handleClick = useCallback(() => {
        dispatch(openStudentPeerPanel());
        dispatch(closeClassroomModal());
    }, [dispatch]);

    if (entry === 'hidden') return null;
    if (entry === 'locked') {
        return (
            <span
                className={styles.peerViewLocked}
                data-testid="classroom-peer-view-locked"
            >
                <FormattedMessage
                    defaultMessage="Submit to see classmates' work"
                    description="Student status: peer view opens after submitting (#1210)"
                    id="gui.classroom.studentStatus.peerViewLocked"
                />
            </span>
        );
    }
    return (
        <button
            className={styles.secondaryButton}
            data-testid="classroom-peer-view-button"
            disabled={disabled}
            onClick={handleClick}
        >
            <FormattedMessage
                defaultMessage="See classmates' work"
                description="Student status: open the peer view panel (#1210)"
                id="gui.classroom.studentStatus.peerView"
            />
        </button>
    );
};

StudentPeerViewButton.propTypes = {
    disabled: PropTypes.bool,
};

export default StudentPeerViewButton;
