/**
 * Unit test replacing test/integration/ruby-tab/extension_music.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Music extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby (v1)', async () => {
        await expectRoundTrip(converter, target, dedent`
            play_drum(drum: 1, beats: 0.25)
            rest(0.25)
            play_note(note: 60, beats: 0.25)
            self.instrument = 1
            self.tempo = 60
            self.tempo += 20

            tempo
        `);
    });

    test('Ruby -> Code -> Ruby (v2)', async () => {
        const converter2 = makeConverter(target, runtime, {version: 2});
        await expectRoundTrip(converter2, target, dedent`
            music.play_drum(drum: 1, beats: 0.25)
            music.rest(0.25)
            music.play_note(note: 60, beats: 0.25)
            music.instrument = 1
            music.tempo = 60
            music.tempo += 20

            music.tempo
        `, null, {version: 2});
    });
});
