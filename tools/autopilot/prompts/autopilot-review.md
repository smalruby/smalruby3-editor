
# /autopilot-review — Adversarial review phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 Issue は 環境変数 `AUTOPILOT_ISSUE`。作業は割り当てられた worktree（その Issue の PR ブランチ）の中で行う。

ゴール: **実装フェーズが作った PR を「別の批判的レビュアー」として敵対的にレビューし、明白な問題を自分で直してから人間レビューに渡す。** 人間の負担を、AI が先に潰せる指摘で減らす。

## 手順

### 1. 対象 PR を特定

```bash
PR=$(GH_TOKEN="$(bin/bot-token)" gh pr list --repo "${AUTOPILOT_REPO:-smalruby/smalruby3-editor}" \
  --search "Closes #$AUTOPILOT_ISSUE in:body" --state open --json number -q '.[0].number')
```

### 2. 敵対的レビューを実行（インライン・軽量）

差分に対し、**自分で（インラインで）批判的にレビューする**。

> ⚠️ **`/code-review` や `/security-review` などの Skill を起動しないこと**（Issue #893）。
> これらは **動的マルチエージェント Workflow** を起動し、許可プロンプトで worker が停止する上に
> トークンを大量消費する。worker は root で動き `bypassPermissions` が使えないため、
> Skill/Workflow の許可プロンプトを避ける。**レビューは以下の観点を自分の目で確認する**
> （どうしても機械的チェックを併用する場合でも、単発の観点チェックに留め、動的 workflow は使わない）。

`GH_TOKEN="$(bin/bot-token)" gh pr diff "$PR" --repo "$AUTOPILOT_REPO"` で差分を読み、次の観点で確認する:

- **正確性バグ** — 境界条件・null/undefined・非同期の取りこぼし・エラー処理漏れ・退行
- **セキュリティ** — 情報漏洩・認可/入力検証・秘密のログ出力
- **再利用/簡潔性/効率** — 重複・不要な複雑さ・明らかな非効率
- プロジェクト規約（`CLAUDE.md` / `.claude/rules`）違反、マーカー漏れ、prettier 対象一覧の更新漏れ
- テスト不足（直接の関連テストがあるか）、ドキュメント/DoD の整合
- 「動くが脆い/将来壊れる」設計の指摘

### 3. 明白な指摘は自分で修正

- 修正は worktree 内で行い `bin/bot-git` でコミット・push（commitlint: 小文字 subject / 各行 ≤100 字）。
- 修正 → 関連テスト/lint をローカル再実行 → push。重大だが自動修正が危険なものは PR にコメントで残す。

### 4. 結果を返す（人間レビューへ）

レビュー＋修正が済んだら、PR を **Ready + `🙋 HITL`** に上げて人間レビューへ（実際の Ready/ラベル/Status は daemon が反映）:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"review","signal":"done","summary":"敵対的レビュー完了(<N>件対応)。人間レビューへ。",
"nextStatus":"Review","nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

判断に迷う重大指摘で人間の意見が要る場合は、コメント + `AUTOPILOT_HITL` で確認する。

## 注意

- レビューは **batch-tools を直接 monkey-patch しない**等、`.claude/rules` の E2E 注意も尊重。
- `AskUserQuestion` を使わない。Project/PR の状態反映は daemon（単一ライター）。
- bot 認証（`bin/bot-git` / `bin/bot-token`）。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
