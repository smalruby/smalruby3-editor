import PropTypes from 'prop-types';
import React from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';

import styles from './mesh-v2-upgrade-modal.css';

const messages = defineMessages({
    title: {
        id: 'gui.meshV2UpgradeModal.title',
        defaultMessage: 'About the Mesh "sensor value" block',
        description: 'Mesh v2 self-inclusive upgrade modal title',
    },
    body: {
        id: 'gui.meshV2UpgradeModal.body',
        defaultMessage:
            'This project uses the old behavior: the "sensor value" block does not ' +
            'read your own global variables, only those of other connected projects. ' +
            'You can switch to the new behavior, where the block also reads your own ' +
            'variables. Keep going as is, or switch now?',
        description: 'Mesh v2 upgrade modal explanation paragraph',
    },
    switchToNew: {
        id: 'gui.meshV2UpgradeModal.switchToNew',
        defaultMessage: 'Switch to the new behavior',
        description: 'Mesh v2 upgrade modal primary button — opt into self-inclusive behavior',
    },
    keepLegacy: {
        id: 'gui.meshV2UpgradeModal.keepLegacy',
        defaultMessage: 'Keep going as is',
        description: 'Mesh v2 upgrade modal secondary button — keep legacy behavior',
    },
    learnMore: {
        id: 'gui.meshV2UpgradeModal.learnMore',
        defaultMessage: 'Learn more',
        description: 'Mesh v2 upgrade modal link to the explanation page',
    },
});

const MeshV2UpgradeModal = ({ onSwitchToNew, onKeepLegacy, onLearnMore }) => (
    <div
        className={styles.overlay}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mesh-v2-upgrade-modal-title"
        data-testid="mesh-v2-upgrade-modal"
    >
        <div className={styles.dialog}>
            <div className={styles.dialogBody}>
                <h2 className={styles.title} id="mesh-v2-upgrade-modal-title">
                    <FormattedMessage {...messages.title} />
                </h2>
                <p className={styles.body}>
                    <FormattedMessage {...messages.body} />
                </p>
                <button
                    className={styles.linkButton}
                    onClick={onLearnMore}
                    data-testid="mesh-v2-upgrade-learn-more"
                >
                    <FormattedMessage {...messages.learnMore} />
                </button>
            </div>
            <div className={styles.buttons}>
                <button
                    className={styles.primaryButton}
                    onClick={onSwitchToNew}
                    data-testid="mesh-v2-upgrade-switch"
                >
                    <FormattedMessage {...messages.switchToNew} />
                </button>
                <button
                    className={styles.secondaryButton}
                    onClick={onKeepLegacy}
                    data-testid="mesh-v2-upgrade-keep"
                >
                    <FormattedMessage {...messages.keepLegacy} />
                </button>
            </div>
        </div>
    </div>
);

MeshV2UpgradeModal.propTypes = {
    onKeepLegacy: PropTypes.func.isRequired,
    onLearnMore: PropTypes.func.isRequired,
    onSwitchToNew: PropTypes.func.isRequired,
};

export { messages };
export default MeshV2UpgradeModal;
