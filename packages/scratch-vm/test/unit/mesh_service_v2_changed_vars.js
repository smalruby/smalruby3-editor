// Issue #1930: values changed outside blocks (the stage monitor's slider
// writes `variable.value` directly) must reach the mesh soon, without
// sending more than the rate limiter allows.
const test = require('tap').test;
const minilog = require('minilog');
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

process.env.MESH_NETWORK_FILTER = 'false';

const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');
const RateLimiter = require('../../src/extensions/scratch3_mesh_v2/rate-limiter');
const Variable = require('../../src/engine/variable');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createSetup = () => {
    const stage = {
        variables: {
            'score-id': { name: 'score', type: Variable.SCALAR_TYPE, value: 0 },
            'name-id': { name: 'name', type: Variable.SCALAR_TYPE, value: 'a' },
            'list-id': { name: 'list', type: Variable.LIST_TYPE, value: [1, 2] },
        },
    };
    const listeners = {};
    const blocks = {
        runtime: {
            getTargetForStage: () => stage,
            sequencer: {},
            emit: () => {},
            on: (event, fn) => {
                (listeners[event] = listeners[event] || []).push(fn);
            },
            off: () => {},
        },
        opcodeFunctions: { event_broadcast: () => {} },
    };
    const service = new MeshV2Service(blocks, 'node1', 'domain1');
    const mutations = [];
    service.client = {
        mutate: (req) => {
            mutations.push(req.variables.data);
            return Promise.resolve({ data: { reportDataByNode: { nodeStatus: { data: req.variables.data } } } });
        },
    };
    const step = () => (listeners.BEFORE_STEP || []).forEach((fn) => fn());
    return { stage, service, mutations, step };
};

test('MeshV2Service sends global variables changed outside blocks (#1930)', (t) => {
    t.test('a slider change is sent on the next frame', async (st) => {
        const { stage, service, mutations, step } = createSetup();
        service.groupId = 'group1';
        await service.sendAllGlobalVariables();
        mutations.length = 0;
        service.dataRateLimiter.lastSendTime = 0;

        stage.variables['score-id'].value = 42; // what the slider does
        step();
        await service.lastDataSendPromise;
        await service.dataRateLimiter.waitForCompletion();

        st.same(mutations, [[{ key: 'score', value: '42' }]], 'only the changed variable is sent');
        st.equal(service.getRemoteVariable('score'), '42', 'own sensor value is updated at once');
        st.end();
    });

    t.test('nothing is sent while nothing changes', async (st) => {
        const { service, mutations, step } = createSetup();
        service.groupId = 'group1';
        await service.sendAllGlobalVariables();
        await service.dataRateLimiter.waitForCompletion();
        mutations.length = 0;

        let sendDataCalls = 0;
        const original = service.sendData.bind(service);
        service.sendData = (...args) => {
            sendDataCalls++;
            return original(...args);
        };
        for (let i = 0; i < 30; i++) step();
        await service.dataRateLimiter.waitForCompletion();

        st.equal(sendDataCalls, 0, 'sendData is not called');
        st.equal(mutations.length, 0, 'no REPORT_DATA');
        st.end();
    });

    t.test('a value already sent by a block is not sent again', async (st) => {
        const { stage, service, mutations, step } = createSetup();
        service.groupId = 'group1';
        await service.sendAllGlobalVariables();
        await service.dataRateLimiter.waitForCompletion();
        mutations.length = 0;
        service.dataRateLimiter.lastSendTime = 0;

        // data_setvariableto → syncVariable sends with force
        stage.variables['score-id'].value = 7;
        service.sendData([{ key: 'score', value: '7' }], { force: true });
        step();
        step();
        await service.dataRateLimiter.waitForCompletion();

        st.same(mutations, [[{ key: 'score', value: '7' }]], 'sent once');
        st.end();
    });

    t.test('nothing is sent when not in a group', async (st) => {
        const { stage, service, mutations, step } = createSetup();
        stage.variables['score-id'].value = 5;
        step();
        await service.dataRateLimiter.waitForCompletion();

        st.equal(mutations.length, 0);
        st.same(service.latestQueuedData, {});
        st.end();
    });

    t.test('dragging the slider keeps the rate limit and ends with the last value', async (st) => {
        const { stage, service, mutations, step } = createSetup();
        const interval = 200;
        service.dataRateLimiter = new RateLimiter(interval, { enableMerge: true, mergeKeyField: 'key' });
        service.groupId = 'group1';
        await service.sendAllGlobalVariables();
        await service.dataRateLimiter.waitForCompletion();
        mutations.length = 0;

        // 40 frames, about 20 ms apart (~800 ms), a new value on every frame
        const started = Date.now();
        for (let i = 1; i <= 40; i++) {
            stage.variables['score-id'].value = i;
            step();
            await sleep(20);
        }
        const elapsed = Date.now() - started;
        await service.dataRateLimiter.waitForCompletion();

        const maxMutations = Math.ceil(elapsed / interval) + 1;
        st.ok(mutations.length >= 2, `sent while dragging (${mutations.length})`);
        st.ok(
            mutations.length <= maxMutations,
            `${mutations.length} REPORT_DATA <= ${maxMutations} (one per interval)`,
        );
        st.same(mutations[mutations.length - 1], [{ key: 'score', value: '40' }], 'the last value is sent last');
        mutations.forEach((data) => st.equal(data.length, 1, 'only the changed variable is in each REPORT_DATA'));
        st.end();
    });

    t.end();
});
