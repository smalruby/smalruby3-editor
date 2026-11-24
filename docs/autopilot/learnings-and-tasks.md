# autopilot — 人間の答えから学ぶしくみと、タスク（1 回・定期）

> **🆕 Smalruby 独自** — autopilot（`tools/autopilot/`）の機能。

EPIC 単位の確認（決定ページ）で人間が答えたことから、autopilot が次から同じ判断をできるようにする
「学び」と、Issue に結びつかない仕事を worker にさせる「タスク」の 2 つ。EPIC の無い単独の Issue は
これまでどおり扱う（学びもタスクも Issue の流れを変えない）。

## 学び

### 2 種類

| 種類 | いつためるか | 何をためるか |
|---|---|---|
| `intent`（人間の意図） | 決定ページで人間の答えが AI のおすすめと違ったとき | 理由を人間に聞き、そこから読み取った「次からはこうする」決まり |
| `review`（レビューの観点） | EPIC の前の人間との確認で、レビューで見るべきことが分かったとき | review が見るべき観点 |

### 流れ

1. **ためる**: 指揮役（autopilot スキルで動く Claude のセッション）が、決定ページの答えを反映したあと
   `tools/autopilot/bin/autopilot-learn`（daemon が止まっていても使える）か `POST /learnings` で 1 件ずつためる。
   置き場は gitignore された `tmp/autopilot-learnings/<id>.json`（1 件 1 ファイル）。毎回コミットしない。
2. **PR にする**: 5 件たまるか、いちばん古いものが 14 日たつと、モニターの「📚 学び」に
   「📝 学び N 件を PR にする」が出る。押すと worker（`prompts/autopilot-learnings.md`）が develop から切った
   ブランチで `docs/autopilot/learned/<area>.md` を分野ごとに書き直し、develop 宛ての PR を作る。
3. **マージする**: 同じボタンが「✅ PR #N をマージ」になる。押すと daemon が CI を確かめ、通っていれば
   develop にマージし、PR に入れた学びを置き場から消す。PR が変えてよいのは `docs/` と `.claude/` だけで、
   それ以外が入っていたらマージしない（`.claude/rules/topic-branches.md` の例外: docs だけの PR は CI が通れば AI がマージしてよい）。
   PR が閉じられていたら記録だけ消し、学びは残る（もう一度 PR にできる）。

### 読むとき

- 置き場は `docs/autopilot/learned/<area>.md`。分野の名前は `.claude/rules/<area>/` と同じ。
  どの分野にも当てはまらないものは `general`。
- review と implement は、変えるファイルから `learnedRuleFilesFor`（`src/learnings.js`）で分野を出し、
  そのファイルだけ読む（`touchedRuleAreas` と同じ分け方。不要な決まりを読まない）。
- `.claude/` の下に置かないのは、root で動く worker が `.claude/` を書くと許可の確認で止まるため。

## タスク

Issue に結びつかない仕事（例: 毎朝の不具合報告の確認）を、worker（`prompts/autopilot-task.md`）に実行させる。

### 定義

| 置き場 | 中身 |
|---|---|
| `tools/autopilot/tasks.json` | repo 共通（コミットする）。例として既定で止めてある「不具合報告の確認」を置いている |
| `tmp/autopilot-tasks.local.json` | 手元だけ（gitignore）。モニターの「＋ タスクを作る」もここに足す。同じ id は項目ごとに上書きし、`{"id": "...", "enabled": false}` だけで repo のタスクを自分だけ止められる |

```json
{ "tasks": [
  { "id": "bug-report-check", "title": "不具合報告の確認", "enabled": true,
    "schedule": { "type": "cron", "cron": "30 8 * * 1-5", "tz": "+09:00" },
    "prompt": "worker にさせること（または promptFile: repo 相対のパス）" }
] }
```

| `schedule` | いつ実行するか |
|---|---|
| `{ "type": "once" }` | 定義を見つけたらすぐ 1 回 |
| `{ "type": "once", "at": "<時刻>" }` | その時刻に 1 回 |
| `{ "type": "cron", "cron": "分 時 日 月 曜日", "tz": "+09:00" }` | 定期。`*` / `1-5` / `*/15` / `1,3` が使える。曜日の 0 と 7 は日曜。daemon が止まっていて何回分か逃しても、まとめて 1 回だけ実行する |

新しく見つけた cron のタスクは、見つけた時刻より後の予定から実行する（過去の分をさかのぼらない）。

### 実行のしかた

- daemon の tick（pause 中は走らない）で、時刻が来たものを選ぶ（`dueTasks`）。同時に走らせるのは 1 つ
  （`cfg.taskConcurrency`）。Issue の worker の並列とは別に数える。
- worktree は `bin/autopilot-worktree create task-<id>`（`.autopilot-worktrees/issue-task-<id>`）。毎回、変更が
  残っていなければ `origin/develop` にそろえてから始める。tmux のセッションは `autopilot-task-<id>`。
- 実行の記録（前回の時刻・結果・要約）は `tmp/autopilot-tasks-state.json`。
- モニターの「🗓 タスク」で、予定・次の実行・前回の結果を見て、「▶ いま実行」で予定を待たずに実行できる。
  手で実行しても定期の予定は動かない（1 回のタスクは済んだことになる）。

## HTTP

| メソッド・パス | すること |
|---|---|
| `GET /learnings` | ためた学びの数・PR にできるか・ボタンの状態 |
| `POST /learnings` | 学びを 1 件ためる（body: `{kind, areas, text, reason?, source?: {epic, question, recommendation, answer}}`） |
| `POST /learnings/pr` | 学びを PR にする worker を起こす（`?force=1` で件数が少なくても） |
| `POST /learnings/merge` | 学びの PR を、CI が通っていればマージする |
| `GET /tasks` | タスクの一覧と、正しくない定義 |
| `POST /tasks` | 手元にタスクを足す（body: `{title, prompt, at?, cron?, tz?, id?}`） |
| `POST /tasks/run?id=<id>` | いま実行する |
| `GET /tasks/log?id=<id>` | 実行中のタスクの pane |

`GET` は手元のファイルを読むだけで GitHub に触らない。GitHub に触るのはボタンの操作だけ。

## 主要ファイル

| ファイル | 役目 |
|---|---|
| `tools/autopilot/src/learnings.js` | 学びの判断（純粋関数）: 分野のそろえ方・分け方・PR にしてよいか・マージしてよいか |
| `tools/autopilot/src/tasks.js` | タスクの判断（純粋関数）: cron の読み方・次の実行・選び方・記録 |
| `tools/autopilot/src/learn-tasks.js` | 学びとタスクの I/O（置き場・worker の起動・HTTP） |
| `tools/autopilot/src/monitor-learn-tasks.js` | モニターの「📚 学び」「🗓 タスク」の欄 |
| `tools/autopilot/bin/autopilot-learn` | 学びを 1 件ためる CLI |
| `tools/autopilot/prompts/autopilot-learnings.md` / `autopilot-task.md` | worker のプロンプト |

---

## License

This document is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
