'use strict';
/**
 * learnings.js — 人間の答えから学ぶしくみの判断ロジック（純粋関数のみ・EPIC #2384 の M6 / R1）。
 *
 * 学びは 2 種類:
 *  - `intent`（M6）: EPIC の決定ページで人間の答えが AI のおすすめと違ったとき、聞いた理由から
 *    読み取った「人間の意図」。次から AI が同じ場面で人間と同じほうを選べるようにする。
 *  - `review`（R1）: EPIC の前の人間との確認で分かった「レビューで見るべき観点」。
 *
 * 学びは毎回コミットせず、gitignore された一時的な置き場（{@link LEARNINGS_DIR}）に
 * 1 件 1 ファイルでためる。一定量になったら、モニターの操作で worker に PR を作らせる
 * （分野ごとのファイル {@link learnedRuleFile} にまとめ直す）。PR は docs だけを変えるので、
 * CI が通ったらモニターの操作で develop にマージしてよい（`.claude/rules/topic-branches.md`）。
 *
 * 分野（area）は `.claude/rules/<area>/` と同じ名前（{@link RULE_AREA_PATH_PREFIXES}）に
 * `general` を足したもの。読む側は変えたファイルから {@link learnedRuleFilesFor} で、触った分野の
 * ファイルだけを読む（不要なルールを読まない・`touchedRuleAreas` と同じ考え方）。
 *
 * I/O・時計・乱数は持ち込まない（時刻は引数で受ける）。
 */

const { touchedRuleAreas, RULE_AREA_PATH_PREFIXES } = require('./phases');

/** 学びをためる置き場（repo 相対・gitignore 済みの tmp/ 配下） */
const LEARNINGS_DIR = 'tmp/autopilot-learnings';

/** 作った PR の記録（置き場の中・ファイル名が `.` 始まりなので学びの一覧には入らない） */
const LEARNINGS_PR_FILE = '.pr.json';

/**
 * 分野ごとの学びのファイルを置く場所（repo 相対）。`.claude/` の下にしないのは、root で動く
 * worker が `.claude/` を書くと許可の確認で止まるため（マーカー一覧を docs/ に出したのと同じ理由）。
 */
const LEARNED_RULES_DIR = 'docs/autopilot/learned';

/** どの分野にも当てはまるもの（いつも読む） */
const GENERAL_AREA = 'general';

/** 学びの種類 */
const LEARNING_KINDS = ['intent', 'review'];

/** PR を作ってよい件数の既定（これ未満ではモニターのボタンを出さない） */
const DEFAULT_LEARNINGS_PR_THRESHOLD = 5;

/** 古い学びは件数が少なくても PR にしてよい（既定 14 日） */
const DEFAULT_LEARNINGS_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** 分かっている分野の名前（`.claude/rules/<area>/` と同じ + general） */
const KNOWN_AREAS = [...new Set([...RULE_AREA_PATH_PREFIXES.map(([, a]) => a), GENERAL_AREA])];

const AREA_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

function toMs(t) {
    if (t == null) return null;
    if (typeof t === 'number') return Number.isFinite(t) ? t : null;
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
}

/**
 * 分野の指定をそろえる（純粋関数）。小文字にし、形の悪いものは捨て、空なら general にする。
 * 未知の名前でも形が正しければ残す（新しい分野を人間が作れるように）。
 * @param {string[]|string} areas
 * @returns {string[]}
 */
function normalizeAreas(areas) {
    const list = Array.isArray(areas) ? areas : String(areas || '').split(/[,\s]+/);
    const out = [];
    for (const a of list) {
        const s = String(a || '').trim().toLowerCase();
        if (!AREA_RE.test(s) || out.includes(s)) continue;
        out.push(s);
    }
    return out.length ? out : [GENERAL_AREA];
}

/**
 * 学び 1 件を検証する（純粋関数）。
 * @param {object} e
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateLearning(e) {
    const errors = [];
    if (!e || typeof e !== 'object') return { ok: false, errors: ['learning is not an object'] };
    if (typeof e.id !== 'string' || !/^[\w.-]{1,120}$/.test(e.id)) errors.push('id must be [\\w.-]{1,120}');
    if (!LEARNING_KINDS.includes(e.kind)) errors.push(`kind must be one of ${LEARNING_KINDS.join('|')}`);
    if (!Array.isArray(e.areas) || !e.areas.length || !e.areas.every((a) => AREA_RE.test(a))) {
        errors.push('areas must be a non-empty array of area names');
    }
    if (typeof e.text !== 'string' || !e.text.trim()) errors.push('text must be a non-empty string');
    if (e.createdAt == null || toMs(e.createdAt) == null) errors.push('createdAt must be a time');
    return { ok: errors.length === 0, errors };
}

/**
 * 入力から学び 1 件を作る（純粋関数）。id は時刻と呼び出し側が渡す suffix から作る
 * （乱数を持ち込まない）。
 * @param {object} input { kind, areas, text, reason?, source?: { epic?, question?, recommendation?, answer? } }
 * @param {{nowMs: number, suffix?: string}} opts
 * @returns {object} entry
 */
function newLearningEntry(input, opts) {
    const nowMs = opts.nowMs;
    const iso = new Date(nowMs).toISOString();
    const stamp = iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace('T', '-');
    const suffix = String(opts.suffix || '0').replace(/[^\w-]/g, '').slice(0, 16) || '0';
    const kind = LEARNING_KINDS.includes(input && input.kind) ? input.kind : 'intent';
    const src = (input && input.source) || {};
    const source = {};
    for (const k of ['epic', 'issue', 'question', 'recommendation', 'answer']) {
        if (src[k] != null && src[k] !== '') source[k] = typeof src[k] === 'number' ? src[k] : String(src[k]).slice(0, 2000);
    }
    return {
        id: `${stamp}-${kind}-${suffix}`,
        kind,
        areas: normalizeAreas(input && input.areas),
        text: String((input && input.text) || '').trim().slice(0, 4000),
        reason: input && input.reason ? String(input.reason).trim().slice(0, 4000) : null,
        source,
        createdAt: iso,
    };
}

/** 学び 1 件のファイル名（純粋関数） */
function learningFileName(entry) {
    return `${entry.id}.json`;
}

/** 分野の学びのファイル（repo 相対・純粋関数） */
function learnedRuleFile(area) {
    return `${LEARNED_RULES_DIR}/${area}.md`;
}

/**
 * 分野ごとに学びを分ける（純粋関数）。2 つの分野を持つ学びは両方に入る。
 * 分野は名前順、中は古い順。
 * @param {object[]} entries
 * @returns {{area: string, entries: object[]}[]}
 */
function groupLearningsByArea(entries) {
    const map = new Map();
    for (const e of entries || []) {
        for (const a of normalizeAreas(e.areas)) {
            if (!map.has(a)) map.set(a, []);
            map.get(a).push(e);
        }
    }
    const byTime = (x, y) => (toMs(x.createdAt) || 0) - (toMs(y.createdAt) || 0);
    return [...map.keys()].sort().map((area) => ({ area, entries: map.get(area).slice().sort(byTime) }));
}

/**
 * PR にしてよいだけ学びがたまったか（純粋関数）。
 * 作った PR がまだ開いているときは、その PR に入れた学びを数えない（二重に PR にしない）。
 * @param {object[]} entries
 * @param {{nowMs: number, threshold?: number, maxAgeMs?: number, pr?: object|null}} opts
 * @returns {{ready: boolean, count: number, reason: string, areas: {area: string, count: number}[]}}
 */
function learningsPrPlan(entries, opts) {
    const threshold = opts.threshold || DEFAULT_LEARNINGS_PR_THRESHOLD;
    const maxAgeMs = opts.maxAgeMs || DEFAULT_LEARNINGS_MAX_AGE_MS;
    const inPr = new Set((opts.pr && opts.pr.ids) || []);
    const pending = (entries || []).filter((e) => !inPr.has(e.id));
    const areas = groupLearningsByArea(pending).map((g) => ({ area: g.area, count: g.entries.length }));
    const count = pending.length;
    if (!count) return { ready: false, count, reason: 'ためた学びはありません', areas };
    if (opts.pr && opts.pr.number) {
        return { ready: false, count, reason: `学びの PR #${opts.pr.number} がまだ開いています`, areas };
    }
    if (count >= threshold) return { ready: true, count, reason: `${count} 件たまりました`, areas };
    const oldest = Math.min(...pending.map((e) => toMs(e.createdAt) || opts.nowMs));
    if (opts.nowMs - oldest >= maxAgeMs) {
        return { ready: true, count, reason: `いちばん古い学びが ${Math.floor((opts.nowMs - oldest) / 86400000)} 日たちました`, areas };
    }
    return { ready: false, count, reason: `あと ${threshold - count} 件で PR にできます`, areas };
}

/**
 * 学びの PR のチェックの結果をまとめる（純粋関数）。REST の check-runs の配列を受ける。
 * @param {{status: string, conclusion: string|null, name?: string}[]|null} checkRuns
 * @returns {'success'|'pending'|'failure'|'none'}
 */
function summarizeChecks(checkRuns) {
    const runs = checkRuns || [];
    if (!runs.length) return 'none';
    const ok = new Set(['success', 'neutral', 'skipped']);
    if (runs.some((r) => r.status === 'completed' && r.conclusion && !ok.has(r.conclusion))) return 'failure';
    if (runs.some((r) => r.status !== 'completed')) return 'pending';
    return 'success';
}

/** 学びの PR が変えてよいパス（docs と .claude だけ。topic-branches.md の例外の条件） */
const LEARNINGS_PR_ALLOWED_RE = /^(docs\/|\.claude\/)/;

/**
 * 学びの PR を AI がマージしてよいか（純粋関数）。`.claude/` と `docs/` だけを変え、
 * CI が全部通っていて、開いていて、base が develop のときだけ。
 * @param {{state: string, merged?: boolean, base: string, files: string[], checks: string, draft?: boolean}} info
 * @returns {{ok: boolean, reason: string}}
 */
function canMergeLearningsPr(info) {
    if (!info) return { ok: false, reason: 'PR の情報がありません' };
    if (info.merged) return { ok: false, reason: 'もうマージされています' };
    if (info.state !== 'open') return { ok: false, reason: `PR が開いていません（${info.state}）` };
    if (info.draft) return { ok: false, reason: 'PR が draft です' };
    if (info.base !== 'develop') return { ok: false, reason: `base が develop ではありません（${info.base}）` };
    const bad = (info.files || []).filter((f) => !LEARNINGS_PR_ALLOWED_RE.test(f));
    if (!(info.files || []).length) return { ok: false, reason: '変えたファイルがありません' };
    if (bad.length) return { ok: false, reason: `docs/・.claude/ 以外を変えています: ${bad.slice(0, 3).join(', ')}` };
    if (info.checks === 'failure') return { ok: false, reason: 'CI が落ちています' };
    if (info.checks !== 'success') return { ok: false, reason: 'CI がまだ終わっていません' };
    return { ok: true, reason: 'CI が通りました' };
}

/**
 * モニターに出す学びの操作（純粋関数）。
 *  - PR が無く、たまっていれば `create`（PR を作る）
 *  - PR を作っている途中なら `creating`
 *  - PR があれば `merge`（押すと CI を確かめ、通っていればマージ）
 *  - それ以外は `none`
 * @param {{plan: object, pr: object|null, creating?: boolean, merging?: boolean}} s
 * @returns {{action: string, label: string, disabled: boolean}}
 */
function learningsAction(s) {
    if (s.creating) return { action: 'creating', label: '⏳ PR を作っています', disabled: true };
    if (s.merging) return { action: 'merging', label: '⏳ CI を確かめています', disabled: true };
    if (s.pr && s.pr.number) return { action: 'merge', label: `✅ PR #${s.pr.number} をマージ（CI が通っていれば）`, disabled: false };
    if (s.plan && s.plan.ready) return { action: 'create', label: `📝 学び ${s.plan.count} 件を PR にする`, disabled: false };
    return { action: 'none', label: (s.plan && s.plan.reason) || '', disabled: true };
}

/**
 * worker に渡す作業メモ（Markdown）を作る（純粋関数）。分野ごとに、まとめ直す先のファイルと
 * 学びの中身を並べる。worker はこれを読んで {@link learnedRuleFile} を書き直す。
 * @param {object[]} entries
 * @returns {string}
 */
function renderLearningsWorkFile(entries) {
    const lines = [
        '<!-- autopilot-learnings-work -->',
        '# ためた学び（分野ごと）',
        '',
        `学び ${entries.length} 件。分野ごとに、下の「書き直すファイル」へまとめ直す。`,
        '',
    ];
    for (const g of groupLearningsByArea(entries)) {
        lines.push(`## ${g.area}`, '', `書き直すファイル: \`${learnedRuleFile(g.area)}\``, '');
        for (const e of g.entries) {
            lines.push(`### ${e.id}（${e.kind === 'review' ? 'レビューの観点' : '人間の意図'}）`, '');
            lines.push(e.text, '');
            if (e.reason) lines.push(`- 人間の理由: ${e.reason}`);
            const s = e.source || {};
            if (s.epic) lines.push(`- EPIC: #${s.epic}`);
            if (s.question) lines.push(`- 問い: ${s.question}`);
            if (s.recommendation) lines.push(`- AI のおすすめ: ${s.recommendation}`);
            if (s.answer) lines.push(`- 人間の答え: ${s.answer}`);
            lines.push('');
        }
    }
    return lines.join('\n');
}

/**
 * 変えたファイルから、読むべき学びのファイルを導く（純粋関数）。触った分野のものだけを返し、
 * general はいつも先頭に入れる。`touchedRuleAreas` と同じ分け方を使う（二重定義しない）。
 * @param {string[]} files 変えたファイル（repo 相対）
 * @returns {string[]} repo 相対のパス
 */
function learnedRuleFilesFor(files) {
    return [GENERAL_AREA, ...touchedRuleAreas(files)].map(learnedRuleFile);
}

/**
 * EPIC の決定待ち（`epic-flow.js` の `parseEpicDecisionsData` で読んだ 1 件）と人間の答えから、
 * 学び 1 件の入力を作る（純粋関数）。指揮役が、答えが AI のおすすめと違ったときに使う。
 * @param {object} d 決定待ち { issue, pr, ref, title, recommendation, alternatives, adopted }
 * @param {{epic?: number, answer: string, reason?: string, text: string, areas?: string[], kind?: string}} a
 * @returns {object} {@link newLearningEntry} の input
 */
function learningInputFromDecision(d, a) {
    const dd = d || {};
    return {
        kind: a.kind === 'review' ? 'review' : 'intent',
        areas: a.areas || [],
        text: a.text,
        reason: a.reason || null,
        source: {
            epic: a.epic,
            issue: dd.issue,
            question: [dd.ref, dd.title].filter(Boolean).join(' '),
            recommendation: dd.recommendation || dd.adopted || null,
            answer: a.answer,
        },
    };
}

module.exports = {
    learningInputFromDecision,
    LEARNINGS_DIR,
    LEARNINGS_PR_FILE,
    LEARNED_RULES_DIR,
    GENERAL_AREA,
    LEARNING_KINDS,
    KNOWN_AREAS,
    DEFAULT_LEARNINGS_PR_THRESHOLD,
    DEFAULT_LEARNINGS_MAX_AGE_MS,
    LEARNINGS_PR_ALLOWED_RE,
    normalizeAreas,
    validateLearning,
    newLearningEntry,
    learningFileName,
    learnedRuleFile,
    groupLearningsByArea,
    learningsPrPlan,
    summarizeChecks,
    canMergeLearningsPr,
    learningsAction,
    renderLearningsWorkFile,
    learnedRuleFilesFor,
};
