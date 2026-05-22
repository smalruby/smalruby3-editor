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
    // === Smalruby: Start of DNCL extension confirm ===
    dnclExtensionConfirm: {
        id: 'gui.extensionButton.dnclExtensionConfirm',
        description: 'Confirm dialog when extension button is clicked in DNCL mode',
        defaultMessage: 'Extensions are not available in Japanese mode.\nReturn to Ruby furigana mode to enable extensions.\nSwitch now?'
    }
    // === Smalruby: End of DNCL extension confirm ===
});

const ExtensionButton = props => {
    const {
        intl,
        dnclMode,
        onExtensionButtonClick,
        onRequestExitDnclMode
    } = props;
    const {captureFocus} = useContext(ModalFocusContext);

    const handleExtensionButtonClick = useCallback(() => {
        // === Smalruby: Start of DNCL extension confirm ===
        if (dnclMode) {
            // eslint-disable-next-line no-alert
            const confirmed = window.confirm(intl.formatMessage(messages.dnclExtensionConfirm));
            if (!confirmed) return;
            onRequestExitDnclMode?.();
            onExtensionButtonClick?.();
            return;
        }
        // === Smalruby: End of DNCL extension confirm ===
        captureFocus();
        onExtensionButtonClick?.();
    }, [captureFocus, onExtensionButtonClick, onRequestExitDnclMode, dnclMode, intl]);

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
    onExtensionButtonClick: PropTypes.func,
    onRequestExitDnclMode: PropTypes.func
};

const ExtensionButtonIntl = injectIntl(ExtensionButton);

export default ExtensionButtonIntl;
