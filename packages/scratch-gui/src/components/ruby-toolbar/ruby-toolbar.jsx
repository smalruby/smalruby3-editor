import React, {useState, useCallback, useRef, useEffect} from 'react';
import PropTypes from 'prop-types';
import {useIntl} from 'react-intl';
import VM from '@smalruby/scratch-vm';

import styles from './ruby-toolbar.css';
import messages from './messages.js';
import TargetSelector from './target-selector.jsx';

import iconPlay from './icon--play.svg';
import iconStop from './icon--stop.svg';
import iconSearch from './icon--search.svg';
import iconUndo from './icon--undo.svg';
import iconRedo from './icon--redo.svg';
import iconDownload from './icon--download.svg';
import iconAutoCorrect from './icon--auto-correct.svg';
import iconRubytee from './icon--rubytee.svg';
import Spinner from '../spinner/spinner.jsx';

const RubyToolbar = props => {
    const intl = useIntl();
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreMenuRef = useRef(null);

    // Close more menu when clicking outside
    useEffect(() => {
        if (!showMoreMenu) return () => {};
        const handleClickOutside = e => {
            if (moreMenuRef.current &&
                !moreMenuRef.current.contains(e.target)) {
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

    const handleDownload = useCallback(() => {
        setShowMoreMenu(false);
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.onDownload) props.onDownload();
    }, [props]);

    const handleToggleFurigana = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.onToggleFurigana) props.onToggleFurigana();
    }, [props]);

    // === Smalruby: Start of mode selection handlers ===
    const handleSelectFuriganaMode = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        // Switch to Ruby mode with furigana ON
        if (props.dnclMode && props.onToggleDnclMode) props.onToggleDnclMode();
        if (!props.furiganaEnabled && props.onToggleFurigana) props.onToggleFurigana();
    }, [props]);

    const handleSelectRubyMode = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        // Switch to Ruby mode with furigana OFF
        if (props.dnclMode && props.onToggleDnclMode) props.onToggleDnclMode();
        if (props.furiganaEnabled && props.onToggleFurigana) props.onToggleFurigana();
    }, [props]);

    const handleSelectDnclMode = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        // Switch to DNCL mode
        if (!props.dnclMode && props.onToggleDnclMode) props.onToggleDnclMode();
    }, [props]);
    // === Smalruby: End of mode selection handlers ===

    const handleToggleAutoCorrect = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        if (props.onToggleAutoCorrect) props.onToggleAutoCorrect();
    }, [props]);

    const handleToggleMoreMenu = useCallback(() => {
        setShowMoreMenu(prev => !prev);
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
                    onClick={handleExecuteLine}
                    disabled={!props.editorRef}
                    aria-label={intl.formatMessage(executeMessage)}
                    title={intl.formatMessage(executeMessage)}
                >
                    <img
                        src={props.isRunning ? iconStop : iconPlay}
                        alt=""
                    />
                </button>
            </div>

            {/* Edit Part */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder}`}>
                <div className={styles.buttonGroup}>
                    <button
                        className={styles.iconButton}
                        onClick={handleUndo}
                        disabled={!props.editorRef || !props.canUndo}
                        aria-label={intl.formatMessage(messages.undo)}
                        title={intl.formatMessage(messages.undo)}
                    >
                        <img
                            src={iconUndo}
                            alt=""
                        />
                    </button>
                    <button
                        className={styles.iconButton}
                        onClick={handleRedo}
                        disabled={!props.editorRef || !props.canRedo}
                        aria-label={intl.formatMessage(messages.redo)}
                        title={intl.formatMessage(messages.redo)}
                    >
                        <img
                            src={iconRedo}
                            alt=""
                        />
                    </button>
                </div>
                <button
                    className={styles.iconButton}
                    onClick={handleSearch}
                    disabled={!props.editorRef}
                    aria-label={intl.formatMessage(messages.search)}
                    title={intl.formatMessage(messages.search)}
                >
                    <img
                        src={iconSearch}
                        alt=""
                    />
                </button>
            </div>

            {/* Auto Correct Toggle */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder}`}>
                <button
                    className={`${styles.autoCorrectButton} ${
                        props.autoCorrectEnabled ? styles.autoCorrectButtonActive : ''
                    }`}
                    onClick={handleToggleAutoCorrect}
                    aria-label={intl.formatMessage(
                        props.autoCorrectEnabled ? messages.autoCorrectOn : messages.autoCorrectOff
                    )}
                    aria-pressed={props.autoCorrectEnabled}
                    title={intl.formatMessage(
                        props.autoCorrectEnabled ? messages.autoCorrectOn : messages.autoCorrectOff
                    )}
                >
                    <img
                        src={iconAutoCorrect}
                        alt=""
                    />
                </button>
            </div>

            {/* Center: Navigation + AI */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder} ${styles.modCenter}`}>
                <TargetSelector
                    editingTarget={props.editingTarget}
                    vm={props.vm}
                    onSelectTarget={props.onSelectTarget}
                    onDismissBubble={props.onDismissBubble}
                />

                {/* Rubytee AI Assistant — disabled in DNCL mode */}
                {props.onOpenRubyteeModal && (
                    <button
                        className={styles.iconButton}
                        onClick={props.dnclMode ? null : props.onOpenRubyteeModal}
                        disabled={props.dnclMode}
                        aria-label={intl.formatMessage(messages.aiAssistant)}
                        title={intl.formatMessage(messages.aiAssistant)}
                    >
                        <img
                            src={iconRubytee}
                            alt=""
                        />
                    </button>
                )}
            </div>

            {/* === Smalruby: Start of mode toggle group === */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder}`}>
                <div className={styles.modeToggleGroup}>
                    <button
                        className={`${styles.modeToggleItem} ${
                            !props.dnclMode && props.furiganaEnabled
                                ? styles.modeToggleItemActive : ''
                        }`}
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
                            !props.dnclMode && !props.furiganaEnabled
                                ? styles.modeToggleItemActive : ''
                        }`}
                        disabled={props.dnclValidating}
                        onClick={handleSelectRubyMode}
                        title={intl.formatMessage(messages.modeRuby)}
                    >
                        {'Ruby'}
                    </button>
                    <button
                        className={`${styles.modeToggleItem} ${
                            props.dnclMode ? styles.modeToggleItemActive : ''
                        }`}
                        disabled={props.dnclValidating}
                        onClick={handleSelectDnclMode}
                        title={intl.formatMessage(messages.modeDncl)}
                    >
                        {props.dnclValidating ? (
                            <Spinner small level="info" />
                        ) : (
                            intl.formatMessage(messages.dnclLabel)
                        )}
                    </button>
                </div>
            </div>
            {/* === Smalruby: End of mode toggle group === */}

            {/* More Menu Part */}
            <div className={styles.toolbarPart}>
                <div
                    className={styles.moreMenuWrapper}
                    ref={moreMenuRef}
                >
                    <button
                        className={styles.iconButton}
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
                                onClick={handleDownload}
                            >
                                <img
                                    className={styles.moreMenuIconImg}
                                    src={iconDownload}
                                    alt=""
                                />
                                {intl.formatMessage(messages.saveRubyScript)}
                            </div>
                            <div
                                className={styles.moreMenuItem}
                                onClick={handleInsertClass}
                            >
                                <span className={styles.moreMenuIcon}>{'{ }'}</span>
                                {intl.formatMessage(messages.insertClass)}
                            </div>
                            <div
                                className={styles.moreMenuItem}
                                onClick={handlePreviewRubyScript}
                            >
                                <span className={styles.moreMenuIcon}>{'</>'}</span>
                                {intl.formatMessage(messages.previewRubyScript)}
                            </div>
                            <div
                                className={styles.moreMenuItem}
                                onClick={handleOpenAutoCorrectSettings}
                            >
                                <img
                                    className={styles.moreMenuIconImg}
                                    src={iconAutoCorrect}
                                    alt=""
                                />
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
    onToggleDnclMode: PropTypes.func,
    furiganaEnabled: PropTypes.bool,
    onToggleFurigana: PropTypes.func,
    autoCorrectEnabled: PropTypes.bool,
    onToggleAutoCorrect: PropTypes.func,
    onOpenAutoCorrectSettings: PropTypes.func,
    onPreviewRubyScript: PropTypes.func,
    onOpenRubyteeModal: PropTypes.func
};

export default RubyToolbar;
