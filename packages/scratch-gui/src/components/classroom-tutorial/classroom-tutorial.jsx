/**
 * Classroom tutorial overlay.
 *
 * Shows a one-time hint for each tutorial step. Once dismissed via
 * "OK" button, it is recorded in localStorage and never shown again.
 *
 * The layout (a card in the middle of the panel) differs from the balloons,
 * so it does not use <Balloon>; it shares the balloon tokens (colors, radius,
 * shadow, typography) and the balloon button instead.
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';
import { isTutorialSeen, markClassroomTutorialSeen } from '../../reducers/classroom-tutorial.js';
import BalloonButton from '../balloon/balloon-button.jsx';
import styles from './classroom-tutorial.css';

const ClassroomTutorial = ({ name, children }) => {
    const dispatch = useDispatch();
    const seen = useSelector((state) => isTutorialSeen(state, name));

    const handleDismiss = useCallback(() => {
        dispatch(markClassroomTutorialSeen(name));
    }, [dispatch, name]);

    if (seen) return null;

    return (
        <div className={styles.overlay} data-testid={`classroom-tutorial-${name}`}>
            <div className={styles.card}>
                <div className={styles.body}>{children}</div>
                <BalloonButton
                    primary
                    className={styles.dismissButton}
                    data-testid={`classroom-tutorial-dismiss-${name}`}
                    onClick={handleDismiss}
                >
                    <FormattedMessage
                        defaultMessage="OK"
                        description="Dismiss tutorial button"
                        id="gui.classroom.tutorial.dismiss"
                    />
                </BalloonButton>
            </div>
        </div>
    );
};

ClassroomTutorial.propTypes = {
    children: PropTypes.node.isRequired,
    name: PropTypes.string.isRequired,
};

export default ClassroomTutorial;
