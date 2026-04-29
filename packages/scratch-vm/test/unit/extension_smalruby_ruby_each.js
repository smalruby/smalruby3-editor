const test = require('tap').test;

const { executeArrayMethodWithBlock } = require('../../src/extensions/smalruby_ruby/block-method-executors');

/**
 * Build a util/list pair for testing the each executor.
 *
 * The list is keyed by ID/name; lookupOrCreateList returns the same instance
 * across calls so multiple iteration steps share a single list.
 * @param {Array} listValue - Items in the list.
 * @param {object} extraArgs - Additional args merged with RECEIVER/METHOD/LIST_ID/LIST_NAME.
 * @returns {{args: object, util: object, list: object, calls: object[], runUntilDone: Function}} Test harness.
 */
const setupArrayEach = (listValue, extraArgs = {}) => {
    const list = {
        id: 'list-a',
        name: 'a',
        value: listValue.slice(),
    };
    const calls = [];
    const util = {
        thread: {},
        target: {
            lookupOrCreateList: (id, name) => {
                if (id === list.id && name === list.name) return list;
                throw new Error(`unexpected list lookup: ${id}/${name}`);
            },
        },
        stackFrame: {},
        startBranch: () => {
            calls.push({
                returnValue: util.thread._smalrubyReturnValue,
                blockParam1: util.thread._smalrubyBlockParams ? util.thread._smalrubyBlockParams._1 : undefined,
            });
        },
    };
    const args = Object.assign(
        {
            RECEIVER: list.value.join(' '),
            METHOD: 'each',
            LIST_ID: list.id,
            LIST_NAME: list.name,
        },
        extraArgs,
    );
    const setReturnValue = (u, value) => {
        u.thread._smalrubyReturnValue = value;
    };
    const runUntilDone = () => {
        for (let i = 0; i < 100; i++) {
            const before = calls.length;
            executeArrayMethodWithBlock(args, util, setReturnValue);
            if (calls.length === before) break;
        }
    };
    return { args, util, list, calls, runUntilDone };
};

test('Array#each: iterates [1, 2, 3] sequentially when LIST_ID is provided', t => {
    // RECEIVER would be the joined "123" (single-char items concatenated by data_listcontents).
    // The executor must ignore RECEIVER and use LIST_ID/LIST_NAME to read the list directly.
    const { calls, runUntilDone } = setupArrayEach(['1', '2', '3'], {
        RECEIVER: '123',
    });

    runUntilDone();

    t.equal(calls.length, 3, 'should iterate 3 times');
    t.equal(calls[0].blockParam1, '1');
    t.equal(calls[1].blockParam1, '2');
    t.equal(calls[2].blockParam1, '3');
    t.end();
});

test('Array#each: iterates strings containing spaces correctly via LIST_ID', t => {
    // RECEIVER would be "hello world foo" (joined with space) which would mis-split.
    const { calls, runUntilDone } = setupArrayEach(['hello world', 'foo'], {
        RECEIVER: 'hello world foo',
    });

    runUntilDone();

    t.equal(calls.length, 2, 'should iterate 2 times');
    t.equal(calls[0].blockParam1, 'hello world');
    t.equal(calls[1].blockParam1, 'foo');
    t.end();
});

test('Array#each: snapshots list at first call (mutation during iteration is ignored)', t => {
    const harness = setupArrayEach(['a', 'b', 'c']);
    const { args, util, list, calls } = harness;
    const setReturnValue = (u, value) => {
        u.thread._smalrubyReturnValue = value;
    };

    let mutated = false;
    util.startBranch = () => {
        calls.push({ blockParam1: util.thread._smalrubyBlockParams._1 });
        if (!mutated) {
            list.value.push('d');
            list.value.push('e');
            mutated = true;
        }
    };

    for (let i = 0; i < 100; i++) {
        const before = calls.length;
        executeArrayMethodWithBlock(args, util, setReturnValue);
        if (calls.length === before) break;
    }

    t.equal(calls.length, 3, 'should still iterate 3 times despite mutation');
    t.equal(calls[0].blockParam1, 'a');
    t.equal(calls[1].blockParam1, 'b');
    t.equal(calls[2].blockParam1, 'c');
    t.end();
});

test('Array#each: empty list does not invoke substack', t => {
    const { calls, runUntilDone } = setupArrayEach([], { RECEIVER: '' });

    runUntilDone();

    t.equal(calls.length, 0, 'should not iterate for empty list');
    t.end();
});

test('Array#each: falls back to RECEIVER split when LIST_ID is absent', t => {
    // Backward compatibility: receiver is a string literal or scalar variable,
    // so LIST_ID is not set. Fall back to space-split behavior.
    const calls = [];
    const util = {
        thread: {},
        target: {
            lookupOrCreateList: () => {
                throw new Error('should not be called when LIST_ID is absent');
            },
        },
        stackFrame: {},
        startBranch: () => {
            calls.push({ blockParam1: util.thread._smalrubyBlockParams._1 });
        },
    };
    const args = {
        RECEIVER: 'hello world',
        METHOD: 'each',
    };
    const setReturnValue = (u, value) => {
        u.thread._smalrubyReturnValue = value;
    };

    for (let i = 0; i < 100; i++) {
        const before = calls.length;
        executeArrayMethodWithBlock(args, util, setReturnValue);
        if (calls.length === before) break;
    }

    t.equal(calls.length, 2);
    t.equal(calls[0].blockParam1, 'hello');
    t.equal(calls[1].blockParam1, 'world');
    t.end();
});
