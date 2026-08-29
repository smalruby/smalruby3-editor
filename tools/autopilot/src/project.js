'use strict';
/**
 * project.js — GitHub Projects v2 への読み書き（gh CLI ラッパ）。
 * 認証は bin/bot-token のインストールトークン。書き込みは gh project item-edit
 * を使う（手動検証済みの経路）。Status/AI Status/HITL/Size/Kind の単一ライターは
 * この層（daemon/CLI）であり、スキルは触らない。
 *
 * I/O はすべて **非同期**（execFile）。旧実装の execFileSync は 1 呼び出しごとに
 * イベントループを止め、tick 中の daemon が HTTP（Web モニタ）に応答できなくなる
 * ため全廃した。純粋関数（normalize / select 系）は同期のまま。
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const {
    HITL_LABEL, AUTOPILOT_LABEL, selectMarkedComments, stickyUpsertPlan, STICKY_MARKERS,
    computeReviewApproval, autopilotHeadBranch, mergeActivity, normalizeBoardEnrichment,
} = require('./phases');

const execFileP = promisify(execFile);

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BOT_TOKEN_BIN = path.join(REPO_ROOT, 'bin', 'bot-token');

// bot-token の in-process キャッシュ。bin/bot-token 自体もディスクキャッシュを持つが、
// tick ごとに何十回も node プロセスを spawn しないよう短時間だけメモ化する。
let tokenCache = { token: null, at: 0 };
const TOKEN_CACHE_MS = 60 * 1000;

async function botToken() {
    const now = Date.now();
    if (tokenCache.token && now - tokenCache.at < TOKEN_CACHE_MS) return tokenCache.token;
    const { stdout } = await execFileP(BOT_TOKEN_BIN, [], { encoding: 'utf8' });
    tokenCache = { token: stdout.trim(), at: now };
    return tokenCache.token;
}

/**
 * 読み取り用トークン（レート予算の分散）。優先順:
 *   env AUTOPILOT_READ_TOKEN → env GH_TOKEN（devpod では人間の PAT）→ `gh auth token` → Bot。
 * **書き込みには使わない**（コメント・ラベル・Project 編集は名義が見える Bot のまま）。
 * `AUTOPILOT_READS=bot` で従来動作（読みも Bot）に戻せる。
 * @returns {Promise<string>}
 */
let readTokenCache = { token: null, at: 0 };
async function readToken() {
    if (process.env.AUTOPILOT_READS === 'bot') return botToken();
    if (process.env.AUTOPILOT_READ_TOKEN) return process.env.AUTOPILOT_READ_TOKEN;
    if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
    const now = Date.now();
    if (readTokenCache.token && now - readTokenCache.at < TOKEN_CACHE_MS) return readTokenCache.token;
    try {
        const env = { ...process.env };
        delete env.GH_TOKEN;
        delete env.GITHUB_TOKEN;
        const { stdout } = await execFileP('gh', ['auth', 'token'], { encoding: 'utf8', env });
        const t = stdout.trim();
        if (t) {
            readTokenCache = { token: t, at: now };
            return t;
        }
    } catch { /* 個人トークン無し → Bot へフォールバック */ }
    readTokenCache = { token: await botToken(), at: now };
    return readTokenCache.token;
}

/**
 * 俯瞰ボード再取得（listItems キャッシュミス時 / enrichment / head-PR 補完）に使うトークン。
 * これらは *読み取り専用で可視な成果物を生まない* ため、read（個人）トークンの GraphQL 予算に
 * 一点集中させず、遊んでいる Bot の GraphQL 予算へ **既定で** 振り分けて実効予算を分散する
 * （dispatch 判断の tick 系 read は従来どおり readToken のまま）。名義が見える書き込みは
 * 引き続き botToken なので、名義規約（書き込み=Bot / 読み取り=read）の趣旨は損なわない。
 * `AUTOPILOT_BOARD_READS=read` で従来（read トークン）へ戻せる。
 * @returns {Promise<string>}
 */
async function boardToken() {
    if (process.env.AUTOPILOT_BOARD_READS === 'read') return readToken();
    return botToken();
}

async function gh(args, { token } = {}) {
    const env = { ...process.env, GH_TOKEN: token || await botToken() };
    const { stdout } = await execFileP('gh', args, { encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
    return stdout;
}

/** Project の id と number を取得 */
async function getProject(owner, number, token) {
    const out = await gh(['project', 'view', String(number), '--owner', owner, '--format', 'json'], { token });
    const j = JSON.parse(out);
    return { id: j.id, number: j.number, title: j.title, url: j.url };
}

/** フィールド定義を name -> {id, type, options:{optName:id}} で返す */
async function getFields(owner, number, token) {
    const out = await gh(['project', 'field-list', String(number), '--owner', owner, '--format', 'json'], { token });
    const fields = JSON.parse(out).fields;
    const map = {};
    for (const f of fields) {
        const options = {};
        if (Array.isArray(f.options)) for (const o of f.options) options[o.name] = o.id;
        map[f.name] = { id: f.id, type: f.type, options };
    }
    return map;
}

/** 指定 Issue 番号に対応する project item id を返す（無ければ null） */
async function findItemId(owner, number, issueNumber, token) {
    const out = await gh(['project', 'item-list', String(number), '--owner', owner, '--format', 'json', '--limit', '1000'], { token });
    const items = JSON.parse(out).items || [];
    const it = items.find(i => i.content && i.content.number === issueNumber);
    return it ? it.id : null;
}

/**
 * gh project item-list の生 item を daemon 用の正規化形へ変換する純粋関数。
 * gh の JSON はキー揺れ（"aI Status"）があるので吸収する。HITL は Project フィールドではなく
 * 🙋 ラベルで管理する（#813）ので、item-list が返す `labels` から `hitlLabel` を導く
 * （追加の API 呼び出し不要）。HITL フィールドは読まない。I/O が無いので unit テスト可能。
 * `assignees` は enroll モデル（担当者の daemon だけが処理する）の判定に使う。
 * @param {object} i 生 item（content / labels / assignees / status などを持つ）
 * @returns {{issue, itemId, status, aiStatus, labels, hitlLabel, kind, size, title, assignees}}
 */
function normalizeProjectItem(i) {
    const labels = Array.isArray(i.labels) ? i.labels : [];
    return {
        issue: i.content.number,
        itemId: i.id,
        title: i.content.title,
        status: i.status,
        aiStatus: i['aI Status'] ?? i.aiStatus,
        labels,
        hitlLabel: labels.includes(HITL_LABEL),
        kind: i.kind,
        size: i.size,
        assignees: Array.isArray(i.assignees) ? i.assignees : [],
    };
}

/**
 * Project の全 item をフィールド値つきで返す（daemon のポーリング用）。
 * 正規化は {@link normalizeProjectItem}（純粋）に委譲する。
 * @returns {Array<{issue, itemId, status, aiStatus, labels, hitlLabel, kind, size, title}>}
 */
async function listItems(owner, number, token) {
    const out = await gh(['project', 'item-list', String(number), '--owner', owner, '--format', 'json', '--limit', '1000'], { token });
    const items = JSON.parse(out).items || [];
    return items
        .filter((i) => i.content && typeof i.content.number === 'number')
        .map(normalizeProjectItem);
}

/** Issue を project に追加して item id を返す（既にあれば既存を返す） */
async function addIssue(owner, number, repo, issueNumber, token) {
    const existing = await findItemId(owner, number, issueNumber, token);
    if (existing) return existing;
    const url = `https://github.com/${repo}/issues/${issueNumber}`;
    const out = await gh(['project', 'item-add', String(number), '--owner', owner, '--url', url, '--format', 'json'], { token });
    return JSON.parse(out).id;
}

/**
 * 1 フィールドを設定する。value=null はクリア。
 * @param {object} ctx { projectId, fields }（getFields 結果）
 */
async function setField(ctx, itemId, fieldName, value, token) {
    const f = ctx.fields[fieldName];
    if (!f) throw new Error(`unknown field: ${fieldName}`);
    const base = ['project', 'item-edit', '--id', itemId, '--project-id', ctx.projectId, '--field-id', f.id];
    if (value === null) {
        await gh([...base, '--clear'], { token });
        return;
    }
    if (f.type === 'ProjectV2SingleSelectField') {
        const optId = f.options[value];
        if (!optId) throw new Error(`field ${fieldName} has no option "${value}"`);
        await gh([...base, '--single-select-option-id', optId], { token });
    } else {
        await gh([...base, '--text', String(value)], { token });
    }
}

/**
 * bot の GraphQL author login（= App slug。コメント作者の human/bot 判定に使う）。
 * `bin/bot-token --bot-email` は "<slug>[bot]\t<id>+<slug>[bot]@..." を返すので slug を取り出す。
 * @returns {string}
 */
let botLoginCache = null;
async function botLogin() {
    if (botLoginCache) return botLoginCache;
    const { stdout } = await execFileP(BOT_TOKEN_BIN, ['--bot-email'], { encoding: 'utf8' });
    const name = (stdout.trim().split(/\s+/)[0] || '').trim();
    botLoginCache = name.replace(/\[bot\]$/, '');
    return botLoginCache;
}

/**
 * closedByPullRequestsReferences のノード群から、projection 対象の PR を 1 つ選ぶ純粋関数（#825）。
 * GitHub が「この Issue を閉じる」と認識した PR だけが渡る前提（本文で `#N` に言及しただけの
 * 無関係 PR は含まれない）。open を最優先し、複数 open なら新しい方（番号が大きい方）を選ぶ。
 * open が無ければ null（projection 対象は open PR のみ）。
 * @param {Array<{number:number, state:string, isDraft:boolean, headRefName:string, baseRefName:string,
 *   labels:{nodes:Array<{name:string}>}}>} nodes
 * @returns {{number:number, labels:string[], isDraft:boolean, branch:string, base:string}|null}
 */
function selectClosingPr(nodes) {
    const open = (Array.isArray(nodes) ? nodes : []).filter((n) => n && n.state === 'OPEN');
    if (!open.length) return null;
    const pr = open.sort((a, b) => b.number - a.number)[0];
    return {
        number: pr.number,
        labels: ((pr.labels && pr.labels.nodes) || []).map((l) => l.name),
        isDraft: Boolean(pr.isDraft),
        branch: pr.headRefName,
        base: pr.baseRefName,
    };
}

/**
 * `gh pr list --json number,isDraft,headRefName,labels` の結果から PR を 1 つ選ぶ純粋関数（#831）。
 * head ブランチ検索のフォールバック用。{@link selectClosingPr} と返り値の形を揃えるが、入力の
 * labels が GraphQL の `labels.nodes` ではなく `gh pr list` の flat な `[{name}]` である点が異なる。
 * 複数あれば新しい方（番号が大きい方）を選ぶ。空/null なら null。
 * @param {Array<{number:number, isDraft:boolean, headRefName:string, baseRefName:string,
 *   labels:Array<{name:string}>}>} prs `gh pr list --json ...` の配列
 * @returns {{number:number, labels:string[], isDraft:boolean, branch:string, base:string}|null}
 */
function selectHeadPr(prs) {
    const list = (Array.isArray(prs) ? prs : []).filter(Boolean);
    if (!list.length) return null;
    const pr = list.sort((a, b) => b.number - a.number)[0];
    return {
        number: pr.number,
        labels: (pr.labels || []).map((l) => l.name),
        isDraft: Boolean(pr.isDraft),
        branch: pr.headRefName,
        base: pr.baseRefName,
    };
}

/**
 * `gh pr list --json state` の結果に merged PR が含まれるか（#831・base 非依存の merge 検知）。
 * @param {Array<{state?:string, merged?:boolean}>} prs
 * @returns {boolean}
 */
function hasMergedHeadPr(prs) {
    return (Array.isArray(prs) ? prs : []).some((p) => p && (p.state === 'MERGED' || p.merged === true));
}

/** autopilot の head ブランチ名（env `AUTOPILOT_BRANCH_PREFIX` があれば bash 側に合わせる）。 */
function headBranchFor(issueNumber) {
    return autopilotHeadBranch(issueNumber, process.env.AUTOPILOT_BRANCH_PREFIX || undefined);
}

/**
 * Issue にひも付く open PR を返す（implement が PR 本文に `Closes #N` を書く規約）。
 * 解決はまず GitHub が認識する「この Issue を閉じる PR」リンク
 * （`closedByPullRequestsReferences`、{@link hasMergedPullRequest} と同経路）を使う。
 * 旧実装は `Closes #N in:body` の全文あいまい検索で、本文が `#N` に言及しただけの無関係 PR を
 * 誤ヒットしていた（#825）。
 *
 * ただし GitHub は **PR が非デフォルト base 宛て**（EPIC サブ Issue の PR を親 epic ブランチに積む等）の
 * 場合、本文の `Closes #N` を close リンクとして登録しない（#829 と相互作用）。そこで close リンクが
 * 空のときは、autopilot の PR が必ず持つ **head ブランチ `topic/autopilot-<N>`** で base 非依存に
 * 引く（あいまい全文検索には戻さない、#831）。labels は名前配列、branch（headRefName）は DoD 引き継ぎで使う（#821）。
 * @param {string} repo `owner/name`
 * @param {number} issueNumber
 * @param {string} token
 * @param {{gh?:Function}} [deps] gh 実行を差し替え可能（テスト用）
 * @returns {{number:number, labels:string[], isDraft:boolean, branch:string}|null} 無ければ null
 */
async function findPrForIssue(repo, issueNumber, token, deps = {}) {
    const ghFn = deps.gh || gh;
    const [owner, name] = repo.split('/');
    const query =
        'query($owner:String!,$name:String!,$num:Int!){' +
        'repository(owner:$owner,name:$name){issue(number:$num){' +
        'closedByPullRequestsReferences(first:20,includeClosedPrs:true){nodes{' +
        'number state isDraft headRefName baseRefName labels(first:20){nodes{name}}}}}}}';
    const out = await ghFn(
        ['api', 'graphql', '-f', `query=${query}`,
            '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `num=${issueNumber}`],
        { token },
    );
    const issue = JSON.parse(out)?.data?.repository?.issue;
    const nodes = (issue && issue.closedByPullRequestsReferences && issue.closedByPullRequestsReferences.nodes) || [];
    const viaLink = selectClosingPr(nodes);
    if (viaLink) return viaLink;
    // close リンクが無い（非デフォルト base 宛て PR 等）→ head ブランチで base 非依存に解決（#831）
    const listOut = await ghFn(
        ['pr', 'list', '--repo', repo, '--head', headBranchFor(issueNumber), '--state', 'open',
            '--json', 'number,isDraft,headRefName,baseRefName,labels', '--limit', '10'],
        { token },
    );
    return selectHeadPr(JSON.parse(listOut));
}

/**
 * PR のレビュー状態を正規化して返す。
 * - approved / changesRequested: {@link computeReviewApproval} で導く。reviewDecision は
 *   ブランチ保護でレビュー必須でないと空になり approve を検知できないため、空のときは
 *   個々の review の著者ごと最新 state から判定する（#815）。
 * - changesRequestedAt: 最新の CHANGES_REQUESTED レビューの submittedAt（ms、無ければ null・#894）
 * - unresolvedHumanComments: 人間が立てた未解決レビュースレッド数（bot は除外）
 * @returns {{approved:boolean, changesRequested:boolean, changesRequestedAt:number|null,
 *   unresolvedHumanComments:number}}
 */
async function getPrReviewState(repo, prNumber, token) {
    const [owner, name] = repo.split('/');
    const query = `query($owner:String!,$name:String!,$pr:Int!){
      repository(owner:$owner,name:$name){
        pullRequest(number:$pr){
          reviewDecision
          comments(last:50){nodes{author{login} createdAt}}
          reviews(last:100){nodes{author{login} state submittedAt}}
          reviewThreads(first:100){nodes{isResolved comments(first:10){nodes{author{login} createdAt}}}}
        }
      }
    }`;
    const out = await gh(
        ['api', 'graphql', '-f', `query=${query}`,
            '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `pr=${prNumber}`],
        { token },
    );
    const pr = JSON.parse(out).data.repository.pullRequest;
    const bot = await botLogin();
    const isHuman = (login) => Boolean(login) && login !== bot && !login.endsWith('[bot]');
    const threads = (pr.reviewThreads && pr.reviewThreads.nodes) || [];
    const unresolvedHumanComments = threads.filter(
        (t) => !t.isResolved && (t.comments.nodes || []).some((c) => isHuman(c.author && c.author.login)),
    ).length;
    const reviews = (pr.reviews && pr.reviews.nodes) || [];
    const { approved, changesRequested } = computeReviewApproval(reviews, pr.reviewDecision, isHuman);
    // 最新の人間 CHANGES_REQUESTED レビューの submittedAt（#894 の構造化解除シグナル用）。
    // approve 後に Request changes しても、その submittedAt が処理済み watermark より新しければ
    // ゲートを解除して address-review へ倒す（hasUnhandledChangesRequest）。
    let changesRequestedAt = null;
    for (const r of reviews) {
        const login = r && r.author && r.author.login;
        if (!isHuman(login) || r.state !== 'CHANGES_REQUESTED') continue;
        const ms = r.submittedAt ? Date.parse(r.submittedAt) : NaN;
        if (Number.isNaN(ms)) continue;
        if (changesRequestedAt == null || ms > changesRequestedAt) changesRequestedAt = ms;
    }
    // 発言アクティビティ（ゲート解除の「人間が最後に発言したか」判定用）: PR コメント +
    // レビュー送信 + レビュースレッドコメントの、人間/bot 別の最新時刻を集める。
    const activity = { lastHumanAt: 0, lastBotAt: 0 };
    const record = (login, at) => {
        const ms = at ? Date.parse(at) : NaN;
        if (Number.isNaN(ms)) return;
        if (isHuman(login)) activity.lastHumanAt = Math.max(activity.lastHumanAt, ms);
        else activity.lastBotAt = Math.max(activity.lastBotAt, ms);
    };
    for (const c of (pr.comments && pr.comments.nodes) || []) record(c.author && c.author.login, c.createdAt);
    for (const r of reviews) record(r.author && r.author.login, r.submittedAt);
    for (const t of threads) {
        for (const c of t.comments.nodes || []) record(c.author && c.author.login, c.createdAt);
    }
    return { approved, changesRequested, changesRequestedAt, unresolvedHumanComments, activity };
}

/**
 * Issue 側の発言アクティビティ（人間/bot 別の最新コメント時刻）を返す。
 * Discussing ゲートや PR の無い Blocked の「人間が最後に発言したか」判定に使う。
 * @param {string} repo `owner/name`
 * @param {number} issueNumber
 * @param {string} token
 * @returns {{lastHumanAt: number, lastBotAt: number}} ms epoch（無ければ 0）
 */
async function getIssueActivity(repo, issueNumber, token) {
    const out = (await gh(
        ['api', '--paginate', `repos/${repo}/issues/${issueNumber}/comments`,
            '--jq', '.[] | "\\(.created_at) \\(.user.login)"'],
        { token },
    )).trim();
    const bot = await botLogin();
    const activity = { lastHumanAt: 0, lastBotAt: 0 };
    if (!out) return activity;
    for (const line of out.split('\n')) {
        const [at, login] = line.split(' ');
        const ms = Date.parse(at);
        if (Number.isNaN(ms) || !login) continue;
        const isHuman = login !== bot && !login.endsWith('[bot]');
        if (isHuman) activity.lastHumanAt = Math.max(activity.lastHumanAt, ms);
        else activity.lastBotAt = Math.max(activity.lastBotAt, ms);
    }
    return activity;
}

/**
 * 人間ゲート item の付帯情報（HITL 解除シグナル + PR レビュー状態 + 発言アクティビティ +
 * PR 番号）を集める。phaseForItem の ctx として渡す。Review/DoD だけでなく Blocked や
 * Discussing（PR が無い場合あり）にも使う。
 *
 * 解除シグナルは OR セマンティクス（contract §7・#813 でラベル一本化）: Issue の `🙋 HITL`
 * ラベル / PR の `🙋 HITL` ラベルのいずれか1つでも除去なら解除。加えて発言アクティビティ
 * （Issue コメント + PR コメント/レビュー）から「人間が最後に発言したか」を daemon が導く
 * （ラベルを触らずコメントだけ出す操作でも固着しないため）。HITL フィールドは見ない。
 * @param {string} repo
 * @param {number} issueNumber
 * @param {string} token
 * @returns {{hitlSignals:object, review:object|null, pr:number|null,
 *   activity:{lastHumanAt:number, lastBotAt:number}}}
 */
async function getGateContext(repo, issueNumber, token) {
    const pr = await findPrForIssue(repo, issueNumber, token);
    const issueLabels = await getIssueLabels(repo, issueNumber, token);
    const issueActivity = await getIssueActivity(repo, issueNumber, token);
    if (!pr) {
        return {
            hitlSignals: { issueLabel: issueLabels.includes(HITL_LABEL) },
            review: null,
            pr: null,
            activity: issueActivity,
        };
    }
    const review = await getPrReviewState(repo, pr.number, token);
    return {
        hitlSignals: {
            issueLabel: issueLabels.includes(HITL_LABEL),
            prLabel: (pr.labels || []).includes(HITL_LABEL),
        },
        review,
        pr: pr.number,
        activity: mergeActivity(issueActivity, review.activity),
    };
}

/**
 * PR の現在の面状態（Draft かどうか + ラベル名配列）を返す。投影の差分計算に使う。
 * @returns {{isDraft:boolean, labels:string[]}}
 */
async function getPrInfo(repo, prNumber, token) {
    // REST（1 呼び出し = 1 リクエスト）。gh pr view は GraphQL 予算を使うため使わない。
    const out = await gh(['api', `repos/${repo}/pulls/${prNumber}`], { token });
    const j = JSON.parse(out);
    return { isDraft: Boolean(j.draft), labels: (j.labels || []).map((l) => l.name) };
}

/**
 * Issue のメタ情報（body / labels / state）を **REST 1 回**で返す。
 * gh issue view（GraphQL）を body 用・labels 用に 2 回呼ぶより安い。
 * @returns {Promise<{body: string, labels: string[], state: string}>}
 */
async function getIssueMeta(repo, issueNumber, token, deps = {}) {
    const ghFn = deps.gh || gh;
    const out = await ghFn(['api', `repos/${repo}/issues/${issueNumber}`], { token });
    const j = JSON.parse(out);
    return {
        body: j.body || '',
        labels: (j.labels || []).map((l) => (typeof l === 'string' ? l : l.name)),
        state: (j.state || '').toUpperCase(),
    };
}

/**
 * Issue の現在のラベル名配列を返す（REST）。
 * @returns {string[]}
 */
async function getIssueLabels(repo, issueNumber, token) {
    return (await getIssueMeta(repo, issueNumber, token)).labels;
}

/**
 * Issue の本文（Markdown）を返す（REST）。DoD 引き継ぎ・ディレクティブ抽出に使う。
 * @returns {string}
 */
async function getIssueBody(repo, issueNumber, token) {
    return (await getIssueMeta(repo, issueNumber, token)).body;
}

/**
 * Issue または PR のラベルを編集する（add/remove の差分。空なら何もしない）。
 * @param {string} type 'issue' | 'pr'
 * @param {{add?:string[], remove?:string[]}} diff
 */
async function editLabels(repo, number, type, diff, token) {
    const add = diff.add || [];
    const remove = diff.remove || [];
    if (!add.length && !remove.length) return;
    const args = [type, 'edit', String(number), '--repo', repo];
    for (const l of add) args.push('--add-label', l);
    for (const l of remove) args.push('--remove-label', l);
    await gh(args, { token });
}

/**
 * PR の Draft/Ready を切り替える。'ready' → レビュー受付、'draft' → Draft へ戻す。
 * @param {'ready'|'draft'} action
 */
async function setPrDraft(repo, prNumber, action, token) {
    const args = ['pr', 'ready', String(prNumber), '--repo', repo];
    if (action === 'draft') args.push('--undo');
    await gh(args, { token });
}

/**
 * Issue/PR の全コメントを {id, body} の配列で取得する。
 * body は改行を含むため @base64 で 1 行にエンコードして取り出し、JS 側でデコードする
 * （`--paginate` + `--jq` でページ跨ぎの改行混入を避ける）。
 * @param {string} repo `owner/name`
 * @param {number} number Issue/PR 番号
 * @param {string} token
 * @returns {Array<{id: string, body: string}>}
 */
async function listIssueComments(repo, number, token) {
    const out = (await gh(
        ['api', '--paginate', `repos/${repo}/issues/${number}/comments`,
            '--jq', '.[] | "\\(.id) \\(.body | @base64)"'],
        { token },
    )).trim();
    if (!out) return [];
    return out.split('\n').filter(Boolean).map((line) => {
        const sp = line.indexOf(' ');
        const id = sp === -1 ? line : line.slice(0, sp);
        const b64 = sp === -1 ? '' : line.slice(sp + 1);
        return { id, body: Buffer.from(b64, 'base64').toString('utf8') };
    });
}

/**
 * sticky ステータスコメントを upsert する（マーカー付きの 1 コメントを編集し続ける）。
 * 正準・旧いずれのマーカーを含む既存コメントも吸収して in-place 更新する（#809）。
 * 複数見つかった場合は先頭を残して PATCH し、残りは DELETE して 1 つに集約する。
 * いずれも無ければ新規 POST。PR/Issue 共通の issues コメント API を使う。
 */
async function upsertStickyComment(repo, number, body, token, deps = {}) {
    await upsertMarkedComment(repo, number, STICKY_MARKERS, body, token, deps);
}

/**
 * 任意マーカーの 1 コメントを upsert する（汎用版）。対応 PR リンク sticky（PR_LINK_MARKER）等、
 * sticky ステータス以外のマーカー付き管理コメントに使う。重複は先頭に集約する。
 * @param {string} repo `owner/name`
 * @param {number} number Issue/PR 番号
 * @param {string[]} markers 識別マーカー（いずれかを含む既存コメントを更新対象にする）
 * @param {string} body 新しい本文（マーカーを含めること）
 */
async function upsertMarkedComment(repo, number, markers, body, token, deps = {}) {
    // 読み取り（コメント一覧）は readToken 側の予算、書き込み（POST/PATCH/DELETE）は token（Bot）
    const comments = await listIssueComments(repo, number, deps.readToken || token);
    const plan = stickyUpsertPlan(selectMarkedComments(comments, markers), body);
    await applyUpsertPlan(repo, number, plan, body, token);
}

/**
 * upsert 計画（{@link stickyUpsertPlan}）を実行する。内容が同一（action='skip'）なら
 * PATCH を発行しない（書き込み予算の節約）。重複は従来どおり DELETE で集約する。
 */
async function applyUpsertPlan(repo, number, plan, body, token) {
    if (plan.action === 'post') {
        await gh(['api', '--method', 'POST', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`], { token });
    } else if (plan.action === 'patch') {
        await gh(['api', '--method', 'PATCH', `repos/${repo}/issues/comments/${plan.keepId}`, '-f', `body=${body}`], { token });
    }
    for (const dup of plan.deleteIds) {
        await gh(['api', '--method', 'DELETE', `repos/${repo}/issues/comments/${dup}`], { token });
    }
}

/**
 * Issue にプレーンなコメントを投稿する（bot 名義）。
 * daemon が run 失敗で Blocked にするとき「何が起きたか・人間は何をすべきか」を残すのに使う
 * （#816。コメント無しで 🙋 だけ付くと人間が状況を把握できない）。
 * @param {string} repo `owner/name`
 * @param {number} number Issue 番号
 * @param {string} body コメント本文
 */
async function postIssueComment(repo, number, body, token) {
    await gh(['api', '--method', 'POST', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`], { token });
}

/**
 * 指定 Issue に紐付く PR の中に merge 済みのものがあるか。
 * まず GitHub の "Development" リンク（PR 本文の `Closes #<issue>` など）を
 * `closedByPullRequestsReferences` で辿る。autopilot は自動 merge しないので、
 * これは人間の手動 merge を検知するための読み取り。
 *
 * close リンクは **非デフォルト base 宛て PR**（epic ブランチに積んだサブ Issue 等）を拾えない
 * （#829 と相互作用）。そのため close リンクで merge が見つからなければ、head ブランチ
 * `topic/autopilot-<N>` の merged PR も見る（base 非依存・#831）。「topic merge = close」運用を
 * epic ブランチへの merge でも効かせるため。
 * @param {string} repo `owner/name`
 * @param {number} issueNumber
 * @param {string} token
 * @param {{gh?:Function}} [deps] gh 実行を差し替え可能（テスト用）
 * @returns {boolean} merge 済み PR が 1 つでもあれば true
 */
async function hasMergedPullRequest(repo, issueNumber, token, deps = {}) {
    const ghFn = deps.gh || gh;
    const [owner, name] = repo.split('/');
    const query =
        'query($owner:String!,$name:String!,$num:Int!){' +
        'repository(owner:$owner,name:$name){issue(number:$num){' +
        'closedByPullRequestsReferences(first:20,includeClosedPrs:true){nodes{merged}}}}}';
    const out = await ghFn(
        ['api', 'graphql', '-f', `query=${query}`, '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `num=${issueNumber}`],
        { token },
    );
    const issue = JSON.parse(out)?.data?.repository?.issue;
    const nodes = (issue && issue.closedByPullRequestsReferences && issue.closedByPullRequestsReferences.nodes) || [];
    if (nodes.some((n) => n.merged === true)) return true;
    // close リンクに無い → head ブランチで非デフォルト base への merge を検知（#831）
    const listOut = await ghFn(
        ['pr', 'list', '--repo', repo, '--head', headBranchFor(issueNumber), '--state', 'merged',
            '--json', 'number,state', '--limit', '10'],
        { token },
    );
    return hasMergedHeadPr(JSON.parse(listOut));
}

/**
 * GitHub で closed な issue 番号の集合を返す（#843）。`gh project item-list` の content には
 * open/closed の state が無いため、Project とは別に issue 一覧から closed を引く。
 * @param {string} repo `owner/name`
 * @param {string} token
 * @param {{gh?:Function}} [deps] gh 実行を差し替え可能（テスト用）
 * @returns {Set<number>} closed な issue 番号の集合
 */
async function listClosedIssueNumbers(repo, token, deps = {}) {
    // フォールバック用（定常経路は getIssueStates の非終端バッチ確認）。
    // REST + **🤖 autopilot ラベル限定**で問い合わせ量を絞る。REST の /issues は PR も
    // 返すため pull_request を持つものは除外する。
    const ghFn = deps.gh || gh;
    const label = encodeURIComponent(AUTOPILOT_LABEL);
    const out = await ghFn(
        ['api', '--paginate', `repos/${repo}/issues?state=closed&labels=${label}&per_page=100`,
            '--jq', '.[] | select(.pull_request | not) | .number'],
        { token },
    );
    return new Set(out.trim().split('\n').filter(Boolean).map(Number));
}

/**
 * 指定 issue 番号群の open/closed 状態を **バッチ GraphQL（alias）** で一括確認する。
 * closed 整合（#843）のための定常経路: リポジトリ全体の closed 一覧（最大 1000 件 ×
 * 毎 tick）を取得する代わりに、**Project 上の非終端 item + autopilot-after 依存先だけ**を
 * 確認する（問い合わせ対象の限定）。存在しない番号は結果に含まれない。
 * @param {string} repo `owner/name`
 * @param {number[]} issueNumbers
 * @param {string} token
 * @param {{gh?:Function}} [deps]
 * @returns {Promise<object>} issue 番号 → 'OPEN' | 'CLOSED'
 */
async function getIssueStates(repo, issueNumbers, token, deps = {}) {
    const ghFn = deps.gh || gh;
    const [owner, name] = repo.split('/');
    const out = {};
    const nums = [...new Set(issueNumbers)].filter((n) => Number.isInteger(n));
    for (let i = 0; i < nums.length; i += 100) {
        const chunk = nums.slice(i, i + 100);
        const fields = chunk.map((n) => `i${n}: issue(number:${n}){ number state }`).join(' ');
        const query = `query{repository(owner:"${owner}",name:"${name}"){ ${fields} }}`;
        let raw;
        try {
            raw = await ghFn(['api', 'graphql', '-f', `query=${query}`], { token });
        } catch (e) {
            // gh api graphql は alias の 1 つが NOT_FOUND（autopilot-after の番号 typo 等）でも
            // exit 1 になるが、**partial data は stdout に残る**。ここで捨てると typo 1 件で
            // closed 整合が丸ごと止まるため、partial data を採用する（見つからない番号は
            // 結果から欠落 = 呼び出し側で保守的に「未完了」扱いになる）。
            raw = (e.stdout || '').toString();
            if (!raw.trim().startsWith('{')) throw e;
        }
        let res;
        try {
            res = JSON.parse(raw.trim().split('\n')[0]);
        } catch {
            res = JSON.parse(raw);
        }
        const repoData = (res.data && res.data.repository) || {};
        for (const n of chunk) {
            const node = repoData[`i${n}`];
            if (node && node.state) out[n] = node.state;
        }
    }
    return out;
}

/**
 * Issue を close する（#843・冪等）。非デフォルト base 宛て PR では GitHub の `Closes #N` 自動 close が
 * 効かないため、merge-progression が leaf を Close へ前進させたとき GitHub issue も明示的に閉じる。
 * 既に closed なら `gh issue close` は no-op で成功する（冪等）。
 * @param {string} repo `owner/name`
 * @param {number} issueNumber
 * @param {string} token
 * @param {{gh?:Function}} [deps] gh 実行を差し替え可能（テスト用）
 */
async function closeIssue(repo, issueNumber, token, deps = {}) {
    const ghFn = deps.gh || gh;
    await ghFn(['issue', 'close', String(issueNumber), '--repo', repo], { token });
}

/**
 * 俯瞰ボード用の enrichment（sub-issue 進捗 + 連携 PR 群）を **1〜数回の GraphQL** で
 * まとめて取得する（#Web モニタ）。issue ごとに個別クエリを撃つと item 数に比例して
 * 遅くなるため、alias で 50 件ずつバッチする。
 * @param {string} repo `owner/name`
 * @param {number[]} issueNumbers
 * @param {string} token
 * @param {{gh?:Function}} [deps]
 * @returns {Promise<object>} issue 番号 → normalizeBoardEnrichment の結果
 */
async function getBoardEnrichment(repo, issueNumbers, token, deps = {}) {
    const ghFn = deps.gh || gh;
    const [owner, name] = repo.split('/');
    const out = {};
    const nums = [...new Set(issueNumbers)].filter((n) => Number.isInteger(n));
    for (let i = 0; i < nums.length; i += 50) {
        const chunk = nums.slice(i, i + 50);
        const fields = chunk.map((n) =>
            `i${n}: issue(number:${n}){ number state ` +
            'subIssuesSummary{ total completed percentCompleted } ' +
            'closedByPullRequestsReferences(first:10,includeClosedPrs:true){nodes{number state isDraft}} }',
        ).join(' ');
        const query = `query{repository(owner:"${owner}",name:"${name}"){ ${fields} }}`;
        const res = JSON.parse(await ghFn(
            ['api', 'graphql', '-H', 'GraphQL-Features: sub_issues', '-f', `query=${query}`],
            { token },
        ));
        const repoData = (res.data && res.data.repository) || {};
        for (const n of chunk) {
            const node = repoData[`i${n}`];
            if (node) out[n] = normalizeBoardEnrichment(node);
        }
    }
    return out;
}

/**
 * autopilot の head ブランチ（topic/autopilot-<N>）の PR を全状態で列挙する。
 * 非デフォルト base 宛て PR は close リンクに出ないため、ボード表示の補完に使う（#831 と同じ理由）。
 * @returns {Promise<Array<{number:number, state:string, isDraft:boolean}>>}
 */
async function listHeadPrs(repo, issueNumber, token, deps = {}) {
    const ghFn = deps.gh || gh;
    const out = await ghFn(
        ['pr', 'list', '--repo', repo, '--head', headBranchFor(issueNumber), '--state', 'all',
            '--json', 'number,state,isDraft', '--limit', '10'],
        { token },
    );
    const arr = JSON.parse(out);
    return (Array.isArray(arr) ? arr : []).map((p) => ({
        number: p.number,
        state: p.state,
        isDraft: Boolean(p.isDraft),
    }));
}

/**
 * rate_limit の残量を取得する（このエンドポイント自体はレート消費なし）。
 * @returns {Promise<{core:{remaining:number,limit:number}, graphql:{remaining:number,limit:number}}>}
 */
async function getRateLimit(token, deps = {}) {
    const ghFn = deps.gh || gh;
    const out = JSON.parse(await ghFn(['api', 'rate_limit'], { token }));
    const r = out.resources || {};
    const pick = (x) => (x ? { remaining: x.remaining, limit: x.limit, reset: x.reset } : undefined);
    return { core: pick(r.core), graphql: pick(r.graphql) };
}

/** applyResult が返す意図配列を Project に反映する */
async function applyIntents(ctx, itemId, intents, token) {
    const applied = [];
    for (const { field, value } of intents) {
        await setField(ctx, itemId, field, value, token);
        applied.push(`${field}=${value === null ? '(clear)' : value}`);
    }
    return applied;
}

module.exports = {
    botToken, readToken, boardToken, gh, getProject, getFields, listItems, normalizeProjectItem, findItemId, addIssue, setField, applyIntents,
    botLogin, findPrForIssue, selectClosingPr, selectHeadPr, hasMergedHeadPr,
    getPrReviewState, getGateContext, getIssueActivity, hasMergedPullRequest, REPO_ROOT,
    getPrInfo, getIssueLabels, getIssueBody, editLabels, setPrDraft, upsertStickyComment, upsertMarkedComment,
    listIssueComments,
    postIssueComment, listClosedIssueNumbers, getIssueStates, getIssueMeta, closeIssue,
    getBoardEnrichment, listHeadPrs, getRateLimit,
};
