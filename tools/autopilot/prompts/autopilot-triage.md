
# /autopilot-triage — Triage phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
特に「対話的に質問しない」「終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き pane に signal トークンを出す」を厳守する。

対象 Issue 番号は 環境変数 `AUTOPILOT_ISSUE`。リポジトリは `AUTOPILOT_REPO`（既定 `smalruby/smalruby3-editor`）。

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

### 3.5 実装方針の合意が必要なら discussion を開始する

次のいずれかに該当する leaf Issue は、**そのまま Backlog に送らず、実装方針の
ディスカッションを開始**する（往復は `autopilot-discuss` フェーズが引き継ぐ）:

- Size が `large`、または設計判断・トレードオフの分岐が明確にある
- 要件が曖昧で、実装前に人間と合意した方が手戻りが小さい
- 既存仕様・他機能への影響が大きい

開始方法: **実装方針の提案コメント**（方針・影響範囲・代替案・確認したい点）を 1 件投稿し、
結果を `signal=hitl` + `nextStatus: "Backlog"` + `nextAiStatus: "Discussing"` で返す:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"triage","signal":"hitl","summary":"実装方針を提案。人間との合意待ち。",
"reason":"実装前に方針の合意が必要。提案コメントを確認のうえ返信し 🙋 HITL を外してください。","commentUrl":"<投稿したコメントURL>",
"nextStatus":"Backlog","nextAiStatus":"Discussing"}
EOF
echo AUTOPILOT_HITL
```

人間が返信して `🙋 HITL` を外すと daemon が `autopilot-discuss` を起動し、承認されれば
Sprint Backlog（= implement へ直接ハンドオフ）まで進む。**議論の往復中 Status は Backlog に
固定**され、triage が再実行されることはない（ステータス固着・再提案ループの防止）。

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

Icebox 提案（人間確認。**Status は動かさない** — 提案段階で Icebox へ動かすと、人間が
ラベルだけ外したときに出口の無い状態に固着する。Icebox への遷移は人間の確定操作のみ）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"triage","signal":"hitl","summary":"スコープ外の可能性。人間確認を依頼。",
"reason":"重複の可能性があり Icebox を提案。同意なら Status を Icebox へ。再検討させるなら 🙋 HITL を外す（またはコメントで指示）と再トリアージします。","commentUrl":"<投稿したコメントURL>","nextStatus":null}
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

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
