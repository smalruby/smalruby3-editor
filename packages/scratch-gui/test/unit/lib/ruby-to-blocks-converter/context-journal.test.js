/**
 * Rolling back a conversion attempt (`_saveContext` / `_restoreContext`) with the record of the
 * writes (`context-journal.js`) must leave the tables exactly as putting a copy back did:
 * the same keys, the same values (the same objects) and the same order of the keys.
 */
import { ContextJournal, JOURNALED_STORES } from '../../../../src/lib/ruby-to-blocks-converter/context-journal';
import { makeConverter, makeSpriteTarget } from '../../helpers/ruby-roundtrip-helper';

/**
 * The tables as [key, value] pairs in order, to compare the order and the objects.
 * @param {object} context - The context (or an object with the same tables).
 * @param {string[]} names - The names of the tables.
 * @returns {object} name -> [[key, value], ...].
 */
const entriesOf = (context, names) => {
    const result = {};
    names.forEach((name) => {
        result[name] = Object.keys(context[name]).map((key) => [key, context[name][key]]);
    });
    return result;
};

/**
 * The way the tables were rolled back before the journal: copy them, and put the copy back
 * (drop the keys made since, set the copied keys again in their order).
 */
const copyRollback = {
    save(tables) {
        const saved = {};
        Object.keys(tables).forEach((name) => {
            saved[name] = Object.assign({}, tables[name]);
        });
        return saved;
    },
    restore(tables, saved) {
        Object.keys(saved).forEach((name) => {
            Object.keys(tables[name]).forEach((key) => {
                if (!Object.prototype.hasOwnProperty.call(saved[name], key)) delete tables[name][key];
            });
            Object.keys(saved[name]).forEach((key) => {
                tables[name][key] = saved[name][key];
            });
        });
    },
};

/**
 * A small random number generator, so that a failure can be reproduced from the seed.
 * @param {number} seed - The seed.
 * @returns {function(): number} A function returning numbers in [0, 1).
 */
const randomOf = (seed) => {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
    };
};

describe('ContextJournal', () => {
    test('rolls back new, replaced and deleted keys', () => {
        const journal = new ContextJournal();
        const a = { id: 'a' };
        const b = { id: 'b' };
        const blocks = journal.wrap('blocks', { a, b });
        const mark = journal.mark();
        blocks.c = { id: 'c' };
        blocks.a = { id: 'a2' };
        delete blocks.b;
        const { removedBlockIds } = journal.rollback(mark);
        expect(Object.keys(blocks)).toEqual(['a', 'b']);
        expect(blocks.a).toBe(a);
        expect(blocks.b).toBe(b);
        expect(removedBlockIds).toEqual(['c']);
    });

    test('puts deleted keys back at the end in the order they had', () => {
        const journal = new ContextJournal();
        const blocks = journal.wrap('blocks', { a: 1, b: 2, c: 3, d: 4 });
        const mark = journal.mark();
        delete blocks.c;
        delete blocks.a;
        blocks.e = 5;
        journal.rollback(mark);
        // Like putting a copy back: the kept keys stay, the deleted ones come after them.
        expect(Object.keys(blocks)).toEqual(['b', 'd', 'a', 'c']);
    });

    test('rolls back nested attempts', () => {
        const journal = new ContextJournal();
        const variables = journal.wrap('variables', { x: 1 });
        const outer = journal.mark();
        variables.y = 2;
        const inner = journal.mark();
        variables.z = 3;
        delete variables.x;
        journal.rollback(inner);
        expect(Object.assign({}, variables)).toEqual({ x: 1, y: 2 });
        variables.w = 4;
        journal.rollback(outer);
        expect(Object.assign({}, variables)).toEqual({ x: 1 });
    });

    test('keeps the order of the outer mark for a key added again inside an inner attempt', () => {
        const journal = new ContextJournal();
        const comments = journal.wrap('comments', { a: 1, b: 2 });
        const outer = journal.mark();
        const inner = journal.mark();
        delete comments.a;
        comments.a = 1;
        journal.rollback(inner);
        delete comments.b;
        delete comments.a;
        journal.rollback(outer);
        // Putting the copy of `outer` back adds `a` and `b` again in the order they had then.
        expect(Object.keys(comments)).toEqual(['a', 'b']);
    });

    test('throws when rolling back to a mark that rolling back to an earlier mark rolled away', () => {
        const journal = new ContextJournal();
        const blocks = journal.wrap('blocks', { a: 1 });
        const outer = journal.mark();
        blocks.b = 2;
        const inner = journal.mark();
        blocks.c = 3;
        journal.rollback(outer);
        // The writes after `inner` are gone from the record, so the tables at `inner` cannot be made again.
        expect(() => journal.rollback(inner)).toThrow(/rolled back/);
        expect(() => journal.storeAt(inner, 'blocks')).toThrow(/rolled back/);
        expect(Object.assign({}, blocks)).toEqual({ a: 1 });
        // A mark taken after that rollback can be used.
        const next = journal.mark();
        blocks.d = 4;
        journal.rollback(next);
        journal.rollback(outer);
        expect(Object.assign({}, blocks)).toEqual({ a: 1 });
    });

    test('rolling back twice to the same mark gives the same tables', () => {
        const journal = new ContextJournal();
        const lists = journal.wrap('lists', { a: 1 });
        const mark = journal.mark();
        lists.b = 2;
        journal.rollback(mark);
        journal.rollback(mark);
        expect(Object.assign({}, lists)).toEqual({ a: 1 });
    });

    test('storeAt gives the table at a mark without changing it', () => {
        const journal = new ContextJournal();
        const one = { name: 'one' };
        const variables = journal.wrap('variables', { one });
        const mark = journal.mark();
        variables.two = { name: 'two' };
        delete variables.one;
        expect(journal.storeAt(mark, 'variables')).toEqual({ one });
        expect(journal.storeAt(mark, 'variables').one).toBe(one);
        expect(Object.keys(variables)).toEqual(['two']);
    });

    test.each([1, 2, 3, 4, 5, 6, 7, 8])('gives the same tables as putting a copy back (seed %i)', (seed) => {
        const random = randomOf(seed);
        const names = ['blocks', 'comments'];
        const journal = new ContextJournal();
        const journaled = {};
        const copied = {};
        names.forEach((name) => {
            journaled[name] = journal.wrap(name, { k0: { v: 0 }, k1: { v: 1 } });
            copied[name] = { k0: journaled[name].k0, k1: journaled[name].k1 };
        });
        // Each open attempt: [journal mark, copy]
        const open = [];
        let value = 2;
        for (let step = 0; step < 400; step++) {
            const r = random();
            const name = names[Math.floor(random() * names.length)];
            const key = `k${Math.floor(random() * 12)}`;
            if (r < 0.15) {
                open.push([journal.mark(), copyRollback.save(copied)]);
            } else if (r < 0.25 && open.length > 0) {
                // Roll back the latest attempt, or one further out (never an attempt inside one
                // that was already rolled back: the converter does not do that).
                const index = Math.floor(random() * open.length);
                const [mark, saved] = open[index];
                open.length = index;
                journal.rollback(mark);
                copyRollback.restore(copied, saved);
            } else if (r < 0.65) {
                const obj = { v: value++ };
                journaled[name][key] = obj;
                copied[name][key] = obj;
            } else {
                delete journaled[name][key];
                delete copied[name][key];
            }
            expect(entriesOf(journaled, names)).toEqual(entriesOf(copied, names));
            for (const [k, v] of Object.entries(copied.blocks)) {
                expect(journaled.blocks[k]).toBe(v);
            }
        }
    });
});

describe('RubyToBlocksConverter/_restoreContext', () => {
    let converter;
    let target;

    beforeEach(() => {
        const sprite = makeSpriteTarget();
        target = sprite.target;
        converter = makeConverter(target, sprite.runtime, { version: '2' });
    });

    test('puts every table back after an attempt that was given up', async () => {
        // Make some blocks, comments and variables first.
        expect(
            await converter.targetCodeToBlocks(
                target,
                'when_flag_clicked do\n  @a = 1\n  move(@a) # move\n  say("hi")\nend\n',
            ),
        ).toBe(true);
        const ctx = converter._context;
        const before = entriesOf(ctx, JOURNALED_STORES);
        const keptBlock = Object.values(ctx.blocks).find((block) => !block.comment);
        const removedBlockId = Object.keys(ctx.blocks)[0];
        const removedCommentId = Object.keys(ctx.comments)[0];
        const anyVariable = Object.keys(ctx.variables)[0];

        const copy = copyRollback.save(Object.fromEntries(JOURNALED_STORES.map((name) => [name, ctx[name]])));
        const saved = converter._saveContext();
        // A failed attempt: new blocks with a comment, a kept block given a new comment,
        // deleted and replaced entries, a new variable, list and procedure.
        const made = converter._createBlock('motion_movesteps', 'statement', { comment: 'new' });
        converter._createBlock('looks_say', 'statement');
        keptBlock.comment = converter._createComment('on a kept block', keptBlock.id);
        delete ctx.blocks[removedBlockId];
        delete ctx.comments[removedCommentId];
        ctx.variables[anyVariable] = { name: 'replaced' };
        converter._lookupOrCreateVariable('@b');
        ctx.lists.l = { name: 'l' };
        ctx.procedures.p = { name: 'p' };
        ctx.literalCallIndices.true = 9;
        // What putting the copy back gives (the deleted block and comment come back at the end).
        const expected = copyRollback.save(Object.fromEntries(JOURNALED_STORES.map((name) => [name, ctx[name]])));
        copyRollback.restore(expected, copy);
        converter._restoreContext(saved);

        expect(entriesOf(ctx, JOURNALED_STORES)).toEqual(entriesOf(expected, JOURNALED_STORES));
        JOURNALED_STORES.forEach((name) => {
            Object.keys(expected[name]).forEach((key) => expect(ctx[name][key]).toBe(expected[name][key]));
        });
        // The same entries as before the attempt.
        JOURNALED_STORES.forEach((name) => {
            expect(Object.keys(ctx[name]).sort()).toEqual(before[name].map(([key]) => key).sort());
            before[name].forEach(([key, value]) => expect(ctx[name][key]).toBe(value));
        });
        expect(ctx.blocks[made.id]).toBeUndefined();
        expect(keptBlock.comment).toBeUndefined();
        expect([...ctx.nodeToBlockMap.values()].every((id) => ctx.blocks[id])).toBe(true);
    });

    test('throws for an inner point used after rolling back to an outer one', () => {
        const outer = converter._saveContext();
        converter._createBlock('motion_movesteps', 'statement');
        const inner = converter._saveContext();
        converter._createBlock('looks_say', 'statement');
        converter._restoreContext(outer);
        expect(() => converter._restoreContext(inner)).toThrow(/rolled back/);
    });

    test('a conversion that fails partway leaves no block from the failed statement', async () => {
        // `x = 1` first tries `x=` as a writer method, rolls that back and converts it as
        // an assignment; the value is converted twice but only the second result is kept.
        expect(await converter.targetCodeToBlocks(target, 'x = false\nsay(x)\n')).toBe(true);
        const ctx = converter._context;
        Object.values(ctx.blocks).forEach((block) => {
            expect(block.topLevel || ctx.blocks[block.parent]).toBeTruthy();
        });
        Object.values(ctx.comments).forEach((comment) => {
            expect(comment.blockId === null || ctx.blocks[comment.blockId]).toBeTruthy();
        });
    });
});
