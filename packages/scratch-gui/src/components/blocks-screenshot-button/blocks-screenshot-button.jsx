import PropTypes from 'prop-types';
import React from 'react';
import cameraIcon from './icon--camera.svg';
import styles from './blocks-screenshot-button.css';

const BlocksScreenshotButton = ({onClick}) => (
    <button
        className={styles.screenshotButton}
        title="命令ブロックを画像として保存"
        onClick={onClick}
    >
        <img
            alt="命令ブロックを画像として保存"
            className={styles.screenshotIcon}
            draggable={false}
            src={cameraIcon}
        />
    </button>
);

BlocksScreenshotButton.propTypes = {
    onClick: PropTypes.func.isRequired
};

export default BlocksScreenshotButton;
