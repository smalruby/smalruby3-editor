import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import ConnectionModalComponent, {PHASES} from '../components/connection-modal/connection-modal.jsx';
import VM from '@smalruby/scratch-vm';
import analytics from '../lib/analytics';
import extensionData from '../lib/libraries/extensions/index.jsx';
import {connect} from 'react-redux';

import {closeConnectionModal, openConnectionModal} from '../reducers/modals';
import {setConnectionModalExtensionId} from '../reducers/connection-modal';
import {isMicroBitUpdateSupported, selectAndUpdateMicroBit} from '../lib/microbit-update';
import {
    isMicroBitUpdateSupported as isMicroBitMoreUpdateSupported,
    selectAndUpdateMicroBit as selectAndUpdateMicroBitMore
} from '../lib/microbit-more-update';
// === Smalruby: Start of meshV2 initial step feature ===
import {setDomain as setMeshV2Domain} from '../reducers/mesh-v2';
// === Smalruby: End of meshV2 initial step feature ===
// === Smalruby: Start of smalrubot firmware flash ===
import {isFirmwareFlashSupported, isWebSerialSupported} from '../lib/smalrubot-firmware-flasher';
import {openSmalrubotFirmwareModal} from '../reducers/smalrubot-firmware';
// === Smalruby: End of smalrubot firmware flash ===

// === Smalruby: Start of smalrubotS1 dedicated flow ===
// USB filter for Smalrubot S1 connection (Studuino TA, PL2303 chipset).
// This filter mirrors `serialPortFilter` in scratch3_smalrubot_s1/index.js.
const SMALRUBOT_S1_CONNECT_FILTER = {usbVendorId: 0x067b, usbProductId: 0x2303};
// === Smalruby: End of smalrubotS1 dedicated flow ===

class ConnectionModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleScanning',
            'handleCancel',
            'handleConnected',
            'handleConnecting',
            'handleDisconnect',
            'handleError',
            'handleHelp',
            'handleSendUpdate',
            'handleUpdatePeripheral',
            'handleUseLegacyMesh',
            // === Smalruby: Start of smalrubot firmware flash ===
            'handleFlashFirmware',
            // === Smalruby: End of smalrubot firmware flash ===
            // === Smalruby: Start of meshV2 initial step feature ===
            'handleMeshV2CreateGroup',
            'handleMeshV2JoinGroup',
            'handleMeshV2DomainChange',
            'handleBackToInitial',
            // === Smalruby: End of meshV2 initial step feature ===
            // === Smalruby: Start of smalrubotS1 dedicated flow ===
            'handleSmalrubotS1ChooseConnect',
            'handleSmalrubotS1ChooseFlashFirmware',
            'handleSmalrubotS1BackToInitial',
            'handleSmalrubotS1Retry',
            'handleSmalrubotS1Close'
            // === Smalruby: End of smalrubotS1 dedicated flow ===
        ]);
        // Determine the initial phase based on extension and connection state
        const initialPhase = (() => {
            const alreadyConnected = props.vm.getPeripheralIsConnected(props.extensionId);
            // === Smalruby: Start of smalrubotS1 dedicated flow ===
            if (props.extensionId === 'smalrubotS1') {
                if (alreadyConnected) return PHASES.smalrubotS1Connected;
                return isWebSerialSupported() ? PHASES.smalrubotS1Initial : PHASES.smalrubotS1Unsupported;
            }
            // === Smalruby: End of smalrubotS1 dedicated flow ===
            if (alreadyConnected) return PHASES.connected;
            // === Smalruby: Start of meshV2 initial step feature ===
            if (props.extensionId === 'meshV2') return PHASES.meshV2Initial;
            // === Smalruby: End of meshV2 initial step feature ===
            return PHASES.scanning;
        })();
        // Track whether the user explicitly changed the domain input.
        // When false and the user clicks Create/Join, we clear the cached
        // domain so createDomain() auto-detects from source IP.
        this.userChangedDomain = false;
        this.state = {
            extension: extensionData.find(ext => ext.extensionId === props.extensionId),
            phase: initialPhase,
            // === Smalruby: Start of meshV2 connected message feature ===
            connectedMessage: props.vm.getPeripheralConnectedMessage(props.extensionId)
            // === Smalruby: End of meshV2 connected message feature ===
        };
    }
    componentDidMount () {
        this.props.vm.on('PERIPHERAL_CONNECTED', this.handleConnected);
        this.props.vm.on('PERIPHERAL_REQUEST_ERROR', this.handleError);
    }
    componentWillUnmount () {
        this.props.vm.removeListener('PERIPHERAL_CONNECTED', this.handleConnected);
        this.props.vm.removeListener('PERIPHERAL_REQUEST_ERROR', this.handleError);
    }
    handleScanning () {
        this.setState({
            phase: PHASES.scanning
        });
    }
    handleConnecting (peripheralId) {
        this.props.vm.connectPeripheral(this.props.extensionId, peripheralId);
        this.setState({
            phase: PHASES.connecting
        });
        analytics.event({
            category: 'extensions',
            action: 'connecting',
            label: this.props.extensionId
        });
    }
    handleDisconnect () {
        try {
            // === Smalruby: Start of mesh_v2/smalrubot_s1 disconnect analytics ===
            try {
                if (this.props.extensionId === 'meshV2') {
                    analytics.event({
                        category: 'mesh_v2',
                        action: 'disconnect'
                    });
                } else if (this.props.extensionId === 'smalrubotS1') {
                    analytics.event({
                        category: 'smalrubot_s1',
                        action: 'disconnect'
                    });
                }
            } catch (_e) {
                // Swallow analytics failures so the editor never breaks.
            }
            // === Smalruby: End of mesh_v2/smalrubot_s1 disconnect analytics ===
            this.props.vm.disconnectPeripheral(this.props.extensionId);
        } finally {
            this.props.onCancel();
        }
    }
    handleCancel () {
        try {
            // If we're not connected to a peripheral, close the websocket so we stop scanning.
            if (!this.props.vm.getPeripheralIsConnected(this.props.extensionId)) {
                this.props.vm.disconnectPeripheral(this.props.extensionId);
            }
        } finally {
            // Close the modal.
            this.props.onCancel();
        }
    }
    handleError (event) {
        // Check if this is a network filter error (HTTP 503 from proxy like i-Filter)
        if (event && event.errorType === 'networkFilter' &&
            this.props.extensionId === 'meshV2') {
            this.setState({
                phase: PHASES.networkFiltered
            });
            analytics.event({
                category: 'extensions',
                action: 'network filter error',
                label: this.props.extensionId
            });
            return;
        }

        // === Smalruby: Start of smalrubotS1 dedicated flow ===
        // smalrubotS1 uses dedicated phases for error display
        if (this.props.extensionId === 'smalrubotS1') {
            this.setState({phase: PHASES.smalrubotS1Error});
            analytics.event({
                category: 'extensions',
                action: 'connecting error',
                label: this.props.extensionId
            });
            return;
        }
        // === Smalruby: End of smalrubotS1 dedicated flow ===

        // Assume errors that come in during scanning phase are the result of not
        // having scratch-link installed.
        if (this.state.phase === PHASES.scanning || this.state.phase === PHASES.unavailable) {
            this.setState({
                phase: PHASES.unavailable
            });
        } else {
            this.setState({
                phase: PHASES.error
            });
            analytics.event({
                category: 'extensions',
                action: 'connecting error',
                label: this.props.extensionId
            });
        }
    }
    handleConnected () {
        this.setState({
            // === Smalruby: Start of smalrubotS1 dedicated flow ===
            phase: this.props.extensionId === 'smalrubotS1' ?
                PHASES.smalrubotS1Connected :
                PHASES.connected,
            // === Smalruby: End of smalrubotS1 dedicated flow ===
            // === Smalruby: Start of meshV2 connected message feature ===
            connectedMessage: this.props.vm.getPeripheralConnectedMessage(this.props.extensionId)
            // === Smalruby: End of meshV2 connected message feature ===
        });
        analytics.event({
            category: 'extensions',
            action: 'connected',
            label: this.props.extensionId
        });
        // === Smalruby: Start of mesh_v2/smalrubot_s1 connect analytics ===
        try {
            if (this.props.extensionId === 'meshV2') {
                const meshExt = this.props.vm.runtime.peripheralExtensions.meshV2;
                const meshLabel = meshExt && meshExt._service && meshExt._service.useWebSocket === false ?
                    'polling' :
                    'websocket';
                analytics.event({
                    category: 'mesh_v2',
                    action: 'connect',
                    label: meshLabel
                });
            } else if (this.props.extensionId === 'smalrubotS1') {
                analytics.event({
                    category: 'smalrubot_s1',
                    action: 'connect'
                });
            }
        } catch (_e) {
            // Swallow analytics failures so the editor never breaks.
        }
        // === Smalruby: End of mesh_v2/smalrubot_s1 connect analytics ===
    }
    handleHelp () {
        window.open(this.state.extension.helpLink, '_blank');
        analytics.event({
            category: 'extensions',
            action: 'help',
            label: this.props.extensionId
        });
    }
    handleUpdatePeripheral () {
        this.setState({
            phase: PHASES.updatePeripheral
        });
        analytics.event({
            category: 'extensions',
            action: 'enter peripheral update flow',
            label: this.props.extensionId
        });
    }
    /**
     * Handle sending an update to the peripheral.
     * @param {function(number): void} [progressCallback] Optional callback for progress updates in the range of [0..1].
     * @returns {Promise} Resolves when the update is complete.
     */
    handleSendUpdate (progressCallback) {
        analytics.event({
            category: 'extensions',
            action: 'send update to peripheral',
            label: this.props.extensionId
        });

        // TODO: get this functionality from the extension
        if (this.props.extensionId === 'microbitMore') {
            return selectAndUpdateMicroBitMore(progressCallback);
        }
        return selectAndUpdateMicroBit(progressCallback);
    }
    // === Smalruby: Start of smalrubot firmware flash ===
    handleFlashFirmware () {
        analytics.event({
            category: 'extensions',
            action: 'open firmware flash from connection error',
            label: this.props.extensionId
        });
        // Opening firmware modal automatically closes connection modal
        // via cross-reducer in modals.js
        this.props.onOpenFirmwareModal();
    }
    // === Smalruby: End of smalrubot firmware flash ===
    handleUseLegacyMesh () {
        const meshExtensionId = 'mesh';

        analytics.event({
            category: 'extensions',
            action: 'use legacy mesh from network filter error',
            label: this.props.extensionId
        });

        // Close current modal first
        this.props.onCancel();

        // Wait for modal to close before loading mesh extension
        setTimeout(() => {
            // Load legacy mesh extension if not already loaded
            if (!this.props.vm.extensionManager.isExtensionLoaded(meshExtensionId)) {
                this.props.vm.extensionManager.loadExtensionURL(meshExtensionId);
            }

            // Open connection modal for mesh extension
            this.props.onUseLegacyMesh(meshExtensionId);
        }, 300); // Wait 300ms for modal close animation to complete
    }
    // === Smalruby: Start of meshV2 initial step feature ===
    handleMeshV2CreateGroup () {
        // If domain input is empty, clear any cached domain from localStorage
        // so that createDomain() will be called to auto-detect from source IP
        this.clearMeshV2DomainIfEmpty();
        // Connect as host using special host ID
        this.handleConnecting('meshV2_host');
        analytics.event({
            category: 'extensions',
            action: 'meshV2 create group',
            label: this.props.extensionId
        });
    }
    handleMeshV2JoinGroup () {
        // If domain input is empty, clear any cached domain from localStorage
        // so that createDomain() will be called to auto-detect from source IP
        this.clearMeshV2DomainIfEmpty();
        // Switch to scanning phase to show group list
        this.handleScanning();
        analytics.event({
            category: 'extensions',
            action: 'meshV2 join group',
            label: this.props.extensionId
        });
    }
    clearMeshV2DomainIfEmpty () {
        // Only clear the cached domain when both:
        // 1. User did not explicitly change the domain input in this modal session
        // 2. The domain input field is currently empty (no value from localStorage/Redux)
        // This preserves domains loaded from localStorage on modal reopen.
        if (!this.userChangedDomain && !this.props.meshV2Domain) {
            const extension = this.props.vm.runtime.peripheralExtensions.meshV2;
            if (extension && extension.setDomain) {
                extension.setDomain(null);
            }
            this.props.onDomainChange(null);
        }
    }
    handleMeshV2DomainChange (domain) {
        this.userChangedDomain = true;
        // Save domain to Redux
        this.props.onDomainChange(domain);

        // Save domain to VM extension
        const extension = this.props.vm.runtime.peripheralExtensions.meshV2;
        if (extension && extension.setDomain) {
            extension.setDomain(domain);
        }

        analytics.event({
            category: 'extensions',
            action: 'meshV2 domain change',
            label: this.props.extensionId
        });
    }
    // === Smalruby: Start of meshV2 back button feature ===
    handleBackToInitial () {
        // For meshV2, go back to initial step (mesh-v2-initial-step)
        this.setState({
            phase: PHASES.meshV2Initial
        });
        analytics.event({
            category: 'extensions',
            action: 'back to initial step',
            label: this.props.extensionId
        });
    }
    // === Smalruby: End of meshV2 back button feature ===
    // === Smalruby: End of meshV2 initial step feature ===
    // === Smalruby: Start of smalrubotS1 dedicated flow ===
    handleSmalrubotS1ChooseConnect () {
        analytics.event({
            category: 'extensions',
            action: 'smalrubotS1 choose connect',
            label: this.props.extensionId
        });
        this.setState({phase: PHASES.smalrubotS1Connecting});

        if (typeof navigator === 'undefined' || !navigator.serial) {
            this.setState({phase: PHASES.smalrubotS1Unsupported});
            return;
        }

        navigator.serial.requestPort({filters: [SMALRUBOT_S1_CONNECT_FILTER]})
            .then(port => {
                const peripheral = this.props.vm.runtime.peripheralExtensions[this.props.extensionId];
                if (!peripheral || !peripheral.connectDirect) {
                    throw new Error('Smalrubot S1 peripheral is not available.');
                }
                return peripheral.connectDirect(port);
            })
            .catch(error => {
                // User canceled the picker dialog: silently return to initial step.
                if (error && (error.name === 'NotFoundError' || error.name === 'AbortError')) {
                    this.setState({phase: PHASES.smalrubotS1Initial});
                    return;
                }
                // Real connection failure (or no peripheral): show error step.
                // PERIPHERAL_REQUEST_ERROR may have already set this; setState is idempotent.
                this.setState({phase: PHASES.smalrubotS1Error});
            });
    }
    handleSmalrubotS1ChooseFlashFirmware () {
        analytics.event({
            category: 'extensions',
            action: 'smalrubotS1 choose flash firmware',
            label: this.props.extensionId
        });
        // Opening firmware modal automatically closes connection modal
        // via cross-reducer in modals.js
        this.props.onOpenFirmwareModal();
    }
    handleSmalrubotS1BackToInitial () {
        this.setState({phase: PHASES.smalrubotS1Initial});
        analytics.event({
            category: 'extensions',
            action: 'smalrubotS1 back to initial',
            label: this.props.extensionId
        });
    }
    handleSmalrubotS1Retry () {
        this.handleSmalrubotS1ChooseConnect();
    }
    handleSmalrubotS1Close () {
        this.props.onCancel();
    }
    // === Smalruby: End of smalrubotS1 dedicated flow ===
    render () {
        const canUpdatePeripheral = ((this.props.extensionId === 'microbit') && isMicroBitUpdateSupported()) ||
            ((this.props.extensionId === 'microbitMore') && isMicroBitMoreUpdateSupported());
        // === Smalruby: Start of smalrubot firmware flash ===
        const canFlashFirmware = (this.props.extensionId === 'smalrubotS1') && isFirmwareFlashSupported();
        // === Smalruby: End of smalrubot firmware flash ===
        return (
            <ConnectionModalComponent
                connectingMessage={this.state.extension && this.state.extension.connectingMessage}
                connectionIconURL={this.state.extension && this.state.extension.connectionIconURL}
                // === Smalruby: Start of meshV2 connected message feature ===
                connectedMessage={this.state.connectedMessage}
                // === Smalruby: End of meshV2 connected message feature ===
                connectionSmallIconURL={this.state.extension && this.state.extension.connectionSmallIconURL}
                connectionTipIconURL={this.state.extension && this.state.extension.connectionTipIconURL}
                // === Smalruby: Start of meshV2 initial step feature ===
                domain={this.props.meshV2Domain}
                // === Smalruby: End of meshV2 initial step feature ===
                extensionId={this.props.extensionId}
                name={this.state.extension && this.state.extension.name}
                phase={this.state.phase}
                prescanMessage={this.state.extension && this.state.extension.prescanMessage}
                scanBeginMessage={this.state.extension && this.state.extension.scanBeginMessage}
                title={this.props.extensionId}
                useAutoScan={this.state.extension && this.state.extension.useAutoScan}
                useExternalPeripheralList={this.props.useExternalPeripheralList}
                vm={this.props.vm}
                // === Smalruby: Start of meshV2 back button feature ===
                onBack={this.props.extensionId === 'meshV2' ? this.handleBackToInitial : null}
                // === Smalruby: End of meshV2 back button feature ===
                onCancel={this.handleCancel}
                onConnected={this.handleConnected}
                onConnecting={this.handleConnecting}
                // === Smalruby: Start of meshV2 initial step feature ===
                onCreateGroup={this.handleMeshV2CreateGroup}
                onDomainChange={this.handleMeshV2DomainChange}
                onJoinGroup={this.handleMeshV2JoinGroup}
                // === Smalruby: End of meshV2 initial step feature ===
                onDisconnect={this.handleDisconnect}
                onHelp={this.handleHelp}
                onScanning={this.handleScanning}
                // === Smalruby: Start of smalrubot firmware flash ===
                onFlashFirmware={canFlashFirmware ? this.handleFlashFirmware : null}
                // === Smalruby: End of smalrubot firmware flash ===
                // === Smalruby: Start of smalrubotS1 dedicated flow ===
                onChooseConnect={this.handleSmalrubotS1ChooseConnect}
                onChooseFlashFirmware={this.handleSmalrubotS1ChooseFlashFirmware}
                onBackToInitial={this.handleSmalrubotS1BackToInitial}
                onRetry={this.handleSmalrubotS1Retry}
                onClose={this.handleSmalrubotS1Close}
                // === Smalruby: End of smalrubotS1 dedicated flow ===
                onSendPeripheralUpdate={canUpdatePeripheral ? this.handleSendUpdate : null}
                onUpdatePeripheral={canUpdatePeripheral ? this.handleUpdatePeripheral : null}
                onUseLegacyMesh={this.handleUseLegacyMesh}
            />
        );
    }
}

ConnectionModal.propTypes = {
    extensionId: PropTypes.string.isRequired,
    // === Smalruby: Start of meshV2 initial step feature ===
    meshV2Domain: PropTypes.string,
    onDomainChange: PropTypes.func.isRequired,
    // === Smalruby: End of meshV2 initial step feature ===
    onCancel: PropTypes.func.isRequired,
    // === Smalruby: Start of smalrubot firmware flash ===
    onOpenFirmwareModal: PropTypes.func.isRequired,
    // === Smalruby: End of smalrubot firmware flash ===
    onUseLegacyMesh: PropTypes.func.isRequired,
    useExternalPeripheralList: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => ({
    extensionId: state.scratchGui.connectionModal.extensionId,
    // === Smalruby: Start of meshV2 initial step feature ===
    meshV2Domain: state.scratchGui.meshV2.domain
    // === Smalruby: End of meshV2 initial step feature ===
});

const mapDispatchToProps = dispatch => ({
    onCancel: () => {
        dispatch(closeConnectionModal());
    },
    // === Smalruby: Start of meshV2 initial step feature ===
    onDomainChange: domain => {
        dispatch(setMeshV2Domain(domain));
    },
    // === Smalruby: End of meshV2 initial step feature ===
    // === Smalruby: Start of smalrubot firmware flash ===
    onOpenFirmwareModal: () => {
        dispatch(openSmalrubotFirmwareModal());
    },
    // === Smalruby: End of smalrubot firmware flash ===
    onUseLegacyMesh: extensionId => {
        dispatch(setConnectionModalExtensionId(extensionId));
        dispatch(openConnectionModal());
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ConnectionModal);
