import { FormattedMessage, defineMessages, useIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';

import styles from './classroom-modal.css';

const messages = defineMessages({
    reasonPlaceholder: {
        defaultMessage: 'Optional: tell the teacher why you need this seat (max 200 chars).',
        description: 'Placeholder text in the kick-request reason textarea',
        id: 'gui.classroom.kickRequest.reasonPlaceholder',
    },
});

const MAX_REASON_LENGTH = 200;

const KickRequestConfirmDialog = ({ seatNumber, isLoading, error, onCancel, onConfirm }) => {
    const intl = useIntl();
    const [reason, setReason] = useState('');

    const handleReasonChange = useCallback((e) => {
        const value = e.target.value;
        setReason(value.length > MAX_REASON_LENGTH ? value.slice(0, MAX_REASON_LENGTH) : value);
    }, []);

    const handleConfirm = useCallback(() => {
        const trimmed = reason.trim();
        onConfirm(trimmed === '' ? null : trimmed);
    }, [onConfirm, reason]);

    return (
        <div className={styles.kickRequestDialog} data-testid="kick-request-confirm-dialog">
            <h3 className={styles.kickRequestDialogTitle}>
                <FormattedMessage
                    defaultMessage="Ask the teacher to free seat {seatNumber}?"
                    description="Title of the dialog where the student requests the teacher kick the current seat occupant"
                    id="gui.classroom.kickRequest.title"
                    values={{ seatNumber: String(seatNumber).padStart(2, '0') }}
                />
            </h3>
            <p className={styles.kickRequestDialogBody}>
                <FormattedMessage
                    defaultMessage="Use this when you think seat {seatNumber} is your seat but someone else picked it by mistake. Your teacher will see the request and decide."
                    description="Explanatory body text in the kick-request dialog"
                    id="gui.classroom.kickRequest.body"
                    values={{ seatNumber: String(seatNumber).padStart(2, '0') }}
                />
            </p>
            <textarea
                className={styles.kickRequestReasonInput}
                data-testid="kick-request-reason-input"
                maxLength={MAX_REASON_LENGTH}
                onChange={handleReasonChange}
                placeholder={intl.formatMessage(messages.reasonPlaceholder)}
                rows={3}
                value={reason}
            />
            {error && (
                <div className={styles.kickRequestDialogError} data-testid="kick-request-error">
                    {error}
                </div>
            )}
            <div className={styles.kickRequestDialogButtons}>
                <button
                    className={styles.secondaryButton}
                    data-testid="kick-request-cancel"
                    disabled={isLoading}
                    onClick={onCancel}
                    type="button"
                >
                    <FormattedMessage
                        defaultMessage="Cancel"
                        description="Cancel button in the kick-request dialog"
                        id="gui.classroom.kickRequest.cancel"
                    />
                </button>
                <button
                    className={styles.primaryButton}
                    data-testid="kick-request-submit"
                    disabled={isLoading}
                    onClick={handleConfirm}
                    type="button"
                >
                    <FormattedMessage
                        defaultMessage="Send request"
                        description="Submit button in the kick-request dialog"
                        id="gui.classroom.kickRequest.submit"
                    />
                </button>
            </div>
        </div>
    );
};

KickRequestConfirmDialog.propTypes = {
    error: PropTypes.string,
    isLoading: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    seatNumber: PropTypes.number.isRequired,
};

export default KickRequestConfirmDialog;
