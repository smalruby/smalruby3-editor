
# /autopilot-review — Adversarial review phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 Issue は 環境変数 `AUTOPILOT_ISSUE`。作業は割り当てられた worktree（その Issue の PR ブランチ）の中で行う。

ゴール: **実装フェーズが作った PR を「別の批判的レビュアー」として、プロジェクト規約
（`.claude/rules`）に沿って敵対的にレビューする。** 指摘は **Must / Question / FYI** の
3 分類で PR にコメントし、分類ごとの対応方針（下記）に従って自分で直すものと人間に委ねるものを
分ける（#921。#893 で失われた「敵対的レビューの深さの可視性」の回復が目的）。指摘は
**1 回のレビューにつき 1 コメント**にまとめ、`M1` / `Q1` / `FYI1` の連番で人間が返信しやすくする（#1248）。

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
- **infra-first**（`.claude/rules/infra/development.md`）。次はどれも **[Must]**:
  - Issue が `🧱 infra` なのに、`infra/**`（と関連 docs）以外を変えている／PR 本文に
    `Closes #` / `Fixes #` がある（`Refs #` にする）／**非互換な変更**（ルート・フィールド・
    リソースの削除や改名、必須化、レスポンス形の変更、既存リソースの置き換え）を含む
  - Issue が `🧱 infra` でないのに `infra/**` を変えている（infra の sub-issue に分ける）

### 4. 指摘を Must / Question / FYI に分類する

見つけた指摘は、それぞれ次のいずれか 1 つに分類する:

| 分類 | 定義 | 例 |
|---|---|---|
| **Must** | リリース前に必ず直す。**セキュリティ問題・考慮漏れ**（明確なバグ/退行） | null 未処理でクラッシュ、秘密情報のログ出力、規約の不変条件違反 |
| **Question** | 直した方がいいが動作はする。人間との対話が必要な場合がある。稀なコーナーケースで不都合の可能性があるが稀 | 命名・設計の妥当性、稀な競合状態、将来の拡張性への懸念 |
| **FYI** | 気になるが直すほどではないと判断したもの | より簡潔に書ける、将来的な整理の余地 |

指摘は **1 件ずつ別コメントにしない**。ステップ 6 で **1 回のレビューの全指摘を 1 コメントに
まとめて**投稿する（#1248。人間が `Q1はOK, FYI1は修正して` のように ID で短く返信できるようにする）。
ここでは各指摘を次の形のメモとして手元に集める（ID はステップ 6 で機械的に振るので自分で付けない）:

```json
{"category":"Must","location":"src/a.js:10","text":"<何が問題か>","handling":"<どう扱ったか>"}
```

- `category`: `Must` / `Question` / `FYI`
- `location`: `file:line`（特定できなければ省略可）
- `handling`: Must は `修正済み（<sha>）`、Question は `修正済み（<sha>）` か `人間の判断に委ねる`、
  FYI は省略可（ステップ 5 の結果を書く）

### 5. 分類ごとの対応方針で処理する

| 分類 | 対応 |
|---|---|
| **Must** | **自分で修正する**。まとめコメントの `handling` に `修正済み（<sha>）` を書く |
| **Question** | **すぐ対応できるもの**（小さな修正）は自分で直す。**改修コスト > 効果**と判断したものは、
まとめコメントに残すだけにして人間の判断に委ねる（後続の人間レビューで拾われる。Review フェーズは
どのみち `🙋 HITL` で人間に渡るため、追加の HITL 分岐は不要） |
| **FYI** | **対応しない**。まとめコメントに載せるだけ（コードは変えない） |

- 修正は worktree 内で行い `bin/bot-git` でコミット・push（commitlint: 小文字 subject / 各行 ≤100 字）。
- 修正 → 関連テスト/lint をローカル再実行 → push。
- 判断に迷う **Must 級の重大指摘**で、修正方針そのものに人間の意見が要る場合（設計判断が割れる等）は、
  自分で直さずコメント + `AUTOPILOT_HITL` で確認する（後述）。

### 6. 全指摘を 1 コメントにまとめて PR に残す

修正を push し終えてから、全指摘（0 件でも）を **1 件のまとめコメント**として投稿する。本文は
`phases.js` の `renderReviewFindingsComment`（純粋関数・テスト済み）で組み立てる。これが

- 先頭に冪等マーカー `<!-- autopilot-review-findings round=N -->`
- 次の行に件数サマリ（`指摘 <N> 件（Must <a> / Question <b> / FYI <c>）`。**別のサマリコメントは出さない**）
- Must → Question → FYI の見出しごとに `- **[M1]** \`file:line\` 内容 — 対応`

を作る。ID は分類ごとの連番（`M1` / `Q1` / `FYI1` …）で、**同じ PR の再レビュー（round 2 以降）は
前回の続きから採番する**（`nextReviewFindingNumbers`。round 1 が Q2 までなら round 2 は Q3 から）。

```bash
REPO="${AUTOPILOT_REPO:-smalruby/smalruby3-editor}"
GH_TOKEN="$(bin/bot-token)" gh api "repos/$REPO/issues/$PR/comments" --paginate \
  | jq -s 'add' > tmp/review-comments-$AUTOPILOT_ISSUE.json
# tmp/review-findings-$AUTOPILOT_ISSUE.json に手順 4 のメモの配列（JSON）を書いてから:
node -e '
const fs = require("fs");
const p = require("./tools/autopilot/src/phases.js");
const comments = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const findings = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
// 通常は新しい round。中断後の再実行は REVIEW_ROUND で既存 round を指定して編集する
const round = Number(process.env.REVIEW_ROUND) || p.nextReviewFindingsRound(comments);
const existing = p.findReviewFindingsComment(comments, round);
const others = comments.filter(c => c !== existing);
const body = p.renderReviewFindingsComment({ round, findings, start: p.nextReviewFindingNumbers(others) });
fs.writeFileSync("tmp/review-findings-body.md", body);
console.log(existing ? `PATCH ${existing.id}` : "POST");
' tmp/review-comments-$AUTOPILOT_ISSUE.json tmp/review-findings-$AUTOPILOT_ISSUE.json
```

- 出力が `POST` → `GH_TOKEN="$(bin/bot-token)" gh pr comment "$PR" --repo "$REPO" --body-file tmp/review-findings-body.md`
- 出力が `PATCH <id>` → `GH_TOKEN="$(bin/bot-token)" gh api -X PATCH "repos/$REPO/issues/comments/<id>" -F body=@tmp/review-findings-body.md`
- **冪等**: このレビューのまとめコメントを既に投稿済みで（途中で中断した再実行など）、その後に
  人間のコメントが無いなら、新しい round を作らず **その round を `REVIEW_ROUND=<N>` で指定して編集**する
  （二重投稿しない）。

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
