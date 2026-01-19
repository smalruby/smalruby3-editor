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
        off: () => {}
    }
});

test('MeshV2Service Timestamp-based getRemoteVariable', t => {
    const blocks = createMockBlocks();
    const service = new MeshV2Service(blocks, 'node-self', 'domain1');
    service.groupId = 'group1';

    t.test('should return the latest value based on timestamp', st => {
        // Setup remoteData with multiple nodes having the same key
        const now = Date.now();
        service.remoteData = {
            node1: {
                'my var': {value: 'value-old', timestamp: now - 1000}
            },
            node2: {
                'my var': {value: 'value-newest', timestamp: now}
            },
            node3: {
                'my var': {value: 'value-middle', timestamp: now - 500}
            }
        };

        const result = service.getRemoteVariable('my var');
        st.equal(result, 'value-newest', 'Should return the value with the largest timestamp');
        st.end();
    });

    t.test('handleDataUpdate should add timestamp from nodeStatus', st => {
        const serverTimestamp = new Date().toISOString();
        const expectedTimestamp = new Date(serverTimestamp).getTime();
        const nodeStatus = {
            nodeId: 'node4',
            timestamp: serverTimestamp,
            data: [
                {key: 'var1', value: '100'}
            ]
        };

        service.handleDataUpdate(nodeStatus);

        st.ok(service.remoteData.node4, 'Node 4 should be added');
        st.ok(service.remoteData.node4.var1, 'var1 should be added');
        st.equal(service.remoteData.node4.var1.value, '100');
        st.equal(service.remoteData.node4.var1.timestamp, expectedTimestamp, 'Should use server timestamp');
        st.end();
    });

    t.test('fetchAllNodesData should add timestamp from status', async st => {
        const serverTimestamp = new Date().toISOString();
        const expectedTimestamp = new Date(serverTimestamp).getTime();
        service.client = {
            query: () => Promise.resolve({
                data: {
                    listGroupStatuses: [
                        {
                            nodeId: 'node5',
                            timestamp: serverTimestamp,
                            data: [{key: 'var2', value: '200'}]
                        }
                    ]
                }
            })
        };

        await service.fetchAllNodesData();

        st.ok(service.remoteData.node5, 'Node 5 should be added');
        st.equal(service.remoteData.node5.var2.value, '200');
        st.equal(service.remoteData.node5.var2.timestamp, expectedTimestamp, 'Should use server timestamp');
        st.end();
    });

    t.end();
});
