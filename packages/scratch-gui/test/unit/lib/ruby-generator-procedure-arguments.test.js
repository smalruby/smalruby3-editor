import RubyToBlocksConverter from '../../../src/lib/ruby-to-blocks-converter';

describe('Ruby Generator Procedure Arguments', () => {
    let converter;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null);
    });

    test('toSnakeCaseLowercase helper function', async () => {
        // Test the helper function directly
        expect(converter._toSnakeCaseLowercase('ARG1')).toBe('arg1');
        expect(converter._toSnakeCaseLowercase('aRG1')).toBe('a_rg1');
        expect(converter._toSnakeCaseLowercase('ArgumentOne')).toBe('argument_one');
        expect(converter._toSnakeCaseLowercase('ARG_VALUE1')).toBe('arg_value1');
        expect(converter._toSnakeCaseLowercase('myVariable')).toBe('my_variable');
        expect(converter._toSnakeCaseLowercase('CONSTANT_VALUE')).toBe('constant_value');
        expect(converter._toSnakeCaseLowercase('simple_arg')).toBe('simple_arg');
        expect(converter._toSnakeCaseLowercase('_private_var_')).toBe('_private_var_');
    });

    test('toSnakeCaseLowercase preserves Japanese characters', async () => {
        expect(converter._toSnakeCaseLowercase('価格')).toBe('価格');
        expect(converter._toSnakeCaseLowercase('売値')).toBe('売値');
        expect(converter._toSnakeCaseLowercase('ねこ')).toBe('ねこ');
        expect(converter._toSnakeCaseLowercase('スコア')).toBe('スコア');
    });
});
