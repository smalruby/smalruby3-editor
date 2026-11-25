'use strict';
/**
 * monitor-inbox.js — モニター D「あなた宛て＋表」（#2404）の判断の純粋関数。
 *
 * monitor.js がブラウザへ `fn.toString()` で埋め込むので、どの関数も**モジュールの外を参照しない**
 * （ほかの関数も呼ばない・定数も中に持つ）。I/O・`Date.now()` は持ち込まない（時刻は引数で受ける）。
 * - 状況板の行の「意味の色」（AI が作業中 / 人間の番 / 止まった / 終わった / 待っている）
 * - あなた宛て（答えが要る・学び・人間待ち）の組み立てと、人間待ちの札・EPIC ごとのまとまり
 * - 状況板の行（EPIC と sub-issue）の絞り込みと並び
 * - 質問の答え（AI の推奨 / 選んだ答え）の組み立て
 * - 数字キー 1〜4 の行き先
 */

/**
 * 1 件の Issue の意味の色と言葉。止まった（Blocked）を AI の作業中より先に見せる。
 * 依存待ち（⏳）は人間の番ではないので「待っている」の側に置く。
 * @param {object} it board item
 * @param {number[]} runningIssues いま worker が動いている Issue
 * @returns {{key:string, label:string}}
 */
function itemSem(it, runningIssues) {
    const s = it && it.status;
    if (s === 'Close' || s === 'Done') return { key: 'done', label: '終わった' };
    if (s === 'Blocked') return { key: 'stop', label: '止まった' };
    if ((runningIssues || []).indexOf(it.issue) >= 0) return { key: 'ai', label: 'AI が作業中' };
    if (it.hitl || (it.waitReason && it.waitReason !== 'waiting')) return { key: 'human', label: '人間の番' };
    if (it.waitReason === 'waiting' || it.waiting) return { key: 'idle', label: '依存待ち' };
    if (s === 'Icebox') return { key: 'idle', label: 'ずっと先' };
    return { key: 'idle', label: '待っている' };
}

/**
 * EPIC（まとまり）の意味の色。中に止まったものがあれば止まった、動いていれば AI、
 * 人間待ち・決定待ちがあれば人間の番、子が全部済めば終わった。
 * @param {object} group /board の epicGroups の 1 件
 * @param {object[]} members まとまりの item（EPIC 自身と子。board item の形）
 * @param {number[]} runningIssues
 * @returns {{key:string, label:string}}
 */
function epicSem(group, members, runningIssues) {
    const list = (members || []).filter(Boolean);
    const run = runningIssues || [];
    if (list.some((m) => m.status === 'Blocked')) return { key: 'stop', label: '止まった' };
    if ((group.running && group.running.length) || list.some((m) => run.indexOf(m.issue) >= 0)) {
        return { key: 'ai', label: 'AI が作業中' };
    }
    const humans = (group.waitingHuman || []).filter((w) => w.waitReason !== 'waiting').length;
    if (humans || group.pendingDecisions || list.some((m) => m.hitl)) return { key: 'human', label: '人間の番' };
    if (group.total && group.done >= group.total) return { key: 'done', label: '終わった' };
    return { key: 'idle', label: '待っている' };
}

/**
 * あなた宛ての中身。答えが要る質問（まだ答えていないもの）・確かめてほしい学び・人間待ち。
 * 質問のある Issue と、worker が動いている Issue は人間待ちに重ねて出さない。依存待ち（⏳）は
 * 人間の番ではないので出さない。
 *
 * 人間待ちの各行には「人間が何を待たれているか」の札（tag）を付ける。「そのほか」のような
 * あいまいな札にしない（全部が同じ札だと読む意味が無い）。決める順は、止まった → 続きの確認 →
 * 相談中 → レビュー → DoD の確認 → 分解待ち → 分解済みの EPIC（子が全部済めば topic の確認、まだなら見守り）→
 * 人間の作業 → 着手待ち → 人間の番（どれにも当たらないとき）。
 * @param {object} board /board の応答
 * @param {object|null} learnings /learnings の応答
 * @returns {{questions:object[], answered:object[], learn:object[], waits:object[]}}
 */
function inboxModel(board, learnings) {
    const d = board || {};
    const items = (d.items || []).filter(Boolean);
    const running = (d.running || []).map((r) => r.issue);
    const qs = (d.monitorQuestions || []).filter((q) => q && Array.isArray(q.questions));
    const questions = qs.filter((q) => q.status !== 'answered');
    const answered = qs.filter((q) => q.status === 'answered');
    const asked = questions.map((q) => q.issue);
    const rank = (p) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[p] == null ? 4 : { P0: 0, P1: 1, P2: 2, P3: 3 }[p]);
    const prio = (it) => (it.effectivePriority && it.effectivePriority.priority) || it.priority || null;
    const byIssue = {};
    for (const it of items) byIssue[it.issue] = it;
    // daemon が「人間待ち」と「AI に任せられるか」を決めて載せる（GET /board の humanWait）。
    // 古い daemon（humanWait なし）では items から作り、任せられるかは 🙋 の有無で見る。
    const source = Array.isArray(d.humanWait)
        ? d.humanWait.filter(Boolean).map((h) => Object.assign({}, byIssue[h.issue] || {}, h))
        : items.filter((it) => (it.hitl || (it.waitReason && it.waitReason !== 'waiting'))
            && it.status !== 'Close' && it.status !== 'Done')
            .map((it) => Object.assign({}, it, { delegate: it.hitl ? { ok: true, action: 'release', nextPhase: null } : null }));
    // EPIC の段（epic-summary.js の stage）。子が全部済んだ EPIC は 'topic-review'
    const stageOf = {};
    for (const g of d.epicGroups || []) if (g && g.epic != null) stageOf[g.epic] = g.stage || null;
    const tagOf = (it, dg) => {
        const s = it.status;
        const ai = it.aiStatus;
        const sub = it.subIssues || {};
        // 🧭 tracker は未分解の EPIC にも付いていることがあるので、それだけでは分解済みと見ない
        const decomposed = (dg && dg.code === 'tracker') || ai === 'EPIC Decomposed' || sub.total > 0;
        if (s === 'Blocked') return { key: 'stop', tag: 'blocked', label: '止まった' };
        if (ai === 'Awaiting Continuation') return { key: 'human', tag: 'continue', label: '続きの確認' };
        if (ai === 'Discussing' || it.waitReason === 'spike') return { key: 'human', tag: 'discuss', label: '相談中' };
        if (s === 'Review') return { key: 'human', tag: 'review', label: 'レビュー' };
        if (s === 'DoD') return { key: 'human', tag: 'dod', label: 'DoD の確認' };
        if (dg && dg.ok && dg.nextPhase === 'decompose') return { key: 'idle', tag: 'decompose', label: '分解待ち' };
        if (decomposed) {
            const allDone = stageOf[it.issue] === 'topic-review' || (sub.total > 0 && sub.completed >= sub.total);
            return allDone ? { key: 'human', tag: 'topic', label: 'topic の確認' } : { key: 'idle', tag: 'watch', label: '見守り' };
        }
        if (dg && dg.code === 'human-work') return { key: 'human', tag: 'work', label: '人間の作業' };
        if (dg && dg.ok) return { key: 'idle', tag: 'start', label: '着手待ち' };
        return { key: 'human', tag: 'other', label: '人間の番' };
    };
    const waits = source
        .filter((it) => asked.indexOf(it.issue) < 0 && running.indexOf(it.issue) < 0)
        .sort((a, b) => rank(prio(a)) - rank(prio(b)) || a.issue - b.issue)
        .map((it) => {
            const dg = it.delegate || null;
            // Review / DoD で任せると差し戻し（address-review）になる。「OK」と取りちがえないよう文言を変える
            const goLabel = dg && dg.ok ? (dg.nextPhase === 'address-review' ? 'AI に直してもらう' : 'AI に任せる') : null;
            const tag = tagOf(it, dg);
            return {
                issue: it.issue, title: it.title || '', url: it.waitUrl || it.url || null,
                reason: it.waitReason || 'other', status: it.status || null, hitl: Boolean(it.hitl),
                later: Boolean(it.later), from: it.parent && it.parent.title ? it.parent.title : null,
                parent: it.parent && it.parent.number != null ? it.parent.number : null,
                // 自分が EPIC なら、行ではなく自分のまとまりの見出しに畳む（inboxGroups）
                isEpic: it.kind === 'EPIC' || Boolean(it.tracker) || tag.tag === 'topic' || tag.tag === 'watch',
                priority: prio(it), tag,
                goLabel, delegateError: dg && !dg.ok ? dg.error || dg.code || null : null,
            };
        });
    const learn = [];
    const act = learnings && learnings.action;
    // 「確かめてほしい」のは、PR を作る / マージする の 2 つ（作っている途中・何もしないは出さない）
    if (act && (act.action === 'create' || act.action === 'merge')) {
        learn.push({
            count: learnings.count || 0, label: act.label || '', disabled: Boolean(act.disabled),
            reason: (learnings.plan && learnings.plan.reason) || '', error: learnings.error || null,
        });
    }
    return { questions, answered, learn, waits };
}

/**
 * 人間待ちを親の EPIC ごとのまとまりにする。EPIC 自身の行（分解済みの見守り・分解待ちなど）は
 * 行にせず、そのまとまりの見出し（header）に畳む。EPIC の無い Issue は「EPIC に属さない」のまとまり。
 *
 * 並びは「押せるもの（AI に任せられる行）があるまとまり」→「人間の作業があるまとまり」→
 * 「見守りだけのまとまり」の順にし、同じ段の中は優先度（P0→P3）→ EPIC の番号の大きい順。
 * 「EPIC に属さない」は同じ段の最後に置く（押せる行を、押せない見守りの EPIC の下に沈めないため）。
 * まとまりの中は、押せる行 → 優先度 → 番号の小さい順。
 * @param {object[]} waits inboxModel の waits
 * @param {object} [opts] { epicGroups, items, limit（1 まとまりで最初に見せる行の数・既定 4）, open: string[]（全部を見せるまとまりの key） }
 * @returns {object[]} { key, epic, title, url, priority, header, rows, hidden, tier, count }
 */
function inboxGroups(waits, opts) {
    const o = opts || {};
    const limit = o.limit == null ? 4 : o.limit;
    const open = (o.open || []).map(String);
    const rankOf = (p) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[p] == null ? 4 : { P0: 0, P1: 1, P2: 2, P3: 3 }[p]);
    const itemOf = {};
    for (const it of o.items || []) if (it) itemOf[it.issue] = it;
    const groupOf = {};
    for (const g of o.epicGroups || []) if (g && g.epic != null) groupOf[g.epic] = g;
    const byKey = {};
    const order = [];
    const ensure = (key, epic) => {
        if (!byKey[key]) { byKey[key] = { key, epic, header: null, rows: [], from: null }; order.push(key); }
        return byKey[key];
    };
    for (const w of waits || []) {
        if (!w) continue;
        if (w.isEpic) ensure(String(w.issue), w.issue).header = w;
        else if (w.parent != null) { const g = ensure(String(w.parent), w.parent); g.rows.push(w); g.from = g.from || w.from; }
        else ensure('none', null).rows.push(w);
    }
    const human = (w) => w.tag && (w.tag.key === 'human' || w.tag.key === 'stop');
    const out = order.map((key) => {
        const g = byKey[key];
        const it = g.epic != null ? itemOf[g.epic] || null : null;
        const eg = g.epic != null ? groupOf[g.epic] || null : null;
        const h = g.header;
        const priority = g.epic == null ? null
            : (h && h.priority) || (it && ((it.effectivePriority && it.effectivePriority.priority) || it.priority)) || (eg && eg.priority) || null;
        const rows = g.rows.slice().sort((a, b) => (b.goLabel ? 1 : 0) - (a.goLabel ? 1 : 0)
            || rankOf(a.priority) - rankOf(b.priority) || a.issue - b.issue);
        const all = (h ? [h] : []).concat(rows);
        const tier = all.some((w) => w.goLabel) ? 0 : (all.some(human) ? 1 : 2);
        const shown = open.indexOf(key) >= 0 ? rows : rows.slice(0, limit);
        return {
            key, epic: g.epic,
            title: g.epic == null ? 'EPIC に属さない' : (h && h.title) || (it && it.title) || g.from || (eg && eg.title) || '#' + g.epic,
            url: (h && h.url) || (it && it.url) || null,
            priority, header: h, rows: shown, hidden: rows.length - shown.length, tier, count: rows.length,
        };
    });
    return out.sort((a, b) => a.tier - b.tier || (a.epic == null ? 1 : 0) - (b.epic == null ? 1 : 0)
        || rankOf(a.priority) - rankOf(b.priority) || (b.epic || 0) - (a.epic || 0));
}

/**
 * 「あなた宛て」を開け閉めするキー（`[`）。入力欄の中と、⌘ / Ctrl / Alt との組み合わせでは効かない。
 * キーの位置ではなく文字（`key`）で見る（JIS 配列では `[` の位置がちがう）。
 * @param {{key:string, metaKey?:boolean, ctrlKey?:boolean, altKey?:boolean, inInput?:boolean}} ev
 * @returns {boolean}
 */
function isInboxToggleKey(ev) {
    return Boolean(ev && !ev.inInput && !ev.metaKey && !ev.ctrlKey && !ev.altKey && ev.key === '[');
}

/**
 * 状況板の行（EPIC の行・子の行・空の行）を作る。チップ（すべて / 人間の番 / AI が作業中 /
 * 止まった / あとで）と文字の絞り込みを当てる。「あとで」以外では 💤 later の子を隠す。
 * 文字の絞り込みが子に当たったまとまりは、当たった子だけを開いて見せる。
 * @param {object[]} groups /board の epicGroups
 * @param {object[]} items /board の items
 * @param {object} opts { filter, query, open: string[]（開いているまとまりの key）, running: number[], later: number[] }
 * @returns {object[]} { type:'epic', group, epicItem, sem, humanN, index, open } / { type:'kid', item, sem, key } / { type:'empty', key }
 */
function boardRows(groups, items, opts) {
    const o = opts || {};
    const byIssue = {};
    for (const it of items || []) if (it) byIssue[it.issue] = it;
    const running = o.running || [];
    const later = o.later || [];
    const open = o.open || [];
    const filter = o.filter || 'all';
    const q = String(o.query || '').trim().toLowerCase();
    const short = (t) => String(t || '').replace(/^(EPIC:\s*|epic\([^)]*\):\s*|feat\([^)]*\):\s*)/i, '');
    const hit = (num, title) => !q || String(num).indexOf(q.replace(/^#/, '')) >= 0 || short(title).toLowerCase().indexOf(q) >= 0;
    const semOf = (it) => {
        const s = it.status;
        if (s === 'Close' || s === 'Done') return { key: 'done', label: '終わった' };
        if (s === 'Blocked') return { key: 'stop', label: '止まった' };
        if (running.indexOf(it.issue) >= 0) return { key: 'ai', label: 'AI が作業中' };
        if (it.hitl || (it.waitReason && it.waitReason !== 'waiting')) return { key: 'human', label: '人間の番' };
        if (it.waitReason === 'waiting' || it.waiting) return { key: 'idle', label: '依存待ち' };
        if (s === 'Icebox') return { key: 'idle', label: 'ずっと先' };
        return { key: 'idle', label: '待っている' };
    };
    const rows = [];
    let index = 0;
    for (const g of groups || []) {
        const epicItem = g.epic != null ? byIssue[g.epic] || null : null;
        const kidsAll = (g.items || []).map((c) => byIssue[c.issue] || c);
        const kids = kidsAll.filter((k) => (filter === 'later' ? later.indexOf(k.issue) >= 0 : later.indexOf(k.issue) < 0));
        if (filter === 'later' && !kids.length && !(epicItem && later.indexOf(epicItem.issue) >= 0)) continue;
        const members = [epicItem].concat(kids).filter(Boolean);
        let sem;
        if (members.some((m) => m.status === 'Blocked')) sem = { key: 'stop', label: '止まった' };
        else if ((g.running && g.running.length) || members.some((m) => running.indexOf(m.issue) >= 0)) sem = { key: 'ai', label: 'AI が作業中' };
        else if ((g.waitingHuman || []).some((w) => w.waitReason !== 'waiting') || g.pendingDecisions || members.some((m) => m.hitl)) sem = { key: 'human', label: '人間の番' };
        else if (g.total && g.done >= g.total) sem = { key: 'done', label: '終わった' };
        else sem = { key: 'idle', label: '待っている' };
        const humanN = members.filter((m) => m.hitl || (m.waitReason && m.waitReason !== 'waiting')).length + (g.pendingDecisions || 0);
        if (filter === 'human' && !humanN && sem.key !== 'human') continue;
        if (filter === 'ai' && sem.key !== 'ai') continue;
        if (filter === 'stop' && sem.key !== 'stop') continue;
        const groupHit = hit(g.epic == null ? '' : g.epic, g.title);
        const kidHits = q ? kids.filter((k) => hit(k.issue, k.title)) : kids;
        if (q && !groupHit && !kidHits.length) continue;
        index += 1;
        const isOpen = (q && !groupHit) || open.indexOf(String(g.key)) >= 0;
        rows.push({ type: 'epic', group: g, epicItem, sem, humanN, index, open: Boolean(isOpen) });
        if (!isOpen) continue;
        const shown = q && !groupHit ? kidHits : kids;
        for (const k of shown) rows.push({ type: 'kid', item: k, sem: semOf(k), key: String(g.key) });
        if (!shown.length) rows.push({ type: 'empty', key: String(g.key) });
    }
    return rows;
}

/**
 * 「AI に任せる（推奨で進める）」の答え。全部の質問に AI の推奨があるときだけ作れる
 * （推奨の無い質問が 1 つでもあれば ok=false。人間が選ぶ）。メモがあれば一緒に送る。
 * @param {object} entry monitorQuestions の 1 件
 * @param {object} [notes] 質問 id → メモ
 * @returns {{ok:boolean, answers:object[]}}
 */
function recommendedAnswers(entry, notes) {
    const n = notes || {};
    const qs = (entry && entry.questions) || [];
    if (!qs.length || qs.some((q) => !q.recommended)) return { ok: false, answers: [] };
    return {
        ok: true,
        answers: qs.map((q) => ({ q: q.id, key: q.recommended, note: n[q.id] ? String(n[q.id]).trim() || null : null })),
    };
}

/**
 * 人間が選んだ答え（とメモ）。`requireAll` のときは全部の質問に選んだ答えがあるときだけ ok。
 * 「メモだけ保存」では選んだ答えかメモのある質問だけを送る（どちらも無い質問は送らない）。
 * @param {object} entry monitorQuestions の 1 件
 * @param {object} picks 質問 id → 選んだ key
 * @param {object} notes 質問 id → メモ
 * @param {boolean} requireAll
 * @returns {{ok:boolean, answers:object[], missing:string[]}}
 */
function chosenAnswers(entry, picks, notes, requireAll) {
    const p = picks || {};
    const n = notes || {};
    const answers = [];
    const missing = [];
    for (const q of (entry && entry.questions) || []) {
        const key = p[q.id] || null;
        const note = n[q.id] ? String(n[q.id]).trim() : '';
        if (!key) missing.push(q.id);
        if (key || note) answers.push({ q: q.id, key, note: note || null });
    }
    const ok = requireAll ? missing.length === 0 && answers.length > 0 : answers.length > 0;
    return { ok, answers, missing };
}

/**
 * 数字キーの行き先（GitHub と同じく入力欄の外の数字だけ。⌘/Ctrl/Alt との組み合わせは
 * ブラウザのタブの切りかえや記号の入力と重なるので使わない）。
 * @param {{code:string, metaKey?:boolean, ctrlKey?:boolean, altKey?:boolean, inInput?:boolean}} ev
 * @returns {string|null} 'inbox' / 'board' / 'hist' / 'tasks'
 */
function digitTarget(ev) {
    if (!ev || ev.inInput || ev.metaKey || ev.ctrlKey || ev.altKey) return null;
    const m = /^Digit([1-4])$/.exec(ev.code || '');
    return m ? ['inbox', 'board', 'hist', 'tasks'][Number(m[1]) - 1] : null;
}

/**
 * 「N 分前」のような短い経過（更新・実行時間）。
 * @param {number} ms 経過ミリ秒
 * @returns {string}
 */
function agoLabel(ms) {
    const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    if (s < 60) return s + ' 秒';
    if (s < 3600) return Math.floor(s / 60) + ' 分';
    if (s < 86400) return Math.floor(s / 3600) + ' 時間';
    return Math.floor(s / 86400) + ' 日';
}

/**
 * 題名の頭の「EPIC:」「feat(...):」を落とす（行が詰まるので。番号はリンクで出している）。
 * @param {string} t
 * @returns {string}
 */
function shortTitle(t) {
    return String(t || '').replace(/^(EPIC:\s*|epic\([^)]*\):\s*|feat\([^)]*\):\s*)/i, '');
}

/** ブラウザへ埋め込む関数（順序は問わない。どれも自己完結） */
const INBOX_CLIENT_FNS = [
    itemSem, epicSem, inboxModel, inboxGroups, isInboxToggleKey, boardRows, recommendedAnswers, chosenAnswers, digitTarget,
    agoLabel, shortTitle,
];

module.exports = {
    itemSem, epicSem, inboxModel, inboxGroups, isInboxToggleKey, boardRows, recommendedAnswers, chosenAnswers, digitTarget,
    agoLabel, shortTitle,
    INBOX_CLIENT_FNS,
};
