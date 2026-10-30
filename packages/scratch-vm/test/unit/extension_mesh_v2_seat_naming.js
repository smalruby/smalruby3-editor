const test = require('tap').test;
const {
    TEACHER_HOST,
    buildGroupName,
    parseGroupName,
    seatNodeIdSuffix,
    withSeatSuffix,
    stripSeatSuffix,
    parseNodeSeat,
} = require('../../src/extensions/scratch3_mesh_v2/seat-naming');

const HOST = '0123456789abcdef0123456789abcdef';

test('buildGroupName', (t) => {
    t.equal(buildGroupName(HOST), HOST, 'no seat info → plain node id (unchanged legacy name)');
    t.equal(buildGroupName(HOST, {}), HOST);
    t.equal(buildGroupName(HOST, { host: 7 }), `${HOST}|host=7`);
    t.equal(buildGroupName(HOST, { host: TEACHER_HOST }), `${HOST}|host=teacher`);
    t.equal(
        buildGroupName(HOST, { seats: [12, 3, 7, 3], host: 3 }),
        `${HOST}|seats=3,7,12|host=3`,
        'seats are sorted and de-duplicated',
    );
    t.equal(
        buildGroupName(HOST, { seats: [0, -1, 'x', 2.5], host: 'bogus' }),
        HOST,
        'invalid seats and host are dropped',
    );
    t.end();
});

test('parseGroupName round trip', (t) => {
    t.same(parseGroupName(`${HOST}|seats=3,7,12|host=3`), { baseName: HOST, seats: [3, 7, 12], host: 3 });
    t.same(parseGroupName(`${HOST}|host=7`), { baseName: HOST, seats: [], host: 7 });
    t.same(parseGroupName(`${HOST}|host=teacher`), { baseName: HOST, seats: [], host: TEACHER_HOST });
    t.end();
});

test('parseGroupName treats legacy and broken names as "no seat info"', (t) => {
    t.equal(parseGroupName(HOST), null, 'legacy name');
    t.equal(parseGroupName(''), null);
    t.equal(parseGroupName(null), null);
    t.equal(parseGroupName(42), null);
    t.equal(parseGroupName('|host=3'), null, 'missing base');
    t.equal(parseGroupName(`${HOST}|`), null, 'empty segment');
    t.equal(parseGroupName(`${HOST}|host=0`), null, 'seat 0');
    t.equal(parseGroupName(`${HOST}|host=abc`), null);
    t.equal(parseGroupName(`${HOST}|seats=3,,7`), null);
    t.equal(parseGroupName(`${HOST}|seats=`), null);
    t.equal(parseGroupName(`${HOST}|color=red`), null, 'unknown key');
    t.equal(parseGroupName(`${HOST}|host=3|host=4`), null, 'duplicate key');
    t.equal(parseGroupName(`${HOST}|host`), null, 'no value');
    t.end();
});

test('seat suffix of node id', (t) => {
    t.equal(seatNodeIdSuffix(7), 's07');
    t.equal(seatNodeIdSuffix(12), 's12');
    t.equal(seatNodeIdSuffix(123), 's123');
    t.equal(seatNodeIdSuffix(0), '');
    t.equal(seatNodeIdSuffix(null), '');
    t.equal(withSeatSuffix(HOST, 7), `${HOST}s07`);
    t.equal(withSeatSuffix(HOST, null), HOST, 'outside class: unchanged');
    t.equal(withSeatSuffix(`${HOST}s03`, 7), `${HOST}s07`, 'replaces an old suffix');
    t.equal(stripSeatSuffix(`${HOST}s07`), HOST);
    t.equal(stripSeatSuffix(HOST), HOST);
    t.equal(parseNodeSeat(`${HOST}s07`), 7);
    t.equal(parseNodeSeat(HOST), null, 'legacy node id');
    t.equal(parseNodeSeat(''), null);
    t.equal(parseNodeSeat(undefined), null);
    t.end();
});

test('suffix keeps the hex prefix used for labels and name search', (t) => {
    const name = buildGroupName(withSeatSuffix(HOST, 7), { host: 7 });
    t.equal(name.slice(0, 6), HOST.slice(0, 6));
    t.end();
});
