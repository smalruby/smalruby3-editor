/**
 * RemoteClient — talks to a real Smalruby Koshien game server over HTTP (#741).
 *
 * This is a JavaScript port of the reference Ruby client (`ai_lib.rb`):
 * - network methods (connectGame / getMapArea / moveTo / setDynamite / setBomb /
 *   setMessage / turnOver) are async and update the cached game state;
 * - reporter methods (map / mapAll / mapFrom / targetCoordinate / calcRoute /
 *   locateObjects) read from that cached state synchronously, mirroring the Ruby
 *   client where `koshien.map(...)` reads `@my_map` populated by `get_map_area`.
 *
 * It exposes the SAME method surface as MockClient (duck-typed) so the block
 * methods in index.js can use either interchangeably. When no server is
 * reachable the extension falls back to MockClient.
 *
 * The protocol is documented (and verified by golden fixtures captured from the
 * real server) under test/fixtures/koshien/golden/.
 */

const UNEXPLORED = -1;

/**
 * Parse a "x:y" position string into [x, y] integers.
 * @param {string} position - "x:y".
 * @returns {Array<number>} - [x, y].
 */
const parsePosition = position => {
    const parts = String(position).split(':');
    return [Number(parts[0]), Number(parts[1])];
};

/**
 * Format [x, y] as "x:y".
 * @param {number} x - x.
 * @param {number} y - y.
 * @returns {string} - "x:y".
 */
const toPositionString = (x, y) => `${x}:${y}`;

/**
 * A client of the Smalruby Koshien game server (real HTTP communication).
 */
class RemoteClient {
    /**
     * @param {Runtime} runtime - the Scratch 3.0 runtime.
     * @param {string} extensionId - the extension id.
     * @param {object} options - configuration.
     * @param {string} options.endpoint - base URL of the game server (e.g. http://host:3000).
     * @param {string} [options.playerId] - player UUID.
     * @param {number} [options.side] - 1 or 2.
     * @param {string} [options.gameCode] - game code.
     * @param {Function} [options.fetchImpl] - fetch implementation (injectable for tests).
     */
    constructor (runtime, extensionId, options = {}) {
        this.runtime = runtime;
        this._extensionId = extensionId;
        this._endpoint = (options.endpoint || '').replace(/\/$/, '');
        this._playerId = options.playerId || null;
        this._side = options.side || 1;
        this._gameCode = options.gameCode || null;
        this._fetch = options.fetchImpl || (typeof fetch === 'function' ? fetch.bind(null) : null);

        this._isConnected = false;
        this._playerName = null;

        // Cached game state (mirrors AILib's @my_map / @x / @y / @goal / ...).
        this.myMap = [];
        this.x = null;
        this.y = null;
        this.goal = null; // [x, y]
        this.otherPlayerPos = null; // [x, y] or null
        this.enemyPos = null; // {x, y} or null
    }

    isConnected () {
        return this._isConnected;
    }

    connect (playerName) {
        this._playerName = playerName;
    }

    // --- Network methods (async) ---

    /**
     * Connect to the game server and register the player.
     * @param {string} playerName - the player name.
     * @returns {Promise<object>} - the player api_info.
     */
    async connectGame (playerName) {
        if (playerName) this._playerName = playerName;
        const url = `${this._endpoint}/api/manage/connectGame`;
        const body = {
            code: this._gameCode,
            name: this._playerName,
            uuid: this._playerId,
            side: this._side
        };
        const info = await this._request('POST', url, {json: body});
        this._isConnected = true;
        this._updatePlayerInfo(info);
        return info;
    }

    /**
     * Fetch the 5x5 map area around a position; merges into the cached map.
     * @param {string} position - "x:y" center.
     * @returns {Promise<object>} - {map, other_player, enemy}.
     */
    async getMapArea (position) {
        const [x, y] = parsePosition(position);
        const res = await this._request('GET', `${this._endpoint}/api/search/getMapArea`, {
            query: {x, y, uuid: this._playerId}
        });
        if (res && res.map) this.myMap = res.map;
        if (res && 'other_player' in res) this.otherPlayerPos = res.other_player;
        if (res && 'enemy' in res) this.enemyPos = res.enemy;
        return res;
    }

    /**
     * Move toward a position (reservation; confirmed server-side at turn end).
     * @param {string} position - "x:y".
     * @returns {Promise<object>} - server response.
     */
    moveTo (position) {
        const [x, y] = parsePosition(position);
        return this._request('POST', `${this._endpoint}/api/move/to`, {
            query: {x, y, uuid: this._playerId}
        });
    }

    /**
     * @param {string} item - 'dynamite' or 'bomb'.
     * @param {string} position - "x:y".
     * @returns {Promise<object>} - server response.
     */
    setItem (item, position) {
        const [x, y] = parsePosition(position);
        const path = item === 'bomb' ? 'setBomb' : 'setDynamite';
        return this._request('POST', `${this._endpoint}/api/move/${path}`, {
            query: {x, y, uuid: this._playerId}
        });
    }

    /**
     * @param {string} message - the message (max 100 chars server-side).
     * @returns {Promise<object>} - server response.
     */
    setMessage (message) {
        return this._request('POST', `${this._endpoint}/api/move/setMessage`, {
            query: {msg: String(message).slice(0, 100), uuid: this._playerId}
        });
    }

    /**
     * End the current turn; blocks server-side until the turn transitions.
     * @returns {Promise<object>} - the player api_info for the next turn.
     */
    async turnOver () {
        const result = await this._request('POST', `${this._endpoint}/api/manage/turnOver`, {
            query: {uuid: this._playerId}
        });
        const info = result && this._playerId ? result[this._playerId] : result;
        this._updatePlayerInfo(info);
        return info;
    }

    // --- Reporters (read cached state, synchronous) ---

    /**
     * @param {string} position - "x:y".
     * @returns {number|string|null} - cell value, -1 if unexplored, null if out of map.
     */
    map (position) {
        const [x, y] = parsePosition(position);
        if (this.myMap && this.myMap[y] && typeof this.myMap[y][x] !== 'undefined') {
            return this.myMap[y][x];
        }
        return null;
    }

    /**
     * @returns {string} - the whole map as comma-separated rows ('-' = unexplored).
     */
    mapAll () {
        return (this.myMap || [])
            .map(row => row.map(cell => (cell === UNEXPLORED ? '-' : String(cell))).join(''))
            .join(',');
    }

    /**
     * Read a cell from a map string previously obtained from mapAll.
     * @param {string} position - "x:y".
     * @param {string} mapString - a map string.
     * @returns {number} - cell value, or -1 when unresolved.
     */
    mapFrom (position, mapString) {
        if (typeof mapString !== 'string' || mapString.length === 0) return UNEXPLORED;
        const rows = mapString.split(',').map(r => r.split('').map(c => (c === '-' ? UNEXPLORED : Number(c))));
        const [x, y] = parsePosition(position);
        if (rows[y] && typeof rows[y][x] !== 'undefined') return rows[y][x];
        return UNEXPLORED;
    }

    /**
     * @param {string} target - player/goal/other_player/enemy.
     * @param {string} coordinate - position/x/y.
     * @returns {string|number|null} - the requested coordinate, or null when unknown.
     */
    targetCoordinate (target, coordinate) {
        let pos = null; // [x, y]
        switch (target) {
        case 'player':
            pos = (this.x === null || this.y === null) ? null : [this.x, this.y];
            break;
        case 'goal':
            pos = this.goal || null;
            break;
        case 'other_player':
            pos = this.otherPlayerPos || null;
            break;
        case 'enemy':
            pos = this.enemyPos ? [this.enemyPos.x, this.enemyPos.y] : null;
            break;
        default:
            pos = null;
        }
        if (!pos) return null;
        if (coordinate === 'x') return pos[0];
        if (coordinate === 'y') return pos[1];
        return toPositionString(pos[0], pos[1]);
    }

    /**
     * Shortest path over the known map (Dijkstra; mirrors ai_lib's calc_route).
     * @param {object} props - {src, dst} as "x:y" strings (both optional).
     * @returns {Array<string>} - route [start, ..., goal] of "x:y" strings.
     */
    calcRoute (props) {
        const {src, dst} = props || {};
        const start = src ? parsePosition(src) : [this.x, this.y];
        const goal = dst ? parsePosition(dst) : this.goal;
        if (!start || start[0] === null || !goal) return [];
        const route = this._dijkstra(start, goal);
        return route.map(([x, y]) => toPositionString(x, y));
    }

    /**
     * Locate cells containing any of the given objects within a square area.
     * @param {object} props - {position, sqSize, objects}.
     * @returns {Array<string>} - matching "x:y" positions (y-major order).
     */
    locateObjects (props) {
        const {position, sqSize, objects} = props || {};
        const center = position ? parsePosition(position) : [this.x, this.y];
        const size = Number(sqSize) || 5;
        const targets = String(objects || 'ABCD').split('');
        const half = Math.floor((size - 1) / 2);
        const found = [];
        if (!this.myMap || this.myMap.length === 0) return found;
        for (let dy = 0; dy < size; dy++) {
            const y = (dy - half) + center[1];
            if (y < 0 || y >= this.myMap.length) continue;
            for (let dx = 0; dx < size; dx++) {
                const x = (dx - half) + center[0];
                if (x < 0 || x >= this.myMap[0].length) continue;
                if (targets.includes(String(this.myMap[y][x]))) {
                    found.push(toPositionString(x, y));
                }
            }
        }
        return found;
    }

    // --- internals ---

    /**
     * Update cached state from a player api_info object.
     * @param {object} info - player api_info (or null).
     */
    _updatePlayerInfo (info) {
        if (!info) return;
        if (info.goal) this.goal = info.goal;
        if (info.map) this.myMap = info.map;
        if (typeof info.x !== 'undefined' && info.x !== null) this.x = Number(info.x);
        if (typeof info.y !== 'undefined' && info.y !== null) this.y = Number(info.y);
        if ('other_player' in info) this.otherPlayerPos = info.other_player;
        if ('enemy' in info) this.enemyPos = info.enemy;
    }

    /**
     * Perform an HTTP request and parse the JSON response.
     * @param {string} method - HTTP method.
     * @param {string} url - URL.
     * @param {object} opts - {query, json}.
     * @returns {Promise<object>} - parsed JSON.
     */
    async _request (method, url, opts = {}) {
        if (!this._fetch) throw new Error('koshien RemoteClient: no fetch implementation');
        let fullUrl = url;
        const init = {method, headers: {}};
        if (opts.query) {
            const qs = Object.keys(opts.query)
                .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(opts.query[k])}`)
                .join('&');
            fullUrl += (url.includes('?') ? '&' : '?') + qs;
        }
        if (opts.json) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(opts.json);
        }
        const res = await this._fetch(fullUrl, init);
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    }

    /**
     * Dijkstra shortest path over this.myMap. Walls (1,2,5) are impassable;
     * unexplored (-1) and water (4) are passable with higher weight, mirroring
     * the reference client's preference for known open space.
     * @param {Array<number>} start - [x, y].
     * @param {Array<number>} goal - [x, y].
     * @returns {Array<Array<number>>} - path of [x, y] cells (start..goal), or [start] if none.
     */
    _dijkstra (start, goal) {
        const map = this.myMap;
        if (!map || map.length === 0) return [start];
        const h = map.length;
        const w = map[0].length;
        const weightOf = cell => {
            if (cell === 1 || cell === 2 || cell === 5) return null; // wall
            if (cell === 4) return 2; // water
            if (cell === UNEXPLORED) return 4; // unexplored
            return 1; // open / item / goal
        };
        const key = (x, y) => `${x}_${y}`;
        const dist = {};
        const prev = {};
        const startKey = key(start[0], start[1]);
        dist[startKey] = 0;
        // simple priority by scanning (maps are small: 15x15)
        const visited = {};
        const queue = [[0, start[0], start[1]]];
        while (queue.length > 0) {
            queue.sort((a, b) => a[0] - b[0]);
            const [d, x, y] = queue.shift();
            const k = key(x, y);
            if (visited[k]) continue;
            visited[k] = true;
            if (x === goal[0] && y === goal[1]) break;
            [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]].forEach(([nx, ny]) => {
                if (nx < 0 || ny < 0 || ny >= h || nx >= w) return;
                const wgt = weightOf(map[ny][nx]);
                if (wgt === null) return;
                const nk = key(nx, ny);
                const nd = d + wgt;
                if (typeof dist[nk] === 'undefined' || nd < dist[nk]) {
                    dist[nk] = nd;
                    prev[nk] = [x, y];
                    queue.push([nd, nx, ny]);
                }
            });
        }
        const goalKey = key(goal[0], goal[1]);
        if (typeof dist[goalKey] === 'undefined') return [start];
        const path = [];
        let cur = goal;
        while (cur) {
            path.unshift(cur);
            const pk = key(cur[0], cur[1]);
            if (pk === startKey) break;
            cur = prev[pk];
        }
        return path;
    }
}

module.exports = RemoteClient;
