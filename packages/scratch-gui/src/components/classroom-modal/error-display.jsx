import PropTypes from 'prop-types';
import React from 'react';

import styles from './classroom-modal.css';

const ErrorDisplay = ({ error, errorTitle, actionLabel, onAction }) => {
    if (!error) return null;
    if (errorTitle) {
        return (
            <div className={styles.errorBox} data-testid="classroom-error">
                <div className={styles.errorBoxTitle}>{errorTitle}</div>
                <div className={styles.errorBoxMessage}>{error}</div>
                {actionLabel && onAction && (
                    <button
                        className={styles.errorActionLink}
                        data-testid="classroom-error-action"
                        onClick={onAction}
                    >
                        {actionLabel}
                    </button>
                )}
            </div>
        );
    }
    return (
        <div className={styles.errorText} data-testid="classroom-error">
            {error}
            {actionLabel && onAction && (
                <button
                    className={styles.errorActionLink}
                    data-testid="classroom-error-action"
                    onClick={onAction}
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

ErrorDisplay.propTypes = {
    actionLabel: PropTypes.string,
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    onAction: PropTypes.func,
};

export default ErrorDisplay;
