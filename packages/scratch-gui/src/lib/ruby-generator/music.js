/**
 * Define Ruby code generator for Music Blocks
 * @param {RubyGenerator} Generator The RubyGenerator
 * @returns {RubyGenerator} same as param.
 */
export default function (Generator) {
    const isV2 = () => String(Generator.version) === '2';
    const prefix = () => (isV2() ? 'music.' : '');
    const selfOrMusic = () => (isV2() ? 'music' : 'self');

    Generator.music_playDrumForBeats = function (block) {
        const drum = Generator.valueToCode(block, 'DRUM', Generator.ORDER_NONE) || null;
        const beats = Generator.valueToCode(block, 'BEATS', Generator.ORDER_NONE) || 0;
        return `${prefix()}play_drum(drum: ${drum}, beats: ${beats})\n`;
    };

    Generator.music_menu_DRUM = function (block) {
        const drum = Generator.getFieldValue(block, 'DRUM') || 1;
        return [drum, Generator.ORDER_ATOMIC];
    };

    Generator.music_restForBeats = function (block) {
        const beats = Generator.valueToCode(block, 'BEATS', Generator.ORDER_NONE) || 0;
        return `${prefix()}rest(${beats})\n`;
    };

    Generator.music_playNoteForBeats = function (block) {
        const note = Generator.valueToCode(block, 'NOTE', Generator.ORDER_NONE) || 0;
        const beats = Generator.valueToCode(block, 'BEATS', Generator.ORDER_NONE) || 0;
        return `${prefix()}play_note(note: ${note}, beats: ${beats})\n`;
    };

    Generator.note = function (block) {
        const note = Generator.getFieldValue(block, 'NOTE') || 0;
        return [note, Generator.ORDER_ATOMIC];
    };

    Generator.music_setInstrument = function (block) {
        const instrument = Generator.valueToCode(block, 'INSTRUMENT', Generator.ORDER_NONE) || null;
        return `${selfOrMusic()}.instrument = ${instrument}\n`;
    };

    Generator.music_menu_INSTRUMENT = function (block) {
        const instrument = Generator.getFieldValue(block, 'INSTRUMENT') || 1;
        return [instrument, Generator.ORDER_ATOMIC];
    };

    Generator.music_setTempo = function (block) {
        const tempo = Generator.valueToCode(block, 'TEMPO', Generator.ORDER_NONE) || 0;
        return `${selfOrMusic()}.tempo = ${tempo}\n`;
    };

    Generator.music_changeTempo = function (block) {
        const tempo = Generator.valueToCode(block, 'TEMPO', Generator.ORDER_NONE) || 0;
        return `${selfOrMusic()}.tempo += ${tempo}\n`;
    };

    Generator.music_getTempo = function () {
        if (isV2()) {
            return ['music.tempo', Generator.ORDER_FUNCTION_CALL];
        }
        return ['tempo', Generator.ORDER_ATOMIC];
    };

    return Generator;
}
