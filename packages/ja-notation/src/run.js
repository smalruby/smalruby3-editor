// SPDX-License-Identifier: MIT
// ja-notation: run a walk of a syntax tree written as generators, with a
// stack of its own instead of the call stack. See ../LICENSE.
//
// A syntax tree is as deep as the program: an expression of thousands of
// terms (`1 + 1 + ... + 1`), a long chain of signs or parentheses, or blocks
// in blocks. Walked by recursion, each level takes a frame of the call stack
// of JavaScript, which runs out at some thousands (RangeError). The walks of
// this library are written as generator functions instead: where they would
// call themselves on a child, they `yield` the walk of the child and are
// given back its result, and `run` keeps the walks that wait for a child on an
// array. The depth of the tree then only takes memory.
//
//     *expression(e) {
//         const left = yield this.expression(e.left);   // not this.expression(e.left)
//         ...
//     }
//     const ruby = run(builder.expression(e));

/**
 * Run a walk (a generator) to its end and give its result. A walk yields the
 * walks it needs the results of (generators); each runs before the walk goes on
 * with its result. An error thrown in a walk is thrown into the walk that
 * waits for it, and out of `run` when no walk catches it.
 * @param {object} walk - The walk (a generator).
 * @returns {unknown} What the walk returns.
 */
const run = (walk) => {
    const stack = [walk];
    let value = null;
    let failed = false;
    let error;
    while (stack.length > 0) {
        const top = stack[stack.length - 1];
        let step;
        try {
            step = failed ? top.throw(error) : top.next(value);
            failed = false;
        } catch (e) {
            stack.pop();
            failed = true;
            error = e;
            continue;
        }
        if (step.done) {
            stack.pop();
            value = step.value;
        } else {
            stack.push(step.value);
            value = null;
        }
    }
    if (failed) throw error;
    return value;
};

/**
 * The walk of each item of a list, one after another, and the results.
 * @param {Array<unknown>} items - The items.
 * @param {function(unknown, number): object} walkOf - The walk of an item.
 * @yields {object} The walk of each item.
 * @returns {Array<unknown>} The results, in the order of the items.
 */
const each = function* (items, walkOf) {
    const results = [];
    for (let i = 0; i < items.length; i++) results.push(yield walkOf(items[i], i));
    return results;
};

export { each, run };
