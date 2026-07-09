'use strict';
/**
 * monitor.js — autopilot daemon が配信する Web ステータスモニタ（自己完結 HTML）。
 *
 * daemon の HTTP サーバが `GET /` で本 HTML を返す。ページは `/board` を定期ポーリングして
 * **enroll 済み Issue の俯瞰ボード（読み取り専用・縦並び）** を first view に描画する。
 * 操作（Status 変更・並べ替え等）は GitHub Projects で行い、ここは俯瞰と log 閲覧・
 * pause/resume/即時 tick だけを提供する。外部依存なし（インライン CSS/JS）。
 *
 * レイアウト方針:
 * - ヘッダーはタイトル + アクションの 1 行に収める（auth 失効などの詳細はアラート帯へ）
 * - log は実行中の行の「log」クリックでモーダル表示（first view はボードに割く）
 * - 実行履歴はログとしての意味しかないので最下部
 * - Close / Done / Icebox はボードに出さない（溜まると重くなる。操作は GitHub Projects で）
 */

const MONITOR_HTML = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>autopilot monitor</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='47' fill='%237a1620' stroke='%23b3202f' stroke-width='5'/><path d='M50 27 L69 47 L50 73 L31 47 Z' fill='%23eaf7ff'/><path d='M31 47 L50 27 L50 50 Z' fill='%23bfeaff'/><path d='M69 47 L50 27 L50 50 Z' fill='%238fd8ff'/></svg>">
<style>
  :root { --border:#e2e8f0; --muted:#64748b; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; color: #1e293b; background:#f8fafc; }
  a { color: #2563eb; text-decoration: none; } a:hover { text-decoration: underline; }
  /* ---- コンパクトヘッダー（3 分割・1 行固定）#883 ----
     左: 状態 + 操作群（🔄 更新 含む） / 中央: usage（absolute 中央）/ 右: meta（固定幅）。
     3 セクションは互いを押さない。meta は固定幅で右寄せするので、内容幅が変わっても
     左端（x）が動かない（更新 Xs前 の桁変化・API残/実行中 の増減で揺れない）。 */
  header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: .5rem;
           padding: .4rem .8rem; background: linear-gradient(100deg, #141428 0%, #3a0f1e 55%, #5c1220 100%);
           color: #e2e8f0; white-space: nowrap; overflow: hidden; }
  .hgroup { display: flex; align-items: center; gap: .5rem; }
  .hleft { flex: 0 0 auto; }
  /* ---- Claude 使用量（ヘッダー中央）#879 ----
     内部の可変要素（%・age）は min-width で予約し、usage 全体の幅を一定に保つ。
     幅が一定なら translateX(-50%) の中央位置（x）も動かない。 */
  .usage { position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center;
           gap: .3rem; font-size: .75rem; color: #cbd5e1; font-variant-numeric: tabular-nums;
           pointer-events: none; }
  .usage .uicon { flex: none; display: block; }
  .usage .ubar { width: 40px; height: 8px; background: #334155; border-radius: 4px; overflow: hidden;
                 display: inline-block; vertical-align: middle; }
  .usage .ubar > span { display: block; height: 100%; background: #22c55e; }
  .usage .ubar > span.warn { background: #ef4444; }
  .usage .upct { min-width: 2.8em; text-align: right; }
  .usage .upct.warn { color: #fca5a5; }
  .usage .usep { color: #64748b; margin: 0 .05rem; }
  .usage .umuted { color: #64748b; min-width: 2.8em; text-align: center; }
  .usage .uage { color: #64748b; margin-left: .1rem; }
  .usage .uage.stale { color: #eab308; }
  .usage .uageval { display: inline-block; min-width: 2.4em; text-align: right; }
  header h1 { font-size: .95rem; margin: 0; font-weight: 600; }
  header .pill { flex: none; }
  header button { padding: .15rem .55rem; font-size: .8rem; cursor: pointer; border: 1px solid #334155;
                  background: #1e293b; color: #e2e8f0; border-radius: .3rem; }
  header button:hover { background: #334155; }
  header .meta { margin-left: auto; flex: 0 0 auto; width: 24rem; max-width: 40vw; text-align: right;
                 color: #94a3b8; font-size: .75rem; overflow: hidden; text-overflow: ellipsis;
                 font-variant-numeric: tabular-nums; }
  /* ---- 稼働バージョン + 更新バッジ（#885・スティッキーフッター） ---- */
  /* ヘッダーは Claude 使用量バーが中央を占めて余白が無いので、稼働バージョンと更新バッジは
     常時見えるスティッキーフッターに置く（issue はヘッダー or フッターを許容）。 */
  footer { position: sticky; bottom: 0; z-index: 20; display: flex; align-items: center; gap: .6rem;
           padding: .3rem .8rem; background: linear-gradient(100deg, #141428 0%, #3a0f1e 55%, #5c1220 100%);
           color: #94a3b8; font-size: .75rem;
           border-top: 1px solid #334155; font-variant-numeric: tabular-nums; }
  footer .ver code { color: #cbd5e1; background: rgba(255,255,255,.06); padding: 0 .3rem; border-radius: .2rem; }
  footer .upd-badge { padding: .1rem .55rem; font-size: .78rem; cursor: pointer; border: 1px solid #d97706;
                      background: #b45309; color: #fff; font-weight: 600; border-radius: .3rem; }
  footer .upd-badge:hover { background: #d97706; }
  /* ---- 更新手順モーダル ---- */
  #updmodal { position: fixed; inset: 0; background: rgba(15,23,42,.55); display: none; align-items: center;
              justify-content: center; z-index: 60; }
  #updmodal.open { display: flex; }
  #updmodal .box { background: #fff; color: #1e293b; width: min(92vw, 44rem); max-height: 85vh; border-radius: .5rem;
                   display: flex; flex-direction: column; overflow: hidden; }
  #updmodal .box header { position: static; border-radius: .5rem .5rem 0 0; }
  #updmodal .body { padding: .9rem 1rem; overflow: auto; font-size: .85rem; line-height: 1.55; }
  #updmodal h3 { font-size: .9rem; margin: .2rem 0 .5rem; }
  #updmodal ol { margin: .3rem 0 .8rem; padding-left: 1.3rem; }
  #updmodal code { background: #f1f5f9; padding: 0 .3rem; border-radius: .2rem; font-size: .82rem; }
  #updmodal .cmd { display: block; background: #0f172a; color: #e2e8f0; padding: .4rem .6rem; border-radius: .3rem;
                   margin: .3rem 0; white-space: pre-wrap; word-break: break-all; }
  #updmodal .commits { margin: .4rem 0 0; border-top: 1px solid var(--border); padding-top: .5rem; }
  #updmodal .commits li { font-size: .8rem; color: #334155; margin-bottom: .15rem; }
  #updmodal .commits code { font-size: .76rem; }
  #updmodal .primary { background: #2563eb; color: #fff; border: 1px solid #1d4ed8; padding: .1rem .5rem;
                       border-radius: .3rem; cursor: pointer; font-size: .78rem; }
  /* 狭い幅では中央 usage を隠して右 meta と重ならないようにする（usage は補助情報） */
  @media (max-width: 960px) { .usage { display: none; } }
  .pill { display: inline-block; padding: .05rem .5rem; border-radius: 1rem; font-size: .75rem; font-weight: 600; }
  .ok { background: #bbf7d0; color: #14532d; } .paused { background: #fecaca; color: #7f1d1d; }
  .auth { background: #fde047; color: #713f12; }
  /* ---- アラート帯 ---- */
  .alert { display: flex; align-items: baseline; gap: .6rem; padding: .45rem .8rem; font-size: .85rem;
           border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .alert.auth-a { background: #fef9c3; color: #713f12; }
  .alert.block-a { background: #fee2e2; color: #7f1d1d; }
  .alert code { background: rgba(0,0,0,.07); padding: 0 .3rem; border-radius: .2rem; }
  .alert button { font-size: .72rem; padding: .05rem .4rem; cursor: pointer; }
  .reauth-info { flex-basis: 100%; margin-top: .35rem; display: flex; gap: .5rem; align-items: center; flex-wrap: wrap;
                 padding: .35rem .5rem; background: rgba(0,0,0,.04); border-radius: .3rem; }
  .reauth-info code { font-size: 1rem; font-weight: 700; letter-spacing: .06em; }
  /* ---- 俯瞰ボード ---- */
  main { padding: .6rem .8rem 2rem; }
  /* #board のはみ出しはページ全体を崩さずスクロールで逃がす保険（列間引きと併用）#936 */
  .board-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; background: #fff; font-size: .84rem; }
  th, td { border: 1px solid var(--border); padding: .3rem .5rem; text-align: left; vertical-align: middle; }
  th { background: #f1f5f9; font-size: .75rem; color: #475569; }
  tr.blocked-row td { background: #fef2f2; }
  tr.running-row td { background: #fffbeb; }
  td.title-cell { max-width: 34rem; }
  .t { display: inline-block; max-width: 30rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
  /* ---- 狭幅（〜820px 目安）で情報量を落として崩れを防ぐ #936 ----
     モバイル対応は不要（横 640px 程度が最小想定）。nth-child は表示/非表示で
     位置番号がズレないので、Size(3) を隠しても 担当(5) の index は変わらない。
     colspan="8" のフォールバック行は td が1つなので誤って隠れない。 */
  @media (max-width: 820px) {
    #board th:nth-child(3), #board td:nth-child(3) { display: none; } /* Size */
    #board th:nth-child(5), #board td:nth-child(5) { display: none; } /* 担当 */
    #board td:nth-child(7) .bar, #board td:nth-child(7) .sub-pct { display: none; } /* Sub-issues: バー/％を隠し件数のみ */
    #board td:nth-child(8) .subtext { display: none; } /* Now: 「人間の番」「N分」等の subtext を隠しアイコン/phase-pill/log を残す */
    .t { max-width: 15rem; }
    th, td { padding: .3rem .35rem; }
  }
  .status-pill { display: inline-block; padding: .05rem .45rem; border-radius: .3rem; font-size: .75rem; font-weight: 600; white-space: nowrap; }
  /* ---- Size バッジ（S=緑 / M=琥珀 / L=赤）#884 ---- */
  .size-badge { display: inline-block; min-width: 1.1rem; padding: .05rem .4rem; border-radius: .3rem; font-size: .75rem; font-weight: 700; text-align: center; }
  .size-s { background: #dcfce7; color: #14532d; }
  .size-m { background: #fef3c7; color: #92400e; }
  .size-l { background: #fee2e2; color: #7f1d1d; }
  /* ---- Awaiting Continuation バッジ（協調的チェックポイント・EPIC #906）#913 ---- */
  .ai-continuation-badge { display: inline-block; padding: .05rem .45rem; border-radius: .3rem; font-size: .75rem;
                            font-weight: 600; white-space: nowrap; background: #ede9fe; color: #5b21b6; }
  .muted { color: var(--muted); }
  .prchip { display: inline-block; margin: 0 .15rem .1rem 0; padding: 0 .35rem; border-radius: .3rem;
            font-size: .75rem; white-space: nowrap; border: 1px solid transparent; }
  .pr-draft { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }
  .pr-ready { background: #dcfce7; color: #14532d; border-color: #86efac; }
  .pr-merged { background: #f3e8ff; color: #6b21a8; border-color: #d8b4fe; }
  .pr-closed { background: #fee2e2; color: #7f1d1d; text-decoration: line-through; }
  .bar { width: 90px; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; display: inline-block; vertical-align: middle; }
  .bar > div { height: 100%; background: #22c55e; }
  .subtext { font-size: .72rem; color: var(--muted); margin-left: .3rem; white-space: nowrap; }
  .phase-pill { background: #fde68a; color: #713f12; padding: .05rem .45rem; border-radius: .3rem; font-size: .75rem; font-weight: 600; white-space: nowrap; }
  td button { font-size: .72rem; padding: .05rem .45rem; cursor: pointer; }
  h2 { font-size: .85rem; color: var(--muted); margin: 1.2rem 0 .4rem; }
  /* ---- log モーダル ---- */
  #modal { position: fixed; inset: 0; background: rgba(15,23,42,.55); display: none; align-items: center; justify-content: center; z-index: 50; }
  #modal.open { display: flex; }
  #modal .box { background: #0f172a; color: #e2e8f0; width: min(90vw, 70rem); max-height: 85vh; border-radius: .5rem;
                display: flex; flex-direction: column; }
  #modal .box header { position: static; border-radius: .5rem .5rem 0 0; }
  #modal pre { margin: 0; padding: .8rem; overflow: auto; white-space: pre-wrap; font-size: .78rem; flex: 1; }
</style></head><body>
<header>
  <div class="hgroup hleft">
    <h1><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' width='22' height='22' style='vertical-align:-4px;margin-right:.15rem'>
        <circle cx='60' cy='60' r='55' fill='#7a1620' stroke='#b3202f' stroke-width='5'/>
        <g fill='none' stroke='#8fd8ff' stroke-width='4.5' stroke-linecap='round'>
          <path d='M58 58 C74 38 86 34 98 34'/><path d='M60 60 H98'/><path d='M58 62 C74 82 86 86 98 86'/>
        </g>
        <path d='M38 60 L54 44 L70 60 L54 76 Z' fill='#eaf7ff'/>
        <path d='M38 60 L54 44 L54 60 Z' fill='#bfeaff'/>
        <path d='M70 60 L54 44 L54 60 Z' fill='#8fd8ff'/>
      </svg>autopilot</h1>
    <span id="state" class="pill ok">…</span>
    <button id="pause" title="新規ディスパッチを止める">⏸</button>
    <button id="resume" title="再開">▶</button>
    <button id="ticknow" title="interval を待たず今すぐ 1 tick 実行">⚡ tick</button>
    <button id="refreshboard" title="俯瞰ボードを今すぐ再取得（GraphQL 消費あり）">🔄 更新</button>
  </div>
  <div id="usage" class="usage" title="Claude 使用率（セッション / 週間）"></div>
  <span class="meta" id="meta"></span>
</header>
<div id="alerts"></div>
<main>
  <div class="board-wrap">
  <table id="board"><thead><tr>
    <th>Issue</th><th>Status</th><th>Size</th><th>AI</th><th>担当</th><th>PR</th><th>Sub-issues</th><th>Now</th>
  </tr></thead><tbody id="rows"><tr><td colspan="8" class="muted">読み込み中…</td></tr></tbody></table>
  </div>
  <h2>実行履歴（最新 100 件・ログ用途のみ）</h2>
  <table id="histt"><thead><tr>
    <th>時刻</th><th>Issue</th><th>Phase</th><th>結果</th><th>メモ</th>
  </tr></thead><tbody id="hist"><tr><td colspan="5" class="muted">（まだ履歴はありません）</td></tr></tbody></table>
</main>
<footer id="footer">
  <span id="version" class="ver" title="稼働中コード（起動時のブランチ @ コミット）"></span>
  <button id="updbadge" class="upd-badge" style="display:none" title="tools/autopilot に更新があります">⬆️ 更新あり</button>
</footer>
<div id="updmodal"><div class="box">
  <header><h1>⬆️ autopilot の更新</h1>
    <span class="meta"></span>
    <button id="updclose">✕ 閉じる</button>
  </header>
  <div class="body" id="updbody"></div>
</div></div>
<div id="modal"><div class="box">
  <header><h1 id="mtitle">log</h1>
    <button id="mreload">↻ 更新</button>
    <span class="meta"></span>
    <button id="mclose">✕ 閉じる</button>
  </header>
  <pre id="mlog"></pre>
</div></div>
<script>
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repoUrl = 'https://github.com/smalruby/smalruby3-editor';
const STATUS_COLORS = {
  'New Item': ['#f1f5f9', '#475569'], 'Backlog': ['#e2e8f0', '#334155'],
  'Sprint Backlog': ['#dbeafe', '#1e40af'], 'In Progress': ['#fef3c7', '#92400e'],
  'Blocked': ['#fecaca', '#7f1d1d'], 'Review': ['#ede9fe', '#5b21b6'], 'DoD': ['#fce7f3', '#9d174d'],
};
const statusPill = (s) => {
  const [bg, fg] = STATUS_COLORS[s] || ['#f1f5f9', '#475569'];
  return '<span class="status-pill" style="background:' + bg + ';color:' + fg + '">' + esc(s) + '</span>';
};
// Size（triage で決まる small/middle/large）を S/M/L の色付きバッジに短縮する（#884）。
// 未設定は「—」（muted）でレイアウトを崩さない。title に元の語を残す。
const SIZE_BADGES = { small: ['S', 'size-s'], middle: ['M', 'size-m'], large: ['L', 'size-l'] };
const sizeBadge = (size) => {
  const b = SIZE_BADGES[size];
  if (!b) return '<span class="muted">—</span>';
  return '<span class="size-badge ' + b[1] + '" title="' + esc(size) + '">' + b[0] + '</span>';
};
// Awaiting Continuation（協調的チェックポイント・EPIC #906）だけ専用バッジにする（#913）。
// 他の AI Status（Implementing 等）はプレーンテキストのまま。
const AI_STATUS_CONTINUATION = 'Awaiting Continuation';
const aiStatusCell = (it) => {
  if (!it.aiStatus) return '<span class="muted">—</span>';
  if (it.aiStatus !== AI_STATUS_CONTINUATION) return esc(it.aiStatus);
  const remaining = it.continuationRemaining;
  const sub = remaining != null
    ? '<span class="subtext" title="continuation ファイルの残タスク数">残 ' + remaining + '</span>'
    : '';
  return '<span class="ai-continuation-badge" title="soft-limit で安全に中断・継続待ち（EPIC #906）">'
    + '⏸️ ' + esc(it.aiStatus) + '</span>' + sub;
};
const prChip = (p) => {
  let cls = 'pr-ready', icon = '✅';
  if (p.state === 'MERGED') { cls = 'pr-merged'; icon = '🟣'; }
  else if (p.state === 'CLOSED') { cls = 'pr-closed'; icon = '❌'; }
  else if (p.isDraft) { cls = 'pr-draft'; icon = '📝'; }
  return '<a class="prchip ' + cls + '" target="_blank" rel="noopener" href="' + repoUrl + '/pull/' + p.number + '">'
    + icon + ' #' + p.number + '</a>';
};
const mins = (ms) => Math.max(0, Math.round(ms / 60000));
let logIssue = null;
let logTimer = null;

// Claude アイコン（インライン SVG・自己完結。外部リソース禁止）
const USAGE_ICON = '<svg class="uicon" viewBox="0 0 100 100" width="15" height="15" aria-label="Claude">'
  + '<g stroke="#d97757" stroke-width="10" stroke-linecap="round">'
  + '<line x1="50" y1="14" x2="50" y2="86"/><line x1="14" y1="50" x2="86" y2="50"/>'
  + '<line x1="24" y1="24" x2="76" y2="76"/><line x1="76" y1="24" x2="24" y2="76"/></g></svg>';

// resetsAt（秒 or ms epoch）を JST の日時文字列に整形する（#935）。無効値・null は
// 空文字を返し、呼び出し側は title に「リセット」を付けない。Intl はブラウザ内蔵なので
// 自己完結（monitor は外部リソース禁止の規約を守れる）。
function resetLabel(resetsAt) {
  if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt) || resetsAt <= 0) return '';
  const ms = resetsAt < 1e12 ? resetsAt * 1000 : resetsAt;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }) + ' JST';
}

// 使用率の短いバー + NN%。データが無いウィンドウは「—」でレイアウトを崩さない。
// used ≥ 80% は警告色（残量僅少）。ホバーで制限リセット期限(JST)を表示する（#935）。
function usageBar(w, label) {
  if (!w || w.percent == null) return '<span class="umuted" title="' + esc(label) + '">—</span>';
  const pct = Math.max(0, Math.min(100, Number(w.percent) || 0));
  const warn = pct >= 80 ? ' warn' : '';
  const rounded = Math.round(pct);
  const reset = resetLabel(w.resetsAt);
  const title = esc(label) + ' ' + rounded + '%' + (reset ? ' — リセット ' + esc(reset) : '');
  return '<span class="ubar" title="' + title + '">'
    + '<span class="' + warn.trim() + '" style="width:' + pct + '%"></span></span>'
    + '<span class="upct' + warn + '" title="' + title + '">' + rounded + '%</span>';
}

// usage の最終更新からの経過（age）を薄字で併記する。usage は worker（claude セッション）
// 実行時にしか更新されない（データ源が status line の rate_limits）ため、worker 非稼働中は
// 値が据え置きになる。経過を出して「固まっている」誤解を防ぐ。90 秒以上更新が無ければ
// stale（黄色）にして据え置き中を明示する。値は uageval の min-width で予約するので桁変化で
// usage 全体の幅が揺れない（= 中央位置 x が動かない）。
function usageAge(u) {
  if (!u || u.updatedAt == null) return '';
  const sec = Math.max(0, Math.round((Date.now() - u.updatedAt) / 1000));
  // 桁数を抑える（worker が長時間非稼働でも幅を一定に保つ）: s → m → h → d
  const v = sec < 60 ? sec + 's'
    : sec < 3600 ? Math.floor(sec / 60) + 'm'
    : sec < 86400 ? Math.floor(sec / 3600) + 'h'
    : Math.floor(sec / 86400) + 'd';
  const stale = sec >= 90 ? ' stale' : '';
  const title = sec >= 90
    ? 'usage は worker 稼働時のみ更新（据え置き中）'
    : 'usage の最終更新からの経過';
  return '<span class="uage' + stale + '" title="' + esc(title) + '">更新<span class="uageval">'
    + v + '</span>前</span>';
}

function renderUsage(d) {
  const u = d.claudeUsage || {};
  document.getElementById('usage').innerHTML = USAGE_ICON
    + usageBar(u.session, 'セッション使用率（直近5時間）')
    + '<span class="usep">/</span>'
    + usageBar(u.weekly, '週間使用率（7日）')
    + usageAge(u);
}

// 稼働バージョン（起動時の branch @ shortCommit）+ 更新バッジ（#885）
let lastUpdate = null; // 更新モーダルが参照する最新の autopilotUpdate
function renderVersion(d) {
  const v = d.version || {};
  const el = document.getElementById('version');
  if (v.branch || v.shortCommit) {
    el.innerHTML = esc(v.branch || '?') + ' <code>@ ' + esc(v.shortCommit || '?') + '</code>';
  } else {
    el.innerHTML = '<span class="muted">version —</span>';
  }
  lastUpdate = d.autopilotUpdate || null;
  const badge = document.getElementById('updbadge');
  if (lastUpdate && lastUpdate.available) {
    badge.style.display = '';
    badge.textContent = '⬆️ 更新あり（' + (lastUpdate.behind || 0) + ' 件）';
  } else {
    badge.style.display = 'none';
  }
}

// 更新手順モーダル: 実行はせず手順テキストのみ提示する（#885）
function openUpdateModal() {
  const u = lastUpdate || {};
  const commits = (u.commits || []).map((c) =>
    '<li><code>' + esc(c.shortCommit) + '</code> ' + esc(c.subject) + '</li>').join('');
  const commitBlock = commits
    ? '<div class="commits"><b>tools/autopilot の差分コミット（' + (u.behind || 0) + ' 件）</b><ul>' + commits + '</ul></div>'
    : '';
  const errBlock = u.error
    ? '<p class="muted">⚠️ 直近の更新チェックはエラーでした（前回値を表示）: ' + esc(u.error) + '</p>'
    : '';
  document.getElementById('updbody').innerHTML =
    '<h3>autopilot の更新手順</h3>'
    + '<p><b>おすすめ:</b> Claude の autopilot セッションで次を指示してください:</p>'
    + '<span class="cmd">update autopilot</span>'
    + '<button class="primary" onclick="copyText(&quot;update autopilot&quot;)">📋 コピー</button>'
    + '<h3 style="margin-top:1rem">手動で更新する場合</h3>'
    + '<ol>'
    + '<li>daemon を止める:<span class="cmd">curl -X POST localhost:8787/shutdown</span></li>'
    + '<li><code>/app</code> で最新を取り込む:<span class="cmd">git pull</span></li>'
    + '<li>再起動する:<span class="cmd">bash tmp/autopilot_up.sh</span></li>'
    + '</ol>'
    + commitBlock + errBlock;
  document.getElementById('updmodal').classList.add('open');
}
function closeUpdateModal() { document.getElementById('updmodal').classList.remove('open'); }

function renderAlerts(d) {
  const parts = [];
  if (d.authError) {
    const R = d.reauth;
    let ra = '';
    if (R && R.status === 'pending' && (R.code || R.url)) {
      ra = '<div class="reauth-info">📱 デバイス認証'
        + (R.code ? ' コード <code>' + esc(R.code) + '</code> <button onclick="copyText(&quot;' + esc(R.code) + '&quot;)">📋 コピー</button>' : '')
        + (R.url ? ' <a target="_blank" rel="noopener" href="' + esc(R.completeUrl || R.url) + '">🔗 認証ページを開く</a>' : '')
        + '<span class="subtext">ホストのブラウザでコードを承認すると autopilot が自動で再開します</span></div>';
    } else if (R && R.status === 'error') {
      ra = '<div class="reauth-info">⚠️ 再接続に失敗: ' + esc(R.error || '') + '</div>';
    } else if (R && R.status === 'starting') {
      ra = '<div class="reauth-info">⏳ SSO ログインを起動中…</div>';
    }
    parts.push('<div class="alert auth-a">🔐 <b>認証エラー（auto-pause 中）</b> ' + esc(d.authError)
      + '<span>' + esc(d.reauthHint || '') + '</span>'
      + '<button id="reauthbtn" onclick="reauth()">🔐 再接続（SSO ログイン）</button>'
      + '<button onclick="copyText(&quot;check autopilot&quot;)">📋 claude へ: check autopilot</button>'
      + ra + '</div>');
  }
  if (d.rate && d.rate.skipLowPriority) {
    parts.push('<div class="alert auth-a">🧯 <b>API レート残量が僅少</b>（' + esc(d.rate.minAt || '')
      + ' 残 ' + d.rate.minRemaining + '）— 低優先処理（PR 投影・ボード更新）を一時スキップ中。残量回復で自動復帰します。</div>');
  }
  const blocked = (d.items || []).filter((it) => it.status === 'Blocked');
  if (blocked.length) {
    const chips = blocked.map((it) => '#' + it.issue
      + ' <button onclick="copyText(&quot;check autopilot #' + it.issue + '&quot;)">📋 check autopilot #' + it.issue + '</button>').join(' ');
    parts.push('<div class="alert block-a">🚨 <b>Blocked ' + blocked.length + ' 件</b> — コピーして claude に貼ると診断します: ' + chips + '</div>');
  }
  document.getElementById('alerts').innerHTML = parts.join('');
}

function renderBoard(d) {
  const runningBy = {};
  for (const r of d.running || []) runningBy[r.issue] = r;
  const rows = (d.items || []).map((it) => {
    const r = runningBy[it.issue];
    const cls = it.status === 'Blocked' ? 'blocked-row' : (r ? 'running-row' : '');
    const prs = (it.prs || []).map(prChip).join('') || '<span class="muted">—</span>';
    const s = it.subIssues || {};
    // 件数（.sub-count）と %（.sub-pct）を別 span に分割し、狭幅 CSS で % だけ隠せるようにする（#936）
    const sub = s.total
      ? '<span class="bar"><div style="width:' + (s.percent || 0) + '%"></div></span>'
        + '<span class="subtext"><span class="sub-count">' + s.completed + '/' + s.total + '</span>'
        + '<span class="sub-pct"> (' + (s.percent || 0) + '%)</span></span>'
      : '<span class="muted">—</span>';
    const now = r
      ? '<span class="phase-pill">' + esc(r.phase) + '</span>'
        + '<span class="subtext">' + mins(Date.now() - r.since) + '分</span> '
        + '<button onclick="openLog(' + it.issue + ')">log</button>'
      : (it.hitl ? '<span title="人間の番">🙋</span> <span class="subtext">人間の番</span>' : '<span class="muted">—</span>');
    const who = (it.assignees || []).length
      ? esc((it.assignees || []).join(', '))
      : '<span class="muted">—</span>';
    const kindMark = it.tracker ? ' <span class="subtext" title="tracker (分解済み親)">🧭</span>' : '';
    const waitMark = it.waiting ? ' <span class="subtext" title="先行 Issue (autopilot-after) の完了待ち">⏳</span>' : '';
    return '<tr class="' + cls + '">'
      + '<td class="title-cell"><a target="_blank" rel="noopener" href="' + esc(it.url) + '">#' + it.issue + '</a> '
      + '<span class="t" title="' + esc(it.title) + '">' + esc(it.title) + '</span>' + kindMark + waitMark + '</td>'
      + '<td>' + statusPill(it.status) + '</td>'
      + '<td>' + sizeBadge(it.size) + '</td>'
      + '<td>' + aiStatusCell(it) + '</td>'
      + '<td>' + who + '</td>'
      + '<td>' + prs + '</td>'
      + '<td>' + sub + '</td>'
      + '<td>' + now + '</td></tr>';
  });
  document.getElementById('rows').innerHTML = rows.join('')
    || '<tr><td colspan="8" class="muted">（表示対象の Issue はありません）</td></tr>';
}

function renderHistory(d) {
  const OUTCOME = { done: '✅ done', hitl: '🙋 hitl', error: '❌ error', failed: '💥 failed', 'invalid-result': '⚠️ invalid', exception: '💥 exception' };
  const rows = (d.history || []).map((h) =>
    '<tr><td class="muted">' + new Date(h.endedAt).toLocaleString('ja-JP', { hour12: false }) + '</td>'
    + '<td><a target="_blank" rel="noopener" href="' + repoUrl + '/issues/' + h.issue + '">#' + h.issue + '</a></td>'
    + '<td>' + esc(h.phase) + '</td>'
    + '<td>' + (OUTCOME[h.outcome] || esc(h.outcome)) + '</td>'
    + '<td class="muted">' + esc(h.note || '') + '</td></tr>');
  document.getElementById('hist').innerHTML = rows.join('')
    || '<tr><td colspan="5" class="muted">（まだ履歴はありません）</td></tr>';
}

async function refresh() {
  try {
    const d = await fetch('/board').then((r) => r.json());
    const st = document.getElementById('state');
    if (d.authError) { st.className = 'pill auth'; st.textContent = 'AUTH ⚠'; }
    else if (d.paused) { st.className = 'pill paused'; st.textContent = 'PAUSED'; }
    else { st.className = 'pill ok'; st.textContent = 'RUNNING'; }
    document.getElementById('meta').textContent =
      (d.assignee ? '👤 ' + d.assignee + ' · ' : '') + '並行 ' + d.concurrency
      + ' · 実行中 ' + (d.running || []).length
      + (d.rate && d.rate.minRemaining != null ? ' · API残 ' + d.rate.minRemaining + (d.rate.warn ? '⚠' : '') : '')
      + (d.updatedAt ? ' · 更新 ' + Math.round((Date.now() - d.updatedAt) / 1000) + 's前' : '');
    renderUsage(d);
    renderVersion(d);
    renderAlerts(d);
    renderBoard(d);
    renderHistory(d);
  } catch (e) {
    document.getElementById('state').className = 'pill paused';
    document.getElementById('state').textContent = '応答なし';
  }
}

async function copyText(t) { try { await navigator.clipboard.writeText(t); } catch (e) { prompt('コピーしてください:', t); } }
async function reauth() {
  const btn = document.getElementById('reauthbtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ SSO 起動中…'; }
  // ユーザー操作（クリック）のうちに空タブを開いておく（await 後の window.open はポップアップブロックされるため）
  let win = null;
  try { win = window.open('about:blank', '_blank'); } catch (e) { /* blocked */ }
  try {
    const r = await fetch('/reauth', { method: 'POST' }).then((x) => x.json());
    const target = r && (r.completeUrl || r.url);
    if (target) { if (win) win.location = target; else window.open(target, '_blank'); }
    else if (win) win.close();
  } catch (e) {
    if (win) win.close();
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔐 再接続（SSO ログイン）'; }
  refresh();
}
async function openLog(issue) {
  logIssue = issue;
  document.getElementById('mtitle').textContent = 'log #' + issue;
  document.getElementById('mlog').textContent = '読み込み中…';
  document.getElementById('modal').classList.add('open');
  await loadLog();
  // モーダルを開いている間は 10 秒ごとに自動で /log を再取得する（開き直しで多重化しないよう先にクリア）
  if (logTimer) clearInterval(logTimer);
  logTimer = setInterval(loadLog, 10000);
}
async function loadLog() {
  if (logIssue == null) return;
  const el = document.getElementById('mlog');
  // 末尾付近を見ているときだけ更新後に末尾へ追従（手動スクロール中は位置を保つ）
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  // 自動ポーリング中に daemon が落ちても未処理 rejection を垂れ流さない（既存表示は保つ）
  try {
    const r = await fetch('/log?issue=' + logIssue);
    el.textContent = await r.text();
    if (atBottom) el.scrollTop = el.scrollHeight;
  } catch (e) {
    /* ネットワーク断は次回ポーリングで自然回復させる */
  }
}
function closeModal() {
  document.getElementById('modal').classList.remove('open');
  logIssue = null;
  // 自動更新を止める（interval リーク防止）
  if (logTimer) { clearInterval(logTimer); logTimer = null; }
}
document.getElementById('mclose').onclick = closeModal;
document.getElementById('mreload').onclick = loadLog;
document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.getElementById('updbadge').onclick = openUpdateModal;
document.getElementById('updclose').onclick = closeUpdateModal;
document.getElementById('updmodal').addEventListener('click', (e) => { if (e.target.id === 'updmodal') closeUpdateModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeUpdateModal(); } });
document.getElementById('pause').onclick = () => fetch('/pause', { method: 'POST' }).then(refresh);
document.getElementById('resume').onclick = () => fetch('/resume', { method: 'POST' }).then(refresh);
document.getElementById('ticknow').onclick = async () => {
  const btn = document.getElementById('ticknow');
  btn.disabled = true; btn.textContent = '⏳';
  try { await fetch('/tick', { method: 'POST' }); } catch (e) { /* refresh 側で表示 */ }
  btn.disabled = false; btn.textContent = '⚡ tick';
  refresh();
};
document.getElementById('refreshboard').onclick = async () => {
  const btn = document.getElementById('refreshboard');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const r = await fetch('/refresh', { method: 'POST' }).then((x) => x.json());
    if (r && r.skipped) btn.title = 'API レート残量が僅少のためスキップしました（残 ' + r.minRemaining + '）';
  } catch (e) { /* refresh 側で表示 */ }
  btn.disabled = false; btn.textContent = '🔄 更新';
  refresh();
};
refresh(); setInterval(refresh, 5000);
</script></body></html>`;

module.exports = { MONITOR_HTML };
