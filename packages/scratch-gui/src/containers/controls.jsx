import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from '@smalruby/scratch-vm';
import {injectIntl} from 'react-intl';
import intlShape from '../lib/intlShape.js';
import {connect} from 'react-redux';

import ControlsComponent from '../components/controls/controls.jsx';

// === Smalruby: Start of block_run analytics ===
import analytics from '../lib/analytics';
// === Smalruby: End of block_run analytics ===

import RubyToBlocksConverterHOC from '../lib/ruby-to-blocks-converter-hoc.jsx';
// === Smalruby: Start of studuino mode write ===
import {abortStuduinoWrite, isStuduinoMode, openStuduinoWrite} from '../reducers/studuino-mode';
// === Smalruby: End of studuino mode write ===

class Controls extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleGreenFlagClick',
            'handleStopAllClick'
        ]);
    }
    async handleGreenFlagClick (e) {
        e.preventDefault();

        const converter = await this.props.targetCodeToBlocks(this.props.intl);
        if (!converter.result) {
            return;
        }
        const shiftKey = e.shiftKey;
        converter.apply()
            .then(() => {
                // === Smalruby: Start of studuino mode write ===
                // In the Studuino mode the program does not run in the browser: the green flag writes it (S13)
                if (this.props.studuinoMode) {
                    this.props.onStuduinoWrite();
                    return;
                }
                // === Smalruby: End of studuino mode write ===
                if (shiftKey) {
                    this.props.vm.setTurboMode(!this.props.turbo);
                } else {
                    if (!this.props.isStarted) {
                        this.props.vm.start();
                    }
                    this.props.vm.greenFlag();
                    // === Smalruby: Start of block_run analytics ===
                    try {
                        analytics.event({
                            category: 'block_run',
                            action: 'green_flag',
                            label: this.props.turbo ? 'turbo' : 'normal'
                        });
                    } catch (_e) {
                        // Swallow analytics failures so the editor never breaks.
                    }
                    // === Smalruby: End of block_run analytics ===
                }
            })
            .catch(error => {
                // apply() failed and rolled the target's blocks back
                // (issue #710); log instead of an unhandled rejection.
                // eslint-disable-next-line no-console
                console.error('[Controls] Ruby to blocks apply error:', error);
            });
    }
    handleStopAllClick (e) {
        e.preventDefault();
        // === Smalruby: Start of studuino mode write ===
        // In the Studuino mode the stop button stops writing (S13)
        if (this.props.studuinoMode) this.props.onStuduinoWriteAbort();
        // === Smalruby: End of studuino mode write ===
        this.props.vm.stopAll();
    }
    render () {
        const {
            vm: _vm,
            targetCodeToBlocks: _targetCodeToBlocks,
            isStarted: _isStarted,
            // === Smalruby: Start of studuino mode write ===
            studuinoMode: _studuinoMode,
            onStuduinoWrite: _onStuduinoWrite,
            onStuduinoWriteAbort: _onStuduinoWriteAbort,
            // === Smalruby: End of studuino mode write ===
            projectRunning,
            turbo,
            ...props
        } = this.props;
        return (
            <ControlsComponent
                {...props}
                active={projectRunning}
                turbo={turbo}
                onGreenFlagClick={this.handleGreenFlagClick}
                onStopAllClick={this.handleStopAllClick}
            />
        );
    }
}

Controls.propTypes = {
    intl: intlShape.isRequired,
    isStarted: PropTypes.bool.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    targetCodeToBlocks: PropTypes.func,
    turbo: PropTypes.bool.isRequired,
    // === Smalruby: Start of studuino mode write ===
    studuinoMode: PropTypes.bool,
    onStuduinoWrite: PropTypes.func,
    onStuduinoWriteAbort: PropTypes.func,
    // === Smalruby: End of studuino mode write ===
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = state => ({
    isStarted: state.scratchGui.vmStatus.running,
    projectRunning: state.scratchGui.vmStatus.running,
    turbo: state.scratchGui.vmStatus.turbo,
    // === Smalruby: Start of studuino mode write ===
    studuinoMode: isStuduinoMode(state)
    // === Smalruby: End of studuino mode write ===
});
// no-op function to prevent dispatch prop being passed to component
// === Smalruby: Start of studuino mode write ===
const mapDispatchToProps = dispatch => ({
    onStuduinoWrite: () => dispatch(openStuduinoWrite()),
    onStuduinoWriteAbort: () => dispatch(abortStuduinoWrite())
});
// === Smalruby: End of studuino mode write ===

export default RubyToBlocksConverterHOC(injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(Controls)));
