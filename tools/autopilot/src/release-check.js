'use strict';
/**
 * release-check.js — 分解済み EPIC（🧭 トラッカー）のリリース確認の判断（純粋関数・#2430）。
 *
 * 流れ: 子が全部済む → daemon が AI Status を Release Check にする（{@link releaseCheckEntryIntents}）→
 * release-check フェーズが確認の観点をトラッカーにまとめる（`<!-- autopilot-release-check round=N -->`）→
 * 🙋 で人間に渡す → 人間がプレビューで確かめ、モニターの「確認の結果を書く」で送る（daemon が
 * `<!-- autopilot-release-review round=N -->` を Bot で書き、🙋 を外す）→ release-check が結果を受け、
 * NG ごとに sub-issue を作る（`<!-- autopilot-release-result round=N -->`）。NG から作った sub-issue が
 * 全部済むと、次の round のリリース確認になる。develop へのマージは人間のまま。
 *
 * どちらの段（観点をまとめる / 結果を受ける）かは、トラッカーの目印付きコメントだけで決める
 * （{@link releaseCheckMode}。時刻や daemon の状態ファイルを使わない・I5）。
 * I/O・時計を持ち込まない。phases.js を require する側（phases.js からは require しない・循環させない）。
 */

const { TRACKING_LABEL, TERMINAL_STATUSES, RELEASE_CHECK_AI_STATUS, extractPreviewUrl } = require('./phases');

/**
 * 「リリース後の作業」の sub-issue に人間（または decompose）が付けるラベル。これだけが残っていれば、
 * 子が全部済んだとみなしてリリース確認に入る。本文のディレクティブにしなかったのは、ボードが既に
 * 持っているラベルで判定でき、sub-issue の本文を読みに行かなくて済むから（API 予算・github-api.md）。
 */
const AFTER_RELEASE_LABEL = '🚀 after-release';

/** 目印の正規表現（round を捕捉する） */
const CHECK_RE = /<!--\s*autopilot-release-check\s+round=(\d+)\s*-->/;
const REVIEW_RE = /<!--\s*autopilot-release-review\s+round=(\d+)\s*-->/;
const RESULT_RE = /<!--\s*autopilot-release-result\s+round=(\d+)\s*-->/;
/** 結果のコメントに埋める機械向けのデータ（人間向けの本文は別に書く） */
const REVIEW_DATA_RE = /<!--\s*autopilot-release-review-data\s+([\s\S]*?)\s*-->/;
/** NG から作った sub-issue の本文に入れる目印（同じ round の同じ観点から二重に作らない） */
const NG_RE = /<!--\s*autopilot-release-ng\s+epic=(\d+)\s+round=(\d+)\s+point=(R\d+|C)\s*-->/g;

/** 観点 1 つのメモと全体のコメントの上限（GitHub のコメントの上限より十分小さく） */
const MAX_RELEASE_NOTE = 2000;
const MAX_RELEASE_COMMENT = 4000;

/** @param {number} round @returns {string} */
function releaseCheckMarker(round) { return `<!-- autopilot-release-check round=${round} -->`; }
/** @param {number} round @returns {string} */
function releaseReviewMarker(round) { return `<!-- autopilot-release-review round=${round} -->`; }
/** @param {number} round @returns {string} */
function releaseResultMarker(round) { return `<!-- autopilot-release-result round=${round} -->`; }

/**
 * NG から作る sub-issue の本文に入れる目印。
 * @param {{epic:number, round:number, point:string}} p point は `R1` など、全体のコメントは `C`
 * @returns {string}
 */
function releaseNgMarker({ epic, round, point }) {
    return `<!-- autopilot-release-ng epic=${epic} round=${round} point=${point} -->`;
}

/** REST のユーザーが bot か。user が無い形（daemon の listIssueComments）は目印だけで見る */
function isBotish(user) {
    if (user === undefined || user === null) return true;
    return user.type === 'Bot' || String(user.login || '').endsWith('[bot]');
}

/** 目印付きの bot コメントの round を集める（内部用） */
function roundsOf(comments, re) {
    const out = [];
    for (const c of comments || []) {
        if (!c || !isBotish(c.user)) continue;
        const m = String(c.body || '').match(re);
        if (m) out.push({ round: Number(m[1]), comment: c });
    }
    return out;
}

function maxRound(list) { return list.reduce((a, x) => Math.max(a, x.round), 0); }

/**
 * item が「リリース後の作業」か（純粋関数）。
 * @param {object} item { labels }
 * @returns {boolean}
 */
function isAfterReleaseItem(item) {
    return Boolean(item) && Array.isArray(item.labels) && item.labels.includes(AFTER_RELEASE_LABEL);
}

/**
 * トラッカーがリリース確認に入れるか（純粋関数）。
 * - 🧭 tracking・In Progress・AI Status=EPIC Decomposed・🙋 なし（人間が持っている間は動かさない）
 * - sub-issue が 1 件以上あり、済んだ数 + 開いている 🚀 after-release の数が全体に届く
 *
 * 🚀 after-release の数はボードの item（親がこのトラッカーのもの）から数える。ボードに載らない子
 * （担当がほかの人）は数えられないので、そのときは入らない（早すぎるリリース確認より安全側）。
 * @param {object} tracker board item { issue, labels, status, aiStatus, hitl|hitlLabel, subIssues:{total, completed} }
 * @param {object[]} boardItems 同じボードの item（parent: {number}）
 * @returns {boolean}
 */
function releaseCheckReady(tracker, boardItems) {
    if (!tracker || !Array.isArray(tracker.labels) || !tracker.labels.includes(TRACKING_LABEL)) return false;
    if (tracker.status !== 'In Progress' || tracker.aiStatus !== 'EPIC Decomposed') return false;
    if (tracker.hitlLabel !== undefined ? tracker.hitlLabel : tracker.hitl) return false;
    const { total = 0, completed = 0 } = tracker.subIssues || {};
    if (!(total > 0)) return false;
    if (completed >= total) return true;
    const afterRelease = (boardItems || []).filter((it) => it && it.parent && it.parent.number === tracker.issue
        && !TERMINAL_STATUSES.has(it.status) && isAfterReleaseItem(it)).length;
    return afterRelease > 0 && completed + afterRelease >= total;
}

/**
 * リリース確認に入れるトラッカーを選び、書く意図を添える（純粋関数）。書くのは daemon（単一ライター）。
 * @param {object[]} boardItems
 * @returns {Array<{item:object, intents:Array<{field:string, value:string}>}>}
 */
function selectReleaseCheckEntries(boardItems) {
    return (boardItems || []).filter((it) => it && it.itemId && releaseCheckReady(it, boardItems))
        .map((item) => ({ item, intents: [{ field: 'AI Status', value: RELEASE_CHECK_AI_STATUS }] }));
}

/**
 * release-check フェーズがどちらの段を走るか（純粋関数）。トラッカーの目印付きコメントだけで決める。
 * - 観点のコメントが無い → collect（round 1）
 * - いちばん新しい round の結果（review）があり、まだ受けていない（result が無い）→ result
 * - いちばん新しい round の結果をもう受けた → collect（次の round。NG の sub-issue が済んで戻ってきた）
 * - 観点はあるが結果が無い（人間が結果を書かずに 🙋 を外した）→ collect（同じ round を書き直す）
 * @param {Array<{body?:string, user?:object}>} comments トラッカーの会話コメント
 * @returns {{mode:'collect'|'result', round:number}}
 */
function releaseCheckMode(comments) {
    const check = maxRound(roundsOf(comments, CHECK_RE));
    const review = maxRound(roundsOf(comments, REVIEW_RE));
    const result = maxRound(roundsOf(comments, RESULT_RE));
    if (check === 0) return { mode: 'collect', round: 1 };
    if (review >= check && result < review) return { mode: 'result', round: review };
    if (result >= check) return { mode: 'collect', round: check + 1 };
    return { mode: 'collect', round: check };
}

/**
 * 観点のコメントから、番号付きの確認の観点を取り出す（純粋関数）。形は `### R1. <題>` の見出しと、
 * 次の見出しまでの本文（プロンプトの書き方と対）。
 * @param {string} body
 * @returns {Array<{id:string, title:string, body:string}>}
 */
function parseReleaseCheckPoints(body) {
    const out = [];
    let cur = null;
    for (const line of String(body || '').replace(/\r\n?/g, '\n').split('\n')) {
        const m = line.match(/^#{2,4}\s+(R\d+)[.:：)]?\s*(.*)$/);
        if (m) {
            if (cur) out.push(cur);
            cur = { id: m[1], title: m[2].trim(), lines: [] };
            continue;
        }
        if (cur && /^#{1,4}\s/.test(line)) { out.push(cur); cur = null; continue; }
        if (cur) cur.lines.push(line);
    }
    if (cur) out.push(cur);
    return out.map((p) => ({ id: p.id, title: p.title, body: p.lines.join('\n').trim() }));
}

/**
 * 観点のコメントからプレビューの URL を取る（純粋関数）。`**プレビュー**: <URL>` の行を先に見て、
 * 無ければ CI が貼るプレビューの URL の形（phases.js の extractPreviewUrl）で探す。
 * @param {string} body
 * @returns {string|null}
 */
function releasePreviewUrl(body) {
    const m = String(body || '').match(/\*\*プレビュー\*\*\s*[:：]\s*<?(https?:\/\/[^\s<>)]+)/);
    if (m) return m[1];
    return extractPreviewUrl([{ body: String(body || '') }]);
}

/**
 * モニターのダイアログに見せるもの（純粋関数）。いちばん新しい round の観点のコメントと、その round の
 * 結果を送ってあるか。観点のコメントが無ければ check は null。
 * @param {Array<{id:(number|string), body?:string, user?:object}>} comments トラッカーの会話コメント
 * @returns {{check:({round:number, id:(number|string|null), body:string, points:object[], previewUrl:(string|null)}|null),
 *   reviewed:boolean}}
 */
function releaseCheckView(comments) {
    const checks = roundsOf(comments, CHECK_RE);
    const round = maxRound(checks);
    if (!round) return { check: null, reviewed: false };
    const c = checks.filter((x) => x.round === round).pop().comment;
    const body = String(c.body || '');
    const reviewed = roundsOf(comments, REVIEW_RE).some((x) => x.round === round);
    return {
        check: { round, id: c.id == null ? null : c.id, body, points: parseReleaseCheckPoints(body), previewUrl: releasePreviewUrl(body) },
        reviewed,
    };
}

/**
 * `POST /release-check/review` の body を検証する（純粋関数）。
 * body: `{issue, round, results:[{id:'R1', verdict:'ok'|'ng', note?}], comment?}`。
 * 観点の結果か全体のコメントのどちらかは要る。
 * @param {object} body
 * @returns {{ok:boolean, error?:string, issue?:number, round?:number,
 *   results?:Array<{id:string, verdict:'ok'|'ng', note:string}>, comment?:string}}
 */
function normalizeReleaseReviewBody(body) {
    if (!body || typeof body !== 'object') return { ok: false, error: 'body must be an object' };
    const num = (v) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v);
    const issue = num(body.issue);
    if (!Number.isInteger(issue) || issue <= 0) return { ok: false, error: 'issue (positive integer) required' };
    const round = num(body.round);
    if (!Number.isInteger(round) || round <= 0) return { ok: false, error: 'round (positive integer) required' };
    if (body.results != null && !Array.isArray(body.results)) return { ok: false, error: 'results must be an array' };
    const seen = new Set();
    const results = [];
    for (const r of body.results || []) {
        if (!r || typeof r.id !== 'string' || !/^R\d+$/.test(r.id)) return { ok: false, error: 'results[].id must be like R1' };
        if (seen.has(r.id)) return { ok: false, error: `results[].id ${r.id} is duplicated` };
        seen.add(r.id);
        if (r.verdict !== 'ok' && r.verdict !== 'ng') return { ok: false, error: 'results[].verdict must be ok or ng' };
        if (r.note != null && typeof r.note !== 'string') return { ok: false, error: 'results[].note must be a string' };
        const note = String(r.note || '').replace(/\r\n?/g, '\n').trim();
        if (note.length > MAX_RELEASE_NOTE) return { ok: false, error: `results[].note is too long (max ${MAX_RELEASE_NOTE})` };
        results.push({ id: r.id, verdict: r.verdict, note });
    }
    if (body.comment != null && typeof body.comment !== 'string') return { ok: false, error: 'comment must be a string' };
    const comment = String(body.comment || '').replace(/\r\n?/g, '\n').trim();
    if (comment.length > MAX_RELEASE_COMMENT) return { ok: false, error: `comment is too long (max ${MAX_RELEASE_COMMENT})` };
    if (!results.length && !comment) return { ok: false, error: 'results or comment required' };
    return { ok: true, issue, round, results, comment };
}

/** HTML コメントの中に JSON を埋めても閉じないように `--` を崩す（JSON としては同じ値に戻る） */
function encodeData(obj) {
    return JSON.stringify(obj).replace(/-/g, '\\u002d').replace(/>/g, '\\u003e');
}

/**
 * 確認の結果のコメント（daemon が Bot で書く・純粋関数）。人間向けの本文と、機械向けのデータを両方持つ。
 * @param {{round:number, results:object[], comment:string, login?:(string|null)}} p
 * @returns {string}
 */
function renderReleaseReviewComment({ round, results, comment, login }) {
    const who = login ? '`@' + String(login).replace(/^@/, '') + '`' : '人間';
    const ng = (results || []).filter((r) => r.verdict === 'ng').length;
    const ok = (results || []).length - ng;
    const lines = [
        releaseReviewMarker(round),
        `<!-- autopilot-release-review-data ${encodeData({ round, results: results || [], comment: comment || '' })} -->`,
        `🖥️ モニターから ${who} のリリース確認の結果（round ${round}・autopilot が代わりに投稿しています）`,
        '',
        `OK **${ok}** / NG **${ng}**`,
        '',
    ];
    for (const r of results || []) {
        lines.push(`- **${r.id}**: ${r.verdict === 'ng' ? '❌ NG' : '✅ OK'}`);
        if (r.note) for (const l of r.note.split('\n')) lines.push(`  > ${l}`);
    }
    if (comment) {
        lines.push('', '**全体のコメント**', '');
        for (const l of comment.split('\n')) lines.push(`> ${l}`);
    }
    return lines.join('\n');
}

/**
 * 確認の結果のコメントを読み戻す（純粋関数）。{@link renderReleaseReviewComment} の逆。
 * @param {string} body
 * @returns {{round:number, results:object[], comment:string}|null}
 */
function parseReleaseReview(body) {
    const s = String(body || '');
    const rm = s.match(REVIEW_RE);
    const dm = s.match(REVIEW_DATA_RE);
    if (!rm || !dm) return null;
    try {
        const d = JSON.parse(dm[1]);
        return { round: Number(rm[1]), results: Array.isArray(d.results) ? d.results : [], comment: String(d.comment || '') };
    } catch (e) {
        return null;
    }
}

/**
 * 結果のコメントを書くか（純粋関数）。押し直し（🙋 を外すのに失敗したなど）で、同じ round の結果を
 * 二重に書かない。
 * @param {Array<object>} comments トラッカーの会話コメント
 * @param {number} round
 * @returns {{action:'post'|'skip', existingId?:(number|string)}}
 */
function planReleaseReviewPost(comments, round) {
    const same = roundsOf(comments, REVIEW_RE).find((x) => x.round === round);
    return same ? { action: 'skip', existingId: same.comment.id } : { action: 'post' };
}

/**
 * 結果を受ける段の計画（純粋関数）。NG の観点ごとに sub-issue を作る。全体のコメントは、直してほしい
 * ことか（sub-issue にするか）をプロンプトが読んで決める（`comment` で渡す）。既にその目印の sub-issue が
 * あれば作らない（冪等）。
 * @param {{epic:number, round:number, review:{results:object[], comment:string}, points?:object[],
 *   existingBodies?:string[]}} p existingBodies は EPIC の sub-issue の本文
 * @returns {{allOk:boolean, create:Array<{point:string, title:string, note:string, marker:string}>,
 *   existing:string[], comment:string, commentDone:boolean}} commentDone は全体のコメントから作った sub-issue（point=C）があるか
 */
function planReleaseResult({ epic, round, review, points, existingBodies }) {
    const made = new Set();
    for (const b of existingBodies || []) {
        for (const m of String(b || '').matchAll(NG_RE)) {
            if (Number(m[1]) === epic && Number(m[2]) === round) made.add(m[3]);
        }
    }
    const titleOf = {};
    for (const p of points || []) titleOf[p.id] = p.title;
    const create = [];
    const existing = [];
    for (const r of (review && review.results) || []) {
        if (r.verdict !== 'ng') continue;
        if (made.has(r.id)) { existing.push(r.id); continue; }
        create.push({ point: r.id, title: titleOf[r.id] || r.id, note: r.note || '', marker: releaseNgMarker({ epic, round, point: r.id }) });
    }
    const comment = String((review && review.comment) || '');
    const ngCount = create.length + existing.length;
    return { allOk: ngCount === 0 && !comment, create, existing, comment, commentDone: made.has('C') };
}

module.exports = {
    AFTER_RELEASE_LABEL,
    MAX_RELEASE_NOTE,
    MAX_RELEASE_COMMENT,
    releaseCheckMarker,
    releaseReviewMarker,
    releaseResultMarker,
    releaseNgMarker,
    isAfterReleaseItem,
    releaseCheckReady,
    selectReleaseCheckEntries,
    releaseCheckMode,
    parseReleaseCheckPoints,
    releasePreviewUrl,
    releaseCheckView,
    normalizeReleaseReviewBody,
    renderReleaseReviewComment,
    parseReleaseReview,
    planReleaseReviewPost,
    planReleaseResult,
};
