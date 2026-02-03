import {FormattedMessage} from 'react-intl';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';

import Box from '../box/box.jsx';
import Dots from './dots.jsx';
import helpIcon from './icons/help.svg';
import backIcon from './icons/back.svg';
import enterUpdateIcon from './icons/enter-update.svg';
import bluetoothIcon from './icons/bluetooth.svg';
import scratchLinkIcon from './icons/scratchlink.svg';

import styles from './connection-modal.css';

const UnavailableStep = props => (
    <Box className={styles.body}>
        <Box className={styles.activityArea}>
            <div className={styles.scratchLinkHelp}>
                <div className={styles.scratchLinkHelpStep}>
                    <div className={styles.helpStepNumber}>
                        {'1'}
                    </div>
                    <div className={styles.helpStepImage}>
                        <img
                            className={styles.scratchLinkIcon}
                            src={scratchLinkIcon}
                        />
                    </div>
                    <div className={styles.helpStepText}>
                        <FormattedMessage
                            defaultMessage="Make sure you have Scratch Link installed and running"
                            description="Message for getting Scratch Link installed"
                            id="gui.connection.unavailable.installscratchlink"
                        />
                    </div>
                </div>
                <div className={styles.scratchLinkHelpStep}>
                    <div className={styles.helpStepNumber}>
                        {'2'}
                    </div>
                    <div className={styles.helpStepImage}>
                        <img
                            className={styles.scratchLinkIcon}
                            src={bluetoothIcon}
                        />
                    </div>
                    <div className={styles.helpStepText}>
                        <FormattedMessage
                            defaultMessage="Check that Bluetooth is enabled"
                            description="Message for making sure Bluetooth is enabled"
                            id="gui.connection.unavailable.enablebluetooth"
                        />
                    </div>
                </div>
            </div>
        </Box>
        <Box className={styles.bottomArea}>
            <Dots
                error
                className={styles.bottomAreaItem}
                total={3}
            />
            {props.onUpdatePeripheral && (
                <div className={classNames(styles.bottomAreaItem, styles.instructions)}>
                    <FormattedMessage
                        defaultMessage="If you don't see your device, you may need to update it to work with Scratch."
                        description="Prompt for updating a peripheral device"
                        id="gui.connection.scanning.updatePeripheralPrompt"
                    />
                </div>
            )}
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
                        id="gui.connection.unavailable.tryagainbutton"
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
                        id="gui.connection.unavailable.helpbutton"
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
                            id="gui.connection.unavailable.updatePeripheralButton"
                        />
                        <img
                            className={styles.buttonIconRight}
                            src={enterUpdateIcon}
                        />
                    </button>
                )}
            </Box>
        </Box>
    </Box>
);

UnavailableStep.propTypes = {
    onHelp: PropTypes.func,
    onScanning: PropTypes.func,
    onUpdatePeripheral: PropTypes.func
};

export default UnavailableStep;
