import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Operators/SymbolError', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('symbol without .to_s in unsupported context', () => {
        test('move(:foo) produces symbolNeedsToS error', async () => {
            const code = 'move(:foo)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toContain('.to_s');
        });

        test(':foo standalone produces symbolNeedsToS error', async () => {
            const code = ':foo';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toContain('.to_s');
        });

        test('turn_right(:foo) produces symbolNeedsToS error', async () => {
            const code = 'turn_right(:foo)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeFalsy();
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toContain('.to_s');
        });
    });

    describe('symbol in valid contexts does not error', () => {
        test('say(:foo) does not error', async () => {
            const code = 'say(:foo)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);
        });

        test(':foo.to_s does not error', async () => {
            const code = 'say(:foo.to_s)';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);
        });

        test('$a = :foo does not error', async () => {
            const code = '$a = :foo';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);
        });

        test(':foo == :bar does not error', async () => {
            const code = ':foo == :bar';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);
        });

        test('self.when(:flag_clicked) does not error', async () => {
            const code = 'self.when(:flag_clicked) { move(10) }';
            const result = await converter.targetCodeToBlocks(target, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);
        });
    });
});
