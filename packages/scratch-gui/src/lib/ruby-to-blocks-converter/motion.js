import _ from 'lodash';
import { defineMessages } from 'react-intl';
import { RubyToBlocksConverterError } from './errors';
import { fieldArg, menuArg, numberArg, registerSendTable } from './send-table';

const messages = defineMessages({
    stageNoMotionBlocks: {
        defaultMessage: 'Stage selected: no motion blocks.\nSelect a sprite to use motion blocks.',
        description: 'Error message when trying to use motion blocks on the Stage',
        id: 'gui.smalruby3.rubyToBlocksConverter.stageNoMotionBlocks',
    },
});

const RotationStyle = ['left-right', "don't rotate", 'all around'];

/**
 * The calls of motion that map one to one onto a block (see `send-table.js`).
 * `go_to`, `glide` and `self.x += 1` (a choice of block by the argument) are handlers below.
 */
const MOTION_SENDS = [
    { receiver: 'sprite', name: 'move', opcode: 'motion_movesteps', args: [numberArg('STEPS', 10)] },
    { receiver: 'sprite', name: 'turn_right', opcode: 'motion_turnright', args: [numberArg('DEGREES', 15)] },
    { receiver: 'sprite', name: 'turn_left', opcode: 'motion_turnleft', args: [numberArg('DEGREES', 15)] },
    {
        receiver: 'sprite',
        name: 'direction=',
        opcode: 'motion_pointindirection',
        args: [numberArg('DIRECTION', 90, 'math_angle')],
    },
    {
        receiver: 'sprite',
        name: 'point_towards',
        opcode: 'motion_pointtowards',
        args: [menuArg('TOWARDS', 'motion_pointtowards_menu')],
    },
    { receiver: 'sprite', name: 'bounce_if_on_edge', opcode: 'motion_ifonedgebounce' },
    {
        receiver: 'sprite',
        name: 'rotation_style=',
        opcode: 'motion_setrotationstyle',
        args: [fieldArg('STYLE', RotationStyle)],
    },
    { receiver: 'sprite', name: 'x=', opcode: 'motion_setx', args: [numberArg('X', 0)] },
    { receiver: 'sprite', name: 'y=', opcode: 'motion_sety', args: [numberArg('Y', 0)] },
    { receiver: 'sprite', name: 'x', opcode: 'motion_xposition', type: 'value' },
    { receiver: 'sprite', name: 'y', opcode: 'motion_yposition', type: 'value' },
    { receiver: 'sprite', name: 'direction', opcode: 'motion_direction', type: 'value' },
];

/**
 * Motion converter
 */
const MotionConverter = {
    sends: MOTION_SENDS,

    register: function (converter) {
        registerSendTable(converter, MOTION_SENDS);

        // go_to(target)
        converter.registerOnSend('sprite', 'go_to', 1, (params) => {
            const { args } = params;
            if (converter._isString(args[0])) {
                const block = converter._createBlock('motion_goto', 'statement');
                converter._addInput(block, 'TO', converter._createFieldBlock('motion_goto_menu', 'TO', args[0]));
                return block;
            } else if (
                converter._isArray(args[0]) &&
                args[0].length === 2 &&
                converter._isNumberOrBlock(args[0].value[0]) &&
                converter._isNumberOrBlock(args[0].value[1])
            ) {
                const block = converter._createBlock('motion_gotoxy', 'statement');
                converter._addNumberInput(block, 'X', 'math_number', args[0].value[0], 0);
                converter._addNumberInput(block, 'Y', 'math_number', args[0].value[1], 0);
                return block;
            }
            return null;
        });

        // glide(target, secs: duration)
        converter.registerOnSend('sprite', 'glide', 2, (params) => {
            const { args } = params;
            if (args.length !== 2 || !converter._isHash(args[1]) || args[1].size !== 1) return null;

            const secs = args[1].get('sym:secs');
            if (!converter._isNumberOrBlock(secs)) return null;

            let block;
            if (converter._isString(args[0])) {
                block = converter._createBlock('motion_glideto', 'statement');
                converter._addInput(block, 'TO', converter._createFieldBlock('motion_glideto_menu', 'TO', args[0]));
            } else if (
                converter._isArray(args[0]) &&
                args[0].length === 2 &&
                converter._isNumberOrBlock(args[0].value[0]) &&
                converter._isNumberOrBlock(args[0].value[1])
            ) {
                block = converter._createBlock('motion_glidesecstoxy', 'statement');
                converter._addNumberInput(block, 'X', 'math_number', args[0].value[0], 0);
                converter._addNumberInput(block, 'Y', 'math_number', args[0].value[1], 0);
            } else {
                return null;
            }

            if (block) {
                converter._addNumberInput(block, 'SECS', 'math_number', secs, 1);
            }
            return block;
        });

        // Register onXxx handlers
        converter.registerOnOpAsgn((lh, operator, rh) => {
            let block;
            if (converter._isBlock(lh) && (operator === '+' || operator === '-') && converter._isNumberOrBlock(rh)) {
                let xy;
                switch (lh.opcode) {
                    case 'motion_xposition':
                    case 'motion_yposition':
                        // All Motion blocks are sprite-only
                        if (converter._isStage()) {
                            throw new RubyToBlocksConverterError(
                                lh.node,
                                converter._translator(messages.stageNoMotionBlocks),
                            );
                        }
                        xy = lh.opcode === 'motion_xposition' ? 'x' : 'y';
                        block = converter._changeBlock(lh, `motion_change${xy}by`, 'statement');
                        if (operator === '-') {
                            let negatedRh;
                            if (converter._isNumber(rh)) {
                                negatedRh = -Number(rh.toString());
                            } else {
                                const subtractBlock = converter._createBlock('operator_subtract', 'value');
                                converter._addNumberInput(subtractBlock, 'NUM1', 'math_number', 0, '');
                                converter._addNumberInput(subtractBlock, 'NUM2', 'math_number', rh, '');
                                negatedRh = subtractBlock;
                            }
                            converter._addNumberInput(block, `D${_.toUpper(xy)}`, 'math_number', negatedRh, 10);
                        } else {
                            converter._addNumberInput(block, `D${_.toUpper(xy)}`, 'math_number', rh, 10);
                        }
                        break;
                    case 'motion_direction':
                        // All Motion blocks are sprite-only
                        if (converter._isStage()) {
                            throw new RubyToBlocksConverterError(
                                lh.node,
                                converter._translator(messages.stageNoMotionBlocks),
                            );
                        }
                        if (operator === '+') {
                            block = converter._changeBlock(lh, 'motion_turnright', 'statement');
                            converter._addNumberInput(block, 'DEGREES', 'math_number', rh, 15);
                            block.comment = converter._createComment('@ruby:operator:+=', block.id);
                        } else {
                            block = converter._changeBlock(lh, 'motion_turnleft', 'statement');
                            converter._addNumberInput(block, 'DEGREES', 'math_number', rh, 15);
                            block.comment = converter._createComment('@ruby:operator:-=', block.id);
                        }
                        break;
                }
            }
            return block;
        });
    },
};

export default MotionConverter;
