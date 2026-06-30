/**
 * RemoteClient end-to-end over real HTTP (#741).
 *
 * Drives the koshien RemoteClient against an in-process mock game server using
 * the real `fetch` path (URL building, query params, JSON parsing) — coverage
 * the golden contract test (which mocks fetch) cannot provide.
 */
const test = require('tap').test;
const { createKoshienMockServer } = require('../fixtures/koshien/mock-server.js');
const RemoteClient = require('../../src/extensions/koshien/remote-client.js');

const listen = (server) =>
    new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

test('RemoteClient over real HTTP against the mock server', async (t) => {
    const server = createKoshienMockServer({ maxTurn: 2 });
    const port = await listen(server);
    const client = new RemoteClient(null, 'koshien', {
        endpoint: `http://127.0.0.1:${port}`,
        playerId: 'p1',
        side: 1,
    });

    // connectGame parses initial api_info
    const info = await client.connectGame('player1');
    t.ok(info, 'connectGame returns api_info');
    t.ok(client.isConnected(), 'connected flag set');
    t.equal(client.x, 1, 'x from connect');
    t.equal(client.y, 1, 'y from connect');
    t.same(client.goal, [13, 13], 'goal from connect');

    // getMapArea merges the 15x15 map + enemy
    await client.getMapArea('1:1');
    t.equal(client.myMap.length, 15, 'myMap has 15 rows');
    t.equal(client.map('1:1'), 0, 'revealed cell reads 0 via map()');
    t.equal(client.map('14:0'), -1, 'unrevealed cell reads -1');
    t.equal(client.enemyPos.x, 7, 'enemy x cached');
    t.equal(client.targetCoordinate('enemy', 'position'), '7:7', 'enemy reporter');

    // setItem / setMessage return OK
    const dyn = await client.setItem('dynamite', '1:1');
    t.same(dyn, { result: 'OK' }, 'setDynamite returns OK');

    // turnOver unwraps {uuid: api_info}; status flips to timeup past maxTurn
    const t1 = await client.turnOver();
    t.equal(t1.status, 'playing', 'turn 1 still playing');
    const t2 = await client.turnOver();
    t.equal(t2.status, 'timeup', 'turn beyond maxTurn -> timeup');

    await new Promise((resolve) => server.close(resolve));
    t.end();
});
