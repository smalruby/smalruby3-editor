import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import { convertAndExpectRubyBlockError } from '../../../helpers/expect-to-equal-blocks';

// The forms of EV3 that are errors (the forms that convert are in ruby-roundtrip/ev3-table.test.js).
describe('RubyToBlocksConverter/EV3', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, { version: '2' });
        target = null;
    });

    // The port of `when_button_pressed` is a string only: the generator never writes a block there,
    // and a block was left connected to nothing.
    test.each([
        'ev3.when_button_pressed(ev3.distance) do\nend',
        'ev3.when_button_pressed(1) do\nend',
        'self.when(:ev3_button_pressed, ev3.distance) do\nend',
        'self.when(:ev3_button_pressed, 1) do\nend',
    ])('%s is an error', async (code) => {
        await convertAndExpectRubyBlockError(converter, target, code);
    });

    test('converts without writing to the console', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        try {
            const res = await converter.targetCodeToBlocks(target, 'ev3.when_button_pressed("1") do\nend');
            expect(converter.errors).toHaveLength(0);
            expect(res).toBeTruthy();
            expect(log).not.toHaveBeenCalled();
        } finally {
            log.mockRestore();
        }
    });
});
