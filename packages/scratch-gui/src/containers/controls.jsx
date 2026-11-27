import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import VM from '@smalruby/scratch-vm';
// === Smalruby: Start of ruby to blocks before green flag ===
import {injectIntl} from 'react-intl';
import intlShape from '../lib/intlShape.js';
// === Smalruby: End of ruby to blocks before green flag ===
import {connect} from 'react-redux';

import ControlsComponent from '../components/controls/controls.jsx';

// === Smalruby: Start of block_run analytics ===
import analytics from '../lib/analytics';
// === Smalruby: End of block_run analytics ===

// === Smalruby: Start of ruby to blocks before green flag ===
import RubyToBlocksConverterHOC from '../lib/ruby-to-blocks-converter-hoc.jsx';
// === Smalruby: End of ruby to blocks before green flag ===

class Controls extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleGreenFlagClick',
            'handleStopAllClick'
        ]);
    }
    // === Smalruby: Start of ruby to blocks before green flag ===
    // Upstream: handleGreenFlagClick (e) is not async.
    async handleGreenFlagClick (e) {
    // === Smalruby: End of ruby to blocks before green flag ===
        e.preventDefault();

        // === Smalruby: Start of ruby to blocks before green flag ===
        // Upstream runs the shift (turbo) / green flag branch right away, without converting Ruby.
        const converter = await this.props.targetCodeToBlocks(this.props.intl);
        if (!converter.result) {
            return;
        }
        const shiftKey = e.shiftKey;
        converter.apply()
            .then(() => {
                if (shiftKey) {
                    this.props.vm.setTurboMode(!this.props.turbo);
                } else {
                    if (!this.props.isStarted) {
                        this.props.vm.start();
                    }
                    this.props.vm.greenFlag();
                    // === Smalruby: End of ruby to blocks before green flag ===
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
                // === Smalruby: Start of ruby to blocks before green flag ===
                }
            })
            .catch(error => {
                // apply() failed and rolled the target's blocks back
                // (issue #710); log instead of an unhandled rejection.
                // eslint-disable-next-line no-console
                console.error('[Controls] Ruby to blocks apply error:', error);
            });
        // === Smalruby: End of ruby to blocks before green flag ===
    }
    handleStopAllClick (e) {
        e.preventDefault();
        this.props.vm.stopAll();
    }
    render () {
        const {
            vm: _vm,
            // === Smalruby: Start of ruby to blocks before green flag ===
            targetCodeToBlocks: _targetCodeToBlocks,
            // === Smalruby: End of ruby to blocks before green flag ===
            isStarted: _isStarted,
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
    // === Smalruby: Start of ruby to blocks before green flag ===
    intl: intlShape.isRequired,
    // === Smalruby: End of ruby to blocks before green flag ===
    isStarted: PropTypes.bool.isRequired,
    projectRunning: PropTypes.bool.isRequired,
    // === Smalruby: Start of ruby to blocks before green flag ===
    targetCodeToBlocks: PropTypes.func,
    // === Smalruby: End of ruby to blocks before green flag ===
    turbo: PropTypes.bool.isRequired,
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = state => ({
    isStarted: state.scratchGui.vmStatus.running,
    projectRunning: state.scratchGui.vmStatus.running,
    turbo: state.scratchGui.vmStatus.turbo
});
// no-op function to prevent dispatch prop being passed to component
const mapDispatchToProps = () => ({});

// === Smalruby: Start of ruby to blocks before green flag ===
export default RubyToBlocksConverterHOC(injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(Controls)));
// Upstream: export default connect(mapStateToProps, mapDispatchToProps)(Controls);
// === Smalruby: End of ruby to blocks before green flag ===
