# autopilot — 開発規約（コード規約・不変条件）

`tools/autopilot/`（+ `bin/autopilot-worktree` / `bin/autopilot-push` /
`tools/autopilot/prompts/`）を変更するときの規約。**現行実装から導出した事実**であり、
ここから逸脱するコードはレビューで指摘する。

> **docs との役割分担**: 機能の全体像・運用手順は `docs/autopilot/README.md`、
> 状態遷移の正準表は `docs/autopilot/state-machine.md`、プロンプト⇔Runner の契約は
> `docs/autopilot/autonomous-contract.md`。**本 rules は「コードを書く/レビューするときの
> 規約と不変条件」に限定**し、docs の内容を繰り返さない。

## レイヤリング不変条件（最重要）

各モジュールの責務は固定されている。**判断ロジックと I/O を混ぜない**。

| モジュール | 責務 | 禁止事項 |
|---|---|---|
| `src/phases.js` | 判断ロジックの**純粋関数のみ**（フェーズ選択・ゲート解除・watchdog 判断・ラベル差分・sticky 計画・ディレクティブ解析・サニタイズ） | I/O・時計（`Date.now()`）・乱数を持ち込まない。時刻は ms epoch / ISO 文字列を**引数で受け** `toMs` で正規化する |
| `src/contract.js` | 結果ペイロード（`AUTOPILOT_RESULT_FILE`）の検証。`TOKENS` / `SIGNALS` / `validateResult` | スキーマを変えるときは `docs/autopilot/autonomous-contract.md` §2 と**対で更新** |
| `src/project.js` | GitHub（Projects v2 / Issue / PR / ラベル / sticky）への **gh CLI ラッパ**。GitHub I/O はここに集約 | 判断ロジックを書かない（純粋な選別・整形は phases.js へ） |
| `src/daemon.js` | 常駐 tick のオーケストレーション（poll → dispatch → `apply*` ステップ群 → face sync）と HTTP 制御 | 判定は phases.js の純粋関数を呼ぶ。直接 GitHub を叩かず project.js を使う |
| `src/runner.js` | tmux での worker（子 claude）起動・send-keys・watchdog ループ | 判断は `phases.js` の `evaluate` / `shouldResend` / `shouldSignalCheckpoint`（純粋）に委ねる |
| `src/settings.js` | worker 起動設定のロード・マージ・コマンド組み立て・run 資産スナップショット | — |
| `src/monitor.js` | Web モニタ（**自己完結 HTML**。外部 CDN / 外部リソース参照は devpod の egress allowlist で死ぬので不可） | — |
| `src/usage.js` / `src/version.js` / `src/pw-check.js` | usage ファイル読取 / 稼働バージョン・更新検知 / headless UI 確認ヘルパー | — |

**新しい判断ロジックを追加する手順**: ① phases.js に純粋関数として書く → ② `test/` に
unit テストを付ける → ③ daemon/runner から呼ぶ。逆順（daemon に inline で判定を書く）は
逸脱。既存の `apply*` ステップ（`applyMergeProgression` / `applyClosedReconcile` /
`applyDodHandoffs` / `applyLabelHealing` / `applyAfterWaitLabels` / `applyPrProjection`）は
すべて「選別・計画 = phases.js 純粋関数、実行 = daemon + project.js」の形になっている。

## 依存規約

- **Node.js 標準モジュールのみ**（`fs` / `path` / `os` / `http` / `child_process` /
  `timers/promises` / `util`）。`package.json` に `dependencies` を**追加しない**
  （現在 dependencies なし・`private: true`・`license: MIT`）。
- 例外: `src/pw-check.js` の `require('playwright')` は monorepo root の `node_modules`
  から解決する（autopilot 自身はインストールしない）。
- CommonJS（`'use strict'` + `require` / `module.exports`）。ESM にしない。
- `module.exports` はファイル末尾に集約する（既存全ファイルの形）。
- JSDoc は日本語で「なぜ」を書く（既存スタイル）。定数にも由来 Issue 番号を残す。

## テスト規約

- **`node --test`**（`cd tools/autopilot && node --test`）。テストランナー・アサーション
  ライブラリを追加しない（`node:test` + `node:assert`）。
- テストは `tools/autopilot/test/*.test.js`。**純粋関数中心**に書く。
- I/O を持つ関数（daemon / project / runner / version）は **`deps` 引数の注入**で
  差し替えてテストする（例: `version.js` の `deps.execFileP`、daemon の各
  `apply*(items, cfg, state, log, deps = {})`）。実 GitHub / 実 tmux に触るテストを書かない。
- 状態・トリガー（`phaseForItem` / ゲート解除 / Status・AI Status の集合）を変えたら
  `test/state-machine.test.js` の網羅テストを必ず更新する
  （手順は `.claude/rules/autopilot/state-and-labels.md`）。

## worker 設定（settings.js）の規約

- 設定の基底は `DEFAULT_SETTINGS`（推奨構成: **実装・レビュー系 = opus、分類・対話系 =
  sonnet**）。マージ順（後勝ち）は
  `DEFAULT_SETTINGS ← tools/autopilot/settings.json（repo 共通・コミット可）←
  ~/.config/autopilot/settings.json（開発者ごと。env AUTOPILOT_SETTINGS で場所変更可）`。
- `phases` はフェーズ単位 shallow merge、配列（`addDirs` / `args` 等）は**置き換え**
  （`mergeSettings`）。この挙動を変えない。
- permission モードは **`auto`**。root では `bypassPermissions` が使えず（社内規定でも禁止）、
  `acceptEdits` は確認プロンプトで worker が停止した実績があるため。
  **`auto` のとき `--allowedTools` / `permissions.allow` を出力しない**
  （classifier が判定を握るため機能しない。`buildClaudeCommand` の `allowlistApplies` 分岐）。
- `effort` は `DEFAULT_SETTINGS` では **opt-in**（既定 null。指定すると `--effort` フラグに
  なり、未対応の Claude Code では起動が壊れるため既定では出さない）。
  ただし **repo `tools/autopilot/settings.json` が全フェーズに `model: "opus"` +
  明示 `effort` を設定して上書き**している（実装・分類系 = medium、understand/decompose/
  review/address-review/discuss = high、`default` catch-all = medium）。理由: ①`--effort` を
  渡さないと worker が**グローバル `~/.claude/settings.json` の `effortLevel`（環境により
  xhigh）を漏れ継承**し、小タスクで過剰にコストを消費していた ②triage/discuss は sonnet
  だと Large 誤判定 → 不要な decompose を誘発するため opus 必須（過去 feedback）。
  effort レベルを変えるときはこの JSON を編集する（`DEFAULT_SETTINGS` ではなく repo settings が
  真実）。`--effort` 非対応の Claude Code を使う開発者は `~/.config/autopilot/settings.json`
  で phase の effort を null に戻して無効化できる。
- env `AUTOPILOT_CLAUDE_CMD` は settings より**最優先**（固定コマンド起動）。
- 壊れた settings JSON は **warn してスキップ**し既定で動き続ける（無人運用優先。
  ロード失敗で daemon を落とさない）。

## 変更の反映は daemon 再起動

daemon はモジュールを**起動時にロード**し、さらに**プロンプト一式 + 解決済み settings を
tmpdir へスナップショット**する（`snapshotRunAssets`）。つまり `tools/autopilot/` の
コード・プロンプト・settings をいくら編集しても、**走行中の daemon には反映されない**。
変更を効かせるには daemon を再起動する（`POST /shutdown` → 再起動）。
「merge したのに挙動が変わらない」の第一容疑者はこれ。

## ライセンス

`tools/autopilot/**` と `tools/autopilot/prompts/**` は、リポジトリ全体の AGPL-3.0 ではなく
**MIT ライセンス**（`tools/autopilot/LICENSE`）。この配下に新規ファイルを追加するときは
MIT のまま置けるか確認する（AGPL なコードのコピー持ち込み不可）。プロンプト /
`docs/autopilot/*.md` の末尾には License セクション（MIT 宣言）を踏襲する。
