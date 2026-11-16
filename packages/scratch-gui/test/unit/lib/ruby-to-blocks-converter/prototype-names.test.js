/**
 * Names such as `__proto__`, `constructor` and `toString` are ordinary Ruby names. The tables of
 * the converter's context (variables, lists, procedures, ...) must keep them like any other name:
 * a plain object (`{}`) takes `table.__proto__ = value` as a change of its prototype, and reads
 * `table.constructor` from `Object.prototype` (issue #2034).
 */
import { ContextJournal, JOURNALED_STORES } from '../../../../src/lib/ruby-to-blocks-converter/context-journal';
import {
    expectRoundTrip,
    makeConverter,
    makeSpriteTarget,
    setupRubyGenerator,
} from '../../helpers/ruby-roundtrip-helper';

const PROTOTYPE_NAMES = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'];

describe('names of the prototype of an object (issue #2034)', () => {
    beforeEach(() => {
        setupRubyGenerator();
    });

    const convert = async (code) => {
        const { target, runtime } = makeSpriteTarget();
        const converter = makeConverter(target, runtime, { version: '2' });
        const result = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(result).toBeTruthy();
        return converter;
    };

    test('the tables of the context have no prototype', async () => {
        const converter = await convert('move(10)');
        [...JOURNALED_STORES, 'argumentBlocks', 'procedureCallBlocks'].forEach((name) => {
            expect(converter._context[name].constructor).toBeUndefined();
            expect(converter._context[name].__proto__).toBeUndefined();
        });
    });

    describe.each(PROTOTYPE_NAMES)('%s', (name) => {
        test('as an instance variable', async () => {
            const converter = await convert(`@${name} = 1\nsay(@${name})`);
            const names = Object.values(converter.variables).map((v) => v.name);
            expect(names).toEqual([name]);
        });

        test('as a global variable', async () => {
            const converter = await convert(`$${name} = 1\nsay($${name})`);
            const names = Object.values(converter.variables).map((v) => v.name);
            expect(names).toEqual([name]);
        });

        test('as a list', async () => {
            const converter = await convert(`@${name} = []\n@${name}.push(1)`);
            const names = Object.values(converter.lists).map((v) => v.name);
            expect(names).toEqual([name]);
        });

        test('round trip of an instance variable and a global list', async () => {
            const { target, runtime } = makeSpriteTarget();
            const converter = makeConverter(target, runtime, { version: '2' });
            await expectRoundTrip(
                converter,
                target,
                [`@${name} = 1`, `$list_${name} = []`, `$list_${name}.push(@${name})`, `say(@${name})`].join('\n'),
            );
        });
    });

    test('a local variable named constructor', async () => {
        const { target, runtime } = makeSpriteTarget();
        const converter = makeConverter(target, runtime, { version: '2' });
        await expectRoundTrip(converter, target, ['constructor = 1', 'say(constructor)'].join('\n'));
        const names = Object.values(converter._context.localVariables).map((v) => v.originalName);
        expect(names).toEqual(['constructor']);
    });

    // A local also goes through the tables of the analysis (`variables.uses`, `locals.uses`).
    test('a local variable named __proto__', async () => {
        const { target, runtime } = makeSpriteTarget();
        const converter = makeConverter(target, runtime, { version: '2' });
        await expectRoundTrip(converter, target, ['__proto__ = 1', 'say(__proto__)'].join('\n'));
        const names = Object.values(converter._context.localVariables).map((v) => v.originalName);
        expect(names).toEqual(['__proto__']);
    });

    test('a method named constructor called as a value is counted', async () => {
        const converter = await convert(['def constructor', '  return 1', 'end', '', 'say(constructor)'].join('\n'));
        expect(converter._context.analysis.procedures.valueCallCounts.constructor).toBe(1);
    });

    test('converting the names does not change Object.prototype', async () => {
        await convert(
            PROTOTYPE_NAMES.map((name) => `@${name} = 1\n$${name}_list = []\n$${name}_list.push(@${name})`).join(
                '\n',
            ),
        );
        ['scalar', 'list', 'hash', 'string', 'notString'].forEach((key) => {
            expect(Object.prototype.hasOwnProperty.call(Object.prototype, key)).toBe(false);
        });
    });

    test('a method named toString or constructor', async () => {
        const { target, runtime } = makeSpriteTarget();
        const converter = makeConverter(target, runtime, { version: '2' });
        const code = [
            'def toString',
            '  move(10)',
            'end',
            '',
            'def constructor',
            '  move(5)',
            'end',
            '',
            'toString',
            'constructor',
        ].join('\n');
        const result = await converter.targetCodeToBlocks(target, code);
        expect(converter.errors).toHaveLength(0);
        expect(result).toBeTruthy();
        expect(Object.keys(converter._context.procedures)).toEqual(['toString', 'constructor']);
    });

    test('a variable named __proto__ next to other names keeps the order of the keys', async () => {
        const converter = await convert(
            ['@a = 1', '@__proto__ = 2', '@b = 3', 'say(@a + @__proto__ + @b)'].join('\n'),
        );
        const names = Object.values(converter.variables).map((v) => v.name);
        expect(names).toEqual(['a', '__proto__', 'b']);
    });
});

describe('ContextJournal with the names of the prototype (issue #2034)', () => {
    test('a key named __proto__ is set, deleted and rolled back like any other', () => {
        const journal = new ContextJournal();
        const table = journal.wrap('variables', { a: 1 });
        const mark = journal.mark();
        table.__proto__ = 2;
        table.b = 3;
        expect(Object.keys(table)).toEqual(['a', '__proto__', 'b']);
        expect(table.__proto__).toBe(2);
        expect(JSON.stringify(table)).toBe('{"a":1,"__proto__":2,"b":3}');
        expect(journal.storeAt(mark, 'variables')).toEqual(Object.assign(Object.create(null), { a: 1 }));
        journal.rollback(mark);
        expect(Object.keys(table)).toEqual(['a']);
        expect(table.__proto__).toBeUndefined();
    });

    test('an entry named __proto__ it starts with, deleted and rolled back', () => {
        const initial = Object.create(null);
        initial.constructor = 'c';
        initial.__proto__ = 'p';
        const journal = new ContextJournal();
        const table = journal.wrap('variables', initial);
        expect(Object.keys(table)).toEqual(['constructor', '__proto__']);
        const mark = journal.mark();
        delete table.__proto__;
        delete table.constructor;
        expect(Object.keys(table)).toEqual([]);
        expect(table.constructor).toBeUndefined();
        const saved = journal.storeAt(mark, 'variables');
        expect(Object.keys(saved).sort()).toEqual(['__proto__', 'constructor']);
        expect(saved.__proto__).toBe('p');
        journal.rollback(mark);
        expect(Object.keys(table)).toEqual(['constructor', '__proto__']);
        expect(table.__proto__).toBe('p');
        expect(table.constructor).toBe('c');
    });

    test('a table reads no names from Object.prototype', () => {
        const journal = new ContextJournal();
        const table = journal.wrap('procedures');
        expect(table.toString).toBeUndefined();
        expect('hasOwnProperty' in table).toBe(false);
        expect(JSON.stringify(table)).toBe('{}');
    });
});
