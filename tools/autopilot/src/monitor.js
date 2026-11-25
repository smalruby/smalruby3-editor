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
 * - [通常] / [あとでやる] タブで `💤 later` 付き Issue を分離する（#1190）。唯一の書き込み操作
 *   「💤 あとで / ↩ 今やる」は `POST /later`。判断ロジックは phases.js の純粋関数を
 *   `fn.toString()` で埋め込んで共有する（二重定義しない）
 * - PR は専用列ではなく Issue 番号のすぐ右に open のものだけ並べ、merged / closed があれば
 *   ▼ メニューに全 PR をまとめる（#1212。振り分けは phases.js の `splitPrsForTitle`）
 * - 一覧の上に「人間待ち」を理由ごと（🔬 Spike / 👀 レビュー / ✅ DoD / 🧱 Blocked / ⏳ 依存 / 🙋 そのほか）
 *   にまとめ、Now 欄の 🙋 も理由つきで出す（#1315。理由は daemon が phases.js の `humanWaitReason`
 *   で決めて /board に載せる。HTML は phases.js の `renderHumanWaitsHtml` / `renderHumanWaitCell`）
 * - Issue 列の左端（固定位置）の 📋 で「#Issue PR#… タイトル」+ URL をコピーし、行を一瞬光らせる
 *   （#1213。文字列は phases.js の `issueCopyText`）
 */

const { BLOCKED_PANEL_HTML } = require('./blocked-panel');
const {
    canToggleLater, effectiveLater, splitLaterBoard, laterPendingReducer, splitPrsForTitle, issueCopyText,
    canResolveConflict,
    HUMAN_WAIT_REASONS, humanWaitGroups, renderHumanWaitsHtml, renderHumanWaitCell,
} = require('./phases');
// 学び・タスクの欄（EPIC #2384）。部品は monitor-learn-tasks.js にまとめ、ここは埋め込むだけ
const { LEARN_TASKS_CSS, LEARN_TASKS_HTML, LEARN_TASKS_SCRIPT } = require('./monitor-learn-tasks');
// EPIC ごとの欄と「現在地を作る」（#2388）。描画は epic-summary.js の純粋関数を埋め込んで共有する
const { renderEpicGroupsHtml } = require('./epic-summary');

// ブラウザへ埋め込むクライアント共有の純粋関数（自己完結。later.test.js / spike.test.js で単独評価を担保）
const SHARED_CLIENT_FNS = [
    canToggleLater, effectiveLater, splitLaterBoard, laterPendingReducer, splitPrsForTitle, issueCopyText,
    humanWaitGroups, renderHumanWaitsHtml, renderHumanWaitCell, canResolveConflict,
    renderEpicGroupsHtml,
]
    .map(String).join('\n');

/** 合言葉の入れ物（素の HTML は空。daemon が配信するときに monitorHtmlWithToken で埋める） */
const TOKEN_META_EMPTY = '<meta name="autopilot-token" content="">';

const MONITOR_HTML = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
${TOKEN_META_EMPTY}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>autopilot monitor</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='47' fill='%237a1620' stroke='%23b3202f' stroke-width='5'/><path d='M50 27 L69 47 L50 73 L31 47 Z' fill='%23eaf7ff'/><path d='M31 47 L50 27 L50 50 Z' fill='%23bfeaff'/><path d='M69 47 L50 27 L50 50 Z' fill='%238fd8ff'/></svg>">
<style>
  /* ---- トークン（docs/autopilot/design-system.md が正。値は同意したモックアップの D から） ----
     色の意味は 6 つだけ（ai / human / done / idle / stop / notice）。細かい名前のトークンは
     どれかの意味の色の別名にしてある（同じ意味なら同じ色。新しい色の値を足さない）。
     ライトが既定。ダークは OS に従い、data-theme="light" / "dark" で手で固定もできる。 */
  :root {
    color-scheme: light;
    /* 意味の色（本体。ダークでは下で値を差しかえる） */
    --ap-bg:#f4f6f7; --ap-surface:#ffffff; --ap-surface-2:#f9fafb; --ap-code-bg:#eef1f3;
    --ap-ink:#17202a; --ap-ink-2:#2b3640; --ap-ink-soft:#3f4b56; --ap-muted:#5a6672; --ap-faint:#8a949e;
    --ap-line:#d9dfe4; --ap-line-soft:#e9edf0; --ap-line-strong:#c3ccd3;
    --ap-ai:#0e6e7c; --ap-ai-wash:#dcf0f2;
    --ap-human:#5a44b4; --ap-human-wash:#ebe7fa;
    --ap-done:#2e7553; --ap-done-wash:#e0f0e7;
    --ap-idle:#6b7785; --ap-idle-wash:#eceff2;
    --ap-stop:#8a3b5c; --ap-stop-wash:#f4e4ea;
    --ap-notice:#7c6514; --ap-notice-wash:#f4eed9;
    /* 「AI に任せる」の虹色の輪（このボタンだけに使う） */
    --ap-go-1:#7b6cf0; --ap-go-2:#3fa9e6; --ap-go-3:#3cc59a; --ap-go-4:#e9b93c; --ap-go-5:#ee7f8c; --ap-go-6:#b77ad9;
    --ap-go-wash:#f4f1ff;
    /* 地の上に載る文字・影・半透明 */
    --ap-on-solid:#ffffff;
    --ap-tint-1:rgba(23,32,42,.04); --ap-tint-2:rgba(23,32,42,.07); --ap-count-wash:rgba(90,102,114,.16);
    --ap-overlay:rgba(15,20,24,.55); --ap-shadow-menu:rgba(20,30,40,.14); --ap-shadow-pop:rgba(15,20,24,.35);
    --ap-term-bg:#0f1418; --ap-term-ink:#e3e8ec;

    /* ---- 別名（意味の色へ寄せる） ---- */
    --ap-link:var(--ap-ink-soft); --ap-primary:var(--ap-human); --ap-primary-line:var(--ap-human);
    --ap-selected:var(--ap-ink); --ap-focus:var(--ap-ai); --ap-flash:var(--ap-ai-wash);
    --ap-progress:var(--ap-done); --ap-track:var(--ap-line-soft);
    /* 上の帯（状態の 1 行）: 暗い帯をやめ、表と同じ地にする */
    --ap-chrome-1:var(--ap-surface); --ap-chrome-2:var(--ap-surface); --ap-chrome-3:var(--ap-surface);
    --ap-chrome-surface:var(--ap-surface); --ap-chrome-line:var(--ap-line); --ap-chrome-track:var(--ap-line);
    --ap-chrome-btn:var(--ap-surface); --ap-chrome-btn-hover:var(--ap-surface-2); --ap-chrome-code-bg:var(--ap-code-bg);
    --ap-chrome-ink:var(--ap-ink); --ap-chrome-ink-2:var(--ap-ink-2); --ap-chrome-dim:var(--ap-muted);
    --ap-chrome-muted:var(--ap-faint); --ap-chrome-notice:var(--ap-notice);
    /* 使用量の計り: ふだんは灰色、少なくなったら注意の色（文字と細い棒だけ） */
    --ap-usage-ok:var(--ap-muted); --ap-usage-warn:var(--ap-notice); --ap-usage-warn-ink:var(--ap-notice);
    --ap-usage-ink:var(--ap-notice); --ap-usage-wash:var(--ap-notice-wash);
    --ap-usage-state:var(--ap-notice); --ap-usage-state-wash:var(--ap-notice-wash);
    /* 更新の知らせ: 押すのは人間なので人間の色（オレンジの面はやめる） */
    --ap-update:var(--ap-human); --ap-update-line:var(--ap-human);
    --ap-update-hover:color-mix(in oklab, var(--ap-human) 85%, var(--ap-ink));
    /* AI が動いている（行の地には塗らない） */
    --ap-ai-row:var(--ap-surface); --ap-ai-phase:var(--ap-ai); --ap-ai-phase-wash:var(--ap-ai-wash);
    --ap-ai-chip:var(--ap-ai); --ap-ai-state:var(--ap-ai); --ap-ai-state-wash:var(--ap-ai-wash);
    /* 人間の番（Review・DoD・人間待ちは同じ色） */
    --ap-human-dod:var(--ap-human); --ap-human-dod-wash:var(--ap-human-wash); --ap-human-chip:var(--ap-human);
    /* 終わった（PR の ready / merged）。閉じた PR は止まったではなく待っている側の灰色 */
    --ap-done-line:color-mix(in oklab, var(--ap-done) 40%, var(--ap-surface));
    --ap-merged:var(--ap-done); --ap-merged-wash:var(--ap-done-wash); --ap-merged-line:var(--ap-done-line);
    --ap-closed:var(--ap-idle); --ap-closed-wash:var(--ap-idle-wash);
    /* 待っている（New Item / Backlog / Sprint Backlog・draft の PR） */
    --ap-idle-line:var(--ap-line-strong);
    --ap-idle-backlog:var(--ap-idle); --ap-idle-backlog-wash:var(--ap-idle-wash);
    --ap-idle-sprint:var(--ap-idle); --ap-idle-sprint-wash:var(--ap-idle-wash);
    /* 止まった（Blocked・一時停止・コンフリクト）。小さな札と文字・細い線だけ。行の地には塗らない */
    --ap-stop-wash-2:var(--ap-stop-wash); --ap-stop-row:var(--ap-surface);
    --ap-conflict:var(--ap-stop); --ap-conflict-strong:var(--ap-stop);
    --ap-conflict-line:color-mix(in oklab, var(--ap-stop) 45%, var(--ap-surface)); --ap-conflict-wash:var(--ap-stop-wash);
    /* 注意（認証・使用量・あとでやるの警告）。失敗の文字は止まったの色 */
    --ap-notice-state-wash:var(--ap-notice-wash); --ap-notice-tab:var(--ap-notice); --ap-notice-tab-wash:var(--ap-notice-wash);
    --ap-notice-err:var(--ap-stop);
    /* Size・優先度は状態ではないので意味の色を使わない（灰色の濃さと文字の濃さだけ） */
    --ap-size-s:var(--ap-ink-2); --ap-size-s-wash:var(--ap-surface-2);
    --ap-size-m:var(--ap-ink-2); --ap-size-m-wash:var(--ap-idle-wash);
    --ap-size-l:var(--ap-ink-2); --ap-size-l-wash:var(--ap-line);
    --ap-prio:var(--ap-muted); --ap-prio-wash:transparent;
    --ap-prio0:var(--ap-ink); --ap-prio0-wash:transparent; --ap-prio1:var(--ap-ink); --ap-prio1-wash:transparent;

    /* ---- 大きさ・間隔・角・動き ---- */
    --ap-font-xs:12px; --ap-font-sm:13px; --ap-font-md:14px; --ap-font-lg:16px; --ap-font-xl:20px;
    --ap-row-dense:30px; --ap-row-comfy:40px; --ap-human-font:15px; --ap-human-gap:16px;
    --ap-space-1:2px; --ap-space-2:4px; --ap-space-3:8px; --ap-space-4:12px; --ap-space-5:16px; --ap-space-6:24px;
    --ap-radius-sm:4px; --ap-radius-md:6px; --ap-radius-pill:999px; --ap-dot:8px;
    --ap-motion-pulse:2s; --ap-motion-go:5s;
    --ap-font-ui:-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Segoe UI", Meiryo, sans-serif;
    --ap-font-mono:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    color-scheme: dark;
    --ap-bg:#0f1418; --ap-surface:#161d23; --ap-surface-2:#1b232a; --ap-code-bg:#1f2830;
    --ap-ink:#e3e8ec; --ap-ink-2:#cfd6dc; --ap-ink-soft:#b6c0c8; --ap-muted:#9aa6b1; --ap-faint:#6f7b86;
    --ap-line:#2a353e; --ap-line-soft:#212a32; --ap-line-strong:#36434d;
    --ap-ai:#5cc3cf; --ap-ai-wash:#163238; --ap-human:#b3a0f2; --ap-human-wash:#2a2543;
    --ap-done:#7cc79e; --ap-done-wash:#173025; --ap-idle:#9aa6b1; --ap-idle-wash:#222b33;
    --ap-stop:#e39ab6; --ap-stop-wash:#3a2230; --ap-notice:#d9bf6a; --ap-notice-wash:#332c17;
    --ap-go-1:#a79cff; --ap-go-2:#6cc6f5; --ap-go-3:#62dcb3; --ap-go-4:#f1cd66; --ap-go-5:#f59aa5; --ap-go-6:#cf9ce9;
    --ap-go-wash:#231f3a;
    --ap-on-solid:#15121f;
    --ap-tint-1:rgba(255,255,255,.04); --ap-tint-2:rgba(255,255,255,.08); --ap-count-wash:rgba(154,166,177,.2);
    --ap-overlay:rgba(0,0,0,.6); --ap-shadow-menu:rgba(0,0,0,.45); --ap-shadow-pop:rgba(0,0,0,.55);
    --ap-term-bg:#0b0f12; --ap-term-ink:#e3e8ec;
  } }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --ap-bg:#0f1418; --ap-surface:#161d23; --ap-surface-2:#1b232a; --ap-code-bg:#1f2830;
    --ap-ink:#e3e8ec; --ap-ink-2:#cfd6dc; --ap-ink-soft:#b6c0c8; --ap-muted:#9aa6b1; --ap-faint:#6f7b86;
    --ap-line:#2a353e; --ap-line-soft:#212a32; --ap-line-strong:#36434d;
    --ap-ai:#5cc3cf; --ap-ai-wash:#163238; --ap-human:#b3a0f2; --ap-human-wash:#2a2543;
    --ap-done:#7cc79e; --ap-done-wash:#173025; --ap-idle:#9aa6b1; --ap-idle-wash:#222b33;
    --ap-stop:#e39ab6; --ap-stop-wash:#3a2230; --ap-notice:#d9bf6a; --ap-notice-wash:#332c17;
    --ap-go-1:#a79cff; --ap-go-2:#6cc6f5; --ap-go-3:#62dcb3; --ap-go-4:#f1cd66; --ap-go-5:#f59aa5; --ap-go-6:#cf9ce9;
    --ap-go-wash:#231f3a;
    --ap-on-solid:#15121f;
    --ap-tint-1:rgba(255,255,255,.04); --ap-tint-2:rgba(255,255,255,.08); --ap-count-wash:rgba(154,166,177,.2);
    --ap-overlay:rgba(0,0,0,.6); --ap-shadow-menu:rgba(0,0,0,.45); --ap-shadow-pop:rgba(0,0,0,.55);
    --ap-term-bg:#0b0f12; --ap-term-ink:#e3e8ec;
  }
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; color: var(--ap-ink); background:var(--ap-bg); }
  a { color: var(--ap-link); text-decoration: none; } a:hover { text-decoration: underline; }
  /* ---- コンパクトヘッダー（3 分割・1 行固定）#883 ----
     左: 状態 + 操作群（🔄 更新 含む） / 中央: usage（absolute 中央）/ 右: meta（固定幅）。
     3 セクションは互いを押さない。meta は固定幅で右寄せするので、内容幅が変わっても
     左端（x）が動かない（更新 Xs前 の桁変化・API残/実行中 の増減で揺れない）。 */
  header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: .5rem;
           padding: .4rem .8rem; background: linear-gradient(100deg, var(--ap-chrome-1) 0%, var(--ap-chrome-2) 55%, var(--ap-chrome-3) 100%);
           color: var(--ap-chrome-ink); white-space: nowrap; overflow: hidden; }
  .hgroup { display: flex; align-items: center; gap: .5rem; }
  .hleft { flex: 0 0 auto; }
  /* ---- Claude 使用量（ヘッダー中央）#879 ----
     内部の可変要素（%・age）は min-width で予約し、usage 全体の幅を一定に保つ。
     幅が一定なら translateX(-50%) の中央位置（x）も動かない。 */
  .usage { position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center;
           gap: .3rem; font-size: .75rem; color: var(--ap-chrome-ink-2); font-variant-numeric: tabular-nums;
           pointer-events: none; }
  /* .usage 全体は pointer-events:none（バー幅・中央位置に影響させない）だが、
     アイコンだけはクリック/フォーカス可能にして使用量詳細ポップオーバーを開く（#996）。 */
  .usage .uicon { flex: none; display: block; pointer-events: auto; cursor: pointer; }
  .usage .uicon:focus-visible { outline: 2px solid var(--ap-focus); outline-offset: 2px; border-radius: 2px; }
  .usage .ubar { width: 40px; height: 8px; background: var(--ap-chrome-track); border-radius: 4px; overflow: hidden;
                 display: inline-block; vertical-align: middle; }
  .usage .ubar > span { display: block; height: 100%; background: var(--ap-usage-ok); }
  .usage .ubar > span.warn { background: var(--ap-usage-warn); }
  .usage .upct { min-width: 2.8em; text-align: right; }
  .usage .upct.warn { color: var(--ap-usage-warn-ink); }
  .usage .usep { color: var(--ap-chrome-muted); margin: 0 .05rem; }
  .usage .umuted { color: var(--ap-chrome-muted); min-width: 2.8em; text-align: center; }
  .usage .uage { color: var(--ap-chrome-muted); margin-left: .1rem; }
  .usage .uage.stale { color: var(--ap-chrome-notice); }
  .usage .uageval { display: inline-block; min-width: 2.4em; text-align: right; }
  /* ---- Claude 使用量の詳細ポップオーバー（#996） ----
     header は overflow:hidden なので、ヘッダー内に置くと下方向へ出るポップオーバーが
     切り取られる。そこで body 直下・position:fixed にし、開いた時に JS でアイコン直下へ
     配置する（usage フローの外なのでバー幅・中央位置に一切影響しない）。z-index は
     header(10)/footer(20) より上・log モーダル(50) より下に置く。 */
  .usagepop { position: fixed; display: none; z-index: 40; min-width: 15rem; max-width: 22rem;
              background: var(--ap-chrome-surface); color: var(--ap-chrome-ink); border: 1px solid var(--ap-chrome-line); border-radius: .4rem;
              padding: .6rem .75rem; font-size: .78rem; line-height: 1.5;
              box-shadow: 0 8px 24px var(--ap-shadow-pop); }
  .usagepop.open { display: block; }
  .usagepop .upop-row { margin-bottom: .5rem; }
  .usagepop .upop-row:last-child { margin-bottom: 0; }
  .usagepop .upop-label { font-weight: 600; color: var(--ap-chrome-ink-2); margin-bottom: .1rem; }
  .usagepop .upop-detail { color: var(--ap-chrome-dim); font-variant-numeric: tabular-nums; }
  header h1 { font-size: .95rem; margin: 0; font-weight: 600; }
  header .pill { flex: none; }
  header button { padding: .15rem .55rem; font-size: .8rem; cursor: pointer; border: 1px solid var(--ap-chrome-line);
                  background: var(--ap-chrome-btn); color: var(--ap-chrome-ink); border-radius: .3rem; }
  header button:hover { background: var(--ap-chrome-btn-hover); }
  header .meta { margin-left: auto; flex: 0 0 auto; width: 24rem; max-width: 40vw; text-align: right;
                 color: var(--ap-chrome-dim); font-size: .75rem; overflow: hidden; text-overflow: ellipsis;
                 font-variant-numeric: tabular-nums; }
  /* ---- 稼働バージョン + 更新バッジ（#885・スティッキーフッター） ---- */
  /* ヘッダーは Claude 使用量バーが中央を占めて余白が無いので、稼働バージョンと更新バッジは
     常時見えるスティッキーフッターに置く（issue はヘッダー or フッターを許容）。 */
  footer { position: sticky; bottom: 0; z-index: 20; display: flex; align-items: center; gap: .6rem;
           padding: .3rem .8rem; background: linear-gradient(100deg, var(--ap-chrome-1) 0%, var(--ap-chrome-2) 55%, var(--ap-chrome-3) 100%);
           color: var(--ap-chrome-dim); font-size: .75rem;
           border-top: 1px solid var(--ap-chrome-line); font-variant-numeric: tabular-nums; }
  footer .ver code { color: var(--ap-chrome-ink-2); background: var(--ap-chrome-code-bg); padding: 0 .3rem; border-radius: .2rem; }
  footer .upd-badge { padding: .1rem .55rem; font-size: .78rem; cursor: pointer; border: 1px solid var(--ap-update-line);
                      background: var(--ap-update); color: var(--ap-on-solid); font-weight: 600; border-radius: .3rem; }
  footer .upd-badge:hover { background: var(--ap-update-hover); }
  /* ---- 更新手順モーダル ---- */
  #updmodal { position: fixed; inset: 0; background: var(--ap-overlay); display: none; align-items: center;
              justify-content: center; z-index: 60; }
  #updmodal.open { display: flex; }
  #updmodal .box { background: var(--ap-surface); color: var(--ap-ink); width: min(92vw, 44rem); max-height: 85vh; border-radius: .5rem;
                   display: flex; flex-direction: column; overflow: hidden; }
  #updmodal .box header { position: static; border-radius: .5rem .5rem 0 0; }
  #updmodal .body { padding: .9rem 1rem; overflow: auto; font-size: .85rem; line-height: 1.55; }
  #updmodal h3 { font-size: .9rem; margin: .2rem 0 .5rem; }
  #updmodal ol { margin: .3rem 0 .8rem; padding-left: 1.3rem; }
  #updmodal code { background: var(--ap-code-bg); padding: 0 .3rem; border-radius: .2rem; font-size: .82rem; }
  #updmodal .cmd { display: block; background: var(--ap-term-bg); color: var(--ap-term-ink); padding: .4rem .6rem; border-radius: .3rem;
                   margin: .3rem 0; white-space: pre-wrap; word-break: break-all; }
  #updmodal .commits { margin: .4rem 0 0; border-top: 1px solid var(--ap-line); padding-top: .5rem; }
  #updmodal .commits li { font-size: .8rem; color: var(--ap-ink-2); margin-bottom: .15rem; }
  #updmodal .commits code { font-size: .76rem; }
  #updmodal .primary { background: var(--ap-primary); color: var(--ap-on-solid); border: 1px solid var(--ap-primary-line); padding: .1rem .5rem;
                       border-radius: .3rem; cursor: pointer; font-size: .78rem; }
  /* 狭い幅では中央 usage を隠して右 meta と重ならないようにする（usage は補助情報） */
  @media (max-width: 960px) { .usage { display: none; } }
  .pill { display: inline-block; padding: .05rem .5rem; border-radius: 1rem; font-size: .75rem; font-weight: 600; }
  .ok { background: var(--ap-ai-state-wash); color: var(--ap-ai-state); } .paused { background: var(--ap-stop-wash-2); color: var(--ap-stop); }
  .auth { background: var(--ap-notice-state-wash); color: var(--ap-notice); }
  .usagep { background: var(--ap-usage-state-wash); color: var(--ap-usage-state); }
  /* ---- アラート帯 ---- */
  .alert { display: flex; align-items: baseline; gap: .6rem; padding: .45rem .8rem; font-size: .85rem;
           border-bottom: 1px solid var(--ap-line); flex-wrap: wrap; }
  .alert.auth-a { background: var(--ap-notice-wash); color: var(--ap-notice); }
  .alert.block-a { background: var(--ap-stop-wash); color: var(--ap-stop); }
  .alert.usage-a { background: var(--ap-usage-wash); color: var(--ap-usage-ink); }
  /* ---- 人間待ちのまとめ（#1315） ---- */
  .human-waits { display: flex; flex-wrap: wrap; gap: .3rem 1rem; align-items: baseline; padding: .4rem .6rem;
                 margin-bottom: .5rem; background: var(--ap-surface); border: 1px solid var(--ap-line); border-radius: .35rem;
                 font-size: .82rem; }
  .human-waits .hw-title { font-weight: 700; color: var(--ap-ink-soft); }
  .human-waits .hw-count { color: var(--ap-muted); font-size: .75rem; }
  .human-waits a { margin-left: .15rem; }
  .alert.usage-a .uforce { margin-left: auto; display: inline-flex; gap: .4rem; align-items: baseline; }
  .alert code { background: var(--ap-tint-2); padding: 0 .3rem; border-radius: .2rem; }
  .alert button { font-size: .72rem; padding: .05rem .4rem; cursor: pointer; }
  .reauth-info { flex-basis: 100%; margin-top: .35rem; display: flex; gap: .5rem; align-items: center; flex-wrap: wrap;
                 padding: .35rem .5rem; background: var(--ap-tint-1); border-radius: .3rem; }
  .reauth-info code { font-size: 1rem; font-weight: 700; letter-spacing: .06em; }
  /* ---- 俯瞰ボード ---- */
  main { padding: .6rem .8rem 2rem; }
  /* #board のはみ出しはページ全体を崩さずスクロールで逃がす保険（列間引きと併用）#936 */
  .board-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; background: var(--ap-surface); font-size: .84rem; }
  th, td { border: 1px solid var(--ap-line); padding: .3rem .5rem; text-align: left; vertical-align: middle; }
  th { background: var(--ap-surface-2); font-size: .75rem; color: var(--ap-ink-soft); }
  tr.blocked-row td { background: var(--ap-stop-row); }
  tr.running-row td { background: var(--ap-ai-row); }
  td.title-cell { max-width: 34rem; }
  /* #Issue → PR チップ → ▼ → タイトル を 1 行に並べる。チップ/▼ は縮めず、タイトルだけ省略表示（#1212） */
  .title-line { display: flex; align-items: center; gap: .25rem; white-space: nowrap; min-width: 0; }
  .title-line > a, .title-line .prchip, .title-line .prmenu-btn, .title-line .copy-btn { flex: none; }
  /* 📋（Issue と PR をコピー）#1213。行の先頭に置くのでどの行でも同じ位置に出る */
  td button.copy-btn { font-size: .72rem; padding: 0 .2rem; line-height: 1.3; border: 1px solid transparent;
                       background: transparent; border-radius: .3rem; }
  td button.copy-btn:hover { border-color: var(--ap-line-strong); background: var(--ap-surface); }
  /* コピーできた行を一瞬光らせる。再描画で作り直されても animation-delay で経過分から続ける。
     to を書かないので、blocked-row / running-row の行は元の背景色へ戻る（透明を経由しない） */
  @keyframes copied-flash { from { background-color: var(--ap-flash); } }
  #board tr.copied-row > td { animation: copied-flash 1.2s ease-out; animation-delay: var(--flash-delay, 0ms); }
  .title-line .prchip { margin: 0; }
  .title-line .t { flex: 0 1 auto; min-width: 0; }
  td button.prmenu-btn { font-size: .62rem; padding: 0 .3rem; line-height: 1.3; border: 1px solid var(--ap-line-strong);
                         background: var(--ap-surface); color: var(--ap-ink-soft); border-radius: .3rem; }
  td button.prmenu-btn[aria-expanded="true"] { background: var(--ap-selected); color: var(--ap-on-solid); border-color: var(--ap-selected); }
  /* ▼ のメニュー。.board-wrap の overflow で切れないよう fixed でボタン直下に出す（1 つだけ） */
  #prmenu { position: fixed; z-index: 40; display: none; min-width: 11rem; background: var(--ap-surface); border: 1px solid var(--ap-line-strong);
            border-radius: .35rem; box-shadow: 0 6px 18px var(--ap-shadow-menu); padding: .25rem 0; font-size: .8rem; }
  #prmenu.open { display: block; }
  #prmenu a { display: flex; gap: .4rem; align-items: baseline; padding: .25rem .7rem; color: var(--ap-ink); white-space: nowrap; }
  #prmenu a:hover { background: var(--ap-surface-2); text-decoration: none; }
  #prmenu .pm-state { margin-left: auto; font-size: .72rem; color: var(--ap-muted); }
  .t { display: inline-block; max-width: 30rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
  /* ---- 狭幅（〜820px 目安）で情報量を落として崩れを防ぐ #936 ----
     モバイル対応は不要（横 640px 程度が最小想定）。nth-child は表示/非表示で
     位置番号がズレないので、Size(3) を隠しても 担当(5) の index は変わらない。
     colspan="7" のフォールバック行は td が1つなので誤って隠れない。 */
  @media (max-width: 820px) {
    #board th:nth-child(3), #board td:nth-child(3) { display: none; } /* Size */
    #board th:nth-child(5), #board td:nth-child(5) { display: none; } /* 担当 */
    #board td:nth-child(6) .bar, #board td:nth-child(6) .sub-pct { display: none; } /* Sub-issues: バー/％を隠し件数のみ */
    #board td:nth-child(7) .subtext { display: none; } /* Now: 「人間の番」「N分」等の subtext を隠しアイコン/phase-pill/log を残す */
    .t { max-width: 15rem; }
    th, td { padding: .3rem .35rem; }
  }
  .status-pill { display: inline-block; padding: .05rem .45rem; border-radius: .3rem; font-size: .75rem; font-weight: 600; white-space: nowrap; }
  /* ---- Size バッジ（S=緑 / M=琥珀 / L=赤）#884 ---- */
  .size-badge { display: inline-block; min-width: 1.1rem; padding: .05rem .4rem; border-radius: .3rem; font-size: .75rem; font-weight: 700; text-align: center; }
  .size-s { background: var(--ap-size-s-wash); color: var(--ap-size-s); }
  .size-m { background: var(--ap-size-m-wash); color: var(--ap-size-m); }
  .size-l { background: var(--ap-size-l-wash); color: var(--ap-size-l); }
  /* ---- Awaiting Continuation バッジ（協調的チェックポイント・EPIC #906）#913 ---- */
  .ai-continuation-badge { display: inline-block; padding: .05rem .45rem; border-radius: .3rem; font-size: .75rem;
                            font-weight: 600; white-space: nowrap; background: var(--ap-human-wash); color: var(--ap-human); }
  .muted { color: var(--ap-muted); }
  .prchip { display: inline-block; margin: 0 .15rem .1rem 0; padding: 0 .35rem; border-radius: .3rem;
            font-size: .75rem; white-space: nowrap; border: 1px solid transparent; }
  .pr-conflict { outline: 2px solid var(--ap-conflict-strong); outline-offset: -1px; }
  td button.resolve-btn { white-space: nowrap; color: var(--ap-conflict); border: 1px solid var(--ap-conflict-line); background: var(--ap-conflict-wash); }
  td button.resolve-btn[disabled] { cursor: progress; opacity: .6; }
  .pr-draft { background: var(--ap-idle-wash); color: var(--ap-idle); border-color: var(--ap-idle-line); }
  .pr-ready { background: var(--ap-done-wash); color: var(--ap-done); border-color: var(--ap-done-line); }
  .pr-merged { background: var(--ap-merged-wash); color: var(--ap-merged); border-color: var(--ap-merged-line); }
  .pr-closed { background: var(--ap-closed-wash); color: var(--ap-closed); text-decoration: line-through; }
  .bar { width: 90px; height: 8px; background: var(--ap-track); border-radius: 4px; overflow: hidden; display: inline-block; vertical-align: middle; }
  .bar > div { height: 100%; background: var(--ap-progress); }
  .subtext { font-size: .72rem; color: var(--ap-muted); margin-left: .3rem; white-space: nowrap; }
  .phase-pill { background: var(--ap-ai-phase-wash); color: var(--ap-ai-phase); padding: .05rem .45rem; border-radius: .3rem; font-size: .75rem; font-weight: 600; white-space: nowrap; }
  td button { font-size: .72rem; padding: .05rem .45rem; cursor: pointer; }
  /* ---- [通常] / [あとでやる] タブ（#1190） ---- */
  .tabs { display: flex; gap: .3rem; margin: 0 0 .4rem; }
  .tabs button { font-size: .8rem; padding: .2rem .7rem; cursor: pointer; border: 1px solid var(--ap-line);
                 background: var(--ap-surface); color: var(--ap-ink-soft); border-radius: .3rem .3rem 0 0; }
  .tabs button.active { background: var(--ap-selected); color: var(--ap-on-solid); border-color: var(--ap-selected); font-weight: 600; }
  .tabs .tab-count { display: inline-block; min-width: 1.2rem; margin-left: .25rem; padding: 0 .3rem; border-radius: .6rem;
                     background: var(--ap-count-wash); font-size: .72rem; text-align: center; }
  .tabs .tab-warn { margin-left: .3rem; padding: 0 .35rem; border-radius: .3rem; background: var(--ap-notice-tab-wash); color: var(--ap-notice-tab);
                    font-size: .72rem; font-weight: 600; }
  td button.later-btn { white-space: nowrap; }
  td button.later-btn[disabled] { cursor: progress; opacity: .6; }
  /* ---- 優先度と並列の計画（EPIC #2384） ---- */
  .prio { display: inline-flex; align-items: center; gap: .1rem; margin-right: .3rem; white-space: nowrap; }
  .prio b { font-size: .72rem; padding: 0 .3rem; border-radius: .3rem; background: var(--ap-prio-wash); color: var(--ap-prio); }
  .prio b.p0 { background: var(--ap-prio0-wash); color: var(--ap-prio0); } .prio b.p1 { background: var(--ap-prio1-wash); color: var(--ap-prio1); }
  .prio b.inh { font-weight: 400; font-style: italic; }
  .prio button { font-size: .6rem; padding: 0 .2rem; line-height: 1.1; }
  #schedule { font-size: .75rem; color: var(--ap-muted); margin: .2rem 1rem; }
  #schedule button { font-size: .7rem; padding: 0 .3rem; }
  h2 { font-size: .85rem; color: var(--ap-muted); margin: 1.2rem 0 .4rem; }
  /* ---- log モーダル ---- */
  #modal { position: fixed; inset: 0; background: var(--ap-overlay); display: none; align-items: center; justify-content: center; z-index: 50; }
  #modal.open { display: flex; }
  #modal .box { background: var(--ap-term-bg); color: var(--ap-term-ink); width: min(90vw, 70rem); max-height: 85vh; border-radius: .5rem;
                display: flex; flex-direction: column; }
  #modal .box header { position: static; border-radius: .5rem .5rem 0 0; }
  #modal pre { margin: 0; padding: .8rem; overflow: auto; white-space: pre-wrap; font-size: .78rem; flex: 1; }
  /* EPIC ごと（#2388） */
  #epicgroups { margin: 8px 0 14px; }
  .epic-head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .epic-head h2 { margin: 0; }
  .epic-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; margin-top: 6px; }
  .epic-card { border: 1px solid var(--ap-line); border-radius: 8px; padding: 6px 10px; font-size: 13px; }
  .epic-card ul { margin: 4px 0 0; padding-left: 1.2em; }
  .epic-prog .bar i { display: block; height: 100%; background: var(--ap-progress); }
  .chip { font-size: 11px; padding: 0 6px; border: 1px solid var(--ap-line-strong); border-radius: 99px; margin-left: 2px; }
  .chip.run { color: var(--ap-ai-chip); border-color: var(--ap-ai-chip); } .chip.wait { color: var(--ap-human-chip); border-color: var(--ap-human-chip); }
  .cs-err { color: var(--ap-notice-err); }
${LEARN_TASKS_CSS}</style></head><body>
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
<div id="schedule" data-testid="schedule-plan"></div>
<main>
  ${BLOCKED_PANEL_HTML}
  <div id="humanwaits"></div>
  <div id="epicgroups" data-testid="epic-groups"></div>
  <div id="tabs" class="tabs" role="tablist"></div>
  <div class="board-wrap">
  <table id="board"><thead><tr>
    <th>Issue</th><th>Status</th><th>Size</th><th>AI</th><th>担当</th><th>Sub-issues</th><th>Now</th>
  </tr></thead><tbody id="rows"><tr><td colspan="7" class="muted">読み込み中…</td></tr></tbody></table>
  </div>
  ${LEARN_TASKS_HTML}
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
<div id="usagepop" role="dialog" aria-label="Claude 使用量の詳細" class="usagepop"><div id="usagepopbody"></div></div>
<div id="prmenu" role="menu"></div>
<div id="modal"><div class="box">
  <header><h1 id="mtitle">log</h1>
    <button id="mreload">↻ 更新</button>
    <span class="meta"></span>
    <button id="mclose">✕ 閉じる</button>
  </header>
  <pre id="mlog"></pre>
</div></div>
<script>
// 書き込み（GET / HEAD 以外）の fetch に合言葉のヘッダを付ける（EPIC #2384 U3）。
// どの欄の fetch も通るように、ほかのスクリプトより先に window.fetch を 1 か所で包む。
(() => {
  const meta = document.querySelector('meta[name="autopilot-token"]');
  const token = meta ? meta.content : '';
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const opts = init || {};
    const method = String(opts.method || (input && input.method) || 'GET').toUpperCase();
    const url = new URL(typeof input === 'string' ? input : (input && input.url) || '', location.href);
    if (method === 'GET' || method === 'HEAD' || url.origin !== location.origin) return origFetch(input, init);
    const headers = new Headers(opts.headers || {});
    headers.set('X-Autopilot-Token', token);
    return origFetch(input, { ...opts, headers });
  };
})();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repoUrl = 'https://github.com/smalruby/smalruby3-editor';
const STATUS_COLORS = {
  'New Item': ['var(--ap-idle-wash)', 'var(--ap-idle)'], 'Backlog': ['var(--ap-idle-backlog-wash)', 'var(--ap-idle-backlog)'],
  'Sprint Backlog': ['var(--ap-idle-sprint-wash)', 'var(--ap-idle-sprint)'], 'In Progress': ['var(--ap-ai-wash)', 'var(--ap-ai)'],
  'Blocked': ['var(--ap-stop-wash-2)', 'var(--ap-stop)'], 'Review': ['var(--ap-human-wash)', 'var(--ap-human)'], 'DoD': ['var(--ap-human-dod-wash)', 'var(--ap-human-dod)'],
};
const statusPill = (s) => {
  const [bg, fg] = STATUS_COLORS[s] || ['var(--ap-idle-wash)', 'var(--ap-idle)'];
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
  // GitHub が判定したコンフリクト（#1348）。OPEN の PR だけ。UNKNOWN（計算中）は印を付けない
  const conflict = p.state === 'OPEN' && p.mergeable === 'CONFLICTING';
  return '<a class="prchip ' + cls + (conflict ? ' pr-conflict' : '') + '" target="_blank" rel="noopener" href="'
    + repoUrl + '/pull/' + p.number + '"' + (conflict ? ' title="base とコンフリクトしています" data-testid="board-pr-conflict"' : '') + '>'
    + icon + ' PR#' + p.number + (conflict ? ' ⚠️' : '') + '</a>';
};
// ---- 📋 Issue と PR をコピー（#1213） ----
// 光らせる演出は 5 秒ごとの innerHTML 再描画で行ごと作り直されるため、対象の Issue と開始時刻を
// 覚えておき、描画のたびに負の animation-delay で経過分から続ける（最初からやり直さない）。
const COPY_FLASH_MS = 1200;
let copyFlash = null;    // { issue, at }
const copyBtn = (it) => '<button type="button" class="copy-btn" data-testid="board-copy-issue" data-issue="' + it.issue + '"'
  + ' title="Issue と PR をコピー" aria-label="Issue と PR をコピー" onclick="copyIssue(' + it.issue + ')">📋</button>';
// 光っている途中の行だけ class と経過時間を返す（tr に付ける属性の断片）
const copyFlashAttrs = (it) => {
  if (!copyFlash || copyFlash.issue !== it.issue) return '';
  const elapsed = Date.now() - copyFlash.at;
  if (elapsed >= COPY_FLASH_MS) return '';
  return ' copied-row" style="--flash-delay:-' + elapsed + 'ms';
};
async function copyIssue(issue) {
  const it = ((lastBoard && lastBoard.items) || []).find((x) => x.issue === issue);
  if (!it) return;
  // fallback（prompt で表示）のときはコピーできたか分からないので光らせない
  if (!await copyText(issueCopyText(it, repoUrl))) return;
  copyFlash = { issue, at: Date.now() };
  for (const tr of document.querySelectorAll('#rows tr[data-issue="' + issue + '"]')) {
    tr.style.setProperty('--flash-delay', '0ms');
    tr.classList.remove('copied-row');
    void tr.offsetWidth; // 連打でもアニメーションを最初から再生する
    tr.classList.add('copied-row');
  }
}
const PR_KIND_ICON = { open: '✅', draft: '📝', merged: '🟣', closed: '❌' };

// ---- ▼ PR メニュー（#1212） ----
// 一覧は 5 秒ごとに innerHTML で作り直すので、開いている Issue 番号を状態に持ち、
// 描画のたびに新しい ▼ ボタンへ付け直す（restorePrMenu）。メニュー要素は 1 つだけ。
let prMenuIssue = null;
let prMenuItems = {};    // 直近の描画での issue → splitPrsForTitle(...).menu
let prMenuHtml = '';     // #prmenu に今入っている HTML（同一内容の再描画を避ける）
const prMenuBtn = (it, menu) => {
  prMenuItems[it.issue] = menu;
  return '<button type="button" class="prmenu-btn" data-issue="' + it.issue + '" aria-haspopup="menu"'
    + ' aria-expanded="' + (prMenuIssue === it.issue) + '" title="この Issue のすべての PR（merged / closed を含む）"'
    + ' onclick="togglePrMenu(' + it.issue + ', event)">▼</button>';
};
function placePrMenu() {
  const el = document.getElementById('prmenu');
  const btn = document.querySelector('.prmenu-btn[data-issue="' + prMenuIssue + '"]');
  if (!btn) { closePrMenu(); return; }
  const rect = btn.getBoundingClientRect();
  el.style.top = Math.round(rect.bottom + 2) + 'px';
  el.style.left = Math.round(Math.max(4, Math.min(rect.left, window.innerWidth - el.offsetWidth - 4))) + 'px';
}
function openPrMenu(issue) {
  const menu = prMenuItems[issue];
  if (!menu || !menu.length) { closePrMenu(); return; }
  prMenuIssue = issue;
  const el = document.getElementById('prmenu');
  const html = menu.map((p) => '<a role="menuitem" target="_blank" rel="noopener" href="' + repoUrl + '/pull/' + p.number
    + '" onclick="setTimeout(closePrMenu, 0)">' + PR_KIND_ICON[p.kind] + ' PR#' + p.number
    + '<span class="pm-state">' + p.kind + '</span></a>').join('');
  // 5 秒ごとの復元で中身が同じなら作り直さない（押下中の項目が差し替わってクリックが消えるのを防ぐ）
  if (html !== prMenuHtml) { el.innerHTML = html; prMenuHtml = html; }
  el.classList.add('open');
  document.querySelectorAll('.prmenu-btn').forEach((b) =>
    b.setAttribute('aria-expanded', String(Number(b.dataset.issue) === issue)));
  placePrMenu();
}
function closePrMenu() {
  prMenuIssue = null;
  const el = document.getElementById('prmenu');
  prMenuHtml = '';
  if (el) { el.classList.remove('open'); el.innerHTML = ''; }
  document.querySelectorAll('.prmenu-btn[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
function togglePrMenu(issue, ev) {
  if (ev) ev.stopPropagation();
  if (prMenuIssue === issue) closePrMenu(); else openPrMenu(issue);
}
// 再描画後に開いていたメニューを復元する（行が消えた / ▼ が不要になったら閉じる）
function restorePrMenu() {
  if (prMenuIssue != null) openPrMenu(prMenuIssue);
}
document.addEventListener('click', (e) => {
  if (prMenuIssue == null) return;
  if (e.target.closest && (e.target.closest('#prmenu') || e.target.closest('.prmenu-btn'))) return;
  closePrMenu();
});
window.addEventListener('resize', () => { if (prMenuIssue != null) placePrMenu(); });
window.addEventListener('scroll', () => { if (prMenuIssue != null) placePrMenu(); }, true);
const mins = (ms) => Math.max(0, Math.round(ms / 60000));
let logIssue = null;
let logTimer = null;

// ---- 💤 あとでやる（#1190） ----
// 判断ロジック（タブ振り分け・⚠ 集計・ボタン出し分け・楽観的更新/連打対策の状態遷移）は
// phases.js の純粋関数をそのまま埋め込む（canToggleLater / effectiveLater / splitLaterBoard /
// laterPendingReducer）。
${SHARED_CLIENT_FNS}
// 人間待ちの理由（表示順・文言）。phases.js の HUMAN_WAIT_REASONS をそのまま埋め込む（#1315）
const HUMAN_WAIT_REASONS = ${JSON.stringify(HUMAN_WAIT_REASONS)};
const BOARD_TAB_KEY = 'autopilot:boardTab';
let boardTab = 'normal';
try { if (localStorage.getItem(BOARD_TAB_KEY) === 'later') boardTab = 'later'; } catch (e) { /* storage 不可でも動く */ }
let lastBoard = null;    // 直近の /board 応答（クリック時の再描画用）
let laterPending = {};   // laterPendingReducer の状態（保留中の Issue だけ）
let laterSeq = 0;
let laterError = null;   // 直近の失敗（アラート帯に出す）
let usageForceConfirm = false; // 強制再開の 2 段階目（確認）を表示中か（#1193。confirm ダイアログは使わない）

// Claude アイコン（インライン SVG・自己完結。外部リソース禁止）。
// クリック/キーボードで使用量詳細ポップオーバーを開くトリガーを兼ねる（#996）。
// aria-label="Claude" は #879 の互換のため維持し、操作ヒントは title で補う。
const USAGE_ICON = '<svg class="uicon" viewBox="0 0 100 100" width="15" height="15"'
  + ' role="button" tabindex="0" aria-expanded="false" aria-haspopup="dialog" aria-label="Claude"'
  + ' title="クリックで使用量の詳細（セッション / 週間）を表示">'
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

// 使用量詳細ポップオーバー 1 行分（ラベル + 「N% 使用済み ・ <日時> にリセット」）を組む。
// percent が取れないウィンドウは「—（未取得）」でレイアウトを崩さない（#996）。
// リセット日時は既存の resetLabel(resetsAt)（JST 整形）を再利用する。
function usagePopRow(label, w) {
  const hasPct = w && w.percent != null;
  const pct = hasPct ? Math.round(Math.max(0, Math.min(100, Number(w.percent) || 0))) : null;
  const reset = w ? resetLabel(w.resetsAt) : '';
  const detail = (hasPct ? pct + '% 使用済み' : '—（未取得）')
    + (reset ? ' ・ ' + esc(reset) + ' にリセット' : '');
  return '<div class="upop-row"><div class="upop-label">' + esc(label) + '</div>'
    + '<div class="upop-detail">' + detail + '</div></div>';
}

// ポップオーバー本文（セッション + 週間の 2 行）を組む。新規のデータ取得はせず
// renderUsage に渡ってくる claudeUsage をそのまま使う（#996）。
function renderUsagePop(u) {
  const uu = u || {};
  return usagePopRow('現在のセッション', uu.session)
    + usagePopRow('週間制限（すべてのモデル）', uu.weekly);
}

function renderUsage(d) {
  const u = d.claudeUsage || {};
  document.getElementById('usage').innerHTML = USAGE_ICON
    + usageBar(u.session, 'セッション使用率（直近5時間）')
    + '<span class="usep">/</span>'
    + usageBar(u.weekly, '週間使用率（7日）')
    + usageAge(u);
  // 詳細ポップオーバー本文を最新値で更新（開いていなくても次に開いた時に最新になる）。
  document.getElementById('usagepopbody').innerHTML = renderUsagePop(u);
  // アイコンは innerHTML で置き換わり aria-expanded が既定（false）に戻るので、
  // 現在の開閉状態へ同期し直す（開いたまま refresh されても状態が食い違わない）。
  const icon = document.querySelector('#usage .uicon');
  if (icon) icon.setAttribute('aria-expanded', usagePopOpen ? 'true' : 'false');
}

// ---- 使用量詳細ポップオーバーの開閉（#996） ----
// アイコンのクリック / Enter / Space で開閉、外側クリック・Esc で閉じる。
// アイコンは refresh のたび innerHTML で再生成されるためイベント委譲で拾う。
let usagePopOpen = false;
function positionUsagePop() {
  const icon = document.querySelector('#usage .uicon');
  const pop = document.getElementById('usagepop');
  if (!icon || !pop) return;
  const r = icon.getBoundingClientRect();
  pop.style.top = (r.bottom + 6) + 'px';
  // 右端がビューポートをはみ出さないよう収める（左端は 8px を下限に）。
  const left = Math.min(r.left, window.innerWidth - pop.offsetWidth - 8);
  pop.style.left = Math.max(8, left) + 'px';
}
function openUsagePop() {
  const pop = document.getElementById('usagepop');
  pop.classList.add('open');
  usagePopOpen = true;
  positionUsagePop();
  const icon = document.querySelector('#usage .uicon');
  if (icon) icon.setAttribute('aria-expanded', 'true');
}
function closeUsagePop() {
  const pop = document.getElementById('usagepop');
  pop.classList.remove('open');
  usagePopOpen = false;
  const icon = document.querySelector('#usage .uicon');
  if (icon) icon.setAttribute('aria-expanded', 'false');
}
function toggleUsagePop() { if (usagePopOpen) closeUsagePop(); else openUsagePop(); }

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

// 使用量枠の表示名（#1193）
function usageWindowLabel(w) { return w === 'weekly' ? '週間' : 'セッション'; }
// リセット時刻を短く（JST の HH:MM。今日でなければ M/D HH:MM）。無効値は空文字。
function resetClock(resetsAt) {
  if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt) || resetsAt <= 0) return '';
  const ms = resetsAt < 1e12 ? resetsAt * 1000 : resetsAt;
  const day = (t) => new Date(t).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const hm = new Date(ms).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false });
  if (day(ms) === day(Date.now())) return hm;
  return new Date(ms).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }) + ' ' + hm;
}
// Claude 使用量の自動 pause（2 段階の強制再開つき）と強制実行中の表示（#1193）
function usageAlerts(d) {
  const out = [];
  const P = d.usagePause;
  if (d.pausedBy === 'usage' && P && P.pause) {
    const pct = Math.round(P.percent);
    const reset = resetClock(P.resetsAt);
    const ctl = usageForceConfirm
      ? '本当に再開？ 使用量 ' + pct + '% <button data-testid="usage-force-confirm" onclick="forceResume()">再開する</button>'
        + '<button data-testid="usage-force-cancel" onclick="usageForceConfirm = false; rerender()">やめる</button>'
      : '<button data-testid="usage-force-resume" onclick="usageForceConfirm = true; rerender()">⚡ 強制再開…</button>';
    out.push('<div class="alert usage-a" data-testid="usage-pause-alert">⚠ <b>Claude 使用量が上限に近いため自動 pause 中</b>'
      + '<span>' + usageWindowLabel(P.window) + ' ' + pct + '%（上限 ' + P.threshold + '%）' + (reset ? ' · リセット ' + esc(reset) : '') + '</span>'
      + '<span class="subtext">新しいタスクは入りません。実行中の worker は継続</span>'
      + '<span class="uforce">' + ctl + '</span></div>');
  } else {
    usageForceConfirm = false;
  }
  for (const f of (P && P.forced) || []) {
    const reset = resetClock(f.resetsAt);
    out.push('<div class="alert usage-a" data-testid="usage-forced-alert">⚡ <b>強制実行中</b>（'
      + usageWindowLabel(f.window) + ' ' + Math.round(f.percent) + '%' + (reset ? ' · 〜' + esc(reset) + ' まで' : '') + '）'
      + '<span class="subtext">枠のリセットで自動的に通常の判定へ戻ります</span></div>');
  }
  return out;
}
async function forceResume() {
  usageForceConfirm = false;
  try { await fetch('/force-resume', { method: 'POST' }); } catch (e) { /* refresh 側で表示 */ }
  refresh();
}

function renderAlerts(d) {
  const parts = usageAlerts(d);
  if (d.notice === 'starting') {
    // 起動中（#1510）: 認証は通っていて Project 情報を取っている。数秒で稼働に変わる
    parts.push('<div class="alert auth-a">⏳ <b>起動中…</b> <span>Project の情報を取っています。</span></div>');
  }
  if (d.authError) {
    const R = d.reauth;
    let ra = '';
    if (R && R.status === 'pending' && (R.code || R.url)) {
      ra = '<div class="reauth-info">📱 デバイス認証'
        + (R.code ? ' コード <code>' + esc(R.code) + '</code> <button onclick="copyText(&quot;' + esc(R.code) + '&quot;)">📋 コピー</button>' : '')
        + (R.url ? ' <a target="_blank" rel="noopener" href="' + esc(R.completeUrl || R.url) + '">🔗 認証ページを開く</a>' : '')
        + '<span class="subtext">ホストのブラウザでコードを承認すると autopilot が自動で' + (d.booting ? '起動' : '再開') + 'します</span></div>';
    } else if (R && R.status === 'error') {
      ra = '<div class="reauth-info">⚠️ 再接続に失敗: ' + esc(R.error || '') + '</div>';
    } else if (R && R.status === 'starting') {
      ra = '<div class="reauth-info">⏳ SSO ログインを起動中…</div>';
    }
    // 起動待ち（#1510）: devpod の再起動直後など、SSO が切れたまま起動した。エラーではなく次の手順として見せる
    const head = d.booting
      ? (d.notice === 'boot-not-sso'
        ? '🔐 <b>bot トークンが取れません（autopilot は起動待ち）</b>'
        : '🔐 <b>SSO ログインが必要です（autopilot は起動待ち）</b>')
        + ' <span>' + esc(d.reauthHint || '') + '</span>'
        + '<details><summary>詳細</summary>' + esc(d.authError) + '</details>'
      : '🔐 <b>認証エラー（auto-pause 中）</b> ' + esc(d.authError) + '<span>' + esc(d.reauthHint || '') + '</span>';
    parts.push('<div class="alert auth-a">' + head
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
  // あとでやる 内の人間の番も見落とさないよう上部に出す（Blocked は上の共通アラートで出る）#1190
  const laterHitl = splitLaterBoard(d.items, laterPending, (d.running || []).map((r) => r.issue)).later
    .filter((it) => it.hitl && it.status !== 'Blocked');
  if (laterHitl.length) {
    const links = laterHitl.map((it) => '<a target="_blank" rel="noopener" href="' + esc(it.url) + '">#' + it.issue + '</a>').join(' ');
    parts.push('<div class="alert auth-a">💤🙋 <b>あとでやる に人間の番 ' + laterHitl.length + ' 件</b> ' + links + '</div>');
  }
  if (resolveError) {
    parts.push('<div class="alert block-a">⚠️ <b>コンフリクト解消の依頼に失敗</b> ' + esc(resolveError)
      + ' <button onclick="resolveError = null; rerender()">✕</button></div>');
  }
  if (laterError) {
    parts.push('<div class="alert block-a">⚠️ <b>あとでやる の切り替えに失敗</b>（元に戻しました） ' + esc(laterError)
      + ' <button onclick="laterError = null; rerender()">✕</button></div>');
  }
  document.getElementById('alerts').innerHTML = parts.join('');
}

// [通常 N] [あとでやる M ⚠…] タブ（件数バッジ付き）。⚠ は あとでやる 内の実行中・人間の番。
function renderTabs(split) {
  const warnParts = [];
  if (split.laterRunning) warnParts.push('実行中 ' + split.laterRunning);
  if (split.laterHitl) warnParts.push('人間の番 ' + split.laterHitl);
  const warn = warnParts.length
    ? '<span class="tab-warn" title="あとでやる 内の動き">⚠ ' + warnParts.join('・') + '</span>'
    : '';
  const tab = (key, label, n, extra) => '<button role="tab" data-tab="' + key + '" aria-selected="' + (boardTab === key)
    + '" class="' + (boardTab === key ? 'active' : '') + '" onclick="setBoardTab(&quot;' + key + '&quot;)">'
    + label + '<span class="tab-count">' + n + '</span>' + extra + '</button>';
  document.getElementById('tabs').innerHTML = tab('normal', '通常', split.normal.length, '')
    + tab('later', '💤 あとでやる', split.later.length, warn);
}
function setBoardTab(t) {
  boardTab = t === 'later' ? 'later' : 'normal';
  try { localStorage.setItem(BOARD_TAB_KEY, boardTab); } catch (e) { /* storage 不可でも動く */ }
  rerender();
}
function rerender() {
  if (!lastBoard) return;
  renderAlerts(lastBoard);
  renderBoard(lastBoard);
}
// Now 列末尾の [💤 あとで] / [↩ 今やる]。終端 Status には出さない。送信中は disabled（二重送信防止）。
function laterButton(it) {
  if (!canToggleLater(it)) return '';
  const p = laterPending[it.issue];
  if (p && p.inFlight) return ' <button class="later-btn" data-later-issue="' + it.issue + '" disabled>⏳ 処理中</button>';
  const isLater = effectiveLater(it, laterPending);
  return isLater
    ? ' <button class="later-btn" data-later-issue="' + it.issue + '" title="あとでやる から通常に戻す（💤 later を外す）" onclick="toggleLater(' + it.issue + ', false)">↩ 今やる</button>'
    : ' <button class="later-btn" data-later-issue="' + it.issue + '" title="あとでやる に移す（💤 later を付ける・autopilot の処理は変わらない）" onclick="toggleLater(' + it.issue + ', true)">💤 あとで</button>';
}
// コンフリクト解消ボタン（#1348）。押すと POST /resolve-conflict。daemon は Status と 🙋 を変えずに
// 解消だけ行う（実行中は running に出るので、ボタンは消えて phase 表示に変わる）。
let resolveRequested = {}; // { [issue]: true } 送信中
let resolveError = null;
function resolveButton(it, runningIssues) {
  if (!canResolveConflict(it, runningIssues)) return '';
  if (resolveRequested[it.issue]) return ' <button class="resolve-btn" disabled>⏳ 依頼中</button>';
  return ' <button class="resolve-btn" data-testid="board-resolve-conflict" data-issue="' + it.issue + '"'
    + ' title="base とのコンフリクトを AI が解消する（Status と 🙋 は変えない）" onclick="resolveConflict(' + it.issue + ')">🔀 解消</button>';
}
async function resolveConflict(issue) {
  if (resolveRequested[issue]) return;
  resolveRequested[issue] = true;
  resolveError = null;
  rerender();
  try {
    const r = await fetch('/resolve-conflict?issue=' + issue, { method: 'POST' });
    let j = {};
    try { j = await r.json(); } catch (e) { /* 本文なし */ }
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  } catch (e) {
    resolveError = '#' + issue + ': ' + e.message;
  }
  delete resolveRequested[issue];
  await refresh();
}
// 楽観的更新: 先に画面上で移動 → 裏で POST /later → 失敗時は最後に確定した状態へ戻す。
// ボード再取得は撃たない（daemon がキャッシュ上の labels を書き換える）。
async function toggleLater(issue, later) {
  const cur = laterPending[issue];
  if (cur && cur.inFlight) return;
  const it = ((lastBoard && lastBoard.items) || []).find((x) => x.issue === issue);
  const seq = ++laterSeq;
  laterPending = laterPendingReducer(laterPending,
    { type: 'request', issue, later, current: effectiveLater(it, laterPending), seq });
  laterError = null;
  rerender();
  try {
    const r = await fetch('/later', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ issue, later }) });
    let j = {};
    try { j = await r.json(); } catch (e) { /* 本文なし */ }
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    laterPending = laterPendingReducer(laterPending, { type: 'success', issue, seq, later: Boolean(j.later) });
  } catch (e) {
    laterPending = laterPendingReducer(laterPending, { type: 'failure', issue, seq, error: e.message });
    laterError = '#' + issue + ': ' + e.message;
  }
  rerender();
}

// ---- 優先度の ▲▼ と並列の計画の 1 行（EPIC #2384） ----
// 自分の Priority が無い行は親（EPIC）から継いだ値を斜体で出す。EPIC の行で動かすと継いでいる sub-issue にも効く。
function prioCtl(it) {
  const e = it.effectivePriority || { priority: it.priority || 'P2', source: it.priority ? 'own' : 'default' };
  const p = e.priority || 'P2';
  const tip = e.source === 'own' ? '優先度 ' + p : (e.source === 'inherited' ? '#' + e.from + ' から継いだ優先度 ' + p : '優先度は未設定（既定 ' + p + '）');
  const epic = (it.tracker || it.kind === 'EPIC') ? '（EPIC: 継いでいる sub-issue にも効く）' : '';
  return '<span class="prio" data-testid="board-priority" data-issue="' + it.issue + '">'
    + '<b class="' + p.toLowerCase() + (e.source === 'own' ? '' : ' inh') + '" title="' + esc(tip + epic) + '">' + p + '</b>'
    + '<button data-testid="board-priority-up" title="優先度を上げる' + epic + '" onclick="movePriority(' + it.issue + ', -1)">▲</button>'
    + '<button data-testid="board-priority-down" title="優先度を下げる' + epic + '" onclick="movePriority(' + it.issue + ', 1)">▼</button></span>';
}
// step: -1 = 上げる / 1 = 下げる（onclick に文字列を書かない: このスクリプトは template literal の中）
async function movePriority(issue, step) {
  const direction = step < 0 ? 'up' : 'down';
  try {
    const r = await fetch('/priority', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ issue, direction }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    const it = lastBoard && (lastBoard.items || []).find((x) => x.issue === issue);
    if (it) { it.priority = j.priority; it.effectivePriority = { priority: j.priority, source: 'own', from: null }; }
    rerender();
  } catch (e) { alert('#' + issue + ' の優先度を変えられませんでした: ' + e.message); }
}
function renderSchedule(d) {
  const el = document.getElementById('schedule');
  if (!el) return;
  const L = d.schedulerLimits || {};
  const ov = d.schedulerOverrides || {};
  const step = (k, delta) => '<button data-testid="schedule-' + k + '-' + (delta > 0 ? 'up' : 'down') + '" onclick="changeLimit(' + LIMIT_KEYS.indexOf(k) + ', ' + delta + ')">' + (delta > 0 ? '+' : '−') + '</button>';
  const reason = d.schedule ? esc(d.schedule.reason) : '（まだ計画していません）';
  el.innerHTML = '🧮 ' + reason + ' · 上限 全体 ' + step('maxTotal', -1) + ' <b>' + (L.maxTotal ?? '?') + '</b> ' + step('maxTotal', 1)
    + ' 重い ' + step('maxHeavy', -1) + ' <b>' + (L.maxHeavy ?? '?') + '</b> ' + step('maxHeavy', 1)
    + (Object.keys(ov).length ? ' <span title="モニターで変えた値（再起動で消える）">（一時変更中 <button onclick="resetLimits()">戻す</button>）</span>' : '');
}
async function postScheduler(body) {
  try {
    const r = await fetch('/scheduler', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (lastBoard) { lastBoard.schedulerLimits = j.limits; lastBoard.schedulerOverrides = j.overrides; renderSchedule(lastBoard); }
  } catch (e) { alert('上限を変えられませんでした: ' + e.message); }
}
const LIMIT_KEYS = ['maxTotal', 'maxHeavy'];
function changeLimit(idx, delta) {
  const k = LIMIT_KEYS[idx];
  const cur = (lastBoard && lastBoard.schedulerLimits && lastBoard.schedulerLimits[k]) || 0;
  postScheduler({ [k]: Math.max(0, cur + delta) });
}
function resetLimits() { postScheduler({ maxTotal: null, maxHeavy: null }); }

function renderBoard(d) {
  const runningBy = {};
  for (const r of d.running || []) runningBy[r.issue] = r;
  // 自分の login（--assignee）。共同担当で自分がオーナーでない行に「観察中」マーカーを出す（#938）。
  const myAssignee = d.assignee || null;
  const split = splitLaterBoard(d.items, laterPending, (d.running || []).map((r) => r.issue));
  // 人間待ちのまとめはタブに関係なく全 item から作る（あとでやる 内の人間待ちも見落とさない）
  document.getElementById('humanwaits').innerHTML = renderHumanWaitsHtml(d.items, HUMAN_WAIT_REASONS);
  document.getElementById('epicgroups').innerHTML = renderEpicGroupsHtml(d.epicGroups || [], d.currentStatus, Date.now());
  renderTabs(split);
  const shown = boardTab === 'later' ? split.later : split.normal;
  prMenuItems = {};
  const rows = shown.map((it) => {
    const r = runningBy[it.issue];
    const cls = it.status === 'Blocked' ? 'blocked-row' : (r ? 'running-row' : '');
    const prSplit = splitPrsForTitle(it.prs);
    const prInline = prSplit.inline.map(prChip).join('');
    const prMenu = prSplit.hasMenu ? prMenuBtn(it, prSplit.menu) : '';
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
      : (renderHumanWaitCell(it, HUMAN_WAIT_REASONS)
        || (it.hitl ? '<span title="人間の番">🙋</span> <span class="subtext">人間の番</span>' : '<span class="muted">—</span>'));
    const assignees = it.assignees || [];
    // オーナー（駆動担当）を太字で明示。自分がオーナーでない共同担当行には 👁 + オーナー login
    // を付け、「観察中（他人が駆動）」であることを示す（#938）。
    const who = assignees.length
      ? assignees.map((a) => (a === it.owner ? '<b>' + esc(a) + '</b>' : esc(a))).join(', ')
      : '<span class="muted">—</span>';
    const observing = (myAssignee && it.owner && it.owner !== myAssignee)
      ? ' <span class="subtext" title="駆動者は ' + esc(it.owner) + '（自分は観察中・live 反映は更新周期/手動更新のみ）">👁 ' + esc(it.owner) + '</span>'
      : '';
    const kindMark = it.tracker ? ' <span class="subtext" title="tracker (分解済み親)">🧭</span>' : '';
    const waitMark = it.waiting ? ' <span class="subtext" title="先行 Issue (autopilot-after) の完了待ち">⏳</span>' : '';
    return '<tr class="' + cls + copyFlashAttrs(it) + '" data-issue="' + it.issue + '">'
      + '<td class="title-cell"><span class="title-line">' + copyBtn(it) + '<a target="_blank" rel="noopener" href="' + esc(it.url) + '">#' + it.issue + '</a>'
      + prInline + prMenu
      + prioCtl(it)
      + '<span class="t" title="' + esc(it.title) + '">' + esc(it.title) + '</span>' + kindMark + waitMark + '</span></td>'
      + '<td>' + statusPill(it.status) + '</td>'
      + '<td>' + sizeBadge(it.size) + '</td>'
      + '<td>' + aiStatusCell(it) + '</td>'
      + '<td>' + who + observing + '</td>'
      + '<td>' + sub + '</td>'
      + '<td>' + now + resolveButton(it, (d.running || []).map((x) => x.issue)) + laterButton(it) + '</td></tr>';
  });
  document.getElementById('rows').innerHTML = rows.join('')
    || '<tr><td colspan="7" class="muted">' + (boardTab === 'later'
      ? '（あとでやる の Issue はありません。通常タブの「💤 あとで」で移せます）'
      : '（表示対象の Issue はありません）') + '</td></tr>';
  restorePrMenu();
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
    lastBoard = d;
    // ボードが目標状態に追いついた保留だけ解除（古いキャッシュで楽観的に動かした行を戻さない）
    laterPending = laterPendingReducer(laterPending, { type: 'board', items: d.items || [] });
    const st = document.getElementById('state');
    if (d.booting) { st.className = 'pill auth'; st.textContent = d.authError ? 'SSO 待ち' : '起動中'; }
    else if (d.authError) { st.className = 'pill auth'; st.textContent = 'AUTH ⚠'; }
    else if (d.paused && d.pausedBy === 'usage') { st.className = 'pill usagep'; st.textContent = 'USAGE ⏸'; }
    else if (d.paused) { st.className = 'pill paused'; st.textContent = 'PAUSED'; }
    else { st.className = 'pill ok'; st.textContent = 'RUNNING'; }
    document.getElementById('meta').textContent =
      (d.assignee ? '👤 ' + d.assignee + ' · ' : '') + '並行 ' + (d.schedulerLimits ? d.schedulerLimits.maxTotal + '（重い ' + d.schedulerLimits.maxHeavy + '）' : d.concurrency)
      + ' · 実行中 ' + (d.running || []).length
      + (d.rate && d.rate.minRemaining != null ? ' · API残 ' + d.rate.minRemaining + (d.rate.warn ? '⚠' : '') : '')
      + (d.updatedAt ? ' · 更新 ' + Math.round((Date.now() - d.updatedAt) / 1000) + 's前' : '');
    // 起動待ちの間は Project 情報が無く、daemon が 503 で断る操作のボタンを止める（#1510）
    for (const id of ['resume', 'ticknow', 'refreshboard']) {
      const b = document.getElementById(id);
      if (!b) continue;
      if (b.dataset.title == null) b.dataset.title = b.title;
      b.disabled = !!d.booting;
      b.title = d.booting ? '起動待ちのため使えません' : b.dataset.title;
    }
    renderUsage(d);
    renderVersion(d);
    renderAlerts(d);
    renderSchedule(d);
    renderBoard(d);
    renderHistory(d);
  } catch (e) {
    document.getElementById('state').className = 'pill paused';
    document.getElementById('state').textContent = '応答なし';
  }
}

// クリップボードに書けたら true。localhost 以外（IP 直打ち等）では navigator.clipboard が無いので prompt で見せる
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { prompt('コピーしてください:', t); return false; } }
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
// ---- 使用量詳細ポップオーバーのイベント委譲（#996） ----
// アイコンは refresh のたび innerHTML で再生成されるので #usage への委譲で拾う。
document.getElementById('usage').addEventListener('click', (e) => {
  if (!e.target.closest('.uicon')) return;
  e.stopPropagation(); // 直後の document クリック（外側クリック判定）で閉じないように
  toggleUsagePop();
});
document.getElementById('usage').addEventListener('keydown', (e) => {
  if (!e.target.closest('.uicon')) return;
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggleUsagePop(); }
});
// 外側クリックで閉じる（ポップオーバー内・アイコン上のクリックは維持）。
document.addEventListener('click', (e) => {
  if (!usagePopOpen) return;
  if (e.target.closest('#usagepop') || e.target.closest('.uicon')) return;
  closeUsagePop();
});
// 幅が変わったら追従。狭幅（usage 非表示・960px 以下）では開いたままにせず閉じる。
window.addEventListener('resize', () => {
  if (!usagePopOpen) return;
  if (window.innerWidth <= 960) closeUsagePop(); else positionUsagePop();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeUpdateModal(); closeUsagePop(); closePrMenu(); } });
document.getElementById('pause').onclick = () => fetch('/pause', { method: 'POST' }).then(refresh);
// usage の auto-pause 中は /resume が 409 を返す → アラート帯の強制再開（確認段）を開く（#1193）
document.getElementById('resume').onclick = async () => {
  try {
    const r = await fetch('/resume', { method: 'POST' });
    if (r.status === 409) usageForceConfirm = true;
  } catch (e) { /* refresh 側で表示 */ }
  refresh();
};
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
// 「現在地を作る」（#2388）。worker を 1 つ起動するだけで、できたらリンクと最終更新が /board に出る
document.getElementById('epicgroups').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('[data-testid="current-status-make"]');
  if (!btn || btn.disabled) return;
  btn.disabled = true; btn.textContent = '⏳ 現在地を作っています…';
  try { await fetch('/current-status', { method: 'POST' }); } catch (e) { /* refresh 側で表示 */ }
  refresh();
});
refresh(); setInterval(refresh, 5000);
${LEARN_TASKS_SCRIPT}</script></body></html>`;

/**
 * 合言葉を埋めたモニターの HTML（EPIC #2384 U3）。合言葉は daemon が起動ごとに作る 16 進の文字列で、
 * HTML を壊す文字が来たら埋めずに例外にする（属性の外へ抜けさせない）。
 * @param {string} token daemon の合言葉
 * @returns {string} 配信する HTML
 */
function monitorHtmlWithToken(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('invalid monitor token');
    return MONITOR_HTML.replace(TOKEN_META_EMPTY, `<meta name="autopilot-token" content="${token}">`);
}

module.exports = { MONITOR_HTML, monitorHtmlWithToken };
