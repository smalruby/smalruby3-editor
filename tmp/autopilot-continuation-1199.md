<!-- autopilot-continuation issue=1199 phase=implement iteration=1 -->
## 完了済み
- 純粋ロジック `packages/scratch-gui/src/lib/classroom-teacher-session.js`（localStorage `smalruby:classroomTeacher` に provider + 最後の classroomId/groupId のみ保存、トークンは保存しない。restore 判定・メニュー出し分け・ナビ解決）+ unit テスト
- reducer `classroom.js` に teacherLoggedIn / teacherUnreadCount / teacherLastSelection / teacherNavTarget と action を追加 + テスト
- `use-teacher-auth.js`: restoreTeacherLogin / logoutCachedTeacher / getCachedTeacherAuthProvider、Microsoft ログイン永続時は reload で MSAL キャッシュを消さない + テスト（use-teacher-auth-restore.test.js）
- `use-teacher-notifications.js`: loadDailyNotifications を切り出し（既存テスト pass）
- 先生メニュー: `components/classroom-teacher-menu/`（表示）+ `containers/classroom-teacher-menu.jsx`（起動時の復元: ?devlogin= or silent re-auth、失敗は黙ってログアウト、ログアウト・ナビ要求）+ テスト
- `menu-bar.jsx`（既存マーカー内）に組み込み: 先生ログイン中は生徒ボタンの代わりに先生メニュー、生徒セッションもある場合は両方表示
- `classroom-teacher-modal.jsx`: ログイン状態/未読数/最後の課題を Redux+永続化に同期、メニューからのナビ要求（いまの課題/クラス一覧/お知らせ）を処理、復元完了を後から採用
- i18n（ja / ja-Hira / en）、.prettierignore 追加、`npm run lint` pass（gui 0 warning）
- WIP commit 091d6ed8c1（未 push・PR 未作成）

## 残タスク
- 関連 unit テスト一式の再実行（containers/ reducers/ menu-bar 周辺。前回は一括実行が 600s タイムアウトしたのでファイル単位で）
- pw-check で `?devlogin=` → リロード → 先生メニュー表示 / 「いまの課題を開く」で該当課題が開く を確認（stg か API スタブ）
- docs 更新: `docs/classroom/ui-ux.md`（先生メニュー・表示ルール）、`docs/classroom/testing.md`（data-testid: classroom-teacher-menu-button / -label / -badge / -current-assignment / -class-list / -notifications / -logout / -notifications-badge）、`docs/classroom/source-code.md`、スクショ `0101-menu-bar` 系
- push（bin/autopilot-push --base topic/classroom-lesson-feedback）と Draft PR 作成（Closes #1199、トークン非保存の判断・先生/生徒両方の表示ルール・実アカウントでのサイレント再認証は人間の DoD と明記）

## 次の一手
`cd packages/scratch-gui && npx jest test/unit/containers/classroom-teacher-menu.test.jsx test/unit/containers/use-teacher-auth-restore.test.js test/unit/reducers/classroom-reducer.test.js` 等をファイル単位で再実行して green を確認 → docs 更新 → pw-check → push + Draft PR。

## 継続して安全か
はい: 実装本体は commit 済みで lint も通っており、残りは検証・docs・PR 作成のみ。外部副作用（push / PR）はまだ行っていないため重複の心配もない。
