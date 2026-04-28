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
 * @typedef {'macSetup'|'ready'|'flashing'|'success'|'error'} FlashPhase
 */

const MAC_APP_STORE_URL = 'https://apps.apple.com/jp/app/pl2303-serial/id1624835354?mt=12';

const SmalrubotFirmwareModal = ({
    phase,
    progressPercent,
    statusMessage,
    errorMessage,
    onFlash,
    onClose,
    onProceedToReady,
}) => {
    const intl = useIntl();
    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            id="smalrubotFirmwareModal"
            onRequestClose={onClose}
        >
            <Box className={styles.body}>
                {phase === 'macSetup' && (
                    <React.Fragment>
                        <div className={styles.description}>
                            <FormattedMessage
                                defaultMessage="To flash firmware on macOS, you need to install the PL2303 Serial Driver app from the Mac App Store."
                                description="Description for macOS setup step in firmware flash modal"
                                id="gui.smalrubotFirmware.macSetupDescription"
                            />
                        </div>
                        <div className={styles.description}>
                            <a
                                className={styles.appStoreLink}
                                href={MAC_APP_STORE_URL}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                <FormattedMessage
                                    defaultMessage="Open in Mac App Store"
                                    description="Link to PL2303 Serial app on Mac App Store"
                                    id="gui.smalrubotFirmware.macSetupLink"
                                />
                            </a>
                        </div>
                        <div className={styles.description}>
                            <FormattedMessage
                                defaultMessage="Install and set up the app following the instructions on the app page."
                                description="Instruction for macOS setup step"
                                id="gui.smalrubotFirmware.macSetupInstruction"
                            />
                        </div>
                        <div className={styles.buttonRow}>
                            <button className={styles.flashButton} onClick={onProceedToReady}>
                                <FormattedMessage
                                    defaultMessage="Setup Complete, Proceed to Flash"
                                    description="Button to proceed from macOS setup to firmware flash"
                                    id="gui.smalrubotFirmware.macSetupProceed"
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
                {phase === 'ready' && (
                    <React.Fragment>
                        <div className={styles.description}>
                            <FormattedMessage
                                defaultMessage="Write the SmalrubotS1 firmware to the Studuino board. Connect the board via USB cable, then press the button below and select your Smalrubot S1 in the serial port dialog."
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
    onProceedToReady: PropTypes.func,
    phase: PropTypes.oneOf(['macSetup', 'ready', 'flashing', 'success', 'error']).isRequired,
    progressPercent: PropTypes.number,
    statusMessage: PropTypes.string,
};

SmalrubotFirmwareModal.defaultProps = {
    errorMessage: null,
    onProceedToReady: null,
    progressPercent: 0,
    statusMessage: null,
};

export default SmalrubotFirmwareModal;
