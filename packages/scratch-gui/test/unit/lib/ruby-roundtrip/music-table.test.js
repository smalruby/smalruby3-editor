/**
 * Music blocks ⇔ Ruby, as a table (block notation: test/unit/helpers/block-notation.js).
 * It fixes the output of the converter before the calls of music move into a send table
 * (issue #2090); ruby-roundtrip/extension_music.test.js stays as the long round trip.
 */
import { defineBlockRubyTable } from '../../helpers/block-ruby-table';

const drum = (value) => `music_menu_DRUM(DRUM = "${value}")`;
const instrument = (value) => `music_menu_INSTRUMENT(INSTRUMENT = "${value}")`;
const note = (value) => `shadow note(NOTE = "${value}")`;

defineBlockRubyTable('Music blocks ⇔ Ruby (v2)', [
    {
        blocks: `music_playDrumForBeats(DRUM: ${drum(1)}, BEATS: 0.25)`,
        ruby: 'music.play_drum(drum: 1, beats: 0.25)',
    },
    {
        blocks: 'music_playDrumForBeats(DRUM: $d, BEATS: $b)',
        ruby: 'music.play_drum(drum: $d, beats: $b)',
    },
    { blocks: 'music_restForBeats(BEATS: 0.25)', ruby: 'music.rest(0.25)' },
    { blocks: 'music_restForBeats(BEATS: $b)', ruby: 'music.rest($b)' },
    {
        blocks: `music_playNoteForBeats(NOTE: ${note(60)}, BEATS: 0.25)`,
        ruby: 'music.play_note(note: 60, beats: 0.25)',
    },
    {
        blocks: 'music_playNoteForBeats(NOTE: $n, BEATS: 0.5)',
        ruby: 'music.play_note(note: $n, beats: 0.5)',
    },
    { blocks: `music_setInstrument(INSTRUMENT: ${instrument(1)})`, ruby: 'music.instrument = 1' },
    { blocks: 'music_setInstrument(INSTRUMENT: $i)', ruby: 'music.instrument = $i' },
    { blocks: 'music_setTempo(TEMPO: 60)', ruby: 'music.tempo = 60' },
    { blocks: 'music_setTempo(TEMPO: $t)', ruby: 'music.tempo = $t' },
    { blocks: 'music_changeTempo(TEMPO: 20)', ruby: 'music.tempo += 20' },
    { blocks: 'music_changeTempo(TEMPO: $t)', ruby: 'music.tempo += $t' },
    { blocks: 'music_getTempo', ruby: 'music.tempo' },
    { blocks: 'looks_say(MESSAGE: music_getTempo)', ruby: 'say(music.tempo)' },
]);

defineBlockRubyTable(
    'Music blocks ⇔ Ruby (v2, stage)',
    [
        { blocks: 'music_restForBeats(BEATS: 0.25)', ruby: 'music.rest(0.25)' },
        { blocks: 'music_getTempo', ruby: 'music.tempo' },
    ],
    { stage: true },
);

defineBlockRubyTable(
    'Music blocks ⇔ Ruby (v1)',
    [
        {
            blocks: `music_playDrumForBeats(DRUM: ${drum(1)}, BEATS: 0.25)`,
            ruby: 'play_drum(drum: 1, beats: 0.25)',
        },
        {
            blocks: 'music_playDrumForBeats(DRUM: $d, BEATS: $b)',
            ruby: 'play_drum(drum: $d, beats: $b)',
        },
        { blocks: 'music_restForBeats(BEATS: 0.25)', ruby: 'rest(0.25)' },
        {
            blocks: `music_playNoteForBeats(NOTE: ${note(60)}, BEATS: 0.25)`,
            ruby: 'play_note(note: 60, beats: 0.25)',
        },
        { blocks: `music_setInstrument(INSTRUMENT: ${instrument(1)})`, ruby: 'self.instrument = 1' },
        { blocks: 'music_setTempo(TEMPO: 60)', ruby: 'self.tempo = 60' },
        { blocks: 'music_changeTempo(TEMPO: 20)', ruby: 'self.tempo += 20' },
        { blocks: 'music_getTempo', ruby: 'tempo' },
    ],
    { version: '1' },
);
