
# /autopilot-release-check — Release check phase (decomposed EPIC)

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない（`AskUserQuestion` を使わない・確認待ちで止まらない）。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、
pane に signal トークンを出す。

対象は環境変数 `AUTOPILOT_ISSUE` の **分解済み EPIC（🧭 トラッカー）**。子の sub-issue が全部済んだ（または残りが
`🚀 after-release` だけ）ので、daemon が AI Status を **Release Check** にした。このフェーズは
topic → develop の前の、人間のプレビューでの確認を準備し、確認の結果を受ける（`.claude/rules/topic-branches.md`）。
結果は、モニターの「確認の結果を書く」と、人間が topic → develop の PR に直接書いたレビュー・コメントの両方から受ける。

- コードを変えない・コミットしない・PR をマージしない。**develop へのマージは人間**。
- Project のフィールドと 🙋 は書かない（daemon が結果を見て書く・単一ライター）。書くのはコメントと sub-issue だけ。
- 判断の純粋関数は `tools/autopilot/src/release-check.js`。目印の形はそこに合わせる。

## 0. どちらの段かを決める

topic → develop の PR に人間が直接書いたレビュー・コメントも、結果として受ける（#2459）。先に PR を探し、
レビュー・行コメント・PR のコメントを取ってから段を決める。

```bash
REPO="${AUTOPILOT_REPO:-smalruby/smalruby3-editor}"
N="$AUTOPILOT_ISSUE"
GH_TOKEN="$(bin/bot-token)" gh issue view "$N" --repo "$REPO" --json title,body,labels
GH_TOKEN="$(bin/bot-token)" gh api "repos/$REPO/issues/$N/comments" --paginate | jq -s 'add // []' > tmp/release-check-comments-$N.json
# EPIC の sub-issue の本文（目印で、受けたものを二重に受けない）。topic ブランチは本文の行頭の autopilot-base: の値
GH_TOKEN="$(bin/bot-token)" gh api "repos/$REPO/issues/$N/sub_issues" --paginate | jq -s 'add // []' > tmp/release-check-subs-$N.json
# --paginate は 30 件ごとに別の配列を続けて出す（`[..][..]`。JSON として読めない）ので、jq -s 'add' で 1 つにする
# topic → develop の open な PR（無ければ PR の 3 ファイルは [] にする）
GH_TOKEN="$(bin/bot-token)" gh pr list --repo "$REPO" --base develop --head <topic> --state open --json number,url
PR=<PR の番号>
GH_TOKEN="$(bin/bot-token)" gh api "repos/$REPO/pulls/$PR/reviews" --paginate | jq -s 'add // []' > tmp/release-check-pr-reviews-$N.json
GH_TOKEN="$(bin/bot-token)" gh api "repos/$REPO/pulls/$PR/comments" --paginate | jq -s 'add // []' > tmp/release-check-pr-review-comments-$N.json
GH_TOKEN="$(bin/bot-token)" gh api "repos/$REPO/issues/$PR/comments" --paginate | jq -s 'add // []' > tmp/release-check-pr-comments-$N.json
node -e '
const fs = require("fs");
const rc = require("./tools/autopilot/src/release-check");
const n = process.argv[1];
const j = (f) => JSON.parse(fs.readFileSync(`tmp/release-check-${f}-${n}.json`, "utf8"));
const comments = j("comments");
const handled = rc.handledPrFeedbackRefs({ epic: Number(n), existingBodies: j("subs").map((s) => s.body), comments });
const pr = rc.selectPrFeedback({ reviews: j("pr-reviews"), reviewComments: j("pr-review-comments"), issueComments: j("pr-comments"), handled });
fs.writeFileSync(`tmp/release-check-pr-feedback-${n}.json`, JSON.stringify(pr, null, 2));
console.log(JSON.stringify({ ...rc.releaseCheckMode(comments, { pendingPrFeedback: pr.length }), prFeedback: pr.length }));
' "$N"
```

- `{"mode":"collect","round":N}` → **1. 観点をまとめる**
- `{"mode":"result","round":N}` → **2. 結果を受ける**（その round のモニターの結果。PR のまだ受けていないレビュー・コメントも一緒に受ける）
- `{"mode":"result","round":N,"prOnly":true}` → **2. 結果を受ける**（PR のレビュー・コメントだけ。`review` は null。
  `round` は、受けたあとに続ける観点の round）
- 読むのは**人間の**ものだけ（Bot のまとめ・CI のプレビューのコメントは `selectPrFeedback` が除く）。
  段に入る合図はトラッカーの 🙋 を外したときだけ（PR の 🙋 は合図にしない）。子が残っているあいだに書かれた
  レビューも、ここで未対応のものとして拾う。

## 1. 観点をまとめる（collect）

1. **topic → develop の PR**: 0. で見つけたもの（本文が要るなら `gh pr view <番号> --json body`）。
   無ければプレビューの URL は「無し」と書き、観点だけをまとめる（PR を作らない）。
2. **プレビューの URL**: PR の本文・コメントの `https://preview.smalruby.app/<slug>/`。無ければ
   `node scripts/preview-slug.mjs <topic ブランチ>` の規則で作る（スクリプトの使い方はファイルの先頭を読む）。
3. **観点を集める**（読むだけ）:
   - EPIC の本文と、EPIC の「決定待ち」まとめコメント（`<!-- autopilot-epic-decisions`）の決めたこと
   - 済んだ sub-issue の DoD（本文の `## DoD`）と、その PR のレビューのまとめ（`<!-- autopilot-review-findings`）で
     見送った指摘・人間の判断が要るもの
   - 関係する docs の方針（例: 日本語モードなら `docs/dncl/policy.md`）
   - 前の round があれば、その NG から作った sub-issue（本文の `<!-- autopilot-release-ng`）が直したもの
4. **観点のコメント**をトラッカーに書く。形（`release-check.js` の `parseReleaseCheckPoints` / `releasePreviewUrl` が読む）:

   ```markdown
   <!-- autopilot-release-check round=N -->
   ## 🚀 リリース確認（round N）

   **プレビュー**: https://preview.smalruby.app/<slug>/
   **topic → develop の PR**: #<番号>

   プレビューで次を確かめ、モニターの「確認の結果を書く」で観点ごとに OK / NG を送ってください。

   ### R1. <何を確かめるか（短く）>
   - 開く: <URL・タブ・画面>
   - する: <操作>
   - OK: <どうなれば OK か>
   - 出どころ: <#sub-issue の DoD / EPIC の決定 / 見送った指摘 など>

   ### R2. ...
   ```

   - 観点は「どこを開いて何をすると、どうなれば OK か」が分かる形にする。数は 5〜15 くらいにまとめる
     （同じ画面の確認は 1 つに）。人間の判断が要るもの（見送った指摘など）は観点の中で選択肢を書く。
   - **冪等**: 同じ round の観点のコメントがあれば、新しく書かずに PATCH する
     （`gh api -X PATCH repos/$REPO/issues/comments/<id> -F body=@<file>`）。
   - トークンの値を書かない（ログインが要るなら `?devlogin=<DEV_BYPASS_TOKEN>` とキー名で書く）。
5. 結果（🙋 で人間に渡す。AI Status は Release Check のまま）:

   ```json
   {"issue":N,"phase":"release-check","signal":"done","hitl":true,"nextAiStatus":"Release Check",
    "summary":"リリース確認 round N の観点（R1〜Rk）をまとめた","previewUrl":"<プレビューの URL か null>"}
   ```

## 2. 結果を受ける（result）

1. その round の結果のコメント（`<!-- autopilot-release-review round=N -->`）を `parseReleaseReview` で読み（`prOnly` の
   ときは読まず `review` は null）、
   `planReleaseResult({epic, round, review, points, existingBodies, prFeedback})` で計画する（`points` は同じ round の観点の
   コメントを `parseReleaseCheckPoints`、`existingBodies` は EPIC の sub-issue の本文、`prFeedback` は 0. で書いた
   `tmp/release-check-pr-feedback-<N>.json`）。
2. **NG ごとに sub-issue を作る**（`plan.create`。`plan.existing` は作ってあるので作らない）:
   - 題: `fix(<scope>): <観点の題> を直す`（commitlint の形・小文字始まり）
   - 本文の行頭に `autopilot-base: <topic ブランチ>`、1 行目か末尾に `marker`（`<!-- autopilot-release-ng ... -->`）、
     観点の内容・人間のメモ・確かめ方（DoD）を書く。
   - EPIC の sub-issue にする（`gh api repos/$REPO/issues/<epic>/sub_issues -F sub_issue_id=<id>`）、担当は EPIC と同じ、
     `🤖 autopilot` ラベル。Project のフィールド（Kind=Issue・Sprint Backlog）は daemon が `createdSubIssues` から入れる。
   - **全体のコメント**（`plan.comment`）は読んで、直してほしいことなら同じように sub-issue を作る（point は `C`。
     `plan.commentDone` が true なら作ってある）。感想だけなら作らない。
3. **topic → develop の PR のレビュー・コメント**（`plan.prFeedback`。人間の Request changes・レビューの本文・行コメント・
   PR のコメント）を読み、**直してほしいことごとに** sub-issue を作る（作り方は 2. と同じ。題は直すことを短く）。
   - 同じことを言っている複数の ref（レビューの本文とその行コメントなど）は 1 つの sub-issue にまとめてよい。
     本文に、まとめた ref の `marker`（`<!-- autopilot-release-pr epic=E ref=... -->`）を**全部**入れ、
     元のレビュー・コメントの URL（`url`）と、行コメントならファイルと行（`path` / `line`）を書く。
   - 直すことが無いもの（承認・感想・質問への答えだけ）は sub-issue にしない。その ref は 4. の結果のコメントに
     `releasePrSeenMarker(refs)` の目印（`<!-- autopilot-release-pr-seen refs=... -->`）で残す（次から読まない）。
   - 同じことを直す sub-issue が既にあれば（目印の無い、人間や AI が手で作ったものも EPIC の sub-issue の一覧から探す）、
     新しく作らない。その ref は seen の目印に入れ、結果のコメントに既にある sub-issue の番号を書く。
   - 仕様の選択が要るもの（どう直すか決まらない）は、sub-issue の本文に選択肢と AI のおすすめを書いて作る。
4. 結果を受けたことをトラッカーに書く（`<!-- autopilot-release-result round=N -->` で始め、作った sub-issue の一覧か
   「全部 OK」、受けた PR のレビュー・コメントの一覧）。同じ round のものがあれば PATCH する。PATCH するときは、前に
   書いた `autopilot-release-pr-seen` の行を消さずに残し、新しい ref を足す。
   - **`prOnly` のときは `autopilot-release-result` の目印を書かない**（書くと、その round のモニターの結果をあとで
     人間が書いても「もう受けた」と読まれて取りこぼす・`releaseCheckMode`）。新しいコメントに、1 行目に
     `releasePrSeenMarker(refs)`（直すことが無かった ref が無ければ省く）、続けて受けた PR のレビュー・コメントと
     作った sub-issue の一覧を書く。
5. 結果:
   - **NG・PR のレビューから sub-issue を作った** → 子を待つ（済んだら daemon が次の round のリリース確認に入れる）:
     `{"signal":"done","hitl":false,"nextAiStatus":"EPIC Decomposed","createdSubIssues":[<番号>...], ...}`
   - **全部 OK**（作るものが無い）→ topic → develop の PR の本文を更新する（入っている sub-issue・確認の結果・プレビュー）。
     draft は外さない・マージしない。トラッカーに「develop へのマージと EPIC の Close は人間」と書いて人間に返す:
     `{"signal":"done","hitl":true,"nextAiStatus":"Release Check", ...}`
   - **`prOnly` で作るものが無かった**ときは「全部 OK」にしない（人間はまだその round の観点を確かめていない）。
     続けて **1. 観点をまとめる**（0. の `round`）を行い、その結果を返す。

## 結果ファイルの書き方

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"release-check","signal":"done","hitl":true,"nextAiStatus":"Release Check",
"summary":"<ひとこと>","previewUrl":"<URL か null>","createdSubIssues":[]}
EOF
echo AUTOPILOT_DONE
```

- `nextStatus` は付けない（Status は In Progress のまま）。`signal=hitl` の `nextStatus` に Icebox / Close / Done を提案しない（I4）。
- 続けられないエラー（認証・壊れた環境）は `{"signal":"error","error":"<理由>","recoverable":false}` + `AUTOPILOT_ERROR`。

## 注意

- 作業は割り当てられた worktree（cwd）の中・この 1 トラッカーだけ。動的 Workflow / Skill（`/code-review` など）を起動しない。
- コマンド出力をコメントに貼るときは秘密を載せない（トークン・URL のクエリ）。
- `tmp/release-check-*.json` はコミットしない（`tmp/` は gitignore 済み）。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
