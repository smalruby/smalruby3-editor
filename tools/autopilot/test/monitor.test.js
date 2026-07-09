'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { MONITOR_HTML } = require('../src/monitor');

test('MONITOR_HTML is a self-contained html document', () => {
    assert.match(MONITOR_HTML, /^<!doctype html>/i);
    assert.match(MONITOR_HTML, /<title>autopilot monitor<\/title>/);
    // 外部リソースを読み込まない（自己完結）
    assert.doesNotMatch(MONITOR_HTML, /<script[^>]+src=/);
    assert.doesNotMatch(MONITOR_HTML, /<link[^>]+href=/);
});

test('MONITOR_HTML wires the daemon control endpoints', () => {
    for (const ep of ['/board', '/pause', '/resume', '/log?issue=', '/tick']) {
        assert.ok(MONITOR_HTML.includes(ep), `should reference ${ep}`);
    }
});

test('MONITOR_HTML exposes a "poll now" (即時 tick) control', () => {
    assert.match(MONITOR_HTML, /id="ticknow"/);
    assert.match(MONITOR_HTML, /\/tick['"],\s*\{\s*method:\s*'POST'/);
});

test('MONITOR_HTML: 俯瞰ボード構造（first view はボード、履歴は最下部、log はモーダル）', () => {
    // 俯瞰ボード（縦並びテーブル）+ 実行履歴 + log モーダル
    assert.match(MONITOR_HTML, /id="board"/);
    assert.match(MONITOR_HTML, /id="hist"/);
    assert.match(MONITOR_HTML, /id="modal"/);
    // ボードがモーダル・履歴より前（first view）にある
    const iBoard = MONITOR_HTML.indexOf('id="board"');
    const iHist = MONITOR_HTML.indexOf('実行履歴');
    assert.ok(iBoard < iHist, 'board must render before history');
    // PR chips（draft/ready/merged/closed の色分け）と sub-issue バー
    for (const cls of ['pr-draft', 'pr-ready', 'pr-merged', 'pr-closed', 'class="bar"']) {
        assert.ok(MONITOR_HTML.includes(cls), `should include ${cls}`);
    }
});

test('MONITOR_HTML: ヘッダー 3 分割 — 更新ボタンは操作群、meta は固定幅右セクション（ジッター解消）', () => {
    // 左グループ（状態 + 操作 + 🔄 更新）/ 中央 usage / 右 meta の 3 セクション。
    const iTick = MONITOR_HTML.indexOf('id="ticknow"');
    const iRefresh = MONITOR_HTML.indexOf('id="refreshboard"');
    const iMeta = MONITOR_HTML.indexOf('id="meta"');
    assert.ok(iTick > -1 && iRefresh > -1 && iMeta > -1, 'ticknow / refreshboard / meta が存在する');
    // 🔄 更新は操作群（⚡ tick の隣）に入り、右端の meta より前（左）にある
    assert.ok(iTick < iRefresh, '🔄 更新は ⚡ tick の後（操作群の中）にある');
    assert.ok(iRefresh < iMeta, '🔄 更新は meta より前（左グループ）にある');
    // 左グループを囲む要素がある
    assert.match(MONITOR_HTML, /class="hgroup hleft"/);
    // 右 meta は固定幅（width or min-width を予約）で右寄せ + tabular-nums →
    // 内容幅が変わっても左端（x）が動かない
    assert.match(MONITOR_HTML, /header \.meta \{[^}]*margin-left: auto/);
    assert.match(MONITOR_HTML, /header \.meta \{[^}]*(?:^|[^-])width:/);
    assert.match(MONITOR_HTML, /header \.meta \{[^}]*text-align: right/);
    assert.match(MONITOR_HTML, /header \.meta \{[^}]*tabular-nums/);
    // 狭い幅では中央 usage を隠して右 meta と重ならないようにする
    assert.match(MONITOR_HTML, /@media[^{]*max-width[^{]*\{[^}]*\.usage[^}]*display: none/);
});

test('MONITOR_HTML: usage に更新からの経過（age）を併記し、据え置き中が分かる（#883）', () => {
    // claudeUsage.updatedAt から経過秒を出す関数がある
    assert.match(MONITOR_HTML, /function usageAge/);
    assert.match(MONITOR_HTML, /u\.updatedAt/);
    // renderUsage が age を描画する
    assert.match(MONITOR_HTML, /usageAge\(/);
    // 一定時間更新が無ければ薄く（stale クラス）表示して据え置きを示す
    assert.match(MONITOR_HTML, /uage stale|stale/);
    assert.match(MONITOR_HTML, /\.uage\b/);
    // age の値は固定幅で予約し桁変化で揺れない
    assert.match(MONITOR_HTML, /\.uageval/);
});

test('MONITOR_HTML: アラート表示と check autopilot ショートカット', () => {
    assert.match(MONITOR_HTML, /check autopilot/);
    assert.match(MONITOR_HTML, /authError/);
    assert.match(MONITOR_HTML, /Blocked/);
});

test('MONITOR_HTML: log モーダルを開いている間 10 秒ごとに自動更新し、閉じると止める', () => {
    // openLog で 10 秒間隔の自動ポーリングを開始する
    assert.match(MONITOR_HTML, /setInterval\(loadLog,\s*10000\)/);
    // interval を保持する変数を持つ
    assert.match(MONITOR_HTML, /let logTimer = null/);
    // closeModal で interval をクリアする（リーク・多重化防止）
    assert.match(MONITOR_HTML, /clearInterval\(logTimer\)/);
    // 自動更新でも叩くのは /log のみ（新規 API を増やさない）
    const autoFetches = MONITOR_HTML.match(/fetch\('\/log\?issue='/g) || [];
    assert.ok(autoFetches.length >= 1, 'loadLog must fetch /log');
});

test('MONITOR_HTML: ボードに Size（S/M/L・色付き）列を表示（#884）', () => {
    // <thead> に Size 列見出しがある
    assert.match(MONITOR_HTML, /<th>Size<\/th>/);
    // small/middle/large を S/M/L に短縮する sizeBadge ヘルパー
    assert.match(MONITOR_HTML, /const sizeBadge = /);
    assert.match(MONITOR_HTML, /small:\s*\['S'/);
    assert.match(MONITOR_HTML, /middle:\s*\['M'/);
    assert.match(MONITOR_HTML, /large:\s*\['L'/);
    // 色分けクラス（S=緑 / M=黄 / L=赤）が CSS に定義される
    for (const cls of ['size-badge', 'size-s', 'size-m', 'size-l']) {
        assert.ok(MONITOR_HTML.includes(cls), `should include ${cls}`);
    }
    // S=緑系 / M=琥珀系 / L=赤系の配色
    assert.match(MONITOR_HTML, /\.size-s \{[^}]*#dcfce7/);
    assert.match(MONITOR_HTML, /\.size-m \{[^}]*#fef3c7/);
    assert.match(MONITOR_HTML, /\.size-l \{[^}]*#fee2e2/);
    // renderBoard が sizeBadge を呼ぶ
    assert.match(MONITOR_HTML, /sizeBadge\(it\.size\)/);
    // size 未設定は「—」（muted）で崩れない
    assert.match(MONITOR_HTML, /class="muted"/);
    // 列追加に合わせて空行の colspan を更新（7 → 8）
    assert.match(MONITOR_HTML, /colspan="8"/);
    assert.doesNotMatch(MONITOR_HTML, /colspan="7"/);
});

test('MONITOR_HTML: インライン script が構文的に妥当', () => {
    const m = MONITOR_HTML.match(/<script>([\s\S]*)<\/script>/);
    assert.ok(m, 'script block exists');
    // DOM は無い環境なので Function コンストラクタで構文チェックのみ行う
    assert.doesNotThrow(() => new Function(m[1]));
});

test('MONITOR_HTML: ヘッダー中央に Claude 使用量表示（#879）', () => {
    // ヘッダーに #usage 要素があり、中央寄せ（absolute + translateX(-50%)）される
    assert.match(MONITOR_HTML, /id="usage"/);
    assert.match(MONITOR_HTML, /\.usage \{[^}]*left: 50%/);
    assert.match(MONITOR_HTML, /\.usage \{[^}]*translateX\(-50%\)/);
    // Claude アイコンはインライン SVG（外部リソース禁止）
    assert.match(MONITOR_HTML, /USAGE_ICON\s*=\s*'<svg/);
    assert.match(MONITOR_HTML, /aria-label="Claude"/);
    assert.doesNotMatch(MONITOR_HTML, /<img[^>]+src=/);
    // session/weekly の 2 本のバー + renderUsage が /board の claudeUsage を読む
    assert.match(MONITOR_HTML, /function usageBar/);
    assert.match(MONITOR_HTML, /function renderUsage/);
    assert.match(MONITOR_HTML, /d\.claudeUsage/);
    assert.match(MONITOR_HTML, /renderUsage\(d\)/);
    // 残量僅少（>= 80%）で警告色
    assert.match(MONITOR_HTML, /pct >= 80/);
    // データ欠如時は「—」でレイアウトを崩さない
    assert.match(MONITOR_HTML, /class="umuted"/);
});
