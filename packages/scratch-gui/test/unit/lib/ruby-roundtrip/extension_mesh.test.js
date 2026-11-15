/**
 * Unit test replacing test/integration/ruby-tab/extension_mesh.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip,
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Mesh extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({ target, runtime } = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            mesh.sensor_value("mesh variable")
        `,
        );
    });

    test('value message blocks (#1843): Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(
            converter,
            target,
            dedent`
            self.when(:receive, "chat") do
              say(mesh.message_value)
            end

            self.when(:flag_clicked) do
              mesh.broadcast("chat", "hello")
              mesh.broadcast("chat", mesh.sensor_value("score"))
            end
        `,
        );
    });
});
