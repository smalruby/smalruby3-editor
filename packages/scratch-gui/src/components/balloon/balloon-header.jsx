// panel の吹き出しのヘッダー（色の帯 + 見出し + 閉じる）。
import PropTypes from 'prop-types';
import React from 'react';
import BalloonCloseButton from './balloon-close-button.jsx';
import styles from './balloon.css';

const BalloonHeader = ({ children, closeLabel, closeTestId, onClose }) => (
    <div className={styles.header}>
        <span className={styles.headerTitle}>{children}</span>
        {onClose ? <BalloonCloseButton label={closeLabel || ''} testId={closeTestId} onClick={onClose} /> : null}
    </div>
);

BalloonHeader.propTypes = {
    children: PropTypes.node,
    closeLabel: PropTypes.string,
    closeTestId: PropTypes.string,
    onClose: PropTypes.func,
};

export default BalloonHeader;
