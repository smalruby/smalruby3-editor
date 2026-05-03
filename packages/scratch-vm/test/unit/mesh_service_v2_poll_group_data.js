const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

// Force network filter test mode disabled
process.env.MESH_NETWORK_FILTER = 'false';

const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');
const { POLL_GROUP_DATA, CREATE_GROUP, JOIN_GROUP } = require('../../src/extensions/scratch3_mesh_v2/gql-operations');

const createMockBlocks = () => ({
    runtime: {
        sequencer: {},
        emit: () => {},
        on: () => {},
        off: () => {},
        getTargetForStage: () => ({ variables: {} }),
    },
    opcodeFunctions: { event_broadcast: () => {} },
});

test('issue #554: pollGroupData integration', (t) => {
    t.test('polling mode skips startPeriodicDataSync (createGroup)', async (st) => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.testWebSocket = () => Promise.resolve(false);

        let periodicStarted = false;
        const originalStart = service.startPeriodicDataSync.bind(service);
        service.startPeriodicDataSync = () => {
            periodicStarted = true;
            originalStart();
        };

        service.client = {
            mutate: ({ mutation }) => {
                if (mutation === CREATE_GROUP) {
                    return Promise.resolve({
                        data: {
                            createGroup: {
                                id: 'g1',
                                name: 'G',
                                domain: 'domain1',
                                expiresAt: '2099-01-01T00:00:00Z',
                                heartbeatIntervalSeconds: 60,
                                useWebSocket: false,
                                pollingIntervalSeconds: 2,
                            },
                        },
                    });
                }
                return Promise.resolve({ data: {} });
            },
            query: () => Promise.resolve({ data: { listGroupStatuses: [] } }),
            subscribe: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        };

        await service.createGroup('G');

        // Polling モードでは startPeriodicDataSync は呼ばれない
        st.equal(periodicStarted, false);
        st.equal(service.useWebSocket, false);
        st.notOk(service.dataSyncTimer, 'dataSyncTimer is not started in polling mode');
        service.cleanup();
        st.end();
    });

    t.test('WebSocket mode keeps startPeriodicDataSync (createGroup)', async (st) => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.testWebSocket = () => Promise.resolve(true);

        let periodicStarted = false;
        const originalStart = service.startPeriodicDataSync.bind(service);
        service.startPeriodicDataSync = () => {
            periodicStarted = true;
            originalStart();
        };

        service.client = {
            mutate: () =>
                Promise.resolve({
                    data: {
                        createGroup: {
                            id: 'g1',
                            name: 'G',
                            domain: 'domain1',
                            expiresAt: '2099-01-01T00:00:00Z',
                            heartbeatIntervalSeconds: 60,
                            useWebSocket: true,
                            pollingIntervalSeconds: null,
                        },
                    },
                }),
            query: () => Promise.resolve({ data: { listGroupStatuses: [] } }),
            subscribe: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        };

        await service.createGroup('G');

        st.equal(periodicStarted, true, 'WebSocket mode runs periodic data sync');
        service.cleanup();
        st.end();
    });

    t.test('polling mode skips startPeriodicDataSync (joinGroup)', async (st) => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.forcePolling = true;
        service.useWebSocket = false;

        let periodicStarted = false;
        const originalStart = service.startPeriodicDataSync.bind(service);
        service.startPeriodicDataSync = () => {
            periodicStarted = true;
            originalStart();
        };

        service.client = {
            mutate: ({ mutation }) => {
                if (mutation === JOIN_GROUP) {
                    return Promise.resolve({
                        data: {
                            joinGroup: {
                                id: 'node1',
                                name: 'Node node1',
                                groupId: 'g1',
                                domain: 'domain1',
                                expiresAt: '2099-01-01T00:00:00Z',
                                heartbeatIntervalSeconds: 120,
                                useWebSocket: false,
                                pollingIntervalSeconds: 2,
                            },
                        },
                    });
                }
                return Promise.resolve({ data: {} });
            },
            query: () => Promise.resolve({ data: { listGroupStatuses: [] } }),
            subscribe: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        };

        await service.joinGroup('g1', 'domain1', 'G');
        st.equal(periodicStarted, false, 'Polling mode skips periodic data sync');
        st.notOk(service.dataSyncTimer, 'dataSyncTimer is not started in polling mode');
        service.cleanup();
        st.end();
    });

    t.test('pollEvents calls POLL_GROUP_DATA query and handles both events and nodeStatuses', async (st) => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.groupId = 'g1';
        service.useWebSocket = false;
        service.lastFetchTime = 'T1';

        let calledMutation = null;
        const handledStatuses = [];
        service.handleDataUpdate = (status) => handledStatuses.push(status);

        const events = [
            {
                name: 'evt-from-other',
                firedByNodeId: 'node2',
                groupId: 'g1',
                domain: 'd1',
                payload: 'p',
                timestamp: 'T2',
                cursor: 'C2',
                orderKey: '20260428000000-0000001',
            },
        ];
        const nodeStatuses = [
            {
                nodeId: 'node2',
                groupId: 'g1',
                domain: 'd1',
                data: [{ key: 'score', value: '42' }],
                timestamp: 'T2',
            },
        ];
        service.client = {
            query: (options) => {
                calledMutation = options.query;
                st.equal(options.variables.since, 'T1');
                return Promise.resolve({
                    data: { pollGroupData: { events, nodeStatuses } },
                });
            },
        };

        await service.pollEvents();

        st.equal(calledMutation, POLL_GROUP_DATA, 'uses POLL_GROUP_DATA query');
        st.equal(service.pendingBroadcasts.length, 1);
        st.equal(service.pendingBroadcasts[0].event.name, 'evt-from-other');
        st.equal(handledStatuses.length, 1);
        st.equal(handledStatuses[0].nodeId, 'node2');
        st.equal(service.lastFetchTime, 'C2');
        st.end();
    });

    t.end();
});
