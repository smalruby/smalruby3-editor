/**
 * Unit test replacing test/integration/ruby-tab/looks.test.js (sprite)
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Looks category blocks (sprite)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            say("Hello!", 2)
            say("Hello!")
            think("Hmm...", 2)
            think("Hmm...")
            switch_costume("costume1")
            next_costume
            switch_backdrop("backdrop1")
            switch_backdrop("next backdrop")
            switch_backdrop("previous backdrop")
            switch_backdrop("random backdrop")
            next_backdrop
            self.size += 10
            self.size = 100
            change_effect_by("color", 25)
            change_effect_by("fisheye", 25)
            change_effect_by("whirl", 25)
            change_effect_by("pixelate", 25)
            change_effect_by("mosaic", 25)
            change_effect_by("brightness", 25)
            change_effect_by("ghost", 25)
            set_effect("color", 0)
            clear_graphic_effects
            show
            hide
            go_to_layer("front")
            go_to_layer("back")
            go_layers(1, "forward")
            go_layers(1, "backward")

            costume_number

            costume_name

            backdrop_number

            backdrop_name

            size
        `);
    });

    test('Ruby -> Code -> Ruby (puts/print/p with type preservation)', async () => {
        const inputCode = dedent`
            puts("ハロー！")
            puts(10)
            puts(3.5)
            puts("Hello", 10, 3.5)
            print("World")
            print(20)
            print(4.5)
            print("Ruby", 30, 4.5)
            p("Test")
            p(30)
            p(5.5)
            p("Blocks", 40, 5.5)
        `;
        const expectedCode = dedent`
            puts("ハロー！")
            puts(10)
            puts(3.5)
            puts("Hello")
            puts(10)
            puts(3.5)
            print("World")
            print(20)
            print(4.5)
            print("Ruby")
            print(30)
            print(4.5)
            p("Test")
            p(30)
            p(5.5)
            p("Blocks")
            p(40)
            p(5.5)
        `;
        await expectRoundTrip(converter, target, inputCode, expectedCode);
    });
});
