
# /autopilot-decompose — Decompose phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 EPIC は 環境変数 `AUTOPILOT_ISSUE`。リポジトリは `AUTOPILOT_REPO`（既定 `smalruby/smalruby3-editor`）。

ゴール: **EPIC を leaf sub-issue に分解し、各 leaf に size(small/middle/large) を付ける。** 分解は
人間の承認ゲート（HITL）を挟むため **2 フェーズ**で動く。フェーズは「自分の分解案コメントが既にあるか」で判定する（冪等）。

## 手順

### 0. 既存状態を確認（propose / create の判定）

```bash
GH_TOKEN="$(bin/bot-token)" gh issue view "$AUTOPILOT_ISSUE" --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}" \
  --json title,body,comments,labels
```

- 本文・コメントから EPIC の意図を把握する。
- コメントに **`🤖 autopilot 分解案`** を含むものが **無ければ → フェーズ A（提案）**、**有れば → フェーズ B（作成）**。
  （daemon は分解案の HITL が人間に承認＝解除されてから本スキルを再起動する。再起動時は分解案が既にあるので B に進む。）

### フェーズ A: 分解案を提案して承認を待つ

1. EPIC を **leaf 単位**（1 PR で完結する粒度）に分割し、各 leaf に **Kind=Issue / Size** と 1〜2 行のスコープを与える。1 PR で終わらない塊はさらに分割するか、フォローアップ EPIC とする。
2. 提案を **bot 名義で 1 コメント**投稿する（先頭は必ず `🤖 autopilot 分解案`）:

   ```
   🤖 autopilot 分解案（#<EPIC> の sub-issue 候補）
   - [small]  <title> — <scope>
   - [middle] <title> — <scope>
   - [large]  <title> — <scope>
   承認: この Issue/PR の HITL を解除（🙋 ラベルを外す or Project HITL=No）してください。
   調整したい場合はコメントで指示してください。
   ```
3. `AUTOPILOT_HITL` で終了（人間の分解承認を待つ）:

   ```bash
   cat > "$AUTOPILOT_RESULT_FILE" <<EOF
   {"issue":$AUTOPILOT_ISSUE,"phase":"decompose","signal":"hitl","summary":"分解案を提示。承認待ち。",
   "reason":"分解承認 HITL。HITL を解除すると sub-issue を作成します。","commentUrl":"<投稿したコメントURL>","nextAiStatus":"Decomposing"}
   EOF
   echo AUTOPILOT_HITL
   ```

### フェーズ B: 承認後に sub-issue を作成

分解案コメントが既にあり（＝承認後の再起動）、最新の人間コメントで否定されていなければ作成する。

1. 各 leaf について sub-issue を作成し、**EPIC に親子リンク**する:

   ```bash
   url=$(GH_TOKEN="$(bin/bot-token)" gh issue create --repo "$AUTOPILOT_REPO" --title "<title>" \
     --body "<scope>"$'\n\nPart of #'"$AUTOPILOT_ISSUE")
   num=$(basename "$url")
   dbid=$(GH_TOKEN="$(bin/bot-token)" gh api repos/$AUTOPILOT_REPO/issues/$num --jq .id)
   GH_TOKEN="$(bin/bot-token)" gh api --method POST repos/$AUTOPILOT_REPO/issues/$AUTOPILOT_ISSUE/sub_issues -F sub_issue_id="$dbid"
   GH_TOKEN="$(bin/bot-token)" gh issue edit "$num" --repo "$AUTOPILOT_REPO" --add-label "🤖 autopilot"
   ```

   - **冪等**: 既に同名 sub-issue が存在する場合は作り直さない（`gh issue list` で確認）。
   - Project への追加・Status=Backlog・Kind=Issue・Size 付与は **daemon が結果ファイルの `createdSubIssues` を見て**行う（単一ライター）。スキルは Project を直接書かない。
2. `done` で終了。EPIC は「分解完了＝親トラッカー化」を表す `EPIC Decomposed` へ:

   ```bash
   cat > "$AUTOPILOT_RESULT_FILE" <<EOF
   {"issue":$AUTOPILOT_ISSUE,"phase":"decompose","signal":"done","summary":"<N> 個の sub-issue を作成。",
   "nextStatus":"In Progress","nextAiStatus":"EPIC Decomposed","hitl":false,"size":null,"kind":"EPIC",
   "createdSubIssues":[<作成した issue 番号...>],"prUrl":null}
   EOF
   echo AUTOPILOT_DONE
   ```

## 注意

- **EPIC は完了させない**（子が全部 done になるまで In Progress）。本スキルは分解までで、EPIC を Close しない。
- size は **leaf にのみ**付ける（EPIC は付けない）。
- `AskUserQuestion` を使わない。承認は HITL（番兵 + コメント）で待つ。
- `gh` には `GH_TOKEN="$(bin/bot-token)"`、コミットは `bin/bot-git`。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
