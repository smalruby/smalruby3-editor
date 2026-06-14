const test = require('tap').test;
const mu = require('../../src/extensions/koshien/map-utils');

// A small hand-made grid for focused tests:
//   row0: wall row
//   interior: a corridor with a wall pillar and a water cell
const SAMPLE = ['11111', '1a0b1', '10101', '104D1', '11111'].join(',');

test('koshien map-utils', (t) => {
    t.test('parsePosition / formatPosition', (st) => {
        st.same(mu.parsePosition('3:4'), { x: 3, y: 4 });
        st.equal(mu.formatPosition(3, 4), '3:4');
        st.end();
    });

    t.test('parseMapString keeps items as letters, digits as numbers, - as -1', (st) => {
        const grid = mu.parseMapString(SAMPLE);
        st.equal(grid.length, 5);
        st.equal(grid[1][1], 'a'); // item letter
        st.equal(grid[1][2], 0); // space as number
        st.equal(grid[0][0], 1); // wall as number
        st.same(mu.parseMapString('--,--'), [
            [-1, -1],
            [-1, -1],
        ]);
        st.end();
    });

    t.test('gridToMapString round-trips', (st) => {
        st.equal(mu.gridToMapString(mu.parseMapString(SAMPLE)), SAMPLE);
        st.equal(
            mu.gridToMapString([
                [-1, 0],
                [1, -1],
            ]),
            '-0,1-',
        );
        st.end();
    });

    t.test('cellAt returns -1 out of bounds', (st) => {
        const grid = mu.parseMapString(SAMPLE);
        st.equal(mu.cellAt(grid, 1, 1), 'a');
        st.equal(mu.cellAt(grid, -1, 0), -1);
        st.equal(mu.cellAt(grid, 0, 99), -1);
        st.end();
    });

    t.test('moveCost: walls impassable, water 2, unexplored 4, else 1', (st) => {
        st.equal(mu.moveCost(1), Infinity);
        st.equal(mu.moveCost(2), Infinity);
        st.equal(mu.moveCost(5), Infinity);
        st.equal(mu.moveCost(4), 2);
        st.equal(mu.moveCost(-1), 4);
        st.equal(mu.moveCost(0), 1);
        st.equal(mu.moveCost('a'), 1); // items are walkable
        st.end();
    });

    t.test('calcRoute finds a path and avoids walls', (st) => {
        const grid = mu.parseMapString(SAMPLE);
        const route = mu.calcRoute(grid, '1:1', '3:3');
        st.ok(route.length >= 2);
        st.equal(route[0], '1:1');
        st.equal(route[route.length - 1], '3:3');
        route.forEach((pos) => {
            const p = mu.parsePosition(pos);
            st.not(mu.cellAt(grid, p.x, p.y), 1);
        });
        st.end();
    });

    t.test('calcRoute returns [start] when src === dst', (st) => {
        const grid = mu.parseMapString(SAMPLE);
        st.same(mu.calcRoute(grid, '1:1', '1:1'), ['1:1']);
        st.end();
    });

    t.test('calcRoute returns [] when unreachable', (st) => {
        // a target fully boxed by walls
        const boxed = ['111', '101', '111'].join(',');
        const grid = mu.parseMapString(boxed);
        st.same(mu.calcRoute(grid, '1:1', '0:0'), []);
        st.end();
    });

    t.test('calcRoute honors exceptCells', (st) => {
        const open = ['1111', '1001', '1001', '1111'].join(',');
        const grid = mu.parseMapString(open);
        const blocked = mu.calcRoute(grid, '1:1', '2:2', ['2:1', '1:2']);
        // both immediate neighbors blocked -> still reachable via the diagonal-free
        // open cells? 1:1 neighbors are 2:1 and 1:2 (both blocked) -> unreachable
        st.same(blocked, []);
        st.end();
    });

    t.test('normalizeObjectCodes handles packed/comma/array', (st) => {
        st.same(mu.normalizeObjectCodes('ABCD'), ['A', 'B', 'C', 'D']);
        st.same(mu.normalizeObjectCodes('a,b , c'), ['a', 'b', 'c']);
        st.same(mu.normalizeObjectCodes(['1', 2]), ['1', '2']);
        st.same(mu.normalizeObjectCodes(''), []);
        st.same(mu.normalizeObjectCodes(null), []);
        st.end();
    });

    t.test('locateObjects scans a square window (sq_size = full side) for codes', (st) => {
        const grid = mu.parseMapString(SAMPLE);
        // items: a@1:1, b@3:1, D@3:3; sq_size 5 -> 5x5 window (radius 2) covers all
        st.same(mu.locateObjects(grid, '2:2', 5, 'abD'), ['1:1', '3:1', '3:3']);
        st.same(mu.locateObjects(grid, '2:2', 5, 'D'), ['3:3']);
        // sq_size is the full side, not a radius: sq_size 1 -> only the center cell
        st.same(mu.locateObjects(grid, '1:1', 1, 'ab'), ['1:1']);
        st.same(mu.locateObjects(grid, '2:2', 1, 'ab'), []); // center (2,2) is a wall
        // empty codes -> everything in range that is not unexplored
        st.ok(mu.locateObjects(grid, '2:2', 3, '').length > 0);
        st.end();
    });

    t.end();
});
