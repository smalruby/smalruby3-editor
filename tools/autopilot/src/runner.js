'use strict';
/**
 * runner.js — tmux 上で対話 Claude Code を起動し、send-keys でスキルを実行させ、
 * watchdog で監視する。docs/autopilot/autonomous-contract.md と Issue #760 の
 * 「Runner 堅牢性要件」に対応。
 *
 * 完了検出の権威 = 「結果ファイル（AUTOPILOT_RESULT_FILE）の出現」。
 * pane トークンは人間観測用の補助。起動・stall・暴走・死活は watchdog タイマーで処理。
 */

const { execFileSync } = require('child_process');
const { setTimeout: sleep } = require('timers/promises');
const fs = require('fs');
const {
    evaluate, shouldResend, DEFAULT_WATCHDOG, DEFAULT_CLAUDE_COMMAND, phasePromptCommand,
    shouldSignalCheckpoint, CHECKPOINT_SIGNAL_MESSAGE,
} = require('./phases');

// claude TUI が「実行中」のときに pane に出る指標（spinner のトークンカウンタ "· ↓"、
// 中断ヒント "esc to interrupt"）。これらが見えていれば、テキストが変わらなくても
// 作業中とみなし idle 判定をリセットする。
const BUSY_RE = /esc to interrupt|·\s*↓/;
// 対話プロンプト（許可/確認/選択ダイアログ）が pane に出ているか。Claude Code の選択 UI は
// 「❯ 1. …」の選択肢と「Esc to cancel …」フッターを持つ。busy でなくこれが見えていれば
// 人間の入力待ち = worker は進めない → HITL に落とす（auto mode でも稀に出る soft_deny 等）。
const PROMPT_RE = /(^|\n)\s*❯\s*\d+\.\s|Esc to cancel|Do you want to (proceed|create|run|make)/;

function tmux(args, { check = true } = {}) {
    // stderr は握りつぶす（has-session 等の "can't find session" は想定内）
    const stdio = ['ignore', 'pipe', 'ignore'];
    try {
        return { code: 0, out: execFileSync('tmux', args, { encoding: 'utf8', stdio }) };
    } catch (e) {
        if (check) throw e;
        return { code: e.status ?? 1, out: (e.stdout || '').toString() };
    }
}

function hasSession(session) {
    return tmux(['has-session', '-t', session], { check: false }).code === 0;
}

/**
 * 生存中の tmux セッション名を一覧する（#953）。孤児 worker 復帰で、daemon crash を
 * 跨いで生き残った worker セッション（`autopilot-<phase>-<issue>`）を検出するために使う。
 * tmux サーバーが無い（1 つも session が無い）ときは非ゼロ終了するので、空配列を返す。
 * @returns {string[]} セッション名の配列
 */
function listSessions() {
    const r = tmux(['list-sessions', '-F', '#{session_name}'], { check: false });
    if (r.code !== 0 || !r.out) return [];
    return r.out.split('\n').map((s) => s.trim()).filter(Boolean);
}

function capture(session) {
    return tmux(['capture-pane', '-p', '-t', session], { check: false }).out || '';
}

function killSession(session) {
    tmux(['kill-session', '-t', session], { check: false });
}

/** detached session で command を起動（env は -e で注入） */
function launch(session, cwd, env, command) {
    killSession(session);
    const args = ['new-session', '-d', '-s', session, '-c', cwd, '-x', '220', '-y', '50'];
    for (const [k, v] of Object.entries(env)) args.push('-e', `${k}=${v}`);
    args.push(command);
    tmux(args);
}

/** スキル起動スラッシュコマンドを送る（literal + Enter） */
function sendLine(session, text) {
    tmux(['send-keys', '-t', session, '-l', text]);
    tmux(['send-keys', '-t', session, 'Enter']);
}

/**
 * 1 フェーズを実行する。
 * @param {object} opts
 * @param {string} opts.session tmux セッション名
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
 * @returns {Promise<{ok:boolean, action:string, reason:string}>}
 */
async function runPhase(opts) {
    const cfg = { ...DEFAULT_WATCHDOG, ...(opts.watchdog || {}) };
    const log = opts.log || (() => {});
    const command = opts.command || DEFAULT_CLAUDE_COMMAND;
    const minBootMs = cfg.minBootMs || 4000;

    // 前回の結果ファイルが残っていると誤検出するので消す
    try { fs.rmSync(opts.resultFile, { force: true }); } catch { /* noop */ }

    let restarts = 0;
    /* eslint-disable no-constant-condition */
    while (true) {
        const reinforce = restarts > 0;
        log(`launch (attempt ${restarts + 1}): ${command}`);
        launch(opts.session, opts.cwd, opts.env, command);

        const startedAt = Date.now();
        let ready = false;
        let sent = false;
        let accepted = false;
        let sentAt = 0;
        let sendAttempts = 0;
        let prevPane = null;
        let lastChangeAt = Date.now();
        let promptSince = 0; // 対話プロンプトを最初に検知した時刻（0 = 出ていない）
        let softSignalSent = false; // checkpoint 信号を送信済みか（試行ごとにリセット・#911）
        // Skill のスラッシュコマンドではなく、プロンプトファイルを読ませる指示を送る（#プロンプト移設）
        const slash = phasePromptCommand(opts.skill, opts.issue, opts.promptDir);

        let outcome = null;
        while (!outcome) {
            await sleep(cfg.pollMs);
            const elapsedMs = Date.now() - startedAt;
            const resultPresent = fs.existsSync(opts.resultFile);
            const dead = !hasSession(opts.session);
            const pane = capture(opts.session);
            // claude が実行中（spinner/トークンカウンタ/"esc to interrupt"）なら idle 扱いしない。
            // 長い思考で pane テキストが変わらなくても stall 誤検知しないため（実装作業で顕在化）。
            const busy = BUSY_RE.test(pane);
            if (pane !== prevPane || busy) { lastChangeAt = Date.now(); prevPane = pane; }
            const idleMs = Date.now() - lastChangeAt;
            // 対話プロンプトが出て人間入力待ちか（busy でない＝作業中でない場合のみ）。
            // 一度検知したら継続時間を測り、tPromptMs 超で HITL に落とす（evaluate 側）。
            const prompting = ready && !busy && PROMPT_RE.test(pane);
            if (prompting) { if (!promptSince) promptSince = Date.now(); } else { promptSince = 0; }
            const promptingMs = promptSince ? Date.now() - promptSince : 0;

            // 起動完了の汎用判定: 非空 & 直近で安定 & 最低ブート時間経過（課題1）
            if (!ready && pane.trim() && idleMs >= cfg.pollMs && elapsedMs >= minBootMs) {
                ready = true;
                if (reinforce) {
                    // 再起動時は no-interview を強める（課題2）
                    sendLine(opts.session,
                        '# 注意: 対話質問しないこと。判断が要れば AUTOPILOT_RESULT_FILE に signal=hitl を書きコメントして終了。');
                }
                log(`ready (${elapsedMs}ms) -> send: ${slash}`);
                sendLine(opts.session, slash);
                sent = true;
                sentAt = Date.now();
                sendAttempts = 1;
                lastChangeAt = Date.now();
            }

            // 送信の到達確認と再送（課題1: cold-start で最初の send-keys が捨てられる）
            if (sent && !accepted) {
                if (busy || resultPresent) {
                    accepted = true;
                    log(`command accepted (#${opts.issue}, attempt ${sendAttempts})`);
                } else if (shouldResend({
                    sinceSendMs: Date.now() - sentAt, attempts: sendAttempts,
                    maxAttempts: cfg.maxSendAttempts, acceptWindowMs: cfg.acceptWindowMs,
                })) {
                    sendLine(opts.session, slash);
                    sendAttempts += 1;
                    sentAt = Date.now();
                    lastChangeAt = Date.now();
                    log(`resend ${slash} (#${opts.issue}, attempt ${sendAttempts})`);
                }
            }

            // 協調的チェックポイント（EPIC #906・#911）: soft-limit 超過で 1 回だけ worker に
            // 「まとめに入れ」信号を送る。多重送信防止（softSignalSent）は shouldSignalCheckpoint
            // の責務、実際の送信とフラグの立ち上げは呼び出し側（ここ）の責務。
            if (shouldSignalCheckpoint({ elapsedMs, ready, dead, resultPresent, softSignalSent }, cfg)) {
                log(`soft-limit exceeded (${elapsedMs}ms) -> send checkpoint signal (#${opts.issue})`);
                sendLine(opts.session, CHECKPOINT_SIGNAL_MESSAGE);
                softSignalSent = true;
            }

            const action = evaluate({ resultPresent, ready, dead, elapsedMs, idleMs, restarts, promptingMs }, cfg);
            if (action.action === 'wait') continue;
            outcome = action;
        }

        log(`watchdog: ${outcome.action} (${outcome.reason})`);
        if (outcome.action === 'collect') {
            // 結果ファイルは呼び出し側が読む。セッションは後始末。
            killSession(opts.session);
            return { ok: true, action: 'collect', reason: outcome.reason };
        }
        if (outcome.action === 'hitl') {
            // 対話プロンプトで人間入力待ちになった → 質問はさせず即中断し、daemon 側で HITL にする。
            killSession(opts.session);
            return { ok: false, action: 'hitl', reason: outcome.reason };
        }
        if (outcome.action === 'fail') {
            killSession(opts.session);
            return { ok: false, action: 'fail', reason: outcome.reason };
        }
        // restart
        killSession(opts.session);
        restarts += 1;
        void sent;
    }
}

module.exports = { runPhase, launch, capture, hasSession, listSessions, killSession, sendLine, BUSY_RE, PROMPT_RE };
