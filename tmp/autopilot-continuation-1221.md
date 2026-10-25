<!-- autopilot-continuation issue=1221 phase=implement iteration=1 -->

## 完了済み

- 測定スクリプト `tools/playwright-verify/verify-classroom-viewport.mjs`（スタブ式・stg 不要・1300×600）。生徒 8 画面（一番長い状態: 40 席・kicked + 退室依頼待ち + 選択中 + エラー / kicked + 却下 + 30 秒の強調 + 番号エラー / 退室依頼ダイアログ + エラー / 参加完了 / ステータス（長いコメント）/ 提出確認 / メニューバー）と先生 5 画面（先生メニュー・クラス一覧・課題詳細の説明 / メンバー 40 席・メンバー詳細）を測って一覧を出す。`VIEWPORT=WxH` / `SKIP_IDLE=1` / `DOCS_SHOTS=1` に対応
- 生徒用モーダル: 幅 500→960px（95vw まで）、上下マージン 100px→1rem、本文の max-height は `calc(100vh - 5.125rem - 8px)`（`classroom-modal.css` の `.modal-content.modal-content` / `.student-body`）
- 座席選択: CSS grid の 2 列（左 = 番号入力・案内・10 列の座席グリッド、右 = バナー + 確認 + 参加ボタン + エラー）。1023px 以下では「バナー → グリッド → 操作」の順に縦に積む
- 結果: **1300×600 で 13/13 PASS**（変更前は生徒 3/8）。1024×768・768×1024・844×390 でも生徒画面は崩れない（390×844 は縦持ちゲートなので対象外）
- 撮り直した docs スクショ（ファイル名はそのまま）: 0301 / 0303 / 0304 / 0306 / 0307 / 0308 / 0309 / 0315 / 0317
- 変更前のスクショ: `tmp/viewport-before/`（gitignore 対象・この worktree にだけある）
- #1209 の画像ビューア: どこにもまだ組み込まれていない。CSS では `.toolbar` は内容の高さのまま、`.viewport` は `flex:1; min-height:0; overflow:hidden` なので、高さが足りないときに縮むのは画像の領域だけ。操作バーは欠けない（CSS を読んで確認。実際に描画しての確認はしていない）

## 残タスク

1. `tools/playwright-verify/README.md` の一覧に `verify-classroom-viewport.mjs` の行を足す
2. `docs/classroom/ui-ux.md` に「画面サイズの基準（1300×600）」の節を足し、「モーダルサイズ」の節（714 行目付近）を新しい幅に直し、§6 の座席選択の説明を 2 列のレイアウトに合わせる
3. unit テスト: `student-seat-selector` の出し分け（バナーは `studentNotices`、確認と参加ボタンは `studentActions` に入る）を `test/unit/components/` に足す
4. `verify-classroom-status-icons.mjs` を `DOCS_SHOTS=1` で走らせて 0302 を撮り直す（0316 / 0305 / 0310〜0314 も古いレイアウトのまま）
5. lint（`npm run lint`）→ コミット → `bin/autopilot-push --base topic/classroom-lesson-feedback` → Draft PR（`Closes #1221`、結果の一覧と変更前 / 変更後のスクショ、幅を 960px にした理由 = 2 列の座席選択 + 右列 360px + 10 列のグリッドに必要な幅で、1300px の 95vw に収まり、iPad の横向き 1024px にも収まる）

## 次の一手

PORT=8621 で dev server を立ち上げる（`cd packages/scratch-gui && PORT=8621 npm start`。メモリが足りないと OOM で落ちる。他の worktree の webpack が 2 つ動いていた）。立ち上がったら `BASE=http://localhost:8621 node tools/playwright-verify/verify-classroom-viewport.mjs` で 13/13 PASS を確かめてから、残タスク 1→5 の順に進める。

## 継続して安全か

安全。WIP はコミット済みで、push も PR もまだしていない。座席選択の一番長い状態は本文がちょうど上限（510/510）で、余裕は 0px。案内文がこれ以上増えるなら、確認ボックスの余白を詰めること。
