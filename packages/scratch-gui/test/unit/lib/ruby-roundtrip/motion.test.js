/**
 * Unit test replacing test/integration/ruby-tab/motion.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Motion category blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            move(10)
            turn_right(15)
            turn_left(15)
            self.direction += 15
            self.direction -= 15
            go_to("_random_")
            go_to("_mouse_")
            go_to("Abby")
            go_to([0, 0])
            glide("_random_", secs: 1)
            glide("_mouse_", secs: 1)
            glide("Abby", secs: 1)
            glide([0, 0], secs: 1)
            self.direction = 90
            point_towards("_mouse_")
            point_towards("Abby")
            self.x += 10
            self.x = 0
            self.y += 10
            self.y = 0
            bounce_if_on_edge
            self.rotation_style = "left-right"
            self.rotation_style = "don't rotate"
            self.rotation_style = "all around"

            x

            y

            direction
        `);
    });
});
