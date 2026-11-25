
# /autopilot-release-check — Release check phase (decomposed EPIC)

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない（`AskUserQuestion` を使わない・確認待ちで止まらない）。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、
pane に signal トークンを出す。

対象は環境変数 `AUTOPILOT_ISSUE` の **分解済み EPIC（🧭 トラッカー）**。子の sub-issue が全部済んだ（または残りが
`🚀 after-release` だけ）ので、daemon が AI Status を **Release Check** にした。このフェーズは
topic → develop の前の、人間のプレビューでの確認を準備し、確認の結果を受ける（`.claude/rules/topic-branches.md`）。

- コードを変えない・コミットしない・PR をマージしない。**develop へのマージは人間**。
- Project のフィールドと 🙋 は書かない（daemon が結果を見て書く・単一ライター）。書くのはコメントと sub-issue だけ。
- 判断の純粋関数は `tools/autopilot/src/release-check.js`。目印の形はそこに合わせる。

## 0. どちらの段かを決める

```bash
REPO="${AUTOPILOT_REPO:-smalruby/smalruby3-editor}"
GH_TOKEN="$(bin/bot-token)" gh issue view "$AUTOPILOT_ISSUE" --repo "$REPO" --json title,body,labels
GH_TOKEN="$(bin/bot-token)" gh api "repos/$REPO/issues/$AUTOPILOT_ISSUE/comments" --paginate > tmp/release-check-comments-$AUTOPILOT_ISSUE.json
node -e '
const rc = require("./tools/autopilot/src/release-check");
const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
console.log(JSON.stringify(rc.releaseCheckMode(c)));
' tmp/release-check-comments-$AUTOPILOT_ISSUE.json
```

- `{"mode":"collect","round":N}` → **1. 観点をまとめる**
- `{"mode":"result","round":N}` → **2. 結果を受ける**

## 1. 観点をまとめる（collect）

1. **topic → develop の PR** を見つける: head が EPIC の topic ブランチ（sub-issue の本文の行頭の `autopilot-base:` の値）、
   base が develop の open な PR（`gh pr list --repo "$REPO" --base develop --head <topic> --json number,url,body`）。
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

1. その round の結果のコメント（`<!-- autopilot-release-review round=N -->`）を `parseReleaseReview` で読み、
   `planReleaseResult({epic, round, review, points, existingBodies})` で計画する（`points` は同じ round の観点のコメントを
   `parseReleaseCheckPoints`、`existingBodies` は EPIC の sub-issue の本文）。
2. **NG ごとに sub-issue を作る**（`plan.create`。`plan.existing` は作ってあるので作らない）:
   - 題: `fix(<scope>): <観点の題> を直す`（commitlint の形・小文字始まり）
   - 本文の行頭に `autopilot-base: <topic ブランチ>`、1 行目か末尾に `marker`（`<!-- autopilot-release-ng ... -->`）、
     観点の内容・人間のメモ・確かめ方（DoD）を書く。
   - EPIC の sub-issue にする（`gh api repos/$REPO/issues/<epic>/sub_issues -F sub_issue_id=<id>`）、担当は EPIC と同じ、
     `🤖 autopilot` ラベル。Project のフィールド（Kind=Issue・Sprint Backlog）は daemon が `createdSubIssues` から入れる。
   - **全体のコメント**（`plan.comment`）は読んで、直してほしいことなら同じように sub-issue を作る（point は `C`。
     `plan.commentDone` が true なら作ってある）。感想だけなら作らない。
3. 結果を受けたことをトラッカーに書く（`<!-- autopilot-release-result round=N -->` で始め、作った sub-issue の一覧か
   「全部 OK」）。同じ round のものがあれば PATCH する。
4. 結果:
   - **NG から sub-issue を作った** → 子を待つ（済んだら daemon が次の round のリリース確認に入れる）:
     `{"signal":"done","hitl":false,"nextAiStatus":"EPIC Decomposed","createdSubIssues":[<番号>...], ...}`
   - **全部 OK** → topic → develop の PR の本文を更新する（入っている sub-issue・確認の結果・プレビュー）。draft は
     外さない・マージしない。トラッカーに「develop へのマージと EPIC の Close は人間」と書いて人間に返す:
     `{"signal":"done","hitl":true,"nextAiStatus":"Release Check", ...}`

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
- `tmp/release-check-comments-*.json` はコミットしない（`tmp/` は gitignore 済み）。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
