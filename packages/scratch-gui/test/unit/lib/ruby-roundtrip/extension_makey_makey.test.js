/**
 * Unit test replacing test/integration/ruby-tab/extension_makey_makey.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Makey Makey extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    const code = dedent`
        makey.when_key_pressed("SPACE") do
        end

        makey.when_pressed_in_oder("LEFT UP RIGHT") do
        end

        makey.when_pressed_in_oder("RIGHT UP LEFT") do
        end

        makey.when_key_pressed("w") do
        end
    `;

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, code);
    });

    test('Ruby -> Code -> Ruby (backward compatibility)', async () => {
        const oldCode = dedent`
            self.when(:makey_key_pressed, "SPACE") do
            end

            self.when(:makey_pressed_in_oder, "LEFT UP RIGHT") do
            end

            self.when(:makey_pressed_in_oder, "RIGHT UP LEFT") do
            end

            self.when(:makey_key_pressed, "w") do
            end
        `;
        await expectRoundTrip(converter, target, oldCode, code);
    });
});
