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

    // --- Issue #739: MockClient fixed return values & list writing ---

    t.test('map returns a meaningful fixed value (space=0)', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        st.equal(blocks.map({ POSITION: '0:0' }), 0);
        st.equal(blocks.map({ POSITION: '5:9' }), 0);
        st.end();
    });

    t.test('mapAll returns a 15-row, 15-col all-space string', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        const all = blocks.mapAll({});
        st.type(all, 'string');
        const rows = all.split(',');
        st.equal(rows.length, 15);
        rows.forEach((row) => {
            st.equal(row.length, 15);
            st.equal(row, '000000000000000');
        });
        st.end();
    });

    t.test('mapFrom parses a map string variable, else returns 0', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        const mapString = blocks.mapAll({});
        const { util } = createUtilWithVars({
            $all: { type: '', value: mapString },
        });
        // all-space map -> any cell is 0
        st.equal(blocks.mapFrom({ POSITION: '3:4', MAP: '$all' }, util), 0);
        // unknown variable -> fixed 0
        st.equal(blocks.mapFrom({ POSITION: '3:4', MAP: '$missing' }, util), 0);
        st.end();
    });

    t.test('targetCoordinate returns fixed positions for each target', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '1:1');
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'x' }), 1);
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'y' }), 1);
        st.equal(blocks.targetCoordinate({ TARGET: 'goal', COORDINATE: 'position' }), '13:13');
        st.equal(blocks.targetCoordinate({ TARGET: 'goal', COORDINATE: 'x' }), 13);
        st.equal(blocks.targetCoordinate({ TARGET: 'enemy', COORDINATE: 'position' }), '7:7');
        st.equal(blocks.targetCoordinate({ TARGET: 'enemy', COORDINATE: 'y' }), 7);
        st.equal(blocks.targetCoordinate({ TARGET: 'other_player', COORDINATE: 'position' }), '7:7');
        st.end();
    });

    t.test('calcGoalRoute writes [player, goal] to the result list', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        const { util, target } = createUtilWithVars({
            route: { type: 'list', value: [] },
        });
        blocks.calcGoalRoute({ RESULT: 'route' }, util);
        const list = target.lookupVariableByNameAndType('route', 'list');
        st.same(list.value, ['1:1', '13:13']);
        st.equal(list._monitorUpToDate, false);
        st.end();
    });

    t.test('calcRoute writes [src, dst] to the result list', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        const { util, target } = createUtilWithVars({
            route: { type: 'list', value: [] },
        });
        blocks.calcRoute({ SRC: '2:3', DST: '4:5', EXCEPT_CELLS: ' ', RESULT: 'route' }, util);
        const list = target.lookupVariableByNameAndType('route', 'list');
        st.same(list.value, ['2:3', '4:5']);
        st.end();
    });

    t.test('locateObjects writes a fixed coordinate list to the result list', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        const { util, target } = createUtilWithVars({
            objs: { type: 'list', value: [] },
        });
        blocks.locateObjects({ POSITION: '7:7', SQ_SIZE: 5, OBJECTS: 'ABCD', RESULT: 'objs' }, util);
        const list = target.lookupVariableByNameAndType('objs', 'list');
        st.ok(Array.isArray(list.value));
        st.ok(list.value.length >= 1);
        st.same(list.value, ['7:7']);
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

    t.end();
});
