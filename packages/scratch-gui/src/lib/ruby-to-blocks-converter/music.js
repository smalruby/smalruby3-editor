import { menuArg, noteArg, numberArg, registerSendTable } from './send-table';

const Music = 'music';

const drumArg = () => menuArg('DRUM', 'music_menu_DRUM', 'DRUM', { number: true });
const instrumentArg = () => menuArg('INSTRUMENT', 'music_menu_INSTRUMENT', 'INSTRUMENT', { number: true });

/**
 * The calls of music that map one to one onto a block (see `send-table.js`): the v1 form
 * (`play_drum(drum: 1, beats: 0.25)`) and the v2 form on the Ruby expression `music`
 * (`music.play_drum(...)`). `music` itself and `music.tempo += 20` are handlers below.
 */
const MUSIC_SENDS = [
    {
        receiver: 'self',
        name: 'play_drum',
        opcode: 'music_playDrumForBeats',
        keywords: [
            ['drum', drumArg()],
            ['beats', numberArg('BEATS', 0.25)],
        ],
    },
    {
        receiver: Music,
        name: 'play_drum',
        opcode: 'music_playDrumForBeats',
        changesReceiver: true,
        keywords: [
            ['drum', drumArg()],
            ['beats', numberArg('BEATS', 0.25)],
        ],
    },
    { receiver: 'self', name: 'rest', opcode: 'music_restForBeats', args: [numberArg('BEATS', 0.25)] },
    {
        receiver: Music,
        name: 'rest',
        opcode: 'music_restForBeats',
        changesReceiver: true,
        args: [numberArg('BEATS', 0.25)],
    },
    {
        receiver: 'self',
        name: 'play_note',
        opcode: 'music_playNoteForBeats',
        keywords: [
            ['note', noteArg('NOTE', 60)],
            ['beats', numberArg('BEATS', 0.25)],
        ],
    },
    {
        receiver: Music,
        name: 'play_note',
        opcode: 'music_playNoteForBeats',
        changesReceiver: true,
        keywords: [
            ['note', noteArg('NOTE', 60)],
            ['beats', numberArg('BEATS', 0.25)],
        ],
    },
    { receiver: 'self', name: 'instrument=', opcode: 'music_setInstrument', args: [instrumentArg()] },
    {
        receiver: Music,
        name: 'instrument=',
        opcode: 'music_setInstrument',
        changesReceiver: true,
        args: [instrumentArg()],
    },
    { receiver: 'self', name: 'tempo=', opcode: 'music_setTempo', args: [numberArg('TEMPO', 60)] },
    {
        receiver: Music,
        name: 'tempo=',
        opcode: 'music_setTempo',
        changesReceiver: true,
        args: [numberArg('TEMPO', 60)],
    },
    { receiver: 'self', name: 'tempo', opcode: 'music_getTempo', type: 'value' },
    // music.tempo, also the left side of music.tempo += 20
    { receiver: Music, name: 'tempo', opcode: 'music_getTempo', type: 'value', changesReceiver: true },
];

/**
 * Music converter
 */
const MusicConverter = {
    sends: MUSIC_SENDS,

    register: function (converter) {
        registerSendTable(converter, MUSIC_SENDS);

        // v2: music receiver (for music.xxx pattern)
        converter.registerOnSend('sprite', Music, 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock(Music, node);
        });
        converter.registerOnSend('stage', Music, 0, (params) => {
            const { node } = params;
            return converter.createRubyExpressionBlock(Music, node);
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
    },
};

export default MusicConverter;
