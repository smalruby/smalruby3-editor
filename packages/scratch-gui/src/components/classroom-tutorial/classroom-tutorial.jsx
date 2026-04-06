/**
 * Classroom tutorial overlay.
 *
 * Shows a one-time hint for each tutorial step. Once dismissed via
 * "OK" button, it is recorded in localStorage and never shown again.
 */
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage } from 'react-intl';
import { useDispatch, useSelector } from 'react-redux';

import {
    isTutorialSeen,
    markClassroomTutorialSeen,
} from '../../reducers/classroom-tutorial.js';

import styles from './classroom-tutorial.css';

const ClassroomTutorial = ({ name, children }) => {
    const dispatch = useDispatch();
    const seen = useSelector((state) => isTutorialSeen(state, name));

    const handleDismiss = useCallback(() => {
        dispatch(markClassroomTutorialSeen(name));
    }, [dispatch, name]);

    if (seen) return null;

    return (
        <div
            className={styles.overlay}
            data-testid={`classroom-tutorial-${name}`}
        >
            <div className={styles.card}>
                <div className={styles.body}>{children}</div>
                <button
                    className={styles.dismissButton}
                    data-testid={`classroom-tutorial-dismiss-${name}`}
                    onClick={handleDismiss}
                >
                    <FormattedMessage
                        defaultMessage="OK"
                        description="Dismiss tutorial button"
                        id="gui.classroom.tutorial.dismiss"
                    />
                </button>
            </div>
        </div>
    );
};

ClassroomTutorial.propTypes = {
    children: PropTypes.node.isRequired,
    name: PropTypes.string.isRequired,
};

export default ClassroomTutorial;
