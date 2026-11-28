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
 * - あなた宛てのタイトルのツールチップ（開く・閉じるの判定、置き場所、中身）
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
        // リリース確認（#2430）: 🙋 ありは人間がプレビューで確かめる番
        if (ai === 'Release Check' && it.hitl) return { key: 'human', tag: 'release', label: 'リリース確認' };
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
            // リリース確認（#2430）は、押すと観点と OK / NG を選ぶダイアログを開く
            const release = Boolean(dg && dg.ok && dg.nextPhase === 'release-check');
            const goLabel = dg && dg.ok
                ? (release ? '確認の結果を書く' : dg.nextPhase === 'address-review' ? 'AI に直してもらう' : 'AI に任せる') : null;
            const tag = tagOf(it, dg);
            return {
                issue: it.issue, title: it.title || '', url: it.waitUrl || it.url || null,
                reason: it.waitReason || 'other', status: it.status || null, hitl: Boolean(it.hitl),
                later: Boolean(it.later), from: it.parent && it.parent.title ? it.parent.title : null,
                parent: it.parent && it.parent.number != null ? it.parent.number : null,
                priority: prio(it), tag,
                // 差し戻し（address-review）は、押すと指摘とコメント欄を開く（#2415）
                goLabel, fix: Boolean(dg && dg.ok && dg.nextPhase === 'address-review'), delegateError: dg && !dg.ok ? dg.error || dg.code || null : null,
                release, previewUrl: it.previewUrl || null,
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
/**
 * 探す欄の文字が、Issue・PR に当たるか（純粋関数）。人間も AI も番号で話すので、Issue の番号だけでなく
 * PR の番号とブランチ名でも引ける（「PR #2513 をレビューして」と頼まれて、状況板の行が Issue の番号でも見つかるように）。
 * 先頭の `#` は外し、大文字・小文字は区別しない。空の文字はどれにも当たる。
 * @param {object} it `{issue, title, prs: [{number, branch}]}`（board の item・forYou の行・状況板のまとまり）
 * @param {string} query 探す欄の文字
 * @returns {boolean}
 */
function matchesQuery(it, query) {
    const q = String(query == null ? '' : query).trim().toLowerCase().replace(/^#/, '');
    if (!q) return true;
    const o = it || {};
    const title = String(o.title || '').replace(/^(EPIC:\s*|epic\([^)]*\):\s*|feat\([^)]*\):\s*)/i, '').toLowerCase();
    if (o.issue != null && String(o.issue).indexOf(q) >= 0) return true;
    if (title.indexOf(q) >= 0) return true;
    return (o.prs || []).some((p) => p && ((p.number != null && String(p.number).indexOf(q) >= 0)
        || String(p.branch || p.headRefName || '').toLowerCase().indexOf(q) >= 0));
}

function boardRows(groups, items, opts) {
    const o = opts || {};
    const byIssue = {};
    for (const it of items || []) if (it) byIssue[it.issue] = it;
    const running = o.running || [];
    const later = o.later || [];
    const open = o.open || [];
    const filter = o.filter || 'all';
    const q = String(o.query || '').trim().toLowerCase();
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
        const groupHit = Boolean(q) && matchesQuery({ issue: g.epic, title: g.title, prs: epicItem ? epicItem.prs : [] }, q);
        const kidHits = q ? kids.filter((k) => matchesQuery(k, q)) : kids;
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

/**
 * タイトルのツールチップの開け閉め（#2416）。開いているのは常に 1 つだけ。
 * `via` は開いたきっかけ（hover / focus / click）。押して開いたもの（click）は、ホバーやフォーカスが
 * 外れても消さない（スマホのタップは「ホバー → クリック」と来るので、押した側を勝たせる）。
 * 押して開いたものは、同じタイトルをもう一度押す・ツールチップを押す・外を押す・Esc で消える。
 * @param {{open:string|null, via:string|null}|null} state いまの状態
 * @param {{type:string, key?:string, disabled?:boolean}} ev
 *   type: enter / leave（マウスのホバー）・focus / blur・click-title / click-tip / click-outside・escape・gone（タイトルが消えた）。
 *   disabled: 左の欄が畳まれている（細い帯）ときは true。出さず、開いていたものも消す
 * @returns {{open:string|null, via:string|null}}
 */
function titleTipNext(state, ev) {
    const closed = { open: null, via: null };
    const cur = state && state.open ? { open: state.open, via: state.via || null } : closed;
    const e = ev || {};
    if (e.disabled) return closed;
    const pinned = cur.open && cur.via === 'click';
    switch (e.type) {
        case 'click-title':
            if (cur.open === e.key && pinned) return closed;
            return { open: e.key, via: 'click' };
        case 'enter':
            return pinned ? cur : { open: e.key, via: 'hover' };
        case 'focus':
            return pinned ? cur : { open: e.key, via: 'focus' };
        case 'leave':
            return cur.open === e.key && cur.via === 'hover' ? closed : cur;
        case 'blur':
            return cur.open === e.key && cur.via === 'focus' ? closed : cur;
        case 'click-tip': case 'click-outside': case 'escape': case 'gone':
            return closed;
        default:
            return cur;
    }
}

/**
 * ツールチップの置き場所。タイトルの下に入ればその下、入らなければ上。左右と上下は
 * 画面の端から 8px 内に収める。
 * @param {{top:number, bottom:number, left:number}} anchor タイトルの矩形（getBoundingClientRect）
 * @param {{width:number, height:number}} tip ツールチップの大きさ
 * @param {{width:number, height:number}} view 画面の大きさ
 * @returns {{left:number, top:number, side:string}} side は 'below' / 'above'
 */
function titleTipPlace(anchor, tip, view) {
    const m = 8;
    const gap = 6;
    const left = Math.max(m, Math.min(anchor.left, view.width - tip.width - m));
    const below = anchor.bottom + gap;
    if (below + tip.height <= view.height - m) return { left, top: below, side: 'below' };
    return { left, top: Math.max(m, anchor.top - gap - tip.height), side: 'above' };
}

/**
 * ツールチップの中身: タイトルの全文・Issue 番号・今の状態（Status と札。例「Review · 人間の番」）。
 * @param {{issue?:number, title?:string, status?:string, tag?:{label:string}}|null} w 人間待ちの行など
 * @returns {{title:string, issue:number|null, state:string|null}}
 */
function titleTipInfo(w) {
    const x = w || {};
    const parts = [];
    for (const p of [x.status, x.tag && x.tag.label]) if (p && parts.indexOf(p) < 0) parts.push(p);
    return { title: String(x.title || ''), issue: x.issue == null ? null : x.issue, state: parts.length ? parts.join(' · ') : null };
}

/**
 * bot の指摘のまとめコメントなど、GitHub の markdown を軽く整形して HTML にする（#2415）。外部の
 * ライブラリは読まない（モニターは自己完結）。見出し・箇条書き（番号つきも）・引用・コードの囲み・
 * 太字・インラインのコード・リンク（http / https だけ）を扱い、ほかは文字のまま出す。
 * **先に本文をすべてエスケープしてから**印を付けるので、本文の HTML はそのまま文字で出る（XSS を起こさない）。
 * HTML のコメント（`<!-- autopilot-... -->` の目印）は見せない。
 * @param {string} src markdown
 * @returns {string} HTML
 */
function renderMiniMarkdown(src) {
    const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const inline = (raw) => {
        const codes = [];
        let h = esc(raw).replace(/`([^`]+)`/g, (m, c) => { codes.push('<code>' + c + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
        h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            (m, t, u) => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>');
        h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        return h.replace(/\u0000(\d+)\u0000/g, (m, i) => codes[Number(i)]);
    };
    // HTML のコメントを消す。始まりを [!] と書くのは、そのまま書くと <script> の中で HTML の解釈が変わるため
    const lines = String(src || '').replace(/\r\n?/g, '\n').replace(/<[!]--[\s\S]*?-->/g, '').split('\n');
    const out = [];
    let para = [];
    let list = null; // { tag, items }
    let quote = [];
    const flushPara = () => { if (para.length) out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; };
    const flushList = () => {
        if (list) out.push('<' + list.tag + '>' + list.items.map((x) => '<li>' + inline(x) + '</li>').join('') + '</' + list.tag + '>');
        list = null;
    };
    const flushQuote = () => { if (quote.length) out.push('<blockquote>' + quote.map(inline).join('<br>') + '</blockquote>'); quote = []; };
    const flushAll = () => { flushPara(); flushList(); flushQuote(); };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*```/.test(line)) {
            flushAll();
            const code = [];
            for (i += 1; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
            out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
            continue;
        }
        const hm = line.match(/^\s*(#{1,6})\s+(.*)$/);
        if (hm) { flushAll(); const lv = Math.min(6, hm[1].length + 3); out.push('<h' + lv + '>' + inline(hm[2]) + '</h' + lv + '>'); continue; }
        const um = line.match(/^\s*[-*+]\s+(.*)$/);
        const om = um ? null : line.match(/^\s*\d+[.)]\s+(.*)$/);
        if (um || om) {
            const tag = um ? 'ul' : 'ol';
            flushPara(); flushQuote();
            if (list && list.tag !== tag) flushList();
            if (!list) list = { tag, items: [] };
            list.items.push((um || om)[1]);
            continue;
        }
        const qm = line.match(/^\s*>\s?(.*)$/);
        if (qm) { flushPara(); flushList(); quote.push(qm[1]); continue; }
        if (!line.trim()) { flushAll(); continue; }
        // 箇条書きの続きの行（字下げ）は直前の項目につなげる
        if (list && /^\s+\S/.test(line)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
        flushList(); flushQuote();
        para.push(line);
    }
    flushAll();
    return out.join('');
}

/** ブラウザへ埋め込む関数（順序は問わない。どれも自己完結） */
const INBOX_CLIENT_FNS = [
    itemSem, epicSem, inboxModel, isInboxToggleKey, matchesQuery, boardRows, recommendedAnswers, chosenAnswers, digitTarget,
    agoLabel, shortTitle, titleTipNext, titleTipPlace, titleTipInfo, renderMiniMarkdown,
];

module.exports = {
    itemSem, epicSem, inboxModel, isInboxToggleKey, matchesQuery, boardRows, recommendedAnswers, chosenAnswers, digitTarget,
    agoLabel, shortTitle, titleTipNext, titleTipPlace, titleTipInfo, renderMiniMarkdown,
    INBOX_CLIENT_FNS,
};
