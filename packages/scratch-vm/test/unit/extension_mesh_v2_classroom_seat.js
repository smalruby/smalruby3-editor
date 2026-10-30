const test = require('tap').test;
const minilog = require('minilog');
minilog.suggest.deny('vm', 'debug');
minilog.suggest.deny('vm', 'info');

process.env.MESH_NETWORK_FILTER = 'false';

const URLSearchParams = require('url').URLSearchParams;
const MeshV2Blocks = require('../../src/extensions/scratch3_mesh_v2/index.js');
const Variable = require('../../src/engine/variable');

const createMockRuntime = () => {
    const runtime = {
        registerPeripheralExtension: () => {},
        on: () => {},
        emit: (event, data) => {
            runtime.lastEmittedEvent = event;
            runtime.lastEmittedData = data;
        },
        getOpcodeFunction: () => () => {},
        createNewGlobalVariable: (name) => ({ type: Variable.SCALAR_TYPE, name: name || 'var1', value: 0 }),
        _primitives: {},
        extensionManager: {
            isExtensionLoaded: () => false,
        },
        constructor: {
            PERIPHERAL_LIST_UPDATE: 'PERIPHERAL_LIST_UPDATE',
            PERIPHERAL_CONNECTED: 'PERIPHERAL_CONNECTED',
            PERIPHERAL_DISCONNECTED: 'PERIPHERAL_DISCONNECTED',
            PERIPHERAL_CONNECTION_ERROR_ID: 'PERIPHERAL_CONNECTION_ERROR_ID',
            PERIPHERAL_CONNECTION_LOST_ERROR: 'PERIPHERAL_CONNECTION_LOST_ERROR',
            PERIPHERAL_REQUEST_ERROR: 'PERIPHERAL_REQUEST_ERROR',
        },
    };
    const stage = {
        variables: {},
        getCustomVars: () => [],
        lookupVariableById: (id) =>
            stage.variables[id] || { id: id, name: 'var1', value: 0, type: Variable.SCALAR_TYPE },
        lookupVariableByNameAndType: () => null,
        lookupOrCreateVariable: () => ({}),
        createVariable: () => {},
        setVariableValue: () => {},
        renameVariable: () => {},
    };
    runtime.getTargetForStage = () => stage;
    return runtime;
};

require('tap').teardown(() => {
    delete global.window;
});

const setup = () => {
    global.window = { location: { search: '?mesh=test-domain' } };
    global.URLSearchParams = URLSearchParams;
    return new MeshV2Blocks(createMockRuntime());
};

test('outside a classroom the node id and host group name are unchanged', (t) => {
    const blocks = setup();
    t.equal(blocks.classroomSeat, null);
    t.equal(blocks.getMeshNodeId(), blocks.nodeId);
    t.equal(blocks.makeHostGroupName(), blocks.nodeId);
    t.end();
});

test('a student seat goes into the node id and the host group name', (t) => {
    const blocks = setup();
    t.equal(blocks.setClassroomSeat({ seat: 7, teacher: false }), true);
    t.equal(blocks.meshService.meshId, `${blocks.nodeId}s07`);
    t.equal(blocks.makeHostGroupName(), `${blocks.nodeId}s07|host=7`);
    t.equal(
        blocks.makeMeshIdLabel(blocks.makeHostGroupName()),
        blocks.makeMeshIdLabel(blocks.nodeId),
        'the 6-letter label is unchanged',
    );
    t.end();
});

test('a teacher gets host=teacher without a node id suffix', (t) => {
    const blocks = setup();
    blocks.setClassroomSeat({ seat: null, teacher: true });
    t.equal(blocks.meshService.meshId, blocks.nodeId);
    t.equal(blocks.makeHostGroupName(), `${blocks.nodeId}|host=teacher`);
    t.end();
});

test('chosen seats go into the host group name (connect by seat number)', (t) => {
    const blocks = setup();
    blocks.setClassroomSeat({ seat: 3, teacher: false });
    blocks.setSeatGroupSeats([12, 3, 7, 7]);
    t.equal(blocks.makeHostGroupName(), `${blocks.nodeId}s03|seats=3,7,12|host=3`);
    t.end();
});

test('clearing the chosen seats returns to a host-only name', (t) => {
    const blocks = setup();
    blocks.setClassroomSeat({ seat: 3, teacher: false });
    blocks.setSeatGroupSeats([3, 7]);
    blocks.setSeatGroupSeats(null);
    t.equal(blocks.makeHostGroupName(), `${blocks.nodeId}s03|host=3`);
    t.end();
});

test('chosen seats are ignored outside a classroom and for the teacher', (t) => {
    const blocks = setup();
    blocks.setSeatGroupSeats([3, 7]);
    t.equal(blocks.makeHostGroupName(), blocks.nodeId);
    blocks.setClassroomSeat({ seat: null, teacher: true });
    t.equal(blocks.makeHostGroupName(), `${blocks.nodeId}|host=teacher`);
    t.end();
});

test('leaving the classroom restores the plain node id', (t) => {
    const blocks = setup();
    blocks.setClassroomSeat({ seat: 3 });
    blocks.setClassroomSeat(null);
    t.equal(blocks.classroomSeat, null);
    t.equal(blocks.meshService.meshId, blocks.nodeId);
    t.equal(blocks.makeHostGroupName(), blocks.nodeId);
    t.end();
});

test('the seat is not changed while connected', (t) => {
    const blocks = setup();
    blocks.connectionState = 'connected';
    t.equal(blocks.setClassroomSeat({ seat: 3 }), false);
    t.equal(blocks.meshService.meshId, blocks.nodeId);
    t.end();
});

test('a seat set while connected is applied at the next connect', (t) => {
    const blocks = setup();
    blocks.connectionState = 'connected';
    blocks.setClassroomSeat({ seat: 3 });
    t.equal(blocks.meshService.meshId, blocks.nodeId, 'kept while connected');

    blocks.connectionState = 'disconnected';
    const created = [];
    blocks.meshService.createGroup = (name) => {
        created.push({ name, meshId: blocks.meshService.meshId });
        return new Promise(() => {});
    };
    blocks.connect('meshV2_host');
    t.same(created, [{ name: `${blocks.nodeId}s03|host=3`, meshId: `${blocks.nodeId}s03` }]);
    t.end();
});

test('leaving the class while connected restores the plain node id at the next join', (t) => {
    const blocks = setup();
    blocks.setClassroomSeat({ seat: 5 });
    blocks.connectionState = 'connected';
    blocks.setClassroomSeat(null);
    t.equal(blocks.meshService.meshId, `${blocks.nodeId}s05`, 'kept while connected');

    blocks.connectionState = 'disconnected';
    let joinedAs = null;
    blocks.meshService.joinGroup = () => {
        joinedAs = blocks.meshService.meshId;
        return new Promise(() => {});
    };
    blocks.connect('group-1');
    t.equal(joinedAs, blocks.nodeId);
    t.end();
});

test('groupToPeripheral carries seat info and keeps the legacy name', (t) => {
    const blocks = setup();
    const base = '0123456789abcdef0123456789abcdef';
    const host = `${base}s03`;
    const seated = blocks.groupToPeripheral({
        id: 'g1',
        name: `${host}|seats=3,7,12|host=3`,
        hostId: host,
        domain: 'd',
    });
    t.equal(seated.peripheralId, 'g1');
    t.equal(seated.name, `【${blocks.makeMeshIdLabel(base)}】`);
    t.equal(seated.meshIdLabel, blocks.makeMeshIdLabel(base));
    t.same(seated.seatInfo, { baseName: host, seats: [3, 7, 12], host: 3 });
    t.equal(seated.domain, 'd');
    const legacy = blocks.groupToPeripheral({ id: 'g2', name: base, domain: 'd' });
    t.equal(legacy.seatInfo, null);
    t.equal(legacy.name, `【${blocks.makeMeshIdLabel(base)}】`);
    t.end();
});

test('groupToPeripheral drops seat info whose head is not the recorded host', (t) => {
    const blocks = setup();
    const base = '0123456789abcdef0123456789abcdef';
    const spoofed = blocks.groupToPeripheral({
        id: 'g3',
        name: `${base}|host=teacher`,
        hostId: 'fedcba9876543210fedcba9876543210s04',
        domain: 'd',
    });
    t.equal(spoofed.seatInfo, null);
    t.equal(spoofed.name, `【${blocks.makeMeshIdLabel(base)}】`, 'still listed with the plain label');
    t.end();
});

test('listSeatGroups lists live groups with the seats of their members', async (t) => {
    const blocks = setup();
    const base = '0123456789abcdef0123456789abcdef';
    const host = `${base}s03`;
    const future = new Date(Date.now() + 60000).toISOString();
    const past = new Date(Date.now() - 60000).toISOString();
    blocks.meshService.listGroups = () =>
        Promise.resolve([
            { id: 'g1', name: `${host}|seats=3,7|host=3`, hostId: host, domain: 'd', expiresAt: future },
            { id: 'g2', name: base, hostId: base, domain: 'd', expiresAt: future },
            { id: 'g3', name: `${host}|seats=3|host=3`, hostId: host, domain: 'd', expiresAt: past },
        ]);
    const asked = [];
    blocks.meshService.listNodesInGroup = (groupId, domain) => {
        asked.push([groupId, domain]);
        return Promise.resolve([{ id: host }, { id: 'fedcba9876543210fedcba9876543210s07' }, { id: base }]);
    };
    const groups = await blocks.listSeatGroups();
    t.same(
        groups.map((g) => [g.id, g.memberSeats]),
        [
            ['g1', [3, 7]],
            ['g2', []],
        ],
    );
    t.same(asked, [['g1', 'd']], 'members are asked only for groups with seat info');
    t.same(groups[0].seatInfo.seats, [3, 7]);
    t.same(
        blocks.discoveredGroups.map((g) => g.id),
        ['g1', 'g2', 'g3'],
        'connect() can join a listed group',
    );
    t.end();
});

test('listSeatGroups keeps a group when its members cannot be listed', async (t) => {
    const blocks = setup();
    const base = '0123456789abcdef0123456789abcdef';
    const host = `${base}s03`;
    blocks.meshService.listGroups = () =>
        Promise.resolve([{ id: 'g1', name: `${host}|host=3`, hostId: host, domain: 'd' }]);
    blocks.meshService.listNodesInGroup = () => Promise.reject(new Error('boom'));
    const groups = await blocks.listSeatGroups();
    t.same(groups[0].memberSeats, [3], 'the host is always a member');
    t.end();
});

test('getConnectedGroupId returns the joined group', (t) => {
    const blocks = setup();
    t.equal(blocks.getConnectedGroupId(), null);
    blocks.meshService.groupId = 'g9';
    t.equal(blocks.getConnectedGroupId(), 'g9');
    t.end();
});

test('isConnectedAsHost is true only while hosting a group', (t) => {
    const blocks = setup();
    t.equal(blocks.isConnectedAsHost(), false);
    blocks.meshService.groupId = 'g9';
    blocks.meshService.isHost = false;
    t.equal(blocks.isConnectedAsHost(), false);
    blocks.meshService.isHost = true;
    t.equal(blocks.isConnectedAsHost(), true);
    t.end();
});
