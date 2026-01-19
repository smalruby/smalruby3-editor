import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';

import {
    setSelectedBlocks,
    closeBlockDisplayModal
} from '../reducers/block-display.js';
import {setProjectChanged} from '../reducers/project-changed.js';

import BlockDisplayModalComponent from '../components/block-display-modal/block-display-modal.jsx';

// Define block categories with their IDs and blocks
const CATEGORY_BLOCKS = {
    motion: [
        'motion_movesteps', 'motion_turnright', 'motion_turnleft', 'motion_goto', 'motion_gotoxy',
        'motion_glideto', 'motion_glidesecstoxy', 'motion_pointindirection', 'motion_pointtowards',
        'motion_changexby', 'motion_setx', 'motion_changeyby', 'motion_sety', 'motion_ifonedgebounce',
        'motion_setrotationstyle'
    ],
    looks: [
        'looks_sayforsecs', 'looks_say', 'looks_thinkforsecs', 'looks_think', 'looks_switchbackdropto',
        'looks_switchbackdroptoandwait', 'looks_nextbackdrop', 'looks_switchcostumeto',
        'looks_nextcostume', 'looks_changesizeby', 'looks_setsizeto', 'looks_changeeffectby',
        'looks_seteffectto', 'looks_cleargraphiceffects', 'looks_show', 'looks_hide',
        'looks_gotofrontback', 'looks_goforwardbackwardlayers', 'looks_costumenumbername',
        'looks_backdropnumbername', 'looks_size'
    ],
    sound: [
        'sound_playuntildone', 'sound_play', 'sound_stopallsounds', 'sound_changeeffectby',
        'sound_seteffectto', 'sound_cleareffects', 'sound_changevolumeby', 'sound_setvolumeto'
    ],
    events: [
        'event_whenflagclicked', 'event_whenkeypressed', 'event_whenthisspriteclicked',
        'event_whenbackdropswitchesto', 'event_whengreaterthan', 'event_whenbroadcastreceived',
        'event_broadcast', 'event_broadcastandwait'
    ],
    control: [
        'control_wait', 'control_repeat', 'control_forever', 'control_if', 'control_if_else',
        'control_wait_until', 'control_repeat_until', 'control_stop', 'control_start_as_clone',
        'control_create_clone_of', 'control_delete_this_clone'
    ],
    sensing: [
        'sensing_touchingobject', 'sensing_touchingcolor', 'sensing_coloristouchingcolor',
        'sensing_distanceto', 'sensing_askandwait', 'sensing_answer', 'sensing_keypressed',
        'sensing_mousedown', 'sensing_mousex', 'sensing_mousey', 'sensing_setdragmode',
        'sensing_loudness', 'sensing_timer', 'sensing_resettimer', 'sensing_of',
        'sensing_current', 'sensing_dayssince2000', 'sensing_username'
    ],
    operators: [
        'operator_add', 'operator_subtract', 'operator_multiply', 'operator_divide',
        'operator_random', 'operator_gt', 'operator_lt', 'operator_equals', 'operator_and',
        'operator_or', 'operator_not', 'operator_join', 'operator_letter_of',
        'operator_length', 'operator_contains', 'operator_mod', 'operator_round',
        'operator_mathop'
    ]
};

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
        const currentBlocks = {...this.props.selectedBlocks};

        if (isSelected) {
            // Select all blocks in this category
            currentBlocks[categoryId] = [...CATEGORY_BLOCKS[categoryId]];
        } else {
            // Deselect all blocks in this category
            currentBlocks[categoryId] = [];
        }

        this.props.onSetSelectedBlocks(currentBlocks);
    }

    handleBlockChange (categoryId, blockId, isSelected) {
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

        this.props.onSetSelectedBlocks(currentBlocks);
    }

    handleSelectAll () {
        this.props.onSetSelectedBlocks(CATEGORY_BLOCKS);
    }

    handleSelectNone () {
        const emptyBlocks = {
            motion: [],
            looks: [],
            sound: [],
            events: [],
            control: [],
            sensing: [],
            operators: []
        };
        this.props.onSetSelectedBlocks(emptyBlocks);
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
    selectedBlocks: PropTypes.object,
    scratchBlocks: PropTypes.object,
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
