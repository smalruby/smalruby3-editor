const test = require('tap').test;

const {
    executeArrayMethodWithBlock,
    executeHashMethodWithBlock,
} = require('../../src/extensions/smalruby_ruby/block-method-executors');

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

test('Array#each: iterates [1, 2, 3] sequentially when LIST_ID is provided', (t) => {
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

test('Array#each: iterates strings containing spaces correctly via LIST_ID', (t) => {
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

test('Array#each: snapshots list at first call (mutation during iteration is ignored)', (t) => {
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

test('Array#each: empty list does not invoke substack', (t) => {
    const { calls, runUntilDone } = setupArrayEach([], { RECEIVER: '' });

    runUntilDone();

    t.equal(calls.length, 0, 'should not iterate for empty list');
    t.end();
});

/**
 * Build a util/two-list pair for testing the hash each executor.
 * @param {Array} keysValue - Keys list contents.
 * @param {Array} valuesValue - Values list contents.
 * @returns {{args: object, util: object, calls: object[], runUntilDone: Function}} Test harness.
 */
const setupHashEach = (keysValue, valuesValue) => {
    const keysList = {
        id: 'list-h-keys',
        name: 'h_keys',
        value: keysValue.slice(),
    };
    const valuesList = {
        id: 'list-h-values',
        name: 'h_values',
        value: valuesValue.slice(),
    };
    const calls = [];
    const util = {
        thread: {},
        target: {
            lookupOrCreateList: (id, name) => {
                if (id === keysList.id && name === keysList.name) return keysList;
                if (id === valuesList.id && name === valuesList.name) return valuesList;
                throw new Error(`unexpected list lookup: ${id}/${name}`);
            },
        },
        stackFrame: {},
        startBranch: () => {
            calls.push({
                blockParam1: util.thread._smalrubyBlockParams ? util.thread._smalrubyBlockParams._1 : undefined,
                blockParam2: util.thread._smalrubyBlockParams ? util.thread._smalrubyBlockParams._2 : undefined,
            });
        },
    };
    const args = {
        METHOD: 'each',
        KEYS_LIST_ID: keysList.id,
        KEYS_LIST_NAME: keysList.name,
        VALUES_LIST_ID: valuesList.id,
        VALUES_LIST_NAME: valuesList.name,
    };
    const setReturnValue = (u, value) => {
        u.thread._smalrubyReturnValue = value;
    };
    const runUntilDone = () => {
        for (let i = 0; i < 100; i++) {
            const before = calls.length;
            executeHashMethodWithBlock(args, util, setReturnValue);
            if (calls.length === before) break;
        }
    };
    return { args, util, keysList, valuesList, calls, runUntilDone };
};

test('Hash#each: iterates {a: 1, b: 2} with parallel keys/values', (t) => {
    const { calls, runUntilDone } = setupHashEach(['a', 'b'], ['1', '2']);

    runUntilDone();

    t.equal(calls.length, 2, 'should iterate 2 times');
    t.equal(calls[0].blockParam1, 'a');
    t.equal(calls[0].blockParam2, '1');
    t.equal(calls[1].blockParam1, 'b');
    t.equal(calls[1].blockParam2, '2');
    t.end();
});

test('Hash#each: handles single-char values that would collapse via data_listcontents', (t) => {
    // {a: 1, b: 2, c: 3} — all single-char items → data_listcontents joins
    // with no separator. Verify direct list access is used.
    const { calls, runUntilDone } = setupHashEach(['a', 'b', 'c'], ['1', '2', '3']);

    runUntilDone();

    t.equal(calls.length, 3);
    t.equal(calls[0].blockParam1, 'a');
    t.equal(calls[0].blockParam2, '1');
    t.equal(calls[2].blockParam1, 'c');
    t.equal(calls[2].blockParam2, '3');
    t.end();
});

test('Hash#each: empty hash does not invoke substack', (t) => {
    const { calls, runUntilDone } = setupHashEach([], []);

    runUntilDone();

    t.equal(calls.length, 0);
    t.end();
});

test('Hash#each: snapshots both lists at first call (mutation ignored)', (t) => {
    const harness = setupHashEach(['a', 'b'], ['1', '2']);
    const { args, util, keysList, valuesList, calls } = harness;
    const setReturnValue = (u, value) => {
        u.thread._smalrubyReturnValue = value;
    };
    let mutated = false;
    util.startBranch = () => {
        calls.push({
            blockParam1: util.thread._smalrubyBlockParams._1,
            blockParam2: util.thread._smalrubyBlockParams._2,
        });
        if (!mutated) {
            keysList.value.push('c');
            valuesList.value.push('3');
            mutated = true;
        }
    };
    for (let i = 0; i < 100; i++) {
        const before = calls.length;
        executeHashMethodWithBlock(args, util, setReturnValue);
        if (calls.length === before) break;
    }
    t.equal(calls.length, 2, 'still iterates only the original 2 entries');
    t.end();
});

test('Hash#each: keys list shorter than values list — iterate min of both', (t) => {
    // Defensive behavior when the two lists are inconsistent. Iterate up to
    // the shorter length to avoid undefined values.
    const { calls, runUntilDone } = setupHashEach(['a', 'b'], ['1', '2', '3']);

    runUntilDone();

    t.equal(calls.length, 2, 'should iterate 2 times (min of 2 and 3)');
    t.equal(calls[0].blockParam1, 'a');
    t.equal(calls[0].blockParam2, '1');
    t.equal(calls[1].blockParam1, 'b');
    t.equal(calls[1].blockParam2, '2');
    t.end();
});

test('Array#each: falls back to RECEIVER split when LIST_ID is absent', (t) => {
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
