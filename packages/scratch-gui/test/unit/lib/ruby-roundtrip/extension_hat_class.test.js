/**
 * Round-trip tests for extension hat blocks inside class definitions.
 * Tests Ruby → Blocks → Ruby for microbit, face_sensing, ev3, etc.
 *
 * NOTE: Argument values must match what the generator outputs and the
 * converter accepts. Use actual menu values (e.g. "P0" not "0").
 */
import {
    makeSpriteTarget,
    makeStageTarget,
    setupRubyGenerator,
    makeConverter,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

let target, stage, runtime, converter;

describe('Extension hat blocks in class - round trip', () => {
    beforeEach(() => {
        ({target, stage, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    // ---- microbit_more ----
    describe('microbit_more hat blocks', () => {
        test('when_button_is', async () => {
            const code = 'microbit.when_button_is("A", "down") do\n  puts("hello")\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('when_microbit (connection changed)', async () => {
            const code = 'microbit.when_microbit("connected") do\n  puts("hello")\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('when_pin_is (touch event)', async () => {
            // NAME field uses TouchIDMenu values: LOGO, P0, P1, P2
            const code = 'microbit.when_pin_is("LOGO", "touched") do\n  puts("hello")\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('when (gesture)', async () => {
            // GestureMenu values: tilted_front, shake, freefall, 3G, etc.
            const code = 'microbit.when("shake") do\n  puts("hello")\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('when_tilted', async () => {
            const code = 'microbit.when_tilted("front") do\n  puts("hello")\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('when_catch_at_pin', async () => {
            // PinEventMenu: rise, fall, low pulse, high pulse
            // GpioPin: P0, P1, P2, P8, ...
            const code = 'microbit.when_catch_at_pin("rise", "P0") do\n  puts("hello")\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('when_data_received_from_microbit', async () => {
            const code = 'microbit.when_data_received_from_microbit("label") do\n  puts("hello")\nend';
            await expectRoundTrip(converter, target, code);
        });
    });

    // ---- face_sensing ----
    describe('face_sensing hat blocks', () => {
        test('when_face_tilted', async () => {
            const code = 'face_sensing.when_face_tilted("left") do\n  move(10)\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('when_this_sprite_touch', async () => {
            const code = 'face_sensing.when_this_sprite_touch("nose") do\n  move(10)\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('when_face_detected', async () => {
            const code = 'face_sensing.when_face_detected do\n  move(10)\nend';
            await expectRoundTrip(converter, target, code);
        });
    });

    // ---- makey makey ----
    describe('makey makey hat blocks', () => {
        test('when_key_pressed', async () => {
            const code = 'makey.when_key_pressed("SPACE") do\n  move(10)\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('when_pressed_in_order', async () => {
            const code = 'makey.when_pressed_in_oder("LEFT UP RIGHT") do\n  move(10)\nend';
            await expectRoundTrip(converter, target, code);
        });
    });

    // ---- video sensing ----
    describe('video sensing hat blocks', () => {
        test('when_video_motion_greater_than', async () => {
            const code = 'video_sensing.when_video_motion_greater_than(10) do\n  move(10)\nend';
            await expectRoundTrip(converter, target, code);
        });
    });

    // ---- mixed core + extension ----
    describe('mixed core and extension hat blocks', () => {
        test('when_flag_clicked + microbit.when_button_is', async () => {
            const code =
                'self.when(:flag_clicked) do\n  move(10)\nend\n\n' +
                'microbit.when_button_is("A", "down") do\n  puts("hello")\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('when_key_pressed + face_sensing.when_face_detected', async () => {
            const code =
                'self.when(:key_pressed, "space") do\n  move(10)\nend\n\n' +
                'face_sensing.when_face_detected do\n  turn_right(15)\nend';
            await expectRoundTrip(converter, target, code);
        });

        test('def + microbit.when_button_is', async () => {
            // Procedure calls use bare name (no self. prefix) in generated code
            const code =
                'def self.my_block\n  move(10)\nend\n\n' +
                'microbit.when_button_is("B", "up") do\n  my_block\nend';
            await expectRoundTrip(converter, target, code);
        });
    });
});

describe('Extension hat blocks on stage - round trip', () => {
    beforeEach(() => {
        ({target, stage, runtime} = makeStageTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('microbit.when_button_is on stage', async () => {
        // Stage doesn't support looks blocks (puts/say), use broadcast instead
        const code = 'microbit.when_button_is("A", "down") do\n  broadcast("hello")\nend';
        await expectRoundTrip(converter, target, code);
    });

    test('video_sensing.when_video_motion_greater_than on stage', async () => {
        const code = 'video_sensing.when_video_motion_greater_than(10) do\n  broadcast("motion")\nend';
        await expectRoundTrip(converter, target, code);
    });

    test('when_flag_clicked + microbit on stage', async () => {
        const code =
            'self.when(:flag_clicked) do\n  broadcast("start")\nend\n\n' +
            'microbit.when_button_is("A", "down") do\n  broadcast("hello")\nend';
        await expectRoundTrip(converter, target, code);
    });
});
