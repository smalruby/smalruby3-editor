'use strict';
/**
 * blocked.js — worker（子 claude）が許可・確認・選択のプロンプトで止まった（blocked）ときに、
 * どう答えるかを決める**純粋関数**（EPIC #2384 の H・#2387）。
 *
 * 流れ: 画面を読む（runner）→ {@link classifyBlockedScreen} で決まった形を先に判定する →
 * 決まらないものは安い `claude -p` の判定（{@link judgePrompt} / {@link parseJudgeReply}）→
 * よければ答えて続ける、NG なら一時停止してモニターで人間が答える（blocked-hub.js）。
 *
 * devpod の中で動くので**基本は続けてよい**。ただし外に出ていく・取り消せない操作
 * （force push・deploy・秘密の読み出し・広い削除など）は止めて人間に渡す（{@link NG_RULES}）。
 * I/O・時計・乱数を持ち込まない（`.claude/rules/autopilot/development.md`）。
 */

/**
 * 画面にこれが出ていたら、ルールでも AI でも答えずに人間に渡す（いちばん先に見る）。
 * 誤って止まる分には人間がモニターから答えればよいので、広めに取る。
 */
const NG_RULES = [
    { re: /git\s+push\b[^\n]*(--force\b|\s-f\b|--force-with-lease)/, reason: 'force push' },
    { re: /\bcdk\s+(deploy|destroy)\b/, reason: 'cdk deploy / destroy' },
    { re: /\baws\s+[a-z0-9-]+\s+(delete|remove|rm|put|update|create)[a-z0-9-]*/i, reason: 'AWS への書き込み' },
    { re: /\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+(\/|~|\$HOME|\/app)(\s|$)/i, reason: '広い削除（rm -rf / ・~・/app）' },
    { re: /(^|[\s/'"])\.env(\.[a-z0-9]+)?([\s'"]|$)/i, reason: '.env（秘密）に触る' },
    { re: /private-key\.pem|\.config\/smalruby-bot|admin-token/, reason: '鍵・トークンに触る' },
    { re: /\bgh\s+pr\s+merge\b|\bgh\s+repo\s+(delete|edit)\b|\bgh\s+secret\b/, reason: 'GitHub の取り消せない操作' },
    { re: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)/, reason: '作業を消す git 操作' },
    { re: /\bDROP\s+(TABLE|DATABASE)\b/i, reason: 'DB の削除' },
];

/** 判定・人間の答えとして送ってよいキー（herdr の logical key / tmux の send-keys の両方で通る名前） */
const ALLOWED_KEYS = new Set([
    '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'enter', 'esc', 'tab', 'up', 'down', 'left', 'right', 'space', 'y', 'n',
]);

/** 同じ画面に何回答えても抜けなければ人間に渡す（答えがループしているとみなす） */
const MAX_SAME_SCREEN_ANSWERS = 3;

/** 人間がモニターから送る文字の上限 */
const MAX_HUMAN_TEXT = 2000;

/**
 * 画面の文字から、プロンプトの部分を取り出す。Claude Code のダイアログは実線の罫線（─）の下に出るので、
 * 最後の実線より下だけを見る（上に残っている会話の文字で NG ルールに誤って当たらないため）。
 * 実線が無ければ最後の 40 行。
 * @param {string} screen
 * @returns {string}
 */
function promptRegion(screen) {
    const lines = String(screen || '').split('\n');
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    let rule = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (/^\s*─{10,}\s*$/.test(lines[i])) { rule = i; break; }
    }
    // 入力欄（❯ の上下に実線）のように実線の下が数行しかないときは、その上も含める
    const below = rule >= 0 ? lines.slice(rule + 1) : [];
    if (rule >= 0 && below.filter((l) => l.trim()).length >= 3) return below.join('\n');
    return lines.slice(-40).join('\n');
}

/**
 * 画面の選択肢を読む（純粋関数）。Claude Code の選択 UI は
 * `❯ 1. Yes` / `  2. No` の番号つきと、`❯ No, exit` / `  Yes, I trust this folder` の番号なしがある。
 * @param {string} screen
 * @returns {{index:number, number:number|null, label:string, selected:boolean}[]}
 */
function parseScreenOptions(screen) {
    const out = [];
    const lines = promptRegion(screen).split('\n');
    // 番号つき
    for (const line of lines) {
        const m = line.match(/^\s*(❯|>)?\s*(\d)\.\s+(.+?)\s*$/);
        if (m) out.push({ index: out.length, number: Number(m[2]), label: m[3], selected: !!m[1] });
    }
    if (out.length) return out;
    // 番号なし: ❯ の付いた行を起点に、同じ字下げで続く行を選択肢とみなす
    const sel = lines.findIndex((l) => /^\s*❯\s+\S/.test(l));
    if (sel < 0) return out;
    let start = sel;
    while (start > 0 && /^\s{2,}\S/.test(lines[start - 1]) && !/[:：?？]\s*$/.test(lines[start - 1])) start -= 1;
    for (let i = start; i < lines.length; i++) {
        const l = lines[i];
        const m = l.match(/^\s*(❯)?\s+(\S.*?)\s*$/);
        if (!m || !l.trim()) break;
        if (/Enter to confirm|Esc to cancel/.test(l)) break;
        out.push({ index: out.length, number: null, label: m[2], selected: !!m[1] });
    }
    return out;
}

/**
 * ある選択肢を選ぶキー列を作る（純粋関数）。番号があれば番号 1 つ、なければ上下と Enter。
 * @param {object[]} options parseScreenOptions の結果
 * @param {number} target 選びたい選択肢の index
 * @returns {string[]}
 */
function keysToSelect(options, target) {
    const t = options[target];
    if (!t) return [];
    if (t.number != null) return [String(t.number)];
    const cur = Math.max(0, options.findIndex((o) => o.selected));
    const diff = target - cur;
    const move = diff >= 0 ? Array(diff).fill('down') : Array(-diff).fill('up');
    return [...move, 'enter'];
}

/**
 * blocked の画面を決まった形で判定する（純粋関数）。
 * - NG に当たる → `pause`（人間に渡す）
 * - フォルダの信頼の確認 → 「信頼する」を選ぶ `answer`
 * - 「Do you want to proceed?」型 → 「1. Yes」（今回だけ許す。always allow は選ばない）の `answer`
 * - それ以外 → `judge`（AI に読ませる。判定が使えないときは呼び出し側が pause にする）
 * @param {string} screen 画面の文字
 * @returns {{action:'answer'|'judge'|'pause', kind:string, keys:string[], reason:string, options:object[]}}
 */
function classifyBlockedScreen(screen) {
    const region = promptRegion(screen);
    const options = parseScreenOptions(screen);
    for (const r of NG_RULES) {
        if (r.re.test(region)) return { action: 'pause', kind: 'ng-rule', keys: [], reason: `NG: ${r.reason}`, options };
    }
    if (/trust this folder|Do you trust the files/i.test(region)) {
        const yes = options.findIndex((o) => /^Yes\b/i.test(o.label));
        if (yes >= 0) return { action: 'answer', kind: 'trust-folder', keys: keysToSelect(options, yes), reason: 'worktree のフォルダを信頼する', options };
    }
    if (/Do you want to (proceed|create|run|make|edit|allow)/i.test(region)) {
        const yes = options.findIndex((o) => /^Yes\s*$/i.test(o.label));
        if (yes >= 0) return { action: 'answer', kind: 'permission', keys: keysToSelect(options, yes), reason: '今回だけ許可する（1. Yes）', options };
    }
    return { action: 'judge', kind: 'unknown', keys: [], reason: '決まった形ではない', options };
}

/**
 * 安い `claude -p` に渡す判定の指示文（純粋関数）。画面は stdin で渡す。
 * @returns {string}
 */
function judgePrompt() {
    return [
        'You judge a blocked AI coding agent (Claude Code) that is waiting at a prompt inside an isolated devcontainer.',
        'The agent works on a git worktree of an open-source project. Continuing is usually fine.',
        'Say "ng" if the action could leak secrets (.env, tokens, keys), deploy or change cloud resources,',
        'force-push, merge PRs, delete work outside the worktree, or if the prompt asks a real design question',
        'that a human should answer. Otherwise say "ok" and choose the option that continues ONLY this once',
        '(never "always allow" and never "switch mode" options).',
        'Reply with ONE line of JSON and nothing else: {"verdict":"ok"|"ng","keys":["1"],"reason":"short reason"}.',
        'keys are key presses such as "1".."9", "enter", "down", "up", "esc", "y", "n". The screen is on stdin.',
    ].join(' ');
}

/**
 * 判定の返事を読む（純粋関数）。JSON が読めない・キーが許されていない → null（呼び出し側は pause）。
 * @param {string} text `claude -p` の出力
 * @returns {{verdict:'ok'|'ng', keys:string[], reason:string}|null}
 */
function parseJudgeReply(text) {
    const s = String(text || '');
    const m = s.match(/\{[^{}]*"verdict"[^{}]*\}/);
    if (!m) return null;
    let obj;
    try { obj = JSON.parse(m[0]); } catch { return null; }
    const verdict = obj.verdict === 'ok' ? 'ok' : obj.verdict === 'ng' ? 'ng' : null;
    if (!verdict) return null;
    const reason = String(obj.reason || '').slice(0, 300);
    if (verdict === 'ng') return { verdict, keys: [], reason };
    const keys = Array.isArray(obj.keys) ? obj.keys.map((k) => String(k).toLowerCase()) : [];
    if (!keys.length || keys.length > 10 || !keys.every((k) => ALLOWED_KEYS.has(k))) return null;
    return { verdict, keys, reason };
}

/**
 * 同じ画面かを見分けるための署名（純粋関数）。spinner・経過時間など揺れる所を落とす。
 * @param {string} screen
 * @returns {string}
 */
function screenSignature(screen) {
    return promptRegion(screen)
        .replace(/[✻✶✳✢·*◐◓◑◒⏵⏸]+/g, '')
        .replace(/\d+\s*(s|ms|m)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(-1500);
}

/**
 * blocked の 1 回分の扱いを決める（純粋関数）。ルール → 判定 → 回数の上限の順。
 * @param {object} p
 * @param {object} p.classification classifyBlockedScreen の結果
 * @param {object|null} [p.judge] parseJudgeReply の結果（判定していなければ undefined、失敗は null）
 * @param {boolean} p.judgeEnabled 判定を使う設定か
 * @param {number} p.sameScreenAnswers 同じ画面にこれまで答えた回数
 * @returns {{action:'answer'|'judge'|'pause', keys:string[], source:'rule'|'judge'|null, reason:string}}
 */
function decideBlocked(p) {
    const c = p.classification;
    if ((p.sameScreenAnswers || 0) >= MAX_SAME_SCREEN_ANSWERS) {
        return { action: 'pause', keys: [], source: null, reason: `同じ画面に ${p.sameScreenAnswers} 回答えても進まない` };
    }
    if (c.action === 'pause') return { action: 'pause', keys: [], source: 'rule', reason: c.reason };
    if (c.action === 'answer') return { action: 'answer', keys: c.keys, source: 'rule', reason: c.reason };
    if (!p.judgeEnabled) return { action: 'pause', keys: [], source: null, reason: '決まった形ではない（AI の判定は無効）' };
    if (p.judge === undefined) return { action: 'judge', keys: [], source: null, reason: c.reason };
    if (p.judge === null) return { action: 'pause', keys: [], source: 'judge', reason: 'AI の判定を読めなかった' };
    if (p.judge.verdict === 'ng') return { action: 'pause', keys: [], source: 'judge', reason: `AI が NG と判定: ${p.judge.reason}` };
    return { action: 'answer', keys: p.judge.keys, source: 'judge', reason: `AI が続けてよいと判定: ${p.judge.reason}` };
}

/**
 * モニターから来た人間の答えを確かめる（純粋関数）。
 * `{keys:["1"]}`（選択肢）か `{text:"..."}`（文を入れて Enter）のどちらか。
 * @param {object} body
 * @returns {{ok:true, answer:{keys?:string[], text?:string}}|{ok:false, error:string}}
 */
function normalizeHumanAnswer(body) {
    const b = body || {};
    if (Array.isArray(b.keys)) {
        const keys = b.keys.map((k) => String(k).toLowerCase());
        if (!keys.length || keys.length > 10) return { ok: false, error: 'keys must have 1..10 items' };
        const bad = keys.find((k) => !ALLOWED_KEYS.has(k));
        if (bad) return { ok: false, error: `key not allowed: ${bad}` };
        return { ok: true, answer: { keys } };
    }
    if (typeof b.text === 'string') {
        const text = b.text.replace(/\r/g, '');
        if (!text.trim()) return { ok: false, error: 'text is empty' };
        if (text.length > MAX_HUMAN_TEXT) return { ok: false, error: 'text too long' };
        return { ok: true, answer: { text } };
    }
    return { ok: false, error: 'keys (array) or text (string) required' };
}

/**
 * watchdog に渡す「経過時間」（純粋関数）。人間の答えを待っていた時間は数えない。
 * @param {number} elapsedMs 起動からの経過
 * @param {number} pausedMs これまで止めていた合計
 * @param {number} [pausedSinceMs] いま止めているなら、止めてからの経過
 * @returns {number}
 */
function activeElapsedMs(elapsedMs, pausedMs, pausedSinceMs = 0) {
    return Math.max(0, elapsedMs - (pausedMs || 0) - (pausedSinceMs || 0));
}

/**
 * settings の `terminal` / `blocked` を既定とあわせる（純粋関数）。env が最優先。
 * @param {object} [settings] マージ済み settings
 * @param {object} [env] process.env 相当
 * @returns {{backend:'herdr'|'tmux', herdrSession:string, herdrBin:string,
 *   blockedMode:'handle'|'hitl', judge:boolean, judgeModel:string, judgeTimeoutMs:number}}
 */
function resolveTerminalSettings(settings, env = {}) {
    const t = (settings && settings.terminal) || {};
    const b = (settings && settings.blocked) || {};
    const pick = (v, allowed, d) => (allowed.includes(v) ? v : d);
    return {
        backend: pick(env.AUTOPILOT_TERMINAL || t.backend, ['herdr', 'tmux'], 'herdr'),
        herdrSession: String(env.AUTOPILOT_HERDR_SESSION || t.herdrSession || 'autopilot'),
        herdrBin: String(t.herdrBin || 'herdr'),
        blockedMode: pick(b.mode, ['handle', 'hitl'], 'handle'),
        judge: b.judge !== false,
        judgeModel: String(b.judgeModel || 'haiku'),
        judgeTimeoutMs: Number.isFinite(b.judgeTimeoutMs) ? b.judgeTimeoutMs : 90_000,
    };
}

module.exports = {
    NG_RULES, ALLOWED_KEYS, MAX_SAME_SCREEN_ANSWERS, MAX_HUMAN_TEXT,
    promptRegion, parseScreenOptions, keysToSelect, classifyBlockedScreen,
    judgePrompt, parseJudgeReply, screenSignature, decideBlocked, normalizeHumanAnswer,
    activeElapsedMs, resolveTerminalSettings,
};
