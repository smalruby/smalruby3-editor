<!-- autopilot-continuation issue=1258 phase=implement iteration=1 -->

## 完了済み

- 決まりの純粋関数 `packages/scratch-gui/src/lib/mesh-v2-seat-connect.js` と unit テスト
  `test/unit/lib/mesh-v2-seat-connect.test.js`（37 件。シナリオ表の全行: 同じ組・混在・すれ違い・欠席・
  ホスト交代 20 秒・遅れたホスト・同時作成・上限 6 / 制限なし・先生のグループ）。
  - `decideSeatAction` → create / join / wait、`findGroupToMergeInto`（2 つできたときの解散→移動）、
    `describeSeatStatuses` / `isEveryoneHere` / `needsAloneConfirm`、`seatPickerState` / `toggleSeat`、
    `findTeacherGroup`、`normalizeGroupLimit`（`meshGroupLimit` 無し = 0 = 制限なし）。
  - group の入力形は `{id, seatInfo, memberSeats}`（memberSeats = `listNodesInGroup` のノード ID を
    `parseNodeSeat` した番号。ホストも含む）。
- VM: `index.js` に `setSeatGroupSeats(seats)` を追加。`makeHostGroupName()` が
  `<hostNodeId>|seats=3,7,12|host=3` を作る（先生は従来どおり `host=teacher`）。tap テスト 3 件追加。

## 残タスク

1. VM: 一覧（scan の結果）に各グループの `memberSeats` を載せる（`meshService.listNodesInGroup` +
   `parseNodeSeat`）か、GUI から照会できる口を足す。ホストでなくなったときの `dissolve` → 再参加の口。
2. GUI 接続モーダル（`components/connection-modal/mesh-v2-initial-step.jsx` ほか）:
   - 画面 1: クラス参加中だけ「出席番号でつながる」を先頭に横幅いっぱい。参加中のクラス・自分の番号。
     制限なし + 先生のグループがあれば［先生のグループに入る］。
   - 画面 2: 8 列グリッド（`seatPickerState`）。開くたびに `POST /classrooms/lookup` の
     `studentCount` / `takenSeats` / `meshGroupLimit` を照会。使用中を押すとそのグループに入るか確認。
     「全員を選ぶ」、選んだ人とホストの要約。
   - 画面 3: 数秒おきに一覧を読み `decideSeatAction` / `describeSeatStatuses` を表示。そろったら 2 秒で
     自動で閉じる、「待たずに始める」、全員欠席なら 1 人で始めるか確認、⚠［外す / 選びなおす / このまま待つ］、
     非ホストは「ホストの 3番さんを待っています」。ホスト中は `findGroupToMergeInto` を監視。
   - 画面 5: 接続済み画面にそろい具合の 1 行。
   - data-testid、モーダル本文の背景色、600px 以内。
3. 文言キーを `en.js` / `ja.js` / `ja-Hira.js` の 3 ファイルに追加。
4. `tools/playwright-verify/` に生徒 3 タブ（1 人欠席）の確認スクリプト。従来方式との混在確認。
5. 1300×600 スクリーンショットを `docs/mesh-v2/screenshots/` へ、`docs/mesh-v2/README.md` と
   `docs/classroom/` を更新。mesh デグレ確認手順（`.claude/rules/scratch-gui/mesh.md`）。

## 次の一手

`packages/scratch-gui/src/components/connection-modal/mesh-v2-initial-step.jsx` と
`containers/connection-modal.jsx` を読み、クラス参加情報（`mesh-v2-classroom-binding.jsx` の
`computeBoundSeat`）と lookup API の呼び出し箇所を確認して、画面 1→2 のステップ追加から始める。
UI 全体は大きいので、必要なら人間に「UI を別 sub-issue に分けるか」を相談してよい。

## 継続して安全か

はい。コミット済みの変更は純粋関数と VM の口の追加だけで、既存の接続経路の挙動は変えていない
（`setSeatGroupSeats` を呼ばない限り名前は従来どおり `host=` だけ）。
