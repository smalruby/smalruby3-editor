'use strict';
/**
 * blocked-panel.js — モニターの「止まっている worker」の欄（#2387）。
 *
 * monitor.js の HTML に差し込む自己完結の断片（CSS・HTML・JS）。`GET /blocked` を 5 秒ごとに読み、
 * AI が NG と判定して一時停止した worker の画面と選択肢を出す。人間は選択肢のボタン・キー・文で
 * 答えられる（`POST /blocked/answer`）。待っている worker が無いときは何も出さない。
 * 現在地（指揮役の artifact）には出さず、ここだけに出す（EPIC #2384 の決まり）。
 */

const BLOCKED_PANEL_HTML = `
<style>
#blockedpanel { margin: 8px 0; }
#blockedpanel .bw { border: 2px solid #d9822b; border-radius: 6px; padding: 8px; margin: 6px 0; background: #fff8ef; }
#blockedpanel .bw h3 { margin: 0 0 4px; font-size: 14px; }
#blockedpanel pre { max-height: 260px; overflow: auto; background: #1e1e1e; color: #ddd; padding: 6px; font-size: 11px; white-space: pre-wrap; }
#blockedpanel .opts button { margin: 2px 4px 2px 0; }
#blockedpanel input[type=text] { width: 40%; }
#blockedpanel .bh { font-size: 11px; color: #666; }
@media (prefers-color-scheme: dark) { #blockedpanel .bw { background: #2a2116; } }
</style>
<div id="blockedpanel" data-testid="blocked-panel"></div>
<script data-panel="blocked">
(() => {
  const el = document.getElementById('blockedpanel');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let last = '';
  async function answer(issue, body) {
    try {
      const r = await fetch('/blocked/answer', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ issue }, body)) });
      if (!r.ok) alert('送れませんでした: ' + ((await r.json()).error || r.status));
    } catch (e) { alert('送れませんでした: ' + e.message); }
    load();
  }
  window.__blockedAnswer = answer;
  function render(d) {
    const w = d.waiting || [];
    if (!w.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<b>⏸ 止まっている worker（' + w.length + '）</b>' + w.map((x) => {
      const opts = (x.options || []).map((o) => {
        return o.number != null ? '<button data-testid="blocked-option" onclick="__blockedAnswer(' + x.issue + ', {keys: [' + Number(o.number) + ']})">'
          + esc(o.number + '. ' + o.label) + '</button>' : '';
      }).join('');
      return '<div class="bw" data-issue="' + x.issue + '"><h3>#' + x.issue + ' ' + esc(x.phase) + ' — ' + esc(x.reason) + '</h3>'
        + '<div class="bh">' + esc(x.since) + ' から待っています（60 分の上限は止めています）' + (x.answerPending ? ' · 答えを送っています…' : '') + '</div>'
        + '<pre>' + esc(x.screen) + '</pre>'
        + '<div class="opts">' + opts
        + ' キー: <input type="text" data-testid="blocked-keys" placeholder="例: down enter" id="bk' + x.issue + '">'
        + '<button data-testid="blocked-send-keys" onclick="__blockedAnswer(' + x.issue + ', {keys: document.getElementById(\\'bk' + x.issue + '\\').value.trim().split(/\\\\s+/)})">キーを送る</button>'
        + ' 文: <input type="text" data-testid="blocked-text" id="bt' + x.issue + '">'
        + '<button data-testid="blocked-send-text" onclick="__blockedAnswer(' + x.issue + ', {text: document.getElementById(\\'bt' + x.issue + '\\').value})">文を送る</button>'
        + '</div></div>';
    }).join('');
    el.querySelectorAll('pre').forEach((p) => { p.scrollTop = p.scrollHeight; }); // プロンプトは画面の下にある
  }
  async function load() {
    try {
      const d = await fetch('/blocked').then((r) => r.json());
      const key = JSON.stringify(d.waiting || []);
      // 入力中に書きかえないよう、中身が変わったときだけ描き直す
      if (key !== last) { last = key; render(d); }
    } catch (e) { /* daemon が止まっている */ }
  }
  load(); setInterval(load, 5000);
})();
</script>
`;

module.exports = { BLOCKED_PANEL_HTML };
