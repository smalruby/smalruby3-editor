'use strict';
/**
 * project.js — GitHub Projects v2 への読み書き（gh CLI ラッパ）。
 * 認証は bin/bot-token のインストールトークン。書き込みは gh project item-edit
 * を使う（手動検証済みの経路）。Status/AI Status/HITL/Size/Kind の単一ライターは
 * この層（daemon/CLI）であり、スキルは触らない。
 */

const { execFileSync } = require('child_process');
const path = require('path');
const { HITL_LABEL, STICKY_MARKER } = require('./phases');

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
 * Project の全 item をフィールド値つきで返す（daemon のポーリング用）。
 * gh の item-list JSON のキー揺れ（"aI Status" / "hITL"）を正規化する。
 * @returns {Array<{issue, itemId, status, aiStatus, hitl, kind, size, title}>}
 */
function listItems(owner, number, token) {
    const out = gh(['project', 'item-list', String(number), '--owner', owner, '--format', 'json', '--limit', '1000'], { token });
    const items = JSON.parse(out).items || [];
    return items
        .filter((i) => i.content && typeof i.content.number === 'number')
        .map((i) => ({
            issue: i.content.number,
            itemId: i.id,
            title: i.content.title,
            status: i.status,
            aiStatus: i['aI Status'] ?? i.aiStatus,
            hitl: i.hITL ?? i.hitl,
            kind: i.kind,
            size: i.size,
        }));
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
 * Issue にひも付く open PR を返す（implement が PR 本文に `Closes #N` を書く規約）。
 * labels は名前配列に正規化して返す。
 * @returns {{number:number, labels:string[], isDraft:boolean}|null} 無ければ null
 */
function findPrForIssue(repo, issueNumber, token) {
    const out = gh(
        ['pr', 'list', '--repo', repo, '--search', `Closes #${issueNumber} in:body`,
            '--state', 'open', '--json', 'number,labels,isDraft', '--limit', '1'],
        { token },
    );
    const prs = JSON.parse(out);
    if (!prs.length) return null;
    const pr = prs[0];
    return { number: pr.number, labels: (pr.labels || []).map((l) => l.name), isDraft: pr.isDraft };
}

/**
 * PR のレビュー状態を reviewPhase 用に正規化して返す。
 * - approved: GitHub の集約判定 reviewDecision === 'APPROVED'
 * - changesRequested: reviewDecision === 'CHANGES_REQUESTED'
 * - unresolvedHumanComments: 人間が立てた未解決レビュースレッド数（bot は除外）
 * @returns {{approved:boolean, changesRequested:boolean, unresolvedHumanComments:number}}
 */
function getPrReviewState(repo, prNumber, token) {
    const [owner, name] = repo.split('/');
    const query = `query($owner:String!,$name:String!,$pr:Int!){
      repository(owner:$owner,name:$name){
        pullRequest(number:$pr){
          reviewDecision
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
    return {
        approved: pr.reviewDecision === 'APPROVED',
        changesRequested: pr.reviewDecision === 'CHANGES_REQUESTED',
        unresolvedHumanComments,
    };
}

/**
 * Review item の付帯情報（HITL 解除シグナル + PR レビュー状態 + PR 番号）を集める。
 * phaseForItem の ctx として渡す。PR が無ければ null（Review なのに PR 無し＝待つ）。
 *
 * 解除シグナルは OR セマンティクス（contract §7）: Project の HITL フィールド /
 * Issue の `🙋 HITL` ラベル / PR の `🙋 HITL` ラベルのいずれか1つでも No/除去なら解除。
 * #794 で daemon が全面を atomic に同期するようになったため、ラベルでの OR 解除が
 * 健全に機能する（人間は目の前の PR ラベルを外すだけで差し戻せる）。
 * @param {string} repo
 * @param {number} issueNumber
 * @param {string} projectHitl Project の HITL フィールド値（'Yes'/'No' 等）
 * @param {string} token
 * @returns {{hitlSignals:object, review:object, pr:number}|null}
 */
function getReviewContext(repo, issueNumber, projectHitl, token) {
    const pr = findPrForIssue(repo, issueNumber, token);
    if (!pr) return null;
    const issueLabels = getIssueLabels(repo, issueNumber, token);
    return {
        hitlSignals: {
            projectField: projectHitl === 'Yes',
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
 * sticky ステータスコメントを upsert する（マーカー付きの 1 コメントを編集し続ける）。
 * 既存（マーカーを含むコメント）があれば PATCH、無ければ新規 POST。PR/Issue 共通の
 * issues コメント API を使う。
 */
function upsertStickyComment(repo, number, body, token) {
    const listed = gh(
        ['api', '--paginate', `repos/${repo}/issues/${number}/comments`,
            '--jq', `.[] | select(.body | contains("${STICKY_MARKER}")) | .id`],
        { token },
    ).trim();
    const id = listed ? listed.split('\n')[0].trim() : '';
    if (id) {
        gh(['api', '--method', 'PATCH', `repos/${repo}/issues/comments/${id}`, '-f', `body=${body}`], { token });
    } else {
        gh(['api', '--method', 'POST', `repos/${repo}/issues/${number}/comments`, '-f', `body=${body}`], { token });
    }
}

/**
 * 指定 Issue に紐付く PR の中に merge 済みのものがあるか。
 * GitHub の "Development" リンク（PR 本文の `Closes #<issue>` など）を
 * `closedByPullRequestsReferences` で辿る。autopilot は自動 merge しないので、
 * これは人間の手動 merge を検知するための読み取り。
 * @param {string} repo `owner/name`
 * @param {number} issueNumber
 * @returns {boolean} merge 済み PR が 1 つでもあれば true
 */
function hasMergedPullRequest(repo, issueNumber, token) {
    const [owner, name] = repo.split('/');
    const query =
        'query($owner:String!,$name:String!,$num:Int!){' +
        'repository(owner:$owner,name:$name){issue(number:$num){' +
        'closedByPullRequestsReferences(first:20,includeClosedPrs:true){nodes{merged}}}}}';
    const out = gh(
        ['api', 'graphql', '-f', `query=${query}`, '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `num=${issueNumber}`],
        { token },
    );
    const issue = JSON.parse(out)?.data?.repository?.issue;
    const nodes = (issue && issue.closedByPullRequestsReferences && issue.closedByPullRequestsReferences.nodes) || [];
    return nodes.some((n) => n.merged === true);
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
    botToken, gh, getProject, getFields, listItems, findItemId, addIssue, setField, applyIntents,
    botLogin, findPrForIssue, getPrReviewState, getReviewContext, hasMergedPullRequest, REPO_ROOT,
    getPrInfo, getIssueLabels, editLabels, setPrDraft, upsertStickyComment,
};
