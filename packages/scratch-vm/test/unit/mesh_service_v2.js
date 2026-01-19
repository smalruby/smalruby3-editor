const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');
const {FIRE_EVENTS} = require('../../src/extensions/scratch3_mesh_v2/gql-operations');
const BlockUtility = require('../../src/engine/block-utility');

const createMockBlocks = () => ({
    runtime: {
        sequencer: {},
        emit: () => {},
        on: () => {},
        off: () => {}
    },
    opcodeFunctions: {
        event_broadcast: () => {}
    }
});

// Mock BlockUtility.lastInstance()
const originalLastInstance = BlockUtility.lastInstance;
const mockUtil = null;
BlockUtility.lastInstance = () => mockUtil;

test('MeshV2Service Batch Events', t => {
    t.test('fireEvent adds to queue', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.stopEventBatchTimer(); // Stop timer to prevent interference
        service.client = {mutate: () => Promise.resolve({})};
        service.groupId = 'group1';

        service.fireEvent('event1', 'payload1');

        // Give it a tiny bit of time if needed, though await should be enough
        st.equal(service.eventQueue.length, 1);
        st.equal(service.eventQueue[0].eventName, 'event1');
        st.equal(service.eventQueue[0].payload, 'payload1');
        st.ok(service.eventQueue[0].firedAt);

        st.end();
    });

    t.test('fireEvent deduplicates events', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.client = {mutate: () => Promise.resolve({})};
        service.groupId = 'group1';

        service.fireEvent('event1', 'payload1');
        service.fireEvent('event1', 'payload1'); // Duplicate
        service.fireEvent('event1', 'payload2'); // Different payload

        st.equal(service.eventQueue.length, 2);
        st.equal(service.eventQueue[0].eventName, 'event1');
        st.equal(service.eventQueue[0].payload, 'payload1');
        st.equal(service.eventQueue[1].eventName, 'event1');
        st.equal(service.eventQueue[1].payload, 'payload2');
        st.equal(service.eventQueueStats.duplicatesSkipped, 1);

        st.end();
    });

    t.test('fireEvent respects MAX_EVENT_QUEUE_SIZE (FIFO)', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.client = {mutate: () => Promise.resolve({})};
        service.groupId = 'group1';
        service.MAX_EVENT_QUEUE_SIZE = 5;

        for (let i = 0; i < 7; i++) {
            service.fireEvent(`event${i}`, `payload${i}`);
        }

        st.equal(service.eventQueue.length, 5);
        st.equal(service.eventQueue[0].eventName, 'event2');
        st.equal(service.eventQueue[4].eventName, 'event6');
        st.equal(service.eventQueueStats.dropped, 2);

        st.end();
    });

    t.test('processBatchEvents sends events and clears queue', async st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.stopEventBatchTimer();
        service.groupId = 'group1';

        service.client = {
            mutate: options => {
                st.equal(options.mutation, FIRE_EVENTS);
                st.equal(options.variables.events.length, 2);
                return Promise.resolve({data: {fireEventsByNode: {}}});
            }
        };

        service.eventQueue.push({eventName: 'e1', payload: 'p1', firedAt: 't1'});
        service.eventQueue.push({eventName: 'e2', payload: 'p2', firedAt: 't2'});

        await service.processBatchEvents();
        st.equal(service.eventQueue.length, 0);

        st.end();
    });

    t.test('processBatchEvents splits large batches', async st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.stopEventBatchTimer();
        service.groupId = 'group1';

        let mutateCount = 0;
        service.client = {
            mutate: options => {
                mutateCount++;
                if (mutateCount === 1) {
                    st.equal(options.variables.events.length, 1000);
                } else {
                    st.equal(options.variables.events.length, 500);
                }
                return Promise.resolve({data: {fireEventsByNode: {}}});
            }
        };

        for (let i = 0; i < 1500; i++) {
            service.eventQueue.push({eventName: 'e', payload: 'p', firedAt: 't'});
        }

        await service.processBatchEvents();
        st.equal(mutateCount, 2);
        st.equal(service.eventQueue.length, 0);

        st.end();
    });

    t.test('handleBatchEvent broadcast events with timing', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');

        const events = [
            {name: 'event1', timestamp: '2025-12-30T00:00:00.000Z'},
            {name: 'event2', timestamp: '2025-12-30T00:00:00.100Z'},
            {name: 'event3', timestamp: '2025-12-30T00:00:00.200Z'}
        ];

        const batchEvent = {
            firedByNodeId: 'node2',
            events: events
        };

        service.handleBatchEvent(batchEvent);

        // Should be queued, not broadcasted immediately
        st.equal(service.pendingBroadcasts.length, 3);
        st.equal(service.pendingBroadcasts[0].event.name, 'event1');
        st.equal(service.pendingBroadcasts[0].offsetMs, 0);
        st.equal(service.pendingBroadcasts[1].event.name, 'event2');
        st.equal(service.pendingBroadcasts[1].offsetMs, 100);
        st.equal(service.pendingBroadcasts[2].event.name, 'event3');
        st.equal(service.pendingBroadcasts[2].offsetMs, 200);

        st.end();
    });

    t.test('processNextBroadcast processes events in one frame if timing arrived and within 33ms', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';
        const broadcasted = [];
        service.broadcastEvent = event => broadcasted.push(event.name);

        // 3 events with very short gaps (all < 1ms relative to previous)
        const batchEvent = {
            firedByNodeId: 'node2',
            events: [
                {name: 'e1', timestamp: '2025-12-30T00:00:00.000Z'},
                {name: 'e2', timestamp: '2025-12-30T00:00:00.0001Z'},
                {name: 'e3', timestamp: '2025-12-30T00:00:00.0002Z'}
            ]
        };

        const realDateNow = Date.now;
        const startTime = 1000000;
        const currentTime = startTime;
        Date.now = () => currentTime;

        try {
            service.handleBatchEvent(batchEvent);
            st.equal(service.pendingBroadcasts.length, 3);

            // Frame 1: Should broadcast all events because offsetMs (0) <= elapsedMs (0)
            // and they are within 33ms window.
            service.processNextBroadcast();
            st.equal(broadcasted.length, 3);
            st.equal(broadcasted[0], 'e1');
            st.equal(broadcasted[1], 'e2');
            st.equal(broadcasted[2], 'e3');
            st.equal(service.pendingBroadcasts.length, 0);
        } finally {
            Date.now = realDateNow;
        }

        st.end();
    });

    t.test('processNextBroadcast respects 33ms window when handling backlog', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';
        const broadcasted = [];
        service.broadcastEvent = event => broadcasted.push(event.name);

        // Events spaced 20ms apart: 0ms, 20ms, 40ms, 60ms
        const batchEvent = {
            firedByNodeId: 'node2',
            events: [
                {name: 'e1', timestamp: '2025-12-30T00:00:00.000Z'}, // offset 0
                {name: 'e2', timestamp: '2025-12-30T00:00:00.020Z'}, // offset 20
                {name: 'e3', timestamp: '2025-12-30T00:00:00.040Z'}, // offset 40
                {name: 'e4', timestamp: '2025-12-30T00:00:00.060Z'} // offset 60
            ]
        };

        const realDateNow = Date.now;
        const startTime = 1000000;
        let currentTime = startTime;
        Date.now = () => currentTime;

        try {
            service.handleBatchEvent(batchEvent);
            st.equal(service.pendingBroadcasts.length, 4);

            // Simulation: Backlog exists. Current time is 100ms after start.
            // elapsedMs = 100. All events are technically "due".
            currentTime = startTime + 100;

            // Frame 1: Should process e1, e2 (within 33ms of e1). e3 is at 40ms, so it's split.
            service.processNextBroadcast();
            st.equal(broadcasted.length, 2);
            st.equal(broadcasted[0], 'e1');
            st.equal(broadcasted[1], 'e2');
            st.equal(service.pendingBroadcasts.length, 2);

            // Frame 2: Should process e3, e4 (within 33ms of e3: 40 + 33 = 73).
            service.processNextBroadcast();
            st.equal(broadcasted.length, 4);
            st.equal(broadcasted[2], 'e3');
            st.equal(broadcasted[3], 'e4');
            st.equal(service.pendingBroadcasts.length, 0);
        } finally {
            Date.now = realDateNow;
        }

        st.end();
    });

    t.test('processNextBroadcast processes many simultaneous events in one frame', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';
        const broadcasted = [];
        service.broadcastEvent = event => broadcasted.push(event.name);

        // 50 events all with the same timestamp
        const events = [];
        for (let i = 0; i < 50; i++) {
            events.push({name: `e${i}`, timestamp: '2025-12-30T00:00:00.000Z'});
        }

        const batchEvent = {
            firedByNodeId: 'node2',
            events: events
        };

        const realDateNow = Date.now;
        const startTime = 1000000;
        Date.now = () => startTime;

        try {
            service.handleBatchEvent(batchEvent);
            st.equal(service.pendingBroadcasts.length, 50);

            // All 50 should be processed in one frame because they all have offset 0
            service.processNextBroadcast();
            st.equal(broadcasted.length, 50);
            st.equal(service.pendingBroadcasts.length, 0);
        } finally {
            Date.now = realDateNow;
        }

        st.end();
    });

    t.test('cleanup does not remove BEFORE_STEP listener', st => {
        const blocks = createMockBlocks();
        let offCalled = false;
        blocks.runtime.off = event => {
            if (event === 'BEFORE_STEP') offCalled = true;
        };
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';

        st.ok(service._processNextBroadcastBound);
        service.cleanup();
        st.notOk(offCalled, 'off should not be called for BEFORE_STEP in cleanup');
        st.ok(service._processNextBroadcastBound, '_processNextBroadcastBound should still exist after cleanup');

        st.end();
    });

    t.test('processNextBroadcast does nothing when disconnected', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = null; // Disconnected

        service.pendingBroadcasts.push({event: {name: 'e1'}, offsetMs: 0});
        service.batchStartTime = Date.now();
        service.lastBroadcastOffset = 10;

        const queueLengthBefore = service.pendingBroadcasts.length;
        const batchStartBefore = service.batchStartTime;
        const offsetBefore = service.lastBroadcastOffset;

        service.processNextBroadcast();

        // When disconnected, processNextBroadcast should not modify state
        st.equal(service.pendingBroadcasts.length, queueLengthBefore,
            'Queue should remain unchanged when disconnected');
        st.equal(service.batchStartTime, batchStartBefore,
            'batchStartTime should remain unchanged when disconnected');
        st.equal(service.lastBroadcastOffset, offsetBefore,
            'lastBroadcastOffset should remain unchanged when disconnected');

        st.end();
    });

    t.test('cleanup clears event queue', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';

        service.pendingBroadcasts.push({event: {name: 'e1'}, offsetMs: 0});
        service.batchStartTime = Date.now();
        service.lastBroadcastOffset = 10;

        service.cleanup();

        st.equal(service.pendingBroadcasts.length, 0, 'Queue should be cleared by cleanup');
        st.equal(service.batchStartTime, null, 'batchStartTime should be reset by cleanup');
        st.equal(service.lastBroadcastOffset, 0, 'lastBroadcastOffset should be reset by cleanup');

        st.end();
    });

    t.test('reportEventStatsIfNeeded logs stats every 10s', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';

        const realDateNow = Date.now;
        let currentTime = 1000000;
        Date.now = () => currentTime;

        try {
            service.eventQueueStats.duplicatesSkipped = 5;
            service.eventQueueStats.dropped = 2;
            service.eventQueueStats.lastReportTime = currentTime;

            // Less than 10s
            currentTime += 5000;
            service.reportEventStatsIfNeeded();
            st.equal(service.eventQueueStats.duplicatesSkipped, 5);

            // 10s or more
            currentTime += 5001;
            service.reportEventStatsIfNeeded();
            st.equal(service.eventQueueStats.duplicatesSkipped, 0);
            st.equal(service.eventQueueStats.dropped, 0);
            st.equal(service.eventQueueStats.lastReportTime, currentTime);
        } finally {
            Date.now = realDateNow;
        }

        st.end();
    });

    t.test('cleanup reports final stats', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.eventQueueStats.duplicatesSkipped = 10;
        service.eventQueueStats.dropped = 5;

        // Note: We are just ensuring it doesn't crash and the coverage is met
        // Capturing log.info would be better but requires more setup
        service.cleanup();

        st.end();
    });

    t.test('reconnect flow: events processed after reconnect', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        const broadcasted = [];
        service.broadcastEvent = event => broadcasted.push(event.name);

        // 1. Initial connection
        service.groupId = 'group1';
        service.handleBatchEvent({
            firedByNodeId: 'node2',
            events: [{name: 'e1', timestamp: new Date().toISOString()}]
        });
        service.processNextBroadcast();
        st.equal(broadcasted.length, 1);
        st.equal(broadcasted[0], 'e1');

        // 2. Disconnect
        service.cleanup();
        st.equal(service.groupId, null);
        st.ok(service._processNextBroadcastBound, 'Listener bound function still exists');

        // 3. Reconnect
        service.groupId = 'group2';
        service.handleBatchEvent({
            firedByNodeId: 'node2',
            events: [{name: 'e2', timestamp: new Date().toISOString()}]
        });

        // Simulating BEFORE_STEP call
        service._processNextBroadcastBound();

        st.equal(broadcasted.length, 2);
        st.equal(broadcasted[1], 'e2');

        st.end();
    });

    t.test('cleanup', st => {
        // Restore original method
        BlockUtility.lastInstance = originalLastInstance;
        st.end();
    });

    t.end();
});
