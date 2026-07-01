
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

### 2. コミット（bot 名義）

```bash
bin/bot-git commit -m "<type>(<scope>): <subject>" -m "<body 各行 ≤100 字>" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- **commitlint 制約**: subject は小文字始まり（大文字始まり/略語先頭は不可）、body/footer 各行 **≤100 字**。
- push: `bin/bot-git push -u origin HEAD:refs/heads/<branch>`。

### 3. Draft PR を作成

```bash
GH_TOKEN="$(bin/bot-token)" gh pr create --repo "$AUTOPILOT_REPO" --draft --base "${AUTOPILOT_BASE_BRANCH:-develop}" \
  --head "<branch>" --title "<type>(<scope>): <title> (#$AUTOPILOT_ISSUE)" --body-file <(...)
```

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
