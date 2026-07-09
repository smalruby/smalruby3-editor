
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

#### A-1. 分割戦略（PR 数最小化）

leaf に分割する前に、**3 案を明示的に比較**して選ぶ（素直に最大分割しない）:

| 案 | 内容 |
|---|---|
| ① 1 PR で完結 | EPIC 全体を分割せず leaf 1 個にする |
| ② 数個にまとめる | 関連コンポーネントを機能単位でまとめ、少数の leaf に束ねる |
| ③ 細かく分割 | 各コンポーネントを個別 leaf にする |

このうち、**各 leaf が 1 実装バジェット**（1 run のタイムアウト。checkpoint 導入後は
複数ラン跨ぎ可）**に収まる範囲で、「最少かつレビュー単位として一貫した」leaf 群**になる
案を選ぶ。

**分割する理由は次のいずれかがあるときのみ**（無ければ束ねる）:

1. 独立して価値がある / 独立してレビューしたい
2. 共有ファイルの衝突を避けたい（並列着手での衝突防止）
3. 1 実装バジェットに収まらない（重い実装・Playwright スクショ多数等）
4. レビュースコープを分けたい（観点が違う・見る人を分けたい等）

上記に当たらない関連コンポーネントは、**別ファイルで衝突しないなら特に** 1 leaf に
束ねてよい（無理に分けない）。直列依存（基盤→応用、共有ファイル編集）が残る場合は、
分割はしても `autopilot-after` で順序付ける（記法は B-2）。

#### A-2. leaf を確定し、提案する

1. 上記戦略で選んだ粒度で EPIC を **leaf 単位**（1 PR で完結する粒度）に分割し、各 leaf に
   **Kind=Issue / Size** と 1〜2 行のスコープを与える。1 PR で終わらない塊はさらに分割するか、
   フォローアップ EPIC とする。
2. 提案を **bot 名義で 1 コメント**投稿する（先頭は必ず `🤖 autopilot 分解案`）。**なぜこの
   粒度か（PR 数の根拠）を 1 行**添える:

   ```
   🤖 autopilot 分解案（#<EPIC> の sub-issue 候補）
   粒度: <① 1 PR で完結 / ② N 個にまとめる / ③ 細かく分割> — <なぜこの粒度か 1 行>
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

#### B-0. 着手順の依存を判断する（並列衝突を防ぐ）

sub-issue を作る前に、**leaf 間に着手順の依存があるか**を判断する。依存がある leaf 同士を
Sprint Backlog にそのまま入れると autopilot が**並列着手**し、**マージ衝突**や
**未整備の基盤への依存**でやり直しになる。順序が要る場合は、後続 leaf の本文の**行頭**に
`autopilot - after`（実際はスペース無し）ディレクティブを書いて直列化する（記法は B-2）。

**依存判断の基準:**

- **基盤 → 応用**: 新しいカテゴリ・機構・共通ファイルを**新設する leaf**を先に、
  それを**使う leaf**を後に。応用 leaf は基盤 leaf に依存させる。
- **共有ファイルを編集する leaf は直列化**する。同じファイル（例: locale ファイル、
  カテゴリ定義、library.jsx のような一覧ファイル）を複数 leaf が編集するなら、
  並列着手すると必ず衝突するので**チェーン状に順序付ける**（leaf2 は leaf1 の後、
  leaf3 は leaf2 の後…）。
- 互いに独立で共有ファイルも触らない leaf には**依存を付けない**（並列で速く回す）。

> 実例: #679 Phase 2（Ruby チュートリアル）の leaf 群は `tutorial-tags.js` /
> `tag-messages.js` / `library.jsx` / locale 3 種を共有編集するため直列化が必須だった。

#### B-1. 各 leaf の sub-issue を作成し、EPIC に親子リンクする

1. 各 leaf について sub-issue を作成し、**EPIC に親子リンク**する。**依存がある leaf は
   本文の先頭に依存ディレクティブを 1 行含める**（B-2 の記法）:

   ```bash
   # 依存の無い基盤 leaf
   url=$(GH_TOKEN="$(bin/bot-token)" gh issue create --repo "$AUTOPILOT_REPO" --title "<title>" \
     --body "<scope>"$'\n\nPart of #'"$AUTOPILOT_ISSUE")

   # 依存のある後続 leaf は本文の "行頭" にディレクティブを置く（$prev は先行 leaf の番号）
   # ↓ 実際の本文では "autopilot-after"（ハイフンのみ・スペース無し）で書くこと
   url=$(GH_TOKEN="$(bin/bot-token)" gh issue create --repo "$AUTOPILOT_REPO" --title "<title>" \
     --body "<!-- autopilot-after: #$prev -->"$'\n\n'"<scope>"$'\n\nPart of #'"$AUTOPILOT_ISSUE")

   num=$(basename "$url")
   dbid=$(GH_TOKEN="$(bin/bot-token)" gh api repos/$AUTOPILOT_REPO/issues/$num --jq .id)
   GH_TOKEN="$(bin/bot-token)" gh api --method POST repos/$AUTOPILOT_REPO/issues/$AUTOPILOT_ISSUE/sub_issues -F sub_issue_id="$dbid"
   GH_TOKEN="$(bin/bot-token)" gh issue edit "$num" --repo "$AUTOPILOT_REPO" --add-label "🤖 autopilot"
   ```

   - **冪等**: 既に同名 sub-issue が存在する場合は作り直さない（`gh issue list` で確認）。
   - Project への追加・Status=Backlog・Kind=Issue・Size 付与は **daemon が結果ファイルの `createdSubIssues` を見て**行う（単一ライター）。スキルは Project を直接書かない。

#### B-2. 依存ディレクティブの記法（`parseAfterIssues` が読む）

`tools/autopilot/src/phases.js` の `parseAfterIssues` が sub-issue 本文から着手順の依存を
抽出する。**後続 leaf の本文**に次の形で書く（正しく発火する条件）:

- **行頭必須**。行の先頭がディレクティブで始まること。**空白インデントがあると発火しない**。
- 大文字小文字は無視される。
- **HTML コメント形式**（`<!-- autopilot-after: #12 -->`）も行頭なら可。人間の目に付かない
  形で入れたいときはこちらを使う。
- **複数依存はカンマまたは空白区切り**（`autopilot-after: #12, #34` / `autopilot-after: #12 #34`）。
  複数行に分けて宣言してもよい（合算される）。
- `#` は省略可（`autopilot-after: 12`）。

> このプロンプト本文では、正規表現に**誤って拾われないよう**わざと
> `autopilot - after`（スペース入り）やバッククォート囲みで書いている。**実際の sub-issue
> 本文では `autopilot-after`（ハイフンのみ・スペース無し）を行頭に置くこと。**

#### ⚠️ B-3. 自己参照の罠（必読）

`parseAfterIssues` の判定正規表現は「**行頭 + `autopilot-after:` + 数字**」で発火する。
そのため、**このディレクティブを説明・例示する文章を Issue 本文やコメントにそのまま書くと、
本物の依存として誤検出され、autopilot がその Issue に永久に着手できなくなる**。

- decompose の分解案コメントや sub-issue のスコープ説明で、依存ディレクティブに**言及**するときは
  必ず**安全な書き方**を使う:
  - `autopilot - after`（**間にスペースを入れる**）… コロン前で切れるので no-match
  - `` `autopilot-after: #N` ``（**バッククォートで囲む**）… 行頭にならないので no-match
  - 行頭でない位置（インデント・箇条書きの `- ` の後など）に置く … no-match
- **本物の依存**として効かせたいときだけ、後続 leaf 本文の**行頭**に
  スペース無しの `autopilot-after: #<先行 leaf>` を置く。
- 本 Issue（#898）の本文自体がこの「説明はスペース入り・本物は行頭スペース無し」の見本。
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
