---
name: autopilot-understand
description: autopilot の理解フェーズ。EPIC/Issue の内容を理解し、不明点があれば bot コメント + HITL で人間に確認する。明確なら次フェーズ可と判定。autopilot Runner から非対話で起動される。
argument-hint: "[issue number]"
disable-model-invocation: true
---

# /autopilot-understand — Understand phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象は `$ARGUMENTS` または `AUTOPILOT_ISSUE`。リポジトリは `AUTOPILOT_REPO`（既定 `smalruby/smalruby3-editor`）。

ゴール: **Issue/EPIC の意図・スコープ・受け入れ条件を把握し、自律的に進められるだけ明確かを判定する。** 不明・曖昧なら人間に確認（HITL）。

## 手順

### 1. Issue を取得して理解する

```bash
GH_TOKEN="$(bin/bot-token)" gh issue view "$AUTOPILOT_ISSUE" --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}" \
  --json title,body,comments,labels
```

本文・コメントから「何を・なぜ・完了条件」を読み取る。関連コード/ドキュメントを必要に応じて調べる。

### 2. 明確さを判定

- **十分に明確**（スコープ・受け入れ条件が自律実行できる粒度で分かる）→ フェーズ完了（done）。
- **不明・曖昧・前提が必要**（仕様が割れる / 影響範囲が読めない / 設計判断が要る）→ **人間に確認（HITL）**。

### 3a. 明確なとき: done

理解の要約を 1 コメント（任意）に残し、次フェーズへ渡す:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"understand","signal":"done","summary":"理解完了: <1行要約>",
"nextStatus":null,"nextAiStatus":null,"hitl":false,"size":null,"kind":null,"createdSubIssues":[],"prUrl":null}
EOF
echo AUTOPILOT_DONE
```

- EPIC なら次は分解（`autopilot-decompose`）。通常 Issue なら次は実装。`nextStatus`/`nextAiStatus` は
  daemon のフェーズ機械に委ねるため原則 null（無理に進めない）。

### 3b. 不明なとき: 人間に確認（HITL）

**対話で聞かず**、確認したい点を箇条書きで bot コメントに投稿してから HITL で終了する:

```bash
GH_TOKEN="$(bin/bot-token)" gh issue comment "$AUTOPILOT_ISSUE" --repo "$AUTOPILOT_REPO" --body-file <(cat <<'EOF'
🤖 autopilot understand — 確認したい点
- <質問1>
- <質問2>
回答のうえ HITL を解除（🙋 ラベルを外す or Project HITL=No）してください。
EOF
)
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"understand","signal":"hitl","summary":"理解に確認が必要。",
"reason":"仕様/スコープの確認。回答のうえ HITL 解除で再開します。","commentUrl":"<投稿したコメントURL>"}
EOF
echo AUTOPILOT_HITL
```

## 注意

- `AskUserQuestion` を使わない。確認は番兵 + コメントで。
- 冪等: 既に同じ確認コメントを出していれば二重投稿しない。
- `gh` は `GH_TOKEN="$(bin/bot-token)"`、コミットは `bin/bot-git`。Project は直接書かない。

---

## License

This skill is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
