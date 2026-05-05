import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import Box from '../box/box.jsx';
import styles from './connection-modal.css';
import Dots from './dots.jsx';
import backIcon from './icons/back.svg';
import errorStyles from './smalrubot-s1-error-step.css';

const SmalrubotS1ErrorStep = (props) => (
    <Box className={styles.body}>
        <Box className={styles.activityArea}>
            <Box className={errorStyles.message}>
                <div className={errorStyles.title}>
                    <FormattedMessage
                        defaultMessage="Connection failed"
                        description="Title shown when connection to Smalrubot S1 has failed"
                        id="gui.connection.smalrubotS1Error.title"
                    />
                </div>
                <div className={errorStyles.description}>
                    <FormattedMessage
                        defaultMessage={
                            'Could not connect to Smalrubot S1. ' +
                            'Make sure your device is plugged in and try again.'
                        }
                        description="Description shown when connection has failed"
                        id="gui.connection.smalrubotS1Error.description"
                    />
                </div>
            </Box>
        </Box>
        <Box className={styles.bottomArea}>
            <Dots error className={styles.bottomAreaItem} total={3} />
            <Box className={classNames(styles.bottomAreaItem, styles.buttonRow)}>
                <button
                    className={styles.connectionButton}
                    data-testid="smalrubot-s1-error-back"
                    onClick={props.onBackToInitial}
                >
                    <img className={classNames(styles.buttonIconLeft, styles.buttonIconBack)} src={backIcon} />
                    <FormattedMessage
                        defaultMessage="Back"
                        description="Button to return to the initial step"
                        id="gui.connection.smalrubotS1.backButton"
                    />
                </button>
                <button
                    className={styles.connectionButton}
                    data-testid="smalrubot-s1-error-retry"
                    onClick={props.onRetry}
                >
                    <FormattedMessage
                        defaultMessage="Try again"
                        description="Button to retry the connection after an error"
                        id="gui.connection.smalrubotS1Error.retryButton"
                    />
                </button>
            </Box>
        </Box>
    </Box>
);

SmalrubotS1ErrorStep.propTypes = {
    onBackToInitial: PropTypes.func.isRequired,
    onRetry: PropTypes.func.isRequired,
};

export default SmalrubotS1ErrorStep;
