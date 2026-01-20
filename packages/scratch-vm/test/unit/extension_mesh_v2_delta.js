const test = require('tap').test;
const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');

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

test('MeshV2Service Delta Transmission', t => {
    const blocks = createMockBlocks();
    const service = new MeshV2Service(blocks, 'node1', 'domain1');

    // Mock client and rate limiter
    let mutationCount = 0;
    let reportedData = null;

    service.client = {
        mutate: ({variables}) => {
            mutationCount++;
            reportedData = variables.data;
            return Promise.resolve({
                data: {
                    reportDataByNode: {
                        nodeStatus: {
                            data: variables.data
                        }
                    }
                }
            });
        }
    };
    service.groupId = 'g1';
    service.domain = 'd1';

    // Set a very short interval for rate limiter to speed up tests
    service.dataRateLimiter.intervalMs = 0;

    t.test('should send all data initially', async st => {
        const data = [{key: 'v1', value: '1'}, {key: 'v2', value: '2'}];
        await service.sendData(data);
        
        st.equal(mutationCount, 1, 'Should call mutation');
        st.same(reportedData, data, 'Should send all data');
        st.same(service.lastSentData, {v1: '1', v2: '2'}, 'Should update lastSentData');
        st.end();
    });

    t.test('should skip sending if data is unchanged', async st => {
        mutationCount = 0;
        reportedData = null;
        
        const data = [{key: 'v1', value: '1'}, {key: 'v2', value: '2'}];
        await service.sendData(data);
        
        st.equal(mutationCount, 0, 'Should NOT call mutation if data is unchanged');
        st.end();
    });

    t.test('should only send changed items (delta)', async st => {
        mutationCount = 0;
        reportedData = null;
        
        // Only v2 changed
        const data = [{key: 'v1', value: '1'}, {key: 'v2', value: '3'}];
        await service.sendData(data);
        
        st.equal(mutationCount, 1, 'Should call mutation if some data changed');
        st.same(reportedData, [{key: 'v2', value: '3'}], 'Should ONLY send changed items');
        st.same(service.lastSentData, {v1: '1', v2: '3'}, 'Should update lastSentData for changed item');
        st.end();
    });

    t.test('should send new items', async st => {
        mutationCount = 0;
        reportedData = null;
        
        const data = [{key: 'v1', value: '1'}, {key: 'v2', value: '3'}, {key: 'v3', value: '4'}];
        await service.sendData(data);
        
        st.equal(mutationCount, 1);
        st.same(reportedData, [{key: 'v3', value: '4'}], 'Should send new items');
        st.end();
    });

    t.test('should handle single item sendData calls from index.js', async st => {
        mutationCount = 0;
        reportedData = null;
        
        // index.js often calls: sendData([{key: name, value: value}])
        await service.sendData([{key: 'v1', value: '1'}]); // Unchanged
        st.equal(mutationCount, 0, 'Should skip unchanged single item');
        
        await service.sendData([{key: 'v1', value: 'updated'}]); // Changed
        st.equal(mutationCount, 1, 'Should send changed single item');
        st.same(reportedData, [{key: 'v1', value: 'updated'}]);
        st.end();
    });

    t.end();
});
