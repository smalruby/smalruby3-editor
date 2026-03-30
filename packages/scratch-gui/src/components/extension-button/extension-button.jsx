import React, {useCallback, useContext} from 'react';
import classNames from 'classnames';
import {defineMessages, injectIntl} from 'react-intl';
import intlShape from '../../lib/intlShape.js';
import PropTypes from 'prop-types';

import Box from '../box/box.jsx';
import addExtensionIcon from '../gui/icon--extensions.svg';
import styles from './extension-button.css';
import {ModalFocusContext} from '../../contexts/modal-focus-context.jsx';

const messages = defineMessages({
    addExtension: {
        id: 'gui.gui.addExtension',
        description: 'Button to add an extension in the target pane',
        defaultMessage: 'Add Extension'
    },
    // === Smalruby: Start of DNCL extension alert ===
    dnclExtensionDisabled: {
        id: 'gui.extensionButton.dnclExtensionDisabled',
        description: 'Alert message when extension button is clicked in DNCL mode',
        defaultMessage: 'Extensions are not available in Japanese mode.'
    }
    // === Smalruby: End of DNCL extension alert ===
});

const ExtensionButton = props => {
    const {
        intl,
        dnclMode,
        onExtensionButtonClick
    } = props;
    const {captureFocus} = useContext(ModalFocusContext);

    const handleExtensionButtonClick = useCallback(() => {
        // === Smalruby: Start of DNCL extension alert ===
        if (dnclMode) {
            window.alert(intl.formatMessage(messages.dnclExtensionDisabled)); // eslint-disable-line no-alert
            return;
        }
        // === Smalruby: End of DNCL extension alert ===
        captureFocus();
        onExtensionButtonClick?.();
    }, [captureFocus, onExtensionButtonClick, dnclMode, intl]);

    return (
        <Box className={styles.extensionButtonContainer}>
            <button
                className={classNames(
                    styles.extensionButton,
                    {[styles.extensionButtonDisabled]: dnclMode}
                )}
                title={intl.formatMessage(messages.addExtension)}
                onClick={handleExtensionButtonClick}
                aria-label={intl.formatMessage(messages.addExtension)}
                data-testid="extension-button"
            >
                <img
                    className={styles.extensionButtonIcon}
                    draggable={false}
                    src={addExtensionIcon}
                />
            </button>
        </Box>
    );
};

ExtensionButton.propTypes = {
    dnclMode: PropTypes.bool,
    intl: intlShape.isRequired,
    onExtensionButtonClick: PropTypes.func
};

const ExtensionButtonIntl = injectIntl(ExtensionButton);

export default ExtensionButtonIntl;
