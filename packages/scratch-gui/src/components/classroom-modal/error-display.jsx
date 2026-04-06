import PropTypes from 'prop-types';
import React from 'react';

import styles from './classroom-modal.css';

const ErrorDisplay = ({ error, errorTitle }) => {
    if (!error) return null;
    if (errorTitle) {
        return (
            <div className={styles.errorBox} data-testid="classroom-error">
                <div className={styles.errorBoxTitle}>{errorTitle}</div>
                <div className={styles.errorBoxMessage}>{error}</div>
            </div>
        );
    }
    return (
        <div className={styles.errorText} data-testid="classroom-error">
            {error}
        </div>
    );
};

ErrorDisplay.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
};

export default ErrorDisplay;
