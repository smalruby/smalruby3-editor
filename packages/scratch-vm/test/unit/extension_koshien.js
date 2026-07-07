const test = require('tap').test;
const KoshienBlocks = require('../../src/extensions/koshien/index.js');

const createMockRuntime = () => {
    const runtime = {
        on: () => {},
        emit: (event, data) => {
            runtime.lastEmittedEvent = event;
            runtime.lastEmittedData = data;
        },
        getEditingTarget: () => ({
            getAllVariableNamesInScopeByType: () => [],
        }),
        formatMessage: (messageData) => messageData.default || messageData.defaultMessage,
        setup: () => ({
            locale: 'en',
            translations: {
                en: {},
            },
        }),
    };
    runtime.formatMessage.setup = runtime.setup;
    return runtime;
};

// Build a fake target + util exposing lookupVariableByNameAndType, mirroring the VM.
// vars: { name: { type: '' | 'list', value } }
const createUtilWithVars = (vars) => {
    const variables = {};
    Object.keys(vars).forEach((name, i) => {
        variables[`id${i}`] = {
            name,
            type: vars[name].type,
            value: vars[name].value,
            _monitorUpToDate: true,
        };
    });
    const target = {
        variables,
        isStage: false,
        lookupVariableByNameAndType(name, type) {
            for (const id of Object.keys(this.variables)) {
                const v = this.variables[id];
                if (v.name === name && v.type === type) return v;
            }
            return null;
        },
    };
    return { util: { target }, target };
};

// Reveal the whole 17x17 my-map by calling getMapArea over a covering grid of
// centers (radius 2 windows; centers spaced to cover rows/cols 0..16).
const revealAll = (blocks) => {
    for (const cy of [2, 7, 12, 14]) {
        for (const cx of [2, 7, 12, 14]) {
            blocks.getMapArea({ POSITION: `${cx}:${cy}` });
        }
    }
};

test('Koshien Blocks', (t) => {
    t.test('constructor', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        st.type(blocks, KoshienBlocks);
        st.ok(blocks._client);
        st.end();
    });

    t.test('getInfo', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        const info = blocks.getInfo();
        st.equal(info.id, 'koshien');
        st.ok(info.blocks.length > 0);

        // Verify setMessage block exists
        const setMessageBlock = info.blocks.find((b) => b.opcode === 'setMessage');
        st.ok(setMessageBlock);
        st.equal(setMessageBlock.text, 'message [MESSAGE]');
        st.end();
    });

    t.test('setMessage', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);

        let messageSent = null;
        blocks._client.setMessage = (message) => {
            messageSent = message;
            return Promise.resolve();
        };

        const args = { MESSAGE: 'hello world' };
        const result = blocks.setMessage(args);

        st.type(result, Promise);
        st.equal(messageSent, 'hello world');
        st.end();
    });

    t.test('connectGame', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);

        st.equal(blocks.connectGame({ NAME: 'player1' }), true);
        st.ok(blocks._client.isConnected());
        st.equal(blocks._client._playerName, 'player1');

        // Second call should return false if already connected
        st.equal(blocks.connectGame({ NAME: 'player2' }), false);
        st.end();
    });

    t.test('position', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        st.equal(blocks.position({ X: 1, Y: 2 }), '1:2');
        st.end();
    });

    t.test('positionOf', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        st.equal(blocks.positionOf({ POSITION: '3:4', COORDINATE: 'x' }), 3);
        st.equal(blocks.positionOf({ POSITION: '3:4', COORDINATE: 'y' }), 4);
        st.end();
    });

    t.test('object', (st) => {
        const mockRuntime = createMockRuntime();
        const blocks = new KoshienBlocks(mockRuntime);
        st.equal(blocks.object({ OBJECT: 'wall' }), 1);
        st.equal(blocks.object({ OBJECT: 'goal' }), 3);
        st.equal(blocks.object({ OBJECT: 'unknown' }), -1);
        st.end();
    });

    // --- Issue #739: MockClient believable, fog-of-war return values ---

    t.test('map is unexplored (-1) until getMapArea reveals it', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        st.equal(blocks.map({ POSITION: '8:9' }), -1); // not yet revealed
        blocks.getMapArea({ POSITION: '8:8' }); // reveal the 5x5 around (8,8)
        st.equal(blocks.map({ POSITION: '8:9' }), 3); // goal now visible
        st.equal(blocks.map({ POSITION: '8:8' }), 0); // space
        st.equal(blocks.map({ POSITION: '0:0' }), -1); // far away, still unexplored
        st.end();
    });

    t.test('mapAll starts fully unexplored and fills in as areas are revealed', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        const before = blocks.mapAll({}).split(',');
        st.equal(before.length, 17);
        before.forEach((row) => st.equal(row, '-----------------')); // 17x17 of '-'
        blocks.getMapArea({ POSITION: '8:8' });
        const after = blocks.mapAll({});
        st.ok(after.includes('3')); // the goal is now revealed
        st.ok(after.includes('-')); // the rest is still unexplored
        st.end();
    });

    t.test('once fully revealed, the field is bordered by unbreakable walls (1/2)', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        revealAll(blocks);
        const rows = blocks.mapAll({}).split(',');
        const n = rows.length;
        st.equal(n, 17);
        const unbreakable = (ch) => ch === '1' || ch === '2';
        for (let i = 0; i < n; i++) {
            st.ok(unbreakable(rows[0][i]), `top ${i}`);
            st.ok(unbreakable(rows[n - 1][i]), `bottom ${i}`);
            st.ok(unbreakable(rows[i][0]), `left ${i}`);
            st.ok(unbreakable(rows[i][n - 1]), `right ${i}`);
        }
        st.end();
    });

    t.test('mapFrom parses a map string variable, else returns -1', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        revealAll(blocks);
        const mapString = blocks.mapAll({});
        const { util } = createUtilWithVars({
            $all: { type: '', value: mapString },
        });
        st.equal(blocks.mapFrom({ POSITION: '8:9', MAP: '$all' }, util), 3); // goal
        st.equal(blocks.mapFrom({ POSITION: '15:1', MAP: '$all' }, util), 'a'); // item
        // unknown variable -> -1 (unexplored)
        st.equal(blocks.mapFrom({ POSITION: '3:4', MAP: '$missing' }, util), -1);
        st.end();
    });

    t.test('targetCoordinate returns map-consistent positions for each target', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '5:1');
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'x' }), 5);
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'y' }), 1);
        st.equal(blocks.targetCoordinate({ TARGET: 'goal', COORDINATE: 'position' }), '8:9');
        st.equal(blocks.targetCoordinate({ TARGET: 'goal', COORDINATE: 'x' }), 8);
        st.equal(blocks.targetCoordinate({ TARGET: 'enemy', COORDINATE: 'position' }), '8:9');
        st.equal(blocks.targetCoordinate({ TARGET: 'other_player', COORDINATE: 'position' }), '10:1');
        // goal coordinate matches the '3' cell once that area is explored
        blocks.getMapArea({ POSITION: '8:8' });
        st.equal(blocks.map({ POSITION: '8:9' }), 3);
        st.end();
    });

    t.test('calcGoalRoute writes a route from player to goal', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        const { util, target } = createUtilWithVars({
            route: { type: 'list', value: [] },
        });
        blocks.calcGoalRoute({ RESULT: 'route' }, util);
        const list = target.lookupVariableByNameAndType('route', 'list');
        st.ok(list.value.length > 2); // a multi-step path, not just [src, dst]
        st.equal(list.value[0], '5:1');
        st.equal(list.value[list.value.length - 1], '8:9');
        st.equal(list._monitorUpToDate, false);
        st.end();
    });

    t.test('calcRoute writes a path between two points', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        const { util, target } = createUtilWithVars({
            route: { type: 'list', value: [] },
        });
        blocks.calcRoute({ SRC: '1:4', DST: '14:4', EXCEPT_CELLS: ' ', RESULT: 'route' }, util);
        const list = target.lookupVariableByNameAndType('route', 'list');
        st.ok(list.value.length > 2);
        st.equal(list.value[0], '1:4');
        st.equal(list.value[list.value.length - 1], '14:4');
        st.end();
    });

    t.test('locateObjects finds harmful items only after they are revealed', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        const { util, target } = createUtilWithVars({
            objs: { type: 'list', value: [] },
        });
        // before exploring, nothing on the my-map is known
        blocks.locateObjects({ POSITION: '8:8', SQ_SIZE: 17, OBJECTS: 'ABCD', RESULT: 'objs' }, util);
        st.same(target.lookupVariableByNameAndType('objs', 'list').value, []);
        // explore the whole field, then the harmful items show up
        revealAll(blocks);
        blocks.locateObjects({ POSITION: '8:8', SQ_SIZE: 17, OBJECTS: 'ABCD', RESULT: 'objs' }, util);
        const list = target.lookupVariableByNameAndType('objs', 'list');
        st.ok(list.value.length > 0);
        // each located cell really holds a harmful item (self-consistency)
        list.value.forEach((pos) => st.ok('ABCD'.includes(String(blocks.map({ POSITION: pos })))));
        st.end();
    });

    t.test('calc* with empty/unknown result list is a no-op (no throw)', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        const { util } = createUtilWithVars({});
        st.doesNotThrow(() => blocks.calcGoalRoute({ RESULT: ' ' }, util));
        st.doesNotThrow(() => blocks.calcGoalRoute({ RESULT: 'nope' }, util));
        st.end();
    });

    t.test('command blocks do not throw', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        st.doesNotThrow(() => blocks.getMapArea({ POSITION: '1:1' }));
        st.doesNotThrow(() => blocks.turnOver({}));
        st.doesNotThrow(() => blocks.setItem({ ITEM: 'dynamite', POSITION: '1:1' }));
        const moved = blocks.moveTo({ POSITION: '1:1' });
        st.type(moved, Promise);
        st.end();
    });

    t.test('always uses the built-in mock game (no remote backend)', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        st.equal(blocks._client, blocks._mockClient, 'the mock client is the only backend');
        st.equal(blocks.map({ POSITION: '0:0' }), -1, 'mock value (unexplored) works');
        st.end();
    });

    // --- Phase 2: pseudo state updates + reset ---

    t.test('moveTo updates the mock player position', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        blocks.moveTo({ POSITION: '1:3' }); // a walkable space
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '1:3');
        // a fresh goal route now starts from the moved position
        const { util, target } = createUtilWithVars({ route: { type: 'list', value: [] } });
        blocks.calcGoalRoute({ RESULT: 'route' }, util);
        st.equal(target.lookupVariableByNameAndType('route', 'list').value[0], '1:3');
        st.end();
    });

    t.test('moveTo into a wall is ignored', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        blocks.moveTo({ POSITION: '0:0' }); // border wall
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '5:1');
        st.end();
    });

    t.test('setItem places an item that becomes visible once revealed', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        blocks.setItem({ ITEM: 'bomb', POSITION: '1:5' });
        st.equal(blocks.map({ POSITION: '1:5' }), -1); // not revealed yet
        blocks.getMapArea({ POSITION: '1:5' });
        st.equal(blocks.map({ POSITION: '1:5' }), 'D'); // now visible on the my-map
        st.end();
    });

    t.test('green flag / stop resets the mock world to its initial state', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        blocks.moveTo({ POSITION: '1:3' });
        blocks.setItem({ ITEM: 'bomb', POSITION: '1:5' });
        blocks.getMapArea({ POSITION: '1:5' });
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '1:3');
        st.equal(blocks.map({ POSITION: '1:5' }), 'D');

        blocks._resetMockWorld(); // fired by PROJECT_START / PROJECT_STOP_ALL

        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '5:1');
        st.equal(blocks.map({ POSITION: '1:5' }), -1); // unexplored again
        st.end();
    });

    t.test('connecting resets the mock world', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        blocks.moveTo({ POSITION: '1:3' });
        blocks.connectGame({ NAME: 'p1' });
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '5:1');
        st.end();
    });

    t.test('reset triggers are registered on the runtime', (st) => {
        const events = [];
        const runtime = createMockRuntime();
        runtime.on = (event) => events.push(event);
        // eslint-disable-next-line no-new
        new KoshienBlocks(runtime);
        st.ok(events.includes('PROJECT_START'));
        st.ok(events.includes('PROJECT_STOP_ALL'));
        st.end();
    });

    t.end();
});
