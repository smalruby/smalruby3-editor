const test = require('tap').test;
const minilog = require('minilog');
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

const { buildStatusSnapshot } = require('../../src/extensions/scratch3_mesh_v2/status-snapshot');
const MeshV2Service = require('../../src/extensions/scratch3_mesh_v2/mesh-service');

const makeService = (meshId) => {
    const service = new MeshV2Service(
        {
            runtime: { sequencer: {}, emit: () => {}, on: () => {}, off: () => {} },
            opcodeFunctions: { event_broadcast: () => {} },
        },
        meshId,
        'domain1',
    );
    service.stopEventBatchTimer();
    return service;
};

test('a disconnected snapshot shows no nodes but keeps the history (#1844)', (t) => {
    const service = makeService('self');
    service.recordMessage({ direction: 'sent', name: 'a', value: '', nodeId: 'self', at: 5 });
    const snap = buildStatusSnapshot({
        connectionState: 'disconnected',
        service,
        domain: 'd',
        groupLabel: 'ほげ',
        inClassroom: false,
    });
    t.equal(snap.connected, false);
    t.equal(snap.useWebSocket, null);
    t.equal(snap.groupLabel, '');
    t.equal(snap.nodeCount, 0);
    t.same(snap.nodes, []);
    t.equal(snap.history.length, 1);
    t.equal(snap.domain, 'd');
    t.end();
});

test('nodes come from remoteData until the node list is known (#1844)', (t) => {
    const service = makeService('self');
    service.groupId = 'g';
    service.useWebSocket = false;
    service.isHost = true;
    service.remoteData = {
        b2: { score: { value: '3', timestamp: 200 }, a: { value: 'x', timestamp: 300 } },
        self: { mine: { value: '1', timestamp: 100 } },
        a1: {},
    };
    const snap = buildStatusSnapshot({
        connectionState: 'connected',
        service,
        domain: 'd',
        groupLabel: 'かな',
        inClassroom: false,
    });
    t.equal(snap.connected, true);
    t.equal(snap.useWebSocket, false);
    t.equal(snap.isHost, true);
    t.equal(snap.groupLabel, 'かな');
    t.equal(snap.nodeCount, 3);
    t.equal(snap.nodeCountFromServer, false);
    t.same(
        snap.nodes.map((n) => [n.id, n.isSelf, n.lastDataAt]),
        [
            ['self', true, 100],
            ['b2', false, 300],
            ['a1', false, null],
        ],
    );
    t.same(snap.nodes[1].variables, [
        { name: 'a', value: 'x', at: 300 },
        { name: 'score', value: '3', at: 200 },
    ]);
    t.end();
});

test('the node list from the server decides who is shown and the count (#1844)', (t) => {
    const service = makeService('aaas07');
    service.groupId = 'g';
    service.useWebSocket = true;
    service.remoteData = {
        gone: { v: { value: '1', timestamp: 1 } },
        bbbs12: { v: { value: '2', timestamp: 2 } },
        // joined after the node list was fetched: shown without waiting 30 seconds
        newcomer: { v: { value: '3', timestamp: 5000 } },
    };
    service.groupNodeIds = ['ccc', 'bbbs12', 'aaas07', 'ddds03'];
    service.groupNodesFetchedAt = 1000;
    const snap = buildStatusSnapshot({
        connectionState: 'connected',
        service,
        domain: 'd',
        groupLabel: '',
        inClassroom: true,
    });
    t.equal(snap.inClassroom, true);
    t.equal(snap.nodeCount, 5);
    t.equal(snap.nodeCountFromServer, true);
    t.same(
        snap.nodes.map((n) => [n.id, n.seat]),
        [
            ['aaas07', 7],
            ['ddds03', 3],
            ['bbbs12', 12],
            ['ccc', null],
            ['newcomer', null],
        ],
    );
    t.end();
});

test('a member also shows the host from the head of the group name (#1844)', (t) => {
    const service = makeService('bbbbbbbbs12');
    service.groupId = 'g';
    service.isHost = false;
    service.groupName = 'aaaaaaaas03|seats=3,12|host=3';
    service.groupNodeIds = ['bbbbbbbbs12'];
    service.groupNodesFetchedAt = 1000;
    service.remoteData = { aaaaaaaas03: { v: { value: '1', timestamp: 10 } } };
    const snap = buildStatusSnapshot({ connectionState: 'connected', service, inClassroom: true });
    t.same(
        snap.nodes.map((n) => [n.id, n.variables.length]),
        [
            ['bbbbbbbbs12', 0],
            ['aaaaaaaas03', 1],
        ],
    );
    t.equal(snap.nodeCount, 2);
    // a name that is not a node id (e.g. a test group) adds nothing
    service.groupName = 'ws-grp-1';
    t.equal(buildStatusSnapshot({ connectionState: 'connected', service }).nodeCount, 1);
    t.end();
});

test('the extension exposes the snapshot and the throttled node refresh (#1844)', async (t) => {
    const MeshV2Blocks = require('../../src/extensions/scratch3_mesh_v2/index.js');
    const runtime = {
        registerPeripheralExtension: () => {},
        on: () => {},
        emit: () => {},
        getOpcodeFunction: () => () => {},
        _primitives: {},
        constructor: {},
    };
    const ext = new MeshV2Blocks(runtime);
    if (!ext.meshService) {
        t.equal(ext.getStatusSnapshot(), null);
        t.end();
        return;
    }
    ext.meshService.stopEventBatchTimer();
    ext.classroomSeat = { seat: 3, teacher: false };
    ext.connectionState = 'connected';
    ext.meshService.groupId = 'g';
    ext.meshService.groupName = '0123456789';
    ext.meshService.isHost = true;
    let calls = 0;
    ext.meshService.listNodesInGroup = () => {
        calls++;
        return Promise.resolve([{ id: 'x' }]);
    };
    t.same(await ext.refreshGroupNodes(), ['x']);
    await ext.refreshGroupNodes();
    t.equal(calls, 1);
    const snap = ext.getStatusSnapshot();
    t.equal(snap.inClassroom, true);
    t.equal(snap.groupLabel, ext.makeMeshIdLabel('0123456789'));
    t.equal(snap.nodeCount, 2); // 自分 + x
    ext.meshService.cleanup();
    t.end();
});
