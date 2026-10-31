
# /autopilot-address-review — Review handling phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 Issue は 環境変数 `AUTOPILOT_ISSUE`。人間が **`🙋 HITL` を外した** PR を扱う。
ゲートは 🙋 を外したときだけ開く（コメントや Request changes だけでは起動しない）。

このフェーズは人間ゲート解除時の**唯一の入口**（#815）。どのゲートから来たかは
環境変数 `AUTOPILOT_STATUS` で分かり、扱う範囲が違う:

| `AUTOPILOT_STATUS` | モード | 対応する範囲 |
|---|---|---|
| `Review` / `DoD`（`In Progress` など中断からの再開も） | **Request changes 対応** | **まだ対応していない Request changes のレビューで指定されたことだけ**（手順 2） |
| `Blocked` | **再開** | Blocked の理由と PR のスレッドを読み、止まった作業を続ける（手順 2B） |

Request changes 対応モードでは、人間のコメント・approve・Comment だけのレビュー・bot の
指摘のうち言及の無いものには**対応しない**（人間が気軽にコメントできるように、対応してほしいことは
Request changes にまとめてもらう運用）。

## 前提: 既存 PR ブランチで作業する

新規ブランチではなく **既存 PR のブランチ**で作業する（daemon が `--pr` で worktree を用意する）:

```bash
PR=$(GH_TOKEN="$(bin/bot-token)" gh pr list --repo "$AUTOPILOT_REPO" --search "Closes #$AUTOPILOT_ISSUE in:body" --state open --json number -q '.[0].number')
bin/autopilot-worktree create "$AUTOPILOT_ISSUE" --pr "$PR"
```

## 手順

### 1. PR の文脈を読む（diff + 会話）

指示を正しく解釈するために、PR の diff と会話を**文脈として**読む（ここで読んだコメントに対応するわけではない。
対応する範囲は手順 2 で決める）:

```bash
# diff（何が変わったか）
GH_TOKEN="$(bin/bot-token)" gh pr diff "$PR" --repo "$AUTOPILOT_REPO"
# 会話コメント・レビュー本文・レビュースレッド
GH_TOKEN="$(bin/bot-token)" gh pr view "$PR" --repo "$AUTOPILOT_REPO" --json title,body,comments,reviews,reviewThreads
# inline（行コメント）
GH_TOKEN="$(bin/bot-token)" gh api repos/$AUTOPILOT_REPO/pulls/$PR/comments
```

修正が必要になった場合に備え、`autopilot-review.md` と同じ方法で、差分が touch する領域の
`.claude/rules/<area>/`（`touchedRuleAreas`。`tools/autopilot/src/phases.js`）を読んでおく:

```bash
FILES=$(GH_TOKEN="$(bin/bot-token)" gh pr diff "$PR" --repo "$AUTOPILOT_REPO" --name-only)
for area in $(node -e '
const { touchedRuleAreas } = require("./tools/autopilot/src/phases.js");
const files = require("fs").readFileSync(0, "utf8").split("\n").filter(Boolean);
console.log(touchedRuleAreas(files).join("\n"));
' <<< "$FILES"); do
  cat ".claude/rules/$area"/*.md
done
```

### 2. 対応する Request changes を決める（`AUTOPILOT_STATUS` が Blocked 以外）

まだ対応していない Request changes のレビューを `selectRequestedReviews`（純粋関数・テスト済み）で選ぶ。
対応済みかどうかは、以前の address-review がまとめコメントの先頭に残したマーカー
`<!-- autopilot-address-review handled-reviews=<id,id> -->` で判定する（`addressReviewMarker`）:

```bash
GH_TOKEN="$(bin/bot-token)" gh api "repos/$AUTOPILOT_REPO/pulls/$PR/reviews" --paginate \
  | jq -s 'add' > tmp/pr-reviews-$AUTOPILOT_ISSUE.json
GH_TOKEN="$(bin/bot-token)" gh api "repos/$AUTOPILOT_REPO/issues/$PR/comments" --paginate \
  | jq -s 'add' > tmp/pr-comments-$AUTOPILOT_ISSUE.json
node -e '
const fs = require("fs");
const { selectRequestedReviews } = require("./tools/autopilot/src/phases.js");
const reviews = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const comments = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
console.log(JSON.stringify(selectRequestedReviews(reviews, comments).map((r) => ({ id: r.id, body: r.body })), null, 2));
' tmp/pr-reviews-$AUTOPILOT_ISSUE.json tmp/pr-comments-$AUTOPILOT_ISSUE.json
```

**1 件も無ければ何もしない**: 「🙋 が外れましたが、まだ対応していない Request changes が無いので何もしていません。
直してほしいことは Request changes で指定してから 🙋 を外してください」と PR に 1 行コメントして、
出口 (b) で終える（マーカーは付けない・コードに触らない）。

選んだレビューごとに、**指示**と**指示の対象**を集める:

- **指示** = レビュー本文 + そのレビューの行コメント
  （`gh api repos/$AUTOPILOT_REPO/pulls/$PR/reviews/<id>/comments`）。
- **指示の対象** = 指示の中に貼られたコメント URL。`extractCommentRefs` で拾い、それぞれ取得する:
  `issue-comment` → `repos/$AUTOPILOT_REPO/issues/comments/<id>`、
  `review-comment` → `repos/$AUTOPILOT_REPO/pulls/comments/<id>`、
  `review` → `repos/$AUTOPILOT_REPO/pulls/$PR/reviews/<id>`。
  URL の無い行コメントは、そのコメントが付いた行が対象。

```bash
node -e '
const { extractCommentRefs } = require("./tools/autopilot/src/phases.js");
console.log(JSON.stringify(extractCommentRefs(require("fs").readFileSync(0, "utf8"))));
' <<< "<指示の本文>"
```

**bot の review 指摘（`<!-- autopilot-review-findings round=N -->` のまとめコメント・`**[M1]**` / `**[Q1]**` /
`**[FYI1]**` の ID 付き）を ID で指定された場合**は、`planAddressReview`（純粋関数・テスト済み）に
**指示の本文だけ**を `replies` として渡し、**`source:"human"` の項目だけ**に対応する
（`source:"policy"` の既定方針は使わない — 言及の無い Must / Question / FYI には対応しない）:

```bash
# tmp/human-replies-$AUTOPILOT_ISSUE.json に「指示」の本文の配列（古い順）を書いてから:
node -e '
const fs = require("fs");
const { planAddressReview } = require("./tools/autopilot/src/phases.js");
const comments = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const replies = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
console.log(JSON.stringify(planAddressReview(comments, replies).filter((x) => x.source === "human"), null, 2));
' tmp/pr-comments-$AUTOPILOT_ISSUE.json tmp/human-replies-$AUTOPILOT_ISSUE.json
```

| action | 意味 | 対応 |
|---|---|---|
| `no-change` | 「OK / そのままで / 直さなくていい」 | **何もしない** |
| `fix` | 「修正して / 直して」 | **修正する**（**FYI でも指定されたら直す**） |
| `reply` | 質問・代案 | **返信**し、必要なら修正 |

ID の表記ゆれ（`Q1` / `q1` / `Question1`、`M1` / `Must1`、`FYI1` / `F1`、全角数字）は
`parseFindingReferences` が吸収する。

**ID の無い指示**（「ここを Z に直して」「テストを足して」など）は、自由文の意図で分類する:

| 種別 | 対応 |
|---|---|
| **改善依頼 / 変更要求** | worktree で**修正**する |
| **質問** | bot で**返信**する。コードを変える必要があれば変える |
| **判断がつかない**（意図が曖昧・複数解釈・URL がまとめコメント全体を指していて、どの指摘か分からない） | **人間に質問**（後述 HITL） |

### 2B. 止まった作業を再開する（`AUTOPILOT_STATUS` が Blocked）

Issue と PR の Blocked コメント（理由）と、その後の人間のコメントを読み、原因が取り除かれていれば
止まった作業を続ける。Request changes が出ていればそれも手順 2 と同じ方法で対応する。原因が残っていれば
何が要るかをコメントして出口 (c) で人間に返す。

### 3. 対応する

- **Must / 改善依頼 / `action:"fix"`**: worktree 内で修正 → 関連テスト/lint → `bin/bot-git` でコミット・push。
- **Question（対応可）/ 質問 / `action:"reply"`**: PR に bot で返信。コード変更を伴うならあわせて push。
- **FYI（`ignore`）/ `action:"no-change"`**: 何もしない（既存のコメントを消さない）。
- 対応の有無が辿れるよう、**まとめコメントを 1 件**残す（「指摘 N 件: 対応 a 件 / 返信 b 件 / 対応不要 c 件」）。
  **先頭に、手順 2 で選んだレビューの ID を `addressReviewMarker` で埋める**
  （例 `<!-- autopilot-address-review handled-reviews=3409123456 -->`）。次に 🙋 が外れたとき、
  このレビューには二重に対応しない。出口 (a)(c) のどちらでも付ける（checkpoint で中断したときは付けない —
  再開時にもう一度同じレビューを選ぶため）。ID 付き指摘は **ID で 1 行ずつ**書く
  （例: `Q1: 変更なし（人間 OK） / FYI1: 修正済み（<sha>） / M2: 修正済み（<sha>）`）。
- 指定がすべて「そのままで」など、コードに触る必要が無ければコミットしない（冪等・無駄 push をしない）。

### 3.5 時間契約（実行上限 約60分・soft-limit 52分）

このフェーズの**実行上限は約60分**。soft-limit（52分）を超えると runner が tmux 経由で
「⏰ 残り約8分。新しい大きな作業を始めず、安全な区切りで停止して checkpoint 手順を実行して」
という信号を **1 回だけ**送る。修正の途中でこれを受け取ったら（または残り時間が僅かと
判断したら）、対応を最後まで終えられる見込みがない限り、下記 (a)(b)(c) の代わりに
**checkpoint で安全に中断**する（詳細・JSON スキーマは `docs/autopilot/autonomous-contract.md` §2.5）:
（どちらも `tools/autopilot/settings.json` の `watchdog` で変えられる。値を変えたときは信号の「残り約N分」も変わる。）

1. WIP を意味のある単位で `bin/bot-git commit` する。
2. `tmp/autopilot-continuation-$AUTOPILOT_ISSUE.md` に「完了済み / 残タスク / 次の一手 /
   継続して安全か」を記載し、commit する。
3. `signal:"hitl"` + `nextAiStatus:"Awaiting Continuation"` で結果を emit し `AUTOPILOT_HITL` を出す
   （`reason` に checkpoint である旨を書く）。

再開時は `tmp/autopilot-continuation-$AUTOPILOT_ISSUE.md` の有無を先に確認し、あれば読んで
続きから対応する。

### 4. 終了する（3 つの出口）

**(a) 質問・改善依頼に対応した → 再び人間レビューへ**（再レビュー/マージ判断を仰ぐ）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"address-review","signal":"done","summary":"指摘 <N> 件対応（修正 <a>/返信 <b>）。再レビューへ。",
"nextStatus":"Review","nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

**(b) 対応することが無い → 人間のマージ待ち**（未対応の Request changes が無い・指定がすべて「そのままで」など。
こちらからは何もしない。Review のまま人間に戻す）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"address-review","signal":"done","summary":"対応することなし（未対応の Request changes なし）。人間のマージ待ち。",
"nextStatus":"Review","nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

**(c) 判断がつかない → 人間に質問**（論点を整理してコメント済み。**改修コスト > 効果と判断した
Question 分類の指摘**もここに含める — コメントで論点を明示し、コードは変えない）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"address-review","signal":"hitl","summary":"指摘の意図が不明。確認待ち。",
"reason":"<何を判断してほしいか>","commentUrl":"<投稿コメント URL>","nextStatus":"Review"}
EOF
echo AUTOPILOT_HITL
```

> (a)(b) はどちらも `hitl:true` で人間の番に戻す。違いは「コードを変えたか」だけ。
> 人間は新しい Request changes を出して再び 🙋 を外せば、また本スキルが起動してその分に対応する。

## 注意

- **既存 PR ブランチで作業**（新ブランチを切らない）。1 Issue = 1 PR。
- **コンフリクトは autopilot で解消しない。** rebase/merge コンフリクトに遭遇したら解消を試みず、
  論点を整理した**コメント + `AUTOPILOT_HITL`** で人間に渡す（コンフリクト解消は人間の役割）。
- 冪等: 同じ指摘に二重対応・二重コメントしない。既存の bot まとめコメントがあれば編集して使う。
- `AskUserQuestion` を使わない。Project/PR の状態反映は daemon（単一ライター）。
- bot 認証（`bin/bot-git` / `bin/bot-token`）。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
