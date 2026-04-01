import { defineMessages, useIntl, FormattedMessage } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';

import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';

import styles from './smalrubot-firmware-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'SmalrubotS1 Firmware',
        description: 'Title for the smalrubot firmware flash modal',
        id: 'gui.smalrubotFirmware.title',
    },
});

/**
 * @typedef {'ready'|'flashing'|'success'|'error'} FlashPhase
 */

const SmalrubotFirmwareModal = ({ phase, progressPercent, statusMessage, errorMessage, onFlash, onClose }) => {
    const intl = useIntl();
    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            id="smalrubotFirmwareModal"
            onRequestClose={onClose}
        >
            <Box className={styles.body}>
                {phase === 'ready' && (
                    <React.Fragment>
                        <div className={styles.description}>
                            <FormattedMessage
                                defaultMessage="Write the SmalrubotS1 firmware to the Studuino board. Connect the board via USB cable, then press the button below."
                                description="Description for the smalrubot firmware flash modal"
                                id="gui.smalrubotFirmware.description"
                            />
                        </div>
                        <div className={styles.warning}>
                            <FormattedMessage
                                defaultMessage="Do not disconnect the USB cable during the firmware write process."
                                description="Warning message during firmware flash"
                                id="gui.smalrubotFirmware.warning"
                            />
                        </div>
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.flashButton}
                                data-testid="smalrubot-firmware-flash-button"
                                onClick={onFlash}
                            >
                                <FormattedMessage
                                    defaultMessage="Write Firmware"
                                    description="Button to start firmware flash"
                                    id="gui.smalrubotFirmware.flashButton"
                                />
                            </button>
                            <button className={styles.closeButton} onClick={onClose}>
                                <FormattedMessage
                                    defaultMessage="Cancel"
                                    description="Button to cancel firmware flash"
                                    id="gui.smalrubotFirmware.cancelButton"
                                />
                            </button>
                        </div>
                    </React.Fragment>
                )}
                {phase === 'flashing' && (
                    <div className={styles.progressArea}>
                        <div className={styles.progressBarContainer}>
                            <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
                        </div>
                        <div className={styles.progressText}>
                            <FormattedMessage
                                defaultMessage="Writing... {progressPercent}%"
                                description="Progress message during firmware flash"
                                id="gui.smalrubotFirmware.progress"
                                values={{ progressPercent: Math.floor(progressPercent) }}
                            />
                        </div>
                        {statusMessage && <div className={styles.statusMessage}>{statusMessage}</div>}
                    </div>
                )}
                {phase === 'success' && (
                    <React.Fragment>
                        <div className={styles.resultArea}>
                            <div className={styles.successMessage}>
                                <FormattedMessage
                                    defaultMessage="Firmware write successful!"
                                    description="Success message after firmware flash"
                                    id="gui.smalrubotFirmware.success"
                                />
                            </div>
                        </div>
                        <div className={styles.buttonRow}>
                            <button className={styles.flashButton} onClick={onClose}>
                                <FormattedMessage
                                    defaultMessage="Close"
                                    description="Button to close after successful firmware flash"
                                    id="gui.smalrubotFirmware.closeButton"
                                />
                            </button>
                        </div>
                    </React.Fragment>
                )}
                {phase === 'error' && (
                    <React.Fragment>
                        <div className={styles.resultArea}>
                            <div className={styles.errorMessage}>
                                <FormattedMessage
                                    defaultMessage="Firmware write failed."
                                    description="Error message after firmware flash failure"
                                    id="gui.smalrubotFirmware.error"
                                />
                            </div>
                            {errorMessage && (
                                <textarea className={styles.errorDetails} readOnly value={errorMessage} />
                            )}
                        </div>
                        <div className={styles.buttonRow}>
                            <button
                                className={styles.flashButton}
                                data-testid="smalrubot-firmware-retry-button"
                                onClick={onFlash}
                            >
                                <FormattedMessage
                                    defaultMessage="Try Again"
                                    description="Button to retry firmware flash"
                                    id="gui.smalrubotFirmware.retryButton"
                                />
                            </button>
                            <button className={styles.closeButton} onClick={onClose}>
                                <FormattedMessage
                                    defaultMessage="Close"
                                    description="Button to close after firmware flash error"
                                    id="gui.smalrubotFirmware.closeAfterErrorButton"
                                />
                            </button>
                        </div>
                    </React.Fragment>
                )}
            </Box>
        </Modal>
    );
};

SmalrubotFirmwareModal.propTypes = {
    errorMessage: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onFlash: PropTypes.func.isRequired,
    phase: PropTypes.oneOf(['ready', 'flashing', 'success', 'error']).isRequired,
    progressPercent: PropTypes.number,
    statusMessage: PropTypes.string,
};

SmalrubotFirmwareModal.defaultProps = {
    errorMessage: null,
    progressPercent: 0,
    statusMessage: null,
};

export default SmalrubotFirmwareModal;
