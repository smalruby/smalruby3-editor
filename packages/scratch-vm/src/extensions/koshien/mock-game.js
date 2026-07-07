/**
 * Local Koshien practice game ("mock game").
 *
 * A self-contained simulation of one Smalruby Koshien round that the koshien
 * extension drives while it is not connected to anything: the user's AI is one
 * of the two pawns, the other pawn is played by a built-in practice rival
 * (see mock-rival.js), and the field fiend chases pawns around the board.
 *
 * The implementation is an original design (a flat cell array plus an
 * intent/resolution pipeline); only its *observable* behavior follows the
 * published Koshien game rules: two actions per turn, one move per turn,
 * reserved moves that resolve on turn end, items, dynamite and bombs, the
 * fiend, walk/goal bonuses and the 50 turn limit. Rule violations produce the
 * same error messages a real match would, so step-by-step debugging in
 * Smalruby teaches the real constraints. There is no wall-clock timeout: the
 * game waits forever while the user thinks.
 */

const ACT_LIMIT = 2;
const MAX_TURN = 50;
const STOCK_PER_KIND = 2;
const WALK_BONUS_EVERY = 5;
const WALK_BONUS_POINTS = 3;
const FIEND_RAGE_TURN = 41;
const TIMEUP_PENALTY = 70;
const FRESH_SIGHT = 5;

/**
 * Points awarded (or deducted) when a pawn picks up an item mark.
 * @type {object}
 */
const LOOT_POINTS = {
    a: 10,
    b: 20,
    c: 30,
    d: 40,
    e: 60,
    A: -10,
    B: -20,
    C: -30,
    D: -40
};

/**
 * Item marks that count as beneficial (indexes into acquired counters).
 * @type {Array<string>}
 */
const GOOD_MARKS = ['a', 'b', 'c', 'd', 'e'];

/**
 * The error messages a real match reports for each rule violation.
 * @type {object}
 */
const RULE_ERRORS = {
    count_lack: 'このターンではもう行動できません',
    move_invalid_pos: '移動できない座標です',
    move_lack: '移動は1ターンに一度しかできません',
    dynamite_invalid_pos: 'ダイナマイトを設置できない座標です',
    bomb_invalid_pos: '爆弾を設置できない座標です',
    dynamite_lack: 'ダイナマイトがありません',
    bomb_lack: '爆弾がありません',
    map_invalid_pos: '指定された座標はマップ上に存在しません',
    already_finished: 'このラウンドではもう行動できません'
};

/**
 * Small deterministic PRNG (mulberry32) so a practice session can be replayed.
 * @param {number} seed - the seed.
 * @returns {Function} - a function returning floats in [0, 1).
 */
const makeRng = seed => {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let z = s;
        z = Math.imul(z ^ (z >>> 15), z | 1);
        z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
        return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * Whether a terrain code can be walked on.
 * @param {number} code - the terrain code.
 * @returns {boolean} - true when a pawn (or the fiend) can enter the cell.
 */
const walkable = code => code === 0 || code === 3 || code === 4;

/**
 * One round of the practice game. See the module doc for the big picture.
 */
class MockGame {
    /**
     * @param {object} options - game options.
     * @param {object} options.map - a bundled map definition (see mock-maps.js).
     * @param {number} [options.userSide] - which start the user takes (1 or 2).
     * @param {number} [options.seed] - PRNG seed (same seed = same fiend walk).
     */
    constructor (options) {
        const map = options.map;
        this._rows = map.rows.length;
        this._cols = map.rows[0].length;
        this._mapId = map.id;

        // The board is a flat terrain array plus a sparse mark->cell overlay
        // for items ("loot"). Item cells in the map source are open spaces.
        this._floor = [];
        this._loot = new Map();
        this._goal = null;
        map.rows.forEach((row, y) => {
            row.split('').forEach((ch, x) => {
                if (/[0-5]/.test(ch)) {
                    this._floor.push(Number(ch));
                    if (ch === '3') {
                        this._goal = [x, y];
                    }
                } else {
                    this._floor.push(0);
                    this._loot.set(this._cellIndex(x, y), ch);
                }
            });
        });

        const userSide = Number(options.userSide) === 2 ? 2 : 1;
        this._pawns = [1, 2].map(side => {
            const start = map.starts[side - 1];
            return this._makePawn(side, start, side === userSide);
        });

        this._fiend = {
            x: this._goal[0],
            y: this._goal[1],
            px: this._goal[0],
            py: this._goal[1],
            active: true,
            killMark: 'none',
            justKilled: false
        };

        this._fuses = [];
        this._turn = 1;
        this._over = false;
        this._events = [];
        this._rng = makeRng(Number.isFinite(options.seed) ? options.seed : 0x5eed);
    }

    /**
     * Build a fresh pawn record for one side.
     * @param {number} side - 1 or 2.
     * @param {Array<number>} start - the [x, y] start cell.
     * @param {boolean} isUser - whether this pawn is driven by the user's AI.
     * @returns {object} - the pawn.
     */
    _makePawn (side, start, isUser) {
        return {
            side,
            isUser,
            name: '',
            x: start[0],
            y: start[1],
            px: start[0],
            py: start[1],
            pts: 0,
            kegs: STOCK_PER_KIND, // dynamite left
            charges: STOCK_PER_KIND, // bombs left
            stride: 0, // walk bonus counter (persists across turns)
            soaked: false, // stepped into water; next step only dries off
            canStep: true, // one move per turn
            acts: 0, // actions used this turn
            state: 'playing', // playing | completed | timeup
            goalBonus: false,
            gotWalkBonus: false,
            gains: [0, 0, 0, 0, 0], // beneficial items acquired (a..e)
            msg: '',
            fog: Array(this._floor.length).fill(-1), // what this pawn has seen
            sight: Array(this._floor.length).fill(-1), // freshness of each cell
            lastScanAt: null,
            moved: false,
            intent: {step: null, plants: [], scans: []},
            logs: []
        };
    }

    /**
     * @param {number} x - the x coordinate.
     * @param {number} y - the y coordinate.
     * @returns {number} - the flat cell index.
     */
    _cellIndex (x, y) {
        return (y * this._cols) + x;
    }

    /**
     * @param {number} x - the x coordinate.
     * @param {number} y - the y coordinate.
     * @returns {boolean} - true when (x, y) is on the board.
     */
    _inBounds (x, y) {
        return x >= 0 && x < this._cols && y >= 0 && y < this._rows;
    }

    /**
     * @param {number} side - 1 or 2.
     * @returns {object} - the pawn for that side.
     */
    _pawn (side) {
        return this._pawns[side - 1];
    }

    /**
     * @param {number} side - 1 or 2.
     * @returns {object} - the opposing pawn.
     */
    _rivalOf (side) {
        return this._pawns[side === 1 ? 1 : 0];
    }

    /**
     * @param {string} code - one of the RULE_ERRORS keys.
     * @returns {object} - an error result shaped like a real match error.
     */
    _refuse (code) {
        return {error: {code, message: RULE_ERRORS[code]}};
    }

    /**
     * Register a player name for a side. Also the "session start" moment.
     * @param {number} side - 1 or 2.
     * @param {string} name - the player name (truncated to 14 chars).
     * @returns {object} - {info} with the joined pawn's state.
     */
    join (side, name) {
        const pawn = this._pawn(side);
        pawn.name = String(name || '').slice(0, 14);
        return {info: this.stateOf(side)};
    }

    /**
     * Consume one action slot, reporting overuse the way a real match does.
     * @param {object} pawn - the acting pawn.
     * @returns {?object} - an error result, or null when the action may proceed.
     */
    _spendAct (pawn) {
        pawn.acts += 1; // even refused actions consume the slot
        if (pawn.acts > ACT_LIMIT) {
            return this._refuse('count_lack');
        }
        return null;
    }

    /**
     * Look around: reveal the 5x5 window (clamped at edges) into the pawn's
     * own map and report the rival (window only) and the fiend (always).
     * @param {number} side - the acting side.
     * @param {number} x - the window center x.
     * @param {number} y - the window center y.
     * @returns {object} - {map, rivalSeen, fiend} or an error result.
     */
    scan (side, x, y) {
        const pawn = this._pawn(side);
        if (pawn.state !== 'playing') {
            return this._refuse('already_finished');
        }
        const overuse = this._spendAct(pawn);
        if (overuse) {
            return overuse;
        }
        if (!this._inBounds(x, y)) {
            return this._refuse('map_invalid_pos');
        }
        const x0 = Math.max(0, x - 2);
        const x1 = Math.min(this._cols - 1, x + 2);
        const y0 = Math.max(0, y - 2);
        const y1 = Math.min(this._rows - 1, y + 2);
        for (let cy = y0; cy <= y1; cy++) {
            for (let cx = x0; cx <= x1; cx++) {
                const i = this._cellIndex(cx, cy);
                pawn.fog[i] = this._loot.has(i) ? this._loot.get(i) : this._floor[i];
                pawn.sight[i] = FRESH_SIGHT;
            }
        }
        pawn.lastScanAt = [pawn.x, pawn.y];
        pawn.intent.scans.push([x, y]);
        const rival = this._rivalOf(side);
        const rivalSeen =
            rival.x >= x0 && rival.x <= x1 && rival.y >= y0 && rival.y <= y1
                ? [rival.x, rival.y]
                : null;
        return {
            map: this.fogOf(side),
            rivalSeen,
            fiend: this.fiendInfo()
        };
    }

    /**
     * Reserve a one-cell move; the pawn's position changes on turn end.
     * @param {number} side - the acting side.
     * @param {number} x - the destination x.
     * @param {number} y - the destination y.
     * @returns {object} - {info} or an error result.
     */
    step (side, x, y) {
        const pawn = this._pawn(side);
        if (pawn.state !== 'playing') {
            return this._refuse('already_finished');
        }
        const overuse = this._spendAct(pawn);
        if (overuse) {
            return overuse;
        }
        if (!pawn.canStep) {
            return this._refuse('move_lack');
        }
        if (pawn.soaked) {
            // Climbing out of water eats the action; the coordinates are not
            // even looked at, and the move-per-turn right is kept.
            pawn.soaked = false;
            return {info: this.stateOf(side)};
        }
        pawn.canStep = false; // an invalid move still uses up the move right
        const dx = x - pawn.x;
        const dy = y - pawn.y;
        const adjacent = (dx * dx) + (dy * dy) <= 1;
        if (
            !adjacent ||
            !this._inBounds(x, y) ||
            !walkable(this._floor[this._cellIndex(x, y)])
        ) {
            return this._refuse('move_invalid_pos');
        }
        pawn.intent.step = [x, y];
        return {info: this.stateOf(side)};
    }

    /**
     * Place dynamite or a bomb next to this turn's移動先 (or current cell).
     * @param {number} side - the acting side.
     * @param {string} kind - 'dynamite' or 'bomb'.
     * @param {number} x - the target x.
     * @param {number} y - the target y.
     * @returns {object} - {ok: true} or an error result.
     */
    plant (side, kind, x, y) {
        const pawn = this._pawn(side);
        const isDynamite = kind === 'dynamite';
        if (pawn.state !== 'playing') {
            return this._refuse('already_finished');
        }
        const overuse = this._spendAct(pawn);
        if (overuse) {
            return overuse;
        }
        const left = isDynamite ? pawn.kegs : pawn.charges;
        if (left <= 0) {
            return this._refuse(isDynamite ? 'dynamite_lack' : 'bomb_lack');
        }
        // A refused placement still uses up the item, like a real match.
        if (isDynamite) {
            pawn.kegs -= 1;
        } else {
            pawn.charges -= 1;
        }
        const base = pawn.intent.step || [pawn.x, pawn.y];
        const dx = x - base[0];
        const dy = y - base[1];
        const nearBase = (dx * dx) + (dy * dy) <= 1;
        const idx = this._cellIndex(x, y);
        const ground = this._inBounds(x, y) ? this._floor[idx] : null;
        const placeable = isDynamite ? ground === 0 || ground === 4 : ground === 0;
        if (!nearBase || !this._inBounds(x, y) || !placeable || this._loot.has(idx)) {
            return this._refuse(isDynamite ? 'dynamite_invalid_pos' : 'bomb_invalid_pos');
        }
        pawn.intent.plants.push({kind, x, y});
        return {ok: true};
    }

    /**
     * Set the pawn's message (shown by viewers; does not use an action).
     * @param {number} side - the acting side.
     * @param {string} msg - the message (truncated to 100 chars).
     * @returns {object} - {ok: true} or an error result.
     */
    say (side, msg) {
        const pawn = this._pawn(side);
        if (pawn.state !== 'playing') {
            return this._refuse('already_finished');
        }
        pawn.msg = String(msg === undefined || msg === null ? '' : msg).slice(0, 100);
        return {ok: true};
    }

    /**
     * End the given side's turn. The rival takes its turn (driven by the
     * caller beforehand) and the whole turn resolves.
     * @param {number} side - the side ending its turn.
     * @returns {object} - {info} with the pawn's state after resolution.
     */
    finishTurn (side) {
        const pawn = this._pawn(side);
        if (pawn.state !== 'playing' || this._over) {
            // A finished pawn may keep calling turn over; it is harmless.
            return {info: this.stateOf(side)};
        }
        this._resolveTurn();
        return {info: this.stateOf(side)};
    }

    /**
     * Resolve the whole turn in the same order a real match does:
     * fiend moves first, then reserved pawn actions apply, then goals and the
     * turn limit, then scoring, then dynamite goes off, then the next turn.
     */
    _resolveTurn () {
        this._events = [];
        this._fiend.justKilled = false;
        this._pawns.forEach(pawn => {
            pawn.logs = [];
            pawn.gotWalkBonus = false;
        });

        this._moveFiend();

        for (const pawn of this._pawns) {
            this._applyIntent(pawn);
        }

        this._grantSwordPower();
        for (const pawn of this._pawns) {
            this._scorePawn(pawn);
        }
        this._settleSwordPower();

        this._detonate();

        this._turn += 1;
        const allDone = this._pawns.every(pawn => pawn.state !== 'playing');
        if (this._turn > MAX_TURN || allDone) {
            this._over = true;
            for (const pawn of this._pawns) {
                if (pawn.state === 'timeup') {
                    pawn.pts -= TIMEUP_PENALTY;
                }
            }
        }
    }

    /**
     * Apply one pawn's reserved actions and per-turn upkeep.
     * @param {object} pawn - the pawn.
     */
    _applyIntent (pawn) {
        if (pawn.state !== 'playing') {
            pawn.logs = [[pawn.state, null, null]];
            pawn.intent = {step: null, plants: [], scans: []};
            return;
        }
        pawn.px = pawn.x;
        pawn.py = pawn.y;
        pawn.moved = false;
        if (pawn.intent.step) {
            const [nx, ny] = pawn.intent.step;
            pawn.x = nx;
            pawn.y = ny;
            pawn.moved = true;
            pawn.logs.push(['move', nx - pawn.px, ny - pawn.py]);
        }
        for (const plant of pawn.intent.plants) {
            if (plant.kind === 'dynamite') {
                this._fuses.push([plant.x, plant.y]);
                pawn.logs.push(['dynamite', plant.x, plant.y]);
            } else {
                this._loot.set(this._cellIndex(plant.x, plant.y), 'D');
                pawn.logs.push(['bomb', plant.x, plant.y]);
            }
        }
        for (const [sx, sy] of pawn.intent.scans) {
            pawn.logs.push(['search', sx, sy]);
        }
        pawn.intent = {step: null, plants: [], scans: []};

        // Everything seen goes one notch stale each turn.
        for (let i = 0; i < pawn.sight.length; i++) {
            if (pawn.sight[i] > 0) {
                pawn.sight[i] -= 1;
            }
        }
        pawn.canStep = true;
        pawn.acts = 0;
        if (pawn.moved && this._floor[this._cellIndex(pawn.x, pawn.y)] === 4) {
            pawn.soaked = true;
        }
        if (pawn.x === this._goal[0] && pawn.y === this._goal[1]) {
            pawn.state = 'completed';
        } else if (this._turn >= MAX_TURN) {
            pawn.state = 'timeup';
            pawn.goalBonus = true; // no goal (or fiend) bonus events after time up
        }
    }

    /**
     * Give the fiend-slaying power to pawns standing on the sword item.
     */
    _grantSwordPower () {
        const holders = this._pawns.filter(pawn => {
            const mark = this._loot.get(this._cellIndex(pawn.x, pawn.y));
            return mark === 'e';
        });
        if (holders.length === 2) {
            this._fiend.killMark = 'both';
        } else if (holders.length === 1) {
            this._fiend.killMark = `p${holders[0].side}`;
        }
    }

    /**
     * Whether a pawn currently holds the fiend-slaying power.
     * @param {object} pawn - the pawn.
     * @returns {boolean} - true when it does.
     */
    _hasSwordPower (pawn) {
        const mark = this._fiend.killMark;
        return mark === 'both' || mark === `p${pawn.side}`;
    }

    /**
     * Score one pawn: items, fiend contact, walk bonus, goal bonus.
     * @param {object} pawn - the pawn.
     */
    _scorePawn (pawn) {
        const rival = this._rivalOf(pawn.side);
        const idx = this._cellIndex(pawn.x, pawn.y);
        const mark = this._loot.get(idx);
        if (mark) {
            const together = rival.x === pawn.x && rival.y === pawn.y;
            const points = LOOT_POINTS[mark];
            if (together) {
                // Simultaneous pickup: each pawn gets half (integer division).
                const half = Math.trunc(points / 2);
                pawn.pts += half;
                rival.pts += half;
                if (GOOD_MARKS.includes(mark)) {
                    pawn.gains[GOOD_MARKS.indexOf(mark)] += 1;
                    rival.gains[GOOD_MARKS.indexOf(mark)] += 1;
                }
            } else {
                pawn.pts += points;
                if (GOOD_MARKS.includes(mark)) {
                    pawn.gains[GOOD_MARKS.indexOf(mark)] += 1;
                }
            }
            this._events.push(['got_item', mark, pawn.x, pawn.y]);
            this._loot.delete(idx);
        }

        const fiend = this._fiend;
        if (
            fiend.active &&
            pawn.x === fiend.x &&
            pawn.y === fiend.y &&
            !pawn.goalBonus
        ) {
            if (this._hasSwordPower(pawn)) {
                const bothHere =
                    fiend.killMark === 'both' && rival.x === fiend.x && rival.y === fiend.y;
                pawn.pts += bothHere ? 15 : 30;
            } else {
                const rivalSlaysHere =
                    this._hasSwordPower(rival) && rival.x === fiend.x && rival.y === fiend.y;
                if (!rivalSlaysHere) {
                    pawn.pts -= 10;
                }
            }
        }

        if (pawn.moved) {
            pawn.stride += 1;
            const onGoal = pawn.x === this._goal[0] && pawn.y === this._goal[1];
            if (pawn.stride >= WALK_BONUS_EVERY && !onGoal) {
                pawn.pts += WALK_BONUS_POINTS;
                pawn.stride = 0;
                pawn.gotWalkBonus = true;
            }
        }

        if (pawn.state === 'completed' && !pawn.goalBonus) {
            pawn.pts += this._currentGoalBonus();
            pawn.goalBonus = true;
        }
        pawn.pts = Math.trunc(pawn.pts);
    }

    /**
     * @returns {number} - the goal bonus a pawn reaching the goal now earns.
     */
    _currentGoalBonus () {
        return 100 - (Math.floor((this._turn - 1) / 10) * 10);
    }

    /**
     * After scoring: slay the fiend if a power holder shares its cell, or
     * dissolve the power when its holder is out of the game.
     */
    _settleSwordPower () {
        const fiend = this._fiend;
        if (!fiend.active || fiend.killMark === 'none' || fiend.killMark === 'done') {
            return;
        }
        const holders = this._pawns.filter(pawn => this._hasSwordPower(pawn));
        const slayer = holders.find(pawn => pawn.x === fiend.x && pawn.y === fiend.y);
        if (slayer) {
            fiend.active = false;
            fiend.justKilled = true;
            fiend.killMark = 'done';
            fiend.x = 0;
            fiend.y = 0;
            return;
        }
        if (fiend.killMark === 'both') {
            if (holders.every(pawn => pawn.goalBonus)) {
                fiend.killMark = 'none';
            }
            return;
        }
        if (holders[0] && holders[0].state === 'completed') {
            fiend.killMark = 'none';
        }
    }

    /**
     * Blow up this turn's dynamite: each fuse turns the breakable walls on
     * its four neighbors into open space.
     */
    _detonate () {
        for (const [x, y] of this._fuses) {
            for (const [nx, ny] of [
                [x + 1, y],
                [x - 1, y],
                [x, y + 1],
                [x, y - 1]
            ]) {
                if (!this._inBounds(nx, ny)) {
                    continue;
                }
                const i = this._cellIndex(nx, ny);
                if (this._floor[i] === 5) {
                    this._floor[i] = 0;
                }
            }
        }
        this._fuses = [];
    }

    /**
     * Move the fiend one cell: hunt a nearby pawn (whole board from turn 41),
     * wander randomly when nobody is close, hold still when cornered.
     */
    _moveFiend () {
        const fiend = this._fiend;
        if (!fiend.active) {
            return;
        }
        fiend.px = fiend.x;
        fiend.py = fiend.y;
        const raging = this._turn >= FIEND_RAGE_TURN;
        const prey = this._pawns.filter(pawn => pawn.state === 'playing');

        let path = null;
        let minSteps = Infinity;
        if (raging) {
            for (const pawn of prey) {
                const p = this._huntPath(fiend.x, fiend.y, pawn.x, pawn.y);
                if (p && p.length - 1 < minSteps) {
                    minSteps = p.length - 1;
                    path = p;
                }
            }
            if (path && minSteps > 1) {
                fiend.x = path[1][0];
                fiend.y = path[1][1];
            }
            return;
        }

        const near = prey.filter(
            pawn => Math.abs(pawn.x - fiend.x) <= 3 && Math.abs(pawn.y - fiend.y) <= 3
        );
        let target = null;
        let best = Infinity;
        for (const pawn of near) {
            const d = ((pawn.x - fiend.x) ** 2) + ((pawn.y - fiend.y) ** 2);
            if (d < best) {
                best = d;
                target = pawn;
            }
        }
        if (target) {
            path = this._huntPath(fiend.x, fiend.y, target.x, target.y);
            if (path && path.length - 1 > 2) {
                fiend.x = path[1][0];
                fiend.y = path[1][1];
            }
            return;
        }
        const options = [
            [fiend.x + 1, fiend.y],
            [fiend.x - 1, fiend.y],
            [fiend.x, fiend.y + 1],
            [fiend.x, fiend.y - 1]
        ].filter(
            ([nx, ny]) => this._inBounds(nx, ny) && walkable(this._floor[this._cellIndex(nx, ny)])
        );
        if (options.length > 0) {
            const [nx, ny] = options[Math.floor(this._rng() * options.length)];
            fiend.x = nx;
            fiend.y = ny;
        }
    }

    /**
     * Shortest walk (uniform step cost, water included) from one cell to
     * another, for the fiend's hunting.
     * @param {number} sx - start x.
     * @param {number} sy - start y.
     * @param {number} tx - target x.
     * @param {number} ty - target y.
     * @returns {?Array<Array<number>>} - the path as [x, y] cells, or null.
     */
    _huntPath (sx, sy, tx, ty) {
        const startKey = this._cellIndex(sx, sy);
        const goalKey = this._cellIndex(tx, ty);
        if (startKey === goalKey) {
            return [[sx, sy]];
        }
        const cameFrom = new Map([[startKey, null]]);
        const queue = [[sx, sy]];
        while (queue.length > 0) {
            const [x, y] = queue.shift();
            for (const [nx, ny] of [
                [x + 1, y],
                [x - 1, y],
                [x, y + 1],
                [x, y - 1]
            ]) {
                if (!this._inBounds(nx, ny)) {
                    continue;
                }
                const key = this._cellIndex(nx, ny);
                if (cameFrom.has(key) || !walkable(this._floor[key])) {
                    continue;
                }
                cameFrom.set(key, this._cellIndex(x, y));
                if (key === goalKey) {
                    const path = [[nx, ny]];
                    let k = this._cellIndex(x, y);
                    while (k !== null) {
                        path.unshift([k % this._cols, Math.floor(k / this._cols)]);
                        k = cameFrom.get(k);
                    }
                    return path;
                }
                queue.push([nx, ny]);
            }
        }
        return null;
    }

    // --- Read model -------------------------------------------------------

    /**
     * @param {number} side - 1 or 2.
     * @returns {Array<Array<(number|string)>>} - a copy of that side's own map
     *     (-1 unexplored, terrain codes, item marks as letters).
     */
    fogOf (side) {
        const pawn = this._pawn(side);
        const grid = [];
        for (let y = 0; y < this._rows; y++) {
            grid.push(pawn.fog.slice(y * this._cols, (y + 1) * this._cols));
        }
        return grid;
    }

    /**
     * @returns {object} - the fiend as reported to players (always visible).
     */
    fiendInfo () {
        const fiend = this._fiend;
        let state = 'normal';
        if (fiend.killMark === 'done') {
            state = 'done';
        } else if (fiend.killMark !== 'none') {
            state = 'kill';
        } else if (this._turn >= FIEND_RAGE_TURN) {
            state = 'angry';
        }
        return {
            x: fiend.x,
            y: fiend.y,
            prev_x: fiend.px,
            prev_y: fiend.py,
            state,
            kill_player: fiend.killMark === 'p1' ? 'player1'
                : fiend.killMark === 'p2' ? 'player2'
                    : fiend.killMark,
            killed: fiend.justKilled
        };
    }

    /**
     * A pawn's public state, shaped like the real per-player info a match
     * reports after connecting, moving and ending a turn.
     * @param {number} side - 1 or 2.
     * @returns {object} - the pawn state.
     */
    stateOf (side) {
        const pawn = this._pawn(side);
        const finished = pawn.state !== 'playing';
        const levelBase = finished ? pawn.pts : pawn.pts + this._currentGoalBonus();
        const level = Math.min(8, Math.max(0, Math.floor((levelBase - 1) / 20)));
        return {
            round: 1,
            name: pawn.name,
            x: pawn.x,
            y: pawn.y,
            prev_x: pawn.px,
            prev_y: pawn.py,
            score: pawn.pts,
            map: this.fogOf(side),
            goal: this._goal.slice(),
            status: pawn.state,
            log: pawn.logs.slice(),
            finished,
            character_level: level,
            acquired_positive_items: [null].concat(pawn.gains),
            walk_bonus: pawn.gotWalkBonus,
            dynamite_items: Array(pawn.kegs).fill(10),
            bomb_items: Array(pawn.charges).fill(9),
            msg: pawn.msg
        };
    }

    /**
     * Everything the debugging panel needs to draw the whole world.
     * @returns {object} - the full ground-truth snapshot.
     */
    snapshot () {
        const rows = [];
        for (let y = 0; y < this._rows; y++) {
            let row = '';
            for (let x = 0; x < this._cols; x++) {
                const i = this._cellIndex(x, y);
                row += this._loot.has(i) ? this._loot.get(i) : String(this._floor[i]);
            }
            rows.push(row);
        }
        return {
            mapId: this._mapId,
            turn: this._turn,
            over: this._over,
            goal: this._goal.slice(),
            rows,
            events: this._events.slice(),
            pawns: this._pawns.map(pawn => ({
                side: pawn.side,
                isUser: pawn.isUser,
                name: pawn.name,
                x: pawn.x,
                y: pawn.y,
                score: pawn.pts,
                status: pawn.state,
                dynamiteLeft: pawn.kegs,
                bombLeft: pawn.charges,
                actionsUsed: Math.min(pawn.acts, ACT_LIMIT),
                actionsLimit: ACT_LIMIT,
                canMove: pawn.canStep,
                inWater: pawn.soaked,
                walkCount: pawn.stride,
                message: pawn.msg,
                level: this.stateOf(pawn.side).character_level
            })),
            fiend: this.fiendInfo()
        };
    }

    /**
     * @returns {number} - the current turn number (1-based).
     */
    get turn () {
        return this._turn;
    }

    /**
     * @returns {boolean} - true once the round has ended.
     */
    get over () {
        return this._over;
    }

    /**
     * @returns {Array<number>} - the goal cell as [x, y].
     */
    get goal () {
        return this._goal.slice();
    }

    /**
     * The current confirmed position of a side's pawn (for the rival driver).
     * @param {number} side - 1 or 2.
     * @returns {object} - {x, y, soaked, state}.
     */
    pawnAt (side) {
        const pawn = this._pawn(side);
        return {x: pawn.x, y: pawn.y, soaked: pawn.soaked, state: pawn.state};
    }

    /**
     * Cells the rival driver may walk on, from the true board.
     * @param {number} x - the x coordinate.
     * @param {number} y - the y coordinate.
     * @returns {boolean} - true when walkable terrain.
     */
    isWalkable (x, y) {
        return this._inBounds(x, y) && walkable(this._floor[this._cellIndex(x, y)]);
    }

    /**
     * @returns {Function} - the game's deterministic RNG (shared with the rival).
     */
    get rng () {
        return this._rng;
    }
}

module.exports = {
    MockGame,
    ACT_LIMIT,
    MAX_TURN,
    RULE_ERRORS,
    LOOT_POINTS
};
