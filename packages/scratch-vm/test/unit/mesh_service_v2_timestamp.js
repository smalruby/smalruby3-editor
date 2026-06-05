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
    },
});

test('MeshV2Service Timestamp-based getRemoteVariable', (t) => {
    const blocks = createMockBlocks();
    const service = new MeshV2Service(blocks, 'node-self', 'domain1');
    service.groupId = 'group1';

    t.test('should return the latest value based on timestamp', (st) => {
        // Setup remoteData with multiple nodes having the same key
        const now = Date.now();
        service.remoteData = {
            node1: {
                'my var': { value: 'value-old', timestamp: now - 1000 },
            },
            node2: {
                'my var': { value: 'value-newest', timestamp: now },
            },
            node3: {
                'my var': { value: 'value-middle', timestamp: now - 500 },
            },
        };

        const result = service.getRemoteVariable('my var');
        st.equal(result, 'value-newest', 'Should return the value with the largest timestamp');
        st.end();
    });

    t.test('handleDataUpdate should add timestamp from nodeStatus', (st) => {
        const serverTimestamp = new Date().toISOString();
        const expectedTimestamp = new Date(serverTimestamp).getTime();
        const nodeStatus = {
            nodeId: 'node4',
            timestamp: serverTimestamp,
            data: [{ key: 'var1', value: '100' }],
        };

        service.handleDataUpdate(nodeStatus);

        st.ok(service.remoteData.node4, 'Node 4 should be added');
        st.ok(service.remoteData.node4.var1, 'var1 should be added');
        st.equal(service.remoteData.node4.var1.value, '100');
        st.equal(service.remoteData.node4.var1.timestamp, expectedTimestamp, 'Should use server timestamp');
        st.end();
    });

    t.test('handleDataUpdate stores own node data (self-inclusive, Issue #707)', (st) => {
        // The sensor value block must read this node's own global variables, which
        // arrive as the AppSync echo of our own nodeStatus.
        const own = new MeshV2Service(createMockBlocks(), 'node-self', 'domain1');
        const serverTimestamp = new Date().toISOString();
        own.handleDataUpdate({
            nodeId: 'node-self',
            timestamp: serverTimestamp,
            data: [{ key: 'self-var', value: 'mine' }],
        });

        st.ok(own.remoteData['node-self'], 'own node is stored in remoteData');
        st.equal(own.remoteData['node-self']['self-var'].value, 'mine');
        st.equal(own.getRemoteVariable('self-var'), 'mine', 'own variable is readable');
        st.end();
    });

    t.test('sendData seeds own value locally for immediate read (issue #713)', (st) => {
        // mesh.sensor_value must return this node's own value immediately after
        // a variable set, without waiting for the AppSync echo round-trip
        // (RateLimiter 1s + network), because local broadcast fires synchronously.
        const service2 = new MeshV2Service(createMockBlocks(), 'node-self', 'domain1');
        service2.groupId = 'group1';
        service2.client = { mutate: () => Promise.resolve({}) };

        service2.sendData([{ key: '送信者', value: 'A' }]);

        // Synchronous check: no await — the seed must be visible before any echo
        st.equal(service2.getRemoteVariable('送信者'), 'A', 'own value is readable immediately after sendData');
        st.ok(service2.remoteData['node-self']['送信者'].timestamp > 0, 'seeded entry has a timestamp');
        st.end();
    });

    t.test('newer value from another node wins over local seed (issue #713)', (st) => {
        const service2 = new MeshV2Service(createMockBlocks(), 'node-self', 'domain1');
        service2.groupId = 'group1';
        service2.client = { mutate: () => Promise.resolve({}) };

        service2.sendData([{ key: 'shared', value: 'mine' }]);
        // Another node reports a NEWER value (timestamp in the future relative to seed)
        service2.remoteData['node-other'] = {
            shared: { value: 'theirs-newer', timestamp: Date.now() + 10000 },
        };

        st.equal(service2.getRemoteVariable('shared'), 'theirs-newer', 'newer remote value wins by timestamp');
        st.end();
    });

    t.test('local seed wins over older value from another node (issue #713)', (st) => {
        const service2 = new MeshV2Service(createMockBlocks(), 'node-self', 'domain1');
        service2.groupId = 'group1';
        service2.client = { mutate: () => Promise.resolve({}) };

        // Another node reported a value earlier
        service2.remoteData['node-other'] = {
            shared: { value: 'theirs-older', timestamp: Date.now() - 10000 },
        };
        service2.sendData([{ key: 'shared', value: 'mine' }]);

        st.equal(service2.getRemoteVariable('shared'), 'mine', 'fresh local seed wins over older remote value');
        st.end();
    });

    t.test('delta-filtered same-value resend does not bump seed timestamp (issue #713)', async (st) => {
        // Re-setting the same value is filtered by latestQueuedData and never
        // reaches the network, so the local view must not change either:
        // what this node reads stays consistent with what other nodes read.
        const service2 = new MeshV2Service(createMockBlocks(), 'node-self', 'domain1');
        service2.groupId = 'group1';
        service2.client = { mutate: () => Promise.resolve({}) };

        service2.sendData([{ key: 'shared', value: 'same' }]);
        const firstTimestamp = service2.remoteData['node-self'].shared.timestamp;

        await new Promise((resolve) => setTimeout(resolve, 20));
        service2.sendData([{ key: 'shared', value: 'same' }]);

        st.equal(
            service2.remoteData['node-self'].shared.timestamp,
            firstTimestamp,
            'timestamp unchanged for delta-filtered resend',
        );
        st.end();
    });

    t.test('self-echo with matching value normalizes timestamp to server time (issue #713)', (st) => {
        // The seed uses the client clock; other nodes' entries use the server
        // clock. When our own echo comes back with the same value, adopt the
        // server timestamp so cross-node comparison happens in one time domain.
        const service2 = new MeshV2Service(createMockBlocks(), 'node-self', 'domain1');
        service2.groupId = 'group1';
        service2.client = { mutate: () => Promise.resolve({}) };

        service2.sendData([{ key: 'shared', value: 'A' }]);

        const serverTimestamp = new Date(Date.now() + 5000).toISOString();
        const expectedTimestamp = new Date(serverTimestamp).getTime();
        service2.handleDataUpdate({
            nodeId: 'node-self',
            timestamp: serverTimestamp,
            data: [{ key: 'shared', value: 'A' }],
        });

        st.equal(service2.remoteData['node-self'].shared.value, 'A', 'value unchanged');
        st.equal(
            service2.remoteData['node-self'].shared.timestamp,
            expectedTimestamp,
            'timestamp normalized to server time',
        );
        st.end();
    });

    t.test('stale self-echo with different value does not overwrite seed (issue #713)', (st) => {
        // Own values always originate locally, so an echo can never carry newer
        // information than the seed. A different value means it is the echo of
        // an OLDER local write (rapid successive writes) — keep the seed.
        const service2 = new MeshV2Service(createMockBlocks(), 'node-self', 'domain1');
        service2.groupId = 'group1';
        service2.client = { mutate: () => Promise.resolve({}) };

        service2.sendData([{ key: 'shared', value: 'old' }]);
        service2.sendData([{ key: 'shared', value: 'new' }]);
        const seedTimestamp = service2.remoteData['node-self'].shared.timestamp;

        // Echo of the FIRST write arrives after the second local write,
        // with a server timestamp that may even be in the future (clock skew)
        service2.handleDataUpdate({
            nodeId: 'node-self',
            timestamp: new Date(Date.now() + 5000).toISOString(),
            data: [{ key: 'shared', value: 'old' }],
        });

        st.equal(service2.remoteData['node-self'].shared.value, 'new', 'seeded value is protected');
        st.equal(service2.remoteData['node-self'].shared.timestamp, seedTimestamp, 'seed timestamp is kept');
        st.equal(service2.getRemoteVariable('shared'), 'new', 'sensor value still reads the latest local write');
        st.end();
    });

    t.test('fetchAllNodesData should add timestamp from status', async (st) => {
        const serverTimestamp = new Date().toISOString();
        const expectedTimestamp = new Date(serverTimestamp).getTime();
        service.client = {
            query: () =>
                Promise.resolve({
                    data: {
                        listGroupStatuses: [
                            {
                                nodeId: 'node5',
                                timestamp: serverTimestamp,
                                data: [{ key: 'var2', value: '200' }],
                            },
                        ],
                    },
                }),
        };

        await service.fetchAllNodesData();

        st.ok(service.remoteData.node5, 'Node 5 should be added');
        st.equal(service.remoteData.node5.var2.value, '200');
        st.equal(service.remoteData.node5.var2.timestamp, expectedTimestamp, 'Should use server timestamp');
        st.end();
    });

    t.end();
});
