---
name: autopilot-triage
description: autopilot のトリアージ・フェーズ。New Item の Issue を分類（EPIC/Issue）・スコープ判定（Backlog/Icebox）・Size 重み付け（small/middle/large）し、結果を autopilot コントラクトの番兵で返す。autopilot Runner から非対話で起動される。
argument-hint: "[issue number]"
disable-model-invocation: true
---

# /autopilot-triage — Triage phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
特に「対話的に質問しない」「終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き pane に signal トークンを出す」を厳守する。

対象 Issue 番号は `$ARGUMENTS` または環境変数 `AUTOPILOT_ISSUE`。リポジトリは `AUTOPILOT_REPO`（既定 `smalruby/smalruby3-editor`）。

このフェーズのゴール: **New Item の Issue を読み、(1) EPIC か通常 Issue か、(2) やる(Backlog)かやらない(Icebox)か、(3) leaf Issue なら Size を、判定して番兵で返す。**

## 手順

### 1. Issue を取得して理解する

```bash
GH_TOKEN="$(bin/bot-token)" gh issue view "$AUTOPILOT_ISSUE" --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}" \
  --json number,title,body,labels,comments
```

タイトル・本文・既存コメントから、何を求めているかを把握する。

### 2. 分類する（判断基準）

**Kind（EPIC / Issue）**
- **EPIC**: 複数の独立した作業に分割でき、1 PR で終わらない規模。または本文に複数の機能・段階・チェックリストが並ぶ。
- **Issue**: 単一の変更で完結し、1 PR で対応できる粒度。

**スコープ（Backlog / Icebox）**
- **Backlog**（やる）: 妥当なバグ報告・機能要望で、プロジェクト方針に沿う。**既定はこちら。**
- **Icebox**（やらない）: 重複・無効・スコープ外・upstream 領域で対応困難など。**Icebox を提案するときは `hitl=true`** にして人間に確認を促す（誤って捨てないため）。

**Size（leaf Issue のみ。EPIC は `null`）**
- `small`: 局所的な小修正（数ファイル・テスト含めて短時間）。
- `middle`: 1 つの機能・コンポーネントにまたがる標準的な変更。
- `large`: 複数コンポーネント横断・設計判断を伴う重い変更（分割を検討すべき水準）。

### 3. トリアージ結果をコメントする（冪等に）

既に autopilot のトリアージコメントを投稿済みでないか確認してから、無ければ bot 名義で 1 件投稿する:

```bash
# 既存コメントに "🤖 autopilot triage" が無いことを確認してから:
GH_TOKEN="$(bin/bot-token)" gh issue comment "$AUTOPILOT_ISSUE" \
  --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}" --body-file <(cat <<'EOF'
🤖 autopilot triage
- Kind: <EPIC|Issue>
- Scope: <Backlog|Icebox>（理由を1-2行）
- Size: <small|middle|large|—>
EOF
)
```

判断に迷い、人間の確認が要る場合（例: Icebox 提案、スコープ不明）は、**質問内容をコメントに書いて `AUTOPILOT_HITL` で終了**する（対話で聞かない）。

### 4. 結果を番兵で返す（必須・最後に実行）

`AUTOPILOT_RESULT_FILE` に単一行 JSON を書いてから、signal トークンを 1 行出力する。

正常完了（例: EPIC → Backlog）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"triage","signal":"done","summary":"EPIC と判定。Backlog へ。",
"nextStatus":"Backlog","nextAiStatus":null,"hitl":false,"size":null,"kind":"EPIC","createdSubIssues":[],"prUrl":null}
EOF
echo AUTOPILOT_DONE
```

通常 Issue で Size 付与（例: middle）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"triage","signal":"done","summary":"通常 Issue。middle。Backlog へ。",
"nextStatus":"Backlog","nextAiStatus":null,"hitl":false,"size":"middle","kind":"Issue","createdSubIssues":[],"prUrl":null}
EOF
echo AUTOPILOT_DONE
```

Icebox 提案（人間確認）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"triage","signal":"hitl","summary":"スコープ外の可能性。人間確認を依頼。",
"reason":"重複の可能性があり Icebox を提案。確認のうえ HITL=No で差し戻してください。","commentUrl":"<投稿したコメントURL>","nextStatus":"Icebox"}
EOF
echo AUTOPILOT_HITL
```

回復不能なエラー:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"triage","signal":"error","summary":"トリアージ失敗","error":"<理由>","recoverable":false}
EOF
echo AUTOPILOT_ERROR
```

## 注意

- **Project フィールドは書き換えない**（Status/AI Status/Size 等の反映は daemon/CLI が結果ファイルを見て行う）。
- `gh` には必ず `GH_TOKEN="$(bin/bot-token)"` を付ける。コミットが要る場面では `bin/bot-git`。
- `AskUserQuestion` を使わない。判断は番兵 + コメントで返す。

---

## License

This skill is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
