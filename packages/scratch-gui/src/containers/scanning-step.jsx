import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import ScanningStepComponent from '../components/connection-modal/scanning-step.jsx';
// === Smalruby: Start of meshV2 scanning step ===
import MeshV2ScanningStepComponent from '../components/connection-modal/mesh-v2-scanning-step.jsx';
// === Smalruby: End of meshV2 scanning step ===
import VM from '@smalruby/scratch-vm';

/**
 * Scan for a peripheral and allow the user to choose from a list of those discovered.
 * Does not support "prescan" and "pressbutton" phases.
 */
class ScanningStep extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handlePeripheralListUpdate',
            'handlePeripheralScanTimeout',
            'handleUserPickedPeripheral',
            'handleRefresh',
            // === Smalruby: Start of meshV2 name search ===
            'handleHiraganaInput',
            'handleHiraganaClear'
            // === Smalruby: End of meshV2 name search ===
        ]);
        this.state = {
            scanning: true,
            peripheralList: [],
            // === Smalruby: Start of meshV2 name search ===
            hiraganaInput: '',
            nameSearching: false,
            nameSearchResults: []
            // === Smalruby: End of meshV2 name search ===
        };
    }
    componentDidMount () {
        this.props.vm.scanForPeripheral(this.props.extensionId);
        this.props.vm.on(
            'PERIPHERAL_LIST_UPDATE', this.handlePeripheralListUpdate);
        this.props.vm.on(
            'PERIPHERAL_SCAN_TIMEOUT', this.handlePeripheralScanTimeout);
        this.props.vm.on(
            'USER_PICKED_PERIPHERAL', this.handleUserPickedPeripheral);
    }
    componentWillUnmount () {
        // @todo: stop the peripheral scan here
        this.props.vm.removeListener(
            'PERIPHERAL_LIST_UPDATE', this.handlePeripheralListUpdate);
        this.props.vm.removeListener(
            'PERIPHERAL_SCAN_TIMEOUT', this.handlePeripheralScanTimeout);
        this.props.vm.removeListener(
            'USER_PICKED_PERIPHERAL', this.handleUserPickedPeripheral);
    }
    handlePeripheralScanTimeout () {
        this.setState({
            scanning: false,
            peripheralList: []
        });
    }
    handlePeripheralListUpdate (newList) {
        // TODO: sort peripherals by signal strength? so they don't jump around
        const peripheralArray = Object.keys(newList).map(id =>
            newList[id]
        );
        this.setState({peripheralList: peripheralArray});
    }
    handleUserPickedPeripheral (newList) {
        const peripheralArray = Object.keys(newList).map(id =>
            newList[id]
        );
        this.setState({peripheralList: peripheralArray});
        if (peripheralArray.length > 0) {
            this.props.onConnecting(peripheralArray[0].peripheralId);
        }
    }
    handleRefresh () {
        this.props.vm.scanForPeripheral(this.props.extensionId);
        this.setState({
            scanning: true,
            peripheralList: []
        });
    }
    // === Smalruby: Start of meshV2 name search ===
    handleHiraganaInput (char) {
        const newInput = this.state.hiraganaInput + char;
        this.setState({hiraganaInput: newInput});

        if (newInput.length >= 6) {
            this.setState({nameSearching: true, nameSearchResults: []});
            const extension = this.props.vm.runtime.peripheralExtensions.meshV2;
            if (extension && extension.searchByName) {
                extension.searchByName(newInput.slice(0, 6))
                    .then(results => {
                        this.setState({
                            nameSearching: false,
                            nameSearchResults: results
                        });
                    })
                    .catch(() => {
                        this.setState({
                            nameSearching: false,
                            nameSearchResults: []
                        });
                    });
            }
        }
    }
    handleHiraganaClear () {
        this.setState({
            hiraganaInput: '',
            nameSearching: false,
            nameSearchResults: []
        });
    }
    // === Smalruby: End of meshV2 name search ===
    render () {
        // === Smalruby: Start of meshV2 scanning step ===
        if (this.props.extensionId === 'meshV2') {
            return (
                <MeshV2ScanningStepComponent
                    connectionSmallIconURL={this.props.connectionSmallIconURL}
                    peripheralList={this.state.peripheralList}
                    scanning={this.state.scanning}
                    onBack={this.props.onBack}
                    onConnected={this.props.onConnected}
                    onConnecting={this.props.onConnecting}
                    onRefresh={this.handleRefresh}
                    hiraganaInput={this.state.hiraganaInput}
                    nameSearching={this.state.nameSearching}
                    nameSearchResults={this.state.nameSearchResults}
                    onHiraganaInput={this.handleHiraganaInput}
                    onHiraganaClear={this.handleHiraganaClear}
                />
            );
        }
        // === Smalruby: End of meshV2 scanning step ===
        return (
            <ScanningStepComponent
                connectionSmallIconURL={this.props.connectionSmallIconURL}
                peripheralList={this.state.peripheralList}
                scanning={this.state.scanning}
                onConnected={this.props.onConnected}
                onConnecting={this.props.onConnecting}
                onRefresh={this.handleRefresh}
                onUpdatePeripheral={this.props.onUpdatePeripheral}
            />
        );
    }
}

ScanningStep.propTypes = {
    connectionSmallIconURL: PropTypes.string,
    extensionId: PropTypes.string.isRequired,
    onBack: PropTypes.func,
    onConnected: PropTypes.func.isRequired,
    onConnecting: PropTypes.func.isRequired,
    onUpdatePeripheral: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};

export default ScanningStep;
