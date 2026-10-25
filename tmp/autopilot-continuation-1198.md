<!-- autopilot-continuation issue=1198 phase=implement iteration=1 -->
## 完了済み
- 純粋ロジック `packages/scratch-gui/src/lib/classroom-seat-selection.js`（番号入力の検証・全角数字対応 / 席アクション判定 / ポーリング結果判定 / ポーリング可否・定数 SEAT_IDLE_HINT_MS=30s, KICK_REQUEST_POLL_INTERVAL_MS=5s）+ unit テスト
- 承認待ちポーリング hook `src/containers/use-kick-request-polling.js`（依頼が生きている間・タブ表示中・未参加のときだけ。非表示→表示で即時 1 回）+ unit テスト
- モーダルを閉じている間の見張り `src/containers/classroom-kick-request-watcher.jsx`（gui.jsx のマーカー内で ClassroomModal 非表示時に描画。承認/却下でモーダルを再オープン）
- `containers/classroom-modal.jsx`: 再オープン時に localStorage の依頼から席画面へ復帰、承認→その席で自動参加（joinSeat + autoJoinSeat effect）、却下→従来バナー
- `student-seat-selector.jsx`: 番号入力欄（`classroom-seat-number-input/-submit/-error/-form`）、常時案内 `classroom-seat-guide`（30 秒で data-idle=1・reduced-motion 尊重アニメ）、大きな確認 `classroom-seat-confirm-message`、依頼中の補足 `kick-request-pending-note`、入力した席の強調 data-typed
- 文言 ja / ja-Hira / en 追加、kickRequest.body を「先生が確認してから席を空けます」に変更
- lint（root `npm run lint`）と関連 unit テスト 38 件 PASS
## 残タスク
- UI 確認: `/app/tmp/issue-1198/verify.mjs`（route スタブで A 空席番号→参加 / B 埋まり席→依頼ダイアログ / D 承認→自動参加 / E モーダル閉→見張りで自動参加 / C 30 秒強調、スクショを /app/tmp/issue-1198/ に保存）を実行。初回は dev server（worktree から `npx webpack serve --port 8631`、ビルド約 9 分）が初回ロードで page.goto 30s タイムアウト → goto の timeout を 180000 に延ばして再実行
- docs: `docs/classroom/ui-ux.md` / `testing.md` に新 data-testid 追記、スクショ更新（docs/classroom/screenshots/）、README/architecture に承認待ちポーリング条件を追記
- push（`bin/autopilot-push --base topic/classroom-lesson-feedback`）と Draft PR 作成。PR 本文に「1 授業あたり最大リクエスト増: 依頼 1 件につき 5 秒間隔×最長 1 時間=最大 720 回（タブ表示中・未参加の間のみ。依頼した生徒だけ）。依頼が無い生徒の通信は増えない」と記載。Closes #1198
## 次の一手
- dev server を `cd packages/scratch-gui && nohup npx webpack serve --port 8631 &` で起動（起動済みなら再利用）→ verify.mjs の goto timeout を延ばして `node /app/tmp/issue-1198/verify.mjs` を実行
## 継続して安全か
- はい。WIP はコミット済みで、テスト・lint は通っている。外部への副作用（push・PR・コメント）はまだ無い。
