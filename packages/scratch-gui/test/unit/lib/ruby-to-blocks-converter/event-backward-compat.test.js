import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Event backward compatibility (v1 syntax in v2 mode)', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    test('self.when(:flag_clicked) is accepted', async () => {
        const code = `
            self.when(:flag_clicked) do
              move(10)
            end
        `;
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });

    test('self.when(:key_pressed, "space") is accepted', async () => {
        const code = `
            self.when(:key_pressed, "space") do
              move(10)
            end
        `;
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });

    test('self.when(:clicked) is accepted', async () => {
        const code = `
            self.when(:clicked) do
              move(10)
            end
        `;
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });

    test('self.when(:backdrop_switches, "backdrop1") is accepted', async () => {
        const code = `
            self.when(:backdrop_switches, "backdrop1") do
              move(10)
            end
        `;
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });

    test('self.when(:greater_than, "loudness", 10) is accepted', async () => {
        const code = `
            self.when(:greater_than, "loudness", 10) do
              move(10)
            end
        `;
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });

    test('self.when(:receive, "msg1") is accepted', async () => {
        const code = `
            self.when(:receive, "msg1") do
              move(10)
            end
        `;
        const res = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(res).toBeTruthy();
    });
});
