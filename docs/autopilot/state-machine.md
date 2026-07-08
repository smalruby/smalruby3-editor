# autopilot — 状態遷移（ステートマシン）

> **🆕 Smalruby 独自** — autopilot の状態遷移とそのトリガーの正準ドキュメント。
> 「ある状態に入ると出口が無く固着する」事故を防ぐため、**全状態の出口**をここで定義し、
> `tools/autopilot/test/state-machine.test.js` が**固着（出口の無い状態）が無いこと**を機械的に担保する。
> 本ドキュメントとテストは対で維持する（状態・トリガーを増減したら両方を更新する）。

## 状態の構成要素

item の状態は次の 4 要素で決まる（Project が単一の真実）:

- **Status**（人間ボード列）: No Status(New Item) / Backlog / Sprint Backlog / In Progress / Blocked / Review / DoD / Close / Done / Icebox
- **AI Status**（AI の細フェーズ）: Triaging / Discussing / Understanding / Decomposing / EPIC Decomposed / Implementing / Creating PR / Self-Reviewing / Addressing Comments / Running DoD / （空）
- **🙋 HITL ラベル**: 人間の番か（Issue/PR の両面に投影）
- **🧭 tracking ラベル / Kind=EPIC**: トラッカー（作業 item ではない）

## トリガーの種類

| 種類 | 実体 |
|---|---|
| **A: autopilot フェーズ** | daemon が `phaseForItem` で決めて worker を dispatch（triage / discuss / decompose / implement / review / address-review） |
| **D: daemon tick ステップ** | merge-progression / closed-reconcile / stuck 検知 / DoD 引き継ぎ / EPIC tracking / PR 投影 |
| **H: 人間の操作** | Status 移動 / `🙋 HITL` ラベル解除 / **コメント・レビュー送信** / PR merge / Issue close |

### 人間ゲートの解除は 2 系統（固着防止の核心）

Review / DoD / Blocked / Discussing の「人間の番」は、次の **どちらでも** 解除される:

1. **ラベル解除**: Issue / PR いずれかの `🙋 HITL` ラベルを外す（OR セマンティクス・#813）
2. **発言解除**: ゲート開放中に**人間が最後に発言**した（Issue コメント / PR コメント / レビュー送信。
   `humanSpokeLast`）。**ラベルを触らずコメントだけ出す操作でも固着しない**。
   bot が応答すると「bot が最後」になり、daemon の dispatch で watermark（`state.gateHandled`）が
   進むため、同じ発言で再発火・空回りしない。

## 状態遷移表

「出口」列が空の状態は存在してはならない（テストが担保）。

| # | 状態（Status / AI Status / HITL） | 意味 | 出口トリガー | 遷移先 |
|---|---|---|---|---|
| 1 | New Item / — / なし | 起票直後 | **A: triage** | Backlog（+提案で Discussing/HITL、質問で HITL） |
| 2 | New Item / Triaging ほか / **あり** | triage の質問・Icebox 提案待ち | H: 解除 or コメント → **A: triage 再実行** / H: Status 移動 | 再トリアージ / 人間の決定 |
| 3 | New Item・Backlog / **Discussing** / あり | 方針提案への返信待ち | H: 解除 or **コメント** → **A: discuss** | #4 |
| 4 | New Item・Backlog / **Discussing** / なし(解除済み) | 人間が返信済み | **A: discuss** | 承認→ Sprint Backlog（implement へ直接ハンドオフ）/ 継続→ #3 / 見送り提案→ #3（Status は動かさない） |
| 5 | Backlog / —（Discussing 以外） / 任意 | やると決めた（キュー前） | H: Status → Sprint Backlog | #6/#7 |
| 6 | Sprint Backlog / — / なし（Kind=EPIC・tracking 無し） | 分解待ち EPIC | **A: decompose** | In Progress + EPIC Decomposed + 🧭 tracking |
| 7 | Sprint Backlog / — / なし（leaf） | 実装キュー | **A: implement**（`autopilot-after:` 未完了依存があれば待ち） | In Progress + Self-Reviewing → #9 |
| 8 | Sprint Backlog / — / **あり** | 人間が明示的に一時停止 | H: ラベル解除 | #7 |
| 9 | In Progress / Self-Reviewing / なし | implement 完了直後 | **A: review**（自動） | Review + HITL（#12） |
| 10 | In Progress / Implementing 等 / 任意（run あり） | worker 実行中 | run 完了（結果ファイル） | 結果の nextStatus へ |
| 11 | In Progress / Implementing 等 / 任意（run なし） | run 消失（daemon 再起動等） | **D: stuck 検知**（35 分） | Blocked + HITL + 説明コメント（#14） |
| 12 | Review・DoD / 任意 / **あり** | 人間レビュー / headful 検証待ち | H: merge → **D: merge-progression** / H: 解除 or **コメント・レビュー送信** → **A: address-review** | Close / #13 |
| 13 | Review・DoD / 任意 / なし(解除済み) | 差し戻し済み | **A: address-review** | 対応後 Review + HITL（#12）/ LGTM は変更なし（watermark で空回りしない） |
| 14 | Blocked / 任意 / **あり** | run 失敗・stall の人間対処待ち | H: 解除 or **コメント** → **A: address-review（PR あり）/ triage（PR なし）** / H: Status 移動 | 再開・再ルート |
| 15 | Blocked / 任意 / なし | ラベルだけ外された Blocked | **A: address-review / triage**（#14 と同じ） | 再開・再ルート |
| 16 | In Progress / EPIC Decomposed / —（トラッカー） | 子の実装を追跡 | H: 子完了後に close（統合 PR の `Closes #epic` 等）→ **D: closed-reconcile** / H: Done へ移動（HITL 運用） | Close / Done |
| 17 | 任意の非終端（leaf, PR あり） | — | H: PR merge → **D: merge-progression** | Close（GitHub issue も close） |
| 18 | 任意の非終端 | — | H: Issue close → **D: closed-reconcile** | Close |
| 19 | In Progress / —（AI Status 空） / 任意 | 人間が手動で置いた作業中 | H: Status 移動（autopilot は所有しない） | 人間の決定 |
| 20 | Icebox / Close / Done | 終端・保留 | H: Status 移動（再開は人間のみ） | — |
| 21 | 🧭 tracking ラベル付き（全状態） | トラッカー | #16〜#18 のみ（フェーズ対象外） | — |

## 不変条件（テストで担保）

`tools/autopilot/test/state-machine.test.js` が Status × AI Status × HITL × Kind ×
解除シグナルの全組み合わせを列挙して検証する:

- **I1（出口保証）**: すべての非終端状態に、A / D / H いずれかの出口トリガーが定義されている。
  「どのトリガーでも遷移できない状態」はテスト失敗になる。
- **I2（コメント解除）**: autopilot が item を置く人間ゲート（Review / DoD / Blocked / Discussing）は、
  ラベル解除だけでなく**人間の発言（humanSpokeLast）でも必ず解除**される。
  「sticky コメントを bot が書き、人間がコメントで返したのにラベルを触らなかったため固着」する
  ケースの再発防止。
- **I3（解除後の遷移先保証）**: ゲート解除後の `phaseForItem` は必ず非 null（解除したのに何も
  起きない、を許さない）。Blocked も PR の有無に応じて address-review / triage に必ず落ちる。
- **I4（提案で退避系へ動かさない）**: hitl 提案（signal=hitl）で Status を Icebox / Close へ
  動かさない（プロンプト規約）。提案段階で退避系へ動かすと、人間がラベルだけ外したときに
  出口の無い状態に落ちるため。Icebox への遷移は人間の確定操作のみ。
- **I5（再発火防止）**: 発言解除は「bot の最終発言・処理済み watermark より後の人間の発言」に
  のみ反応する。bot が応答しない分類（LGTM 等）でも watermark（dispatch 時に更新）により
  同じ発言で毎 tick 再 dispatch されない。

## 状態・トリガーを変更するときのチェックリスト

1. `phases.js` の純粋関数（`phaseForItem` / `isGateReleased` / select 系）を変更する
2. 本ドキュメントの遷移表を更新する
3. `test/state-machine.test.js` の期待値（HUMAN_DRIVEN whitelist / gate 集合）を更新する
4. 網羅テストが「出口の無い状態」を検出しないことを確認する（`node --test`）

---

## License

This document is part of the Smalruby autopilot and is licensed under the **MIT License**
(not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
