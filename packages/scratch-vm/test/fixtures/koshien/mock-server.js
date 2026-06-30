/**
 * Minimal mock Smalruby Koshien game server (#741).
 *
 * Serves the koshien HTTP API with canned, deterministic responses + CORS, so the
 * browser/Node koshien RemoteClient can be exercised end-to-end without standing
 * up the real (viewer-driven, 2-player) game server.
 *
 * Use as a library (tests):   const {createKoshienMockServer} = require('./mock-server');
 * Use as a CLI (manual/browser): node packages/scratch-vm/test/fixtures/koshien/mock-server.js [port]
 *   (or: npm --prefix packages/scratch-vm run koshien:mock-server -- 3000)
 */
const http = require('http');

const MAP_SIZE = 15;
const buildMap = fill => Array.from({length: MAP_SIZE}, () => new Array(MAP_SIZE).fill(fill));

/**
 * Create (but do not start) a mock koshien game server.
 * @param {object} options - {maxTurn}.
 * @returns {http.Server} - the server (call .listen()).
 */
const createKoshienMockServer = (options = {}) => {
    const maxTurn = options.maxTurn || 3;
    const state = {
        turn: 1,
        player: {x: 1, y: 1},
        goal: [13, 13],
        map: buildMap(-1),
    };
    const enemy = {
        x: 7,
        y: 7,
        prev_x: 7,
        prev_y: 7,
        state: 'normal',
        kill_player: 'none',
        killed: false,
    };

    const apiInfo = status => ({
        round: 1,
        name: 'player',
        uuid: 'mock-uuid',
        x: state.player.x,
        y: state.player.y,
        prev_x: state.player.x,
        prev_y: state.player.y,
        score: 0,
        total_score: [0, null],
        map: state.map,
        goal: state.goal,
        status: status || 'playing',
        finished: !!status && status !== 'playing',
    });

    // Reveal the 5x5 area around (cx, cy) as space (goal cell stays the goal code).
    const reveal = (cx, cy) => {
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const y = cy + dy;
                const x = cx + dx;
                if (y >= 0 && y < MAP_SIZE && x >= 0 && x < MAP_SIZE) {
                    state.map[y][x] = x === state.goal[0] && y === state.goal[1] ? 3 : 0;
                }
            }
        }
    };

    const server = http.createServer((req, res) => {
        const origin = req.headers.origin;
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.end();
            return;
        }

        const url = new URL(req.url, 'http://localhost');
        const path = url.pathname;
        const q = url.searchParams;
        const send = obj => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
        };

        switch (path) {
        case '/api/manage/connectGame':
            send(apiInfo('playing'));
            return;
        case '/api/search/getMapArea':
            reveal(Number(q.get('x')), Number(q.get('y')));
            send({map: state.map, other_player: null, enemy});
            return;
        case '/api/move/to':
            state.player.x = Number(q.get('x'));
            state.player.y = Number(q.get('y'));
            send(apiInfo('playing'));
            return;
        case '/api/move/setDynamite':
        case '/api/move/setBomb':
        case '/api/move/setMessage':
            send({result: 'OK'});
            return;
        case '/api/manage/turnOver': {
            state.turn += 1;
            const status = state.turn > maxTurn ? 'timeup' : 'playing';
            send({[q.get('uuid')]: apiInfo(status)});
            return;
        }
        case '/api/viewer/getAllMap':
            send({status: 'turn', players: [apiInfo('playing')], enemy, turn: state.turn});
            return;
        default:
            res.statusCode = 404;
            send({class: 'ApiNotFound', message: 'not found'});
        }
    });

    return server;
};

module.exports = {createKoshienMockServer};

// CLI entry point.
if (require.main === module) {
    const port = Number(process.argv[2]) || 3000;
    createKoshienMockServer().listen(port, '127.0.0.1', () => {
        process.stdout.write(`Koshien mock server listening on http://127.0.0.1:${port}\n`);
    });
}
