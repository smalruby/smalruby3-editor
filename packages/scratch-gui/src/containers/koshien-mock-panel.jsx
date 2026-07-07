// === Smalruby: This file is Smalruby-specific (Koshien practice game panel) ===
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import KoshienMockPanelComponent from '../components/koshien-mock-panel/koshien-mock-panel.jsx';
import { closeKoshienMockPanel, openKoshienMockPanel } from '../reducers/koshien-mock-panel';

// Runtime event the koshien VM extension emits on every mock state change
// (KoshienBlocks.MOCK_STATE_EVENT). The latest snapshot is also kept on
// vm.runtime.koshienMockState.
const MOCK_STATE_EVENT = 'KOSHIEN_MOCK_STATE';

/**
 * Container keeping the Koshien practice game panel in sync with the VM.
 *
 * It is always mounted (so its listeners exist before the extension loads)
 * and renders nothing while hidden. The panel opens itself when the koshien
 * extension is added and whenever the AI connects to (starts) a practice
 * game; the koshien menu can reopen it after it was closed.
 */
class KoshienMockPanel extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            snapshot: (props.vm && props.vm.runtime && props.vm.runtime.koshienMockState) || null,
        };
        this.handleMockState = this.handleMockState.bind(this);
        this.handleExtensionAdded = this.handleExtensionAdded.bind(this);
    }

    componentDidMount() {
        const runtime = this.props.vm && this.props.vm.runtime;
        if (!runtime) return;
        runtime.on(MOCK_STATE_EVENT, this.handleMockState);
        runtime.on('EXTENSION_ADDED', this.handleExtensionAdded);
    }

    componentWillUnmount() {
        const runtime = this.props.vm && this.props.vm.runtime;
        if (!runtime) return;
        runtime.removeListener(MOCK_STATE_EVENT, this.handleMockState);
        runtime.removeListener('EXTENSION_ADDED', this.handleExtensionAdded);
    }

    handleMockState(snapshot) {
        const wasConnected = this.state.snapshot && this.state.snapshot.connected;
        this.setState({ snapshot });
        // A fresh connect (the connect-game block ran) shows the panel again.
        if (snapshot && snapshot.connected && !wasConnected) {
            this.props.onOpen();
        }
    }

    handleExtensionAdded(categoryInfo) {
        if (categoryInfo && categoryInfo.id === 'koshien') {
            this.props.onOpen();
        }
    }

    render() {
        if (!this.props.visible) return null;
        return <KoshienMockPanelComponent snapshot={this.state.snapshot} onClose={this.props.onClose} />;
    }
}

KoshienMockPanel.propTypes = {
    onClose: PropTypes.func.isRequired,
    onOpen: PropTypes.func.isRequired,
    visible: PropTypes.bool.isRequired,
    vm: PropTypes.shape({
        runtime: PropTypes.object,
    }).isRequired,
};

const mapStateToProps = (state) => ({
    visible: state.scratchGui.koshienMockPanel.visible,
});

const mapDispatchToProps = (dispatch) => ({
    onOpen: () => dispatch(openKoshienMockPanel()),
    onClose: () => dispatch(closeKoshienMockPanel()),
});

export default connect(mapStateToProps, mapDispatchToProps)(KoshienMockPanel);
