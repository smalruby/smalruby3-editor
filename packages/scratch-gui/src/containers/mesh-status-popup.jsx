import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import MeshStatusPopup from '../components/mesh-status-popup/mesh-status-popup.jsx';
import { assignPeerNumbers } from '../lib/mesh-v2-status.js';
import { setConnectionModalExtensionId } from '../reducers/connection-modal.js';
import { closeMeshV2StatusPopup } from '../reducers/mesh-v2.js';
import { openConnectionModal } from '../reducers/modals.js';

// 画面は VM の手元の値（getStatusSnapshot）を 1 秒ごとに読み直すだけ。サーバーには問い合わせない。
const SNAPSHOT_INTERVAL_MS = 1000;
// 人数を知るための listNodesInGroup は、開いたとき・つないだときと、開いている間 30 秒ごと。
// VM の側でも 30 秒に 1 回までにしている（MeshV2Service#refreshGroupNodes）。
const NODE_LIST_INTERVAL_MS = 30000;

const getExtension = (vm) =>
    vm && vm.runtime && vm.runtime.peripheralExtensions ? vm.runtime.peripheralExtensions.meshV2 : null;

const readSnapshot = (vm) => {
    const extension = getExtension(vm);
    return extension && typeof extension.getStatusSnapshot === 'function' ? extension.getStatusSnapshot() : null;
};

/**
 * メッシュの「状態と履歴」ウィンドウ (#1844) のコンテナ。いつもマウントしておき、開いている
 * ときだけ描く。
 * @param {object} props - props.
 * @param {boolean} props.isFullScreen - full-screen stage.
 * @param {boolean} props.isOpen - whether the window is open.
 * @param {Function} props.onClose - closes the window.
 * @param {Function} props.onOpenConnection - opens the connection modal.
 * @param {object} props.vm - the VM.
 * @returns {?React.ReactElement} the window, or null when closed.
 */
const MeshStatusPopupContainer = ({ isFullScreen, isOpen, onClose, onOpenConnection, vm }) => {
    const [snapshot, setSnapshot] = useState(null);
    const [peers, setPeers] = useState({});

    useEffect(() => {
        if (!isOpen || !vm) return () => {};
        const update = () => {
            const next = readSnapshot(vm);
            setSnapshot(next);
            if (next) {
                const ids = next.nodes.map((n) => n.id).concat(next.history.map((h) => h.nodeId));
                setPeers((prev) => assignPeerNumbers(prev, ids, next.selfId, next.inClassroom));
            }
        };
        const refreshNodes = () => {
            const extension = getExtension(vm);
            if (!extension || typeof extension.refreshGroupNodes !== 'function') return;
            if (extension.connectionState !== 'connected') return;
            extension
                .refreshGroupNodes()
                .then(update)
                .catch(() => {});
        };
        const handleConnected = () => {
            update();
            refreshNodes();
        };
        update();
        refreshNodes();
        const snapshotTimer = setInterval(update, SNAPSHOT_INTERVAL_MS);
        const nodeTimer = setInterval(refreshNodes, NODE_LIST_INTERVAL_MS);
        vm.on('PERIPHERAL_CONNECTED', handleConnected);
        vm.on('PERIPHERAL_DISCONNECTED', update);
        return () => {
            clearInterval(snapshotTimer);
            clearInterval(nodeTimer);
            vm.removeListener('PERIPHERAL_CONNECTED', handleConnected);
            vm.removeListener('PERIPHERAL_DISCONNECTED', update);
        };
    }, [isOpen, vm]);

    const handleConnect = useCallback(() => onOpenConnection(), [onOpenConnection]);

    if (!isOpen) return null;
    return (
        <MeshStatusPopup
            aboveStage={isFullScreen}
            onClose={onClose}
            onConnect={handleConnect}
            peers={peers}
            snapshot={snapshot}
        />
    );
};

MeshStatusPopupContainer.propTypes = {
    isFullScreen: PropTypes.bool,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onOpenConnection: PropTypes.func.isRequired,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    isFullScreen: !!state.scratchGui.mode.isFullScreen,
    isOpen: !!(state.scratchGui.meshV2 && state.scratchGui.meshV2.statusPopupOpen),
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = (dispatch) => ({
    onClose: () => dispatch(closeMeshV2StatusPopup()),
    onOpenConnection: () => {
        dispatch(setConnectionModalExtensionId('meshV2'));
        dispatch(openConnectionModal());
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(MeshStatusPopupContainer);
