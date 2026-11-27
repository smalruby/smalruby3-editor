
# /autopilot-review — Adversarial review phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 Issue は 環境変数 `AUTOPILOT_ISSUE`。作業は割り当てられた worktree（その Issue の PR ブランチ）の中で行う。

ゴール: **実装フェーズが作った PR を「別の批判的レビュアー」として、プロジェクト規約
（`.claude/rules`）に沿って敵対的にレビューする。** 指摘は **Must / Question / FYI** の
3 分類で PR にコメントし、分類ごとの対応方針（下記）に従って自分で直すものと人間に委ねるものを
分ける（#921。#893 で失われた「敵対的レビューの深さの可視性」の回復が目的）。指摘は
**1 回のレビューにつき 1 コメント**にまとめ、`M1` / `Q1` / `FYI1` の連番で人間が返信しやすくする（#1248）。


## EPIC の流れ（`AUTOPILOT_EPIC_FLOW=1` のとき）

PR の base が `topic/...`（Issue 本文の `autopilot-base:`）のとき、daemon は `AUTOPILOT_EPIC_FLOW=1` を渡す。
この Issue は EPIC の sub-issue で、**人間は EPIC の設計を承認済み**。確認は EPIC ごとにまとめて行うので、
途中で `🙋 HITL` を出してよいのは次の 3 つだけ（結果ファイルの `hitlKind` に書く）:

| `hitlKind` | いつ |
|---|---|
| `diverge` | **3 案以上**に分かれる判断（実装が発散する）。その sub-issue だけ止まる |
| `must-exhausted` | 直しを 3 回しても Must が残る（daemon が自分で判定する。worker は使わない） |
| `environment` | エラーで続けられない（認証・使用量・壊れた環境） |

それ以外の判断（仕様の小さな選択・命名・見送り）は **AI のおすすめで決めて進め**、結果ファイルの
`decisions` に書く。daemon が EPIC の Issue の「決定待ち」まとめコメント
（`<!-- autopilot-epic-decisions count=N -->`）に書き足す（**worker はそのコメントを書かない**）:

```json
"decisions":[{"kind":"ai-decision","ref":null,"title":"<何を決めたか>","recommendation":"<AI の案（採ったもの）>",
  "alternatives":["<ほかの案>"],"adopted":"<入れたもの>"}]
```

`kind` は `question`（仕様の選択が要る）/ `not-adopted`（採用しなかった指摘）/ `ai-decision`（AI が決めた）/
`two-way`（2 案。下記）/ `diverge`（3 案以上）。スキーマは `docs/autopilot/autonomous-contract.md` §2.6。

このフェーズでは（手順 7 も参照）:

- 結果ファイルに **`mustCount`（このレビューで直しきれず残った Must の数）** と **`round`（手順 6 の round）** を必ず書く。
  daemon はこれで次を決める: Must 0 → topic へ自動マージ（CI 通過・コンフリクト無し）/ Must あり → address-review が
  直してもう一度 review / 3 回直しても残る → その sub-issue だけ止める（daemon が決定待ちに載せる）。
- `hitl` は `false`。Question の「人間の判断に委ねる」もの、見送った Question / FYI は 🙋 にせず `decisions` に
  書く（`question` / `not-adopted`。`ref` に `Q1` などの ID）。直したものは載せない。
- Must 級の設計判断が 3 案以上に割れるときだけ `signal:"hitl"` + `"hitlKind":"diverge"`。

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

**人間から学んだこと**（`docs/autopilot/learned/<area>.md`。EPIC の確認で人間の答えが AI のおすすめと違ったときの
意図と、人間との確認で分かったレビューの観点）も、触った分野のものだけ読み、観点に加える
（`learnedRuleFilesFor`・純粋関数・`tools/autopilot/src/learnings.js`。`general.md` はいつも入る）:

```bash
node -e '
const { learnedRuleFilesFor } = require("./tools/autopilot/src/learnings.js");
const files = require("fs").readFileSync(0, "utf8").split("\n").filter(Boolean);
console.log(learnedRuleFilesFor(files).join("\n"));
' <<< "$FILES" | while read -r f; do [ -f "$f" ] && cat "$f"; done
```

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
- **セキュリティ** — 情報漏洩・認可/入力検証・秘密のログ出力。diff・PR 本文・コメントに `DEV_BYPASS_TOKEN` などの**実際の値**が入っていたら [Must]（手順は `?devlogin=<DEV_BYPASS_TOKEN>` のようにキー名で書く・#1393）
- **再利用/簡潔性/効率** — 重複・不要な複雑さ・明らかな非効率
- テスト不足（直接の関連テストがあるか）、ドキュメント/DoD の整合、prettier 対象一覧の更新漏れ
- 「動くが脆い/将来壊れる」設計の指摘
- **翻訳カタログの揃い**: diff で追加された翻訳キー（`packages/scratch-gui/src/locales/`）が
  `en.js` / `ja.js` / `ja-Hira.js` の **3 ファイルすべて**にあるか。1 つでも欠けていれば **[Must]**
  （特に `en.js` は「`defaultMessage` があるから不要」と漏れやすい）。
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
| **FYI** | 動作・安全性には影響しない改善点（重複・冗長・整理の余地・小さな不整合） | より簡潔に書ける、使われなくなったコードや文言、将来的な整理の余地 |

分類は「直すかどうか」ではなく**影響の大きさ**で決める。Question / FYI も、ステップ 5 の方針で
**できるだけこのレビューの中で直す**（載せるだけで終わらせない）。

指摘は **1 件ずつ別コメントにしない**。ステップ 6 で **1 回のレビューの全指摘を 1 コメントに
まとめて**投稿する（#1248。人間が `Q1はOK, FYI1は修正して` のように ID で短く返信できるようにする）。
ここでは各指摘を次の形のメモとして手元に集める（ID はステップ 6 で機械的に振るので自分で付けない）:

```json
{"category":"Must","location":"src/a.js:10","text":"<何が問題か>","handling":"<どう扱ったか>"}
```

- `category`: `Must` / `Question` / `FYI`
- `location`: `file:line`（特定できなければ省略可）
- `handling`: ステップ 5 の結果を必ず書く。Must は `修正済み（<sha>）`。Question は `修正済み（<sha>）` /
  `見送り: <理由>。#<follow-up Issue> で対応` / `人間の判断に委ねる: <何を選んでほしいか>` のどれか。
  FYI は `修正済み（<sha>）` か `見送り: <理由>`（振る舞いが変わる / 設定値が増える / infra の変更が要る /
  情報共有のみで直すものが無い）

### 5. 分類ごとの対応方針で処理する

| 分類 | 対応 |
|---|---|
| **Must** | **自分で修正する**。まとめコメントの `handling` に `修正済み（<sha>）` を書く |
| **Question** | **基本は自分で直す**（`phases.js` の既定方針 `fix-or-followup`）。**よほど大変・効果が小さい**と判断して見送るときも、何もしないで終わらせず **follow-up の sub-issue を作り**、`handling` に `見送り: <理由>。#<番号> で対応` と書く（作り方は下記）。**仕様・方針の選択が人間にしかできないもの**（どちらの挙動にするか、何を残すか）だけは直さず `人間の判断に委ねる: <選んでほしいこと>` と書く（Review フェーズはどのみち `🙋 HITL` で人間に渡るので、追加の HITL 分岐は不要） |
| **FYI** | **簡単に直せるものは自分で直す**（既定方針 `fix-if-easy`）。ただし次のどれかに当たるものは直さず、`handling` に `見送り: <理由>` と書く: ① **振る舞いが変わる**（ユーザー・API 利用者から見える挙動や出力が変わる）② **設定値が増える**（env・settings・URL パラメータ・localStorage キーなど）③ **infra（`infra/**`）の変更が要る**。情報共有だけの FYI（確認したことの記録など）は直すものが無いので `見送り: 情報共有のみ` でよい |

**follow-up の sub-issue の作り方**（Question を見送るとき。人間が enroll するかを決められる形にする）:

```bash
REPO="${AUTOPILOT_REPO:-smalruby/smalruby3-editor}"
# 冪等: 同じ内容の follow-up が既にあれば作り直さない
GH_TOKEN="$(bin/bot-token)" gh issue list --repo "$REPO" --state open --search "<要点> in:title" --json number,title
url=$(GH_TOKEN="$(bin/bot-token)" gh issue create --repo "$REPO" --title "<conventional な title>" \
  --body "<何が問題か・どう直すか・なぜこの PR で見送ったか>"$'\n\n'"Follow-up of #$AUTOPILOT_ISSUE (PR #$PR のレビュー指摘)")
num=$(basename "$url")
dbid=$(GH_TOKEN="$(bin/bot-token)" gh api "repos/$REPO/issues/$num" --jq .id)
GH_TOKEN="$(bin/bot-token)" gh api --method POST "repos/$REPO/issues/$AUTOPILOT_ISSUE/sub_issues" -F sub_issue_id="$dbid"
```

- **assignee と `🤖 autopilot` ラベルは付けない**（autopilot に乗せるかは人間が決める）。Project にも
  追加しない（単一ライター。結果ファイルの `createdSubIssues` にも入れない — それは decompose 専用）。
- infra の変更が要る follow-up は `--label "🧱 infra"` を付け、本文に「`infra/**` だけ・後方互換な変更だけ」
  「PR は `Refs #<番号>`」を書く（infra-first）。

- 修正は worktree 内で行い `bin/bot-git` でコミット・push（commitlint: 小文字 subject / 各行 ≤100 字）。
- 修正 → 関連テスト（直接関係するテストファイルだけ（`CLAUDE.md` の「ローカルで流すテストの範囲」。全体実行は PR の CI で。どうしても全体の結果が要るときだけ例外で、理由を書く））/lint は **`bin/lint-changed`**（変えたファイルだけ。ルートの `npm run lint` の全体は流さない・全体は CI）をローカル再実行 → push。重い処理は `.claude/rules/parallel-work.md` の「重い処理の一覧」を読んでから流す（jest は `npm exec jest -- --runInBand <file>` でファイルを指定、dev server を 2 つ立てない、終わったらブラウザ・webpack の残りを確かめる）。
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

**先に「終わる前の後片付け」（下の節）を行う**（dev server・ブラウザを使ったとき。`tools/autopilot/bin/cleanup-leftovers`）。

レビュー＋修正が済んだら、PR を **Ready + `🙋 HITL`** に上げて人間レビューへ（実際の Ready/ラベル/Status は daemon が反映）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"review","signal":"done","summary":"敵対的レビュー完了(Must <a>件修正/Question <b>件/FYI <c>件)。人間レビューへ。",
"nextStatus":"Review","nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

判断に迷う重大指摘（Must 級の設計判断）で人間の意見が要る場合は、コメント + `AUTOPILOT_HITL` で確認する。

**EPIC の流れ（`AUTOPILOT_EPIC_FLOW=1`）**では、人間レビューへ渡さない。`mustCount` / `round` / `decisions` を書き、
`hitl:false` で返す（Status は daemon が `mustCount` から決めるので `nextStatus` は `Review` のままでよい）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"review","signal":"done","summary":"敵対的レビュー完了(Must <a>件修正・残り <m>件/Question <b>件/FYI <c>件)。",
"nextStatus":"Review","nextAiStatus":null,"hitl":false,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>",
"mustCount":<m>,"round":<N>,
"decisions":[{"kind":"question","ref":"Q1","title":"<何を>","recommendation":"<AI の案>","alternatives":["<ほかの案>"],"adopted":"<入れたもの>"}]}
EOF
echo AUTOPILOT_DONE
```

## 終わる前の後片付け（dev server・ブラウザ・#2463）

dev server やブラウザ（integration テストの chromedriver・chromium、pw-check の headless_shell）を使ったら、
**結果ファイルを書く前**（`AUTOPILOT_DONE` / `AUTOPILOT_HITL` / `AUTOPILOT_ERROR`・checkpoint のどれで終わるときも）に、
自分が起動したものを止める。残すと親を失って動き続け、コンテナのメモリと CPU を食う
（webpack の dev server が 2.4 GB まで大きくなった・作業場が消えたあとも chromium が残った例がある）。

1. dev server は `tools/autopilot/prompts/autopilot-verify.md` の「dev server の起動と停止」の形で起動・停止する
   （起動前に 8601 の持ち主の cwd を確かめる・`setsid -f` で起動して PGID を `$WT/tmp/dev-server.pgid` に記録する・
   `kill -- "-$PGID"` でプロセスグループごと止める）。`npx` / `npm` のラッパーだけを止めない。
   webpack は自分のコマンド行を `webpack` に書き換えるので、`pgrep -f 'webpack serve'` では見つからない。
2. 最後に **`tools/autopilot/bin/cleanup-leftovers`** を流す。`/proc/<pid>/cwd` が**自分の worktree** の
   webpack・chromedriver・chromium・headless_shell だけを止め、止めたものを出す（`--dry-run` で一覧だけ）。
   ほかの worker・人間のもの（cwd がほかの worktree や `/app`）は止めない。`pkill -f` のような広い一致を使わない。
3. 手で確かめるときは `.claude/rules/parallel-work.md` の「後片付け」に従う。

daemon も run の終了時にこの worktree に残ったものを止める（保険。頼らないこと）。

## 人間に選んでほしいことがあるとき（モニターで答える質問）

- `signal:"hitl"` で人間に選んでほしいことがあるときは、結果に **`questions`** を足す（選択肢と推奨を必ず書く）:
  `"questions":[{"id":"q1","text":"<何を選んでほしいか>","options":[{"key":"a","label":"<案>","desc":"<一行の説明>"},{"key":"b","label":"<案>"}],"recommended":"a"}]`。
  `id` / `key` は英数字・`_`・`-` だけ。daemon が質問を Issue にマーカー付きで書き、モニターに出す（質問のコメントを自分で書かなくてよい）。
  形は `docs/autopilot/autonomous-contract.md` §2.3。新しい signal は作らない。
- 起動の指示に「人間がモニターで質問に答えています。先に … を Read し」とあれば、そのファイル（`AUTOPILOT_ANSWERS_FILE`）を
  最初に読み、答え（質問 ID・選んだ選択肢・メモ）に従って続ける。同じことをもう一度質問しない。Issue の
  `<!-- autopilot-monitor-answer ... -->` のコメントも同じ答え。

## 注意

- レビューは **batch-tools を直接 monkey-patch しない**等、`.claude/rules` の E2E 注意も尊重。
- `AskUserQuestion` を使わない。Project/PR の状態反映は daemon（単一ライター）。
- bot 認証（`bin/bot-git` / `bin/bot-token`）。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
