const test = require('tap').test;
const RateLimiter = require('../../src/extensions/scratch3_mesh_v2/rate-limiter');

test('RateLimiter Basic', t => {
    const limiter = new RateLimiter(10);
    let count = 0;
    
    const pendingResolves = [];
    const slowSendFn = data => {
        count += data;
        return new Promise(resolve => {
            pendingResolves.push(resolve);
        });
    };

    limiter.send(1, slowSendFn);
    limiter.send(2, slowSendFn);

    t.equal(limiter.queue.length, 1, 'Item 2 should be in queue');
    t.ok(limiter.processing, 'Limiter should be processing item 1');
    
    // Resolve all items as they come
    const interval = setInterval(() => {
        if (pendingResolves.length > 0) {
            const resolve = pendingResolves.shift();
            resolve();
        }
    }, 50);
    
    return limiter.waitForCompletion().then(() => {
        clearInterval(interval);
        t.equal(count, 3, 'Both items should be processed');
        t.equal(limiter.queue.length, 0, 'Queue should be empty');
        t.end();
    });
});

test('RateLimiter Merge Feature', t => {
    const limiter = new RateLimiter(10, {
        enableMerge: true,
        mergeKeyField: 'key'
    });
    
    const sentData = [];
    const pendingResolves = [];
    
    const slowSendFn = data => {
        // Clone data to avoid reference changes in tests
        sentData.push(JSON.parse(JSON.stringify(data)));
        return new Promise(resolve => {
            pendingResolves.push(resolve);
        });
    };

    // Send 1: starts processing
    limiter.send([{key: 'var1', value: 1}], slowSendFn);
    
    // Send 2 & 3: should be merged into ONE item in queue
    limiter.send([{key: 'var1', value: 2}], slowSendFn);
    limiter.send([{key: 'var1', value: 3}], slowSendFn);

    t.equal(limiter.queue.length, 1, 'Queue should have 1 item (merged send 2 & 3)');
    t.equal(limiter.queue[0].data[0].value, 3, 'Latest value should be in queue');

    // Resolve items as they come
    const interval = setInterval(() => {
        if (pendingResolves.length > 0) {
            const resolve = pendingResolves.shift();
            resolve(true);
        }
    }, 50);

    // After Send 1 finishes, Send 2/3 (merged) will start after interval
    return limiter.waitForCompletion().then(() => {
        clearInterval(interval);
        t.equal(sentData.length, 2, 'Total 2 sends: Send 1 + Merged(Send 2, Send 3)');
        t.same(sentData[0], [{key: 'var1', value: 1}]);
        t.same(sentData[1], [{key: 'var1', value: 3}]);
        t.end();
    });
});

test('RateLimiter Merge Different Keys in same Send', t => {

    const limiter = new RateLimiter(10, {

        enableMerge: true,

        mergeKeyField: 'key'

    });
    

    const pendingResolves = [];

    const slowSendFn = () => new Promise(resolve => {
        pendingResolves.push(resolve);
    });


    // Send 1

    limiter.send([{key: 'v1', value: 1}], slowSendFn);
    

    // Send 2: updates v1, adds v2

    limiter.send([{key: 'v1', value: 2}, {key: 'v2', value: 10}], slowSendFn);


    t.equal(limiter.queue.length, 1);

    t.equal(limiter.queue[0].data.length, 2);
    

    const v1 = limiter.queue[0].data.find(i => i.key === 'v1');

    const v2 = limiter.queue[0].data.find(i => i.key === 'v2');

    t.equal(v1.value, 2);

    t.equal(v2.value, 10);


    // Resolve items as they come

    const interval = setInterval(() => {

        if (pendingResolves.length > 0) {

            const resolve = pendingResolves.shift();

            resolve(true);

        }

    }, 50);


    return limiter.waitForCompletion().then(() => {

        clearInterval(interval);

        t.end();

    });

});
