import RubyToBlocksConverter from '../../../../../src/lib/ruby-to-blocks-converter';

describe('RubyToBlocksConverter/Variables/SymbolList', () => {
    let converter;
    let target;

    beforeEach(() => {
        converter = new RubyToBlocksConverter(null, {version: '2'});
        target = null;
    });

    describe('_collectSymbol', () => {
        test('adds symbol to the symbols set with colon prefix', () => {
            converter.reset();
            converter._collectSymbol('foo');
            expect(converter._context.symbols).toContain(':foo');
        });

        test('preserves insertion order', () => {
            converter.reset();
            converter._collectSymbol('bar');
            converter._collectSymbol('foo');
            converter._collectSymbol('baz');
            expect(Array.from(converter._context.symbols)).toEqual([':bar', ':foo', ':baz']);
        });

        test('does not duplicate existing symbols', () => {
            converter.reset();
            converter._collectSymbol('foo');
            converter._collectSymbol('foo');
            expect(converter._context.symbols.size).toBe(1);
        });
    });

    describe('symbols set in context', () => {
        test('is initialized as empty Set on reset', () => {
            converter.reset();
            expect(converter._context.symbols).toBeInstanceOf(Set);
            expect(converter._context.symbols.size).toBe(0);
        });

        test('is cleared on each reset', () => {
            converter.reset();
            converter._collectSymbol('foo');
            converter.reset();
            expect(converter._context.symbols.size).toBe(0);
        });
    });

    describe('$_symbols_ list creation via _createSymbolsList', () => {
        test('creates $_symbols_ list when symbols are collected', () => {
            converter.reset();
            converter._collectSymbol('foo');
            converter._collectSymbol('bar');
            converter._createSymbolsList();
            expect(converter.lists).toHaveProperty('_symbols_');
            const list = converter.lists['_symbols_'];
            expect(list.name).toBe('_symbols_');
            expect(list.scope).toBe('global');
        });

        test('does not create $_symbols_ list when no symbols are collected', () => {
            converter.reset();
            converter._createSymbolsList();
            expect(converter.lists).not.toHaveProperty('_symbols_');
        });

        test('$_symbols_ list has correct type (list)', () => {
            converter.reset();
            converter._collectSymbol('foo');
            converter._createSymbolsList();
            const list = converter.lists['_symbols_'];
            expect(list.type).toBe('list');
        });
    });
});
