/**
 * The BlockStore of the convert stage (issue #2093): what the conversion writes is in one store, which
 * records the writes so that an attempt can be rolled back, and the conversion writes only through it.
 */
import fs from 'fs';
import path from 'path';
import RubyToBlocksConverter from '../../../../src/lib/ruby-to-blocks-converter';
import { BLOCK_STORE_TABLES, BlockStore } from '../../../../src/lib/ruby-to-blocks-converter/block-store';

const CONVERTER_DIR = path.resolve(__dirname, '../../../../src/lib/ruby-to-blocks-converter');

/**
 * The JavaScript files of the converter, except the store and its journal.
 * @param {string} dir - The directory.
 * @returns {string[]} The paths.
 */
const converterFiles = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) return converterFiles(file);
        if (!entry.name.endsWith('.js') || ['block-store.js', 'context-journal.js'].includes(entry.name)) return [];
        return [file];
    });

const TABLES = BLOCK_STORE_TABLES.join('|');
// `_context.blocks[id] = ...`, `delete _context.comments[id]`, `_context[name][key] = ...`,
// `_context.symbols.add(...)`
const DIRECT_WRITES = [
    new RegExp(`_context(\\.(${TABLES})|\\[[A-Za-z]+\\])(\\[[^\\]]*\\]|\\.[A-Za-z_]+)\\s*(=[^=>]|\\+\\+|\\+=|-=)`),
    new RegExp(`delete [A-Za-z._]*_context[.[]`),
    /_context\.symbols\.(add|delete|clear)\(/,
];

describe('RubyToBlocksConverter/BlockStore', () => {
    test('the conversion does not write the tables of the context directly', () => {
        const found = [];
        converterFiles(CONVERTER_DIR).forEach((file) => {
            fs.readFileSync(file, 'utf8')
                .split('\n')
                .forEach((line, i) => {
                    if (DIRECT_WRITES.some((re) => re.test(line))) {
                        found.push(`${path.relative(CONVERTER_DIR, file)}:${i + 1}: ${line.trim()}`);
                    }
                });
        });
        expect(found).toEqual([]);
    });

    test('the context points at the tables of its store', () => {
        const converter = new RubyToBlocksConverter(null, { version: '2' });
        BLOCK_STORE_TABLES.forEach((name) => {
            expect(converter._context[name]).toBe(converter._context.store[name]);
        });
    });

    test('rolls back the writes since a mark, but keeps the symbols', () => {
        const store = new BlockStore();
        store.setBlock({ id: 'a' }, 'statement');
        store.setComment({ id: 'a_comment', text: 'x' });
        const mark = store.mark();
        store.setBlock({ id: 'b' }, 'value');
        store.deleteBlock('a', { withType: true });
        store.deleteComment('a_comment');
        store.setVariable('variables', 'v', { id: 'v1', name: 'v' });
        store.setProcedure('foo', { id: 'p1' });
        store.setLiteralCallIndex('true', 2);
        store.addSymbol(':foo');
        expect(store.storeAt(mark, 'blocks')).toEqual({ a: { id: 'a' } });

        store.rollback(mark);
        expect(Object.keys(store.blocks)).toEqual(['a']);
        expect(store.blockTypes).toEqual({ a: 'statement' });
        expect(Object.keys(store.comments)).toEqual(['a_comment']);
        expect(Object.keys(store.variables)).toEqual([]);
        expect(Object.keys(store.procedures)).toEqual([]);
        expect(Object.keys(store.literalCallIndices)).toEqual([]);
        expect([...store.symbols]).toEqual([':foo']);
    });

    test('a block removed without its type keeps the type', () => {
        const store = new BlockStore();
        store.setBlock({ id: 'a' }, 'value');
        store.deleteBlock('a');
        expect(Object.keys(store.blocks)).toEqual([]);
        expect(store.blockTypes).toEqual({ a: 'value' });
    });

    test('removes a procedure, and a rollback puts it back', () => {
        const store = new BlockStore();
        store.setProcedure('foo', { id: 'p1' });
        const mark = store.mark();
        store.deleteProcedure('foo');
        expect(Object.keys(store.procedures)).toEqual([]);
        store.rollback(mark);
        expect(store.procedures.foo).toEqual({ id: 'p1' });
    });

    test('only the tables of variables take variables', () => {
        const store = new BlockStore();
        expect(() => store.setVariable('blocks', 'x', {})).toThrow('not a table of variables');
        store.setVariable('broadcastMsgs', 'hi', { id: 'm1' });
        store.deleteVariable('broadcastMsgs', 'hi');
        expect(Object.keys(store.broadcastMsgs)).toEqual([]);
    });
});
