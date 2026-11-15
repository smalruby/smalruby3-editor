import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { FormattedMessage } from 'react-intl';
import { connect } from 'react-redux';
import { openMeshV2StatusPopup } from '../../reducers/mesh-v2.js';
import styles from './connection-modal.css';

/**
 * 接続済みの画面から、メッシュの「状態と履歴」ウィンドウを開くリンク (#1844)。
 * 接続のモーダルを閉じてからウィンドウを開く（モーダルの後ろにウィンドウが隠れないように）。
 * @param {object} props - props.
 * @param {Function} props.onCloseModal - closes the connection modal.
 * @param {Function} props.onOpenStatus - opens the status window.
 * @returns {React.ReactElement} the button.
 */
const MeshV2OpenStatusButton = ({ onCloseModal, onOpenStatus }) => {
    const handleClick = useCallback(() => {
        if (onCloseModal) onCloseModal();
        onOpenStatus();
    }, [onCloseModal, onOpenStatus]);
    return (
        <button className={styles.connectionButton} data-testid="mesh-v2-open-status" onClick={handleClick}>
            <FormattedMessage
                defaultMessage="Status and history"
                description="Button in the mesh connected step that opens the mesh status window"
                id="gui.connection.meshV2.openStatus"
            />
        </button>
    );
};

MeshV2OpenStatusButton.propTypes = {
    onCloseModal: PropTypes.func,
    onOpenStatus: PropTypes.func.isRequired,
};

const mapDispatchToProps = (dispatch) => ({
    onOpenStatus: () => dispatch(openMeshV2StatusPopup()),
});

export default connect(null, mapDispatchToProps)(MeshV2OpenStatusButton);
