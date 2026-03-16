import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Operators/SymbolArithmetic', () => {
    let converter;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
    });

    describe('symbol as receiver in arithmetic → error', () => {
        test.each([
            [':foo + 1'],
            [':foo - 1'],
            [':foo * 2'],
            [':foo / 2'],
            [':foo % 2'],
            [':foo ** 2'],
            [':foo + "a"'],
            [':foo + :bar']
        ])('%s produces symbolCannotArithmetic error', async (code) => {
            const result = await converter.targetCodeToBlocks(null, code);
            expect(result).toBeFalsy();
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toContain('.to_s');
            expect(converter.errors[0].text).toMatch(/[+\-*/]/);
        });
    });

    describe('symbol as argument in arithmetic → error', () => {
        test.each([
            ['1 + :foo'],
            ['1 - :foo'],
            ['1 * :foo'],
            ['1 / :foo'],
            ['"a" + :foo']
        ])('%s produces symbolCannotArithmetic error', async (code) => {
            const result = await converter.targetCodeToBlocks(null, code);
            expect(result).toBeFalsy();
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toContain('.to_s');
            expect(converter.errors[0].text).toMatch(/[+\-*/]/);
        });
    });

    describe('symbol with non-symbol in >/< comparison → error', () => {
        test.each([
            [':foo > 1'],
            [':foo < 1'],
            [':foo > "a"'],
            [':foo < true'],
            ['1 > :foo'],
            ['1 < :foo'],
            ['"a" > :foo']
        ])('%s produces symbolCannotCompare error', async (code) => {
            const result = await converter.targetCodeToBlocks(null, code);
            expect(result).toBeFalsy();
            expect(converter.errors).toHaveLength(1);
            expect(converter.errors[0].text).toMatch(/[><]/);
        });
    });

    describe('symbol == any type → OK (no error)', () => {
        test.each([
            [':foo == :bar'],
            [':foo == 1'],
            [':foo == "a"'],
            ['1 == :foo']
        ])('%s does not error', async (code) => {
            const result = await converter.targetCodeToBlocks(null, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);
        });
    });

    describe('symbol >/< symbol → OK (no error)', () => {
        test.each([
            [':foo > :bar'],
            [':foo < :bar']
        ])('%s does not error', async (code) => {
            const result = await converter.targetCodeToBlocks(null, code);
            expect(result).toBeTruthy();
            expect(converter.errors).toHaveLength(0);
        });
    });
});
