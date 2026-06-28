---
name: autopilot-address-review
description: autopilot のレビュー指摘対応フェーズ。人間が PR に残した指摘に対応し、修正を push して再び人間レビューに渡す。autopilot Runner から非対話で起動される。
argument-hint: "[issue number]"
disable-model-invocation: true
---

# /autopilot-address-review — Address review phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 Issue は `$ARGUMENTS` または `AUTOPILOT_ISSUE`。人間が **HITL=No に戻した（差し戻した）** PR の指摘に対応する。

ゴール: **人間レビューコメントを読み、対応（修正/返信）し、再び人間レビュー（HITL=Yes）に渡す。**

## 前提: 既存 PR ブランチで作業する

このフェーズは新規ブランチではなく **既存 PR のブランチ**で作業する。worktree は #767 の
既存ブランチ checkout モードで用意する:

```bash
PR=$(GH_TOKEN="$(bin/bot-token)" gh pr list --repo "$AUTOPILOT_REPO" --search "Closes #$AUTOPILOT_ISSUE in:body" --state open --json number -q '.[0].number')
bin/autopilot-worktree create "$AUTOPILOT_ISSUE" --pr "$PR"   # PR ヘッドブランチを checkout
```

（daemon がこのフェーズの worktree を `--pr` で用意する。スキル内で再実行しても冪等。）

## 手順

### 1. 未対応のレビュー指摘を集める

```bash
GH_TOKEN="$(bin/bot-token)" gh pr view "$PR" --repo "$AUTOPILOT_REPO" --json comments,reviews,reviewThreads
GH_TOKEN="$(bin/bot-token)" gh api repos/$AUTOPILOT_REPO/pulls/$PR/comments  # inline コメント
```

bot 自身のコメントや解決済みは除外。人間からの未対応指摘だけを対象にする。

### 2. 対応する

- コード修正が要る指摘 → worktree 内で修正 → 関連テスト/lint → `bin/bot-git` でコミット・push。
- 議論/質問の指摘 → PR に bot で返信（必要なら判断を仰ぐ場合は HITL）。
- 各指摘に「対応した/返信した」が辿れるよう、まとめコメントを 1 件残す。

### 3. 再び人間レビューへ

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"address-review","signal":"done","summary":"レビュー指摘 <N> 件対応。再レビューへ。",
"nextStatus":"Review","nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

判断が割れる指摘で人間の意見が要るなら、論点を整理してコメント + `AUTOPILOT_HITL` で確認する。

## 注意

- **既存 PR ブランチで作業**（新ブランチを切らない）。1 Issue = 1 PR。
- 冪等: 同じ指摘に二重対応・二重コメントしない。
- `AskUserQuestion` を使わない。Project/PR の状態反映は daemon（単一ライター）。
- bot 認証（`bin/bot-git` / `bin/bot-token`）。
