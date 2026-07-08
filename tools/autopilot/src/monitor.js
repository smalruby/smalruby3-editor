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
<style>
  :root { --border:#e2e8f0; --muted:#64748b; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; color: #1e293b; background:#f8fafc; }
  a { color: #2563eb; text-decoration: none; } a:hover { text-decoration: underline; }
  /* ---- コンパクトヘッダー（1 行固定） ---- */
  header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: .5rem;
           padding: .4rem .8rem; background: #0f172a; color: #e2e8f0; white-space: nowrap; overflow: hidden; }
  header h1 { font-size: .95rem; margin: 0; font-weight: 600; }
  header .pill { flex: none; }
  header button { padding: .15rem .55rem; font-size: .8rem; cursor: pointer; border: 1px solid #334155;
                  background: #1e293b; color: #e2e8f0; border-radius: .3rem; }
  header button:hover { background: #334155; }
  header .meta { margin-left: auto; color: #94a3b8; font-size: .75rem; overflow: hidden; text-overflow: ellipsis; }
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
  table { border-collapse: collapse; width: 100%; background: #fff; font-size: .84rem; }
  th, td { border: 1px solid var(--border); padding: .3rem .5rem; text-align: left; vertical-align: middle; }
  th { background: #f1f5f9; font-size: .75rem; color: #475569; }
  tr.blocked-row td { background: #fef2f2; }
  tr.running-row td { background: #fffbeb; }
  td.title-cell { max-width: 34rem; }
  .t { display: inline-block; max-width: 30rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
  .status-pill { display: inline-block; padding: .05rem .45rem; border-radius: .3rem; font-size: .75rem; font-weight: 600; white-space: nowrap; }
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
  <h1>🤖 autopilot</h1>
  <span id="state" class="pill ok">…</span>
  <button id="pause" title="新規ディスパッチを止める">⏸</button>
  <button id="resume" title="再開">▶</button>
  <button id="ticknow" title="interval を待たず今すぐ 1 tick 実行">⚡ tick</button>
  <button id="refreshboard" title="俯瞰ボードを今すぐ再取得（GraphQL 消費あり）">🔄 更新</button>
  <span class="meta" id="meta"></span>
</header>
<div id="alerts"></div>
<main>
  <table id="board"><thead><tr>
    <th>Issue</th><th>Status</th><th>AI</th><th>担当</th><th>PR</th><th>Sub-issues</th><th>Now</th>
  </tr></thead><tbody id="rows"><tr><td colspan="7" class="muted">読み込み中…</td></tr></tbody></table>
  <h2>実行履歴（最新 100 件・ログ用途のみ）</h2>
  <table id="histt"><thead><tr>
    <th>時刻</th><th>Issue</th><th>Phase</th><th>結果</th><th>メモ</th>
  </tr></thead><tbody id="hist"><tr><td colspan="5" class="muted">（まだ履歴はありません）</td></tr></tbody></table>
</main>
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
    const sub = s.total
      ? '<span class="bar"><div style="width:' + (s.percent || 0) + '%"></div></span>'
        + '<span class="subtext">' + s.completed + '/' + s.total + ' (' + (s.percent || 0) + '%)</span>'
      : '<span class="muted">—</span>';
    const now = r
      ? '<span class="phase-pill">' + esc(r.phase) + '</span>'
        + '<span class="subtext">' + mins(Date.now() - r.since) + '分</span> '
        + '<button onclick="openLog(' + it.issue + ')">log</button>'
      : (it.hitl ? '🙋 <span class="subtext">人間の番</span>' : '<span class="muted">—</span>');
    const who = (it.assignees || []).length
      ? esc((it.assignees || []).join(', '))
      : '<span class="muted">—</span>';
    const kindMark = it.tracker ? ' <span class="subtext" title="tracker (分解済み親)">🧭</span>' : '';
    return '<tr class="' + cls + '">'
      + '<td class="title-cell"><a target="_blank" rel="noopener" href="' + esc(it.url) + '">#' + it.issue + '</a> '
      + '<span class="t" title="' + esc(it.title) + '">' + esc(it.title) + '</span>' + kindMark + '</td>'
      + '<td>' + statusPill(it.status) + '</td>'
      + '<td>' + (it.aiStatus ? esc(it.aiStatus) : '<span class="muted">—</span>') + '</td>'
      + '<td>' + who + '</td>'
      + '<td>' + prs + '</td>'
      + '<td>' + sub + '</td>'
      + '<td>' + now + '</td></tr>';
  });
  document.getElementById('rows').innerHTML = rows.join('')
    || '<tr><td colspan="7" class="muted">（表示対象の Issue はありません）</td></tr>';
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
  const r = await fetch('/log?issue=' + logIssue);
  el.textContent = await r.text();
  if (atBottom) el.scrollTop = el.scrollHeight;
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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
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
