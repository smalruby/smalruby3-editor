import _ from 'lodash';

const Music = 'music';

/**
 * Music converter
 */
const MusicConverter = {
    register: function (converter) {
        // v1: play_drum(drum: 1, beats: 0.25)
        converter.registerOnSend('self', 'play_drum', 1, params => {
            const {args} = params;
            if (!converter._isHash(args[0]) || args[0].size !== 2) return null;

            const drum = args[0].get('sym:drum');
            const beats = args[0].get('sym:beats');
            if (!converter.isNumberOrBlock(drum) || !converter.isNumberOrBlock(beats)) return null;

            const block = converter.createBlock('music_playDrumForBeats', 'statement');
            converter.addInput(
                block,
                'DRUM',
                converter._createFieldBlock('music_menu_DRUM', 'DRUM', drum)
            );
            converter.addNumberInput(block, 'BEATS', 'math_number', beats, 0.25);
            return block;
        });

        // v2: music.play_drum(drum: 1, beats: 0.25)
        converter.registerOnSend(Music, 'play_drum', 1, params => {
            const {receiver, args} = params;
            if (!converter._isHash(args[0]) || args[0].size !== 2) return null;

            const drum = args[0].get('sym:drum');
            const beats = args[0].get('sym:beats');
            if (!converter.isNumberOrBlock(drum) || !converter.isNumberOrBlock(beats)) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'music_playDrumForBeats', 'statement');
            converter.addInput(
                block,
                'DRUM',
                converter._createFieldBlock('music_menu_DRUM', 'DRUM', drum)
            );
            converter.addNumberInput(block, 'BEATS', 'math_number', beats, 0.25);
            return block;
        });

        // v1: rest(0.25)
        converter.registerOnSend('self', 'rest', 1, params => {
            const {args} = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.createBlock('music_restForBeats', 'statement');
            converter.addNumberInput(block, 'BEATS', 'math_number', args[0], 0.25);
            return block;
        });

        // v2: music.rest(0.25)
        converter.registerOnSend(Music, 'rest', 1, params => {
            const {receiver, args} = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'music_restForBeats', 'statement');
            converter.addNumberInput(block, 'BEATS', 'math_number', args[0], 0.25);
            return block;
        });

        // v1: play_note(note: 60, beats: 0.25)
        converter.registerOnSend('self', 'play_note', 1, params => {
            const {args} = params;
            if (!converter._isHash(args[0]) || args[0].size !== 2) return null;

            const note = args[0].get('sym:note');
            const beats = args[0].get('sym:beats');
            if (!converter.isNumberOrBlock(note) || !converter.isNumberOrBlock(beats)) return null;

            const block = converter.createBlock('music_playNoteForBeats', 'statement');
            converter._addNoteInput(block, 'NOTE', note, 60);
            converter.addNumberInput(block, 'BEATS', 'math_number', beats, 0.25);
            return block;
        });

        // v2: music.play_note(note: 60, beats: 0.25)
        converter.registerOnSend(Music, 'play_note', 1, params => {
            const {receiver, args} = params;
            if (!converter._isHash(args[0]) || args[0].size !== 2) return null;

            const note = args[0].get('sym:note');
            const beats = args[0].get('sym:beats');
            if (!converter.isNumberOrBlock(note) || !converter.isNumberOrBlock(beats)) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'music_playNoteForBeats', 'statement');
            converter._addNoteInput(block, 'NOTE', note, 60);
            converter.addNumberInput(block, 'BEATS', 'math_number', beats, 0.25);
            return block;
        });

        // v1: self.instrument = 5
        converter.registerOnSend('self', 'instrument=', 1, params => {
            const {args} = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.createBlock('music_setInstrument', 'statement');
            converter.addInput(
                block,
                'INSTRUMENT',
                converter._createFieldBlock('music_menu_INSTRUMENT', 'INSTRUMENT', args[0])
            );
            return block;
        });

        // v2: music.instrument = 5
        converter.registerOnSend(Music, 'instrument=', 1, params => {
            const {receiver, args} = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'music_setInstrument', 'statement');
            converter.addInput(
                block,
                'INSTRUMENT',
                converter._createFieldBlock('music_menu_INSTRUMENT', 'INSTRUMENT', args[0])
            );
            return block;
        });

        // v1: self.tempo = 60
        converter.registerOnSend('self', 'tempo=', 1, params => {
            const {args} = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.createBlock('music_setTempo', 'statement');
            converter.addNumberInput(block, 'TEMPO', 'math_number', args[0], 60);
            return block;
        });

        // v2: music.tempo = 60
        converter.registerOnSend(Music, 'tempo=', 1, params => {
            const {receiver, args} = params;
            if (!converter.isNumberOrBlock(args[0])) return null;

            const block = converter.changeRubyExpressionBlock(receiver, 'music_setTempo', 'statement');
            converter.addNumberInput(block, 'TEMPO', 'math_number', args[0], 60);
            return block;
        });

        // v1: tempo (getter)
        converter.registerOnSend('self', 'tempo', 0, () =>
            converter.createBlock('music_getTempo', 'value')
        );

        // v2: music receiver (for music.xxx pattern)
        converter.registerOnSend('sprite', Music, 0, params => {
            const {node} = params;
            return converter.createRubyExpressionBlock(Music, node);
        });
        converter.registerOnSend('stage', Music, 0, params => {
            const {node} = params;
            return converter.createRubyExpressionBlock(Music, node);
        });

        // v2: music.tempo (getter for value and +=)
        converter.registerOnSend(Music, 'tempo', 0, params => {
            const {receiver} = params;
            return converter.changeRubyExpressionBlock(receiver, 'music_getTempo', 'value');
        });

        // v1: self.tempo += 20, v2: music.tempo += 20
        // Both resolve to music_getTempo block, so a single handler works
        converter.registerOnOpAsgn((lh, operator, rh) => {
            if (converter._isBlock(lh) && operator === '+' && converter._isNumberOrBlock(rh)) {
                if (lh.opcode === 'music_getTempo') {
                    const block = converter._changeBlock(lh, 'music_changeTempo', 'statement');
                    converter._addNumberInput(block, 'TEMPO', 'math_number', rh, 20);
                    return block;
                }
            }
            return null;
        });
    }
};

export default MusicConverter;
