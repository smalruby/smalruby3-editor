// The face of "生成AI に相談" with its 「AI に相談」 label (#1414), the same in the code
// tab and the Ruby tab. Both open (or close) the panel.
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import { FormattedMessage } from 'react-intl';
import styles from './genai-concierge.css';
import messages from './messages.js';

const GenaiFace = ({ title, label, onClick }) => (
    <div className={styles.faceRow}>
        <button className={styles.face} data-testid="genai-face" onClick={onClick} title={title} aria-label={title}>
            <svg className={styles.faceIcon} viewBox="0 0 40 40" aria-hidden="true">
                <circle className={styles.faceSkin} cx="20" cy="20" r="15" strokeWidth="2" />
                <circle className={styles.faceEye} cx="14.5" cy="18" r="2" />
                <circle className={styles.faceEye} cx="25.5" cy="18" r="2" />
                <path className={styles.faceMouth} d="M14 25 q6 5 12 0" strokeWidth="2" strokeLinecap="round" />
            </svg>
        </button>
        {label !== 'none' && (
            <button className={styles.faceLabel} data-testid="genai-face-label" onClick={onClick} title={title}>
                <span className={classNames(styles.faceLabelBubble, { [styles.faceLabelShort]: label === 'short' })}>
                    <FormattedMessage {...(label === 'short' ? messages.faceLabelShort : messages.faceLabel)} />
                </span>
            </button>
        )}
    </div>
);

GenaiFace.propTypes = {
    title: PropTypes.string.isRequired,
    // Which label goes beside the face (faceLabel in src/lib/genai-concierge-state.js).
    label: PropTypes.oneOf(['full', 'short', 'none']).isRequired,
    onClick: PropTypes.func.isRequired,
};

export default GenaiFace;
