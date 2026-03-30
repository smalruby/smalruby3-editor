// === Smalruby: This file is Smalruby-specific (target selector for Ruby toolbar) ===

import React, {useState, useCallback} from 'react';
import PropTypes from 'prop-types';
import {useIntl} from 'react-intl';
import VM from '@smalruby/scratch-vm';

import styles from './ruby-toolbar.css';
import messages from './messages.js';

import iconBack from './icon--back.svg';
import iconForward from './icon--forward.svg';

const TargetSelector = props => {
    const intl = useIntl();
    const [commandValue, setCommandValue] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredTargets, setFilteredTargets] = useState([]);

    const getSortedSprites = useCallback(() => {
        if (!props.vm || !props.vm.runtime) {
            return [];
        }
        return props.vm.runtime.targets
            .filter(t => !t.isStage)
            .sort((a, b) => a.getLayerOrder() - b.getLayerOrder());
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
        if (!target) return '';
        if (target.isStage) return intl.formatMessage(messages.stage);
        if (typeof target.getName === 'function') return target.getName();
        if (target.sprite && target.sprite.name) return target.sprite.name;
        return target.name || '';
    }, [intl]);

    const handlePrevSprite = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        const sprites = getSortedSprites();
        const currentIndex = getCurrentSpriteIndex();

        if (props.editingTarget?.isStage) return;

        if (currentIndex === 0) {
            const stage = props.vm.runtime.targets.find(t => t.isStage);
            if (stage) props.onSelectTarget(stage.id);
        } else if (currentIndex > 0) {
            props.onSelectTarget(sprites[currentIndex - 1].id);
        }
    }, [getSortedSprites, getCurrentSpriteIndex, props]);

    const handleNextSprite = useCallback(() => {
        if (props.onDismissBubble) props.onDismissBubble();
        const sprites = getSortedSprites();
        const currentIndex = getCurrentSpriteIndex();

        if (props.editingTarget?.isStage) {
            if (sprites.length > 0) props.onSelectTarget(sprites[0].id);
        } else if (currentIndex >= 0 && currentIndex < sprites.length - 1) {
            props.onSelectTarget(sprites[currentIndex + 1].id);
        }
    }, [getSortedSprites, getCurrentSpriteIndex, props]);

    const handleSelectTarget = useCallback(targetId => {
        if (props.onDismissBubble) props.onDismissBubble();
        props.onSelectTarget(targetId);
        setCommandValue('');
        setShowDropdown(false);
    }, [props]);

    const handleCommandChange = useCallback(e => {
        const value = e.target.value;
        setCommandValue(value);

        if (value.startsWith('>')) {
            setShowDropdown(false);
        } else {
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
        setTimeout(() => {
            setShowDropdown(false);
        }, 200);
    }, []);

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

    const canGoPrev = useCallback(() => {
        if (props.editingTarget?.isStage) return false;
        const currentIndex = getCurrentSpriteIndex();
        return currentIndex >= 0;
    }, [props.editingTarget, getCurrentSpriteIndex]);

    const canGoNext = useCallback(() => {
        const sprites = getSortedSprites();
        if (sprites.length === 0) return false;
        if (props.editingTarget?.isStage) return true;
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
        <>
            <button
                className={styles.iconButton}
                data-testid="ruby-toolbar-prev-sprite"
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
                data-testid="ruby-toolbar-next-sprite"
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
                    data-testid="ruby-toolbar-sprite-search"
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
        </>
    );
};

TargetSelector.propTypes = {
    editingTarget: PropTypes.object,
    vm: PropTypes.instanceOf(VM).isRequired,
    onSelectTarget: PropTypes.func.isRequired,
    onDismissBubble: PropTypes.func
};

export default TargetSelector;
