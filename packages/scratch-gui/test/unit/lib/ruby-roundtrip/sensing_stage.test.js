/**
 * Unit test replacing test/integration/ruby-tab/sensing.test.js (stage)
 */
import dedent from 'dedent';
import {
    makeStageTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Sensing category blocks (stage)', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeStageTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            ask("What's your name?")

            answer

            Keyboard.pressed?("space")

            Mouse.down?

            Mouse.x

            Mouse.y

            loudness

            Timer.value

            Timer.reset

            stage.backdrop_number

            stage.backdrop_name

            stage.volume

            stage.variable("my variable")

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
