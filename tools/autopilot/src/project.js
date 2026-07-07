'use strict';
/**
 * project.js — GitHub Projects v2 への読み書き（gh CLI ラッパ）。
 * 認証は bin/bot-token のインストールトークン。書き込みは gh project item-edit
 * を使う（手動検証済みの経路）。Status/AI Status/HITL/Size/Kind の単一ライターは
 * この層（daemon/CLI）であり、スキルは触らない。
 */

const { execFileSync } = require('child_process');
const path = require('path');
const {
    HITL_LABEL, selectStickyCommentIds, selectMarkedCommentIds, computeReviewApproval, autopilotHeadBranch,
} = require('./phases');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BOT_TOKEN_BIN = path.join(REPO_ROOT, 'bin', 'bot-token');

function botToken() {
    return execFileSync(BOT_TOKEN_BIN, [], { encoding: 'utf8' }).trim();
}

function gh(args, { token } = {}) {
    const env = { ...process.env, GH_TOKEN: token || botToken() };
    return execFileSync('gh', args, { encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 });
}

/** Project の id と number を取得 */
function getProject(owner, number, token) {
    const out = gh(['project', 'view', String(number), '--owner', owner, '--format', 'json'], { token });
    const j = JSON.parse(out);
    return { id: j.id, number: j.number, title: j.title, url: j.url };
}

/** フィールド定義を name -> {id, type, options:{optName:id}} で返す */
function getFields(owner, number, token) {
    const out = gh(['project', 'field-list', String(number), '--owner', owner, '--format', 'json'], { token });
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
function findItemId(owner, number, issueNumber, token) {
    const out = gh(['project', 'item-list', String(number), '--owner', owner, '--format', 'json', '--limit', '1000'], { token });
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
function listItems(owner, number, token) {
    const out = gh(['project', 'item-list', String(number), '--owner', owner, '--format', 'json', '--limit', '1000'], { token });
    const items = JSON.parse(out).items || [];
    return items
        .filter((i) => i.content && typeof i.content.number === 'number')
        .map(normalizeProjectItem);
}

/** Issue を project に追加して item id を返す（既にあれば既存を返す） */
function addIssue(owner, number, repo, issueNumber, token) {
    const existing = findItemId(owner, number, issueNumber, token);
    if (existing) return existing;
    const url = `https://github.com/${repo}/issues/${issueNumber}`;
    const out = gh(['project', 'item-add', String(number), '--owner', owner, '--url', url, '--format', 'json'], { token });
    return JSON.parse(out).id;
}

/**
 * 1 フィールドを設定する。value=null はクリア。
 * @param {object} ctx { projectId, fields }（getFields 結果）
 */
function setField(ctx, itemId, fieldName, value, token) {
    const f = ctx.fields[fieldName];
    if (!f) throw new Error(`unknown field: ${fieldName}`);
    const base = ['project', 'item-edit', '--id', itemId, '--project-id', ctx.projectId, '--field-id', f.id];
    if (value === null) {
        gh([...base, '--clear'], { token });
        return;
    }
    if (f.type === 'ProjectV2SingleSelectField') {
        const optId = f.options[value];
        if (!optId) throw new Error(`field ${fieldName} has no option "${value}"`);
        gh([...base, '--single-select-option-id', optId], { token });
    } else {
        gh([...base, '--text', String(value)], { token });
    }
}

/**
 * bot の GraphQL author login（= App slug。コメント作者の human/bot 判定に使う）。
 * `bin/bot-token --bot-email` は "<slug>[bot]\t<id>+<slug>[bot]@..." を返すので slug を取り出す。
 * @returns {string}
 */
function botLogin() {
    const out = execFileSync(BOT_TOKEN_BIN, ['--bot-email'], { encoding: 'utf8' }).trim();
    const name = (out.split(/\s+/)[0] || '').trim();
    return name.replace(/\[bot\]$/, '');
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
function findPrForIssue(repo, issueNumber, token, deps = {}) {
    const ghFn = deps.gh || gh;
    const [owner, name] = repo.split('/');
    const query =
        'query($owner:String!,$name:String!,$num:Int!){' +
        'repository(owner:$owner,name:$name){issue(number:$num){' +
        'closedByPullRequestsReferences(first:20,includeClosedPrs:true){nodes{' +
        'number state isDraft headRefName baseRefName labels(first:20){nodes{name}}}}}}}';
    const out = ghFn(
        ['api', 'graphql', '-f', `query=${query}`,
            '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `num=${issueNumber}`],
        { token },
    );
    const issue = JSON.parse(out)?.data?.repository?.issue;
    const nodes = (issue && issue.closedByPullRequestsReferences && issue.closedByPullRequestsReferences.nodes) || [];
    const viaLink = selectClosingPr(nodes);
    if (viaLink) return viaLink;
    // close リンクが無い（非デフォルト base 宛て PR 等）→ head ブランチで base 非依存に解決（#831）
    const listOut = ghFn(
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
 * - unresolvedHumanComments: 人間が立てた未解決レビュースレッド数（bot は除外）
 * @returns {{approved:boolean, changesRequested:boolean, unresolvedHumanComments:number}}
 */
function getPrReviewState(repo, prNumber, token) {
    const [owner, name] = repo.split('/');
    const query = `query($owner:String!,$name:String!,$pr:Int!){
      repository(owner:$owner,name:$name){
        pullRequest(number:$pr){
          reviewDecision
          reviews(last:100){nodes{author{login} state}}
          reviewThreads(first:100){nodes{isResolved comments(first:1){nodes{author{login}}}}}
        }
      }
    }`;
    const out = gh(
        ['api', 'graphql', '-f', `query=${query}`,
            '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `pr=${prNumber}`],
        { token },
    );
    const pr = JSON.parse(out).data.repository.pullRequest;
    const bot = botLogin();
    const isHuman = (login) => Boolean(login) && login !== bot && !login.endsWith('[bot]');
    const threads = (pr.reviewThreads && pr.reviewThreads.nodes) || [];
    const unresolvedHumanComments = threads.filter(
        (t) => !t.isResolved && (t.comments.nodes || []).some((c) => isHuman(c.author && c.author.login)),
    ).length;
    const reviews = (pr.reviews && pr.reviews.nodes) || [];
    const { approved, changesRequested } = computeReviewApproval(reviews, pr.reviewDecision, isHuman);
    return { approved, changesRequested, unresolvedHumanComments };
}

/**
 * Review item の付帯情報（HITL 解除シグナル + PR レビュー状態 + PR 番号）を集める。
 * phaseForItem の ctx として渡す。PR が無ければ null（Review なのに PR 無し＝待つ）。
 *
 * 解除シグナルは OR セマンティクス（contract §7・#813 でラベル一本化）: Issue の `🙋 HITL`
 * ラベル / PR の `🙋 HITL` ラベルのいずれか1つでも除去なら解除。daemon が両面を atomic に
 * 同期するため、人間は目の前の PR ラベルを外すだけで差し戻せる。HITL フィールドは見ない。
 * @param {string} repo
 * @param {number} issueNumber
 * @param {string} token
 * @returns {{hitlSignals:object, review:object, pr:number}|null}
 */
function getReviewContext(repo, issueNumber, token) {
    const pr = findPrForIssue(repo, issueNumber, token);
    if (!pr) return null;
    const issueLabels = getIssueLabels(repo, issueNumber, token);
    return {
        hitlSignals: {
            issueLabel: issueLabels.includes(HITL_LABEL),
            prLabel: (pr.labels || []).includes(HITL_LABEL),
        },
        review: getPrReviewState(repo, pr.number, token),
        pr: pr.number,
    };
}

/**
 * PR の現在の面状態（Draft かどうか + ラベル名配列）を返す。投影の差分計算に使う。
 * @returns {{isDraft:boolean, labels:string[]}}
 */
function getPrInfo(repo, prNumber, token) {
    const out = gh(['pr', 'view', String(prNumber), '--repo', repo, '--json', 'isDraft,labels'], { token });
    const j = JSON.parse(out);
    return { isDraft: Boolean(j.isDraft), labels: (j.labels || []).map((l) => l.name) };
}

/**
 * Issue の現在のラベル名配列を返す。
 * @returns {string[]}
 */
function getIssueLabels(repo, issueNumber, token) {
    const out = gh(['issue', 'view', String(issueNumber), '--repo', repo, '--json', 'labels'], { token });
    return (JSON.parse(out).labels || []).map((l) => l.name);
}

/**
 * Issue の本文（Markdown）を返す。DoD 引き継ぎでチェックリストを抜き出すのに使う（#821）。
 * @returns {string}
 */
function getIssueBody(repo, issueNumber, token) {
    const out = gh(['issue', 'view', String(issueNumber), '--repo', repo, '--json', 'body'], { token });
    return JSON.parse(out).body || '';
}

/**
 * Issue または PR のラベルを編集する（add/remove の差分。空なら何もしない）。
 * @param {string} type 'issue' | 'pr'
 * @param {{add?:string[], remove?:string[]}} diff
 */
function editLabels(repo, number, type, diff, token) {
    const add = diff.add || [];
    const remove = diff.remove || [];
    if (!add.length && !remove.length) return;
    const args = [type, 'edit', String(number), '--repo', repo];
    for (const l of add) args.push('--add-label', l);
    for (const l of remove) args.push('--remove-label', l);
    gh(args, { token });
}

/**
 * PR の Draft/Ready を切り替える。'ready' → レビュー受付、'draft' → Draft へ戻す。
 * @param {'ready'|'draft'} action
 */
function setPrDraft(repo, prNumber, action, token) {
    const args = ['pr', 'ready', String(prNumber), '--repo', repo];
    if (action === 'draft') args.push('--undo');
    gh(args, { token });
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
function listIssueComments(repo, number, token) {
    const out = gh(
        ['api', '--paginate', `repos/${repo}/issues/${number}/comments`,
            '--jq', '.[] | "\\(.id) \\(.body | @base64)"'],
        { token },
    ).trim();
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
function upsertStickyComment(repo, number, body, token) {
    upsertByIds(repo, number, selectStickyCommentIds(listIssueComments(repo, number, token)), body, token);
}

/**
 * 任意マーカーの 1 コメントを upsert する（汎用版）。対応 PR リンク sticky（PR_LINK_MARKER）等、
 * sticky ステータス以外のマーカー付き管理コメントに使う。重複は先頭に集約する。
 * @param {string} repo `owner/name`
 * @param {number} number Issue/PR 番号
 * @param {string[]} markers 識別マーカー（いずれかを含む既存コメントを更新対象にする）
 * @param {string} body 新しい本文（マーカーを含めること）
 */
function upsertMarkedComment(repo, number, markers, body, token) {
    upsertByIds(repo, number, selectMarkedCommentIds(listIssueComments(repo, number, token), markers), body, token);
}

/** upsert の共通処理: 既存 id 群の先頭を PATCH（無ければ POST）、残りは DELETE で集約 */
function upsertByIds(repo, number, ids, body, token) {
    if (ids.length === 0) {
        gh(['api', '--method', 'POST', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`], { token });
        return;
    }
    const [keep, ...dupes] = ids;
    gh(['api', '--method', 'PATCH', `repos/${repo}/issues/comments/${keep}`, '-f', `body=${body}`], { token });
    for (const dup of dupes) {
        gh(['api', '--method', 'DELETE', `repos/${repo}/issues/comments/${dup}`], { token });
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
function postIssueComment(repo, number, body, token) {
    gh(['api', '--method', 'POST', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`], { token });
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
function hasMergedPullRequest(repo, issueNumber, token, deps = {}) {
    const ghFn = deps.gh || gh;
    const [owner, name] = repo.split('/');
    const query =
        'query($owner:String!,$name:String!,$num:Int!){' +
        'repository(owner:$owner,name:$name){issue(number:$num){' +
        'closedByPullRequestsReferences(first:20,includeClosedPrs:true){nodes{merged}}}}}';
    const out = ghFn(
        ['api', 'graphql', '-f', `query=${query}`, '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `num=${issueNumber}`],
        { token },
    );
    const issue = JSON.parse(out)?.data?.repository?.issue;
    const nodes = (issue && issue.closedByPullRequestsReferences && issue.closedByPullRequestsReferences.nodes) || [];
    if (nodes.some((n) => n.merged === true)) return true;
    // close リンクに無い → head ブランチで非デフォルト base への merge を検知（#831）
    const listOut = ghFn(
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
function listClosedIssueNumbers(repo, token, deps = {}) {
    const ghFn = deps.gh || gh;
    const out = ghFn(
        ['issue', 'list', '--repo', repo, '--state', 'closed', '--limit', '1000', '--json', 'number'],
        { token },
    );
    const arr = JSON.parse(out);
    return new Set((Array.isArray(arr) ? arr : []).map((i) => i.number));
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
function closeIssue(repo, issueNumber, token, deps = {}) {
    const ghFn = deps.gh || gh;
    ghFn(['issue', 'close', String(issueNumber), '--repo', repo], { token });
}

/** applyResult が返す意図配列を Project に反映する */
function applyIntents(ctx, itemId, intents, token) {
    const applied = [];
    for (const { field, value } of intents) {
        setField(ctx, itemId, field, value, token);
        applied.push(`${field}=${value === null ? '(clear)' : value}`);
    }
    return applied;
}

module.exports = {
    botToken, gh, getProject, getFields, listItems, normalizeProjectItem, findItemId, addIssue, setField, applyIntents,
    botLogin, findPrForIssue, selectClosingPr, selectHeadPr, hasMergedHeadPr,
    getPrReviewState, getReviewContext, hasMergedPullRequest, REPO_ROOT,
    getPrInfo, getIssueLabels, getIssueBody, editLabels, setPrDraft, upsertStickyComment, upsertMarkedComment,
    listIssueComments,
    postIssueComment, listClosedIssueNumbers, closeIssue,
};
