/**
 * Unit test replacing test/integration/ruby-tab/sensing.test.js (sprite)
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Sensing category blocks (sprite)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            touching?("_mouse_")

            touching?("_edge_")

            touching?("Abby")

            touching_color?("#f0765e")

            color_is_touching_color?("#da343f", "#3dd46a")

            distance("_mouse_")

            distance("Abby")

            ask("What's your name?")

            answer

            Keyboard.pressed?("space")

            Mouse.down?

            Mouse.x

            Mouse.y

            self.drag_mode = "draggable"
            self.drag_mode = "not draggable"

            loudness

            Timer.value

            Timer.reset

            stage.backdrop_number

            sprite("Abby").y

            stage.backdrop_name

            stage.volume

            stage.variable("my variable")

            sprite("Abby").x

            sprite("Abby").direction

            sprite("Abby").costume_number

            sprite("Abby").costume_name

            sprite("Abby").size

            sprite("Abby").volume

            Time.now.year

            Time.now.month

            Time.now.day

            Time.now.wday + 1

            Time.now.hour

            Time.now.min

            Time.now.sec

            days_since_2000

            online?

            user_name
        `);
    });
});
