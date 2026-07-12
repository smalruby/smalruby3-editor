# autopilot — 状態遷移（ステートマシン）

> **🆕 Smalruby 独自** — autopilot の状態遷移とそのトリガーの正準ドキュメント。
> 「ある状態に入ると出口が無く固着する」事故を防ぐため、**全状態の出口**をここで定義し、
> `tools/autopilot/test/state-machine.test.js` が**固着（出口の無い状態）が無いこと**を機械的に担保する。
> 本ドキュメントとテストは対で維持する（状態・トリガーを増減したら両方を更新する）。

## 状態の構成要素

item の状態は次の 4 要素で決まる（Project が単一の真実）:

- **Status**（人間ボード列）: No Status(New Item) / Backlog / Sprint Backlog / In Progress / Blocked / Review / DoD / Close / Done / Icebox
- **AI Status**（AI の細フェーズ）: Triaging / Discussing / Understanding / Decomposing / EPIC Decomposed / Implementing / Creating PR / Self-Reviewing / Addressing Comments / Running DoD / **Awaiting Continuation**（協調的チェックポイント・EPIC #906） / （空）
- **🙋 HITL ラベル**: 人間の番か（Issue/PR の両面に投影）
- **🧭 tracking ラベル / Kind=EPIC**: トラッカー（作業 item ではない）

## トリガーの種類

| 種類 | 実体 |
|---|---|
| **A: autopilot フェーズ** | daemon が `phaseForItem` で決めて worker を dispatch（triage / discuss / decompose / implement / review / address-review） |
| **D: daemon tick ステップ** | merge-progression / closed-reconcile / **stalled 復帰（worker 不在の in-flight 再開・#995）** / stuck 検知 / DoD 引き継ぎ / EPIC tracking / PR 投影 |
| **H: 人間の操作** | Status 移動 / `🙋 HITL` ラベル解除 / **コメント・レビュー送信** / PR merge / Issue close |

> **stuck 検知は 🙋 HITL 付きの item を対象外にする（#915）**。decompose/triage の提案系フェーズ
> （#2/#6b）は Status/AI Status を動かさず HITL で承認待ちにする設計のため、run が無いのは正常
> （人間の番）であり stall ではない。誤って Blocked にしないよう `isStuckCandidate` が
> `item.hitlLabel` 付きを候補から除外する。解除後は #2/#6b の A トリガーが元フェーズへ
> 再ディスパッチする（それでも動かない場合のみ、通常の run-なし判定で #11 の stuck 検知に掛かる）。

> **stalled 復帰は stuck 検知の穴（#972）を埋める（#995）**。**実作業系 AI Status**（Understanding /
> Implementing / Creating PR / Self-Reviewing / Addressing Comments / Running DoD）は dispatch のみが
> 設定する in-flight マーカーで、`phaseForItem` は Self-Reviewing の happy-path を除き出口を持たない。
> worker が異常終了・daemon 再起動・**Blocked マーキングの一時失敗**（#972: address-review の
> tMax 失敗 → Blocked にする `gh` が SSO 失効で失敗 → Status=In Progress / 🙋 HITL のまま残留）で
> 消えると、stuck 検知は 🙋 を除外するため拾えず出口が無くなる。`selectStalledInFlightItems` は
> **worker 不在**（in-memory running ∪ `tmux list-sessions` に不在）を根拠に、HITL の有無を問わず
> 対応フェーズへ**毎 tick**再ディスパッチする（#953 の起動時孤児復帰を定常 tick へ拡張）。
> recovery は tick 冒頭で走り running に同期登録するので、selectActionable / stuck 検知と二重
> ディスパッチせず、Blocked より再開を優先する。毎 tick 走るため Self-Reviewing の happy-path も
> 対象に入るが、**空き容量（`cfg.concurrency - running`）の分だけ再開**し溢れは次 tick へ回すので
> 並行上限を跨がない。人間の判断待ち HITL（Triaging / Decomposing / Discussing / Awaiting
> Continuation / EPIC Decomposed）は実作業系 AI Status 集合に入らないため誤って再開されない。

### 人間ゲートの解除は 3 系統（固着防止の核心）

Review / DoD / Blocked / Discussing の「人間の番」は、次の **いずれか** で解除される:

1. **ラベル解除**: Issue / PR いずれかの `🙋 HITL` ラベルを外す（OR セマンティクス・#813）
2. **発言解除**: ゲート開放中に**人間が最後に発言**した（Issue コメント / PR コメント / レビュー送信。
   `humanSpokeLast`）。**ラベルを触らずコメントだけ出す操作でも固着しない**。
   bot が応答すると「bot が最後」になり、daemon の dispatch で watermark（`state.gateHandled`）が
   進むため、同じ発言で再発火・空回りしない。
3. **changesRequested 解除（構造化シグナル・#894）**: 未処理の新しい `CHANGES_REQUESTED` レビューが
   ある（`hasUnhandledChangesRequest`）。**approve 後に Request changes** すると、発言解除
   （`humanSpokeLast`）は bot の sticky 更新（`lastBotAt`）や approve 時の watermark に
   leapfrog され拾えないことがあった（🙋 ラベルを付けるだけで address-review が dispatch されず
   停止する行き止まり）。そこで changesRequested の submittedAt を**コメント時刻とは独立に**
   専用 watermark（`state.gateReviewHandled`）と比較し、より新しければ approve の有無に関わらず
   address-review へ倒す。一度 dispatch すれば watermark が進み同じレビューでは再発火せず、次に
   より新しい Request changes が来たら再度発火する。

## 状態遷移表

「出口」列が空の状態は存在してはならない（テストが担保）。

| # | 状態（Status / AI Status / HITL） | 意味 | 出口トリガー | 遷移先 |
|---|---|---|---|---|
| 1 | New Item / — / なし | 起票直後 | **A: triage** | Backlog（+提案で Discussing/HITL、質問で HITL） |
| 2 | In Progress / Triaging / **あり** | triage の質問・Icebox 提案待ち（Status は動かさない） | H: 解除 or コメント → **A: triage 再実行** / H: Status 移動 | 再トリアージ / 人間の決定 |
| 3 | New Item・Backlog / **Discussing** / あり | 方針提案への返信待ち | H: 解除 or **コメント** → **A: discuss** | #4 |
| 4 | New Item・Backlog / **Discussing** / なし(解除済み) | 人間が返信済み | **A: discuss** | 承認→ Sprint Backlog（implement へ直接ハンドオフ）/ 継続→ #3 / 見送り提案→ #3（Status は動かさない） |
| 5 | Backlog / —（Discussing 以外） / 任意 | やると決めた（キュー前） | H: Status → Sprint Backlog | #6/#7 |
| 6 | Sprint Backlog / — / なし（Kind=EPIC・tracking 無し） | 分解待ち EPIC | **A: decompose** | In Progress + Decomposing + HITL（#6b）/ 分解済みなら In Progress + EPIC Decomposed + 🧭 tracking |
| 6b | In Progress / **Decomposing** / **あり** | decompose の分解案提示・承認待ち（Status は動かさない） | H: 解除 or コメント → **A: decompose 再実行**（分解案コメントの有無で phase A/B を自動判定） | sub-issue 作成 → #16 / #6 |
| 7 | Sprint Backlog / — / なし（leaf） | 実装キュー | **A: implement**（`autopilot-after:` 未完了依存があれば待ち） | In Progress + Self-Reviewing → #9 |
| 8 | Sprint Backlog / — / **あり** | 人間が明示的に一時停止 | H: ラベル解除 | #7 |
| 9 | In Progress / Self-Reviewing / なし | implement 完了直後 | **A: review**（自動） | Review + HITL（#12） |
| 10 | In Progress / Implementing 等 / 任意（run あり） | worker 実行中 | run 完了（結果ファイル） | 結果の nextStatus へ |
| 11 | In Progress / 実作業系 AI Status / **任意**（run なし） | worker 消失（異常終了・daemon 再起動・Blocked マーキング失敗の残渣 #972） | **D: stalled 復帰**（毎 tick・worker 不在なら対応フェーズへ再 dispatch。🙋 HITL 残渣も含む・#995）。非 HITL でなお動かない深いケースは **D: stuck 検知**（35 分）| 対応フェーズへ再開（Implementing/Creating PR→implement, Self-Reviewing→review, Addressing Comments→address-review, Running DoD→verify, Understanding→understand）/ deeper fallback は Blocked + HITL（#14） |
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
| 22 | In Progress / **Awaiting Continuation** / **あり** | 協調的チェックポイント（EPIC #906）: soft-limit で worker が安全に中断し継続待ち | H: 解除 or **コメント** → **A: 元フェーズへ再 dispatch**（continuation ファイルの marker から復元。不明なら implement） | #10 の元フェーズへ戻る（実行中の run の扱いは #10 と同じ） |

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
- **I6（approve 後の Request changes・#894）**: approve 済みでも新しい `CHANGES_REQUESTED` レビューが
  来たら、bot sticky が `lastBotAt` を更新して発言解除を潰しても **address-review が dispatch される**
  （構造化シグナル `hasUnhandledChangesRequest`）。専用 watermark（`state.gateReviewHandled`）で同じ
  レビューでは再発火せず、より新しい changesRequested で再度発火する。approve 単独では発火しない。

## 状態・トリガーを変更するときのチェックリスト

1. `phases.js` の純粋関数（`phaseForItem` / `isGateReleased` / select 系）を変更する
2. 本ドキュメントの遷移表を更新する
3. `test/state-machine.test.js` の期待値（HUMAN_DRIVEN whitelist / gate 集合）を更新する
4. 網羅テストが「出口の無い状態」を検出しないことを確認する（`node --test`）

---

## License

This document is part of the Smalruby autopilot and is licensed under the **MIT License**
(not the repository's AGPL-3.0). See `tools/autopilot/LICENSE`.
