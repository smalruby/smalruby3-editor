import React, {useState, useCallback, useRef, useEffect} from 'react';
import PropTypes from 'prop-types';
import {defineMessages, useIntl} from 'react-intl';
import VM from '@smalruby/scratch-vm';

import styles from './ruby-toolbar.css';

import iconPlay from './icon--play.svg';
import iconStop from './icon--stop.svg';
import iconSearch from './icon--search.svg';
import iconUndo from './icon--undo.svg';
import iconRedo from './icon--redo.svg';
import iconBack from './icon--back.svg';
import iconForward from './icon--forward.svg';
import iconDownload from './icon--download.svg';
import iconAI from './icon--ai.svg';
import iconFurigana from './icon--furigana.svg';
import iconAutoCorrect from './icon--auto-correct.svg';

const messages = defineMessages({
    executeLine: {
        id: 'gui.rubyToolbar.executeLine',
        defaultMessage: 'Execute current line',
        description: 'Tooltip for execute line button'
    },
    stopExecution: {
        id: 'gui.rubyToolbar.stopExecution',
        defaultMessage: 'Stop execution',
        description: 'Tooltip for stop execution button'
    },
    search: {
        id: 'gui.rubyToolbar.search',
        defaultMessage: 'Search',
        description: 'Tooltip for search button'
    },
    undo: {
        id: 'gui.rubyToolbar.undo',
        defaultMessage: 'Undo',
        description: 'Tooltip for undo button'
    },
    redo: {
        id: 'gui.rubyToolbar.redo',
        defaultMessage: 'Redo',
        description: 'Tooltip for redo button'
    },
    prevSprite: {
        id: 'gui.rubyToolbar.prevSprite',
        defaultMessage: 'Previous sprite',
        description: 'Tooltip for previous sprite button'
    },
    nextSprite: {
        id: 'gui.rubyToolbar.nextSprite',
        defaultMessage: 'Next sprite',
        description: 'Tooltip for next sprite button'
    },
    commandPlaceholder: {
        id: 'gui.rubyToolbar.commandPlaceholder',
        defaultMessage: 'Search sprites by name',
        description: 'Placeholder for command input'
    },
    download: {
        id: 'gui.rubyToolbar.download',
        defaultMessage: 'Download Ruby code',
        description: 'Tooltip for download button'
    },
    aiAssistant: {
        id: 'gui.rubyToolbar.aiAssistant',
        defaultMessage: 'Smalruby Teacher (Gemini)',
        description: 'Tooltip for AI assistant button'
    },
    furiganaOn: {
        id: 'gui.rubyToolbar.furiganaOn',
        defaultMessage: 'Hide furigana',
        description: 'Tooltip for furigana toggle button when ON'
    },
    furiganaOff: {
        id: 'gui.rubyToolbar.furiganaOff',
        defaultMessage: 'Show furigana',
        description: 'Tooltip for furigana toggle button when OFF'
    },
    autoCorrectOn: {
        id: 'gui.rubyToolbar.autoCorrectOn',
        defaultMessage: 'Disable auto-correct',
        description: 'Tooltip for auto-correct toggle button when ON'
    },
    autoCorrectOff: {
        id: 'gui.rubyToolbar.autoCorrectOff',
        defaultMessage: 'Enable auto-correct',
        description: 'Tooltip for auto-correct toggle button when OFF'
    },
    moreOptions: {
        id: 'gui.rubyToolbar.moreOptions',
        defaultMessage: 'More options',
        description: 'Tooltip for three-dot menu button'
    },
    autoCorrectSettings: {
        id: 'gui.rubyToolbar.autoCorrectSettings',
        defaultMessage: 'Auto-Correct Settings',
        description: 'Label for auto-correct settings menu item'
    },
    saveRubyScript: {
        id: 'gui.rubyToolbar.saveRubyScript',
        defaultMessage: 'Save Ruby script',
        description: 'Label for save Ruby script menu item'
    },
    stage: {
        id: 'gui.rubyToolbar.stage',
        defaultMessage: 'Stage',
        description: 'Name for stage target'
    }
});

const RubyToolbar = props => {
    const intl = useIntl();
    const [commandValue, setCommandValue] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredTargets, setFilteredTargets] = useState([]);
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

    const getSortedSprites = useCallback(() => {
        if (!props.vm || !props.vm.runtime) {
            return [];
        }
        const targets = props.vm.runtime.targets;
        const sprites = targets
            .filter(t => !t.isStage)
            .sort((a, b) => a.getLayerOrder() - b.getLayerOrder());
        return sprites;
    }, [props.vm]);

    const getAllTargets = useCallback(() => {
        if (!props.vm || !props.vm.runtime) {
            return [];
        }
        const stage = props.vm.runtime.targets.find(t => t.isStage);
        const sprites = getSortedSprites();
        return stage ? [stage, ...sprites] : sprites;
    }, [props.vm, getSortedSprites]);

    const getCurrentSpriteIndex = useCallback(() => {
        const sprites = getSortedSprites();
        const currentId = props.editingTarget?.id;
        return sprites.findIndex(s => s.id === currentId);
    }, [getSortedSprites, props.editingTarget]);

    const getTargetName = useCallback(target => {
        if (!target) {
            return '';
        }
        if (target.isStage) {
            return intl.formatMessage(messages.stage);
        }
        if (typeof target.getName === 'function') {
            return target.getName();
        }
        if (target.sprite && target.sprite.name) {
            return target.sprite.name;
        }
        return target.name || '';
    }, [intl]);

    const handleSearch = useCallback(() => {
        if (props.onDismissBubble) {
            props.onDismissBubble();
        }
        if (props.editorRef) {
            // Trigger Monaco Editor's search action
            props.editorRef.trigger('keyboard', 'actions.find', null);
        }
    }, [props]);

    const handleUndo = useCallback(() => {
        if (props.onDismissBubble) {
            props.onDismissBubble();
        }
        if (props.editorRef) {
            props.editorRef.trigger('keyboard', 'undo', null);
        }
    }, [props]);

    const handleRedo = useCallback(() => {
        if (props.onDismissBubble) {
            props.onDismissBubble();
        }
        if (props.editorRef) {
            props.editorRef.trigger('keyboard', 'redo', null);
        }
    }, [props]);

    const handlePrevSprite = useCallback(() => {
        if (props.onDismissBubble) {
            props.onDismissBubble();
        }

        const sprites = getSortedSprites();
        const currentIndex = getCurrentSpriteIndex();

        if (props.editingTarget?.isStage) {
            return;
        }

        if (currentIndex === 0) {
            const stage = props.vm.runtime.targets.find(t => t.isStage);
            if (stage) {
                props.onSelectTarget(stage.id);
            }
        } else if (currentIndex > 0) {
            props.onSelectTarget(sprites[currentIndex - 1].id);
        }
    }, [getSortedSprites, getCurrentSpriteIndex, props]);

    const handleNextSprite = useCallback(() => {
        if (props.onDismissBubble) {
            props.onDismissBubble();
        }

        const sprites = getSortedSprites();
        const currentIndex = getCurrentSpriteIndex();

        if (props.editingTarget?.isStage) {
            if (sprites.length > 0) {
                props.onSelectTarget(sprites[0].id);
            }
        } else if (currentIndex >= 0 && currentIndex < sprites.length - 1) {
            props.onSelectTarget(sprites[currentIndex + 1].id);
        }
    }, [getSortedSprites, getCurrentSpriteIndex, props]);

    const handleCommandChange = useCallback(e => {
        const value = e.target.value;
        setCommandValue(value);

        if (value.startsWith('>')) {
            // Command mode - TODO: implement Monaco command palette
            setShowDropdown(false);
        } else {
            // Sprite search mode
            const allTargets = getAllTargets();
            const filtered = allTargets.filter(target => {
                const name = getTargetName(target).toLowerCase();
                return name.includes(value.toLowerCase());
            });
            setShowDropdown(value.length > 0 && filtered.length > 0);
            setFilteredTargets(filtered);
        }
    }, [getAllTargets, getTargetName]);

    const handleCommandFocus = useCallback(() => {
        if (commandValue && !commandValue.startsWith('>')) {
            const allTargets = getAllTargets();
            const filtered = allTargets.filter(target => {
                const name = getTargetName(target).toLowerCase();
                return name.includes(commandValue.toLowerCase());
            });
            setShowDropdown(filtered.length > 0);
            setFilteredTargets(filtered);
        }
    }, [commandValue, getAllTargets, getTargetName]);

    const handleCommandBlur = useCallback(() => {
        // Delay to allow click on dropdown item
        setTimeout(() => {
            setShowDropdown(false);
        }, 200);
    }, []);

    const handleSelectTarget = useCallback(targetId => {
        if (props.onDismissBubble) {
            props.onDismissBubble();
        }
        props.onSelectTarget(targetId);
        setCommandValue('');
        setShowDropdown(false);
    }, [props]);

    const handleCommandKeyDown = useCallback(e => {
        if (e.key === 'Escape') {
            setCommandValue('');
            setShowDropdown(false);
            e.target.blur();
        } else if (e.key === 'Enter' && !e.isComposing && filteredTargets.length > 0) {
            handleSelectTarget(filteredTargets[0].id);
        }
    }, [filteredTargets, handleSelectTarget]);

    const handleSelectTargetFromDropdown = useCallback(e => {
        const targetId = e.currentTarget.dataset.targetId;
        handleSelectTarget(targetId);
    }, [handleSelectTarget]);

    const handleDownload = useCallback(() => {
        setShowMoreMenu(false);
        if (props.onDismissBubble) {
            props.onDismissBubble();
        }
        if (props.onDownload) {
            props.onDownload();
        }
    }, [props]);

    const handleOpenAI = useCallback(() => {
        if (props.onDismissBubble) {
            props.onDismissBubble();
        }
        if (props.onOpenGeminiModal) {
            props.onOpenGeminiModal();
        }
    }, [props]);

    const handleToggleFurigana = useCallback(() => {
        if (props.onDismissBubble) {
            props.onDismissBubble();
        }
        if (props.onToggleFurigana) {
            props.onToggleFurigana();
        }
    }, [props]);

    const handleToggleAutoCorrect = useCallback(() => {
        if (props.onDismissBubble) {
            props.onDismissBubble();
        }
        if (props.onToggleAutoCorrect) {
            props.onToggleAutoCorrect();
        }
    }, [props]);

    const handleToggleMoreMenu = useCallback(() => {
        setShowMoreMenu(prev => !prev);
    }, []);

    const handleOpenAutoCorrectSettings = useCallback(() => {
        setShowMoreMenu(false);
        if (props.onOpenAutoCorrectSettings) {
            props.onOpenAutoCorrectSettings();
        }
    }, [props]);

    const handleExecuteLine = useCallback(() => {
        if (!props.editorRef) {
            return;
        }

        // Get current cursor position
        const position = props.editorRef.getPosition();
        const lineNumber = position.lineNumber;

        // Trigger conversion and execution
        if (props.onExecuteLine) {
            props.onExecuteLine(lineNumber);
        }
    }, [props]);

    const canGoPrev = useCallback(() => {
        if (props.editingTarget?.isStage) {
            return false;
        }
        const currentIndex = getCurrentSpriteIndex();
        return currentIndex >= 0;
    }, [props.editingTarget, getCurrentSpriteIndex]);

    const canGoNext = useCallback(() => {
        const sprites = getSortedSprites();
        if (sprites.length === 0) {
            return false;
        }
        if (props.editingTarget?.isStage) {
            return true;
        }
        const currentIndex = getCurrentSpriteIndex();
        return currentIndex >= 0 && currentIndex < sprites.length - 1;
    }, [getSortedSprites, props.editingTarget, getCurrentSpriteIndex]);

    const highlightMatch = useCallback((text, query) => {
        if (!query) return text;
        const index = text.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return text;

        return (
            <>
                {text.substring(0, index)}
                <span className={styles.highlight}>
                    {text.substring(index, index + query.length)}
                </span>
                {text.substring(index + query.length)}
            </>
        );
    }, []);

    return (
        <div className={styles.toolbar}>
            {/* Run Part */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder}`}>
                <button
                    className={styles.iconButton}
                    onClick={handleExecuteLine}
                    disabled={!props.editorRef}
                    aria-label={intl.formatMessage(props.isRunning ? messages.stopExecution : messages.executeLine)}
                    title={intl.formatMessage(props.isRunning ? messages.stopExecution : messages.executeLine)}
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

            {/* Furigana Toggle & Auto Correct Toggle */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder}`}>
                <button
                    className={`${styles.furiganaButton} ${props.furiganaEnabled ? styles.furiganaButtonActive : ''}`}
                    onClick={handleToggleFurigana}
                    aria-label={intl.formatMessage(props.furiganaEnabled ? messages.furiganaOn : messages.furiganaOff)}
                    aria-pressed={props.furiganaEnabled}
                    title={intl.formatMessage(props.furiganaEnabled ? messages.furiganaOn : messages.furiganaOff)}
                >
                    <img
                        src={iconFurigana}
                        alt=""
                    />
                </button>
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

            {/* Navigation & Command Part */}
            <div className={`${styles.toolbarPart} ${styles.modDashedBorder} ${styles.modCenter}`}>
                <button
                    className={styles.iconButton}
                    onClick={handlePrevSprite}
                    disabled={!canGoPrev()}
                    aria-label={intl.formatMessage(messages.prevSprite)}
                    title={intl.formatMessage(messages.prevSprite)}
                >
                    <img
                        src={iconBack}
                        alt=""
                    />
                </button>
                <button
                    className={styles.iconButton}
                    onClick={handleNextSprite}
                    disabled={!canGoNext()}
                    aria-label={intl.formatMessage(messages.nextSprite)}
                    title={intl.formatMessage(messages.nextSprite)}
                >
                    <img
                        src={iconForward}
                        alt=""
                    />
                </button>
                <div className={styles.commandWrapper}>
                    <input
                        className={styles.commandInput}
                        type="text"
                        value={commandValue}
                        onChange={handleCommandChange}
                        onFocus={handleCommandFocus}
                        onBlur={handleCommandBlur}
                        onKeyDown={handleCommandKeyDown}
                        placeholder={intl.formatMessage(messages.commandPlaceholder)}
                    />
                    {showDropdown && (
                        <div className={styles.dropdown}>
                            {filteredTargets.map(target => (
                                <div
                                    key={target.id}
                                    className={styles.dropdownItem}
                                    data-target-id={target.id}
                                    onMouseDown={handleSelectTargetFromDropdown}
                                >
                                    {highlightMatch(getTargetName(target), commandValue)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    className={styles.iconButton}
                    onClick={handleOpenAI}
                    aria-label={intl.formatMessage(messages.aiAssistant)}
                    title={intl.formatMessage(messages.aiAssistant)}
                >
                    <img
                        src={iconAI}
                        alt=""
                    />
                </button>
            </div>

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
                                {intl.formatMessage(
                                    messages.saveRubyScript
                                )}
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
                                {intl.formatMessage(
                                    messages.autoCorrectSettings
                                )}
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
    onExecuteLine: PropTypes.func,
    onDismissBubble: PropTypes.func,
    onOpenGeminiModal: PropTypes.func,
    isRunning: PropTypes.bool,
    canUndo: PropTypes.bool,
    canRedo: PropTypes.bool,
    furiganaEnabled: PropTypes.bool,
    onToggleFurigana: PropTypes.func,
    autoCorrectEnabled: PropTypes.bool,
    onToggleAutoCorrect: PropTypes.func,
    onOpenAutoCorrectSettings: PropTypes.func
};

export default RubyToolbar;
