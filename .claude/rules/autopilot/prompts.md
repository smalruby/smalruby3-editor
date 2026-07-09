# autopilot — フェーズプロンプト・ディレクティブ・worktree の規約

## プロンプトは Skill ではない

- フェーズプロンプトは **`tools/autopilot/prompts/autopilot-<phase>.md`** に置く。
  **`.claude/skills/` に置かない**（開発者が `/autopilot-*` とスラッシュ起動すると
  期待どおり動かないため。Runner が `phasePromptCommand` でファイルを Read させて実行する）。
- フェーズ名 ↔ ファイル名の対応は `phases.js` の `PHASE_BY_COMMAND`（`skill` = basename）。
- daemon 経由の run は**起動時スナップショット**のプロンプトを読む。プロンプト編集は
  daemon 再起動まで反映されない。

## プロンプト本文の必須要素（コントラクト準拠）

正準は `docs/autopilot/autonomous-contract.md`（§8 にチェックリスト）。要点:

- 冒頭に **「Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`」**
  を宣言する（全 8 プロンプトが持つ形）。
- **対話禁止**: `AskUserQuestion` を使わない・確認待ちで停止しない。判断が要るときは
  bot コメント + `AUTOPILOT_HITL` で終了。
- 終了直前に `AUTOPILOT_RESULT_FILE` へ JSON（スキーマは contract.js の `validateResult` が
  検証）→ pane に signal トークン（`AUTOPILOT_DONE` / `AUTOPILOT_HITL` / `AUTOPILOT_ERROR`）
  を単独行で出す。
- **冪等**: 副作用（コメント・PR・sub-issue）の前に既存の同種副作用を確認する。
- **Project フィールド・🙋 ラベルを直接書かない**（単一ライター。
  `.claude/rules/autopilot/state-and-labels.md`）。
- `signal=hitl` の `nextStatus` に **Icebox / Close / Done を提案しない**（不変条件 I4）。
- 作業は割り当てられた worktree（cwd）内・割り当てられた 1 Issue/PR のみ。
- 末尾に MIT License セクションを踏襲する。

## 動的 Workflow / Skill を起動しない（#893）

review / verify などのプロンプトから **`/code-review` / `/security-review` 等の
マルチエージェント Workflow・Skill を起動しない**。worker は root で動き
`bypassPermissions` が使えず、Workflow の許可プロンプトで停止する上にトークンを大量消費
する。レビューは**インラインの軽量敵対的レビュー**（`autopilot-review.md` の観点リスト:
正確性・セキュリティ・再利用/簡潔性/効率・`.claude/rules` 準拠・テスト/DoD 整合）で行う。

## コミット・push の規約

- コミット = `bin/bot-git commit`（Bot 名義の `-c` 注入。共有 `.git/config` は不変）。
  commitlint 準拠: **subject は小文字始まりの Conventional Commits・各行 ≤100 字**。
- push = **`bin/autopilot-push`**。変更に Bot 権限外パスが含まれると個人トークン経路
  （`route=personal`）に自動で切り替わる。その場合 PR も plain `gh`（個人）で作成し、
  **`👥 human-review-required` ラベル**を付けて本人以外のレビューを必須にする。
- **対規約**: Bot 権限外パスのパターンは 2 箇所で二重定義されている —
  `bin/autopilot-push` の `PROTECTED_RE` と `phases.js` の `PROTECTED_PATH_PATTERNS`
  （現在 `^.github/workflows/` と `^.github/actions/`）。**変更時は必ず両方を更新**する。

## 本文ディレクティブの記法（行頭マーカー）

Issue 本文のディレクティブは **行頭のみ**で発火する（`phases.js` の `parseBaseBranch` /
`parseAfterIssues`。正規表現は `^(?:<!--\s*)?ディレクティブ名:` + `im` フラグ）:

- `autopilot-base: <branch>` — PR 先・worktree 分岐元。バッククォート囲み可・
  行頭 HTML コメント内も可。
- `autopilot-after: #N [#M ...]` — 依存宣言。カンマ/空白区切り・複数行合算・`#` 省略可・
  重複除去。未完了判定は `unresolvedAfterIssues`（closed でも Project 終端でもないものは
  保守的に「未完了」扱い — 番号 typo に人間が気付けるように）。
- **誤マッチ回避**: 本文や docs でディレクティブを**説明**するときは行頭に置かない
  （箇条書き `- \`autopilot-after: ...\`` やインラインコードにする）。行頭に生で書くと
  実際に発火する。
- 新ディレクティブを追加するときも「行頭のみ・HTML コメント許容・純粋関数 + テスト」の
  同じ形式に従い、`docs/autopilot/README.md` の表へ追記する。

## worktree・ブランチ規約

- Issue ごとの隔離作業場は **`bin/autopilot-worktree create <issue>`**。
  置き場所は `<main checkout>/.autopilot-worktrees/issue-<N>`（gitignore 済み・
  devpod では /app 配下 = bind mount で rebuild 後も永続。`$HOME` 配下は ephemeral で
  stale 登録事故を起こした旧仕様なので戻さない）。
- ブランチ名は **`topic/autopilot-<issue>`**。この接頭辞は
  `bin/autopilot-worktree`（`AUTOPILOT_BRANCH_PREFIX`）と `phases.js`
  （`AUTOPILOT_BRANCH_PREFIX` / `autopilotHeadBranch`）の**二重定義**で、head ブランチ名
  から PR を base 非依存に特定する検知（#831）が依存している。**変更時は両方を更新**する。
- 軽量モード（既定）は `.env.*` を**コピー**（symlink 禁止 —
  `.claude/rules/env-file.md`）、`node_modules` / 各 package の `node_modules` を main へ
  **symlink** する。→ `@smalruby/*` は **main checkout の dist に解決される**ため、
  worktree 側でのクロスパッケージのソース編集は反映されない。クロスパッケージ編集は
  `--full`（実 npm install + build:dev）。
- 既存 PR ブランチでの作業（review / address-review）は `--pr <number>`（daemon の
  `ensureWorktree` が使う経路）。
- worktree 内では node_modules symlink の誤ステージ防止を `git-common-dir` の
  `info/exclude` で担保している（Issue #801）。この保険を外さない。

## UI 確認（pw-check）

- worker の UI 確認は **`tools/autopilot/bin/pw-check`（playwright パッケージの bundled
  chromium・headless）**。**Playwright MCP は使わない**（host Chrome 依存でコンテナ内では
  失敗する）。スクショは `tmp/` 配下に保存。
- 音 / autoplay 依存の確認は headless では信用できない → daemon の DoD headful 引き継ぎ
  （`applyDodHandoffs`）で人間/ホスト Claude に渡す（`docs/autopilot/README.md`）。
