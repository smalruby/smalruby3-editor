/**
 * Unit test replacing test/integration/ruby-tab/sound.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Sound category blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            play_until_done("Meow")
            play("Meow")
            stop_all_sounds
            change_sound_effect_by("PITCH", 10)
            change_sound_effect_by("PAN", 10)
            set_sound_effect("PITCH", 100)
            clear_sound_effects
            self.volume += -10
            self.volume = 100

            volume
        `);
    });
});
