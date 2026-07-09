'use strict';
/**
 * daemon.js — autopilot 常駐デーモン。
 *
 * Project をポーリングし、着手可能な item を並行上限内で拾って Claude runner に
 * ディスパッチし、結果を Project に反映する。HTTP で pause/resume/force-stop/inject/status を提供。
 *
 * 設計: Project が状態の単一の真実。スキルは結果ファイルで意図を伝え、daemon が Project を書く
 * （単一ライター）。フェーズ選択・着手判定は phases.js の純粋関数を使う。
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const { setTimeout: sleep } = require('timers/promises');
const {
    PHASE_BY_COMMAND,
    DEFAULT_BASE_BRANCH,
    parseBaseBranch,
    parseAfterIssues,
    unresolvedAfterIssues,
    selectActionable,
    isStuckCandidate,
    applyResult,
    hitlDesireFromResult,
    selectMergeCandidates,
    mergeProgressionIntents,
    selectClosedToReconcile,
    selectPrSyncCandidates,
    ownsItem,
    itemOwner,
    orderItemsLikeBoard,
    selectBoardItems,
    selectClosedCheckIssues,
    rateLimitPlan,
    PR_SYNC_STATUSES,
    humanSpokeLast,
    hasUnhandledChangesRequest,
    toMs,
    TRACKING_LABEL,
    AUTOPILOT_LABEL,
    TERMINAL_STATUSES,
    isTrackerItem,
    needsPrLinkSticky,
    renderPrLinkSticky,
    PR_LINK_MARKER,
    sanitizeForSurface,
    labelActions,
    draftAction,
    renderSticky,
    applyIntentsToItem,
    needsDodHandoff,
    hasDodHandoffComment,
    extractPreviewUrl,
    extractDodChecklist,
    dodHandoffBody,
} = require('./phases');
const { readResultFile } = require('./contract');
const { runPhase, killSession, capture } = require('./runner');
const { MONITOR_HTML } = require('./monitor');
const { loadSettings, buildClaudeCommand, snapshotRunAssets } = require('./settings');
const { readClaudeUsage } = require('./usage');
const project = require('./project');

const execFileP = promisify(execFile);

const WORKTREE_BIN = path.join(project.REPO_ROOT, 'bin', 'autopilot-worktree');

/** 既存 PR ブランチで作業するフェーズ（新ブランチを切らず PR ヘッドを checkout する） */
const PR_BRANCH_PHASES = new Set(['review', 'address-review', 'verify']);

async function ensureWorktree(issue, pr, base) {
    const args = ['create', String(issue)];
    // base が明示されていれば新ブランチをそこから分岐（EPIC サブ Issue 等）。既定は develop。
    if (base && base !== DEFAULT_BASE_BRANCH) args.push(base);
    // address-review / verify 等は既存 PR ブランチで作業する（新ブランチを切らない）
    if (pr) args.push('--pr', String(pr));
    await execFileP(WORKTREE_BIN, args, { maxBuffer: 16 * 1024 * 1024 });
    const { stdout } = await execFileP(WORKTREE_BIN, ['path', String(issue)], { encoding: 'utf8' });
    return stdout.trim();
}

// In Progress + AI 作業中のまま run が無くなってから Blocked にするまでの猶予（#816）。
// 1 回の run の最大時間（watchdog tMaxMs=30分）より長くして、生きている run を誤って
// 止めない。daemon 再起動後はこの daemon が初めて観測した時刻から測り直す（保守的）。
const DEFAULT_STUCK_MS = 35 * 60 * 1000;

// Issue 本文ディレクティブ（autopilot-base / autopilot-after）のキャッシュ TTL。
// 人間が本文を編集した変更は最大この時間で反映される。tick ごとの本文 fetch を避ける。
const DIRECTIVE_TTL_MS = 10 * 60 * 1000;

/**
 * Issue 本文から導いたディレクティブ（base / after）を TTL キャッシュ付きで返す。
 * 失敗時は空ディレクティブ（既定動作）にフォールバックし、次回また取りに行く。
 * @returns {{base: string|null, after: number[]}}
 */
async function getDirectives(cfg, state, issue, log, deps = {}) {
    const getIssueBody = deps.getIssueBody || project.getIssueBody;
    if (!state.directives) state.directives = new Map();
    const cached = state.directives.get(issue);
    const now = cfg.now();
    if (cached && now - cached.at < (cfg.directiveTtlMs || DIRECTIVE_TTL_MS)) return cached;
    let entry = { base: null, after: [], at: now };
    try {
        const body = await getIssueBody(cfg.repo, issue, deps.token || await project.readToken());
        entry = { base: parseBaseBranch(body), after: parseAfterIssues(body), at: now };
    } catch (e) {
        log(`#${issue}: directive fetch failed: ${e.message}`);
        entry.at = now - (cfg.directiveTtlMs || DIRECTIVE_TTL_MS); // 失敗は次 tick で再取得
    }
    state.directives.set(issue, entry);
    return entry;
}

/** SSO セッション名（`aws sso login --sso-session <name>`）。infra/aws-sso.env と一致 */
const SSO_SESSION = 'smalruby';

/** 認証失効時にモニタ・status へ出す再認証手順（SSO 無人運用の出口） */
const REAUTH_HINT =
    'コンテナ内で `aws sso login --sso-session smalruby --use-device-code` を実行して再認証し、' +
    '`bin/bot-token --whoami` で確認してください。回復すると autopilot は自動で再開します。';

/**
 * `aws sso login --use-device-code` の出力から認証 URL と user code を抽出する（純粋関数）。
 * AWS CLI のバージョンで文言が異なる（"open the following URL" / "Please visit ..." 等）ため、
 * URL と `XXXX-XXXX` 形式のコードをパターンで拾い、コード入力不要の完全 URL も組み立てる。
 * @param {string} text aws CLI の stdout/stderr（部分バッファでも可）
 * @returns {{url: string|null, code: string|null, completeUrl: string|null}|null} 何も拾えなければ null
 */
function parseSsoDeviceOutput(text) {
    const s = String(text || '');
    const urls = s.match(/https?:\/\/[^\s"'<>]+/g) || [];
    // device 認証 URL を優先（複数 URL が出るバージョン対策）
    const url = urls.find((u) => /device|sso|amazonaws/.test(u)) || urls[0] || null;
    let code = null;
    // 1) URL に user_code が埋まっている版（verification_uri_complete）を最優先
    for (const u of urls) {
        const m = u.match(/user_code=([A-Za-z0-9-]+)/i);
        if (m) { code = decodeURIComponent(m[1]).toUpperCase(); break; }
    }
    // 2) 独立した XXXX-XXXX 形式
    if (!code) {
        const cm = s.match(/\b([A-Za-z0-9]{4}-[A-Za-z0-9]{4})\b/);
        if (cm) code = cm[1].toUpperCase();
    }
    if (!url && !code) return null;
    let completeUrl = url;
    if (url && code && !/user_code=/i.test(url)) {
        completeUrl = url + (url.includes('?') ? '&' : '?') + 'user_code=' + encodeURIComponent(code);
    }
    return { url: url || null, code: code || null, completeUrl: completeUrl || null };
}

/**
 * SSO 再認証（device code フロー）を daemon 側で起動し、URL/コードを state.reauth に surface する。
 * ブラウザの無い devpod でも、モニタに出た URL をホストのブラウザで開いてコードを承認すれば
 * `aws sso login` が完了 → 次の checkAuthHealth（onSuccess）で auto-resume する。
 * @param {object} state daemon の state（state.reauth を書き換える）
 * @param {Function} log ロガー
 * @param {object} deps 差し替え用（spawn / onSuccess / waitMs）。テストで注入する
 * @returns {Promise<object>} URL/コードが揃うか（タイムアウト/エラー時も）現在の state.reauth
 */
function startReauth(state, log, deps = {}) {
    if (state.reauth && (state.reauth.status === 'pending' || state.reauth.status === 'starting')) {
        return Promise.resolve(state.reauth); // 二重起動しない
    }
    const spawnFn = deps.spawn || spawn;
    const onSuccess = deps.onSuccess || (() => {});
    const waitMs = deps.waitMs || 15000;
    state.reauth = { status: 'starting', url: null, code: null, completeUrl: null, startedAt: state.now ? state.now() : Date.now(), error: null };
    return new Promise((resolve) => {
        let resolved = false;
        const done = () => { if (!resolved) { resolved = true; resolve(state.reauth); } };
        let child;
        try {
            child = spawnFn('aws', ['sso', 'login', '--sso-session', SSO_SESSION, '--use-device-code'], {
                env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (e) {
            state.reauth = { status: 'error', url: null, code: null, completeUrl: null, error: sanitizeForSurface(e.message || String(e), 200) };
            return done();
        }
        let buf = '';
        const onData = (chunk) => {
            buf += chunk.toString();
            if (state.reauth && !state.reauth.url && !state.reauth.code) {
                const p = parseSsoDeviceOutput(buf);
                if (p && (p.url || p.code)) {
                    state.reauth = { ...state.reauth, status: 'pending', ...p };
                    done();
                }
            }
        };
        if (child.stdout) child.stdout.on('data', onData);
        if (child.stderr) child.stderr.on('data', onData);
        child.on('error', (e) => {
            state.reauth = { status: 'error', url: null, code: null, completeUrl: null, error: sanitizeForSurface(e.message || String(e), 200) };
            done();
        });
        child.on('exit', (codeNum) => {
            if (codeNum === 0) {
                state.reauth = null; // 成功。authError は onSuccess の checkAuthHealth が消す
                log('reauth: aws sso login succeeded');
                Promise.resolve().then(onSuccess).catch(() => {});
            } else if (state.reauth) {
                state.reauth = { ...state.reauth, status: 'error', error: `aws sso login exited ${codeNum}` };
                log(`reauth: aws sso login exited ${codeNum}`);
            }
            done();
        });
        const to = deps.setTimeout || setTimeout;
        const t = to(done, waitMs); // URL が拾えなくても pending のまま応答は返す
        if (t && t.unref) t.unref();
    });
}

/**
 * 認証ヘルスチェック（SSO 無人運用）。bot トークンの取得を試み、
 * - 失敗（SSO 失効・Secrets Manager 不達等）→ **auto-pause**（pausedBy='auth'）し、
 *   サニタイズ済みエラーと再認証手順を /status・モニタに surface する
 * - 回復（auth で pause 中に成功）→ **auto-resume**
 * 人間が明示的に pause した状態（pausedBy='human'）は上書きしない。
 * @returns {Promise<boolean>} 認証が健全なら true
 */
async function checkAuthHealth(cfg, state, log, deps = {}) {
    const getToken = deps.botToken || project.botToken;
    try {
        await getToken();
        if (state.pausedBy === 'auth') {
            state.paused = false;
            state.pausedBy = null;
            state.authError = null;
            log('auth recovered — auto-resume');
        }
        return true;
    } catch (e) {
        const msg = sanitizeForSurface(`${e.message || e}${e.stderr ? `: ${e.stderr}` : ''}`, 300);
        if (state.pausedBy === 'human') {
            // 人間の pause を尊重しつつエラーだけ記録する
            state.authError = msg;
            return false;
        }
        if (state.pausedBy !== 'auth') log(`auth failure — auto-pause: ${msg}`);
        state.paused = true;
        state.pausedBy = 'auth';
        state.authError = msg;
        return false;
    }
}

/**
 * item を Blocked にして人間へハンドオフする（Status=Blocked + 🙋 ラベル + 説明コメント）。
 * dispatch の run 失敗と tick の stuck 検知の両方から使う（#813/#816）。
 * @param {object} item Project item
 * @param {string|null} body 投稿する bot コメント本文（null ならコメントしない）
 * @param {object} cfg
 * @param {function} log
 * @param {object} [deps] テスト用に I/O を差し替え可能
 * @param {object|null} [state] daemon の可変状態。渡すと Blocked を board キャッシュにも live 反映する（#888）
 */
async function markBlocked(item, body, cfg, log, deps = {}, state = null) {
    const token = deps.token || await project.botToken();
    const findItemId = deps.findItemId || project.findItemId;
    const setField = deps.setField || project.setField;
    const postIssueComment = deps.postIssueComment || project.postIssueComment;
    const syncFaces = deps.syncFaces || ((it) => syncFacesAfterIntents(it, [], cfg, log));
    const ctx = { projectId: cfg.projectId, fields: cfg.fields };
    const itemId = item.itemId || await findItemId(cfg.owner, cfg.project, item.issue, token);
    try {
        await setField(ctx, itemId, 'Status', 'Blocked', token);
        // Blocked は人間の注意を要する最重要遷移。他の書き込み局面と同様に board キャッシュへも
        // live 反映し、refreshBoard（既定 5 分間隔）を待たず monitor の 5 秒 poll で見えるようにする（#888）。
        patchBoardCache(state, item.issue, [{ field: 'Status', value: 'Blocked' }]);
    } catch (e) { log(`#${item.issue}: mark Status failed: ${e.message}`); }
    if (body) {
        try { await postIssueComment(cfg.repo, item.issue, body, token); }
        catch (e) { log(`#${item.issue}: block comment failed: ${e.message}`); }
    }
    await syncFaces({ ...item, status: 'Blocked', hitlLabel: true });
}

/** run 失敗時の Blocked コメント本文（#816）。reason は呼び出し側でサニタイズ済みであること。 */
function failureBlockBody(skill, issue, reason) {
    return (
        `🤖 autopilot: \`${skill}\` フェーズの run が完了できなかったため **Blocked** にしました。\n\n` +
        `**理由**: ${reason}\n\n` +
        `**人間の対応**: ログ（\`/log?issue=${issue}\`）と worktree を確認し、原因を取り除いた上で ` +
        '`🙋 HITL` を外す（またはこの Issue/PR にコメントする）と autopilot が再開します' +
        '（PR があれば指摘対応、無ければ再トリアージ）。手動で Status を動かして再ルートしても、' +
        '不要なら Icebox / Close にしても構いません。'
    );
}

/**
 * signal=error 時の Blocked コメント本文。reason は呼び出し側でサニタイズ済みであること。
 * 生ログは機密を含みうるため GitHub に全文を載せず、ローカル参照へ誘導する。
 */
function errorBlockBody(skill, reason) {
    return (
        `🤖 autopilot: \`${skill}\` フェーズが回復不能なエラーを報告したため **Blocked** にしました。\n\n` +
        `**理由（サニタイズ済み要約）**: ${reason || '（ローカルログ参照）'}\n\n` +
        '詳細な生ログは機密情報を含む可能性があるため GitHub には載せていません。' +
        'ローカルの daemon ログと worktree を確認してください。\n\n' +
        '**人間の対応**: 原因を取り除いた上で `🙋 HITL` を外す（またはコメントする）と ' +
        'autopilot が再開します（PR があれば指摘対応、無ければ再トリアージ）。'
    );
}

/** stuck 検知時の Blocked コメント本文（#816） */
function stuckBlockBody(item, stuckMinutes) {
    return (
        `🤖 autopilot: Status が **In Progress** / AI Status=\`${item.aiStatus}\` のまま約 ` +
        `${stuckMinutes} 分進行が止まっていました（run が見当たりません。daemon 再起動や run の異常終了が原因）。` +
        '安全のため **Blocked** にしました。\n\n' +
        `**人間の対応**: ログ（\`/log?issue=${item.issue}\`）と worktree を確認してください。` +
        '`🙋 HITL` を外す（またはコメントする）と autopilot が再開します（PR があれば指摘対応、' +
        '無ければ再トリアージ）。再実装なら Sprint Backlog へ、続きから再開なら Review へ ' +
        'Status を動かしても構いません。'
    );
}

/**
 * In Progress + AI 作業中のまま run が無く、一定時間動かない item を検知して Blocked にする（#816）。
 * 観測した時刻を state.stuckSince に記録し、DEFAULT_STUCK_MS を超えたら markBlocked。
 * 候補でなくなった（status が進んだ等）issue は追跡から外す。
 */
async function detectStuck(items, cfg, state, log, deps = {}) {
    const now = cfg.now();
    const stuckMs = cfg.stuckMs || DEFAULT_STUCK_MS;
    if (!state.stuckSince) state.stuckSince = new Map();
    const seen = state.stuckSince;
    const live = new Set();
    for (const item of items) {
        if (!isStuckCandidate(item)) continue;
        if (state.running.has(item.issue)) continue; // この daemon が実行中の run を所有
        live.add(item.issue);
        if (!seen.has(item.issue)) { seen.set(item.issue, now); continue; }
        const elapsed = now - seen.get(item.issue);
        if (elapsed >= stuckMs) {
            const minutes = Math.round(elapsed / 60000);
            log(`#${item.issue}: stuck at In Progress/${item.aiStatus} for ${minutes}min -> Blocked`);
            seen.delete(item.issue);
            try { await markBlocked(item, stuckBlockBody(item, minutes), cfg, log, deps, state); }
            catch (e) { log(`#${item.issue}: stuck block failed: ${e.message}`); }
        }
    }
    for (const issue of [...seen.keys()]) if (!live.has(issue)) seen.delete(issue);
}

/** 実行履歴の上限（モニタ最下部の表示用。ログとしての意味のみ） */
const HISTORY_LIMIT = 100;

/** 実行履歴に 1 run を記録する（新しいものが先頭）。note はサニタイズ済み短文のみ */
function recordHistory(state, entry) {
    if (!state.history) state.history = [];
    state.history.unshift(entry);
    if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT;
}

/**
 * worker の status line（usage-statusline.sh）が書き出した usage ファイルから
 * Claude 使用率（session/weekly）を読み、state.claudeUsage に反映する（Issue #879）。
 * 取得できなければ既存値を保持する（非サブスク / 初回応答前は rate_limits が無い →
 * 無理に null 上書きしない）。
 * @param {object} state daemon の可変状態（state.claudeUsage を書き換える）
 * @param {object} cfg
 * @param {function} log
 */
function updateClaudeUsage(state, cfg, log) {
    try {
        const usage = readClaudeUsage(cfg.usageFile || usageFilePath(), { now: cfg.now });
        if (usage) {
            state.claudeUsage = usage;
            const pct = (w) => (w && w.percent != null ? `${Math.round(w.percent)}%` : '—');
            log(`claude usage: session=${pct(usage.session)} weekly=${pct(usage.weekly)}`);
        }
    } catch (e) {
        log(`claude usage read failed: ${e.message}`);
    }
}

/** 1 つの item を 1 フェーズ実行し、結果を Project に反映する */
async function dispatch(item, cfg, state, log) {
    const phase = item.phase;
    const meta = PHASE_BY_COMMAND[phase];
    if (!meta) return;
    const session = `autopilot-${phase}-${item.issue}`;
    const startedAt = cfg.now();
    state.running.set(item.issue, { phase, session, since: startedAt });
    const record = (outcome, note) => recordHistory(state, {
        issue: item.issue,
        phase,
        outcome,
        note: note ? sanitizeForSurface(note, 200) : null,
        startedAt,
        endedAt: cfg.now(),
    });
    const ctx = { projectId: cfg.projectId, fields: cfg.fields };
    // item-id の解決と PR 解決は読み取り → 個人トークン側の予算（書き込みは従来どおり Bot）
    const itemId = item.itemId || await project.findItemId(cfg.owner, cfg.project, item.issue, await project.readToken());
    item.itemId = itemId; // markBlocked が再解決しないよう保持
    const mark = async (field, value) => {
        try { await project.setField(ctx, itemId, field, value, await project.botToken()); }
        catch (e) { log(`#${item.issue}: mark ${field} failed: ${e.message}`); }
    };
    // ブロック時の人間ハンドオフ（#813/#816）: run が失敗・stall したとき、コメント無しで 🙋 だけ
    // 付くと人間が状況を把握できない（#815 の発端）。必ず説明コメントを残して Blocked にする。
    // GitHub へ出す理由は必ずサニタイズする（コマンド出力由来の機密を含みうる）。生ログはローカル。
    const blockToHuman = async (reason) => {
        try {
            await markBlocked(item, reason ? failureBlockBody(meta.skill, item.issue, sanitizeForSurface(reason)) : null, cfg, log, {}, state);
        } catch (e) {
            log(`#${item.issue}: blockToHuman failed: ${e.message}`);
        }
    };
    try {
        // 着手を即可視化（Issue を状態の正に）: In Progress + AI Status=xxxing
        await mark('Status', 'In Progress');
        await mark('AI Status', meta.aiStatus);
        // 着手も worker のローカル状態変化 → board キャッシュに live 反映（#888・GraphQL は増やさない）。
        // これで dispatch 開始が refreshBoard（既定 5 分）を待たず monitor の 5 秒 poll で見える。
        patchBoardCache(state, item.issue, [
            { field: 'Status', value: 'In Progress' },
            { field: 'AI Status', value: meta.aiStatus },
        ]);
        // PR ブランチで作業するフェーズは PR 番号を解決（inject 経由など item.pr 未設定時はここで取得）
        let pr;
        if (PR_BRANCH_PHASES.has(phase)) {
            pr = item.pr || (await project.findPrForIssue(cfg.repo, item.issue, await project.readToken()) || {}).number;
        }
        // 新ブランチを切るフェーズ（implement）は Issue 本文の base 宣言を尊重する（#827・EPIC サブ）。
        // 既定は develop。PR ブランチ作業フェーズは PR の base を継ぐので解決不要。
        let baseBranch = DEFAULT_BASE_BRANCH;
        if (!pr) {
            const declared = (await getDirectives(cfg, state, item.issue, log)).base;
            if (declared) { baseBranch = declared; log(`#${item.issue}: base branch = ${baseBranch} (declared)`); }
        }
        const cwd = await ensureWorktree(item.issue, pr, baseBranch);
        const resultDir = path.join(cwd, 'tmp');
        fs.mkdirSync(resultDir, { recursive: true });
        const resultFile = path.join(resultDir, `autopilot-result-${item.issue}.json`);
        const env = {
            AUTOPILOT_ISSUE: String(item.issue),
            AUTOPILOT_PHASE: phase,
            AUTOPILOT_RESULT_FILE: resultFile,
            AUTOPILOT_PROJECT: String(cfg.project),
            AUTOPILOT_REPO: cfg.repo,
            AUTOPILOT_BASE_BRANCH: baseBranch,
        };
        // worker 起動コマンド: env AUTOPILOT_CLAUDE_CMD が最優先（従来互換・その場合は worktree 内の
        // プロンプトを使う）。無ければ settings からフェーズ別に組み立て、スナップショットの
        // プロンプトを --add-dir で許可して使う（checkout のブランチ切り替えに非依存）。
        const envCmd = process.env.AUTOPILOT_CLAUDE_CMD;
        const command = envCmd
            || buildClaudeCommand(cfg.settings, phase, {
                extraDirs: cfg.snapshotDir ? [cfg.snapshotDir] : [],
                // Claude 使用率抽出（#879）: worker の status line にスクリプトを仕込む。
                // script は worker の worktree 内の絶対パス（動作中ブランチのものに一致）、
                // file は daemon が読む共有パス。パスを誤ると値が取れないので絶対パスで渡す。
                usageStatusline: {
                    script: path.join(cwd, 'tools', 'autopilot', 'bin', 'usage-statusline.sh'),
                    file: cfg.usageFile || usageFilePath(),
                },
            });
        const promptDir = envCmd ? undefined : cfg.promptDir;
        log(`#${item.issue}: run ${phase} (${meta.skill})`);
        const res = await runPhase({
            session, cwd, env, command, promptDir, skill: meta.skill, issue: item.issue, resultFile, log,
        });
        // worker のセッションが終わったこのタイミングで Claude 使用率を更新する（#879）。
        updateClaudeUsage(state, cfg, log);
        if (!res.ok) {
            log(`#${item.issue}: runner failed (${res.reason})`);
            record('failed', res.reason);
            await blockToHuman(`run（${meta.skill}）が失敗・停止しました（watchdog: ${res.reason}）。`);
            return;
        }
        const parsed = readResultFile(resultFile);
        if (!parsed.ok) {
            log(`#${item.issue}: invalid result (${parsed.errors.join('; ')})`);
            record('invalid-result', parsed.errors.join('; '));
            await blockToHuman(`run は終了しましたが結果ファイルが不正でした: ${parsed.errors.join('; ')}`);
            return;
        }
        const intents = applyResult(parsed.result);
        const applied = await project.applyIntents(ctx, itemId, intents, await project.botToken());
        // ローカルで把握した状態変化を board キャッシュにも反映（#888）。GraphQL は増やさない。
        // implement 完了→ AI Status=Self-Reviewing 等が refreshBoard を待たず monitor に live 反映される。
        patchBoardCache(state, item.issue, intents);
        log(`#${item.issue}: ${parsed.result.signal} — applied: ${applied.join(', ')}`);
        record(parsed.result.signal, parsed.result.summary);
        // signal=error は Blocked で surface する（churn を止める）。理由はサニタイズ済みの
        // 要約だけを GitHub に出し、生ログ（機密を含みうる）はローカル参照に誘導する。
        if (parsed.result.signal === 'error') {
            const body = errorBlockBody(meta.skill, sanitizeForSurface(parsed.result.error || parsed.result.summary || ''));
            try { await project.postIssueComment(cfg.repo, item.issue, body, await project.botToken()); }
            catch (e) { log(`#${item.issue}: error block comment failed: ${e.message}`); }
        }
        // 権威的な面同期（contract §7）: 🙋/🤖 ラベル・Draft・sticky を Project 状態 + HITL 希望へ合わせる。
        // HITL は Project フィールドではなくラベルなので、結果から導いた希望を hitlLabel として渡す（#813）。
        const wantHitl = hitlDesireFromResult(parsed.result);
        await syncFacesAfterIntents({ ...item, hitlLabel: wantHitl }, intents, cfg, log);
    } catch (e) {
        log(`#${item.issue}: error ${e.message}`);
        record('exception', e.message);
        await blockToHuman(`dispatch が例外で停止しました: ${e.message}`);
    } finally {
        state.running.delete(item.issue);
    }
}

/**
 * item が人間ゲート状態（付帯情報の収集が要る状態）か。
 * Review / DoD（レビュー・検証待ち）、Blocked（人間の対処待ち）、
 * Discussing（実装前ディスカッションの返信待ち）が該当する。
 */
function isGateItem(item) {
    if (!item) return false;
    if (item.status === 'Review' || item.status === 'DoD' || item.status === 'Blocked') return true;
    const status = item.status || 'New Item';
    return (status === 'New Item' || status === 'Backlog') && item.aiStatus === 'Discussing';
}

/**
 * 人間ゲート状態（Review / DoD / Blocked / Discussing）かつ未実行の item について、
 * HITL 解除シグナル + PR レビュー状態 + 発言アクティビティを集める。phaseForItem の ctx として
 * 渡すと、(1) ラベル解除、(2) **人間がコメントだけ出してラベルを触らない**操作、のどちらでも
 * ゲートが解除され、状態が固着しない（状態遷移ドキュメント参照）。
 * humanSpokeLast は「bot の最終発言・処理済み watermark（state.gateHandled）より後に人間が
 * 発言したか」で導く。I/O はここに閉じ込め、判定は phases.js の純粋関数。
 * @returns {object} issue 番号 → { review, hitlSignals, pr, activity, humanSpokeLast } の map
 */
async function collectGateContexts(cfg, items, running, state, log, deps = {}) {
    const contexts = {};
    // 読み取り専用の収集なので個人トークン側の予算を使う
    const token = deps.token || await project.readToken();
    const getGateContext = deps.getGateContext || project.getGateContext;
    const handled = state.gateHandled || (state.gateHandled = new Map());
    const reviewHandled = state.gateReviewHandled || (state.gateReviewHandled = new Map());
    for (const item of items) {
        if (!isGateItem(item)) continue;
        if (running.has(item.issue)) continue;
        // enroll モデル: 自分がオーナーでない item の付帯情報は集めない（API 節約 + 越権防止）
        if (!ownsItem(item, cfg.assignee)) continue;
        try {
            const ctx = await getGateContext(cfg.repo, item.issue, token);
            if (!ctx) continue;
            contexts[item.issue] = {
                ...ctx,
                humanSpokeLast: humanSpokeLast({ ...ctx.activity, handledAt: handled.get(item.issue) }),
                // 構造化シグナル（#894）: approve 後の Request changes を、コメント時刻ベースの
                // humanSpokeLast が bot sticky（lastBotAt）や handledAt に leapfrog されても
                // 確実に拾う。処理済みレビュー watermark より新しい changesRequested だけ解除。
                unhandledChangesRequested: hasUnhandledChangesRequest(
                    ctx.review, reviewHandled.get(item.issue),
                ),
            };
        } catch (e) {
            log(`#${item.issue}: gate context error ${e.message}`);
        }
    }
    return contexts;
}

/**
 * merge-progression: 連携 PR が人間に merge された leaf を Close へ前進させる。
 * autopilot は自動 merge しない（人間の手動 merge を検知して後処理するだけ）。
 * 判定は phases.js の純粋関数、GitHub 問い合わせ・Project 書き込みは project.js。
 * deps は injection できる（テスト用）。実行中の item は触らない（live phase と競合しない）。
 */
async function applyMergeProgression(items, cfg, state, log, deps = {}) {
    const token = deps.token || await project.botToken();
    // merge 済みかの問い合わせは読み取り → 個人トークン側の予算（deps.token はテスト用に両方を上書き）
    const readTok = deps.readToken || deps.token || await project.readToken();
    const hasMerged = deps.hasMergedPullRequest || project.hasMergedPullRequest;
    const applyIntents = deps.applyIntents || project.applyIntents;
    const findItemId = deps.findItemId || project.findItemId;
    const closeIssue = deps.closeIssue || project.closeIssue;
    // merge 後の面正規化（Issue の HITL ラベルを落とす等）。テストは no-op を注入できる。
    const syncFaces = deps.syncFaces || ((item, intents) => syncFacesAfterIntents(item, intents, cfg, log));
    const ctx = { projectId: cfg.projectId, fields: cfg.fields };
    for (const item of selectMergeCandidates(items)) {
        if (state.running.has(item.issue)) continue; // live phase が所有中は触らない
        let merged;
        try {
            merged = await hasMerged(cfg.repo, item.issue, readTok);
        } catch (e) {
            log(`#${item.issue}: merge check failed: ${e.message}`);
            continue;
        }
        const intents = mergeProgressionIntents(item, merged);
        if (!intents.length) continue;
        const itemId = item.itemId || await findItemId(cfg.owner, cfg.project, item.issue, token);
        try {
            const applied = await applyIntents(ctx, itemId, intents, token);
            // merge 進行の状態変化も board キャッシュに live 反映（#888・GraphQL は増やさない）
            patchBoardCache(state, item.issue, intents);
            log(`#${item.issue}: PR merged → ${applied.join(', ')}`);
            // Fix A（#843）: 非デフォルト base 宛て PR（EPIC サブ）では GitHub の `Closes #N` 自動
            // close が効かないため、Project を Close へ進めたら GitHub issue も明示的に閉じる（冪等）。
            try { await closeIssue(cfg.repo, item.issue, token); }
            catch (e) { log(`#${item.issue}: gh issue close failed: ${e.message}`); }
            // 反映済みを in-memory item にも映す → 同 tick の closed-reconcile が二重処理しない（冪等）
            item.status = 'Close';
            // merge は前進シグナル → 人間の番は解除。🙋 ラベルを両面から落とす（force 同期・#813）。
            await syncFaces({ ...item, hitlLabel: false }, intents);
        } catch (e) {
            log(`#${item.issue}: merge progression failed: ${e.message}`);
        }
    }
}

/**
 * Fix B（#843）: 「GitHub issue が closed ⇄ Project Status=Close」の整合パス。
 * merge-progression は leaf の連携 PR merge しか見ないため、(A) 非デフォルト base 宛て PR で手動 close
 * した leaf、(B) 統合 PR の `Closes #<epic>` で閉じた EPIC、(C) 人手で閉じた issue が取り残される。
 * ここは closed という事実だけを根拠に整合する（EPIC も対象）。判定は phases.js の純粋関数
 * （selectClosedToReconcile）、I/O は project.js。実行中の item は触らない。1 件の失敗は他を止めない。
 * deps は injection 可能（テスト用）。
 */
async function applyClosedReconcile(items, cfg, state, log, deps = {}) {
    const token = deps.token || await project.botToken();
    const readTok = deps.readToken || deps.token || await project.readToken();
    const listClosed = deps.listClosedIssueNumbers || project.listClosedIssueNumbers;
    const applyIntents = deps.applyIntents || project.applyIntents;
    const findItemId = deps.findItemId || project.findItemId;
    const syncFaces = deps.syncFaces || ((item, intents) => syncFacesAfterIntents(item, intents, cfg, log));
    // tick が事前計算した closedSet があれば再取得しない（after 依存判定と共用・API 節約）
    let closedSet = deps.closedSet;
    if (!closedSet) {
        try {
            closedSet = await listClosed(cfg.repo, readTok);
        } catch (e) {
            log(`closed issue list failed: ${e.message}`);
            return;
        }
    }
    const ctx = { projectId: cfg.projectId, fields: cfg.fields };
    const intents = [
        { field: 'Status', value: 'Close' },
        { field: 'AI Status', value: null },
    ];
    for (const item of selectClosedToReconcile(items, closedSet)) {
        if (state.running.has(item.issue)) continue; // live phase が所有中は触らない
        const itemId = item.itemId || await findItemId(cfg.owner, cfg.project, item.issue, token);
        try {
            const applied = await applyIntents(ctx, itemId, intents, token);
            // closed 整合の状態変化も board キャッシュに live 反映（#888・GraphQL は増やさない）
            patchBoardCache(state, item.issue, intents);
            log(`#${item.issue}: closed issue → ${applied.join(', ')}`);
            // closed は終端シグナル → 人間の番は解除。🙋 ラベルを落とす（force 同期）。
            await syncFaces({ ...item, status: 'Close', hitlLabel: false }, intents);
        } catch (e) {
            log(`#${item.issue}: closed reconcile failed: ${e.message}`);
        }
    }
}

/**
 * DoD 引き継ぎ生成（#821）: Status=DoD の leaf について、連携 PR に headful 検証手順の引き継ぎ
 * コメント（`autopilot:dod-handoff` マーカー付き）を **1 回だけ** 投稿する。コンテナ内 daemon は
 * headless で実ブラウザ確認ができないため、ホスト側 Claude（headful Playwright）に渡す文面を
 * テンプレート生成する（child Claude を起動せず純粋な I/O + 文字列テンプレートで完結）。
 *
 * - プレビュー URL は PR の CI コメントから拾う（無ければフォールバック文言）。
 * - DoD チェックリストは Issue 本文から転記する（無ければフォールバック文言）。
 * - 冪等: 既に引き継ぎコメントがあれば再投稿しない（`hasDodHandoffComment`）。
 * - 🙋 HITL はそのまま維持（ホスト/人間の番）。sticky の DoD ポインタは renderSticky が出す。
 * - 実行中（run が所有する）item は触らない。1 件の失敗は他を止めない。
 * deps は injection 可能（テスト用）。
 */
async function applyDodHandoffs(items, cfg, state, log, deps = {}) {
    const token = deps.token || await project.botToken();
    const readTok = deps.readToken || deps.token || await project.readToken();
    const findPrForIssue = deps.findPrForIssue || project.findPrForIssue;
    const listIssueComments = deps.listIssueComments || project.listIssueComments;
    const getIssueBody = deps.getIssueBody || project.getIssueBody;
    const postIssueComment = deps.postIssueComment || project.postIssueComment;
    for (const item of items) {
        if (!item || isTrackerItem(item) || item.status !== 'DoD') continue;
        if (state.running.has(item.issue)) continue; // live phase が所有中は触らない
        try {
            const pr = await findPrForIssue(cfg.repo, item.issue, readTok);
            const prComments = pr ? await listIssueComments(cfg.repo, pr.number, readTok) : [];
            const ctx = { hasHandoffComment: hasDodHandoffComment(prComments), hasPr: Boolean(pr) };
            if (!needsDodHandoff(item, ctx)) continue;
            const previewUrl = extractPreviewUrl(prComments);
            const dodChecklist = extractDodChecklist(await getIssueBody(cfg.repo, item.issue, readTok));
            const body = dodHandoffBody({
                issue: item.issue,
                pr: pr.number,
                repo: cfg.repo,
                branch: pr.branch,
                previewUrl,
                dodChecklist,
            });
            await postIssueComment(cfg.repo, pr.number, body, token);
            log(`#${item.issue}: posted DoD handoff on PR #${pr.number}`);
        } catch (e) {
            log(`#${item.issue}: DoD handoff failed: ${e.message}`);
        }
    }
}

/**
 * ラベル整合（label healing）: 非終端の Project item に管理ラベルを担保する。
 * - 全 item: `🤖 autopilot`（**広い問い合わせをこのラベル限定にする前提**。closed 状態の
 *   一括確認やフォールバックの closed 一覧はラベル付きだけを見る）
 * - Kind=EPIC: `🧭 tracking`（以後の tick はラベルだけでトラッカーと判定できる）
 * ラベルは自動では外さない（人間の手動指定を潰さない）。終端（Close/Done）は触らない。
 * ラベルは item-list に含まれるので判定に追加 API は不要、書き込みは不足時のみ（冪等）。
 * deps は injection 可能（テスト用）。実行中の item は触らない。1 件の失敗は他を止めない。
 */
async function applyLabelHealing(items, cfg, state, log, deps = {}) {
    const token = deps.token || await project.botToken();
    const editLabels = deps.editLabels || project.editLabels;
    for (const item of items) {
        if (!item || TERMINAL_STATUSES.has(item.status)) continue;
        if (state.running.has(item.issue)) continue;
        const labels = item.labels || [];
        const add = [];
        if (!labels.includes(AUTOPILOT_LABEL)) add.push(AUTOPILOT_LABEL);
        if (item.kind === 'EPIC' && !labels.includes(TRACKING_LABEL)) add.push(TRACKING_LABEL);
        if (!add.length) continue;
        try {
            await editLabels(cfg.repo, item.issue, 'issue', { add }, token);
            log(`#${item.issue}: ラベル担保 ${add.join(' ')}`);
        } catch (e) {
            log(`#${item.issue}: label healing failed: ${e.message}`);
        }
    }
}

/**
 * Issue/PR の面（🙋 HITL / 🤖 autopilot ラベル・Draft/Ready・sticky コメント）を Project 状態へ
 * 同期する（contract §7 の投影）。判定は phases.js の純粋関数、書き込みはここ（単一ライター）。
 * deps は injection 可能（テスト用）。force=true は権威的な遷移（Review への handoff 等）で、
 * Review でも HITL ラベルを明示的に付与する。
 * @param {object} item Project item（status/aiStatus/hitlLabel/size/kind を含む）
 * @param {object} io 束ねた I/O（token + project 関数群）
 * @param {object} cfg
 * @param {function} log
 * @param {object} [opts] { force }
 */
async function syncFacesForItem(item, io, cfg, log, opts = {}) {
    // 1) Issue 側のラベル。item-list が返した labels があれば再利用して読み取りを節約する
    // （古くても label 編集は差分ベース + GitHub 側で冪等なので実害なし）。inject 経由など
    // labels 未知のときだけ取得する。
    const issueLabels = Array.isArray(item.labels)
        ? item.labels
        : await io.getIssueLabels(cfg.repo, item.issue, io.readToken);
    await io.editLabels(cfg.repo, item.issue, 'issue', labelActions(item, issueLabels, opts), io.token);
    // 2) 連携 PR の面（ラベル・Draft/Ready・sticky）。読み取りは readToken、書き込みは Bot
    const pr = await io.findPrForIssue(cfg.repo, item.issue, io.readToken);
    if (!pr) return;
    const info = await io.getPrInfo(cfg.repo, pr.number, io.readToken);
    await io.editLabels(cfg.repo, pr.number, 'pr', labelActions(item, info.labels, opts), io.token);
    const da = draftAction(info.isDraft, item);
    if (da) await io.setPrDraft(cfg.repo, pr.number, da, io.token);
    await io.upsertStickyComment(cfg.repo, pr.number, renderSticky(item), io.token, { readToken: io.readToken });
    // 3) 対応 PR リンク sticky（Issue 側・base 非デフォルト時のみ）: 非デフォルト base 宛て PR は
    // GitHub の Development 欄に出ないため、Issue から PR へ辿れるリンクを 1 コメント upsert する。
    // デフォルト base 宛てでは投稿しない（Development 欄と重複する情報を増やさない）。
    if (needsPrLinkSticky(pr)) {
        await io.upsertMarkedComment(
            cfg.repo, item.issue, [PR_LINK_MARKER], renderPrLinkSticky(pr, cfg.repo), io.token,
            { readToken: io.readToken },
        );
    }
}

/** project.js 実関数を束ねた I/O オブジェクトを返す（deps 差し替えがあれば優先） */
async function projectionIo(deps = {}) {
    return {
        token: deps.token || await project.botToken(),
        readToken: deps.readToken || deps.token || await project.readToken(),
        findPrForIssue: deps.findPrForIssue || project.findPrForIssue,
        getPrInfo: deps.getPrInfo || project.getPrInfo,
        getIssueLabels: deps.getIssueLabels || project.getIssueLabels,
        editLabels: deps.editLabels || project.editLabels,
        setPrDraft: deps.setPrDraft || project.setPrDraft,
        upsertStickyComment: deps.upsertStickyComment || project.upsertStickyComment,
        upsertMarkedComment: deps.upsertMarkedComment || project.upsertMarkedComment,
    };
}

/**
 * per-tick の面投影: PR を持ちうる item の面を Project 状態へ揃える（contract §7）。
 * 実行中の item は live phase が所有するので触らない。1 件の失敗は他を止めない。
 * deps.force を渡すと全件 force 同期（通常は per-tick=非 force）。
 */
async function applyPrProjection(items, cfg, state, log, deps = {}) {
    const io = await projectionIo(deps);
    const opts = { force: Boolean(deps.force) };
    for (const item of selectPrSyncCandidates(items)) {
        if (state.running.has(item.issue)) continue; // live phase が所有中は触らない
        try {
            await syncFacesForItem(item, io, cfg, log, opts);
        } catch (e) {
            log(`#${item.issue}: pr projection failed: ${e.message}`);
        }
    }
}

/**
 * フェーズ適用後・merge 前進後の権威的な面同期（force）。結果の意図を item に反映してから
 * 投影する。PR が無ければ Issue ラベルのみ。失敗は warn に留める（Project 反映は別途済み）。
 */
async function syncFacesAfterIntents(item, intents, cfg, log) {
    try {
        const projected = applyIntentsToItem(item, intents);
        await syncFacesForItem(projected, await projectionIo(), cfg, log, { force: true });
    } catch (e) {
        log(`#${item.issue}: face sync failed: ${e.message}`);
    }
}

/**
 * 1 ポーリングサイクル。
 * @returns {{paused: boolean, picked: number[]}} このサイクルの要約
 *   - paused: pause 中で早期 return した（no-op）か
 *   - picked: このサイクルで dispatch を起動した issue 番号（並行上限内の actionable）
 */
async function tick(cfg, state, log) {
    if (state.paused) return { paused: true, picked: [] };
    // レート残量の監視（rate_limit はレート消費なし）。残量僅少なら低優先処理をスキップする
    await refreshRateLimits(cfg, state, log);
    let items;
    try {
        items = await project.listItems(cfg.owner, cfg.project, await project.readToken());
    } catch (e) {
        log(`poll error: ${e.message}`);
        return { paused: false, picked: [] };
    }
    const running = new Set(state.running.keys());
    const contexts = await collectGateContexts(cfg, items, running, state, log);
    // 候補は上限なしで Board 順に列挙し、autopilot-after の未完了依存を持つ item を
    // スキップしながら空き容量まで拾う（依存でブロックされた分は次点候補が繰り上がる）
    const candidates = selectActionable(items, {
        paused: state.paused,
        running,
        limit: Infinity,
        contexts,
        assignee: cfg.assignee,
        statusOrder: cfg.statusOrder,
    });
    // closed 状態の確認は **対象限定のバッチ GraphQL**（非終端 + 🤖 ラベルの item だけ）。
    // 旧実装のリポジトリ全体 closed 一覧（最大 1000 件 × 毎 tick）は使わない。
    const closedSet = new Set();
    const mergeStates = (states) => {
        for (const [n, s] of Object.entries(states)) if (s === 'CLOSED') closedSet.add(Number(n));
    };
    try {
        mergeStates(await project.getIssueStates(
            cfg.repo, selectClosedCheckIssues(items), await project.readToken(),
        ));
    } catch (e) {
        log(`closed state check failed: ${e.message}`);
    }
    const statusByIssue = Object.fromEntries(items.map((it) => [it.issue, it.status]));
    const capacity = Math.max(0, cfg.concurrency - state.running.size);
    const picked = [];
    for (const item of candidates) {
        // ディレクティブ取得は**検討した候補の分だけ**（capacity で打ち切り。全候補の先読みは
        // API 削減の趣旨に逆行する）。TTL キャッシュがあるので 2 tick 目以降はさらに安い。
        if (picked.length >= capacity) break;
        const after = (await getDirectives(cfg, state, item.issue, log)).after;
        // Project 外の after 依存（closedSet にも statusByIssue にも無い番号）だけ
        // オンデマンドで state を確認して closedSet にマージする（少数・稀）
        const unknown = (after || []).filter((n) => !closedSet.has(n) && !(n in statusByIssue));
        if (unknown.length) {
            try {
                mergeStates(await project.getIssueStates(cfg.repo, unknown, await project.readToken()));
            } catch (e) {
                log(`#${item.issue}: after 依存の state 確認失敗: ${e.message}`);
            }
        }
        const unresolved = unresolvedAfterIssues(after, { closedSet, statusByIssue });
        if (unresolved.length) {
            log(`#${item.issue}: autopilot-after 待ち (未完了: ${unresolved.map((n) => `#${n}`).join(', ')})`);
            continue;
        }
        picked.push(item);
    }
    for (const item of picked) {
        // ゲート item を dispatch したら「人間の発言をここまで処理した」watermark を進める。
        // 発言解除（humanSpokeLast）が同じ発言で毎 tick 再発火してループするのを防ぐ
        // （bot がコメントを返さない LGTM 分類などでも固着・空回りしない）。
        if (contexts[item.issue]) {
            if (!state.gateHandled) state.gateHandled = new Map();
            state.gateHandled.set(item.issue, cfg.now());
            // #894: 処理した changesRequested レビューの submittedAt を watermark に記録し、
            // 同じレビューで毎 tick 再発火しないようにする（新しい changesRequested で再度発火）。
            const review = contexts[item.issue].review;
            if (review && review.changesRequestedAt) {
                if (!state.gateReviewHandled) state.gateReviewHandled = new Map();
                state.gateReviewHandled.set(item.issue, toMs(review.changesRequestedAt));
            }
        }
        // fire-and-forget（running で重複防止）
        dispatch(item, cfg, state, log);
    }
    // 人間が手動 merge した leaf を Close へ前進（自動 merge はしない）+ GitHub issue も close（#843 Fix A）
    await applyMergeProgression(items, cfg, state, log);
    // GitHub で closed な issue（EPIC・人手 close 含む）の Project Status を Close へ整合（#843 Fix B）
    await applyClosedReconcile(items, cfg, state, log, { closedSet });
    // 非終端 item に 🤖 autopilot / 🧭 tracking ラベルを担保（問い合わせのラベル限定の前提）
    await applyLabelHealing(items, cfg, state, log);
    // In Progress + AI 作業中のまま止まった item を検知して Blocked へ（#816）
    await detectStuck(items, cfg, state, log);
    // Status=DoD の leaf に headful 検証の引き継ぎコメントを 1 回だけ投稿（#821・冪等）
    await applyDodHandoffs(items, cfg, state, log);
    // PR/Issue の面（ラベル/Draft/sticky）は低優先: レート残量が僅少ならこの tick はスキップ
    if (state.ratePlan && state.ratePlan.skipLowPriority) {
        log(`rate limit low (${state.ratePlan.minAt}=${state.ratePlan.minRemaining}) — PR 投影をスキップ`);
    } else {
        await applyPrProjection(items, cfg, state, log);
    }
    return { paused: false, picked: picked.map((it) => it.issue) };
}

/**
 * Bot / 個人（読み取り）両トークンの rate_limit 残量を取得し、実行計画
 * （{@link rateLimitPlan}）を state に置く。rate_limit エンドポイント自体はレート消費なし。
 * 取得失敗は前回の計画を維持する（保守的に動き続ける）。
 */
async function refreshRateLimits(cfg, state, log, deps = {}) {
    const getRateLimit = deps.getRateLimit || project.getRateLimit;
    try {
        const botTok = deps.token || await project.botToken();
        const readTok = deps.readToken || await project.readToken();
        const limits = { bot: await getRateLimit(botTok) };
        if (readTok !== botTok) limits.read = await getRateLimit(readTok);
        state.rateLimits = limits;
        const prev = state.ratePlan || {};
        state.ratePlan = rateLimitPlan(limits, cfg.rateThresholds);
        if (state.ratePlan.warn && !prev.warn) {
            log(`rate limit warning: ${state.ratePlan.minAt} remaining=${state.ratePlan.minRemaining}`);
        }
    } catch (e) {
        log(`rate limit check failed: ${e.message}`);
    }
}

// 俯瞰ボードの再取得は専用の短周期タイマーを持たない（旧: 60 秒ごと）。
// listItems は 1 回で ~100 GraphQL ポイント消費する重い問い合わせで、60 秒間隔だと
// 60 回/h × 100 = 6000 pt/h となり read トークンの GraphQL 予算 5000/h を単独で超過する
// （実測で read/graphql が数十分で枯渇 → skipLowPriority が発動しボードが stale 化していた）。
// そこで board 更新は **poll/tick の直後**（= interval ごと）と、モニタの「🔄 更新」ボタン
// （POST /refresh）による **オンデマンド** のみに限定し、見たいときだけ消費する。

/**
 * daemon がローカルで把握した intents を board キャッシュ（`state.board.items`）へ反映する（#888）。
 * worker 結果や merge 進行・closed 整合など Project を書き換えた局面で、**同じ intents** を
 * `applyIntentsToItem` で当該 issue のキャッシュ item にも適用する。これにより AI Status
 * （例 Implementing → Self-Reviewing）や Status が **refreshBoard を待たず** 次の poll（5 秒）で
 * monitor に live 反映される。**GraphQL / gh を一切呼ばない**（in-memory の更新のみ）。
 * キャッシュ未在（refreshBoard 前）や当該 issue がまだ無い場合はスキップする（次の refreshBoard で入る）。
 * @param {object} state daemon の可変状態（`state.board.items` を持ちうる）
 * @param {number} issue 対象 issue 番号
 * @param {Array<{field: string, value: string|null}>} intents applyResult 等が返した intents
 * @returns {boolean} キャッシュにパッチしたら true、スキップなら false
 */
function patchBoardCache(state, issue, intents) {
    if (!state || !state.board || !Array.isArray(state.board.items)) return false;
    if (!Array.isArray(intents) || !intents.length) return false;
    const idx = state.board.items.findIndex((it) => it && it.issue === issue);
    if (idx < 0) return false;
    // applyIntentsToItem はコピーを返す純粋関数 → 配列の参照を差し替える（元 item は破壊しない）
    state.board.items[idx] = applyIntentsToItem(state.board.items[idx], intents);
    return true;
}

/**
 * 俯瞰ボードのデータを再構築して state.board に置く（Web モニタの `GET /board` が返す）。
 * 表示対象は非終端・非 Icebox の item（selectBoardItems）を Board view の見た目順に並べ、
 * sub-issue 進捗と連携 PR 群（state/draft）をバッチ GraphQL で enrich する。
 * 非デフォルト base 宛て PR は close リンクに出ないため、PR を持ちうる Status なのに
 * PR が見つからない item は head ブランチ検索で補完する（#831 と同じ理由）。
 * 再入防止つき（前回の refresh が走っていればスキップ）。読み取り専用（Project は書かない）。
 */
async function refreshBoard(cfg, state, log, deps = {}) {
    if (state.boardRefreshing) return;
    // レート残量が僅少なら低優先のボード更新はスキップ（前回キャッシュを表示し続ける）
    if (state.ratePlan && state.ratePlan.skipLowPriority) return;
    state.boardRefreshing = true;
    try {
        // ボードは読み取り専用 → 個人トークン側の予算
        const token = deps.token || await project.readToken();
        const listItems = deps.listItems || project.listItems;
        const getBoardEnrichment = deps.getBoardEnrichment || project.getBoardEnrichment;
        const listHeadPrs = deps.listHeadPrs || project.listHeadPrs;
        const items = await listItems(cfg.owner, cfg.project, token);
        // 表示対象は daemon の処理対象と同じ enroll 判定（ownsItem）に限定する
        const boardItems = orderItemsLikeBoard(selectBoardItems(items, cfg.assignee), cfg.statusOrder);
        let enrichment = {};
        try {
            enrichment = await getBoardEnrichment(cfg.repo, boardItems.map((i) => i.issue), token);
        } catch (e) {
            log(`board enrichment failed: ${e.message}`);
        }
        const enriched = [];
        for (const it of boardItems) {
            const extra = enrichment[it.issue] || { subIssues: { total: 0, completed: 0, percent: 0 }, prs: [] };
            // close リンクに PR が出ない（非デフォルト base 宛て等）item は head ブランチで補完
            if (!extra.prs.length && PR_SYNC_STATUSES.has(it.status) && !isTrackerItem(it)) {
                try { extra.prs = await listHeadPrs(cfg.repo, it.issue, token); }
                catch (e) { log(`#${it.issue}: board head pr lookup failed: ${e.message}`); }
            }
            enriched.push({
                issue: it.issue,
                title: it.title,
                url: `https://github.com/${cfg.repo}/issues/${it.issue}`,
                status: it.status || 'New Item',
                aiStatus: it.aiStatus || null,
                hitl: Boolean(it.hitlLabel),
                kind: it.kind || null,
                size: it.size || null,
                assignees: it.assignees || [],
                tracker: isTrackerItem(it),
                owner: itemOwner(it),
                subIssues: extra.subIssues,
                prs: extra.prs,
            });
        }
        state.board = { updatedAt: cfg.now(), items: enriched };
    } catch (e) {
        log(`board refresh failed: ${e.message}`);
    } finally {
        state.boardRefreshing = false;
    }
}

/**
 * tick を1回だけ実行する（再入防止つき）。HTTP `POST /tick` と interval ループの両方から使い、
 * 手動 tick と定期 tick が重ならないようにする。実行中（state.ticking）なら tick を呼ばず busy を返す。
 * @param {object} cfg
 * @param {object} state running/paused/ticking を持つ可変状態
 * @param {function} log
 * @param {object} [deps] テスト用に tick を差し替え可能
 * @returns {Promise<object>} `{ran:false, busy:true}`（実行中）または `{ran:true, ...summary, running:number[]}`
 */
async function runTickOnce(cfg, state, log, deps = {}) {
    const tickFn = deps.tick || tick;
    if (state.ticking) return { ran: false, busy: true };
    state.ticking = true;
    try {
        const summary = await tickFn(cfg, state, log);
        return { ran: true, ...summary, running: [...state.running.keys()] };
    } finally {
        state.ticking = false;
    }
}

/**
 * `GET /board` のレスポンス（俯瞰ボード・読み取り専用）を組み立てる純粋関数。
 * items は refreshBoard のキャッシュ、running/paused/claudeUsage は live。
 * @param {object} cfg
 * @param {object} state
 * @returns {object}
 */
function boardResponse(cfg, state) {
    return {
        updatedAt: state.board ? state.board.updatedAt : null,
        paused: state.paused,
        pausedBy: state.pausedBy || (state.paused ? 'human' : null),
        authError: state.authError || null,
        reauthHint: state.authError ? REAUTH_HINT : null,
        reauth: state.reauth || null,
        assignee: cfg.assignee,
        concurrency: cfg.concurrency,
        running: [...state.running.entries()].map(([issue, v]) => ({ issue, phase: v.phase, since: v.since })),
        rate: state.ratePlan || null,
        claudeUsage: state.claudeUsage || null,
        items: state.board ? state.board.items : [],
        history: state.history || [],
    };
}

/**
 * `GET /status` のレスポンスを組み立てる純粋関数。
 * @param {object} cfg
 * @param {object} state
 * @returns {object}
 */
function statusResponse(cfg, state) {
    return {
        paused: state.paused,
        pausedBy: state.pausedBy || (state.paused ? 'human' : null),
        authError: state.authError || null,
        reauthHint: state.authError ? REAUTH_HINT : null,
        reauth: state.reauth || null,
        assignee: cfg.assignee,
        concurrency: cfg.concurrency,
        rate: state.ratePlan || null,
        rateLimits: state.rateLimits || null,
        claudeUsage: state.claudeUsage || null,
        running: [...state.running.entries()].map(([issue, v]) => ({ issue, phase: v.phase })),
    };
}

/** HTTP 制御サーバ（pause/resume/stop/inject/status） */
function startHttp(cfg, state, log) {
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const send = (code, obj) => {
            res.writeHead(code, { 'content-type': 'application/json' });
            res.end(JSON.stringify(obj));
        };
        if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end(MONITOR_HTML);
        }
        if (req.method === 'GET' && url.pathname === '/log') {
            const issue = Number(url.searchParams.get('issue'));
            const r = state.running.get(issue);
            res.writeHead(r ? 200 : 404, { 'content-type': 'text/plain; charset=utf-8' });
            return res.end(r ? capture(r.session) : `#${issue} は実行中ではありません`);
        }
        if (req.method === 'GET' && url.pathname === '/board') {
            return send(200, boardResponse(cfg, state));
        }
        if (req.method === 'GET' && url.pathname === '/status') {
            return send(200, statusResponse(cfg, state));
        }
        if (req.method === 'POST' && url.pathname === '/tick') {
            // 即時 tick: interval を待たずに 1 サイクル実行する（Web モニタの「今すぐ確認」）。
            // 再入防止つき。実行中なら 409 busy。pause 中は tick が早期 return し no-op（paused:true で返る）。
            runTickOnce(cfg, state, log)
                .then((result) => {
                    if (result.busy) return send(409, { ran: false, busy: true, error: 'tick already running' });
                    send(200, result);
                    refreshBoard(cfg, state, log); // 手動 tick 後もボードを追従（fire-and-forget）
                })
                .catch((e) => { log(`tick error: ${e.message}`); send(500, { error: e.message }); });
            return;
        }
        if (req.method === 'POST' && url.pathname === '/pause') {
            state.paused = true; state.pausedBy = 'human'; log('paused');
            return send(200, { paused: true, pausedBy: 'human' });
        }
        if (req.method === 'POST' && url.pathname === '/resume') {
            state.paused = false; state.pausedBy = null; state.authError = null; log('resumed');
            return send(200, { paused: false });
        }
        if (req.method === 'POST' && url.pathname === '/reauth') {
            // SSO 再認証を daemon 側で起動し、device code の URL/コードをモニタへ surface する。
            // 成功したら checkAuthHealth を即時に回して auto-resume を早める。
            startReauth(state, log, { onSuccess: () => checkAuthHealth(cfg, state, log) })
                .then((r) => send(200, r || { status: 'ok' }))
                .catch((e) => { log(`reauth error: ${e.message}`); send(500, { error: e.message }); });
            return;
        }
        if (req.method === 'POST' && url.pathname === '/refresh') {
            // 俯瞰ボードを即時再取得する（モニタの「🔄 更新」ボタン）。board は専用タイマーを
            // 持たず poll/tick 後にのみ更新するため、ユーザーが見たいときはここで消費する。
            // listItems は ~100 GraphQL ポイントと重いので、オンデマンドに限定して節約する。
            if (state.ratePlan && state.ratePlan.skipLowPriority) {
                // レート残量が僅少なら refreshBoard は内部で no-op になる。正直にスキップを返す。
                return send(200, { refreshed: false, skipped: 'rate-limited', minRemaining: state.ratePlan.minRemaining });
            }
            refreshBoard(cfg, state, log)
                .then(() => send(200, { refreshed: true, updatedAt: state.board ? state.board.updatedAt : null }))
                .catch((e) => { log(`refresh error: ${e.message}`); send(500, { error: e.message }); });
            return;
        }
        if (req.method === 'POST' && url.pathname === '/stop') {
            const issue = Number(url.searchParams.get('issue'));
            const r = state.running.get(issue);
            if (r) { killSession(r.session); state.running.delete(issue); log(`force-stopped #${issue}`); return send(200, { stopped: issue }); }
            return send(404, { error: 'not running', issue });
        }
        if (req.method === 'POST' && url.pathname === '/inject') {
            // 割り込み投入: 並行上限を超えてよい
            const issue = Number(url.searchParams.get('issue'));
            const phase = url.searchParams.get('phase');
            if (!issue || !PHASE_BY_COMMAND[phase]) return send(400, { error: 'issue and valid phase required' });
            if (state.running.has(issue)) return send(409, { error: 'already running', issue });
            dispatch({ issue, phase }, cfg, state, log);
            log(`injected #${issue} (${phase})`);
            return send(202, { injected: issue, phase });
        }
        if (req.method === 'POST' && url.pathname === '/shutdown') {
            // 安全停止: pkill -f は自己 kill するため使わず、この HTTP か PID ファイルで止める
            log('shutdown requested');
            send(200, { shutdown: true });
            setTimeout(() => process.exit(0), 100);
            return;
        }
        send(404, { error: 'not found' });
    });
    server.listen(cfg.port, () => log(`control server on :${cfg.port}`));
    return server;
}

/** PID ファイルのパス（停止スクリプトが参照） */
function pidFilePath() {
    return path.join(os.tmpdir(), 'autopilot-daemon.pid');
}

/**
 * Claude 使用率の受け渡しファイル（Issue #879）。worker の status line
 * （usage-statusline.sh）が rate_limits を書き出し、daemon がここから読む。
 * アカウント横断の値なので単一ファイル（どの worker が書いても最新が入ればよい）。
 * @returns {string} 絶対パス
 */
function usageFilePath() {
    return path.join(os.tmpdir(), 'autopilot-claude-usage.json');
}

/** デーモン起動 */
async function main(opts = {}) {
    const log = opts.log || ((m) => process.stderr.write(`[autopilot-daemon] ${m}\n`));
    const token = await project.botToken();
    const proj = await project.getProject(opts.owner || 'smalruby', opts.project || 4, token);
    const fields = await project.getFields(opts.owner || 'smalruby', opts.project || 4, token);
    const cfg = {
        owner: opts.owner || 'smalruby',
        project: opts.project || 4,
        repo: opts.repo || 'smalruby/smalruby3-editor',
        concurrency: opts.concurrency || 2,
        // 既定 5 分（単位は秒で CLI 指定 → ms）。実運用で 20 秒等の高頻度ポーリングは API を無駄に叩く。
        intervalMs: opts.intervalMs || 300_000,
        port: opts.port || 8787,
        projectId: proj.id,
        fields,
        // enroll モデル: 開発者個人の daemon は自分がオーナーの item だけ処理する（未設定=全件）
        assignee: opts.assignee || process.env.AUTOPILOT_ASSIGNEE || null,
        // 投入順を Board view の見た目に揃えるための Status 列順（= option 定義順）
        statusOrder: Object.keys((fields.Status && fields.Status.options) || {}),
        now: () => Date.now(),
    };
    // worker 設定（フェーズ別 model/effort・追加許可ディレクトリ）を読み込み、
    // プロンプト一式 + 解決済み設定を tmpdir へスナップショット（ブランチ切り替え非依存・C13）
    cfg.settings = loadSettings({ log });
    try {
        const snap = snapshotRunAssets({ settings: cfg.settings });
        cfg.snapshotDir = snap.dir;
        cfg.promptDir = snap.promptDir;
        log(`run assets snapshot: ${snap.dir}`);
    } catch (e) {
        log(`snapshot failed (worktree 内プロンプトへフォールバック): ${e.message}`);
        cfg.snapshotDir = null;
        cfg.promptDir = undefined;
    }
    const state = {
        paused: false, pausedBy: null, authError: null, reauth: null,
        running: new Map(), ticking: false, claudeUsage: null,
    };
    // PID ファイルを書き、安全停止（kill "$(cat <pidfile>)" / POST /shutdown）を可能にする
    try {
        fs.writeFileSync(pidFilePath(), String(process.pid));
        const cleanup = () => { try { fs.rmSync(pidFilePath(), { force: true }); } catch { /* noop */ } };
        process.on('exit', cleanup);
        process.on('SIGTERM', () => process.exit(0));
        process.on('SIGINT', () => process.exit(0));
    } catch (e) { log(`pid file warn: ${e.message}`); }
    startHttp(cfg, state, log);
    log(`daemon up: project #${cfg.project}, assignee ${cfg.assignee || '(all)'}, concurrency ${cfg.concurrency}, interval ${cfg.intervalMs}ms, pid ${process.pid} (${pidFilePath()})`);
    // 俯瞰ボードは起動時に 1 度だけ即時取得する。以降は専用タイマーを持たず、
    // 各 poll/tick の直後（下の refreshBoard）と、モニタの「🔄 更新」ボタン
    // （POST /refresh）によるオンデマンドでのみ更新する（GraphQL 予算の節約）。
    refreshBoard(cfg, state, log);
    /* eslint-disable no-constant-condition */
    while (!opts.once) {
        // 認証ヘルスチェック（失効 → auto-pause / 回復 → auto-resume）を tick の前に行う。
        // auth で pause 中も interval ごとに再試行し、人間が再認証すれば自動で再開する。
        await checkAuthHealth(cfg, state, log);
        // runTickOnce 経由にして、定期 tick と手動 POST /tick が重ならないようにする（再入防止）
        await runTickOnce(cfg, state, log);
        // tick で Project が動いた直後はボードも追従させる（fire-and-forget）
        refreshBoard(cfg, state, log);
        await sleep(cfg.intervalMs);
    }
    if (opts.once) {
        await checkAuthHealth(cfg, state, log);
        await runTickOnce(cfg, state, log);
        refreshBoard(cfg, state, log);
    }
}

module.exports = {
    main, tick, runTickOnce, dispatch, applyMergeProgression, applyClosedReconcile, applyPrProjection,
    applyDodHandoffs, detectStuck, markBlocked, getDirectives, applyLabelHealing,
    isGateItem, collectGateContexts, checkAuthHealth, REAUTH_HINT,
    parseSsoDeviceOutput, startReauth,
    refreshBoard, recordHistory, refreshRateLimits, patchBoardCache,
    updateClaudeUsage, boardResponse, statusResponse,
};
