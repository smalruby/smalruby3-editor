/* eslint-disable no-console */
import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, injectIntl} from 'react-intl';
import intlShape from '../lib/intlShape.js';
import VM from '@smalruby/scratch-vm';

import GeminiAPI from '../lib/gemini-api';
import GeminiModal from '../components/gemini-modal/gemini-modal.jsx';

const TIMEOUT_SECONDS = 120;

const messages = defineMessages({
    authError: {
        id: 'gui.geminiModal.authError',
        defaultMessage: 'Authentication failed. Please try again.',
        description: 'Error shown when Gemini OAuth authentication fails'
    },
    apiError: {
        id: 'gui.geminiModal.apiError',
        defaultMessage: 'Gemini API error. Please try again.',
        description: 'Error shown when Gemini API call fails'
    },
    timeoutError: {
        id: 'gui.geminiModal.timeoutError',
        defaultMessage: 'Request timed out (2 minutes). Please try again.',
        description: 'Error shown when Gemini API request times out'
    }
});

/**
 * Collect current sprite/stage/vm state from window.smalruby for Gemini context
 * @param {object} vm - Scratch VM instance
 * @param {object} editingTarget - Currently editing target
 * @returns {object} State context for Gemini
 */
const collectStateContext = (vm, editingTarget) => {
    const context = {};

    if (!vm || !vm.runtime) {
        return context;
    }

    // Collect VM state (loaded extensions)
    const extensionIds = [];
    if (vm.extensionManager) {
        const allExtensions = [
            'music', 'pen', 'videoSensing', 'text2speech', 'translate',
            'microbit', 'smalrubotS1', 'microbitMore', 'koshien', 'makeymakey', 'gdxfor'
        ];
        allExtensions.forEach(id => {
            if (vm.extensionManager.isExtensionLoaded(id)) {
                extensionIds.push(id);
            }
        });
    }
    context.vm = {extensions: extensionIds};

    // Helper to build target state
    const buildTargetState = target => {
        if (!target) return null;
        const state = {
            name: target.sprite ? target.sprite.name : (target.name || ''),
            x: Math.round(target.x || 0),
            y: Math.round(target.y || 0),
            size: target.size || 100,
            direction: target.direction || 90,
            visible: target.visible !== false,
            draggable: target.draggable || false
        };

        // Costumes
        if (target.sprite && target.sprite.costumes) {
            state.costumes = target.sprite.costumes.map(c => ({name: c.name}));
        } else {
            state.costumes = [];
        }

        // Sounds
        if (target.sprite && target.sprite.sounds) {
            state.sounds = target.sprite.sounds.map(s => ({name: s.name}));
        } else {
            state.sounds = [];
        }

        return state;
    };

    // Collect sprite state (current editing target)
    if (editingTarget && !editingTarget.isStage) {
        context.sprite = buildTargetState(editingTarget);
        // Include current Ruby code from window.smalruby if available
        if (window.smalruby && typeof window.smalruby.rubyCode !== 'undefined') {
            context.sprite.currentCode = window.smalruby.rubyCode;
        }
    }

    // Collect stage state
    const stage = vm.runtime.targets.find(t => t.isStage);
    if (stage) {
        const stageState = {
            width: 480,
            height: 360
        };
        if (stage.sprite && stage.sprite.costumes) {
            stageState.costumes = stage.sprite.costumes.map(c => ({name: c.name}));
        }
        if (stage.sprite && stage.sprite.sounds) {
            stageState.sounds = stage.sprite.sounds.map(s => ({name: s.name}));
        }
        context.stage = stageState;
    }

    return context;
};

/**
 * Higher Order Component that wraps a component with Gemini AI modal functionality
 * @param {React.Component} WrappedComponent the component to add Gemini functionality to
 * @returns {React.Component} WrappedComponent with Gemini modal functionality added
 */
const GeminiModalHOC = function (WrappedComponent) {
    class GeminiModalComponent extends React.Component {
        constructor (props) {
            super(props);

            this.geminiAPI = new GeminiAPI();

            this.state = {
                isModalOpen: false,
                chatHistory: [], // [{role: 'user'|'model', text: string}]
                isLoading: false,
                loadingSeconds: 0,
                error: null,
                latestCode: null,
                inputValue: ''
            };

            this._timerInterval = null;
            this._timeoutTimer = null;

            this.handleOpenModal = this.handleOpenModal.bind(this);
            this.handleCloseModal = this.handleCloseModal.bind(this);
            this.handleSend = this.handleSend.bind(this);
            this.handleCancel = this.handleCancel.bind(this);
            this.handleApplyCode = this.handleApplyCode.bind(this);
            this.handleClearHistory = this.handleClearHistory.bind(this);
            this.handleInputChange = this.handleInputChange.bind(this);
            this.handleInputKeyDown = this.handleInputKeyDown.bind(this);
            this.handleRegisterApplyCallback = this.handleRegisterApplyCallback.bind(this);
            this._applyGeminiCode = null;
        }

        componentWillUnmount () {
            this._clearTimers();
            this.geminiAPI.cancelRequest();
        }

        _startTimers () {
            this.setState({loadingSeconds: 0});
            this._timerInterval = setInterval(() => {
                this.setState(prev => ({loadingSeconds: prev.loadingSeconds + 1}));
            }, 1000);
            this._timeoutTimer = setTimeout(() => {
                this._clearTimers();
                // Cancel the in-flight request on timeout
                this.geminiAPI.cancelRequest();
                // Remove the pending user message from history (last entry)
                this.setState(prevState => ({
                    isLoading: false,
                    error: this.props.intl.formatMessage(messages.timeoutError),
                    chatHistory: prevState.chatHistory.slice(0, -1)
                }));
            }, TIMEOUT_SECONDS * 1000);
        }

        _clearTimers () {
            if (this._timerInterval) {
                clearInterval(this._timerInterval);
                this._timerInterval = null;
            }
            if (this._timeoutTimer) {
                clearTimeout(this._timeoutTimer);
                this._timeoutTimer = null;
            }
        }

        handleOpenModal () {
            this.setState({isModalOpen: true, error: null});
        }

        handleCloseModal () {
            this.setState({isModalOpen: false});
        }

        /**
         * Called by WrappedComponent to register the function that applies
         * generated code to the Monaco editor.
         * @param {function} callback - Function that accepts a code string
         */
        handleRegisterApplyCallback (callback) {
            this._applyGeminiCode = callback;
        }

        async handleSend () {
            const {inputValue} = this.state;
            if (!inputValue.trim() || this.state.isLoading) {
                return;
            }

            this._startTimers();
            this.setState({
                isLoading: true,
                error: null,
                inputValue: ''
            });

            // Add user message to local history immediately for UI
            const userMessage = {role: 'user', text: inputValue.trim()};
            this.setState(prevState => ({
                chatHistory: [...prevState.chatHistory, userMessage]
            }));

            try {
                // Collect state context
                const stateContext = collectStateContext(
                    this.props.vm,
                    this.props.editingTarget
                );

                // Call Gemini API
                const responseText = await this.geminiAPI.sendMessage(
                    inputValue.trim(),
                    stateContext
                );

                const modelMessage = {role: 'model', text: responseText};
                const latestCode = GeminiAPI.extractCodeBlock(responseText);

                this._clearTimers();
                this.setState(prevState => ({
                    chatHistory: [...prevState.chatHistory, modelMessage],
                    latestCode: latestCode,
                    isLoading: false
                }));
            } catch (error) {
                this._clearTimers();

                // AbortError means user cancelled — remove pending user message, no error shown
                if (error.name === 'AbortError') {
                    this.setState(prevState => ({
                        isLoading: false,
                        chatHistory: prevState.chatHistory.slice(0, -1)
                    }));
                    return;
                }

                console.error('[GeminiModalHOC] Error calling Gemini API:', error);

                let errorMessage;
                if (error.message && error.message.includes('401')) {
                    errorMessage = this.props.intl.formatMessage(messages.authError);
                } else if (error.message && error.message.includes('timeout')) {
                    errorMessage = this.props.intl.formatMessage(messages.timeoutError);
                } else {
                    errorMessage = this.props.intl.formatMessage(messages.apiError);
                }

                // Remove the pending user message from history on error
                this.setState(prevState => ({
                    isLoading: false,
                    error: errorMessage,
                    chatHistory: prevState.chatHistory.slice(0, -1)
                }));
            }
        }

        /**
         * Cancel the current in-flight Gemini request.
         * Stops the timers, aborts the fetch, and removes the pending user message.
         */
        handleCancel () {
            if (!this.state.isLoading) {
                return;
            }
            this._clearTimers();
            this.geminiAPI.cancelRequest();
            // Remove the pending user message (the last entry added optimistically)
            this.setState(prevState => ({
                isLoading: false,
                chatHistory: prevState.chatHistory.slice(0, -1)
            }));
        }

        handleApplyCode () {
            const {latestCode} = this.state;
            if (latestCode && this._applyGeminiCode) {
                this._applyGeminiCode(latestCode);
            }
        }

        handleClearHistory () {
            this.geminiAPI.clearHistory();
            this.setState({
                chatHistory: [],
                latestCode: null,
                error: null
            });
        }

        handleInputChange (e) {
            this.setState({inputValue: e.target.value});
        }

        handleInputKeyDown (e) {
            // Do NOT send on Enter key - user must click the send button
            // Prevent accidental submission; a future option may be Cmd/Shift+Enter
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        }

        render () {
            const {
                intl, // consumed in error message handling (this.props.intl)
                ...passThroughProps
            } = this.props;
            void intl;

            return (
                <React.Fragment>
                    <WrappedComponent
                        onOpenGeminiModal={this.handleOpenModal}
                        onRegisterGeminiApply={this.handleRegisterApplyCallback}
                        {...passThroughProps}
                    />
                    {this.state.isModalOpen && (
                        <GeminiModal
                            isVisible={this.state.isModalOpen}
                            history={this.state.chatHistory}
                            isLoading={this.state.isLoading}
                            loadingSeconds={this.state.loadingSeconds}
                            error={this.state.error}
                            latestCode={this.state.latestCode}
                            inputValue={this.state.inputValue}
                            onClose={this.handleCloseModal}
                            onSend={this.handleSend}
                            onCancel={this.handleCancel}
                            onApplyCode={this.handleApplyCode}
                            onClearHistory={this.handleClearHistory}
                            onInputChange={this.handleInputChange}
                            onInputKeyDown={this.handleInputKeyDown}
                        />
                    )}
                </React.Fragment>
            );
        }
    }

    GeminiModalComponent.propTypes = {
        intl: intlShape.isRequired,
        vm: PropTypes.instanceOf(VM).isRequired,
        editingTarget: PropTypes.object
    };

    GeminiModalComponent.defaultProps = {
        editingTarget: null
    };

    return injectIntl(GeminiModalComponent);
};

export default GeminiModalHOC;
