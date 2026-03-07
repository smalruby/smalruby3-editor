/* eslint-disable no-console */
import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, injectIntl} from 'react-intl';
import intlShape from '../lib/intlShape.js';
import VM from '@smalruby/scratch-vm';

import GeminiAPI, {RateLimitError} from '../lib/gemini-api';
import GeminiModal from '../components/gemini-modal/gemini-modal.jsx';

/**
 * Replace invalid resource references in Gemini-generated Ruby code with valid ones.
 * - Sounds: replace with first valid sound; comment out if no sounds exist
 * - Costumes: replace with first valid costume; skip if no costumes exist
 * - Backdrops: replace with first valid backdrop; skip if no backdrops exist
 * @param {string} code - Ruby source code to sanitize
 * @param {string[]} validSounds - List of valid sound names on the current sprite
 * @param {string[]} validCostumes - List of valid costume names on the current sprite
 * @param {string[]} validBackdrops - List of valid backdrop names on the stage
 * @returns {string} Sanitized code
 */
export const sanitizeResourceReferences = (code, validSounds, validCostumes, validBackdrops) => {
    let result = code;

    // --- Sounds ---
    result = result.replace(
        /^( *)(play(?:_until_done)?)\(("[^"]*"|'[^']*')\)/gm,
        (match, indent, fn, nameWithQuotes) => {
            const name = nameWithQuotes.slice(1, -1);
            if (validSounds.includes(name)) return match;
            if (validSounds.length === 0) {
                return `${indent}# ${fn}(${nameWithQuotes}) # この音は存在しないのでコメントアウトしました`;
            }
            return `${indent}${fn}("${validSounds[0]}")`;
        }
    );

    // --- Costumes ---
    if (validCostumes.length > 0) {
        result = result.replace(
            /^( *)switch_costume\(("[^"]*"|'[^']*')\)/gm,
            (match, indent, nameWithQuotes) => {
                const name = nameWithQuotes.slice(1, -1);
                if (validCostumes.includes(name)) return match;
                return `${indent}switch_costume("${validCostumes[0]}")`;
            }
        );
        result = result.replace(
            /^( *)(?:self\.)?costume\s*=\s*("[^"]*"|'[^']*')/gm,
            (match, indent, nameWithQuotes) => {
                const name = nameWithQuotes.slice(1, -1);
                if (validCostumes.includes(name)) return match;
                return `${indent}self.costume = "${validCostumes[0]}"`;
            }
        );
    }

    // --- Backdrops ---
    if (validBackdrops.length > 0) {
        result = result.replace(
            /^( *)(switch_backdrop(?:_(?:and_wait|to_and_wait))?)\(("[^"]*"|'[^']*')\)/gm,
            (match, indent, fn, nameWithQuotes) => {
                const name = nameWithQuotes.slice(1, -1);
                if (validBackdrops.includes(name)) return match;
                return `${indent}${fn}("${validBackdrops[0]}")`;
            }
        );
        result = result.replace(
            /^( *)(?:self\.)?backdrop\s*=\s*("[^"]*"|'[^']*')/gm,
            (match, indent, nameWithQuotes) => {
                const name = nameWithQuotes.slice(1, -1);
                if (validBackdrops.includes(name)) return match;
                return `${indent}self.backdrop = "${validBackdrops[0]}"`;
            }
        );
    }

    return result;
};

const TIMEOUT_SECONDS = 120;

const messages = defineMessages({
    apiError: {
        id: 'gui.geminiModal.apiError',
        defaultMessage: 'Gemini API error. Please try again.',
        description: 'Error shown when Gemini API call fails'
    },
    timeoutError: {
        id: 'gui.geminiModal.timeoutError',
        defaultMessage: 'Request timed out (2 minutes). Please try again.',
        description: 'Error shown when Gemini API request times out'
    },
    overloadedError: {
        id: 'gui.geminiModal.overloadedError',
        // eslint-disable-next-line max-len
        defaultMessage: 'Gemini is currently experiencing high demand and is temporarily unavailable. Please wait about 5 minutes and try again.',
        description: 'Error shown when Gemini API returns 503 due to high demand'
    },
    rateLimitError: {
        id: 'gui.geminiModal.rateLimitError',
        defaultMessage: 'You have reached the usage limit. Please try again in {minutes} minutes.',
        description: 'Error shown when the relay rate limit is exceeded'
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
                latestCodes: [], // all code blocks from the last model response
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
                const latestCodes = GeminiAPI.extractAllCodeBlocks(responseText);

                this._clearTimers();
                this.setState(prevState => ({
                    chatHistory: [...prevState.chatHistory, modelMessage],
                    latestCodes: latestCodes,
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
                if (error instanceof RateLimitError) {
                    const minutes = Math.ceil((error.resetAfterSeconds || 0) / 60);
                    errorMessage = this.props.intl.formatMessage(
                        messages.rateLimitError,
                        {minutes}
                    );
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

        handleApplyCode (index) {
            const {latestCodes} = this.state;
            let code = latestCodes[index];
            if (code && this._applyGeminiCode) {
                const target = this.props.editingTarget;
                const validSounds = target && target.sprite && target.sprite.sounds ?
                    target.sprite.sounds.map(s => s.name) : [];
                const validCostumes = target && target.sprite && target.sprite.costumes ?
                    target.sprite.costumes.map(c => c.name) : [];
                const stage = this.props.vm && this.props.vm.runtime &&
                    this.props.vm.runtime.targets &&
                    this.props.vm.runtime.targets.find(t => t.isStage);
                const validBackdrops = stage && stage.sprite && stage.sprite.costumes ?
                    stage.sprite.costumes.map(c => c.name) : [];
                code = sanitizeResourceReferences(code, validSounds, validCostumes, validBackdrops);
                this._applyGeminiCode(code);
            }
        }

        handleClearHistory () {
            this.geminiAPI.clearHistory();
            this.setState({
                chatHistory: [],
                latestCodes: [],
                error: null
            });
        }

        handleInputChange (e) {
            this.setState({inputValue: e.target.value});
        }

        handleInputKeyDown (e) {
            // Allow Enter/Return to insert a newline (default textarea behavior)
            // User must click the send button to submit
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
                            latestCodes={this.state.latestCodes}
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
