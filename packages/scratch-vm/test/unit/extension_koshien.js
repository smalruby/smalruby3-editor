const test = require('tap').test;
const KoshienBlocks = require('../../src/extensions/koshien/index.js');

const createMockRuntime = (mockConfig) => {
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
    if (mockConfig) {
        runtime.getKoshienMockConfig = () => mockConfig;
    }
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

// Default map ("meadow"): player1 starts at (3,2), player2 at (13,2),
// the goal is at (8,9).
const connectDefault = (blocks) => blocks.connectGame({ NAME: 'p1' });

// Reveal the whole 17x17 my-map: getMapArea is limited to 2 actions per
// turn, so scans are interleaved with turn overs.
const revealAll = (blocks) => {
    const centers = [];
    for (const cy of [2, 7, 12, 14]) {
        for (const cx of [2, 7, 12, 14]) {
            centers.push(`${cx}:${cy}`);
        }
    }
    while (centers.length > 0) {
        blocks.getMapArea({ POSITION: centers.shift() });
        if (centers.length > 0) blocks.getMapArea({ POSITION: centers.shift() });
        blocks.turnOver({});
    }
};

const journalOf = (blocks) => blocks.runtime.koshienMockState.journal;
const lastJournal = (blocks) => journalOf(blocks)[journalOf(blocks).length - 1];

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

    t.test('always uses the built-in mock game (no remote backend)', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        st.equal(blocks._client, blocks._mockClient, 'the mock client is the only backend');
        st.equal(blocks.map({ POSITION: '0:0' }), -1, 'mock value (unexplored) works');
        st.end();
    });

    // --- Before connecting: reads answer "unknown", commands are journaled ---

    t.test('before connecting, readers return unknown values', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        st.equal(blocks.map({ POSITION: '3:2' }), -1);
        st.equal(blocks.mapAll({}), '');
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), null);
        st.equal(blocks.targetCoordinate({ TARGET: 'goal', COORDINATE: 'position' }), null);
        st.end();
    });

    t.test('commands before connecting do not throw and are reported', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        st.doesNotThrow(() => blocks.getMapArea({ POSITION: '1:1' }));
        st.doesNotThrow(() => blocks.turnOver({}));
        st.doesNotThrow(() => blocks.setItem({ ITEM: 'dynamite', POSITION: '1:1' }));
        st.doesNotThrow(() => blocks.moveTo({ POSITION: '1:1' }));
        st.ok(
            journalOf(blocks).every((e) => e.kind === 'error'),
            'each was journaled as an error',
        );
        st.end();
    });

    // --- Connecting starts a session on the configured map/side ---

    t.test('connecting reports the start position and goal of the default map', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime());
        connectDefault(blocks);
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '3:2');
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'x' }), 3);
        st.equal(blocks.targetCoordinate({ TARGET: 'goal', COORDINATE: 'position' }), '8:9');
        // Not seen yet: rival and fiend positions come from getMapArea.
        st.equal(blocks.targetCoordinate({ TARGET: 'other_player', COORDINATE: 'position' }), null);
        st.equal(blocks.targetCoordinate({ TARGET: 'enemy', COORDINATE: 'position' }), null);
        st.end();
    });

    t.test('the GUI config selects the map, side and rival strategy', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ mapId: 'canal', side: 2, rival: 'stop' }));
        connectDefault(blocks);
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '15:15');
        st.equal(blocks.runtime.koshienMockState.game.mapId, 'canal');
        st.equal(blocks.runtime.koshienMockState.strategy, 'stop');
        st.end();
    });

    t.test('connecting broadcasts the mock state for the GUI panel', (st) => {
        const rt = createMockRuntime();
        const blocks = new KoshienBlocks(rt);
        connectDefault(blocks);
        st.equal(rt.lastEmittedEvent, KoshienBlocks.MOCK_STATE_EVENT);
        st.ok(rt.koshienMockState.connected);
        st.equal(rt.koshienMockState.game.turn, 1);
        st.end();
    });

    // --- Fog of war ---

    t.test('map is unexplored (-1) until getMapArea reveals it', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        st.equal(blocks.map({ POSITION: '3:2' }), -1, 'own cell not revealed yet');
        blocks.getMapArea({ POSITION: '3:2' });
        st.equal(blocks.map({ POSITION: '3:2' }), 0, 'own cell revealed');
        st.equal(blocks.map({ POSITION: '8:9' }), -1, 'far away, still unexplored');
        st.end();
    });

    t.test('mapAll starts fully unexplored and fills in as areas are revealed', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        const before = blocks.mapAll({}).split(',');
        st.equal(before.length, 17);
        before.forEach((row) => st.equal(row, '-----------------'));
        blocks.getMapArea({ POSITION: '8:9' });
        const after = blocks.mapAll({});
        st.ok(after.includes('3'), 'the goal is now revealed');
        st.ok(after.includes('-'), 'the rest is still unexplored');
        st.end();
    });

    t.test('once fully revealed, the field is bordered by unbreakable walls (1/2)', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
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

    t.test('getMapArea reports the fiend always, the rival only nearby', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        blocks.getMapArea({ POSITION: '3:2' });
        st.equal(
            blocks.targetCoordinate({ TARGET: 'enemy', COORDINATE: 'position' }),
            '8:9',
            'fiend visible from anywhere',
        );
        st.equal(
            blocks.targetCoordinate({ TARGET: 'other_player', COORDINATE: 'position' }),
            null,
            'rival (13:2) outside the scanned window',
        );
        blocks.turnOver({});
        blocks.getMapArea({ POSITION: '13:2' });
        st.equal(
            blocks.targetCoordinate({ TARGET: 'other_player', COORDINATE: 'position' }),
            '13:2',
            'rival visible when scanned nearby',
        );
        st.end();
    });

    t.test('mapFrom parses a map string variable, else returns -1', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        revealAll(blocks);
        const mapString = blocks.mapAll({});
        const { util } = createUtilWithVars({
            $all: { type: '', value: mapString },
        });
        st.equal(blocks.mapFrom({ POSITION: '8:9', MAP: '$all' }, util), 3); // goal
        st.equal(blocks.mapFrom({ POSITION: '13:4', MAP: '$all' }, util), 'c'); // item
        // unknown variable -> -1 (unexplored)
        st.equal(blocks.mapFrom({ POSITION: '3:4', MAP: '$missing' }, util), -1);
        st.end();
    });

    // --- Action limits (the heart of step-by-step debugging) ---

    t.test('a third action in one turn is suppressed and journaled', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        blocks.getMapArea({ POSITION: '3:2' });
        blocks.getMapArea({ POSITION: '8:9' });
        const before = journalOf(blocks).filter((e) => e.kind === 'error').length;
        blocks.getMapArea({ POSITION: '13:2' });
        const errors = journalOf(blocks).filter((e) => e.kind === 'error');
        st.equal(errors.length, before + 1, 'the over-limit call was journaled');
        st.match(errors[errors.length - 1].text, /行動/);
        blocks.turnOver({});
        blocks.getMapArea({ POSITION: '3:2' });
        st.equal(lastJournal(blocks).kind, 'action', 'the limit resets on turn over');
        st.end();
    });

    t.test('a second move in one turn is suppressed and journaled', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        blocks.moveTo({ POSITION: '4:2' });
        blocks.moveTo({ POSITION: '5:2' });
        st.equal(lastJournal(blocks).kind, 'error');
        st.match(lastJournal(blocks).text, /移動は1ターンに一度/);
        st.end();
    });

    // --- Moves are reservations ---

    t.test('moveTo does not change the position until the turn is over', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        blocks.moveTo({ POSITION: '4:2' });
        st.equal(
            blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }),
            '3:2',
            'still on the start cell',
        );
        blocks.turnOver({});
        st.equal(
            blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }),
            '4:2',
            'moved after the turn resolved',
        );
        st.end();
    });

    t.test('an invalid move is journaled as a rule error', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        blocks.moveTo({ POSITION: '3:3' }); // (3,3) is a storehouse wall (2)
        st.equal(lastJournal(blocks).kind, 'error');
        st.match(lastJournal(blocks).text, /移動できない座標/);
        st.end();
    });

    t.test('setItem places dynamite next to the player', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        blocks.setItem({ ITEM: 'dynamite', POSITION: '2:2' });
        st.equal(lastJournal(blocks).kind, 'action');
        st.end();
    });

    // --- Route / object helpers work off the my map ---

    t.test('calcGoalRoute writes a route from player to goal', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        const { util, target } = createUtilWithVars({
            route: { type: 'list', value: [] },
        });
        blocks.calcGoalRoute({ RESULT: 'route' }, util);
        const list = target.lookupVariableByNameAndType('route', 'list');
        st.ok(list.value.length > 2); // a multi-step path, not just [src, dst]
        st.equal(list.value[0], '3:2');
        st.equal(list.value[list.value.length - 1], '8:9');
        st.equal(list._monitorUpToDate, false);
        st.end();
    });

    t.test('calcRoute writes a path between two points', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
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
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
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
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        const { util } = createUtilWithVars({});
        st.doesNotThrow(() => blocks.calcGoalRoute({ RESULT: ' ' }, util));
        st.doesNotThrow(() => blocks.calcGoalRoute({ RESULT: 'nope' }, util));
        st.end();
    });

    // --- Rivals ---

    t.test('a goal-seeking rival moves once the turn resolves', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'goal' }));
        connectDefault(blocks);
        const start = blocks.runtime.koshienMockState.game.pawns[1];
        blocks.turnOver({});
        const after = blocks.runtime.koshienMockState.game.pawns[1];
        st.ok(after.x !== start.x || after.y !== start.y, 'the rival moved');
        st.end();
    });

    t.test('a stopped rival never moves', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        blocks.turnOver({});
        blocks.turnOver({});
        const rival = blocks.runtime.koshienMockState.game.pawns[1];
        st.equal(rival.x, 13);
        st.equal(rival.y, 2);
        st.end();
    });

    // --- Reset ---

    t.test('green flag / stop resets the mock world (a new connect starts fresh)', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        blocks.moveTo({ POSITION: '4:2' });
        blocks.turnOver({});
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '4:2');

        blocks._resetMockWorld(); // fired by PROJECT_START / PROJECT_STOP_ALL

        st.notOk(blocks._client.isConnected(), 'disconnected');
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), null);
        st.equal(blocks.connectGame({ NAME: 'p1' }), true, 'can connect again');
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '3:2');
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

    t.test('the green flag resets the world and fires the connect-game hats', (st) => {
        const runtime = createMockRuntime({ rival: 'stop' });
        const started = [];
        runtime.startHats = (opcode) => started.push(opcode);
        const blocks = new KoshienBlocks(runtime);
        connectDefault(blocks);
        blocks.moveTo({ POSITION: '4:2' });
        blocks.turnOver({});
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '4:2');

        blocks._handleProjectStart(); // fired by PROJECT_START (green flag)

        st.notOk(blocks._client.isConnected(), 'world reset');
        st.same(started, ['koshien_connectGame'], 'connect-game hats started');
        // The hat block then reconnects and the script below it replays.
        st.equal(blocks.connectGame({ NAME: 'p1' }), true);
        st.equal(blocks.targetCoordinate({ TARGET: 'player', COORDINATE: 'position' }), '3:2');
        st.end();
    });

    t.test('setMessage', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        const result = blocks.setMessage({ MESSAGE: 'hello world' });
        st.type(result, Promise);
        st.equal(blocks.runtime.koshienMockState.game.pawns[0].message, 'hello world');
        st.end();
    });

    t.test('turnOver with turnInterval=0 stays synchronous (legacy no-wait)', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop' }));
        connectDefault(blocks);
        st.equal(blocks._client._turnInterval, 0, 'default interval is 0');
        let slept = false;
        blocks._client._sleep = () => {
            slept = true;
            return Promise.resolve();
        };
        st.equal(blocks.turnOver({}), null, 'returns no delay promise');
        st.notOk(slept, 'does not sleep');
        st.end();
    });

    t.test('turnOver with turnInterval>0 returns a delay promise while playing', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop', turnInterval: 1 }));
        connectDefault(blocks);
        st.equal(blocks._client._turnInterval, 1, 'interval read from config');
        const sentinel = Promise.resolve('sentinel');
        let sleptMs = null;
        blocks._client._sleep = (ms) => {
            sleptMs = ms;
            return sentinel;
        };
        const result = blocks.turnOver({});
        st.equal(result, sentinel, 'returns the delay promise');
        st.equal(sleptMs, 1000, 'sleeps interval seconds in ms');
        st.end();
    });

    t.test('turnOver does not sleep once the game is over', (st) => {
        const blocks = new KoshienBlocks(createMockRuntime({ rival: 'stop', turnInterval: 1 }));
        connectDefault(blocks);
        let slept = false;
        blocks._client._sleep = () => {
            slept = true;
            return Promise.resolve();
        };
        // Simulate the game having ended: no next turn, so no sleep.
        blocks._client._session._over = true;
        st.equal(blocks.turnOver({}), null, 'returns no delay promise when over');
        st.notOk(slept, 'does not sleep after the game ends');
        st.end();
    });

    t.end();
});
