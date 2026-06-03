import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import MeshV2UpgradeModal from '../components/mesh-v2-upgrade-modal/mesh-v2-upgrade-modal.jsx';
import { closeMeshV2UpgradeModal, openMeshV2UpgradeModal } from '../reducers/mesh-v2.js';

const MESH_V2_EXTENSION_ID = 'meshV2';

// Static page served alongside about.html (see packages/scratch-gui/pages/).
const LEARN_MORE_URL = 'mesh-self-sensor.html';

// Always-mounted container that watches for the Mesh v2 extension being enabled
// and, when the current project has not opted into the self-inclusive "sensor
// value" behavior, prompts the user to switch. Shown every time the extension is
// enabled (Issue #707) so there is always a path to the new behavior, even for
// projects that were left on the legacy behavior.
const MeshV2UpgradeModalContainer = ({ vm, isOpen, onOpen, onClose }) => {
    // Keep the latest dispatchers in refs so the EXTENSION_ADDED listener is
    // attached once and never re-subscribes (mirrors mesh-v2-classroom-binding).
    const onOpenRef = useRef(onOpen);
    onOpenRef.current = onOpen;

    useEffect(() => {
        if (!vm) return () => {};
        const handleExtensionAdded = (categoryInfo) => {
            if (!categoryInfo || categoryInfo.id !== MESH_V2_EXTENSION_ID) return;
            if (vm.runtime && vm.runtime.meshSelfInclusive) return;
            onOpenRef.current();
        };
        vm.on('EXTENSION_ADDED', handleExtensionAdded);
        return () => vm.off('EXTENSION_ADDED', handleExtensionAdded);
    }, [vm]);

    const handleSwitchToNew = useCallback(() => {
        if (vm && vm.runtime) {
            vm.runtime.meshSelfInclusive = true;
            // Mark the project dirty so the choice gets persisted on save.
            if (typeof vm.emitProjectChanged === 'function') {
                vm.emitProjectChanged();
            }
        }
        onClose();
    }, [vm, onClose]);

    const handleKeepLegacy = useCallback(() => {
        // Persist nothing: the modal will appear again next time the extension is
        // enabled, keeping the upgrade path available.
        onClose();
    }, [onClose]);

    const handleLearnMore = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.open(LEARN_MORE_URL, '_blank', 'noopener,noreferrer');
        }
    }, []);

    if (!isOpen) return null;

    return (
        <MeshV2UpgradeModal
            onKeepLegacy={handleKeepLegacy}
            onLearnMore={handleLearnMore}
            onSwitchToNew={handleSwitchToNew}
        />
    );
};

MeshV2UpgradeModalContainer.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onOpen: PropTypes.func.isRequired,
    vm: PropTypes.object,
};

const mapStateToProps = (state) => ({
    isOpen: Boolean(state.scratchGui.meshV2.upgradeModalVisible),
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = (dispatch) => ({
    onOpen: () => dispatch(openMeshV2UpgradeModal()),
    onClose: () => dispatch(closeMeshV2UpgradeModal()),
});

export default connect(mapStateToProps, mapDispatchToProps)(MeshV2UpgradeModalContainer);
