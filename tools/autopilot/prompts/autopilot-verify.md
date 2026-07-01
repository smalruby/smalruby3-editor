
# /autopilot-verify — DoD (Playwright) phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 Issue は 環境変数 `AUTOPILOT_ISSUE`。approve 済みの PR の **DoD（Definition of Done）** を確認する。

ゴール: **Issue/PR に定義された DoD を、CI green 確認 + 必要なら Playwright MCP のブラウザ確認で満たす。** 満たせば人間の merge 待ち（HITL）へ。

## 手順

### 1. 対象 PR と DoD を特定

```bash
PR=$(GH_TOKEN="$(bin/bot-token)" gh pr list --repo "$AUTOPILOT_REPO" --search "Closes #$AUTOPILOT_ISSUE in:body" --state open --json number -q '.[0].number')
GH_TOKEN="$(bin/bot-token)" gh pr view "$PR" --repo "$AUTOPILOT_REPO" --json body,statusCheckRollup
```

PR 本文/Issue の **Definition of Done** の各項目を読む。

### 2. CI を確認

```bash
GH_TOKEN="$(bin/bot-token)" gh pr checks "$PR" --repo "$AUTOPILOT_REPO"
```

すべて green でなければ HITL（または address-review へ戻す）。

### 3. ブラウザ DoD（UI 変更がある場合）

UI に関わる DoD は **Playwright MCP** で確認する（`.claude/rules/scratch-gui/e2e-test.md` 準拠）:

- PR コメントの**プレビュー URL**（無ければローカル `http://localhost:8601`）に `?no_beforeunload=1` 付きでアクセス。
- DoD の各確認項目を実施し、スクリーンショットは `tmp/` 配下に保存。
- **ドキュメント変更/ツールのみで UI 変更が無い PR は Playwright 対象外**（CI green = DoD）。

### 4. 結果を返す（人間の merge 待ちへ）

DoD を満たしたら、人間の merge 待ち（HITL=Yes）にする:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"verify","signal":"done","summary":"DoD 確認完了。人間 merge 待ち。",
"nextStatus":"DoD","nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

DoD を満たせない（CI 赤 / ブラウザ確認 NG）場合は、内容をコメントし HITL か address-review に戻す:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"verify","signal":"hitl","summary":"DoD 未達。",
"reason":"<CI 赤 / ブラウザ NG の詳細>。対応のうえ HITL を解除してください。","commentUrl":"<URL>","nextStatus":"Review"}
EOF
echo AUTOPILOT_HITL
```

## 注意

- **merge はしない**（モデル: DoD 後に人間が merge）。本スキルは DoD 確認まで。
- `?tab=sounds` 直アクセス禁止等、`.claude/rules/scratch-gui/e2e-test.md` の Playwright 注意を尊重。
- `AskUserQuestion` を使わない。Project/PR の状態反映は daemon（単一ライター）。bot 認証必須。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
