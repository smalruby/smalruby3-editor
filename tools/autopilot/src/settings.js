'use strict';
/**
 * settings.js — worker（子 claude）の起動設定。
 *
 * フェーズごと・開発者ごとに model / effort / 追加許可ディレクトリを変えられるようにする。
 * デフォルト（DEFAULT_SETTINGS）はベストを目指した推奨構成で、開発者は
 * `~/.config/autopilot/settings.json`（または env `AUTOPILOT_SETTINGS` のパス）で上書きする。
 * リポジトリ共通の上書きは `tools/autopilot/settings.json`（任意・コミット可）に置ける。
 *
 * マージ順（後勝ち）: DEFAULT_SETTINGS ← repo settings.json ← 開発者 settings.json
 *
 * daemon は起動時に「プロンプト一式 + 解決済み settings」を tmpdir へスナップショットし、
 * run 中に checkout のブランチが切り替わってもプロンプト/設定が変わらないようにする
 * （{@link snapshotRunAssets}）。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PROMPT_DIR } = require('./phases');

/**
 * 既定の worker 設定。model はフェーズの性質に合わせた推奨値
 * （実装・レビュー系は opus、分類・対話系は sonnet）。effort は既定では指定しない
 * （指定すると `--effort` フラグになる。古い Claude Code では未対応のため opt-in）。
 */
const DEFAULT_SETTINGS = {
    /** claude 実行ファイル（PATH 解決） */
    claudeCommand: 'claude',
    permissionMode: 'acceptEdits',
    /** 非対話で gh/git が権限プロンプトに当たらないための許可ツール */
    allowedTools: ['Bash', 'Edit', 'Read', 'Glob', 'Grep', 'WebFetch'],
    /**
     * worker に読み書きを許可する追加ディレクトリ（`--add-dir`）。
     * 例: 参照リポジトリ群を許可するなら `"~/ghq"`。`~` はホームに展開される。
     */
    addDirs: [],
    /**
     * フェーズごとの上書き。`default` は全フェーズの共通既定。
     * 各値: { model: string|null, effort: string|null, args: string[] }
     */
    phases: {
        default: { model: null, effort: null, args: [] },
        triage: { model: 'sonnet' },
        understand: { model: 'opus' },
        decompose: { model: 'opus' },
        discuss: { model: 'sonnet' },
        implement: { model: 'opus' },
        review: { model: 'opus' },
        'address-review': { model: 'opus' },
        verify: { model: 'sonnet' },
    },
};

/** 開発者ごとの設定ファイルの既定パス */
function userSettingsPath(env = process.env, homedir = os.homedir()) {
    if (env.AUTOPILOT_SETTINGS) return env.AUTOPILOT_SETTINGS;
    return path.join(env.XDG_CONFIG_HOME || path.join(homedir, '.config'), 'autopilot', 'settings.json');
}

/**
 * 設定を deep merge する（純粋関数）。`phases` はフェーズ単位で shallow merge、
 * 配列（allowedTools / addDirs / args）は置き換え。base は破壊しない。
 * @param {object} base
 * @param {object} override
 * @returns {object}
 */
function mergeSettings(base, override) {
    const out = { ...base, ...(override || {}) };
    out.phases = { ...(base.phases || {}) };
    for (const [phase, cfg] of Object.entries((override && override.phases) || {})) {
        out.phases[phase] = { ...(out.phases[phase] || {}), ...(cfg || {}) };
    }
    return out;
}

/**
 * 設定ファイル群を読み込んでマージ済み設定を返す。
 * ファイルが無いのは正常（既定を使う）。壊れた JSON は warn してスキップする
 * （設定ミスで daemon が起動不能になるより、既定で動き続ける方が無人運用に向く）。
 * @param {object} [opts] { repoRoot, env, homedir, log }
 * @returns {object} マージ済み設定
 */
function loadSettings(opts = {}) {
    const log = opts.log || (() => {});
    const repoRoot = opts.repoRoot || path.resolve(__dirname, '..', '..', '..');
    const candidates = [
        path.join(repoRoot, 'tools', 'autopilot', 'settings.json'),
        userSettingsPath(opts.env || process.env, opts.homedir || os.homedir()),
    ];
    let settings = DEFAULT_SETTINGS;
    for (const file of candidates) {
        if (!fs.existsSync(file)) continue;
        try {
            settings = mergeSettings(settings, JSON.parse(fs.readFileSync(file, 'utf8')));
            log(`settings loaded: ${file}`);
        } catch (e) {
            log(`settings skipped (${file}): ${e.message}`);
        }
    }
    return settings;
}

/**
 * フェーズの実効設定（default とフェーズ個別のマージ）を返す（純粋関数）。
 * @param {object} settings マージ済み設定
 * @param {string} phase フェーズ名
 * @returns {{model: string|null, effort: string|null, args: string[]}}
 */
function phaseSettings(settings, phase) {
    const phases = (settings && settings.phases) || {};
    return { model: null, effort: null, args: [], ...(phases.default || {}), ...(phases[phase] || {}) };
}

/** shell に安全に渡せるよう単一引数を quote する（純粋関数） */
function shellQuote(arg) {
    const s = String(arg);
    if (/^[\w@%+=:,.\/-]+$/.test(s)) return s;
    return `'${s.replace(/'/g, "'\\''")}'`;
}

/** `~/` 始まりをホームディレクトリに展開する（純粋関数） */
function expandHome(p, homedir = os.homedir()) {
    if (p === '~') return homedir;
    if (p && p.startsWith('~/')) return path.join(homedir, p.slice(2));
    return p;
}

/**
 * worker（子 claude）の起動コマンド文字列を組み立てる（純粋関数）。
 * @param {object} settings マージ済み設定
 * @param {string} phase フェーズ名（model/effort のフェーズ上書きを引く）
 * @param {object} [opts] { extraDirs: string[], homedir }
 * @returns {string} tmux で起動するコマンド文字列
 */
function buildClaudeCommand(settings, phase, opts = {}) {
    const s = settings || DEFAULT_SETTINGS;
    const ph = phaseSettings(s, phase);
    const homedir = opts.homedir || os.homedir();
    const parts = [s.claudeCommand || 'claude'];
    if (s.permissionMode) parts.push('--permission-mode', s.permissionMode);
    if (Array.isArray(s.allowedTools) && s.allowedTools.length) {
        parts.push('--allowedTools', ...s.allowedTools);
    }
    for (const dir of [...(s.addDirs || []), ...(opts.extraDirs || [])]) {
        parts.push('--add-dir', expandHome(dir, homedir));
    }
    if (ph.model) parts.push('--model', ph.model);
    if (ph.effort) parts.push('--effort', ph.effort);
    // Claude 使用率の抽出（Issue #879）: worker の status line に usage-statusline.sh を仕込み、
    // rate_limits を usage ファイルへ書き出させる。script/file は **絶対パス**を渡すこと
    // （パスを誤ると daemon が値を読めない）。JSON は shellQuote でまとめて single-quote される。
    if (opts.usageStatusline && opts.usageStatusline.script && opts.usageStatusline.file) {
        const { script, file } = opts.usageStatusline;
        const settingsJson = JSON.stringify({
            statusLine: { type: 'command', command: `bash ${script} ${file}` },
        });
        parts.push('--settings', settingsJson);
    }
    parts.push(...(ph.args || []));
    return parts.map(shellQuote).join(' ');
}

/**
 * run 資産（フェーズプロンプト一式 + 解決済み settings）を tmpdir へスナップショットする。
 * daemon 起動中に checkout のブランチが切り替わってもプロンプト/設定が変わらないための隔離。
 * worker はスナップショットの絶対パスを Read する（daemon が `--add-dir` で許可を渡す）。
 * @param {object} [opts] { repoRoot, settings, tmpdir }
 * @returns {{dir: string, promptDir: string}} スナップショットの場所
 */
function snapshotRunAssets(opts = {}) {
    const repoRoot = opts.repoRoot || path.resolve(__dirname, '..', '..', '..');
    const dir = fs.mkdtempSync(path.join(opts.tmpdir || os.tmpdir(), 'autopilot-run-'));
    const promptDir = path.join(dir, 'prompts');
    fs.cpSync(path.join(repoRoot, PROMPT_DIR), promptDir, { recursive: true });
    if (opts.settings) {
        fs.writeFileSync(path.join(dir, 'settings.resolved.json'), JSON.stringify(opts.settings, null, 2));
    }
    return { dir, promptDir };
}

module.exports = {
    DEFAULT_SETTINGS,
    userSettingsPath,
    mergeSettings,
    loadSettings,
    phaseSettings,
    shellQuote,
    expandHome,
    buildClaudeCommand,
    snapshotRunAssets,
};
