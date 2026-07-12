const test = require('tap').test;
const { MockGame, RULE_ERRORS } = require('../../src/extensions/koshien/mock-game');

// A small handmade board for precise scenarios.
//   - p1 starts (1,1), p2 starts (7,1)
//   - item b (+20) at (3,1), item a (+10) at (3,3)
//   - breakable wall at (2,2), water at (4,2), harmful D at (4,6)
//   - goal (and the fiend's start) at (5,5)
const TEST_ROWS = [
    '222222222',
    '200b00001',
    '205040001',
    '200a00001',
    '200000001',
    '200003001',
    '2000D0001',
    '200000001',
    '211111111',
];

const makeGame = (opts) =>
    new MockGame(
        Object.assign(
            {
                map: {
                    id: 'test',
                    rows: TEST_ROWS,
                    starts: [
                        [1, 1],
                        [7, 1],
                    ],
                },
                userSide: 1,
                seed: 1,
            },
            opts || {},
        ),
    );

// --- 2026 scoring-rule fixtures -------------------------------------------
// A tiny board for exercising the turn-scaled goal bonus. p1 starts right next
// to the goal (3,1) -> (4,1). The lone fiend starts on the goal and, because it
// keeps its distance from an adjacent pawn, never leaves it, so arriving always
// costs the -10 fiend contact on top of that turn's goal bonus. p2 starts far
// away (9,1) and never interferes.
const TIER_ROWS = ['22222222222', '20003000001', '21111111111'];

const makeTierGame = () =>
    new MockGame({
        map: {
            id: 'tiers',
            rows: TIER_ROWS,
            starts: [
                [3, 1],
                [9, 1],
            ],
        },
        userSide: 1,
        seed: 1,
    });

// Idle beside the goal until `targetTurn`, then step onto it on that turn.
const goalOnTurn = (targetTurn) => {
    const game = makeTierGame();
    game.join(1, 'p1');
    for (let i = 0; i < targetTurn - 1; i++) {
        game.finishTurn(1); // wait a turn without moving
    }
    game.step(1, 4, 1); // reserve the step onto the goal
    const info = game.finishTurn(1).info;
    return { game, info };
};

test('Koshien mock game engine', (t) => {
    t.test('join reports the initial player state', (st) => {
        const game = makeGame();
        const { info } = game.join(1, 'player1');
        st.equal(info.x, 1);
        st.equal(info.y, 1);
        st.same(info.goal, [5, 5]);
        st.equal(info.status, 'playing');
        st.equal(info.score, 0);
        st.same(info.dynamite_items, [10, 10]);
        st.same(info.bomb_items, [9, 9]);
        st.ok(
            info.map.every((row) => row.every((cell) => cell === -1)),
            'own map starts unexplored',
        );
        st.end();
    });

    t.test('scan reveals a clamped 5x5 window with items and actors', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        const res = game.scan(1, 1, 1); // window clamps to 0..3
        st.equal(res.map[1][1], 0, 'own cell revealed');
        st.equal(res.map[1][3], 'b', 'item shows as its letter');
        st.equal(res.map[2][2], 5, 'breakable wall revealed');
        st.equal(res.map[5][5], -1, 'outside the window stays unexplored');
        st.equal(res.rivalSeen, null, 'rival outside the window');
        st.equal(res.fiend.x, 5, 'fiend always fully visible');
        st.equal(res.fiend.y, 5);
        st.equal(res.fiend.state, 'normal');

        const res2 = game.scan(1, 6, 1); // rival (7,1) inside this window
        st.same(res2.rivalSeen, [7, 1], 'rival inside the window');
        st.end();
    });

    t.test('scan outside the board is refused', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        const res = game.scan(1, 99, 0);
        st.equal(res.error.code, 'map_invalid_pos');
        st.equal(res.error.message, RULE_ERRORS.map_invalid_pos);
        st.end();
    });

    t.test('two actions per turn; refused actions also consume the slot', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        st.notOk(game.scan(1, 1, 1).error, 'first action ok');
        st.equal(game.scan(1, 99, 0).error.code, 'map_invalid_pos', 'second action refused...');
        st.equal(game.scan(1, 1, 1).error.code, 'count_lack', '...but consumed the slot');
        game.finishTurn(1);
        st.notOk(game.scan(1, 1, 1).error, 'slots replenish next turn');
        st.end();
    });

    t.test('moves are reservations that resolve on turn end', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        const res = game.step(1, 2, 1);
        st.notOk(res.error);
        st.equal(res.info.x, 1, 'still on the start cell before turn end');
        const { info } = game.finishTurn(1);
        st.equal(info.x, 2, 'moved after turn end');
        st.equal(info.prev_x, 1, 'previous position reported');
        st.end();
    });

    t.test('one move per turn; a second move is refused but costs an action', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        game.step(1, 2, 1);
        st.equal(game.step(1, 1, 1).error.code, 'move_lack');
        st.equal(game.scan(1, 1, 1).error.code, 'count_lack', 'both slots now used');
        st.end();
    });

    t.test('invalid moves are refused and still use up the move right', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        st.equal(game.step(1, 2, 2).error.code, 'move_invalid_pos', 'breakable wall');
        st.equal(game.step(1, 2, 1).error.code, 'move_lack', 'move right already spent');
        game.finishTurn(1);
        st.equal(game.step(1, 3, 1).error.code, 'move_invalid_pos', 'two cells away');
        game.finishTurn(1);
        st.equal(game.step(1, 2, 2).error.code, 'move_invalid_pos', 'diagonal');
        st.end();
    });

    t.test('water: the next move only climbs out (position untouched)', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        // (1,1) -> (2,1) -> (3,1) -> (4,1) -> (4,2)=water
        for (const [x, y] of [
            [2, 1],
            [3, 1],
            [4, 1],
            [4, 2],
        ]) {
            st.notOk(game.step(1, x, y).error, `step to ${x}:${y}`);
            game.finishTurn(1);
        }
        st.equal(game.pawnAt(1).x, 4);
        st.equal(game.pawnAt(1).y, 2);
        st.ok(game.pawnAt(1).soaked, 'in water now');
        // First move after entering water: consumed, but no movement at all.
        const res = game.step(1, 4, 1);
        st.notOk(res.error, 'climbing out is not an error');
        game.finishTurn(1);
        st.equal(game.pawnAt(1).y, 2, 'did not actually move');
        st.notOk(game.pawnAt(1).soaked, 'dried off');
        // Next turn moves normally again.
        game.step(1, 4, 1);
        game.finishTurn(1);
        st.equal(game.pawnAt(1).y, 1, 'moved out on the following turn');
        st.end();
    });

    t.test('items are picked up on turn end and disappear', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        game.step(1, 2, 1);
        game.finishTurn(1);
        game.step(1, 3, 1); // item b (+20)
        const { info } = game.finishTurn(1);
        st.equal(info.score, 20);
        st.same(info.acquired_positive_items, [null, 0, 1, 0, 0, 0]);
        const seen = game.scan(1, 3, 1);
        st.equal(seen.map[1][3], 0, 'item gone from the board');
        st.end();
    });

    t.test('simultaneous pickup on the same cell splits the points', (st) => {
        // Both pawns walk onto the same item cell in the same turn.
        const rows = ['222222222', '200000001', '2000b0001', '200000301', '211111111'];
        const game = new MockGame({
            map: {
                id: 't2',
                rows,
                starts: [
                    [3, 2],
                    [5, 2],
                ],
            },
            userSide: 1,
            seed: 1,
        });
        game.join(1, 'p1');
        game.join(2, 'p2');
        game.step(1, 4, 2);
        game.step(2, 4, 2);
        const { info } = game.finishTurn(1);
        st.equal(info.score, 10, 'half of +20');
        st.equal(game.stateOf(2).score, 10, 'rival got the other half');
        st.end();
    });

    t.test('dynamite blows breakable walls at turn end; stock is 2', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        // (2,1) is next to the current cell and open; breakable wall at (2,2).
        st.notOk(game.plant(1, 'dynamite', 2, 1).error);
        game.finishTurn(1);
        const seen = game.scan(1, 2, 2);
        st.equal(seen.map[2][2], 0, 'breakable wall opened');
        st.notOk(game.plant(1, 'dynamite', 1, 2).error, 'second stick ok');
        st.equal(game.plant(1, 'dynamite', 1, 2).error.code, 'count_lack', 'actions ran out first');
        game.finishTurn(1);
        st.equal(game.plant(1, 'dynamite', 1, 2).error.code, 'dynamite_lack', 'no stock left');
        st.end();
    });

    t.test('a refused dynamite placement still consumes a stick', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        st.equal(game.plant(1, 'dynamite', 5, 5).error.code, 'dynamite_invalid_pos', 'far away');
        game.finishTurn(1);
        st.notOk(game.plant(1, 'dynamite', 2, 1).error, 'second stick usable');
        game.finishTurn(1);
        st.equal(game.plant(1, 'dynamite', 2, 1).error.code, 'dynamite_lack');
        st.end();
    });

    t.test('bombs become a "D" item on the board (and hurt whoever steps on it)', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        st.equal(game.plant(1, 'bomb', 0, 1).error.code, 'bomb_invalid_pos', 'wall cell');
        game.finishTurn(1);
        st.notOk(game.plant(1, 'bomb', 2, 1).error);
        game.finishTurn(1);
        st.equal(game.scan(1, 2, 1).map[1][2], 'D', 'placed bomb looks like a D item');
        game.step(1, 2, 1); // step onto own bomb
        const { info } = game.finishTurn(1);
        st.equal(info.score, -40, 'the placer is hurt too');
        st.end();
    });

    t.test('bomb cannot go on water; dynamite can', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        // Walk next to the water cell (4,2): (1,1)->(2,1)->(3,1)->(3,2).
        for (const [x, y] of [
            [2, 1],
            [3, 1],
            [3, 2],
        ]) {
            game.step(1, x, y);
            game.finishTurn(1);
        }
        st.equal(game.plant(1, 'bomb', 4, 2).error.code, 'bomb_invalid_pos');
        game.finishTurn(1);
        st.notOk(game.plant(1, 'dynamite', 4, 2).error, 'dynamite is fine on water');
        st.end();
    });

    t.test('reaching the goal completes the round with the turn-scaled bonus', (st) => {
        const rows = ['222222222', '200030001', '211111111'];
        const game = new MockGame({
            map: {
                id: 't3',
                rows,
                starts: [
                    [3, 1],
                    [7, 1],
                ],
            },
            userSide: 1,
            seed: 1,
        });
        game.join(1, 'p1');
        game.step(1, 4, 1);
        const { info } = game.finishTurn(1);
        st.equal(info.status, 'completed');
        // The fiend waits on the goal, so arriving costs the -10 contact.
        st.equal(info.score, 100 - 10, 'turn 1-10 goal bonus minus fiend contact');
        st.equal(info.finished, true);
        // Finished players may only keep calling turn over.
        st.equal(game.scan(1, 3, 1).error.code, 'already_finished');
        st.equal(game.step(1, 3, 1).error.code, 'already_finished');
        st.equal(game.say(1, 'hi').error.code, 'already_finished');
        st.equal(game.finishTurn(1).info.status, 'completed', 'turn over stays harmless');
        st.end();
    });

    t.test('walk bonus: +3 for every 5 moved turns', (st) => {
        const rows = ['22222222222222222', '20000000000000001', '20000000000000301', '21111111111111111'];
        const game = new MockGame({
            map: {
                id: 't4',
                rows,
                starts: [
                    [1, 1],
                    [15, 1],
                ],
            },
            userSide: 1,
            seed: 1,
        });
        game.join(1, 'p1');
        let info = null;
        for (let x = 2; x <= 6; x++) {
            game.step(1, x, 1);
            info = game.finishTurn(1).info;
        }
        st.equal(info.score, 3, 'five moved turns earned the bonus');
        st.equal(info.walk_bonus, true, 'flagged on the earning turn');
        st.end();
    });

    t.test('50 turns without a goal ends in timeup with the penalty', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        let info = null;
        for (let i = 0; i < 50; i++) {
            info = game.finishTurn(1).info;
        }
        st.equal(info.status, 'timeup');
        st.equal(info.score, -70, 'timeup penalty applied at game over');
        st.ok(game.over, 'round over');
        st.end();
    });

    t.test('the fiend chases a pawn in its watch box but keeps its distance', (st) => {
        // Corridor: p1 starts already inside the fiend's 3-cell watch box
        // (fiend on the goal at (8,1)); p2 is far outside it.
        const rows = ['222222222222222', '200000003000001', '211111111111111'];
        const game = new MockGame({
            map: {
                id: 't5',
                rows,
                starts: [
                    [5, 1],
                    [13, 1],
                ],
            },
            userSide: 1,
            seed: 1,
        });
        game.join(1, 'p1');
        game.finishTurn(1); // pawn stands still; fiend approaches once
        st.equal(game.fiendInfo().x, 7, 'fiend stepped toward the pawn');
        game.finishTurn(1);
        st.equal(game.fiendInfo().x, 7, 'fiend stops 2 cells away (no body-slam)');
        st.end();
    });

    t.test('the sword grants slaying power: contact turns into +30 and a kill', (st) => {
        // Sword next to the goal. p2 sits adjacent to the fiend so the fiend
        // targets p2 and (being within 2 steps) never moves.
        const rows = ['222222222', '200e30001', '211111111'];
        const game = new MockGame({
            map: {
                id: 't6',
                rows,
                starts: [
                    [1, 1],
                    [5, 1],
                ],
            },
            userSide: 1,
            seed: 1,
        });
        game.join(1, 'p1');
        game.step(1, 2, 1);
        game.finishTurn(1);
        game.step(1, 3, 1); // onto the sword
        const swordTurn = game.finishTurn(1).info;
        st.equal(swordTurn.score, 60, 'sword picked up');
        st.equal(game.fiendInfo().state, 'kill', 'slaying power granted');
        game.step(1, 4, 1); // onto the fiend (also the goal here)
        const finalTurn = game.finishTurn(1).info;
        st.equal(game.fiendInfo().state, 'done', 'fiend slain');
        st.equal(game.fiendInfo().killed, true, 'killed flag reported');
        st.equal(finalTurn.status, 'completed');
        st.equal(finalTurn.score, 60 + 30 + 100, 'sword + slay + goal bonus');
        st.end();
    });

    t.test('messages are kept and do not use an action', (st) => {
        const game = makeGame();
        game.join(1, 'p1');
        game.scan(1, 1, 1);
        game.step(1, 2, 1);
        st.notOk(game.say(1, 'こんにちは').error, 'no count_lack even after 2 actions');
        const { info } = game.finishTurn(1);
        st.equal(info.msg, 'こんにちは');
        st.end();
    });

    // --- 2026 official rules: five-tier goal bonus + -70 timeup penalty ------

    t.test('the goal bonus matches the 2026 five-tier table by turn', (st) => {
        // Published 2026 rule: 1-10T=100, 11-20T=90, 21-30T=80, 31-40T=70,
        // 41-50T=60. Pin the raw bonus (no board noise) at every decade edge.
        const game = makeGame();
        const table = [
            [1, 100],
            [10, 100],
            [11, 90],
            [20, 90],
            [21, 80],
            [30, 80],
            [31, 70],
            [40, 70],
            [41, 60],
            [50, 60],
        ];
        for (const [turn, bonus] of table) {
            game._turn = turn;
            st.equal(game._currentGoalBonus(), bonus, `turn ${turn} earns +${bonus}`);
        }
        st.end();
    });

    t.test('each goal-bonus tier is awarded end to end when a pawn reaches the goal', (st) => {
        // Confirms the table above is wired to the real arrival turn. The score
        // is the tier bonus minus the -10 contact with the fiend on the goal.
        const tiers = [
            [1, 100],
            [10, 100],
            [11, 90],
            [20, 90],
            [21, 80],
            [30, 80],
            [31, 70],
            [40, 70],
            [41, 60],
            [50, 60],
        ];
        for (const [turn, bonus] of tiers) {
            const { info } = goalOnTurn(turn);
            st.equal(info.status, 'completed', `turn ${turn}: round completed`);
            st.equal(info.score, bonus - 10, `turn ${turn}: +${bonus} goal bonus (-10 fiend contact)`);
        }
        st.end();
    });

    t.test('reaching the goal on the 50th turn scores +60 and is not a timeup', (st) => {
        // Boundary: arriving exactly on the final turn still counts as a goal,
        // so the -70 timeup penalty must NOT apply.
        const { game, info } = goalOnTurn(50);
        st.equal(info.status, 'completed', 'goal on turn 50 completes rather than timing up');
        st.equal(info.score, 60 - 10, '41-50T bonus +60 minus fiend contact, no -70 penalty');
        st.ok(game.over, 'the round is over');
        st.end();
    });

    t.test('the -70 timeup penalty combines with other score components', (st) => {
        // Minimal construction: a pawn banks +20 from an item, then never
        // reaches the goal. At game over the -70 timeup penalty adds to (does
        // not replace) that +20. The fiend is boxed on an unreachable goal so
        // it never interferes.
        const rows = ['2222222', '20b0002', '2222222', '2223222', '2222222'];
        const game = new MockGame({
            map: {
                id: 'boxed',
                rows,
                starts: [
                    [1, 1],
                    [5, 1],
                ],
            },
            userSide: 1,
            seed: 1,
        });
        game.join(1, 'p1');
        game.step(1, 2, 1); // step onto item b (+20)
        game.finishTurn(1);
        st.equal(game.stateOf(1).score, 20, 'banked the +20 item first');
        let info = null;
        while (!game.over) {
            info = game.finishTurn(1).info; // idle to the turn limit
        }
        st.equal(info.status, 'timeup', 'never goaled ends in timeup');
        st.equal(info.score, 20 - 70, 'the +20 item and the -70 penalty combine to -50');
        st.end();
    });

    t.end();
});
