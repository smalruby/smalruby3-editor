# autopilot — GitHub API 予算・認証経路の規約

daemon は常駐で GitHub をポーリングするため、**API レート予算が設計制約**
（実測で Bot の GraphQL 残 0 に到達した実績がある）。`tools/autopilot/` に GitHub への
問い合わせ・書き込みを追加するときは以下を守る。実装は `tools/autopilot/src/project.js` に
集約されている。

## 1. トークン分散（読み書きで別トークン）

- **書き込み**（コメント・ラベル・Draft/Ready・Project 編集・close）= **Bot トークン**
  （`project.botToken()` → `bin/bot-token`。名義が見える操作は Bot 名義）。
- **読み取り**（一覧・PR/Issue 情報・レビュー状態・アクティビティ）= **`project.readToken()`**。
  解決順: env `AUTOPILOT_READ_TOKEN` → env `GH_TOKEN` → `gh auth token` → Bot フォールバック。
  `AUTOPILOT_READS=bot` で従来動作（読みも Bot）に戻せる。
- 新しい読み取りを Bot トークンで書く / 新しい書き込みを個人トークンで書くのは逸脱
  （前者は予算の一点集中、後者は名義の混在）。

## 2. GraphQL / REST の使い分け（別枠予算の並行活用）

- **バッチ読み**（複数 issue の enrichment・closed 状態一括確認・レビュー状態）=
  **GraphQL**（alias で 50〜100 件/回にまとめる。例: `getIssueStates`）。
- **単発読み**（PR 情報 `/pulls/N`・Issue メタ `/issues/N`・コメント一覧）= **REST**
  （例: `getIssueMeta` は body/labels/state を REST 1 回で取る。GraphQL の
  `gh issue view` を 2 回呼ぶより安い）。
- N 件ループで単発 GraphQL を N 回叩く実装は逸脱（alias バッチにするか REST へ）。

## 3. 問い合わせ対象の限定

- リポジトリ横断の広い問い合わせは **`🤖 autopilot` ラベル付き限定**にする
  （label healing がラベルを毎 tick 担保しているので絞ってよい）。
- **終端 Status（Close / Done）は定常問い合わせから除外**（`selectClosedCheckIssues` /
  `TERMINAL_STATUSES`）。「リポジトリ全体の closed 一覧を毎 tick 取得」のような
  全量スキャンを復活させない（旧実装で予算を枯渇させた）。

## 4. 書き込みは差分時のみ

- sticky コメントは **内容が変わったときだけ PATCH**（`stickyUpsertPlan` の `skip`）。
- ラベル同期は item-list が返す値を再利用し、面同期のための再取得をしない。
- 「毎 tick 同じ内容を上書きする」書き込みは逸脱（冪等 = 書かない、が正）。

## 5. 残量監視と自動退避

- `gh api rate_limit` は**レート消費なし**。tick ごとに Bot / 個人の両方を確認し、
  `rateLimitPlan`（純粋関数）で計画を立てる: **最小残量 < 200 で低優先処理
  （PR 面投影・俯瞰ボード更新）を自動スキップ**、< 500 で warn。dispatch・merge 検知は継続。
- **新しい定期ポーリングタイマーを安易に追加しない**。俯瞰ボードの再取得（`listItems` ≈
  100 GraphQL ポイント/回）を 60 秒タイマーで回した旧実装は、read トークンの GraphQL 予算
  5000/h を単独で超過した。更新はオンデマンド（`POST /refresh`）か tick 便乗にする。
  ブラウザ側のポーリングは**キャッシュ（`GET /board`）を読むだけ**にして GitHub に触らせない。

## 認証まわりの規約

- worker（プロンプト）の gh 操作は `GH_TOKEN="$(bin/bot-token)" gh ...`、コミットは
  `bin/bot-git`、push は `bin/autopilot-push`（`.claude/rules/github-app-bot.md` と
  `.claude/rules/autopilot/prompts.md` を参照）。**共有 `.git/config` を書き換えない**。
- Bot 秘密鍵は `~/.config/smalruby-bot/config` の `PRIVATE_KEY_SECRET_ID` 経由で
  AWS Secrets Manager から取得できる（ローカル `.pem` はフォールバック）。
- daemon は interval ごとに認証ヘルスチェックし、bot トークン取得不能で
  **auto-pause**（`pausedBy: "auth"`）、回復で auto-resume。**人間が押した pause を
  auth 系の自動 resume で上書きしない**こと（`pausedBy` の区別を保つ）。
- 運用手順（SSO device code 再認証・モニタの再接続ボタン）は `docs/autopilot/README.md`。
