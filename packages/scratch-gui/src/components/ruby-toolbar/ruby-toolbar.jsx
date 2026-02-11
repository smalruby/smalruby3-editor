import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, injectIntl} from 'react-intl';
import VM from '@smalruby/scratch-vm';
import intlShape from '../../lib/intlShape.js';

import styles from './ruby-toolbar.css';

const messages = defineMessages({
    searchPlaceholder: {
        id: 'gui.rubyToolbar.searchPlaceholder',
        defaultMessage: 'Search sprites...',
        description: 'Placeholder text for sprite search input'
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
    stage: {
        id: 'gui.rubyToolbar.stage',
        defaultMessage: 'Stage',
        description: 'Name for stage target'
    }
});

class RubyToolbar extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            searchValue: ''
        };
        this.handlePrevSprite = this.handlePrevSprite.bind(this);
        this.handleNextSprite = this.handleNextSprite.bind(this);
        this.handleSearchChange = this.handleSearchChange.bind(this);
        this.handleSearchSelect = this.handleSearchSelect.bind(this);
        this.handleUndo = this.handleUndo.bind(this);
        this.handleRedo = this.handleRedo.bind(this);
    }

    getSortedSprites () {
        if (!this.props.vm || !this.props.vm.runtime) {
            return [];
        }
        const targets = this.props.vm.runtime.targets;
        // Filter out stage and sort by drawableID (display order)
        const sprites = targets
            .filter(t => !t.isStage)
            .sort((a, b) => {
                // Sort by layer order (higher layer = later in array)
                return a.getLayerOrder() - b.getLayerOrder();
            });
        return sprites;
    }

    getCurrentSpriteIndex () {
        const sprites = this.getSortedSprites();
        const currentId = this.props.editingTarget?.id;
        return sprites.findIndex(s => s.id === currentId);
    }

    handlePrevSprite () {
        const sprites = this.getSortedSprites();
        const currentIndex = this.getCurrentSpriteIndex();

        if (this.props.editingTarget?.isStage) {
            // On stage, do nothing (← button should be disabled)
            return;
        }

        if (currentIndex === 0) {
            // First sprite → go to stage
            const stage = this.props.vm.runtime.targets.find(t => t.isStage);
            if (stage) {
                this.props.onSelectTarget(stage.id);
            }
        } else if (currentIndex > 0) {
            // Go to previous sprite
            this.props.onSelectTarget(sprites[currentIndex - 1].id);
        }
    }

    handleNextSprite () {
        const sprites = this.getSortedSprites();
        const currentIndex = this.getCurrentSpriteIndex();

        if (this.props.editingTarget?.isStage) {
            // Stage → go to first sprite
            if (sprites.length > 0) {
                this.props.onSelectTarget(sprites[0].id);
            }
        } else if (currentIndex >= 0 && currentIndex < sprites.length - 1) {
            // Go to next sprite
            this.props.onSelectTarget(sprites[currentIndex + 1].id);
        }
        // On last sprite, do nothing (→ button should be disabled)
    }

    handleSearchChange (e) {
        this.setState({searchValue: e.target.value});
    }

    handleSearchSelect (e) {
        const targetId = e.target.value;
        if (targetId) {
            this.props.onSelectTarget(targetId);
            this.setState({searchValue: ''});
        }
    }

    handleUndo () {
        if (this.props.editorRef) {
            this.props.editorRef.trigger('keyboard', 'undo', null);
        }
    }

    handleRedo () {
        if (this.props.editorRef) {
            this.props.editorRef.trigger('keyboard', 'redo', null);
        }
    }

    getTargetName (target) {
        if (target.isStage) {
            return this.props.intl.formatMessage(messages.stage);
        }
        return target.sprite ? target.sprite.name : target.getName();
    }

    getCurrentTargetName () {
        if (!this.props.editingTarget) {
            return '';
        }
        return this.getTargetName(this.props.editingTarget);
    }

    canGoPrev () {
        // Can't go prev if on stage or no sprites
        if (this.props.editingTarget?.isStage) {
            return false;
        }
        const currentIndex = this.getCurrentSpriteIndex();
        return currentIndex >= 0; // Can always go to stage
    }

    canGoNext () {
        const sprites = this.getSortedSprites();
        if (sprites.length === 0) {
            return false;
        }
        if (this.props.editingTarget?.isStage) {
            return true; // Can go to first sprite
        }
        const currentIndex = this.getCurrentSpriteIndex();
        return currentIndex >= 0 && currentIndex < sprites.length - 1;
    }

    render () {
        const {intl} = this.props;
        const sprites = this.getSortedSprites();
        const stage = this.props.vm?.runtime?.targets?.find(t => t.isStage);
        const currentName = this.getCurrentTargetName();

        return (
            <div className={styles.toolbar}>
                {/* Sprite Navigation */}
                <div className={styles.navGroup}>
                    <button
                        className={styles.button}
                        onClick={this.handlePrevSprite}
                        disabled={!this.canGoPrev()}
                        aria-label={intl.formatMessage(messages.prevSprite)}
                        title={intl.formatMessage(messages.prevSprite)}
                    >
                        ←
                    </button>
                    <button
                        className={styles.button}
                        onClick={this.handleNextSprite}
                        disabled={!this.canGoNext()}
                        aria-label={intl.formatMessage(messages.nextSprite)}
                        title={intl.formatMessage(messages.nextSprite)}
                    >
                        →
                    </button>
                </div>

                {/* Navigation Control */}
                <div className={styles.searchControlWrapper}>
                    <input
                        className={styles.searchControl}
                        type="text"
                        list="sprite-list"
                        value={this.state.searchValue || currentName}
                        onChange={this.handleSearchChange}
                        placeholder={intl.formatMessage(messages.searchPlaceholder)}
                    />
                    <datalist id="sprite-list">
                        {stage && (
                            <option
                                key={stage.id}
                                value={stage.id}
                            >
                                {this.getTargetName(stage)}
                            </option>
                        )}
                        {sprites.map(sprite => (
                            <option
                                key={sprite.id}
                                value={sprite.id}
                            >
                                {this.getTargetName(sprite)}
                            </option>
                        ))}
                    </datalist>
                </div>

                <div className={styles.separator} />

                {/* Editor Operations */}
                <div className={styles.navGroup}>
                    <button
                        className={styles.button}
                        onClick={this.handleUndo}
                        disabled={!this.props.editorRef}
                        aria-label={intl.formatMessage(messages.undo)}
                        title={intl.formatMessage(messages.undo)}
                    >
                        ⟲
                    </button>
                    <button
                        className={styles.button}
                        onClick={this.handleRedo}
                        disabled={!this.props.editorRef}
                        aria-label={intl.formatMessage(messages.redo)}
                        title={intl.formatMessage(messages.redo)}
                    >
                        ⟳
                    </button>
                </div>
            </div>
        );
    }
}

RubyToolbar.propTypes = {
    editingTarget: PropTypes.shape({
        id: PropTypes.string.isRequired,
        sprite: PropTypes.shape({
            name: PropTypes.string
        }),
        isStage: PropTypes.bool,
        getName: PropTypes.func
    }),
    vm: PropTypes.instanceOf(VM).isRequired,
    editorRef: PropTypes.object,
    onSelectTarget: PropTypes.func.isRequired,
    intl: intlShape.isRequired
};

export default injectIntl(RubyToolbar);
