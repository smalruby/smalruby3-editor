/**
 * Unit test replacing test/integration/ruby-tab/extension_pen.test.js
 */
import dedent from 'dedent';
import {
    makeSpriteTarget,
    makeConverter,
    setupRubyGenerator,
    expectRoundTrip
} from '../../helpers/ruby-roundtrip-helper';

describe('Ruby Roundtrip: Pen extension blocks', () => {
    let target, runtime, converter;

    beforeEach(() => {
        ({target, runtime} = makeSpriteTarget());
        setupRubyGenerator();
        converter = makeConverter(target, runtime);
    });

    const code = dedent`
        Pen.clear
        pen.stamp
        pen.down
        pen.up
        pen.color = "#c11318"
        pen.color += 10
        pen.saturation += 10
        pen.brightness += 10
        pen.transparency += 10
        pen.color = 50
        pen.saturation = 50
        pen.brightness = 50
        pen.transparency = 50
        pen.size += 1
        pen.size = 1
    `;

    test('Ruby -> Code -> Ruby', async () => {
        await expectRoundTrip(converter, target, code);
    });

    test('Ruby -> Code -> Ruby (backward compatibility)', async () => {
        const oldCode = dedent`
            pen_clear
            pen_stamp
            pen_down
            pen_up
            self.pen_color = "#c11318"
            self.pen_color += 10
            self.pen_saturation += 10
            self.pen_brightness += 10
            self.pen_transparency += 10
            self.pen_color = 50
            self.pen_saturation = 50
            self.pen_brightness = 50
            self.pen_transparency = 50
            self.pen_size += 1
            self.pen_size = 1
        `;
        await expectRoundTrip(converter, target, oldCode, code);
    });
});
