'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { MONITOR_HTML } = require('../src/monitor');

test('MONITOR_HTML is a self-contained html document', () => {
    assert.match(MONITOR_HTML, /^<!doctype html>/i);
    assert.match(MONITOR_HTML, /<title>autopilot monitor<\/title>/);
    // 外部リソースを読み込まない（自己完結）。data URI は自己完結なので許可する
    // （favicon をインライン SVG data URI で埋め込むため）。
    assert.doesNotMatch(MONITOR_HTML, /<script[^>]+src=/);
    assert.doesNotMatch(MONITOR_HTML, /<link[^>]+href=["'](?!data:)/);
});

test('MONITOR_HTML: ブランディング（favicon / ヘッダーグラデ / インライン SVG アイコン）#904', () => {
    // (a) インライン SVG data URI の favicon（外部リクエスト禁止＝自己完結を維持）
    assert.match(MONITOR_HTML, /<link\s+rel="icon"\s+href="data:image\/svg\+xml,/);
    // (b) ヘッダー背景に紺→深紅グラデ
    assert.match(MONITOR_HTML, /header \{[^}]*background:[^;}]*linear-gradient/);
    // (c) <h1> にインライン SVG アイコン（🤖 絵文字を置き換え）
    assert.match(MONITOR_HTML, /<h1>\s*<svg[\s\S]*?<\/svg>\s*autopilot<\/h1>/);
    assert.doesNotMatch(MONITOR_HTML, /<h1>🤖 autopilot<\/h1>/);
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

test('MONITOR_HTML: Awaiting Continuation は専用バッジ + 残タスク数を表示（#913）', () => {
    // 専用の描画ヘルパーと CSS バッジクラスがある
    assert.match(MONITOR_HTML, /const aiStatusCell = /);
    assert.ok(MONITOR_HTML.includes('ai-continuation-badge'), 'should include ai-continuation-badge class');
    assert.match(MONITOR_HTML, /\.ai-continuation-badge \{[^}]*background:\s*#ede9fe/);
    // renderBoard の AI 列が aiStatusCell を呼ぶ（他 AI Status はプレーンテキストのまま）
    assert.match(MONITOR_HTML, /aiStatusCell\(it\)/);
    // continuation ファイルの残タスク数（continuationRemaining）を subtext で出す
    assert.match(MONITOR_HTML, /it\.continuationRemaining/);
    assert.match(MONITOR_HTML, /残\s*'\s*\+\s*remaining/);
    // 未設定（他フェーズ）は既存どおり muted の「—」にフォールバック
    assert.match(MONITOR_HTML, /const aiStatusCell = \(it\) => \{\s*if \(!it\.aiStatus\) return '<span class="muted">—<\/span>';/);
});

test('resetLabel: resetsAt（秒 epoch）を JST 表示に整形する（#935 実データ）', () => {
    const m = MONITOR_HTML.match(/function resetLabel\(resetsAt\) \{[\s\S]*?\n\}/);
    assert.ok(m, 'resetLabel function exists');
    // eslint-disable-next-line no-new-func
    const resetLabel = new Function(m[0] + '; return resetLabel;')();
    assert.equal(resetLabel(1783604400), '7/9(木) 22:40 JST');
    assert.equal(resetLabel(1783778400), '7/11(土) 23:00 JST');
    // ms epoch（13桁）も吸収する
    assert.equal(resetLabel(1783604400000), '7/9(木) 22:40 JST');
    // 無効値・null は空文字（title に「リセット」を出さない）
    assert.equal(resetLabel(null), '');
    assert.equal(resetLabel(undefined), '');
    assert.equal(resetLabel(NaN), '');
    assert.equal(resetLabel(0), '');
    assert.equal(resetLabel('not-a-number'), '');
});

test('MONITOR_HTML: 使用率バーのホバーに制限リセット期限(JST)を表示（#935）', () => {
    // usageBar が resetsAt を使って title にリセット期限を足す
    assert.match(MONITOR_HTML, /function usageBar/);
    assert.match(MONITOR_HTML, /w\.resetsAt/);
    assert.match(MONITOR_HTML, /リセット /);
    // バー本体（.ubar）と % テキスト（.upct）の両方に同じ title を付与する
    const src = MONITOR_HTML.match(/function usageBar\([\s\S]*?\n\}/)[0];
    const titleAttrs = src.match(/title="/g) || [];
    assert.ok(titleAttrs.length >= 2, 'ubar と upct の両方に title を付与する');
    // resetsAt が無い/無効なウィンドウでは既存の「—」表示を壊さない
    assert.match(MONITOR_HTML, /class="umuted"/);
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

test('MONITOR_HTML: 俯瞰ボードは狭幅で列を間引く（#936）', () => {
    // #board を overflow-x: auto のコンテナで包む（保険のフォールバック）
    assert.match(MONITOR_HTML, /overflow-x:\s*auto/);
    // 狭幅メディアクエリ（推奨 820px）で Size(3) / 担当(5) 列を隠す
    const media = MONITOR_HTML.match(/@media \(max-width: 820px\) \{([\s\S]*?)\n  \}/);
    assert.ok(media, '@media (max-width: 820px) ブロックが存在する');
    const body = media[1];
    assert.match(body, /#board th:nth-child\(3\),\s*#board td:nth-child\(3\)\s*\{[^}]*display:\s*none/);
    assert.match(body, /#board th:nth-child\(5\),\s*#board td:nth-child\(5\)\s*\{[^}]*display:\s*none/);
    // Sub-issues 列（7）はバーと % を隠す（件数のみ残す）
    assert.match(body, /#board td:nth-child\(7\)\s+\.bar[^{]*\{[^}]*display:\s*none/);
    assert.match(body, /\.sub-pct\s*\{[^}]*display:\s*none/);
    // Now 列（8）は subtext（「人間の番」や経過分）を隠す（アイコン/phase-pill/log は残す）
    assert.match(body, /#board td:nth-child\(8\)\s+\.subtext\s*\{[^}]*display:\s*none/);
});

test('MONITOR_HTML: Sub-issues セルは件数 (.sub-count) と %（.sub-pct）を別 span に分割する（#936）', () => {
    // render 側で件数と % を分割する（狭幅 CSS が .sub-pct だけ隠せるように）
    assert.match(MONITOR_HTML, /class="sub-count"/);
    assert.match(MONITOR_HTML, /class="sub-pct"/);
});

test('MONITOR_HTML: 担当列にオーナー（駆動者）を明示し、非オーナー行は観察中マーカーを出す（#938）', () => {
    // /board の assignee（自分の login）を保持する
    assert.match(MONITOR_HTML, /const myAssignee = d\.assignee/);
    // オーナー（it.owner と一致する assignee）は太字で明示
    assert.match(MONITOR_HTML, /a === it\.owner/);
    // 自分がオーナーでない行には 👁 + オーナー login のマーカーを付ける
    assert.match(MONITOR_HTML, /it\.owner !== myAssignee/);
    assert.ok(MONITOR_HTML.includes('👁'), 'should include the observing marker emoji');
});
