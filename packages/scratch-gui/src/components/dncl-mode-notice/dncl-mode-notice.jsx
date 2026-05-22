import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { defineMessages, injectIntl } from 'react-intl';
import intlShape from '../../lib/intlShape.js';
import styles from './dncl-mode-notice.css';

const messages = defineMessages({
    message: {
        id: 'gui.dnclModeNotice.message',
        description: 'Notice shown in blocks tab when DNCL mode is active',
        defaultMessage: 'Japanese mode: blocks are restricted',
    },
    exitButton: {
        id: 'gui.dnclModeNotice.exitButton',
        description: 'Button label to exit DNCL mode from the blocks tab notice',
        defaultMessage: 'Return to Ruby furigana mode',
    },
    exitConfirm: {
        id: 'gui.extensionButton.dnclExtensionConfirm',
        description: 'Confirm dialog when switching out of DNCL mode',
        defaultMessage:
            'Extensions are not available in Japanese mode.\nReturn to Ruby furigana mode to enable extensions.\nSwitch now?',
    },
});

const DnclModeNotice = ({ dnclMode, onExitDnclMode, intl }) => {
    const handleExitClick = useCallback(() => {
        // eslint-disable-next-line no-alert
        const confirmed = window.confirm(intl.formatMessage(messages.exitConfirm));
        if (confirmed) onExitDnclMode?.();
    }, [onExitDnclMode, intl]);

    if (!dnclMode) return null;

    return (
        <div className={styles.notice} data-testid="dncl-mode-notice">
            <span className={styles.message}>{intl.formatMessage(messages.message)}</span>
            <button
                className={styles.exitButton}
                data-testid="dncl-mode-notice-exit-button"
                onClick={handleExitClick}
            >
                {intl.formatMessage(messages.exitButton)}
            </button>
        </div>
    );
};

DnclModeNotice.propTypes = {
    dnclMode: PropTypes.bool,
    intl: intlShape.isRequired,
    onExitDnclMode: PropTypes.func,
};

export default injectIntl(DnclModeNotice);
