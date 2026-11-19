import VM from '@smalruby/scratch-vm';
import PropTypes from 'prop-types';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useIntl } from 'react-intl';
import analytics from '../../lib/analytics';
import { dnclSettingsPatternId } from '../../lib/dncl/dncl-settings';
import { isJapaneseLocale } from '../../lib/locale-utils.js';
import { isTouchDevice } from '../../lib/touch-device.js';
import iconAutoCorrect from './icon--auto-correct.svg';
import iconDownload from './icon--download.svg';
import iconKeyboard from './icon--keyboard.svg';
import iconPlay from './icon--play.svg';
import iconRedo from './icon--redo.svg';
import iconSearch from './icon--search.svg';
import iconStop from './icon--stop.svg';
import iconUndo from './icon--undo.svg';
import messages from './messages.js';
import styles from './ruby-toolbar.css';
import TargetSelector from './target-selector.jsx';

const RubyToolbar = (props) => {
    const intl = useIntl();
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const moreMenuRef = useRef(null);

    // Track Monaco focus so the keyboard toggle button reflects whether the
    // software keyboard is shown (editor focused) on touch devices.
    useEffect(() => {
        const editor = props.editorRef;
        if (!editor || typeof editor.onDidFocusEditorText !== 'function') {
            setKeyboardVisible(false);
            return () => {};
        }
        setKeyboardVisible(typeof editor.hasTextFocus === 'function' && editor.hasTextFocus());
        const focusDisposable = editor.onDidFocusEditorText(() => setKeyboardVisible(true));
        const blurDisposable = editor.onDidBlurEditorText(() => setKeyboardVisible(false));
        return () => {
            focusDisposable.dispose();
            blurDisposable.dispose();
        };
    }, [props.editorRef]);

    // Close more menu when clicking outside
    useEffect(() => {
        if (!showMoreMenu) return () => {};
        const handleClickOutside = (e) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
                setShowMoreMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMoreMenu]);

    const handleSearch = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.editorRef) {
            props.editorRef.trigger('keyboard', 'actions.find', null);
        }
    }, [props]);

    const handleUndo = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.editorRef) {
            props.editorRef.trigger('keyboard', 'undo', null);
        }
    }, [props]);

    const handleRedo = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.editorRef) {
            props.editorRef.trigger('keyboard', 'redo', null);
        }
    }, [props]);

    const handleToggleKeyboard = useCallback(() => {
        const editor = props.editorRef;
        if (!editor) return;
        if (keyboardVisible) {
            // Monaco has no public blur API. The focused element depends on
            // its text input strategy (div.native-edit-context on 0.55+,
            // textarea.inputarea before), so blur whichever element inside
            // the editor currently has focus to dismiss the keyboard.
            const domNode = typeof editor.getDomNode === 'function' && editor.getDomNode();
            const active = document.activeElement;
            if (domNode && active && domNode.contains(active)) {
                active.blur();
            }
        } else {
            // Focusing within the button's user gesture summons the software
            // keyboard on iOS/Android (same mechanism as Monaco's built-in
            // iPad show-keyboard widget, hidden via ruby-tab.css).
            editor.focus();
        }
    }, [props.editorRef, keyboardVisible]);

    const handleKeyboardMouseDown = useCallback((e) => {
        // Keep focus on the editor: without this, pressing the button blurs
        // Monaco at mousedown time, keyboardVisible flips to false before the
        // click handler runs, and "hide" would re-focus instead.
        e.preventDefault();
    }, []);

    const handleDownload = useCallback(() => {
        setShowMoreMenu(false);
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.onDownload) props.onDownload();
    }, [props]);

    const trackFuriganaToggle = useCallback((next) => {
        try {
            analytics.event({
                category: 'furigana_toggle',
                action: 'toggle',
                label: next ? 'on' : 'off',
            });
        } catch (_e) {
            // Swallow analytics failures so the editor never breaks.
        }
    }, []);

    const trackModeSwitch = useCallback((mode) => {
        try {
            analytics.event({
                category: 'mode_switch',
                action: 'change',
                label: mode,
            });
        } catch (_e) {
            // Swallow analytics failures so the editor never breaks.
        }
    }, []);

    const handleToggleFurigana = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.onToggleFurigana) {
            trackFuriganaToggle(!props.furiganaEnabled);
            props.onToggleFurigana();
        }
    }, [props, trackFuriganaToggle]);

    // === Smalruby: Start of mode selection handlers ===
    const handleSelectFuriganaMode = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        trackModeSwitch('furigana');
        // Furigana ON. Japanese is the Japanese tab, not a mode of this toolbar (docs/dncl/design.md 1 章)
        if (!props.furiganaEnabled && props.onToggleFurigana) {
            trackFuriganaToggle(true);
            props.onToggleFurigana();
        }
    }, [props, trackModeSwitch, trackFuriganaToggle]);

    const handleSelectRubyMode = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        trackModeSwitch('ruby');
        // Furigana OFF
        if (props.furiganaEnabled && props.onToggleFurigana) {
            trackFuriganaToggle(false);
            props.onToggleFurigana();
        }
    }, [props, trackModeSwitch, trackFuriganaToggle]);

    // === Smalruby: End of mode selection handlers ===

    const handleToggleAutoCorrect = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.onToggleAutoCorrect) props.onToggleAutoCorrect();
    }, [props]);

    const handleToggleMoreMenu = useCallback(() => {
        setShowMoreMenu((prev) => !prev);
    }, []);

    const handleInsertClass = useCallback(() => {
        setShowMoreMenu(false);
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.onInsertClass) props.onInsertClass();
    }, [props]);

    const handleOpenAutoCorrectSettings = useCallback(() => {
        setShowMoreMenu(false);
        if (props.onOpenAutoCorrectSettings) props.onOpenAutoCorrectSettings();
    }, [props]);

    const handleCopyProblemForm = useCallback(() => {
        setShowMoreMenu(false);
        if (props.onCopyProblemForm) props.onCopyProblemForm();
    }, [props]);

    // === Smalruby: Start of settings patterns of the Japanese mode ===
    const handleSelectSettingsPattern = useCallback(
        (patternId) => {
            setShowMoreMenu(false);
            if (props.onDismissBubble) props.onDismissBubble();
            if (props.onSelectSettingsPattern) props.onSelectSettingsPattern(patternId);
        },
        [props],
    );
    const handleSelectExamplePattern = useCallback(
        () => handleSelectSettingsPattern('example'),
        [handleSelectSettingsPattern],
    );
    const handleSelectIndexFromOnePattern = useCallback(
        () => handleSelectSettingsPattern('indexFromOne'),
        [handleSelectSettingsPattern],
    );
    // The pattern the program is written by, read from its sentences when the menu is shown.
    const currentPatternId =
        showMoreMenu && props.dnclMode && props.editorRef && typeof props.editorRef.getValue === 'function'
            ? dnclSettingsPatternId(props.editorRef.getValue())
            : null;
    // === Smalruby: End of settings patterns of the Japanese mode ===
    const handlePreviewRubyScript = useCallback(() => {
        setShowMoreMenu(false);
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.onPreviewRubyScript) props.onPreviewRubyScript();
    }, [props]);

    const handleExecuteLine = useCallback(() => {
        if (!props.editorRef) return;
        const position = props.editorRef.getPosition();
        if (props.onExecuteLine) props.onExecuteLine(position.lineNumber);
    }, [props]);

    // === Smalruby: Start of DNCL execute button label ===
    const executeMessage = props.isRunning
        ? messages.stopExecution
        : props.dnclMode
          ? messages.executeAll
          : messages.executeLine;
    // === Smalruby: End of DNCL execute button label ===

    return (
        <div className={styles.toolbar}>
            {/* Run Part */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder}`}>
                <button
                    className={styles.iconButton}
                    data-testid="ruby-toolbar-execute"
                    onClick={handleExecuteLine}
                    disabled={!props.editorRef}
                    aria-label={intl.formatMessage(executeMessage)}
                    title={intl.formatMessage(executeMessage)}
                >
                    <img src={props.isRunning ? iconStop : iconPlay} alt="" />
                </button>
            </div>

            {/* Edit Part */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder}`}>
                <div className={styles.buttonGroup}>
                    <button
                        className={styles.iconButton}
                        data-testid="ruby-toolbar-undo"
                        onClick={handleUndo}
                        disabled={!props.editorRef || !props.canUndo}
                        aria-label={intl.formatMessage(messages.undo)}
                        title={intl.formatMessage(messages.undo)}
                    >
                        <img src={iconUndo} alt="" />
                    </button>
                    <button
                        className={styles.iconButton}
                        data-testid="ruby-toolbar-redo"
                        onClick={handleRedo}
                        disabled={!props.editorRef || !props.canRedo}
                        aria-label={intl.formatMessage(messages.redo)}
                        title={intl.formatMessage(messages.redo)}
                    >
                        <img src={iconRedo} alt="" />
                    </button>
                </div>
                <button
                    className={styles.iconButton}
                    data-testid="ruby-toolbar-search"
                    onClick={handleSearch}
                    disabled={!props.editorRef}
                    aria-label={intl.formatMessage(messages.search)}
                    title={intl.formatMessage(messages.search)}
                >
                    <img src={iconSearch} alt="" />
                </button>
                {isTouchDevice() && (
                    <button
                        className={styles.iconButton}
                        data-testid="ruby-toolbar-keyboard"
                        onClick={handleToggleKeyboard}
                        onMouseDown={handleKeyboardMouseDown}
                        disabled={!props.editorRef}
                        aria-pressed={keyboardVisible}
                        aria-label={intl.formatMessage(
                            keyboardVisible ? messages.keyboardHide : messages.keyboardShow,
                        )}
                        title={intl.formatMessage(keyboardVisible ? messages.keyboardHide : messages.keyboardShow)}
                    >
                        <img src={iconKeyboard} alt="" />
                    </button>
                )}
            </div>

            {/* Auto Correct Toggle */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder}`}>
                <button
                    className={`${styles.autoCorrectButton} ${
                        props.autoCorrectEnabled ? styles.autoCorrectButtonActive : ''
                    }`}
                    data-testid="ruby-toolbar-auto-correct"
                    onClick={handleToggleAutoCorrect}
                    aria-label={intl.formatMessage(
                        props.autoCorrectEnabled ? messages.autoCorrectOn : messages.autoCorrectOff,
                    )}
                    aria-pressed={props.autoCorrectEnabled}
                    title={intl.formatMessage(
                        props.autoCorrectEnabled ? messages.autoCorrectOn : messages.autoCorrectOff,
                    )}
                >
                    <img src={iconAutoCorrect} alt="" />
                </button>
            </div>

            {/* Center: Navigation */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder} ${styles.modCenter}`}>
                <TargetSelector
                    editingTarget={props.editingTarget}
                    vm={props.vm}
                    onSelectTarget={props.onSelectTarget}
                    onDismissBubble={props.onDismissBubble}
                />
            </div>

            {/* === Smalruby: Start of mode toggle group === */}
            {/* Furigana / Ruby: the two ways the Ruby tab shows Ruby. Not shown in the Japanese tab */}
            {isJapaneseLocale(props.locale) && !props.dnclMode && (
                <div className={`${styles.toolbarPart} ${styles.modDashedBorder}`}>
                    <div className={styles.modeToggleGroup}>
                        <button
                            className={`${styles.modeToggleItem} ${
                                props.furiganaEnabled ? styles.modeToggleItemActive : ''
                            }`}
                            data-testid="ruby-toolbar-mode-furigana"
                            disabled={props.dnclValidating}
                            onClick={handleSelectFuriganaMode}
                            title={intl.formatMessage(messages.modeFurigana)}
                        >
                            <span className={styles.modeToggleFuriganaLabel}>
                                <span className={styles.modeToggleFuriganaLine1}>
                                    {intl.formatMessage(messages.modeFuriganaLine1)}
                                </span>
                                <span className={styles.modeToggleFuriganaLine2}>
                                    {intl.formatMessage(messages.modeFuriganaLine2)}
                                </span>
                            </span>
                        </button>
                        <button
                            className={`${styles.modeToggleItem} ${
                                props.furiganaEnabled ? '' : styles.modeToggleItemActive
                            }`}
                            data-testid="ruby-toolbar-mode-ruby"
                            disabled={props.dnclValidating}
                            onClick={handleSelectRubyMode}
                            title={intl.formatMessage(messages.modeRuby)}
                        >
                            {'Ruby'}
                        </button>
                    </div>
                </div>
            )}
            {/* === Smalruby: End of mode toggle group === */}

            {/* More Menu Part */}
            <div className={styles.toolbarPart}>
                <div className={styles.moreMenuWrapper} ref={moreMenuRef}>
                    <button
                        className={styles.iconButton}
                        data-testid="ruby-toolbar-more-menu"
                        onClick={handleToggleMoreMenu}
                        aria-label={intl.formatMessage(messages.moreOptions)}
                        title={intl.formatMessage(messages.moreOptions)}
                    >
                        <span className={styles.moreIcon}>{'⋯'}</span>
                    </button>
                    {showMoreMenu && (
                        <div className={styles.moreMenu}>
                            <div
                                className={styles.moreMenuItem}
                                data-testid="ruby-toolbar-menu-download"
                                onClick={handleDownload}
                            >
                                <img className={styles.moreMenuIconImg} src={iconDownload} alt="" />
                                {intl.formatMessage(messages.saveRubyScript)}
                            </div>
                            <div
                                className={styles.moreMenuItem}
                                data-testid="ruby-toolbar-menu-insert-class"
                                onClick={handleInsertClass}
                            >
                                <span className={styles.moreMenuIcon}>{'{ }'}</span>
                                {intl.formatMessage(messages.insertClass)}
                            </div>
                            <div
                                className={styles.moreMenuItem}
                                data-testid="ruby-toolbar-menu-preview"
                                onClick={handlePreviewRubyScript}
                            >
                                <span className={styles.moreMenuIcon}>{'</>'}</span>
                                {intl.formatMessage(messages.previewRubyScript)}
                            </div>
                            {props.dnclMode && (
                                <div
                                    className={styles.moreMenuItem}
                                    data-testid="ruby-toolbar-menu-copy-problem-form"
                                    onClick={handleCopyProblemForm}
                                >
                                    <span className={styles.moreMenuIcon}>{'(01)'}</span>
                                    {intl.formatMessage(messages.copyProblemForm)}
                                </div>
                            )}
                            {props.dnclMode && (
                                <div
                                    className={styles.moreMenuItem}
                                    data-testid="ruby-toolbar-menu-settings-pattern-example"
                                    aria-checked={currentPatternId === 'example'}
                                    role="menuitemradio"
                                    onClick={handleSelectExamplePattern}
                                >
                                    <span className={styles.moreMenuIcon}>
                                        {currentPatternId === 'example' ? '✓' : ''}
                                    </span>
                                    {intl.formatMessage(messages.settingsPatternExample)}
                                </div>
                            )}
                            {props.dnclMode && (
                                <div
                                    className={styles.moreMenuItem}
                                    data-testid="ruby-toolbar-menu-settings-pattern-index-from-one"
                                    aria-checked={currentPatternId === 'indexFromOne'}
                                    role="menuitemradio"
                                    onClick={handleSelectIndexFromOnePattern}
                                >
                                    <span className={styles.moreMenuIcon}>
                                        {currentPatternId === 'indexFromOne' ? '✓' : ''}
                                    </span>
                                    {intl.formatMessage(messages.settingsPatternIndexFromOne)}
                                </div>
                            )}
                            <div
                                className={styles.moreMenuItem}
                                data-testid="ruby-toolbar-menu-auto-correct-settings"
                                onClick={handleOpenAutoCorrectSettings}
                            >
                                <img className={styles.moreMenuIconImg} src={iconAutoCorrect} alt="" />
                                {intl.formatMessage(messages.autoCorrectSettings)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

RubyToolbar.propTypes = {
    editingTarget: PropTypes.object,
    vm: PropTypes.instanceOf(VM).isRequired,
    editorRef: PropTypes.object,
    onSelectTarget: PropTypes.func.isRequired,
    onDownload: PropTypes.func,
    onInsertClass: PropTypes.func,
    onExecuteLine: PropTypes.func,
    onDismissBubble: PropTypes.func,
    isRunning: PropTypes.bool,
    canUndo: PropTypes.bool,
    canRedo: PropTypes.bool,
    dnclMode: PropTypes.bool,
    dnclValidating: PropTypes.bool,
    furiganaEnabled: PropTypes.bool,
    onToggleFurigana: PropTypes.func,
    autoCorrectEnabled: PropTypes.bool,
    onToggleAutoCorrect: PropTypes.func,
    onOpenAutoCorrectSettings: PropTypes.func,
    onPreviewRubyScript: PropTypes.func,
    onCopyProblemForm: PropTypes.func,
    onSelectSettingsPattern: PropTypes.func,
    locale: PropTypes.string,
};

export default RubyToolbar;
