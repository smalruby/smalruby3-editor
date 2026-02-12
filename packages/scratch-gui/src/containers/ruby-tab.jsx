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
import VM from '@smalruby/scratch-vm';
import {BLOCKS_TAB_INDEX} from '../reducers/editor-tab';

import RubyToBlocksConverterHOC from '../lib/ruby-to-blocks-converter-hoc.jsx';

import SnippetsCompleter from './ruby-tab/snippets-completer';
import {smalrubyLanguage} from './ruby-tab/smalruby-mode';

import RubyDownloader from './ruby-downloader.jsx';
import RubyToolbar from '../components/ruby-toolbar/ruby-toolbar.jsx';
import collectMetadata from '../lib/collect-metadata.js';
import {closeFileMenu} from '../reducers/menus.js';
import {setAiSaveStatus, clearAiSaveStatus} from '../reducers/koshien-file';
import styles from './ruby-tab/ruby-tab.css';
import {loadMonacoLocale} from '../lib/monaco-i18n-helper';

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48];
const DEFAULT_FONT_SIZE = 16;

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
            'handleDownload'
        ]);
        this.mainTooltipId = 'ruby-downloader-tooltip';
        this.editorRef = null;
        this.monacoRef = null;
        this.containerRef = null;
        this.resizeObserver = null;
        this.completionProvider = null;
        this.lastProcessedVersion = props.rubyVersion;
        this.downloadCallbackRef = null;

        loadMonacoLocale(props.locale);
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
                const converter = this.props.targetCodeToBlocks(this.props.intl);
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
        }
    }

    componentWillUnmount () {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.completionProvider) {
            this.completionProvider.dispose();
            this.completionProvider = null;
        }
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

    handleRubyVersionChange (oldVersion, newVersion) {
        this.lastProcessedVersion = newVersion;
        if (this.props.rubyCode.modified) {
            const converter = this.props.targetCodeToBlocks(this.props.intl);
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

        // Register Smalruby language
        monaco.languages.register({id: 'smalruby'});
        monaco.languages.setMonarchTokensProvider('smalruby', smalrubyLanguage);

        if (!this.completionProvider) {
            const completer = new SnippetsCompleter();
            this.completionProvider = monaco.languages.registerCompletionItemProvider('smalruby', {
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
                                fixedOverflowWidgets: true
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
    onRequestCloseFile: PropTypes.func,
    onProjectTelemetryEvent: PropTypes.func,
    onSetAiSaveStatus: PropTypes.func,
    onClearAiSaveStatus: PropTypes.func,
    onFontSizeChange: PropTypes.func,
    onRevertRubyVersion: PropTypes.func,
    onShowAlert: PropTypes.func,
    onDismissAlert: PropTypes.func,
    rubyCode: rubyCodeShape,
    rubyVersion: PropTypes.string,
    targetCodeToBlocks: PropTypes.func,
    updateRubyCodeErrorsState: PropTypes.func,
    updateRubyCodeTargetState: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired,
    projectTitle: PropTypes.string,
    locale: PropTypes.string
};

const mapStateToProps = state => ({
    blocksTabVisible: state.scratchGui.editorTab.activeTabIndex === BLOCKS_TAB_INDEX,
    editingTarget: state.scratchGui.targets.editingTarget,
    rubyCode: state.scratchGui.rubyCode,
    rubyVersion: state.scratchGui.settings.rubyVersion,
    vm: state.scratchGui.vm,
    projectTitle: state.scratchGui.projectTitle,
    locale: state.locales.locale
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
    onFontSizeChange: fontSize => dispatch(updateRubyFontSize(fontSize))
});

export default RubyToBlocksConverterHOC(injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(RubyTab)));
