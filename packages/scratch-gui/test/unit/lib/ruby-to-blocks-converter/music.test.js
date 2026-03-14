import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import {
    convertAndExpectToEqualBlocks,
    convertAndExpectRubyBlockError,
    expectedInfo
} from '../../../helpers/expect-to-equal-blocks';

describe('RubyToBlocksConverter/Music', () => {
    let converter;
    let target;
    let code;
    let expected;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
        code = null;
        expected = null;
    });

    test('music_playDrumForBeats', async () => {
        code = 'play_drum(drum: 1, beats: 0.25)';
        expected = [
            {
                opcode: 'music_playDrumForBeats',
                inputs: [
                    {
                        name: 'DRUM',
                        block: {opcode: 'music_menu_DRUM', fields: [{name: 'DRUM', value: '1'}], shadow: true}
                    },
                    {
                        name: 'BEATS',
                        block: expectedInfo.makeNumber(0.25)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('music_restForBeats', async () => {
        code = 'rest(0.25)';
        expected = [
            {
                opcode: 'music_restForBeats',
                inputs: [
                    {
                        name: 'BEATS',
                        block: expectedInfo.makeNumber(0.25)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('music_playNoteForBeats', async () => {
        code = 'play_note(note: 60, beats: 0.25)';
        expected = [
            {
                opcode: 'music_playNoteForBeats',
                inputs: [
                    {
                        name: 'NOTE',
                        block: {opcode: 'note', fields: [{name: 'NOTE', value: '60'}], shadow: true}
                    },
                    {
                        name: 'BEATS',
                        block: expectedInfo.makeNumber(0.25)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('music_setInstrument', async () => {
        code = 'self.instrument = 1';
        expected = [
            {
                opcode: 'music_setInstrument',
                inputs: [
                    {
                        name: 'INSTRUMENT',
                        block: {
                            opcode: 'music_menu_INSTRUMENT',
                            fields: [{name: 'INSTRUMENT', value: '1'}],
                            shadow: true
                        }
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('music_setTempo', async () => {
        code = 'self.tempo = 120';
        expected = [
            {
                opcode: 'music_setTempo',
                inputs: [
                    {
                        name: 'TEMPO',
                        block: expectedInfo.makeNumber(120)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('music_changeTempo', async () => {
        code = 'self.tempo += 20';
        expected = [
            {
                opcode: 'music_changeTempo',
                inputs: [
                    {
                        name: 'TEMPO',
                        block: expectedInfo.makeNumber(20)
                    }
                ]
            }
        ];
        await convertAndExpectToEqualBlocks(converter, target, code, expected);
    });

    test('music_getTempo (as value block)', async () => {
        code = 'say(tempo)';
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });

    test('invalid', async () => {
        for (const s of [
            'play_drum(1)',
            'play_drum(drum: 1)',
            'rest("abc")',
            'play_note(note: 60)'
        ]) {
            await convertAndExpectRubyBlockError(converter, target, s);
        }
    });
});
