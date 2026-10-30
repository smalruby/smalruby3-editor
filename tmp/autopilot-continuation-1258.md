<!-- autopilot-continuation issue=1258 phase=implement iteration=2 -->

## 完了済み

- 決まりの純粋関数 `packages/scratch-gui/src/lib/mesh-v2-seat-connect.js` と unit テスト
  `test/unit/lib/mesh-v2-seat-connect.test.js`（37 件。シナリオ表の全行）。
  group の入力形は `{id, seatInfo, memberSeats}`。
- VM `index.js`:
  - `setSeatGroupSeats(seats)` → `makeHostGroupName()` が `<hostNodeId>|seats=3,7,12|host=3` を作る。
  - `listSeatGroups()`（iteration 2）: 期限内のグループを `{...peripheral, id, seatInfo, memberSeats}` で返す。
    `seatInfo` があるグループだけ `listNodesInGroup` で番号を集め、ホスト番号は常に含める。
    `discoveredGroups` も更新するので `vm.connectPeripheral('meshV2', groupId)` でそのまま入れる。
  - `getConnectedGroupId()`。tap テスト（`extension_mesh_v2_classroom_seat.js`）計 38 件 pass。
  - 解散して入り直すときは `vm.disconnectPeripheral('meshV2')`（ホストなら dissolve される）→
    `connectPeripheral` で良い。
- GUI 画面 2 の表示部品 `components/connection-modal/mesh-v2-seat-pick-step.jsx` +
  `mesh-v2-seat-connect.css`（本文背景白・最大 510px・8 列グリッド・使用中を押すと入るか確認・
  上限/全員を選ぶ・要約）。props: `picker`(=seatPickerState の結果) / `chosenSeats` / `hostSeat` /
  `onToggle` / `onSelectAll` / `onJoinGroup(groupId)` / `onNext`。**まだモーダルに繋いでいない**。
  文言キー `gui.connection.meshV2Seat.*` を en / ja / ja-Hira の 3 ファイルに追加済み。.prettierignore 追加済み。

## 残タスク

1. GUI 配線（`containers/connection-modal.jsx` と `components/connection-modal/connection-modal.jsx`）:
   - PHASES に `meshV2SeatPick` / `meshV2SeatWait` を追加（Smalruby マーカー内）。
   - 画面 1: `mesh-v2-initial-step.jsx` に `meshV2Seat.seat` があるときだけ先頭に横幅いっぱいの
     「出席番号でつながる」（参加中のクラス名・自分の番号）。制限なし + `findTeacherGroup` があれば
     ［先生のグループに入る］。
   - 画面 2 のコンテナ: 開くたびに `classroomAPI.lookupClassroom(joinCode)`（`studentCount` /
     `takenSeats` / `meshGroupLimit`）と `ext.listSeatGroups()` を取得し `seatPickerState` / `toggleSeat`。
     ホスト表示は `pickHostSeat`。
   - 画面 3（新規 `mesh-v2-seat-wait-step.jsx`）: 3 秒おきに `listSeatGroups` + lookup →
     `decideSeatAction`（create なら `ext.setSeatGroupSeats(seats)` → `connectPeripheral('meshV2_host')`、
     join なら `connectPeripheral(groupId)`。二重発火防止）。`describeSeatStatuses` を表示、
     `isEveryoneHere` で「そろいました」2 秒（`ALL_ARRIVED_CLOSE_MS`）後に閉じる、「待たずに始める」
     （`needsAloneConfirm` で確認）、ELSEWHERE に ⚠［外す / 選びなおす / このまま待つ］、非ホストは
     「ホストの N番さんを待っています」、ホスト中は `findGroupToMergeInto` → 解散して移動。
     **`handleConnected` は seatWait 中なら phase を connected に変えない**ようにする。
   - 画面 5: 接続済み画面にそろい具合の 1 行。
2. 画面 2/3 の jest テスト（component）。
3. `tools/playwright-verify/` に生徒 3 タブ（1 人欠席）の確認スクリプト。従来方式との混在確認。
4. 1300×600 スクリーンショット → `docs/mesh-v2/screenshots/`、`docs/mesh-v2/README.md` と
   `docs/classroom/` 更新、マーカー一覧（`docs/maintenance/smalruby-markers-gui.md`）更新、mesh デグレ確認。
5. Draft PR 作成（まだ push / PR していない）。

## 次の一手

`components/connection-modal/connection-modal.jsx` の PHASES に 2 つ追加し、
`containers/connection-modal.jsx` に画面 2 の state（lookup / groups / chosenSeats）とハンドラを足して
`MeshV2SeatPickStep` を表示するところから。

## 継続して安全か

はい。追加したのは純粋関数・VM の新メソッド・未接続の表示部品だけで、既存の接続経路の挙動は変えていない。
