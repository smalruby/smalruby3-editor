import _ from 'lodash';
import {RubyToBlocksConverterError} from './errors';

const Effects = [
    'PITCH',
    'PAN'
];

 
const validateSound = function (converter, soundName, node) {
    // Skip validation if no target context (e.g., in tests)
    if (!converter._context.target || !converter._context.target.getSounds) {
        return;
    }

    const sounds = converter._context.target.getSounds();
    const soundExists = sounds.some(sound => sound.name === soundName);
    if (!soundExists) {
        throw new RubyToBlocksConverterError(
            node,
            `sound "${soundName}" does not exist`
        );
    }
};

/**
 * Sound converter
 */
const SoundConverter = {
    register: function (converter) {
        // play(name) - sound_play
        converter.registerOnSend('self', 'play', 1, params => {
            const {receiver, args, node} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0]) && !converter._isBlock(args[0])) return null;

            if (converter._isString(args[0])) {
                validateSound(converter, args[0].toString(), node);
            }

            const block = converter._createBlock('sound_play', 'statement');
            converter._addFieldInput(block, 'SOUND_MENU', 'sound_sounds_menu', 'SOUND_MENU', args[0], '');
            return block;
        });

        // play_until_done(name) - sound_playuntildone
        converter.registerOnSend('self', 'play_until_done', 1, params => {
            const {receiver, args, node} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0]) && !converter._isBlock(args[0])) return null;

            if (converter._isString(args[0])) {
                validateSound(converter, args[0].toString(), node);
            }

            const block = converter._createBlock('sound_playuntildone', 'statement');
            converter._addFieldInput(block, 'SOUND_MENU', 'sound_sounds_menu', 'SOUND_MENU', args[0], '');
            return block;
        });

        // stop_all_sounds
        converter.registerOnSend('self', 'stop_all_sounds', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('sound_stopallsounds', 'statement');
        });

        // change_sound_effect_by(effect, value)
        converter.registerOnSend('self', 'change_sound_effect_by', 2, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0]) || Effects.indexOf(args[0].toString().toUpperCase()) < 0) return null;
            if (!converter._isNumberOrBlock(args[1])) return null;

            const block = converter._createBlock('sound_changeeffectby', 'statement');
            converter._addField(block, 'EFFECT', args[0].toString().toUpperCase());
            converter._addNumberInput(block, 'VALUE', 'math_number', args[1], 10);
            return block;
        });

        // set_sound_effect(effect, value)
        converter.registerOnSend('self', 'set_sound_effect', 2, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isString(args[0]) || Effects.indexOf(args[0].toString().toUpperCase()) < 0) return null;
            if (!converter._isNumberOrBlock(args[1])) return null;

            const block = converter._createBlock('sound_seteffectto', 'statement');
            converter._addField(block, 'EFFECT', args[0].toString().toUpperCase());
            converter._addNumberInput(block, 'VALUE', 'math_number', args[1], 100);
            return block;
        });

        // clear_sound_effects
        converter.registerOnSend('self', 'clear_sound_effects', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('sound_cleareffects', 'statement');
        });

        // volume = value
        converter.registerOnSend('self', 'volume=', 1, params => {
            const {receiver, args} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;
            if (!converter._isNumberOrBlock(args[0])) return null;

            const block = converter._createBlock('sound_setvolumeto', 'statement');
            converter._addNumberInput(block, 'VOLUME', 'math_number', args[0], 100);
            return block;
        });

        // volume getter
        converter.registerOnSend('self', 'volume', 0, params => {
            const {receiver} = params;
            if (!converter._isSelf(receiver) && receiver !== null) return null;

            return converter._createBlock('sound_volume', 'value');
        });

        // Register onXxx handlers
        converter.registerOnOpAsgn((lh, operator, rh) => {
            let block;
            if (converter._isBlock(lh) && operator === '+' && converter._isNumberOrBlock(rh)) {
                if (lh.opcode === 'sound_volume') {
                    block = converter._changeBlock(lh, 'sound_changevolumeby', 'statement');
                    converter._addNumberInput(block, 'VOLUME', 'math_number', rh, -10);
                }
            }
            return block;
        });
    }
};

export default SoundConverter;
