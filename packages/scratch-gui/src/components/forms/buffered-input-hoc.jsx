import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';

/**
 * Higher Order Component to manage inputs that submit on blur and <enter>
 * @param {React.Component} Input text input that consumes onChange, onBlur, onKeyPress
 * @returns {React.Component} Buffered input that calls onSubmit on blur and <enter>
 */
export default function (Input) {
    class BufferedInput extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'handleChange',
                'handleKeyPress',
                'handleFlush'
            ]);
            this.state = {
                value: null
            };
        }
        handleKeyPress (e) {
            // === Smalruby: Start of IME composition guard ===
            // The Enter that commits an IME conversion must not flush and blur.
            // React's SyntheticKeyboardEvent omits isComposing, so read the
            // native event. This is bound to keypress, which Chromium never fires
            // while composing (and where React reports keyCode 0), so the guard is
            // there for browsers that do deliver a composing keypress.
            if ((e.nativeEvent && e.nativeEvent.isComposing) || e.keyCode === 229) return;
            // === Smalruby: End of IME composition guard ===
            if (e.key === 'Enter') {
                this.handleFlush();
                e.target.blur();
            }
        }
        handleFlush () {
            const isNumeric = typeof this.props.value === 'number';
            const validatesNumeric = isNumeric ? !isNaN(this.state.value) : true;
            if (this.state.value !== null && validatesNumeric) {
                this.props.onSubmit(isNumeric ? Number(this.state.value) : this.state.value);
            }
            this.setState({value: null});
        }
        handleChange (e) {
            this.setState({value: e.target.value});
        }
        render () {
            const bufferedValue = this.state.value === null ? this.props.value : this.state.value;
            return (
                <Input
                    {...this.props}
                    value={bufferedValue}
                    onBlur={this.handleFlush}
                    onChange={this.handleChange}
                    onKeyPress={this.handleKeyPress}
                />
            );
        }
    }

    BufferedInput.propTypes = {
        onSubmit: PropTypes.func.isRequired,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    };

    return BufferedInput;
}
