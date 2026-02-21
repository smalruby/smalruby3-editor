/**
 * Unit test replacing test/integration/ruby-tab/control.test.js
 * (if...elsif and case...when variants)
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Control if/elsif/case blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby (if...elsif...end)', async () => {
        await expectRoundTrip(converter, target, dedent`
            if x == 1
              move(10)
            elsif x == 2
              move(20)
            end
            if x == 1
              move(10)
            elsif x == 2
              move(20)
            else
              move(30)
            end
            if x == 1
              move(10)
            elsif x == 2
              move(20)
            elsif x == 3
              move(30)
            else
              move(40)
            end
        `);
    });

    test('Ruby -> Code -> Ruby (case...when...end)', async () => {
        await expectRoundTrip(converter, target, dedent`
            case x
            when 1
              move(10)
            end
            case x
            when 1
              move(10)
            else
              move(20)
            end
            case x
            when 1
              move(10)
            when 2
              move(20)
            else
              move(30)
            end
            case @a
            when 1
              move(10)
            end
            case @b
            when 2
              move(20)
            end
        `);
    });
});
