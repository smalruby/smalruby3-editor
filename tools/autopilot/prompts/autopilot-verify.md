
# /autopilot-verify — DoD (headless Playwright) phase

**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`.**
対話的に質問しない。終了時に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出す。

対象 Issue は 環境変数 `AUTOPILOT_ISSUE`。approve 済みの PR の **DoD（Definition of Done）** を確認する。

ゴール: **Issue/PR に定義された DoD を、CI green 確認 + 必要なら headless Playwright のブラウザ確認で満たす。** 満たせば人間の merge 待ち（HITL）へ。

> **ブラウザ確認は `playwright` パッケージ（bundled chromium）を headless で使う。** worker（コンテナ内 claude）は
> bundled chromium を headless で起動して自分で UI 確認まで完結できる（Issue #891 で実証済み）。
> **Playwright MCP は使わない**（host Chrome 依存でコンテナ内では `Chromium distribution 'chrome' is not found` で失敗する）。

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

### 3. ブラウザ DoD（UI 変更がある場合）— **UI 種別で分岐**

**ドキュメント変更/ツールのみで UI 変更が無い PR は Playwright 対象外**（CI green = DoD）。
UI に関わる DoD がある場合、**次の 3 種別で確認手順を分岐**する:

#### 3-A. 自己完結ページ（dev server 不要 — autopilot monitor 等）

インライン CSS/JS で完結する HTML（例: `tools/autopilot/src/monitor.js` の `MONITOR_HTML`）は
**dev server 不要**。稼働中 daemon の `http://localhost:8787/` を開くか、HTML を静的 serve して確認する。

ヘルパー `tools/autopilot/bin/pw-check`（bundled chromium・headless 固定・スクショ `tmp/`）を使う:

```bash
# (a) 稼働中の daemon monitor を確認
node tools/autopilot/bin/pw-check http://localhost:8787/ --wait '#board' --eval 'document.title'

# (b) daemon が起動していないとき: 自己完結 HTML を静的 serve して確認
node -e "const {MONITOR_HTML}=require('./tools/autopilot/src/monitor'); require('fs').writeFileSync('tmp/monitor-preview.html', MONITOR_HTML);"
node tools/autopilot/bin/pw-check --serve-html tmp/monitor-preview.html --wait '#board' --eval 'document.title'
```

`pw-check` は結果 JSON（`ok` / `title` / `evalResult` / `screenshot`）を stdout に出し、
スクリーンショットを `tmp/pw-check-*.png` に保存する。DoD 項目に応じて `--eval` で
`getBoundingClientRect()` / `getComputedStyle()` / DOM テキストなどを取って検証する。

#### 3-B. scratch-gui の UI（dev server が必要）

`localhost:8601` の dev server が要る。**起動は重い（webpack）ので、PR コメントの
プレビュー URL（`https://smalruby.jp/smalruby3-editor/<branch>/`）があればそれを優先**し、
無ければ dev server を起動して待機してから確認する。

```bash
# プレビュー URL があれば直接確認（dev server 起動不要）
node tools/autopilot/bin/pw-check \
  'https://smalruby.jp/smalruby3-editor/<branch>/?no_beforeunload=1&tab=ruby' \
  --wait '[class*="gui_editor-wrapper"]' --timeout 90000 --eval '<DoD 確認式>'

# プレビュー URL が無いとき（dev server をバックグラウンド起動 → 応答を待つ → 確認）
# npm start をバックグラウンドで起動し、`until curl -sf -o /dev/null http://localhost:8601; do sleep 5; done` で待機してから pw-check を実行する
```

`.claude/rules/scratch-gui/e2e-test.md` の URL パラメータ（`?no_beforeunload=1` 必須、`tab` / `rubyMode` 等）、
data-testid 一覧、Monaco 操作に従う。`?tab=sounds` 直アクセスの扱いも同ドキュメントに従う。

#### 3-C. 音 / autoplay 依存（headless では判定不可 → ホスト引き継ぎ）

音の再生・autoplay policy に依存する DoD は **headless chromium では信用できない**
（`e2e-test.md` の既知事項: headless の Chromium は autoplay policy が緩く「鳴った」と誤判定する）。
この種の最終確認は **実 Chrome が要るためホスト/人間へ引き継ぐ**（従来どおり `🙋 HITL`）。
headless で「OK」と誤判定しないこと。

### 4. 結果を返す（人間の merge 待ちへ）

DoD を満たしたら、人間の merge 待ち（HITL=Yes）にする:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"verify","signal":"done","summary":"DoD 確認完了。人間 merge 待ち。",
"nextStatus":"DoD","nextAiStatus":null,"hitl":true,"size":null,"kind":null,"createdSubIssues":[],"prUrl":"<PR URL>"}
EOF
echo AUTOPILOT_DONE
```

DoD を満たせない（CI 赤 / ブラウザ確認 NG / 音系でホスト確認が必要）場合は、内容をコメントし HITL か address-review に戻す:

```bash
cat > "$AUTOPILOT_RESULT_FILE" <<EOF
{"issue":$AUTOPILOT_ISSUE,"phase":"verify","signal":"hitl","summary":"DoD 未達。",
"reason":"<CI 赤 / ブラウザ NG / 音系はホスト確認が必要 の詳細>。対応のうえ HITL を解除してください。","commentUrl":"<URL>","nextStatus":"Review"}
EOF
echo AUTOPILOT_HITL
```

## 注意

- **ブラウザは `playwright` パッケージの bundled chromium を headless で使う**（`pw-check` ヘルパー推奨）。**Playwright MCP は使わない**。
- **merge はしない**（モデル: DoD 後に人間が merge）。本スキルは DoD 確認まで。
- dev server 起動は重い。**プレビュー URL があれば優先**し、無闇に毎回ビルドしない。
- 音/autoplay の最終確認は実 Chrome（ホスト）— headless で「OK」と誤判定しない（種別 3-C）。
- スクショは必ず `tmp/` 配下、`?tab=sounds` 直アクセス等 `.claude/rules/scratch-gui/e2e-test.md` の注意を尊重。
- `AskUserQuestion` を使わない。Project/PR の状態反映は daemon（単一ライター）。bot 認証必須。

---

## License

This phase prompt is part of the Smalruby autopilot and is licensed under the **MIT License** (not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
