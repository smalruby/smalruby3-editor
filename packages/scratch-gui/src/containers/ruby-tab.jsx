// === Smalruby: This file is Smalruby-specific (Ruby tab with Monaco Editor, DNCL mode, furigana) ===
import Editor from '@monaco-editor/react';
import { settingsOfSource } from '@smalruby/ja-notation';
import VM from '@smalruby/scratch-vm';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import { connect } from 'react-redux';
import AutoCorrectModal from '../components/auto-correct-modal/auto-correct-modal.jsx';
import cameraIcon from '../components/blocks-screenshot-button/icon--camera.svg';
import RubyScriptPreview from '../components/ruby-script-preview/ruby-script-preview.jsx';
import RubyToolbar from '../components/ruby-toolbar/ruby-toolbar.jsx';
import analytics from '../lib/analytics';
import { autoCorrect, defaultSettings as defaultAutoCorrectSettings } from '../lib/auto-correct';
import collectMetadata from '../lib/collect-metadata.js';
import { findArrayIndexHints } from '../lib/dncl/dncl-array-index-hint';
import {
    japaneseBlockErrors,
    STRING_PLUS_NUMBER_ERROR_ID,
    withStringPlusNumberIds,
} from '../lib/dncl/dncl-block-check';
import { dnclTextBlob, dnclTextFilename } from '../lib/dncl/dncl-download';
import { slashCommentRows, tidyPastedDncl, withDoubleSlashHint } from '../lib/dncl/dncl-paste-tidy';
import { problemFormText } from '../lib/dncl/dncl-problem-form';
import { dnclWithSettingsPattern } from '../lib/dncl/dncl-settings';
import { stringArithmeticRows } from '../lib/dncl/dncl-string-arithmetic-hint';
import { dnclToRuby, rubyForLeavingDncl } from '../lib/dncl/dncl-to-ruby';
import {
    FORBIDDEN_PREFIX_ERROR_ID,
    isRubyCommandName,
    POST_TEST_LOOP_ERROR_ID,
    STAGE_VARIABLE_ERROR_ID,
    UNSUPPORTED_COMMAND_ERROR_ID,
    UNSUPPORTED_NOTATION_ERROR_ID,
    UNSUPPORTED_NUMBER_ERROR_ID,
} from '../lib/dncl/dncl-validator';
import { RUBY_SYNTAX_ERROR_ID } from '../lib/dncl/ja-notation-errors';
import { rubyToDncl } from '../lib/dncl/ruby-to-dncl';
import downloadBlob from '../lib/download-blob';
import FuriganaAnnotator from '../lib/furigana-annotator';
import { makeRubyTabAdapterFactory } from '../lib/genai-ruby-adapter.js';
import { wrapCurrentCodeWithClass } from '../lib/insert-class';
import intlShape from '../lib/intlShape.js';
import { isJapaneseLocale } from '../lib/locale-utils';
import { syncModules } from '../lib/module-sync';
import { loadMonacoLocale } from '../lib/monaco-i18n-helper';
import { getPrism, loadPrism } from '../lib/prism-parser';
import RubyGenerator from '../lib/ruby-generator';
import { downloadRubyAsImage } from '../lib/ruby-screenshot';
import { generatePreviewCode } from '../lib/ruby-script-preview';
import { targetCodeToBlocks } from '../lib/ruby-to-blocks-converter';
import RubyToBlocksConverterHOC from '../lib/ruby-to-blocks-converter-hoc.jsx';
import { containsV1Code } from '../lib/ruby-to-blocks-converter/v1-detection';
import { hideSmalrubyConsole, showSmalrubyConsole } from '../lib/smalruby-console.js';
import { getUrlParams } from '../lib/url-params';
import { showAlertWithTimeout, closeAlertWithId } from '../reducers/alerts';
import {
    setDnclMode as setDnclModeAction,
    clearExternalExitDnclModeRequest,
    getInitialDnclMode,
} from '../reducers/dncl-mode';
import {
    BLOCKS_TAB_INDEX,
    JAPANESE_TAB_INDEX,
    RUBY_TAB_INDEX,
    activateTab,
    isTextTabIndex,
} from '../reducers/editor-tab';
import { setAiSaveStatus, clearAiSaveStatus } from '../reducers/koshien-file';
import { getLessonDnclModeAllowed } from '../reducers/lesson-mode';
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
import GenaiConcierge from './genai-concierge.jsx';
import RubyDownloader from './ruby-downloader.jsx';
import {
    FONT_SIZES,
    DEFAULT_FONT_SIZE,
    FURIGANA_ENABLED_KEY,
    AUTO_CORRECT_ENABLED_KEY,
    AUTO_CORRECT_SETTINGS_KEY,
    DNCL_MODE_KEY,
    DNCL_INDEX_HINT_OWNER,
    DNCL_UNSUPPORTED_OWNER,
    DNCL_SLASH_COMMENT_OWNER,
    DNCL_STRING_ARITHMETIC_OWNER,
    DNCL_BLOCKS_OWNER,
} from './ruby-tab/constants';
import updateDebugGlobals from './ruby-tab/debug-globals';
import { offerDnclIndexSetting, replaceEditorText } from './ruby-tab/dncl-index-setting';
import {
    createProblemFormView,
    problemFormLineNumbers,
    problemFormLineNumbersMinChars,
} from './ruby-tab/dncl-problem-form-view';
import {
    registerCustomPasteAction,
    setupPasteTransform,
    setupPasteDuplicateHider,
    registerLanguageAndProviders,
} from './ruby-tab/editor-setup';
import { JAPANESE_PAPER_THEME, defineEditorThemes } from './ruby-tab/editor-themes';
import {
    clearDecoration,
    highlightLine,
    highlightLineRange,
    findExecutableLine,
} from './ruby-tab/execution-highlighter';
import FuriganaRenderer from './ruby-tab/furigana-renderer';
import QuickFixProvider from './ruby-tab/quick-fix-provider';
import styles from './ruby-tab/ruby-tab.css';
import { showBubble, dismissBubble, removeBubble } from './ruby-tab/visual-report-bubble';

const languageBandMessages = defineMessages({
    japanese: {
        id: 'gui.rubyTab.japaneseLanguageBand',
        defaultMessage: 'Japanese (the program notation of the common test)',
        description: 'The name of the language shown over the editor of the Japanese tab',
    },
});

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

// How long the Japanese tab waits after the last key before it checks that the program can become
// blocks (Issue #2547): the check converts the whole program, so it is not done on every key.
const JAPANESE_BLOCKS_CHECK_DELAY_MS = 500;

/**
 * How the auto-correct reads the code: in the Japanese tab, `「…」` is a string
 * and, when the settings at its top say so, `//` starts a comment. What is
 * written in a comment is kept as it is (Issue #1731, S10).
 * @param {string} code - The code in the editor.
 * @param {boolean} dncl - Whether it is the Japanese tab's code.
 * @returns {object} The options of `autoCorrect`.
 */
const autoCorrectOptionsOf = (code, dncl) =>
    dncl ? { japanese: true, slashComments: settingsOfSource(code).commentMarker === '//' } : {};

const RubyTab = (props) => {
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
        v1PromptDismissed,
        onDismissV1Prompt,
        onSetDnclMode,
        exitDnclModeExternallyRequested,
        dnclModeLocked,
        onClearExitDnclModeRequest,
        onActivateTab,
        onShowSmalrubyConsole,
        onHideSmalrubyConsole,
    } = props;

    // --- State ---
    const [runningBlockId, setRunningBlockId] = useState(null);
    const [executingLine, setExecutingLine] = useState(null); // set by execution, read for future use
    void executingLine;
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [furiganaEnabled, setFuriganaEnabled] = useState(() => {
        if (!isJapaneseLocale(locale)) return false;
        const urlRubyMode = getUrlParams().rubyMode;
        if (urlRubyMode === 'furigana') return true;
        if (urlRubyMode === 'ruby') return false;
        // Furigana is a setting of the Ruby tab: the Japanese tab never draws it, and keeps it
        // for the Ruby tab (docs/dncl/design.md 1 章).
        return loadBool(FURIGANA_ENABLED_KEY, true);
    });
    const [autoCorrectEnabled, setAutoCorrectEnabled] = useState(() => loadBool(AUTO_CORRECT_ENABLED_KEY, true));
    const [autoCorrectSettings, setAutoCorrectSettings] = useState(loadAutoCorrectSettings);
    const [showAutoCorrectModal, setShowAutoCorrectModal] = useState(false);
    const [showScriptPreview, setShowScriptPreview] = useState(false);
    const [previewCode, setPreviewCode] = useState('');
    const [dnclValidating, setDnclValidating] = useState(false);
    // Whether the editor holds the program in Japanese. It follows the tab: true in the
    // Japanese tab, false in the Ruby tab (docs/dncl/design.md 1 章). On the other tabs it keeps
    // the language of the last text tab, and the Code tab narrows the blocks while it is true.
    const [dnclMode, setDnclMode] = useState(() => isJapaneseLocale(locale) && getInitialDnclMode());
    // Separate DNCL display code to prevent editor from showing Ruby
    const [dnclDisplayCode, setDnclDisplayCode] = useState('');
    // Ruby → Japanese parses the Ruby with prism (ja-notation), so the Japanese is
    // shown once prism is loaded.
    const [prismReady, setPrismReady] = useState(() => Boolean(getPrism()));
    useEffect(() => {
        if (prismReady) return;
        let alive = true;
        loadPrism().then(() => {
            if (alive) setPrismReady(true);
        });
        return () => {
            alive = false;
        };
    }, []);
    // Whether the editor shows the read mode (line numbers and rules as in the
    // questions) of the Japanese mode (Issue #1755, #2380).
    const [problemFormShown, setProblemFormShown] = useState(false);
    const problemFormViewRef = useRef(null);
    // Room in the line number column for the labels `(01)` / `(100)` / `(1000)`.
    const [lineNumbersMinChars, setLineNumbersMinChars] = useState(5);
    const dnclSourceMapRef = useRef(null);
    // Whether the Japanese text the student typed makes no Ruby. Such text is kept only in
    // the editor (dispatchCode does not send it), so it must not be left behind (Issue #2546).
    const dnclEditErrorRef = useRef(false);
    // Set when the Japanese tab gives way from outside the editor: that switch is not stopped.
    const externalDnclExitRef = useRef(false);
    const dnclModeRef = useRef(dnclMode);
    dnclModeRef.current = dnclMode;
    // The toggle reads it through a ref so that a stale callback (requestAnimationFrame) sees the latest lock
    const dnclModeLockedRef = useRef(dnclModeLocked);
    dnclModeLockedRef.current = dnclModeLocked;

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
    const removePasteTransformRef = useRef(null);
    const pasteListenerRef = useRef(null);
    const bodyMutationObserverRef = useRef(null);
    const bubbleElRef = useRef(null);
    const quickFixProviderRef = useRef(null);
    const furiganaAnnotatorRef = useRef(null);
    const furiganaRendererRef = useRef(null);
    const furiganaDebounceTimerRef = useRef(null);
    const furiganaLastMsRef = useRef(0);
    const isAutoCorrectUpdateRef = useRef(false);
    const isModeSwitchRef = useRef(false);

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
    const rubyVersionRef = useRef(rubyVersion);
    rubyVersionRef.current = rubyVersion;
    // "生成AI に相談" in the Ruby, furigana (#1398) and Japanese (DNCL, #1402) modes. The
    // adapter reads the editor and the mode when it needs them, so this function stays the
    // same between renders. The sprite in the editor is rubyCode.target, not
    // vm.editingTarget: the editor keeps the code (and its sprite) that cannot become blocks
    // while the VM switches to another sprite (#1435).
    const rubyCodeTargetRef = useRef(rubyCode.target);
    rubyCodeTargetRef.current = rubyCode.target;
    // The last Ruby of the editor, kept when the DNCL cannot become Ruby (#1626).
    const rubyCodeCodeRef = useRef(rubyCode.code);
    rubyCodeCodeRef.current = rubyCode.code;
    const editorTargetListenersRef = useRef(new Set());
    const genaiAdapterRef = useRef(null);
    if (!genaiAdapterRef.current) {
        genaiAdapterRef.current = makeRubyTabAdapterFactory({
            getEditor: () => editorRef.current,
            getMonaco: () => monacoRef.current,
            getMode: () => {
                if (dnclModeRef.current) return 'dncl';
                return furiganaEnabledRef.current ? 'furigana' : 'ruby';
            },
            getEditorTarget: () => rubyCodeTargetRef.current,
            onEditorTargetChange: (listener) => {
                editorTargetListenersRef.current.add(listener);
                return () => editorTargetListenersRef.current.delete(listener);
            },
        });
    }
    // Told after the editor (a child, whose effects run first) has the new sprite's code. In
    // the DNCL mode the DNCL comes in a later render; the adapter waits for it then.
    useEffect(() => {
        editorTargetListenersRef.current.forEach((listener) => listener());
    }, [rubyCode.target]);
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

    // The words of the errors on the Japanese lines. A `+` of a string and a number literal says
    // how to write it (Issue #2547) and a line with `//` tells to use `#` (Issue #1192); the
    // others keep the words of the converter. The conversion of the Code tab and the check of the
    // blocks while writing both use it, so they say the same words.
    const withJapaneseErrorWords = (errors) => {
        const lines = editorRef.current.getModel().getLinesContent();
        const stringPlusNumber = intlRef.current.formatMessage({
            id: 'gui.rubyTab.dnclStringPlusNumberError',
            defaultMessage:
                'To join a string and a number with "+", make the number a string like "文字列(3)" (e.g. "残り" + 文字列(3)). You may also write the number in the string, like "残り3".',
        });
        const hint = intlRef.current.formatMessage({
            id: 'gui.rubyTab.dnclDoubleSlashHint',
            defaultMessage: 'In Smalruby, // is not a comment (it is integer division). Use # for comments.',
        });
        const worded = withStringPlusNumberIds(errors, lines).map((err) =>
            err.id === STRING_PLUS_NUMBER_ERROR_ID ? { ...err, text: stringPlusNumber } : err,
        );
        return withDoubleSlashHint(worded, lines, hint);
    };

    const showErrors = (rawErrors) => {
        if (editorRef.current && monacoRef.current) {
            // Conversion errors point at Ruby lines. In DNCL mode the editor
            // shows DNCL, whose lines do not match the Ruby ones 1:1, so move
            // each error to its DNCL line. Ruby columns have no DNCL
            // counterpart, so the whole DNCL line is marked.
            const sourceMap = dnclModeRef.current ? dnclSourceMapRef.current : null;
            // A missing or extra closer of DNCL makes no Ruby, so it is told
            // on its DNCL line by the DNCL error markers below, never as a
            // missing `end` of the converter (Issue #1419).
            let errors = sourceMap ? sourceMap.rubyErrorsToDncl(rawErrors) : rawErrors;
            if (dnclModeRef.current) {
                // `//` is integer division in Smalruby DNCL, never a comment,
                // so a 共通テスト style `//` comment fails to convert. Tell
                // the user to use `#` on such lines (Issue #1192).
                errors = withJapaneseErrorWords(errors);
            }
            const markers = errors.map((err) => ({
                startLineNumber: err.row + 1,
                startColumn: err.column + 1,
                endLineNumber: err.row + 1,
                endColumn: err.source ? err.column + err.source.length + 1 : 1000,
                message: err.text,
                severity: monacoRef.current.MarkerSeverity.Error,
            }));
            monacoRef.current.editor.setModelMarkers(editorRef.current.getModel(), 'smalruby', markers);
            // The same errors as the check of the blocks while writing (Issue #2547): show them once.
            if (dnclModeRef.current) {
                monacoRef.current.editor.setModelMarkers(editorRef.current.getModel(), DNCL_BLOCKS_OWNER, []);
            }
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
        // Furigana annotations target Ruby source; in DNCL mode the editor
        // shows Japanese pseudo-code, so suppress rendering entirely.
        if (dnclModeRef.current) return;
        const code = editorRef.current.getValue() || '';
        const prism = getPrism();
        if (prism) {
            const t0 = performance.now();
            const parseResult = prism.parse(code);
            const annotations = furiganaAnnotatorRef.current.annotate(code, parseResult);
            furiganaRendererRef.current.render(editorRef.current, monacoRef.current, annotations);
            furiganaLastMsRef.current = performance.now() - t0;
        } else {
            loadPrism().then((loadedPrism) => {
                if (!furiganaEnabledRef.current) return;
                if (dnclModeRef.current) return;
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
            if (furiganaEnabledRef.current && !dnclModeRef.current) {
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

    const doHighlightLine = (lineNumber) => {
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

    const handleScriptGlowOn = useCallback((data) => {
        setRunningBlockId(data.id);
    }, []);

    const handleScriptGlowOff = useCallback((data) => {
        if (runningBlockIdRef.current === data.id) {
            setRunningBlockId(null);
            setExecutingLine(null);
            clearDecoration(executingLineDecorationRef.current);
            executingLineDecorationRef.current = null;
        }
    }, []);

    const handleVisualReport = useCallback((data) => {
        if (!isTextTabIndex(activeTabIndexRef.current)) return;
        bubbleElRef.current = showBubble(bubbleElRef.current, data.value);
    }, []);

    const handleDismissBubbleStable = useCallback(() => {
        dismissBubble(bubbleElRef.current);
    }, []);

    // --- Stable Editor callbacks ---

    const dispatchCode = useCallback((code) => {
        if (dnclModeRef.current) {
            setDnclDisplayCode(code);
            const result = dnclToRuby(code);
            dnclEditErrorRef.current = Boolean(result.errors && result.errors.length > 0);
            if (dnclEditErrorRef.current) {
                // Don't dispatch code that makes no Ruby: its errors are shown
                // on their DNCL lines by the DNCL error markers, so the markers
                // of the last conversion of the blocks are taken off.
                dnclSourceMapRef.current = null;
                if (editorRef.current && monacoRef.current) {
                    monacoRef.current.editor.setModelMarkers(editorRef.current.getModel(), 'smalruby', []);
                }
                return;
            }
            dnclSourceMapRef.current = result.sourceMap;
            onChangeRef.current(result.ruby);
        } else {
            onChangeRef.current(code);
        }
    }, []);

    const handleEditorChange = useCallback(
        (value) => {
            // Skip change events triggered by mode switch (Ruby↔DNCL) to
            // prevent a Redux dispatch that causes a re-render race where
            // the dnclMode state hasn't committed yet.
            if (isModeSwitchRef.current) return;
            if (isAutoCorrectUpdateRef.current) {
                isAutoCorrectUpdateRef.current = false;
                dispatchCode(value);
                return;
            }
            if (autoCorrectEnabledRef.current && editorRef.current) {
                const options = autoCorrectOptionsOf(value, dnclModeRef.current);
                const corrected = autoCorrect(value, autoCorrectSettingsRef.current, options);
                if (corrected !== value) {
                    isAutoCorrectUpdateRef.current = true;
                    const position = editorRef.current.getPosition();
                    const model = editorRef.current.getModel();
                    const beforeCursor = value.substring(0, model.getOffsetAt(position));
                    const correctedBeforeCursor = autoCorrect(beforeCursor, autoCorrectSettingsRef.current, options);
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
        // Japanese (DNCL) mode tidies pasted 共通テスト code: line numbers
        // and `//` comments (Issue #1192).
        const transformPastedText = (text) => (dnclModeRef.current ? tidyPastedDncl(text, editor.getValue()) : text);
        registerCustomPasteAction(editor, pasteLabel, transformPastedText);
        removePasteTransformRef.current = setupPasteTransform(editor, transformPastedText);
        // Japanese (DNCL) mode offers to take a note of pasted code that the
        // indexes start at 1 as the setting of the program (the sentence at its
        // top; docs/dncl/design.md 4 章). The dialog waits until Monaco has
        // finished handling the paste.
        pasteListenerRef.current = editor.onDidPaste((event) => {
            if (!dnclModeRef.current) return;
            setTimeout(() => {
                if (!dnclModeRef.current || editorRef.current !== editor) return;
                offerDnclIndexSetting({
                    editor,
                    range: event.range,
                    formatMessage: (descriptor, values) => intlRef.current.formatMessage(descriptor, values),
                });
            }, 0);
        });
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

        // The view switches between the read mode and the write mode with the
        // focus, the input and the paste itself (Issue #2380).
        problemFormViewRef.current = createProblemFormView(
            editor,
            monaco,
            () => dnclModeRef.current,
            setProblemFormShown,
        );
        setLineNumbersMinChars(problemFormLineNumbersMinChars(editor.getValue()));

        contentChangeListenerRef.current = editor.onDidChangeModelContent(() => {
            updateUndoRedoState();
            problemFormViewRef.current.textChanged();
            setLineNumbersMinChars(problemFormLineNumbersMinChars(editor.getValue()));
            if (furiganaEnabledRef.current) {
                scheduleFuriganaUpdate();
            }
        });

        configChangeListenerRef.current = editor.onDidChangeConfiguration((e) => {
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
        // A new editor (reload in the Japanese mode, another language) starts
        // without the problem form: make React and the view agree, then show
        // it if the mode asks for it.
        setProblemFormShown(false);
        problemFormViewRef.current.sync();
    }, []);

    // --- UI event handlers (useCallback for react/jsx-no-bind) ---

    const handleZoomIn = useCallback(() => {
        const currentSize = rubyCode.fontSize || DEFAULT_FONT_SIZE;
        const nextSize = FONT_SIZES.find((s) => s > currentSize);
        if (nextSize) onFontSizeChange(nextSize);
    }, [rubyCode.fontSize, onFontSizeChange]);

    const handleZoomOut = useCallback(() => {
        const currentSize = rubyCode.fontSize || DEFAULT_FONT_SIZE;
        const prevSize = FONT_SIZES.slice()
            .reverse()
            .find((s) => s < currentSize);
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
        (targetId) => {
            const target = vm.runtime.getTargetById(targetId);
            if (target) vm.setEditingTarget(target.id);
        },
        [vm],
    );

    const getSaveToComputerHandler = useCallback(
        (downloadProjectCallback) => () => {
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

    // Save the Japanese program as it is in the editor, as a text file in
    // UTF-8 (Issue #2453).
    const handleDownloadJapanese = useCallback(() => {
        if (!editorRef.current) return;
        const target = vm.editingTarget;
        const spriteName = target ? target.sprite.name : 'sprite';
        downloadBlob(dnclTextFilename(props.projectTitle, spriteName), dnclTextBlob(editorRef.current.getValue()));
    }, [vm, props.projectTitle]);

    // The toggle of the toolbar: the read mode, or back to the write mode
    // (Issue #2380).
    const handleToggleReadMode = useCallback(() => {
        if (problemFormViewRef.current) problemFormViewRef.current.toggle();
    }, []);

    const problemFormLineNumberLabels = useCallback(
        (lineNumber) => problemFormLineNumbers(editorRef.current)(lineNumber),
        [],
    );

    // Copy the program as the questions show it: line numbers and rules as
    // characters (Issue #1755). The usual copy keeps the text.
    const handleCopyProblemForm = useCallback(async () => {
        if (!editorRef.current) return;
        try {
            await navigator.clipboard.writeText(problemFormText(editorRef.current.getValue()));
        } catch (error) {
            console.error('Failed to copy the problem form:', error); // eslint-disable-line no-console
        }
    }, []);

    // A pattern of settings picked from the menu (docs/dncl/design.md 4 章):
    // the sentences at the top are written for it, and the program again by
    // them, so it means the same. One undo step takes it back.
    const handleSelectSettingsPattern = useCallback((patternId) => {
        if (!editorRef.current || !getPrism()) return;
        replaceEditorText(
            editorRef.current,
            dnclWithSettingsPattern(editorRef.current.getValue(), patternId),
            'smalruby.dnclSettingsPattern',
        );
    }, []);

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
        (errors) => {
            onShowAlert('convertRubyToBlocksError');
            updateRubyCodeErrorsState(errors);
            showErrors(errors);
        },
        [onShowAlert, updateRubyCodeErrorsState],
    ); // showErrors uses refs, safe in stale closure

    const dnclValidationErrorMessage = intl.formatMessage({
        id: 'gui.rubyTab.dnclValidationError',
        defaultMessage:
            'This code contains constructs not supported in Japanese mode.\nPlease use only supported instructions before switching modes.',
    });

    const dnclPostTestLoopErrorMessage = intl.formatMessage({
        id: 'gui.rubyTab.dnclPostTestLoopError',
        defaultMessage:
            'A post-test loop (a loop that runs once before it checks the condition) cannot be written in Japanese. Write the first run before the loop, then make it a "〜の間繰り返す" loop. You can write it in Ruby mode.',
    });

    // The message of a DNCL conversion error, by its id.
    const dnclErrorText = useCallback(
        (err) => {
            if (err.id === POST_TEST_LOOP_ERROR_ID) return dnclPostTestLoopErrorMessage;
            // Ruby prism cannot read (Japanese typed in the Ruby tab): its words are Japanese, as
            // the Japanese tab is only in the Japanese locales (Issue #2547).
            if (err.id === RUBY_SYNTAX_ERROR_ID) return err.message;
            if (err.id === UNSUPPORTED_COMMAND_ERROR_ID && !isRubyCommandName(err.name)) {
                // A Japanese name is a function to define, not a Ruby command.
                return intl.formatMessage(
                    {
                        id: 'gui.rubyTab.dnclUndefinedFunctionError',
                        defaultMessage:
                            '"{name}" is a function that is not defined. Define it with "関数 {name}(…):".',
                    },
                    { name: err.name },
                );
            }
            if (err.id === UNSUPPORTED_NUMBER_ERROR_ID) {
                return intl.formatMessage(
                    {
                        id: 'gui.rubyTab.dnclUnsupportedNumberError',
                        defaultMessage:
                            '"{name}" is a way of writing a number that cannot be used in Japanese mode (a hex number, _ between digits, an exponent and so on). Write it like "1000" or "0.5". You can write it in Ruby mode.',
                    },
                    { name: err.name },
                );
            }
            if (err.id === FORBIDDEN_PREFIX_ERROR_ID) {
                return intl.formatMessage(
                    {
                        id: 'gui.rubyTab.dnclForbiddenPrefixError',
                        defaultMessage: '"{name}" cannot be used in a variable in Japanese mode.',
                    },
                    { name: err.name },
                );
            }
            if (err.id === STAGE_VARIABLE_ERROR_ID) {
                return intl.formatMessage(
                    {
                        id: 'gui.rubyTab.dnclStageVariableError',
                        defaultMessage:
                            'A variable of the stage ({name}) cannot be written in Japanese mode. You can write it in Ruby mode.',
                    },
                    { name: err.name },
                );
            }
            if (err.id === UNSUPPORTED_NOTATION_ERROR_ID) {
                return intl.formatMessage(
                    {
                        id: 'gui.rubyTab.dnclUnsupportedNotationError',
                        defaultMessage: '"{name}" cannot be written in Japanese mode. You can write it in Ruby mode.',
                    },
                    { name: err.name },
                );
            }
            if (err.id === UNSUPPORTED_COMMAND_ERROR_ID) {
                return intl.formatMessage(
                    {
                        id: 'gui.rubyTab.dnclUnsupportedCommandError',
                        defaultMessage:
                            '"{name}" is a command that cannot be written in Japanese mode. You can write it in Ruby mode.',
                    },
                    { name: err.name },
                );
            }
            return dnclValidationErrorMessage;
        },
        [intl, dnclPostTestLoopErrorMessage, dnclValidationErrorMessage],
    );

    // Write the program in Japanese (enabling) or in Ruby. The tab decides it: the Japanese tab
    // calls it with true, the Ruby tab with false (docs/dncl/design.md 1 章). Resolves to whether
    // the editor is now in the asked language: false when the Ruby cannot be written in
    // Japanese (the errors are shown on the Ruby lines) or the lesson does not allow Japanese.
    const switchLanguage = useCallback(
        async (enabling) => {
            if (enabling === dnclModeRef.current) return true;
            // A lesson that does not allow the Japanese mode (#1741): never enter it (leaving it is always fine).
            if (enabling && dnclModeLockedRef.current) return false;

            // Clear any existing errors before mode switch attempt.
            clearErrors();
            // Ruby → Japanese parses the Ruby with prism.
            if (enabling) await loadPrism();

            // Validate before switching TO DNCL mode:
            // Dry-run Ruby → DNCL → Ruby → Blocks to check for unsupported code.
            // The conversions are kept so the switch below can reuse them.
            let dryRun = null;
            if (enabling && editorRef.current && monacoRef.current) {
                setDnclValidating(true);
                try {
                    const currentRuby = editorRef.current.getModel().getValue();
                    const dnclResult = rubyToDncl(currentRuby);

                    // Code that has no DNCL form, such as the post-test loop
                    // `begin ... end while` (Issue #1626), on its Ruby lines.
                    if (dnclResult.errors.length > 0) {
                        showErrors(
                            dnclResult.errors.map((err) => ({
                                row: err.line - 1,
                                column: err.column - 1,
                                text: dnclErrorText(err),
                                type: 'error',
                            })),
                        );
                        return false;
                    }

                    const rubyResult = dnclToRuby(dnclResult.dncl);

                    // Check DNCL → Ruby conversion errors (e.g. @ or $ in DNCL)
                    if (rubyResult.errors && rubyResult.errors.length > 0) {
                        const errors = rubyResult.errors.map((err) => ({
                            row: err.line - 1,
                            column: err.column - 1,
                            text: dnclErrorText(err),
                            type: 'error',
                        }));
                        showErrors(errors);
                        return false;
                    }

                    // Dry-run blocks conversion (no apply — no side effects)
                    const converter = await targetCodeToBlocks(vm, rubyCode.target, rubyResult.ruby, intl, {
                        version: rubyVersion,
                    });
                    if (!converter.result) {
                        const errors = converter.errors.map((err) => ({
                            ...err,
                            text: dnclValidationErrorMessage,
                        }));
                        showErrors(errors);
                        return false;
                    }
                    dryRun = { ruby: currentRuby, dncl: dnclResult.dncl, sourceMap: rubyResult.sourceMap };
                } finally {
                    setDnclValidating(false);
                }
            }
            // The tab was changed while the program was being checked: stay in Ruby.
            if (enabling && activeTabIndexRef.current !== JAPANESE_TAB_INDEX) return false;

            // Suppress handleEditorChange during mode switch to prevent a
            // re-render race: model.setValue triggers onChange synchronously,
            // which dispatches to Redux, causing a re-render where dnclMode
            // state hasn't committed yet — overwriting the editor content.
            isModeSwitchRef.current = true;

            dnclModeRef.current = enabling; // eslint-disable-line require-atomic-updates

            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(DNCL_MODE_KEY, enabling);
            }

            if (editorRef.current && monacoRef.current) {
                const model = editorRef.current.getModel();
                if (enabling) {
                    // Switching to DNCL: convert Ruby → DNCL
                    const currentRuby = model.getValue();
                    // Reuse the dry-run conversions unless the code was edited
                    // while the blocks conversion was being checked.
                    let dncl;
                    if (dryRun && dryRun.ruby === currentRuby) {
                        dncl = dryRun.dncl;
                        dnclSourceMapRef.current = dryRun.sourceMap;
                    } else {
                        dncl = rubyToDncl(currentRuby).dncl;
                        dnclSourceMapRef.current = dnclToRuby(dncl).sourceMap;
                    }
                    monacoRef.current.editor.setModelLanguage(model, 'dncl');
                    model.setValue(dncl);
                    dnclEditErrorRef.current = false;
                    setDnclDisplayCode(dncl);
                } else {
                    // Switching to Ruby: convert DNCL → Ruby
                    const currentDncl = model.getValue();
                    const ruby = rubyForLeavingDncl(currentDncl, rubyCodeCodeRef.current);
                    dnclSourceMapRef.current = null;
                    monacoRef.current.editor.setModelLanguage(model, 'smalruby');
                    model.setValue(ruby);
                    dnclEditErrorRef.current = false;
                    setDnclDisplayCode('');
                    onChangeRef.current(ruby);
                }
            }

            isModeSwitchRef.current = false;
            setDnclMode(enabling);
            onSetDnclMode(enabling);

            // Furigana is meaningless in DNCL view (Japanese pseudo-code, not Ruby).
            // Clear annotations on enable; restore them on disable when the user
            // had furigana on.
            if (enabling) {
                furiganaRendererRef.current?.clear(editorRef.current);
            } else if (furiganaEnabledRef.current) {
                renderFurigana();
            }
            return true;
        },
        [vm, rubyCode.target, intl, rubyVersion, dnclValidationErrorMessage, dnclErrorText, onSetDnclMode],
    );

    // The Japanese tab was chosen: write the program in Japanese. When it cannot be written in
    // Japanese, go to the Ruby tab, where the errors are shown on the Ruby lines.
    const enterJapaneseTab = useCallback(async () => {
        if (activeTabIndexRef.current !== JAPANESE_TAB_INDEX) return;
        const switched = await switchLanguage(true);
        if (!switched && activeTabIndexRef.current === JAPANESE_TAB_INDEX) onActivateTab(RUBY_TAB_INDEX);
    }, [switchLanguage, onActivateTab]);

    // The errors of the blocks of the Japanese on its lines (a dry run of the conversion, the
    // same check as going to the Code tab; Issue #2547), or null when it makes no Ruby.
    const checkJapaneseBlocks = useCallback(async (dncl) => {
        await loadPrism();
        try {
            return await japaneseBlockErrors(dncl, async (ruby) => {
                const converter = await targetCodeToBlocks(
                    vmRef.current,
                    rubyCodeTargetRef.current,
                    ruby,
                    intlRef.current,
                    { version: rubyVersionRef.current },
                );
                return { result: converter.result, errors: converter.errors };
            });
        } catch (e) {
            // The check only tells; it must never stop the editor.
            console.warn('Failed to check the blocks of the Japanese:', e); // eslint-disable-line no-console
            return null;
        }
    }, []);

    // Show the errors of `checkJapaneseBlocks` on their Japanese lines (and go to the first one).
    // A line that still has an error of the conversion of the Code tab (`smalruby`) keeps that
    // one: the same error is shown once, also after the student edits other lines.
    const showJapaneseBlockErrors = useCallback((errors, { focus = false } = {}) => {
        if (!editorRef.current || !monacoRef.current) return;
        const model = editorRef.current.getModel();
        const shownRows = new Set(
            monacoRef.current.editor
                .getModelMarkers({ owner: 'smalruby', resource: model.uri })
                .map((marker) => marker.startLineNumber - 1),
        );
        const markers = withJapaneseErrorWords(errors)
            .filter((err) => !shownRows.has(err.row))
            .map((err) => ({
                startLineNumber: err.row + 1,
                startColumn: 1,
                endLineNumber: err.row + 1,
                endColumn: 1000,
                message: err.text,
                severity: monacoRef.current.MarkerSeverity.Error,
            }));
        monacoRef.current.editor.setModelMarkers(model, DNCL_BLOCKS_OWNER, markers);
        if (focus && errors.length > 0) {
            const lineNumber = errors[0].row + 1;
            editorRef.current.setPosition({ lineNumber, column: 1 });
            editorRef.current.revealLineInCenter(lineNumber);
            editorRef.current.focus();
        }
    }, []);

    // The Ruby tab was chosen from the Japanese tab: write the program in Ruby. Japanese that makes
    // Ruby with no blocks stays in the Japanese tab with its errors on its lines, as going to the
    // Code tab does: in the Ruby tab it could not come back to the Japanese tab (Issue #2547).
    const leaveJapaneseTab = useCallback(async () => {
        if (dnclModeRef.current && editorRef.current) {
            const errors = await checkJapaneseBlocks(editorRef.current.getModel().getValue());
            if (errors && errors.length > 0) {
                if (activeTabIndexRef.current === RUBY_TAB_INDEX) onActivateTab(JAPANESE_TAB_INDEX);
                showJapaneseBlockErrors(errors, { focus: true });
                return;
            }
        }
        // The Japanese tab was chosen again while the program was being checked.
        if (activeTabIndexRef.current === JAPANESE_TAB_INDEX) return;
        switchLanguage(false);
    }, [checkJapaneseBlocks, showJapaneseBlockErrors, switchLanguage, onActivateTab]);

    const handleToggleFurigana = useCallback(() => {
        setFuriganaEnabled((prev) => {
            const enabled = !prev;
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(FURIGANA_ENABLED_KEY, enabled);
            }
            return enabled;
        });
    }, []);

    const handleToggleAutoCorrect = useCallback(() => {
        setAutoCorrectEnabled((prev) => {
            const enabled = !prev;
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(AUTO_CORRECT_ENABLED_KEY, enabled);
            }
            if (enabled && editorRef.current) {
                const value = editorRef.current.getValue();
                if (value) {
                    const corrected = autoCorrect(
                        value,
                        autoCorrectSettingsRef.current,
                        autoCorrectOptionsOf(value, dnclModeRef.current),
                    );
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
            try {
                await converter.apply();
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[handlePreviewRubyScript] Apply error:', error);
                onShowAlert('convertRubyToBlocksError');
                return;
            }
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
        setAutoCorrectSettings((prev) => {
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
                converter
                    .apply()
                    .then(async () => {
                        clearErrors();
                        if (rubyCode.target && String(newVersion) === '2') {
                            try {
                                await syncModules(vm, rubyCode.target, intl, newVersion);
                            } catch (e) {
                                // eslint-disable-next-line no-console
                                console.error('Module sync error:', e);
                            }
                        }
                        updateRubyCodeTargetState(vm.editingTarget, newVersion);
                    })
                    .catch((error) => {
                        // eslint-disable-next-line no-console
                        console.error('[handleRubyVersionChange] Apply error:', error);
                        lastProcessedVersionRef.current = oldVersion;
                        onRevertRubyVersion(oldVersion);
                        onShowAlert('rubyVersionChangeFailed');
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
        async (lineNumber) => {
            if (runningBlockIdRef.current) {
                vm.runtime.toggleScript(runningBlockIdRef.current, {
                    target: vm.editingTarget,
                    stackClick: true,
                });
                return;
            }

            clearErrors();

            const code = rubyCode.code;

            // In DNCL mode, execute all top-level scripts from top to bottom
            // instead of just the cursor line.
            const isDncl = dnclModeRef.current;
            // Running shows the read mode, to follow the program by the line numbers (Issue #2380).
            if (isDncl && problemFormViewRef.current) problemFormViewRef.current.showReadMode();
            const targetLine = isDncl ? 1 : findExecutableLine(code, lineNumber);

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

                        if (dnclModeRef.current) {
                            // Convert regenerated Ruby back to DNCL for display
                            const dnclResult = rubyToDncl(regenerated);
                            dnclEditErrorRef.current = false;
                            setDnclDisplayCode(dnclResult.dncl);
                            editorRef.current.setValue(dnclResult.dncl);
                        } else {
                            editorRef.current.setValue(regenerated);
                        }

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
                .catch((error) => {
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
            if (problemFormViewRef.current) {
                problemFormViewRef.current.dispose();
                problemFormViewRef.current = null;
            }
            if (configChangeListenerRef.current) {
                configChangeListenerRef.current.dispose();
                configChangeListenerRef.current = null;
            }
            if (removePasteTransformRef.current) {
                removePasteTransformRef.current();
                removePasteTransformRef.current = null;
            }
            if (pasteListenerRef.current) {
                pasteListenerRef.current.dispose();
                pasteListenerRef.current = null;
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

    // Force Ruby mode when switching to a non-Japanese locale.
    // Skip the initial render — initial state is already set correctly by useState.
    const localeInitRef = useRef(false);
    useEffect(() => {
        if (!localeInitRef.current) {
            localeInitRef.current = true;
            return;
        }
        if (isJapaneseLocale(locale)) {
            // Restore saved preferences when switching back to Japanese. The language follows
            // the tab, so the Japanese tab is chosen again by the user.
            setFuriganaEnabled(loadBool(FURIGANA_ENABLED_KEY, true));
        } else {
            // Non-Japanese locale: force Ruby without updating the furigana setting. The
            // Japanese tab is hidden in these locales, so leave it for the Ruby tab.
            if (furiganaEnabled) {
                setFuriganaEnabled(false);
            }
            if (activeTabIndexRef.current === JAPANESE_TAB_INDEX) {
                onActivateTab(RUBY_TAB_INDEX);
            } else if (dnclModeRef.current) {
                switchLanguage(false);
            }
        }
    }, [locale]);

    // Leaving Japanese from outside the editor (the notice of the Code tab, the extension
    // button, a lesson that does not allow Japanese): the Japanese tab gives way to the
    // Ruby tab. On the other tabs the editor follows when a text tab is opened next.
    // The Japanese tab is not offered in the other locales either.
    useEffect(() => {
        const japaneseUnavailable = dnclModeLocked || !isJapaneseLocale(locale);
        if (!exitDnclModeExternallyRequested && !japaneseUnavailable) return;
        if (activeTabIndex === JAPANESE_TAB_INDEX) {
            externalDnclExitRef.current = true;
            onActivateTab(RUBY_TAB_INDEX);
        }
        if (exitDnclModeExternallyRequested) onClearExitDnclModeRequest?.();
    }, [exitDnclModeExternallyRequested, dnclModeLocked, locale, activeTabIndex]);

    // The console is the stage of the Japanese tab (docs/dncl/design.md 5 章): it is shown while the
    // Japanese tab shows the program in Japanese, and the Ruby tab gives the stage back. Only the
    // screen is shown: the console extension is added by the conversion when the program prints
    // or reads (`表示する` / `入力する`). The editing target is a dependency so that the console
    // comes back after a project is loaded.
    const japaneseTabActive = activeTabIndex === JAPANESE_TAB_INDEX;
    useEffect(() => {
        if (dnclMode && japaneseTabActive) onShowSmalrubyConsole?.();
    }, [dnclMode, japaneseTabActive, editingTarget]);
    useEffect(() => {
        if (activeTabIndex === RUBY_TAB_INDEX) onHideSmalrubyConsole?.();
    }, [activeTabIndex]);

    // Furigana toggle effect
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        if (furiganaEnabled) {
            renderFurigana();
        } else {
            furiganaRendererRef.current.clear(editorRef.current);
        }
    }, [furiganaEnabled]);

    // When code changes from blocks tab (Ruby → DNCL display), sync DNCL display
    const rubyCodeStr = rubyCode.code;
    useEffect(() => {
        if (!dnclMode || !prismReady) return;
        if (!editorRef.current || !monacoRef.current) return;
        // Only sync when the Ruby code changed externally (e.g., from blocks)
        // not from our own editor change (which already sets dnclDisplayCode)
        const currentEditorValue = editorRef.current.getValue();
        const currentRubyFromDncl = dnclToRuby(currentEditorValue).ruby;
        if (currentRubyFromDncl !== rubyCodeStr && rubyCodeStr) {
            const result = rubyToDncl(rubyCodeStr);
            dnclEditErrorRef.current = false;
            setDnclDisplayCode(result.dncl);
        }
    }, [rubyCodeStr, dnclMode, prismReady]);

    // The read mode is drawn only in the Japanese mode.
    useEffect(() => {
        if (problemFormViewRef.current) problemFormViewRef.current.sync();
    }, [dnclMode]);

    // The green flag shows the read mode too, as the run button of the toolbar does (Issue #2380).
    useEffect(() => {
        const handleProjectStart = () => {
            if (dnclModeRef.current && problemFormViewRef.current) problemFormViewRef.current.showReadMode();
        };
        vm.addListener('PROJECT_START', handleProjectStart);
        return () => vm.removeListener('PROJECT_START', handleProjectStart);
    }, [vm]);

    // Smalruby DNCL arrays start at index 0. A program written with 1-based
    // indices reads past the end of an array, where the VM silently returns
    // an empty value, so warn about such accesses in the editor. The markers
    // use their own owner so clearing conversion errors keeps them (Issue #1357).
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        const lines = dnclMode ? dnclDisplayCode.split('\n') : [];
        const hints = dnclMode ? findArrayIndexHints(dnclDisplayCode) : [];
        const markers = hints
            .filter((hint) => hint.line <= lines.length)
            .map((hint) => {
                const text = lines[hint.line - 1];
                const column = text.indexOf(hint.access);
                return {
                    startLineNumber: hint.line,
                    startColumn: column >= 0 ? column + 1 : 1,
                    endLineNumber: hint.line,
                    endColumn: column >= 0 ? column + hint.access.length + 1 : text.length + 1,
                    message: intl.formatMessage(
                        {
                            id: 'gui.rubyTab.dnclArrayIndexHint',
                            defaultMessage:
                                '{access} reads past the end of the array. In Smalruby Japanese mode, array indices start at 0 (the first element is {array}[0] and the last is {array}[{last}]). If the problem counts from 1, shift the index by 1, like {fixed}, or write "すべての配列の添字は 1 から始まる。" at the top of the program (the menu "A problem whose indices start at 1" writes it).',
                        },
                        hint,
                    ),
                    severity: monacoRef.current.MarkerSeverity.Warning,
                };
            });
        monacoRef.current.editor.setModelMarkers(editorRef.current.getModel(), DNCL_INDEX_HINT_OWNER, markers);
    }, [dnclMode, dnclDisplayCode, intl]);

    // `//` is the quotient in Smalruby DNCL, so a 共通テスト style `//` comment
    // (`a = 1 // 生徒番号`) converts without an error, into a different program.
    // Warn on such lines (see `slashCommentRows`) so that the user writes `#`.
    // The markers use their own owner so clearing conversion errors keeps them
    // (Issue #1192, #1711).
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        const lines = dnclMode ? dnclDisplayCode.split('\n') : [];
        const rows = dnclMode ? slashCommentRows(lines) : [];
        const message = intl.formatMessage({
            id: 'gui.rubyTab.dnclDoubleSlashHint',
            defaultMessage: 'In Smalruby, // is not a comment (it is integer division). Use # for comments.',
        });
        const markers = rows.map((row) => ({
            startLineNumber: row + 1,
            startColumn: 1,
            endLineNumber: row + 1,
            endColumn: lines[row].length + 1,
            message,
            severity: monacoRef.current.MarkerSeverity.Warning,
        }));
        monacoRef.current.editor.setModelMarkers(editorRef.current.getModel(), DNCL_SLASH_COMMENT_OWNER, markers);
    }, [dnclMode, dnclDisplayCode, intl]);

    // `+` with a string and `-` / `*` / `/` are worked out from the left, so in
    // `"残り" + a - 1` the `- 1` is taken from a string and only a number is shown.
    // The order is kept (Ruby reads it the same way); warn on such lines so that
    // the number part is put in parentheses (see `stringArithmeticRows`). The
    // markers use their own owner so clearing conversion errors keeps them
    // (Issue #1465).
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        const lines = dnclMode ? dnclDisplayCode.split('\n') : [];
        const rows = dnclMode ? stringArithmeticRows(lines) : [];
        const message = intl.formatMessage({
            id: 'gui.rubyTab.dnclStringArithmeticHint',
            defaultMessage:
                'With a string, - * / are worked out from the left, so "a" + x - 1 subtracts from the string "a" + x. Put the number part in parentheses, like "a" + (x - 1).',
        });
        const markers = rows.map((row) => ({
            startLineNumber: row + 1,
            startColumn: 1,
            endLineNumber: row + 1,
            endColumn: lines[row].length + 1,
            message,
            severity: monacoRef.current.MarkerSeverity.Warning,
        }));
        monacoRef.current.editor.setModelMarkers(editorRef.current.getModel(), DNCL_STRING_ARITHMETIC_OWNER, markers);
    }, [dnclMode, dnclDisplayCode, intl]);

    // DNCL that makes no Ruby is told on its lines, whether it was typed or
    // shown from blocks: the post-test loop (Issue #1626), the Ruby commands
    // (Issue #1679), the numbers of Ruby, a missing or extra closer (Issue
    // #1419) and a line that cannot be read. The markers use their own owner
    // so clearing conversion errors keeps them.
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        const errors = dnclMode ? dnclToRuby(dnclDisplayCode).errors : [];
        const lines = dnclDisplayCode.split('\n');
        const translated = (err) =>
            err.id === POST_TEST_LOOP_ERROR_ID ||
            err.id === UNSUPPORTED_COMMAND_ERROR_ID ||
            err.id === UNSUPPORTED_NUMBER_ERROR_ID ||
            err.id === FORBIDDEN_PREFIX_ERROR_ID;
        // `//` is integer division in Smalruby DNCL, never a comment (Issue #1192).
        const doubleSlashHint = intl.formatMessage({
            id: 'gui.rubyTab.dnclDoubleSlashHint',
            defaultMessage: 'In Smalruby, // is not a comment (it is integer division). Use # for comments.',
        });
        const markers = errors
            .filter((err) => err.line <= lines.length)
            .map((err) => {
                const lineEnd = lines[err.line - 1].length + 1;
                // A command, a number and `@` / `$` (issue #1674) are marked where they are written.
                const command =
                    (err.id === UNSUPPORTED_COMMAND_ERROR_ID ||
                        err.id === UNSUPPORTED_NUMBER_ERROR_ID ||
                        err.id === FORBIDDEN_PREFIX_ERROR_ID) &&
                    err.column + err.name.length <= lineEnd;
                const [hinted] = translated(err)
                    ? [{ text: dnclErrorText(err) }]
                    : withDoubleSlashHint([{ row: err.line - 1, text: err.message }], lines, doubleSlashHint);
                return {
                    startLineNumber: err.line,
                    startColumn: command ? err.column : 1,
                    endLineNumber: err.line,
                    endColumn: command ? err.column + err.name.length : lineEnd,
                    message: hinted.text,
                    severity: monacoRef.current.MarkerSeverity.Error,
                };
            });
        monacoRef.current.editor.setModelMarkers(editorRef.current.getModel(), DNCL_UNSUPPORTED_OWNER, markers);
    }, [dnclMode, dnclDisplayCode, dnclErrorText, intl]);

    // Japanese that makes Ruby with no blocks (`a, b = b, a`, `"a" + 1`, a change of an argument)
    // is told on its lines while the student writes, a moment after the last key (Issue #2547).
    // A later check wins over one still running.
    const japaneseBlocksCheckRef = useRef(0);
    useEffect(() => {
        const check = ++japaneseBlocksCheckRef.current;
        if (!dnclMode) {
            showJapaneseBlockErrors([]);
            return;
        }
        const timer = setTimeout(async () => {
            const errors = await checkJapaneseBlocks(dnclDisplayCode);
            if (check !== japaneseBlocksCheckRef.current || !dnclModeRef.current) return;
            showJapaneseBlockErrors(errors || []);
        }, JAPANESE_BLOCKS_CHECK_DELAY_MS);
        return () => clearTimeout(timer);
    }, [dnclMode, dnclDisplayCode, rubyCode.target, rubyVersion]);

    // componentDidUpdate equivalent
    const prevPropsRef = useRef(null);
    // Guard against starting a second Ruby→blocks conversion while one is
    // already running. The conversion's own side effects (extension loads,
    // emitWorkspaceUpdate, alerts) re-render this component while
    // rubyCode.modified is still true, so without this guard the effect
    // below starts the whole convert+apply pipeline twice per tab switch
    // (issue #710).
    const conversionInFlightRef = useRef(false);
    // When the user leaves the Ruby tab with modified code, this holds the
    // tab they were headed to. The effect below bounces back to the Ruby tab
    // while the conversion runs and activates this destination once the
    // blocks were applied successfully. RubyTab is the single owner of this
    // transition (the equivalent hook that used to live in containers/gui.jsx
    // was removed to stop the two pipelines from racing — issue #710).
    const pendingDestinationTabRef = useRef(null);
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

        // Japanese text that makes no Ruby is only in the editor: leaving the Japanese tab or
        // the sprite would write the program again from the blocks, and the lines the student
        // typed would be lost without a word (Issue #2546). Stay, as the Ruby tab stays when
        // its Ruby cannot be converted, and keep prev so that coming back is no change at all.
        // A switch asked from outside the editor (a lesson, the notice of the Code tab) is not stopped.
        if (dnclEditErrorRef.current && dnclModeRef.current) {
            const leavingTab = prev.activeTabIndex === JAPANESE_TAB_INDEX && activeTabIndex !== JAPANESE_TAB_INDEX;
            const heldTarget = rubyCode.target ? vm.runtime.getTargetById(rubyCode.target.id) : null;
            const leavingTarget =
                editingTarget !== prev.editingTarget && heldTarget && vm.editingTarget !== heldTarget;
            if (leavingTab && externalDnclExitRef.current) {
                dnclEditErrorRef.current = false;
            } else if (leavingTab || leavingTarget) {
                if (leavingTarget) vm.setEditingTarget(heldTarget.id);
                if (leavingTab) onActivateTab(JAPANESE_TAB_INDEX);
                onShowAlert('convertJapaneseError');
                return;
            }
            // The sprite the text was written for is gone (a project was loaded): nothing to keep.
            if (editingTarget !== prev.editingTarget && !heldTarget) dnclEditErrorRef.current = false;
        }
        if (activeTabIndex !== JAPANESE_TAB_INDEX) externalDnclExitRef.current = false;

        // The label of the `ruby_tab/open` GA event: the language of the tab that was
        // opened (the Japanese tab is 'dncl'), not the transient state of the editor
        // while it is switched.
        const rubyTabOpenLabel =
            isVisible && !prev.isVisible
                ? activeTabIndex === JAPANESE_TAB_INDEX
                    ? 'dncl'
                    : furiganaEnabledRef.current
                      ? 'furigana'
                      : 'ruby'
                : null;

        // Ruby version change
        if (rubyVersion !== prev.rubyVersion) {
            if (rubyVersion === lastProcessedVersionRef.current) {
                savePrev();
                return;
            }
            handleRubyVersionChange(prev.rubyVersion, rubyVersion);
        }

        const wasTextTab = isTextTabIndex(prev.activeTabIndex);
        const isTextTab = isTextTabIndex(activeTabIndex);

        // Tab switch away → dismiss bubble
        if (wasTextTab && activeTabIndex !== prev.activeTabIndex) {
            handleDismissBubbleStable();
        }

        // Between the Ruby tab and the Japanese tab: the same editor shows the
        // program in the language of the tab (docs/dncl/design.md 1 章).
        if (wasTextTab && isTextTab && activeTabIndex !== prev.activeTabIndex) {
            const toJapanese = activeTabIndex === JAPANESE_TAB_INDEX;
            if (toJapanese) {
                enterJapaneseTab();
            } else {
                leaveJapaneseTab();
            }
            try {
                analytics.event({
                    category: 'mode_switch',
                    action: 'change',
                    label: toJapanese ? 'dncl' : furiganaEnabledRef.current ? 'furigana' : 'ruby',
                });
            } catch (_e) {
                // Swallow analytics failures so the editor never breaks.
            }
        }

        // Leaving the Ruby tab (or the Japanese tab) with modified code: remember
        // the destination tab and immediately bounce back to that tab while the
        // conversion runs. The conversion itself is started by the
        // `modified` block below, and the destination is activated once the
        // blocks were applied successfully.
        if (wasTextTab && !isTextTab && rubyCode.modified) {
            pendingDestinationTabRef.current = activeTabIndex;
            onActivateTab(prev.activeTabIndex);
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
            if (changedTarget || blocksTabVisible || pendingDestinationTabRef.current !== null) {
                if (String(rubyVersion) === '2' && !v1PromptDismissed && containsV1Code(rubyCode.code)) {
                    const message = intlRef.current.formatMessage({
                        id: 'gui.rubyTab.v1CodeDetected',

                        defaultMessage:
                            'Switch Ruby version to "v1"?\n\nThe code you entered uses the "v1" syntax found in textbooks. Switching to "v1" lets you program with the same syntax as the textbook.',
                    });
                    // eslint-disable-next-line no-alert
                    if (window.confirm(message)) {
                        // Stay on the Ruby tab after switching versions; the
                        // version-change flow runs its own conversion.
                        pendingDestinationTabRef.current = null;
                        onRevertRubyVersion('1');
                        return;
                    }
                    onDismissV1Prompt();
                }
                if (!conversionInFlightRef.current) {
                    conversionInFlightRef.current = true;
                    targetCodeToBlocksHOC(intl)
                        .then((converter) => {
                            if (converter.result) {
                                return converter.apply().then(async () => {
                                    modified = false;
                                    clearErrors();
                                    if (rubyCode.target && String(rubyVersion) === '2') {
                                        try {
                                            await syncModules(vm, rubyCode.target, intl, rubyVersion);
                                        } catch (e) {
                                            // eslint-disable-next-line no-console
                                            console.error('Module sync error:', e);
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
                                    }
                                    // The user was headed to another tab when
                                    // the conversion started — take them
                                    // there now that the blocks are applied.
                                    if (pendingDestinationTabRef.current !== null) {
                                        const destination = pendingDestinationTabRef.current;
                                        pendingDestinationTabRef.current = null;
                                        onActivateTab(destination);
                                    }
                                });
                            }
                            showErrors(converter.errors);
                        })
                        .catch((error) => {
                            // apply() failed and rolled the target back
                            // (issue #710) — surface the error instead of
                            // letting it vanish as an unhandled rejection.
                            // eslint-disable-next-line no-console
                            console.error('[RubyTab] Ruby to blocks apply error:', error);
                            onShowAlert('convertRubyToBlocksError');
                        })
                        .finally(() => {
                            conversionInFlightRef.current = false;
                            // Conversion failed or produced errors: stay on
                            // the Ruby tab so the user can fix the code.
                            pendingDestinationTabRef.current = null;
                        });
                }
            }
        }

        if (!modified) {
            const etChanged = editingTarget && editingTarget !== prev.editingTarget;
            if ((isVisible && !prev.isVisible) || etChanged) {
                // Coming to the Ruby tab or the Japanese tab with the program in
                // Japanese: fall back to Ruby so blocks→Ruby generation works. In the
                // Ruby tab this is the end; in the Japanese tab the program is written
                // in Japanese again once the Ruby is ready (docs/dncl/design.md 1 章).
                const becameVisible = isVisible && !prev.isVisible;
                const wasDncl = becameVisible && dnclModeRef.current;
                const wantJapanese = becameVisible && activeTabIndex === JAPANESE_TAB_INDEX;
                if (wasDncl) {
                    dnclModeRef.current = false;
                    setDnclMode(false);
                    onSetDnclMode(false);
                    setFuriganaEnabled(isJapaneseLocale(locale) && loadBool(FURIGANA_ENABLED_KEY, true));
                    if (typeof window !== 'undefined' && window.localStorage) {
                        window.localStorage.setItem(DNCL_MODE_KEY, 'false');
                    }
                    if (editorRef.current && monacoRef.current) {
                        monacoRef.current.editor.setModelLanguage(editorRef.current.getModel(), 'smalruby');
                    }
                }
                updateRubyCodeTargetState(vm.editingTarget, rubyVersion);
                // Write the program in Japanese after React re-renders with the new
                // Ruby code and the Monaco editor value prop is committed.
                if (wantJapanese) {
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            enterJapaneseTab();
                        }, 0);
                    });
                }
            }
        }

        if (isVisible && !prev.isVisible) {
            if (editorRef.current) {
                editorRef.current.focus();
                editorRef.current.layout();
            }
            onMarkRubyTabUsed();
            try {
                analytics.event({
                    category: 'ruby_tab',
                    action: 'open',
                    label: rubyTabOpenLabel,
                });
            } catch (_e) {
                // Swallow analytics failures so the editor never breaks.
            }
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
                    onDownloadJapanese={handleDownloadJapanese}
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
                    dnclMode={dnclMode}
                    dnclValidating={dnclValidating}
                    onCopyProblemForm={handleCopyProblemForm}
                    readMode={problemFormShown}
                    onToggleReadMode={handleToggleReadMode}
                    onSelectSettingsPattern={handleSelectSettingsPattern}
                    locale={locale}
                />
                {/* The name of the language over the editor of the Japanese tab
                    (docs/dncl/design.md 1 章) */}
                {(dnclMode || dnclValidating) && (
                    <div className={styles.languageBand} data-testid="ruby-tab-language-band">
                        {intl.formatMessage(languageBandMessages.japanese)}
                    </div>
                )}
                <div
                    className={classNames(styles.editorWrapper, {
                        [styles.editorWrapperWithBand]: dnclMode || dnclValidating,
                    })}
                >
                    <Editor
                        key={locale}
                        height="100%"
                        language={dnclMode ? 'dncl' : 'smalruby'}
                        beforeMount={defineEditorThemes}
                        onMount={handleEditorDidMount}
                        onChange={handleEditorChange}
                        options={{
                            fontSize: fontSize || DEFAULT_FONT_SIZE,
                            fontFamily: 'Monaco, Menlo, Consolas, "source-code-pro", monospace',
                            minimap: { enabled: false },
                            // The problem form of the Japanese mode shows no dots for the
                            // spaces and no indent guides, and the line numbers as (01).
                            renderWhitespace: problemFormShown ? 'none' : 'all',
                            guides: { indentation: !problemFormShown },
                            lineNumbers: dnclMode ? problemFormLineNumberLabels : 'on',
                            lineNumbersMinChars: dnclMode ? lineNumbersMinChars : 5,
                            scrollBeyondLastLine: true,
                            // The Japanese tab writes the standard form indented 4 spaces (as
                            // ja-notation and the snippets write it), so Enter after `:` and Tab
                            // indent by 4 there too.
                            tabSize: dnclMode ? 4 : 2,
                            fixedOverflowWidgets: true,
                            wordBasedSuggestions: 'off',
                            autoIndent: 'full',
                            // Android Chrome でキーボード出現により親 div の高さが
                            // 縮んだとき、Monaco を ResizeObserver で自動再レイアウト
                            // させる。未設定だと内部キャッシュ寸法のままになり、
                            // キーボードに隠れた領域に caret が残って入力できない。
                            automaticLayout: true,
                        }}
                        theme={dnclMode ? JAPANESE_PAPER_THEME : 'vs'}
                        value={dnclMode ? dnclDisplayCode : code}
                        width="100%"
                    />
                    {/* Switching to or from DNCL starts the consultation again: the question, the
                        answer and the two versions are in the language of the mode (#1402). */}
                    <GenaiConcierge
                        key={dnclMode ? 'genai-dncl' : 'genai-ruby'}
                        vm={vm}
                        rubyTab
                        dnclMode={dnclMode}
                        createAdapter={genaiAdapterRef.current}
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
    v1PromptDismissed: PropTypes.bool,
    onDismissV1Prompt: PropTypes.func,
    onSetDnclMode: PropTypes.func,
    exitDnclModeExternallyRequested: PropTypes.bool,
    dnclModeLocked: PropTypes.bool,
    onClearExitDnclModeRequest: PropTypes.func,
    onActivateTab: PropTypes.func,
    onShowSmalrubyConsole: PropTypes.func,
    onHideSmalrubyConsole: PropTypes.func,
};

const mapStateToProps = (state) => ({
    blocksTabVisible: state.scratchGui.editorTab.activeTabIndex === BLOCKS_TAB_INDEX,
    editingTarget: state.scratchGui.targets.editingTarget,
    rubyCode: state.scratchGui.rubyCode,
    rubyVersion: state.scratchGui.settings.rubyVersion,
    vm: state.scratchGui.vm,
    projectTitle: state.scratchGui.projectTitle,
    locale: state.locales.locale,
    activeTabIndex: state.scratchGui.editorTab.activeTabIndex,
    v1PromptDismissed: state.scratchGui.settings.v1PromptDismissed,
    exitDnclModeExternallyRequested: state.scratchGui.dnclMode.exitDnclModeExternallyRequested,
    // A lesson that does not allow the Japanese mode (#1741)
    dnclModeLocked: !getLessonDnclModeAllowed(state),
});

const mapDispatchToProps = (dispatch) => ({
    onChange: (code) => {
        dispatch(updateRubyCode(code));
        dispatch(setProjectChanged());
    },
    updateRubyCodeErrorsState: (errors) => dispatch(updateRubyCodeErrors(errors)),
    updateRubyCodeTargetState: (target, version) => dispatch(updateRubyCodeTarget(target, version)),
    onRevertRubyVersion: (version) => dispatch(setRubyVersion(version)),
    onShowAlert: (alertId) => showAlertWithTimeout(dispatch, alertId),
    onDismissAlert: (alertId) => dispatch(closeAlertWithId(alertId)),
    onRequestCloseFile: () => dispatch(closeFileMenu()),
    onSetAiSaveStatus: (status) => dispatch(setAiSaveStatus(status)),
    onClearAiSaveStatus: () => dispatch(clearAiSaveStatus()),
    onFontSizeChange: (fontSize) => dispatch(updateRubyFontSize(fontSize)),
    onMarkRubyTabUsed: () => dispatch(markRubyTabUsed()),
    onDismissV1Prompt: () => dispatch(dismissV1Prompt()),
    onSetDnclMode: (dnclMode) => dispatch(setDnclModeAction(dnclMode)),
    onClearExitDnclModeRequest: () => dispatch(clearExternalExitDnclModeRequest()),
    onActivateTab: (tab) => dispatch(activateTab(tab)),
    onShowSmalrubyConsole: () => showSmalrubyConsole(dispatch),
    onHideSmalrubyConsole: () => hideSmalrubyConsole(dispatch),
});

const ConnectedRubyTab = RubyToBlocksConverterHOC(injectIntl(connect(mapStateToProps, mapDispatchToProps)(RubyTab)));

export default ConnectedRubyTab;
