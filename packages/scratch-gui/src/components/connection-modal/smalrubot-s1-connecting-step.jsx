import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import Box from '../box/box.jsx';
import styles from './connection-modal.css';
import Dots from './dots.jsx';
import backIcon from './icons/back.svg';
import connectingStyles from './smalrubot-s1-connecting-step.css';

const SmalrubotS1ConnectingStep = (props) => (
    <Box className={styles.body}>
        <Box className={styles.activityArea}>
            <Box className={connectingStyles.message}>
                <div className={connectingStyles.heading}>
                    <div className={connectingStyles.spinner} />
                    <div className={connectingStyles.title}>
                        <FormattedMessage
                            defaultMessage="Connecting..."
                            description="Heading shown while connecting to a Smalrubot S1"
                            id="gui.connection.smalrubotS1Connecting.title"
                        />
                    </div>
                </div>
                <div className={connectingStyles.description}>
                    <FormattedMessage
                        defaultMessage={
                            'Please select your Smalrubot S1 in the serial port dialog. ' +
                            'If the dialog does not appear, click "Back" and try again.'
                        }
                        description="Instruction shown while waiting for serial port selection"
                        id="gui.connection.smalrubotS1Connecting.description"
                    />
                </div>
            </Box>
        </Box>
        <Box className={styles.bottomArea}>
            <Dots className={styles.bottomAreaItem} counter={1} total={3} />
            <Box className={classNames(styles.bottomAreaItem, styles.buttonRow)}>
                <button
                    className={styles.connectionButton}
                    data-testid="smalrubot-s1-connecting-back"
                    onClick={props.onBackToInitial}
                >
                    <img className={classNames(styles.buttonIconLeft, styles.buttonIconBack)} src={backIcon} />
                    <FormattedMessage
                        defaultMessage="Back"
                        description="Button to return to the initial step"
                        id="gui.connection.smalrubotS1.backButton"
                    />
                </button>
            </Box>
        </Box>
    </Box>
);

SmalrubotS1ConnectingStep.propTypes = {
    onBackToInitial: PropTypes.func.isRequired,
};

export default SmalrubotS1ConnectingStep;
