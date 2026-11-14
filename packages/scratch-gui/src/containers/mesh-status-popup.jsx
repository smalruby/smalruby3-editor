import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import MeshStatusPopup from '../components/mesh-status-popup/mesh-status-popup.jsx';
import { listProjectMeshItems, MESH_PRACTICE_PARTNER_NODE_ID, withPracticeNodes } from '../lib/mesh-practice/partner';
import { projectKeyOf } from '../lib/mesh-practice/storage';
import { useMeshPracticePartner } from '../lib/mesh-practice/use-mesh-practice-partner';
import { updatePeerNumbers } from '../lib/mesh-v2-status.js';
import { setConnectionModalExtensionId } from '../reducers/connection-modal.js';
import { closeMeshV2StatusPopup } from '../reducers/mesh-v2.js';
import { openConnectionModal } from '../reducers/modals.js';
import { setFullScreen } from '../reducers/mode.js';

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

const stageOf = (vm) => (vm && vm.runtime && vm.runtime.getTargetForStage ? vm.runtime.getTargetForStage() : null);

const EMPTY_ITEMS = { messages: [], variables: [] };

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * 練習相手が動いているあいだ（つないでいない）、練習相手を「相手」の 1 人として足す (#1845)。
 * @param {object} vm - the VM.
 * @param {?object} snapshot - getStatusSnapshot().
 * @returns {?object} snapshot.
 */
const withPractice = (vm, snapshot) => {
    const extension = getExtension(vm);
    const service = extension && extension.meshService;
    if (!snapshot || !service) return snapshot;
    const selfVariables = typeof service.getGlobalVariables === 'function' ? service.getGlobalVariables() : [];
    return withPracticeNodes(snapshot, {
        selfVariables: selfVariables.map((v) => ({ name: v.key, value: v.value })),
        partnerData: (service.remoteData || {})[MESH_PRACTICE_PARTNER_NODE_ID],
    });
};

/**
 * メッシュの「状態と履歴」ウィンドウ (#1844) のコンテナ。いつもマウントしておき、開いている
 * ときだけ描く。
 * @param {object} props - props.
 * @param {boolean} props.isFullScreen - full-screen stage.
 * @param {boolean} props.isOpen - whether the window is open.
 * @param {Function} props.onClose - closes the window.
 * @param {Function} props.onOpenConnection - opens the connection modal.
 * @param {?string} props.projectKey - key of the project for the practice partner settings.
 * @param {object} props.vm - the VM.
 * @returns {?React.ReactElement} the window, or null when closed.
 */
const MeshStatusPopupContainer = ({ isFullScreen, isOpen, onClose, onOpenConnection, projectKey = null, vm }) => {
    const [snapshot, setSnapshot] = useState(null);
    const [peerState, setPeerState] = useState({ groupId: null, peers: {} });
    const [items, setItems] = useState(EMPTY_ITEMS);
    // 練習相手 (#1845) はウィンドウを閉じても動き続けるので、開いているかどうかに関わらず呼ぶ
    const practice = useMeshPracticePartner({ vm, projectKey });
    const practiceActiveRef = useRef(practice.active);
    practiceActiveRef.current = practice.active;

    useEffect(() => {
        if (!isOpen || !vm) return () => {};
        const update = () => {
            const raw = readSnapshot(vm);
            const next = practiceActiveRef.current ? withPractice(vm, raw) : raw;
            setSnapshot(next);
            if (next) setPeerState((prev) => updatePeerNumbers(prev, next));
            // 作品のメッセージと変数（練習相手のタブに自動で並べる）。変わったときだけ描き直す
            const found = listProjectMeshItems(stageOf(vm));
            setItems((prev) =>
                sameList(prev.messages, found.messages) && sameList(prev.variables, found.variables) ? prev : found,
            );
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

    // 練習相手を入れた・切った・何かしたら、すぐに状態と履歴を描き直す（1 秒待たない）
    useEffect(() => {
        if (!isOpen || !vm) return;
        const raw = readSnapshot(vm);
        setSnapshot(practice.active ? withPractice(vm, raw) : raw);
    }, [isOpen, vm, practice.active, practice.revision, practice.settings]);

    const handleConnect = useCallback(() => onOpenConnection(), [onOpenConnection]);

    if (!isOpen) return null;
    return (
        <MeshStatusPopup
            aboveStage={isFullScreen}
            messageNames={items.messages}
            onClose={onClose}
            onConnect={handleConnect}
            peers={peerState.peers}
            practice={practice}
            projectVariables={items.variables}
            snapshot={snapshot}
        />
    );
};

MeshStatusPopupContainer.propTypes = {
    isFullScreen: PropTypes.bool,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onOpenConnection: PropTypes.func.isRequired,
    // 練習相手の設定をブラウザに覚えるときの作品のキー (#1845)
    projectKey: PropTypes.string,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    isFullScreen: !!state.scratchGui.mode.isFullScreen,
    isOpen: !!(state.scratchGui.meshV2 && state.scratchGui.meshV2.statusPopupOpen),
    projectKey: projectKeyOf({
        projectId: state.scratchGui.projectState && state.scratchGui.projectState.projectId,
        projectTitle: state.scratchGui.projectTitle,
    }),
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = (dispatch) => ({
    onClose: () => dispatch(closeMeshV2StatusPopup()),
    onOpenConnection: () => {
        // The connection modal sits below the full-screen stage, so leave full screen
        // first (#1844 review FYI2). Outside full screen this does nothing.
        dispatch(setFullScreen(false));
        dispatch(setConnectionModalExtensionId('meshV2'));
        dispatch(openConnectionModal());
    },
});

export { MeshStatusPopupContainer };
export default connect(mapStateToProps, mapDispatchToProps)(MeshStatusPopupContainer);
