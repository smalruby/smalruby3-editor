import React, {useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import {defineMessages, useIntl} from 'react-intl';
import VM from '@smalruby/scratch-vm';

import styles from './ruby-toolbar.css';

import iconPlay from './icon--play.svg';
import iconSearch from './icon--search.svg';
import iconUndo from './icon--undo.svg';
import iconRedo from './icon--redo.svg';
import iconBack from './icon--back.svg';
import iconForward from './icon--forward.svg';
import iconDownload from './icon--download.svg';

const messages = defineMessages({
    executeLine: {
        id: 'gui.rubyToolbar.executeLine',
        defaultMessage: 'Execute current line',
        description: 'Tooltip for execute line button'
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
        if (props.editorRef) {
            // Trigger Monaco Editor's search action
            props.editorRef.trigger('keyboard', 'actions.find', null);
        }
    }, [props.editorRef]);

    const handleUndo = useCallback(() => {
        if (props.editorRef) {
            props.editorRef.trigger('keyboard', 'undo', null);
        }
    }, [props.editorRef]);

    const handleRedo = useCallback(() => {
        if (props.editorRef) {
            props.editorRef.trigger('keyboard', 'redo', null);
        }
    }, [props.editorRef]);

    const handlePrevSprite = useCallback(() => {
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
        // Trigger download Ruby code
        if (props.onDownload) {
            props.onDownload();
        }
    }, [props]);

    const handleExecuteLine = useCallback(() => {
        if (!props.editorRef || !props.converter) {
            return;
        }

        // Get current cursor position
        const position = props.editorRef.getPosition();
        const lineNumber = position.lineNumber;

        // Get block ID from line number
        const blockId = props.converter.getBlockIdForLine(lineNumber);

        if (!blockId) {
            // No executable block found
            if (props.onExecuteLineError) {
                props.onExecuteLineError();
            }
            return;
        }

        // Execute block
        if (props.onExecuteLine) {
            props.onExecuteLine(blockId);
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
                    disabled={!props.editorRef || !props.converter}
                    aria-label={intl.formatMessage(messages.executeLine)}
                    title={intl.formatMessage(messages.executeLine)}
                >
                    <img
                        src={iconPlay}
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
                        disabled={!props.editorRef}
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
                        disabled={!props.editorRef}
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
            </div>

            {/* Download Part */}
            <div className={styles.toolbarPart}>
                <button
                    className={styles.iconButton}
                    onClick={handleDownload}
                    aria-label={intl.formatMessage(messages.download)}
                    title={intl.formatMessage(messages.download)}
                >
                    <img
                        src={iconDownload}
                        alt=""
                    />
                </button>
            </div>

            {/* Three-dot Menu Part - TODO */}
            <div className={`${styles.toolbarPart} ${styles.modRight}`}>
                {/* Placeholder for three-dot menu */}
            </div>
        </div>
    );
};

RubyToolbar.propTypes = {
    editingTarget: PropTypes.object,
    vm: PropTypes.instanceOf(VM).isRequired,
    editorRef: PropTypes.object,
    converter: PropTypes.shape({
        getBlockIdForLine: PropTypes.func
    }),
    onSelectTarget: PropTypes.func.isRequired,
    onDownload: PropTypes.func,
    onExecuteLine: PropTypes.func,
    onExecuteLineError: PropTypes.func
};

export default RubyToolbar;
