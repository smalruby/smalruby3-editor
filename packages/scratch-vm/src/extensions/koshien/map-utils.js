/**
 * Pure helpers operating on a Koshien map grid.
 *
 * A "grid" is a 2D array indexed as `grid[y][x]`. Each cell is either a number
 * (0 = space, 1 = wall, 2 = storehouse, 3 = goal, 4 = water, 5 = breakable wall,
 * -1 = unexplored) or a single item letter (a-e beneficial, A-D harmful).
 *
 * These functions are intentionally free of any game/runtime state so they can
 * be shared by the mock client (fed a fixed sample map) and the remote client
 * (fed the map fetched from the real server). Keeping them identical guarantees
 * the disconnected "mock" experience behaves like the real game.
 */

/**
 * Cell codes that block movement (cannot be entered).
 * @type {Set<number>}
 */
const IMPASSABLE_CODES = new Set([1, 2, 5]);

/**
 * Parse an "x:y" position string into integer coordinates.
 * @param {string} position - the "x:y" string.
 * @returns {{x: number, y: number}} - the parsed coordinates (NaN when invalid).
 */
const parsePosition = position => {
    const [x, y] = String(position).split(':').map(Number);
    return {x, y};
};

/**
 * Format integer coordinates as the Koshien "x:y" string.
 * @param {number} x - the x coordinate.
 * @param {number} y - the y coordinate.
 * @returns {string} - "x:y".
 */
const formatPosition = (x, y) => `${x}:${y}`;

/**
 * Parse a Koshien map string ("row,row,...") into a grid.
 * @param {string} mapString - the map string ('-' = unexplored).
 * @returns {Array<Array<(number|string)>>} - the parsed grid.
 */
const parseMapString = mapString => {
    if (typeof mapString !== 'string' || mapString.length === 0) {
        return [];
    }
    return mapString.split(',').map(row =>
        row.split('').map(ch => {
            if (ch === '-') {
                return -1;
            }
            return /[0-9]/.test(ch) ? Number(ch) : ch;
        }),
    );
};

/**
 * Serialize a grid back into a Koshien map string.
 * @param {Array<Array<(number|string)>>} grid - the grid.
 * @returns {string} - the "row,row,..." map string.
 */
const gridToMapString = grid =>
    grid
        .map(row => row.map(cell => (cell === -1 ? '-' : String(cell))).join(''))
        .join(',');

/**
 * Read a single cell, returning -1 (unexplored) when out of bounds.
 * @param {Array<Array<(number|string)>>} grid - the grid.
 * @param {number} x - the x coordinate.
 * @param {number} y - the y coordinate.
 * @returns {(number|string)} - the cell value, or -1 when out of bounds.
 */
const cellAt = (grid, x, y) => {
    if (y < 0 || y >= grid.length) {
        return -1;
    }
    const row = grid[y];
    if (!row || x < 0 || x >= row.length) {
        return -1;
    }
    return row[x];
};

/**
 * Movement cost for entering a cell (Infinity = impassable).
 * Mirrors the real server: walls impassable, water 2, unexplored 4, else 1.
 * @param {(number|string)} cell - the cell value.
 * @returns {number} - the movement cost.
 */
const moveCost = cell => {
    if (typeof cell === 'number' && IMPASSABLE_CODES.has(cell)) {
        return Infinity;
    }
    if (cell === 4) {
        return 2;
    }
    if (cell === -1) {
        return 4;
    }
    return 1;
};

/**
 * Compute the shortest route between two positions using Dijkstra.
 * @param {Array<Array<(number|string)>>} grid - the grid.
 * @param {string} src - start "x:y".
 * @param {string} dst - goal "x:y".
 * @param {Array<string>} [exceptCells] - "x:y" cells to treat as impassable.
 * @returns {Array<string>} - the route as "x:y" strings (empty when unreachable).
 */
const calcRoute = (grid, src, dst, exceptCells = []) => {
    const height = grid.length;
    const width = height ? grid[0].length : 0;
    if (!width || !height) {
        return [];
    }
    const start = parsePosition(src);
    const goal = parsePosition(dst);
    const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
    if (!inBounds(start.x, start.y) || !inBounds(goal.x, goal.y)) {
        return [];
    }

    const key = (x, y) => `${x},${y}`;
    const startKey = key(start.x, start.y);
    const goalKey = key(goal.x, goal.y);
    if (startKey === goalKey) {
        return [formatPosition(start.x, start.y)];
    }

    const blocked = new Set(
        (Array.isArray(exceptCells) ? exceptCells : [])
            .filter(cell => typeof cell === 'string' && cell.includes(':'))
            .map(cell => {
                const p = parsePosition(cell);
                return key(p.x, p.y);
            }),
    );

    const dist = new Map([[startKey, 0]]);
    const prev = new Map();
    const visited = new Set();

    for (;;) {
        let curKey = null;
        let curDist = Infinity;
        for (const [k, d] of dist) {
            if (!visited.has(k) && d < curDist) {
                curDist = d;
                curKey = k;
            }
        }
        if (curKey === null) {
            break;
        }
        if (curKey === goalKey) {
            break;
        }
        visited.add(curKey);
        const [cx, cy] = curKey.split(',').map(Number);
        const neighbors = [
            [cx + 1, cy],
            [cx - 1, cy],
            [cx, cy + 1],
            [cx, cy - 1],
        ];
        for (const [nx, ny] of neighbors) {
            if (!inBounds(nx, ny)) {
                continue;
            }
            const nKey = key(nx, ny);
            if (visited.has(nKey) || blocked.has(nKey)) {
                continue;
            }
            const cost = moveCost(cellAt(grid, nx, ny));
            if (!isFinite(cost)) {
                continue;
            }
            const nd = curDist + cost;
            if (nd < (dist.has(nKey) ? dist.get(nKey) : Infinity)) {
                dist.set(nKey, nd);
                prev.set(nKey, curKey);
            }
        }
    }

    if (!prev.has(goalKey)) {
        return [];
    }
    const path = [];
    let k = goalKey;
    while (k) {
        const [x, y] = k.split(',').map(Number);
        path.unshift(formatPosition(x, y));
        if (k === startKey) {
            break;
        }
        k = prev.get(k);
    }
    if (path[0] !== formatPosition(start.x, start.y)) {
        return [];
    }
    return path;
};

/**
 * Normalize the OBJECTS argument into a list of cell codes (as strings).
 * Accepts an array, a comma list ("a,b"), or a packed string ("abce" / "ABCD").
 * @param {(string|Array)} objects - the objects argument.
 * @returns {Array<string>} - object codes as strings.
 */
const normalizeObjectCodes = objects => {
    if (objects === undefined || objects === null) {
        return [];
    }
    if (Array.isArray(objects)) {
        return objects.map(o => String(o).trim()).filter(o => o !== '');
    }
    const str = String(objects).trim();
    if (str === '') {
        return [];
    }
    if (str.includes(',')) {
        return str.split(',').map(s => s.trim()).filter(s => s !== '');
    }
    return str.split('').filter(c => c.trim() !== '');
};

/**
 * Scan the grid around a center position for the requested object codes.
 * @param {Array<Array<(number|string)>>} grid - the grid.
 * @param {string} centerPos - the center "x:y".
 * @param {number} sqSize - the full side length of the (square) scan window;
 *     the scanned radius is (sqSize - 1) / 2, matching the real game.
 * @param {(string|Array)} objects - object codes to look for.
 * @returns {Array<string>} - matching "x:y" positions (top-left to bottom-right).
 */
const locateObjects = (grid, centerPos, sqSize, objects) => {
    const center = parsePosition(centerPos);
    const side = Math.max(1, Math.floor(Number(sqSize) || 1));
    const radius = Math.floor((side - 1) / 2);
    const codes = normalizeObjectCodes(objects);
    const result = [];
    for (let y = center.y - radius; y <= center.y + radius; y++) {
        for (let x = center.x - radius; x <= center.x + radius; x++) {
            const cell = cellAt(grid, x, y);
            if (cell === -1) {
                continue;
            }
            if (codes.length === 0 || codes.includes(String(cell))) {
                result.push(formatPosition(x, y));
            }
        }
    }
    return result;
};

module.exports = {
    IMPASSABLE_CODES,
    parsePosition,
    formatPosition,
    parseMapString,
    gridToMapString,
    cellAt,
    moveCost,
    calcRoute,
    normalizeObjectCodes,
    locateObjects,
};
