import {FormattedMessage} from 'react-intl';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';

import Box from '../box/box.jsx';
import Dots from './dots.jsx';
import helpIcon from './icons/help.svg';
import backIcon from './icons/back.svg';
import enterUpdateIcon from './icons/enter-update.svg';

import styles from './connection-modal.css';

const ErrorStep = props => (
    <Box className={styles.body}>
        <Box className={styles.activityArea}>
            <Box className={styles.centeredRow}>
                <div className={styles.peripheralActivity}>
                    <img
                        className={styles.peripheralActivityIcon}
                        src={props.connectionIconURL}
                    />
                </div>
            </Box>
        </Box>
        <Box className={styles.bottomArea}>
            <div className={classNames(styles.bottomAreaItem, styles.instructions)}>
                <FormattedMessage
                    defaultMessage="Oops, looks like something went wrong."
                    description="The device connection process has encountered an error."
                    id="gui.connection.error.errorMessage"
                />
            </div>
            {props.onUpdatePeripheral && (
                <div className={classNames(styles.bottomAreaItem, styles.instructions)}>
                    <FormattedMessage
                        defaultMessage="If you don't see your device, you may need to update it to work with Scratch."
                        description="Prompt for updating a peripheral device"
                        id="gui.connection.scanning.updatePeripheralPrompt"
                    />
                </div>
            )}
            <Dots
                error
                className={styles.bottomAreaItem}
                total={3}
            />
            <Box className={classNames(styles.bottomAreaItem, styles.buttonRow)}>
                <button
                    className={styles.connectionButton}
                    onClick={props.onScanning}
                >
                    <img
                        className={classNames(styles.buttonIconLeft, styles.buttonIconBack)}
                        src={backIcon}
                    />
                    <FormattedMessage
                        defaultMessage="Try again"
                        description="Button to initiate trying the device connection again after an error"
                        id="gui.connection.error.tryagainbutton"
                    />
                </button>
                <button
                    className={styles.connectionButton}
                    onClick={props.onHelp}
                >
                    <img
                        className={styles.buttonIconLeft}
                        src={helpIcon}
                    />
                    <FormattedMessage
                        defaultMessage="Help"
                        description="Button to view help content"
                        id="gui.connection.error.helpbutton"
                    />
                </button>
                {props.onUpdatePeripheral && (
                    <button
                        className={styles.connectionButton}
                        onClick={props.onUpdatePeripheral}
                    >
                        <FormattedMessage
                            defaultMessage="Update my Device"
                            description="Button to enter the peripheral update mode"
                            id="gui.connection.error.updatePeripheralButton"
                        />
                        <img
                            className={styles.buttonIconRight}
                            src={enterUpdateIcon}
                        />
                    </button>
                )}
                {/* === Smalruby: Start of smalrubot firmware flash === */}
                {props.onFlashFirmware && (
                    <button
                        className={styles.connectionButton}
                        data-testid="connection-error-flash-firmware"
                        onClick={props.onFlashFirmware}
                    >
                        <FormattedMessage
                            defaultMessage="Write Firmware"
                            description="Button to open the firmware flash modal for SmalrubotS1"
                            id="gui.connection.error.flashFirmwareButton"
                        />
                        <img
                            className={styles.buttonIconRight}
                            src={enterUpdateIcon}
                        />
                    </button>
                )}
                {/* === Smalruby: End of smalrubot firmware flash === */}
            </Box>
        </Box>
    </Box>
);

ErrorStep.propTypes = {
    connectionIconURL: PropTypes.string.isRequired,
    onFlashFirmware: PropTypes.func, // === Smalruby: smalrubot firmware flash ===
    onHelp: PropTypes.func,
    onScanning: PropTypes.func,
    onUpdatePeripheral: PropTypes.func
};

export default ErrorStep;
