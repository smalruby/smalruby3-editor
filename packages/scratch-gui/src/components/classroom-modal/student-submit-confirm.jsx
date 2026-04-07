import { FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';

import ErrorDisplay from './error-display.jsx';

import styles from './classroom-modal.css';

const StudentSubmitConfirm = ({
    thumbnailDataUrl,
    isLoading,
    submitProgress,
    error,
    errorTitle,
    onConfirmSubmit,
    onCancelSubmit,
}) => (
    <div data-testid="classroom-phase-submit-confirm">
        <div className={styles.phaseTitle}>
            <FormattedMessage
                defaultMessage="Submit your project"
                description="Submit confirmation title"
                id="gui.classroom.submitConfirm.title"
            />
        </div>
        {thumbnailDataUrl && (
            <div className={styles.thumbnailPreview}>
                <img
                    alt="Project thumbnail"
                    className={styles.thumbnailImage}
                    data-testid="classroom-submit-preview"
                    src={thumbnailDataUrl}
                />
            </div>
        )}
        <div className={styles.description}>
            <FormattedMessage
                defaultMessage="Are you sure you want to submit your current project?"
                description="Submit confirmation message"
                id="gui.classroom.submitConfirm.message"
            />
        </div>
        <div className={styles.buttonRow}>
            <button
                className={styles.secondaryButton}
                data-testid="classroom-submit-cancel"
                onClick={onCancelSubmit}
            >
                <FormattedMessage
                    defaultMessage="Cancel"
                    description="Cancel submit button"
                    id="gui.classroom.submitConfirm.cancel"
                />
            </button>
            <button
                className={styles.primaryButton}
                data-testid="classroom-submit-confirm"
                disabled={isLoading}
                onClick={onConfirmSubmit}
            >
                {isLoading && submitProgress ? (
                    `${submitProgress.label} (${submitProgress.current}/${submitProgress.total})`
                ) : isLoading ? (
                    <FormattedMessage
                        defaultMessage="Submitting..."
                        description="Submitting progress"
                        id="gui.classroom.submitConfirm.submitting"
                    />
                ) : (
                    <FormattedMessage
                        defaultMessage="Submit"
                        description="Confirm submit button"
                        id="gui.classroom.submitConfirm.submit"
                    />
                )}
            </button>
        </div>
        <ErrorDisplay error={error} errorTitle={errorTitle} />
    </div>
);

StudentSubmitConfirm.propTypes = {
    error: PropTypes.string,
    errorTitle: PropTypes.string,
    isLoading: PropTypes.bool,
    onCancelSubmit: PropTypes.func.isRequired,
    onConfirmSubmit: PropTypes.func.isRequired,
    submitProgress: PropTypes.shape({
        current: PropTypes.number,
        total: PropTypes.number,
        label: PropTypes.string,
    }),
    thumbnailDataUrl: PropTypes.string,
};

export default StudentSubmitConfirm;
