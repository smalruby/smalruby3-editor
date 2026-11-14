const test = require('tap').test;
const minilog = require('minilog');
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');
const {
    MAX_MESSAGE_HISTORY,
    NODE_LIST_MIN_INTERVAL_MS,
} = require('../../src/extensions/scratch3_mesh_v2/status-history');

const makeBlocks = () => ({
    runtime: { sequencer: {}, emit: () => {}, on: () => {}, off: () => {} },
    opcodeFunctions: { event_broadcast: () => {} },
});

const makeService = (meshId = 'self') => {
    const service = new MeshV2Service(makeBlocks(), meshId, 'domain1');
    service.stopEventBatchTimer();
    return service;
};

test('history starts empty and is a read-only copy (#1844)', (t) => {
    const service = makeService();
    t.same(service.getMessageHistory(), []);
    service.recordMessage({ direction: 'sent', name: 'a', value: '1', nodeId: 'self', at: 1 });
    const history = service.getMessageHistory();
    history.push({ name: 'x' });
    t.equal(service.getMessageHistory().length, 1);
    t.ok(Object.isFrozen(service.getMessageHistory()[0]));
    t.equal(service.getMessageHistory()[0].name, 'a');
    t.end();
});

test('history keeps the newest first and at most 50 items (#1844)', (t) => {
    const service = makeService();
    t.equal(MAX_MESSAGE_HISTORY, 50);
    for (let i = 0; i < 60; i++) {
        service.recordMessage({ direction: 'received', name: `m${i}`, value: '', nodeId: 'n1', at: i });
    }
    const history = service.getMessageHistory();
    t.equal(history.length, 50);
    t.equal(history[0].name, 'm59');
    t.equal(history[49].name, 'm10');
    t.end();
});

test('received events are recorded with sender, value and time (#1844)', (t) => {
    const service = makeService();
    service._queueEventsForPlayback([
        { name: 'b', firedByNodeId: 'n2', payload: 'v2', timestamp: '2026-11-14T00:00:02.000Z' },
        { name: 'a', firedByNodeId: 'n1', payload: null, timestamp: '2026-11-14T00:00:01.000Z' },
    ]);
    const history = service.getMessageHistory();
    t.same(
        history.map((h) => [h.direction, h.name, h.value, h.nodeId, h.at]),
        [
            ['received', 'b', 'v2', 'n2', Date.parse('2026-11-14T00:00:02.000Z')],
            ['received', 'a', '', 'n1', Date.parse('2026-11-14T00:00:01.000Z')],
        ],
    );
    t.end();
});

test('sent events are recorded only after the batch is sent (#1844)', async (t) => {
    const service = makeService();
    service.groupId = 'g1';
    const mutations = [];
    service.client = {
        mutate: (args) => {
            mutations.push(args);
            return Promise.resolve({ data: {} });
        },
    };
    service.fireEvent('a', 'x');
    service.fireEvent('b');
    // queued, not sent yet
    t.same(service.getMessageHistory(), []);
    await service.processBatchEvents();
    t.equal(mutations.length, 1);
    const history = service.getMessageHistory();
    t.same(
        history.map((h) => [h.direction, h.name, h.value, h.nodeId]),
        [
            ['sent', 'b', '', 'self'],
            ['sent', 'a', 'x', 'self'],
        ],
    );
    t.ok(Number.isFinite(history[0].at));

    // a failed send is not recorded
    service.client = { mutate: () => Promise.reject(new Error('boom')) };
    service.shouldDisconnectOnError = () => null;
    service.fireEvent('c');
    await service.processBatchEvents();
    t.equal(service.getMessageHistory().length, 2);
    t.end();
});

test('history is cleared when a new group starts (#1844)', async (t) => {
    const service = makeService();
    service.recordMessage({ direction: 'sent', name: 'a', value: '', nodeId: 'self', at: 1 });
    service.client = {
        mutate: () =>
            Promise.resolve({
                data: {
                    joinGroup: {
                        id: 'n',
                        groupId: 'g2',
                        domain: 'domain1',
                        expiresAt: new Date(Date.now() + 60000).toISOString(),
                        heartbeatIntervalSeconds: 120,
                        useWebSocket: false,
                    },
                },
            }),
        query: () => Promise.resolve({ data: {} }),
    };
    service.startPolling = () => {};
    service.startHeartbeat = () => {};
    service.startConnectionTimer = () => {};
    service.startEventBatchTimer = () => {};
    service.sendAllGlobalVariables = () => Promise.resolve();
    service.fetchAllNodesData = () => Promise.resolve();
    await service.joinGroup('g2', 'domain1', 'name', 'hostnode1');
    t.same(service.getMessageHistory(), []);
    // the server-recorded host is remembered for the status window (review Q1)
    t.equal(service.groupHostId, 'hostnode1');
    service.cleanup();
    t.equal(service.groupHostId, null);
    t.end();
});

test('refreshGroupNodes asks the server at most once per 30 seconds (#1844)', async (t) => {
    const service = makeService();
    t.equal(NODE_LIST_MIN_INTERVAL_MS, 30000);
    service.groupId = 'g1';
    let calls = 0;
    service.listNodesInGroup = () => {
        calls++;
        return Promise.resolve([{ id: 'self' }, { id: 'n1' }]);
    };
    t.equal(service.getGroupNodeIds(), null);
    t.same(await service.refreshGroupNodes(1000), ['self', 'n1']);
    t.same(await service.refreshGroupNodes(1000 + 29999), ['self', 'n1']);
    t.equal(calls, 1);
    await service.refreshGroupNodes(1000 + 30000);
    t.equal(calls, 2);
    t.same(service.getGroupNodeIds(), ['self', 'n1']);

    // not connected: no query
    service.groupId = null;
    t.equal(await service.refreshGroupNodes(999999), null);
    t.equal(calls, 2);

    // a failure keeps the old list and still waits 30 seconds
    service.groupId = 'g1';
    service.listNodesInGroup = () => {
        calls++;
        return Promise.reject(new Error('x'));
    };
    t.same(await service.refreshGroupNodes(200000), ['self', 'n1']);
    t.same(await service.refreshGroupNodes(200001), ['self', 'n1']);
    t.equal(calls, 3);

    // cleanup forgets the list
    service.cleanup();
    t.equal(service.getGroupNodeIds(), null);
    t.end();
});

test('refreshGroupNodes shares one request while it is in flight (#1844)', async (t) => {
    const service = makeService();
    service.groupId = 'g1';
    let calls = 0;
    service.listNodesInGroup = () => {
        calls++;
        return new Promise((resolve) => setTimeout(() => resolve([{ id: 'a' }]), 10));
    };
    const [a, b] = await Promise.all([service.refreshGroupNodes(1), service.refreshGroupNodes(2)]);
    t.same(a, ['a']);
    t.same(b, ['a']);
    t.equal(calls, 1);
    t.end();
});

test('a throwing history recorder never breaks receiving (#1844 review M1)', (t) => {
    const service = makeService();
    service.recordReceivedEvents = () => {
        throw new Error('recorder broke');
    };
    t.doesNotThrow(() =>
        service._queueEventsForPlayback([
            { name: 'a', firedByNodeId: 'n1', payload: 'v', timestamp: '2026-11-14T00:00:01.000Z' },
            { name: 'b', firedByNodeId: 'n1', payload: '', timestamp: '2026-11-14T00:00:02.000Z' },
        ]),
    );
    t.same(
        service.pendingBroadcasts.map((p) => p.event.name),
        ['a', 'b'],
    );
    t.end();
});

test('a throwing history recorder never disconnects the sender (#1844 review M1)', async (t) => {
    const service = makeService();
    service.groupId = 'g1';
    let mutations = 0;
    service.client = {
        mutate: () => {
            mutations++;
            return Promise.resolve({ data: {} });
        },
    };
    service.recordSentEvents = () => {
        throw new Error('group not found in recorder');
    };
    let disconnectChecks = 0;
    service.shouldDisconnectOnError = () => {
        disconnectChecks++;
        return 'GroupNotFound';
    };
    let disconnected = false;
    service.cleanupAndDisconnect = () => {
        disconnected = true;
    };
    service.fireEvent('a', 'x');
    await service.processBatchEvents();
    t.equal(mutations, 1);
    t.equal(disconnectChecks, 0);
    t.equal(disconnected, false);
    t.equal(service.groupId, 'g1');
    t.end();
});
