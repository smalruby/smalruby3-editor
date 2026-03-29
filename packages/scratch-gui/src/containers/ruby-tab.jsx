import PropTypes from 'prop-types';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import Editor from '@monaco-editor/react';
import VM from '@smalruby/scratch-vm';
import AutoCorrectModal from '../components/auto-correct-modal/auto-correct-modal.jsx';
import cameraIcon from '../components/blocks-screenshot-button/icon--camera.svg';
import RubyScriptPreview from '../components/ruby-script-preview/ruby-script-preview.jsx';
import RubyToolbar from '../components/ruby-toolbar/ruby-toolbar.jsx';
import { autoCorrect, defaultSettings as defaultAutoCorrectSettings } from '../lib/auto-correct';
import collectMetadata from '../lib/collect-metadata.js';
import { DnclSourceMap } from '../lib/dncl/dncl-source-map';
// === Smalruby: Start of DNCL mode imports ===
import { dnclToRuby } from '../lib/dncl/dncl-to-ruby';
import { rubyToDncl } from '../lib/dncl/ruby-to-dncl';
import FuriganaAnnotator from '../lib/furigana-annotator';
import { wrapCurrentCodeWithClass } from '../lib/insert-class';
import intlShape from '../lib/intlShape.js';
// === Smalruby: End of module editor update ===
// === Smalruby: Start of module sync ===
import { syncModules } from '../lib/module-sync';
import { loadMonacoLocale } from '../lib/monaco-i18n-helper';
import { getPrism, loadPrism } from '../lib/prism-parser';
// === Smalruby: Start of module editor update ===
import RubyGenerator from '../lib/ruby-generator';
import { downloadRubyAsImage } from '../lib/ruby-screenshot';
import { generatePreviewCode } from '../lib/ruby-script-preview';
import { targetCodeToBlocks } from '../lib/ruby-to-blocks-converter';
import RubyToBlocksConverterHOC from '../lib/ruby-to-blocks-converter-hoc.jsx';
import { containsV1Code } from '../lib/ruby-to-blocks-converter/v1-detection';
import { getUrlParams } from '../lib/url-params';
import { showAlertWithTimeout, closeAlertWithId } from '../reducers/alerts';
import { BLOCKS_TAB_INDEX, RUBY_TAB_INDEX } from '../reducers/editor-tab';
import { setAiSaveStatus, clearAiSaveStatus } from '../reducers/koshien-file';
import { closeFileMenu } from '../reducers/menus.js';
import { setProjectChanged } from '../reducers/project-changed';
import {
    rubyCodeShape,
    updateRubyCode,
    updateRubyCodeErrors,
    updateRubyCodeTarget,
    updateRubyFontSize,
} from '../reducers/ruby-code';
import { setRubyVersion, dismissV1Prompt } from '../reducers/settings';
import { markRubyTabUsed } from '../reducers/tutorial-onboarding';
import RubyDownloader from './ruby-downloader.jsx';
import {
    FONT_SIZES,
    DEFAULT_FONT_SIZE,
    FURIGANA_ENABLED_KEY,
    AUTO_CORRECT_ENABLED_KEY,
    AUTO_CORRECT_SETTINGS_KEY,
    DNCL_MODE_KEY,
} from './ruby-tab/constants';
// === Smalruby: End of DNCL mode imports ===
import updateDebugGlobals from './ruby-tab/debug-globals';
import {
    registerCustomPasteAction,
    setupPasteDuplicateHider,
    registerLanguageAndProviders,
} from './ruby-tab/editor-setup';
import {
    clearDecoration,
    highlightLine,
    highlightLineRange,
    findExecutableLine,
} from './ruby-tab/execution-highlighter';
import FuriganaRenderer from './ruby-tab/furigana-renderer';
// === Smalruby: End of module sync ===

import QuickFixProvider from './ruby-tab/quick-fix-provider';
import styles from './ruby-tab/ruby-tab.css';
import { showBubble, dismissBubble, removeBubble } from './ruby-tab/visual-report-bubble';
import RubyteeModalHOC from './rubytee-modal-hoc.jsx';

// === Initialization helpers ===

const loadBool = (key, defaultVal) => {
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key) !== 'false';
    }
    return defaultVal;
};

const loadAutoCorrectSettings = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            const raw = window.localStorage.getItem(AUTO_CORRECT_SETTINGS_KEY);
            if (raw) return { ...defaultAutoCorrectSettings, ...JSON.parse(raw) };
        } catch (_e) {
            /* use defaults */
        }
    }
    return defaultAutoCorrectSettings;
};

// === Component ===

const RubyTab = props => {
    const {
        vm,
        intl,
        rubyCode,
        rubyVersion,
        locale,
        activeTabIndex,
        isVisible,
        editingTarget,
        blocksTabVisible,
        onChange,
        updateRubyCodeErrorsState,
        updateRubyCodeTargetState,
        targetCodeToBlocks: targetCodeToBlocksHOC,
        onRevertRubyVersion,
        onShowAlert,
        onDismissAlert,
        onRequestCloseFile,
        onProjectTelemetryEvent,
        onSetAiSaveStatus,
        onClearAiSaveStatus,
        onFontSizeChange,
        onMarkRubyTabUsed,
        onOpenRubyteeModal,
        onRegisterRubyteeApply,
        v1PromptDismissed,
        onDismissV1Prompt,
    } = props;

    // --- State ---
    const [runningBlockId, setRunningBlockId] = useState(null);
    const [executingLine, setExecutingLine] = useState(null); // set by execution, read for future use
    void executingLine;
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    // === Smalruby: Start of furigana URL param override ===
    const [furiganaEnabled, setFuriganaEnabled] = useState(() => {
        const urlRubyMode = getUrlParams().rubyMode;
        if (urlRubyMode === 'furigana') return true;
        if (urlRubyMode === 'ruby' || urlRubyMode === 'dncl') return false;
        return loadBool(FURIGANA_ENABLED_KEY, true);
    });
    // === Smalruby: End of furigana URL param override ===
    const [autoCorrectEnabled, setAutoCorrectEnabled] = useState(() => loadBool(AUTO_CORRECT_ENABLED_KEY, true));
    const [autoCorrectSettings, setAutoCorrectSettings] = useState(loadAutoCorrectSettings);
    const [showAutoCorrectModal, setShowAutoCorrectModal] = useState(false);
    const [showScriptPreview, setShowScriptPreview] = useState(false);
    const [previewCode, setPreviewCode] = useState('');
    // === Smalruby: Start of DNCL mode state ===
    const [dnclMode, setDnclMode] = useState(() => {
        const urlRubyMode = getUrlParams().rubyMode;
        if (urlRubyMode === 'dncl') return true;
        if (urlRubyMode === 'furigana' || urlRubyMode === 'ruby') return false;
        // loadBool treats missing keys as true; DNCL defaults to off
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(DNCL_MODE_KEY) === 'true';
        }
        return false;
    });
    // Separate DNCL display code to prevent editor from showing Ruby
    const [dnclDisplayCode, setDnclDisplayCode] = useState('');
    const dnclSourceMapRef = useRef(null);
    const dnclModeRef = useRef(dnclMode);
    dnclModeRef.current = dnclMode;
    // === Smalruby: End of DNCL mode state ===

    // --- Instance refs ---
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const containerRef = useRef(null);
    const resizeObserverRef = useRef(null);
    const completionProviderManagerRef = useRef(null);
    const lastProcessedVersionRef = useRef(rubyVersion);
    const downloadCallbackRef = useRef(null);
    const executingLineDecorationRef = useRef(null);
    const contentChangeListenerRef = useRef(null);
    const configChangeListenerRef = useRef(null);
    const pasteMutationObserverRef = useRef(null);
    const bodyMutationObserverRef = useRef(null);
    const bubbleElRef = useRef(null);
    const quickFixProviderRef = useRef(null);
    const furiganaAnnotatorRef = useRef(null);
    const furiganaRendererRef = useRef(null);
    const furiganaDebounceTimerRef = useRef(null);
    const furiganaLastMsRef = useRef(0);
    const isAutoCorrectUpdateRef = useRef(false);

    // Lazy initialization of heavy objects
    if (!quickFixProviderRef.current) quickFixProviderRef.current = new QuickFixProvider();
    if (!furiganaAnnotatorRef.current) furiganaAnnotatorRef.current = new FuriganaAnnotator();
    if (!furiganaRendererRef.current) furiganaRendererRef.current = new FuriganaRenderer();

    // --- State/Props refs for stable callbacks ---
    const runningBlockIdRef = useRef(runningBlockId);
    runningBlockIdRef.current = runningBlockId;
    const furiganaEnabledRef = useRef(furiganaEnabled);
    furiganaEnabledRef.current = furiganaEnabled;
    const autoCorrectEnabledRef = useRef(autoCorrectEnabled);
    autoCorrectEnabledRef.current = autoCorrectEnabled;
    const autoCorrectSettingsRef = useRef(autoCorrectSettings);
    autoCorrectSettingsRef.current = autoCorrectSettings;
    const activeTabIndexRef = useRef(activeTabIndex);
    activeTabIndexRef.current = activeTabIndex;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const intlRef = useRef(intl);
    intlRef.current = intl;
    const vmRef = useRef(vm);
    vmRef.current = vm;
    // Load Monaco locale synchronously before first render
    const localeLoadedRef = useRef(false);
    if (!localeLoadedRef.current) {
        loadMonacoLocale(locale);
        localeLoadedRef.current = true;
    }

    // --- Helper functions ---

    const clearErrors = () => {
        if (editorRef.current && monacoRef.current) {
            monacoRef.current.editor.setModelMarkers(editorRef.current.getModel(), 'smalruby', []);
            editorRef.current.trigger('source', 'closeMarkersNavigation');
        }
        if (rubyCode.errors.length > 0) {
            updateRubyCodeErrorsState([]);
        }
        onDismissAlert('convertRubyToBlocksError');
        onDismissAlert('rubyVersionChangeFailed');
    };

    const showErrors = errors => {
        if (editorRef.current && monacoRef.current) {
            const markers = errors.map(err => ({
                startLineNumber: err.row + 1,
                startColumn: err.column + 1,
                endLineNumber: err.row + 1,
                endColumn: err.source ? err.column + err.source.length + 1 : 1000,
                message: err.text,
                severity: monacoRef.current.MarkerSeverity.Error,
            }));
            monacoRef.current.editor.setModelMarkers(editorRef.current.getModel(), 'smalruby', markers);
            if (markers.length > 0) {
                const error = errors[0];
                editorRef.current.setPosition({
                    lineNumber: error.row + 1,
                    column: error.column + 1,
                });
                editorRef.current.focus();
                editorRef.current.trigger('source', 'editor.action.marker.next');
            }
        }
    };

    const renderFurigana = () => {
        if (!editorRef.current || !monacoRef.current) return;
        const code = editorRef.current.getValue() || '';
        const prism = getPrism();
        if (prism) {
            const t0 = performance.now();
            const parseResult = prism.parse(code);
            const annotations = furiganaAnnotatorRef.current.annotate(code, parseResult);
            furiganaRendererRef.current.render(editorRef.current, monacoRef.current, annotations);
            furiganaLastMsRef.current = performance.now() - t0;
        } else {
            loadPrism().then(loadedPrism => {
                if (!furiganaEnabledRef.current) return;
                if (!editorRef.current || !monacoRef.current) return;
                const currentCode = editorRef.current.getValue() || '';
                const t0 = performance.now();
                const parseResult = loadedPrism.parse(currentCode);
                const annotations = furiganaAnnotatorRef.current.annotate(currentCode, parseResult);
                furiganaRendererRef.current.render(editorRef.current, monacoRef.current, annotations);
                furiganaLastMsRef.current = performance.now() - t0;
            });
        }
    };

    const scheduleFuriganaUpdate = () => {
        if (furiganaDebounceTimerRef.current) {
            clearTimeout(furiganaDebounceTimerRef.current);
        }
        const delay = Math.max(50, furiganaLastMsRef.current * 2);
        furiganaDebounceTimerRef.current = setTimeout(() => {
            furiganaDebounceTimerRef.current = null;
            if (furiganaEnabledRef.current) {
                renderFurigana();
            }
        }, delay);
    };

    const updateUndoRedoState = () => {
        if (!editorRef.current) return;
        const model = editorRef.current.getModel();
        if (!model) return;
        const undoRedoService = model._undoRedoService;
        if (undoRedoService && typeof undoRedoService.canUndo === 'function') {
            const resource = model.uri;
            setCanUndo(undoRedoService.canUndo(resource));
            setCanRedo(undoRedoService.canRedo(resource));
        }
    };

    const doHighlightLine = lineNumber => {
        if (!editorRef.current || !monacoRef.current) return;
        executingLineDecorationRef.current = highlightLine(
            editorRef.current,
            monacoRef.current,
            lineNumber,
            executingLineDecorationRef.current,
        );
    };

    const doHighlightLineRange = (startLine, endLine) => {
        if (!editorRef.current || !monacoRef.current) return;
        executingLineDecorationRef.current = highlightLineRange(
            editorRef.current,
            monacoRef.current,
            startLine,
            endLine,
            executingLineDecorationRef.current,
        );
    };

    // --- Stable VM event handlers ---

    const handleScriptGlowOn = useCallback(data => {
        setRunningBlockId(data.id);
    }, []);

    const handleScriptGlowOff = useCallback(data => {
        if (runningBlockIdRef.current === data.id) {
            setRunningBlockId(null);
            setExecutingLine(null);
            clearDecoration(executingLineDecorationRef.current);
            executingLineDecorationRef.current = null;
        }
    }, []);

    const handleVisualReport = useCallback(data => {
        if (activeTabIndexRef.current !== RUBY_TAB_INDEX) return;
        bubbleElRef.current = showBubble(bubbleElRef.current, data.value);
    }, []);

    const handleDismissBubbleStable = useCallback(() => {
        dismissBubble(bubbleElRef.current);
    }, []);

    // --- Stable Editor callbacks ---

    // === Smalruby: Start of DNCL-aware dispatch helper ===
    const dispatchCode = useCallback(code => {
        if (dnclModeRef.current) {
            setDnclDisplayCode(code);
            const result = dnclToRuby(code);
            if (result.errors && result.errors.length > 0) {
                // Show DNCL validation errors but don't dispatch invalid code
                dnclSourceMapRef.current = null;
                return;
            }
            dnclSourceMapRef.current = new DnclSourceMap(code, result.ruby);
            onChangeRef.current(result.ruby);
        } else {
            onChangeRef.current(code);
        }
    }, []);
    // === Smalruby: End of DNCL-aware dispatch helper ===

    const handleEditorChange = useCallback(
        value => {
            if (isAutoCorrectUpdateRef.current) {
                isAutoCorrectUpdateRef.current = false;
                dispatchCode(value);
                return;
            }
            if (autoCorrectEnabledRef.current && editorRef.current) {
                const corrected = autoCorrect(value, autoCorrectSettingsRef.current);
                if (corrected !== value) {
                    isAutoCorrectUpdateRef.current = true;
                    const position = editorRef.current.getPosition();
                    const model = editorRef.current.getModel();
                    const beforeCursor = value.substring(0, model.getOffsetAt(position));
                    const correctedBeforeCursor = autoCorrect(beforeCursor, autoCorrectSettingsRef.current);
                    const offsetDiff = beforeCursor.length - correctedBeforeCursor.length;
                    model.setValue(corrected);
                    const newOffset = model.getOffsetAt(position) - offsetDiff;
                    const newPosition = model.getPositionAt(Math.max(0, newOffset));
                    editorRef.current.setPosition(newPosition);
                    return;
                }
            }
            dispatchCode(value);
        },
        [dispatchCode],
    );

    const handleEditorDidMount = useCallback((editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        window.monacoEditor = editor;
        window.monaco = monaco;

        const pasteLabel = intlRef.current.formatMessage({
            id: 'gui.rubyTab.paste',
            defaultMessage: 'Paste',
        });
        registerCustomPasteAction(editor, pasteLabel);
        const observers = setupPasteDuplicateHider();
        pasteMutationObserverRef.current = observers.pasteMutationObserver;
        bodyMutationObserverRef.current = observers.bodyMutationObserver;

        completionProviderManagerRef.current = registerLanguageAndProviders(
            monaco,
            editor,
            vmRef.current,
            quickFixProviderRef.current,
            completionProviderManagerRef.current,
        );

        if (containerRef.current) {
            resizeObserverRef.current = new ResizeObserver(() => {
                editor.layout();
            });
            resizeObserverRef.current.observe(containerRef.current);
        }

        contentChangeListenerRef.current = editor.onDidChangeModelContent(() => {
            updateUndoRedoState();
            if (furiganaEnabledRef.current) {
                scheduleFuriganaUpdate();
            }
        });

        configChangeListenerRef.current = editor.onDidChangeConfiguration(e => {
            if (e.hasChanged(monaco.editor.EditorOption.fontInfo)) {
                if (furiganaEnabledRef.current) {
                    renderFurigana();
                }
            }
        });

        if (furiganaEnabledRef.current) {
            renderFurigana();
        }

        editor.onDidChangeCursorPosition(() => {
            dismissBubble(bubbleElRef.current);
        });

        editor.onMouseDown(() => {
            dismissBubble(bubbleElRef.current);
        });

        updateUndoRedoState();

        // Register callback for Rubytee (AI assistant) to insert code into the editor
        if (onRegisterRubyteeApply) {
            onRegisterRubyteeApply(code => {
                onChangeRef.current(code);
            });
        }
    }, []);

    // --- UI event handlers (useCallback for react/jsx-no-bind) ---

    const handleZoomIn = useCallback(() => {
        const currentSize = rubyCode.fontSize || DEFAULT_FONT_SIZE;
        const nextSize = FONT_SIZES.find(s => s > currentSize);
        if (nextSize) onFontSizeChange(nextSize);
    }, [rubyCode.fontSize, onFontSizeChange]);

    const handleZoomOut = useCallback(() => {
        const currentSize = rubyCode.fontSize || DEFAULT_FONT_SIZE;
        const prevSize = FONT_SIZES.slice()
            .reverse()
            .find(s => s < currentSize);
        if (prevSize) onFontSizeChange(prevSize);
    }, [rubyCode.fontSize, onFontSizeChange]);

    const handleZoomReset = useCallback(() => {
        onFontSizeChange(DEFAULT_FONT_SIZE);
    }, [onFontSizeChange]);

    const handleScreenshot = useCallback(() => {
        if (!editorRef.current) return;
        const target = vm.editingTarget;
        const spriteName = target ? target.sprite.name : 'sprite';
        const title = props.projectTitle || 'project';
        downloadRubyAsImage(editorRef.current, title, spriteName);
    }, [vm, props.projectTitle]);

    const handleSelectTarget = useCallback(
        targetId => {
            const target = vm.runtime.getTargetById(targetId);
            if (target) vm.setEditingTarget(target.id);
        },
        [vm],
    );

    const getSaveToComputerHandler = useCallback(
        downloadProjectCallback => () => {
            onRequestCloseFile();
            downloadProjectCallback();
            if (onProjectTelemetryEvent) {
                const metadata = collectMetadata(vm, props.projectTitle, locale);
                onProjectTelemetryEvent('projectDidSave', metadata);
            }
        },
        [onRequestCloseFile, onProjectTelemetryEvent, vm, props.projectTitle, locale],
    );

    const handleDownload = useCallback(() => {
        if (downloadCallbackRef.current) {
            const handler = getSaveToComputerHandler(downloadCallbackRef.current);
            handler();
        }
    }, [getSaveToComputerHandler]);

    const handleInsertClass = useCallback(() => {
        if (!editorRef.current) return;
        const code = editorRef.current.getValue() || '';
        const target = vm.editingTarget;
        if (!target) return;
        const wrapped = wrapCurrentCodeWithClass(code, target);
        if (wrapped === null) return; // class already exists
        const model = editorRef.current.getModel();
        const fullRange = model.getFullModelRange();
        editorRef.current.executeEdits('insertClass', [
            {
                range: fullRange,
                text: wrapped,
            },
        ]);
    }, [vm]);

    const handleAISaveFinished = useCallback(() => {
        onSetAiSaveStatus('saved');
        setTimeout(() => {
            onClearAiSaveStatus();
        }, 3000);
    }, [onSetAiSaveStatus, onClearAiSaveStatus]);

    const handleAISaveError = useCallback(() => {
        onClearAiSaveStatus();
    }, [onClearAiSaveStatus]);

    const handleConversionError = useCallback(
        errors => {
            onShowAlert('convertRubyToBlocksError');
            updateRubyCodeErrorsState(errors);
            showErrors(errors);
        },
        [onShowAlert, updateRubyCodeErrorsState],
    ); // showErrors uses refs, safe in stale closure

    // === Smalruby: Start of DNCL mode toggle ===
    const handleToggleDnclMode = useCallback(() => {
        setDnclMode(prev => {
            const enabled = !prev;
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(DNCL_MODE_KEY, enabled);
            }
            if (editorRef.current && monacoRef.current) {
                const model = editorRef.current.getModel();
                if (enabled) {
                    // Switching to DNCL: convert Ruby → DNCL
                    const currentRuby = model.getValue();
                    const result = rubyToDncl(currentRuby);
                    setDnclDisplayCode(result.dncl);
                    monacoRef.current.editor.setModelLanguage(model, 'dncl');
                    model.setValue(result.dncl);
                } else {
                    // Switching to Ruby: convert DNCL → Ruby
                    const currentDncl = model.getValue();
                    const result = dnclToRuby(currentDncl);
                    setDnclDisplayCode('');
                    monacoRef.current.editor.setModelLanguage(model, 'smalruby');
                    model.setValue(result.ruby);
                }
            }
            return enabled;
        });
    }, []);
    // === Smalruby: End of DNCL mode toggle ===

    const handleToggleFurigana = useCallback(() => {
        setFuriganaEnabled(prev => {
            const enabled = !prev;
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(FURIGANA_ENABLED_KEY, enabled);
            }
            return enabled;
        });
    }, []);

    const handleToggleAutoCorrect = useCallback(() => {
        setAutoCorrectEnabled(prev => {
            const enabled = !prev;
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(AUTO_CORRECT_ENABLED_KEY, enabled);
            }
            if (enabled && editorRef.current) {
                const value = editorRef.current.getValue();
                if (value) {
                    const corrected = autoCorrect(value, autoCorrectSettingsRef.current);
                    if (corrected !== value) {
                        isAutoCorrectUpdateRef.current = true;
                        const model = editorRef.current.getModel();
                        model.setValue(corrected);
                    }
                }
            }
            return enabled;
        });
    }, []);

    const handleOpenAutoCorrectSettings = useCallback(() => {
        setShowAutoCorrectModal(true);
    }, []);

    const handleCloseAutoCorrectSettings = useCallback(() => {
        setShowAutoCorrectModal(false);
    }, []);

    const handlePreviewRubyScript = useCallback(async () => {
        // Validate and convert Ruby code to blocks (same as download flow)
        if (rubyCode.modified) {
            const converter = await targetCodeToBlocks(vm, rubyCode.target, rubyCode.code, intl, {
                version: rubyVersion,
            });
            if (!converter.result) {
                onShowAlert('convertRubyToBlocksError');
                updateRubyCodeErrorsState(converter.errors);
                showErrors(converter.errors);
                return;
            }
            await converter.apply();
            props.onChange(rubyCode.code);
        }
        const code = generatePreviewCode(vm.editingTarget, rubyVersion);
        setPreviewCode(code);
        setShowScriptPreview(true);
    }, [vm, rubyCode, intl, rubyVersion, onShowAlert, updateRubyCodeErrorsState, props]);

    const handleCloseScriptPreview = useCallback(() => {
        setShowScriptPreview(false);
    }, []);

    const handleAutoCorrectSettingChange = useCallback((key, value) => {
        setAutoCorrectSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(AUTO_CORRECT_SETTINGS_KEY, JSON.stringify(newSettings));
            }
            return newSettings;
        });
    }, []);

    const handleRubyVersionChange = async (oldVersion, newVersion) => {
        lastProcessedVersionRef.current = newVersion;
        if (rubyCode.modified) {
            const converter = await targetCodeToBlocksHOC(intl);
            if (converter.result) {
                converter.apply().then(async () => {
                    clearErrors();
                    // === Smalruby: Start of module sync ===
                    if (rubyCode.target && String(newVersion) === '2') {
                        try {
                            await syncModules(vm, rubyCode.target, intl, newVersion);
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('Module sync error:', e);
                        }
                    }
                    // === Smalruby: End of module sync ===
                    updateRubyCodeTargetState(vm.editingTarget, newVersion);
                });
            } else {
                lastProcessedVersionRef.current = oldVersion;
                onRevertRubyVersion(oldVersion);
                onShowAlert('rubyVersionChangeFailed');
                showErrors(converter.errors);
            }
        } else {
            clearErrors();
            updateRubyCodeTargetState(vm.editingTarget, newVersion);
        }
    };

    const handleExecuteLine = useCallback(
        async lineNumber => {
            if (runningBlockIdRef.current) {
                vm.runtime.toggleScript(runningBlockIdRef.current, {
                    target: vm.editingTarget,
                    stackClick: true,
                });
                return;
            }

            clearErrors();

            const code = rubyCode.code;

            // === Smalruby: Start of DNCL mode execute all ===
            // In DNCL mode, execute all top-level scripts from top to bottom
            // instead of just the cursor line.
            const isDncl = dnclModeRef.current;
            const targetLine = isDncl ? 1 : findExecutableLine(code, lineNumber);
            // === Smalruby: End of DNCL mode execute all ===

            if (!targetLine) {
                // eslint-disable-next-line no-console
                console.warn('[handleExecuteLine] No non-empty line found');
                onShowAlert('cannotExecuteLine');
                return;
            }

            const converter = await targetCodeToBlocks(vm, rubyCode.target, code, intl, { version: rubyVersion });

            if (!converter.result) {
                onShowAlert('convertRubyToBlocksError');
                updateRubyCodeErrorsState(converter.errors);
                showErrors(converter.errors);
                return;
            }

            converter
                .apply()
                .then(() => {
                    // === Smalruby: Start of update editor after execute ===
                    // Regenerate Ruby code from blocks so that auto-imported
                    // modules are reflected in the editor immediately.
                    // Using direct editor setValue because Redux prop-driven
                    // updates via @monaco-editor/react may not take effect
                    // reliably within the same callback.
                    const regenerated = RubyGenerator.targetToCode(vm.editingTarget, { version: rubyVersion });
                    if (editorRef.current && regenerated !== code) {
                        // Remember cursor content to restore position after setValue
                        const cursorLine = editorRef.current.getPosition().lineNumber;
                        const cursorContent = editorRef.current.getModel().getLineContent(cursorLine).trim();

                        // === Smalruby: Start of DNCL mode preserve display ===
                        if (dnclModeRef.current) {
                            // Convert regenerated Ruby back to DNCL for display
                            const dnclResult = rubyToDncl(regenerated);
                            setDnclDisplayCode(dnclResult.dncl);
                            editorRef.current.setValue(dnclResult.dncl);
                        } else {
                            editorRef.current.setValue(regenerated);
                        }
                        // === Smalruby: End of DNCL mode preserve display ===

                        // Restore cursor to matching line in regenerated code
                        if (typeof cursorContent === 'string' && cursorContent.length > 0) {
                            const currentValue = editorRef.current.getValue();
                            const lines = currentValue.split('\n');
                            for (let i = 0; i < lines.length; i++) {
                                if (lines[i].trim() === cursorContent) {
                                    const newLine = i + 1;
                                    editorRef.current.setPosition({
                                        lineNumber: newLine,
                                        column: 1,
                                    });
                                    editorRef.current.revealLineInCenter(newLine);
                                    break;
                                }
                            }
                        }
                    }
                    // === Smalruby: End of update editor after execute ===

                    // === Smalruby: Start of DNCL mode execute all scripts ===
                    if (isDncl) {
                        // Execute all top-level scripts sequentially
                        const blocks = vm.editingTarget.blocks;
                        const allTopBlocks = blocks.getScripts();
                        if (allTopBlocks.length === 0) {
                            onShowAlert('cannotExecuteLine');
                            return;
                        }

                        // Highlight all lines
                        const totalLines = code.split('\n').length;
                        doHighlightLineRange(1, totalLines);

                        // Execute each top-level script
                        for (const topBlockId of allTopBlocks) {
                            vm.runtime.toggleScript(topBlockId, {
                                target: vm.editingTarget,
                                stackClick: true,
                            });
                        }
                        return;
                    }
                    // === Smalruby: End of DNCL mode execute all scripts ===

                    const blockId = converter.getBlockIdForLine(targetLine);
                    if (!blockId) {
                        // eslint-disable-next-line no-console
                        console.warn(`[handleExecuteLine] No executable block at line ${targetLine}`);
                        onShowAlert('cannotExecuteLine');
                        return;
                    }

                    const topBlockId = vm.editingTarget.blocks.getTopLevelScript(blockId);
                    if (!topBlockId) {
                        // eslint-disable-next-line no-console
                        console.warn(`[handleExecuteLine] No top-level block for ${blockId}`);
                        onShowAlert('cannotExecuteLine');
                        return;
                    }

                    const blocks = vm.editingTarget.blocks;
                    const lineRange = converter.getLineRangeForTopLevelScript(topBlockId, blocks);

                    setExecutingLine(targetLine);
                    if (lineRange) {
                        doHighlightLineRange(lineRange.startLine, lineRange.endLine);
                    } else {
                        doHighlightLine(targetLine);
                    }

                    vm.runtime.toggleScript(topBlockId, {
                        target: vm.editingTarget,
                        stackClick: true,
                    });
                })
                .catch(error => {
                    // eslint-disable-next-line no-console
                    console.error('[handleExecuteLine] Apply error:', error);
                    onShowAlert('convertRubyToBlocksError');
                });
        },
        [vm, rubyCode, intl, rubyVersion, onShowAlert, updateRubyCodeErrorsState, onDismissAlert],
    );

    const renderDownloaderChildren = useCallback((_, downloadProjectCallback) => {
        downloadCallbackRef.current = downloadProjectCallback;
        return null;
    }, []);

    // --- Effects ---

    // Mount + Unmount
    useEffect(() => {
        vm.addListener('SCRIPT_GLOW_ON', handleScriptGlowOn);
        vm.addListener('SCRIPT_GLOW_OFF', handleScriptGlowOff);
        vm.addListener('VISUAL_REPORT', handleVisualReport);

        window.smalruby = window.smalruby || {};
        window.smalruby.vm = vm;
        updateDebugGlobals(vm, {
            enabled: autoCorrectEnabledRef.current,
            settings: autoCorrectSettingsRef.current,
        });

        return () => {
            vm.removeListener('SCRIPT_GLOW_ON', handleScriptGlowOn);
            vm.removeListener('SCRIPT_GLOW_OFF', handleScriptGlowOff);
            vm.removeListener('VISUAL_REPORT', handleVisualReport);
            dismissBubble(bubbleElRef.current);
            removeBubble(bubbleElRef.current);
            bubbleElRef.current = null;
            clearDecoration(executingLineDecorationRef.current);
            executingLineDecorationRef.current = null;
            if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
            if (completionProviderManagerRef.current) {
                completionProviderManagerRef.current.dispose();
                completionProviderManagerRef.current = null;
            }
            if (contentChangeListenerRef.current) {
                contentChangeListenerRef.current.dispose();
                contentChangeListenerRef.current = null;
            }
            if (configChangeListenerRef.current) {
                configChangeListenerRef.current.dispose();
                configChangeListenerRef.current = null;
            }
            if (pasteMutationObserverRef.current) {
                pasteMutationObserverRef.current.disconnect();
                pasteMutationObserverRef.current = null;
            }
            if (bodyMutationObserverRef.current) {
                bodyMutationObserverRef.current.disconnect();
                bodyMutationObserverRef.current = null;
            }
            if (furiganaDebounceTimerRef.current) {
                clearTimeout(furiganaDebounceTimerRef.current);
                furiganaDebounceTimerRef.current = null;
            }
        };
    }, [vm, handleScriptGlowOn, handleScriptGlowOff, handleVisualReport]);

    // Locale change
    useEffect(() => {
        loadMonacoLocale(locale);
    }, [locale]);

    // Furigana toggle effect
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        if (furiganaEnabled) {
            renderFurigana();
        } else {
            furiganaRendererRef.current.clear(editorRef.current);
        }
    }, [furiganaEnabled]);

    // === Smalruby: Start of DNCL code sync ===
    // When code changes from blocks tab (Ruby → DNCL display), sync DNCL display
    const rubyCodeStr = rubyCode.code;
    useEffect(() => {
        if (!dnclMode) return;
        if (!editorRef.current || !monacoRef.current) return;
        // Only sync when the Ruby code changed externally (e.g., from blocks)
        // not from our own editor change (which already sets dnclDisplayCode)
        const currentEditorValue = editorRef.current.getValue();
        const currentRubyFromDncl = dnclToRuby(currentEditorValue).ruby;
        if (currentRubyFromDncl !== rubyCodeStr && rubyCodeStr) {
            const result = rubyToDncl(rubyCodeStr);
            setDnclDisplayCode(result.dncl);
        }
    }, [rubyCodeStr, dnclMode]);
    // === Smalruby: End of DNCL code sync ===

    // componentDidUpdate equivalent
    const prevPropsRef = useRef(null);
    useEffect(() => {
        const prev = prevPropsRef.current;
        const savePrev = () => {
            prevPropsRef.current = {
                rubyVersion,
                locale,
                activeTabIndex,
                isVisible,
                editingTarget,
                rubyCode,
                blocksTabVisible,
            };
        };

        if (!prev) {
            savePrev();
            return;
        }

        // Ruby version change
        if (rubyVersion !== prev.rubyVersion) {
            if (rubyVersion === lastProcessedVersionRef.current) {
                savePrev();
                return;
            }
            handleRubyVersionChange(prev.rubyVersion, rubyVersion);
        }

        // Tab switch away → dismiss bubble
        if (prev.activeTabIndex === RUBY_TAB_INDEX && activeTabIndex !== RUBY_TAB_INDEX) {
            handleDismissBubbleStable();
        }

        // Visibility off → clear errors
        if (prev.isVisible && !isVisible) {
            if (editorRef.current && monacoRef.current) {
                clearErrors();
            }
        }

        // Code change (not modified) → clear errors
        if (rubyCode.code !== prev.rubyCode.code && !rubyCode.modified) {
            clearErrors();
        }

        // Error display
        if (rubyCode.errors !== prev.rubyCode.errors) {
            showErrors(rubyCode.errors);
        }

        // Modified → convert to blocks
        let modified = rubyCode.modified;
        if (modified) {
            const targetId = rubyCode.target ? rubyCode.target.id : null;
            const changedTarget = vm.editingTarget && rubyCode.target && vm.editingTarget.id !== targetId;
            if (changedTarget || blocksTabVisible) {
                if (String(rubyVersion) === '2' && !v1PromptDismissed && containsV1Code(rubyCode.code)) {
                    const message = intlRef.current.formatMessage({
                        id: 'gui.rubyTab.v1CodeDetected',

                        defaultMessage:
                            'Switch Ruby version to "v1"?\n\nThe code you entered uses the "v1" syntax found in textbooks. Switching to "v1" lets you program with the same syntax as the textbook.',
                    });
                    // eslint-disable-next-line no-alert
                    if (window.confirm(message)) {
                        onRevertRubyVersion('1');
                        return;
                    }
                    onDismissV1Prompt();
                }
                targetCodeToBlocksHOC(intl).then(converter => {
                    if (converter.result) {
                        converter.apply().then(async () => {
                            modified = false;
                            clearErrors();
                            // === Smalruby: Start of module sync ===
                            if (rubyCode.target && String(rubyVersion) === '2') {
                                try {
                                    await syncModules(vm, rubyCode.target, intl, rubyVersion);
                                } catch (e) {
                                    // eslint-disable-next-line no-console
                                    console.error('Module sync error:', e);
                                }
                            }
                            // === Smalruby: End of module sync ===
                            if (!modified) {
                                const etChanged = editingTarget && editingTarget !== prev.editingTarget;
                                if ((isVisible && !prev.isVisible) || etChanged) {
                                    updateRubyCodeTargetState(vm.editingTarget, rubyVersion);
                                }
                            }
                            if (isVisible && !prev.isVisible) {
                                if (editorRef.current) {
                                    editorRef.current.focus();
                                    editorRef.current.layout();
                                }
                            }
                        });
                        return;
                    }
                    showErrors(converter.errors);
                });
            }
        }

        if (!modified) {
            const etChanged = editingTarget && editingTarget !== prev.editingTarget;
            if ((isVisible && !prev.isVisible) || etChanged) {
                updateRubyCodeTargetState(vm.editingTarget, rubyVersion);
            }
        }

        if (isVisible && !prev.isVisible) {
            if (editorRef.current) {
                editorRef.current.focus();
                editorRef.current.layout();
            }
            onMarkRubyTabUsed();
        }

        updateDebugGlobals(vm, {
            enabled: autoCorrectEnabled,
            settings: autoCorrectSettings,
        });
        savePrev();
    });

    // --- Render ---

    const { code, fontSize } = rubyCode;

    return (
        <>
            <div ref={containerRef} className={styles.editorContainer}>
                <RubyToolbar
                    editingTarget={vm.editingTarget}
                    vm={vm}
                    editorRef={editorRef.current}
                    onSelectTarget={handleSelectTarget}
                    onDownload={handleDownload}
                    onInsertClass={handleInsertClass}
                    onExecuteLine={handleExecuteLine}
                    onDismissBubble={handleDismissBubbleStable}
                    isRunning={!!runningBlockId}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    furiganaEnabled={furiganaEnabled}
                    onToggleFurigana={handleToggleFurigana}
                    autoCorrectEnabled={autoCorrectEnabled}
                    onToggleAutoCorrect={handleToggleAutoCorrect}
                    onOpenAutoCorrectSettings={handleOpenAutoCorrectSettings}
                    onPreviewRubyScript={handlePreviewRubyScript}
                    onOpenRubyteeModal={onOpenRubyteeModal}
                    dnclMode={dnclMode}
                    onToggleDnclMode={handleToggleDnclMode}
                />
                <div className={styles.editorWrapper}>
                    <Editor
                        key={locale}
                        height="100%"
                        language={dnclMode ? 'dncl' : 'smalruby'}
                        onMount={handleEditorDidMount}
                        onChange={handleEditorChange}
                        options={{
                            fontSize: fontSize || DEFAULT_FONT_SIZE,
                            fontFamily: 'Monaco, Menlo, Consolas, "source-code-pro", monospace',
                            minimap: { enabled: false },
                            renderWhitespace: 'all',
                            scrollBeyondLastLine: true,
                            tabSize: 2,
                            fixedOverflowWidgets: true,
                            wordBasedSuggestions: 'off',
                            autoIndent: 'full',
                        }}
                        theme="vs"
                        value={dnclMode ? dnclDisplayCode : code}
                        width="100%"
                    />
                </div>
            </div>
            {/* Hidden RubyDownloader for storing download callback */}
            <RubyDownloader
                onConversionError={handleConversionError}
                onSaveError={handleAISaveError}
                onSaveFinished={handleAISaveFinished}
            >
                {renderDownloaderChildren}
            </RubyDownloader>
            <div className={styles.zoomControlsWrapper}>
                <button
                    className={styles.zoomButton}
                    data-testid="ruby-screenshot"
                    title="Rubyコードを画像として保存"
                    onClick={handleScreenshot}
                >
                    <img
                        alt="Rubyコードを画像として保存"
                        className={styles.zoomIcon}
                        draggable={false}
                        src={cameraIcon}
                    />
                </button>
                <button className={styles.zoomButton} data-testid="ruby-zoom-in" onClick={handleZoomIn}>
                    <img src="./static/blocks-media/default/zoom-in.svg" className={styles.zoomIcon} />
                </button>
                <button className={styles.zoomButton} data-testid="ruby-zoom-out" onClick={handleZoomOut}>
                    <img src="./static/blocks-media/default/zoom-out.svg" className={styles.zoomIcon} />
                </button>
                <button className={styles.zoomButton} data-testid="ruby-zoom-reset" onClick={handleZoomReset}>
                    <img src="./static/blocks-media/default/zoom-reset.svg" className={styles.zoomIcon} />
                </button>
            </div>
            {showAutoCorrectModal && (
                <AutoCorrectModal
                    settings={autoCorrectSettings}
                    onSettingChange={handleAutoCorrectSettingChange}
                    onRequestClose={handleCloseAutoCorrectSettings}
                />
            )}
            {showScriptPreview && <RubyScriptPreview code={previewCode} onClose={handleCloseScriptPreview} />}
        </>
    );
};

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
    onMarkRubyTabUsed: PropTypes.func,
    rubyCode: rubyCodeShape,
    rubyVersion: PropTypes.string,
    targetCodeToBlocks: PropTypes.func,
    updateRubyCodeErrorsState: PropTypes.func,
    updateRubyCodeTargetState: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired,
    projectTitle: PropTypes.string,
    locale: PropTypes.string,
    activeTabIndex: PropTypes.number,
    onOpenRubyteeModal: PropTypes.func,
    onRegisterRubyteeApply: PropTypes.func,
    v1PromptDismissed: PropTypes.bool,
    onDismissV1Prompt: PropTypes.func,
};

const mapStateToProps = state => ({
    blocksTabVisible: state.scratchGui.editorTab.activeTabIndex === BLOCKS_TAB_INDEX,
    editingTarget: state.scratchGui.targets.editingTarget,
    rubyCode: state.scratchGui.rubyCode,
    rubyVersion: state.scratchGui.settings.rubyVersion,
    vm: state.scratchGui.vm,
    projectTitle: state.scratchGui.projectTitle,
    locale: state.locales.locale,
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex,
    v1PromptDismissed: state.scratchGui.settings.v1PromptDismissed,
});

const mapDispatchToProps = dispatch => ({
    onChange: code => {
        dispatch(updateRubyCode(code));
        dispatch(setProjectChanged());
    },
    updateRubyCodeErrorsState: errors => dispatch(updateRubyCodeErrors(errors)),
    updateRubyCodeTargetState: (target, version) => dispatch(updateRubyCodeTarget(target, version)),
    onRevertRubyVersion: version => dispatch(setRubyVersion(version)),
    onShowAlert: alertId => showAlertWithTimeout(dispatch, alertId),
    onDismissAlert: alertId => dispatch(closeAlertWithId(alertId)),
    onRequestCloseFile: () => dispatch(closeFileMenu()),
    onSetAiSaveStatus: status => dispatch(setAiSaveStatus(status)),
    onClearAiSaveStatus: () => dispatch(clearAiSaveStatus()),
    onFontSizeChange: fontSize => dispatch(updateRubyFontSize(fontSize)),
    onMarkRubyTabUsed: () => dispatch(markRubyTabUsed()),
    onDismissV1Prompt: () => dispatch(dismissV1Prompt()),
});

const ConnectedRubyTab = RubyteeModalHOC(
    RubyToBlocksConverterHOC(injectIntl(connect(mapStateToProps, mapDispatchToProps)(RubyTab))),
);

export default ConnectedRubyTab;
