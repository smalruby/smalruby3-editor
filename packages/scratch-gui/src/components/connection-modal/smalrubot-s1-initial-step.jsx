import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import Box from '../box/box.jsx';
import styles from './connection-modal.css';
import helpIcon from './icons/help.svg';
import initialStyles from './smalrubot-s1-initial-step.css';

const SmalrubotS1InitialStep = props => (
    <Box className={styles.body}>
        <Box className={initialStyles.activityArea}>
            <div className={initialStyles.intro}>
                <FormattedMessage
                    defaultMessage={
                        'How do you want to use Smalrubot S1? ' +
                        'If this is your first time, please write the firmware first.'
                    }
                    description="Introduction text on the Smalrubot S1 initial step"
                    id="gui.connection.smalrubotS1Initial.intro"
                />
            </div>
            <div className={initialStyles.buttonContainer}>
                <button
                    className={initialStyles.actionButton}
                    data-testid="smalrubot-s1-initial-connect"
                    onClick={props.onChooseConnect}
                >
                    <div className={initialStyles.buttonTitle}>
                        <FormattedMessage
                            defaultMessage="Connect (for students)"
                            description="Button to connect to a Smalrubot S1 (student usage)"
                            id="gui.connection.smalrubotS1Initial.connect"
                        />
                    </div>
                    <div className={initialStyles.buttonDescription}>
                        <FormattedMessage
                            defaultMessage="Connect to a Smalrubot S1 with firmware already written."
                            description="Description for the connect option"
                            id="gui.connection.smalrubotS1Initial.connectDescription"
                        />
                    </div>
                </button>
                <button
                    className={initialStyles.actionButton}
                    data-testid="smalrubot-s1-initial-flash-firmware"
                    onClick={props.onChooseFlashFirmware}
                >
                    <div className={initialStyles.buttonTitle}>
                        <FormattedMessage
                            defaultMessage="Write firmware (for teachers)"
                            description="Button to flash firmware to a Smalrubot S1 (teacher usage)"
                            id="gui.connection.smalrubotS1Initial.flashFirmware"
                        />
                    </div>
                    <div className={initialStyles.buttonDescription}>
                        <FormattedMessage
                            defaultMessage="Write firmware to a new Smalrubot S1."
                            description="Description for the flash firmware option"
                            id="gui.connection.smalrubotS1Initial.flashFirmwareDescription"
                        />
                    </div>
                </button>
            </div>
        </Box>
        <Box className={styles.bottomArea}>
            {props.onHelp && (
                <Box className={classNames(styles.bottomAreaItem, styles.buttonRow)}>
                    <button
                        className={styles.connectionButton}
                        data-testid="smalrubot-s1-initial-help"
                        onClick={props.onHelp}
                    >
                        <img className={styles.buttonIconLeft} src={helpIcon} />
                        <FormattedMessage
                            defaultMessage="Help"
                            description="Button to view help content"
                            id="gui.connection.smalrubotS1Initial.helpButton"
                        />
                    </button>
                </Box>
            )}
        </Box>
    </Box>
);

SmalrubotS1InitialStep.propTypes = {
    onChooseConnect: PropTypes.func.isRequired,
    onChooseFlashFirmware: PropTypes.func.isRequired,
    onHelp: PropTypes.func,
};

export default SmalrubotS1InitialStep;
