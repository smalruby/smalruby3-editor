/**
 * Unit test replacing test/integration/ruby-tab/operators.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Operators category blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, dedent`
            0 + 0

            0 - 0

            0 * 0

            0 / 0.0

            rand(1..10)

            "" > 50

            "" < 50

            "" == 50

            "" != 50

            false && false

            false || false

            !false

            "apple " + "banana"

            "apple"[0]

            "apple".length

            "".empty?

            "apple".include?("a")

            0 % 0

            0.round

            0.to_s

            "".to_i

            0.abs

            0.floor

            0.ceil

            Math.sqrt(0)

            Math.sin(0)

            Math.cos(0)

            Math.tan(0)

            Math.asin(0)

            Math.acos(0)

            Math.atan(0)

            Math.log(0)

            Math.log10(0)

            Math::E ** 0

            10 ** 0
        `);
    });
});
