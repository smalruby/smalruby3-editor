/* eslint-disable require-atomic-updates */
const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug logs during tests
minilog.suggest.deny('vm', 'debug');

const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');
const log = require('../../src/util/log');

const createMockBlocks = () => ({
    runtime: {
        on: () => {},
        getTargetForStage: () => ({
            variables: {}
        }),
        sequencer: {}
    },
    opcodeFunctions: {
        event_broadcast: () => {}
    }
});

test('MeshV2Service Cost Tracking', t => {
    const blocks = createMockBlocks();
    const service = new MeshV2Service(blocks, 'node1', 'domain1');

    // Mock client
    const mockClient = {
        query: () => Promise.resolve({
            data: {
                listGroupsByDomain: [],
                listGroupStatuses: []
            }
        }),
        mutate: () => Promise.resolve({
            data: {
                createDomain: 'd1',
                createGroup: {
                    id: 'g1',
                    name: 'G1',
                    domain: 'd1',
                    expiresAt: '2099-01-01T00:00:00Z',
                    heartbeatIntervalSeconds: 60
                },
                joinGroup: {
                    id: 'n1',
                    domain: 'd1',
                    expiresAt: '2099-01-01T00:00:00Z',
                    heartbeatIntervalSeconds: 120
                },
                renewHeartbeat: {
                    expiresAt: '2099-01-01T00:00:00Z',
                    heartbeatIntervalSeconds: 60
                },
                sendMemberHeartbeat: {
                    expiresAt: '2099-01-01T00:00:00Z',
                    heartbeatIntervalSeconds: 120
                }
            }
        }),
        subscribe: () => ({
            subscribe: () => ({
                unsubscribe: () => {}
            })
        })
    };
    service.client = mockClient;

    t.test('initial state', st => {
        st.equal(service.costTracking.queryCount, 0);
        st.equal(service.costTracking.mutationCount, 0);
        st.equal(service.costTracking.connectionStartTime, null);
        st.end();
    });

    t.test('tracking mutations and queries', async st => {
        await service.createDomain();
        st.equal(service.costTracking.mutationCount, 1);

        await service.createGroup('G1');
        // createGroup uses service.domain if it exists. service.domain is 'domain1' from constructor.
        // So createGroup calls mutate once.
        st.equal(service.costTracking.mutationCount, 2);
        st.ok(service.costTracking.connectionStartTime);

        await service.listGroups();
        st.equal(service.costTracking.queryCount, 1);

        await service.joinGroup('g1', 'd1', 'G1');
        st.equal(service.costTracking.mutationCount, 3);

        await service.renewHeartbeat(); // only if host
        
        // Set isHost directly
        service.isHost = true;
        
        await service.renewHeartbeat();
        st.equal(service.costTracking.mutationCount, 4);
        st.equal(service.costTracking.heartbeatCount, 1);

        service.isHost = false;
        await service.sendMemberHeartbeat();
        st.equal(service.costTracking.mutationCount, 5);
        st.equal(service.costTracking.heartbeatCount, 2);

        await service._reportData([{key: 'k1', value: 'v1'}]);
        st.equal(service.costTracking.mutationCount, 6);
        st.equal(service.costTracking.reportDataCount, 1);

        await service.fireEventsBatch([{eventName: 'e1'}]);
        st.equal(service.costTracking.mutationCount, 7);
        st.equal(service.costTracking.fireEventsCount, 1);

        await service.fetchAllNodesData();
        st.equal(service.costTracking.queryCount, 3);

        st.end();
    });

    t.test('tracking received messages', st => {
        service.costTracking.dataUpdateReceived++;
        service.handleDataUpdate({
            nodeId: 'other',
            data: [{key: 'k', value: 'v'}]
        });
        st.equal(service.costTracking.dataUpdateReceived, 1);

        service.costTracking.batchEventReceived++;
        service.handleBatchEvent({
            firedByNodeId: 'other',
            events: [{
                name: 'e',
                timestamp: new Date().toISOString()
            }]
        });
        st.equal(service.costTracking.batchEventReceived, 1);

        st.end();
    });

    t.test('logging summary in cleanup', st => {
        // Mock log.info to verify it's called
        const originalLogInfo = log.info;
        const messages = [];
        log.info = msg => messages.push(msg);

        service.cleanup();

        st.ok(messages.some(m => m.includes('Mesh V2: Cost Summary')));
        st.ok(messages.some(m => m.includes('TOTAL ESTIMATED COST')));

        log.info = originalLogInfo;
        st.end();
    });

    t.end();
});
