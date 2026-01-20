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

test('MeshV2Service Delta Transmission Redundancy Repro', t => {
    const blocks = createMockBlocks();
    const service = new MeshV2Service(blocks, 'node1', 'domain1');

    let mutationCount = 0;
    let reportedPayloads = [];

    service.client = {
        mutate: ({variables}) => {
            mutationCount++;
            reportedPayloads.push(JSON.parse(JSON.stringify(variables.data)));
            // 送信に少し時間がかかることをシミュレート
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve({
                        data: {
                            reportDataByNode: {
                                nodeStatus: {
                                    data: variables.data
                                }
                            }
                        }
                    });
                }, 50);
            });
        }
    };
    service.groupId = 'g1';
    service.domain = 'd1';

    // インターバルを1000msに設定
    service.dataRateLimiter.intervalMs = 1000;

    t.test('should NOT send redundant data if value changes back before transmission', async st => {
        // 1. データAを1にセット
        const p1 = service.sendData([{key: 'A', value: '1'}]);
        
        // 2. 少し待って、データAを991にセット
        await new Promise(resolve => setTimeout(resolve, 100));
        const p2 = service.sendData([{key: 'A', value: '991'}]);
        
        // 3. さらに少し待って、データAを1にセット
        await new Promise(resolve => setTimeout(resolve, 100));
        const p3 = service.sendData([{key: 'A', value: '1'}]);

        // 全ての送信が完了するのを待つ
        await Promise.all([p1, p2, p3]);
        await service.dataRateLimiter.waitForCompletion();

        st.equal(mutationCount, 1, 'Should only call mutation ONCE if the final state matches initial state');
        st.same(reportedPayloads[0], [{key: 'A', value: '1'}], 'The first mutation should be 1');
        
        if (mutationCount > 1) {
            st.fail(`Redundant mutation detected: ${JSON.stringify(reportedPayloads)}`);
        }
        
        st.end();
    });

    t.test('should send data if value changes and stays changed', async st => {
        mutationCount = 0;
        reportedPayloads = [];
        service.lastSentData = {};
        service.latestQueuedData = {};

        // 1. データAを1にセット
        const p1 = service.sendData([{key: 'A', value: '1'}]);
        
        // 2. 少し待って、データAを991にセット
        await new Promise(resolve => setTimeout(resolve, 100));
        const p2 = service.sendData([{key: 'A', value: '991'}]);
        
        // 3. さらに少し待って、データAを992にセット (1ではない)
        await new Promise(resolve => setTimeout(resolve, 100));
        const p3 = service.sendData([{key: 'A', value: '992'}]);

        // 全ての送信が完了するのを待つ
        await Promise.all([p1, p2, p3]);
        await service.dataRateLimiter.waitForCompletion();

        st.equal(mutationCount, 1, 'Should call mutation once (all changes merged into one)');
        st.same(reportedPayloads[0], [{key: 'A', value: '992'}], 'The mutation should contain the latest value');
        st.end();
    });

    t.end();
});
