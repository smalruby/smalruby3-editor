/**
 * RemoteClient unit/contract test (#741).
 *
 * Feeds the golden fixtures captured from the REAL game server (#740) into
 * RemoteClient via an injected fetch, and asserts it parses those real
 * responses into the correct cached state. This makes the golden recordings
 * directly verify the client's protocol handling without a live server.
 */
const test = require('tap').test;
const path = require('path');
const RemoteClient = require('../../src/extensions/koshien/remote-client.js');

const golden = (name) => require(path.join(__dirname, '..', 'fixtures', 'koshien', 'golden', `${name}.json`));

const stepResponse = (scenario, label) => scenario.steps.find((s) => s.label === label).response;

// fetch stub that returns a queue of responses (one per call), as the server would.
const makeFetch = (responses) => {
    const queue = responses.slice();
    return () =>
        Promise.resolve({
            text: () => Promise.resolve(JSON.stringify(queue.shift())),
        });
};

const newClient = (responses, opts = {}) =>
    new RemoteClient(
        null,
        'koshien',
        Object.assign(
            {
                endpoint: 'http://example.test:3000',
                playerId: 'p1-uuid',
                side: 1,
                fetchImpl: makeFetch(responses),
            },
            opts,
        ),
    );

test('Koshien RemoteClient (golden-fed)', (t) => {
    t.test('getMapArea parses the real 15x15 map + enemy + other_player', async (st) => {
        const res = stepResponse(golden('get_map_area'), 'get_map_area_1_1');
        const client = newClient([res]);
        await client.getMapArea('1:1');

        st.equal(client.myMap.length, 15, 'myMap has 15 rows');
        st.equal(client.myMap[0].length, 15, 'myMap rows have 15 cells');
        st.same(client.enemyPos, res.enemy, 'enemyPos cached from response');
        st.equal(client.otherPlayerPos, null, 'otherPlayerPos null when out of range');
        // map() reads cached state
        st.equal(client.map('1:1'), res.map[1][1], 'map() reads the cached cell');
        st.end();
    });

    t.test('connectGame parses initial api_info (x/y/goal)', async (st) => {
        const info = stepResponse(golden('move_basic'), 'connect_player1');
        const client = newClient([info]);
        const ret = await client.connectGame('player1');

        st.ok(client.isConnected(), 'connected flag set');
        st.equal(client.x, Number(info.x), 'x cached');
        st.equal(client.y, Number(info.y), 'y cached');
        st.same(client.goal, info.goal, 'goal cached');
        st.equal(client.targetCoordinate('goal', 'position'), `${info.goal[0]}:${info.goal[1]}`, 'goal reporter');
        st.ok(ret, 'returns api_info');
        st.end();
    });

    t.test('turnOver unwraps {uuid: api_info} and updates state', async (st) => {
        const after = stepResponse(golden('move_basic'), 'get_all_map_after_transition');
        // emulate turnOver response shape: {uuid: api_info}
        const apiInfo = after.players[0];
        const client = newClient([{ 'p1-uuid': apiInfo }]);
        const info = await client.turnOver();
        st.equal(client.x, Number(apiInfo.x), 'x updated from turnOver');
        st.equal(client.y, Number(apiInfo.y), 'y updated from turnOver');
        st.same(info, apiInfo, 'returns the unwrapped api_info');
        st.end();
    });

    t.test('calcRoute finds a path over the known map', async (st) => {
        const client = newClient([]);
        // 5x5 all-open map
        client.myMap = Array.from({ length: 5 }, () => Array(5).fill(0));
        const route = client.calcRoute({ src: '0:0', dst: '4:0' });
        st.equal(route[0], '0:0', 'route starts at src');
        st.equal(route[route.length - 1], '4:0', 'route ends at dst');
        st.equal(route.length, 5, 'straight horizontal path length 5');
        st.end();
    });

    t.test('calcRoute routes around a wall', async (st) => {
        const client = newClient([]);
        client.myMap = Array.from({ length: 5 }, () => Array(5).fill(0));
        // wall blocking the direct row 0 at x=2
        client.myMap[0][2] = 1;
        const route = client.calcRoute({ src: '0:0', dst: '4:0' });
        st.equal(route[0], '0:0', 'starts at src');
        st.equal(route[route.length - 1], '4:0', 'ends at dst');
        st.notOk(route.includes('2:0'), 'does not pass through the wall cell');
        st.end();
    });

    t.test('locateObjects scans the known map for items', async (st) => {
        const client = newClient([]);
        client.myMap = Array.from({ length: 5 }, () => Array(5).fill(0));
        client.myMap[2][2] = 'A';
        client.myMap[1][3] = 'B';
        const found = client.locateObjects({ position: '2:2', sqSize: 5, objects: 'AB' });
        st.ok(found.includes('2:2'), 'finds A at 2:2');
        st.ok(found.includes('3:1'), 'finds B at 3:1');
        st.equal(found.length, 2, 'finds exactly the two items');
        st.end();
    });

    t.test('mapAll / mapFrom round-trip over cached map', async (st) => {
        const client = newClient([]);
        client.myMap = Array.from({ length: 3 }, () => Array(3).fill(0));
        client.myMap[1][1] = 4;
        const all = client.mapAll();
        st.equal(all, '000,040,000', 'mapAll serializes rows');
        st.equal(client.mapFrom('1:1', all), 4, 'mapFrom reads back the cell');
        st.end();
    });

    t.end();
});
