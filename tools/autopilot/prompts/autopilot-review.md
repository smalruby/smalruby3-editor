
# /autopilot-review — Adversarial review phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 Issue は 環境変数 `AUTOPILOT_ISSUE`。作業は割り当てられた worktree（その Issue の PR ブランチ）の中で行う。

ゴール: **実装フェーズが作った PR を「別の批判的レビュアー」として、プロジェクト規約
（`.claude/rules`）に沿って敵対的にレビューする。** 指摘は **Must / Question / FYI** の
3 分類で PR にコメントし、分類ごとの対応方針（下記）に従って自分で直すものと人間に委ねるものを
分ける（#921。#893 で失われた「敵対的レビューの深さの可視性」の回復が目的）。

## 手順

### 1. 対象 PR を特定

```bash
PR=$(GH_TOKEN="$(bin/bot-token)" gh pr list --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}" \
  --search "Closes #$AUTOPILOT_ISSUE in:body" --state open --json number -q '.[0].number')
```

### 2. 変更が touch する領域の `.claude/rules/<area>/` を読む

差分に含まれるファイルから、レビュー時に読むべき `.claude/rules/` のエリアを機械的に導く
（`touchedRuleAreas`・純粋関数・`tools/autopilot/src/phases.js`）:

```bash
FILES=$(GH_TOKEN="$(bin/bot-token)" gh pr diff "$PR" --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}" --name-only)
AREAS=$(node -e '
const { touchedRuleAreas } = require("./tools/autopilot/src/phases.js");
const files = require("fs").readFileSync(0, "utf8").split("\n").filter(Boolean);
console.log(touchedRuleAreas(files).join("\n"));
' <<< "$FILES")
echo "$AREAS"
for area in $AREAS; do
  cat ".claude/rules/$area"/*.md
done
```

`.claude/rules/` 直下の一般規約（`code-style.md` / `git-workflow.md` / `documentation.md` /
`env-file.md` / `supply-chain-security.md` / `github-app-bot.md` 等。`CLAUDE.md` にも要約あり）は
touch した領域に関わらず**常に**前提として踏まえる。触った領域が `$AREAS` に無い場合（root 直下の
スクリプトのみの変更等）はルート規約だけで十分。

### 3. 敵対的レビューを実行（インライン・軽量）

差分に対し、**自分で（インラインで）批判的にレビューする**。

> ⚠️ **`/code-review` や `/security-review` などの Skill を起動しないこと**（Issue #893）。
> これらは **動的マルチエージェント Workflow** を起動し、許可プロンプトで worker が停止する上に
> トークンを大量消費する。worker は root で動き `bypassPermissions` が使えないため、
> Skill/Workflow の許可プロンプトを避ける。**レビューは以下の観点を自分の目で確認する**
> （どうしても機械的チェックを併用する場合でも、単発の観点チェックに留め、動的 workflow は使わない）。

`GH_TOKEN="$(bin/bot-token)" gh pr diff "$PR" --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}"` で差分を読み、次の観点で確認する:

- **`.claude/rules/<area>/`（ステップ 2 で読んだもの）からの逸脱** — 実装規約違反、現行実装からの
  逸脱、マーカー漏れ（Smalruby marker comments）、独自実装の不変条件違反（例: autopilot の
  単一ライター原則、レイヤリング不変条件）
- **正確性バグ** — 境界条件・null/undefined・非同期の取りこぼし・エラー処理漏れ・退行
- **セキュリティ** — 情報漏洩・認可/入力検証・秘密のログ出力
- **再利用/簡潔性/効率** — 重複・不要な複雑さ・明らかな非効率
- テスト不足（直接の関連テストがあるか）、ドキュメント/DoD の整合、prettier 対象一覧の更新漏れ
- 「動くが脆い/将来壊れる」設計の指摘

### 4. 指摘を Must / Question / FYI に分類する

見つけた指摘は、それぞれ次のいずれか 1 つに分類する:

| 分類 | 定義 | 例 |
|---|---|---|
| **Must** | リリース前に必ず直す。**セキュリティ問題・考慮漏れ**（明確なバグ/退行） | null 未処理でクラッシュ、秘密情報のログ出力、規約の不変条件違反 |
| **Question** | 直した方がいいが動作はする。人間との対話が必要な場合がある。稀なコーナーケースで不都合の可能性があるが稀 | 命名・設計の妥当性、稀な競合状態、将来の拡張性への懸念 |
| **FYI** | 気になるが直すほどではないと判断したもの | より簡潔に書ける、将来的な整理の余地 |

PR への各指摘コメントは、**本文の先頭に分類マーカーを付ける**（daemon がサマリ集計に使う。
`countReviewFindings` が `**[Must]**` 等の完全一致を見る）:

```
**[Must]** <指摘内容>
**[Question]** <指摘内容>
**[FYI]** <指摘内容>
```

### 5. 分類ごとの対応方針で処理する

| 分類 | 対応 |
|---|---|
| **Must** | **自分で修正する**。修正後に PR コメントを投稿（分類マーカー付き、対応済みである旨を明記） |
| **Question** | **すぐ対応できるもの**（小さな修正）は自分で直す。**改修コスト > 効果**と判断したものは、
コメントを残すだけにして人間の判断に委ねる（後続の人間レビューで拾われる。Review フェーズは
どのみち `🙋 HITL` で人間に渡るため、追加の HITL 分岐は不要） |
| **FYI** | **対応しない**。コメントのみ残す（コードは変えない） |

- 修正は worktree 内で行い `bin/bot-git` でコミット・push（commitlint: 小文字 subject / 各行 ≤100 字）。
- 修正 → 関連テスト/lint をローカル再実行 → push。
- 判断に迷う **Must 級の重大指摘**で、修正方針そのものに人間の意見が要る場合（設計判断が割れる等）は、
  自分で直さずコメント + `AUTOPILOT_HITL` で確認する（後述）。

### 6. 分類サマリを PR に残す

すべての指摘を出し終えたら、件数のサマリを 1 件のコメントとして残す（`renderReviewFindingsSummary`
の形式に合わせる。`指摘 <N> 件（Must <a> / Question <b> / FYI <c>）`）:

```bash
GH_TOKEN="$(bin/bot-token)" gh pr comment "$PR" --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}" \
  --body "🤖 敵対的レビュー完了。指摘 <N> 件（Must <a> / Question <b> / FYI <c>）。Must は修正済み。"
```

指摘が 0 件なら「指摘なし。」と明記する（レビューを実行したことの証跡を残す）。

### 7. 結果を返す（人間レビューへ）

レビュー＋修正が済んだら、PR を **Ready + `🙋 HITL`** に上げて人間レビューへ（実際の Ready/ラベル/Status は daemon が反映）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"review","signal":"done","summary":"敵対的レビュー完了(Must <a>件修正/Question <b>件/FYI <c>件)。人間レビューへ。",
"nextStatus":"Review","nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

判断に迷う重大指摘（Must 級の設計判断）で人間の意見が要る場合は、コメント + `AUTOPILOT_HITL` で確認する。

## 注意

- レビューは **batch-tools を直接 monkey-patch しない**等、`.claude/rules` の E2E 注意も尊重。
- `AskUserQuestion` を使わない。Project/PR の状態反映は daemon（単一ライター）。
- bot 認証（`bin/bot-git` / `bin/bot-token`）。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
