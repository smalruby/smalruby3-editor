import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, FormattedMessage} from 'react-intl';
import intlShape from '../../lib/intlShape.js';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import {
    KOSHIEN_MOCK_MAPS,
    MAX_TURN_INTERVAL,
    loadKoshienMockConfig,
    saveKoshienMockConfig,
    wireKoshienMockConfig,
} from '../../lib/koshien-mock-config.js';

import styles from './koshien-settings-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Koshien practice settings',
        description: 'Title for the Koshien practice settings modal',
        id: 'gui.koshienSettingsModal.title',
    },
    rivalGoal: {
        defaultMessage: 'Heads for the goal',
        description: 'Rival AI option: goes straight for the goal',
        id: 'gui.koshienSettingsModal.rivalGoal',
    },
    rivalItem: {
        defaultMessage: 'Hunts for items',
        description: 'Rival AI option: prioritizes items',
        id: 'gui.koshienSettingsModal.rivalItem',
    },
    rivalStop: {
        defaultMessage: 'Stands still',
        description: 'Rival AI option: never moves',
        id: 'gui.koshienSettingsModal.rivalStop',
    },
    rivalRandom: {
        defaultMessage: 'Moves randomly',
        description: 'Rival AI option: moves at random',
        id: 'gui.koshienSettingsModal.rivalRandom',
    },
});

/**
 * Modal to configure the Koshien practice game: which practice map to play,
 * which side the user's AI takes and how the built-in rival behaves.
 * Settings are stored in localStorage and read by the VM extension every
 * time the AI connects (see lib/koshien-mock-config).
 * @param {object} props - component props.
 * @returns {object} - the rendered modal.
 */
const KoshienSettingsModal = props => {
    const {intl, vm, onRequestClose} = props;
    const initial = loadKoshienMockConfig();
    const [mapId, setMapId] = React.useState(initial.mapId);
    const [side, setSide] = React.useState(initial.side);
    const [rival, setRival] = React.useState(initial.rival);
    const [turnInterval, setTurnInterval] = React.useState(initial.turnInterval);

    const handleMapChange = React.useCallback(e => setMapId(e.target.value), []);
    const handleSideChange = React.useCallback(e => setSide(Number(e.target.value)), []);
    const handleRivalChange = React.useCallback(e => setRival(e.target.value), []);
    const handleTurnIntervalChange = React.useCallback(e => setTurnInterval(Number(e.target.value)), []);

    const handleSave = React.useCallback(() => {
        saveKoshienMockConfig({mapId, side, rival, turnInterval});
        // Re-install the runtime getter so the extension reads the latest settings.
        if (vm) wireKoshienMockConfig(vm);
        onRequestClose();
    }, [mapId, side, rival, turnInterval, vm, onRequestClose]);

    const rivalLabels = {
        goal: intl.formatMessage(messages.rivalGoal),
        item: intl.formatMessage(messages.rivalItem),
        stop: intl.formatMessage(messages.rivalStop),
        random: intl.formatMessage(messages.rivalRandom),
    };

    return (
        <Modal
            className={styles.modalContent}
            contentLabel={intl.formatMessage(messages.title)}
            id="koshienSettingsModal"
            onRequestClose={onRequestClose}
        >
            <Box className={styles.body}>
                <label className={styles.field}>
                    <span className={styles.label}>
                        <FormattedMessage
                            defaultMessage="Practice map"
                            description="Label for the koshien practice map field"
                            id="gui.koshienSettingsModal.map"
                        />
                    </span>
                    <select
                        className={styles.input}
                        data-testid="koshien-settings-map"
                        value={mapId}
                        onChange={handleMapChange}
                    >
                        {KOSHIEN_MOCK_MAPS.map(map => (
                            <option
                                key={map.id}
                                value={map.id}
                            >
                                {map.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className={styles.field}>
                    <span className={styles.label}>
                        <FormattedMessage
                            defaultMessage="Your player"
                            description="Label for the koshien player side field"
                            id="gui.koshienSettingsModal.side"
                        />
                    </span>
                    <select
                        className={styles.input}
                        data-testid="koshien-settings-side"
                        value={side}
                        onChange={handleSideChange}
                    >
                        <option value={1}>{'player1'}</option>
                        <option value={2}>{'player2'}</option>
                    </select>
                </label>

                <label className={styles.field}>
                    <span className={styles.label}>
                        <FormattedMessage
                            defaultMessage="Rival AI"
                            description="Label for the koshien rival AI field"
                            id="gui.koshienSettingsModal.rival"
                        />
                    </span>
                    <select
                        className={styles.input}
                        data-testid="koshien-settings-rival"
                        value={rival}
                        onChange={handleRivalChange}
                    >
                        {['goal', 'item', 'stop', 'random'].map(value => (
                            <option
                                key={value}
                                value={value}
                            >
                                {rivalLabels[value]}
                            </option>
                        ))}
                    </select>
                </label>

                <label className={styles.field}>
                    <span className={styles.label}>
                        <FormattedMessage
                            defaultMessage="Turn interval (sec)"
                            description="Label for the koshien per-turn sleep field"
                            id="gui.koshienSettingsModal.turnInterval"
                        />
                    </span>
                    <input
                        className={styles.input}
                        data-testid="koshien-settings-turn-interval"
                        max={MAX_TURN_INTERVAL}
                        min={0}
                        step={0.1}
                        type="number"
                        value={turnInterval}
                        onChange={handleTurnIntervalChange}
                    />
                </label>

                <div className={styles.hint}>
                    <FormattedMessage
                        defaultMessage="The settings apply the next time your AI connects to the game server."
                        description="Hint that saved koshien settings apply from the next connect"
                        id="gui.koshienSettingsModal.hint"
                    />
                </div>

                <Box className={styles.buttonRow}>
                    <button
                        className={styles.saveButton}
                        data-testid="koshien-settings-save"
                        onClick={handleSave}
                    >
                        <FormattedMessage
                            defaultMessage="Save"
                            description="Button to save the koshien practice settings"
                            id="gui.koshienSettingsModal.save"
                        />
                    </button>
                </Box>
            </Box>
        </Modal>
    );
};

KoshienSettingsModal.propTypes = {
    intl: intlShape.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    vm: PropTypes.shape({runtime: PropTypes.object}),
};

export default injectIntl(KoshienSettingsModal);
