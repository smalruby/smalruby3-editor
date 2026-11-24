'use strict';
/**
 * current-status-job.js — 「現在地を作る」job の I/O（#2388）。
 *
 * モニタのボタン（POST /current-status）から 1 回だけ Claude の worker を起動し、材料
 * （GET /status.json と同じ JSON）を読ませて、現在地の artifact を**同じ URL で**作り直させる。
 * Issue に属さない job なので Project の Status / AI Status は動かさず、`phaseForItem` にも
 * 入れない（resolve-conflict と同じ「割り込み」の形・`.claude/rules/autopilot/prompts.md`）。
 * 判断（結果の解釈・次の状態）は current-status.js の純粋関数、ここはファイルと worker の起動だけ。
 *
 * 状態（artifact の URL・最終更新）は daemon の再起動をまたいで残すため、repo の外のファイルに置く:
 *   $AUTOPILOT_STATE_DIR（既定 ~/.config/autopilot）/current-status.json
 *   同じ場所の current-status-notes.jsonl に、worker が出したテンプレートの改善メモをためる。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildClaudeCommand } = require('./settings');
const { readResultFile } = require('./contract');
const {
    CURRENT_STATUS_PHASE, CURRENT_STATUS_SKILL, planCurrentStatusOutcome, currentStatusView,
} = require('./current-status');

/** 状態ファイルの置き場（テストや試しの daemon は env で分ける）。 */
function stateDir(env = process.env) {
    return env.AUTOPILOT_STATE_DIR || path.join(os.homedir(), '.config', 'autopilot');
}

function statePath(env) { return path.join(stateDir(env), 'current-status.json'); }
function notesPath(env) { return path.join(stateDir(env), 'current-status-notes.jsonl'); }

/** テンプレートの場所。daemon のスナップショットにあればそれ（ブランチ切り替えに非依存）、無ければ repo。 */
function templateDir(cfg) {
    const snap = cfg.snapshotDir && path.join(cfg.snapshotDir, 'templates', 'current-status');
    if (snap && fs.existsSync(snap)) return snap;
    return path.join(__dirname, '..', 'templates', 'current-status');
}

/**
 * 残した状態を読む。無い・壊れているときは settings の `currentStatus.artifactUrl`（あれば）から始める。
 * @returns {object}
 */
function loadCurrentStatusState(cfg = {}, deps = {}) {
    const read = deps.readFileSync || fs.readFileSync;
    let st = {};
    try { st = JSON.parse(read(statePath(deps.env), 'utf8')) || {}; } catch { st = {}; }
    const seed = cfg.settings && cfg.settings.currentStatus && cfg.settings.currentStatus.artifactUrl;
    if (!st.url && seed) st.url = seed;
    return st;
}

function saveCurrentStatusState(st, deps = {}) {
    const file = statePath(deps.env);
    (deps.mkdirSync || fs.mkdirSync)(path.dirname(file), { recursive: true });
    (deps.writeFileSync || fs.writeFileSync)(file, JSON.stringify(st, null, 2));
}

/** たまっている改善メモの数（モニタに出す）。 */
function countNotes(deps = {}) {
    try {
        return String((deps.readFileSync || fs.readFileSync)(notesPath(deps.env), 'utf8')).split('\n').filter(Boolean).length;
    } catch { return 0; }
}

function appendNotes(notes, at, deps = {}) {
    if (!notes.length) return;
    const file = notesPath(deps.env);
    (deps.mkdirSync || fs.mkdirSync)(path.dirname(file), { recursive: true });
    const lines = notes.map((note) => JSON.stringify({ at: new Date(at).toISOString(), note })).join('\n') + '\n';
    (deps.appendFileSync || fs.appendFileSync)(file, lines);
}

/** daemon の state に現在地の見え方を載せる（/board・/status.json 用）。 */
function refreshCurrentStatusView(state, deps = {}) {
    state.currentStatus = currentStatusView(state.currentStatusState, state.currentStatusJob, countNotes(deps));
    return state.currentStatus;
}

/**
 * 現在地を作る job を 1 回走らせる。走っている間は state.currentStatusJob を持ち、二重に起動しない
 * （呼び出し側が 409 を返す）。成功・失敗とも状態ファイルを書き、モニタの見え方を更新する。
 * @param {object} cfg daemon の cfg（settings / snapshotDir / promptDir / port / now / watchdog）
 * @param {object} state daemon の state（currentStatusState / currentStatusJob を書く）
 * @param {function} log
 * @param {object} deps { material: () => object, runPhase, readResultFile, env, ...fs }
 * @returns {Promise<{ok: boolean, url?: string, error?: string}>}
 */
async function runCurrentStatusJob(cfg, state, log, deps = {}) {
    if (state.currentStatusJob) return { ok: false, error: 'already running' };
    const now = () => (cfg.now ? cfg.now() : Date.now());
    state.currentStatusJob = { startedAt: now() };
    refreshCurrentStatusView(state, deps);
    try {
        const work = deps.workDir || path.join(os.tmpdir(), `autopilot-current-status-${cfg.port || 'x'}`);
        fs.mkdirSync(work, { recursive: true });
        const materialFile = path.join(work, 'material.json');
        const resultFile = path.join(work, 'result.json');
        const htmlFile = path.join(work, 'current-status.html');
        fs.writeFileSync(materialFile, JSON.stringify(deps.material(), null, 2));
        fs.rmSync(resultFile, { force: true });
        const prev = state.currentStatusState || {};
        const tdir = templateDir(cfg);
        const env = {
            AUTOPILOT_ISSUE: '0',
            AUTOPILOT_PHASE: CURRENT_STATUS_PHASE,
            AUTOPILOT_RESULT_FILE: resultFile,
            AUTOPILOT_REPO: cfg.repo || '',
            AUTOPILOT_REPO_ROOT: cfg.repoRoot || path.join(__dirname, '..', '..', '..'),
            AUTOPILOT_STATUS_JSON: materialFile,
            AUTOPILOT_STATUS_URL: `http://localhost:${cfg.port}/status.json`,
            AUTOPILOT_ARTIFACT_URL: prev.url || '',
            AUTOPILOT_ARTIFACT_HTML: htmlFile,
            AUTOPILOT_TEMPLATE_DIR: tdir,
            AUTOPILOT_RENDER: path.join(__dirname, '..', 'bin', 'current-status-render.js'),
        };
        const command = process.env.AUTOPILOT_CLAUDE_CMD
            || buildClaudeCommand(cfg.settings, CURRENT_STATUS_PHASE, {
                extraDirs: [cfg.snapshotDir, tdir, path.join(__dirname, '..')].filter(Boolean),
            });
        const run = deps.runPhase || require('./runner').runPhase;
        log(`current-status: run ${CURRENT_STATUS_SKILL} (artifact ${prev.url ? 'update' : 'create'})`);
        const res = await run({
            session: `autopilot-${CURRENT_STATUS_PHASE}-${cfg.port || 0}`, cwd: work, env, command,
            promptDir: process.env.AUTOPILOT_CLAUDE_CMD ? undefined : cfg.promptDir,
            skill: CURRENT_STATUS_SKILL, issue: 0, resultFile, log, watchdog: cfg.watchdog,
        });
        const parsed = res && res.ok ? (deps.readResultFile || readResultFile)(resultFile) : null;
        const plan = planCurrentStatusOutcome({ prev, run: res, parsed, now: now() });
        state.currentStatusState = plan.state;
        try { saveCurrentStatusState(plan.state, deps); } catch (e) { log(`current-status: save failed: ${e.message}`); }
        try { appendNotes(plan.notes, now(), deps); } catch (e) { log(`current-status: notes failed: ${e.message}`); }
        log(plan.ok ? `current-status: updated ${plan.state.url}` : `current-status: failed ${plan.state.lastError}`);
        return plan.ok ? { ok: true, url: plan.state.url } : { ok: false, error: plan.state.lastError };
    } catch (e) {
        state.currentStatusState = { ...(state.currentStatusState || {}), lastRunAt: now(), lastError: e.message };
        log(`current-status: error ${e.message}`);
        return { ok: false, error: e.message };
    } finally {
        state.currentStatusJob = null;
        refreshCurrentStatusView(state, deps);
    }
}

module.exports = {
    stateDir, statePath, notesPath, templateDir,
    loadCurrentStatusState, saveCurrentStatusState, countNotes, appendNotes,
    refreshCurrentStatusView, runCurrentStatusJob,
};
