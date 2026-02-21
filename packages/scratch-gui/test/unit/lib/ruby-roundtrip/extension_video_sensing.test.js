/**
 * Unit test replacing test/integration/ruby-tab/extension_video_sensing.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Video Sensing extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            video_sensing.when_video_motion_greater_than(10) do
            end

            video_sensing.when_video_motion_greater_than(x) do
            end

            video_sensing.video_on("motion", "this sprite")

            video_sensing.video_on("direction", "this sprite")

            video_sensing.video_on("direction", "Stage")

            video_sensing.video_turn("on")
            video_sensing.video_turn("off")
            video_sensing.video_turn("on-flipped")
            video_sensing.video_transparency = 50
        `);
    });
});
