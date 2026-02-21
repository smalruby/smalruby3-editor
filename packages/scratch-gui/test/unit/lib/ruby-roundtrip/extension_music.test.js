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

    test('Ruby -> Code -> Ruby', async () => {
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
});
