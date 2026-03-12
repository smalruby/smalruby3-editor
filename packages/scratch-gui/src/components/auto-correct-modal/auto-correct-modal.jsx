// === Smalruby: This file is Smalruby-specific (auto-correct settings modal) ===
import PropTypes from 'prop-types';
import React, {useCallback} from 'react';
import {defineMessages, injectIntl} from 'react-intl';
import intlShape from '../../lib/intlShape.js';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';

import styles from './auto-correct-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Auto-Correct Settings',
        description: 'Title for the auto-correct settings modal',
        id: 'gui.autoCorrectModal.title'
    },
    fullwidthNumbers: {
        defaultMessage: 'Fullwidth numbers → Halfwidth numbers',
        description: 'Setting for fullwidth number conversion',
        id: 'gui.autoCorrectModal.fullwidthNumbers'
    },
    fullwidthAlpha: {
        defaultMessage: 'Fullwidth alphabet → Halfwidth alphabet',
        description: 'Setting for fullwidth alphabet conversion',
        id: 'gui.autoCorrectModal.fullwidthAlpha'
    },
    fullwidthSymbols: {
        defaultMessage: 'Fullwidth symbols → Halfwidth symbols',
        description: 'Setting for fullwidth symbol conversion',
        id: 'gui.autoCorrectModal.fullwidthSymbols'
    },
    fullwidthSpace: {
        defaultMessage: 'Fullwidth space → Halfwidth space',
        description: 'Setting for fullwidth space conversion',
        id: 'gui.autoCorrectModal.fullwidthSpace'
    },
    replaceInStrings: {
        defaultMessage: 'Also replace inside strings',
        description: 'Setting for replacing inside string literals',
        id: 'gui.autoCorrectModal.replaceInStrings'
    }
});

const SETTING_KEYS = [
    'fullwidthNumbers',
    'fullwidthAlpha',
    'fullwidthSymbols',
    'fullwidthSpace',
    'replaceInStrings'
];

const AutoCorrectModal = ({intl, settings, onSettingChange, onRequestClose}) => {
    const handleChange = useCallback(event => {
        const key = event.target.getAttribute('data-setting');
        const checked = event.target.checked;
        onSettingChange(key, checked);
    }, [onSettingChange]);

    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            headerClassName={styles.header}
            id="autoCorrectModal"
            onRequestClose={onRequestClose}
        >
            <Box className={styles.body}>
                {SETTING_KEYS.map(key => (
                    <div
                        key={key}
                        className={styles.settingItem}
                    >
                        <label className={styles.settingLabel}>
                            <input
                                type="checkbox"
                                className={styles.checkbox}
                                data-setting={key}
                                checked={settings[key]}
                                onChange={handleChange}
                            />
                            {intl.formatMessage(messages[key])}
                        </label>
                    </div>
                ))}
            </Box>
        </Modal>
    );
};

AutoCorrectModal.propTypes = {
    intl: intlShape.isRequired,
    settings: PropTypes.shape({
        fullwidthNumbers: PropTypes.bool.isRequired,
        fullwidthAlpha: PropTypes.bool.isRequired,
        fullwidthSymbols: PropTypes.bool.isRequired,
        fullwidthSpace: PropTypes.bool.isRequired,
        replaceInStrings: PropTypes.bool.isRequired
    }).isRequired,
    onSettingChange: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func.isRequired
};

export default injectIntl(AutoCorrectModal);
