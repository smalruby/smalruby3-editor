'use strict';
/**
 * epic-flow.js — EPIC 単位の確認（EPIC #2384 / #2385）の判断ロジック。純粋関数のみ。
 *
 * 人間が決めるのは最初の EPIC の設計だけにし、topic へのマージ直前まで AI のおすすめで進める。
 * そのための判断をここに集める（I/O は epic-merge.js / daemon.js / project.js）:
 *
 * - **EPIC の流れ**かどうか（PR の base が `topic/` のブランチ）: {@link isEpicFlowBase}
 * - **run の結果をどう反映するか**（review の Must の数で「マージ待ち / 直す / 止める」）: {@link resolveRunOutcome}
 * - **Must の直しは 3 回まで**: {@link mustFixPlan}
 * - **topic への自動マージ**（Must 0・CI 通過・コンフリクト無し）: {@link autoMergePlan}
 * - **EPIC の「決定待ち」まとめコメント**（daemon だけが書く）: {@link renderEpicDecisionsComment} ほか
 *
 * phases.js を require するが、phases.js からは require しない（循環させない）。phaseForItem は
 * ctx の `autoMerge` フラグ（{@link markAutoMergeContexts} が立てる）だけを見る。
 */

const { applyResult, hitlDesireFromResult, isTrackerItem, isCheckpointResult } = require('./phases');

/** EPIC の流れの base の接頭辞。topic へのマージは daemon、develop へは人間 */
const EPIC_FLOW_BASE_PREFIX = 'topic/';

/** Must の直し（address-review → review）の上限。超えたらその sub-issue だけ止めて EPIC の確認に載せる */
const MAX_MUST_FIX_ROUNDS = 3;

/**
 * 途中で 🙋 を出してよい理由（`hitlKind`）。これ以外の 🙋 は EPIC の流れでは出さない
 * （出てしまったら daemon が警告し、決定待ちに載せる）。
 * - `diverge`: 3 案以上に分かれる判断
 * - `must-exhausted`: 直しを 3 回しても Must が残る（daemon が自分で作る）
 * - `environment`: エラーで続けられない（認証・使用量・壊れた環境）
 * - `design`: EPIC そのものの設計（最初の discuss / decompose の承認）。EPIC の子では使わない
 */
const HITL_KINDS = ['diverge', 'must-exhausted', 'environment', 'design'];

/** EPIC の子で 🙋 を出さないフェーズ（設計の承認のあとは AI のおすすめで進める） */
const EPIC_CHILD_NO_HITL_PHASES = new Set(['triage', 'discuss', 'decompose', 'review']);

/** EPIC の子で 🙋 を出してよい hitlKind */
const EPIC_CHILD_ALLOWED_HITL = new Set(['diverge', 'must-exhausted', 'environment']);

/**
 * 決定待ちの種類（結果ファイルの `decisions[].kind`）。
 * - `question`: review の Question で、仕様の選択が要るもの
 * - `not-adopted`: 採用しなかった指摘（見送り）
 * - `ai-decision`: 決まっていなかったことを AI のおすすめで決めた
 * - `two-way`: 2 案に分かれた。おすすめを topic へ、もう 1 案を別ブランチの draft PR にした
 * - `diverge`: 3 案以上に分かれた。その sub-issue だけ止めた（指揮役が決定ページを作る）
 * - `must-exhausted`: 3 回直しても Must が残った（daemon が作る）
 * - `unexpected-hitl`: EPIC の子で出すはずのない 🙋 が出た（daemon が作る）
 */
const DECISION_KINDS = ['question', 'not-adopted', 'ai-decision', 'two-way', 'diverge', 'must-exhausted', 'unexpected-hitl'];

/** 決定待ちの表示名 */
const DECISION_KIND_LABELS = {
    question: '質問',
    'not-adopted': '採用しなかった指摘',
    'ai-decision': 'AI が決めたこと',
    'two-way': '2 案（別ブランチあり）',
    diverge: '3 案以上（止めています）',
    'must-exhausted': 'Must が残った（止めています）',
    'unexpected-hitl': '想定外の確認（止めています）',
};

/** 止めている（人間の答えが要る）種類 */
const BLOCKING_DECISION_KINDS = new Set(['diverge', 'must-exhausted', 'unexpected-hitl']);

/** EPIC の「決定待ち」まとめコメントのマーカー（1 つだけ。書くのは daemon だけ） */
const EPIC_DECISIONS_MARKER = '<!-- autopilot-epic-decisions -->';

/** まとめコメントに埋める機械用データ（base64 の JSON。`-->` を含まないように） */
const EPIC_DECISIONS_DATA_RE = /<!--\s*autopilot-epic-decisions-data:([A-Za-z0-9+/=]*)\s*-->/;

/** CI のチェックが 1 つも無い PR を「通過」とみなすまでの猶予（push 直後はまだ登録されていない） */
const AUTO_MERGE_NO_CHECKS_GRACE_MS = 10 * 60 * 1000;

/**
 * PR の base が EPIC の流れ（topic への自動マージ・🙋 を 3 つだけ）か。
 * `autopilot-base:` で `topic/...` を指した Issue の PR が対象。develop（既定）は今までどおり人間。
 * @param {string|null|undefined} base
 * @param {string} [defaultBase]
 * @returns {boolean}
 */
function isEpicFlowBase(base, defaultBase = 'develop') {
    return typeof base === 'string' && base.startsWith(EPIC_FLOW_BASE_PREFIX) && base !== defaultBase;
}

/**
 * 2 案に分かれたとき、もう 1 案を置くブランチ名（`topic/<epic のブランチ>-alt-<番号>`）。
 * `<epic のブランチ>` は base（`topic/...`）から `topic/` を除いたもの。番号は sub-issue の番号。
 * @param {string} base 例 `topic/autopilot-redesign-2384`
 * @param {number} issue
 * @returns {string}
 */
function altBranchName(base, issue) {
    const stem = String(base || '').replace(/^topic\//, '');
    return `topic/${stem}-alt-${issue}`;
}

/**
 * review の結果（Must の残りと round）から、次にどうするかを決める。
 * - Must 0 → `merge`（topic への自動マージ待ち）
 * - Must あり・直しが 3 回未満 → `fix`（address-review が直す → review）
 * - Must あり・直しが 3 回 → `escalate`（その sub-issue だけ止める）
 * 直した回数は round - 1（review の 1 回目は直す前。直すたびに review が 1 回増える）。
 * @param {{mustCount: number, round?: number, maxFixes?: number}} p
 * @returns {'merge'|'fix'|'escalate'}
 */
function mustFixPlan({ mustCount, round = 1, maxFixes = MAX_MUST_FIX_ROUNDS }) {
    if (!(mustCount > 0)) return 'merge';
    const fixesDone = Math.max(0, (Number(round) || 1) - 1);
    return fixesDone < maxFixes ? 'fix' : 'escalate';
}

/**
 * worker の結果を Project の意図と 🙋 の希望に変える（EPIC の流れの上書き付き）。
 * EPIC の流れでない、または上書きの対象でない結果は従来どおり（{@link applyResult} /
 * {@link hitlDesireFromResult}）。
 *
 * EPIC の流れでの上書き:
 * - **review（done・`mustCount` あり）**: {@link mustFixPlan} の結果で
 *   `merge` = Review + 🙋 なし（daemon の自動マージ待ち）/ `fix` = In Progress + Addressing Comments +
 *   🙋 なし（address-review が直す）/ `escalate` = Blocked + 🙋（`escalation` を返す）
 * - **address-review の自動の直し**（着手前が In Progress + Addressing Comments）で done →
 *   In Progress + Self-Reviewing + 🙋 なし（もう一度 review）
 * - **checkpoint**（Awaiting Continuation）→ 🙋 なしで続きを自動で再開（反復上限は既存のまま）
 * - **想定外の 🙋**（EPIC の子の triage / discuss / decompose / review で `hitlKind` が許可外）→
 *   🙋 は残す（安全側）が `warnings` に `unexpected-hitl` を足す（daemon が決定待ちに載せる）
 * @param {object} result 検証済み結果
 * @param {{epicFlow?: boolean, priorStatus?: string|null, priorAiStatus?: string|null, maxFixes?: number}} [ctx]
 * @returns {{intents: Array<{field:string,value:string|null}>, hitl: boolean,
 *   escalation: object|null, warnings: string[], plan: string|null}}
 */
function resolveRunOutcome(result, ctx = {}) {
    const base = { intents: applyResult(result), hitl: hitlDesireFromResult(result), escalation: null, warnings: [], plan: null };
    if (!result || !ctx.epicFlow) return base;
    const set = (pairs) => pairs.map(([field, value]) => ({ field, value }));
    if (result.phase === 'review' && result.signal === 'done' && Number.isInteger(result.mustCount)) {
        const plan = mustFixPlan({ mustCount: result.mustCount, round: result.round, maxFixes: ctx.maxFixes });
        if (plan === 'merge') {
            return { ...base, plan, intents: set([['Status', 'Review'], ['AI Status', null]]), hitl: false };
        }
        if (plan === 'fix') {
            return { ...base, plan, intents: set([['Status', 'In Progress'], ['AI Status', 'Addressing Comments']]), hitl: false };
        }
        return {
            ...base,
            plan,
            intents: set([['Status', 'Blocked'], ['AI Status', null]]),
            hitl: true,
            escalation: { kind: 'must-exhausted', mustCount: result.mustCount, round: Number(result.round) || 1 },
        };
    }
    const autoFix = ctx.priorStatus === 'In Progress' && ctx.priorAiStatus === 'Addressing Comments';
    if (result.phase === 'address-review' && result.signal === 'done' && autoFix) {
        return { ...base, plan: 'review', intents: set([['Status', 'In Progress'], ['AI Status', 'Self-Reviewing']]), hitl: false };
    }
    if (isCheckpointResult(result)) {
        return { ...base, plan: 'continue', hitl: false };
    }
    if (result.signal === 'hitl' && EPIC_CHILD_NO_HITL_PHASES.has(result.phase)
        && !EPIC_CHILD_ALLOWED_HITL.has(result.hitlKind)) {
        return { ...base, warnings: ['unexpected-hitl'] };
    }
    return base;
}

/**
 * 決定待ちの 1 件を正規化する（足りない issue / pr を補い、文字列を整える）。
 * @param {object} d 結果ファイルの decisions[] の 1 件
 * @param {{issue?: number, pr?: number|null}} [fill]
 * @returns {object|null} 不正なら null
 */
function normalizeDecision(d, fill = {}) {
    if (!d || typeof d !== 'object' || !DECISION_KINDS.includes(d.kind)) return null;
    const title = typeof d.title === 'string' ? d.title.trim() : '';
    if (!title) return null;
    const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const int = (v) => (Number.isInteger(v) && v > 0 ? v : null);
    return {
        kind: d.kind,
        issue: int(d.issue) || int(fill.issue),
        pr: int(d.pr) || int(fill.pr),
        ref: str(d.ref),
        title,
        recommendation: str(d.recommendation),
        alternatives: Array.isArray(d.alternatives) ? d.alternatives.map(str).filter(Boolean) : [],
        adopted: str(d.adopted),
        altPr: int(d.altPr),
        preview: str(d.preview),
        altPreview: str(d.altPreview),
    };
}

/**
 * 結果ファイルの decisions を正規化して返す。
 * @param {object} result
 * @param {{issue?: number, pr?: number|null}} [fill]
 * @returns {object[]}
 */
function decisionsFromResult(result, fill = {}) {
    if (!result || !Array.isArray(result.decisions)) return [];
    return result.decisions.map((d) => normalizeDecision(d, fill)).filter(Boolean);
}

/**
 * daemon 自身が作る決定待ち（Must が残った・想定外の 🙋）。
 * @param {{kind: string, mustCount?: number, round?: number, reason?: string}} e
 * @param {{issue: number, pr?: number|null}} where
 * @returns {object}
 */
function daemonDecision(e, where) {
    if (e.kind === 'must-exhausted') {
        return normalizeDecision({
            kind: 'must-exhausted',
            title: `${(Number(e.round) || 1) - 1} 回直しても Must が ${e.mustCount} 件残りました`,
            recommendation: 'PR のまとめコメントの Must を見て、直し方を決めてください（🙋 を外すと再開します）',
            alternatives: ['この sub-issue を見送る', '方針を変えて作り直す'],
        }, where);
    }
    return normalizeDecision({
        kind: 'unexpected-hitl',
        title: `EPIC の途中で確認が出ました: ${String(e.reason || '').slice(0, 200) || '(理由なし)'}`,
        recommendation: 'Issue のコメントを見て答え、🙋 を外してください',
    }, where);
}

/** 決定待ちの同一性（同じものを二重に載せない）。同じ Issue・種類・ID・題なら同じ */
function decisionKey(d) {
    return [d.issue || '', d.kind, d.ref || '', d.title].join('|');
}

/**
 * 既存の決定待ちに新しいものを足す（同じものは新しい内容で置きかえ、順番は保つ）。
 * @param {object[]} existing
 * @param {object[]} incoming
 * @returns {object[]}
 */
function mergeDecisionEntries(existing, incoming) {
    const out = [...(existing || [])];
    for (const d of incoming || []) {
        const k = decisionKey(d);
        const i = out.findIndex((x) => decisionKey(x) === k);
        if (i >= 0) out[i] = { ...out[i], ...d };
        else out.push(d);
    }
    return out;
}

/**
 * まとめコメントから機械用データ（決定待ちの配列）を読む。読めなければ空配列。
 * @param {string} body
 * @returns {object[]}
 */
function parseEpicDecisionsData(body) {
    const m = String(body || '').match(EPIC_DECISIONS_DATA_RE);
    if (!m) return [];
    try {
        const arr = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'));
        return Array.isArray(arr) ? arr.map((d) => normalizeDecision(d)).filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

/**
 * コメントの中から決定待ちのまとめコメントを探す（先頭の 1 件）。
 * @param {Array<{id: string|number, body?: string}>} comments
 * @returns {object|null}
 */
function findEpicDecisionsComment(comments) {
    return (comments || []).find((c) => c && String(c.body || '').includes(EPIC_DECISIONS_MARKER)) || null;
}

/** 1 行に収める（改行を空白に） */
function oneLine(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * 決定待ちのまとめコメントの本文を作る。Issue ごとに並べ、止めているものを先に出す。
 * @param {object[]} entries 正規化済み
 * @returns {string}
 */
function renderEpicDecisionsComment(entries) {
    const list = entries || [];
    const blocking = list.filter((d) => BLOCKING_DECISION_KINDS.has(d.kind)).length;
    const lines = [
        EPIC_DECISIONS_MARKER,
        '## 決定待ち（autopilot がまとめています）',
        '',
        list.length
            ? `${list.length} 件（止めているもの ${blocking} 件）。EPIC を develop へ出す前に、指揮役が決定ページにまとめて確認します。`
            : 'まだありません。',
        '',
        '> このコメントは daemon だけが書きます。答えはこの Issue に別のコメントで書いてください。',
    ];
    const byIssue = new Map();
    for (const d of list) {
        const k = d.issue || 0;
        if (!byIssue.has(k)) byIssue.set(k, []);
        byIssue.get(k).push(d);
    }
    for (const [issue, ds] of byIssue) {
        const sorted = [...ds].sort((a, b) => Number(BLOCKING_DECISION_KINDS.has(b.kind)) - Number(BLOCKING_DECISION_KINDS.has(a.kind)));
        const prs = [...new Set(ds.map((d) => d.pr).filter(Boolean))];
        lines.push('', `### ${issue ? `#${issue}` : '（Issue 不明）'}${prs.length ? ` / PR ${prs.map((n) => `#${n}`).join(', ')}` : ''}`);
        for (const d of sorted) {
            const label = DECISION_KIND_LABELS[d.kind] || d.kind;
            lines.push(`- **[${label}]**${d.ref ? ` ${d.ref}` : ''} ${oneLine(d.title)}`);
            if (d.recommendation) lines.push(`  - AI の案: ${oneLine(d.recommendation)}`);
            if (d.alternatives.length) lines.push(`  - ほかの案: ${d.alternatives.map(oneLine).join(' ／ ')}`);
            if (d.adopted) lines.push(`  - 入れたもの: ${oneLine(d.adopted)}`);
            const links = [];
            if (d.pr) links.push(`PR #${d.pr}`);
            if (d.altPr) links.push(`別案 #${d.altPr}（draft）`);
            if (d.preview) links.push(`プレビュー ${d.preview}`);
            if (d.altPreview) links.push(`別案のプレビュー ${d.altPreview}`);
            if (links.length && (d.kind === 'two-way' || d.altPr || d.preview)) lines.push(`  - ${links.join(' ／ ')}`);
        }
    }
    const data = Buffer.from(JSON.stringify(list), 'utf8').toString('base64');
    lines.push('', `<!-- autopilot-epic-decisions-data:${data} -->`);
    return lines.join('\n');
}

/**
 * まとめコメントの次の本文を作る。足すものが無い・変わらないなら null（書かない）。
 * @param {object|null} existingComment {@link findEpicDecisionsComment} の結果
 * @param {object[]} incoming 足す決定待ち（正規化済み）
 * @returns {string|null}
 */
function nextEpicDecisionsBody(existingComment, incoming) {
    if (!incoming || !incoming.length) return null;
    const prev = existingComment ? parseEpicDecisionsData(existingComment.body) : [];
    const merged = mergeDecisionEntries(prev, incoming);
    const body = renderEpicDecisionsComment(merged);
    return existingComment && existingComment.body === body ? null : body;
}

/**
 * Must が残ってその sub-issue を止めたときに、sub-issue に残す説明コメント。
 * @param {{mustCount: number, round: number}} e
 * @param {number|null} epic
 * @returns {string}
 */
function mustExhaustedBody(e, epic) {
    return [
        '<!-- autopilot-must-exhausted -->',
        `🛑 Must の直しを ${(Number(e.round) || 1) - 1} 回しても、Must が ${e.mustCount} 件残りました。この sub-issue だけ止めます。`,
        '',
        epic ? `EPIC #${epic} の「決定待ち」に載せました。` : 'EPIC が見つからなかったため、決定待ちには載せていません。',
        'PR のレビューのまとめコメントを見て方針を決め、`🙋 HITL` を外すと address-review から再開します。',
    ].join('\n');
}

/**
 * statusCheckRollup（`gh pr view --json statusCheckRollup`）から CI の状態をまとめる。
 * - CheckRun: status が COMPLETED でなければ pending、conclusion が失敗系なら failure
 * - StatusContext: state が PENDING / EXPECTED なら pending、FAILURE / ERROR なら failure
 * @param {Array<object>} rollup
 * @returns {'success'|'pending'|'failure'|'none'}
 */
function ciStateFromRollup(rollup) {
    const list = Array.isArray(rollup) ? rollup.filter(Boolean) : [];
    if (!list.length) return 'none';
    const FAIL = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR']);
    let pending = false;
    for (const c of list) {
        if (c.__typename === 'StatusContext' || (c.state && !c.status)) {
            const s = String(c.state || '').toUpperCase();
            if (FAIL.has(s)) return 'failure';
            if (s === 'PENDING' || s === 'EXPECTED' || !s) pending = true;
            continue;
        }
        if (String(c.status || '').toUpperCase() !== 'COMPLETED') { pending = true; continue; }
        if (FAIL.has(String(c.conclusion || '').toUpperCase())) return 'failure';
    }
    return pending ? 'pending' : 'success';
}

/**
 * topic 宛ての PR を自動でマージしてよいかを決める（Must 0 は呼び出し側の前提 = Review + 🙋 なし）。
 * @param {object} facts `gh pr view --json number,state,isDraft,baseRefName,mergeable,reviewDecision,statusCheckRollup,updatedAt`
 *   + 任意の `unhandledRequestedReviews`（daemon が selectRequestedReviews で数えたもの）
 * @param {{nowMs?: number, graceMs?: number, defaultBase?: string}} [opts]
 * @returns {{action: 'merge'|'wait'|'conflict'|'fix'|'skip', reason: string}}
 */
function autoMergePlan(facts, opts = {}) {
    if (!facts) return { action: 'skip', reason: 'PR がありません' };
    if (facts.state && facts.state !== 'OPEN') return { action: 'skip', reason: `PR は ${facts.state}` };
    if (!isEpicFlowBase(facts.baseRefName, opts.defaultBase)) return { action: 'skip', reason: `base が topic ではありません（${facts.baseRefName}）` };
    // Request changes は「まだ対応していないもの」だけを見る（対応済みでも reviewDecision は
    // 人間が見直すまで CHANGES_REQUESTED のまま残るため）。数が無ければ reviewDecision で判断する。
    const pendingReviews = Number.isInteger(facts.unhandledRequestedReviews)
        ? facts.unhandledRequestedReviews
        : (facts.reviewDecision === 'CHANGES_REQUESTED' ? 1 : 0);
    if (pendingReviews > 0) return { action: 'fix', reason: 'まだ対応していない Request changes があります' };
    if (facts.mergeable === 'CONFLICTING') return { action: 'conflict', reason: 'base とコンフリクトしています' };
    if (facts.isDraft) return { action: 'wait', reason: 'draft のまま（PR 投影が Ready にするのを待つ）' };
    if (facts.mergeable !== 'MERGEABLE') return { action: 'wait', reason: `mergeable を計算中（${facts.mergeable || '不明'}）` };
    const ci = ciStateFromRollup(facts.statusCheckRollup);
    if (ci === 'failure') return { action: 'fix', reason: 'CI が落ちています' };
    if (ci === 'pending') return { action: 'wait', reason: 'CI の結果待ち' };
    if (ci === 'none') {
        const grace = opts.graceMs == null ? AUTO_MERGE_NO_CHECKS_GRACE_MS : opts.graceMs;
        const updated = Date.parse(facts.updatedAt || '') || 0;
        if (opts.nowMs != null && opts.nowMs - updated < grace) return { action: 'wait', reason: 'CI のチェックがまだ登録されていません' };
    }
    return { action: 'merge', reason: ci === 'none' ? 'CI のチェックなし（対象外のパスだけ）' : 'CI 通過' };
}

/**
 * 自動マージの候補（Review・🙋 なし・leaf・実行中でない・gate ctx で autoMerge が立っている）。
 * @param {object[]} items
 * @param {Set<number>} running
 * @param {object} contexts issue → gate ctx（{@link markAutoMergeContexts} 済み）
 * @returns {object[]}
 */
function selectAutoMergeCandidates(items, running, contexts = {}) {
    return (items || []).filter((it) => it && it.status === 'Review' && !it.hitlLabel
        && it.kind !== 'EPIC' && !isTrackerItem(it)
        && !(running && running.has(it.issue))
        && contexts[it.issue] && contexts[it.issue].autoMerge && contexts[it.issue].pr);
}

/**
 * gate ctx（`project.getGateContext` の結果）に `autoMerge` を立てる。PR の base が topic の
 * ものだけ。phaseForItem は Review + 🙋 なし + autoMerge のとき address-review を起動しない
 * （daemon の自動マージを待つ）。
 * @param {object} contexts issue → ctx（in place で更新して返す）
 * @param {string} [defaultBase]
 * @returns {object}
 */
function markAutoMergeContexts(contexts, defaultBase = 'develop') {
    for (const ctx of Object.values(contexts || {})) {
        if (ctx && isEpicFlowBase(ctx.prBase, defaultBase)) ctx.autoMerge = true;
    }
    return contexts;
}

module.exports = {
    EPIC_FLOW_BASE_PREFIX, MAX_MUST_FIX_ROUNDS, HITL_KINDS, EPIC_CHILD_NO_HITL_PHASES, EPIC_CHILD_ALLOWED_HITL,
    DECISION_KINDS, DECISION_KIND_LABELS, BLOCKING_DECISION_KINDS, EPIC_DECISIONS_MARKER, EPIC_DECISIONS_DATA_RE,
    AUTO_MERGE_NO_CHECKS_GRACE_MS,
    isEpicFlowBase, altBranchName, mustFixPlan, resolveRunOutcome,
    normalizeDecision, decisionsFromResult, daemonDecision, decisionKey, mergeDecisionEntries,
    parseEpicDecisionsData, findEpicDecisionsComment, renderEpicDecisionsComment, nextEpicDecisionsBody,
    mustExhaustedBody, ciStateFromRollup, autoMergePlan, selectAutoMergeCandidates, markAutoMergeContexts,
};
