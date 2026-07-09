
# /autopilot-implement — Implement phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 leaf Issue は 環境変数 `AUTOPILOT_ISSUE`。作業は **割り当てられた worktree（cwd）**の中だけで行う。

ゴール: **Issue を TDD で実装し、Draft PR を作成する。** 実装が終わったら自己（敵対的）レビュー（`autopilot-review`）に渡す。

## 手順

### 1. Issue を把握し、TDD で実装

```bash
GH_TOKEN="$(bin/bot-token)" gh issue view "$AUTOPILOT_ISSUE" --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}" --json title,body,comments
```

- プロジェクト規約（`CLAUDE.md` / `.claude/rules`）に従う。**[RED] テストを先に書き失敗を確認 → [GREEN] 実装 → [PASS]**。
- 関連する直接のテスト + lint をローカルで実行（フル CI は push 時）。
- 仕様が割れる/設計判断が要るなら **実装に踏み込まず**、bug コメント + `AUTOPILOT_HITL` で確認（understand と同様）。
- **`tmp/autopilot-continuation-$AUTOPILOT_ISSUE.md` があれば checkpoint からの再開**。存在すれば
  まず読み、「完了済み / 残タスク / 次の一手」を踏まえて続きから実装する（詳細は 1.5）。

### 1.5 時間契約（実行上限 約30分・soft-limit 22分）

このフェーズの**実行上限は約30分**。soft-limit（22分）を超えると runner が tmux 経由で
「⏰ 残り約8分。新しい大きな作業を始めず、安全な区切りで停止して checkpoint 手順を実行して」
という信号を **1 回だけ**送る。この信号を受け取ったら（または自分で残り時間が僅かと判断
したら）、新しい大きな作業を始めず、安全な区切りで停止すること。まだ完了できる見込みが
あれば通常どおり最後まで実装してよい（checkpoint は強制ではない。完了できた場合は 4 の
通常完了を返す）。

停止する場合の手順（詳細・JSON スキーマは `docs/autopilot/autonomous-contract.md` §2.5）:

1. WIP を意味のある単位で `bin/bot-git commit` する。
2. `tmp/autopilot-continuation-$AUTOPILOT_ISSUE.md` に「完了済み / 残タスク / 次の一手 /
   継続して安全か」を固定フォーマットで記載し、commit する（既存ファイルがあれば
   `iteration` を前回 +1 にする）。
3. checkpoint を示す結果を emit する:

   ```bash
   cat > "$AUTOPILOT_RESULT_FILE" <<EOF
   {"issue":$AUTOPILOT_ISSUE,"phase":"implement","signal":"hitl",
   "reason":"soft-limit でチェックポイント。tmp/autopilot-continuation-$AUTOPILOT_ISSUE.md に残タスクを記載。",
   "summary":"チェックポイント: <ひとこと>","nextAiStatus":"Awaiting Continuation"}
   EOF
   echo AUTOPILOT_HITL
   ```

### 2. コミット（bot 名義）

```bash
bin/bot-git commit -m "<type>(<scope>): <subject>" -m "<body 各行 ≤100 字>" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- **commitlint 制約**: subject は小文字始まり（大文字始まり/略語先頭は不可）、body/footer 各行 **≤100 字**。
- push は **`bin/autopilot-push --base "${AUTOPILOT_BASE_BRANCH:-develop}"`** を使う（push 経路を自動判定）:
  - `route=bot` → Bot 名義で push された（通常経路。従来の `bin/bot-git push` と同じ）
  - `route=personal` → 変更に **Bot 権限外パス**（`.github/workflows/**` 等）が含まれるため、
    **個人クレデンシャル**で push された。**次の「3.5 個人トークン PR」に従うこと**

### 3. Draft PR を作成

```bash
GH_TOKEN="$(bin/bot-token)" gh pr create --repo "$AUTOPILOT_REPO" --draft --base "${AUTOPILOT_BASE_BRANCH:-develop}" \
  --head "<branch>" --title "<type>(<scope>): <title> (#$AUTOPILOT_ISSUE)" --body-file <(...)
```

### 3.5 個人トークン PR（`route=personal` のときのみ）

`bin/autopilot-push` が `route=personal` を返した場合（`.github/workflows/**` 等、Bot の
権限外パスを含む変更）:

1. PR 作成は **`GH_TOKEN` を注入せず plain `gh` で行う**（開発者の個人トークン名義になる）:
   ```bash
   gh pr create --repo "$AUTOPILOT_REPO" --draft --base "${AUTOPILOT_BASE_BRANCH:-develop}" ...
   ```
2. PR に **`👥 human-review-required` ラベル**を付ける（想定外領域の変更は本人以外の
   レビューを必須にする運用）:
   ```bash
   gh pr edit <PR番号> --repo "$AUTOPILOT_REPO" --add-label "👥 human-review-required"
   ```
3. PR 本文に「この PR は Bot 権限外パス（`<該当ファイル>`）を含むため個人トークンで
   作成しています。**作成者本人以外のレビューが必須**です」と明記する。

- **ベースブランチ**: `--base` は **`$AUTOPILOT_BASE_BRANCH`（既定 `develop`）** を使う。daemon が Issue 本文の
  `autopilot-base:` ディレクティブや「## ベースブランチ」宣言を読み、worktree もこの base から分岐させて渡す。
  EPIC のサブ Issue を親 epic ブランチに積むケースで使う。宣言が無ければ develop。
- 本文に **`Closes #<issue>`**（merge で leaf を自動 Close = merge-progression）。
- **Draft で作成**（AI 作業中の合図）。Ready 化と `🙋 HITL` は人間レビューに渡すフェーズで行う（daemon が反映）。

### 4. 結果を返す（自己レビューへ）

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"implement","signal":"done","summary":"実装+Draft PR 作成。",
"nextStatus":"In Progress","nextAiStatus":"Self-Reviewing","hitl":false,"size":null,"kind":null,
"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

実装できないブロッカー時:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"implement","signal":"error","summary":"実装失敗","error":"<理由>","recoverable":false}
EOF
echo AUTOPILOT_ERROR
```

## 注意

- **worktree の外を触らない**。1 Issue = 1 PR。
- `AskUserQuestion` を使わない。判断は HITL（コメント + 番兵）。
- Project フィールド・PR ラベル/Ready/Draft の切替は daemon が結果を見て行う（単一ライター）。
- bot 認証（`bin/bot-git` / `bin/bot-token`）。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
