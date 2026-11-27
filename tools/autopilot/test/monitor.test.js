'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { MONITOR_HTML } = require('../src/monitor');
const { ICON_FAVICON_64, ICON_HEADING_40 } = require('../src/icon-data');

test('MONITOR_HTML is a self-contained html document', () => {
    assert.match(MONITOR_HTML, /^<!doctype html>/i);
    assert.match(MONITOR_HTML, /<title>autopilot monitor<\/title>/);
    // 外部リソースを読み込まない（自己完結）。data URI は自己完結なので許可する
    // （favicon とアイコンを PNG の data URI で埋め込むため）。
    assert.doesNotMatch(MONITOR_HTML, /<script[^>]+src=/);
    assert.doesNotMatch(MONITOR_HTML, /<link[^>]+href=["'](?!data:)/);
});

test('MONITOR_HTML: ブランディング（虹色の ∞ + A のアイコン #2413）・上の行は表と同じ地（#2404）', () => {
    // (a) favicon は PNG の data URI（外部リクエスト禁止＝自己完結を維持）。64px の版を使う
    assert.match(ICON_FAVICON_64, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    assert.ok(MONITOR_HTML.includes(`<link rel="icon" type="image/png" href="${ICON_FAVICON_64}">`));
    // (b) <h1> のアイコンは、20px 表示の 2 倍に縮めた 40px の版（小さく出しても ∞ と A がつぶれない）
    assert.match(ICON_HEADING_40, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    assert.ok(MONITOR_HTML.includes(
        `<h1><img class="logo" src="${ICON_HEADING_40}" width="20" height="20" alt="">autopilot</h1>`));
    // 旧アイコン（赤い丸に水色のひし形）は残さない
    assert.doesNotMatch(MONITOR_HTML, /%237a1620|#7a1620/);
    assert.doesNotMatch(MONITOR_HTML, /<h1>🤖 autopilot<\/h1>/);
    // (c) 上の行は暗い帯（グラデーション）にせず、表と同じ地の panel にする（design-system.md §3）
    assert.match(MONITOR_HTML, /<header class="panel topline"/);
    assert.doesNotMatch(MONITOR_HTML, /linear-gradient\(100deg/);
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

test('MONITOR_HTML: 並べ方 D — 左に「あなた宛て」、右に状況板、実行履歴とタスクは横の欄（#2404）', () => {
    for (const id of ['sec-inbox', 'sec-board', 'board', 'hist', 'modal', 'drawer', 'viewtabs', 'inbox-q', 'inbox-learn', 'inbox-wait']) {
        assert.match(MONITOR_HTML, new RegExp(`id="${id}"`), id);
    }
    // あなた宛てが状況板より先（左）。実行履歴は横の欄（drawer）の中
    assert.ok(MONITOR_HTML.indexOf('id="sec-inbox"') < MONITOR_HTML.indexOf('id="sec-board"'));
    assert.ok(MONITOR_HTML.indexOf('id="drawer"') < MONITOR_HTML.indexOf('id="hist"'));
    // 件数バッジ（実行履歴 N・タスク N）は上の行にあり、押すと横の欄を開く
    assert.match(MONITOR_HTML, /data-drawer="hist" data-testid="badge-history"/);
    assert.match(MONITOR_HTML, /data-drawer="tasks" id="badge-tasks" data-testid="badge-tasks"/);
    // 学び・タスクの欄と止まっている worker の欄を埋め込む（どちらも別ファイルの部品）
    assert.ok(MONITOR_HTML.indexOf('id="pane-tasks"') < MONITOR_HTML.indexOf('data-testid="learn-tasks"'));
    assert.ok(MONITOR_HTML.indexOf('id="sec-inbox"') < MONITOR_HTML.indexOf('data-testid="blocked-panel"'));
    // 幅の広い画面はページをスクロールさせず列の中だけ動かす。900px 未満はタブ
    assert.match(MONITOR_HTML, /@media \(min-width: 900px\) \{[\s\S]*?body \{ height: 100vh; overflow: hidden; \}/);
    assert.match(MONITOR_HTML, /\.stage > section \{ overflow: auto; min-height: 0; \}/);
    assert.match(MONITOR_HTML, /@media \(max-width: 899px\) \{[\s\S]*?\.tabs \{ display: flex;/);
    // PR のコンフリクトの印と sub-issue の棒
    for (const cls of ['pr-conflict', 'class="bar"']) {
        assert.ok(MONITOR_HTML.includes(cls), `should include ${cls}`);
    }
});

test('MONITOR_HTML: 上の 1 行 — 更新・tick・現在地を作るは ⋯ の中（#2404）', () => {
    const iMenuBtn = MONITOR_HTML.indexOf('id="globalmenubtn"');
    const iMenu = MONITOR_HTML.indexOf('id="globalmenu"');
    for (const id of ['refreshboard', 'ticknow', 'csmake']) {
        const i = MONITOR_HTML.indexOf(`id="${id}"`);
        assert.ok(i > iMenu, `${id} は ⋯ のメニューの中`);
    }
    assert.ok(iMenuBtn > -1 && iMenuBtn < iMenu);
    assert.match(MONITOR_HTML, /fetch\('\/refresh', \{ method: 'POST' \}\)/);
    assert.match(MONITOR_HTML, /fetch\('\/current-status', \{ method: 'POST' \}\)/);
    // 一時停止 / 再開はどちらか 1 つだけ見せる
    assert.match(MONITOR_HTML, /getElementById\('pause'\)\.hidden = Boolean\(d\.paused\)/);
    assert.match(MONITOR_HTML, /getElementById\('resume'\)\.hidden = !d\.paused/);
    // 名前の付いた計り（Claude・GitHub API）と worker の数
    assert.match(MONITOR_HTML, /<span class="svcname">Claude<\/span>/);
    assert.match(MONITOR_HTML, /<span class="svcname">GitHub API<\/span>/);
    assert.match(MONITOR_HTML, /<span class="svcname">worker<\/span>/);
    // [hidden] は .ibtn の display より強くする（一時停止と再開が両方出ない）
    assert.match(MONITOR_HTML, /\[hidden\] \{ display: none !important; \}/);
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

test('MONITOR_HTML: 状況板の行に Size（S/M/L）を出す（#884）', () => {
    assert.match(MONITOR_HTML, /const sizeBadge = /);
    assert.match(MONITOR_HTML, /small:\s*\['S'/);
    assert.match(MONITOR_HTML, /middle:\s*\['M'/);
    assert.match(MONITOR_HTML, /large:\s*\['L'/);
    for (const cls of ['size-badge', 'size-s', 'size-m', 'size-l']) {
        assert.ok(MONITOR_HTML.includes(cls), `should include ${cls}`);
    }
    // Size は状態ではないので意味の色を使わない（トークンは灰色の濃さの別名・design-system.md §3）
    assert.match(MONITOR_HTML, /\.size-s \{[^}]*var\(--ap-size-s-wash\)/);
    assert.match(MONITOR_HTML, /\.size-l \{[^}]*var\(--ap-size-l-wash\)/);
    assert.match(MONITOR_HTML, /sizeBadge\(it\.size\)/);
    // 状況板の列（Issue · PR・題名・優先・状態・次の動き・時刻・進み・人間待ち）と空の行の colspan（#2471）
    assert.match(MONITOR_HTML, /<th><\/th><th>Issue · PR<\/th><th>題名<\/th><th>優先<\/th><th>状態<\/th><th>次の動き<\/th><th>時刻<\/th><th>進み<\/th><th>人間待ち<\/th><th><\/th>/);
    assert.match(MONITOR_HTML, /colspan="10"/);
});

test('MONITOR_HTML: Awaiting Continuation は専用バッジ + 残タスク数を表示（#913）', () => {
    // 専用の描画ヘルパーと CSS バッジクラスがある
    assert.match(MONITOR_HTML, /const aiStatusCell = /);
    assert.ok(MONITOR_HTML.includes('ai-continuation-badge'), 'should include ai-continuation-badge class');
    assert.match(MONITOR_HTML, /\.ai-continuation-badge \{[^}]*background:\s*var\(--ap-human-wash\)/);
    assert.match(MONITOR_HTML, /--ap-human-wash:#ebe7fa;/);
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

test('MONITOR_HTML: 上の行に Claude の使用量（名前・アイコン・細い棒）（#879 / #2404）', () => {
    assert.match(MONITOR_HTML, /id="usage"/);
    // Claude アイコンはインライン SVG（外部リソース禁止・ロゴではない）
    assert.match(MONITOR_HTML, /USAGE_ICON\s*=\s*'<svg/);
    assert.match(MONITOR_HTML, /aria-label="Claude"/);
    // 外部の画像を読まない（見出しのアイコンは data URI の PNG なので許す・#2413）
    assert.doesNotMatch(MONITOR_HTML, /<img[^>]+src=["'](?!data:)/);
    assert.match(MONITOR_HTML, /function usageBar/);
    assert.match(MONITOR_HTML, /function renderUsage/);
    assert.match(MONITOR_HTML, /d\.claudeUsage/);
    assert.match(MONITOR_HTML, /renderUsage\(d\)/);
    // 残量僅少（>= 80%）で注意の色。ふだんは灰色（design-system.md §6）
    assert.match(MONITOR_HTML, /pct >= 80/);
    assert.match(MONITOR_HTML, /\.usage \.ubar > span \{[^}]*var\(--ap-usage-ok\)/);
    assert.match(MONITOR_HTML, /\.usage \.ubar > span\.warn \{[^}]*var\(--ap-usage-warn\)/);
    assert.match(MONITOR_HTML, /class="umuted"/);
    // GitHub API の残りも同じ形で出す
    assert.match(MONITOR_HTML, /function renderRate\(d\)/);
    assert.match(MONITOR_HTML, /minRemaining/);
});

test('MONITOR_HTML: 状況板の表は列の中で横にスクロールし、ページを横にはみ出さない（#936 / #2404）', () => {
    assert.match(MONITOR_HTML, /\.tbl-wrap \{ overflow-x: auto; \}/);
    assert.match(MONITOR_HTML, /#board \{ border-collapse: collapse; width: 100%; min-width: \d+px;/);
    // ▲▼ は行に乗せたときだけ見せる（場所は取っておき、列を動かさない・#2471）
    assert.match(MONITOR_HTML, /#board tr:hover \.prio button, #board tr:focus-within \.prio button \{ visibility: visible; \}/);
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

test('MONITOR_HTML: 使用量アイコンはクリック/キーボードで開閉するポップオーバーのトリガー（#996）', () => {
    assert.match(MONITOR_HTML, /class="uicon[^"]*"[^>]*role="button"/);
    assert.match(MONITOR_HTML, /class="uicon[^"]*"[^>]*tabindex="0"/);
    assert.match(MONITOR_HTML, /class="uicon[^"]*"[^>]*aria-expanded=/);
    assert.match(MONITOR_HTML, /class="uicon[^"]*"[^>]*aria-haspopup=/);
    assert.match(MONITOR_HTML, /aria-label="Claude"/);
    assert.match(MONITOR_HTML, /\.usage \.uicon \{[^}]*cursor:\s*pointer/);
});

test('MONITOR_HTML: 使用量ポップオーバーは fixed 配置で header の overflow:hidden に切られない（#996）', () => {
    // #usagepop 要素があり dialog ロール + ラベルを持つ
    assert.match(MONITOR_HTML, /id="usagepop"/);
    assert.match(MONITOR_HTML, /id="usagepop"[^>]*role="dialog"/);
    assert.match(MONITOR_HTML, /id="usagepop"[^>]*aria-label=/);
    // header は overflow:hidden なので fixed 配置し JS で位置を決める（切り取られない）
    assert.match(MONITOR_HTML, /\.usagepop \{[^}]*position:\s*fixed/);
    // 開いている時だけ表示（.open）
    assert.match(MONITOR_HTML, /\.usagepop \{[^}]*display:\s*none/);
    assert.match(MONITOR_HTML, /\.usagepop\.open \{[^}]*display:\s*block/);
    // ヘッダー(10)より上・log モーダル(50)より下の z-index
    assert.match(MONITOR_HTML, /\.usagepop \{[^}]*z-index:\s*40/);
});

test('MONITOR_HTML: 使用量ポップオーバーの開閉ロジック（トグル / 外側クリック / Esc / 委譲）（#996）', () => {
    // 開閉・配置関数
    assert.match(MONITOR_HTML, /function openUsagePop/);
    assert.match(MONITOR_HTML, /function closeUsagePop/);
    assert.match(MONITOR_HTML, /function toggleUsagePop/);
    assert.match(MONITOR_HTML, /function positionUsagePop/);
    // 開閉状態を保持する
    assert.match(MONITOR_HTML, /let usagePopOpen = false/);
    // アイコンは refresh のたび innerHTML で再生成されるのでイベント委譲で拾う
    assert.match(MONITOR_HTML, /getElementById\('usage'\)\.addEventListener\('click'/);
    assert.match(MONITOR_HTML, /getElementById\('usage'\)\.addEventListener\('keydown'/);
    // Enter / Space で開閉（キーボード操作）
    assert.match(MONITOR_HTML, /e\.key === 'Enter'/);
    // 外側クリックで閉じる（document への委譲）
    assert.match(MONITOR_HTML, /closeUsagePop\(\)/);
    // Esc は既存の keydown ハンドラで closeModal と同列に閉じる
    assert.match(MONITOR_HTML, /Escape[\s\S]*?closeUsagePop\(\)/);
});

test('MONITOR_HTML: renderUsage がポップオーバー本文を更新し aria-expanded を同期する（#996）', () => {
    // renderUsage が usagepopbody を描画する（新規のデータ取得はしない = claudeUsage を再利用）
    assert.match(MONITOR_HTML, /getElementById\('usagepopbody'\)/);
    assert.match(MONITOR_HTML, /renderUsagePop\(/);
    // アイコン再描画後に aria-expanded を現在の開閉状態へ同期する
    assert.match(MONITOR_HTML, /setAttribute\('aria-expanded'/);
});

test('renderUsagePop: セッション/週間の % とリセット日時を出し、未取得は崩さず表示（#996）', () => {
    const escM = MONITOR_HTML.match(/const esc = [\s\S]*?;\n/);
    const resetM = MONITOR_HTML.match(/function resetLabel\(resetsAt\) \{[\s\S]*?\n\}/);
    const rowM = MONITOR_HTML.match(/function usagePopRow\([\s\S]*?\n\}/);
    const popM = MONITOR_HTML.match(/function renderUsagePop\([\s\S]*?\n\}/);
    assert.ok(escM && resetM && rowM && popM, 'esc / resetLabel / usagePopRow / renderUsagePop が抽出できる');
    // eslint-disable-next-line no-new-func
    const renderUsagePop = new Function(
        escM[0] + resetM[0] + rowM[0] + popM[0] + '; return renderUsagePop;',
    )();
    const html = renderUsagePop({
        session: { percent: 39, resetsAt: 1783604400 },
        weekly: { percent: null, resetsAt: 1783778400 },
    });
    // セッション: % + リセット日時（JST）
    assert.match(html, /現在のセッション/);
    assert.match(html, /39%/);
    assert.match(html, /7\/9\(木\) 22:40 JST/);
    // 週間: percent が null のときは「未取得」でレイアウトを崩さない（リセット日時は出せる）
    assert.match(html, /週間制限/);
    assert.match(html, /未取得/);
    assert.match(html, /7\/11\(土\) 23:00 JST/);
    // usage 全体が空（claudeUsage 無し）でも例外を投げない
    assert.doesNotThrow(() => renderUsagePop(undefined));
    assert.doesNotThrow(() => renderUsagePop({}));
});

test('MONITOR_HTML: 💤 あとでやる はチップで絞り込み、行の ⋯ で 💤 あとで / ↩ 今やる（#1190 / #2404）', () => {
    // 絞り込みのチップ（すべて / 人間の番 / AI が作業中 / 止まった / 💤 あとで）
    assert.match(MONITOR_HTML, /\['later', '💤 あとで'\]/);
    assert.match(MONITOR_HTML, /'autopilot:boardFilter'/);
    assert.match(MONITOR_HTML, /try \{ localStorage\.setItem\(BOARD_FILTER_KEY/);
    // POST /later を叩く（JSON body）。送信中は押せない（二重送信防止）
    assert.match(MONITOR_HTML, /fetch\('\/later', \{ method: 'POST'/);
    assert.ok(MONITOR_HTML.includes("label: '💤 あとで'"));
    assert.ok(MONITOR_HTML.includes("label: '↩ 今やる'"));
    assert.match(MONITOR_HTML, /label: '⏳ 処理中', disabled: true/);
});

test('MONITOR_HTML: 判断ロジックは phases.js の純粋関数を埋め込んで共有する（二重定義しない）', () => {
    const phases = require('../src/phases');
    for (const name of ['canToggleLater', 'effectiveLater', 'splitLaterBoard', 'laterPendingReducer']) {
        assert.ok(MONITOR_HTML.includes(String(phases[name])), `${name} should be embedded verbatim`);
    }
});

test('MONITOR_HTML: インライン script が構文として妥当（埋め込み後も壊れない）', () => {
    const m = MONITOR_HTML.match(/<script>([\s\S]*)<\/script>/);
    assert.ok(m);
    // 構文チェックのみ（実行はしない）
    assert.doesNotThrow(() => new Function(m[1]));
});

test('MONITOR_HTML: Claude 使用量の自動 pause — USAGE ⏸ ピルと 2 段階の強制再開（#1193）', () => {
    assert.ok(MONITOR_HTML.includes("pausedBy === 'usage'"));
    assert.ok(MONITOR_HTML.includes('USAGE ⏸'));
    assert.ok(MONITOR_HTML.includes('/force-resume'));
    for (const id of ['usage-pause-alert', 'usage-force-resume', 'usage-force-confirm', 'usage-force-cancel', 'usage-forced-alert']) {
        assert.ok(MONITOR_HTML.includes(`data-testid="${id}"`), id);
    }
    assert.ok(MONITOR_HTML.includes('強制実行中'));
    // ブラウザの confirm ダイアログは使わない（その場でボタンを置き換える）
    assert.doesNotMatch(MONITOR_HTML, /\bconfirm\(/);
});

test('MONITOR_HTML: PR は open だけ並べ、merged/closed は ▼ メニュー（#1212）', () => {
    assert.match(MONITOR_HTML, /function splitPrsForTitle\(prs\)/);
    assert.match(MONITOR_HTML, /splitPrsForTitle\(it\.prs\)/);
    // チップの文字は PR#N（Issue 番号と区別する）
    assert.match(MONITOR_HTML, /'PR#' \+ p\.number/);
    assert.match(MONITOR_HTML, /class="prmenu-btn"/);
    assert.match(MONITOR_HTML, /id="prmenu"/);
    assert.match(MONITOR_HTML, /function openPrMenu\(/);
    assert.match(MONITOR_HTML, /function closePrMenu\(/);
    assert.match(MONITOR_HTML, /let prMenuIssue = null/);
    assert.match(MONITOR_HTML, /restorePrMenu\(\)/);
    assert.match(MONITOR_HTML, /if \(html !== prMenuHtml\)/);
    assert.match(MONITOR_HTML, /closePrMenu\(\); closeMenus\(\)/);
});

test('MONITOR_HTML: 行の ⋯ の「Issue と PR をコピー」（#1213）と #番号のリンク（#2404）', () => {
    assert.match(MONITOR_HTML, /function issueCopyText\(item, repoUrl\)/);
    assert.match(MONITOR_HTML, /if \(!await copyText\(issueCopyText\(it, repoUrl\)\)\) return;/);
    assert.match(MONITOR_HTML, /label: '📋 Issue と PR をコピー', act: \(\) => copyIssue\(issue\)/);
    assert.match(MONITOR_HTML, /async function copyText\(t\) \{ try \{ await navigator\.clipboard\.writeText\(t\); return true; \}/);
    // 光らせる演出は 5 秒ごとの再描画をまたいで経過時間から続ける（最初からやり直さない）
    assert.match(MONITOR_HTML, /@keyframes copied-flash/);
    assert.match(MONITOR_HTML, /--flash-delay:-' \+ elapsed \+ 'ms/);
    assert.match(MONITOR_HTML, /animation-delay: var\(--flash-delay, 0ms\)/);
    assert.match(MONITOR_HTML, /data-issue="' \+ it\.issue \+ '"/);
    // 「開く」ボタンは置かず、#番号を GitHub へのリンクにする
    assert.match(MONITOR_HTML, /const ilink = /);
    assert.doesNotMatch(MONITOR_HTML, />開く<\/button>/);
});

test('MONITOR_HTML: 起動待ちは「SSO ログインが必要」と出し、再接続ボタンで起動まで進める（#1510）', () => {
    assert.match(MONITOR_HTML, /d\.booting/);
    assert.match(MONITOR_HTML, /SSO ログインが必要です（autopilot は起動待ち）/);
    assert.match(MONITOR_HTML, /SSO 待ち/);
    assert.match(MONITOR_HTML, /id="reauthbtn"/);
    // 起動中（Project 情報の取得中）と、SSO 以外の原因で起動待ちのときの表示
    assert.match(MONITOR_HTML, /notice === 'starting'/);
    assert.match(MONITOR_HTML, /boot-not-sso/);
    // 起動待ちの間は daemon が断る操作のボタンを止める
    assert.match(MONITOR_HTML, /b\.disabled = !!d\.booting/);
});

test('monitorHtmlWithToken: 合言葉を meta に埋め、書き込みの fetch にヘッダを付ける（EPIC #2384 U3）', () => {
    const { monitorHtmlWithToken } = require('../src/monitor');
    // 素の HTML の meta は空（合言葉はリポジトリに持たない）
    assert.match(MONITOR_HTML, /<meta name="autopilot-token" content="">/);
    const html = monitorHtmlWithToken('f'.repeat(64));
    assert.ok(html.includes(`<meta name="autopilot-token" content="${'f'.repeat(64)}">`));
    assert.ok(!html.includes('<meta name="autopilot-token" content="">'));
    // fetch の包みは script の先頭（どの fetch の呼び出しよりも前）に置く
    const script = html.slice(html.indexOf('<script>'));
    assert.ok(script.indexOf('X-Autopilot-Token') >= 0);
    assert.ok(script.indexOf('X-Autopilot-Token') < script.indexOf("fetch('/"));
    // 合言葉に HTML を壊す文字は通さない
    assert.throws(() => monitorHtmlWithToken('"><script>'), /token/);
});

test('monitor の fetch の包み: 合言葉が古い 403 なら、ページから読み直して 1 回だけやり直す（daemon の再起動をまたいだページ）', async () => {
    const { monitorHtmlWithToken } = require('../src/monitor');
    const html = monitorHtmlWithToken('a'.repeat(64));
    const start = html.indexOf('(() => {\n  const meta = document.querySelector');
    const wrapper = html.slice(start, html.indexOf('})();', start) + 5);
    const fresh = 'b'.repeat(64);
    const sent = [];
    const metaEl = { content: 'a'.repeat(64) };
    const reply = (status, body) => ({
        status, ok: status < 400,
        clone() { return this; },
        json: async () => body,
        text: async () => body,
    });
    const origFetch = async (input, opts = {}) => {
        if (input === '/') return reply(200, `<meta name="autopilot-token" content="${fresh}">`);
        const tok = opts.headers.get('X-Autopilot-Token');
        sent.push(tok);
        return tok === fresh ? reply(200, { ok: true }) : reply(403, { error: 'forbidden: token' });
    };
    const win = { fetch: origFetch };
    const doc = {
        querySelector: () => metaEl,
        createElement: () => ({ remove() {} }),
        getElementById: () => ({ appendChild() {} }),
        body: { appendChild() {} },
    };
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', 'location', 'Headers', 'URL', 'setTimeout', wrapper)(
        win, doc, { href: 'http://localhost:8787/', origin: 'http://localhost:8787' }, Headers, URL, () => {},
    );
    const res = await win.fetch('/delegate?issue=1', { method: 'POST' });
    assert.equal(res.status, 200);
    assert.deepEqual(sent, ['a'.repeat(64), fresh]);
    assert.equal(metaEl.content, fresh);
    // 2 回目からは新しい合言葉をそのまま使う（読み直さない）
    await win.fetch('/pause', { method: 'POST' });
    assert.deepEqual(sent.slice(2), [fresh]);
});

test('MONITOR_HTML: 色は :root の --ap-* トークンで持ち、CSS に 16 進の直書きを残さない（EPIC #2384）', () => {
    const style = MONITOR_HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
    const root = style.match(/:root \{[\s\S]*?\n {2}\}/)[0];
    const defined = new Set([...root.matchAll(/(--ap-[a-z0-9-]+):/g)].map((m) => m[1]));
    // 使っているトークンはすべて :root で定義されている
    for (const [, name] of MONITOR_HTML.matchAll(/var\((--ap-[a-z0-9-]+)\)/g)) {
        assert.ok(defined.has(name), `${name} should be defined in :root`);
    }
    // ダークは OS に従う形と手で固定する形の 2 つ。どちらも :root にある名前だけを差しかえる
    const darkOs = style.match(/@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\) \{[\s\S]*?\} \}/)[0];
    const darkFixed = style.match(/:root\[data-theme="dark"\] \{[\s\S]*?\n {2}\}/)[0];
    for (const block of [darkOs, darkFixed]) {
        for (const [, name] of block.matchAll(/(--ap-[a-z0-9-]+):/g)) {
            assert.ok(defined.has(name), `${name} in the dark block should also be in :root`);
        }
    }
    // トークンの塊とコメントを除いた CSS に色の直書きが無い（学び・タスクの欄も含む）
    const ownCss = style.replace(root, '').replace(darkOs, '').replace(darkFixed, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(ownCss, /#[0-9a-fA-F]{3,6}\b|rgba?\(/);
    // 止まっている worker の欄も色はトークンで持つ
    const { BLOCKED_PANEL_HTML } = require('../src/blocked-panel');
    const blockedCss = BLOCKED_PANEL_HTML.match(/<style>([\s\S]*?)<\/style>/)[1];
    assert.doesNotMatch(blockedCss, /#[0-9a-fA-F]{3,6}\b|rgba?\(/);
});

test('MONITOR_HTML: あなた宛ての操作 — AI に任せる（/delegate）・答える（/answer）・数字キー（#2404）', () => {
    // 「AI に任せる」は人間待ちの行から POST /delegate。失敗は toast に出す
    assert.match(MONITOR_HTML, /postJson\('\/delegate', \{ issue \}\)/);
    assert.match(MONITOR_HTML, /を任せられませんでした: ' \+ e\.message, true/);
    // 質問: 推奨で進める / 選んだ答えで進める / メモだけ保存 は POST /answer
    assert.match(MONITOR_HTML, /postJson\('\/answer', \{ issue, answers, proceed \}\)/);
    for (const id of ['inbox-answer-recommended', 'inbox-answer-chosen', 'inbox-answer-save', 'inbox-action']) {
        assert.ok(MONITOR_HTML.includes(`data-testid="${id}"`), id);
    }
    // 数字キーは monitor-inbox.js の digitTarget で決める（入力欄の中では効かない）
    assert.match(MONITOR_HTML, /function digitTarget\(ev\)/);
    assert.match(MONITOR_HTML, /digitTarget\(\{ code: e\.code, metaKey: e\.metaKey, ctrlKey: e\.ctrlKey, altKey: e\.altKey, inInput \}\)/);
    // 「AI に任せる」の虹色の輪は動きを減らす設定で止める
    assert.match(MONITOR_HTML, /@property --go-angle/);
    assert.match(MONITOR_HTML, /@media \(prefers-reduced-motion: reduce\) \{ \.go, \.pulse \{ animation: none; \} \}/);
});

test('MONITOR_HTML: 「確認の結果を書く」は観点ごとに OK / NG を選び /release-check/review へ送る（#2430）', () => {
    // 「確認の結果を書く」は ⋯ のメニューと、動詞のボタン（act=release）から開く（#2466）
    assert.match(MONITOR_HTML, /wait\.release \? openRelease\(issue\)/);
    assert.match(MONITOR_HTML, /else if \(w\.act === 'release'\) \{ if \(w\.url\) window\.open\(w\.url, '_blank', 'noopener'\); openRelease\(issue\); \}/);
    assert.match(MONITOR_HTML, /fetch\('\/release-check\?issue=' \+ issue\)/);
    assert.match(MONITOR_HTML, /postJson\('\/release-check\/review', \{ issue, round: relRound, results/);
    for (const id of ['release-modal', 'release-points', 'release-note', 'release-send', 'release-cancel']) {
        assert.ok(MONITOR_HTML.includes(`data-testid="${id}"`), id);
    }
    assert.match(MONITOR_HTML, /data-testid="release-send" disabled>/);
    // 観点の本文は自前の整形を通す
    assert.match(MONITOR_HTML, /renderMiniMarkdown\(p\.body\)/);
    // テンプレート文字列の中なので、観点の番号の正規表現は \\d を二重にしないと /^Rd+$/ になり OK / NG が効かない
    assert.ok(MONITOR_HTML.includes('if (!/^R\\d+$/.test(String(id))) return;'));
    // 🙋 ありで入った EPIC（観点のコメントがまだ無い）は、ここから AI に観点をまとめてもらう（/delegate で 🙋 を外す）
    assert.ok(MONITOR_HTML.includes('data-testid="release-collect"'));
    assert.match(MONITOR_HTML, /act === 'rel-collect'\) \{ closeRelease\(\); delegateIssue\(issue, t\)/);
    // OK / NG を選ばずにメモだけ書いた観点は、全体のコメントに入れて送る（捨てない）
    assert.match(MONITOR_HTML, /postJson\('\/release-check\/review', \{ issue, round: relRound, results, comment \}\)/);
    assert.ok(MONITOR_HTML.includes("const comment = [document.getElementById('relnote').value.trim()].concat(loose).filter(Boolean).join('\\n');"));
});

test('MONITOR_HTML: 「AI に直してもらう」は指摘とコメント欄を開き、指示と一緒に /delegate へ送る（#2415）', () => {
    // 差し戻しの行は data-act="fix"（すぐ 🙋 を外さない）
    assert.match(MONITOR_HTML, /wait\.fix \? openFix\(issue\)/);
    // 押したときだけ指摘を取ってくる・markdown は自前の整形（外部ライブラリなし）
    assert.match(MONITOR_HTML, /fetch\('\/delegate\/findings\?issue=' \+ issue\)/);
    assert.match(MONITOR_HTML, /function renderMiniMarkdown\(src\)/);
    assert.match(MONITOR_HTML, /postJson\('\/delegate', \{ issue, instruction: text \}\)/);
    for (const id of ['fix-modal', 'fix-findings', 'fix-note', 'fix-send', 'fix-cancel']) {
        assert.ok(MONITOR_HTML.includes(`data-testid="${id}"`), id);
    }
    // 空のままは送れない（最初は disabled・入力のたびに見直す）
    assert.match(MONITOR_HTML, /data-testid="fix-send" disabled>/);
    assert.match(MONITOR_HTML, /\.disabled = !document\.getElementById\('fixnote'\)\.value\.trim\(\)/);
    // <script> の中に HTML のコメントの始まりを生で書かない
    const script = MONITOR_HTML.slice(MONITOR_HTML.indexOf('<script>'));
    assert.ok(!script.includes('<!--'));
});

test('MONITOR_HTML: 「あなた宛て」の開け閉め — 印のボタン・細い帯・[ キー・localStorage（#2404）', () => {
    // 見出しの切りかえと、閉じたときの帯。どちらも aria-controls で本文を指す
    assert.match(MONITOR_HTML, /id="inboxtoggle" aria-expanded="true" aria-controls="inbox-body"/);
    assert.match(MONITOR_HTML, /id="inbox-rail" aria-expanded="false" aria-controls="inbox-body"/);
    assert.ok(MONITOR_HTML.includes('title="あなた宛てを閉じる ([)"'));
    // 閉じると帯の幅にし、本文を隠す（幅の広い画面だけ）。900px 未満では切りかえを出さない
    assert.match(MONITOR_HTML, /\.stage\.inbox-closed \{ grid-template-columns: var\(--ap-rail-w\) minmax\(0, 1fr\); \}/);
    assert.match(MONITOR_HTML, /\.paneltoggle \{ display: none;/);
    assert.match(MONITOR_HTML, /@media \(prefers-reduced-motion: reduce\) \{ \.stage \{ transition: none; \} \}/);
    // [ は monitor-inbox.js の isInboxToggleKey で決める。状態は localStorage（try/catch）に覚える
    assert.match(MONITOR_HTML, /function isInboxToggleKey\(ev\)/);
    assert.match(MONITOR_HTML, /isInboxToggleKey\(\{ key: e\.key, metaKey: e\.metaKey, ctrlKey: e\.ctrlKey, altKey: e\.altKey, inInput \}\)/);
    assert.match(MONITOR_HTML, /try \{ localStorage\.setItem\(INBOX_OPEN_KEY, String\(inboxOpen\)\); \} catch/);
    // 数字キー 1 は閉じていれば開く
    assert.match(MONITOR_HTML, /if \(target === 'inbox' && !inboxOpen && wideLayout\(\)\) setInboxOpen\(true\);/);
    // 人間待ちは することごとの欄（forYouModel・#2466）。「EPIC に属さない」を行ごとに書かない
    assert.match(MONITOR_HTML, /forYouModel\(Object\.assign\(\{\}, d, \{ items \}\), \{ repoUrl \}\)/);
    assert.ok(!MONITOR_HTML.includes("w.from || 'EPIC に属さない'"));
});

test('MONITOR_HTML: あなた宛ては動詞のボタン → 行の中の確かめ → 行う（#2466）', () => {
    // ボタンを押すと行の中で「これを行います」と確かめ、「行う」で初めて doForYou が動く
    assert.match(MONITOR_HTML, /data-act="fy-ask"/);
    assert.ok(MONITOR_HTML.includes("'<div class=\"fy-confirm\" role=\"status\" data-testid=\"inbox-confirm\"><span>これを行います: '"));
    assert.match(MONITOR_HTML, /if \(act === 'fy-do'\) \{ doForYou\(issue, t\); return; \}/);
    // EPIC にまとめたゴーサインは、子ごとに既存の POST /delegate
    assert.match(MONITOR_HTML, /for \(const n of w\.targets\) await delegateIssue\(n, btn\)/);
    // 「押すと」はいつも出し、状態の一文と「押すと」の #N は別タブのリンクにする
    assert.ok(MONITOR_HTML.includes("'<div class=\"fy-happens\"><b>押すと:</b> ' + lr(w.happens)"));
    assert.ok(MONITOR_HTML.includes("'<div class=\"fy-state\">' + ep + lr(w.state)"));
    // 人間の番ではないものは最後にたたむ
    assert.ok(MONITOR_HTML.includes('data-testid="inbox-idle"'));
    const ha = require('../src/human-action');
    for (const fn of ha.HUMAN_ACTION_CLIENT_FNS) assert.ok(MONITOR_HTML.includes(String(fn)), fn.name);
});

test('MONITOR_HTML: monitor-inbox.js の純粋関数を verbatim で埋め込む（二重定義しない）', () => {
    const inbox = require('../src/monitor-inbox');
    for (const fn of inbox.INBOX_CLIENT_FNS) {
        assert.ok(MONITOR_HTML.includes(String(fn)), `${fn.name} should be embedded verbatim`);
    }
});
