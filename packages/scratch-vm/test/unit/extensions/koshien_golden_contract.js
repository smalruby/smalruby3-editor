/**
 * Koshien client contract test (#740).
 *
 * Asserts the real Smalruby Koshien game server's behavior, captured as golden
 * fixtures (see test/fixtures/koshien/golden/README.md). These encode the
 * server contract the JS client must reproduce when connected to a real server.
 *
 * The fixtures are the source of truth; this suite both (1) guards the captured
 * behavior against drift and (2) provides a scenario lookup the future
 * RemoteClient (#741) can replay against.
 */
const test = require('tap').test;
const fs = require('fs');
const path = require('path');

const GOLDEN_DIR = path.join(__dirname, '..', '..', 'fixtures', 'koshien', 'golden');

const loadGolden = (name) =>
    JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, `${name}.json`), 'utf8'));

const stepResponse = (scenario, label) => {
    const step = scenario.steps.find((s) => s.label === label);
    if (!step) throw new Error(`step not found: ${label}`);
    return step.response;
};

test('Koshien golden fixtures', (t) => {
    t.test('all fixtures are well-formed scenarios', (st) => {
        for (const name of ['move_basic', 'get_map_area', 'two_actions']) {
            const scenario = loadGolden(name);
            st.equal(scenario.name, name, `${name}: name matches`);
            st.ok(Array.isArray(scenario.steps), `${name}: has steps array`);
            st.ok(scenario.steps.length > 0, `${name}: has at least one step`);
            scenario.steps.forEach((s) => {
                st.type(s.label, 'string', `${name}: step has label`);
                st.ok('response' in s, `${name}: step has response`);
            });
        }
        st.end();
    });

    t.test('move_to is a reservation: position confirmed only after turnTransition', (st) => {
        const scenario = loadGolden('move_basic');
        const before = stepResponse(scenario, 'get_all_map_before_transition');
        const after = stepResponse(scenario, 'get_all_map_after_transition');

        // Before turnTransition: still at the start position.
        st.same([before.players[0].x, before.players[0].y], [1, 1], 'position unchanged before transition');
        // After turnTransition: moved to the requested cell.
        st.same([after.players[0].x, after.players[0].y], [2, 1], 'position updated after transition');
        st.end();
    });

    t.test('getMapArea returns the full 15x15 player map + enemy + other_player', (st) => {
        const scenario = loadGolden('get_map_area');
        const res = stepResponse(scenario, 'get_map_area_1_1');

        st.ok(Array.isArray(res.map), 'map is an array');
        st.equal(res.map.length, 15, 'map has 15 rows');
        res.map.forEach((row) => st.equal(row.length, 15, 'each row has 15 cells'));

        // Unexplored cells are represented as -1.
        const hasUnexplored = res.map.some((row) => row.includes(-1));
        st.ok(hasUnexplored, 'unexplored cells are -1');

        // enemy is always reported; other_player is null when out of range.
        st.ok(res.enemy && typeof res.enemy.x === 'number', 'enemy has x');
        st.ok(typeof res.enemy.y === 'number', 'enemy has y');
        st.equal(res.other_player, null, 'other_player is null when out of range');
        st.end();
    });

    t.test('two actions in one turn move the player and reveal the map', (st) => {
        const scenario = loadGolden('two_actions');
        const res = stepResponse(scenario, 'get_all_map');
        // Player 1 moved to (2,1) after move_to + turnTransition.
        st.same([res.players[0].x, res.players[0].y], [2, 1], 'player moved after two-action turn');
        st.end();
    });

    t.end();
});
