// 動かし方を切り替えられないときのダイアログ（#2214・S11）。
// 「使えないブロックが n 個あるので切り替えられません」＋［ブロックを見る］［すべて消して切り替える］［やめる］。
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import Modal from '../../containers/modal.jsx';
import Box from '../box/box.jsx';
import styles from './studuino-mode-switch-dialog.css';

const messages = defineMessages({
    toStuduino: {
        defaultMessage: 'Switch to the Studuino mode',
        description: 'Title of the dialog shown when the project can not be switched to the Studuino mode',
        id: 'gui.studuinoMode.switchDialog.toStuduinoTitle',
    },
    toNormal: {
        defaultMessage: 'Switch to the normal mode',
        description: 'Title of the dialog shown when the project can not be switched to the normal mode',
        id: 'gui.studuinoMode.switchDialog.toNormalTitle',
    },
});

const StuduinoModeSwitchDialog = ({ count, toStuduino, onCancel, onClearAndSwitch, onShowBlocks }) => {
    const intl = useIntl();
    return (
        <Modal
            contentLabel={intl.formatMessage(toStuduino ? messages.toStuduino : messages.toNormal)}
            id="studuinoModeSwitchDialog"
            onRequestClose={onCancel}
        >
            <Box className={styles.body} data-testid="studuino-mode-switch-dialog">
                <p className={styles.message}>
                    <FormattedMessage
                        defaultMessage="{count} blocks can not be used, so the mode can not be switched."
                        description="Message of the dialog shown when the mode can not be switched"
                        id="gui.studuinoMode.switchDialog.message"
                        values={{ count }}
                    />
                </p>
                <div className={styles.buttons}>
                    <button
                        className={classNames(styles.button, styles.primary)}
                        data-testid="studuino-mode-switch-dialog-show-blocks"
                        onClick={onShowBlocks}
                    >
                        <FormattedMessage
                            defaultMessage="Show the blocks"
                            description="Button to show the blocks that can not be used"
                            id="gui.studuinoMode.switchDialog.showBlocks"
                        />
                    </button>
                    <button
                        className={classNames(styles.button, styles.danger)}
                        data-testid="studuino-mode-switch-dialog-clear"
                        onClick={onClearAndSwitch}
                    >
                        <FormattedMessage
                            defaultMessage="Delete all and switch"
                            description="Button to delete all the blocks (same as a new project) and switch the mode"
                            id="gui.studuinoMode.switchDialog.clearAndSwitch"
                        />
                    </button>
                    <button
                        className={styles.button}
                        data-testid="studuino-mode-switch-dialog-cancel"
                        onClick={onCancel}
                    >
                        <FormattedMessage
                            defaultMessage="Cancel"
                            description="Button to close the dialog without switching the mode"
                            id="gui.studuinoMode.switchDialog.cancel"
                        />
                    </button>
                </div>
            </Box>
        </Modal>
    );
};

StuduinoModeSwitchDialog.propTypes = {
    count: PropTypes.number.isRequired,
    toStuduino: PropTypes.bool.isRequired,
    onCancel: PropTypes.func.isRequired,
    onClearAndSwitch: PropTypes.func.isRequired,
    onShowBlocks: PropTypes.func.isRequired,
};

export default StuduinoModeSwitchDialog;
