'use strict';
/**
 * tasks.js — 「タスク」の判断ロジック（純粋関数のみ・EPIC #2384 の E1）。
 *
 * タスクは Issue に結びつかない仕事で、worker（子 claude）にプロンプトを渡して実行する。
 * 例: 毎朝の不具合報告の確認。実行のしかたは 3 つ:
 *  - `once`（`at` なし）: いま 1 回だけ
 *  - `once`（`at` あり）: 決めた時刻に 1 回だけ
 *  - `cron`: 定期（5 項目の cron 式「分 時 日 月 曜日」。タイムゾーンは既定 +09:00）
 *
 * 定義は repo 共通の `tools/autopilot/tasks.json` と、手元だけの `tmp/autopilot-tasks.local.json`
 * （モニターから作ったものもここに入る）を id でまぜる（{@link mergeTaskDefs}）。
 * 実行の記録（いつ実行したか・結果）は daemon が `tmp/autopilot-tasks-state.json` に持つ。
 *
 * I/O・時計・乱数は持ち込まない（時刻は ms epoch を引数で受ける）。
 */

const TASK_ID_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

/** cron のタイムゾーンの既定（JST） */
const DEFAULT_TASK_TZ = '+09:00';

/** 次の実行を探す上限（1 年 + α。これを超える cron 式は「実行しない」扱い） */
const CRON_SEARCH_LIMIT_MS = 400 * 24 * 60 * 60 * 1000;

const MINUTE_MS = 60 * 1000;

/**
 * タイムゾーンの表記（`+09:00` / `-05:30` / `Z`）を分に直す（純粋関数）。読めなければ null。
 * @param {string} tz
 * @returns {number|null}
 */
function parseTzOffset(tz) {
    if (tz == null || tz === '') return parseTzOffset(DEFAULT_TASK_TZ);
    if (tz === 'Z' || tz === 'UTC') return 0;
    const m = /^([+-])(\d{2}):?(\d{2})$/.exec(String(tz));
    if (!m) return null;
    const v = Number(m[2]) * 60 + Number(m[3]);
    return m[1] === '-' ? -v : v;
}

/** cron の 1 項目を数の集合にする。読めなければ null */
function parseCronField(s, min, max) {
    const out = new Set();
    for (const part of String(s).split(',')) {
        const m = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part.trim());
        if (!m) return null;
        let lo = min;
        let hi = max;
        if (m[2] != null) {
            lo = Number(m[2]);
            hi = m[3] != null ? Number(m[3]) : (m[4] != null ? max : lo);
        }
        const step = m[4] != null ? Number(m[4]) : 1;
        if (!(step >= 1) || lo < min || hi > max || lo > hi) return null;
        for (let v = lo; v <= hi; v += step) out.add(v);
    }
    return out;
}

/**
 * 5 項目の cron 式（分 時 日 月 曜日）を読む（純粋関数）。曜日は 0〜7（0 と 7 が日曜）。
 * 日と曜日の両方が `*` でないときは、どちらかに当てはまれば実行する（一般的な cron と同じ）。
 * @param {string} expr
 * @returns {object|null} 読めなければ null
 */
function parseCron(expr) {
    const parts = String(expr || '').trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const minute = parseCronField(parts[0], 0, 59);
    const hour = parseCronField(parts[1], 0, 23);
    const dom = parseCronField(parts[2], 1, 31);
    const month = parseCronField(parts[3], 1, 12);
    const dowRaw = parseCronField(parts[4], 0, 7);
    if (!minute || !hour || !dom || !month || !dowRaw) return null;
    const dow = new Set([...dowRaw].map((d) => (d === 7 ? 0 : d)));
    return { minute, hour, dom, month, dow, domAny: parts[2] === '*', dowAny: parts[4] === '*' };
}

/** その時刻の（タイムゾーンをずらした）各項目 */
function localParts(ms, tzMin) {
    const d = new Date(ms + tzMin * MINUTE_MS);
    return {
        minute: d.getUTCMinutes(), hour: d.getUTCHours(), dom: d.getUTCDate(),
        month: d.getUTCMonth() + 1, dow: d.getUTCDay(),
    };
}

function dayMatches(c, p) {
    if (!c.month.has(p.month)) return false;
    if (c.domAny && c.dowAny) return true;
    if (c.domAny) return c.dow.has(p.dow);
    if (c.dowAny) return c.dom.has(p.dom);
    return c.dom.has(p.dom) || c.dow.has(p.dow);
}

/**
 * `afterMs` より後で、cron 式に当てはまるいちばん近い時刻（分の頭）を返す（純粋関数）。
 * 日・時が当てはまらないときは日・時の単位で飛ばすので、1 年先まで探しても軽い。
 * @param {object} cron {@link parseCron} の戻り値
 * @param {number} afterMs
 * @param {number} tzMin タイムゾーン（分）
 * @returns {number|null}
 */
function nextCronRun(cron, afterMs, tzMin) {
    if (!cron) return null;
    let t = Math.floor(afterMs / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
    const limit = afterMs + CRON_SEARCH_LIMIT_MS;
    while (t <= limit) {
        const p = localParts(t, tzMin);
        if (!dayMatches(cron, p)) {
            // 次の（ローカルの）日の 0:00 へ
            t += ((23 - p.hour) * 60 + (60 - p.minute)) * MINUTE_MS;
            continue;
        }
        if (!cron.hour.has(p.hour)) {
            t += (60 - p.minute) * MINUTE_MS;
            continue;
        }
        if (!cron.minute.has(p.minute)) {
            t += MINUTE_MS;
            continue;
        }
        return t;
    }
    return null;
}

function toMs(t) {
    if (t == null || t === '') return null;
    if (typeof t === 'number') return Number.isFinite(t) ? t : null;
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
}

/**
 * タスクの定義を検証する（純粋関数）。
 * @param {object} def { id, title, prompt?, promptFile?, schedule: {type, at?, cron?, tz?}, enabled? }
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateTask(def) {
    const errors = [];
    if (!def || typeof def !== 'object') return { ok: false, errors: ['task is not an object'] };
    if (typeof def.id !== 'string' || !TASK_ID_RE.test(def.id)) errors.push('id must be [a-z0-9-]{1,41}');
    if (typeof def.title !== 'string' || !def.title.trim()) errors.push('title must be a non-empty string');
    const hasPrompt = typeof def.prompt === 'string' && def.prompt.trim();
    const hasFile = typeof def.promptFile === 'string' && def.promptFile.trim();
    if (!hasPrompt && !hasFile) errors.push('prompt or promptFile is required');
    if (hasFile && (def.promptFile.startsWith('/') || def.promptFile.split('/').includes('..'))) {
        errors.push('promptFile must be a repo-relative path');
    }
    const s = def.schedule;
    if (!s || typeof s !== 'object') {
        errors.push('schedule is required');
    } else if (s.type === 'once') {
        if (s.at != null && toMs(s.at) == null) errors.push('schedule.at must be a time');
    } else if (s.type === 'cron') {
        if (!parseCron(s.cron)) errors.push('schedule.cron must be a 5-field cron expression');
        if (parseTzOffset(s.tz) == null) errors.push('schedule.tz must look like +09:00');
    } else {
        errors.push('schedule.type must be once|cron');
    }
    return { ok: errors.length === 0, errors };
}

/**
 * repo 共通と手元の定義を id でまぜる（純粋関数）。手元のほうが勝つ（項目ごとに上書き）。
 * 手元に `{id, enabled:false}` だけを書けば、repo のタスクを自分だけ止められる。
 * 壊れた定義は捨てて `invalid` に入れる（daemon を落とさない）。
 * @param {object[]} repoDefs
 * @param {object[]} localDefs
 * @returns {{tasks: object[], invalid: {id: string, errors: string[], source: string}[]}}
 */
function mergeTaskDefs(repoDefs, localDefs) {
    const map = new Map();
    for (const [list, source] of [[repoDefs, 'repo'], [localDefs, 'local']]) {
        for (const d of Array.isArray(list) ? list : []) {
            if (!d || typeof d.id !== 'string') continue;
            const prev = map.get(d.id);
            map.set(d.id, prev ? { ...prev, ...d, source: prev.source } : { ...d, source });
        }
    }
    const tasks = [];
    const invalid = [];
    for (const d of map.values()) {
        const v = validateTask(d);
        if (v.ok) tasks.push({ ...d, enabled: d.enabled !== false });
        else invalid.push({ id: d.id, errors: v.errors, source: d.source });
    }
    return { tasks, invalid };
}

/**
 * タスクの次の実行時刻を返す（純粋関数）。実行しない（済んだ・止めてある）なら null。
 *  - once（at なし）: まだなら、定義を最初に見た時刻（= すぐ）
 *  - once（at あり）: まだなら at
 *  - cron: 前回の実行（無ければ定義を最初に見た時刻）より後の、いちばん近い時刻。
 *    daemon が止まっていて何回分か逃しても、まとめて 1 回だけ実行する。
 * @param {object} def
 * @param {{lastRunAt?: number, firstSeenAt?: number}} st そのタスクの実行の記録
 * @returns {number|null}
 */
function taskNextRunAt(def, st) {
    if (!def || def.enabled === false) return null;
    const s = st || {};
    const s0 = def.schedule || {};
    if (s0.type === 'once') {
        if (s.lastRunAt != null) return null;
        const at = toMs(s0.at);
        return at != null ? at : (s.firstSeenAt != null ? s.firstSeenAt : 0);
    }
    if (s0.type === 'cron') {
        const base = s.lastRunAt != null ? s.lastRunAt : s.firstSeenAt;
        if (base == null) return null;
        return nextCronRun(parseCron(s0.cron), base, parseTzOffset(s0.tz));
    }
    return null;
}

/**
 * いま実行すべきタスクを選ぶ（純粋関数）。手で「いま実行」を押されたもの（`forced`）を先に、
 * 次に時刻が来たものを古い順に。実行中のものと、上限（`limit`）を超える分は選ばない。
 * @param {object[]} tasks {@link mergeTaskDefs} の tasks
 * @param {object} taskState { [id]: {lastRunAt, firstSeenAt} }
 * @param {{nowMs: number, running?: Set<string>|string[], forced?: string[], limit?: number}} opts
 * @returns {{id: string, reason: 'forced'|'due'}[]}
 */
function dueTasks(tasks, taskState, opts) {
    const running = new Set(opts.running || []);
    const limit = opts.limit == null ? 1 : opts.limit;
    const byId = new Map((tasks || []).map((t) => [t.id, t]));
    const out = [];
    const capacity = Math.max(0, limit - running.size);
    for (const id of opts.forced || []) {
        if (out.length >= capacity) return out;
        if (byId.has(id) && !running.has(id) && !out.some((o) => o.id === id)) out.push({ id, reason: 'forced' });
    }
    const due = [];
    for (const t of tasks || []) {
        if (running.has(t.id) || out.some((o) => o.id === t.id)) continue;
        const next = taskNextRunAt(t, (taskState || {})[t.id]);
        if (next != null && next <= opts.nowMs) due.push({ id: t.id, next });
    }
    due.sort((a, b) => a.next - b.next);
    for (const d of due) {
        if (out.length >= capacity) break;
        out.push({ id: d.id, reason: 'due' });
    }
    return out;
}

/**
 * 実行の記録に「最初に見た時刻」を足す（純粋関数）。新しい定義の cron が、過去の時刻の分まで
 * すぐ実行されないようにするため。記録を変えたときだけ `changed: true`。
 * @param {object[]} tasks
 * @param {object} taskState
 * @param {number} nowMs
 * @returns {{state: object, changed: boolean}}
 */
function seedTaskState(tasks, taskState, nowMs) {
    const state = { ...(taskState || {}) };
    let changed = false;
    for (const t of tasks || []) {
        if (!state[t.id] || state[t.id].firstSeenAt == null) {
            state[t.id] = { ...(state[t.id] || {}), firstSeenAt: nowMs };
            changed = true;
        }
    }
    return { state, changed };
}

/**
 * 実行が終わったときの記録（純粋関数）。手で実行したものは cron の予定を動かさない
 * （`lastRunAt` を変えない）が、once は手で実行しても済んだことにする。
 * @param {object} st 前の記録
 * @param {{def: object, reason: string, startedAt: number, endedAt: number, outcome: string, summary?: string}} r
 * @returns {object}
 */
function recordTaskRun(st, r) {
    const next = { ...(st || {}), lastOutcome: r.outcome, lastSummary: r.summary ? String(r.summary).slice(0, 300) : null,
        lastStartedAt: r.startedAt, lastEndedAt: r.endedAt };
    const isOnce = r.def && r.def.schedule && r.def.schedule.type === 'once';
    if (r.reason !== 'forced' || isOnce) next.lastRunAt = r.startedAt;
    else next.lastManualRunAt = r.startedAt;
    return next;
}

/** 予定の短い説明（モニター用・純粋関数） */
function scheduleLabel(def) {
    const s = (def && def.schedule) || {};
    if (s.type === 'once') return s.at ? `1 回（${s.at}）` : '1 回（いま）';
    if (s.type === 'cron') return `定期（${s.cron}${s.tz && s.tz !== DEFAULT_TASK_TZ ? ` ${s.tz}` : ''}）`;
    return '?';
}

/**
 * モニターに出すタスクの行（純粋関数）。
 * @param {object[]} tasks
 * @param {object} taskState
 * @param {{running?: string[], forced?: string[]}} opts
 * @returns {object[]}
 */
function taskRows(tasks, taskState, opts = {}) {
    const running = new Set(opts.running || []);
    const forced = new Set(opts.forced || []);
    return (tasks || []).map((t) => {
        const st = (taskState || {})[t.id] || {};
        return {
            id: t.id,
            title: t.title,
            source: t.source || 'repo',
            enabled: t.enabled !== false,
            schedule: scheduleLabel(t),
            nextRunAt: taskNextRunAt(t, st),
            lastRunAt: st.lastRunAt != null ? st.lastRunAt : (st.lastManualRunAt != null ? st.lastManualRunAt : null),
            lastOutcome: st.lastOutcome || null,
            lastSummary: st.lastSummary || null,
            running: running.has(t.id),
            queued: forced.has(t.id),
        };
    });
}

/**
 * モニターの「タスクを作る」の入力から定義を作る（純粋関数）。id はタイトルと時刻から作る。
 * @param {{title: string, prompt: string, at?: string, cron?: string, tz?: string}} input
 * @param {number} nowMs
 * @returns {{ok: boolean, task?: object, errors: string[]}}
 */
function taskFromInput(input, nowMs) {
    const i = input || {};
    const stamp = new Date(nowMs).toISOString().replace(/[-:T]/g, '').slice(0, 12);
    const slug = String(i.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
    const schedule = i.cron
        ? { type: 'cron', cron: String(i.cron).trim(), tz: i.tz || DEFAULT_TASK_TZ }
        : { type: 'once', ...(i.at ? { at: String(i.at) } : {}) };
    const task = {
        id: slug || `t${stamp}`,
        title: String(i.title || '').trim().slice(0, 200),
        prompt: String(i.prompt || '').trim().slice(0, 20000),
        schedule,
    };
    const v = validateTask(task);
    return v.ok ? { ok: true, task, errors: [] } : { ok: false, errors: v.errors };
}

module.exports = {
    DEFAULT_TASK_TZ,
    TASK_ID_RE,
    parseTzOffset,
    parseCron,
    nextCronRun,
    validateTask,
    mergeTaskDefs,
    taskNextRunAt,
    dueTasks,
    seedTaskState,
    recordTaskRun,
    scheduleLabel,
    taskRows,
    taskFromInput,
};
