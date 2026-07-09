import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import styles from './palette-toggle.css';

const PaletteToggle = ({paletteVisible, onClick, style}) => (
    <button
        className={classNames(
            styles.paletteToggleButton,
            {[styles.paletteToggleButtonHidden]: !paletteVisible}
        )}
        style={style}
        title={paletteVisible ? 'ブロックパレットを隠す' : 'ブロックパレットを表示する'}
        data-testid="palette-toggle-button"
        onClick={onClick}
    >
        {paletteVisible ? '◀' : '▶'}
    </button>
);

PaletteToggle.propTypes = {
    onClick: PropTypes.func.isRequired,
    paletteVisible: PropTypes.bool.isRequired,
    style: PropTypes.object
};

export default PaletteToggle;
