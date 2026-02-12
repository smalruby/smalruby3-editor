import React from 'react';
import PropTypes from 'prop-types';
import {defineMessages, injectIntl} from 'react-intl';
import VM from '@smalruby/scratch-vm';
import intlShape from '../../lib/intlShape.js';

import styles from './ruby-toolbar.css';

import iconSearch from './icon--search.svg';
import iconUndo from './icon--undo.svg';
import iconRedo from './icon--redo.svg';
import iconBack from './icon--back.svg';
import iconForward from './icon--forward.svg';
import iconDownload from './icon--download.svg';

const messages = defineMessages({
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

class RubyToolbar extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            commandValue: '',
            showDropdown: false,
            filteredTargets: []
        };

        this.handleSearch = this.handleSearch.bind(this);
        this.handleUndo = this.handleUndo.bind(this);
        this.handleRedo = this.handleRedo.bind(this);
        this.handlePrevSprite = this.handlePrevSprite.bind(this);
        this.handleNextSprite = this.handleNextSprite.bind(this);
        this.handleCommandChange = this.handleCommandChange.bind(this);
        this.handleCommandFocus = this.handleCommandFocus.bind(this);
        this.handleCommandBlur = this.handleCommandBlur.bind(this);
        this.handleCommandKeyDown = this.handleCommandKeyDown.bind(this);
        this.handleSelectTarget = this.handleSelectTarget.bind(this);
        this.handleSelectTargetFromDropdown = this.handleSelectTargetFromDropdown.bind(this);
        this.handleDownload = this.handleDownload.bind(this);
    }

    getSortedSprites () {
        if (!this.props.vm || !this.props.vm.runtime) {
            return [];
        }
        const targets = this.props.vm.runtime.targets;
        const sprites = targets
            .filter(t => !t.isStage)
            .sort((a, b) => a.getLayerOrder() - b.getLayerOrder());
        return sprites;
    }

    getAllTargets () {
        if (!this.props.vm || !this.props.vm.runtime) {
            return [];
        }
        const stage = this.props.vm.runtime.targets.find(t => t.isStage);
        const sprites = this.getSortedSprites();
        return stage ? [stage, ...sprites] : sprites;
    }

    getCurrentSpriteIndex () {
        const sprites = this.getSortedSprites();
        const currentId = this.props.editingTarget?.id;
        return sprites.findIndex(s => s.id === currentId);
    }

    getTargetName (target) {
        if (!target) {
            return '';
        }
        if (target.isStage) {
            return this.props.intl.formatMessage(messages.stage);
        }
        if (typeof target.getName === 'function') {
            return target.getName();
        }
        if (target.sprite && target.sprite.name) {
            return target.sprite.name;
        }
        return target.name || '';
    }

    handleSearch () {
        if (this.props.editorRef) {
            // Trigger Monaco Editor's search action
            this.props.editorRef.trigger('keyboard', 'actions.find', null);
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

    handlePrevSprite () {
        const sprites = this.getSortedSprites();
        const currentIndex = this.getCurrentSpriteIndex();

        if (this.props.editingTarget?.isStage) {
            return;
        }

        if (currentIndex === 0) {
            const stage = this.props.vm.runtime.targets.find(t => t.isStage);
            if (stage) {
                this.props.onSelectTarget(stage.id);
            }
        } else if (currentIndex > 0) {
            this.props.onSelectTarget(sprites[currentIndex - 1].id);
        }
    }

    handleNextSprite () {
        const sprites = this.getSortedSprites();
        const currentIndex = this.getCurrentSpriteIndex();

        if (this.props.editingTarget?.isStage) {
            if (sprites.length > 0) {
                this.props.onSelectTarget(sprites[0].id);
            }
        } else if (currentIndex >= 0 && currentIndex < sprites.length - 1) {
            this.props.onSelectTarget(sprites[currentIndex + 1].id);
        }
    }

    handleCommandChange (e) {
        const value = e.target.value;
        this.setState({commandValue: value});

        if (value.startsWith('>')) {
            // Command mode - TODO: implement Monaco command palette
            this.setState({showDropdown: false});
        } else {
            // Sprite search mode
            const allTargets = this.getAllTargets();
            const filtered = allTargets.filter(target => {
                const name = this.getTargetName(target).toLowerCase();
                return name.includes(value.toLowerCase());
            });
            this.setState({
                showDropdown: value.length > 0 && filtered.length > 0,
                filteredTargets: filtered
            });
        }
    }

    handleCommandFocus () {
        if (this.state.commandValue && !this.state.commandValue.startsWith('>')) {
            const allTargets = this.getAllTargets();
            const filtered = allTargets.filter(target => {
                const name = this.getTargetName(target).toLowerCase();
                return name.includes(this.state.commandValue.toLowerCase());
            });
            this.setState({
                showDropdown: filtered.length > 0,
                filteredTargets: filtered
            });
        }
    }

    handleCommandBlur () {
        // Delay to allow click on dropdown item
        setTimeout(() => {
            this.setState({showDropdown: false});
        }, 200);
    }

    handleCommandKeyDown (e) {
        if (e.key === 'Escape') {
            this.setState({commandValue: '', showDropdown: false});
            e.target.blur();
        } else if (e.key === 'Enter' && this.state.filteredTargets.length > 0) {
            this.handleSelectTarget(this.state.filteredTargets[0].id);
        }
    }

    handleSelectTarget (targetId) {
        this.props.onSelectTarget(targetId);
        this.setState({commandValue: '', showDropdown: false});
    }

    handleSelectTargetFromDropdown (e) {
        const targetId = e.currentTarget.dataset.targetId;
        this.handleSelectTarget(targetId);
    }

    handleDownload () {
        // Trigger download Ruby code
        if (this.props.onDownload) {
            this.props.onDownload();
        }
    }

    canGoPrev () {
        if (this.props.editingTarget?.isStage) {
            return false;
        }
        const currentIndex = this.getCurrentSpriteIndex();
        return currentIndex >= 0;
    }

    canGoNext () {
        const sprites = this.getSortedSprites();
        if (sprites.length === 0) {
            return false;
        }
        if (this.props.editingTarget?.isStage) {
            return true;
        }
        const currentIndex = this.getCurrentSpriteIndex();
        return currentIndex >= 0 && currentIndex < sprites.length - 1;
    }

    highlightMatch (text, query) {
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
    }

    render () {
        const {intl} = this.props;
        const {commandValue, showDropdown, filteredTargets} = this.state;

        return (
            <div className={styles.toolbar}>
                {/* Edit Part */}
                <div className={`${styles.toolbarPart} ${styles.modDashedBorder}`}>
                    <div className={styles.buttonGroup}>
                        <button
                            className={styles.iconButton}
                            onClick={this.handleUndo}
                            disabled={!this.props.editorRef}
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
                            onClick={this.handleRedo}
                            disabled={!this.props.editorRef}
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
                        onClick={this.handleSearch}
                        disabled={!this.props.editorRef}
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
                        onClick={this.handlePrevSprite}
                        disabled={!this.canGoPrev()}
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
                        onClick={this.handleNextSprite}
                        disabled={!this.canGoNext()}
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
                            onChange={this.handleCommandChange}
                            onFocus={this.handleCommandFocus}
                            onBlur={this.handleCommandBlur}
                            onKeyDown={this.handleCommandKeyDown}
                            placeholder={intl.formatMessage(messages.commandPlaceholder)}
                        />
                        {showDropdown && (
                            <div className={styles.dropdown}>
                                {filteredTargets.map(target => (
                                    <div
                                        key={target.id}
                                        className={styles.dropdownItem}
                                        data-target-id={target.id}
                                        onMouseDown={this.handleSelectTargetFromDropdown}
                                    >
                                        {this.highlightMatch(this.getTargetName(target), commandValue)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Run Part */}
                <div className={styles.toolbarPart}>
                    <button
                        className={styles.iconButton}
                        onClick={this.handleDownload}
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
    }
}

RubyToolbar.propTypes = {
    editingTarget: PropTypes.object,
    vm: PropTypes.instanceOf(VM).isRequired,
    editorRef: PropTypes.object,
    onSelectTarget: PropTypes.func.isRequired,
    onDownload: PropTypes.func,
    intl: intlShape.isRequired
};

export default injectIntl(RubyToolbar);
