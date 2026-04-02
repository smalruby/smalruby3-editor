/**
 * Ruby round-trip unit test for TM2Scratch (Teachable Machine) extension.
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: TM2Scratch extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('image classification blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            tm.set_image_classification_model_url("https://teachablemachine.withgoogle.com/models/0rX_3hoH/")
            tm.classify_video_image

            tm.image_label

            tm.image_label_detected?("any")

            tm.image_label_confidence("cat")
        `,
        );
    });

    test('image HAT block', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            tm.when_image_label_received("any") do
              tm.classify_video_image
            end
        `,
        );
    });

    test('sound classification blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            tm.set_sound_classification_model_url("https://teachablemachine.withgoogle.com/models/xP0spGSB/")

            tm.sound_label

            tm.sound_label_detected?("any")

            tm.sound_label_confidence("clap")
        `,
        );
    });

    test('sound HAT block', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            tm.when_sound_label_received("any") do
              tm.classify_video_image
            end
        `,
        );
    });

    test('configuration blocks', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            tm.toggle_classification("on")
            tm.classification_interval = "0.5"
            tm.confidence_threshold = 0.8
            tm.video_toggle("on")
            tm.switch_camera("abc123")

            tm.confidence_threshold
        `,
        );
    });
});
