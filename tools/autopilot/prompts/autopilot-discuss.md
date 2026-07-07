
# /autopilot-discuss — 実装前ディスカッションフェーズ

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
特に「対話的に質問しない」「終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き pane に signal トークンを出す」を厳守する。

対象 Issue 番号は環境変数 `AUTOPILOT_ISSUE`。リポジトリは `AUTOPILOT_REPO`（既定 `smalruby/smalruby3-editor`）。

このフェーズのゴール: **実装に入る前の方針ディスカッション（autopilot ↔ 人間の往復）を 1 往復進める。**
triage（または前回の discuss）が方針提案コメントを出して人間に渡し、人間が返信して `🙋 HITL` ラベルを
外すと、このフェーズが起動される。**議論の往復中は Status を動かさない**（Backlog のまま）。
人間が承認したら **Sprint Backlog を返して implement へ直接ハンドオフ**する。

## 手順

### 1. Issue とスレッド全体を読む

```bash
GH_TOKEN="$(bin/bot-token)" gh issue view "$AUTOPILOT_ISSUE" --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}" \
  --json number,title,body,labels,comments
```

これまでの提案コメント（`🤖 autopilot` の方針提案）と、その後の人間の返信をすべて読み、
**人間の最新の意図**を分類する。

### 2. 人間の返信を分類して対応する

| 分類 | 判断基準 | 対応 |
|---|---|---|
| **承認** | 「承認」「approve」「LGTM」「この方針で」「進めて」など、提案への明確な同意 | 追加コメント不要（必要なら短い着手宣言のみ）。**`signal=done` + `nextStatus: "Sprint Backlog"`** で終了 → daemon が implement へ直接ハンドオフ |
| **修正・条件付き同意** | 「〜は変えて」「この部分はこうして」など方針の部分修正 | 修正を織り込んだ**改訂方針**を 1 コメントで返す（差分を明示）。**`signal=hitl`（`nextStatus: "Backlog"`, `nextAiStatus: "Discussing"`）** で再び人間へ |
| **質問** | 提案内容への質問 | 質問に答えるコメントを 1 件投稿。**`signal=hitl`（同上）** |
| **見送り** | 「やらない」「不要」など | 確認コメントを投稿し **`signal=hitl` + `nextStatus: "Icebox"`** を提案（人間が Status を確定） |
| **判断不能** | 返信が無い・意図が読めない | 論点を箇条書きで整理したコメントを投稿し **`signal=hitl`（`nextStatus: "Backlog"`, `nextAiStatus: "Discussing"`）** |

**重要**:
- 往復中に Status を Backlog 以外へ動かす提案をしない（承認 → Sprint Backlog と、見送り → Icebox の 2 つだけが例外）。
  これにより triage との再提案ループでステータスが固着・振動しない。
- 承認の判断は保守的に。**明確な同意が読み取れないときは承認扱いしない**（hitl で聞き直す）。
- 改訂方針は**同じ 1 スレッドに積む**（新しい Issue や重複コメントを作らない・冪等）。

### 3. 結果を番兵で返す（必須・最後に実行）

承認 → implement へ直接ハンドオフ:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"discuss","signal":"done","summary":"方針承認。implement へハンドオフ。",
"nextStatus":"Sprint Backlog","nextAiStatus":null,"hitl":false,"size":null,"kind":null,"createdSubIssues":[],"prUrl":null}
EOF
echo AUTOPILOT_DONE
```

議論継続（改訂提案・回答を投稿済み）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"discuss","signal":"hitl","summary":"改訂方針を提示。人間の返信待ち。",
"reason":"提案への指摘を織り込んだ改訂方針を提示。確認のうえ返信し 🙋 HITL を外してください。","commentUrl":"<投稿したコメントURL>",
"nextStatus":"Backlog"}
EOF
echo AUTOPILOT_HITL
```

> 注: `signal=hitl` の場合、daemon は `nextStatus` を反映し AI Status は `Discussing` のまま維持される
> （dispatch 開始時に daemon が設定済み）。`🙋 HITL` ラベルは daemon が両面に付与する。

回復不能なエラー:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"discuss","signal":"error","summary":"discuss 失敗","error":"<理由>","recoverable":false}
EOF
echo AUTOPILOT_ERROR
```

## 注意

- **Project フィールドは書き換えない**（反映は daemon/CLI が結果ファイルを見て行う）。
- `gh` には必ず `GH_TOKEN="$(bin/bot-token)"` を付ける。
- `AskUserQuestion` を使わない。判断は番兵 + コメントで返す。
- コードは書かない（実装は implement フェーズの仕事）。設計方針・影響範囲・代替案の議論に徹する。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
