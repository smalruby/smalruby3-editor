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

`.claude/rules` 準拠は「読んだつもり」にならないよう、変更ファイルから `phases.js` の
`touchedRuleAreas`（純粋関数）で touch する `.claude/rules/<area>/` を機械的に導いてから読む
（#921）。指摘は本文先頭に `**[Must]**` / `**[Question]**` / `**[FYI]**` マーカーを付けて
3 分類し、`countReviewFindings` / `renderReviewFindingsSummary` で件数サマリを PR に残す
（対応方針は Must=修正 / Question=対応可なら修正・困難なら人間へ / FYI=無視。
`addressReviewPolicyFor` が唯一の真実）。`autopilot-address-review.md` も同じ分類・対応表を
未対応の bot コメントに適用する。

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
- `autopilot-assignee: <login>`（`@login` も可）— 複数 assignee の Issue でオーナー
  （駆動する担当）を明示指定する（#938）。**Issue の説明（本文＝最初のコメント）のみ**から
  探索する（コメント・PR は見ない）。指定 login が Assignees に含まれていなければ無視して
  従来どおり辞書順先頭（`resolveOwner`）。0/1 人の Issue はディレクティブが無意味なので
  本文 fetch 自体を行わない（`populateAssigneeDirectives`・API 予算規約）。
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
- 軽量モードは scratch-gui の **prepare 生成物**（`src/generated` の microbit hex URL
  モジュールと `static/microbit` / `static/microbitMore` の hex 本体・すべて gitignored）も
  main へ **symlink** する（#1001）。npm install（=prepare の DL 生成）を走らせないため、
  これが無いと webpack dev server が `Module not found: microbit-*-hex-url` で起動しない。
  `--full` は npm install で実ファイルが生成されるため対象外。
- 軽量モードは **husky の生成物 `.husky/_`**（gitignored・`npm install` = prepare の
  `husky install` が生成）も main へ **symlink** する（#1137）。`core.hooksPath=.husky` は
  共有設定なので `.husky/commit-msg` は worktree でも起動し、これが無いと
  `cannot open .husky/_/husky.sh` で **すべての commit が失敗**する。特に daemon の base 追従
  （`git merge origin/<base>`）は merge コミット作成段階で落ち、競合ゼロなのに
  `base-follow-conflict` として Blocked になっていた（#957）。`--full` は対象外。
- 既存 PR ブランチでの作業（review / address-review）は `--pr <number>`（daemon の
  `ensureWorktree` が使う経路）。
- worktree 内では node_modules / prepare 生成物 / `.husky/_` symlink の誤ステージ防止を
  `git-common-dir` の `info/exclude` で担保している（Issue #801 / #1001 / #1137）。
  この保険を外さない。

## infra のデプロイは worker が行わない

worker は **`cdk deploy` を実行しない**（stg / prod とも）。stg は共有資源で、複数の worker が
同時に撃つと CloudFormation の更新が中断する。stg に自分の変更を載せたいときは:

1. PR に **`deploy-stg` ラベル**を付ける（`GH_TOKEN="$(bin/bot-token)" gh pr edit <n> --add-label "deploy-stg"`）
2. `.github/workflows/deploy-infra-stg.yml` の完了を待つ（`gh run watch` / `gh pr checks`）
3. workflow が PR に残すコメントで「いまの stg が自分の SHA か」を確認してから DoD を行う

ラベルは **1 回きりの操作**で、run の完了時に workflow が自動で外す。**外す処理を自分で書かない**
（二重に外そうとして 404 になる）。再度載せたいときは付け直す。

prod への反映は**人間の作業**。結果ファイルや PR 本文に「prod は人間が実施」と明記して終える
（`.claude/rules/infra/development.md` の「デプロイ経路」）。

## UI 確認（pw-check）

- worker の UI 確認は **`tools/autopilot/bin/pw-check`（playwright パッケージの bundled
  chromium・headless）**。**Playwright MCP は使わない**（host Chrome 依存でコンテナ内では
  失敗する）。スクショは `tmp/` 配下に保存。
- 音 / autoplay 依存の確認は headless では信用できない → daemon の DoD headful 引き継ぎ
  （`applyDodHandoffs`）で人間/ホスト Claude に渡す（`docs/autopilot/README.md`）。
