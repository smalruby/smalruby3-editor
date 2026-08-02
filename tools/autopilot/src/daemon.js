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
    resolveBaseRef,
    baseFollowConflictBody,
    shouldPushAfterFollow,
    parseAfterIssues,
    unresolvedAfterIssues,
    parseAssigneeDirective,
    selectActionable,
    isStuckCandidate,
    selectStalledInFlightItems,
    liveWorkerIssuesFromSessions,
    applyResult,
    subIssueSetupIntents,
    hitlDesireFromResult,
    selectMergeCandidates,
    mergeProgressionIntents,
    selectClosedToReconcile,
    selectPrSyncCandidates,
    ownsItem,
    itemOwner,
    orderItemsLikeBoard,
    selectBoardItems,
    shouldReuseItemsCache,
    shouldRefreshBoardPeriodic,
    BOARD_WATCH_TTL_MS,
    BOARD_UPKEEP_MS,
    selectClosedCheckIssues,
    rateLimitPlan,
    PR_SYNC_STATUSES,
    humanSpokeLast,
    hasUnhandledChangesRequest,
    toMs,
    WAITING_LABEL,
    waitingLabelAction,
    isTrackerItem,
    needsPrLinkSticky,
    renderPrLinkSticky,
    PR_LINK_MARKER,
    needsTrackerSticky,
    renderTrackerSticky,
    TRACKER_STICKY_MARKER,
    sanitizeForSurface,
    isAuthError,
    labelActions,
    isGateItem,
    healingLabelActions,
    selectLabelHealingItems,
    selectSubIssueCountTargets,
    draftAction,
    renderSticky,
    applyIntentsToItem,
    needsDodHandoff,
    hasDodHandoffComment,
    extractPreviewUrl,
    extractDodChecklist,
    dodHandoffBody,
    AWAITING_CONTINUATION_STATUS,
    isCheckpointResult,
    continuationFilePath,
    parseContinuationFile,
    DEFAULT_MAX_CHECKPOINT_ITERATIONS,
    checkpointIterationDecision,
    CHECKPOINT_CONTINUATION_COMMENT_MARKER,
    continuationCommentBody,
} = require('./phases');
const { readResultFile } = require('./contract');
const { runPhase, killSession, capture, listSessions } = require('./runner');
const { MONITOR_HTML } = require('./monitor');
const { loadSettings, buildClaudeCommand, snapshotRunAssets } = require('./settings');
const { readClaudeUsage } = require('./usage');
const { readVersion, checkAutopilotUpdate } = require('./version');
const project = require('./project');

const execFileP = promisify(execFile);

const WORKTREE_BIN = path.join(project.REPO_ROOT, 'bin', 'autopilot-worktree');
/** checkpoint 保険commit（{@link ensureCheckpointCommit}・EPIC #906）が使う bot 名義 git */
const BOT_GIT_BIN = path.join(project.REPO_ROOT, 'bin', 'bot-git');

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

/**
 * 作業ブランチを最新の base へ自動追従（merge）させる（#950）。
 *
 * autopilot の worktree は作成時点の base から分岐するが、その後 base が前進しても自動追従しない。
 * 長時間・複数日にまたがる implement（checkpoint / Blocked 復旧などで再開が遅れる）では起点が
 * 古いままになり、PR が大量コンフリクトになる（#932）。着手/PR 化のタイミングでこの関数を挟み、
 * base を merge して stale 化を防ぐ。
 *
 * 方針:
 *  - rebase ではなく **merge**（既に push 済みの Draft PR ブランチでも force push 不要で追従できる）。
 *    merge commit は bot 名義（`bin/bot-git`）で作る（共有 config は書き換えない）。
 *  - 追従前に worktree がダーティなら触らない（`skipped-dirty`。worker 起動前提でクリーンなはず）。
 *  - base より遅れていなければ何もしない（`current`）。
 *  - コンフリクトしたら **勝手に解決せず** `git merge --abort` で元に戻し `conflict` を返す
 *    （呼び出し側が Blocked + 🙋 HITL にエスカレーションする）。
 *
 * 判断ロジック（追従 ref 解決）は phases.js の純粋関数 {@link resolveBaseRef} に寄せ、
 * ここは git I/O のみ（`.claude/rules/autopilot/development.md` のレイヤリング）。
 * @param {string} cwd 作業 worktree
 * @param {string|null} baseBranch 宣言 base（null は既定 develop）
 * @param {Function} log ロガー
 * @param {object} [deps] { execFileP, botGitBin }（テスト用の差し替え）
 * @returns {Promise<{status: 'current'|'followed'|'conflict'|'skipped-dirty', baseRef: string, behind?: number, detail?: string}>}
 */
async function followBaseBranch(cwd, baseBranch, log, deps = {}) {
    const exec = deps.execFileP || execFileP;
    const botGit = deps.botGitBin || BOT_GIT_BIN;
    const baseRef = resolveBaseRef(baseBranch);
    const baseName = baseRef.replace(/^origin\//, '');
    const opts = { cwd, maxBuffer: 16 * 1024 * 1024 };
    // ダーティな worktree では merge できない（安全側で触らない）
    const { stdout: status } = await exec('git', ['status', '--porcelain'], opts);
    if (status.trim()) {
        log(`base 追従スキップ: worktree に未コミット変更あり（${baseRef}）`);
        return { status: 'skipped-dirty', baseRef };
    }
    // 最新 origin を取得（失敗しても致命ではない: 手前の worktree 作成で develop は fetch 済み）
    await exec('git', ['fetch', 'origin', baseName], opts).catch(() => {});
    const { stdout: behindOut } = await exec('git', ['rev-list', '--count', `HEAD..${baseRef}`], opts);
    const behind = Number(String(behindOut).trim()) || 0;
    if (behind === 0) return { status: 'current', baseRef, behind: 0 };
    try {
        await exec(botGit, ['merge', '--no-edit', baseRef], opts);
        log(`base 追従: ${baseRef} を merge（${behind} commits 先行していた base に追従）`);
        return { status: 'followed', baseRef, behind };
    } catch (e) {
        // コンフリクト等 → 勝手に解決せず元に戻す
        await exec('git', ['merge', '--abort'], opts).catch(() => {});
        const detail = e.stderr || e.stdout || e.message || '';
        return { status: 'conflict', baseRef, behind, detail: String(detail) };
    }
}

// In Progress + AI 作業中のまま run が無くなってから Blocked にするまでの猶予（#816）。
// 1 回の run の最大時間（watchdog tMaxMs=30分）より長くして、生きている run を誤って
// 止めない。daemon 再起動後はこの daemon が初めて観測した時刻から測り直す（保守的）。
const DEFAULT_STUCK_MS = 35 * 60 * 1000;

// 終了コード規約（#953）。外部 supervisor（tools/autopilot/bin/autopilot-supervise）は
// この規約で「再起動するか停止のままにするか」を決める:
//   EXIT_OK   (0)  = 意図的な停止（POST /shutdown・SIGTERM・SIGINT）→ supervisor は再起動しない
//   EXIT_CRASH(1)  = 未知の非認証エラーによるクラッシュ → supervisor が再起動する
// 認証エラーは exit せずプロセス内 auto-pause（pausedBy='auth'・#949）で耐えるので、この規約の外。
const EXIT_OK = 0;
const EXIT_CRASH = 1;

// Issue 本文ディレクティブ（autopilot-base / autopilot-after）のキャッシュ TTL。
// 人間が本文を編集した変更は最大この時間で反映される。tick ごとの本文 fetch を避ける。
const DIRECTIVE_TTL_MS = 10 * 60 * 1000;

// `tools/autopilot/` 更新検知の間隔（#885）。git fetch は月に見合う頻度でよく、5 分より短くしない。
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Issue 本文から導いたディレクティブ（base / after / assignee）を TTL キャッシュ付きで返す。
 * 失敗時は空ディレクティブ（既定動作）にフォールバックし、次回また取りに行く。
 * @returns {{base: string|null, after: number[], assignee: string|null}}
 */
async function getDirectives(cfg, state, issue, log, deps = {}) {
    const getIssueBody = deps.getIssueBody || project.getIssueBody;
    if (!state.directives) state.directives = new Map();
    const cached = state.directives.get(issue);
    const now = cfg.now();
    if (cached && now - cached.at < (cfg.directiveTtlMs || DIRECTIVE_TTL_MS)) return cached;
    let entry = { base: null, after: [], assignee: null, at: now };
    try {
        const body = await getIssueBody(cfg.repo, issue, deps.token || await project.readToken());
        entry = {
            base: parseBaseBranch(body), after: parseAfterIssues(body),
            assignee: parseAssigneeDirective(body), at: now,
        };
    } catch (e) {
        log(`#${issue}: directive fetch failed: ${e.message}`);
        entry.at = now - (cfg.directiveTtlMs || DIRECTIVE_TTL_MS); // 失敗は次 tick で再取得
    }
    state.directives.set(issue, entry);
    return entry;
}

/**
 * assignees が 2 人以上の item だけ、本文の `autopilot-assignee:` ディレクティブを解決して
 * `item.assigneeDirective` を補う（#938）。0/1 人の item はディレクティブが無意味なので
 * 本文 fetch をスキップする（`.claude/rules/autopilot/github-api.md` の API 予算規約）。
 * 取得は {@link getDirectives} の TTL キャッシュを共用するため、後続の base/after 解決
 * （同じ tick 内の候補選別）と合わせて追加の GraphQL/REST は増えない。
 * dispatch（{@link tick}）と board（{@link refreshBoard}）の両方で、
 * `selectActionable`/`selectBoardItems`（= `itemOwner`/`ownsItem`/`isAssignee` を使う箇所）の
 * **前**に呼ぶ必要がある。
 * @param {object[]} items
 * @param {object} cfg
 * @param {object} state
 * @param {Function} log
 * @param {object} [deps] getDirectives へそのまま渡す（テスト用の差し替え）
 * @returns {Promise<object[]>} assigneeDirective を補った新しい配列（元の item は変更しない）
 */
async function populateAssigneeDirectives(items, cfg, state, log, deps = {}) {
    const out = [];
    for (const item of items || []) {
        if (!item || (item.assignees || []).length < 2) { out.push(item); continue; }
        const { assignee } = await getDirectives(cfg, state, item.issue, log, deps);
        out.push({ ...item, assigneeDirective: assignee });
    }
    return out;
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
        recordAuthFailure(state, e, log);
        return false;
    }
}

/**
 * 認証失敗を state に記録し **auto-pause（pausedBy='auth'）** へ落とす（#949）。
 * checkAuthHealth の onError 経路と、tick 途中・非同期経路（safety net）で捕捉した
 * 認証系エラーの合流点。人間が明示 pause 中（pausedBy='human'）はエラー記録のみで
 * pause の主体を上書きしない（`pausedBy` の区別を保つ不変条件）。
 * @param {object} state daemon の可変状態
 * @param {Error|string} err 認証系エラー
 * @param {function} log
 * @returns {string} surface 用にサニタイズ済みのメッセージ
 */
function recordAuthFailure(state, err, log) {
    const msg = sanitizeForSurface(
        `${(err && err.message) || err}${err && err.stderr ? `: ${err.stderr}` : ''}`,
        300,
    );
    if (state.pausedBy === 'human') {
        // 人間の pause を尊重しつつエラーだけ記録する
        state.authError = msg;
        return msg;
    }
    if (state.pausedBy !== 'auth') log(`auth failure — auto-pause: ${msg}`);
    state.paused = true;
    state.pausedBy = 'auth';
    state.authError = msg;
    return msg;
}

/**
 * プロセスレベルの安全網（#949 → #953 で方針転換）。tick の各 apply ステップ・PR 投影・
 * face sync 等は fire-and-forget で呼ばれる箇所があり、その非同期経路で reject/throw が
 * 未捕捉のままプロセスに届きうる。
 *
 * - **認証系エラー**: 従来どおりプロセス内で auto-pause（pausedBy='auth'・#949）。SSO 瞬断は
 *   これで耐える。**終了しない**。
 * - **未知の非認証エラー**: Node 公式ドキュメントでは `uncaughtException` 後のプロセスは
 *   「未定義の状態」であり継続は非推奨（データ不整合・ゾンビ状態を招く）。よって
 *   サニタイズして log に残したうえで **`process.exit(EXIT_CRASH)`** し、外部 supervisor
 *   （`autopilot-supervise`）に再起動を委ねる（#953）。「log して継続」分岐は廃止した。
 * @param {object} state daemon の可変状態
 * @param {Error|string} err
 * @param {function} log
 * @param {string} [kind] ログ用のイベント種別（'unhandledRejection' 等）
 * @param {object} [proc] exit を呼ぶ process（テスト用に差し替え可能）
 */
function handleProcessError(state, err, log, kind = 'error', proc = process) {
    if (isAuthError(err)) {
        recordAuthFailure(state, err, log);
        return;
    }
    // 未知の非認証エラーは Node 準拠でクラッシュ扱い。supervisor が再起動する。
    log(`${kind}（プロセス終了 exit ${EXIT_CRASH} — supervisor が再起動）: ${sanitizeForSurface(`${(err && err.message) || err}`, 300)}`);
    proc.exit(EXIT_CRASH);
}

/**
 * {@link handleProcessError} を process のグローバルハンドラとして 1 度だけ張る（#949/#953）。
 * @param {object} state
 * @param {function} log
 * @param {object} [proc] テスト用に process を差し替え可能
 */
function installProcessSafetyNet(state, log, proc = process) {
    proc.on('unhandledRejection', (reason) => handleProcessError(state, reason, log, 'unhandledRejection', proc));
    proc.on('uncaughtException', (err) => handleProcessError(state, err, log, 'uncaughtException', proc));
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
 * 連続 checkpoint が反復上限を超えたときの Blocked コメント本文（協調的チェックポイント・
 * EPIC #906・#912）。無限ループ防止のための daemon 側エスカレーションであり、worker 自身が
 * エラーを報告したわけではないことを明示する（errorBlockBody とは文言を分ける）。
 */
function checkpointEscalationBody(item, iteration, maxIterations) {
    return (
        `🤖 autopilot: 連続チェックポイントが ${iteration} 回に達し、反復上限（${maxIterations} 回）を` +
        '超えました。無限ループ防止のため **Blocked** にしました（worker 自身がエラーを報告した' +
        'わけではありません）。\n\n' +
        `**人間の対応**: このスレッドの \`autopilot-continuation\` コメント（残タスク・次の一手）を` +
        '確認し、実装方針の見直しや粒度の分割を検討してください。' +
        `ログ（\`/log?issue=${item.issue}\`）と worktree も参考にできます。` +
        '`🙋 HITL` を外す（またはコメントする）と autopilot が再開します' +
        '（PR があれば指摘対応、無ければ再トリアージ）。'
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

/**
 * In Progress + 実作業系 AI Status のまま worker が不在（stalled）の item を対応フェーズへ
 * 再ディスパッチする（#995）。#953 の「起動時だけの孤児復帰」を**定常 tick でも**適用する
 * 拡張で、既に fetch 済みの `items` を受け取る core 関数（poll は呼び出し側が済ませる）。
 *
 * 背景（#972）: address-review worker が tMax 超過で失敗 → daemon が Blocked にしようとした
 * `gh project item-edit` がちょうど SSO 失効で失敗 → item が Status=In Progress /
 * AI Status=Addressing Comments / 🙋 HITL のまま残り、`phaseForItem` が null（出口なし）を
 * 返して完全にストールした。実作業系 AI Status は dispatch のみが設定するので、worker が居ない
 * なら「人間の番」ではなく異常終了の残渣であり、HITL の有無を問わず自動再開してよい。
 *
 * 生存判定は **in-memory running ∪ tmux list-sessions** のユニオン: crash → 外部 supervisor に
 * よる再起動では in-memory running を失う一方、tmux の worker セッションは生き残りうる。逆に
 * 定常運転中は in-memory running が最新なので、両方を見て「本当に worker が居ない」ものだけ拾う。
 * 生存中 worker を持つ item・この daemon が所有中の item は触らない（走行中の run を完走させる）。
 *
 * **並行上限を尊重する（#995）**: この関数は tick 冒頭で**毎 tick**走るため、Self-Reviewing の
 * happy-path（implement 完了直後・次 tick で worker 不在）も対象に入る。無制限に再ディスパッチ
 * すると `selectActionable` が守る `cfg.concurrency` を跨いで worker を起こしてしまう。空き容量
 * （`cfg.concurrency - state.running.size`）の分だけ再開し、溢れた分は次 tick に委ねる（capacity が
 * 空けば `selectStalledInFlightItems` が再度拾う）。recovery が tick 冒頭で running を埋めるので、
 * この後の `selectActionable` は残り容量だけを使い、二重ディスパッチや過剰起動が起きない。
 * @param {object[]} items fetch 済みの Project item 一覧（tick が渡す）
 * @param {object} cfg
 * @param {object} state daemon の可変状態
 * @param {function} log
 * @param {object} [deps] { listSessions, dispatch }（テスト用）
 * @returns {Promise<{issue:number, phase:string}[]>} 再ディスパッチした item
 */
async function recoverStalledInFlightWorkers(items, cfg, state, log, deps = {}) {
    const listSess = deps.listSessions || listSessions;
    const dispatchFn = deps.dispatch || dispatch;
    const concurrency = cfg.concurrency || Infinity;
    const live = new Set([
        ...state.running.keys(),
        ...liveWorkerIssuesFromSessions(listSess()),
    ]);
    const stalled = selectStalledInFlightItems(items, live);
    const byIssue = new Map(items.map((it) => [it.issue, it]));
    const recovered = [];
    for (const s of stalled) {
        // 空き容量が尽きたら停止（残りは次 tick で拾う）。dispatch は running を同期 set するので
        // running.size はこのループ内で増える = 実際の起動数を数えて上限を守れる。
        if (state.running.size >= concurrency) break;
        const item = byIssue.get(s.issue);
        if (!ownsItem(item, cfg.assignee)) continue; // 自分がオーナーの item だけ復帰させる
        if (state.running.has(s.issue)) continue; // 既にこの daemon が所有中なら触らない
        log(`#${s.issue}: stalled in-flight worker（${s.phase} / worker 不在）→ 再ディスパッチ`);
        dispatchFn({ ...item, phase: s.phase }, cfg, state, log);
        recovered.push(s);
    }
    if (recovered.length) log(`stalled recovery: ${recovered.length} 件を再ディスパッチ`);
    return recovered;
}

/**
 * 起動時の孤児 worker 自動復帰（#953）。crash → 外部 supervisor による再起動では in-memory の
 * `state.running` を失う一方、tmux の worker セッションは別プロセスなので生き残りうる。
 * この関数は起動時に 1 度だけ呼ばれ、items を fetch してから
 * {@link recoverStalledInFlightWorkers}（定常 tick と共通の core）に委譲する。
 * @param {object} cfg
 * @param {object} state daemon の可変状態
 * @param {function} log
 * @param {object} [deps] { listSessions, listItems, readToken, dispatch }（テスト用）
 * @returns {Promise<{issue:number, phase:string}[]>} 再ディスパッチした孤児
 */
async function recoverOrphanedWorkers(cfg, state, log, deps = {}) {
    const listItemsFn = deps.listItems || project.listItems;
    const readToken = deps.readToken || project.readToken;
    let items;
    try {
        items = await listItemsFn(cfg.owner, cfg.project, await readToken());
    } catch (e) {
        log(`orphan recovery: poll 失敗（スキップ）: ${e.message}`);
        return [];
    }
    return recoverStalledInFlightWorkers(items, cfg, state, log, deps);
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
 *
 * usage ファイルはローカルの小さな JSON（GraphQL/API 予算を消費しない）ので、毎 tick /
 * GET /board / POST /refresh から高頻度に呼んでよい（#1027）。ログは値が変わったときだけ
 * 出す（毎 tick 読取でのログ肥大を防ぐ）。updatedAt はファイル mtime 由来（readClaudeUsage）。
 * @param {object} state daemon の可変状態（state.claudeUsage を書き換える）
 * @param {object} cfg
 * @param {function} log
 */
function updateClaudeUsage(state, cfg, log) {
    try {
        const usage = readClaudeUsage(cfg.usageFile || usageFilePath(), { now: cfg.now, statSync: cfg.statSync });
        if (usage) {
            const prev = state.claudeUsage;
            state.claudeUsage = usage;
            const pct = (w) => (w && w.percent != null ? `${Math.round(w.percent)}%` : '—');
            const changed = !prev
                || pct(prev.session) !== pct(usage.session)
                || pct(prev.weekly) !== pct(usage.weekly);
            if (changed) log(`claude usage: session=${pct(usage.session)} weekly=${pct(usage.weekly)}`);
        }
    } catch (e) {
        log(`claude usage read failed: ${e.message}`);
    }
}

/**
 * `tools/autopilot/` に origin 側の新コミットがあるかを判定し、state.autopilotUpdate に反映する（#885）。
 * 稼働中コード = 起動時コミット（state.version.commit）を基準に判定する。失敗（ネットワーク/認証）
 * 時は前回値（available/behind/commits）を保持し、error だけを控えめに surface する（表示は崩さない）。
 * @param {object} cfg
 * @param {object} state daemon の可変状態（state.autopilotUpdate を書き換える）
 * @param {function} log
 * @param {object} [deps] { check }（テスト用）
 */
async function checkForUpdate(cfg, state, log, deps = {}) {
    const check = deps.check || checkAutopilotUpdate;
    const bootCommit = state.version && state.version.commit;
    const res = await check({
        repoRoot: cfg.repoRoot,
        baseBranch: cfg.updateBranch || DEFAULT_BASE_BRANCH,
        bootCommit,
        now: cfg.now,
    });
    const prev = state.autopilotUpdate || {};
    if (res.error) {
        // 失敗は前回の available/behind/commits を保持し、error と checkedAt だけ更新する
        state.autopilotUpdate = {
            available: Boolean(prev.available),
            behind: prev.behind || 0,
            commits: prev.commits || [],
            checkedAt: res.checkedAt,
            error: sanitizeForSurface(res.error, 200),
        };
        return;
    }
    state.autopilotUpdate = res;
    if (res.available && !prev.available) {
        log(`autopilot update available: tools/autopilot は origin/${cfg.updateBranch || DEFAULT_BASE_BRANCH} で ${res.behind} 件先行`);
    }
}

/**
 * 起動直後に 1 回 + 以降 UPDATE_CHECK_INTERVAL_MS 間隔で更新検知を回す（#885）。
 * タイマーは unref して daemon の終了を妨げない。deps はテスト用に差し替え可能。
 * @returns {Promise<object|undefined>} 生成したタイマー（テスト用）
 */
async function startUpdateChecks(cfg, state, log, deps = {}) {
    await checkForUpdate(cfg, state, log, deps).catch((e) => log(`update check error: ${e.message}`));
    const interval = cfg.updateCheckMs || UPDATE_CHECK_INTERVAL_MS;
    const setIntervalFn = deps.setInterval || setInterval;
    const t = setIntervalFn(() => {
        checkForUpdate(cfg, state, log, deps).catch((e) => log(`update check error: ${e.message}`));
    }, interval);
    if (t && t.unref) t.unref();
    return t;
}

// ---- 協調的チェックポイント（EPIC #906・実装コンポーネント D・#912）: worker が soft-limit で
// 安全に中断した checkpoint 結果の後処理。「本人以外の書き込み」を防ぐため単一ライター（daemon）
// がここで (1) 保険commit (2) continuation ファイルの内容を Issue へ提示 (3) 反復上限の
// エスカレーション を行う。AI Status=Awaiting Continuation + 🙋 HITL 自体は既存の signal=hitl
// 汎用パス（applyResult/hitlDesireFromResult/syncFacesAfterIntents・dispatch 側で実行済み）が
// そのまま処理するので、ここでは file I/O とエスカレーション判定だけを担う。 ----

/**
 * checkpoint 結果を受けたとき、worker が commit し忘れた WIP が worktree に残っていれば保険で
 * commit する（#911 の契約上 worker が既に commit している前提だが、バグ対策の保険）。
 * @param {string} cwd この run のワークツリー
 * @param {number} issue
 * @param {function} log
 * @param {object} [deps] { execFileP }（テスト用）
 * @returns {Promise<boolean>} commit した場合 true（クリーンなら false）
 */
async function ensureCheckpointCommit(cwd, issue, log, deps = {}) {
    const exec = deps.execFileP || execFileP;
    const { stdout } = await exec('git', ['status', '--porcelain'], { cwd, maxBuffer: 16 * 1024 * 1024 });
    if (!stdout.trim()) return false;
    log(`#${issue}: checkpoint — 未コミットの WIP を検出、保険commit します`);
    await exec(BOT_GIT_BIN, ['add', '-A'], { cwd });
    await exec(BOT_GIT_BIN, ['commit', '-m', `chore(autopilot): checkpoint 時の未コミット差分を保険commit (#${issue})`], { cwd });
    return true;
}

/**
 * continuation ファイル（{@link continuationFilePath}）をワークツリーから読み、解析する。
 * ファイルが無ければ null（呼び出し側は implement へのフォールバック等で扱う）。
 * @param {string} cwd
 * @param {number} issue
 * @param {object} [deps] { existsSync, readFileSync }（テスト用）
 * @returns {ReturnType<typeof parseContinuationFile>|null}
 */
function readContinuationFromWorktree(cwd, issue, deps = {}) {
    const exists = deps.existsSync || fs.existsSync;
    const readFile = deps.readFileSync || fs.readFileSync;
    const file = path.join(cwd, continuationFilePath(issue));
    if (!exists(file)) return null;
    return parseContinuationFile(readFile(file, 'utf8'));
}

/**
 * checkpoint 結果の後処理（#912）。dispatch が signal=hitl の汎用処理（AI Status/HITL 反映）を
 * 済ませた**後**に呼ぶこと — 反復上限超過時の Blocked 上書きが確実に最後の書き込みになる。
 * 1. 保険commit（{@link ensureCheckpointCommit}）
 * 2. continuation ファイルの内容を `autopilot-continuation-comment` マーカー付きコメントで
 *    Issue へ upsert（差分時のみ書き込み・{@link continuationCommentBody}）
 * 3. 連続 checkpoint 回数（continuation ファイルの `iteration`）が反復上限を超えたら
 *    {@link markBlocked} で Blocked にエスカレーション（無限ループ防止）
 * @param {object} item Project item（itemId 設定済み）
 * @param {string} cwd この run のワークツリー
 * @param {object} result 検証済み checkpoint 結果（isCheckpointResult(result) === true）
 * @param {object} cfg
 * @param {object} state
 * @param {function} log
 * @param {object} [deps] I/O 差し替え（テスト用）
 */
async function applyCheckpointHandling(item, cwd, result, cfg, state, log, deps = {}) {
    try {
        await ensureCheckpointCommit(cwd, item.issue, log, deps);
    } catch (e) {
        log(`#${item.issue}: checkpoint 保険commit failed: ${e.message}`);
    }

    let parsedContinuation = null;
    try {
        parsedContinuation = readContinuationFromWorktree(cwd, item.issue, deps);
    } catch (e) {
        log(`#${item.issue}: continuation file read failed: ${e.message}`);
    }

    if (parsedContinuation) {
        const upsertMarkedComment = deps.upsertMarkedComment || project.upsertMarkedComment;
        const token = deps.token || await project.botToken();
        const readTok = deps.readToken || deps.token || await project.readToken();
        try {
            await upsertMarkedComment(
                cfg.repo, item.issue, [CHECKPOINT_CONTINUATION_COMMENT_MARKER],
                continuationCommentBody(parsedContinuation), token, { readToken: readTok },
            );
        } catch (e) {
            log(`#${item.issue}: continuation comment failed: ${e.message}`);
        }
    } else {
        log(`#${item.issue}: continuation file が見つからないため implement へフォールバックします`);
    }

    const iteration = (parsedContinuation && parsedContinuation.iteration) || 1;
    const maxIterations = cfg.maxCheckpointIterations || DEFAULT_MAX_CHECKPOINT_ITERATIONS;
    const decision = checkpointIterationDecision(iteration, maxIterations);
    if (decision.action === 'escalate') {
        log(`#${item.issue}: ${decision.reason} -> Blocked`);
        const markBlockedFn = deps.markBlocked || markBlocked;
        await markBlockedFn(item, checkpointEscalationBody(item, iteration, maxIterations), cfg, log, deps, state);
    }
}

/**
 * Awaiting Continuation 状態の item について、continuation ファイル（worktree 内）から
 * 元フェーズ・反復回数を読み、`phaseForItem` が正しいフェーズへ再開できるよう ctx.continuation
 * として返す（#912）。GitHub API は使わず worktree のローカルファイルシステムのみを読む。
 * worktree/ファイルが無い item は結果に含まれない（phaseForItem は implement にフォールバック）。
 * @param {object[]} items
 * @param {Set<number>} running 実行中の issue（触らない）
 * @param {function} log
 * @param {object} [deps] { execFileP, existsSync, readFileSync }（テスト用）
 * @returns {Promise<object>} issue -> { continuation }
 */
async function collectContinuationContexts(items, running, log, deps = {}) {
    const contexts = {};
    const exec = deps.execFileP || execFileP;
    for (const item of items || []) {
        if (item.status !== 'In Progress' || item.aiStatus !== AWAITING_CONTINUATION_STATUS) continue;
        if (running.has(item.issue)) continue;
        try {
            const { stdout } = await exec(WORKTREE_BIN, ['path', String(item.issue)], { encoding: 'utf8' });
            const cwd = stdout.trim();
            const continuation = readContinuationFromWorktree(cwd, item.issue, deps);
            if (continuation) contexts[item.issue] = { continuation };
        } catch (e) {
            log(`#${item.issue}: continuation context read failed: ${e.message}`);
        }
    }
    return contexts;
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
        // base 宣言（Issue 本文の `autopilot-base:`）を implement / PR フェーズの**両方**で解決する。
        // PR は implement が同じ base で作成しているため、宣言 base は PR の base と一致する（#953）。
        // 既定は develop。getDirectives は TTL キャッシュ付きなので毎 tick の本文 fetch にはならない。
        let baseBranch = DEFAULT_BASE_BRANCH;
        const declared = (await getDirectives(cfg, state, item.issue, log)).base;
        if (declared) { baseBranch = declared; log(`#${item.issue}: base branch = ${baseBranch} (declared)`); }
        const cwd = await ensureWorktree(item.issue, pr, baseBranch);
        // base 追従（#950/#953）: 新ブランチ作業フェーズ（implement・pr なし）も PR ブランチ作業フェーズ
        // （review / address-review・pr あり）も、着手時に作業ブランチを最新 base へ merge して stale
        // 起点の衝突を防ぐ。PR の base を継ぐこと（ref の一致）とブランチが base に追従済みであることは
        // 別物で、PR 化後に develop が進むと PR が CONFLICTING になり自動復旧できなくなる（#953/#954）。
        // clean に追従できた場合、PR フェーズでは worker が push しないことがあるため、この merge を
        // push してリモートの PR を mergeable に保つ（implement は後で worker が自分の commit ごと push
        // するので push 不要）。コンフリクトは自動解決せず Blocked + 🙋 HITL にエスカレーションする（両者共通）。
        {
            const follow = await followBaseBranch(cwd, baseBranch, (m) => log(`#${item.issue}: ${m}`));
            if (follow.status === 'conflict') {
                log(`#${item.issue}: base 追従でコンフリクト（${follow.baseRef}）→ Blocked`);
                record('base-follow-conflict', `${follow.baseRef}: ${follow.detail || ''}`);
                await markBlocked(
                    item,
                    baseFollowConflictBody(meta.skill, item.issue, follow.baseRef, sanitizeForSurface(follow.detail || '')),
                    cfg, log, {}, state,
                );
                return;
            }
            if (shouldPushAfterFollow(pr, follow.status)) {
                try {
                    await execFileP(BOT_GIT_BIN, ['push', 'origin', 'HEAD'], { cwd, maxBuffer: 16 * 1024 * 1024 });
                    log(`#${item.issue}: base 追従の merge を push（PR #${pr} を mergeable に保つ）`);
                } catch (e) {
                    // push 失敗は致命ではない（ローカル merge は健全）。次 dispatch で再試行される。
                    log(`#${item.issue}: base 追従 merge の push 失敗（継続）: ${sanitizeForSurface(e.message || '')}`);
                }
            }
        }
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
            if (res.action === 'hitl') {
                // 対話プロンプト（要人間判断）で worker が停止しかけた → 質問させず打ち切って HITL。
                // auto mode でも soft_deny 等で稀にプロンプトが出うるが、worker は非対話運用なので
                // 待たせずここで人間に渡す（restart もしない＝同じプロンプトの再発を避ける）。
                log(`#${item.issue}: interactive prompt -> HITL (${res.reason})`);
                record('hitl', 'interactive prompt -> HITL');
                await blockToHuman(`worker が対話プロンプト（要人間判断）で停止しかけたため中断し HITL にしました（${res.reason}）。auto mode でも判断を要する操作が出た可能性があります。ログ（\`/log?issue=${item.issue}\`）を確認し、対応のうえ 🙋 を外してください。`);
                return;
            }
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
        // decompose 完了で作成された sub-issue に Status/Kind/Size を補完（単一ライター・#914）。
        if (phase === 'decompose' && parsed.result.signal === 'done') {
            await applyDecomposeSubIssueSetup(parsed.result, cfg, log);
        }
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
        // 協調的チェックポイント（EPIC #906）: 保険commit・continuation コメント・反復上限
        // エスカレーションは上の汎用処理（AI Status=Awaiting Continuation + HITL）の**後**に行う。
        // escalate 時の markBlocked（Status=Blocked への上書き）が確実に最後の書き込みになる。
        if (isCheckpointResult(parsed.result)) {
            await applyCheckpointHandling(item, cwd, parsed.result, cfg, state, log);
        }
    } catch (e) {
        log(`#${item.issue}: error ${e.message}`);
        record('exception', e.message);
        await blockToHuman(`dispatch が例外で停止しました: ${e.message}`);
    } finally {
        state.running.delete(item.issue);
    }
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
/**
 * autopilot-after ゲートで待たされている candidate に ⏳ waiting ラベルを担保する（純粋部は
 * {@link waitingLabelAction}）。依存が解決したら外す。GitHub Projects の view で「他 Issue 待ち」
 * を一目で判別できるようにするのが目的。
 *
 * `waitingByIssue` は dispatch ループで evaluate 済みの candidate だけを含む（true=依存未完了）。
 * candidate は実行中/終端を含まない（selectActionable が除外）。書き込みは差分があるときだけ
 * （冪等・API 節約）。token 取得も付け外しが 1 件でもある時だけ行う。
 * @param {object[]} candidates selectActionable の結果
 * @param {Map<number,boolean>} waitingByIssue issue → 依存未完了か
 * @param {object} cfg
 * @param {Function} log
 * @param {object} [deps] { token, editLabels }（テスト用注入）
 */
async function applyAfterWaitLabels(candidates, waitingByIssue, cfg, log, deps = {}) {
    const editLabels = deps.editLabels || project.editLabels;
    const todo = [];
    for (const item of candidates || []) {
        if (!waitingByIssue.has(item.issue)) continue;
        const has = (item.labels || []).includes(WAITING_LABEL);
        const act = waitingLabelAction(has, waitingByIssue.get(item.issue));
        if (act) todo.push({ issue: item.issue, act });
    }
    if (!todo.length) return;
    const token = deps.token || await project.botToken();
    for (const { issue, act } of todo) {
        const change = act === 'add' ? { add: [WAITING_LABEL] } : { remove: [WAITING_LABEL] };
        try {
            await editLabels(cfg.repo, issue, 'issue', change, token);
            log(`#${issue}: ⏳ waiting ${act === 'add' ? '付与' : '除去'}`);
        } catch (e) {
            log(`#${issue}: waiting label ${act} failed: ${e.message}`);
        }
    }
}

/**
 * 🧭 tracking の担保判定に要る sub-issue 件数を解決する（#1130）。Project の item-list は
 * 件数を返さないので補完する。俯瞰ボードのキャッシュ（{@link refreshBoard} が enrichment 済み）
 * を優先し、そこに無い分だけ 1 回のバッチ GraphQL で取る（`.claude/rules/autopilot/github-api.md`
 * の「バッチ読み = GraphQL / 問い合わせ対象の限定」）。取得失敗は握りつぶす（件数不明 = 未分解
 * 扱いになり 🧭 を付けないので、デッドロック側に倒れない安全側の既定）。
 * @param {number[]} numbers 件数が要る issue 番号（{@link selectSubIssueCountTargets} の結果）
 * @param {object} cfg
 * @param {object} state board キャッシュを持つ可変状態
 * @param {Function} log
 * @param {object} [deps] { readToken, getBoardEnrichment }（テスト用注入）
 * @returns {Promise<Map<number, {total:number}>>}
 */
async function resolveSubIssueCounts(numbers, cfg, state, log, deps = {}) {
    const out = new Map();
    if (!numbers.length) return out;
    const wanted = new Set(numbers);
    for (const it of (state.board && state.board.items) || []) {
        if (it && it.subIssues && wanted.has(it.issue)) out.set(it.issue, it.subIssues);
    }
    const missing = numbers.filter((n) => !out.has(n));
    if (!missing.length) return out;
    const getBoardEnrichment = deps.getBoardEnrichment || project.getBoardEnrichment;
    try {
        const readToken = deps.readToken || await project.readToken();
        const enrichment = await getBoardEnrichment(cfg.repo, missing, readToken);
        for (const [num, extra] of Object.entries(enrichment || {})) {
            if (extra && extra.subIssues) out.set(Number(num), extra.subIssues);
        }
    } catch (e) {
        log(`label healing: sub-issue 件数の取得に失敗 (${e.message})`);
    }
    return out;
}

/**
 * 非終端 item に管理対象ラベル（🤖 autopilot / 分解済み EPIC の 🧭 tracking）を担保する。
 * 判定は {@link healingLabelActions}（= `labelActions`）に一本化する — 自前で再実装すると
 * 未分解 EPIC に 🧭 が付いて decompose が永久に走らないデッドロックが復活する（#1130）。
 * 書き込みは差分があるときだけ（冪等・API 節約）で、token 取得も付与が 1 件でもある時だけ行う。
 * 1 件の失敗は他を止めない。
 * @param {object[]} items Project item
 * @param {object} cfg
 * @param {object} state { running, board }
 * @param {Function} log
 * @param {object} [deps] { token, readToken, editLabels, getBoardEnrichment }（テスト用注入）
 */
async function applyLabelHealing(items, cfg, state, log, deps = {}) {
    const editLabels = deps.editLabels || project.editLabels;
    const targets = selectLabelHealingItems(items, state.running);
    const counts = await resolveSubIssueCounts(
        selectSubIssueCountTargets(targets), cfg, state, log, deps,
    );
    const todo = [];
    for (const item of targets) {
        const withCounts = counts.has(item.issue) ? { ...item, subIssues: counts.get(item.issue) } : item;
        const { add } = healingLabelActions(withCounts, item.labels || []);
        if (add.length) todo.push({ issue: item.issue, add });
    }
    if (!todo.length) return;
    const token = deps.token || await project.botToken();
    for (const { issue, add } of todo) {
        try {
            await editLabels(cfg.repo, issue, 'issue', { add }, token);
            log(`#${issue}: ラベル担保 ${add.join(' ')}`);
        } catch (e) {
            log(`#${issue}: label healing failed: ${e.message}`);
        }
    }
}

/**
 * decompose の done で作成された leaf sub-issue に、既定の Project フィールド（Status/Kind/Size）
 * を補完する（#914）。sub-issue の作成そのもの・`--assignee` 付与は decompose スキル側の
 * GitHub Issue 直接操作（プロンプトの責務）だが、Project フィールドの単一ライターは daemon
 * なのでここで書く。フィールド設定意図は {@link subIssueSetupIntents}（純粋関数、既に値が
 * 入っているフィールドは上書きしない）に委譲する。1 件の失敗は他の sub-issue を止めない。
 * @param {object} result 検証済み decompose done 結果（createdSubIssues / subIssueSizes を含む）
 * @param {object} cfg { owner, project, repo, projectId, fields }
 * @param {function} log
 * @param {object} [deps] injection 用（token/addIssue/listItems/applyIntents）
 */
async function applyDecomposeSubIssueSetup(result, cfg, log, deps = {}) {
    const numbers = Array.isArray(result && result.createdSubIssues) ? result.createdSubIssues : [];
    if (!numbers.length) return;
    const sizes = (result && result.subIssueSizes) || {};
    const token = deps.token || await project.botToken();
    const addIssue = deps.addIssue || project.addIssue;
    const listItems = deps.listItems || project.listItems;
    const applyIntentsFn = deps.applyIntents || project.applyIntents;
    const ctx = { projectId: cfg.projectId, fields: cfg.fields };
    let existingItems = [];
    try {
        existingItems = await listItems(cfg.owner, cfg.project, token);
    } catch (e) {
        log(`decompose #${result.issue}: sub-issue field setup — item list failed: ${e.message}`);
    }
    const byIssue = new Map(existingItems.map((it) => [it.issue, it]));
    for (const num of numbers) {
        try {
            const itemId = await addIssue(cfg.owner, cfg.project, cfg.repo, num, token);
            const existing = byIssue.get(num) || {};
            const intents = subIssueSetupIntents(sizes[String(num)] || null, existing);
            if (!intents.length) continue;
            const applied = await applyIntentsFn(ctx, itemId, intents, token);
            log(`decompose #${result.issue}: sub-issue #${num} — ${(applied || []).join(', ')}`);
        } catch (e) {
            log(`decompose #${result.issue}: sub-issue #${num} setup failed: ${e.message}`);
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
    // Claude 使用率はローカルの小さな JSON（API 予算を消費しない）。毎 tick 読み直して
    // モニタが worker 完了を待たずライブ追従できるようにする（#1027）。pause 中も更新する
    // （稼働中 worker があれば statusline が書き続けるため）。rate 状態には依存させない。
    updateClaudeUsage(state, cfg, log);
    if (state.paused) return { paused: true, picked: [] };
    // レート残量の監視（rate_limit はレート消費なし）。残量僅少なら低優先処理をスキップする
    await refreshRateLimits(cfg, state, log);
    let items;
    try {
        items = await project.listItems(cfg.owner, cfg.project, await project.readToken());
        // 直後に走る refreshBoard が同じ listItems（~100 GraphQL pt）を撃ち直さず再利用できるよう
        // スナップショットを保存する（#read-GraphQL 予算節約 / shouldReuseItemsCache）。
        state.itemsCache = { items, at: cfg.now() };
    } catch (e) {
        log(`poll error: ${e.message}`);
        return { paused: false, picked: [] };
    }
    // autopilot-assignee ディレクティブ（#938）: itemOwner/ownsItem が使う前に解決しておく
    // （2人以上 assign の item のみ本文 fetch）。
    items = await populateAssigneeDirectives(items, cfg, state, log);
    // ストール復帰（#995）: In Progress + 実作業系 AI Status のまま worker が不在の item を
    // 対応フェーズへ再ディスパッチする（#972 のデッドエンド解消）。dispatch は running を
    // 同期的に set するので、直後の running スナップショットに含まれ selectActionable /
    // detectStuck と二重ディスパッチせず、Blocked より再開を優先できる。
    await recoverStalledInFlightWorkers(items, cfg, state, log)
        .catch((e) => log(`stalled recovery error: ${e.message}`));
    const running = new Set(state.running.keys());
    const contexts = await collectGateContexts(cfg, items, running, state, log);
    // 協調的チェックポイント（EPIC #906・#912）: Awaiting Continuation の item は continuation
    // ファイル（worktree 内）から元フェーズ・反復回数を読み、phaseForItem が implement 固定
    // フォールバックに頼らず正しいフェーズ（例 address-review）へ再開できるようにする。
    // isGateItem（Review/DoD/Blocked/Discussing）とは対象が重ならないので単純に merge する。
    Object.assign(contexts, await collectContinuationContexts(items, running, log));
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
    // autopilot-after ゲートで待たされている candidate を記録し、後で ⏳ waiting ラベルを
    // 依存状態へ合わせる（true=依存未完了で待ち / false=解決済み）。examined な candidate のみ。
    const waitingByIssue = new Map();
    for (const item of candidates) {
        const hasWaitLabel = (item.labels || []).includes(WAITING_LABEL);
        const capacityLeft = picked.length < capacity;
        // ディレクティブ取得（本文 fetch）は API を食うので、**capacity 内の候補**か、
        // **既に ⏳ が付いた候補（解決したら外すため再評価が要る）**だけに絞る。capacity が
        // 埋まった後の未ラベル候補は従来どおり読まない（API 削減の趣旨を維持）。
        // TTL キャッシュがあるので 2 tick 目以降はさらに安い。
        if (!capacityLeft && !hasWaitLabel) continue;
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
        waitingByIssue.set(item.issue, unresolved.length > 0);
        if (unresolved.length) {
            log(`#${item.issue}: autopilot-after 待ち (未完了: ${unresolved.map((n) => `#${n}`).join(', ')})`);
            continue;
        }
        if (capacityLeft) picked.push(item);
    }
    // ⏳ waiting ラベルを依存状態へ合わせる（待ち=付与 / 解決=除去）。picked を dispatch する
    // **前**に実行するので、これから着手する item からは ⏳ が外れる（実行中は candidate に
    // 含まれないので二重には触らない）。
    await applyAfterWaitLabels(candidates, waitingByIssue, cfg, log);
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
 * Awaiting Continuation item の continuation ファイル（worktree 内・{@link continuationFilePath}）
 * から残タスク数を読む（#913）。GitHub API は使わずローカルファイルシステムのみを読むので
 * GraphQL / gh のレート消費は無い（{@link collectContinuationContexts} と同じ理由）。
 * worktree/ファイルが無い・解析できない場合は null（board 側は「—」表示にフォールバック）。
 * @param {number} issue
 * @param {function} log
 * @param {object} [deps] { execFileP, existsSync, readFileSync }（テスト用）
 * @returns {Promise<number|null>}
 */
async function readContinuationRemainingCount(issue, log, deps = {}) {
    const exec = deps.execFileP || execFileP;
    try {
        const { stdout } = await exec(WORKTREE_BIN, ['path', String(issue)], { encoding: 'utf8' });
        const parsed = readContinuationFromWorktree(stdout.trim(), issue, deps);
        return parsed && Array.isArray(parsed.remaining) ? parsed.remaining.length : null;
    } catch (e) {
        log(`#${issue}: board continuation lookup failed: ${e.message}`);
        return null;
    }
}

/**
 * 俯瞰ボードのデータを再構築して state.board に置く（Web モニタの `GET /board` が返す）。
 * 表示対象は非終端・非 Icebox かつ「自分が Assignees のいずれか」（selectBoardItems /
 * isAssignee・#938）の item を Board view の見た目順に並べ、sub-issue 進捗と連携 PR 群
 * （state/draft）をバッチ GraphQL で enrich する。共同担当（オーナーでない Assignees）も
 * 表示対象になるが、**この daemon が dispatch するのは自分がオーナーの item だけ**
 * （itemOwner/ownsItem）— 観察対象（他人が駆動する item）の状態は、この daemon 自身の
 * dispatch では更新されず、`refreshBoard` の周期実行（既定 5 分）または「🔄 更新」ボタン
 * （`POST /refresh`）でのみ最新化される（`patchBoardCache` は自 worker 実行分のみの
 * live 反映で、観察対象には効かない）。
 * 非デフォルト base 宛て PR は close リンクに出ないため、PR を持ちうる Status なのに
 * PR が見つからない item は head ブランチ検索で補完する（#831 と同じ理由）。
 * Awaiting Continuation（#906/#912）の item は continuation ファイルの残タスク数も
 * `continuationRemaining` として添える（#913・monitor.js のバッジ表示用）。
 * 再入防止つき（前回の refresh が走っていればスキップ）。読み取り専用（Project は書かない）。
 */
async function refreshBoard(cfg, state, log, deps = {}) {
    if (state.boardRefreshing) return;
    // レート残量が僅少なら低優先のボード更新はスキップ（前回キャッシュを表示し続ける）
    if (state.ratePlan && state.ratePlan.skipLowPriority) return;
    state.boardRefreshing = true;
    try {
        // ボードは読み取り専用。read（個人）トークンの GraphQL 予算に一点集中させないため、
        // 既定で Bot の GraphQL 予算へ振り分ける（project.boardToken / C）。
        const token = deps.token || await project.boardToken();
        const listItems = deps.listItems || project.listItems;
        const getBoardEnrichment = deps.getBoardEnrichment || project.getBoardEnrichment;
        const listHeadPrs = deps.listHeadPrs || project.listHeadPrs;
        // tick が直前に取得した item スナップショットが十分新しければ listItems を撃たず再利用する
        // （B・~100 GraphQL pt/サイクルの重複排除）。POST /refresh は forceFetch で最新を取り直す。
        const maxAgeMs = cfg.itemsCacheMs || Math.floor((cfg.intervalMs || 300_000) / 2);
        let items;
        if (shouldReuseItemsCache({ now: cfg.now(), cache: state.itemsCache, maxAgeMs, forceFetch: deps.forceFetch })) {
            items = state.itemsCache.items;
        } else {
            items = await listItems(cfg.owner, cfg.project, token);
            state.itemsCache = { items, at: cfg.now() };
        }
        // 先に表示対象へ絞る: selectBoardItems（= isAssignee）はディレクティブ非依存なので、
        // owner 解決の**前**に非終端 &「自分が Assignees のいずれか」だけへ限定できる。これで
        // 終端 Status や他人の multi-assignee item の本文 fetch を避ける（#938・
        // `.claude/rules/autopilot/github-api.md` の「終端 Status を定常問い合わせから除外」）。
        const visible = selectBoardItems(items, cfg.assignee);
        // autopilot-assignee ディレクティブ（#938）: owner 表示の前に、表示対象だけ解決する
        const withDirectives = await populateAssigneeDirectives(visible, cfg, state, log, { ...deps, token });
        const boardItems = orderItemsLikeBoard(withDirectives, cfg.statusOrder);
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
            let continuationRemaining = null;
            if (it.aiStatus === AWAITING_CONTINUATION_STATUS) {
                continuationRemaining = await readContinuationRemainingCount(it.issue, log, deps);
            }
            enriched.push({
                issue: it.issue,
                title: it.title,
                url: `https://github.com/${cfg.repo}/issues/${it.issue}`,
                status: it.status || 'New Item',
                aiStatus: it.aiStatus || null,
                continuationRemaining,
                hitl: Boolean(it.hitlLabel),
                kind: it.kind || null,
                size: it.size || null,
                assignees: it.assignees || [],
                tracker: isTrackerItem(it),
                // autopilot-after ゲート待ち（daemon が毎 tick 維持する ⏳ ラベルをそのまま反映）。
                waiting: Array.isArray(it.labels) && it.labels.includes(WAITING_LABEL),
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
 * 分解済み EPIC（トラッカー）Issue に sub-issue 進捗 + Close 指示の sticky を維持する（#934）。
 * sub-issue 進捗は俯瞰ボードの enrichment（{@link refreshBoard} が既に取得済みの `state.board.items`）
 * をそのまま使うため、追加の GraphQL は発生しない（`.claude/rules/autopilot/github-api.md` 予算規約）。
 * 書き込みは `upsertMarkedComment` の冪等 upsert に委ね、本文が変わらない tick では PATCH しない。
 * 1 件の失敗は他を止めない。deps は injection 可能（テスト用）。
 * @param {object[]} boardItems refreshBoard が構築した board item（tracker/status/subIssues を含む）
 * @param {object} cfg
 * @param {function} log
 * @param {object} [deps] { token, readToken, upsertMarkedComment }
 */
async function applyTrackerStickies(boardItems, cfg, log, deps = {}) {
    const targets = (boardItems || []).filter(needsTrackerSticky);
    if (!targets.length) return;
    const token = deps.token || await project.botToken();
    const readToken = deps.readToken || deps.token || await project.readToken();
    const upsertMarkedComment = deps.upsertMarkedComment || project.upsertMarkedComment;
    for (const item of targets) {
        try {
            await upsertMarkedComment(
                cfg.repo, item.issue, [TRACKER_STICKY_MARKER], renderTrackerSticky(item), token,
                { readToken },
            );
        } catch (e) {
            log(`#${item.issue}: tracker sticky failed: ${e.message}`);
        }
    }
}

/**
 * {@link refreshBoard} 完了後にトラッカー sticky を投影するラッパー。board を更新する呼び出し
 * 箇所はすべてこれに置き換える（refreshBoard 自体は読み取り専用を保つ・単一責務）。
 * refreshBoard がレート僅少で内部スキップした場合は前回キャッシュのままなので、ここでも
 * 同条件で再投影をスキップする（同内容の再チェックで API を無駄遣いしない）。
 * deps は injection 可能（テスト用。refreshBoard と applyTrackerStickies 両方に渡る）。
 */
async function refreshBoardAndProjectTrackers(cfg, state, log, deps = {}) {
    await refreshBoard(cfg, state, log, deps);
    if (state.ratePlan && state.ratePlan.skipLowPriority) return;
    await applyTrackerStickies(state.board ? state.board.items : [], cfg, log, deps);
}

/**
 * 定期（main loop）専用の board 追従（D）。誰もモニタを見ていない間は board の read
 * （listItems/enrichment）を撃たず、トラッカー sticky が古くなり過ぎないアップキープ間隔
 * （{@link BOARD_UPKEEP_MS}）を超えたときだけ 1 度走らせる。判定は純粋関数
 * {@link shouldRefreshBoardPeriodic} に委ね、ここは fire-and-forget の I/O のみ。
 * POST /refresh・POST /tick 直後・起動時はこの関数を通さず常に実行する。
 */
function maybeRefreshBoardPeriodic(cfg, state, log, deps = {}) {
    const run = shouldRefreshBoardPeriodic({
        now: cfg.now(),
        watchedAt: state.boardWatchedAt != null ? state.boardWatchedAt : null,
        lastBoardAt: state.board ? state.board.updatedAt : null,
        watchTtlMs: cfg.boardWatchTtlMs || BOARD_WATCH_TTL_MS,
        upkeepMs: cfg.boardUpkeepMs || BOARD_UPKEEP_MS,
    });
    if (run) refreshBoardAndProjectTrackers(cfg, state, log, deps);
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
    } catch (e) {
        // tick 途中で bot-token 由来の認証エラー等が飛んでも **プロセスを落とさない**（#949）。
        // 認証系なら checkAuthHealth の onError と同じ経路（auto-pause）へ合流させ、
        // それ以外はサニタイズして log に残し、次 interval で通常継続する（無人運用）。
        if (isAuthError(e)) {
            recordAuthFailure(state, e, log);
            return { ran: false, authPaused: true, running: [...state.running.keys()] };
        }
        log(`tick error（プロセス継続）: ${sanitizeForSurface(`${(e && e.message) || e}`, 300)}`);
        return { ran: false, error: true, running: [...state.running.keys()] };
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
        version: state.version || null,
        autopilotUpdate: state.autopilotUpdate || null,
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
        version: state.version || null,
        autopilotUpdate: state.autopilotUpdate || null,
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
            // usage をライブ読取（ローカルファイル・API 予算ゼロ）してから返す。monitor の
            // 5 秒 poll でほぼライブ追従させる（worker 完了を待たない）（#1027）。
            updateClaudeUsage(state, cfg, log);
            // 観測時刻を記録する（D）: 誰も見ていない間は定期 refreshBoard を抑制して
            // board の read（listItems/enrichment）を撃たないため（shouldRefreshBoardPeriodic）。
            state.boardWatchedAt = cfg.now();
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
                    refreshBoardAndProjectTrackers(cfg, state, log); // 手動 tick 後もボードを追従（fire-and-forget）
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
            // usage はローカルファイル読取（API 予算を消費しない）ので、レート状態に関わらず
            // まず更新する。「🔄 更新」ボタンで使用量も更新される（#1027・skipLowPriority 非適用）。
            updateClaudeUsage(state, cfg, log);
            // 俯瞰ボードを即時再取得する（モニタの「🔄 更新」ボタン）。board は専用タイマーを
            // 持たず poll/tick 後にのみ更新するため、ユーザーが見たいときはここで消費する。
            // listItems は ~100 GraphQL ポイントと重いので、オンデマンドに限定して節約する。
            if (state.ratePlan && state.ratePlan.skipLowPriority) {
                // レート残量が僅少なら refreshBoard は内部で no-op になる。正直にスキップを返す。
                return send(200, { refreshed: false, skipped: 'rate-limited', minRemaining: state.ratePlan.minRemaining });
            }
            // 「🔄 更新」は明示的な最新要求なので forceFetch=true で listItems を取り直す（B の
            // キャッシュ再利用をバイパス）。観測扱いにして直後の定期サイクルも追従させる（D）。
            state.boardWatchedAt = cfg.now();
            refreshBoardAndProjectTrackers(cfg, state, log, { forceFetch: true })
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
            // 意図的な停止 → EXIT_OK。supervisor は再起動せず停止のままにする（#953）。
            setTimeout(() => process.exit(EXIT_OK), 100);
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
        // 稼働バージョン表示 + 更新検知（#885）: 動作中 checkout と監視ブランチ
        repoRoot: opts.repoRoot || project.REPO_ROOT,
        updateBranch: opts.updateBranch || DEFAULT_BASE_BRANCH,
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
        version: null, autopilotUpdate: null,
    };
    // プロセスレベルの安全網（#949/#953）: fire-and-forget な非同期経路のエラーを捕捉し、
    // 認証系は auto-pause で耐え、未知の非認証エラーは Node 準拠で exit（supervisor が再起動）。
    installProcessSafetyNet(state, log);
    // 稼働バージョンを起動時に確定させる（= 動いているコード）。以降 working tree が進んでも
    // この値は動かさない（だからこそ表示 + 更新検知が有用）。#885
    state.version = await readVersion(cfg.repoRoot);
    log(`running version: ${state.version.branch || '?'} @ ${state.version.shortCommit || '?'}`);
    // 更新検知（起動直後に 1 回 + 以降 15 分間隔・unref タイマー）
    startUpdateChecks(cfg, state, log);
    // PID ファイルを書き、安全停止（kill "$(cat <pidfile>)" / POST /shutdown）を可能にする
    try {
        fs.writeFileSync(pidFilePath(), String(process.pid));
        const cleanup = () => { try { fs.rmSync(pidFilePath(), { force: true }); } catch { /* noop */ } };
        process.on('exit', cleanup);
        // シグナルによる停止も意図的停止 → EXIT_OK（supervisor は再起動しない・#953）。
        process.on('SIGTERM', () => process.exit(EXIT_OK));
        process.on('SIGINT', () => process.exit(EXIT_OK));
    } catch (e) { log(`pid file warn: ${e.message}`); }
    startHttp(cfg, state, log);
    log(`daemon up: project #${cfg.project}, assignee ${cfg.assignee || '(all)'}, concurrency ${cfg.concurrency}, interval ${cfg.intervalMs}ms, pid ${process.pid} (${pidFilePath()})`);
    // 俯瞰ボードは起動時に 1 度だけ即時取得する。以降は専用タイマーを持たず、
    // 各 poll/tick の直後（下の refreshBoard）と、モニタの「🔄 更新」ボタン
    // （POST /refresh）によるオンデマンドでのみ更新する（GraphQL 予算の節約）。
    refreshBoardAndProjectTrackers(cfg, state, log);
    // 起動時の孤児 worker 自動復帰（#953）: crash → supervisor 再起動で in-memory running を
    // 失っても、in-flight のまま worker 不在の item を検出して対応フェーズへ再ディスパッチする。
    await recoverOrphanedWorkers(cfg, state, log).catch((e) => log(`orphan recovery error: ${e.message}`));
    /* eslint-disable no-constant-condition */
    while (!opts.once) {
        // 認証ヘルスチェック（失効 → auto-pause / 回復 → auto-resume）を tick の前に行う。
        // auth で pause 中も interval ごとに再試行し、人間が再認証すれば自動で再開する。
        await checkAuthHealth(cfg, state, log);
        // runTickOnce 経由にして、定期 tick と手動 POST /tick が重ならないようにする（再入防止）
        await runTickOnce(cfg, state, log);
        // tick で Project が動いた直後はボードも追従させる（fire-and-forget）。ただし誰も
        // モニタを見ていない間は board の read を撃たない（D・トラッカー維持のアップキープ間隔は除く）。
        maybeRefreshBoardPeriodic(cfg, state, log);
        await sleep(cfg.intervalMs);
    }
    if (opts.once) {
        await checkAuthHealth(cfg, state, log);
        await runTickOnce(cfg, state, log);
        maybeRefreshBoardPeriodic(cfg, state, log);
    }
}

module.exports = {
    main, tick, runTickOnce, dispatch, applyMergeProgression, applyClosedReconcile, applyPrProjection,
    applyDodHandoffs, detectStuck, recoverOrphanedWorkers, recoverStalledInFlightWorkers,
    markBlocked, getDirectives, populateAssigneeDirectives,
    applyLabelHealing, applyAfterWaitLabels,
    applyDecomposeSubIssueSetup,
    isGateItem, collectGateContexts, checkAuthHealth, REAUTH_HINT,
    recordAuthFailure, handleProcessError, installProcessSafetyNet,
    parseSsoDeviceOutput, startReauth,
    refreshBoard, recordHistory, refreshRateLimits, patchBoardCache,
    applyTrackerStickies, refreshBoardAndProjectTrackers, maybeRefreshBoardPeriodic,
    updateClaudeUsage, boardResponse, statusResponse, startHttp,
    checkForUpdate, startUpdateChecks,
    ensureCheckpointCommit, readContinuationFromWorktree, applyCheckpointHandling,
    collectContinuationContexts, checkpointEscalationBody,
    followBaseBranch,
};
