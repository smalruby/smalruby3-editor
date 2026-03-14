import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Module (v1)', () => {
    let target;

    beforeEach(() => {
        target = null;
    });

    test('module in v1 throws error', async () => {
        const converterV1 = new RubyToBlocksConverter(null, {version: '1'});
        const code = `
            module Utils
              def add(a, b)
                a + b
              end
            end
        `;
        const result = await converterV1.targetCodeToBlocks(target, code);
        expect(result).toBeFalsy();
        expect(converterV1.errors.length).toBeGreaterThan(0);
    });
});
