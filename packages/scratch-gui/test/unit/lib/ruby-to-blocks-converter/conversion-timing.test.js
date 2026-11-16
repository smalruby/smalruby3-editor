import RubyParser from '../../../../src/lib/ruby-parser';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

// The Ruby tab reverts the editing target and shows the error alert when a conversion fails
// (ruby-to-blocks-converter-hoc.jsx). It lost the alert when the conversion settled a few ticks
// later than before (the integration test "convert Code from Ruby › syntax error › changed
// sprite"), so once prism is loaded the conversion must not wait on anything: it settles in the
// same tick as a function that has no await.
describe('targetCodeToBlocks timing', () => {
    beforeAll(async () => {
        await RubyParser.loadPrism();
    });

    const settlesInOneTick = async (code) => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        let settled = false;
        converter.targetCodeToBlocks(null, code).then(() => {
            settled = true;
        });
        await Promise.resolve();
        return settled;
    };

    test('a syntax error settles in one tick once prism is loaded', async () => {
        expect(await settlesInOneTick('move(10')).toBe(true);
    });

    test('a converted code settles in one tick once prism is loaded', async () => {
        expect(await settlesInOneTick('move(10)')).toBe(true);
    });
});
