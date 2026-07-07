/**
 * Built-in practice rivals for the Koshien mock game.
 *
 * A rival plays the other pawn so the user's AI always has an opponent while
 * debugging. Each strategy only uses the same interface a player has (scan
 * around itself, then reserve one move), so it obeys the two-actions-per-turn
 * rule by construction.
 *
 * Strategies:
 *   - goal:   scan, then walk the cheapest known route to the goal.
 *   - item:   scan, then walk toward the nearest known beneficial item;
 *             falls back to the goal when none is known.
 *   - stop:   never moves (useful to observe a static opponent).
 *   - random: takes a random neighboring cell each turn.
 */

const mapUtils = require('./map-utils');

/**
 * Choose the rival's route on its own (fog-of-war) map.
 * @param {Array<Array<(number|string)>>} fog - the rival's own map.
 * @param {object} from - {x, y} start.
 * @param {Array<number>} to - [x, y] destination.
 * @returns {Array<string>} - the route as "x:y" strings.
 */
const routeOnFog = (fog, from, to) =>
    mapUtils.calcRoute(
        fog,
        mapUtils.formatPosition(from.x, from.y),
        mapUtils.formatPosition(to[0], to[1])
    );

/**
 * Positions of the beneficial items the rival has seen so far.
 * @param {Array<Array<(number|string)>>} fog - the rival's own map.
 * @returns {Array<Array<number>>} - item cells as [x, y].
 */
const knownGoodies = fog => {
    const found = [];
    fog.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (typeof cell === 'string' && /[a-e]/.test(cell)) {
                found.push([x, y]);
            }
        });
    });
    return found;
};

/**
 * Walk one step along a route when it is actually usable.
 * @param {object} game - the MockGame.
 * @param {number} side - the rival's side.
 * @param {Array<string>} route - "x:y" steps (route[0] is the current cell).
 */
const stepAlong = (game, side, route) => {
    if (!route || route.length < 2) {
        return;
    }
    const next = mapUtils.parsePosition(route[1]);
    if (game.isWalkable(next.x, next.y)) {
        game.step(side, next.x, next.y);
    }
};

/**
 * Play one rival turn (actions only; the caller resolves the turn).
 * @param {object} game - the MockGame.
 * @param {number} side - the rival's side.
 * @param {string} strategy - goal | item | stop | random.
 */
const playRivalTurn = (game, side, strategy) => {
    const me = game.pawnAt(side);
    if (me.state !== 'playing' || strategy === 'stop') {
        return;
    }

    if (strategy === 'random') {
        const options = [
            [me.x + 1, me.y],
            [me.x - 1, me.y],
            [me.x, me.y + 1],
            [me.x, me.y - 1]
        ].filter(([x, y]) => game.isWalkable(x, y));
        if (options.length > 0) {
            const [x, y] = options[Math.floor(game.rng() * options.length)];
            game.step(side, x, y);
        }
        return;
    }

    // goal / item: look around first, then move (2 actions, like a real AI).
    const scanned = game.scan(side, me.x, me.y);
    if (scanned.error) {
        return;
    }
    const fog = scanned.map;

    if (strategy === 'item') {
        const goodies = knownGoodies(fog);
        let best = null;
        let bestLen = Infinity;
        for (const cell of goodies) {
            const route = routeOnFog(fog, me, cell);
            if (route.length > 1 && route.length < bestLen) {
                bestLen = route.length;
                best = route;
            }
        }
        if (best) {
            stepAlong(game, side, best);
            return;
        }
        // No known item: head for the goal instead.
    }

    stepAlong(game, side, routeOnFog(fog, me, game.goal));
};

module.exports = {
    playRivalTurn
};
