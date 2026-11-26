'use strict';
/**
 * scheduler.js — 並列の数と選ぶ順番を決める純粋関数（EPIC #2384 の P・E）。
 *
 * - **重さの推定**: フェーズの既定 + Issue 本文の `autopilot-weight: heavy|light` + Issue の中身
 *   （タイトル・本文の言葉と、変更するパッケージ）からの推測。重さの原因は CPU とメモリなので、
 *   分かっているパターン（自動テスト・lint・webpack・ブラウザ）を {@link LOAD_PATTERNS} の表に持つ。
 * - **動的な計画**: 全体・重いものの上限と、空きメモリ（/proc/meminfo の MemAvailable）・
 *   CPU（loadavg）から、この tick で始める数を決める（{@link planSlots}）。理由を文で返す。
 * - **優先度**: Project の `Priority`（P0〜P3）。sub-issue は親 EPIC の優先度を継ぐ
 *   （自分に付いていればそちら）。選ぶ順は 優先度 → autopilot-after が解けたもの → Project の並び。
 *
 * I/O（/proc の読み取り・os.loadavg・GitHub）は daemon / project.js が行い、ここには値だけ渡す。
 * 時計・乱数も持ち込まない（`.claude/rules/autopilot/development.md` のレイヤリング）。
 */

/** 重さの値 */
const HEAVY = 'heavy';
const LIGHT = 'light';

/**
 * フェーズごとの重さの既定。implement・verify はテスト・ビルド・ブラウザを動かすので重い。
 * 読む・書くだけのフェーズは軽い。ここに無いフェーズは {@link DEFAULT_PHASE_WEIGHT}。
 */
const PHASE_WEIGHTS = {
    triage: LIGHT,
    understand: LIGHT,
    decompose: LIGHT,
    discuss: LIGHT,
    review: LIGHT,
    'address-review': LIGHT,
    docs: LIGHT,
    'resolve-conflict': LIGHT,
    implement: HEAVY,
    verify: HEAVY,
};
const DEFAULT_PHASE_WEIGHT = LIGHT;

/**
 * Issue の中身で重さが変わるフェーズ。ここに無いフェーズ（triage など）は中身に関係なく
 * フェーズの既定を使う（Issue に「jest」と書いてあっても triage は jest を流さない）。
 */
const CONTENT_SENSITIVE_PHASES = new Set(['implement', 'verify', 'address-review', 'resolve-conflict']);

/**
 * 重さのパターンの表。`re` がタイトルか本文に当たれば `score` を足す。
 * `resources` は何を使うか（cpu / mem）の説明用で、判定には `kind` と `score` だけを使う。
 * - kind=heavy: 重さの合計が {@link HEAVY_SCORE_THRESHOLD} 以上で重い
 * - kind=light: 軽いことを示す（docs だけ・autopilot だけ）。heavy の合計より大きければ軽い
 * 「test」「lint」のように多くの Issue に出る言葉は点を低くし、それだけでは重くしない。
 */
const LOAD_PATTERNS = [
    { id: 'jest', kind: HEAVY, score: 2, resources: ['cpu', 'mem'], re: /\bjest\b/i, note: '自動テスト（jest。ワーカーで数 GB）' },
    { id: 'integration', kind: HEAVY, score: 2, resources: ['cpu', 'mem'], re: /\bintegration\b|インテグレーション|結合テスト/i, note: 'integration テスト（Selenium + chromium）' },
    { id: 'browser', kind: HEAVY, score: 2, resources: ['cpu', 'mem'], re: /\b(playwright|selenium|e2e|browser|chromium|pw-check)\b|ブラウザ|スクリーンショット|screenshot/i, note: 'ブラウザを使う確認' },
    { id: 'webpack', kind: HEAVY, score: 2, resources: ['cpu', 'mem'], re: /\bwebpack\b|\bbuild(:dev)?\b|dev server|ビルド/i, note: 'webpack のビルド・dev server' },
    { id: 'scratch-gui', kind: HEAVY, score: 2, resources: ['cpu', 'mem'], re: /packages\/scratch-gui|\bscratch-gui\b/i, note: 'scratch-gui を変える（jest・lint・webpack が重い）' },
    { id: 'lint', kind: HEAVY, score: 1, resources: ['cpu', 'mem'], re: /\blint\b|eslint/i, note: 'lint（scratch-gui の eslint は重い）' },
    { id: 'test', kind: HEAVY, score: 1, resources: ['cpu'], re: /\btests?\b|テスト/i, note: 'テスト一般' },
    { id: 'scratch-vm', kind: HEAVY, score: 1, resources: ['cpu'], re: /packages\/scratch-vm|\bscratch-vm\b|\btap\b/i, note: 'scratch-vm（tap）' },
    { id: 'docs', kind: LIGHT, score: 2, resources: [], re: /^docs?:|ドキュメントだけ|docs only|\bdocs\/|\.claude\/rules/im, note: 'docs・rules だけ' },
    { id: 'autopilot', kind: LIGHT, score: 2, resources: [], re: /tools\/autopilot|\(autopilot\)|node --test/i, note: 'autopilot（node --test は軽い）' },
];
const HEAVY_SCORE_THRESHOLD = 2;

/**
 * Issue 本文の `autopilot-weight: heavy|light` を読む（行頭のみ・行頭 HTML コメント・バッククォート可。
 * ほかのディレクティブと同じ記法）。
 * @param {string} body
 * @returns {'heavy'|'light'|null}
 */
function parseWeightDirective(body) {
    const m = /^(?:<!--\s*)?autopilot-weight:\s*`?(heavy|light)`?/im.exec(body || '');
    return m ? m[1].toLowerCase() : null;
}

/**
 * タイトルと本文から重さの手がかりを集める（フェーズに依らない部分。daemon は本文ごとに 1 回だけ計算してよい）。
 * @param {string} title
 * @param {string} body
 * @returns {{heavyScore:number, lightScore:number, matched:string[], directive:('heavy'|'light'|null)}}
 */
function analyzeContent(title, body) {
    const text = `${title || ''}\n${body || ''}`;
    let heavyScore = 0;
    let lightScore = 0;
    const matched = [];
    for (const p of LOAD_PATTERNS) {
        if (!p.re.test(text)) continue;
        matched.push(p.id);
        if (p.kind === HEAVY) heavyScore += p.score;
        else lightScore += p.score;
    }
    return { heavyScore, lightScore, matched, directive: parseWeightDirective(body) };
}

/**
 * 1 つの作業（item × フェーズ）の重さを決める。
 * 順番: ①本文の `autopilot-weight:` ②中身で変わるフェーズなら中身の推測 ③フェーズの既定。
 * @param {object} args
 * @param {string} args.phase
 * @param {object} [args.content] {@link analyzeContent} の結果
 * @returns {{weight:'heavy'|'light', source:'directive'|'content'|'phase', reasons:string[]}}
 */
function estimateWeight({ phase, content } = {}) {
    const c = content || { heavyScore: 0, lightScore: 0, matched: [], directive: null };
    if (c.directive === HEAVY || c.directive === LIGHT) {
        return { weight: c.directive, source: 'directive', reasons: ['autopilot-weight'] };
    }
    const base = PHASE_WEIGHTS[phase] || DEFAULT_PHASE_WEIGHT;
    if (CONTENT_SENSITIVE_PHASES.has(phase)) {
        if (c.heavyScore >= HEAVY_SCORE_THRESHOLD && c.heavyScore >= c.lightScore) {
            return { weight: HEAVY, source: 'content', reasons: c.matched };
        }
        if (c.lightScore > c.heavyScore) {
            return { weight: LIGHT, source: 'content', reasons: c.matched };
        }
    }
    return { weight: base, source: 'phase', reasons: [phase || 'default'] };
}

// ---- 上限と資源 ----

/** 計画の既定（settings.json の `scheduler` で変えられる） */
const DEFAULT_SCHEDULER_LIMITS = {
    /** 同時に動かす worker の上限（全体） */
    maxTotal: 6,
    /** 同時に動かす重い worker の上限 */
    maxHeavy: 2,
    /** 空きメモリがこれ未満なら重いものを始めない（MB） */
    heavyMinMemMb: 2560,
    /** 空きメモリがこれ未満なら新しい作業を始めない（MB） */
    anyMinMemMb: 1024,
    /** 1 件始めるごとに見込む使用量（MB）。同じ tick で始めた分を空きから引く（すぐには減らないため） */
    heavyMemMb: 1500,
    lightMemMb: 300,
    /** 1 CPU あたりの loadavg（1 分）がこれ以上なら重いものを始めない */
    heavyMaxLoadPerCpu: 1.0,
    /** 1 CPU あたりの loadavg（1 分）がこれ以上なら新しい作業を始めない */
    maxLoadPerCpu: 2.0,
};

/**
 * settings の `scheduler` とモニターからの一時的な上書きをまとめる。数でない・負の値は既定に戻す。
 * @param {object} [fromSettings] settings.scheduler
 * @param {object} [overrides] モニターで変えた値（再起動で消える）
 * @returns {typeof DEFAULT_SCHEDULER_LIMITS}
 */
function resolveSchedulerLimits(fromSettings, overrides) {
    const out = { ...DEFAULT_SCHEDULER_LIMITS };
    for (const src of [fromSettings, overrides]) {
        for (const [k, v] of Object.entries(src || {})) {
            if (!(k in out)) continue;
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
        }
    }
    out.maxTotal = Math.floor(out.maxTotal);
    out.maxHeavy = Math.min(Math.floor(out.maxHeavy), out.maxTotal);
    return out;
}

/**
 * /proc/meminfo の本文から MemAvailable を MB で返す（無ければ null）。
 * @param {string} text
 * @returns {number|null}
 */
function parseMemAvailableMb(text) {
    const m = /^MemAvailable:\s+(\d+)\s*kB/m.exec(text || '');
    return m ? Math.round(Number(m[1]) / 1024) : null;
}

const fmtGb = (mb) => `${(mb / 1024).toFixed(1)}GB`;

/**
 * この tick で始める作業を決める。候補は**選ぶ順**（{@link orderByPriority} の後）で渡す。
 * 重いものが上限・資源で始められないときも、後ろの軽いものは始める（軽い仕事で空きを埋める）。
 * @param {object} args
 * @param {Array<{issue:number, weight:string}>} args.candidates 選ぶ順の候補
 * @param {Array<{issue:number, weight:string}>} args.running 実行中
 * @param {object} args.limits {@link resolveSchedulerLimits} の結果
 * @param {{memAvailableMb:(number|null), load1:(number|null), cpus:(number|null)}} [args.resources]
 * @returns {{picked:number[], waiting:Array<{issue:number, why:string}>, reason:string, summary:object}}
 */
function planSlots({ candidates = [], running = [], limits, resources = {} } = {}) {
    const L = limits || resolveSchedulerLimits();
    let total = running.length;
    let heavy = running.filter((r) => r.weight === HEAVY).length;
    let mem = typeof resources.memAvailableMb === 'number' ? resources.memAvailableMb : null;
    const cpus = resources.cpus && resources.cpus > 0 ? resources.cpus : null;
    const loadPerCpu = typeof resources.load1 === 'number' && cpus ? resources.load1 / cpus : null;
    const picked = [];
    const pickedHeavy = [];
    const waiting = [];
    let stop = null;
    if (mem !== null && mem < L.anyMinMemMb) stop = `空きメモリ ${fmtGb(mem)} < ${fmtGb(L.anyMinMemMb)}`;
    else if (loadPerCpu !== null && loadPerCpu >= L.maxLoadPerCpu) {
        stop = `負荷 ${loadPerCpu.toFixed(2)}/CPU ≥ ${L.maxLoadPerCpu}`;
    }
    for (const c of candidates) {
        if (stop) { waiting.push({ issue: c.issue, why: stop }); continue; }
        if (total >= L.maxTotal) { waiting.push({ issue: c.issue, why: `全体の上限 ${L.maxTotal}` }); continue; }
        if (mem !== null && mem < L.anyMinMemMb) {
            waiting.push({ issue: c.issue, why: `空きメモリの見込み ${fmtGb(mem)} < ${fmtGb(L.anyMinMemMb)}` });
            continue;
        }
        if (c.weight === HEAVY) {
            let why = null;
            if (heavy >= L.maxHeavy) why = `重いものの上限 ${L.maxHeavy}`;
            else if (mem !== null && mem < L.heavyMinMemMb) why = `空きメモリ ${fmtGb(mem)} < ${fmtGb(L.heavyMinMemMb)}（重い）`;
            else if (loadPerCpu !== null && loadPerCpu >= L.heavyMaxLoadPerCpu) {
                why = `負荷 ${loadPerCpu.toFixed(2)}/CPU ≥ ${L.heavyMaxLoadPerCpu}（重い）`;
            }
            if (why) { waiting.push({ issue: c.issue, why }); continue; }
            heavy += 1;
            pickedHeavy.push(c.issue);
            if (mem !== null) mem -= L.heavyMemMb;
        } else if (mem !== null) {
            mem -= L.lightMemMb;
        }
        total += 1;
        picked.push(c.issue);
    }
    const res = [];
    if (typeof resources.memAvailableMb === 'number') res.push(`空き ${fmtGb(resources.memAvailableMb)}`);
    if (loadPerCpu !== null) res.push(`負荷 ${loadPerCpu.toFixed(2)}/CPU`);
    const runningHeavy = running.filter((r) => r.weight === HEAVY).length;
    res.push(`実行中 ${running.length}（重い ${runningHeavy}）`);
    let reason = `${res.join('・')} → `;
    reason += picked.length
        ? `${picked.length} 件開始（重い ${pickedHeavy.length}・軽い ${picked.length - pickedHeavy.length}）`
        : '開始なし';
    if (stop) reason += `。${stop} のため新しい作業を止める`;
    else if (waiting.length) {
        const byWhy = new Map();
        for (const w of waiting) byWhy.set(w.why, (byWhy.get(w.why) || 0) + 1);
        reason += `。待ち ${[...byWhy].map(([why, n]) => `${why} で ${n} 件`).join('・')}`;
    }
    reason += `（上限 全体 ${L.maxTotal}・重い ${L.maxHeavy}）`;
    return {
        picked,
        waiting,
        reason,
        summary: {
            limits: L,
            memAvailableMb: typeof resources.memAvailableMb === 'number' ? resources.memAvailableMb : null,
            loadPerCpu,
            running: running.length,
            runningHeavy,
            started: picked.length,
            startedHeavy: pickedHeavy.length,
            waiting: waiting.length,
        },
    };
}

// ---- 優先度 ----

/** Project の Priority の option（高い順） */
const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
/** 付いていない（自分にも親にも）ときに使う優先度 */
const DEFAULT_PRIORITY = 'P2';

/**
 * Priority の値を P0〜P3 にそろえる（`P1 高` のような option 名にも耐える）。当たらなければ null。
 * @param {*} v
 * @returns {string|null}
 */
function normalizePriority(v) {
    const m = /^\s*(P[0-3])\b/i.exec(typeof v === 'string' ? v : '');
    return m ? m[1].toUpperCase() : null;
}

/**
 * item の実際に効く優先度。自分 → 親（EPIC）→ その親 …（最大 4 段・循環に耐える）→ 既定。
 * @param {number} issue
 * @param {{priorityByIssue?:Map<number,string>|object, parentByIssue?:Map<number,number>|object}} ctx
 * @returns {{priority:string, source:'own'|'inherited'|'default', from:(number|null)}}
 */
function effectivePriority(issue, ctx = {}) {
    const get = (m, k) => (m instanceof Map ? m.get(k) : (m || {})[k]);
    let cur = issue;
    const seen = new Set();
    for (let depth = 0; depth < 5 && cur != null && !seen.has(cur); depth++) {
        seen.add(cur);
        const p = normalizePriority(get(ctx.priorityByIssue, cur));
        if (p) return { priority: p, source: depth === 0 ? 'own' : 'inherited', from: depth === 0 ? null : cur };
        cur = get(ctx.parentByIssue, cur) ?? null;
    }
    return { priority: DEFAULT_PRIORITY, source: 'default', from: null };
}

// ---- 続きの作業か（#2472） ----

/**
 * 同じ優先度の中で先に進める順（先ほど前）。人間のレビューへの直しは人間を待たせているので最初、
 * PR を作ったものの続きは作りかけを減らすため次、新しく始める作業は最後（#2472）。
 */
const WORK_STAGES = ['fix', 'pr', 'new'];
/** モニター・ログで段を言うときの言葉 */
const WORK_STAGE_LABELS = { fix: '直し', pr: 'PR の続き', new: '新しい作業' };
/** PR があることがフェーズから分かるもの（review・verify は PR を作ったあとにしか来ない） */
const PR_PHASES = new Set(['review', 'verify', 'resolve-conflict']);

/**
 * 候補が「続きの作業」のどの段か。daemon が dispatch のために既に持っている値
 * （次のフェーズ `phase` と、ゲートの ctx から来る `pr`）だけで決める（追加の GitHub の read をしない）。
 * @param {{phase?:string, pr?:*}} c
 * @returns {'fix'|'pr'|'new'}
 */
function workStage(c = {}) {
    if (c.phase === 'address-review') return 'fix';
    if (PR_PHASES.has(c.phase) || (c.pr != null && c.pr !== false && c.pr !== 0)) return 'pr';
    return 'new';
}

/**
 * 候補を「優先度 → 続きの作業か → 渡された順（= Project の並び）」に並べる（安定ソート）。
 * autopilot-after が解けていないものは daemon が先に除く。優先度は今までどおり最優先
 * （P0 の新しい作業は P1 の直しより先）。
 * @param {Array<{issue:number, phase?:string, pr?:*}>} candidates Project の並びの候補
 * @param {object} ctx {@link effectivePriority} の ctx
 * @returns {Array<object>} 新しい配列（各要素に `priority` / `prioritySource` / `stage` を足す）
 */
function orderByPriority(candidates, ctx = {}) {
    return (candidates || [])
        .map((c, i) => {
            const e = effectivePriority(c.issue, ctx);
            const stage = workStage(c);
            return {
                c: { ...c, priority: e.priority, prioritySource: e.source, stage },
                i,
                rank: PRIORITIES.indexOf(e.priority),
                stageRank: WORK_STAGES.indexOf(stage),
            };
        })
        .sort((a, b) => a.rank - b.rank || a.stageRank - b.stageRank || a.i - b.i)
        .map((x) => x.c);
}

/**
 * 並べた順の理由（モニターの「並列:」の行に足す）。同じ優先度の中で段が分かれたときだけ
 * 「同じ P1 で、直しを先に」のように書く。分かれていなければ空文字。
 * @param {Array<{priority:string, stage:string}>} ordered {@link orderByPriority} の結果
 * @returns {string}
 */
function describeOrder(ordered) {
    const byPriority = new Map();
    for (const c of ordered || []) {
        if (!byPriority.has(c.priority)) byPriority.set(c.priority, new Set());
        byPriority.get(c.priority).add(c.stage);
    }
    const notes = [];
    for (const [p, stages] of byPriority) {
        if (stages.size < 2) continue;
        const present = WORK_STAGES.filter((st) => stages.has(st));
        notes.push(`同じ ${p} で、${present.slice(0, -1).map((st) => WORK_STAGE_LABELS[st]).join(' → ')}を先に`);
    }
    return notes.join('・');
}

/**
 * モニターの ▲ / ▼ で優先度を 1 段動かす。今の値（自分に無ければ継いだ値・既定）から動かし、端で止まる。
 * @param {string|null} current 実際に効いている優先度
 * @param {'up'|'down'} direction
 * @returns {string}
 */
function shiftPriority(current, direction) {
    const idx = PRIORITIES.indexOf(normalizePriority(current) || DEFAULT_PRIORITY);
    const next = direction === 'up' ? idx - 1 : idx + 1;
    return PRIORITIES[Math.max(0, Math.min(PRIORITIES.length - 1, next))];
}

module.exports = {
    HEAVY,
    LIGHT,
    PHASE_WEIGHTS,
    DEFAULT_PHASE_WEIGHT,
    CONTENT_SENSITIVE_PHASES,
    LOAD_PATTERNS,
    HEAVY_SCORE_THRESHOLD,
    parseWeightDirective,
    analyzeContent,
    estimateWeight,
    DEFAULT_SCHEDULER_LIMITS,
    resolveSchedulerLimits,
    parseMemAvailableMb,
    planSlots,
    PRIORITIES,
    DEFAULT_PRIORITY,
    normalizePriority,
    effectivePriority,
    WORK_STAGES,
    WORK_STAGE_LABELS,
    workStage,
    orderByPriority,
    describeOrder,
    shiftPriority,
};
