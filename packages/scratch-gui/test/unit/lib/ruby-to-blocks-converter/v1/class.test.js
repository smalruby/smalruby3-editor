import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Class (v1)', () => {
    let target;

    beforeEach(() => {
        target = null;
    });

    test('class definition is rejected in version 1', async () => {
        const v1Converter = new RubyToBlocksConverter(null, {version: '1'});
        const code = `
            class Sprite1
              self.when(:flag_clicked) do
                move(10)
              end
            end
        `;
        const res = await v1Converter.targetCodeToBlocks(target, code);
        expect(res).toBeFalsy();
        expect(v1Converter.errors).toHaveLength(1);
        expect(v1Converter.errors[0].text).toContain('version 1');
    });
});
