import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

const StudentJoinForm = ({
    error,
    errorTitle,
    isLoading,
    noBackButton,
    onBack,
    onJoin,
}) => {
    const [code, setCode] = React.useState('');

    const handleCodeChange = useCallback((e) => {
        setCode(e.target.value.toLowerCase());
    }, []);

    const handleSubmit = useCallback(() => {
        if (code.trim().length === 6) {
            onJoin(code.trim().toUpperCase());
        }
    }, [code, onJoin]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter' && code.trim().length === 6) {
                onJoin(code.trim().toUpperCase());
            }
        },
        [code, onJoin],
    );

    return (
        <div data-testid="classroom-phase-student-join">
            {!noBackButton && (
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
            )}
            <div className={styles.phaseTitle}>
                <FormattedMessage
                    defaultMessage="Enter Join Code"
                    description="Student join form title"
                    id="gui.classroom.studentJoin.title"
                />
            </div>
            <div className={styles.formGroup}>
                <input
                    className={styles.input}
                    data-testid="classroom-join-code-input"
                    maxLength={6}
                    placeholder="○○○○○○"
                    style={{
                        textAlign: 'center',
                        fontSize: '1.5rem',
                        letterSpacing: '0.2em',
                    }}
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    onKeyDown={handleKeyDown}
                />
            </div>
            <div className={styles.buttonRow}>
                <button
                    className={styles.primaryButton}
                    data-testid="classroom-join-submit"
                    disabled={code.trim().length !== 6 || isLoading}
                    onClick={handleSubmit}
                >
                    {isLoading ? (
                        <FormattedMessage
                            defaultMessage="Loading..."
                            description="Loading indicator"
                            id="gui.classroom.loading"
                        />
                    ) : (
                        <FormattedMessage
                            defaultMessage="Next"
                            description="Submit join code button"
                            id="gui.classroom.studentJoin.next"
                        />
                    )}
                </button>
            </div>
            <ErrorDisplay error={error} errorTitle={errorTitle} />
        </div>
    );
};

StudentJoinForm.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    noBackButton: PropTypes.bool,
    onBack: PropTypes.func,
    onJoin: PropTypes.func.isRequired,
};

export default StudentJoinForm;
