import _ from 'lodash';
import { defineMessages } from 'react-intl';
import { RubyToBlocksConverterError } from './errors';
import { fieldArg, menuInputArg, numberArg, onSelf, registerSendTable } from './send-table';

const messages = defineMessages({
    soundDoesNotExist: {
        defaultMessage: 'sound "{NAME}" does not exist.\nCheck the name or add the sound first.',
        description: 'Error message when playing a sound that does not exist',
        id: 'gui.smalruby3.rubyToBlocksConverter.soundDoesNotExist',
    },
});

const Effects = ['PITCH', 'PAN'];

const validateSound = function (converter, soundName, node) {
    // Skip validation if no target context (e.g., in tests) or when the converter was told not to
    if (converter.validateAssets === false) return;
    if (!converter._context.target || !converter._context.target.getSounds) {
        return;
    }

    const sounds = converter._context.target.getSounds();
    const soundExists = sounds.some((sound) => sound.name === soundName);
    if (!soundExists) {
        throw new RubyToBlocksConverterError(
            node,
            converter._translator(messages.soundDoesNotExist, { NAME: soundName }),
        );
    }
};

const upcase = (value) => value.toUpperCase();

const soundArg = menuInputArg('SOUND_MENU', 'sound_sounds_menu', 'SOUND_MENU', '', {
    validate: (converter, arg, { node }) => {
        if (converter._isString(arg)) validateSound(converter, arg.toString(), node);
    },
});

/**
 * The calls of sound that map one to one onto a block (see `send-table.js`). They take only
 * `self.xxx` or `xxx`. `self.volume += 1` is a handler below.
 */
const SOUND_SENDS = onSelf([
    { receiver: 'self', name: 'play', opcode: 'sound_play', args: [soundArg] },
    { receiver: 'self', name: 'play_until_done', opcode: 'sound_playuntildone', args: [soundArg] },
    { receiver: 'self', name: 'stop_all_sounds', opcode: 'sound_stopallsounds' },
    {
        receiver: 'self',
        name: 'change_sound_effect_by',
        opcode: 'sound_changeeffectby',
        args: [fieldArg('EFFECT', Effects, { normalize: upcase }), numberArg('VALUE', 10)],
    },
    {
        receiver: 'self',
        name: 'set_sound_effect',
        opcode: 'sound_seteffectto',
        args: [fieldArg('EFFECT', Effects, { normalize: upcase }), numberArg('VALUE', 100)],
    },
    { receiver: 'self', name: 'clear_sound_effects', opcode: 'sound_cleareffects' },
    { receiver: 'self', name: 'volume=', opcode: 'sound_setvolumeto', args: [numberArg('VOLUME', 100)] },
    { receiver: 'self', name: 'volume', opcode: 'sound_volume', type: 'value' },
]);

/**
 * Sound converter
 */
const SoundConverter = {
    sends: SOUND_SENDS,

    register: function (converter) {
        registerSendTable(converter, SOUND_SENDS);

        // Register onXxx handlers
        converter.registerOnOpAsgn((lh, operator, rh) => {
            let block;
            if (converter._isBlock(lh) && (operator === '+' || operator === '-') && converter._isNumberOrBlock(rh)) {
                if (lh.opcode === 'sound_volume') {
                    block = converter._changeBlock(lh, 'sound_changevolumeby', 'statement');
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
                        converter._addNumberInput(block, 'VOLUME', 'math_number', negatedRh, -10);
                    } else {
                        converter._addNumberInput(block, 'VOLUME', 'math_number', rh, -10);
                    }
                }
            }
            return block;
        });
    },
};

export default SoundConverter;
