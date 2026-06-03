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

// Issue #707: the sensor value block should read this node's own global
// variables when the project opts into self-inclusive mode, while peer variable
// reads stay unchanged. AppSync echoes the sender's own nodeStatus back, so we
// simulate that echo via handleDataUpdate (the shared ingestion path for
// subscription / polling / periodic-sync).
test('MeshV2Service self-inclusive sensor value (Issue #707)', (t) => {
    const ownEcho = {
        nodeId: 'self-node',
        timestamp: '2026-01-01T00:00:02Z',
        data: [{ key: 'myScore', value: '100' }],
    };
    const peerData = {
        nodeId: 'peer-node',
        timestamp: '2026-01-01T00:00:01Z',
        data: [{ key: 'peerScore', value: '7' }],
    };

    t.test('legacy mode (default): own data ignored, peer data read', (st) => {
        const service = new MeshV2Service(createMockBlocks(), 'self-node', 'domain1');
        service.handleDataUpdate({ ...ownEcho });
        service.handleDataUpdate({ ...peerData });

        st.equal(service.getRemoteVariable('myScore'), null, 'own variable is not readable');
        st.equal(service.getRemoteVariable('peerScore'), '7', 'peer variable is read as before');
        service.cleanup();
        st.end();
    });

    t.test('new mode: own data read alongside peer data, latest timestamp wins', (st) => {
        const service = new MeshV2Service(createMockBlocks(), 'self-node', 'domain1');
        service.runtime.meshSelfInclusive = true;
        service.handleDataUpdate({ ...peerData });
        service.handleDataUpdate({ ...ownEcho });

        st.equal(service.getRemoteVariable('myScore'), '100', 'own variable is now readable');
        st.equal(service.getRemoteVariable('peerScore'), '7', 'peer variable unchanged (no regression)');

        // A shared variable name resolves to the latest timestamp, self included.
        service.handleDataUpdate({
            nodeId: 'peer-node',
            timestamp: '2026-01-01T00:00:05Z',
            data: [{ key: 'shared', value: 'peer-newer' }],
        });
        service.handleDataUpdate({
            nodeId: 'self-node',
            timestamp: '2026-01-01T00:00:10Z',
            data: [{ key: 'shared', value: 'self-newest' }],
        });
        st.equal(service.getRemoteVariable('shared'), 'self-newest', 'latest timestamp wins across self and peers');

        service.cleanup();
        st.end();
    });

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
