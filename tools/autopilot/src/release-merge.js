'use strict';
/**
 * release-merge.js — リリース確認が全部 OK の EPIC を、モニターから develop へマージする判断（純粋関数・#2544）。
 *
 * 流れ: release-check が全部 OK の結果をトラッカーに書く（`<!-- autopilot-release-result round=N allOk=1 pr=P head=SHA -->`）
 * → 人間がモニターの「develop へマージする」を押す（`POST /release-check/merge`）→ daemon がここの
 * {@link planReleaseMerge} で確かめてから、draft を外す → `--merge` でマージ → EPIC を Close にして閉じる。
 * 人間が GitHub で直接マージしたときも、{@link selectMergedReleaseEpics} で同じ終わり方にする。
 *
 * 「全部 OK でマージを待っている」は、トラッカーの目印付きコメントと PR のまだ受けていないレビュー・コメントだけで
 * 決める（{@link releaseMergeReadiness}。時刻や daemon の状態ファイルを使わない・I5）。目印の head の SHA は、
 * 人間が確かめたときの topic の中身。マージの前に PR の head と同じかを見て、確かめたものと違う中身をマージしない。
 *
 * I/O・時計を持ち込まない（時刻は引数で受ける）。マージの時間の決まりは human-action.js の
 * developMergeWindow（モニターにも埋め込むので、そちらに置く）を使う。
 */

const { TERMINAL_STATUSES, RELEASE_CHECK_AI_STATUS, protectedPaths } = require('./phases');
const { ciStateFromRollup } = require('./epic-flow');
const { developMergeWindow } = require('./human-action');
const { parseReleaseResultMarker, releaseCheckRounds } = require('./release-check');

/** メッシュに関わるファイル（`.claude/rules/merge-and-release.md`。平日の日中は develop へマージしない） */
const MESH_PATH_PATTERNS = [
    /^packages\/scratch-vm\/src\/extensions\/scratch3_mesh_v2\//,
    /^packages\/scratch-gui\/src\/components\/connection-modal\/mesh-v2-/,
    /^packages\/scratch-gui\/src\/reducers\/mesh-v2\.js$/,
    /^packages\/scratch-gui\/src\/lib\/ruby-generator\/mesh_v2\.js$/,
    /^packages\/scratch-gui\/src\/lib\/ruby-to-blocks-converter\/mesh_v2\.js$/,
    /^infra\/smalruby-mesh-v2\//,
];

/** 断る理由ごとの人間向けの一文（モニターのトーストに出す） */
const REFUSE_TEXT = {
    'no-result': 'リリース確認の結果がまだありません',
    'not-all-ok': 'いちばん新しいリリース確認の結果が全部 OK ではありません',
    'no-head': '全部 OK の結果に topic の SHA がありません（古い形の結果です）。GitHub でマージしてください',
    'new-round': '全部 OK のあとに新しい観点か確認の結果があります',
    'pr-feedback': 'topic → develop の PR に、まだ受けていないレビュー・コメントがあります',
    'no-pr': 'topic → develop の PR が見つかりません',
    'pr-not-open': 'topic → develop の PR が open ではありません',
    'pr-mismatch': '全部 OK の結果の PR と、いまの PR が違います',
    'not-develop': 'PR の base が develop ではありません',
    conflict: 'PR が develop とコンフリクトしています',
    'mergeable-unknown': 'GitHub がまだマージできるかを計算しています。少し待ってから押してください',
    'ci-failed': 'PR の CI が落ちています',
    'ci-pending': 'PR の CI がまだ終わっていません',
    'no-ci': 'PR の CI がまだ動いていません',
    'head-changed': '全部 OK のあとに topic が変わりました（確かめた中身と違います）。もう一度リリース確認をしてください',
    protected: 'Bot の権限で通らないファイル（.github/workflows など）を含みます。GitHub でマージしてください',
    'mesh-daytime': 'メッシュに関わる変更は、平日の日中は develop へマージしません（土日か夜に）',
};

/**
 * 「全部 OK でマージを待っている」か（純粋関数）。
 * - いちばん新しい round の結果（`autopilot-release-result`）が全部 OK（`allOk=1`）で、topic の head の SHA を持つ
 * - そのあとに新しい観点・確認の結果（round が大きいもの）が無い
 * - topic → develop の PR に、まだ受けていない人間のレビュー・コメントが無い（`prFeedback` は selectPrFeedback の結果）
 * @param {{comments:Array<{body?:string, user?:object}>, prFeedback?:object[]}} p comments はトラッカーの会話コメント
 * @returns {{ready:boolean, code?:string, round?:number, pr?:(number|null), head?:(string|null)}}
 */
function releaseMergeReadiness({ comments, prFeedback }) {
    const r = releaseCheckRounds(comments);
    if (!r.result) return { ready: false, code: 'no-result' };
    const m = parseReleaseResultMarker(r.resultComment.body);
    const base = { round: r.result, pr: (m && m.pr) || null, head: (m && m.head) || null };
    if (!m || !m.allOk) return { ready: false, code: 'not-all-ok', ...base };
    if (r.check > r.result || r.review > r.result) return { ready: false, code: 'new-round', ...base };
    if (!m.head) return { ready: false, code: 'no-head', ...base };
    if (Array.isArray(prFeedback) && prFeedback.length) return { ready: false, code: 'pr-feedback', ...base };
    return { ready: true, ...base };
}

/** ファイルの一覧にメッシュのものがあるか */
function touchesMesh(files) {
    return (files || []).some((f) => MESH_PATH_PATTERNS.some((re) => re.test(String(f))));
}

/**
 * マージの計画（純粋関数）。断る（refuse）・確かめを求める（confirm）・行う（merge）のどれか。
 *
 * 時間の外（平日の 12:50〜13:15 の外）は、モニターの確かめで人間に見せてから通す（`confirmOffHours`）。
 * 押すのは人間の判断で、授業中に画面が変わる心配は人間が一番よく分かるから。メッシュに関わる変更は
 * 平日の日中は断る（確かめても通さない）。メッシュは授業で使う最も大事な機能だから。
 * @param {{readiness:object, pr:(object|null), nowMs:number, confirmOffHours?:boolean, epic:number}} p
 *   pr は `gh pr view --json number,state,isDraft,baseRefName,headRefOid,mergeable,statusCheckRollup,files` の形
 *   （files は `[{path}]` か文字列の配列）
 * @returns {{action:'refuse'|'confirm'|'merge', code?:string, reason:string, steps?:string[], pr?:number}}
 */
function planReleaseMerge({ readiness, pr, nowMs, confirmOffHours, epic }) {
    const refuse = (code) => ({ action: 'refuse', code, reason: REFUSE_TEXT[code] || code });
    if (!readiness || !readiness.ready) return refuse((readiness && readiness.code) || 'no-result');
    if (!pr) return refuse('no-pr');
    if (pr.state && pr.state !== 'OPEN') return refuse('pr-not-open');
    if (readiness.pr && pr.number !== readiness.pr) return refuse('pr-mismatch');
    if (pr.baseRefName && pr.baseRefName !== 'develop') return refuse('not-develop');
    if (pr.mergeable === 'CONFLICTING') return refuse('conflict');
    if (pr.mergeable !== 'MERGEABLE') return refuse('mergeable-unknown');
    const ci = ciStateFromRollup(pr.statusCheckRollup);
    if (ci === 'failure') return refuse('ci-failed');
    if (ci === 'pending') return refuse('ci-pending');
    if (ci === 'none') return refuse('no-ci');
    if (!pr.headRefOid || pr.headRefOid !== readiness.head) return refuse('head-changed');
    const files = (pr.files || []).map((f) => (typeof f === 'string' ? f : f && f.path)).filter(Boolean);
    if (protectedPaths(files).length) return refuse('protected');
    const w = developMergeWindow(nowMs);
    if (w.weekdayDaytime && touchesMesh(files)) return refuse('mesh-daytime');
    if (!w.inWindow && !confirmOffHours) return { action: 'confirm', code: 'off-hours', reason: w.note };
    const steps = [...(pr.isDraft ? ['ready'] : []), 'merge', 'close'];
    return {
        action: 'merge', pr: pr.number, steps,
        reason: `PR #${pr.number} の draft を外して develop へマージし、EPIC #${epic} を Close にする`,
    };
}

/**
 * EPIC を終わらせる意図（純粋関数）。Status=Close・AI Status を空に。🙋 を外して Issue を閉じるのは daemon。
 * @returns {Array<{field:string, value:(string|null)}>}
 */
function releaseMergeCloseIntents() {
    return [{ field: 'Status', value: 'Close' }, { field: 'AI Status', value: null }];
}

/**
 * EPIC の topic ブランチ（純粋関数）。ボードの子の `autopilot-base:`（daemon が持つ本文のキャッシュ）から取る。
 * 子によって違うときは、いちばん多いもの。分からなければ null。
 * @param {number} epic
 * @param {object[]} boardItems
 * @param {function(number):(string|null|undefined)} baseOf
 * @returns {string|null}
 */
function epicTopicBranch(epic, boardItems, baseOf) {
    if (typeof baseOf !== 'function') return null;
    const count = new Map();
    for (const it of boardItems || []) {
        if (!it || !it.parent || it.parent.number !== epic) continue;
        const b = baseOf(it.issue);
        if (typeof b === 'string' && /^topic\//.test(b)) count.set(b, (count.get(b) || 0) + 1);
    }
    let best = null;
    for (const [b, n] of count) if (!best || n > count.get(best)) best = b;
    return best;
}

/**
 * topic → develop の PR のマージを見るトラッカー（純粋関数）。🧭・Release Check・終端でないもの。
 * @param {object[]} boardItems
 * @returns {object[]}
 */
function selectReleaseCheckTrackers(boardItems) {
    return (boardItems || []).filter((it) => it && it.itemId && it.tracker && it.aiStatus === RELEASE_CHECK_AI_STATUS
        && !TERMINAL_STATUSES.has(it.status));
}

/**
 * topic → develop の PR が merged になった Release Check の EPIC を選び、終わらせる意図を添える（純粋関数）。
 * 人間が GitHub でマージしたときも、モニターから押したときと同じ終わり方にする。
 * @param {object[]} boardItems
 * @param {object} mergedByIssue `{ [epic]: prNumber }`（merged の PR が見つかったものだけ）
 * @returns {Array<{item:object, pr:number, intents:object[]}>}
 */
function selectMergedReleaseEpics(boardItems, mergedByIssue) {
    const m = mergedByIssue || {};
    return selectReleaseCheckTrackers(boardItems).filter((it) => m[it.issue])
        .map((item) => ({ item, pr: m[item.issue], intents: releaseMergeCloseIntents() }));
}

/**
 * release-check の結果ファイルから、モニターに「develop へマージする」を出す材料を作る（純粋関数）。
 * 全部 OK（`allOk: true`）で PR の番号と head の SHA があるときだけ。ほかの結果では null（前の材料を消す）。
 * @param {object} result
 * @returns {{round:(number|null), pr:number, head:string}|null}
 */
function releaseMergeCandidate(result) {
    const r = result || {};
    if (r.allOk !== true || r.hitl !== true) return null;
    const pr = Number(r.pr);
    if (!Number.isInteger(pr) || pr <= 0) return null;
    if (typeof r.headSha !== 'string' || !/^[0-9a-f]{7,40}$/i.test(r.headSha)) return null;
    return { round: Number.isInteger(r.round) ? r.round : null, pr, head: r.headSha.toLowerCase() };
}

module.exports = {
    MESH_PATH_PATTERNS,
    REFUSE_TEXT,
    releaseMergeReadiness,
    touchesMesh,
    planReleaseMerge,
    releaseMergeCloseIntents,
    epicTopicBranch,
    selectReleaseCheckTrackers,
    selectMergedReleaseEpics,
    releaseMergeCandidate,
};
