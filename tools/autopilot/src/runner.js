'use strict';
/**
 * runner.js — 端末（herdr か tmux・terminal.js）の上で対話 Claude Code を起動し、send-keys でスキルを実行させ、
 * watchdog で監視する。docs/autopilot/autonomous-contract.md と Issue #760 の
 * 「Runner 堅牢性要件」に対応。
 *
 * 完了検出の権威 = 「結果ファイル（AUTOPILOT_RESULT_FILE）の出現」。
 * pane トークンは人間観測用の補助。起動・stall・暴走・死活は watchdog タイマーで処理。
 */

const { setTimeout: sleep } = require('timers/promises');
const fs = require('fs');
const {
    evaluate, shouldResend, DEFAULT_WATCHDOG, DEFAULT_CLAUDE_COMMAND, phasePromptCommand,
    shouldSignalCheckpoint, checkpointSignalMessage,
} = require('./phases');

// claude TUI が「実行中」のときに pane に出る指標（spinner のトークンカウンタ "· ↓"、
// 中断ヒント "esc to interrupt"）。これらが見えていれば、テキストが変わらなくても
// 作業中とみなし idle 判定をリセットする。
const BUSY_RE = /esc to interrupt|·\s*↓/;
// 対話プロンプト（許可/確認/選択ダイアログ）が pane に出ているか。Claude Code の選択 UI は
// 「❯ 1. …」の選択肢と「Esc to cancel …」フッターを持つ。busy でなくこれが見えていれば
// 人間の入力待ち = worker は進めない → HITL に落とす（auto mode でも稀に出る soft_deny 等）。
const PROMPT_RE = /(^|\n)\s*❯\s*\d+\.\s|Esc to cancel|Do you want to (proceed|create|run|make)/;

const { createTmuxBackend, createTerminal } = require('./terminal');
const { createBlockedHandler } = require('./blocked-handler');
const { resolveTerminalSettings, activeElapsedMs } = require('./blocked');

// 端末（tmux | herdr・#2387）。daemon が起動時に configureRunner で決める。未設定なら従来の tmux。
let terminal = null;
let terminalSettings = resolveTerminalSettings({ terminal: { backend: 'tmux' } });

/**
 * runner が使う端末を設定から決める（daemon の起動時に 1 回）。
 * @param {object} settings マージ済み settings（`terminal` / `blocked`）
 * @param {function} [log]
 * @param {object} [deps] { env, createTerminal }（テスト用）
 * @returns {object} 使う backend
 */
function configureRunner(settings, log = () => {}, deps = {}) {
    terminalSettings = resolveTerminalSettings(settings, deps.env || process.env);
    terminal = (deps.createTerminal || createTerminal)(terminalSettings, log);
    log(`terminal: ${terminal.kind}${terminal.kind === 'herdr' ? ` (session ${terminal.session})` : ''}, blocked: ${terminalSettings.blockedMode}${terminalSettings.judge ? ` + judge(${terminalSettings.judgeModel})` : ''}`);
    return terminal;
}

function getTerminal() {
    if (!terminal) terminal = createTmuxBackend();
    return terminal;
}

function getTerminalSettings() { return terminalSettings; }

/** autopilot が止まるとき、worker を全部止める（herdr は session ごと・#2387） */
function shutdownTerminal() {
    if (terminal && terminal.shutdown) terminal.shutdown();
}

// 従来の関数名（daemon が使う）。中身は今の端末へ渡す。
const hasSession = (session) => getTerminal().hasSession(session);
const listSessions = () => getTerminal().listSessions();
const capture = (session) => getTerminal().capture(session);
const killSession = (session) => getTerminal().killSession(session);
const launch = (session, cwd, env, command) => getTerminal().launch(session, cwd, env, command);
const sendLine = (session, text) => getTerminal().sendLine(session, text);

/**
 * 1 フェーズを実行する。
 * @param {object} opts
 * @param {string} opts.session worker の名前（tmux の session 名 / herdr の workspace の label）
 * @param {string} opts.cwd worktree パス
 * @param {object} opts.env claude に渡す環境（AUTOPILOT_* 等）
 * @param {string} opts.command claude 起動コマンド（既定 'claude --permission-mode acceptEdits'）
 * @param {string} opts.skill フェーズプロンプト basename（例 'autopilot-triage'。`tools/autopilot/prompts/<skill>.md`）
 * @param {string} [opts.promptDir] プロンプト配置ディレクトリ（daemon の起動時スナップショットの
 *   絶対パス等。省略時は worktree 内 `tools/autopilot/prompts`）
 * @param {number} opts.issue 対象 Issue 番号
 * @param {string} opts.resultFile 結果ファイルの絶対パス
 * @param {object} [opts.watchdog] タイマー設定（既定 DEFAULT_WATCHDOG）
 * @param {(m:string)=>void} [opts.log] ログ出力
 * @param {object} [opts.blocked] blocked-hub の channel（人間がモニターから答える口・#2387）
 * @param {object} [opts.terminal] 端末の backend（既定 configureRunner で決めたもの）
 * @param {object} [opts.terminalSettings] resolveTerminalSettings の結果（既定 configureRunner の値）
 * @param {function} [opts.judge] blocked の AI 判定（テスト用。既定 `claude -p`）
 * @param {function} [opts.now] 時計（テスト用）
 * @returns {Promise<{ok:boolean, action:string, reason:string}>}
 */
async function runPhase(opts) {
    const cfg = { ...DEFAULT_WATCHDOG, ...(opts.watchdog || {}) };
    const log = opts.log || (() => {});
    const command = opts.command || DEFAULT_CLAUDE_COMMAND;
    const minBootMs = cfg.minBootMs || 4000;
    const term = opts.terminal || getTerminal();
    const tset = opts.terminalSettings || terminalSettings;
    // handle = blocked を読んで答える / 人間を待つ（#2387）。hitl = 従来どおり打ち切って HITL。
    const handleBlocked = tset.blockedMode === 'handle';
    const now = opts.now || (() => Date.now());

    // 前回の結果ファイルが残っていると誤検出するので消す
    try { fs.rmSync(opts.resultFile, { force: true }); } catch { /* noop */ }

    let restarts = 0;
    /* eslint-disable no-constant-condition */
    while (true) {
        const reinforce = restarts > 0;
        log(`launch (attempt ${restarts + 1}, ${term.kind}): ${command}`);
        term.launch(opts.session, opts.cwd, opts.env, command);

        const startedAt = now();
        let ready = false;
        let sent = false;
        let accepted = false;
        let sentAt = 0;
        let sendAttempts = 0;
        let prevPane = null;
        let lastChangeAt = now();
        let promptSince = 0; // 対話プロンプトを最初に検知した時刻（0 = 出ていない）
        let blockedPolls = 0; // 続けて blocked に見えた回数（描きかけの画面に答えないため 2 回で扱う）
        let softSignalSent = false; // checkpoint 信号を送信済みか（試行ごとにリセット・#911）
        const handler = handleBlocked
            ? createBlockedHandler({ term, session: opts.session, settings: tset, channel: opts.blocked, judge: opts.judge, log })
            : null;
        // Skill のスラッシュコマンドではなく、プロンプトファイルを読ませる指示を送る（#プロンプト移設）
        const slash = phasePromptCommand(opts.skill, opts.issue, opts.promptDir);

        let outcome = null;
        while (!outcome) {
            await sleep(cfg.pollMs);
            const t = now();
            const resultPresent = fs.existsSync(opts.resultFile);
            const snap = term.snapshot(opts.session);
            const dead = !snap.alive;
            const pane = snap.screen || '';
            // claude が実行中（herdr の working / spinner / "esc to interrupt"）なら idle 扱いしない。
            const busy = snap.status === 'working' || BUSY_RE.test(pane);
            // herdr は判定（blocked）を持つのでそれを使う。tmux は画面の形で見る。
            const blockedNow = !dead && (snap.status ? snap.status === 'blocked' : (!busy && PROMPT_RE.test(pane)));
            blockedPolls = blockedNow ? blockedPolls + 1 : 0;
            if (pane !== prevPane || busy) { lastChangeAt = t; prevPane = pane; }

            let paused = false;
            if (handler) {
                const r = await handler.step({ blocked: handler.isPaused() ? blockedNow : blockedPolls >= 2, screen: pane, now: t });
                paused = r.paused;
                if (r.answered || paused) lastChangeAt = t; // 答えた・待っているあいだは stall とみなさない
                if (paused && !opts.blocked) {
                    // 人間が答える口が無い（モニターに出せない）ときは待たずに HITL へ渡す
                    outcome = { action: 'hitl', reason: 'blocked prompt needs a human (no monitor channel)' };
                    break;
                }
            }
            const pausedMs = handler ? handler.pausedMs(t) : 0;
            const elapsedMs = activeElapsedMs(t - startedAt, pausedMs);
            const idleMs = t - lastChangeAt;
            // 従来（hitl モード）: プロンプトが一定時間出たら HITL に落とす
            const prompting = !handler && ready && !busy && PROMPT_RE.test(pane);
            if (prompting) { if (!promptSince) promptSince = t; } else { promptSince = 0; }
            const promptingMs = promptSince ? t - promptSince : 0;

            // 起動完了の汎用判定: 非空 & 直近で安定 & 最低ブート時間経過（課題1）。
            // プロンプト（フォルダの信頼など）が出ているあいだは送らない（選択肢に文字が入るため）。
            if (!ready && !blockedNow && !paused && pane.trim() && idleMs >= cfg.pollMs && elapsedMs >= minBootMs) {
                ready = true;
                if (reinforce) {
                    // 再起動時は no-interview を強める（課題2）
                    term.sendLine(opts.session,
                        '# 注意: 対話質問しないこと。判断が要れば AUTOPILOT_RESULT_FILE に signal=hitl を書きコメントして終了。');
                }
                log(`ready (${elapsedMs}ms) -> send: ${slash}`);
                term.sendLine(opts.session, slash);
                sent = true;
                sentAt = t;
                sendAttempts = 1;
                lastChangeAt = t;
            }

            // 送信の到達確認と再送（課題1: cold-start で最初の送信が捨てられる・herdr の Enter 抜け）
            if (sent && !accepted && !paused) {
                if (busy || resultPresent || blockedNow) {
                    accepted = true;
                    log(`command accepted (#${opts.issue}, attempt ${sendAttempts})`);
                } else if (shouldResend({
                    sinceSendMs: t - sentAt, attempts: sendAttempts,
                    maxAttempts: cfg.maxSendAttempts, acceptWindowMs: cfg.acceptWindowMs,
                })) {
                    term.sendLine(opts.session, slash);
                    sendAttempts += 1;
                    sentAt = t;
                    lastChangeAt = t;
                    log(`resend ${slash} (#${opts.issue}, attempt ${sendAttempts})`);
                }
            }

            // 協調的チェックポイント（EPIC #906・#911）: soft-limit 超過で 1 回だけ worker に
            // 「まとめに入れ」信号を送る。人間を待っているあいだは送らない（画面に文字が入るため）。
            if (!paused && shouldSignalCheckpoint({ elapsedMs, ready, dead, resultPresent, softSignalSent }, cfg)) {
                log(`soft-limit exceeded (${elapsedMs}ms) -> send checkpoint signal (#${opts.issue})`);
                term.sendLine(opts.session, checkpointSignalMessage(cfg));
                softSignalSent = true;
            }

            const action = evaluate({ resultPresent, ready: ready || paused, dead, elapsedMs, idleMs, restarts, promptingMs }, cfg);
            if (action.action === 'wait') continue;
            outcome = action;
        }

        log(`watchdog: ${outcome.action} (${outcome.reason})`);
        if (opts.blocked) opts.blocked.close(`worker が終わった（${outcome.action}）`);
        term.killSession(opts.session);
        if (outcome.action === 'collect') {
            // 結果ファイルは呼び出し側が読む。
            return { ok: true, action: 'collect', reason: outcome.reason };
        }
        if (outcome.action === 'hitl') {
            // 対話プロンプトで人間入力待ちになった（hitl モード）→ daemon 側で HITL にする。
            return { ok: false, action: 'hitl', reason: outcome.reason };
        }
        if (outcome.action === 'fail') {
            return { ok: false, action: 'fail', reason: outcome.reason };
        }
        // restart
        restarts += 1;
        void sent;
    }
}

module.exports = {
    runPhase, launch, capture, hasSession, listSessions, killSession, sendLine, BUSY_RE, PROMPT_RE,
    configureRunner, getTerminal, getTerminalSettings, shutdownTerminal,
};
