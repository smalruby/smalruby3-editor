'use strict';
/**
 * terminal.js — worker（子 claude）を動かす端末の切りかえ（tmux | herdr・#2387）。
 *
 * runner.js / daemon.js はこのファイルの backend だけを使い、tmux / herdr のコマンドを直接書かない。
 * どちらの backend も同じ形の関数を持つ:
 *
 * | 関数 | 意味 |
 * |---|---|
 * | `launch(name, cwd, env, command)` | name の worker を新しく起こす（同名があれば先に止める） |
 * | `hasSession(name)` | worker の端末が生きているか（claude が終わると消える） |
 * | `listSessions()` | 生きている worker の名前の一覧 |
 * | `capture(name)` | いま見えている画面の文字 |
 * | `sendLine(name, text)` | 文を入れて Enter |
 * | `sendKeys(name, keys)` | キー（`1` / `enter` / `down` …）を送る |
 * | `snapshot(name)` | 見回り 1 回分 `{alive, screen, status}` |
 * | `agentStatus(name)` | herdr の判定（idle / working / blocked / done / unknown）。tmux は null |
 * | `shutdown()` | autopilot が止まるとき、worker を全部止める（ゾンビを残さない） |
 *
 * herdr は 1 つの session（既定 `autopilot`）を autopilot 専用に使い、worker 1 つ = workspace 1 つ
 * （label = worker の名前）にする。server は `herdr --session <s> server` で画面なしに起こせる
 * （tmux で client を起こす必要は無い）。`exec <command>` で起こすので、claude が終わると pane と
 * workspace も閉じる = tmux の session が消えるのと同じに扱える。
 */

const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// tmux の send-keys のキー名（herdr の logical key と同じ名前で受けて変換する）
const TMUX_KEY = { enter: 'Enter', esc: 'Escape', tab: 'Tab', up: 'Up', down: 'Down', left: 'Left', right: 'Right', space: 'Space' };

/**
 * tmux の backend（従来の動き）。
 * @param {object} [deps] { exec }（テスト用。exec(cmd, args) → stdout 文字列、失敗で throw）
 * @returns {object}
 */
function createTmuxBackend(deps = {}) {
    const exec = deps.exec || ((cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    const tmux = (args, { check = true } = {}) => {
        try { return { code: 0, out: exec('tmux', args) }; } catch (e) {
            if (check) throw e;
            return { code: e.status ?? 1, out: (e.stdout || '').toString() };
        }
    };
    // この daemon が起こした worker だけを shutdown で止める（同じ tmux に別の daemon の worker が居ても触らない）
    const launched = new Set();
    const killSession = (name) => { tmux(['kill-session', '-t', name], { check: false }); launched.delete(name); };
    return {
        kind: 'tmux',
        hasSession: (name) => tmux(['has-session', '-t', name], { check: false }).code === 0,
        listSessions() {
            const r = tmux(['list-sessions', '-F', '#{session_name}'], { check: false });
            if (r.code !== 0 || !r.out) return [];
            return r.out.split('\n').map((s) => s.trim()).filter(Boolean);
        },
        capture: (name) => tmux(['capture-pane', '-p', '-t', name], { check: false }).out || '',
        killSession,
        launch(name, cwd, env, command) {
            killSession(name);
            const args = ['new-session', '-d', '-s', name, '-c', cwd, '-x', '220', '-y', '50'];
            for (const [k, v] of Object.entries(env || {})) args.push('-e', `${k}=${v}`);
            args.push(command);
            tmux(args);
            launched.add(name);
        },
        sendLine(name, text) {
            tmux(['send-keys', '-t', name, '-l', text]);
            tmux(['send-keys', '-t', name, 'Enter']);
        },
        sendKeys(name, keys) {
            for (const k of keys) tmux(['send-keys', '-t', name, TMUX_KEY[k] || k]);
        },
        agentStatus: () => null,
        snapshot(name) {
            const alive = this.hasSession(name);
            return { alive, screen: alive ? this.capture(name) : '', status: null };
        },
        // tmux は worker ごとの session なので、この daemon が起こしたものだけを止める
        shutdown() {
            for (const s of [...launched]) killSession(s);
        },
    };
}

/**
 * herdr の backend。
 * @param {object} [opts] { session, bin, exec, spawnServer, sleepSync }（exec 以下はテスト用）
 * @returns {object}
 */
function createHerdrBackend(opts = {}) {
    const session = opts.session || 'autopilot';
    const bin = opts.bin || 'herdr';
    const exec = opts.exec || ((cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }));
    const sleepSync = opts.sleepSync || ((ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms));
    const run = (args) => exec(bin, ['--session', session, ...args]);
    const json = (args) => {
        const out = run(args);
        try { return JSON.parse(out).result; } catch { return null; }
    };
    const tryJson = (args) => { try { return json(args); } catch { return null; } };

    /** label → workspace / pane（pane は workspace の最初の pane） */
    function find(name) {
        const r = tryJson(['workspace', 'list']);
        const ws = r && Array.isArray(r.workspaces) ? r.workspaces.find((w) => w.label === name) : null;
        if (!ws) return null;
        const p = tryJson(['pane', 'list', '--workspace', ws.workspace_id]);
        const pane = p && Array.isArray(p.panes) && p.panes.length ? p.panes[0] : null;
        return { workspaceId: ws.workspace_id, paneId: pane ? pane.pane_id : null, agentStatus: pane ? pane.agent_status : null };
    }

    function serverRunning() {
        try {
            const out = exec(bin, ['session', 'list']);
            return out.split('\n').some((l) => {
                const cols = l.trim().split(/\s+/);
                return cols[0] === session && cols[1] === 'running';
            });
        } catch { return false; }
    }

    /** server を画面なしで起こす（tmux の client は使わない）。起動済みなら何もしない。 */
    function ensureServer() {
        if (serverRunning()) return;
        if (opts.spawnServer) opts.spawnServer(bin, session);
        else {
            const logFile = path.join(os.tmpdir(), `autopilot-herdr-${session}.log`);
            const fd = fs.openSync(logFile, 'a');
            const child = spawn(bin, ['--session', session, 'server'], { detached: true, stdio: ['ignore', fd, fd] });
            child.unref();
            fs.closeSync(fd);
        }
        for (let i = 0; i < 50 && !serverRunning(); i++) sleepSync(100);
        if (!serverRunning()) throw new Error(`herdr server (${session}) が起動しませんでした`);
    }

    const killSession = (name) => {
        const f = find(name);
        if (f) { try { run(['workspace', 'close', f.workspaceId]); } catch { /* 既に閉じた */ } }
    };

    return {
        kind: 'herdr',
        session,
        ensureServer,
        hasSession: (name) => !!find(name),
        listSessions() {
            const r = tryJson(['workspace', 'list']);
            return r && Array.isArray(r.workspaces) ? r.workspaces.map((w) => w.label).filter(Boolean) : [];
        },
        capture(name) {
            const f = find(name);
            if (!f || !f.paneId) return '';
            try { return run(['pane', 'read', f.paneId, '--source', 'visible']); } catch { return ''; }
        },
        killSession,
        launch(name, cwd, env, command) {
            ensureServer();
            killSession(name);
            const args = ['workspace', 'create', '--cwd', cwd, '--label', name, '--no-focus'];
            for (const [k, v] of Object.entries(env || {})) args.push('--env', `${k}=${v}`);
            const r = json(args);
            const paneId = r && r.root_pane && r.root_pane.pane_id;
            if (!paneId) throw new Error('herdr workspace create が pane を返しませんでした');
            // exec にして、claude が終わったら pane（= workspace）も閉じるようにする
            run(['pane', 'run', paneId, `exec ${command}`]);
        },
        sendLine(name, text) {
            // `agent prompt` は Enter が効かず送られないことがある（agent_prompt_stalled）ので、
            // 文と Enter を分けて送る。届いたかどうかは runner の再送の仕組みが見る。
            const f = find(name);
            if (!f || !f.paneId) return;
            run(['pane', 'send-text', f.paneId, text]);
            run(['pane', 'send-keys', f.paneId, 'Enter']);
        },
        sendKeys(name, keys) {
            const f = find(name);
            if (!f || !f.paneId || !keys.length) return;
            run(['pane', 'send-keys', f.paneId, ...keys]);
        },
        agentStatus(name) {
            const f = find(name);
            return f ? f.agentStatus || null : null;
        },
        /** 見回り 1 回分（生きているか・画面・herdr の判定）を少ない呼び出しで取る */
        snapshot(name) {
            const f = find(name);
            if (!f || !f.paneId) return { alive: false, screen: '', status: null };
            let screen = '';
            try { screen = run(['pane', 'read', f.paneId, '--source', 'visible']); } catch { /* 閉じかけ */ }
            return { alive: true, screen, status: f.agentStatus || null };
        },
        /** autopilot 専用の session を止める（中の pane = worker ごと止まる） */
        shutdown() {
            try { exec(bin, ['session', 'stop', session]); } catch { /* 動いていない */ }
        },
    };
}

/**
 * 設定から backend を作る。herdr を選んでも herdr が無ければ tmux に戻す（止まらないことを優先）。
 * @param {object} t resolveTerminalSettings の結果
 * @param {function} [log]
 * @param {object} [deps] { exec, createHerdr, createTmux }（テスト用）
 * @returns {object}
 */
function createTerminal(t, log = () => {}, deps = {}) {
    const mkTmux = deps.createTmux || createTmuxBackend;
    const mkHerdr = deps.createHerdr || createHerdrBackend;
    if (t && t.backend === 'herdr') {
        const exec = deps.exec || ((cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
        try {
            exec(t.herdrBin || 'herdr', ['--version']);
            return mkHerdr({ session: t.herdrSession, bin: t.herdrBin });
        } catch (e) {
            log(`herdr が使えないので tmux で動かします（${e.message}）`);
        }
    }
    return mkTmux();
}

module.exports = { createTmuxBackend, createHerdrBackend, createTerminal, TMUX_KEY };
