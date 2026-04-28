import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import Box from '../box/box.jsx';
import styles from './connection-modal.css';
import Dots from './dots.jsx';
import connectedStyles from './smalrubot-s1-connected-step.css';

const SmalrubotS1ConnectedStep = props => (
    <Box className={styles.body}>
        <Box className={styles.activityArea}>
            <Box className={connectedStyles.message}>
                <div className={connectedStyles.checkmark}>{'✓'}</div>
                <div className={connectedStyles.title}>
                    <FormattedMessage
                        defaultMessage="Connected"
                        description="Message indicating that the Smalrubot S1 is connected"
                        id="gui.connection.smalrubotS1Connected.title"
                    />
                </div>
                <div className={connectedStyles.description}>
                    <FormattedMessage
                        defaultMessage="Your Smalrubot S1 is ready to use."
                        description="Description shown when the Smalrubot S1 is connected"
                        id="gui.connection.smalrubotS1Connected.description"
                    />
                </div>
            </Box>
        </Box>
        <Box className={styles.bottomArea}>
            <Dots success className={styles.bottomAreaItem} total={3} />
            <div className={classNames(styles.bottomAreaItem, styles.cornerButtons)}>
                <button
                    className={classNames(styles.redButton, styles.connectionButton)}
                    data-testid="smalrubot-s1-connected-disconnect"
                    onClick={props.onDisconnect}
                >
                    <FormattedMessage
                        defaultMessage="Disconnect"
                        description="Button to disconnect the device"
                        id="gui.connection.smalrubotS1Connected.disconnectButton"
                    />
                </button>
                <button
                    className={styles.connectionButton}
                    data-testid="smalrubot-s1-connected-close"
                    onClick={props.onClose}
                >
                    <FormattedMessage
                        defaultMessage="Go to Editor"
                        description="Button to return to the editor"
                        id="gui.connection.smalrubotS1Connected.goToEditorButton"
                    />
                </button>
            </div>
        </Box>
    </Box>
);

SmalrubotS1ConnectedStep.propTypes = {
    onClose: PropTypes.func.isRequired,
    onDisconnect: PropTypes.func.isRequired,
};

export default SmalrubotS1ConnectedStep;
