import VM from '@smalruby/scratch-vm';
import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import { NullRubyToBlocksConverter, targetCodeToBlocks } from '../lib/ruby-to-blocks-converter';
import { showAlertWithTimeout } from '../reducers/alerts';
import { activateTab, JAPANESE_TAB_INDEX, RUBY_TAB_INDEX } from '../reducers/editor-tab';
import { rubyCodeShape, updateRubyCodeErrors, convertedRubyCode } from '../reducers/ruby-code';
import { highlightTarget } from '../reducers/targets';

// What the HOC answers while the Japanese tab has lines with an error: nothing to apply.
const JapaneseEditErrorConverter = {
    result: false,
    errors: [],
    apply: () => Promise.resolve(),
};

/**
 * Higher Order Component to provide behavior for converting Ruby to Code.
 * @param {React.Component} WrappedComponent the component to add Ruby to Code converting functionality to
 * @returns {React.Component} WrappedComponent with Ruby to Code converting functionality added
 *
 * <ProjectSaverHOC>
 *     <WrappedComponent />
 * </ProjectSaverHOC>
 */
const RubyToBlocksConverterHOC = function (WrappedComponent) {
    class RubyToBlocksConverterComponent extends React.Component {
        constructor(props) {
            super(props);
            bindAll(this, ['targetCodeToBlocks']);
        }

        async targetCodeToBlocks(intl) {
            // Japanese lines that make no Ruby are only in the editor: the blocks (and the Ruby)
            // lack them whether or not the code is modified. Stop as on a Ruby error, so that
            // saving, submitting or running does not drop the lines without a word (Issue #2560).
            if (this.props.dnclMode && this.props.japaneseEditError) {
                const target = this.props.rubyCode.target;
                if (target) {
                    this.props.vm.setEditingTarget(target.id);
                    if (!target.isStage) this.props.onHighlightTarget(target.id);
                }
                this.props.onActivateRubyTab(true);
                this.props.onShowConvertJapaneseErrorAlert();
                return JapaneseEditErrorConverter;
            }
            if (this.props.rubyCode.modified) {
                const converter = await targetCodeToBlocks(
                    this.props.vm,
                    this.props.rubyCode.target,
                    this.props.rubyCode.code,
                    intl,
                    { version: this.props.rubyVersion },
                );
                if (!converter.result) {
                    this.props.vm.setEditingTarget(this.props.rubyCode.target.id);
                    if (!this.props.rubyCode.target.isStage) {
                        this.props.onHighlightTarget(this.props.rubyCode.target.id);
                    }
                    // Show the errors in the language the program is written in: a program
                    // written in Japanese goes back to the Japanese tab, not to the Ruby tab.
                    this.props.onActivateRubyTab(this.props.dnclMode);
                    this.props.onShowConvertRubyToBlocksErrorAlert();
                    this.props.updateRubyCodeErrorsState(converter.errors);
                    return converter;
                }
                this.props.updateRubyCodeErrorsState(converter.errors);
                // Clear the modified flag only after the blocks were actually
                // applied. Clearing it here (before apply) would skip
                // re-conversion on the next tab switch when apply fails and
                // silently lose the user's edits (issue #710).
                const originalApply = converter.apply;
                converter.apply = async (...args) => {
                    const applied = await originalApply(...args);
                    this.props.convertedRubyCodeState();
                    return applied;
                };
                return converter;
            }
            return NullRubyToBlocksConverter;
        }

        render() {
            const {
                editingTarget: _editingTarget,
                convertedRubyCodeState: _convertedRubyCodeState,
                dnclMode: _dnclMode,
                japaneseEditError: _japaneseEditError,
                onActivateRubyTab: _onActivateRubyTab,
                onHighlightTarget: _onHighlightTarget,
                onShowConvertRubyToBlocksErrorAlert: _onShowConvertRubyToBlocksErrorAlert,
                onShowConvertJapaneseErrorAlert: _onShowConvertJapaneseErrorAlert,
                rubyCode: _rubyCode,
                updateRubyCodeErrorsState: _updateRubyCodeErrorsState,
                ...componentProps
            } = this.props;
            return <WrappedComponent targetCodeToBlocks={this.targetCodeToBlocks} {...componentProps} />;
        }
    }

    RubyToBlocksConverterComponent.propTypes = {
        convertedRubyCodeState: PropTypes.func,
        dnclMode: PropTypes.bool,
        editingTarget: PropTypes.string,
        japaneseEditError: PropTypes.bool,
        onActivateRubyTab: PropTypes.func,
        onHighlightTarget: PropTypes.func,
        onShowConvertJapaneseErrorAlert: PropTypes.func,
        onShowConvertRubyToBlocksErrorAlert: PropTypes.func,
        rubyCode: rubyCodeShape,
        rubyVersion: PropTypes.string,
        updateRubyCodeErrorsState: PropTypes.func,
        vm: PropTypes.instanceOf(VM),
    };

    const mapStateToProps = (state) => ({
        dnclMode: Boolean(state.scratchGui.dnclMode?.dnclMode),
        editingTarget: state.scratchGui.targets.editingTarget,
        japaneseEditError: Boolean(state.scratchGui.dnclMode?.japaneseEditError),
        rubyCode: state.scratchGui.rubyCode,
        rubyVersion: state.scratchGui.settings.rubyVersion,
        vm: state.scratchGui.vm,
    });

    const mapDispatchToProps = (dispatch) => ({
        convertedRubyCodeState: () => dispatch(convertedRubyCode()),
        onActivateRubyTab: (japanese) => dispatch(activateTab(japanese ? JAPANESE_TAB_INDEX : RUBY_TAB_INDEX)),
        onHighlightTarget: (id) => dispatch(highlightTarget(id)),
        onShowConvertJapaneseErrorAlert: () => showAlertWithTimeout(dispatch, 'convertJapaneseError'),
        onShowConvertRubyToBlocksErrorAlert: () => showAlertWithTimeout(dispatch, 'convertRubyToBlocksError'),
        updateRubyCodeErrorsState: (errors) => dispatch(updateRubyCodeErrors(errors)),
    });

    // Allow incoming props to override redux-provided props. Used to mock in tests.
    const mergeProps = (stateProps, dispatchProps, ownProps) =>
        Object.assign({}, stateProps, dispatchProps, ownProps);

    return connect(mapStateToProps, mapDispatchToProps, mergeProps)(RubyToBlocksConverterComponent);
};

export { RubyToBlocksConverterHOC as default };
