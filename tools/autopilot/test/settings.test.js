'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    DEFAULT_SETTINGS,
    userSettingsPath,
    mergeSettings,
    loadSettings,
    phaseSettings,
    shellQuote,
    expandHome,
    buildClaudeCommand,
    snapshotRunAssets,
} = require('../src/settings');

test('mergeSettings: phases はフェーズ単位でマージ、配列は置き換え、base は破壊しない', () => {
    const base = {
        allowedTools: ['Bash', 'Read'],
        addDirs: [],
        phases: { default: { model: null }, implement: { model: 'opus' } },
    };
    const merged = mergeSettings(base, {
        addDirs: ['~/ghq'],
        phases: { implement: { effort: 'high' }, triage: { model: 'sonnet' } },
    });
    assert.deepEqual(merged.addDirs, ['~/ghq']);
    // implement は model を保ちつつ effort が加わる
    assert.deepEqual(merged.phases.implement, { model: 'opus', effort: 'high' });
    assert.deepEqual(merged.phases.triage, { model: 'sonnet' });
    assert.deepEqual(merged.phases.default, { model: null });
    // base は破壊しない
    assert.deepEqual(base.phases.implement, { model: 'opus' });
    assert.deepEqual(base.addDirs, []);
});

test('phaseSettings: default とフェーズ個別のマージ（未知フェーズは default）', () => {
    const s = mergeSettings(DEFAULT_SETTINGS, {
        phases: { default: { effort: 'medium' }, implement: { effort: 'high' } },
    });
    assert.equal(phaseSettings(s, 'implement').model, 'opus');
    assert.equal(phaseSettings(s, 'implement').effort, 'high');
    assert.equal(phaseSettings(s, 'triage').model, 'sonnet');
    assert.equal(phaseSettings(s, 'triage').effort, 'medium'); // default から継承
    assert.equal(phaseSettings(s, 'unknown-phase').effort, 'medium');
});

test('shellQuote: 安全な引数はそのまま、特殊文字は single-quote', () => {
    assert.equal(shellQuote('claude'), 'claude');
    assert.equal(shellQuote('/tmp/autopilot-run-x'), '/tmp/autopilot-run-x');
    assert.equal(shellQuote('a b'), "'a b'");
    assert.equal(shellQuote("it's"), "'it'\\''s'");
});

test('expandHome: ~ をホームに展開する', () => {
    assert.equal(expandHome('~/ghq', '/home/dev'), path.join('/home/dev', 'ghq'));
    assert.equal(expandHome('~', '/home/dev'), '/home/dev');
    assert.equal(expandHome('/abs/path', '/home/dev'), '/abs/path');
});

test('buildClaudeCommand: 既定設定で non-interactive なコマンドを組み立てる', () => {
    const cmd = buildClaudeCommand(DEFAULT_SETTINGS, 'implement', { homedir: '/home/dev' });
    assert.match(cmd, /^claude --permission-mode acceptEdits --allowedTools Bash Edit Read Glob Grep WebFetch/);
    assert.match(cmd, /--model opus/);
    // effort は既定では指定しない（古い CLI との互換のため opt-in）
    assert.doesNotMatch(cmd, /--effort/);
});

test('buildClaudeCommand: フェーズ別 model/effort・addDirs・extraDirs が効く', () => {
    const s = mergeSettings(DEFAULT_SETTINGS, {
        addDirs: ['~/ghq'],
        phases: { triage: { model: 'haiku', effort: 'low' } },
    });
    const cmd = buildClaudeCommand(s, 'triage', { homedir: '/home/dev', extraDirs: ['/tmp/autopilot-run-1'] });
    assert.match(cmd, /--add-dir \/home\/dev\/ghq/);
    assert.match(cmd, /--add-dir \/tmp\/autopilot-run-1/);
    assert.match(cmd, /--model haiku/);
    assert.match(cmd, /--effort low/);
});

test('userSettingsPath: AUTOPILOT_SETTINGS > XDG_CONFIG_HOME > ~/.config', () => {
    assert.equal(userSettingsPath({ AUTOPILOT_SETTINGS: '/x/s.json' }, '/h'), '/x/s.json');
    assert.equal(userSettingsPath({ XDG_CONFIG_HOME: '/xdg' }, '/h'), path.join('/xdg', 'autopilot', 'settings.json'));
    assert.equal(userSettingsPath({}, '/h'), path.join('/h', '.config', 'autopilot', 'settings.json'));
});

test('loadSettings: 開発者 settings.json を上書き適用、壊れた JSON はスキップ', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-settings-'));
    const userFile = path.join(tmp, 'settings.json');
    fs.writeFileSync(userFile, JSON.stringify({ phases: { implement: { model: 'sonnet' } } }));
    const s = loadSettings({ repoRoot: tmp, env: { AUTOPILOT_SETTINGS: userFile }, homedir: tmp });
    assert.equal(phaseSettings(s, 'implement').model, 'sonnet');
    // 壊れた JSON は既定へフォールバック（throw しない）
    fs.writeFileSync(userFile, '{broken');
    const s2 = loadSettings({ repoRoot: tmp, env: { AUTOPILOT_SETTINGS: userFile }, homedir: tmp });
    assert.equal(phaseSettings(s2, 'implement').model, 'opus');
    fs.rmSync(tmp, { recursive: true, force: true });
});

test('snapshotRunAssets: プロンプト一式と解決済み settings をコピーする', () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-snap-'));
    const snap = snapshotRunAssets({ repoRoot, settings: DEFAULT_SETTINGS, tmpdir: tmp });
    assert.ok(fs.existsSync(path.join(snap.promptDir, 'autopilot-triage.md')));
    assert.ok(fs.existsSync(path.join(snap.dir, 'settings.resolved.json')));
    // スナップショットは元ディレクトリから独立（コピーであって symlink ではない）
    assert.ok(!fs.lstatSync(snap.promptDir).isSymbolicLink());
    fs.rmSync(tmp, { recursive: true, force: true });
});
