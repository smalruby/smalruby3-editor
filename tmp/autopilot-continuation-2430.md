<!-- autopilot-continuation issue=2430 phase=implement iteration=1 -->
# 継続メモ: #2430 リリース確認の段

## 完了済み
- phases.js: `RELEASE_CHECK_AI_STATUS`（'Release Check'）、`PHASE_BY_COMMAND['release-check']`、phaseForItem（🧭 + In Progress + Release Check は 🙋 を外すと release-check）、isStuckCandidate（トラッカーの Release Check は対象外・非トラッカーは stuck）、planDelegate（Release Check は release → release-check）、humanWaitReason の 'release'、トラッカー sticky の全部済んだときの文言
- src/release-check.js（純粋関数: 入る条件 `releaseCheckReady` / `selectReleaseCheckEntries`・目印・`releaseCheckMode`・観点の解析・結果コメントの描画と解析・`planReleaseReviewPost`・`planReleaseResult`）+ test/release-check.test.js
- src/release-check-http.js（`applyReleaseCheckEntries`・`GET /release-check`・`POST /release-check/review`・`rememberPreview`）+ test/release-check-http.test.js
- daemon.js: refreshBoardAndProjectTrackers のあとに入る条件を適用、board item の previewUrl、release-check の結果の previewUrl を覚える、createdSubIssues の補完を release-check にも、HTTP の口
- state-machine.test.js（AI_STATUSES に Release Check・網羅テスト）
- prompts/autopilot-release-check.md、settings.js / settings.json の phase
- monitor-inbox.js（札「リリース確認」・「確認の結果を書く」・previewUrl）、monitor.js（#relmodal ダイアログ・プレビューのリンク）+ テスト

## 残タスク
- docs/autopilot/state-machine.md の遷移表（#16 の後に Release Check の行・不変条件の説明）
- docs/autopilot/README.md（フェーズ・AI Status の表・モニターの「確認の結果を書く」・🚀 after-release ラベル）
- docs/autopilot/autonomous-contract.md §2 に `previewUrl`（任意・release-check）を追記（必要なら contract.js で検証）
- docs/autopilot/design-system.md にダイアログ（#relmodal）を 1 行
- pw-check のスクショ（Release Check の行のプレビューリンク・ダイアログ）を docs/autopilot/screenshots/ に追加し README に載せる
- 関係テストを流す: phases.test.js / daemon.test.js / state-machine.test.js / release-check*.test.js / monitor*.test.js
- push（bin/autopilot-push --base develop）→ Draft PR（Closes #2430、「人間の作業」: Projects の AI Status に `Release Check` の option を足す・`🚀 after-release` ラベルを作る・daemon の再起動）

## 次の一手
- docs の 4 ファイルを更新 → テストを流す → pw-check のスクショ → push → Draft PR

## 継続して安全か
- 安全。コードとテストはコミット済みで、残りは docs・スクショ・PR だけ。daemon は再起動まで新しいコードを読まない。
