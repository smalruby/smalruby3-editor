const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');

const createMockBlocks = () => ({
    runtime: {
        sequencer: {},
        emit: () => {},
        on: () => {},
        off: () => {},
        getTargetForStage: () => ({
            variables: {},
        }),
    },
    opcodeFunctions: {
        event_broadcast: () => {},
    },
});

test('MeshV2Service orderKey generation (issue #556)', t => {
    t.test('_generateOrderKey produces YYYYMMDDHHMMSS-NNNNNNN format', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.eventSequence = 0;

        const date = new Date('2026-04-28T09:00:00');
        const key = service._generateOrderKey(date);

        // Local-time interpretation: format must be 14 digits + - + 7 digits
        st.match(key, /^\d{14}-\d{7}$/, 'matches YYYYMMDDHHMMSS-NNNNNNN');
        st.equal(key.endsWith('-0000001'), true, 'starts at sequence 0000001');
        st.end();
    });

    t.test('eventSequence increments per call within the same second', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.eventSequence = 0;

        const date = new Date('2026-04-28T09:00:00');
        const k1 = service._generateOrderKey(date);
        const k2 = service._generateOrderKey(date);
        const k3 = service._generateOrderKey(date);

        st.equal(k1.split('-')[1], '0000001');
        st.equal(k2.split('-')[1], '0000002');
        st.equal(k3.split('-')[1], '0000003');
        // Lexicographic sort matches generation order
        st.same([...[k3, k1, k2]].sort(), [k1, k2, k3]);
        st.end();
    });

    t.test('sequence does not reset across seconds (continues monotonically)', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.eventSequence = 0;

        const k1 = service._generateOrderKey(new Date('2026-04-28T09:00:00'));
        const k2 = service._generateOrderKey(new Date('2026-04-28T09:00:01'));

        st.equal(k1.split('-')[1], '0000001');
        st.equal(k2.split('-')[1], '0000002');
        st.end();
    });

    t.test('fireEvent attaches orderKey to queued event', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'group1';
        service.client = { mutate: () => Promise.resolve({ data: {} }) };
        service.eventSequence = 0;

        service.fireEvent('hello', '');
        st.equal(service.eventQueue.length, 1);
        const queued = service.eventQueue[0];
        st.match(queued.orderKey, /^\d{14}-0000001$/);
        st.equal(queued.eventName, 'hello');
        st.ok(queued.firedAt);
        st.end();
    });

    t.test('eventSequence above 999 keeps lexicographic order (no overflow)', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.eventSequence = 998; // next call → 999, then 1000

        const date = new Date('2026-04-28T09:00:00');
        const k999 = service._generateOrderKey(date);
        const k1000 = service._generateOrderKey(date);
        const k9999999 = (() => {
            service.eventSequence = 9999998;
            return service._generateOrderKey(date);
        })();

        st.equal(k999.split('-')[1], '0000999');
        st.equal(k1000.split('-')[1], '0001000');
        st.equal(k9999999.split('-')[1], '9999999');
        // 7-digit padding keeps lexicographic order across the 999→1000 boundary
        st.ok(k999 < k1000, '0000999 < 0001000 in lex order');
        st.end();
    });

    t.test('createGroup resets eventSequence to 0', async st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.eventSequence = 5;
        service.testWebSocket = () => Promise.resolve(true);
        service.client = {
            mutate: () =>
                Promise.resolve({
                    data: {
                        createGroup: {
                            id: 'g1',
                            domain: 'domain1',
                            name: 'G1',
                            expiresAt: '2099-01-01T00:00:00Z',
                            heartbeatIntervalSeconds: 60,
                            useWebSocket: true,
                            pollingIntervalSeconds: null,
                        },
                    },
                }),
            subscribe: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        };

        await service.createGroup('G1');
        st.equal(service.eventSequence, 0, 'sequence reset on createGroup');
        service.cleanup();
        st.end();
    });

    t.test('joinGroup resets eventSequence to 0', async st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.eventSequence = 7;
        service.client = {
            mutate: () =>
                Promise.resolve({
                    data: {
                        joinGroup: {
                            id: 'node1',
                            name: 'Node node1',
                            groupId: 'g1',
                            domain: 'd1',
                            expiresAt: '2099-01-01T00:00:00Z',
                            heartbeatIntervalSeconds: 120,
                            useWebSocket: true,
                            pollingIntervalSeconds: null,
                        },
                    },
                }),
            query: () => Promise.resolve({ data: { listGroupStatuses: [] } }),
            subscribe: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        };

        await service.joinGroup('g1', 'd1', 'G1');
        st.equal(service.eventSequence, 0, 'sequence reset on joinGroup');
        service.cleanup();
        st.end();
    });

    t.end();
});

test('MeshV2Service _queueEventsForPlayback stable sort (issue #556)', t => {
    t.test('events with same timestamp are ordered by orderKey', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');

        // Server returns events in arbitrary order (e.g. UUID-shuffled)
        // but same timestamp; orderKey should restore send order.
        const events = [
            { name: 'b', timestamp: '2026-04-28T00:00:00Z', orderKey: '20260428090000-002', firedByNodeId: 'other' },
            { name: 'c', timestamp: '2026-04-28T00:00:00Z', orderKey: '20260428090000-003', firedByNodeId: 'other' },
            { name: 'a', timestamp: '2026-04-28T00:00:00Z', orderKey: '20260428090000-001', firedByNodeId: 'other' },
        ];
        service._queueEventsForPlayback(events);
        const order = service.pendingBroadcasts.map(b => b.event.name);
        st.same(order, ['a', 'b', 'c']);
        st.end();
    });

    t.test('events with different timestamps sort by timestamp first', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');

        const events = [
            {
                name: 'late',
                timestamp: '2026-04-28T00:00:02Z',
                orderKey: '20260428090002-001',
                firedByNodeId: 'other',
            },
            {
                name: 'early',
                timestamp: '2026-04-28T00:00:00Z',
                orderKey: '20260428090000-099',
                firedByNodeId: 'other',
            },
            {
                name: 'middle',
                timestamp: '2026-04-28T00:00:01Z',
                orderKey: '20260428090001-001',
                firedByNodeId: 'other',
            },
        ];
        service._queueEventsForPlayback(events);
        const order = service.pendingBroadcasts.map(b => b.event.name);
        st.same(order, ['early', 'middle', 'late']);
        st.end();
    });

    t.test('events without orderKey use timestamp-only comparison (backward compat)', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');

        // Old-client events (no orderKey) with same timestamp:
        // sort is stable in V8 so original input order is preserved.
        const events = [
            { name: 'first', timestamp: '2026-04-28T00:00:00Z', firedByNodeId: 'other' },
            { name: 'second', timestamp: '2026-04-28T00:00:00Z', firedByNodeId: 'other' },
            { name: 'third', timestamp: '2026-04-28T00:00:00Z', firedByNodeId: 'other' },
        ];
        service._queueEventsForPlayback(events);
        const order = service.pendingBroadcasts.map(b => b.event.name);
        st.same(order, ['first', 'second', 'third']);
        st.end();
    });

    t.test(
        'mix of orderKey present and absent: orderKey-having pairs sort, others fall back to original order',
        st => {
            const blocks = createMockBlocks();
            const service = new MeshV2Service(blocks, 'node1', 'domain1');

            // When sort comparator returns 0 (one side missing orderKey), V8's
            // stable sort keeps the input order. So if input is [no-key, key]
            // with the same timestamp, output = [no-key, key].
            const events = [
                { name: 'no-key', timestamp: '2026-04-28T00:00:00Z', firedByNodeId: 'other' },
                {
                    name: 'with-key',
                    timestamp: '2026-04-28T00:00:00Z',
                    orderKey: '20260428090000-001',
                    firedByNodeId: 'other',
                },
            ];
            service._queueEventsForPlayback(events);
            const order = service.pendingBroadcasts.map(b => b.event.name);
            st.same(order, ['no-key', 'with-key']);
            st.end();
        },
    );

    t.end();
});
