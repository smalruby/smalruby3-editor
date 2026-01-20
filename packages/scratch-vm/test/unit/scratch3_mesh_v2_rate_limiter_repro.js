const test = require('tap').test;
const RateLimiter = require('../../src/extensions/scratch3_mesh_v2/rate-limiter');
const log = require('../../src/util/log');

// Disable logging for test to avoid timeout
log.debug = () => {};
log.info = () => {};

test('RateLimiter stack overflow reproduction', {timeout: 60000}, async t => {
    // intervalMs: 250ms, enableMerge: true
    const limiter = new RateLimiter(250, {enableMerge: true});
    
    // Immediate sendFunction
    const sendFunction = d => Promise.resolve(d);

    const promises = [];

    // 15000 merges is usually enough to trigger stack overflow in Node.js
    const MERGE_COUNT = 15000;

    console.log(`Starting ${MERGE_COUNT} merges...`);

    for (let i = 0; i < MERGE_COUNT; i++) {
        promises.push(limiter.send([{key: 'var1', value: i}], sendFunction));
    }

    console.log('Finished pushing to queue. Waiting for completion...');

    try {
        await Promise.all(promises);
        t.pass('Completed without stack overflow');
    } catch (e) {
        if (e.message === 'Maximum call stack size exceeded') {
            t.fail(`Stack overflow occurred: ${e.message}`);
        } else {
            t.fail(`Failed with unexpected error: ${e.message}`);
        }
    }

    t.end();
});
