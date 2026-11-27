'use strict';
/**
 * epic-pr.js — EPIC の topic → develop の draft PR（#2473）の判断（純粋関数のみ）。
 *
 * `.claude/rules/topic-branches.md` は「topic に最初の変更が入ったら topic → develop の PR を draft で作り、
 * 本文にプレビューの URL と、どの sub-issue まで入ったかを書いて、マージのたびに直す」と決めている。
 * daemon が子の PR を topic へマージしたあと（と起動時）に、ここの {@link epicPrPlan} で
 * 「作る / 本文を直す / 進み具合のコメントを書く / 何もしない」を決める。I/O は project.js と epic-merge.js。
 *
 * - 本文は daemon だけが書く（単一ライター）。目印 `<!-- autopilot-epic-pr epic=N -->` を先頭に置く。
 * - 人間が作った PR（目印なし）の本文は書きかえず、目印付きのコメント 1 つで進み具合を出す。
 * - I/O・時計・乱数を持ち込まない（プレビューの slug の hash は入力だけで決まる）。
 */

const crypto = require('crypto');
const { AUTOPILOT_BRANCH_PREFIX, TERMINAL_STATUSES } = require('./phases');
const { ciStateFromRollup } = require('./epic-flow');

/** daemon が作った topic → develop の PR の本文の目印（前方一致で探す） */
const EPIC_PR_MARKER = '<!-- autopilot-epic-pr ';

/** 人間が作った topic → develop の PR に書く、進み具合のコメントの目印（前方一致で探す） */
const EPIC_PR_STATUS_MARKER = '<!-- autopilot-epic-pr-status';

/** ブランチのプレビューの置き場（`scripts/preview-slug.mjs` と同じ規則の slug を付ける） */
const PREVIEW_BASE_URL = 'https://preview.smalruby.app';

/** slug の長さの上限（DNS のラベルと同じ。`scripts/preview-slug.mjs` の PREVIEW_SLUG_MAX_LENGTH） */
const PREVIEW_SLUG_MAX_LENGTH = 63;

const PREVIEW_HASH_LENGTH = 8;

/** sub-issue の状態の表示（topic に入った / 作業中 / 待ち / 閉じた） */
const CHILD_STATE_LABELS = {
    merged: '✅ topic に入った',
    working: '🚧 作業中',
    waiting: '⏳ 待ち',
    closed: '⛔ 閉じた（topic に入っていない）',
};

/** PR が無くても「作業中」とみなす Project の Status */
const WORKING_STATUSES = new Set(['In Progress', 'Review', 'DoD', 'Blocked']);

/**
 * @param {number} epic
 * @returns {string} PR の本文の 1 行目
 */
function epicPrMarker(epic) {
    return `<!-- autopilot-epic-pr epic=${epic} -->`;
}

/**
 * @param {number} epic
 * @returns {string} 人間が作った PR に書くコメントの 1 行目
 */
function epicPrStatusMarker(epic) {
    return `<!-- autopilot-epic-pr-status epic=${epic} -->`;
}

/**
 * ブランチのプレビューの slug。`scripts/preview-slug.mjs`（CI が使う ESM）と同じ規則を CommonJS で持つ
 * （autopilot は依存を足さず CommonJS のまま・`.claude/rules/autopilot/development.md`）。
 * 規則を変えたら両方を直す（test/epic-pr.test.js が同じ値になることを確かめる）。
 * @param {string} branch
 * @returns {string}
 */
function previewSlug(branch) {
    if (typeof branch !== 'string' || branch === '') throw new Error('previewSlug: branch name is required');
    const shortHash = (name) => crypto.createHash('sha1').update(name).digest('hex').slice(0, PREVIEW_HASH_LENGTH);
    const trimHyphens = (s) => s.replace(/^-+|-+$/g, '');
    const slug = trimHyphens(branch.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    if (slug === '') return `b-${shortHash(branch)}`;
    if (slug === branch && slug.length <= PREVIEW_SLUG_MAX_LENGTH) return slug;
    const head = trimHyphens(slug.slice(0, PREVIEW_SLUG_MAX_LENGTH - PREVIEW_HASH_LENGTH - 1));
    return `${head}-${shortHash(branch)}`;
}

/**
 * @param {string} branch
 * @returns {string} `https://preview.smalruby.app/<slug>/`
 */
function previewUrlForBranch(branch) {
    return `${PREVIEW_BASE_URL}/${previewSlug(branch)}/`;
}

/**
 * PR の題。commitlint の対象外だが、ほかの PR とそろえて小文字始まりにする（`epic:` で始まるので
 * EPIC の題そのものは変えない。`GA` / `Ruby` / `DNCL` などの頭文字を崩さないため）。
 * EPIC の題が既に `EPIC:` / `epic(scope):` で始まるときは、`epic: epic: ...` と重ねず接頭辞の大文字だけそろえる。
 * @param {string} epicTitle
 * @returns {string} `epic: <EPIC の題>`
 */
function epicPrTitle(epicTitle) {
    const t = String(epicTitle || '').replace(/\s+/g, ' ').trim();
    const m = t.match(/^epic(\([^)]*\))?:\s*/i);
    if (m) return `epic${m[1] || ''}: ${t.slice(m[0].length)}`.trim();
    return `epic: ${t}`.trim();
}

/**
 * autopilot の head ブランチ（`topic/autopilot-<N>`）から Issue 番号を取る。それ以外（topic そのもの・
 * 別案の `-alt-` など）は null。
 * @param {string} head
 * @param {string} [prefix]
 * @returns {number|null}
 */
function issueFromHeadBranch(head, prefix = AUTOPILOT_BRANCH_PREFIX) {
    const s = String(head || '');
    if (!s.startsWith(prefix)) return null;
    const rest = s.slice(prefix.length);
    return /^\d+$/.test(rest) ? Number(rest) : null;
}

/**
 * sub-issue ごとの状態と PR。
 * - topic 宛ての PR がマージ済み → merged
 * - open な PR がある、または Project の Status が作業中（{@link WORKING_STATUSES}）→ working
 * - Issue が閉じている、または Project の Status が終端（Close / Done）→ closed
 * - それ以外 → waiting
 * @param {Array<{number:number, title:string, state:string}>} subIssues
 * @param {Array<{number:number, state:string, headRefName:string}>} childPrs topic 宛ての PR
 * @param {object} [statuses] issue → Project の Status
 * @returns {Array<{issue:number, title:string, state:string, pr:(number|null)}>}
 */
function childStates(subIssues, childPrs, statuses = {}) {
    const byIssue = new Map();
    for (const pr of childPrs || []) {
        const n = pr && issueFromHeadBranch(pr.headRefName);
        if (!n) continue;
        const list = byIssue.get(n) || [];
        list.push(pr);
        byIssue.set(n, list);
    }
    return (subIssues || []).filter(Boolean).map((s) => {
        const prs = byIssue.get(s.number) || [];
        const merged = prs.find((p) => p.state === 'MERGED');
        const open = prs.find((p) => p.state === 'OPEN');
        const status = (statuses || {})[s.number];
        // 🧱 infra の子は develop へ直接マージされ、prod に出るまで Issue が開いたまま Project だけ Close になる
        const closed = s.state === 'CLOSED' || TERMINAL_STATUSES.has(status);
        let state = 'waiting';
        if (merged) state = 'merged';
        else if (open || (!closed && WORKING_STATUSES.has(status))) state = 'working';
        else if (closed) state = 'closed';
        const pr = (merged || open || null);
        return { issue: s.number, title: s.title || '', state, pr: pr ? pr.number : null };
    }).sort((a, b) => a.issue - b.issue);
}

/** 表のセルに入れる 1 行（`|` と改行を消す） */
function cell(s) {
    return String(s || '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '｜').trim();
}

/**
 * 本文とコメントの共通部分（プレビュー・sub-issue の表・マージの決まり）。
 * @param {{topic:string, base:string, children:object[]}} p
 * @returns {string[]}
 */
function progressLines({ topic, base, children, preview = null }) {
    const merged = children.filter((c) => c.state === 'merged').length;
    // 書くのは競合だけ。CI を待つあいだの状態（no-ci / building）は本文を直す次の機会まで残り、古い文になるため
    // （競合は develop を取り込んだあとに本文を直すので消える・#2485）
    const note = preview && preview.state === 'conflict' ? previewStatusText(preview, base) : null;
    const lines = [
        '## プレビュー',
        '',
        previewUrlForBranch(topic),
        '',
        ...(note ? [`⚠️ ${note}`, ''] : []),
        `## sub-issue（topic に入った: ${merged} / ${children.length}）`,
        '',
        '| sub-issue | 状態 | PR |',
        '|---|---|---|',
    ];
    for (const c of children) {
        lines.push(`| #${c.issue} ${cell(c.title)} | ${CHILD_STATE_LABELS[c.state] || c.state} | ${c.pr ? `#${c.pr}` : '—'} |`);
    }
    lines.push(
        '',
        `## ${base} へのマージ`,
        '',
        `${base} へのマージは、人間がリリース確認のあとで行います（autopilot はマージしません）。`,
    );
    return lines;
}

/**
 * daemon が作る topic → develop の PR の本文。EPIC は `Refs`（topic → develop のマージで閉じるかは人間が決める）。
 * @param {{epic:number, topic:string, base:string, children:object[]}} p
 * @returns {string}
 */
function renderEpicPrBody({ epic, topic, base = 'develop', children = [], preview = null }) {
    return [
        epicPrMarker(epic),
        `EPIC #${epic} の topic ブランチ \`${topic}\` を ${base} へ出す PR です。`,
        'autopilot が sub-issue を topic にマージするたびに、この本文を直します。',
        '',
        `Refs #${epic}`,
        '',
        ...progressLines({ topic, base, children, preview }),
        '',
        '---',
        'この本文は autopilot の daemon が書きます（手で直しても次の更新で上書きされます）。コメントは自由に書けます。',
    ].join('\n');
}

/**
 * 人間が作った topic → develop の PR に書く、進み具合のコメント（本文は書きかえない）。
 * @param {{epic:number, topic:string, base:string, children:object[]}} p
 * @returns {string}
 */
function renderEpicPrStatusComment({ epic, topic, base = 'develop', children = [], preview = null }) {
    return [
        epicPrStatusMarker(epic),
        `EPIC #${epic} の進み具合です（autopilot が sub-issue を topic にマージするたびに、このコメントを直します）。`,
        '',
        ...progressLines({ topic, base, children, preview }),
    ].join('\n');
}

/**
 * topic → develop の open な PR から、この EPIC の PR を選ぶ。目印付き（daemon が作った）を先に選ぶ。
 * @param {Array<{number:number, body:string}>} prs
 * @param {number} epic
 * @returns {{number:number, managed:boolean}|null}
 */
function selectEpicPr(prs, epic) {
    const list = (prs || []).filter(Boolean);
    const managed = list.find((p) => String(p.body || '').includes(epicPrMarker(epic)));
    if (managed) return { number: managed.number, managed: true };
    // 別の EPIC の目印を持つ PR は選ばない（同じ topic を 2 つの EPIC が使うことは無いはずだが、念のため）
    const human = list.find((p) => !String(p.body || '').includes(EPIC_PR_MARKER));
    return human ? { number: human.number, managed: false } : null;
}

/** GitHub が改行を `\r\n` にしても同じとみなす */
function sameBody(a, b) {
    const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trim();
    return norm(a) === norm(b);
}

/**
 * topic → develop の PR をどうするか。
 * @param {object} facts project.getEpicPrFacts の結果
 *   `{epic:{number,title,state}, topic, branchExists, subIssues, childPrs, topicPrs:[{number, body}]}`
 * @param {{base?:string, statuses?:object}} [opts]
 * @returns {{action:'create'|'update'|'comment'|'skip', reason:string, pr?:number, title?:string, body?:string}}
 */
function epicPrPlan(facts, opts = {}) {
    const base = opts.base || 'develop';
    if (!facts || !facts.epic) return { action: 'skip', reason: 'EPIC が見つかりません' };
    if (facts.epic.state === 'CLOSED') return { action: 'skip', reason: 'EPIC は閉じています' };
    if (!facts.topic || facts.topic === base) return { action: 'skip', reason: 'topic ブランチがありません' };
    if (facts.branchExists === false) return { action: 'skip', reason: `${facts.topic} がもうありません` };
    const children = childStates(facts.subIssues, facts.childPrs, opts.statuses);
    if (!children.some((c) => c.state === 'merged')) return { action: 'skip', reason: 'まだ topic に入った sub-issue がありません' };
    const existing = selectEpicPr(facts.topicPrs, facts.epic.number);
    const currentPr = existing ? (facts.topicPrs || []).find((x) => x && x.number === existing.number) : null;
    // PR がまだ無いときは、作った直後なので状態を書かない（CI はこれから動く）。mergeable を読めていないときも書かない
    const preview = currentPr && currentPr.mergeable ? previewStatus(currentPr) : null;
    const p = { epic: facts.epic.number, topic: facts.topic, base, children, preview };
    if (!existing) {
        return { action: 'create', reason: 'topic → develop の PR がありません', title: epicPrTitle(facts.epic.title), body: renderEpicPrBody(p) };
    }
    if (!existing.managed) {
        // 人間の PR。コメントの upsert（project.upsertMarkedComment）は、同じ本文なら書かない
        return { action: 'comment', reason: '人間が作った PR があります', pr: existing.number, body: renderEpicPrStatusComment(p) };
    }
    const body = renderEpicPrBody(p);
    const current = currentPr;
    if (current && sameBody(current.body, body)) return { action: 'skip', reason: '本文は変わっていません', pr: existing.number };
    return { action: 'update', reason: '進み具合が変わりました', pr: existing.number, body };
}

/**
 * 最近マージされた PR の一覧から、topic 宛てにマージされた autopilot の子の PR を topic ごとに 1 つ選ぶ
 * （daemon の起動時に、既に子が topic に入っている EPIC の PR を作るため）。新しいものから並んでいる前提。
 * @param {Array<{number:number, baseRefName:string, headRefName:string}>} prs
 * @param {(base:string) => boolean} isTopic
 * @returns {Array<{issue:number, base:string}>}
 */
function topicMergeTargets(prs, isTopic) {
    const seen = new Set();
    const out = [];
    for (const pr of prs || []) {
        if (!pr || !isTopic(pr.baseRefName) || seen.has(pr.baseRefName)) continue;
        const issue = issueFromHeadBranch(pr.headRefName);
        if (!issue) continue;
        seen.add(pr.baseRefName);
        out.push({ issue, base: pr.baseRefName });
    }
    return out;
}

/** CI のプレビューを出すジョブの名前（`.github/workflows/ci-cd.yml` の `preview-deploy`） */
const PREVIEW_CHECK_RE = /preview/i;

/**
 * topic → develop の PR のプレビューの状態（純粋関数・#2485）。
 * GitHub は base と競合している PR では `pull_request` の workflow を動かさないので、競合しているあいだは
 * プレビューが作られない。人間に開けない URL を「確かめる場所」として渡さないため、ここで状態を決める。
 * @param {{mergeable?:string, statusCheckRollup?:object[]}|null} pr topic → develop の PR
 *   （`mergeable`: MERGEABLE / CONFLICTING / UNKNOWN）
 * @param {{httpStatus?:(number|null)}} [opts] プレビューの URL を開いたときの HTTP の状態（分からなければ null）
 * @returns {{ready:boolean, state:'no-pr'|'conflict'|'no-ci'|'building'|'failed'|'missing'|'ready'}}
 */
function previewStatus(pr, opts = {}) {
    if (!pr) return { ready: false, state: 'no-pr' };
    const http = Number.isInteger(opts.httpStatus) ? opts.httpStatus : null;
    if (pr.mergeable === 'CONFLICTING') return { ready: false, state: 'conflict' };
    const checks = Array.isArray(pr.statusCheckRollup) ? pr.statusCheckRollup.filter(Boolean) : [];
    if (!checks.length) return { ready: false, state: 'no-ci' };
    const preview = checks.filter((c) => PREVIEW_CHECK_RE.test(String(c.name || c.context || '')));
    if (preview.length) {
        const ci = ciStateFromRollup(preview);
        if (ci === 'pending') return { ready: false, state: 'building' };
        if (ci === 'failure') return { ready: false, state: 'failed' };
        // 成功しても skip（conclusion=SKIPPED）だけなら作られていない
        if (preview.every((c) => String(c.conclusion || '').toUpperCase() === 'SKIPPED')) return { ready: false, state: 'missing' };
    } else if (ciStateFromRollup(checks) === 'pending') {
        return { ready: false, state: 'building' };
    }
    if (http !== null && http !== 200) return { ready: false, state: 'missing' };
    if (!preview.length && http === null) return { ready: false, state: 'missing' };
    return { ready: true, state: 'ready' };
}

/**
 * プレビューの状態を人間に見せる一文（純粋関数・#2485）。epic-pr の本文とリリース確認の観点のコメントで使う。
 * @param {{state:string}} status {@link previewStatus} の結果
 * @param {string} [base]
 * @returns {string}
 */
function previewStatusText(status, base = 'develop') {
    switch (status && status.state) {
    case 'ready': return 'プレビューはできています。';
    case 'no-pr': return `プレビューはまだできていません（topic → ${base} の PR がありません）。`;
    case 'conflict': return `${base} と競合しています。プレビューはまだありません（競合している PR では CI が動きません。autopilot が ${base} を topic に取り込みます）。`;
    case 'no-ci': return 'プレビューはまだできていません（CI がまだ動いていません）。';
    case 'building': return 'プレビューはまだできていません（CI が作っているところです）。';
    case 'failed': return 'プレビューはまだできていません（プレビューを作る CI が落ちています）。';
    default: return 'プレビューはまだできていません（プレビューの URL が開けません）。';
    }
}

/**
 * develop を topic に取り込むブランチ（#2485）。`topic/autopilot-<N>` の形にしない（子の PR と取り違えない）。
 * @param {string} topic
 * @param {string} [base]
 * @returns {string}
 */
function topicSyncBranch(topic, base = 'develop') {
    return `${topic}-sync-${base}`;
}

/** develop を topic に取り込む PR の本文の目印 */
function topicSyncMarker(epic) {
    return `<!-- autopilot-topic-sync epic=${epic} -->`;
}

/**
 * develop を topic に取り込む PR の本文（#2485）。
 * @param {{epic:number, topic:string, base?:string, topicPr?:(number|null), summary?:string}} p
 * @returns {string}
 */
function renderTopicSyncBody({ epic, topic, base = 'develop', topicPr = null, summary = '' }) {
    return [
        topicSyncMarker(epic),
        `\`${base}\` を EPIC #${epic} の topic ブランチ \`${topic}\` に取り込む PR です。`,
        `topic → ${base} の PR${topicPr ? ` #${topicPr}` : ''} が ${base} と競合していて、CI が動かず、プレビューが作られないため。`,
        'rebase はせず、merge で競合を解いています。CI が通ったら autopilot の daemon が topic にマージします。',
        '',
        ...(summary ? ['## 解いたこと', '', String(summary).slice(0, 2000), ''] : []),
        `Refs #${epic}`,
    ].join('\n');
}

/**
 * topic を develop に追従させるために、いま何をするか（純粋関数・#2485）。
 * - 取り込む PR が open: CI 通過・競合なしなら merge、CI 失敗・競合は hitl、それ以外は wait
 * - 取り込む PR が無い: topic → develop の PR が競合していれば resolve（ブランチを作って merge で解く）、
 *   mergeable を計算中なら wait、競合していなければ none
 * @param {{topicPr:(object|null), syncPr:(object|null), nowMs?:number}} p
 *   topicPr は `{number, mergeable}`、syncPr は `gh pr view --json state,isDraft,mergeable,statusCheckRollup,updatedAt`
 * @returns {{action:'none'|'wait'|'resolve'|'merge'|'hitl', reason:string}}
 */
function topicSyncPlan({ topicPr, syncPr, nowMs = null, graceMs = 10 * 60 * 1000 } = {}) {
    if (syncPr && (!syncPr.state || syncPr.state === 'OPEN')) {
        if (syncPr.mergeable === 'CONFLICTING') return { action: 'hitl', reason: '取り込む PR がまた競合しています' };
        if (syncPr.mergeable !== 'MERGEABLE') return { action: 'wait', reason: `mergeable を計算中（${syncPr.mergeable || '不明'}）` };
        const ci = ciStateFromRollup(syncPr.statusCheckRollup);
        if (ci === 'failure') return { action: 'hitl', reason: '取り込む PR の CI が落ちています' };
        if (ci === 'pending') return { action: 'wait', reason: 'CI の結果待ち' };
        if (ci === 'none') {
            const updated = Date.parse(syncPr.updatedAt || '') || 0;
            if (nowMs == null || nowMs - updated < graceMs) return { action: 'wait', reason: 'CI のチェックがまだ登録されていません' };
        }
        return { action: 'merge', reason: ci === 'none' ? 'CI のチェックなし' : 'CI 通過' };
    }
    if (!topicPr) return { action: 'none', reason: 'topic → develop の PR がありません' };
    if (topicPr.mergeable === 'CONFLICTING') return { action: 'resolve', reason: 'topic → develop の PR が競合しています' };
    if (topicPr.mergeable !== 'MERGEABLE') return { action: 'wait', reason: `mergeable を計算中（${topicPr.mergeable || '不明'}）` };
    return { action: 'none', reason: '競合していません' };
}

module.exports = {
    EPIC_PR_MARKER, EPIC_PR_STATUS_MARKER, PREVIEW_BASE_URL, PREVIEW_SLUG_MAX_LENGTH, CHILD_STATE_LABELS, WORKING_STATUSES,
    epicPrMarker, epicPrStatusMarker, previewSlug, previewUrlForBranch, epicPrTitle, issueFromHeadBranch,
    childStates, renderEpicPrBody, renderEpicPrStatusComment, selectEpicPr, epicPrPlan, topicMergeTargets,
    previewStatus, previewStatusText, topicSyncBranch, topicSyncMarker, renderTopicSyncBody, topicSyncPlan,
};
