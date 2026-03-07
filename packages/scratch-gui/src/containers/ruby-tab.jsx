import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {injectIntl} from 'react-intl';
import intlShape from '../lib/intlShape.js';
import {connect} from 'react-redux';
import Editor from '@monaco-editor/react';
import {
    rubyCodeShape,
    updateRubyCode,
    updateRubyCodeErrors,
    updateRubyCodeTarget,
    updateRubyFontSize
} from '../reducers/ruby-code';
import {setRubyVersion} from '../reducers/settings';
import {showAlertWithTimeout, closeAlertWithId} from '../reducers/alerts';
import {markRubyTabUsed} from '../reducers/tutorial-onboarding';
import VM from '@smalruby/scratch-vm';
import {BLOCKS_TAB_INDEX, RUBY_TAB_INDEX} from '../reducers/editor-tab';

import RubyToBlocksConverterHOC from '../lib/ruby-to-blocks-converter-hoc.jsx';
import {targetCodeToBlocks} from '../lib/ruby-to-blocks-converter';

import CompletionProviderManager from './ruby-tab/completion-provider-manager';
import SnippetsCompleter from './ruby-tab/snippets-completer';
import {smalrubyLanguage, smalrubyLanguageConfiguration} from './ruby-tab/smalruby-mode';

import RubyDownloader from './ruby-downloader.jsx';
import RubyToolbar from '../components/ruby-toolbar/ruby-toolbar.jsx';
import FuriganaAnnotator from '../lib/furigana-annotator';
import FuriganaRenderer from './ruby-tab/furigana-renderer';
import GeminiModalHOC from './gemini-modal-hoc.jsx';
import collectMetadata from '../lib/collect-metadata.js';
import {closeFileMenu} from '../reducers/menus.js';
import {setAiSaveStatus, clearAiSaveStatus} from '../reducers/koshien-file';
import styles from './ruby-tab/ruby-tab.css';
import {loadMonacoLocale} from '../lib/monaco-i18n-helper';
import {getPrism, loadPrism} from '../lib/prism-parser';

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48];
const DEFAULT_FONT_SIZE = 16;
const FURIGANA_ENABLED_KEY = 'smalruby:furiganaEnabled';

class RubyTab extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'setContainerRef',
            'handleEditorDidMount',
            'handleEditorChange',
            'handleZoomIn',
            'handleZoomOut',
            'handleZoomReset',
            'getSaveToComputerHandler',
            'getSaveAIHandler',
            'handleAISaveFinished',
            'handleAISaveError',
            'handleSelectTarget',
            'handleDownload',
            'handleExecuteLine',
            'handleScriptGlowOn',
            'handleScriptGlowOff',
            'handleVisualReport',
            'handleDismissBubble',
            'handleApplyGeminiCode',
            'handleToggleFurigana',
            'updateUndoRedoState'
        ]);
        this.mainTooltipId = 'ruby-downloader-tooltip';
        this.editorRef = null;
        this.monacoRef = null;
        this.containerRef = null;
        this.resizeObserver = null;
        this.completionProvider = null;
        this.lastProcessedVersion = props.rubyVersion;
        this.downloadCallbackRef = null;
        this.executingLineDecoration = null;
        this.contentChangeListener = null;
        this.pasteMutationObserver = null;
        this.bodyMutationObserver = null;
        this.bubbleRef = null;
        this.furiganaAnnotator = new FuriganaAnnotator();
        this.furiganaRenderer = new FuriganaRenderer();
        this.furiganaDebounceTimer = null;
        this.furiganaLastMs = 0; // last measured render time, used for adaptive debounce
        const savedFurigana = typeof window !== 'undefined' && window.localStorage ?
            window.localStorage.getItem(FURIGANA_ENABLED_KEY) === 'true' : false;
        this.state = {
            runningBlockId: null,
            executingLine: null,
            canUndo: false,
            canRedo: false,
            furiganaEnabled: savedFurigana
        };

        loadMonacoLocale(props.locale);
    }

    componentDidMount () {
        this.props.vm.addListener('SCRIPT_GLOW_ON', this.handleScriptGlowOn);
        this.props.vm.addListener('SCRIPT_GLOW_OFF', this.handleScriptGlowOff);
        this.props.vm.addListener('VISUAL_REPORT', this.handleVisualReport);

        // Expose debug globals for Playwright MCP and browser console
        window.smalruby = window.smalruby || {};
        window.smalruby.vm = this.props.vm;
        this._updateDebugGlobals();
    }

    componentDidUpdate (prevProps) {
        if (this.props.rubyVersion !== prevProps.rubyVersion) {
            if (this.props.rubyVersion === this.lastProcessedVersion) {
                return;
            }
            this.handleRubyVersionChange(prevProps.rubyVersion, this.props.rubyVersion);
        }

        if (this.props.locale !== prevProps.locale) {
            loadMonacoLocale(this.props.locale);
        }

        if (prevProps.activeTabIndex === RUBY_TAB_INDEX &&
            this.props.activeTabIndex !== RUBY_TAB_INDEX) {
            this.handleDismissBubble();
        }

        if (prevProps.isVisible && !this.props.isVisible) {
            if (this.editorRef && this.monacoRef) {
                this.clearErrors();
            }
        }

        if (this.props.rubyCode.code !== prevProps.rubyCode.code && !this.props.rubyCode.modified) {
            this.clearErrors();
        }

        if (this.props.rubyCode.errors !== prevProps.rubyCode.errors) {
            this.showErrors(this.props.rubyCode.errors);
        }

        let modified = this.props.rubyCode.modified;
        if (modified) {
            const targetId = this.props.rubyCode.target ? this.props.rubyCode.target.id : null;
            const changedTarget =
                this.props.vm.editingTarget && this.props.rubyCode.target &&
                  this.props.vm.editingTarget.id !== targetId;
            if (changedTarget || this.props.blocksTabVisible) {
                this.props.targetCodeToBlocks(this.props.intl).then(converter => {
                    if (converter.result) {
                        converter.apply().then(() => {
                            modified = false;

                            this.clearErrors();

                            if (!modified) {
                                const editingTargetChanged = this.props.editingTarget &&
                                    this.props.editingTarget !== prevProps.editingTarget;
                                if ((this.props.isVisible && !prevProps.isVisible) || editingTargetChanged) {
                                    this.props.updateRubyCodeTargetState(
                                        this.props.vm.editingTarget,
                                        this.props.rubyVersion
                                    );
                                }
                            }

                            if (this.props.isVisible && !prevProps.isVisible) {
                                if (this.editorRef) {
                                    this.editorRef.focus();
                                    this.editorRef.layout();
                                }
                            }
                        });
                        return;
                    }
                    this.showErrors(converter.errors);
                });
            }
        }

        if (!modified) {
            const editingTargetChanged = this.props.editingTarget &&
                this.props.editingTarget !== prevProps.editingTarget;
            if ((this.props.isVisible && !prevProps.isVisible) || editingTargetChanged) {
                this.props.updateRubyCodeTargetState(this.props.vm.editingTarget, this.props.rubyVersion);
            }
        }

        if (this.props.isVisible && !prevProps.isVisible) {
            if (this.editorRef) {
                this.editorRef.focus();
                this.editorRef.layout();
            }
            // Mark Ruby tab as used for tutorial onboarding
            this.props.onMarkRubyTabUsed();
        }

        this._updateDebugGlobals();
    }

    componentWillUnmount () {
        this.props.vm.removeListener('SCRIPT_GLOW_ON', this.handleScriptGlowOn);
        this.props.vm.removeListener('SCRIPT_GLOW_OFF', this.handleScriptGlowOff);
        this.props.vm.removeListener('VISUAL_REPORT', this.handleVisualReport);
        this.handleDismissBubble();
        if (this.bubbleRef) {
            document.body.removeChild(this.bubbleRef);
            this.bubbleRef = null;
        }
        this.clearExecutingLineHighlight();
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.completionProviderManager) {
            this.completionProviderManager.dispose();
            this.completionProviderManager = null;
        }
        if (this.contentChangeListener) {
            this.contentChangeListener.dispose();
            this.contentChangeListener = null;
        }
        if (this.pasteMutationObserver) {
            this.pasteMutationObserver.disconnect();
            this.pasteMutationObserver = null;
        }
        if (this.bodyMutationObserver) {
            this.bodyMutationObserver.disconnect();
            this.bodyMutationObserver = null;
        }
        if (this.furiganaDebounceTimer) {
            clearTimeout(this.furiganaDebounceTimer);
            this.furiganaDebounceTimer = null;
        }
    }

    _updateDebugGlobals () {
        if (!window.smalruby) window.smalruby = {};
        const vm = this.props.vm;
        window.smalruby.vm = vm;
        if (vm.editingTarget) {
            window.smalruby.sprite = vm.editingTarget;
            window.smalruby.blocks = vm.editingTarget.blocks;
            window.smalruby.comments = vm.editingTarget.comments;
        }
        window.smalruby.stage = vm.runtime ? vm.runtime.getTargetForStage() : null;
        window.smalruby.runtime = vm.runtime;
    }

    clearErrors () {
        if (this.editorRef && this.monacoRef) {
            this.monacoRef.editor.setModelMarkers(this.editorRef.getModel(), 'smalruby', []);
            // Close any active widgets (peek view, hover, etc.)
            this.editorRef.trigger('source', 'closeMarkersNavigation');
        }
        if (this.props.rubyCode.errors.length > 0) {
            this.props.updateRubyCodeErrorsState([]);
        }
        this.props.onDismissAlert('convertRubyToBlocksError');
        this.props.onDismissAlert('rubyVersionChangeFailed');
    }

    showErrors (errors) {
        if (this.editorRef && this.monacoRef) {
            const markers = errors.map(err => ({
                startLineNumber: err.row + 1,
                startColumn: err.column + 1,
                endLineNumber: err.row + 1,
                endColumn: (err.source ? err.column + err.source.length + 1 : 1000),
                message: err.text,
                severity: this.monacoRef.MarkerSeverity.Error
            }));
            this.monacoRef.editor.setModelMarkers(this.editorRef.getModel(), 'smalruby', markers);
            if (markers.length > 0) {
                const error = errors[0];
                this.editorRef.setPosition({lineNumber: error.row + 1, column: error.column + 1});
                this.editorRef.focus();
                this.editorRef.trigger('source', 'editor.action.marker.next');
            }
        }
    }

    async handleRubyVersionChange (oldVersion, newVersion) {
        this.lastProcessedVersion = newVersion;
        if (this.props.rubyCode.modified) {
            const converter = await this.props.targetCodeToBlocks(this.props.intl);
            if (converter.result) {
                converter.apply().then(() => {
                    this.clearErrors();
                    this.props.updateRubyCodeTargetState(this.props.vm.editingTarget, newVersion);
                });
            } else {
                this.lastProcessedVersion = oldVersion;
                this.props.onRevertRubyVersion(oldVersion);
                this.props.onShowAlert('rubyVersionChangeFailed');
                this.showErrors(converter.errors);
            }
        } else {
            this.clearErrors();
            this.props.updateRubyCodeTargetState(this.props.vm.editingTarget, newVersion);
        }
    }

    setContainerRef (ref) {
        this.containerRef = ref;
    }

    handleEditorDidMount (editor, monaco) {
        this.editorRef = editor;
        this.monacoRef = monaco;

        window.monacoEditor = editor;
        window.monaco = monaco;

        // Custom paste action for Monaco Editor v0.55.1 standalone environment
        editor.addAction({
            id: 'smalruby.paste',
            label: this.props.intl.formatMessage({
                id: 'gui.rubyTab.paste',
                defaultMessage: 'Paste'
            }),
            contextMenuGroupId: '9_cutcopypaste',
            contextMenuOrder: 4,
            precondition: '!editorReadonly',
            run: async ed => {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                        ed.trigger('keyboard', 'type', {text});
                    }
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('Smalruby custom paste error:', err);
                }
            }
        });

        // Hide original (broken) Paste action in Monaco Editor v0.55.1 context menu.
        // Monaco renders context menus in a Shadow DOM (.shadow-root-host).
        // The aria-label is on .action-label (child), NOT on .action-item itself.
        // We use a MutationObserver to hide the broken original paste item each time
        // the menu opens. We also call hideDuplicatePaste() immediately on setup because
        // the shadow host may be created lazily (on first right-click), at which point
        // menu items are already in the DOM before the observer starts watching.
        const hideDuplicatePaste = shadowRoot => {
            const pasteLabels = Array.from(shadowRoot.querySelectorAll(
                '.action-label[aria-label="Paste"], .action-label[aria-label="貼り付け"]'
            ));
            if (pasteLabels.length >= 2) {
                // Hide the first item (original broken Monaco paste action)
                const firstPasteItem = pasteLabels[0].closest('.action-item');
                if (firstPasteItem) {
                    firstPasteItem.style.display = 'none';
                }
            }
        };

        const setupPasteMutationObserver = host => {
            if (this.pasteMutationObserver) return;

            this.pasteMutationObserver = new MutationObserver(() => {
                hideDuplicatePaste(host.shadowRoot);
            });
            this.pasteMutationObserver.observe(host.shadowRoot, {
                childList: true,
                subtree: true
            });

            // Run immediately in case menu items are already in the DOM
            // (this happens when the shadow host is created on first right-click,
            // at which point all items are added before our observer starts watching)
            hideDuplicatePaste(host.shadowRoot);
        };

        const shadowRootHost = document.querySelector('.shadow-root-host');
        if (shadowRootHost && shadowRootHost.shadowRoot) {
            setupPasteMutationObserver(shadowRootHost);
        } else {
            this.bodyMutationObserver = new MutationObserver(() => {
                const host = document.querySelector('.shadow-root-host');
                if (host && host.shadowRoot) {
                    setupPasteMutationObserver(host);
                    this.bodyMutationObserver.disconnect();
                    this.bodyMutationObserver = null;
                }
            });
            this.bodyMutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // Register Smalruby language
        monaco.languages.register({id: 'smalruby'});
        monaco.languages.setMonarchTokensProvider('smalruby', smalrubyLanguage);
        monaco.languages.setLanguageConfiguration('smalruby', smalrubyLanguageConfiguration);

        if (!this.completionProviderManager) {
            this.completionProviderManager = new CompletionProviderManager();
            const completer = new SnippetsCompleter(this.props.vm);
            this.completionProviderManager.register(monaco, 'smalruby', {
                provideCompletionItems: (model, position, context, token) => (
                    completer.provideCompletionItems(model, position, context, token, monaco)
                )
            });
        }

        if (this.containerRef) {
            this.resizeObserver = new ResizeObserver(() => {
                editor.layout();
            });
            this.resizeObserver.observe(this.containerRef);
        }

        this.contentChangeListener = editor.onDidChangeModelContent(() => {
            this.updateUndoRedoState();
            if (this.state.furiganaEnabled) {
                this._scheduleFuriganaUpdate();
            }
        });

        // Restore furigana if it was enabled in the previous session
        if (this.state.furiganaEnabled) {
            this._renderFurigana();
        }

        editor.onDidChangeCursorPosition(() => {
            this.handleDismissBubble();
        });

        editor.onMouseDown(() => {
            this.handleDismissBubble();
        });

        this.updateUndoRedoState();

        // Register the apply callback with GeminiModalHOC
        if (this.props.onRegisterGeminiApply) {
            this.props.onRegisterGeminiApply(this.handleApplyGeminiCode);
        }
    }

    updateUndoRedoState () {
        if (!this.editorRef) {
            return;
        }

        const model = this.editorRef.getModel();
        if (!model) {
            return;
        }

        // Access internal _undoRedoService to check undo/redo state
        // Note: This uses private API which may change in future Monaco Editor versions
        const undoRedoService = model._undoRedoService;
        if (undoRedoService && typeof undoRedoService.canUndo === 'function') {
            const resource = model.uri;
            const canUndo = undoRedoService.canUndo(resource);
            const canRedo = undoRedoService.canRedo(resource);

            this.setState({
                canUndo,
                canRedo
            });
        }
    }

    handleEditorChange (value) {
        this.props.onChange(value);
    }

    handleZoomIn () {
        const currentSize = this.props.rubyCode.fontSize || DEFAULT_FONT_SIZE;
        const nextSize = FONT_SIZES.find(s => s > currentSize);
        if (nextSize) {
            this.props.onFontSizeChange(nextSize);
        }
    }

    handleZoomOut () {
        const currentSize = this.props.rubyCode.fontSize || DEFAULT_FONT_SIZE;
        const prevSize = FONT_SIZES.slice().reverse()
            .find(s => s < currentSize);
        if (prevSize) {
            this.props.onFontSizeChange(prevSize);
        }
    }

    handleZoomReset () {
        this.props.onFontSizeChange(DEFAULT_FONT_SIZE);
    }

    getSaveToComputerHandler (downloadProjectCallback) {
        return () => {
            this.props.onRequestCloseFile();
            downloadProjectCallback();
            if (this.props.onProjectTelemetryEvent) {
                const metadata = collectMetadata(this.props.vm, this.props.projectTitle, this.props.locale);
                this.props.onProjectTelemetryEvent('projectDidSave', metadata);
            }
        };
    }

    getSaveAIHandler (downloadProjectCallback) {
        return () => {
            // Set AI save status to 'saving'
            this.props.onSetAiSaveStatus('saving');
            // Call download callback
            downloadProjectCallback();
        };
    }

    handleAISaveFinished () {
        // Set AI save status to 'saved'
        this.props.onSetAiSaveStatus('saved');
        // Clear status after 3 seconds
        setTimeout(() => {
            this.props.onClearAiSaveStatus();
        }, 3000);
    }

    handleAISaveError () {
        // Clear AI save status
        this.props.onClearAiSaveStatus();
    }

    handleSelectTarget (targetId) {
        // Set editing target in VM
        const target = this.props.vm.runtime.getTargetById(targetId);
        if (target) {
            this.props.vm.setEditingTarget(target.id);
        }
    }

    handleDownload () {
        // Trigger Ruby code download
        if (this.downloadCallbackRef) {
            const handler = this.getSaveToComputerHandler(this.downloadCallbackRef);
            handler();
        }
    }

    handleScriptGlowOn (data) {
        this.setState({runningBlockId: data.id});
    }

    handleScriptGlowOff (data) {
        if (this.state.runningBlockId === data.id) {
            this.setState({runningBlockId: null, executingLine: null});
            this.clearExecutingLineHighlight();
        }
    }

    handleVisualReport (data) {
        if (this.props.activeTabIndex !== RUBY_TAB_INDEX) {
            return;
        }

        const button = document.querySelector('button[aria-label*="カーソル行を実行"]') ||
                       document.querySelector('button[aria-label*="Execute current line"]') ||
                       document.querySelector('button[aria-label*="実行を停止"]') ||
                       document.querySelector('button[aria-label*="Stop execution"]');
        if (!button) {
            return;
        }

        const rect = button.getBoundingClientRect();

        if (!this.bubbleRef) {
            this.bubbleRef = document.createElement('div');
            this.bubbleRef.className = styles.valueReportBubble;
            document.body.appendChild(this.bubbleRef);
        }

        this.bubbleRef.textContent = String(data.value);

        const x = rect.right + 10;
        const y = rect.top;

        this.bubbleRef.style.left = `${x}px`;
        this.bubbleRef.style.top = `${y}px`;

        requestAnimationFrame(() => {
            this.bubbleRef.classList.add(styles.visible);
        });
    }

    handleDismissBubble () {
        if (this.bubbleRef) {
            this.bubbleRef.classList.remove(styles.visible);
        }
    }

    handleApplyGeminiCode (code) {
        this.props.onChange(code);
    }

    handleToggleFurigana () {
        const enabled = !this.state.furiganaEnabled;
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(FURIGANA_ENABLED_KEY, enabled);
        }
        this.setState({furiganaEnabled: enabled}, () => {
            if (!this.editorRef || !this.monacoRef) return;
            if (enabled) {
                this._renderFurigana();
            } else {
                this.furiganaRenderer.clear(this.editorRef);
            }
        });
    }

    _renderFurigana () {
        if (!this.editorRef || !this.monacoRef) return;
        const prism = getPrism();
        if (prism) {
            const code = this.props.rubyCode.code || '';
            const t0 = performance.now();
            const parseResult = prism.parse(code);
            const annotations = this.furiganaAnnotator.annotate(code, parseResult);
            this.furiganaRenderer.render(this.editorRef, this.monacoRef, annotations);
            this.furiganaLastMs = performance.now() - t0;
        } else {
            loadPrism().then(loadedPrism => {
                if (!this.state.furiganaEnabled || !this.editorRef || !this.monacoRef) return;
                const code = this.props.rubyCode.code || '';
                const t0 = performance.now();
                const parseResult = loadedPrism.parse(code);
                const annotations = this.furiganaAnnotator.annotate(code, parseResult);
                this.furiganaRenderer.render(this.editorRef, this.monacoRef, annotations);
                this.furiganaLastMs = performance.now() - t0;
            });
        }
    }

    _scheduleFuriganaUpdate () {
        if (this.furiganaDebounceTimer) {
            clearTimeout(this.furiganaDebounceTimer);
        }
        // Wait 2x the last render time (minimum 50ms) so typing never races with rendering
        const delay = Math.max(50, this.furiganaLastMs * 2);
        this.furiganaDebounceTimer = setTimeout(() => {
            this.furiganaDebounceTimer = null;
            if (this.state.furiganaEnabled) {
                this._renderFurigana();
            }
        }, delay);
    }

    clearExecutingLineHighlight () {
        if (this.executingLineDecoration) {
            this.executingLineDecoration.clear();
            this.executingLineDecoration = null;
        }
    }

    highlightExecutingLine (lineNumber) {
        if (!this.editorRef || !this.monacoRef) {
            return;
        }

        this.clearExecutingLineHighlight();

        this.executingLineDecoration = this.editorRef.createDecorationsCollection([{
            range: new this.monacoRef.Range(lineNumber, 1, lineNumber, 1),
            options: {
                isWholeLine: true,
                className: 'executing-line'
            }
        }]);

        // Scroll to the executing line
        this.editorRef.revealLineInCenter(lineNumber);
    }

    highlightExecutingLineRange (startLine, endLine) {
        if (!this.editorRef || !this.monacoRef) {
            return;
        }

        this.clearExecutingLineHighlight();

        this.executingLineDecoration = this.editorRef.createDecorationsCollection([{
            range: new this.monacoRef.Range(startLine, 1, endLine, 1),
            options: {
                isWholeLine: true,
                className: 'executing-line'
            }
        }]);

        // Scroll to reveal the range (center on the middle line)
        const middleLine = Math.floor((startLine + endLine) / 2);
        this.editorRef.revealLineInCenter(middleLine);
    }

    async handleExecuteLine (lineNumber) {
        // If already running, stop it
        if (this.state.runningBlockId) {
            this.props.vm.runtime.toggleScript(this.state.runningBlockId, {
                target: this.props.vm.editingTarget,
                stackClick: true
            });
            return;
        }

        // Clear any previous errors before starting a new execution
        this.clearErrors();

        // Find the actual line to execute (skip empty lines)
        const rubyCode = this.props.rubyCode.code;
        const lines = rubyCode.split('\n');
        let targetLine = lineNumber;

        // If the current line is empty or whitespace-only, search upwards for a non-empty line
        while (targetLine >= 1) {
            const line = lines[targetLine - 1]; // Convert to 0-indexed
            if (line && line.trim() !== '') {
                break;
            }
            targetLine--;
        }

        // If no non-empty line found, cannot execute
        if (targetLine < 1) {
            // eslint-disable-next-line no-console
            console.warn('[handleExecuteLine] No non-empty line found');
            this.props.onShowAlert('cannotExecuteLine');
            return;
        }

        const converter = await targetCodeToBlocks(
            this.props.vm,
            this.props.rubyCode.target,
            rubyCode,
            this.props.intl,
            {version: this.props.rubyVersion}
        );

        if (!converter.result) {
            this.props.onShowAlert('convertRubyToBlocksError');
            this.props.updateRubyCodeErrorsState(converter.errors);
            this.showErrors(converter.errors);
            return;
        }

        converter.apply()
            .then(() => {
                const blockId = converter.getBlockIdForLine(targetLine);

                if (!blockId) {
                    // eslint-disable-next-line no-console
                    console.warn(`[handleExecuteLine] No executable block found at line ${targetLine}`);
                    this.props.onShowAlert('cannotExecuteLine');
                    return;
                }

                // Execute from top of block stack (like Scratch's behavior)
                const topBlockId = this.props.vm.editingTarget.blocks.getTopLevelScript(blockId);

                if (!topBlockId) {
                    // eslint-disable-next-line no-console
                    console.warn(`[handleExecuteLine] Could not find top-level block for blockId ${blockId}`);
                    this.props.onShowAlert('cannotExecuteLine');
                    return;
                }

                const blocks = this.props.vm.editingTarget.blocks;
                const lineRange = converter.getLineRangeForTopLevelScript(topBlockId, blocks);

                if (lineRange) {
                    this.setState({executingLine: targetLine});
                    this.highlightExecutingLineRange(lineRange.startLine, lineRange.endLine);
                } else {
                    // Fallback to single line highlight
                    this.setState({executingLine: targetLine});
                    this.highlightExecutingLine(targetLine);
                }

                this.props.vm.runtime.toggleScript(topBlockId, {
                    target: this.props.vm.editingTarget,
                    stackClick: true
                });
            })
            .catch(error => {
                // eslint-disable-next-line no-console
                console.error('[handleExecuteLine] Apply error:', error);
                this.props.onShowAlert('convertRubyToBlocksError');
            });
    }

    render () {
        const {
            rubyCode,
            vm
        } = this.props;
        const {
            code,
            fontSize
        } = rubyCode;

        return (
            <>
                <div
                    ref={this.setContainerRef}
                    className={styles.editorContainer}
                >
                    <RubyToolbar
                        editingTarget={vm.editingTarget}
                        vm={vm}
                        editorRef={this.editorRef}
                        onSelectTarget={this.handleSelectTarget}
                        onDownload={this.handleDownload}
                        onExecuteLine={this.handleExecuteLine}
                        onDismissBubble={this.handleDismissBubble}
                        onOpenGeminiModal={this.props.onOpenGeminiModal}
                        isRunning={!!this.state.runningBlockId}
                        canUndo={this.state.canUndo}
                        canRedo={this.state.canRedo}
                        furiganaEnabled={this.state.furiganaEnabled}
                        onToggleFurigana={this.handleToggleFurigana}
                    />
                    <div className={styles.editorWrapper}>
                        <Editor
                            key={this.props.locale}
                            height="100%"
                            language="smalruby"
                            onMount={this.handleEditorDidMount}
                            onChange={this.handleEditorChange}
                            options={{
                                fontSize: fontSize || DEFAULT_FONT_SIZE,
                                fontFamily: 'Monaco, Menlo, Consolas, "source-code-pro", monospace',
                                minimap: {enabled: false},
                                renderWhitespace: 'all',
                                scrollBeyondLastLine: true,
                                tabSize: 2,
                                fixedOverflowWidgets: true,
                                wordBasedSuggestions: 'off',
                                autoIndent: 'full'
                            }}
                            theme="vs"
                            value={code}
                            width="100%"
                        />
                    </div>
                </div>
                {/* Hidden RubyDownloader for storing download callback */}
                <RubyDownloader
                    onSaveError={this.handleAISaveError}
                    onSaveFinished={this.handleAISaveFinished}
                >
                    {(_, downloadProjectCallback) => {
                        this.downloadCallbackRef = downloadProjectCallback;
                        return null;
                    }}
                </RubyDownloader>
                <div className={styles.zoomControlsWrapper}>
                    <button
                        className={styles.zoomButton}
                        onClick={this.handleZoomIn}
                    >
                        <img
                            src="./static/blocks-media/default/zoom-in.svg"
                            className={styles.zoomIcon}
                        />
                    </button>
                    <button
                        className={styles.zoomButton}
                        onClick={this.handleZoomOut}
                    >
                        <img
                            src="./static/blocks-media/default/zoom-out.svg"
                            className={styles.zoomIcon}
                        />
                    </button>
                    <button
                        className={styles.zoomButton}
                        onClick={this.handleZoomReset}
                    >
                        <img
                            src="./static/blocks-media/default/zoom-reset.svg"
                            className={styles.zoomIcon}
                        />
                    </button>
                </div>
            </>
        );
    }
}

RubyTab.propTypes = {
    blocksTabVisible: PropTypes.bool,
    editingTarget: PropTypes.string,
    intl: intlShape.isRequired,
    isVisible: PropTypes.bool,
    onChange: PropTypes.func,
    onOpenGeminiModal: PropTypes.func,
    onRegisterGeminiApply: PropTypes.func,
    onRequestCloseFile: PropTypes.func,
    onProjectTelemetryEvent: PropTypes.func,
    onSetAiSaveStatus: PropTypes.func,
    onClearAiSaveStatus: PropTypes.func,
    onFontSizeChange: PropTypes.func,
    onRevertRubyVersion: PropTypes.func,
    onShowAlert: PropTypes.func,
    onDismissAlert: PropTypes.func,
    onMarkRubyTabUsed: PropTypes.func,
    rubyCode: rubyCodeShape,
    rubyVersion: PropTypes.string,
    targetCodeToBlocks: PropTypes.func,
    updateRubyCodeErrorsState: PropTypes.func,
    updateRubyCodeTargetState: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired,
    projectTitle: PropTypes.string,
    locale: PropTypes.string,
    activeTabIndex: PropTypes.number
};

const mapStateToProps = state => ({
    blocksTabVisible: state.scratchGui.editorTab.activeTabIndex === BLOCKS_TAB_INDEX,
    editingTarget: state.scratchGui.targets.editingTarget,
    rubyCode: state.scratchGui.rubyCode,
    rubyVersion: state.scratchGui.settings.rubyVersion,
    vm: state.scratchGui.vm,
    projectTitle: state.scratchGui.projectTitle,
    locale: state.locales.locale,
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex
});

const mapDispatchToProps = dispatch => ({
    onChange: code => dispatch(updateRubyCode(code)),
    updateRubyCodeErrorsState: errors => dispatch(updateRubyCodeErrors(errors)),
    updateRubyCodeTargetState: (target, version) => dispatch(updateRubyCodeTarget(target, version)),
    onRevertRubyVersion: version => dispatch(setRubyVersion(version)),
    onShowAlert: alertId => showAlertWithTimeout(dispatch, alertId),
    onDismissAlert: alertId => dispatch(closeAlertWithId(alertId)),
    onRequestCloseFile: () => dispatch(closeFileMenu()),
    onSetAiSaveStatus: status => dispatch(setAiSaveStatus(status)),
    onClearAiSaveStatus: () => dispatch(clearAiSaveStatus()),
    onFontSizeChange: fontSize => dispatch(updateRubyFontSize(fontSize)),
    onMarkRubyTabUsed: () => dispatch(markRubyTabUsed())
});

const ConnectedRubyTab = RubyToBlocksConverterHOC(injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(RubyTab)));

export default GeminiModalHOC(ConnectedRubyTab);
