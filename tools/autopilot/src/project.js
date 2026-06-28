'use strict';
/**
 * project.js — GitHub Projects v2 への読み書き（gh CLI ラッパ）。
 * 認証は bin/bot-token のインストールトークン。書き込みは gh project item-edit
 * を使う（手動検証済みの経路）。Status/AI Status/HITL/Size/Kind の単一ライターは
 * この層（daemon/CLI）であり、スキルは触らない。
 */

const { execFileSync } = require('child_process');
const path = require('path');

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
    hasMergedPullRequest, REPO_ROOT,
};
