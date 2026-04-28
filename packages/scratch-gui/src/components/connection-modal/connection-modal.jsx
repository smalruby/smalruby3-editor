import PropTypes from 'prop-types';
import React from 'react';
import keyMirror from 'keymirror';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';

import ScanningStep from '../../containers/scanning-step.jsx';
import AutoScanningStep from '../../containers/auto-scanning-step.jsx';
import ConnectingStep from './connecting-step.jsx';
import ConnectedStep from './connected-step.jsx';
import ErrorStep from './error-step.jsx';
import UnavailableStep from './unavailable-step.jsx';
import UpdatePeripheralStep from './update-peripheral-step.jsx';
// === Smalruby: Start of network filter detection feature ===
import MeshV2NetworkFilteredStep from './mesh-v2-network-filtered-step.jsx';
// === Smalruby: End of network filter detection feature ===
// === Smalruby: Start of meshV2 initial step feature ===
import MeshV2InitialStep from './mesh-v2-initial-step.jsx';
// === Smalruby: End of meshV2 initial step feature ===
// === Smalruby: Start of smalrubotS1 dedicated flow ===
import SmalrubotS1InitialStep from './smalrubot-s1-initial-step.jsx';
import SmalrubotS1UnsupportedStep from './smalrubot-s1-unsupported-step.jsx';
import SmalrubotS1ConnectingStep from './smalrubot-s1-connecting-step.jsx';
import SmalrubotS1ConnectedStep from './smalrubot-s1-connected-step.jsx';
import SmalrubotS1ErrorStep from './smalrubot-s1-error-step.jsx';
// === Smalruby: End of smalrubotS1 dedicated flow ===

import styles from './connection-modal.css';

const PHASES = keyMirror({
    scanning: null,
    connecting: null,
    connected: null,
    error: null,
    unavailable: null,
    // === Smalruby: Start of network filter detection feature ===
    networkFiltered: null,
    // === Smalruby: End of network filter detection feature ===
    // === Smalruby: Start of meshV2 initial step feature ===
    meshV2Initial: null,
    // === Smalruby: End of meshV2 initial step feature ===
    // === Smalruby: Start of smalrubotS1 dedicated flow ===
    smalrubotS1Initial: null,
    smalrubotS1Unsupported: null,
    smalrubotS1Connecting: null,
    smalrubotS1Connected: null,
    smalrubotS1Error: null,
    // === Smalruby: End of smalrubotS1 dedicated flow ===
    updatePeripheral: null
});

const ConnectionModalComponent = props => {
    // ScanningStep allows the user to choose a peripheral from a list.
    // AutoScanningStep connects to the first peripheral found.
    // Also, AutoScanningStep adds "prescan" and "pressbutton" phases before the actual scan.
    // When useExternalPeripheralList is true, force the use of AutoScanningStep:
    // - We want to automatically connect to the first peripheral "found" since it's actually the one selected by the
    //   user from the external list.
    // - We want to show the "prescan" phase to inform the user before the external list appears.
    // - The "pressbutton" phase doesn't hurt: it might be hidden behind the external list (especially with Android
    //   CDM) or it might help the user to keep the peripheral device awake.
    // TODO: does forcing AutoScanningStep mean we can eliminate the `USER_PICKED_PERIPHERAL` message?
    const ScanningStepContainer = (
        (props.useAutoScan || props.useExternalPeripheralList) ?
            AutoScanningStep :
            ScanningStep
    );
    return (<Modal
        className={styles.modalContent}
        contentLabel={typeof props.name === 'string' ? props.name : props.title}
        headerTitle={props.name}
        headerClassName={styles.header}
        headerImage={props.connectionSmallIconURL}
        id="connectionModal"
        onHelp={props.onHelp}
        onRequestClose={props.onCancel}
    >
        <Box className={styles.body}>
            {props.phase === PHASES.scanning && <ScanningStepContainer {...props} />}
            {props.phase === PHASES.connecting && <ConnectingStep {...props} />}
            {props.phase === PHASES.connected && <ConnectedStep {...props} />}
            {props.phase === PHASES.error && <ErrorStep {...props} />}
            {props.phase === PHASES.unavailable && <UnavailableStep {...props} />}
            {/* === Smalruby: Start of network filter detection feature === */}
            {props.phase === PHASES.networkFiltered && <MeshV2NetworkFilteredStep {...props} />}
            {/* === Smalruby: End of network filter detection feature === */}
            {/* === Smalruby: Start of meshV2 initial step feature === */}
            {props.phase === PHASES.meshV2Initial && <MeshV2InitialStep {...props} />}
            {/* === Smalruby: End of meshV2 initial step feature === */}
            {/* === Smalruby: Start of smalrubotS1 dedicated flow === */}
            {props.phase === PHASES.smalrubotS1Initial && <SmalrubotS1InitialStep {...props} />}
            {props.phase === PHASES.smalrubotS1Unsupported && <SmalrubotS1UnsupportedStep {...props} />}
            {props.phase === PHASES.smalrubotS1Connecting && <SmalrubotS1ConnectingStep {...props} />}
            {props.phase === PHASES.smalrubotS1Connected && <SmalrubotS1ConnectedStep {...props} />}
            {props.phase === PHASES.smalrubotS1Error && <SmalrubotS1ErrorStep {...props} />}
            {/* === Smalruby: End of smalrubotS1 dedicated flow === */}
            {props.phase === PHASES.updatePeripheral && <UpdatePeripheralStep {...props} />}
        </Box>
    </Modal>);
};

ConnectionModalComponent.propTypes = {
    connectingMessage: PropTypes.node.isRequired,
    connectionIconURL: PropTypes.string,
    connectionSmallIconURL: PropTypes.string,
    connectionTipIconURL: PropTypes.string,
    name: PropTypes.node,
    onCancel: PropTypes.func.isRequired,
    onFlashFirmware: PropTypes.func, // === Smalruby: smalrubot firmware flash ===
    onHelp: PropTypes.func.isRequired,
    // === Smalruby: Start of smalrubotS1 dedicated flow ===
    onChooseConnect: PropTypes.func,
    onChooseFlashFirmware: PropTypes.func,
    onBackToInitial: PropTypes.func,
    onRetry: PropTypes.func,
    onClose: PropTypes.func,
    // === Smalruby: End of smalrubotS1 dedicated flow ===
    phase: PropTypes.oneOf(Object.keys(PHASES)).isRequired,
    prescanMessage: PropTypes.node,
    scanBeginMessage: PropTypes.node,
    title: PropTypes.string.isRequired,
    useAutoScan: PropTypes.bool.isRequired,
    useExternalPeripheralList: PropTypes.bool
};

ConnectionModalComponent.defaultProps = {
    connectingMessage: 'Connecting'
};

export {
    ConnectionModalComponent as default,
    PHASES
};
