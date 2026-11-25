'use strict';
/**
 * epic-summary.js — 俯瞰ボードの item を EPIC 単位にまとめ、現在地の材料を作る（純粋関数のみ・#2388）。
 *
 * 人間が知りたいのは「EPIC ごとに、いまどの段にいて、あと何件で、次にいつ人間に聞くのか」。
 * daemon は {@link buildStatusMaterial} の結果を `GET /status.json` で出し、モニタは
 * {@link renderEpicGroupsHtml} で EPIC ごとに束ねて見せ、現在地の artifact を作る worker は
 * 同じ JSON を読む。I/O・時計（Date.now()）は持ち込まない（時刻は引数 `now` で受ける）。
 */

// まとまりの優先度は、作業を始める順番（scheduler.orderByPriority）と同じ決め方にする（#2411）
const { DEFAULT_PRIORITY, normalizePriority } = require('./scheduler');

/** EPIC の段（左から順に進む）。単独の Issue のまとまりは段を持たない（null）。 */
const EPIC_STAGES = ['design', 'implement', 'topic-review', 'develop'];

/** 段の表示名（モニタ・artifact で共通に使う）。 */
const EPIC_STAGE_LABELS = {
    design: '設計',
    implement: '実装',
    'topic-review': 'topic の確認',
    develop: 'develop',
};

/** EPIC の無い Issue のまとまりのキーの頭。実際のキーは優先度ごとに `solo-P2` のようになる（#2411）。 */
const SOLO_GROUP_KEY = 'solo';

/**
 * EPIC の無い Issue の、優先度ごとのまとまりのキー。
 * @param {string} priority P0〜P3
 * @returns {string}
 */
function soloGroupKey(priority) {
    return `${SOLO_GROUP_KEY}-${priority}`;
}

/** 1 件あたりの時間がまだ測れないときの既定（60 分）。 */
const DEFAULT_ISSUE_DURATION_MS = 60 * 60 * 1000;

// phases.js の TERMINAL_STATUSES と同じ集合（ここは phases.js に依存させず自己完結にしておく。
// renderEpicGroupsHtml はブラウザに fn.toString() で埋め込むため、モジュールの外を参照できない）
const DONE_STATUSES = new Set(['Close', 'Done']);

/**
 * Project の Priority（P0〜P3）を並べ替え用の数にする。無い・読めないものは最後（9）。
 * @param {string|null|undefined} p
 * @returns {number}
 */
function priorityRank(p) {
    const m = /^P([0-9])$/i.exec(String(p || '').trim());
    return m ? Number(m[1]) : 9;
}

/**
 * 決定待ちの数を正規化する。#2385 の daemon が持つ値の形が固まっていないので、
 * 数・{count}・{items: []}・配列のどれでも受ける。
 * @param {*} v
 * @returns {number}
 */
function decisionCount(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'object') {
        if (Number.isFinite(v.count)) return Math.max(0, Math.floor(v.count));
        if (Array.isArray(v.items)) return v.items.length;
    }
    return 0;
}

/**
 * EPIC の Issue の「決定待ち」まとめコメント（マーカー `<!-- autopilot-epic-decisions -->`）から、
 * 決定待ちの数を数える。書くのは daemon（#2385）なので、形に強く依存しないよう次の順で数える:
 * ①マーカーに `count=N` があればそれ ②未チェックの `- [ ]` の行 ③`### ` の見出し ④箇条書き `- ` の行。
 * マーカーが無い本文は 0。
 * @param {string} body コメント本文
 * @returns {number}
 */
function countEpicDecisions(body) {
    const text = String(body || '');
    const marker = /<!--\s*autopilot-epic-decisions([^>]*)-->/.exec(text);
    if (!marker) return 0;
    const explicit = /count=(\d+)/.exec(marker[1] || '');
    if (explicit) return Number(explicit[1]);
    const lines = text.split('\n');
    const unchecked = lines.filter((l) => /^\s*[-*]\s+\[ \]/.test(l)).length;
    if (unchecked) return unchecked;
    const headings = lines.filter((l) => /^###\s+\S/.test(l)).length;
    if (headings) return headings;
    return lines.filter((l) => /^\s*[-*]\s+\S/.test(l)).length;
}

/**
 * これまでの 1 件（Issue）あたりの時間を、実行履歴から求める。
 * 履歴は run ごと（フェーズごと）なので、Issue ごとに足してから平均する。
 * Issue 番号の無い run（現在地を作る job など）は数えない。
 * @param {object[]} history daemon の state.history（{issue, startedAt, endedAt}）
 * @param {object} [opts] { fallbackMs }
 * @returns {number} ms
 */
function averageIssueDurationMs(history, opts = {}) {
    const fallback = Number.isFinite(opts.fallbackMs) ? opts.fallbackMs : DEFAULT_ISSUE_DURATION_MS;
    const byIssue = new Map();
    for (const h of history || []) {
        if (!h || !Number.isInteger(h.issue) || h.issue <= 0) continue;
        const d = Number(h.endedAt) - Number(h.startedAt);
        if (!Number.isFinite(d) || d <= 0) continue;
        byIssue.set(h.issue, (byIssue.get(h.issue) || 0) + d);
    }
    if (!byIssue.size) return fallback;
    let sum = 0;
    for (const v of byIssue.values()) sum += v;
    return Math.round(sum / byIssue.size);
}

/**
 * EPIC の段を決める。
 * - develop: EPIC が終端（Close / Done）か、EPIC の PR（topic → develop）が merge 済み
 * - design: sub-issue がまだ無い（設計・分解の前）
 * - implement: 済みの sub-issue が全部に届いていない
 * - topic-review: sub-issue が全部済んだ（topic を人間がまとめて確かめる番）
 * @param {object|null} epic EPIC の board item（ボードに無ければ null）
 * @param {{done:number,total:number}} counts
 * @returns {string} EPIC_STAGES のどれか
 */
function epicStage(epic, counts) {
    if (epic && DONE_STATUSES.has(epic.status)) return 'develop';
    if (epic && Array.isArray(epic.prs) && epic.prs.some((p) => p && p.state === 'MERGED')) return 'develop';
    if (!counts || !counts.total) return 'design';
    if (counts.done < counts.total) return 'implement';
    return 'topic-review';
}

/**
 * 次に人間に聞く見込み。残りの sub-issue × 1 件の時間 ÷ いまの並列の数。
 * - topic-review: いま聞ける（at = now）
 * - implement: now + remaining × avg ÷ parallelism（並列は残りの数を超えない・最低 1）
 * - design / develop / 単独: 見込みを出さない（null）
 * @param {object} p { stage, remaining, avgDurationMs, parallelism, now, questions }
 * @returns {{at:number, remaining:number, questions:number, parallelism:number}|null}
 */
function estimateNextInterview(p) {
    const { stage, now } = p;
    const remaining = Math.max(0, Math.floor(p.remaining || 0));
    const questions = Math.max(0, Math.floor(p.questions || 0));
    if (stage === 'topic-review') return { at: now, remaining: 0, questions, parallelism: 0 };
    if (stage !== 'implement') return null;
    const parallelism = Math.max(1, Math.min(Math.floor(p.parallelism || 1), remaining || 1));
    const avg = Number.isFinite(p.avgDurationMs) && p.avgDurationMs > 0 ? p.avgDurationMs : DEFAULT_ISSUE_DURATION_MS;
    return { at: now + Math.round((remaining * avg) / parallelism), remaining, questions, parallelism };
}

/**
 * item の親 EPIC の番号（無ければ null）。enrichment の `parent` を見る。
 * @param {object} it
 * @returns {number|null}
 */
function parentOf(it) {
    const n = it && it.parent && Number(it.parent.number);
    return Number.isInteger(n) && n > 0 ? n : null;
}

/** EPIC（トラッカー）の item か。Kind=EPIC か 🧭 tracking。 */
function isEpicItem(it) {
    return Boolean(it && (it.kind === 'EPIC' || it.tracker));
}

/**
 * board item を EPIC ごとにまとめる。EPIC の無い単独の Issue は、実際に効く優先度
 * （自分の Priority、無ければ既定の P2。scheduler.effectivePriority と同じ）ごとのまとまりにする（#2411）。
 * 親の EPIC がボードに無い（担当ではない・終端）ときも、enrichment の parent からまとまりを作る。
 * @param {object[]} items board item（refreshBoard の形。parent / priority があれば使う）
 * @param {object} [ctx] { running: [{issue, phase, since}], history, concurrency, now,
 *   decisionsByEpic: {[epic]: number|{count}|{items}} }
 * @returns {object[]} まとまり（優先度 → 段 → 番号の順。同じ優先度では EPIC が上、単独はその下）
 */
function groupItemsByEpic(items, ctx = {}) {
    const list = (items || []).filter(Boolean);
    const running = new Map((ctx.running || []).map((r) => [Number(r.issue), r]));
    const now = Number.isFinite(ctx.now) ? ctx.now : 0;
    const avg = averageIssueDurationMs(ctx.history);
    const concurrency = Math.max(1, Math.floor(ctx.concurrency || 1));
    const decisions = ctx.decisionsByEpic || {};
    const byNumber = new Map(list.map((it) => [it.issue, it]));
    const groups = new Map();
    const ensure = (key, epic, fallbackTitle) => {
        if (!groups.has(key)) {
            groups.set(key, { key, epic: epic || null, title: epic ? epic.title : (fallbackTitle || ''), children: [] });
        } else if (epic && !groups.get(key).epic) {
            groups.get(key).epic = epic;
            groups.get(key).title = epic.title;
        }
        return groups.get(key);
    };
    for (const it of list) {
        const parent = parentOf(it);
        if (parent) {
            ensure(parent, byNumber.get(parent) && isEpicItem(byNumber.get(parent)) ? byNumber.get(parent) : null,
                (it.parent && it.parent.title) || '').children.push(it);
        } else if (isEpicItem(it)) {
            ensure(it.issue, it);
        } else {
            // 単独は親が無いので、実際に効く優先度は自分の Priority か既定（作業を始める順番と同じ）
            const p = normalizePriority(it.priority) || DEFAULT_PRIORITY;
            const g = ensure(soloGroupKey(p), null, `EPIC に属さない · ${p}`);
            g.soloPriority = p;
            g.children.push(it);
        }
    }
    const out = [];
    for (const g of groups.values()) {
        const solo = Boolean(g.soloPriority);
        const epicNumber = solo ? null : g.key;
        const childDone = g.children.filter((c) => DONE_STATUSES.has(c.status)).length;
        // EPIC の sub-issue の数は GitHub の subIssuesSummary を正とする（終端の sub-issue はボードに出ないため）
        const sum = g.epic && g.epic.subIssues;
        const total = sum && sum.total ? sum.total : g.children.length;
        const done = sum && sum.total ? sum.completed || 0 : childDone;
        const members = solo ? g.children : [g.epic, ...g.children].filter(Boolean);
        const runningHere = members
            .filter((m) => running.has(m.issue))
            .map((m) => ({ issue: m.issue, title: m.title, phase: running.get(m.issue).phase, since: running.get(m.issue).since }));
        const stage = solo ? null : epicStage(g.epic, { done, total });
        const pendingDecisions = solo ? 0 : decisionCount(decisions[epicNumber]);
        const remaining = Math.max(0, total - done);
        const priority = solo ? g.soloPriority : (g.epic && g.epic.priority)
            || g.children.map((c) => c.priority).filter(Boolean).sort((a, b) => priorityRank(a) - priorityRank(b))[0]
            || null;
        out.push({
            key: String(g.key),
            solo,
            epic: epicNumber,
            title: solo ? g.title : (g.title || `#${epicNumber}`),
            url: g.epic ? g.epic.url || null : null,
            priority,
            stage,
            stageLabel: stage ? EPIC_STAGE_LABELS[stage] : null,
            done,
            total,
            remaining,
            running: runningHere,
            pendingDecisions,
            waitingHuman: members.filter((m) => m.waitReason).map((m) => ({ issue: m.issue, title: m.title, waitReason: m.waitReason })),
            eta: solo ? null : estimateNextInterview({
                stage, remaining, avgDurationMs: avg, parallelism: concurrency, now, questions: pendingDecisions,
            }),
            items: g.children
                .slice()
                .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.issue - b.issue)
                .map((c) => ({
                    issue: c.issue,
                    title: c.title,
                    url: c.url || null,
                    status: c.status || null,
                    aiStatus: c.aiStatus || null,
                    priority: c.priority || null,
                    hitl: Boolean(c.hitl),
                    waitReason: c.waitReason || null,
                    running: running.has(c.issue) ? running.get(c.issue).phase : null,
                })),
        });
    }
    // 並べ替えの優先度は作業を始める順番と同じく、無ければ既定の P2 とみなす（Priority の無い EPIC の子は
    // P2 で着手されるので、単独の P3 より下に出さない）。同じ優先度では EPIC を上に置く
    // （EPIC は段の順に並べていて、そこへ単独を割り込ませない）
    const rank = (g) => priorityRank(normalizePriority(g.priority) || DEFAULT_PRIORITY);
    return out.sort((a, b) => rank(a) - rank(b)
            || (a.solo === b.solo ? 0 : a.solo ? 1 : -1)
            || EPIC_STAGES.indexOf(a.stage) - EPIC_STAGES.indexOf(b.stage)
            || Number(a.epic) - Number(b.epic));
}

/**
 * いま優先しているものの順（優先度 → 指定の並び → 番号）。#2386 が dispatch の順を持つなら
 * `order`（Issue 番号の配列）で渡すと、それを同じ優先度の中の並びとして使う。終端と EPIC 自体は除く。
 * @param {object[]} items
 * @param {object} [opts] { order: number[] }
 * @returns {object[]}
 */
function priorityList(items, opts = {}) {
    const order = new Map((opts.order || []).map((n, i) => [Number(n), i]));
    const pos = (n) => (order.has(n) ? order.get(n) : Number.MAX_SAFE_INTEGER);
    return (items || [])
        .filter((it) => it && !DONE_STATUSES.has(it.status) && it.status !== 'Icebox' && !isEpicItem(it) && !it.later)
        .slice()
        .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || pos(a.issue) - pos(b.issue) || a.issue - b.issue)
        .map((it) => ({
            issue: it.issue, title: it.title, url: it.url || null, priority: it.priority || null,
            status: it.status || null, epic: parentOf(it),
        }));
}

/**
 * `GET /status.json` の中身（現在地の材料）を作る。現在地を作る worker もモニタもこれを読む。
 * @param {object} p { items, running, history, concurrency, now, decisionsByEpic, blocked, order,
 *   currentStatus, repo, boardUpdatedAt }
 * @returns {object}
 */
function buildStatusMaterial(p) {
    const now = Number.isFinite(p.now) ? p.now : 0;
    const items = p.items || [];
    const groups = groupItemsByEpic(items, {
        running: p.running, history: p.history, concurrency: p.concurrency, now, decisionsByEpic: p.decisionsByEpic,
    });
    const etas = groups.map((g) => g.eta && { ...g.eta, epic: g.epic, title: g.title }).filter(Boolean);
    etas.sort((a, b) => a.at - b.at);
    const byNumber = new Map(items.map((it) => [it.issue, it]));
    const iso = (ms) => (Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null);
    return {
        schema: 1,
        generatedAt: iso(now),
        boardUpdatedAt: iso(p.boardUpdatedAt),
        repo: p.repo || null,
        concurrency: p.concurrency || null,
        averageIssueMinutes: Math.round(averageIssueDurationMs(p.history) / 60000),
        groups: groups.map((g) => ({ ...g, eta: g.eta ? { ...g.eta, atIso: iso(g.eta.at) } : null })),
        priorities: priorityList(items, { order: p.order }),
        running: (p.running || []).map((r) => ({
            issue: r.issue, phase: r.phase, since: iso(r.since),
            title: byNumber.has(r.issue) ? byNumber.get(r.issue).title : null,
            epic: byNumber.has(r.issue) ? parentOf(byNumber.get(r.issue)) : null,
        })),
        waitingHuman: items.filter((it) => it.waitReason).map((it) => ({
            issue: it.issue, title: it.title, url: it.url || null, waitReason: it.waitReason, epic: parentOf(it),
        })),
        pendingDecisionsTotal: groups.reduce((s, g) => s + g.pendingDecisions, 0),
        nextInterview: etas.length ? { ...etas[0], atIso: iso(etas[0].at) } : null,
        blocked: (p.blocked || []).map((b) => ({ ...b })),
        recentHistory: (p.history || []).slice(0, 30).map((h) => ({
            issue: h.issue, phase: h.phase, outcome: h.outcome, note: h.note || null, endedAt: iso(h.endedAt),
        })),
        currentStatus: p.currentStatus || null,
    };
}

/**
 * モニタの「EPIC ごと」欄の HTML を作る（ブラウザへ fn.toString() で埋め込むので自己完結にする）。
 * ボタン「現在地を作る」と、現在地の artifact へのリンク・最終更新の時刻もここで出す。
 * @param {object[]} groups {@link groupItemsByEpic} の結果
 * @param {object|null} cs 現在地の状態 { url, updatedAt, running, startedAt, lastError }
 * @param {number} now 表示時刻（ms）
 * @returns {string} HTML
 */
function renderEpicGroupsHtml(groups, cs, now) {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
    const hm = (ms) => {
        const d = new Date(ms);
        const p2 = (n) => String(n).padStart(2, '0');
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    };
    const s = cs || {};
    let head = '<div class="epic-head"><h2>EPIC ごと</h2>';
    head += '<button type="button" class="cs-make" data-testid="current-status-make"' + (s.running ? ' disabled' : '') + '>'
        + (s.running ? '⏳ 現在地を作っています…' : '🧭 現在地を作る') + '</button>';
    if (s.url) {
        head += ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener" data-testid="current-status-link">現在地を開く</a>';
    }
    head += ' <span class="muted" data-testid="current-status-updated">'
        + (s.updatedAt ? '最終更新 ' + esc(hm(s.updatedAt)) : (s.url ? '' : 'まだ作っていません')) + '</span>';
    if (s.lastError) head += ' <span class="cs-err" data-testid="current-status-error">⚠ ' + esc(s.lastError) + '</span>';
    head += '</div>';
    const cards = (groups || []).map((g) => {
        const pct = g.total ? Math.round((g.done / g.total) * 100) : 0;
        let eta = '';
        if (g.eta) {
            eta = g.eta.at <= now
                ? 'いま確認できます'
                : '次の確認 ' + hm(g.eta.at) + ' ごろ';
            if (g.eta.questions) eta += '・' + g.eta.questions + ' 問';
        }
        const title = g.solo ? '単独の Issue'
            : (g.url ? '<a href="' + esc(g.url) + '" target="_blank" rel="noopener">#' + g.epic + '</a> ' : '#' + g.epic + ' ') + esc(g.title);
        const chips = [
            g.priority ? '<span class="chip">' + esc(g.priority) + '</span>' : '',
            g.stageLabel ? '<span class="chip stage-' + esc(g.stage) + '">' + esc(g.stageLabel) + '</span>' : '',
            g.running && g.running.length ? '<span class="chip run">▶ ' + g.running.length + '</span>' : '',
            g.pendingDecisions ? '<span class="chip wait" title="決定待ち">❓ ' + g.pendingDecisions + '</span>' : '',
        ].join('');
        const items = (g.items || []).map((it) => '<li>#' + it.issue + ' ' + esc(it.title)
            + (it.running ? ' <b>▶ ' + esc(it.running) + '</b>' : '')
            + (it.waitReason ? ' <span class="cs-err">🙋</span>' : '') + '</li>').join('');
        return '<div class="epic-card" data-testid="epic-group" data-key="' + esc(g.key) + '">'
            + '<div class="epic-title">' + title + ' ' + chips + '</div>'
            + (g.solo ? '' : '<div class="epic-prog"><span class="bar"><i style="width:' + pct + '%"></i></span> '
                + g.done + ' / ' + g.total + (eta ? ' · ' + esc(eta) : '') + '</div>')
            + (items ? '<details><summary>' + (g.items || []).length + ' 件</summary><ul>' + items + '</ul></details>' : '')
            + '</div>';
    }).join('');
    return head + '<div class="epic-grid">' + (cards || '<div class="muted">（まだありません）</div>') + '</div>';
}

module.exports = {
    EPIC_STAGES,
    EPIC_STAGE_LABELS,
    SOLO_GROUP_KEY,
    soloGroupKey,
    DEFAULT_ISSUE_DURATION_MS,
    priorityRank,
    decisionCount,
    countEpicDecisions,
    averageIssueDurationMs,
    epicStage,
    estimateNextInterview,
    groupItemsByEpic,
    priorityList,
    buildStatusMaterial,
    renderEpicGroupsHtml,
};
