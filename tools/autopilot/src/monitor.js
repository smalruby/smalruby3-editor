'use strict';
/**
 * monitor.js — autopilot daemon が配信する Web ステータスモニタ（自己完結 HTML）。
 *
 * daemon の HTTP サーバが `GET /` で本 HTML を返す。ページは `/status` を定期ポーリングして
 * 一覧・状態を描画し、`/pause` `/resume` `/stop` `/log` を叩いて手動操作・ログ閲覧する。
 * 外部依存なし（インライン CSS/JS）。
 */

const MONITOR_HTML = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>autopilot monitor</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 1.5rem; color: #222; }
  h1 { font-size: 1.2rem; } .muted { color: #888; }
  .bar { margin: .5rem 0 1rem; display: flex; gap: .5rem; align-items: center; }
  button { padding: .3rem .7rem; cursor: pointer; }
  table { border-collapse: collapse; width: 100%; max-width: 800px; }
  th, td { border: 1px solid #ddd; padding: .4rem .6rem; text-align: left; font-size: .9rem; }
  .pill { padding: .1rem .5rem; border-radius: 1rem; font-size: .8rem; }
  .running { background: #fde68a; } .paused { background: #fecaca; } .ok { background: #bbf7d0; }
  pre { background: #111; color: #eee; padding: .8rem; overflow: auto; max-height: 50vh; white-space: pre-wrap; }
</style></head><body>
<h1>🤖 autopilot monitor</h1>
<div class="bar">
  <span id="state"></span>
  <button id="pause">⏸ pause</button>
  <button id="resume">▶ resume</button>
  <button id="ticknow" title="interval を待たず今すぐ 1 tick 実行">⚡ 今すぐ確認</button>
  <span class="muted" id="meta"></span>
</div>
<table><thead><tr><th>Issue</th><th>Phase</th><th>操作</th></tr></thead><tbody id="rows"></tbody></table>
<h2 class="muted" style="font-size:1rem;margin-top:1.2rem">log <span id="logissue"></span></h2>
<pre id="log">（行の「log」を押すと pane を表示）</pre>
<script>
const j = (p, m) => fetch(p, { method: m || 'GET' }).then(r => r.json());
async function refresh() {
  try {
    const s = await j('/status');
    document.getElementById('state').innerHTML = s.paused
      ? '<span class="pill paused">PAUSED</span>' : '<span class="pill ok">RUNNING</span>';
    document.getElementById('meta').textContent = 'concurrency ' + s.concurrency + ' / running ' + s.running.length;
    document.getElementById('rows').innerHTML = s.running.length
      ? s.running.map(r => '<tr><td>#' + r.issue + '</td><td><span class="pill running">' + r.phase
        + '</span></td><td><button onclick="stop(' + r.issue + ')">⏹ stop</button> '
        + '<button onclick="showlog(' + r.issue + ')">log</button></td></tr>').join('')
      : '<tr><td colspan="3" class="muted">（実行中の item はありません）</td></tr>';
  } catch (e) { document.getElementById('state').textContent = 'daemon 応答なし'; }
}
async function stop(i) { await fetch('/stop?issue=' + i, { method: 'POST' }); refresh(); }
async function showlog(i) {
  document.getElementById('logissue').textContent = '#' + i;
  const r = await fetch('/log?issue=' + i); document.getElementById('log').textContent = await r.text();
}
document.getElementById('pause').onclick = () => j('/pause', 'POST').then(refresh);
document.getElementById('resume').onclick = () => j('/resume', 'POST').then(refresh);
async function ticknow() {
  const btn = document.getElementById('ticknow');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = '⏳ 確認中…';
  try { await fetch('/tick', { method: 'POST' }); } catch (e) { /* daemon 応答待ちは refresh 側で表示 */ }
  btn.disabled = false; btn.textContent = label;
  refresh();
}
document.getElementById('ticknow').onclick = ticknow;
refresh(); setInterval(refresh, 2000);
</script></body></html>`;

module.exports = { MONITOR_HTML };
