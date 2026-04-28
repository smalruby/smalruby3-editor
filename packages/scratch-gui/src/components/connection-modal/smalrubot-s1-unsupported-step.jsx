import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import Box from '../box/box.jsx';
import styles from './connection-modal.css';
import Dots from './dots.jsx';
import helpIcon from './icons/help.svg';
import unsupportedStyles from './smalrubot-s1-unsupported-step.css';

const SmalrubotS1UnsupportedStep = props => (
    <Box className={styles.body}>
        <Box className={styles.activityArea}>
            <Box className={unsupportedStyles.message}>
                <div className={unsupportedStyles.title}>
                    <FormattedMessage
                        defaultMessage="WebSerial is not supported"
                        description="Title shown when WebSerial API is unavailable"
                        id="gui.connection.smalrubotS1Unsupported.title"
                    />
                </div>
                <div className={unsupportedStyles.description}>
                    <FormattedMessage
                        defaultMessage={
                            'Smalrubot S1 requires WebSerial API support, which is available in ' +
                            'Google Chrome, Microsoft Edge, and Opera on desktop. ' +
                            'Please use one of these browsers to use Smalrubot S1.'
                        }
                        description="Description shown when WebSerial API is unavailable"
                        id="gui.connection.smalrubotS1Unsupported.description"
                    />
                </div>
            </Box>
        </Box>
        <Box className={styles.bottomArea}>
            <Dots error className={styles.bottomAreaItem} total={1} />
            {props.onHelp && (
                <Box className={classNames(styles.bottomAreaItem, styles.buttonRow)}>
                    <button
                        className={styles.connectionButton}
                        data-testid="smalrubot-s1-unsupported-help"
                        onClick={props.onHelp}
                    >
                        <img className={styles.buttonIconLeft} src={helpIcon} />
                        <FormattedMessage
                            defaultMessage="Help"
                            description="Button to view help content"
                            id="gui.connection.smalrubotS1Unsupported.helpButton"
                        />
                    </button>
                </Box>
            )}
        </Box>
    </Box>
);

SmalrubotS1UnsupportedStep.propTypes = {
    onHelp: PropTypes.func,
};

export default SmalrubotS1UnsupportedStep;
