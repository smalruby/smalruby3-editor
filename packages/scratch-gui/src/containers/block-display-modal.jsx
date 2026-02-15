import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {
    setSelectedBlocks,
    closeBlockDisplayModal
} from '../reducers/block-display.js';
import {setProjectChanged} from '../reducers/project-changed.js';
import {CATEGORY_BLOCKS} from '../lib/block-utils';

import BlockDisplayModalComponent from '../components/block-display-modal/block-display-modal.jsx';

class BlockDisplayModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleCategoryToggle',
            'handleBlockChange',
            'handleSelectAll',
            'handleSelectNone',
            'handleClose'
        ]);
    }

    handleCategoryToggle (categoryId, isSelected) {
        console.log('[DEBUG] handleCategoryToggle called', {categoryId, isSelected});
        console.log('[DEBUG] Current selectedBlocks:', this.props.selectedBlocks);
        console.log('[DEBUG] CATEGORY_BLOCKS keys:', Object.keys(CATEGORY_BLOCKS));
        console.log('[DEBUG] CATEGORY_BLOCKS[categoryId]:', CATEGORY_BLOCKS[categoryId]);

        const currentBlocks = {...this.props.selectedBlocks};

        if (isSelected) {
            // Select all blocks in this category
            currentBlocks[categoryId] = [...CATEGORY_BLOCKS[categoryId]];
        } else {
            // Deselect all blocks in this category
            currentBlocks[categoryId] = [];
        }

        console.log('[DEBUG] New selectedBlocks:', currentBlocks);
        this.props.onSetSelectedBlocks(currentBlocks);
        this.props.onSetProjectChanged();
    }

    handleBlockChange (categoryId, blockId, isSelected) {
        console.log('[DEBUG] handleBlockChange called', {categoryId, blockId, isSelected});
        console.log('[DEBUG] Current selectedBlocks:', this.props.selectedBlocks);
        console.log('[DEBUG] Current selectedBlocks[categoryId]:', this.props.selectedBlocks[categoryId]);

        const currentBlocks = {...this.props.selectedBlocks};

        // Update the specific block
        if (!currentBlocks[categoryId]) {
            currentBlocks[categoryId] = [];
        }

        if (isSelected && !currentBlocks[categoryId].includes(blockId)) {
            currentBlocks[categoryId].push(blockId);
        } else if (!isSelected && currentBlocks[categoryId].includes(blockId)) {
            const index = currentBlocks[categoryId].indexOf(blockId);
            currentBlocks[categoryId].splice(index, 1);
        }

        console.log('[DEBUG] New selectedBlocks:', currentBlocks);
        this.props.onSetSelectedBlocks(currentBlocks);
        this.props.onSetProjectChanged();
    }

    handleSelectAll () {
        this.props.onSetSelectedBlocks(CATEGORY_BLOCKS);
        this.props.onSetProjectChanged();
    }

    handleSelectNone () {
        const emptyBlocks = {
            motion: [],
            looks: [],
            sound: [],
            event: [],
            control: [],
            sensing: [],
            operators: []
        };
        this.props.onSetSelectedBlocks(emptyBlocks);
        this.props.onSetProjectChanged();
    }

    handleClose () {
        this.props.onRequestClose();
    }

    render () {
        return (
            <BlockDisplayModalComponent
                selectedBlocks={this.props.selectedBlocks}
                onCategoryChange={this.handleCategoryToggle}
                onBlockChange={this.handleBlockChange}
                onSelectAll={this.handleSelectAll}
                onSelectNone={this.handleSelectNone}
                onRequestClose={this.handleClose}
                {...this.props}
            />
        );
    }
}

BlockDisplayModal.propTypes = {
    selectedBlocks: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.string)),
    scratchBlocks: PropTypes.instanceOf(Object),
    onSetSelectedBlocks: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func.isRequired,
    onSetProjectChanged: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    selectedBlocks: state.scratchGui.blockDisplay.selectedBlocks,
    scratchBlocks: state.scratchGui.blockDisplay.scratchBlocks,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onSetSelectedBlocks: blocks => dispatch(setSelectedBlocks(blocks)),
    onRequestClose: () => dispatch(closeBlockDisplayModal()),
    onSetProjectChanged: () => dispatch(setProjectChanged())
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(BlockDisplayModal);
