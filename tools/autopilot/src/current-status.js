'use strict';
/**
 * current-status.js — 「現在地」の artifact を作る job の判断とテンプレートの描画（純粋関数のみ・#2388）。
 *
 * 現在地は人間が頼んだときだけ（モニタの「現在地を作る」）Claude の worker が作り直す。artifact は
 * 同じ URL を更新して使い回すので、URL と最終更新の時刻を daemon の外のファイルに持つ（I/O は
 * current-status-job.js）。ここは結果の解釈・状態の次の値・テンプレートへのデータの埋め込みだけ。
 *
 * テンプレートは tools/autopilot/templates/current-status/。いまは worker が材料（GET /status.json）
 * から {@link draftDataFromMaterial} の下書きを作り、ことばを足してから {@link renderCurrentStatusHtml}
 * で HTML にする。分かりやすい形が決まったら、下書きだけで（Claude なしで）作れるようにする。
 */

/** job の名前（AUTOPILOT_PHASE・settings の phases のキー・プロンプトのファイル名）。 */
const CURRENT_STATUS_PHASE = 'current-status';
const CURRENT_STATUS_SKILL = 'autopilot-current-status';

/** テンプレートの中で、データの JSON に置きかえる印。 */
const TEMPLATE_DATA_TOKEN = '/*__CURRENT_STATUS_DATA__*/null';

/** テンプレートのデータの形の版。形を変えたら上げ、テンプレートの JS と合わせる。 */
const TEMPLATE_DATA_SCHEMA = 1;

/**
 * claude.ai の artifact の URL か（worker の申告をそのまま信じない）。
 * @param {*} u
 * @returns {boolean}
 */
function isArtifactUrl(u) {
    return typeof u === 'string' && /^https:\/\/claude\.ai\/(code\/)?artifact\/[A-Za-z0-9_-]+\/?$/.test(u.trim());
}

/**
 * job の結果から、次の状態（ファイルに残すもの）とためる改善メモを決める。
 * - 成功: URL を（初回は新しく）記録し、updatedAt を now にする
 * - 失敗: URL・updatedAt は前のまま、lastError に理由を残す
 * 既に URL があるのに worker が別の URL を返したら、新しいほうを採る（人間が作り直しを頼んだ場合など）。
 * @param {object} p { prev, run: {ok, reason}, parsed: {ok, result, errors}, now }
 * @returns {{state: object, notes: string[], ok: boolean}}
 */
function planCurrentStatusOutcome(p) {
    const prev = p.prev || {};
    const now = p.now;
    const base = { url: prev.url || null, updatedAt: prev.updatedAt || null, lastRunAt: now };
    const fail = (reason) => ({ ok: false, notes: [], state: { ...base, lastError: String(reason).slice(0, 300) } });
    if (!p.run || !p.run.ok) return fail(`worker が止まりました（${(p.run && p.run.reason) || '不明'}）`);
    if (!p.parsed || !p.parsed.ok) return fail(`結果ファイルが不正です: ${((p.parsed && p.parsed.errors) || []).join('; ')}`);
    const r = p.parsed.result;
    const notes = (Array.isArray(r.templateNotes) ? r.templateNotes : [])
        .filter((n) => typeof n === 'string' && n.trim())
        .map((n) => n.trim().slice(0, 500));
    if (r.signal !== 'done') return { ...fail(r.error || r.reason || `signal=${r.signal}`), notes };
    const url = isArtifactUrl(r.artifactUrl) ? r.artifactUrl.trim() : null;
    if (!url && !prev.url) return { ...fail('artifact の URL が結果にありません'), notes };
    return { ok: true, notes, state: { url: url || prev.url, updatedAt: now, lastRunAt: now, lastError: null } };
}

/**
 * モニタ・/board・/status.json に出す現在地の見え方。
 * @param {object|null} st ファイルに残した状態
 * @param {object|null} job 走っている job（{ startedAt }）
 * @param {number} [notesCount] たまっている改善メモの数
 * @returns {object}
 */
function currentStatusView(st, job, notesCount = 0) {
    const s = st || {};
    return {
        url: s.url || null,
        updatedAt: s.updatedAt || null,
        lastRunAt: s.lastRunAt || null,
        lastError: s.lastError || null,
        running: Boolean(job),
        startedAt: job ? job.startedAt : null,
        notesCount,
    };
}

/**
 * 材料（GET /status.json）からテンプレートのデータの下書きを作る。worker はこれにことば（lead・note）を足す。
 * いずれ Claude なしでこれだけで現在地を作れるように、テンプレートが読む形をここで決める。
 * @param {object} m buildStatusMaterial の結果
 * @returns {object} テンプレートのデータ（schema = TEMPLATE_DATA_SCHEMA）
 */
function draftDataFromMaterial(m) {
    const mat = m || {};
    const repoUrl = mat.repo ? `https://github.com/${mat.repo}` : null;
    const issueUrl = (n) => (repoUrl && n ? `${repoUrl}/issues/${n}` : null);
    const ni = mat.nextInterview;
    return {
        schema: TEMPLATE_DATA_SCHEMA,
        title: '開発の現在地',
        asOf: mat.generatedAt || null,
        lead: '',
        waits: (mat.waitingHuman || []).map((w) => ({
            what: `#${w.issue} ${w.title || ''}`.trim(), why: '', link: w.url || issueUrl(w.issue), label: `#${w.issue}`,
            reason: w.waitReason || null,
        })),
        added: [],
        running: (mat.running || []).map((r) => ({ issue: r.issue, title: r.title || '', phase: r.phase, since: r.since || null, note: '' })),
        priorities: (mat.priorities || []).slice(0, 15).map((p) => ({
            issue: p.issue, title: p.title || '', priority: p.priority || null, epic: p.epic || null, link: p.url || issueUrl(p.issue),
        })),
        nextInterview: ni ? { at: ni.atIso || null, epic: ni.epic || null, title: ni.title || '', questions: ni.questions || 0, text: '' } : null,
        epics: (mat.groups || []).map((g) => ({
            n: g.epic, t: g.title, link: g.url || issueUrl(g.epic), solo: Boolean(g.solo), done: g.done, total: g.total,
            stage: g.stage, stageLabel: g.stageLabel, priority: g.priority || null,
            running: (g.running || []).length, pendingDecisions: g.pendingDecisions || 0,
            eta: g.eta ? g.eta.atIso || null : null, note: '',
        })),
        blocked: (mat.blocked || []).map((b) => ({ issue: b.issue || null, title: b.title || '', reason: b.reason || '' })),
        footer: mat.repo ? `Issue と PR は GitHub の ${mat.repo} から取りました。` : '',
    };
}

/**
 * テンプレートの HTML にデータを埋め込む。`</script>` を閉じられないよう `<` を < にする。
 * @param {string} template テンプレートの HTML（TEMPLATE_DATA_TOKEN を 1 つ含む）
 * @param {object} data {@link draftDataFromMaterial} の形
 * @returns {string} HTML
 */
function renderCurrentStatusHtml(template, data) {
    return embedTemplateData(template, TEMPLATE_DATA_TOKEN, data);
}

/**
 * テンプレートの印をデータの JSON に置きかえる（現在地・リリース確認のページで共通・#2474）。
 * @param {string} template
 * @param {string} token テンプレートの中の印
 * @param {object} data
 * @returns {string}
 */
function embedTemplateData(template, token, data) {
    const t = String(template || '');
    if (!t.includes(token)) throw new Error('template has no data token');
    const json = JSON.stringify(data == null ? null : data)
        .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return t.split(token).join(json);
}

module.exports = {
    CURRENT_STATUS_PHASE,
    CURRENT_STATUS_SKILL,
    TEMPLATE_DATA_TOKEN,
    TEMPLATE_DATA_SCHEMA,
    isArtifactUrl,
    planCurrentStatusOutcome,
    currentStatusView,
    draftDataFromMaterial,
    renderCurrentStatusHtml,
    embedTemplateData,
};
