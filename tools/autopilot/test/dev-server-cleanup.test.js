'use strict';
// worker が残した dev server（webpack serve）とブラウザの後片付け（#1381・#2463）
const { test } = require('node:test');
const assert = require('node:assert');
const {
    isDevServerCommand, isBrowserCommand, leftoverKind, worktreeIssueFromCwd, selectLeftoversToStop,
} = require('../src/phases');
const { stopWorktreeLeftovers, listProcesses, cleanupIssueWorktree } = require('../src/daemon');

const ROOT = '/app/.autopilot-worktrees';
const WEBPACK = 'node /app/node_modules/.bin/webpack serve --port 8601';

test('isDevServerCommand: webpack serve / webpack-dev-server / npm start だけを dev server とみなす', () => {
    assert.equal(isDevServerCommand(WEBPACK), true);
    assert.equal(isDevServerCommand('sh -c webpack serve'), true);
    assert.equal(isDevServerCommand('node node_modules/webpack-dev-server/bin/webpack-dev-server.js'), true);
    assert.equal(isDevServerCommand('npm start'), true);
    assert.equal(isDevServerCommand('npm run start'), true);
    assert.equal(isDevServerCommand('node /usr/bin/npm start'), true);
    assert.equal(isDevServerCommand('node tools/autopilot/bin/autopilot-daemon'), false);
    assert.equal(isDevServerCommand('npm exec jest test/unit/a.test.js'), false);
    assert.equal(isDevServerCommand('webpack --mode production'), false);
    assert.equal(isDevServerCommand('claude --model opus'), false);
    assert.equal(isDevServerCommand(''), false);
    assert.equal(isDevServerCommand(null), false);
});

test('isDevServerCommand: webpack-cli が process.title で書き換えた `webpack` も拾う（#2463）', () => {
    // /proc/<pid>/cmdline は NUL 埋めの `webpack` だけになる（listProcesses が空を落として `webpack`）
    assert.equal(isDevServerCommand('webpack'), true);
    assert.equal(isDevServerCommand('  webpack '), true);
    assert.equal(isDevServerCommand('webpack-cli'), false);
    assert.equal(isDevServerCommand('pgrep -af webpack'), false);
});

test('isBrowserCommand: 実行ファイルの名前が chromedriver・chromium・headless_shell・chrome のものだけ（#2463）', () => {
    assert.equal(isBrowserCommand('/usr/bin/chromedriver --port=9515'), true);
    assert.equal(isBrowserCommand('/usr/lib/chromium/chromium --type=renderer --headless'), true);
    assert.equal(isBrowserCommand('/root/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell --headless'), true);
    assert.equal(isBrowserCommand('/root/.cache/ms-playwright/chromium-1187/chrome-linux/chrome --no-sandbox'), true);
    assert.equal(isBrowserCommand('chromium-browser'), true);
    // 引数にブラウザの名前が出るだけのものは含めない
    assert.equal(isBrowserCommand("pgrep -af chromedriver|chromium"), false);
    assert.equal(isBrowserCommand('node node_modules/.bin/jest test/integration/a.test.js --browser chromium'), false);
    assert.equal(isBrowserCommand('node tools/autopilot/bin/pw-check http://localhost:8601/'), false);
    assert.equal(isBrowserCommand(''), false);
    assert.equal(isBrowserCommand(null), false);
});

test('leftoverKind: dev server・ブラウザ・それ以外を見分ける', () => {
    assert.equal(leftoverKind('webpack'), 'dev-server');
    assert.equal(leftoverKind('/usr/bin/chromedriver'), 'browser');
    assert.equal(leftoverKind('claude --model opus'), null);
});

test('worktreeIssueFromCwd: autopilot worktree の cwd から Issue 番号を取る（削除済みの印も許す）', () => {
    assert.equal(worktreeIssueFromCwd(`${ROOT}/issue-1357/packages/scratch-gui`, ROOT), 1357);
    assert.equal(worktreeIssueFromCwd(`${ROOT}/issue-1300/packages/scratch-gui (deleted)`, ROOT), 1300);
    assert.equal(worktreeIssueFromCwd(`${ROOT}/issue-7`, `${ROOT}/`), 7);
    // main checkout・ほかの場所・似た名前は対象外
    assert.equal(worktreeIssueFromCwd('/app/packages/scratch-gui', ROOT), null);
    assert.equal(worktreeIssueFromCwd('/app', ROOT), null);
    assert.equal(worktreeIssueFromCwd(`${ROOT}/issue-12abc/x`, ROOT), null);
    assert.equal(worktreeIssueFromCwd(`${ROOT}-other/issue-7`, ROOT), null);
    assert.equal(worktreeIssueFromCwd(`${ROOT}/scratch`, ROOT), null);
    assert.equal(worktreeIssueFromCwd(null, ROOT), null);
    assert.equal(worktreeIssueFromCwd(`${ROOT}/issue-7`, ''), null);
});

const procs = [
    { pid: 101, cwd: `${ROOT}/issue-1300/packages/scratch-gui (deleted)`, cwdDeleted: true, cmd: WEBPACK },
    { pid: 102, cwd: `${ROOT}/issue-1357/packages/scratch-gui`, cwdDeleted: false, cmd: WEBPACK },
    { pid: 103, cwd: `${ROOT}/issue-1400/packages/scratch-gui`, cwdDeleted: false, cmd: WEBPACK },
    { pid: 104, cwd: '/app/packages/scratch-gui', cwdDeleted: false, cmd: WEBPACK }, // main checkout（人間）
    { pid: 105, cwd: '/home/someone/gui', cwdDeleted: true, cmd: WEBPACK }, // autopilot 外
    { pid: 106, cwd: `${ROOT}/issue-1357`, cwdDeleted: false, cmd: 'claude --model opus' }, // dev server でない
    { pid: 107, cwd: `${ROOT}/issue-1500/packages/scratch-gui`, cwdDeleted: true, cmd: WEBPACK }, // 実行中
];

test('selectLeftoversToStop: 掃除では cwd が消えたもの・終端 Issue のものだけを止める', () => {
    const r = selectLeftoversToStop(procs, {
        worktreeRoot: ROOT, terminalIssues: [1357], runningIssues: [1500],
    });
    assert.deepEqual(r.map((x) => [x.pid, x.issue, x.reason]), [
        [101, 1300, 'cwd-deleted'],
        [102, 1357, 'terminal-issue'],
    ]);
});

test('selectLeftoversToStop: main checkout や autopilot 以外・dev server でないもの・実行中は止めない', () => {
    const r = selectLeftoversToStop(procs, {
        worktreeRoot: ROOT, terminalIssues: [1400, 1500], runningIssues: [1500],
    });
    const pids = r.map((x) => x.pid);
    for (const pid of [104, 105, 106, 107]) assert.ok(!pids.includes(pid), `pid ${pid} を止めてはいけない`);
});

test('selectLeftoversToStop: 対象 Issue を指定したらその worktree のものだけを止める', () => {
    const r = selectLeftoversToStop(procs, { worktreeRoot: ROOT, issues: [1400], runningIssues: [] });
    assert.deepEqual(r.map((x) => [x.pid, x.reason]), [[103, 'target']]);
    // 実行中の Issue は指定されても止めない（次のフェーズの worker が使っている）
    assert.deepEqual(selectLeftoversToStop(procs, { worktreeRoot: ROOT, issues: [1500], runningIssues: [1500] }), []);
});

test('selectLeftoversToStop: 自分自身の PID と worktreeRoot 未指定は止めない', () => {
    assert.deepEqual(selectLeftoversToStop(procs, { worktreeRoot: ROOT, issues: [1400], selfPid: 103 }), []);
    assert.deepEqual(selectLeftoversToStop(procs, { issues: [1400] }), []);
    assert.deepEqual(selectLeftoversToStop(null, { worktreeRoot: ROOT }), []);
});

test('selectLeftoversToStop: ブラウザと書き換えた webpack も種類つきで選ぶ（#2463）', () => {
    const more = [
        { pid: 201, cwd: `${ROOT}/issue-1400/packages/scratch-gui`, cwdDeleted: false, cmd: 'webpack' },
        { pid: 202, cwd: `${ROOT}/issue-1400/packages/scratch-gui`, cwdDeleted: false, cmd: '/usr/bin/chromedriver --port=9515' },
        { pid: 203, cwd: `${ROOT}/issue-1300 (deleted)`, cwdDeleted: true, cmd: '/usr/lib/chromium/chromium --type=gpu-process' },
        { pid: 204, cwd: '/app/packages/scratch-gui', cwdDeleted: false, cmd: '/usr/bin/chromedriver' }, // 人間のもの
        { pid: 205, cwd: `${ROOT}/issue-1500`, cwdDeleted: false, cmd: '/usr/lib/chromium/chromium' }, // 実行中
    ];
    assert.deepEqual(
        selectLeftoversToStop(more, { worktreeRoot: ROOT, issues: [1400, 1500], runningIssues: [1500] })
            .map((x) => [x.pid, x.kind, x.reason]),
        [[201, 'dev-server', 'target'], [202, 'browser', 'target']],
    );
    assert.deepEqual(
        selectLeftoversToStop(more, { worktreeRoot: ROOT, terminalIssues: [], runningIssues: [1500] })
            .map((x) => [x.pid, x.kind, x.reason]),
        [[203, 'browser', 'cwd-deleted']],
    );
});

test('listProcesses: /proc から pid・cwd・コマンドを読み、削除済み cwd を見分ける', () => {
    const files = {
        '/proc/11/cwd': `${ROOT}/issue-1300/packages/scratch-gui (deleted)`,
        '/proc/11/cmdline': 'node\0/app/node_modules/.bin/webpack\0serve\0',
        '/proc/12/cwd': '/app',
        '/proc/12/cmdline': 'bash\0',
    };
    const r = listProcesses({
        procDir: '/proc',
        readdirSync: () => ['11', '12', '13', 'self', 'net'],
        readlinkSync: (p) => { if (!(p in files)) throw new Error('EACCES'); return files[p]; },
        readFileSync: (p) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; },
        existsSync: (p) => p === '/app',
    });
    assert.deepEqual(r, [
        { pid: 11, cwd: `${ROOT}/issue-1300/packages/scratch-gui (deleted)`, cwdDeleted: true, cmd: 'node /app/node_modules/.bin/webpack serve' },
        { pid: 12, cwd: '/app', cwdDeleted: false, cmd: 'bash' },
    ]);
    // /proc が読めない環境（macOS 等）は空
    assert.deepEqual(listProcesses({ readdirSync: () => { throw new Error('ENOENT'); } }), []);
});

test('stopWorktreeLeftovers: 選んだ PID に SIGTERM を送り、PID と理由をログに残す', () => {
    const killed = [];
    const logs = [];
    const r = stopWorktreeLeftovers({ issues: [1400], runningIssues: [] }, (m) => logs.push(m), {
        worktreeRoot: ROOT,
        listProcesses: () => procs,
        kill: (pid, sig) => killed.push([pid, sig]),
        selfPid: 1,
    });
    assert.deepEqual(killed, [[103, 'SIGTERM']]);
    assert.deepEqual(r.map((x) => x.pid), [103]);
    assert.ok(logs.some((m) => /PID 103/.test(m) && /#1400/.test(m) && /dev server を止めた/.test(m)));
});

test('stopWorktreeLeftovers: kill の失敗（もう居ない等）で落ちない', () => {
    const logs = [];
    const r = stopWorktreeLeftovers({ terminalIssues: [], runningIssues: [] }, (m) => logs.push(m), {
        worktreeRoot: ROOT,
        listProcesses: () => procs,
        kill: () => { throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' }); },
    });
    assert.deepEqual(r, []);
    assert.ok(logs.some((m) => /PID 101/.test(m) && /失敗/.test(m)));
});

test('cleanupIssueWorktree: worktree を消す前にその worktree の dev server を止める', async () => {
    const order = [];
    const exec = async (cmd, args) => {
        if (/autopilot-worktree$/.test(cmd)) return { stdout: '/wt/issue-7\n' };
        if (args[0] === 'status') return { stdout: '' };
        if (args[0] === 'symbolic-ref') return { stdout: 'topic/autopilot-7\n' };
        if (args[0] === 'worktree') order.push('remove');
        return { stdout: '' };
    };
    const r = await cleanupIssueWorktree({ issue: 7 }, {}, { running: new Map() }, () => {}, {
        execFileP: exec,
        existsSync: () => true,
        getDirectives: async () => ({ base: null, after: [] }),
        stopLeftovers: (opts) => { order.push(['stop', opts.issues]); return []; },
    });
    assert.equal(r.status, 'removed');
    assert.deepEqual(order, [['stop', [7]], 'remove']);
});
