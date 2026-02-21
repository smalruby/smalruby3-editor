/**
 * Unit test replacing test/integration/ruby-tab/extension_text2speech.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Text to Speech extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            text2speech.speak("hello")
            text2speech.voice = "ALTO"
            text2speech.voice = "TENOR"
            text2speech.voice = "SQUEAK"
            text2speech.voice = "GIANT"
            text2speech.voice = "KITTEN"
            text2speech.language = "en"
            text2speech.language = "ja"
            text2speech.language = "de"
        `);
    });

    test('Ruby -> Code -> Ruby (case normalization)', async () => {
        const beforeRuby = dedent`
            text2speech.voice = "alto"
            text2speech.voice = "Alto"
            text2speech.language = "EN"
            text2speech.language = "En"
        `;
        const afterRuby = dedent`
            text2speech.voice = "ALTO"
            text2speech.voice = "ALTO"
            text2speech.language = "en"
            text2speech.language = "en"
        `;
        await expectRoundTrip(converter, target, beforeRuby, afterRuby);
    });
});
