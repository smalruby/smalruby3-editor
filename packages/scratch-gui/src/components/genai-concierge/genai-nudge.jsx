// The face's offer to help, shown after the student has done nothing for a while.
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';

import styles from './genai-concierge.css';
import messages from './messages.js';

const GenaiNudge = ({ onOpen, onLater, onOff }) => (
    <div className={styles.bubble} data-testid="genai-nudge">
        <p>
            <FormattedMessage {...messages.nudgeText} />
        </p>
        <div className={styles.row}>
            <button className={styles.primary} data-testid="genai-nudge-open" onClick={onOpen}>
                <FormattedMessage {...messages.nudgeOpen} />
            </button>
            <button data-testid="genai-nudge-later" onClick={onLater}>
                <FormattedMessage {...messages.nudgeLater} />
            </button>
            <button data-testid="genai-nudge-off" onClick={onOff}>
                <FormattedMessage {...messages.nudgeOff} />
            </button>
        </div>
    </div>
);

GenaiNudge.propTypes = {
    onOpen: PropTypes.func.isRequired,
    onLater: PropTypes.func.isRequired,
    onOff: PropTypes.func.isRequired,
};

export default GenaiNudge;
