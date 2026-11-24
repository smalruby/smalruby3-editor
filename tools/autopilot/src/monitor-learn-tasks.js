'use strict';
/**
 * monitor-learn-tasks.js — モニターの「学び」と「タスク」の欄（EPIC #2384 の M6 / R1 / E1）。
 *
 * monitor.js の HTML に埋め込む部品だけを持つ（自己完結・外部リソースなし）。
 * `/learnings` と `/tasks` は daemon の手元のファイルを読むだけで GitHub に触らないので、
 * ボードと同じ 5 秒の poll で読んでよい。GitHub に触るのはボタンを押したときだけ
 * （PR を作る worker の起動・CI を確かめてマージ）。
 */

const LEARN_TASKS_CSS = `
  #learntasks { margin: 1rem 0; display: grid; gap: .6rem; grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr)); }
  #learntasks details { border: 1px solid #cbd5e1; border-radius: .4rem; padding: .4rem .6rem; background: #f8fafc; }
  #learntasks summary { cursor: pointer; font-weight: 600; }
  #learntasks table { width: 100%; border-collapse: collapse; font-size: .8rem; margin-top: .3rem; }
  #learntasks td, #learntasks th { border-bottom: 1px solid #e2e8f0; padding: .2rem .3rem; text-align: left; vertical-align: top; }
  #learntasks .lt-err { color: #b91c1c; font-size: .8rem; }
  #learntasks form { display: grid; gap: .3rem; margin-top: .4rem; font-size: .8rem; }
  #learntasks textarea { min-height: 4rem; }
`;

const LEARN_TASKS_HTML = `<div id="learntasks" data-testid="learn-tasks">
  <details id="lt-learn" data-testid="learnings-panel" open><summary>📚 学び <span id="lt-learn-count"></span></summary>
    <div id="lt-learn-reason" class="muted"></div>
    <button id="lt-learn-btn" data-testid="learnings-action" disabled></button>
    <div id="lt-learn-msg" class="lt-err"></div>
    <table><tbody id="lt-learn-rows"></tbody></table>
  </details>
  <details id="lt-tasks" data-testid="tasks-panel" open><summary>🗓 タスク <span id="lt-task-count"></span></summary>
    <table><thead><tr><th>タスク</th><th>予定</th><th>次</th><th>前回</th><th></th></tr></thead>
      <tbody id="lt-task-rows"></tbody></table>
    <div id="lt-task-msg" class="lt-err"></div>
    <details><summary>＋ タスクを作る</summary>
      <form id="lt-task-form" data-testid="tasks-create-form">
        <input name="title" placeholder="タイトル（例: 不具合報告の確認）" required>
        <textarea name="prompt" placeholder="worker にさせること" required></textarea>
        <input name="at" placeholder="時刻（空ならいま。例 2026-11-25T09:00:00+09:00）">
        <input name="cron" placeholder="定期なら cron（例 0 9 * * 1-5 = 平日 9 時）">
        <button type="submit" data-testid="tasks-create">作る</button>
      </form>
    </details>
  </details>
</div>`;

const LEARN_TASKS_SCRIPT = `
function ltEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function ltTime(ms) { if (ms == null) return '—'; const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
let ltLearnAction = null;
async function ltRefresh() {
  try {
    const l = await fetch('/learnings').then((r) => r.json());
    ltLearnAction = l.action && l.action.action;
    document.getElementById('lt-learn-count').textContent = '(' + l.count + ')';
    document.getElementById('lt-learn-reason').textContent = (l.plan && l.plan.reason) || '';
    const btn = document.getElementById('lt-learn-btn');
    btn.textContent = (l.action && l.action.label) || '';
    btn.disabled = !l.action || l.action.disabled;
    btn.style.display = l.action && l.action.action !== 'none' ? '' : 'none';
    if (l.error) document.getElementById('lt-learn-msg').textContent = '前回の失敗: ' + l.error;
    document.getElementById('lt-learn-rows').innerHTML = (l.entries || []).map((e) =>
      '<tr><td>' + (e.kind === 'review' ? '👀' : '🧭') + '</td><td>' + ltEsc(e.areas.join(', ')) + '</td><td>' + ltEsc(e.text) + '</td></tr>').join('')
      || '<tr><td class="muted">（ためた学びはありません）</td></tr>';
    const t = await fetch('/tasks').then((r) => r.json());
    document.getElementById('lt-task-count').textContent = '(' + (t.tasks || []).length + ')';
    document.getElementById('lt-task-rows').innerHTML = (t.tasks || []).map((r) =>
      '<tr data-testid="task-row" data-task="' + ltEsc(r.id) + '"><td title="' + ltEsc(r.id) + '">' + ltEsc(r.title) + (r.source === 'local' ? ' <span class="muted">(手元)</span>' : '') + '</td>'
      + '<td>' + ltEsc(r.schedule) + (r.enabled ? '' : ' ⏸') + '</td>'
      + '<td>' + (r.running ? '▶ 実行中 <a href="#" onclick="ltOpenLog(\\'' + ltEsc(r.id) + '\\');return false">log</a>' : r.queued ? '⏳ 待ち' : ltTime(r.nextRunAt)) + '</td>'
      + '<td title="' + ltEsc(r.lastSummary || '') + '">' + (r.lastOutcome ? ltEsc(r.lastOutcome) + ' ' + ltTime(r.lastRunAt) : '—') + '</td>'
      + '<td><button data-testid="task-run-now" onclick="ltRunNow(\\'' + ltEsc(r.id) + '\\')"' + (r.running || r.queued ? ' disabled' : '') + '>▶ いま実行</button></td></tr>').join('')
      || '<tr><td colspan="5" class="muted">（タスクはありません）</td></tr>';
    document.getElementById('lt-task-msg').textContent = (t.invalid || []).length
      ? '正しくない定義: ' + t.invalid.map((x) => x.id + '（' + x.errors.join('; ') + '）').join(' / ') : '';
  } catch (e) { /* daemon が落ちているときはボードの側で表示する */ }
}
async function ltRunNow(id) {
  await fetch('/tasks/run?id=' + encodeURIComponent(id), { method: 'POST' }).catch(() => {});
  ltRefresh();
}
async function ltOpenLog(id) {
  const t = await fetch('/tasks/log?id=' + encodeURIComponent(id)).then((r) => r.text()).catch(() => '');
  document.getElementById('mtitle').textContent = 'task ' + id;
  document.getElementById('mlog').textContent = t;
  document.getElementById('modal').classList.add('open');
}
document.getElementById('lt-learn-btn').onclick = async () => {
  const msg = document.getElementById('lt-learn-msg');
  msg.textContent = '';
  const path = ltLearnAction === 'merge' ? '/learnings/merge' : '/learnings/pr';
  const r = await fetch(path, { method: 'POST' }).then((x) => x.json()).catch((e) => ({ error: String(e) }));
  if (r.error || r.reason) msg.textContent = r.error || r.reason;
  ltRefresh();
};
document.getElementById('lt-task-form').onsubmit = async (ev) => {
  ev.preventDefault();
  const f = ev.target.elements;
  const body = { title: f.title.value, prompt: f.prompt.value, at: f.at.value || undefined, cron: f.cron.value || undefined };
  const r = await fetch('/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then((x) => x.json()).catch((e) => ({ error: String(e) }));
  document.getElementById('lt-task-msg').textContent = r.error || '';
  if (!r.error) ev.target.reset();
  ltRefresh();
};
ltRefresh(); setInterval(ltRefresh, 5000);
`;

module.exports = { LEARN_TASKS_CSS, LEARN_TASKS_HTML, LEARN_TASKS_SCRIPT };
