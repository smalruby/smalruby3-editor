'use strict';
/**
 * monitor.js — autopilot daemon が配信する Web ステータスモニタ（自己完結 HTML）。
 *
 * daemon の HTTP サーバが `GET /` で本 HTML を返す。ページは `/board`（daemon の手元のキャッシュ）を
 * 5 秒ごとに読むだけで、GitHub には触らない（`.claude/rules/autopilot/github-api.md`）。
 * 外部依存なし（インライン CSS/JS）。並べ方は人間と同意した D「あなた宛て＋表」（#2404）。
 *
 * - 上の 1 行: 動いている / 一時停止中・worker の数・Claude の使用量・GitHub API の残り・更新からの経過・
 *   「実行履歴 N」「タスク N」の件数バッジ（押すと右から開く）・一時停止 / 再開・⋯（更新 / tick / 現在地を作る）
 * - 左「あなた宛て」（ゆったり）: 答えが要る（`POST /answer`）・止まっている worker（blocked-panel.js）・
 *   学び・確かめてほしい・人間待ち（「AI に任せる」= `POST /delegate`、⋯ に GitHub で開く・コピー・あとで など）
 * - 右「状況板」（詰めた表）: EPIC ごとの行と、開くと sub-issue の行。絞り込みの文字とチップ
 * - 幅の広い画面ではページ自体はスクロールせず、各列の中だけ動く。900px 未満はタブにする
 * - 数字キー 1〜4（入力欄の外・⌘/Ctrl なし）で欄へ移る / 横の欄を開く
 * - 判断（意味の色・あなた宛ての組み立て・行の絞り込み・答えの組み立て）は monitor-inbox.js と
 *   phases.js の純粋関数を `fn.toString()` で埋め込んで共有する（二重定義しない）
 */

const { BLOCKED_PANEL_HTML } = require('./blocked-panel');
const {
    canToggleLater, effectiveLater, splitLaterBoard, laterPendingReducer, splitPrsForTitle, issueCopyText,
    canResolveConflict,
    HUMAN_WAIT_REASONS, renderHumanWaitCell,
} = require('./phases');
// 学び・タスクの欄（EPIC #2384）。部品は monitor-learn-tasks.js にまとめ、ここは横の欄に埋め込むだけ
const { LEARN_TASKS_CSS, LEARN_TASKS_HTML, LEARN_TASKS_SCRIPT } = require('./monitor-learn-tasks');
// D「あなた宛て＋表」の判断（#2404）
const { INBOX_CLIENT_FNS } = require('./monitor-inbox');
// 虹色の ∞ + A のアイコン（#2413）。assets/make-icon.py が作る PNG の data URI（自己完結のまま埋める）
const { ICON_FAVICON_64, ICON_HEADING_40 } = require('./icon-data');

// ブラウザへ埋め込むクライアント共有の純粋関数（自己完結。later.test.js / spike.test.js / monitor-inbox.test.js で単独評価を担保）
const SHARED_CLIENT_FNS = [
    canToggleLater, effectiveLater, splitLaterBoard, laterPendingReducer, splitPrsForTitle, issueCopyText,
    renderHumanWaitCell, canResolveConflict,
    ...INBOX_CLIENT_FNS,
]
    .map(String).join('\n');

/** 合言葉の入れ物（素の HTML は空。daemon が配信するときに monitorHtmlWithToken で埋める） */
const TOKEN_META_EMPTY = '<meta name="autopilot-token" content="">';

/** 「AI に任せる」のキラキラ（虹色のグラデーション #goGrad で塗る） */
const ICON_SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="url(#goGrad)" d="M12 1.5c.5 4.9 2.6 8 7.6 9.2.5.1.5.8 0 .9-5 1.2-7.1 4.3-7.6 9.2-.1.6-.9.6-1 0-.5-4.9-2.6-8-7.6-9.2-.5-.1-.5-.8 0-.9 5-1.2 7.1-4.3 7.6-9.2.1-.6.9-.6 1 0Z"/>'
    + '<path fill="url(#goGrad)" d="M19.5 1.8c.2 1.6.9 2.4 2.4 2.7.2 0 .2.3 0 .3-1.5.3-2.2 1.1-2.4 2.7 0 .2-.3.2-.3 0-.2-1.6-.9-2.4-2.4-2.7-.2 0-.2-.3 0-.3 1.5-.3 2.2-1.1 2.4-2.7 0-.2.3-.2.3 0Z"/></svg>';
/** ⋯（ほかの操作） */
// 「あなた宛て」の開け閉め: 左に列のある四角（サイドバーの切りかえの形として広く見かける形）
const ICON_SIDEBAR = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4">'
    + '<rect x="1.7" y="2.7" width="12.6" height="10.6" rx="2"/><path d="M6 2.9v10.2"/></g></svg>';
const ICON_MORE = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/></g></svg>';
/** GitHub API の印（git の枝分かれの形。ロゴではない） */
const ICON_GITHUB = '<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="4.5" cy="3.5" r="1.8"/><circle cx="4.5" cy="12.5" r="1.8"/><circle cx="11.5" cy="5.5" r="1.8"/><path d="M4.5 5.3v5.4M11.5 7.3c0 2.6-2.4 3-5.4 3.8"/></g></svg>';

const MONITOR_HTML = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
${TOKEN_META_EMPTY}
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>autopilot monitor</title>
<link rel="icon" type="image/png" href="${ICON_FAVICON_64}">
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
    --ap-motion-pulse:2s; --ap-motion-go:5s; --ap-motion-pane:150ms;
    --ap-rail-w:44px;
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
  /* ---- D「あなた宛て＋表」（#2404・docs/autopilot/design-system.md） ---- */
  .c-ai { --c: var(--ap-ai); --w: var(--ap-ai-wash); }
  .c-human { --c: var(--ap-human); --w: var(--ap-human-wash); }
  .c-done { --c: var(--ap-done); --w: var(--ap-done-wash); }
  .c-idle { --c: var(--ap-idle); --w: var(--ap-idle-wash); }
  .c-stop { --c: var(--ap-stop); --w: var(--ap-stop-wash); }
  .c-notice { --c: var(--ap-notice); --w: var(--ap-notice-wash); }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  html, body { margin: 0; }
  body { font-family: var(--ap-font-ui);
         color: var(--ap-ink); background: var(--ap-bg); font-size: var(--ap-font-sm); line-height: 1.5; font-variant-numeric: tabular-nums; }
  a { color: inherit; }
  button { font: inherit; color: inherit; cursor: pointer; }
  button:disabled { cursor: default; opacity: .5; }
  .app { display: flex; flex-direction: column; min-height: 100vh; gap: 10px;
         padding: 10px max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px)); }
  .panel { background: var(--ap-surface); border: 1px solid var(--ap-line); border-radius: var(--ap-radius-md); min-width: 0; }
  .panel-h { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding: 8px 12px; border-bottom: 1px solid var(--ap-line-soft);
             position: sticky; top: 0; z-index: 2; background: var(--ap-surface); border-radius: var(--ap-radius-md) var(--ap-radius-md) 0 0; }
  .panel-h h2 { margin: 0; font-size: var(--ap-font-md); font-weight: 600; }
  .small { font-size: var(--ap-font-xs); color: var(--ap-muted); }
  .muted { color: var(--ap-muted); }
  .sp { flex: 1; }
  svg.i { width: 14px; height: 14px; flex: none; vertical-align: -2px; }
  kbd { font-family: var(--ap-font-mono); font-size: 11px; border: 1px solid var(--ap-line);
        border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; color: var(--ap-muted); background: var(--ap-surface); }
  .ilink { color: var(--ap-faint); text-decoration: none; font-family: var(--ap-font-mono); font-weight: 400; }
  .ilink:hover { color: var(--ap-ink); text-decoration: underline; text-underline-offset: 3px; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--c); flex: none; }
  .dot.ring { background: transparent; border: 2px solid var(--c); }
  .pulse { animation: pulse var(--ap-motion-pulse) ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklab, var(--c) 45%, transparent); } 50% { box-shadow: 0 0 0 4px transparent; } }
  .ibtn { border: 1px solid var(--ap-line); background: var(--ap-surface); border-radius: var(--ap-radius-md); padding: 1px 10px;
          font-size: var(--ap-font-xs); display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .ibtn:hover:not(:disabled) { border-color: var(--ap-muted); }
  .ibtn.icon { padding: 1px 6px; min-width: 26px; justify-content: center; }
  .btn { min-height: 34px; padding: 4px 16px; border-radius: var(--ap-radius-md); border: 1px solid var(--ap-line); background: var(--ap-surface); font-size: var(--ap-font-md); }
  .btn.primary { background: var(--ap-human); border-color: var(--ap-human); color: var(--ap-on-solid); font-weight: 600; }
  /* ---- 上の 1 行 ---- */
  .topline { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 6px 12px; }
  .topline h1 { margin: 0; font-size: var(--ap-font-md); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
  .topline h1 .logo { display: block; flex: none; }
  .topline .k { color: var(--ap-muted); }
  .topline .sep { color: var(--ap-line); }
  .tl-right { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto; }
  .st { display: inline-flex; gap: 6px; align-items: center; }
  .svc { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
  .svc .svcname { font-size: var(--ap-font-xs); font-weight: 600; color: var(--ap-muted); }
  .meter { display: inline-block; width: 44px; height: 4px; border-radius: 2px; background: var(--ap-track); position: relative; overflow: hidden; vertical-align: middle; }
  .meter > b { position: absolute; inset: 0 auto 0 0; background: var(--ap-muted); }
  .meter > b.warn { background: var(--ap-usage-warn); }
  .badge { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--ap-line); background: var(--ap-surface);
           border-radius: 999px; padding: 1px 10px; font-size: var(--ap-font-xs); }
  .badge .cnt { font-weight: 700; }
  .badge.has { border-color: color-mix(in oklab, var(--ap-notice) 50%, var(--ap-line)); }
  .badge.has .cnt { color: var(--ap-notice); }
  /* ---- Claude 使用量（#879 / #883 / #935 / #996） ----
     アイコンはクリック/キーボードで使用量の詳細ポップオーバーを開く。可変の % と経過は min-width で予約して行が揺れない。 */
  .usage .uicon { flex: none; display: block; pointer-events: auto; cursor: pointer; }
  .usage .uicon:focus-visible { outline: 2px solid var(--ap-focus); outline-offset: 2px; border-radius: 2px; }
  .usage .ubar { width: 44px; height: 4px; background: var(--ap-track); border-radius: 2px; overflow: hidden; display: inline-block; vertical-align: middle; }
  .usage .ubar > span { display: block; height: 100%; background: var(--ap-usage-ok); }
  .usage .ubar > span.warn { background: var(--ap-usage-warn); }
  .usage .upct { min-width: 2.6em; text-align: right; }
  .usage .upct.warn { color: var(--ap-usage-warn-ink); font-weight: 600; }
  .usage .usep { color: var(--ap-line); }
  .usage .umuted { color: var(--ap-muted); min-width: 2.6em; text-align: center; }
  .usage .uage { color: var(--ap-faint); font-size: var(--ap-font-xs); }
  .usage .uage.stale { color: var(--ap-notice); }
  .usage .uageval { display: inline-block; min-width: 2.4em; text-align: right; }
  .usagepop { position: fixed; display: none; z-index: 40; min-width: 15rem; max-width: 22rem;
              background: var(--ap-surface); color: var(--ap-ink); border: 1px solid var(--ap-line); border-radius: var(--ap-radius-md);
              padding: .6rem .75rem; font-size: var(--ap-font-xs); line-height: 1.5; box-shadow: 0 6px 24px var(--ap-shadow-menu); }
  .usagepop.open { display: block; }
  /* あなた宛てのタイトルの全文（#2416）。ブラウザの title は使わない（スマホで出ず、出るまで遅い） */
  [data-tip] { cursor: pointer; -webkit-tap-highlight-color: transparent; }
  [data-tip]:focus-visible { outline: 2px solid var(--ap-focus); outline-offset: 2px; border-radius: var(--ap-radius-sm); }
  .titletip { position: fixed; z-index: 45; max-width: min(28rem, calc(100vw - 16px)); cursor: pointer;
              background: var(--ap-surface); color: var(--ap-ink); border: 1px solid var(--ap-line-strong); border-radius: var(--ap-radius-md);
              padding: var(--ap-space-3) var(--ap-space-4); font-size: var(--ap-font-sm); line-height: 1.5; font-weight: 400;
              white-space: normal; overflow-wrap: anywhere; box-shadow: 0 6px 24px var(--ap-shadow-menu); }
  .titletip[hidden] { display: none; }
  .titletip .tip-meta { display: block; margin-top: var(--ap-space-2); font-size: var(--ap-font-xs); color: var(--ap-muted); }
  .usagepop .upop-row { margin-bottom: .5rem; }
  .usagepop .upop-row:last-child { margin-bottom: 0; }
  .usagepop .upop-label { font-weight: 600; }
  .usagepop .upop-detail { color: var(--ap-muted); }
  /* ---- アラート帯（認証・使用量・レート） ---- */
  #alerts:empty { display: none; }
  /* 帯の地は塗らない（文字と細い線だけ。design-system.md §3） */
  .alert { display: flex; align-items: baseline; gap: .6rem; padding: .35rem .8rem; font-size: var(--ap-font-sm); flex-wrap: wrap;
           background: var(--ap-surface); border: 1px solid var(--ap-line); border-left: 3px solid currentColor;
           border-radius: var(--ap-radius-sm); margin-bottom: 6px; }
  .alert.auth-a { color: var(--ap-notice); }
  .alert.usage-a { color: var(--ap-usage-ink); }
  .alert.usage-a .uforce { margin-left: auto; display: inline-flex; gap: .4rem; align-items: baseline; }
  .alert code { background: var(--ap-tint-2); padding: 0 .3rem; border-radius: .2rem; }
  .alert button { font-size: var(--ap-font-xs); padding: .05rem .4rem; }
  .subtext { font-size: var(--ap-font-xs); color: var(--ap-muted); margin-left: .3rem; white-space: nowrap; }
  .reauth-info { flex-basis: 100%; margin-top: .35rem; display: flex; gap: .5rem; align-items: center; flex-wrap: wrap;
                 padding: .35rem .5rem; background: var(--ap-tint-1); border-radius: .3rem; }
  .reauth-info code { font-size: 1rem; font-weight: 700; letter-spacing: .06em; }
  /* ---- 「AI に任せる」: いちばん多く押すボタン。虹色がめぐる輪（動きを減らす設定では止める） ---- */
  @property --go-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
  .go { display: inline-flex; align-items: center; gap: 6px; border: 1.5px solid transparent; border-radius: 999px; padding: 2px 12px 2px 9px;
        font-weight: 600; font-size: var(--ap-font-sm); white-space: nowrap;
        background: linear-gradient(var(--ap-surface), var(--ap-surface)) padding-box,
          conic-gradient(from var(--go-angle), var(--ap-go-1), var(--ap-go-2), var(--ap-go-3), var(--ap-go-4), var(--ap-go-5), var(--ap-go-6), var(--ap-go-1)) border-box;
        animation: goSpin var(--ap-motion-go) linear infinite; }
  .go:hover:not(:disabled) { background: linear-gradient(var(--ap-go-wash), var(--ap-go-wash)) padding-box,
          conic-gradient(from var(--go-angle), var(--ap-go-1), var(--ap-go-2), var(--ap-go-3), var(--ap-go-4), var(--ap-go-5), var(--ap-go-6), var(--ap-go-1)) border-box; }
  .go.big { min-height: 34px; padding: 4px 16px 4px 12px; font-size: var(--ap-font-md); border-width: 2px; }
  .go svg { width: 15px; height: 15px; flex: none; }
  .go:disabled { animation: none; }
  @keyframes goSpin { to { --go-angle: 360deg; } }
  @media (prefers-reduced-motion: reduce) { .go, .pulse { animation: none; } }
  .acts-r { display: inline-flex; gap: 6px; align-items: center; margin-left: auto; }
  /* ---- あなた宛て（ゆったり） ---- */
  .human { font-size: var(--ap-human-font); }
  .feed-h { padding: 6px 16px; font-size: var(--ap-font-xs); font-weight: 600; color: var(--ap-muted); background: var(--ap-surface-2);
            border-bottom: 1px solid var(--ap-line-soft); }
  .fi { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; padding: 8px 16px; min-height: var(--ap-row-comfy); border-bottom: 1px solid var(--ap-line-soft); }
  .fi .t { flex: 1 1 180px; min-width: 0; }
  .fi .from { display: block; font-size: var(--ap-font-xs); color: var(--ap-faint); }
  .kind { font-size: var(--ap-font-xs); font-weight: 600; border-radius: 999px; padding: 0 8px; background: var(--w); color: var(--c); white-space: nowrap; }
  .fi-q { padding: 10px 16px 14px; border-bottom: 1px solid var(--ap-line-soft); }
  .q { background: var(--ap-surface-2); border: 1px solid var(--ap-line-soft); border-radius: var(--ap-radius-md); padding: 12px 14px; display: flex; flex-direction: column; gap: var(--ap-human-gap); }
  .qq { display: flex; flex-direction: column; gap: 8px; }
  .q .why { color: var(--ap-ink); }
  .opts { display: flex; flex-direction: column; gap: 6px; }
  .opt { display: flex; gap: 10px; align-items: flex-start; min-height: var(--ap-row-comfy); padding: 8px 12px; border: 1px solid var(--ap-line);
         border-radius: var(--ap-radius-md); background: var(--ap-surface); text-align: left; width: 100%; }
  .opt:hover { border-color: var(--ap-muted); }
  .opt[aria-pressed="true"] { border-color: var(--ap-human); box-shadow: inset 0 0 0 1px var(--ap-human); }
  .opt .key { font-weight: 600; color: var(--ap-muted); flex: none; width: 1.4em; }
  .opt .desc { display: block; color: var(--ap-muted); font-size: var(--ap-font-sm); }
  .opt .rec { font-size: var(--ap-font-xs); color: var(--ap-human); border: 1px solid color-mix(in oklab, var(--ap-human) 40%, transparent);
              border-radius: 999px; padding: 0 8px; margin-left: 6px; white-space: nowrap; }
  .q textarea { width: 100%; min-height: 52px; border: 1px solid var(--ap-line); border-radius: var(--ap-radius-md); background: var(--ap-surface);
                color: var(--ap-ink); padding: 8px 10px; font: inherit; font-size: var(--ap-font-md); resize: vertical; }
  .acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .more { background: transparent; border: 0; color: var(--ap-muted); padding: 0; text-decoration: underline; text-underline-offset: 3px; }
  .empty { padding: 14px 16px; color: var(--ap-muted); }
  /* 止まっている worker の欄（blocked-panel.js）は、あなた宛ての中に置く */
  #blockedpanel { margin: 0; padding: 0 16px; }
  #blockedpanel:empty { display: none; }
  /* ---- 状況板（詰めた表） ---- */
  .filter { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--ap-line-soft); }
  .filter input { flex: 1 1 200px; min-width: 0; border: 1px solid var(--ap-line); background: var(--ap-surface); color: var(--ap-ink);
                  border-radius: var(--ap-radius-md); padding: 3px 10px; font: inherit; }
  .chip { border: 1px solid var(--ap-line); background: var(--ap-surface); border-radius: 999px; padding: 1px 10px; font-size: var(--ap-font-xs); }
  .chip[aria-pressed="true"] { border-color: var(--ap-ink); font-weight: 600; }
  #schedule { font-size: var(--ap-font-xs); color: var(--ap-muted); padding: 4px 12px; border-bottom: 1px solid var(--ap-line-soft); }
  #schedule button { font-size: var(--ap-font-xs); padding: 0 .3rem; }
  .tbl-wrap { overflow-x: auto; }
  #board { border-collapse: collapse; width: 100%; min-width: 720px; font-size: var(--ap-font-sm); }
  #board th { font-size: var(--ap-font-xs); font-weight: 600; color: var(--ap-muted); text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--ap-line);
              white-space: nowrap; background: var(--ap-surface-2); position: sticky; top: 0; z-index: 1; }
  #board td { padding: 0 6px; height: var(--ap-row-dense); border-bottom: 1px solid var(--ap-line-soft); white-space: nowrap; vertical-align: middle; }
  #board tr:hover td { background: var(--ap-tint-1); }
  #board td.title { white-space: normal; min-width: 180px; max-width: 380px; }
  #board td.title .tx { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
  #board td.n { color: var(--ap-faint); text-align: right; width: 2.5em; }
  #board tr.kid td { background: var(--ap-surface-2); }
  #board tr.kid td.title { padding-left: 30px; }
  /* 人間待ちの理由は表では印だけ（言葉は title とあなた宛てに出ている） */
  #board .hw-cell { text-decoration: none; }
  #board .hw-cell .subtext { display: none; }
  .exp { border: 0; background: transparent; color: var(--ap-muted); width: 20px; padding: 0; font-size: 12px; }
  .exp[aria-expanded="true"] { transform: rotate(90deg); }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 0 9px; height: 22px; border-radius: 999px; background: var(--w); color: var(--c);
          font-size: var(--ap-font-xs); font-weight: 600; white-space: nowrap; }
  .pill .dot { background: transparent; border: 2px solid var(--c); width: 10px; height: 10px; }
  .pill .dot.solid { background: var(--c); }
  .bar { display: inline-block; width: 48px; height: 4px; border-radius: 2px; background: var(--ap-track); overflow: hidden; vertical-align: middle; }
  .bar > i { display: block; height: 100%; background: var(--ap-done); }
  .hcount { color: var(--ap-human); font-weight: 600; }
  .phase-pill { background: var(--ap-ai-wash); color: var(--ap-ai); padding: 0 .45rem; border-radius: .3rem; font-size: var(--ap-font-xs); font-weight: 600; white-space: nowrap; }
  .size-badge { display: inline-block; min-width: 1.1rem; padding: 0 .35rem; border-radius: .3rem; font-size: var(--ap-font-xs); font-weight: 700; text-align: center; margin-left: 4px; }
  .size-s { background: var(--ap-size-s-wash); color: var(--ap-size-s); }
  .size-m { background: var(--ap-size-m-wash); color: var(--ap-size-m); }
  .size-l { background: var(--ap-size-l-wash); color: var(--ap-size-l); }
  .ai-continuation-badge { display: inline-block; padding: 0 .45rem; border-radius: .3rem; font-size: var(--ap-font-xs); font-weight: 600; white-space: nowrap;
                           background: var(--ap-human-wash); color: var(--ap-human); }
  .prio { display: inline-flex; align-items: center; gap: .1rem; white-space: nowrap; }
  .prio b { font-size: var(--ap-font-xs); padding: 0 .3rem; border-radius: .3rem; background: var(--ap-prio-wash); color: var(--ap-prio); }
  .prio b.p0 { background: var(--ap-prio0-wash); color: var(--ap-prio0); } .prio b.p1 { background: var(--ap-prio1-wash); color: var(--ap-prio1); }
  .prio b.inh { font-weight: 400; font-style: italic; }
  /* ▲▼ は行に乗せたときだけ、札に重ねて見せる（幅を取らない・密な表をうるさくしない） */
  #board .prio { position: relative; }
  #board .prio button { display: none; }
  #board tr:hover .prio button { display: inline-block; }
  #board tr:hover .prio b { display: none; }
  .prio button { font-size: .6rem; padding: 0 .2rem; line-height: 1.1; border: 1px solid var(--ap-line); background: var(--ap-surface); border-radius: 3px; }
  .prchip { display: inline-block; margin-right: .15rem; padding: 0 .35rem; border-radius: 999px; font-size: var(--ap-font-xs); white-space: nowrap;
            border: 1px solid transparent; text-decoration: none; }
  .pr-conflict { outline: 2px solid var(--ap-conflict-strong); outline-offset: -1px; }
  .pr-draft { background: var(--ap-idle-wash); color: var(--ap-idle); border-color: var(--ap-idle-line); }
  .pr-ready { background: var(--ap-done-wash); color: var(--ap-done); border-color: var(--ap-done-line); }
  .pr-merged { background: var(--ap-merged-wash); color: var(--ap-merged); border-color: var(--ap-merged-line); }
  .pr-closed { background: var(--ap-closed-wash); color: var(--ap-closed); text-decoration: line-through; }
  button.prmenu-btn { font-size: .62rem; padding: 0 .3rem; line-height: 1.3; border: 1px solid var(--ap-line-strong); background: var(--ap-surface);
                      color: var(--ap-ink-soft); border-radius: .3rem; }
  button.prmenu-btn[aria-expanded="true"] { background: var(--ap-selected); color: var(--ap-on-solid); border-color: var(--ap-selected); }
  #prmenu { position: fixed; z-index: 45; display: none; min-width: 11rem; background: var(--ap-surface); border: 1px solid var(--ap-line-strong);
            border-radius: var(--ap-radius-md); box-shadow: 0 6px 18px var(--ap-shadow-menu); padding: .25rem 0; font-size: var(--ap-font-sm); }
  #prmenu.open { display: block; }
  #prmenu a { display: flex; gap: .4rem; align-items: baseline; padding: .25rem .7rem; color: var(--ap-ink); white-space: nowrap; text-decoration: none; }
  #prmenu a:hover { background: var(--ap-surface-2); }
  #prmenu .pm-state { margin-left: auto; font-size: var(--ap-font-xs); color: var(--ap-muted); }
  /* コピーできた行を一瞬光らせる（#1213）。再描画で作り直されても animation-delay で経過分から続ける */
  @keyframes copied-flash { from { background-color: var(--ap-flash); } }
  #board tr.copied-row > td { animation: copied-flash 1.2s ease-out; animation-delay: var(--flash-delay, 0ms); }
  /* ---- 並べ方 ----
     幅の広い画面: ページはスクロールせず、左右の列の中だけが動く。900px 未満: タブで 1 欄ずつ。 */
  .tabs { display: none; }
  .tab { display: inline-flex; align-items: center; gap: 8px; border: 1px solid transparent; border-bottom: 0; background: transparent;
         border-radius: var(--ap-radius-md) var(--ap-radius-md) 0 0; padding: 6px 12px; font-size: var(--ap-font-md); color: var(--ap-muted); margin-bottom: -1px; }
  .tab[aria-selected="true"] { background: var(--ap-surface); border-color: var(--ap-line); color: var(--ap-ink); font-weight: 600; }
  .tab .cnt { font-size: var(--ap-font-xs); border-radius: 999px; padding: 0 7px; background: var(--ap-idle-wash); color: var(--ap-muted); font-weight: 600; }
  .tab .cnt.hum { background: var(--ap-human-wash); color: var(--ap-human); }
  .tab .cnt.has { background: var(--ap-notice-wash); color: var(--ap-notice); }
  .stage { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
  .stage > section:focus { outline: none; }
  .stage > section.flash { box-shadow: 0 0 0 3px color-mix(in oklab, var(--ap-human) 45%, transparent); }
  @media (min-width: 900px) {
    body { height: 100vh; overflow: hidden; }
    .app { height: 100vh; min-height: 0; }
    .stage { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(340px, 9fr) minmax(0, 16fr); }
    .stage > section { overflow: auto; min-height: 0; }
  }
  @media (max-width: 899px) {
    .tabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 1px solid var(--ap-line); margin-bottom: -10px; }
    .stage > section { display: none; border-top-left-radius: 0; }
    .stage > section.on { display: block; }
    .topline .sep { display: none; }
    .keyhint { display: none; }
  }
  /* ---- 人間待ちのまとまり（親の EPIC ごと） ---- */
  .ig { border-bottom: 1px solid var(--ap-line); }
  .ig-h { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; padding: 8px 16px 6px; font-size: var(--ap-font-md);
          border-bottom: 1px solid var(--ap-line-soft); }
  .ig-h .tt { font-weight: 600; }
  /* 1 行に収める: 題名だけを … で切り、#番号は残す */
  .t1 { flex: 1 1 0; min-width: 0; display: flex; align-items: baseline; gap: 6px; }
  .t1 .tt { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .t1 .ilink, .t1 .small { flex: none; white-space: nowrap; }
  .ig .fi { flex-wrap: nowrap; padding-left: 28px; min-height: 0; padding-top: 6px; padding-bottom: 6px; }
  .ig-h, .ig .fi { flex-wrap: nowrap; }
  .ig .acts-r .go { padding-top: 1px; padding-bottom: 1px; }
  .ig .kind { min-width: 5.2em; text-align: center; }
  .ig .ig-more { min-height: 0; padding-top: 4px; padding-bottom: 6px; font-size: var(--ap-font-sm); }
  .gprio { font-size: var(--ap-font-xs); font-weight: 600; color: var(--ap-faint); }
  .gprio.p0, .gprio.p1 { color: var(--ap-ink); }
  /* ---- 「あなた宛て」の開け閉め（幅の広い画面だけ） ---- */
  .paneltoggle { display: none; padding: 2px 5px; margin-left: -4px; color: var(--ap-muted); }
  .paneltoggle svg.i { width: 16px; height: 16px; }
  .rail { display: none; }
  @media (min-width: 900px) {
    .stage { transition: grid-template-columns var(--ap-motion-pane) ease; }
    .paneltoggle { display: inline-flex; }
    .stage.inbox-closed { grid-template-columns: var(--ap-rail-w) minmax(0, 1fr); }
    .stage.inbox-closed #inbox-body { display: none; }
    .stage.inbox-closed #sec-inbox { overflow: hidden; }
    .stage.inbox-closed .rail { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; height: 100%;
             padding: 9px 0; border: 0; border-radius: var(--ap-radius-md); background: transparent; color: var(--ap-muted); }
    .rail:hover { background: var(--ap-surface-2); }
    .rail > svg.i { width: 16px; height: 16px; }
    .rail #railbadges { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .rb { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 28px; padding: 4px 2px; border-radius: var(--ap-radius-md);
          background: var(--w); color: var(--c); font-weight: 600; }
    .rb b { font-size: var(--ap-font-sm); }
    .rb span { font-size: 11px; writing-mode: vertical-rl; letter-spacing: .05em; }
    .rb.zero { background: transparent; color: var(--ap-faint); font-weight: 400; }
  }
  @media (prefers-reduced-motion: reduce) { .stage { transition: none; } }
  /* ---- 横から開く欄・メニュー・お知らせ ---- */
  .scrim { position: fixed; inset: 0; z-index: 29; background: var(--ap-overlay); }
  .drawer { position: fixed; z-index: 30; top: 0; right: 0; bottom: 0; width: min(560px, 100%); background: var(--ap-surface);
            border-left: 1px solid var(--ap-line); box-shadow: 0 6px 24px var(--ap-shadow-menu); display: flex; flex-direction: column; }
  .drawer[hidden], .scrim[hidden], .menu[hidden] { display: none; }
  .drawer-h { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--ap-line-soft); }
  .drawer-h h3 { margin: 0; font-size: var(--ap-font-lg); flex: 1; }
  .drawer-b { overflow: auto; flex: 1; }
  #histt { border-collapse: collapse; width: 100%; font-size: var(--ap-font-sm); }
  #histt th, #histt td { padding: 4px 10px; border-bottom: 1px solid var(--ap-line-soft); text-align: left; vertical-align: top; }
  #histt th { font-size: var(--ap-font-xs); color: var(--ap-muted); background: var(--ap-surface-2); }
  #learntasks { margin: 0; padding: 12px 16px; }
  .menu { position: fixed; z-index: 35; min-width: 220px; background: var(--ap-surface); border: 1px solid var(--ap-line); border-radius: var(--ap-radius-md);
          box-shadow: 0 6px 24px var(--ap-shadow-menu); padding: 4px; display: flex; flex-direction: column; }
  .menu button, .menu a { display: flex; gap: 8px; align-items: center; text-align: left; border: 0; background: transparent; padding: 6px 10px;
                          border-radius: var(--ap-radius-sm); font-size: var(--ap-font-sm); text-decoration: none; color: var(--ap-ink); }
  .menu button:hover:not(:disabled), .menu a:hover { background: var(--ap-surface-2); }
  .menu .note { font-size: var(--ap-font-xs); color: var(--ap-faint); margin-left: auto; padding-left: 12px; }
  .menu .menu-note { font-size: var(--ap-font-xs); color: var(--ap-muted); padding: 2px 10px 6px; }
  .menu hr { border: 0; border-top: 1px solid var(--ap-line-soft); margin: 4px 0; width: 100%; }
  #toasts { position: fixed; z-index: 70; left: 50%; bottom: calc(40px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%);
            display: flex; flex-direction: column; gap: 6px; align-items: center; max-width: calc(100% - 32px); }
  .toast { background: var(--ap-ink); color: var(--ap-surface); padding: 8px 16px; border-radius: var(--ap-radius-md); font-size: var(--ap-font-sm); }
  .toast.err { background: var(--ap-stop); color: var(--ap-on-solid); }
  /* ---- 下の帯（稼働バージョン + 更新バッジ #885） ---- */
  footer { display: flex; align-items: center; gap: .6rem; padding: 4px 2px 8px; color: var(--ap-muted); font-size: var(--ap-font-xs); }
  footer .ver code { background: var(--ap-code-bg); padding: 0 .3rem; border-radius: .2rem; }
  footer .upd-badge { padding: .05rem .55rem; font-size: var(--ap-font-xs); border: 1px solid var(--ap-update-line); background: var(--ap-update);
                      color: var(--ap-on-solid); font-weight: 600; border-radius: .3rem; }
  /* ---- モーダル（log・更新手順） ---- */
  #modal, #updmodal { position: fixed; inset: 0; background: var(--ap-overlay); display: none; align-items: center; justify-content: center; z-index: 50; }
  #updmodal { z-index: 60; }
  #modal.open, #updmodal.open { display: flex; }
  .mbox { background: var(--ap-surface); color: var(--ap-ink); width: min(92vw, 70rem); max-height: 85vh; border-radius: var(--ap-radius-md);
          display: flex; flex-direction: column; overflow: hidden; }
  #updmodal .mbox { width: min(92vw, 44rem); }
  .mbox-h { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--ap-line-soft); }
  .mbox-h h3 { margin: 0; font-size: var(--ap-font-md); flex: 1; }
  #modal pre { margin: 0; padding: .8rem; overflow: auto; white-space: pre-wrap; font-size: .78rem; flex: 1; background: var(--ap-term-bg); color: var(--ap-term-ink); }
  #updmodal .body { padding: .9rem 1rem; overflow: auto; font-size: var(--ap-font-sm); line-height: 1.55; }
  #updmodal ol { margin: .3rem 0 .8rem; padding-left: 1.3rem; }
  #updmodal code { background: var(--ap-code-bg); padding: 0 .3rem; border-radius: .2rem; }
  #updmodal .cmd { display: block; background: var(--ap-term-bg); color: var(--ap-term-ink); padding: .4rem .6rem; border-radius: .3rem;
                   margin: .3rem 0; white-space: pre-wrap; word-break: break-all; }
  #updmodal .commits { margin: .4rem 0 0; border-top: 1px solid var(--ap-line); padding-top: .5rem; }
  #updmodal .primary { background: var(--ap-primary); color: var(--ap-on-solid); border: 1px solid var(--ap-primary-line); padding: .1rem .5rem; border-radius: .3rem; }
  /* ---- 「AI に直してもらう」: 指摘を見て直してほしいことを書く（#2415） ---- */
  #fixmodal { position: fixed; inset: 0; background: var(--ap-overlay); display: none; align-items: center; justify-content: center; z-index: 55; }
  #fixmodal.open { display: flex; }
  #fixmodal .mbox { width: min(92vw, 46rem); }
  #fixmodal .body { padding: 12px 14px; overflow: auto; display: flex; flex-direction: column; gap: 10px; font-size: var(--ap-font-sm); line-height: 1.55; }
  #fixmodal .fx-sum { color: var(--ap-muted); }
  #fixmodal .md { border: 1px solid var(--ap-line-soft); border-radius: var(--ap-radius-md); padding: 4px 12px; max-height: 40vh; overflow: auto; }
  #fixmodal .md h4, #fixmodal .md h5, #fixmodal .md h6 { margin: .7rem 0 .2rem; font-size: var(--ap-font-sm); }
  #fixmodal .md p, #fixmodal .md ul, #fixmodal .md ol, #fixmodal .md blockquote, #fixmodal .md pre { margin: .35rem 0; }
  #fixmodal .md ul, #fixmodal .md ol { padding-left: 1.3rem; }
  #fixmodal .md blockquote { border-left: 3px solid var(--ap-line); padding-left: .6rem; color: var(--ap-muted); }
  #fixmodal .md code { background: var(--ap-code-bg); padding: 0 .3rem; border-radius: .2rem; }
  #fixmodal .md pre { background: var(--ap-code-bg); padding: .4rem .6rem; border-radius: .3rem; overflow: auto; }
  #fixmodal .md pre code { padding: 0; }
  #fixmodal .md a { color: var(--ap-link); }
  #fixmodal label { font-weight: 600; }
  #fixmodal textarea { width: 100%; min-height: 96px; border: 1px solid var(--ap-line); border-radius: var(--ap-radius-md); background: var(--ap-surface);
                       color: var(--ap-ink); padding: 8px 10px; font: inherit; font-size: var(--ap-font-md); resize: vertical; box-sizing: border-box; }
  #fixmodal .acts { justify-content: flex-end; }
  /* ---- 「確認の結果を書く」: リリース確認の観点ごとに OK / NG（#2430）。#fixmodal と同じ部品 ---- */
  #relmodal { position: fixed; inset: 0; background: var(--ap-overlay); display: none; align-items: center; justify-content: center; z-index: 55; }
  #relmodal.open { display: flex; }
  #relmodal .mbox { width: min(92vw, 46rem); }
  #relmodal .body { padding: 12px 14px; overflow: auto; display: flex; flex-direction: column; gap: 10px; font-size: var(--ap-font-sm); line-height: 1.55; }
  #relmodal .fx-sum { color: var(--ap-muted); }
  #relmodal .fx-sum a { color: var(--ap-link); }
  #relmodal .rpt { border: 1px solid var(--ap-line-soft); border-radius: var(--ap-radius-md); padding: 6px 12px; display: flex; flex-direction: column; gap: 6px; }
  #relmodal .rpt-h { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  #relmodal .rpt-h b { flex: 1 1 12rem; }
  #relmodal .md { color: var(--ap-muted); }
  #relmodal .md p, #relmodal .md ul, #relmodal .md ol { margin: .2rem 0; }
  #relmodal .md ul, #relmodal .md ol { padding-left: 1.3rem; }
  #relmodal .md code { background: var(--ap-code-bg); padding: 0 .3rem; border-radius: .2rem; }
  #relmodal .md a { color: var(--ap-link); }
  #relmodal .vd { display: inline-flex; gap: 4px; }
  #relmodal .vd button[aria-pressed="true"].ok { background: var(--ap-primary); color: var(--ap-on-solid); border-color: var(--ap-primary-line); }
  #relmodal .vd button[aria-pressed="true"].ng { background: var(--ap-stop); color: var(--ap-on-solid); border-color: var(--ap-stop); }
  #relmodal label { font-weight: 600; }
  #relmodal textarea { width: 100%; min-height: 48px; border: 1px solid var(--ap-line); border-radius: var(--ap-radius-md); background: var(--ap-surface);
                       color: var(--ap-ink); padding: 6px 10px; font: inherit; font-size: var(--ap-font-md); resize: vertical; box-sizing: border-box; }
  #relmodal #relnote { min-height: 80px; }
  #relmodal .acts { justify-content: flex-end; }
${LEARN_TASKS_CSS}</style></head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="goGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" style="stop-color:var(--ap-go-1)"/><stop offset=".35" style="stop-color:var(--ap-go-2)"/>
    <stop offset=".65" style="stop-color:var(--ap-go-3)"/><stop offset="1" style="stop-color:var(--ap-go-5)"/>
  </linearGradient>
</defs></svg>
<div class="app">
<header class="panel topline" id="topline">
  <h1><img class="logo" src="${ICON_HEADING_40}" width="20" height="20" alt="">autopilot</h1>
  <span id="state" class="st c-idle" data-testid="monitor-state"><span class="dot ring"></span><b>…</b></span><span id="statenote" class="k"></span>
  <span class="sep">·</span>
  <span class="svc" title="同時に動く worker の数（重い作業は別枠）" data-testid="monitor-workers"><svg class="i" viewBox="0 0 16 16" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="2.5" width="13" height="8.5" rx="1.5"/><path d="M5 14h6M8 11v3"/></g></svg><span class="svcname">worker</span><span id="workers">—</span></span>
  <span class="sep">·</span>
  <span id="usage" class="svc usage" title="Claude の使用量（セッション / 週間）" data-testid="monitor-usage"></span>
  <span class="sep">·</span>
  <span id="ghapi" class="svc" data-testid="monitor-github-api"></span>
  <span class="sep">·</span>
  <span class="k" id="meta"></span>
  <span class="tl-right">
  <button type="button" class="badge" data-drawer="hist" data-testid="badge-history">実行履歴 <span class="cnt" id="cnt-hist">0</span></button>
  <button type="button" class="badge" data-drawer="tasks" id="badge-tasks" data-testid="badge-tasks">タスク <span class="cnt" id="cnt-tasks">0</span></button>
  <button type="button" class="ibtn" id="pause" title="新しい dispatch を止める（動いている worker は続ける）"><svg class="i" viewBox="0 0 16 16" aria-hidden="true"><g fill="currentColor"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></g></svg>一時停止</button>
  <button type="button" class="ibtn" id="resume" title="再開" hidden><svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2.6v10.8c0 .6.7 1 1.2.6l8.3-5.4c.5-.3.5-1 0-1.3L5.2 2c-.5-.4-1.2 0-1.2.6Z"/></svg>再開</button>
  <button type="button" class="ibtn icon" id="globalmenubtn" aria-haspopup="menu" aria-expanded="false" aria-label="autopilot の操作" data-testid="global-menu">${ICON_MORE}</button>
  </span>
</header>
<div id="globalmenu" class="menu" role="menu" hidden>
  <button type="button" role="menuitem" id="refreshboard" title="俯瞰ボードを今すぐ再取得（GraphQL 消費あり）">更新<span class="note">GitHub から読み直す</span></button>
  <button type="button" role="menuitem" id="ticknow" title="interval を待たず今すぐ 1 tick 実行">tick を 1 回走らせる</button>
  <hr>
  <button type="button" role="menuitem" id="csmake" data-testid="current-status-make">現在地を作る<span class="note">autopilot 全体を 1 枚に</span></button>
  <a role="menuitem" id="cslink" data-testid="current-status-link" target="_blank" rel="noopener" hidden>現在地を開く</a>
  <div class="menu-note" id="csnote" data-testid="current-status-updated"></div>
</div>
<div id="alerts"></div>
<nav id="viewtabs" class="tabs" role="tablist" aria-label="表示する欄"></nav>
<div class="stage" id="stage">
  <section class="panel human on" id="sec-inbox" data-sec="inbox" tabindex="-1" data-testid="inbox">
    <button type="button" class="rail" id="inbox-rail" aria-expanded="false" aria-controls="inbox-body" title="あなた宛てを開く ([)"
            aria-label="あなた宛てを開く" data-testid="inbox-rail">${ICON_SIDEBAR}<span id="railbadges"></span></button>
    <div id="inbox-body">
    <div class="panel-h"><button type="button" class="ibtn icon paneltoggle" id="inboxtoggle" aria-expanded="true" aria-controls="inbox-body"
            title="あなた宛てを閉じる ([)" aria-label="あなた宛てを閉じる" data-testid="inbox-toggle">${ICON_SIDEBAR}</button>
      <h2>あなた宛て</h2><span class="small" id="inboxcount"></span><span class="sp"></span><kbd>1</kbd></div>
    <div id="inbox-q" data-testid="inbox-questions"></div>
    ${BLOCKED_PANEL_HTML}
    <div id="inbox-learn" data-testid="inbox-learnings"></div>
    <div id="inbox-wait" data-testid="inbox-waits"></div>
    <div id="inbox-empty" class="empty" hidden>いま、あなた宛てのものはありません。</div>
    </div>
  </section>
  <section class="panel" id="sec-board" data-sec="board" tabindex="-1" data-testid="board-panel">
    <div class="panel-h"><h2>状況板</h2><span class="small" id="boardcount"></span><span class="sp"></span><kbd>2</kbd></div>
    <div class="filter">
      <input id="q" placeholder="絞り込み（題名・番号）" aria-label="絞り込み" data-testid="board-filter">
      <span id="chips"></span>
    </div>
    <div id="schedule" data-testid="schedule-plan"></div>
    <div class="tbl-wrap"><table id="board"><thead><tr>
      <th></th><th>#</th><th>題名</th><th>優先</th><th>状態</th><th>次の動き</th><th>時刻</th><th>進み</th><th>人間待ち</th><th>PR</th><th></th>
    </tr></thead><tbody id="rows"><tr><td colspan="11" class="muted">読み込み中…</td></tr></tbody></table></div>
  </section>
</div>
<footer id="footer">
  <span id="version" class="ver" title="稼働中コード（起動時のブランチ @ コミット）"></span>
  <button type="button" id="updbadge" class="upd-badge" style="display:none" title="tools/autopilot に更新があります">⬆️ 更新あり</button>
  <span class="sp"></span>
  <span class="keyhint">数字キー <kbd>1</kbd> あなた宛て <kbd>2</kbd> 状況板 <kbd>3</kbd> 実行履歴 <kbd>4</kbd> 学び・タスク</span>
</footer>
</div>
<div id="scrim" class="scrim" hidden></div>
<aside id="drawer" class="drawer" role="dialog" aria-label="横の欄" hidden data-testid="drawer">
  <div class="drawer-h"><h3 id="drawertitle"></h3><button type="button" class="ibtn" id="drawerclose">閉じる</button></div>
  <div class="drawer-b">
    <div id="pane-hist" data-pane="hist">
      <table id="histt"><thead><tr><th>時刻</th><th>Issue</th><th>Phase</th><th>結果</th><th>メモ</th></tr></thead>
        <tbody id="hist"><tr><td colspan="5" class="muted">（まだ実行履歴はありません）</td></tr></tbody></table>
    </div>
    <div id="pane-tasks" data-pane="tasks" hidden>${LEARN_TASKS_HTML}</div>
  </div>
</aside>
<div id="layer"></div>
<div id="toasts" aria-live="polite"></div>
<div id="updmodal"><div class="mbox">
  <div class="mbox-h"><h3>⬆️ autopilot の更新</h3><button type="button" class="ibtn" id="updclose">✕ 閉じる</button></div>
  <div class="body" id="updbody"></div>
</div></div>
<div id="usagepop" role="dialog" aria-label="Claude 使用量の詳細" class="usagepop"><div id="usagepopbody"></div></div>
<div id="titletip" role="tooltip" class="titletip" hidden data-testid="title-tip"></div>
<div id="prmenu" role="menu"></div>
<div id="fixmodal" data-testid="fix-modal"><div class="mbox" role="dialog" aria-modal="true" aria-labelledby="fixtitle">
  <div class="mbox-h"><h3 id="fixtitle">AI に直してもらう</h3><button type="button" class="ibtn" id="fixclose">✕ 閉じる</button></div>
  <div class="body">
    <div id="fixfindings" data-testid="fix-findings"></div>
    <label for="fixnote">直してほしいこと</label>
    <textarea id="fixnote" data-testid="fix-note" placeholder="GitHub にコメントを書くように（例: FYI1 と FYI3 は直して。FYI2 はそのままで）"></textarea>
    <div class="small muted">PR にコメントとして残し、🙋 を外して AI に渡します。</div>
    <div class="acts"><button type="button" class="ibtn" id="fixcancel" data-testid="fix-cancel">やめる</button>
      <button type="button" class="go" id="fixsend" data-testid="fix-send" disabled>送って AI に直してもらう</button></div>
  </div>
</div></div>
<div id="relmodal" data-testid="release-modal"><div class="mbox" role="dialog" aria-modal="true" aria-labelledby="reltitle">
  <div class="mbox-h"><h3 id="reltitle">確認の結果を書く</h3><button type="button" class="ibtn" id="relclose">✕ 閉じる</button></div>
  <div class="body">
    <div id="relpoints" data-testid="release-points"></div>
    <label for="relnote">全体のコメント</label>
    <textarea id="relnote" data-testid="release-note" placeholder="観点に入らない気づき（直してほしいことは sub-issue になります）"></textarea>
    <div class="small muted">EPIC の Issue に結果をコメントとして残し、🙋 を外して AI に渡します。NG ごとに sub-issue を作ります。</div>
    <div class="acts"><button type="button" class="ibtn" id="relcancel" data-testid="release-cancel">やめる</button>
      <button type="button" class="go" id="relsend" data-testid="release-send" disabled>送る</button></div>
  </div>
</div></div>
<div id="modal"><div class="mbox">
  <div class="mbox-h"><h3 id="mtitle">log</h3><button type="button" class="ibtn" id="mreload">↻ 更新</button><button type="button" class="ibtn" id="mclose">✕ 閉じる</button></div>
  <pre id="mlog"></pre>
</div></div>
<script>
// 書き込み（GET / HEAD 以外）の fetch に合言葉のヘッダを付ける（EPIC #2384 U3）。
// どの欄の fetch も通るように、ほかのスクリプトより先に window.fetch を 1 か所で包む。
// 合言葉は daemon が起動するたびに作り直す。開いたままのページが daemon の再起動をまたぐと
// 古い合言葉を送り続けて、どの書き込みも 403（forbidden: token）になる（押しても無反応に見える）。
// そこで 403 の token を受けたら、同じオリジンのページ（GET /）から新しい合言葉を読み直して 1 回だけやり直す。
(() => {
  const meta = document.querySelector('meta[name="autopilot-token"]');
  let token = meta ? meta.content : '';
  const origFetch = window.fetch.bind(window);
  const send = (input, opts) => {
    const headers = new Headers(opts.headers || {});
    headers.set('X-Autopilot-Token', token);
    return origFetch(input, { ...opts, headers });
  };
  const isStaleToken = async (res) => {
    if (res.status !== 403) return false;
    try { return /forbidden: token/.test((await res.clone().json()).error || ''); } catch (e) { return false; }
  };
  const refreshToken = async () => {
    const html = await origFetch('/', { cache: 'no-store' }).then((r) => (r.ok ? r.text() : ''));
    const m = html.match(/<meta name="autopilot-token" content="([A-Za-z0-9_-]+)">/);
    if (!m) return false;
    token = m[1];
    if (meta) meta.content = token;
    return true;
  };
  window.fetch = async (input, init) => {
    const opts = init || {};
    const method = String(opts.method || (input && input.method) || 'GET').toUpperCase();
    const url = new URL(typeof input === 'string' ? input : (input && input.url) || '', location.href);
    if (method === 'GET' || method === 'HEAD' || url.origin !== location.origin) return origFetch(input, init);
    const res = await send(input, opts);
    if (!(await isStaleToken(res))) return res;
    if (!(await refreshToken().catch(() => false))) return res;
    const retried = await send(input, opts);
    if (await isStaleToken(retried)) {
      const t = document.createElement('div');
      t.className = 'toast err';
      t.textContent = 'daemon とつながりません。ページを読み直してください';
      (document.getElementById('toasts') || document.body).appendChild(t);
      setTimeout(() => t.remove(), 6000);
    }
    return retried;
  };
})();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repoUrl = 'https://github.com/smalruby/smalruby3-editor';
const ICON_SPARK = ${JSON.stringify(ICON_SPARK)};
const ICON_MORE = ${JSON.stringify(ICON_MORE)};
const ICON_GITHUB = ${JSON.stringify(ICON_GITHUB)};

// ---- 判断の純粋関数（phases.js / monitor-inbox.js をそのまま埋め込む。二重定義しない） ----
${SHARED_CLIENT_FNS}
// 人間待ちの理由（表示順・文言）。phases.js の HUMAN_WAIT_REASONS をそのまま埋め込む（#1315）
const HUMAN_WAIT_REASONS = ${JSON.stringify(HUMAN_WAIT_REASONS)};

// ---- 小さな部品 ----
const ilink = (n, url) => '<a class="ilink" href="' + esc(url || (repoUrl + '/issues/' + n)) + '" target="_blank" rel="noopener">#' + esc(n) + '</a>';
const pill = (sem) => '<span class="pill c-' + sem.key + '"><span class="dot' + (sem.key === 'done' || sem.key === 'ai' ? ' solid' : '')
  + (sem.key === 'ai' ? ' pulse' : '') + '"></span>' + esc(sem.label) + '</span>';
// 「AI に任せる」: いちばん多く押すボタン（虹色の輪）。attrs は data-act などの属性の断片
const goBtn = (label, attrs, big) => '<button type="button" class="go' + (big ? ' big' : '') + '" ' + attrs + '>' + ICON_SPARK + esc(label) + '</button>';
const moreBtn = (issue) => '<button type="button" class="ibtn icon" data-act="rowmenu" data-issue="' + issue + '" aria-haspopup="menu" aria-label="ほかの操作">' + ICON_MORE + '</button>';
const mins = (ms) => Math.max(0, Math.round(ms / 60000));
function toast(msg, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), isErr ? 6000 : 2600);
}
async function postJson(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  let j = {};
  try { j = await r.json(); } catch (e) { /* 本文なし */ }
  if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}

// Size（triage で決まる small/middle/large）を S/M/L のバッジに短縮する（#884）。未設定は出さない。
const SIZE_BADGES = { small: ['S', 'size-s'], middle: ['M', 'size-m'], large: ['L', 'size-l'] };
const sizeBadge = (size) => {
  const b = SIZE_BADGES[size];
  if (!b) return '';
  return '<span class="size-badge ' + b[1] + '" title="Size: ' + esc(size) + '">' + b[0] + '</span>';
};
// Awaiting Continuation（協調的チェックポイント・EPIC #906）だけ専用バッジにする（#913）。
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
  // 状態は色と title で示す（密な表の幅を取らないよう、チップには絵文字を入れない）
  return '<a class="prchip ' + cls + (conflict ? ' pr-conflict' : '') + '" target="_blank" rel="noopener" href="'
    + repoUrl + '/pull/' + p.number + '"' + (conflict ? ' title="base とコンフリクトしています" data-testid="board-pr-conflict"' : ' title="' + icon + ' ' + cls.slice(3) + '"') + '>'
    + 'PR#' + p.number + (conflict ? ' ⚠️' : '') + '</a>';
};

// ---- 📋 Issue と PR をコピー（#1213。⋯ の中） ----
// 光らせる演出は 5 秒ごとの innerHTML 再描画で行ごと作り直されるため、対象の Issue と開始時刻を
// 覚えておき、描画のたびに負の animation-delay で経過分から続ける（最初からやり直さない）。
const COPY_FLASH_MS = 1200;
let copyFlash = null;    // { issue, at }
const copyFlashAttrs = (it) => {
  if (!copyFlash || copyFlash.issue !== it.issue) return '';
  const elapsed = Date.now() - copyFlash.at;
  if (elapsed >= COPY_FLASH_MS) return '';
  return ' copied-row" style="--flash-delay:-' + elapsed + 'ms';
};
async function copyIssue(issue) {
  const it = findItem(issue);
  if (!it) return;
  // fallback（prompt で表示）のときはコピーできたか分からないので光らせない
  if (!await copyText(issueCopyText(it, repoUrl))) return;
  copyFlash = { issue, at: Date.now() };
  toast('#' + issue + ' と PR をコピーしました');
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
let logIssue = null;
let logTimer = null;

// ---- 状態 ----
let lastBoard = null;    // 直近の /board 応答（クリック時の再描画用）
let lastLearn = null;    // 直近の /learnings 応答
let lastTasks = null;    // 直近の /tasks 応答
let laterPending = {};   // laterPendingReducer の状態（保留中の Issue だけ）
let laterSeq = 0;
let usageForceConfirm = false; // 強制再開の 2 段階目（確認）を表示中か（#1193。confirm ダイアログは使わない）
const BOARD_FILTER_KEY = 'autopilot:boardFilter';
let boardFilter = 'all';
try { const f = localStorage.getItem(BOARD_FILTER_KEY); if (f) boardFilter = f; } catch (e) { /* storage 不可でも動く */ }
// 状況板で開いているまとまり（key）。EPIC に属さない Issue は優先度ごとのまとまり（solo-P0〜P3・#2411）で、最初から開く
const openGroups = new Set(['solo-P0', 'solo-P1', 'solo-P2', 'solo-P3']);
let view = 'inbox';                     // 900px 未満のタブ
const openInboxGroups = new Set();  // 「ほか N 件」を開いた人間待ちのまとまり（key）
const qPick = {};                       // 質問の答え: issue → { 質問 id → key }
const qNote = {};                       // 質問のメモ: issue → { 質問 id → 文 }
const findItem = (issue) => ((lastBoard && lastBoard.items) || []).find((x) => x.issue === issue) || null;
const runningIssues = () => ((lastBoard && lastBoard.running) || []).map((r) => r.issue);

// Claude アイコン（インライン SVG・自己完結。外部リソース禁止。ロゴではなく放射の印）。
// クリック/キーボードで使用量詳細ポップオーバーを開くトリガーを兼ねる（#996）。
const USAGE_ICON = '<svg class="uicon i" viewBox="0 0 16 16" width="14" height="14"'
  + ' role="button" tabindex="0" aria-expanded="false" aria-haspopup="dialog" aria-label="Claude"'
  + ' title="クリックで使用量の詳細（セッション / 週間）を表示">'
  + '<g stroke="currentColor" stroke-width="1.7" stroke-linecap="round">'
  + '<path d="M8 1.5v4M8 10.5v4M1.5 8h4M10.5 8h4M3.4 3.4l2.8 2.8M9.8 9.8l2.8 2.8M12.6 3.4 9.8 6.2M6.2 9.8l-2.8 2.8"/></g></svg>';

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

// 使用率の細い棒 + NN%。データが無いウィンドウは「—」でレイアウトを崩さない。
// used ≥ 80% は注意の色（残量僅少）。ホバーで制限リセット期限(JST)を表示する（#935）。
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

// usage の最終更新からの経過（age）を薄字で併記する。usage は worker 実行時にしか更新されない
// （データ源が status line の rate_limits）ため、経過を出して「固まっている」誤解を防ぐ。
// 90 秒以上更新が無ければ stale にして据え置き中を明示する（#883）。
function usageAge(u) {
  if (!u || u.updatedAt == null) return '';
  const sec = Math.max(0, Math.round((Date.now() - u.updatedAt) / 1000));
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

// 使用量詳細ポップオーバー 1 行分（ラベル + 「N% 使用済み ・ <日時> にリセット」）を組む（#996）。
function usagePopRow(label, w) {
  const hasPct = w && w.percent != null;
  const pct = hasPct ? Math.round(Math.max(0, Math.min(100, Number(w.percent) || 0))) : null;
  const reset = w ? resetLabel(w.resetsAt) : '';
  const detail = (hasPct ? pct + '% 使用済み' : '—（未取得）')
    + (reset ? ' ・ ' + esc(reset) + ' にリセット' : '');
  return '<div class="upop-row"><div class="upop-label">' + esc(label) + '</div>'
    + '<div class="upop-detail">' + detail + '</div></div>';
}

// ポップオーバー本文（セッション + 週間の 2 行）。新規のデータ取得はせず claudeUsage をそのまま使う（#996）。
function renderUsagePop(u) {
  const uu = u || {};
  return usagePopRow('現在のセッション', uu.session)
    + usagePopRow('週間制限（すべてのモデル）', uu.weekly);
}

function renderUsage(d) {
  const u = d.claudeUsage || {};
  document.getElementById('usage').innerHTML = USAGE_ICON
    + '<span class="svcname">Claude</span>'
    + usageBar(u.session, 'セッション使用率（直近5時間）')
    + '<span class="usep">/</span>'
    + usageBar(u.weekly, '週間使用率（7日）')
    + usageAge(u);
  document.getElementById('usagepopbody').innerHTML = renderUsagePop(u);
  // アイコンは innerHTML で置き換わり aria-expanded が既定に戻るので、現在の開閉状態へ同期し直す
  const icon = document.querySelector('#usage .uicon');
  if (icon) icon.setAttribute('aria-expanded', usagePopOpen ? 'true' : 'false');
}
// GitHub API の残り（Bot / 個人のうち少ないほう・1 時間の枠 5000）。少ないと注意の色
function renderRate(d) {
  const r = d.rate || {};
  const left = r.minRemaining;
  const pct = left == null ? 0 : Math.max(0, Math.min(100, Math.round(left / 50)));
  const warn = r.warn || r.skipLowPriority ? ' warn' : '';
  document.getElementById('ghapi').title = 'GitHub API の残り（1 時間の枠 5000' + (r.minAt ? '・少ないほう: ' + r.minAt : '') + '）';
  document.getElementById('ghapi').innerHTML = ICON_GITHUB + '<span class="svcname">GitHub API</span><span class="k">残り</span>'
    + (left == null ? '<span class="muted">—</span>' : esc(left) + ' <span class="meter"><b class="' + warn.trim() + '" style="width:' + pct + '%"></b></span>');
}

// ---- 使用量詳細ポップオーバーの開閉（#996） ----
let usagePopOpen = false;
function positionUsagePop() {
  const icon = document.querySelector('#usage .uicon');
  const pop = document.getElementById('usagepop');
  if (!icon || !pop) return;
  const r = icon.getBoundingClientRect();
  pop.style.top = (r.bottom + 6) + 'px';
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
let lastUpdate = null;
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

// アラートの帯: 認証・使用量・レート・起動中だけ（Blocked と「あとでやる の人間の番」は、あなた宛ての行に出す）
function renderAlerts(d) {
  const parts = usageAlerts(d);
  if (d.notice === 'starting') {
    // 起動中（#1510）: 認証は通っていて Project の情報を取っている。数秒で稼働に変わる
    parts.push('<div class="alert auth-a">⏳ <b>起動中…</b> <span>Project の情報を取っています。</span></div>');
  }
  if (d.notice === 'boot-rate-limit') {
    // 起動待ち（#2384）: GitHub API のレート制限。exit せず、残量が戻るのを待って自動で起動する
    const W = d.bootWait || {};
    parts.push('<div class="alert auth-a" data-testid="boot-rate-limit-alert">⏳ <b>GitHub API のレート制限で起動待ち</b> <span>'
      + (W.resetAt ? 'リセット ' + esc(new Date(W.resetAt).toLocaleTimeString()) + ' ごろ・' : '')
      + (W.retryAt ? '次の取り直し ' + esc(new Date(W.retryAt).toLocaleTimeString()) : '')
      + '。戻ると自動で起動します。</span><details><summary>詳細</summary>' + esc(W.message || '') + '</details></div>');
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
  document.getElementById('alerts').innerHTML = parts.join('');
}

// ---- 上の 1 行 ----
function renderStatus(d) {
  const st = document.getElementById('state');
  let sem = 'ai', text = '動いている', note = '', ring = false;
  if (d.booting) { sem = 'notice'; text = d.authError ? 'SSO 待ち' : (d.notice === 'boot-rate-limit' ? 'API 待ち' : '起動中'); ring = true; }
  else if (d.authError) { sem = 'notice'; text = 'AUTH ⚠ 認証エラー'; ring = true; }
  else if (d.paused && d.pausedBy === 'usage') { sem = 'notice'; text = 'USAGE ⏸ 使用量で一時停止中'; ring = true; }
  else if (d.paused) { sem = 'idle'; text = '一時停止中'; note = d.pausedBy === 'human' ? '人間が止めました' : ''; ring = true; }
  st.className = 'st c-' + sem;
  st.innerHTML = '<span class="dot' + (ring ? ' ring' : ' pulse') + '"></span><b>' + esc(text) + '</b>';
  document.getElementById('statenote').textContent = note;
  const L = d.schedulerLimits || {};
  const run = d.running || [];
  const heavy = run.filter((r) => r.weight === 'heavy').length;
  document.getElementById('workers').innerHTML = run.length + '/' + (L.maxTotal != null ? L.maxTotal : d.concurrency)
    + (L.maxHeavy != null ? '<span class="k">（重い ' + heavy + '/' + L.maxHeavy + '）</span>' : '');
  document.getElementById('meta').textContent = (d.assignee ? '👤 ' + d.assignee + ' · ' : '')
    + (d.updatedAt ? '更新 ' + agoLabel(Date.now() - d.updatedAt) + '前' : '');
  if (d.updatedAt) document.getElementById('meta').title = new Date(d.updatedAt).toLocaleString('ja-JP');
  document.getElementById('pause').hidden = Boolean(d.paused);
  document.getElementById('resume').hidden = !d.paused;
  const nh = (d.history || []).length;
  document.getElementById('cnt-hist').textContent = nh;
  const nt = lastTasks && lastTasks.tasks ? lastTasks.tasks.length : 0;
  document.getElementById('cnt-tasks').textContent = nt;
  document.getElementById('badge-tasks').classList.toggle('has', Boolean(lastTasks && (lastTasks.invalid || []).length));
  // 起動待ちの間は Project 情報が無く、daemon が 503 で断る操作のボタンを止める（#1510）
  for (const id of ['resume', 'ticknow', 'refreshboard', 'csmake']) {
    const b = document.getElementById(id);
    if (!b) continue;
    if (b.dataset.title == null) b.dataset.title = b.title;
    b.disabled = !!d.booting || (id === 'csmake' && Boolean(d.currentStatus && d.currentStatus.running));
    b.title = d.booting ? '起動待ちのため使えません' : b.dataset.title;
  }
}
// 「現在地を作る」（#2388）は ⋯ の中。worker を 1 つ起動するだけで、できたらリンクと最終更新が /board に出る
function renderCurrentStatus(d) {
  const s = d.currentStatus || {};
  const b = document.getElementById('csmake');
  b.firstChild.textContent = s.running ? '⏳ 現在地を作っています…' : '現在地を作る';
  const a = document.getElementById('cslink');
  a.hidden = !s.url;
  if (s.url) a.href = s.url;
  const hm = (ms) => new Date(ms).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  document.getElementById('csnote').textContent = (s.updatedAt ? '最終更新 ' + hm(s.updatedAt) : (s.url ? '' : 'まだ作っていません'))
    + (s.lastError ? ' · ⚠ ' + s.lastError : '');
}

// ---- あなた宛て ----
function seedAnswers(entry) {
  if (qPick[entry.issue]) return;
  qPick[entry.issue] = {};
  qNote[entry.issue] = {};
  for (const a of entry.answers || []) {
    if (a.key) qPick[entry.issue][a.q] = a.key;
    if (a.note) qNote[entry.issue][a.q] = a.note;
  }
}
// ---- あなた宛てのタイトルのツールチップ（#2416）。開け閉めの判定は titleTipNext（monitor-inbox.js） ----
let tipState = { open: null, via: null };
let tipInfos = {};   // 直近の描画での key → titleTipInfo(...)。行は 5 秒ごとに作り直すので key で引き直す
function tipTitle(tag, key, w, text) {
  tipInfos[key] = titleTipInfo(w);
  const on = tipState.open === key;
  return '<' + tag + ' class="tt" tabindex="0" data-tip="' + esc(key) + '"' + (on ? ' aria-describedby="titletip"' : '') + '>'
    + esc(text) + '</' + tag + '>';
}
const tipAnchor = (key) => (key ? document.querySelector('[data-tip="' + CSS.escape(key) + '"]') : null);
function titleTipEvent(ev) {
  const disabled = wideLayout() && !inboxOpen;
  const before = tipState.open;
  tipState = titleTipNext(tipState, Object.assign({ disabled }, ev));
  if (tipState.open !== before) { const a = tipAnchor(before); if (a) a.removeAttribute('aria-describedby'); }
  showTitleTip();
}
function showTitleTip() {
  const tip = document.getElementById('titletip');
  const a = tipAnchor(tipState.open);
  const info = tipState.open ? tipInfos[tipState.open] : null;
  // 描き直しでタイトルが消えた・見えない（畳まれた欄・ほかのタブ）ときは閉じる
  if (tipState.open && (!a || !info || !a.getClientRects().length)) tipState = titleTipNext(tipState, { type: 'gone' });
  if (!tipState.open) { tip.hidden = true; return; }
  a.setAttribute('aria-describedby', 'titletip');
  const html = esc(info.title) + '<span class="tip-meta">' + esc(['#' + info.issue, info.state].filter(Boolean).join(' · ')) + '</span>';
  if (tip.innerHTML !== html) tip.innerHTML = html;
  tip.hidden = false;
  const p = titleTipPlace(a.getBoundingClientRect(), { width: tip.offsetWidth, height: tip.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight });
  tip.style.left = p.left + 'px';
  tip.style.top = p.top + 'px';
}
function questionCard(entry, open) {
  seedAnswers(entry);
  const issue = entry.issue;
  const it = findItem(issue);
  const picks = qPick[issue], notes = qNote[issue];
  const rec = recommendedAnswers(entry, notes);
  const chosen = chosenAnswers(entry, picks, notes, true);
  const title = it ? shortTitle(it.title) : '#' + issue;
  const recKeys = (entry.questions || []).map((q) => q.recommended).filter(Boolean).join('・');
  const head = '<div>' + tipTitle('b', 'q:' + issue, { issue, title: it ? it.title : title, status: it && it.status, tag: { label: '答えが要る' } }, title)
    + ' ' + ilink(issue, it && it.url)
    + ' <span class="small">' + esc([entry.phase, entry.reason].filter(Boolean).join(' · ')) + '</span></div>';
  if (!open) {
    return '<div class="q" data-testid="inbox-question" data-issue="' + issue + '"><div class="acts">' + head + '<span class="sp"></span>'
      + '<span class="small">質問 ' + entry.questions.length + (recKeys ? ' · AI の推奨 ' + esc(recKeys) : '') + '</span>'
      + '<button type="button" class="btn" data-act="q-open" data-issue="' + issue + '">開いて答える</button></div></div>';
  }
  const qs = entry.questions.map((q) => '<div class="qq"><div class="why">' + esc(q.text) + '</div><div class="opts">'
    + (q.options || []).map((o) => '<button type="button" class="opt" data-act="pick" data-issue="' + issue + '" data-q="' + esc(q.id) + '" data-k="' + esc(o.key) + '"'
      + ' aria-pressed="' + (picks[q.id] === o.key) + '"><span class="key">' + esc(o.key) + '</span><span><span>' + esc(o.label) + '</span>'
      + (q.recommended === o.key ? '<span class="rec">AI の推奨</span>' : '') + (o.desc ? '<span class="desc">' + esc(o.desc) + '</span>' : '')
      + '</span></button>').join('')
    + '</div><textarea data-act="note" data-issue="' + issue + '" data-q="' + esc(q.id) + '" placeholder="メモ（任意）。答えと一緒に Issue に残ります">'
    + esc(notes[q.id] || '') + '</textarea></div>').join('');
  // 推奨の無い問いが 1 つでもあれば「AI に任せる」は出さない（人間が選ぶ）
  const go = rec.ok ? goBtn('AI に任せる（推奨 ' + recKeys + ' で進める）', 'data-act="ans-rec" data-issue="' + issue + '" data-testid="inbox-answer-recommended"', true) : '';
  return '<div class="q" data-testid="inbox-question" data-issue="' + issue + '">' + head + qs
    + '<div class="acts">' + go
    + '<button type="button" class="btn primary" data-act="ans-go" data-issue="' + issue + '" data-testid="inbox-answer-chosen"' + (chosen.ok ? '' : ' disabled') + '>選んだ答えで進める</button>'
    + '<button type="button" class="btn" data-act="ans-save" data-issue="' + issue + '" data-testid="inbox-answer-save">メモだけ保存</button>'
    + '<span class="small">答えたのは ' + (entry.questions.length - chosen.missing.length) + ' / ' + entry.questions.length + '</span></div></div>';
}
let openQuestion = null;   // いま開いている質問の Issue（null なら 1 件目）
let lastQuestionsHtml = '';
let lastInbox = { questions: [], answered: [], learn: [], waits: [] };
function renderInbox(d) {
  tipInfos = {};
  // 描き直すとフォーカスしていたタイトルが消えるので、同じ key のタイトルへ戻す（キーボードで読んでいる途中に外れない）
  const ae = document.activeElement;
  const focusTip = ae && ae.dataset ? ae.dataset.tip : null;
  const items = (d.items || []).map((it) => Object.assign({}, it, { later: effectiveLater(it, laterPending) }));
  const m = inboxModel(Object.assign({}, d, { items }), lastLearn);
  lastInbox = m;
  // 質問の欄: メモを書いている途中は描き直さない（5 秒ごとの poll でカーソルが飛ぶのを防ぐ）
  const qEl = document.getElementById('inbox-q');
  const typing = document.activeElement && qEl.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA';
  const first = m.questions.length ? m.questions[0].issue : null;
  const qOpen = m.questions.some((q) => q.issue === openQuestion) ? openQuestion : first;
  const qHtml = (m.questions.length ? '<div class="feed-h">答えが要る · ' + m.questions.length + '</div>' : '')
    + m.questions.map((q) => '<div class="fi-q">' + questionCard(q, q.issue === qOpen) + '</div>').join('')
    + m.answered.map((q) => '<div class="fi"><span class="kind c-done">答えた</span><span class="t">' + ilink(q.issue)
      + ' <span class="small">worker が答えを読んで先へ進めるのを待っています</span></span></div>').join('');
  if (!typing && qHtml !== lastQuestionsHtml) { qEl.innerHTML = qHtml; lastQuestionsHtml = qHtml; }
  // 学び・確かめてほしい
  document.getElementById('inbox-learn').innerHTML = m.learn.length
    ? '<div class="feed-h">学び · 確かめてほしい ' + m.learn.length + '</div>' + m.learn.map((l) => '<div class="fi" data-testid="inbox-learning">'
      + '<span class="kind c-notice">学び</span><span class="t">ためた学び ' + l.count + ' 件を規則に足しますか'
      + '<span class="from">' + esc(l.reason) + (l.error ? ' · 前回の失敗: ' + esc(l.error) : '') + '</span></span>'
      + '<span class="acts-r"><button type="button" class="ibtn" data-act="learn-act"' + (l.disabled ? ' disabled' : '') + '>' + esc(l.label) + '</button>'
      + '<button type="button" class="ibtn" data-drawer="tasks">中身を見る</button></span></div>').join('')
    : '';
  // 人間待ち: 親の EPIC ごとのまとまり。EPIC 自身の行は見出しに畳む（inboxGroups）
  const groups = inboxGroups(m.waits, { epicGroups: d.epicGroups, items, open: Array.from(openInboxGroups) });
  const tagPill = (w) => '<span class="kind c-' + w.tag.key + '" data-testid="inbox-tag" data-tag="' + w.tag.tag + '">' + esc(w.tag.label) + '</span>';
  const why = (w) => (w.delegateError ? ' title="AI に任せられない理由: ' + esc(w.delegateError) + '"' : '');
  // Review / DoD（差し戻し）は、すぐ 🙋 を外さず指摘とコメント欄を開く（#2415）
  // リリース確認（#2430）は観点と OK / NG のダイアログを開く。プレビューのリンクも並べる
  const goOf = (w) => (w.previewUrl ? '<a class="ibtn" href="' + esc(w.previewUrl) + '" target="_blank" rel="noopener noreferrer" data-testid="inbox-preview">プレビュー ↗</a>' : '')
    + (w.goLabel ? goBtn(w.goLabel, 'data-act="' + (w.release ? 'release' : w.fix ? 'fix' : 'delegate') + '" data-issue="' + w.issue + '" data-testid="inbox-delegate"') : '');
  document.getElementById('inbox-wait').innerHTML = m.waits.length
    ? '<div class="feed-h">人間待ち · ' + m.waits.length + '</div>' + groups.map((g) => {
      const h = g.header;
      const p = g.priority ? '<span class="gprio ' + g.priority.toLowerCase() + '">' + esc(g.priority) + '</span>' : '';
      const head = '<div class="ig-h" data-testid="inbox-group-head"' + (h ? ' data-issue="' + h.issue + '"' + why(h) : '') + '>'
        + (h ? tagPill(h) : '')
        + '<span class="t1">' + (g.epic == null ? '<b class="tt">' + esc(g.title) + '</b>'
          : tipTitle('b', 'i:' + g.epic, h ? Object.assign({}, h, { title: g.title }) : { issue: g.epic, title: g.title }, shortTitle(g.title)))
        + (g.epic != null ? ilink(g.epic, g.url) : '') + '</span>'
        + p + (g.count ? '<span class="small">' + g.count + ' 件</span>' : '')
        + (h ? '<span class="acts-r">' + goOf(h) + moreBtn(h.issue) + '</span>' : '') + '</div>';
      const rows = g.rows.map((w) => '<div class="fi" data-testid="inbox-wait" data-issue="' + w.issue + '"' + why(w) + '>'
        + tagPill(w)
        + '<span class="t1">' + tipTitle('span', 'i:' + w.issue, w, shortTitle(w.title)) + ilink(w.issue, w.url)
        // 札で分かる状態は繰り返さない。札が「人間の番」（理由が分からない）ときだけ Status を添える
        + (w.tag.tag === 'other' && w.status ? '<span class="small">' + esc(w.status) + '</span>' : '')
        + (w.later ? '<span class="small">💤 あとで</span>' : '') + '</span>'
        + '<span class="acts-r">' + goOf(w) + moreBtn(w.issue) + '</span></div>').join('');
      const more = g.hidden || (openInboxGroups.has(g.key) && g.count > 4)
        ? '<div class="fi ig-more"><button type="button" class="more" data-act="group-more" data-key="' + esc(g.key) + '">'
          + (g.hidden ? 'ほか ' + g.hidden + ' 件' : 'たたむ') + '</button></div>' : '';
      return '<div class="ig" data-testid="inbox-group" data-key="' + esc(g.key) + '">' + head + rows + more + '</div>';
    }).join('')
    : '';
  renderRail(m);
  const total = m.questions.length + m.learn.length + m.waits.length;
  document.getElementById('inboxcount').textContent = total + ' 件';
  document.getElementById('inbox-empty').hidden = total > 0 || m.answered.length > 0;
  if (focusTip) { const a = tipAnchor(focusTip); if (a && a !== document.activeElement) a.focus({ preventScroll: true }); }
  showTitleTip();
}

// ---- 状況板 ----
const FILTERS = [['all', 'すべて'], ['human', '人間の番'], ['ai', 'AI が作業中'], ['stop', '止まった'], ['later', '💤 あとで']];
function renderChips(laterCount) {
  document.getElementById('chips').innerHTML = FILTERS.map(([k, label]) => '<button type="button" class="chip" data-f="' + k + '"'
    + ' aria-pressed="' + (boardFilter === k) + '">' + label + (k === 'later' ? ' ' + laterCount : '') + '</button>').join(' ');
}
// 優先度の ▲▼（EPIC #2384）。自分の Priority が無い行は親（EPIC）から継いだ値を斜体で出す。
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
function prCells(it) {
  const prSplit = splitPrsForTitle(it.prs);
  const prInline = prSplit.inline.map(prChip).join('');
  const prMenu = prSplit.hasMenu ? prMenuBtn(it, prSplit.menu) : '';
  return prInline + prMenu;
}
function epicRow(r, now) {
  const g = r.group, e = r.epicItem;
  const pct = g.total ? Math.round(g.done / g.total * 100) : 0;
  const run = g.running || [];
  const next = run.length
    ? run.map((x) => '#' + x.issue + ' ' + x.phase).join('・')
    : [g.stageLabel, g.remaining ? '残り ' + g.remaining + ' 件' : ''].filter(Boolean).join(' · ');
  const since = run.length ? Math.min.apply(null, run.map((x) => x.since)) : null;
  const hm = (ms) => new Date(ms).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const time = since ? mins(now - since) + ' 分' : (g.eta ? (g.eta.at <= now ? 'いま確認できます' : hm(g.eta.at) + ' ごろ') : '');
  const title = g.solo ? 'EPIC に属さない' + (g.priority ? ' · ' + esc(g.priority) : '') : esc(shortTitle(g.title)) + ' ' + ilink(g.epic, g.url);
  return '<tr class="epic"' + (e ? ' data-issue="' + e.issue + '"' : '') + ' data-testid="board-epic" data-key="' + esc(g.key) + '">'
    + '<td><button type="button" class="exp" data-act="exp" data-key="' + esc(g.key) + '" aria-expanded="' + r.open + '" aria-label="sub-issue を開く">▶</button></td>'
    + '<td class="n">' + r.index + '</td>'
    + '<td class="title"><span class="tx">' + title + '</span></td>'
    + '<td>' + (e ? prioCtl(e) : (g.priority ? '<span class="prio"><b>' + esc(g.priority) + '</b></span>' : '')) + '</td>'
    + '<td>' + pill(r.sem) + '</td>'
    + '<td class="muted">' + esc(next || '—') + (g.pendingDecisions ? ' <span class="hcount" title="決定待ち">❓ ' + g.pendingDecisions + '</span>' : '') + '</td>'
    + '<td class="muted">' + esc(time) + '</td>'
    + '<td>' + (g.total ? '<span class="bar"><i style="width:' + pct + '%"></i></span> <span class="muted">' + g.done + ' / ' + g.total + '</span>' : '<span class="muted">—</span>') + '</td>'
    + '<td>' + (r.humanN ? '<span class="hcount">' + r.humanN + '</span>' : '<span class="muted">—</span>') + '</td>'
    + '<td>' + (e ? prCells(e) : '') + '</td>'
    + '<td>' + (e ? moreBtn(e.issue) : '') + '</td></tr>';
}
function kidRow(it, sem, runningBy, myAssignee, now) {
  const r = runningBy[it.issue];
  const s = it.subIssues || {};
  // 件数（.sub-count）と %（.sub-pct）を別 span にする（#936）
  const sub = s.total
    ? '<span class="bar"><i style="width:' + (s.percent || 0) + '%"></i></span>'
      + '<span class="subtext"><span class="sub-count">' + s.completed + '/' + s.total + '</span>'
      + '<span class="sub-pct"> (' + (s.percent || 0) + '%)</span></span>'
    : '';
  const next = r
    ? '<span class="phase-pill">' + esc(r.phase) + '</span> <button type="button" class="ibtn" onclick="openLog(' + it.issue + ')">log</button>'
    : (it.aiStatus ? aiStatusCell(it) : '<span class="small">' + esc(it.status || '') + '</span>');
  const assignees = it.assignees || [];
  // オーナー（駆動担当）を明示。自分がオーナーでない共同担当行には 👁 + オーナー login を付ける（#938）
  const who = assignees.map((a) => (a === it.owner ? a + '（駆動）' : a)).join(', ');
  const observing = (myAssignee && it.owner && it.owner !== myAssignee)
    ? ' <span class="subtext" title="駆動者は ' + esc(it.owner) + '（自分は観察中）">👁 ' + esc(it.owner) + '</span>'
    : '';
  const marks = (it.tracker ? ' <span class="subtext" title="tracker (分解済み親)">🧭</span>' : '')
    + (it.waiting ? ' <span class="subtext" title="先行 Issue (autopilot-after) の完了待ち">⏳</span>' : '')
    + (effectiveLater(it, laterPending) ? ' <span class="subtext" title="あとでやる">💤</span>' : '');
  return '<tr class="kid' + copyFlashAttrs(it) + '" data-issue="' + it.issue + '" data-testid="board-item">'
    + '<td></td><td></td>'
    + '<td class="title"' + (who ? ' title="担当: ' + esc(who) + '"' : '') + '><span class="tx">' + esc(shortTitle(it.title)) + ' ' + ilink(it.issue, it.url)
    + sizeBadge(it.size) + marks + observing + '</span></td>'
    + '<td>' + prioCtl(it) + '</td>'
    + '<td>' + pill(sem) + '</td>'
    + '<td>' + next + '</td>'
    + '<td class="muted">' + (r ? mins(now - r.since) + ' 分' : '') + '</td>'
    + '<td>' + sub + '</td>'
    + '<td>' + renderHumanWaitCell(it, HUMAN_WAIT_REASONS) + '</td>'
    + '<td>' + prCells(it) + '</td>'
    + '<td>' + moreBtn(it.issue) + '</td></tr>';
}
let lastBoardRows = [];
function renderBoard(d) {
  const now = Date.now();
  const running = (d.running || []).map((r) => r.issue);
  const runningBy = {};
  for (const r of d.running || []) runningBy[r.issue] = r;
  const myAssignee = d.assignee || null;
  const items = d.items || [];
  const later = items.filter((it) => effectiveLater(it, laterPending)).map((it) => it.issue);
  renderChips(later.length);
  const rows = boardRows(d.epicGroups || [], items, {
    filter: boardFilter, query: document.getElementById('q').value, open: Array.from(openGroups), running, later,
  });
  lastBoardRows = rows;
  prMenuItems = {};
  const html = rows.map((r) => (r.type === 'epic' ? epicRow(r, now)
    : r.type === 'kid' ? kidRow(r.item, r.sem, runningBy, myAssignee, now)
      : '<tr class="kid"><td></td><td></td><td class="title muted" colspan="9">表示する sub-issue はありません</td></tr>')).join('');
  document.getElementById('rows').innerHTML = html
    || '<tr><td colspan="11" class="muted">' + (boardFilter === 'later'
      ? '（あとでやる の Issue はありません。行の ⋯ の「💤 あとで」で移せます）'
      : '（表示する Issue はありません）') + '</td></tr>';
  const groups = d.epicGroups || [];
  const solos = groups.filter((g) => g.solo);
  const soloN = solos.reduce((n, g) => n + (g.items || []).length, 0);
  document.getElementById('boardcount').textContent = 'EPIC ' + groups.filter((g) => !g.solo).length + ' 件'
    + (solos.length ? ' · EPIC に属さない ' + soloN + ' 件' : '');
  restorePrMenu();
}

// ---- 実行履歴（横の欄） ----
function renderHistory(d) {
  const OUTCOME = { done: '✅ done', hitl: '🙋 hitl', error: '❌ error', failed: '💥 failed', 'invalid-result': '⚠️ invalid', exception: '💥 exception' };
  const rows = (d.history || []).map((h) =>
    '<tr><td class="muted">' + new Date(h.endedAt).toLocaleString('ja-JP', { hour12: false }) + '</td>'
    + '<td>' + ilink(h.issue) + '</td>'
    + '<td>' + esc(h.phase) + '</td>'
    + '<td>' + (OUTCOME[h.outcome] || esc(h.outcome)) + '</td>'
    + '<td class="muted">' + esc(h.note || '') + '</td></tr>');
  document.getElementById('hist').innerHTML = rows.join('')
    || '<tr><td colspan="5" class="muted">（まだ実行履歴はありません）</td></tr>';
}

// ---- 「あなた宛て」の開け閉め（幅の広い画面だけ。閉じても細い帯に件数を残す） ----
const INBOX_OPEN_KEY = 'autopilot:inboxOpen';
let inboxOpen = true;
try { inboxOpen = localStorage.getItem(INBOX_OPEN_KEY) !== 'false'; } catch (e) { /* storage 不可でも開いたまま動く */ }
function setInboxOpen(open) {
  inboxOpen = Boolean(open);
  try { localStorage.setItem(INBOX_OPEN_KEY, String(inboxOpen)); } catch (e) { /* storage 不可でも動く */ }
  applyInboxOpen();
  if (!inboxOpen) titleTipEvent({ type: 'gone' });
}
function applyInboxOpen() {
  document.getElementById('stage').classList.toggle('inbox-closed', !inboxOpen);
  document.getElementById('inboxtoggle').setAttribute('aria-expanded', String(inboxOpen));
  document.getElementById('inbox-rail').setAttribute('aria-expanded', String(inboxOpen));
}
// 閉じた帯の件数（答え・学び・人間待ち）。0 件も薄く出して「無い」ことが分かるようにする
function renderRail(m) {
  const b = (cls, n, label, tip) => '<span class="rb ' + cls + (n ? '' : ' zero') + '" title="' + esc(tip + ' ' + n + ' 件') + '"><b>' + n + '</b><span>' + label + '</span></span>';
  document.getElementById('railbadges').innerHTML = b('c-human', m.questions.length, '答え', '答えが要る')
    + b('c-notice', m.learn.length, '学び', '確かめてほしい学び') + b('c-idle', m.waits.length, '人間待ち', '人間待ち');
}
const wideLayout = () => window.matchMedia('(min-width: 900px)').matches;

// ---- 900px 未満のタブ ----
function renderTabs() {
  const d = lastBoard || {};
  const m = lastInbox;
  const counts = {
    inbox: m.questions.length + m.learn.length + m.waits.length,
    board: (d.epicGroups || []).length,
    hist: (d.history || []).length,
    tasks: (lastTasks && lastTasks.tasks ? lastTasks.tasks.length : 0) + (lastLearn ? lastLearn.count || 0 : 0),
  };
  const defs = [['inbox', '人間の番'], ['board', '状況板'], ['hist', '実行履歴'], ['tasks', '学び・タスク']];
  document.getElementById('viewtabs').innerHTML = defs.map(([id, label], i) => '<button type="button" class="tab" role="tab" data-tab="' + id + '"'
    + ' aria-selected="' + (view === id) + '">' + label + '<span class="cnt' + (id === 'inbox' && counts[id] ? ' hum' : (id === 'tasks' && counts[id] ? ' has' : '')) + '">'
    + counts[id] + '</span><kbd>' + (i + 1) + '</kbd></button>').join('');
  document.querySelectorAll('.stage > section').forEach((s) => s.classList.toggle('on', s.dataset.sec === view));
}
// 欄へ移る（数字キー・タブ）。実行履歴と学び・タスクは横の欄を開く
function goTo(target) {
  if (target === 'hist' || target === 'tasks') { openDrawer(target); return; }
  if (target === 'inbox' && !inboxOpen && wideLayout()) setInboxOpen(true);
  view = target;
  renderTabs();
  const el = document.getElementById(target === 'inbox' ? 'sec-inbox' : 'sec-board');
  el.focus({ preventScroll: true });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 700);
}

// ---- 横の欄（drawer） ----
function openDrawer(which) {
  closeMenus();
  document.getElementById('drawertitle').textContent = which === 'hist' ? '実行履歴' : '学び・タスク';
  document.getElementById('pane-hist').hidden = which !== 'hist';
  document.getElementById('pane-tasks').hidden = which !== 'tasks';
  document.getElementById('drawer').hidden = false;
  document.getElementById('scrim').hidden = false;
}
function closeDrawer() {
  document.getElementById('drawer').hidden = true;
  document.getElementById('scrim').hidden = true;
}

// ---- メニュー（上の ⋯ と行の ⋯） ----
let menuActs = [];
function placeMenu(el, anchor) {
  const r = anchor.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(window.innerWidth - el.offsetWidth - 8, r.right - el.offsetWidth)) + 'px';
  const below = r.bottom + 4;
  el.style.top = (below + el.offsetHeight > window.innerHeight - 8 ? Math.max(8, r.top - el.offsetHeight - 4) : below) + 'px';
}
function closeMenus() {
  document.getElementById('layer').innerHTML = '';
  document.getElementById('globalmenu').hidden = true;
  document.getElementById('globalmenubtn').setAttribute('aria-expanded', 'false');
}
function openMenu(anchor, entries) {
  closeMenus();
  menuActs = [];
  const note = (e) => (e.note ? '<span class="note">' + esc(e.note) + '</span>' : '');
  const html = entries.map((e) => {
    if (e === '-') return '<hr>';
    if (e.href) return '<a role="menuitem" target="_blank" rel="noopener" href="' + esc(e.href) + '">' + esc(e.label) + note(e) + '</a>';
    const i = menuActs.push(e.act || null) - 1;
    return '<button type="button" role="menuitem" data-mi="' + i + '"' + (e.disabled ? ' disabled' : '') + '>' + esc(e.label) + note(e) + '</button>';
  }).join('');
  const layer = document.getElementById('layer');
  layer.innerHTML = '<div class="menu" role="menu" id="rowmenu" data-testid="row-menu">' + html + '</div>';
  placeMenu(layer.firstChild, anchor);
}
// 行の ⋯: 今の行に効くものだけを並べる。一時停止・やめるは将来の操作（押せない）
function openRowMenu(anchor, issue) {
  const it = findItem(issue) || { issue };
  const running = runningIssues();
  const entries = [{ label: 'GitHub で開く', href: it.url || (repoUrl + '/issues/' + issue) }];
  if (it.title) entries.push({ label: '📋 Issue と PR をコピー', act: () => copyIssue(issue) });
  for (const p of (splitPrsForTitle(it.prs).menu.length ? splitPrsForTitle(it.prs).menu : splitPrsForTitle(it.prs).inline.map((x) => Object.assign({ kind: x.isDraft ? 'draft' : 'open' }, x)))) {
    entries.push({ label: PR_KIND_ICON[p.kind] + ' PR#' + p.number, note: p.kind, href: repoUrl + '/pull/' + p.number });
  }
  if (running.indexOf(issue) >= 0) entries.push({ label: 'worker の log を見る', act: () => openLog(issue) });
  if (it.title && canResolveConflict(it, running)) {
    entries.push(resolveRequested[issue] ? { label: '⏳ 依頼中', disabled: true }
      : { label: '🔀 コンフリクトを解消', note: 'Status と 🙋 は変えない', act: () => resolveConflict(issue) });
  }
  if (it.title && canToggleLater(it)) {
    const p = laterPending[issue];
    if (p && p.inFlight) entries.push({ label: '⏳ 処理中', disabled: true });
    else if (effectiveLater(it, laterPending)) entries.push({ label: '↩ 今やる', note: '💤 later を外す', act: () => toggleLater(issue, false) });
    else entries.push({ label: '💤 あとで', note: 'autopilot の処理は変わらない', act: () => toggleLater(issue, true) });
  }
  if (it.title) {
    entries.push({ label: '優先度を上げる', act: () => movePriority(issue, -1) }, { label: '優先度を下げる', act: () => movePriority(issue, 1) });
  }
  entries.push({ label: '📋 claude へ: check autopilot #' + issue, act: () => copyText('check autopilot #' + issue) });
  entries.push('-', { label: '一時停止', note: '今後', disabled: true }, { label: 'やめる（Icebox へ）', note: '今後', disabled: true });
  openMenu(anchor, entries);
}

// ---- 操作 ----
// 「AI に任せる」（人間待ちの行）: daemon が 🙋 を外し、autopilot が次のフェーズを拾う（POST /delegate）
async function delegateIssue(issue, btn) {
  if (btn) btn.disabled = true;
  try {
    const j = await postJson('/delegate', { issue });
    toast('#' + issue + ' を AI に任せました' + (j.nextPhase ? '（次は ' + j.nextPhase + '）' : ''));
  } catch (e) {
    toast('#' + issue + ' を任せられませんでした: ' + e.message, true);
  }
  refresh();
}
// 「AI に直してもらう」（Review / DoD・#2415）: 押したときだけ bot の指摘を取ってきて見せ、書いた指示と一緒に渡す
let fixIssue = null;
async function openFix(issue) {
  fixIssue = issue;
  const box = document.getElementById('fixfindings');
  const note = document.getElementById('fixnote');
  document.getElementById('fixtitle').textContent = 'AI に直してもらう #' + issue;
  box.innerHTML = '<div class="muted">指摘を読み込み中…</div>';
  note.value = '';
  updateFixSend();
  document.getElementById('fixmodal').classList.add('open');
  note.focus();
  try {
    const r = await fetch('/delegate/findings?issue=' + issue);
    const j = await r.json().catch(() => ({}));
    if (fixIssue !== issue) return;
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    let h = '';
    if (j.findings) {
      const c = j.findings.counts || {};
      const prLink = j.pr ? ' <a href="' + esc(repoUrl + '/pull/' + j.pr + (j.findings.id ? '#issuecomment-' + j.findings.id : '')) + '" target="_blank" rel="noopener">PR#' + j.pr + ' で見る</a>' : '';
      h += '<div class="fx-sum">bot の指摘（round ' + j.findings.round + '）: Must ' + (c.Must || 0) + ' / Question ' + (c.Question || 0) + ' / FYI ' + (c.FYI || 0) + prLink + '</div>'
        + '<div class="md" data-testid="fix-findings-body">' + renderMiniMarkdown(j.findings.body) + '</div>';
    } else {
      h += '<div class="muted">' + (j.pr ? 'PR#' + j.pr + ' に bot の指摘はまだありません。' : 'この Issue には開いている PR がありません。') + '</div>';
    }
    if ((j.pendingInstructions || []).length) {
      h += '<div class="fx-sum">まだ AI が対応していない指示があります（' + j.pendingInstructions.length + ' 件）。今回の指示と一緒に対応します。</div>';
    }
    box.innerHTML = h;
  } catch (e) {
    if (fixIssue === issue) box.innerHTML = '<div class="muted">指摘を読み込めませんでした: ' + esc(e.message) + '</div>';
  }
}
function updateFixSend() {
  document.getElementById('fixsend').disabled = !document.getElementById('fixnote').value.trim();
}
function closeFix() { document.getElementById('fixmodal').classList.remove('open'); fixIssue = null; }
async function sendFix() {
  const issue = fixIssue;
  const text = document.getElementById('fixnote').value.trim();
  if (issue == null || !text) return;
  const btn = document.getElementById('fixsend');
  btn.disabled = true;
  try {
    const j = await postJson('/delegate', { issue, instruction: text });
    closeFix();
    toast('#' + issue + ' の指示を PR に残して AI に渡しました' + (j.nextPhase ? '（次は ' + j.nextPhase + '）' : ''));
  } catch (e) {
    toast('#' + issue + ' を渡せませんでした: ' + e.message, true);
    updateFixSend();
  }
  refresh();
}
// 「確認の結果を書く」（リリース確認・#2430）: 押したときだけ観点を取ってきて、観点ごとに OK / NG を選んで送る
let relIssue = null;
let relRound = null;
let relVerdicts = {};
async function openRelease(issue) {
  relIssue = issue; relRound = null; relVerdicts = {};
  const box = document.getElementById('relpoints');
  document.getElementById('reltitle').textContent = '確認の結果を書く #' + issue;
  document.getElementById('relnote').value = '';
  box.innerHTML = '<div class="muted">観点を読み込み中…</div>';
  updateRelSend();
  document.getElementById('relmodal').classList.add('open');
  try {
    const r = await fetch('/release-check?issue=' + issue);
    const j = await r.json().catch(() => ({}));
    if (relIssue !== issue) return;
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    // 🙋 を付けたままの EPIC（human-wait.md）は、観点をまとめる前に人間の番になる。ここから AI に頼めるようにする
    if (!j.check) {
      box.innerHTML = '<div class="muted">まだ観点のコメントがありません。</div>'
        + '<div class="acts"><button type="button" class="go" data-act="rel-collect" data-issue="' + issue + '" data-testid="release-collect">AI に観点をまとめてもらう</button></div>';
      return;
    }
    relRound = j.check.round;
    const link = j.check.previewUrl ? ' · <a href="' + esc(j.check.previewUrl) + '" target="_blank" rel="noopener noreferrer">プレビューを開く ↗</a>' : '';
    const cl = j.check.id ? ' · <a href="' + esc(repoUrl + '/issues/' + issue + '#issuecomment-' + j.check.id) + '" target="_blank" rel="noopener">Issue で見る</a>' : '';
    box.innerHTML = '<div class="fx-sum">round ' + j.check.round + ' · 観点 ' + j.check.points.length + ' 件' + link + cl
      + (j.reviewed ? ' · <b>この round の結果は送ってあります</b>' : '') + '</div>'
      + j.check.points.map((p) => '<div class="rpt" data-testid="release-point" data-id="' + esc(p.id) + '">'
        + '<div class="rpt-h"><b>' + esc(p.id) + '. ' + esc(p.title) + '</b><span class="vd">'
        + '<button type="button" class="ibtn ok" data-act="rel-v" data-id="' + esc(p.id) + '" data-v="ok" aria-pressed="false">OK</button>'
        + '<button type="button" class="ibtn ng" data-act="rel-v" data-id="' + esc(p.id) + '" data-v="ng" aria-pressed="false">NG</button></span></div>'
        + '<div class="md">' + renderMiniMarkdown(p.body) + '</div>'
        + '<textarea data-rel-note="' + esc(p.id) + '" aria-label="' + esc(p.id) + ' のコメント" placeholder="コメント（任意）"></textarea></div>').join('');
  } catch (e) {
    if (relIssue === issue) box.innerHTML = '<div class="muted">観点を読み込めませんでした: ' + esc(e.message) + '</div>';
  }
  updateRelSend();
}
function setRelVerdict(id, v) {
  if (!/^R\\d+$/.test(String(id))) return;
  relVerdicts[id] = v === 'ng' ? 'ng' : 'ok';
  document.querySelectorAll('#relpoints [data-act="rel-v"][data-id="' + id + '"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === relVerdicts[id])));
  updateRelSend();
}
function updateRelSend() {
  const notes = Array.from(document.querySelectorAll('#relpoints [data-rel-note]')).some((t) => t.value.trim());
  const any = Object.keys(relVerdicts).length > 0 || document.getElementById('relnote').value.trim() || notes;
  document.getElementById('relsend').disabled = !(relRound && any);
}
function closeRelease() { document.getElementById('relmodal').classList.remove('open'); relIssue = null; }
async function sendRelease() {
  const issue = relIssue;
  if (issue == null || !relRound) return;
  const results = Object.keys(relVerdicts).map((id) => {
    const t = document.querySelector('#relpoints [data-rel-note="' + id + '"]');
    return { id, verdict: relVerdicts[id], note: t ? t.value : '' };
  });
  // OK / NG を選ばずにメモだけ書いた観点は、捨てずに全体のコメントへ入れる
  const loose = [];
  document.querySelectorAll('#relpoints [data-rel-note]').forEach((t) => {
    const id = t.getAttribute('data-rel-note');
    if (!relVerdicts[id] && t.value.trim()) loose.push(id + ': ' + t.value.trim());
  });
  const comment = [document.getElementById('relnote').value.trim()].concat(loose).filter(Boolean).join('\\n');
  const btn = document.getElementById('relsend');
  btn.disabled = true;
  try {
    const j = await postJson('/release-check/review', { issue, round: relRound, results, comment });
    closeRelease();
    toast('#' + issue + ' の確認の結果を送りました（NG ' + (j.ng || 0) + ' 件）');
  } catch (e) {
    toast('#' + issue + ' の結果を送れませんでした: ' + e.message, true);
    updateRelSend();
  }
  refresh();
}
// 質問に答える（POST /answer）。proceed=false は「メモだけ保存」（GitHub に書かない・🙋 も外さない）
async function sendAnswer(issue, answers, proceed, btn) {
  if (btn) btn.disabled = true;
  try {
    await postJson('/answer', { issue, answers, proceed });
    toast(proceed ? '#' + issue + ' に答えて先へ進めました' : '#' + issue + ' のメモを保存しました');
    if (proceed) { delete qPick[issue]; delete qNote[issue]; }
  } catch (e) {
    toast('#' + issue + ' に答えられませんでした: ' + e.message, true);
  }
  lastQuestionsHtml = '';
  refresh();
}
function questionEntry(issue) { return lastInbox.questions.find((q) => q.issue === issue) || null; }
function answerAction(act, issue, btn) {
  const entry = questionEntry(issue);
  if (!entry) return;
  if (act === 'ans-rec') {
    const rec = recommendedAnswers(entry, qNote[issue]);
    if (rec.ok) sendAnswer(issue, rec.answers, true, btn);
    return;
  }
  const c = chosenAnswers(entry, qPick[issue], qNote[issue], act === 'ans-go');
  if (!c.ok) { toast(act === 'ans-go' ? 'まだ選んでいない質問があります' : '保存するものがありません', true); return; }
  sendAnswer(issue, c.answers, act === 'ans-go', btn);
}
let resolveRequested = {}; // { [issue]: true } 送信中
// コンフリクト解消（#1348）。押すと POST /resolve-conflict。daemon は Status と 🙋 を変えずに解消だけ行う
async function resolveConflict(issue) {
  if (resolveRequested[issue]) return;
  resolveRequested[issue] = true;
  try {
    const r = await fetch('/resolve-conflict?issue=' + issue, { method: 'POST' });
    let j = {};
    try { j = await r.json(); } catch (e) { /* 本文なし */ }
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    toast('#' + issue + ' のコンフリクト解消を頼みました');
  } catch (e) {
    toast('コンフリクト解消の依頼に失敗 #' + issue + ': ' + e.message, true);
  }
  delete resolveRequested[issue];
  await refresh();
}
// 楽観的更新: 先に画面上で移動 → 裏で POST /later → 失敗時は最後に確定した状態へ戻す（#1190）
async function toggleLater(issue, later) {
  const cur = laterPending[issue];
  if (cur && cur.inFlight) return;
  const it = findItem(issue);
  const seq = ++laterSeq;
  laterPending = laterPendingReducer(laterPending,
    { type: 'request', issue, later, current: effectiveLater(it, laterPending), seq });
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
    toast('あとでやる の切り替えに失敗（元に戻しました） #' + issue + ': ' + e.message, true);
  }
  rerender();
}
// step: -1 = 上げる / 1 = 下げる（onclick に文字列を書かない: このスクリプトは template literal の中）
async function movePriority(issue, step) {
  const direction = step < 0 ? 'up' : 'down';
  try {
    const r = await fetch('/priority', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ issue, direction }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    const it = findItem(issue);
    if (it) { it.priority = j.priority; it.effectivePriority = { priority: j.priority, source: 'own', from: null }; }
    rerender();
  } catch (e) { toast('#' + issue + ' の優先度を変えられませんでした: ' + e.message, true); }
}
// 並列の計画の 1 行（EPIC #2384）。上限の ± は状況板の上に置く
function renderSchedule(d) {
  const el = document.getElementById('schedule');
  if (!el) return;
  const L = d.schedulerLimits || {};
  const ov = d.schedulerOverrides || {};
  const step = (k, delta) => '<button data-testid="schedule-' + k + '-' + (delta > 0 ? 'up' : 'down') + '" onclick="changeLimit(' + LIMIT_KEYS.indexOf(k) + ', ' + delta + ')">' + (delta > 0 ? '+' : '−') + '</button>';
  const reason = d.schedule ? esc(d.schedule.reason) : '（まだ計画していません）';
  el.innerHTML = '並列: ' + reason + ' · 上限 全体 ' + step('maxTotal', -1) + ' <b>' + (L.maxTotal ?? '?') + '</b> ' + step('maxTotal', 1)
    + ' 重い ' + step('maxHeavy', -1) + ' <b>' + (L.maxHeavy ?? '?') + '</b> ' + step('maxHeavy', 1)
    + (Object.keys(ov).length ? ' <span title="モニターで変えた値（再起動で消える）">（一時変更中 <button onclick="resetLimits()">戻す</button>）</span>' : '');
}
async function postScheduler(body) {
  try {
    const r = await fetch('/scheduler', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (lastBoard) { lastBoard.schedulerLimits = j.limits; lastBoard.schedulerOverrides = j.overrides; renderSchedule(lastBoard); }
  } catch (e) { toast('上限を変えられませんでした: ' + e.message, true); }
}
const LIMIT_KEYS = ['maxTotal', 'maxHeavy'];
function changeLimit(idx, delta) {
  const k = LIMIT_KEYS[idx];
  const cur = (lastBoard && lastBoard.schedulerLimits && lastBoard.schedulerLimits[k]) || 0;
  postScheduler({ [k]: Math.max(0, cur + delta) });
}
function resetLimits() { postScheduler({ maxTotal: null, maxHeavy: null }); }

function rerender() {
  if (!lastBoard) return;
  renderAlerts(lastBoard);
  renderInbox(lastBoard);
  renderBoard(lastBoard);
  renderTabs();
}

// 学び・タスクの数（あなた宛て・バッジ・タブ）。どちらも daemon の手元のファイルを読むだけ（GitHub に触らない）
async function loadSide() {
  const get = (p) => fetch(p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [l, t] = await Promise.all([get('/learnings'), get('/tasks')]);
  lastLearn = l;
  lastTasks = t;
}
async function refresh() {
  try {
    const [d] = await Promise.all([fetch('/board').then((r) => r.json()), loadSide()]);
    lastBoard = d;
    // ボードが目標状態に追いついた保留だけ解除（古いキャッシュで楽観的に動かした行を戻さない）
    laterPending = laterPendingReducer(laterPending, { type: 'board', items: d.items || [] });
    renderStatus(d);
    renderUsage(d);
    renderRate(d);
    renderVersion(d);
    renderCurrentStatus(d);
    renderAlerts(d);
    renderSchedule(d);
    renderInbox(d);
    renderBoard(d);
    renderHistory(d);
    renderTabs();
  } catch (e) {
    const st = document.getElementById('state');
    st.className = 'st c-stop';
    st.innerHTML = '<span class="dot ring"></span><b>応答なし</b>';
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

// ---- イベント ----
document.getElementById('mclose').onclick = closeModal;
document.getElementById('fixclose').onclick = closeFix;
document.getElementById('relclose').onclick = closeRelease;
document.getElementById('relcancel').onclick = closeRelease;
document.getElementById('relsend').onclick = sendRelease;
document.getElementById('relnote').addEventListener('input', updateRelSend);
document.getElementById('relpoints').addEventListener('input', updateRelSend);
document.getElementById('relmodal').addEventListener('click', (e) => { if (e.target.id === 'relmodal') closeRelease(); });
document.getElementById('fixcancel').onclick = closeFix;
document.getElementById('fixsend').onclick = sendFix;
document.getElementById('fixnote').addEventListener('input', updateFixSend);
document.getElementById('fixmodal').addEventListener('click', (e) => { if (e.target.id === 'fixmodal') closeFix(); });
document.getElementById('mreload').onclick = loadLog;
document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.getElementById('updbadge').onclick = openUpdateModal;
document.getElementById('updclose').onclick = closeUpdateModal;
document.getElementById('updmodal').addEventListener('click', (e) => { if (e.target.id === 'updmodal') closeUpdateModal(); });
document.getElementById('drawerclose').onclick = closeDrawer;
document.getElementById('scrim').onclick = closeDrawer;
// 使用量詳細ポップオーバー（#996）。アイコンは refresh のたび innerHTML で再生成されるので #usage への委譲で拾う
document.getElementById('usage').addEventListener('click', (e) => {
  if (!e.target.closest('.uicon')) return;
  e.stopPropagation(); // 直後の document クリック（外側クリック判定）で閉じないように
  toggleUsagePop();
});
document.getElementById('usage').addEventListener('keydown', (e) => {
  if (!e.target.closest('.uicon')) return;
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); toggleUsagePop(); }
});
document.addEventListener('click', (e) => {
  if (!usagePopOpen) return;
  if (e.target.closest('#usagepop') || e.target.closest('.uicon')) return;
  closeUsagePop();
});
window.addEventListener('resize', () => { if (usagePopOpen) positionUsagePop(); });
// タイトルのホバー（マウスだけ。タッチのホバーはクリックで扱う）とフォーカス
document.addEventListener('pointerover', (e) => {
  const t = e.pointerType === 'mouse' && e.target.closest('[data-tip]');
  if (t) titleTipEvent({ type: 'enter', key: t.dataset.tip });
});
document.addEventListener('pointerout', (e) => {
  const t = e.pointerType === 'mouse' && e.target.closest('[data-tip]');
  if (t && !t.contains(e.relatedTarget)) titleTipEvent({ type: 'leave', key: t.dataset.tip });
});
document.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) titleTipEvent({ type: 'focus', key: t.dataset.tip }); });
document.addEventListener('focusout', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) titleTipEvent({ type: 'blur', key: t.dataset.tip }); });
window.addEventListener('resize', () => { if (tipState.open) showTitleTip(); });
document.addEventListener('scroll', () => { if (tipState.open) showTitleTip(); }, true);
// まとめてクリックを受ける（行は 5 秒ごとに作り直すので、要素ごとに付けない）
document.addEventListener('click', (ev) => {
  // タイトルのツールチップの切り替えは、タイトルの文字の部分だけ（ほかの部分の動作は変えない）
  const tipT = ev.target.closest('[data-tip]');
  if (tipT) { closeMenus(); titleTipEvent({ type: 'click-title', key: tipT.dataset.tip }); return; }
  if (ev.target.closest('#titletip')) { closeMenus(); titleTipEvent({ type: 'click-tip' }); return; }
  if (tipState.open) titleTipEvent({ type: 'click-outside' });
  const t = ev.target.closest('button, a, [data-act]');
  const inMenu = ev.target.closest('#rowmenu, #globalmenu');
  if (!t) { if (!inMenu) closeMenus(); return; }
  if (t.dataset.mi != null) { const fn = menuActs[Number(t.dataset.mi)]; closeMenus(); if (fn) fn(); return; }
  if (t.id === 'globalmenubtn') {
    const m = document.getElementById('globalmenu');
    const willOpen = m.hidden;
    closeMenus();
    if (willOpen) { m.hidden = false; t.setAttribute('aria-expanded', 'true'); placeMenu(m, t); }
    return;
  }
  if (!inMenu) closeMenus();
  if (t.id === 'inboxtoggle') { setInboxOpen(false); document.getElementById('inbox-rail').focus(); return; }
  if (t.id === 'inbox-rail') { setInboxOpen(true); document.getElementById('inboxtoggle').focus(); return; }
  if (t.dataset.drawer) { openDrawer(t.dataset.drawer); return; }
  if (t.dataset.tab) { goTo(t.dataset.tab); return; }
  if (t.dataset.f) {
    boardFilter = t.dataset.f;
    try { localStorage.setItem(BOARD_FILTER_KEY, boardFilter); } catch (e) { /* storage 不可でも動く */ }
    rerender();
    return;
  }
  const act = t.dataset.act;
  const issue = Number(t.dataset.issue);
  if (act === 'rowmenu') { ev.stopPropagation(); openRowMenu(t, issue); return; }
  if (act === 'exp') { const k = t.dataset.key; if (openGroups.has(k)) openGroups.delete(k); else openGroups.add(k); rerender(); return; }
  if (act === 'delegate') { delegateIssue(issue, t); return; }
  if (act === 'fix') { openFix(issue); return; }
  if (act === 'release') { openRelease(issue); return; }
  if (act === 'rel-collect') { closeRelease(); delegateIssue(issue, t); return; }
  if (act === 'rel-v') { setRelVerdict(t.dataset.id, t.dataset.v); return; }
  if (act === 'q-open') { openQuestion = issue; lastQuestionsHtml = ''; rerender(); return; }
  if (act === 'pick') {
    const picks = qPick[issue] || (qPick[issue] = {});
    picks[t.dataset.q] = t.dataset.k;
    lastQuestionsHtml = '';
    rerender();
    return;
  }
  if (act === 'ans-rec' || act === 'ans-go' || act === 'ans-save') { answerAction(act, issue, t); return; }
  if (act === 'learn-act') { const b = document.getElementById('lt-learn-btn'); if (b && !b.disabled) b.click(); setTimeout(refresh, 800); return; }
  if (act === 'group-more') {
    const k = t.dataset.key;
    if (openInboxGroups.has(k)) openInboxGroups.delete(k); else openInboxGroups.add(k);
    rerender();
  }
});
document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset && t.dataset.act === 'note') {
    const issue = Number(t.dataset.issue);
    (qNote[issue] || (qNote[issue] = {}))[t.dataset.q] = t.value;
  }
});
document.getElementById('q').addEventListener('input', () => { if (lastBoard) renderBoard(lastBoard); });
// 数字キー 1〜4: 欄へ移る（入力欄の中・⌘/Ctrl/Alt との組み合わせでは効かない）
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { titleTipEvent({ type: 'escape' }); closeFix(); closeRelease(); closeModal(); closeUpdateModal(); closeUsagePop(); closePrMenu(); closeMenus(); closeDrawer(); return; }
  const tag = (e.target.tagName || '').toLowerCase();
  const inInput = tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(e.target.isContentEditable);
  const target = digitTarget({ code: e.code, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, inInput });
  if (target) { e.preventDefault(); goTo(target); return; }
  if (wideLayout() && isInboxToggleKey({ key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, inInput })) {
    e.preventDefault();
    setInboxOpen(!inboxOpen);
  }
});
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
  try { await fetch('/tick', { method: 'POST' }); toast('tick を 1 回走らせました'); } catch (e) { /* refresh 側で表示 */ }
  refresh();
};
document.getElementById('refreshboard').onclick = async () => {
  try {
    const r = await fetch('/refresh', { method: 'POST' }).then((x) => x.json());
    toast(r && r.skipped ? 'API レート残量が僅少のためスキップしました（残 ' + r.minRemaining + '）' : 'GitHub から読み直しました');
  } catch (e) { /* refresh 側で表示 */ }
  refresh();
};
document.getElementById('csmake').onclick = async () => {
  try { await fetch('/current-status', { method: 'POST' }); toast('現在地を作り始めました'); } catch (e) { toast('現在地を作れませんでした: ' + e.message, true); }
  refresh();
};
applyInboxOpen();
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
