import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { defineMessages, injectIntl } from 'react-intl';

import intlShape from '../../lib/intlShape.js';
import styles from './mesh-self-sensor-notice.css';

const messages = defineMessages({
    message: {
        id: 'gui.meshSelfSensorNotice.message',
        defaultMessage: 'Mesh "sensor value" now also reads your own variable of the same name.',
        description: 'One-time notice that the Mesh v2 sensor value behavior changed (self-inclusive)',
    },
    learnMore: {
        id: 'gui.meshSelfSensorNotice.learnMore',
        defaultMessage: 'Learn more',
        description: 'Link to the explanation page in the mesh self sensor notice',
    },
    dismiss: {
        id: 'gui.meshSelfSensorNotice.dismiss',
        defaultMessage: 'Close',
        description: 'Dismiss the mesh self sensor notice',
    },
});

const MeshSelfSensorNotice = ({ visible, onDismiss, onLearnMore, intl }) => {
    const handleLearnMore = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.open('mesh-self-sensor.html', '_blank', 'noopener,noreferrer');
        }
        onLearnMore?.();
    }, [onLearnMore]);

    if (!visible) return null;

    return (
        <div className={styles.notice} role="status" data-testid="mesh-self-sensor-notice">
            <span className={styles.icon} aria-hidden="true">
                {'🌐'}
            </span>
            <span className={styles.message}>{intl.formatMessage(messages.message)}</span>
            <button
                className={styles.learnMore}
                onClick={handleLearnMore}
                data-testid="mesh-self-sensor-notice-learn-more"
            >
                {intl.formatMessage(messages.learnMore)}
            </button>
            <button
                className={styles.close}
                onClick={onDismiss}
                aria-label={intl.formatMessage(messages.dismiss)}
                data-testid="mesh-self-sensor-notice-dismiss"
            >
                {'×'}
            </button>
        </div>
    );
};

MeshSelfSensorNotice.propTypes = {
    intl: intlShape.isRequired,
    onDismiss: PropTypes.func.isRequired,
    onLearnMore: PropTypes.func,
    visible: PropTypes.bool,
};

export { messages };
export default injectIntl(MeshSelfSensorNotice);
