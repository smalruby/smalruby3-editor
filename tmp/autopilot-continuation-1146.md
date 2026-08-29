<!-- autopilot-continuation issue=1146 phase=address-review iteration=1 -->
## 完了済み

- **base 追従の確認**: `ddcc47a2` で develop を取り込み済み。`origin/develop` から 0 commit behind、
  PR #1148 は `MERGEABLE`（レビュー時点のコンフリクトは解消済み）。
- **FYI 1（型の嘘）**: `paginateAll` の `as QueryCommand` キャストを廃止し、`instanceof ScanCommand`
  で分岐して本来の出力型を得る形にした（`Parameters<typeof docClient.send>[0]` へのキャストは
  `ServiceOutputTypes` に潰れて `Items` / `LastEvaluatedKey` が引けなくなるので不採用）。
- **逆引き索引の土台（CDK）**: `ClassroomCoTeacherIndex{suffix}`（PK `coTeacherEmail` /
  SK `resourceKey` = `assignment#<id>` or `group#<id>`、TTL `ttl`、DESTROY）を追加。
  Classrooms に `groupId-index` GSI を追加。env `CO_TEACHER_INDEX_TABLE_NAME` と
  `grantReadWriteData` も配線済み。
- **逆引き索引の書き込み（dual-write）**: `syncCoTeacherIndex(type, id, before, after, ttl)` を追加し、
  課題の共同管理者 追加 / 削除（`handleAddCoTeacher` / `handleRemoveCoTeacher`）と
  組の更新（`handleUpdateGroup` の `coTeacherEmails`）から呼ぶようにした。差分のみ Put/Delete。
- 現状で `npx tsc --noEmit` エラーなし / `npx jest` **18 suites 279 tests green**（読み取りは未変更）。

## 残タスク

1. **書き込みの取りこぼし**: `handleMigrateGroups` が作る `groupUpdates`（`set.coTeacherEmails` の union）を
   適用している箇所からも `syncCoTeacherIndex('group', ...)` を呼ぶ。
2. **読み取りの切り替え（Scan の全廃）**:
   - `listCoManagedGroups` → 逆引き Query（`coTeacherEmail = :email AND begins_with(resourceKey, 'group#')`）
     → `ClassroomGroups` を BatchGet → `teacherSub !== identity.sub` で除外。
   - `listSharedAssignments` を 2 つに割る:
     `listAssignmentsCoTaughtBy(email)`（逆引き Query + BatchGet）と
     `listAssignmentsInGroups(groupIds)`（`groupId-index` を groupId ごとに `queryAll`）。
     → これで FYI 2（1 行ラッパ）/ FYI 3（センチネル）/ FYI 4（述語ごとに計測できない）も同時に解消し、
     `IN` の 100 個チャンク分割も不要になる。
   - `handleListClassrooms` から Classrooms / ClassroomGroups の Scan が 0 になる
     → レビューの Question「ページ上限 25 × 1MB × 4 本 vs `memorySize: 256`」も前提ごと消える。
3. **バックフィル**: 既存データ用の一回限りのスクリプト（`infra/smalruby-classroom/bin/backfill-coteacher-index.ts`、
   stage 指定・冪等）と `docs/classroom/operations.md` の runbook。
   **読み取り切り替えを含む Lambda を反映する前に必ず実行する**（未実行のまま切り替えると
   既存の共同管理者が一覧から消える）。デプロイ順は「GSI/テーブル作成 → backfill → Lambda 反映」。
4. **テスト**: `handler-list-classrooms-reads.test.ts` を「Classrooms への Scan 0 回・逆引き Query と
   `groupId-index` Query で全件取得」に更新。逆引き同期（追加/削除で Put/Delete が出る）と
   backfill スクリプトのテストを追加。Scan 前提のモックを持つ既存スイート
   （`handler-group-co-teacher` / `handler-group-enumeration` / `handler-group-seatcount` 等）を Query に追随。
5. **ドキュメント**: `docs/classroom/architecture.md` の読み取り構成を新しい形（逆引き索引 + `groupId-index`、
   Scan 全廃、`DDB_MAX_PAGES` の位置づけ）に更新。`.claude/rules/infra/smalruby-classroom.md` の
   テーブル一覧（現在 8 テーブル）に新テーブルを追記。
6. **PR 本文の更新**: 読み取り構成の表を更新し、「人間の確認事項」に *stg で backfill を実行してから
   デプロイする* を追加する。

## 次の一手

残タスク 2 の読み取り切り替えから着手する（1 は 2 の途中で同じファイルを触るのでついでに直す）。
`listSharedAssignments` の呼び出し元は `handleListClassrooms` と `listAssignmentsInGroups` 経由の
4 箇所だけなので、まず 2 関数への分割 → 既存テストを走らせてモックの追随が必要な箇所を洗い出す、
の順が早い。

## 継続して安全か

はい: コミット済みの変更は **追加のみ**（新テーブル・新 GSI・書き込みの差分同期）で、読み取り経路は
一切変えていない。既存テスト 18 suites 279 tests が green で、この状態で止めても既存の挙動は変わらない
（逆引き索引が使われないだけ）。バックフィル未実行でも読み取りが索引を見ていないため影響が出ない。
