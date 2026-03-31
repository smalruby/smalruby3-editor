import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import SmalrubotFirmwareModalComponent from '../components/smalrubot-firmware-modal/smalrubot-firmware-modal.jsx';
import { FirmwareFlasher } from '../lib/smalrubot-firmware-flasher';
import { closeSmalrubotFirmwareModal } from '../reducers/smalrubot-firmware';

class SmalrubotFirmwareModal extends React.Component {
    constructor(props) {
        super(props);
        bindAll(this, ['handleFlash', 'handleClose']);
        this.state = {
            phase: 'ready',
            progressPercent: 0,
            statusMessage: null,
            errorMessage: null,
        };
    }

    handleFlash() {
        this.setState({
            phase: 'flashing',
            progressPercent: 0,
            statusMessage: null,
            errorMessage: null,
        });

        const flasher = new FirmwareFlasher({ debug: true });

        flasher
            .flashDefaultFirmware(
                (written, total) => {
                    this.setState({
                        progressPercent: Math.floor((written / total) * 200) / 2,
                    });
                },
                statusMsg => {
                    this.setState({ statusMessage: statusMsg });
                },
            )
            .then(() => {
                this.setState({ phase: 'success' });
            })
            .catch(err => {
                this.setState({
                    phase: 'error',
                    errorMessage: err.message || String(err),
                });
            });
    }

    handleClose() {
        this.setState({
            phase: 'ready',
            progressPercent: 0,
            statusMessage: null,
            errorMessage: null,
        });
        this.props.onClose();
    }

    render() {
        return (
            <SmalrubotFirmwareModalComponent
                errorMessage={this.state.errorMessage}
                phase={this.state.phase}
                progressPercent={this.state.progressPercent}
                statusMessage={this.state.statusMessage}
                onClose={this.handleClose}
                onFlash={this.handleFlash}
            />
        );
    }
}

SmalrubotFirmwareModal.propTypes = {
    onClose: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
    onClose: () => dispatch(closeSmalrubotFirmwareModal()),
});

export default connect(null, mapDispatchToProps)(SmalrubotFirmwareModal);
