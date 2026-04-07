import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';

import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

const TeacherLoginPhase = ({ error, errorTitle, onBack, onTeacherLogin }) => (
    <div data-testid="classroom-phase-teacher-login">
        <button
            className={styles.backLink}
            data-testid="classroom-back"
            onClick={onBack}
        >
            {'<'}{' '}
            <FormattedMessage
                defaultMessage="Back"
                description="Back button"
                id="gui.classroom.back"
            />
        </button>
        <div className={styles.phaseTitle}>
            <FormattedMessage
                defaultMessage="Sign in with Google"
                description="Prompt for teacher Google sign in"
                id="gui.classroom.teacherLogin.prompt"
            />
        </div>
        <div className={styles.description}>
            <FormattedMessage
                defaultMessage="Sign in with your Google account to manage classrooms."
                description="Teacher login description"
                id="gui.classroom.teacherLogin.description"
            />
        </div>
        <div className={styles.buttonRow}>
            <button
                className={styles.primaryButton}
                data-testid="classroom-google-login"
                onClick={onTeacherLogin}
            >
                <FormattedMessage
                    defaultMessage="Sign in with Google"
                    description="Google sign in button"
                    id="gui.classroom.teacherLogin.button"
                />
            </button>
        </div>
        <ErrorDisplay error={error} errorTitle={errorTitle} />
    </div>
);

TeacherLoginPhase.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    onBack: PropTypes.func.isRequired,
    onTeacherLogin: PropTypes.func.isRequired,
};

export default TeacherLoginPhase;
