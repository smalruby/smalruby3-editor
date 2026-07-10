---
name: check-autopilot
description: autopilot daemon の状態確認と異常（Blocked / 認証失効 / stuck）の診断・復旧支援。「check autopilot」「check autopilot #<issue>」のようなショートカットメッセージで起動する。
---

# check-autopilot — autopilot の異常診断・復旧支援

ユーザーが「check autopilot」（全体確認）または「check autopilot #123」（特定 Issue）と
入力したときに実行する。Web モニタのアラート帯からコピーされるショートカットでもある。

## 手順

### 1. daemon の状態を取得する

```bash
curl -s localhost:8787/board | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));
console.log("paused:", d.paused, d.pausedBy||""); if(d.authError) console.log("authError:", d.authError);
console.log("running:", JSON.stringify(d.running));
for (const it of d.items) console.log(`#${it.issue} ${it.status} ai=${it.aiStatus||"-"} hitl=${it.hitl} prs=${(it.prs||[]).map(p=>p.number+":"+p.state).join(",")||"-"} | ${it.title.slice(0,50)}`);
console.log("--- history (直近10) ---");
for (const h of d.history.slice(0,10)) console.log(new Date(h.endedAt).toISOString(), `#${h.issue}`, h.phase, h.outcome, h.note||"");'
```

- 接続できない場合: daemon が起動していない（クラッシュ含む）。`tmux has-session -t autopilot-daemon`・
  `/tmp/autopilot-daemon.pid`・`tmp/autopilot-daemon.log` の末尾でクラッシュ理由を確認する。
  **認証（`bin/bot-token >/dev/null 2>&1`）が有効なら Claude が `bash tmp/autopilot_up.sh` で再起動してよい**
  （SSO 失効なら先に人間へ `aws sso login --sso-session smalruby --use-device-code` を依頼 → 回復確認 → 起動）。
  起動後に `curl -s localhost:8787/status` で疎通・authError・boot commit を確認して報告する。
  daemon が bot-token 取得不能で未捕捉例外クラッシュした事例があるため、**再起動前の認証確認は必須**。

### 2. 異常の種類ごとに診断する

**認証失効（authError あり / pausedBy=auth）**
- `bin/bot-token --whoami` を実行して再現確認。
- SSO 失効なら、ユーザーに `aws sso login --sso-session smalruby --use-device-code` の実行を
  依頼する（デバイスコード承認はホストのブラウザで人間が行う。Claude は代行できない）。
- 再認証後は daemon が自動で resume する（次の interval で回復を検知）。

**Blocked の item（`check autopilot #<issue>` で特定 Issue を指されたときは必ず）**
1. Issue の bot コメント（Blocked 理由）を読む:
   `GH_TOKEN="$(bin/bot-token)" gh issue view <N> --repo smalruby/smalruby3-editor --json title,body,comments`
2. 実行履歴（/board の history）と、あれば worktree
   （`bin/autopilot-worktree path <N>`）の状態（`git -C <path> status` / `tmp/autopilot-result-<N>.json`）を確認。
3. 原因を特定して要約し、次の選択肢を提示する（勝手に実行しない。ユーザーの指示を待つ）:
   - 原因を取り除いたうえで `🙋 HITL` ラベルを外す（→ autopilot が再開: PR あり=address-review / 無し=triage）
   - **Status=Blocked のまま resume する場合の注意**: `🙋 HITL` を外しても、daemon の
     face-sync（特に再起動時）が Blocked を人間ゲートとみなして `🙋 HITL` を再付与し得る。
     確実に再開させるには **Status を Blocked → In Progress に戻す**（`gh project item-edit` で
     Status フィールドを設定）+ HITL 除去をセットで行う。Blocked 復旧の再ルートは単一ライター
     原則の例外として許容される（本スキルで実施可）。
   - `POST /inject?issue=<N>&phase=<p>` で特定フェーズを再投入
   - worktree を作り直す: `bin/autopilot-worktree remove <N>` → 次の dispatch で再作成
   - 不要なら Status を Icebox / Close へ（GitHub Projects で操作）

**実行中のまま長い（running の since が古い）**
- `curl -s 'localhost:8787/log?issue=<N>'` で pane ログを確認（watchdog が面倒を見るのが原則。
  暴走が明らかなときのみ `POST /stop?issue=<N>` を提案）。

### 3. 報告

- 状態の要約（RUNNING/PAUSED、実行中、Blocked 件数、認証状態）
- 異常ごとの原因と推奨アクション（上記の選択肢から）
- 破壊的な操作（stop / worktree remove / Status 変更）は**提案のみ**とし、ユーザーの明示的な
  指示があってから実行する

## 注意

- daemon のポートは既定 8787（`--port` で変更されている場合はユーザーに確認）。
- Project の Status/AI Status を直接書き換えない（単一ライターは daemon。人間は GitHub Projects で操作）。
- ログ・コメントに機密（トークン等）を見つけたら、それ自体を出力に転記しない。
