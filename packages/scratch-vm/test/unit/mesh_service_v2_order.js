const test = require('tap').test;
const minilog = require('minilog');
// Suppress debug and info logs during tests
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');
const {REPORT_DATA, FIRE_EVENTS} = require('../../src/extensions/scratch3_mesh_v2/gql-operations');

const createMockBlocks = () => ({
    runtime: {
        sequencer: {},
        emit: () => {},
        on: () => {},
        off: () => {},
        getTargetForStage: () => ({
            variables: {}
        })
    },
    opcodeFunctions: {
        event_broadcast: () => {}
    }
});

test('MeshV2Service Data and Event Order', t => {
    t.test('fireEventsBatch awaits lastDataSendPromise', async st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.stopEventBatchTimer();
        service.groupId = 'group1';

        let dataMutationStarted = false;
        let dataMutationFinished = false;
        let eventMutationStarted = false;

        service.client = {
            mutate: options => {
                if (options.mutation === REPORT_DATA) {
                    dataMutationStarted = true;
                    return new Promise(resolve => {
                        setTimeout(() => {
                            dataMutationFinished = true;
                            resolve({data: {reportDataByNode: {
                                nodeId: 'node1',
                                timestamp: new Date().toISOString(),
                                data: []
                            }}});
                        }, 50); // Delay data mutation
                    });
                }
                if (options.mutation === FIRE_EVENTS) {
                    eventMutationStarted = true;
                    st.ok(dataMutationStarted, 'Data mutation should have started');
                    st.ok(dataMutationFinished, 'Data mutation should have finished before event mutation starts');
                    return Promise.resolve({data: {fireEventsByNode: {}}});
                }
                return Promise.resolve({});
            }
        };

        // 1. Send data
        const dataPromise = service.sendData([{key: 'var1', value: '10'}]);
        st.ok(service.lastDataSendPromise, 'lastDataSendPromise should be set');
        
        // 2. Fire event batch immediately (should wait for dataPromise)
        const eventPromise = service.fireEventsBatch([{eventName: 'msg1', payload: '', firedAt: 't1'}]);

        await Promise.all([dataPromise, eventPromise]);
        
        st.ok(dataMutationFinished, 'Data mutation finished');
        st.ok(eventMutationStarted, 'Event mutation started');

        st.end();
    });

    t.test('handleDataUpdate uses server timestamp', st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        
        const serverTimestamp = '2025-12-30T12:34:56.789Z';
        const expectedTime = new Date(serverTimestamp).getTime();
        
        const nodeStatus = {
            nodeId: 'node2',
            timestamp: serverTimestamp,
            data: [
                {key: 'var1', value: '100'}
            ]
        };
        
        service.handleDataUpdate(nodeStatus);
        
        st.equal(service.remoteData.node2.var1.value, '100');
        st.equal(service.remoteData.node2.var1.timestamp, expectedTime, 'Should use server timestamp');
        
        st.end();
    });

    t.test('fireEventsBatch works without preceding data send', async st => {
        const blocks = createMockBlocks();
        const service = new MeshV2Service(blocks, 'node1', 'domain1');
        service.stopEventBatchTimer();
        service.groupId = 'group1';

        let eventMutationStarted = false;

        service.client = {
            mutate: options => {
                if (options.mutation === FIRE_EVENTS) {
                    eventMutationStarted = true;
                    return Promise.resolve({data: {fireEventsByNode: {}}});
                }
                return Promise.resolve({});
            }
        };

        // fireEventsBatch should work even if lastDataSendPromise is just Promise.resolve()
        await service.fireEventsBatch([{eventName: 'msg1', payload: '', firedAt: 't1'}]);
        
        st.ok(eventMutationStarted, 'Event mutation started without data send');

        st.end();
    });

    t.end();
});
