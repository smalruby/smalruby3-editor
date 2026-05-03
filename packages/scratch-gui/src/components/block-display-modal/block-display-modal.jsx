import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import {defineMessages, FormattedMessage, injectIntl} from 'react-intl';
import intlShape from '../../lib/intlShape.js';
import * as Blockly from 'scratch-blocks';
import {CATEGORY_BLOCKS, generateBlockOrder} from '../../lib/block-utils';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import blockDisplayIcon from '../menu-bar/block-display-icon.png';
import copyIcon from './icon--clipboard-copy.svg';
import fileIcon from '../menu-bar/icon--file.svg';

import styles from './block-display-modal.css';

const messages = defineMessages({
    title: {
        defaultMessage: 'Block Display Settings',
        description: 'Title for the block display settings modal',
        id: 'gui.smalruby3.blockDisplayModal.title'
    },
    alwaysVisible: {
        defaultMessage: 'Always visible',
        description: 'Label for categories that are always visible',
        id: 'gui.smalruby3.blockDisplayModal.alwaysVisible'
    },
    saveToFile: {
        defaultMessage: 'Save to File',
        description: 'Label for save to file button',
        id: 'gui.smalruby3.blockDisplayModal.saveToFile'
    }
});

// Define block categories with their IDs and ScratchBlocks.Msg keys
const BLOCK_CATEGORIES = [
    {id: 'motion', messageKey: 'CATEGORY_MOTION'},
    {id: 'looks', messageKey: 'CATEGORY_LOOKS'},
    {id: 'sound', messageKey: 'CATEGORY_SOUND'},
    {id: 'event', messageKey: 'CATEGORY_EVENTS'},
    {id: 'control', messageKey: 'CATEGORY_CONTROL'},
    {id: 'sensing', messageKey: 'CATEGORY_SENSING'},
    {id: 'operators', messageKey: 'CATEGORY_OPERATORS'}
];

const ALWAYS_VISIBLE_CATEGORIES = [
    {id: 'variables', messageKey: 'CATEGORY_VARIABLES'},
    {id: 'myBlocks', messageKey: 'CATEGORY_MYBLOCKS'},
    {id: 'extensions', messageId: 'gui.smalruby3.blockDisplayModal.extensions'}
];

// CATEGORY_BLOCKS imported from block-utils.js

// Helper functions imported from make-toolbox-xml.js


class BlockDisplayModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleCategoryChange',
            'handleBlockChange',
            'handleCategorySelect',
            'handleBlockListScroll',
            'scrollToCategorySection',
            'setBlockListRef',
            'handleCopyClick',
            'handleSaveToFile'
        ]);

        this.state = {
            selectedCategoryIndex: 0,
            copyButtonState: 'normal' // 'normal' | 'copying' | 'copied'
        };

        // Ref for the block list container
        this.blockListRef = null;
    }

    handleCategoryChange (event) {
        const categoryId = event.target.getAttribute('data-category');
        const isChecked = event.target.checked;

        // Find the category index for the clicked category
        const categoryIndex = BLOCK_CATEGORIES.findIndex(category => category.id === categoryId);

        // Update the selected category to sync the right pane
        if (categoryIndex !== -1) {
            this.setState({selectedCategoryIndex: categoryIndex});
            // Scroll to the corresponding category section
            this.scrollToCategorySection(categoryIndex);
        }

        this.props.onCategoryChange(categoryId, isChecked);
    }

    handleBlockChange (event) {
        const blockId = event.target.getAttribute('data-block');
        const categoryId = event.target.getAttribute('data-category');
        const isChecked = event.target.checked;
        this.props.onBlockChange(categoryId, blockId, isChecked);
    }

    handleCategorySelect (event) {
        const categoryIndex = parseInt(event.currentTarget.getAttribute('data-category-index'), 10);
        this.setState({selectedCategoryIndex: categoryIndex});
        // Scroll to the corresponding category section
        this.scrollToCategorySection(categoryIndex);
    }

    handleBlockListScroll () {
        if (!this.blockListRef) return;

        const blockListContainer = this.blockListRef;
        const containerTop = blockListContainer.scrollTop;

        // Find the category header that has passed the top of the viewport
        const categoryHeaders = blockListContainer.querySelectorAll(`.${styles.categoryHeader}`);

        let activeCategoryIndex = 0;

        categoryHeaders.forEach((header, index) => {
            const headerTop = header.offsetTop;
            // If this header is approaching or at the top of the viewport
            if (headerTop <= containerTop + 180) {
                activeCategoryIndex = index;
            }
        });

        // Update the selected category index if it changed
        if (this.state.selectedCategoryIndex !== activeCategoryIndex) {
            this.setState({selectedCategoryIndex: activeCategoryIndex});
        }
    }

    scrollToCategorySection (categoryIndex) {
        if (!this.blockListRef) return;

        const blockListContainer = this.blockListRef;
        const categoryHeaders = blockListContainer.querySelectorAll(`.${styles.categoryHeader}`);

        if (categoryHeaders[categoryIndex]) {
            const targetHeader = categoryHeaders[categoryIndex];
            const headerTop = targetHeader.offsetTop;

            // Scroll to position that exactly matches the detection timing (180px offset)
            const scrollPosition = headerTop - 180;

            blockListContainer.scrollTo({
                top: Math.max(0, scrollPosition),
                behavior: 'smooth'
            });
        }
    }

    setBlockListRef (ref) {
        this.blockListRef = ref;
    }

    generateOnlyBlocksUrl () {
        const {selectedBlocks} = this.props;
        const currentUrl = typeof window === 'undefined' ? '' : window.location.href;

        // Parse current URL to preserve hash
        let baseUrl;
        let hash;
        try {
            const url = new URL(currentUrl);
            baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
            hash = url.hash;
        } catch (e) {
            return currentUrl;
        }

        // Get the ordered list of all blocks
        const blockOrder = generateBlockOrder();

        // Create binary string representing block selection
        let binaryString = '';
        blockOrder.forEach(blockId => {
            // Check if this block is selected in any category
            let isSelected = false;
            Object.keys(selectedBlocks).forEach(categoryId => {
                const blocksInCategory = selectedBlocks[categoryId] || [];
                if (blocksInCategory.includes(blockId)) {
                    isSelected = true;
                }
            });
            binaryString += isSelected ? '1' : '0';
        });

        // Convert binary to hex with proper bit ordering
        let hexString = '';
        // Process in chunks of 4 bits (1 hex digit each)
        for (let i = 0; i < binaryString.length; i += 4) {
            const chunk = binaryString.slice(i, i + 4);
            // Pad chunk to 4 bits if needed
            const paddedChunk = chunk.padEnd(4, '0');
            // Reverse bits for proper ordering (LSB first)
            const reversedChunk = paddedChunk.split('')
                .reverse()
                .join('');
            // Convert to decimal then hex
            const decimal = parseInt(reversedChunk, 2);
            const hex = decimal.toString(16);
            hexString += hex;
        }

        // Add leading '0' identifier for hex format
        const hexParam = `0${hexString}`;

        // Create new URL with only_blocks parameter using hex format
        const newUrl = `${baseUrl}?only_blocks=${encodeURIComponent(hexParam)}${hash}`;

        return newUrl;
    }

    async handleCopyClick () {
        const url = this.generateOnlyBlocksUrl();

        try {
            this.setState({copyButtonState: 'copying'});

            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = url;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }

            this.setState({copyButtonState: 'copied'});

            // Reset button state after 2 seconds
            setTimeout(() => {
                this.setState({copyButtonState: 'normal'});
            }, 2000);
        } catch (error) {
            // Handle copy failure - silently reset button state
            this.setState({copyButtonState: 'normal'});
        }
    }

    handleSaveToFile () {
        const {vm} = this.props;
        if (!vm) return;

        // Generate the only_blocks parameter
        const url = this.generateOnlyBlocksUrl();
        const urlParams = new URLSearchParams(url.split('?')[1] || '');
        const onlyBlocks = urlParams.get('only_blocks');

        if (!onlyBlocks) return;

        // Get the Stage target
        const stage = vm.runtime.getTargetForStage();
        if (!stage) return;

        const commentText = `only_blocks=${onlyBlocks}`;

        // Check for existing only_blocks comment
        const comments = stage.comments;
        let existingComment = null;

        // Find the first comment containing 'only_blocks='
        for (const commentId in comments) {
            const comment = comments[commentId];
            if (comment.text && comment.text.includes('only_blocks=')) {
                existingComment = comment;
                break;
            }
        }

        if (existingComment) {
            // Update existing comment
            existingComment.text = commentText;
        } else {
            // Create new comment
            const commentId = Blockly.utils.idGenerator.genUid();
            stage.createComment(
                commentId,
                null,
                commentText,
                100,
                100,
                200,
                100,
                false
            );
        }

        vm.emitWorkspaceUpdate();

        // Mark project as changed
        this.props.onSetProjectChanged();
    }

    getCategoryCheckboxState (categoryId) {
        const {selectedBlocks} = this.props;
        const allBlocksInCategory = CATEGORY_BLOCKS[categoryId] || [];
        const selectedBlocksInCategory = selectedBlocks[categoryId] || [];

        if (selectedBlocksInCategory.length === 0) {
            return {checked: false, indeterminate: false};
        }
        if (selectedBlocksInCategory.length === allBlocksInCategory.length) {
            return {checked: true, indeterminate: false};
        }
        return {checked: false, indeterminate: true};
    }

    render () {
        const {
            intl,
            onRequestClose,
            selectedBlocks,
            scratchBlocks
        } = this.props;

        const {selectedCategoryIndex} = this.state;

        return (
            <Modal
                className={styles.modalContent}
                contentLabel={intl.formatMessage(messages.title)}
                headerClassName={styles.header}
                headerImage={blockDisplayIcon}
                id="blockDisplayModal"
                onRequestClose={onRequestClose}
            >
                <Box className={styles.body}>
                    <Box className={styles.topSection}>
                        <Box className={styles.leftPane}>
                            <Box className={styles.categorySection}>
                                <div className={styles.sectionTitle}>
                                    <FormattedMessage
                                        defaultMessage="Categories:"
                                        description="Title for block categories section"
                                        id="gui.smalruby3.blockDisplayModal.categoriesTitle"
                                    />
                                </div>
                                {BLOCK_CATEGORIES.map((category, index) => {
                                    const checkboxState = this.getCategoryCheckboxState(category.id);
                                    return (
                                        <div
                                            key={category.id}
                                            className={classNames(styles.categoryItem, {
                                                [styles.selectedCategory]: selectedCategoryIndex === index
                                            })}
                                            data-category={category.id}
                                        >
                                            <input
                                                type="checkbox"
                                                className={styles.checkbox}
                                                data-category={category.id}
                                                checked={checkboxState.checked}
                                                ref={checkbox => {
                                                    if (checkbox) {
                                                        checkbox.indeterminate = checkboxState.indeterminate;
                                                    }
                                                }}
                                                onChange={this.handleCategoryChange}
                                            />
                                            <span
                                                className={styles.categoryName}
                                                data-category-index={index}
                                                onClick={this.handleCategorySelect}
                                            >
                                                {scratchBlocks && scratchBlocks.Msg &&
                                                    scratchBlocks.Msg[category.messageKey] ?
                                                    scratchBlocks.Msg[category.messageKey] :
                                                    category.messageKey}
                                            </span>
                                        </div>
                                    );
                                })}
                            </Box>

                            <Box className={styles.alwaysVisibleSection}>
                                <div className={styles.sectionTitle}>
                                    <FormattedMessage
                                        defaultMessage="Always Visible:"
                                        description="Title for always visible categories section"
                                        id="gui.smalruby3.blockDisplayModal.alwaysVisibleTitle"
                                    />
                                </div>
                                {ALWAYS_VISIBLE_CATEGORIES.map(category => (
                                    <div
                                        key={category.id}
                                        className={styles.categoryItem}
                                    >
                                        <label className={styles.categoryLabel}>
                                            <input
                                                type="checkbox"
                                                className={styles.checkbox}
                                                checked
                                                disabled
                                            />
                                            <span className={classNames(styles.categoryName, styles.alwaysVisibleText)}>
                                                {category.messageKey ?
                                                    (scratchBlocks && scratchBlocks.Msg &&
                                                        scratchBlocks.Msg[category.messageKey] ?
                                                        scratchBlocks.Msg[category.messageKey] :
                                                        category.messageKey) :
                                                    intl.formatMessage({id: category.messageId})}
                                            </span>
                                        </label>
                                    </div>
                                ))}
                            </Box>
                        </Box>

                        <Box className={styles.rightPane}>
                            <Box
                                className={styles.blockList}
                                componentRef={this.setBlockListRef}
                                onScroll={this.handleBlockListScroll}
                            >
                                {BLOCK_CATEGORIES.map((category, categoryIndex) => {
                                    const categoryBlocks = CATEGORY_BLOCKS[category.id] || [];
                                    return (
                                        <div
                                            key={category.id}
                                            className={styles.categorySection}
                                            data-category-index={categoryIndex}
                                        >
                                            <div className={styles.categoryHeader}>
                                                {scratchBlocks && scratchBlocks.Msg &&
                                                    scratchBlocks.Msg[category.messageKey] ?
                                                    scratchBlocks.Msg[category.messageKey] :
                                                    category.messageKey}
                                            </div>
                                            {categoryBlocks.map(blockType => {
                                                const selectedBlocksInCategory = selectedBlocks[category.id] || [];
                                                const isBlockSelected = selectedBlocksInCategory.includes(blockType);

                                                // Try to get block name from ScratchBlocks.Msg first
                                                // Convert block type to uppercase key format
                                                // (e.g., sensing_online → SENSING_ONLINE)
                                                const scratchBlocksKey = blockType.toUpperCase();
                                                let blockName;

                                                if (scratchBlocks && scratchBlocks.Msg &&
                                                    scratchBlocks.Msg[scratchBlocksKey]) {
                                                    // Use ScratchBlocks translation if available
                                                    blockName = scratchBlocks.Msg[scratchBlocksKey];
                                                } else {
                                                    // Fallback to custom translation
                                                    const messageId = `gui.smalruby3.blockDisplayModal.${blockType}`;
                                                    blockName = intl.formatMessage({
                                                        id: messageId,
                                                        defaultMessage: blockType
                                                    });
                                                }

                                                return (
                                                    <div
                                                        key={blockType}
                                                        className={styles.blockItem}
                                                    >
                                                        <label className={styles.blockLabel}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isBlockSelected}
                                                                className={styles.blockCheckbox}
                                                                data-block={blockType}
                                                                data-category={category.id}
                                                                onChange={this.handleBlockChange}
                                                            />
                                                            <span className={styles.blockName}>
                                                                {blockName}
                                                            </span>
                                                        </label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </Box>
                        </Box>
                    </Box>
                    <Box className={styles.urlPane}>
                        <div className={styles.urlButtonContainer}>
                            <button
                                className={classNames(styles.copyUrlButton, {
                                    [styles.copied]: this.state.copyButtonState === 'copied'
                                })}
                                onClick={this.handleCopyClick}
                                disabled={this.state.copyButtonState === 'copying'}
                                title={this.state.copyButtonState === 'copied' ? 'Copied!' : 'Copy URL'}
                            >
                                <img
                                    className={styles.copyIcon}
                                    src={copyIcon}
                                    alt="Copy"
                                />
                                <span className={styles.buttonLabel}>
                                    <FormattedMessage
                                        defaultMessage="Copy URL"
                                        description="Label for copy URL button"
                                        id="gui.smalruby3.blockDisplayModal.copyUrl"
                                    />
                                </span>
                            </button>
                            <button
                                className={styles.saveToFileButton}
                                onClick={this.handleSaveToFile}
                                title="Save to File"
                            >
                                <img
                                    className={styles.saveIcon}
                                    src={fileIcon}
                                    alt="File"
                                />
                                <span className={styles.buttonLabel}>
                                    <FormattedMessage
                                        defaultMessage="Save to File"
                                        description="Label for save to file button"
                                        id="gui.smalruby3.blockDisplayModal.saveToFile"
                                    />
                                </span>
                            </button>
                        </div>
                    </Box>
                </Box>
            </Modal>
        );
    }
}

BlockDisplayModal.propTypes = {
    intl: intlShape.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    selectedBlocks: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
    scratchBlocks: PropTypes.instanceOf(Object),
    onCategoryChange: PropTypes.func.isRequired,
    onBlockChange: PropTypes.func.isRequired,
    onSetProjectChanged: PropTypes.func.isRequired,
    vm: PropTypes.instanceOf(Object)
};

export default injectIntl(BlockDisplayModal);
