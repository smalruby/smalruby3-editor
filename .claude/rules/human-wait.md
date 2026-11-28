# 人間待ち（🙋 HITL）を Claude のセッションでも守る

autopilot の Project（GitHub Projects #4）は、開いている Issue の状態の正です。autopilot の daemon と
Claude のセッション（人間と対話して作業するもの）の**どちらが作業しても、同じ人間待ちが保たれる**ように、
セッションも次の決まりに従う。状態の正準表は `docs/autopilot/state-machine.md`。

## 人間待ちの表し方

**`🙋 HITL` ラベルが付いている Issue は、人間の番**。人間が 🙋 を外すか Status を動かすまで、
daemon は手をつけない。セッションも同じで、**人間に言われるまで着手しない**。

| 種類 | Status / AI Status | 🙋 | 出口（人間の操作） |
|---|---|---|---|
| 分解済みの EPIC | In Progress / EPIC Decomposed（Kind=EPIC） | あり | 子が全部済んだら Issue を閉じる |
| まだ分解していない EPIC | Backlog（Kind=EPIC） | あり | Sprint Backlog へ動かす → 分解 |
| AI がいずれ進める Issue | Sprint Backlog（Kind=Issue） | あり | 🙋 を外す → autopilot が着手 |
| 人間がする作業 | Backlog（Kind=Issue） | あり | 人間が済ませて閉じる |
| ずっと先のもの | Icebox | なし | 人間が Status を戻す |

担当（assignee）は daemon の担当（`takaokouji`）にする。担当が違うと daemon は見ない。

## セッションで作業するとき

- 人間に「進めて」と言われて**セッションで**作業する Issue は、着手時に 🙋 を外し、
  Status を **In Progress・AI Status は空**にする（daemon は持ち主にならない・state-machine の #19）。
- セッションの作業が済んで、また人間の判断を待つときは、上の表の形に戻して 🙋 を付け直す
  （例: topic の draft PR の確認待ち、決定ページの回答待ち）。
- **autopilot に任せる**ときは、セッションでは作業せず、Status を Sprint Backlog にして 🙋 を外すだけにする。
- **人間の判断が要る Issue を作るとき**（案を選んでほしい・方針を決めてほしい）は、本文に案を書くだけにせず、
  **`bin/autopilot-ask <issue> <questions.json>` で質問を出す**。モニターは決まった形の質問のコメントしか読まないので、
  本文だけだと「答える」に出ず、ゴーサインの行になって、押すと答えないまま 🙋 が外れて実装が始まる。
  形と手順は `docs/autopilot/README.md` の「モニターで答える」（Bot のトークンが取れないときは書かずに止まる）。
- **新しく Issue を作ったら**、Project #4 に入れて上の表の形にする。Project に入れると
  **閉じた sub-issue が Status 無しで自動で入る**ことがある。Status 無しは autopilot では起票直後（triage の対象）
  なので、閉じたものは Close にそろえる。
- Project のフィールドを変える・🙋 を付け外しするのは、人間の代わりにセッションが行う操作として扱う
  （daemon の単一ライターの決まりは、daemon と worker の間の決まり。`.claude/rules/autopilot/state-and-labels.md`）。
- daemon を止めずに一度にたくさんの Issue を Project に入れない。入れる前に `POST /pause` で一時停止する。
