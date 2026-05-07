import PropTypes from 'prop-types';
import classNames from 'classnames';
import React from 'react';
// === Smalruby: Start of conversion overlay imports ===
import {FormattedMessage} from 'react-intl';
// === Smalruby: End of conversion overlay imports ===
import Box from '../box/box.jsx';
import styles from './blocks.css';

const BlocksComponent = props => {
    const {
        containerRef,
        dragOver,
        // === Smalruby: Start of conversion overlay prop ===
        isReloading,
        // === Smalruby: End of conversion overlay prop ===
        ...componentProps
    } = props;
    return (
        <Box
            className={classNames(styles.blocks, {
                [styles.dragOver]: dragOver
            })}
            {...componentProps}
            componentRef={containerRef}
        >
            {/* === Smalruby: Start of conversion overlay render === */}
            {isReloading ? (
                <div className={styles.reloadOverlay}>
                    <div className={styles.reloadOverlaySpinner} />
                    <div className={styles.reloadOverlayLabel}>
                        <FormattedMessage
                            defaultMessage="Converting…"
                            description="Overlay shown while Ruby code is being converted to blocks"
                            id="gui.blocks.converting"
                        />
                    </div>
                </div>
            ) : null}
            {/* === Smalruby: End of conversion overlay render === */}
        </Box>
    );
};
BlocksComponent.propTypes = {
    containerRef: PropTypes.func,
    dragOver: PropTypes.bool,
    // === Smalruby: Start of conversion overlay propType ===
    isReloading: PropTypes.bool
    // === Smalruby: End of conversion overlay propType ===
};
export default BlocksComponent;
