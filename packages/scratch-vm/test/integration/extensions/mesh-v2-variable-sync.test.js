const test = require('tap').test;
const MeshV2Service = require('../../../src/extensions/scratch3_mesh_v2/mesh-service');
const {
    REPORT_DATA,
    CREATE_GROUP,
    JOIN_GROUP,
    LIST_GROUP_STATUSES,
} = require('../../../src/extensions/scratch3_mesh_v2/gql-operations');
const Variable = require('../../../src/engine/variable');

// Mock MeshClient
const mockClient = {
    mutate: null,
    query: null,
    subscribe: () => ({
        subscribe: () => ({
            unsubscribe: () => {},
        }),
    }),
};

const createMockBlocks = () => ({
    runtime: {
        getTargetForStage: () => ({
            variables: {
                'var1-id': {
                    name: 'var1',
                    type: Variable.SCALAR_TYPE,
                    value: 10,
                },
                'var2-id': {
                    name: 'var2',
                    type: Variable.SCALAR_TYPE,
                    value: 'hello',
                },
            },
        }),
        on: () => {},
        off: () => {},
    },
});

const FAR_FUTURE = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

test('MeshV2Service Variable Sync Integration', async (t) => {
    let reportDataPayload = null;

    mockClient.mutate = ({ mutation, variables }) => {
        if (mutation === CREATE_GROUP) {
            return Promise.resolve({
                data: {
                    createGroup: {
                        id: 'group1',
                        name: variables.name,
                        domain: variables.domain,
                        expiresAt: FAR_FUTURE,
                    },
                },
            });
        }
        if (mutation === REPORT_DATA) {
            reportDataPayload = variables.data;
        }
        return Promise.resolve({ data: {} });
    };

    mockClient.query = () => Promise.resolve({ data: { listGroupStatuses: [] } });

    const blocks = createMockBlocks();
    const service = new MeshV2Service(blocks, 'node1', 'domain1');
    service.client = mockClient;
    service.forcePolling = true; // Skip WebSocket test in unit test environment

    // Test createGroup
    await service.createGroup('my-group');

    // Need to wait for RateLimiter to process the queue
    await service.dataRateLimiter.waitForCompletion();

    t.ok(reportDataPayload, 'REPORT_DATA should be called');
    t.equal(reportDataPayload.length, 2);
    t.same(
        reportDataPayload.find((v) => v.key === 'var1'),
        { key: 'var1', value: '10' },
    );
    t.same(
        reportDataPayload.find((v) => v.key === 'var2'),
        { key: 'var2', value: 'hello' },
    );

    // Cleanup for next test
    reportDataPayload = null;
    service.cleanup();

    // Test joinGroup with a NEW service instance
    const service2 = new MeshV2Service(blocks, 'node2', 'domain1');
    service2.client = mockClient;
    service2.forcePolling = true; // Skip WebSocket test in unit test environment

    mockClient.mutate = ({ mutation, variables }) => {
        if (mutation === JOIN_GROUP) {
            return Promise.resolve({
                data: {
                    joinGroup: {
                        domain: variables.domain,
                        heartbeatIntervalSeconds: 60,
                        expiresAt: FAR_FUTURE,
                    },
                },
            });
        }
        if (mutation === REPORT_DATA) {
            reportDataPayload = variables.data;
        }
        return Promise.resolve({ data: {} });
    };

    await service2.joinGroup('group2', 'domain1', 'groupName');
    await service2.dataRateLimiter.waitForCompletion();

    t.ok(reportDataPayload, 'REPORT_DATA should be called on joinGroup');
    t.equal(reportDataPayload.length, 2);

    service2.cleanup();

    t.end();
});

// Issue #707: the sensor value block reads this node's own global variables.
// AppSync echoes the sender's own nodeStatus back; we keep it (no self-exclusion)
// so self and peers are read uniformly via the shared handleDataUpdate path.
test('MeshV2Service self-inclusive sensor value (Issue #707)', (t) => {
    const service = new MeshV2Service(createMockBlocks(), 'self-node', 'domain1');

    // Own echoed data is stored and readable.
    service.handleDataUpdate({
        nodeId: 'self-node',
        timestamp: '2026-01-01T00:00:02Z',
        data: [{ key: 'myScore', value: '100' }],
    });
    // Peer data is read as before (no regression).
    service.handleDataUpdate({
        nodeId: 'peer-node',
        timestamp: '2026-01-01T00:00:01Z',
        data: [{ key: 'peerScore', value: '7' }],
    });

    t.equal(service.getRemoteVariable('myScore'), '100', 'own variable is readable');
    t.equal(service.getRemoteVariable('peerScore'), '7', 'peer variable unchanged');

    // Shared name resolves to the latest timestamp, self included.
    service.handleDataUpdate({
        nodeId: 'peer-node',
        timestamp: '2026-01-01T00:00:05Z',
        data: [{ key: 's', value: 'peer' }],
    });
    service.handleDataUpdate({
        nodeId: 'self-node',
        timestamp: '2026-01-01T00:00:10Z',
        data: [{ key: 's', value: 'self' }],
    });
    t.equal(service.getRemoteVariable('s'), 'self', 'latest timestamp wins across self and peers');

    service.cleanup();
    t.end();
});

// Issue #713: a when_receive handler triggered by a LOCAL broadcast runs
// synchronously, before the AppSync echo (RateLimiter 1s + network) brings the
// just-set variables back. The local seed in sendData makes them readable
// immediately, while values from other nodes still win when newer.
test('MeshV2Service immediate self sensor value after set (Issue #713)', async (t) => {
    mockClient.mutate = ({ mutation, variables }) => {
        if (mutation === CREATE_GROUP) {
            return Promise.resolve({
                data: {
                    createGroup: {
                        id: 'group1',
                        name: variables.name,
                        domain: variables.domain,
                        expiresAt: FAR_FUTURE,
                    },
                },
            });
        }
        return Promise.resolve({ data: {} });
    };
    mockClient.query = () => Promise.resolve({ data: { listGroupStatuses: [] } });

    const service = new MeshV2Service(createMockBlocks(), 'host-node', 'domain1');
    service.client = mockClient;
    service.forcePolling = true; // Skip WebSocket test in unit test environment

    await service.createGroup('my-group');

    // First message: $送信者 = "A"; $送信メッセージ = answer; broadcast(...)
    // — when_receive reads the sensor values in the same tick.
    service.sendData([
        { key: '送信者', value: 'A' },
        { key: '送信メッセージ', value: 'こんにちは' },
    ]);
    t.equal(
        `${service.getRemoteVariable('送信者')}：${service.getRemoteVariable('送信メッセージ')}`,
        'A：こんにちは',
        'first read works immediately, without waiting for the echo',
    );

    // Second message before any echo: must read the LATEST value, not the previous one.
    service.sendData([{ key: '送信メッセージ', value: '2かいめ' }]);
    t.equal(service.getRemoteVariable('送信メッセージ'), '2かいめ', 'second read returns the latest value');

    // Stale echo of the first write arrives late: the seed must be protected.
    service.handleDataUpdate({
        nodeId: 'host-node',
        timestamp: FAR_FUTURE,
        data: [{ key: '送信メッセージ', value: 'こんにちは' }],
    });
    t.equal(service.getRemoteVariable('送信メッセージ'), '2かいめ', 'stale echo does not revert the value');

    // A NEWER value from another node still wins by timestamp.
    service.handleDataUpdate({
        nodeId: 'peer-node',
        timestamp: new Date(Date.now() + 7200000).toISOString(),
        data: [{ key: '送信メッセージ', value: 'from-peer' }],
    });
    t.equal(service.getRemoteVariable('送信メッセージ'), 'from-peer', 'newer peer value wins');

    service.cleanup();
    t.end();
});

// Issue #721: mutual messaging idiom — each node re-asserts its own 送信者
// (always the same value) before broadcasting. The guard in the user program
// is `if sensor_value("送信者") != $送信者`, so an explicit same-value set must
// count as a fresh write locally AND on the network, or the other node's
// write stays newest forever.
test('MeshV2Service mutual messaging with same-value re-sets (Issue #721)', async (t) => {
    const sentPayloads = [];
    mockClient.mutate = ({ mutation, variables }) => {
        if (mutation === CREATE_GROUP) {
            return Promise.resolve({
                data: {
                    createGroup: {
                        id: 'group1',
                        name: variables.name,
                        domain: variables.domain,
                        expiresAt: FAR_FUTURE,
                    },
                },
            });
        }
        if (mutation === REPORT_DATA) {
            sentPayloads.push(variables.data);
        }
        return Promise.resolve({ data: {} });
    };
    mockClient.query = () => Promise.resolve({ data: { listGroupStatuses: [] } });

    const nodeA = new MeshV2Service(createMockBlocks(), 'node-a', 'domain1');
    nodeA.client = mockClient;
    nodeA.forcePolling = true; // Skip WebSocket test in unit test environment
    nodeA.dataRateLimiter.intervalMs = 10; // speed up the test

    await nodeA.createGroup('grp');
    sentPayloads.length = 0;

    // A clicks: $送信者 = "A" (explicit set → force, as the HOC does)
    await nodeA.sendData([{ key: '送信者', value: 'A' }], { force: true });
    t.equal(nodeA.getRemoteVariable('送信者'), 'A', 'A reads own value');

    // B clicks later: B's write arrives with a newer (server) timestamp
    nodeA.handleDataUpdate({
        nodeId: 'node-b',
        timestamp: new Date(Date.now() + 1000).toISOString(),
        data: [{ key: '送信者', value: 'B' }],
    });
    t.equal(nodeA.getRemoteVariable('送信者'), 'B', "B's newer write wins on A");

    // A clicks again with the SAME value: must become A's fresh write again,
    // both locally (guard skips own message) and on the network (B can see it).
    await new Promise((resolve) => setTimeout(resolve, 1100 + 20));
    await nodeA.sendData([{ key: '送信者', value: 'A' }], { force: true });
    t.equal(nodeA.getRemoteVariable('送信者'), 'A', "A's same-value re-set wins locally");
    t.ok(
        sentPayloads.some((p) => p.some((item) => item.key === '送信者' && item.value === 'A')),
        "A's same-value re-set is re-sent to the network",
    );
    t.equal(sentPayloads.length, 2, "both of A's sets reached REPORT_DATA");

    nodeA.cleanup();
    t.end();
});

test('MeshV2Service fetch existing nodes data on joinGroup', async (t) => {
    const blocks = {
        runtime: {
            getTargetForStage: () => ({ variables: {} }),
            on: () => {},
            off: () => {},
        },
    };

    mockClient.mutate = ({ mutation }) => {
        if (mutation === JOIN_GROUP) {
            return Promise.resolve({
                data: {
                    joinGroup: {
                        domain: 'domain1',
                        heartbeatIntervalSeconds: 60,
                        expiresAt: FAR_FUTURE,
                    },
                },
            });
        }
        return Promise.resolve({ data: {} });
    };

    mockClient.query = ({ query, variables }) => {
        if (query === LIST_GROUP_STATUSES) {
            return Promise.resolve({
                data: {
                    listGroupStatuses: [
                        {
                            nodeId: 'host-node',
                            groupId: variables.groupId,
                            domain: variables.domain,
                            data: [{ key: 'hostVar', value: '100' }],
                            timestamp: '2025-12-30T12:00:00Z',
                        },
                    ],
                },
            });
        }
        return Promise.resolve({ data: {} });
    };

    const service = new MeshV2Service(blocks, 'member-node', 'domain1');
    service.client = mockClient;
    service.forcePolling = true; // Skip WebSocket test in unit test environment

    await service.joinGroup('group1', 'domain1', 'groupName');

    t.ok(service.remoteData['host-node'], 'Should have data from host-node');
    t.equal(service.remoteData['host-node'].hostVar.value, '100', 'Should have correct variable value from host');

    service.cleanup();
    t.end();
});
