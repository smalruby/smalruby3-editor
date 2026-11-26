'use strict';
/**
 * human-action.js — モニターの「あなた宛て」で、人間が**何をするか**を決める純粋関数（#2466）。
 *
 * 「人間待ち」を 1 つの札（🙋）でひとまとめにすると、人間の番ではないもの（🚀 after-release・⏳ 待ち）まで
 * 数えてしまい、ボタンもどれも「AI に任せる」になって、押すと何が起きるか分からなかった。
 * ここでは Status・AI Status・Kind・🙋・🧭・子の状態・ラベル・PR・質問から「すること」を 1 つに決め、
 * 動詞のボタンと「押すと: …」の説明、状態の一文を作る（親の EPIC はモニターの行の札で見せるので、一文には書かない）。材料はボードの値だけ（追加の GitHub の read をしない）。
 *
 * monitor.js がブラウザへ `fn.toString()` で埋め込むので、どの関数も**モジュールの外を参照しない**
 * （定数も中に持つ。ほかの関数を呼ぶのは、同じく埋め込む関数だけ）。I/O・`Date.now()` は持ち込まない。
 */

/**
 * 1 件の item で人間がすること（純粋関数）。kind は次のどれか:
 * check（確かめる）/ answer（答える）/ go（ゴーサイン）/ decompose（分解を始めるか決める）/
 * hand（人間の作業）/ idle（人間の番ではない）。終端（Close / Done）・Icebox は null。
 *
 * act はボタンを押して「行う」を選んだときの操作:
 * open（url を別タブで開く。リリース確認の確認ページもこれ）/ release（確認の結果を書くダイアログ）/
 * delegate（targets の 🙋 を外す）/ null（ボタンなし）。
 * @param {object} it board item（GET /board の items に humanWait の delegate を重ねたもの）
 * @param {object} [ctx] { kids: object[]（親がこの item の board item）, running: number[], questions: number[], repoUrl: string }
 * @returns {object|null} { kind, button, happens, state, act, url, targets }
 */
function humanAction(it, ctx) {
    if (!it) return null;
    const c = ctx || {};
    const repo = c.repoUrl || 'https://github.com/smalruby/smalruby3-editor';
    const s = it.status || 'New Item';
    if (s === 'Close' || s === 'Done' || s === 'Icebox') return null;
    const ai = it.aiStatus || null;
    const labels = Array.isArray(it.labels) ? it.labels : [];
    const running = c.running || [];
    const questions = c.questions || [];
    const kids = (c.kids || []).filter((k) => k && k.status !== 'Close' && k.status !== 'Done');
    const sub = it.subIssues || {};
    const issueUrl = it.url || repo + '/issues/' + it.issue;
    const openPr = (it.prs || []).find((p) => p && p.state === 'OPEN') || null;
    const prUrl = openPr ? openPr.url || repo + '/pull/' + openPr.number : null;
    const r = (kind, button, happens, state, act, url, targets) => ({
        kind, button: button || null, happens: happens || null, state: state || '', act: act || null,
        url: url || null, targets: targets || [],
    });
    const parent = it.parent && it.parent.number != null ? it.parent.number : null;
    const delegateOk = Boolean(it.delegate && it.delegate.ok);
    // 子のうち、ゴーサインを待っているもの（Sprint Backlog + 🙋・待ちでもリリース後でもない・動いていない）
    const goKid = (k) => k.status === 'Sprint Backlog' && (k.hitl || k.hitlLabel)
        && k.kind !== 'EPIC' && !k.waiting && (k.labels || []).indexOf('⏳ waiting') < 0
        && (k.labels || []).indexOf('🚀 after-release') < 0 && running.indexOf(k.issue) < 0
        && !(k.delegate && k.delegate.ok === false);
    // 宛て先: 🧱 infra の子は develop 宛て（infra-first）、ほかの EPIC の子は topic 宛て、EPIC に属さないものは develop 宛て
    const isInfra = (x) => (x.labels || []).indexOf('🧱 infra') >= 0;
    const decomposed = Boolean(it.tracker) || ai === 'EPIC Decomposed' || sub.total > 0;

    if (running.indexOf(it.issue) >= 0) return r('idle', null, null, 'AI が作業中');
    if (labels.indexOf('🚀 after-release') >= 0) {
        return r('idle', null, null, '🚀 リリース後の作業。' + (parent != null ? '#' + parent + ' を develop に出したら' : 'リリースのあとで') + ' AI が始める');
    }
    if (it.waiting || labels.indexOf('⏳ waiting') >= 0) return r('idle', null, null, '⏳ 先に済ませる Issue（autopilot-after）を待っている');
    if (questions.indexOf(it.issue) >= 0) {
        return r('answer', '答える', '質問の欄を開く。選んだ答えで AI が先へ進む', 'AI の質問への答え待ち', 'answer', null);
    }
    // リリース確認（#2430）: topic → develop の PR とプレビューで確かめる
    if (ai === 'Release Check' && it.hitl) {
        const pr = prUrl ? 'PR #' + openPr.number : 'topic → develop の PR';
        // 確認ページ（#2474）があれば、プレビュー・観点・決定待ちを 1 枚で見て答えを送る
        if (it.releasePageUrl) {
            return r('check', '確認ページを開く', 'プレビューと確認の観点・決定待ちを 1 枚で見て、答えを送る（別タブ）',
                '子は ' + (sub.completed || 0) + '/' + (sub.total || 0) + ' 済み。確認ページで ' + pr + ' のプレビューを確かめる番',
                'open', it.releasePageUrl);
        }
        return r('check', 'プレビューで確かめる', 'プレビューと ' + pr + ' を開く。確かめた結果は「確認の結果を書く」か PR のレビューで AI に返す',
            '子は ' + (sub.completed || 0) + '/' + (sub.total || 0) + ' 済み。' + pr + ' のプレビューで、成果物を確かめる番', 'release', it.previewUrl || prUrl);
    }
    if (decomposed) {
        const go = kids.filter(goKid).sort((a, b) => a.issue - b.issue);
        const done = (sub.completed || 0) + '/' + (sub.total || 0);
        if (go.length) {
            const nums = go.map((k) => '#' + k.issue).join('・');
            const button = go.length === 1 ? '#' + go[0].issue + ' を始めてもらう' : go.length + ' 件の実装を始めてもらう';
            const infraN = go.filter(isInfra).length;
            const to = infraN === 0 ? 'topic 宛ての ' : infraN === go.length ? 'develop 宛ての ' : '';
            return r('go', button, nums + ' の 🙋 を外す。AI が順に実装し、' + to + 'PR を作る',
                '子は ' + done + ' 済み。' + nums + ' があなたのゴーサイン待ち', 'delegate', null, go.map((k) => k.issue));
        }
        if (sub.total > 0 && sub.completed >= sub.total) {
            const pr = prUrl ? 'PR #' + openPr.number : 'topic → develop の PR';
            return r('check', 'プレビューで確かめる', pr + ' とプレビューを開く。結果は PR のレビューで返す',
                '子は ' + done + ' 済み。topic のプレビューで成果物を確かめる番', 'open', it.previewUrl || prUrl || issueUrl);
        }
        const hands = kids.filter((k) => k.status === 'Backlog' && (k.hitl || k.hitlLabel) && k.kind !== 'EPIC').map((k) => '#' + k.issue);
        return r('idle', null, null, '子は ' + done + ' 済み。' + (hands.length ? hands.join('・') + ' は人間の作業。' : '') + 'ほかの子を AI が進めている');
    }
    if (s === 'Review' || s === 'DoD') {
        const what = s === 'Review' ? 'あなたのレビュー待ち' : '動作の確認（DoD）待ち';
        const pr = prUrl ? 'PR #' + openPr.number : 'Issue';
        return r('check', prUrl ? 'PR を見る' : 'Issue を見る', pr + ' を開く。OK なら 🙋 を外すと AI が先へ進む',
            (prUrl ? 'PR #' + openPr.number + ' が' : '') + what, 'open', prUrl || issueUrl);
    }
    if (s === 'Blocked') {
        return r('check', 'Issue を見る', 'Issue を開く。止まった理由を確かめ、直したら 🙋 を外す', '止まった。理由はコメントにある', 'open', issueUrl);
    }
    if (ai === 'Discussing' || labels.indexOf('🔬 spike') >= 0) {
        return r('answer', '答える', 'Issue を開く。AI の質問にコメントで答え、🙋 を外すと AI が続ける', '要件の相談中。あなたの答え待ち', 'open', issueUrl);
    }
    if (ai === 'Awaiting Continuation') {
        return r('go', '続きを始めてもらう', '🙋 を外す。AI が残りの作業を続ける', '時間切れで区切った。続けてよいかのゴーサイン待ち',
            delegateOk ? 'delegate' : 'open', delegateOk ? null : issueUrl, delegateOk ? [it.issue] : []);
    }
    if (s === 'Backlog' && it.kind === 'EPIC') {
        return r('decompose', '分解を始めてもらう', 'Sprint Backlog へ動かす。AI が sub-issue に分け、設計で迷うところは質問として返す',
            'まだ分解していない EPIC', 'delegate', null, [it.issue]);
    }
    if (s === 'Backlog') {
        return r('hand', 'Issue を開く', 'Issue を開く。済んだら GitHub で閉じる', '人間が行う作業', 'open', issueUrl);
    }
    // 🙋 を外せない（planDelegate が受けない）ときはゴーサインにしない。押しても失敗するだけなので、Issue を見てもらう
    if (s === 'Sprint Backlog' && it.hitl && !(it.delegate && it.delegate.ok === false)) {
        const to = parent != null && !isInfra(it) ? 'topic 宛て' : 'develop 宛て';
        return r('go', '実装を始めてもらう', '🙋 を外す。AI が実装して ' + to + 'の PR を作る',
            (parent != null ? '' : 'EPIC に属さない。') + '着手してよいかのゴーサイン待ち', 'delegate', null, [it.issue]);
    }
    if (it.hitl && delegateOk) {
        return r('go', '先へ進めてもらう', '🙋 を外す。AI が次の作業（' + (it.delegate.nextPhase || '次のフェーズ') + '）を始める',
            (ai ? ai + ' で止まっている' : s + ' で止まっている'), 'delegate', null, [it.issue]);
    }
    if (it.hitl) return r('check', 'Issue を見る', 'Issue を開いて、何を待っているかを確かめる', s + (ai ? ' / ' + ai : ''), 'open', issueUrl);
    return r('idle', null, null, '待っている');
}

/**
 * 「あなた宛て」の人間待ちを、すること ごとの欄に分ける（純粋関数）。
 * 欄の順は 確かめる → 答える → ゴーサイン → 分解 → 人間の作業。欄の中は優先度（P0 → P3）→ 番号の小さい順。
 * 人間の番ではないもの（idle）は数えず、最後にたたんで出す。EPIC の行のゴーサインにまとめた子は、
 * 子の行として重ねて出さない。モニターの「答えが要る」の欄に出している質問の Issue は出さない。
 * @param {object} board GET /board の応答（items / humanWait / running / monitorQuestions / repo）
 * @param {object} [opts] { repoUrl }
 * @returns {{sections: object[], idle: object[], counts: {total:number, check:number, answer:number, go:number, hand:number}}}
 */
function forYouModel(board, opts) {
    const d = board || {};
    const o = opts || {};
    const items = (d.items || []).filter(Boolean);
    const byIssue = {};
    for (const it of items) byIssue[it.issue] = it;
    const running = (d.running || []).map((x) => x.issue);
    const asked = (d.monitorQuestions || []).filter((q) => q && q.status !== 'answered').map((q) => q.issue);
    const source = Array.isArray(d.humanWait)
        ? d.humanWait.filter(Boolean).map((h) => Object.assign({}, byIssue[h.issue] || {}, h))
        : items.filter((it) => it.hitl && it.status !== 'Close' && it.status !== 'Done');
    // 子にも humanWait の delegate（🙋 を外せるか）を重ねる。外せない子は EPIC のゴーサインに入れない
    const delegateOf = {};
    for (const h of Array.isArray(d.humanWait) ? d.humanWait : []) if (h && h.delegate) delegateOf[h.issue] = h.delegate;
    const kidsOf = {};
    for (const it of items) {
        const p = it.parent && it.parent.number != null ? it.parent.number : null;
        if (p != null) (kidsOf[p] = kidsOf[p] || []).push(delegateOf[it.issue] ? Object.assign({}, it, { delegate: delegateOf[it.issue] }) : it);
    }
    const rank = (p) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[p] == null ? 4 : { P0: 0, P1: 1, P2: 2, P3: 3 }[p]);
    const prio = (it) => (it.effectivePriority && it.effectivePriority.priority) || it.priority || null;
    const rows = [];
    for (const it of source) {
        if (asked.indexOf(it.issue) >= 0) continue;
        const a = humanAction(it, { kids: kidsOf[it.issue] || [], running, questions: [], repoUrl: o.repoUrl });
        if (!a) continue;
        rows.push(Object.assign({
            issue: it.issue, title: it.title || '', url: it.url || null, priority: prio(it),
            parent: it.parent && it.parent.number != null ? it.parent.number : null,
            isEpic: it.kind === 'EPIC' || Boolean(it.tracker), later: Boolean(it.later),
            delegate: it.delegate || null, previewUrl: it.previewUrl || null,
        }, a));
    }
    // EPIC の行のゴーサインにまとめた子は、子の行として重ねない
    const folded = [];
    for (const w of rows) if (w.isEpic && w.kind === 'go') for (const n of w.targets) if (n !== w.issue) folded.push(n);
    const shown = rows.filter((w) => folded.indexOf(w.issue) < 0);
    const order = (a, b) => rank(a.priority) - rank(b.priority) || a.issue - b.issue;
    const SECTIONS = [
        { kind: 'check', verb: '確かめる', why: 'できたものを、プレビューや PR で見て OK / NG を返す' },
        { kind: 'answer', verb: '答える', why: 'AI の質問・相談への答えを待っている' },
        { kind: 'go', verb: 'ゴーサインを出す', why: '作業の中身は決まっている。始めてよいかだけを決める' },
        { kind: 'decompose', verb: '分解を始めるか決める', why: 'まだ分けていない EPIC。始めると AI が sub-issue に分ける' },
        { kind: 'hand', verb: '人間の作業', why: 'AI にはできない作業。済んだら閉じる' },
    ];
    const sections = SECTIONS.map((s) => Object.assign({}, s, { rows: shown.filter((w) => w.kind === s.kind).sort(order) }))
        .filter((s) => s.rows.length);
    const idle = shown.filter((w) => w.kind === 'idle').sort(order);
    const n = (k) => shown.filter((w) => w.kind === k).length;
    const counts = { check: n('check'), answer: n('answer'), go: n('go') + n('decompose'), hand: n('hand') };
    counts.total = counts.check + counts.answer + counts.go + counts.hand;
    return { sections, idle, counts };
}

/**
 * 文の中の `#N` を、別タブで Issue / PR を開くリンクにした HTML（純粋関数）。ほかの文字はエスケープする。
 * GitHub は `/issues/N` を PR にも転送するので、PR の番号も同じ URL で開ける。
 * @param {string} text
 * @param {string} repoUrl `https://github.com/<owner>/<repo>`
 * @returns {string}
 */
function linkIssueRefs(text, repoUrl) {
    const e = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
        (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
    const base = repoUrl || 'https://github.com/smalruby/smalruby3-editor';
    return String(text == null ? '' : text).split(/(#\d+)/).map((part) => (/^#\d+$/.test(part)
        ? '<a class="ilink" href="' + e(base + '/issues/' + part.slice(1)) + '" target="_blank" rel="noopener">' + e(part) + '</a>'
        : e(part))).join('');
}

/** ブラウザへ埋め込む関数（monitor.js の SHARED_CLIENT_FNS） */
const HUMAN_ACTION_CLIENT_FNS = [humanAction, forYouModel, linkIssueRefs];

module.exports = { humanAction, forYouModel, linkIssueRefs, HUMAN_ACTION_CLIENT_FNS };
