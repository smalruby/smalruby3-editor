/**
 * Unit test for v2 sensing blocks: keyboard, mouse, timer lowercase receivers.
 * Related issue: #363
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Sensing v2 lowercase receivers', () => {
    let target, runtime;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
    });

    test('keyboard.pressed? (v2)', async () => {
        const converter2 = makeConverter(target, runtime, {version: 2});
        await expectRoundTrip(converter2, target, dedent`
            keyboard.pressed?("space")
        `, null, {version: 2});
    });

    test('mouse.x / mouse.y / mouse.down? (v2)', async () => {
        const converter2 = makeConverter(target, runtime, {version: 2});
        await expectRoundTrip(converter2, target, dedent`
            mouse.x

            mouse.y

            mouse.down?
        `, null, {version: 2});
    });

    test('timer.value / timer.reset (v2)', async () => {
        const converter2 = makeConverter(target, runtime, {version: 2});
        await expectRoundTrip(converter2, target, dedent`
            timer.value

            timer.reset
        `, null, {version: 2});
    });

    test('v1 backward compat: Keyboard/Mouse/Timer (uppercase)', async () => {
        const converter1 = makeConverter(target, runtime);
        await expectRoundTrip(converter1, target, dedent`
            Keyboard.pressed?("space")

            Mouse.x

            Mouse.y

            Mouse.down?

            Timer.value

            Timer.reset
        `);
    });
});
