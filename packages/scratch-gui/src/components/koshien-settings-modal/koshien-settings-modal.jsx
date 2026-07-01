import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, FormattedMessage} from 'react-intl';
import intlShape from '../../lib/intlShape.js';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import {
    loadKoshienConnection,
    saveKoshienConnection,
    wireKoshienRemoteOptions,
    testKoshienConnection,
} from '../../lib/koshien-connection.js';

import styles from './koshien-settings-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Koshien connection settings',
        description: 'Title for the Koshien connection settings modal',
        id: 'gui.koshienSettingsModal.title',
    },
});

/**
 * Modal to configure how the Koshien AI connects to a game server.
 * Settings are stored in localStorage and exposed to the VM extension via
 * vm.runtime.getKoshienRemoteOptions (see lib/koshien-connection).
 * @param {object} props - component props.
 * @returns {object} - the rendered modal.
 */
const KoshienSettingsModal = props => {
    const {intl, vm, onRequestClose} = props;
    const initial = loadKoshienConnection();
    const [endpoint, setEndpoint] = React.useState(initial.endpoint || '');
    const [side, setSide] = React.useState(Number(initial.side) === 2 ? 2 : 1);
    const [gameCode, setGameCode] = React.useState(initial.gameCode || '');
    const [testState, setTestState] = React.useState({status: 'idle', message: ''});

    const handleEndpointChange = React.useCallback(e => setEndpoint(e.target.value), []);
    const handleSideChange = React.useCallback(e => setSide(Number(e.target.value)), []);
    const handleGameCodeChange = React.useCallback(e => setGameCode(e.target.value), []);

    const handleTest = React.useCallback(async () => {
        setTestState({status: 'testing', message: ''});
        const result = await testKoshienConnection(endpoint.trim());
        setTestState({
            status: result.ok ? 'ok' : 'ng',
            message: result.message,
        });
    }, [endpoint]);

    const handleSave = React.useCallback(() => {
        saveKoshienConnection({endpoint: endpoint.trim(), side, gameCode: gameCode.trim()});
        // Re-install the runtime getter so the extension reads the latest settings.
        if (vm) wireKoshienRemoteOptions(vm);
        onRequestClose();
    }, [endpoint, side, gameCode, vm, onRequestClose]);

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
                            defaultMessage="Game server URL"
                            description="Label for the koshien game server URL field"
                            id="gui.koshienSettingsModal.endpoint"
                        />
                    </span>
                    <input
                        className={styles.input}
                        data-testid="koshien-settings-endpoint"
                        placeholder="https://example.com:3000"
                        type="text"
                        value={endpoint}
                        onChange={handleEndpointChange}
                    />
                </label>

                <label className={styles.field}>
                    <span className={styles.label}>
                        <FormattedMessage
                            defaultMessage="Player side"
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
                            defaultMessage="Game code"
                            description="Label for the koshien game code field"
                            id="gui.koshienSettingsModal.gameCode"
                        />
                    </span>
                    <input
                        className={styles.input}
                        data-testid="koshien-settings-game-code"
                        type="text"
                        value={gameCode}
                        onChange={handleGameCodeChange}
                    />
                </label>

                <Box className={styles.buttonRow}>
                    <button
                        className={styles.testButton}
                        data-testid="koshien-settings-test"
                        disabled={!endpoint.trim() || testState.status === 'testing'}
                        onClick={handleTest}
                    >
                        <FormattedMessage
                            defaultMessage="Test connection"
                            description="Button to test the koshien game server connection"
                            id="gui.koshienSettingsModal.test"
                        />
                    </button>
                    <button
                        className={styles.saveButton}
                        data-testid="koshien-settings-save"
                        onClick={handleSave}
                    >
                        <FormattedMessage
                            defaultMessage="Save"
                            description="Button to save the koshien connection settings"
                            id="gui.koshienSettingsModal.save"
                        />
                    </button>
                </Box>

                {testState.status !== 'idle' && (
                    <div
                        className={testState.status === 'ok' ? styles.resultOk : styles.resultNg}
                        data-testid="koshien-settings-test-result"
                    >
                        {testState.status === 'testing' ? (
                            <FormattedMessage
                                defaultMessage="Testing..."
                                description="Status while testing the koshien connection"
                                id="gui.koshienSettingsModal.testing"
                            />
                        ) : (
                            testState.message
                        )}
                    </div>
                )}
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
