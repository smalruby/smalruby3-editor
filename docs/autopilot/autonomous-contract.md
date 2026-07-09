# autopilot — Autonomous Contract

> **🆕 Smalruby 独自** — autopilot（Claude による Issue ライフサイクル自律オーケストレーター）の
> 中核規約。upstream には存在しない。設計の出発点は Issue #760。

このドキュメントは、autopilot の各**フェーズ・プロンプト**（`autopilot-triage` / `autopilot-discuss` /
`autopilot-understand` / `autopilot-decompose` / `autopilot-implement` / `autopilot-review` /
`autopilot-address-review` / `autopilot-verify`）と、それらを tmux 上で駆動する
**Claude Runner** の間の**契約**を定める。

すべての `autopilot-*` プロンプトは本コントラクトに従う。プロンプトの冒頭は必ず
「**Follow the autopilot autonomous contract: `docs/autopilot/autonomous-contract.md`**」を宣言する。

> **これらは `tools/autopilot/prompts/<phase>.md` に置く Markdown プロンプトであり、Claude Code の
> Skill ではない**（`.claude/skills/` には置かない）。開発者が誤って `/autopilot-*` としてスラッシュ
> 起動すると期待どおり動かないため、Skill として登録しない。Runner は各プロンプトファイルを
> 対話 Claude に **Read させて手順に従わせる**（起動メッセージは `phases.js` の `phasePromptCommand`）。

---

## 1. 最重要不変条件: 対話的に人間へ質問しない

autopilot のプロンプトは、**人間が enter を押すのと同じ形で tmux 経由に起動された対話 Claude Code**
の中で動く。したがって次を**絶対**に守る:

- **`AskUserQuestion` を使わない。** いかなる対話的プロンプト・選択 UI も出さない。
- **カーソル入力待ちで停止しない。** 確認のために人間の応答を待つ動作をしない。
- **権限プロンプトを前提にしない。** worker は `--permission-mode auto`（classifier が自動許可/
  拒否）で動くので通常は確認が出ない。もしツールが拒否されたら、対話的に粘らず
  **`AUTOPILOT_ERROR` / `signal=hitl` で終了**する。万一プロンプトを出してしまっても、runner が
  検知して自動的に HITL へ落とす（人間に渡る）が、**自分からプロンプトを出さない**のが前提。

判断・確認・追加情報が必要になったら、**人間に聞くのではなく**:

1. 対象 Issue / PR に **bot 名義でコメント**を投稿し（`GH_TOKEN="$(bin/bot-token)" gh ...`）、
   何を判断してほしいかを具体的に書く。
2. **HITL シグナル**（`AUTOPILOT_HITL`）を出して**終了**する。

人間はそのコメントを読み、**`🙋 HITL` ラベルを外す**（=「Claude に差し戻す」）ことで、
autopilot が次に対応コメントを処理する（#813。Issue/PR どちらかのラベルを外すだけでよい）。

---

## 2. シグナルとペイロード（Runner との検出契約）

tmux pane のテキストは長い行が**折り返される**ため、JSON を pane から直接読むのは不安定。
そこで **「短い signal トークン（pane 用）」＋「ペイロードファイル」** の二段構成にする。

### 2.1 ペイロードファイル

Runner は環境変数 **`AUTOPILOT_RESULT_FILE`**（書き込み先の絶対パス）を渡す。
プロンプトは**終了直前に、まずこのファイルへ単一の JSON オブジェクトを書き込む**。

### 2.2 pane signal トークン（最後の出力・1 行・折り返さない短語）

ペイロードを書いた**後**に、結果に応じて次の**いずれか 1 つ**だけを単独行で出力する:

| トークン | 意味 |
|---|---|
| `AUTOPILOT_DONE` | フェーズが正常完了した |
| `AUTOPILOT_HITL` | 人間の対応待ち（コメント済み）。`🙋 HITL` ラベル付与へ |
| `AUTOPILOT_ERROR` | 回復不能なエラーで中断した |

Runner はこの短語を pane で検出してから `AUTOPILOT_RESULT_FILE` を読み、権威ある結果とする。

### 2.3 ペイロード JSON スキーマ

共通フィールド:

| key | 型 | 説明 |
|---|---|---|
| `issue` | number | 対象 Issue 番号 |
| `phase` | string | 実行したプロンプト（`triage`/`discuss`/`decompose`/`implement`/`review`/`address-review`/`verify`/`understand`） |
| `signal` | string | `done` / `hitl` / `error`（pane トークンと一致させる） |
| `summary` | string | 人間向け 1 行要約 |

`signal=done` のとき追加で:

| key | 型 | 説明 |
|---|---|---|
| `nextStatus` | string \| null | 提案する人間ボードの Status（例 `Backlog` / `In Progress` / `Review` / `DoD`） |
| `nextAiStatus` | string \| null | 提案する AI Status（例 `Implementing` / `Self-Reviewing`） |
| `hitl` | boolean | 完了後に人間の番になるか（true なら daemon が `🙋 HITL` ラベルを付与） |
| `size` | `"small"`\|`"middle"`\|`"large"`\| null | 判定した size（triage / decompose） |
| `kind` | `"EPIC"`\|`"Issue"`\| null | 判定した種別 |
| `createdSubIssues` | number[] | decompose で作成した sub-issue 番号 |
| `prUrl` | string \| null | implement で作成/更新した PR |

`signal=hitl` のとき追加で:

| key | 型 | 説明 |
|---|---|---|
| `reason` | string | 人間に何を判断してほしいか |
| `commentUrl` | string | 投稿したコメントの URL |
| `nextStatus` | string \| null | 提案する Status（任意。**Icebox / Close / Done は提案しない** — 提案段階で退避系へ動かすと出口の無い状態に固着する。`state-machine.md` 不変条件 I4） |
| `nextAiStatus` | string \| null | 提案する AI Status（任意。例: 実装前ディスカッションの `Discussing`） |

`signal=error` のとき追加で:

| key | 型 | 説明 |
|---|---|---|
| `error` | string | エラーメッセージ |
| `recoverable` | boolean | 再試行で回復しうるか |

### 2.4 例

```json
// AUTOPILOT_RESULT_FILE の内容（done）
{"issue":760,"phase":"triage","signal":"done","summary":"EPIC と判定。Backlog へ。",
 "nextStatus":"Backlog","nextAiStatus":null,"hitl":false,"size":null,"kind":"EPIC",
 "createdSubIssues":[],"prUrl":null}
```
```
AUTOPILOT_DONE
```

---

## 3. 状態の書き込み責務（単一ライター原則）

- **Project フィールド（Status / AI Status / Size / Kind ...）と HITL（`🙋 HITL` ラベル）の書き込みは
  daemon（または CLI）が行う。** プロンプトは**結果ファイルで「こうしてほしい」という意図を伝えるだけ**で、
  Project やラベルを直接書き換えない（二重ライターによる競合を避ける）。HITL は Project フィールドではなく
  `🙋 HITL` ラベルで一本化する（#813。理由: PR は Project フィールドを持てないため）。
- **GitHub の Issue / PR への副作用**（コメント投稿・PR 作成・sub-issue 作成・コミット）は
  **プロンプトが行う**。これらは Project 状態とは別物。
- daemon が落ちても **Issue / PR / Project が状態の正**。プロンプトは再実行されうる前提で冪等にする（次節）。

---

## 4. 冪等性・再入可能性

プロンプトはクラッシュ・再起動後に**同じ Issue に対して再実行されうる**。よって:

- 副作用を出す前に**現状を確認**する（既に同種コメントを出していないか、PR が既にあるか、
  sub-issue を既に作っていないか）。
- 重複投稿・重複 PR・重複 sub-issue を作らない。判定には GitHub 上の既存状態を使う。
- 途中再開時、Runner は**再投入プロンプトに強めの no-interview 注意**を前置する（課題2 対策）。
  プロンプトはこの前置きがある前提で、同じインタビューで再停止しないこと。

---

## 5. 認証・スコープ

- コミットは **`bin/bot-git`**（bot 名義を `-c` 注入。共有 `.git/config` は書き換えない）。
- push は **`bin/autopilot-push`** を使う。変更に Bot 権限外パス（`.github/workflows/**` 等）が
  含まれると個人クレデンシャルの push に自動で切り替わる（`route=personal`）。その場合
  PR 作成も plain `gh`（個人トークン）で行い、`👥 human-review-required` ラベルを付けて
  本人以外のレビューを必須にする。
- gh / GraphQL は **`GH_TOKEN="$(bin/bot-token)" gh ...`**（`bin/bot-token` は5分前自動リフレッシュ）。
- 作業は**割り当てられた worktree（cwd）の中だけ**で行う。
- 対象は**割り当てられた 1 つの Issue / PR のみ**。他の Issue を勝手に触らない。

---

## 6. Runner が渡す環境（プロンプトが参照してよい）

| 環境変数 | 内容 |
|---|---|
| `AUTOPILOT_ISSUE` | 対象 Issue 番号 |
| `AUTOPILOT_PHASE` | 実行フェーズ名 |
| `AUTOPILOT_RESULT_FILE` | 結果 JSON の書き込み先パス |
| （起動メッセージのプロンプトパス） | daemon 経由の run は**起動時スナップショット**の絶対パスのプロンプトを Read する（checkout のブランチ切り替えに非依存）。worker の model/effort/追加ディレクトリは `tools/autopilot/src/settings.js` 参照 |
| `AUTOPILOT_PROJECT` | Project 番号（参照のみ。書き込みは daemon） |
| `AUTOPILOT_REPO` | `smalruby/smalruby3-editor` |
| `AUTOPILOT_BASE_BRANCH` | PR 先・worktree 分岐元のベースブランチ（既定 `develop`）。Issue 本文の `autopilot-base:` ディレクティブや「ベースブランチ」宣言があれば daemon が渡す（EPIC サブ Issue を親 epic ブランチに積む用）。implement は `gh pr create --base` にこれを使う |

---

## 7. PR 側の状態可視化（Issue のみ Project 管理 + PR は投影）

Project は **Issue のみ**を管理する（PR を Project に入れると二重管理になるため入れない）。
PR を見ただけで連携 Issue の状態が分かるよう、**daemon が PR 側へ Issue の状態を投影**する。
いずれも Project が真実で、PR 側は読み取り用の投影（単一ライター原則を保つ）。

| 手段 | 意味 | 同期ルール |
|---|---|---|
| `🤖 autopilot` ラベル | autopilot 管理対象（AI 処理対象）の PR/Issue | 常時付与 |
| `🙋 HITL` ラベル | 人間の対応待ち（レビュー/判断/マージ）。**HITL の唯一の真実**（#813） | 人間に渡すとき Issue/PR の両面に付与、release で除去 |
| **Draft ⇄ Ready for review** | Draft=AI 作業中 / Ready=人間が見る段階 | **Status 基準**（#815）: `Review`/`DoD`/`Close`/`Blocked`→Ready、それ以外（`In Progress` 等）→Draft。HITL ラベルでは判定しない（解除しても Status が Review なら Ready を維持） |
| **sticky ステータスコメント** | bot が1つのコメントを編集し続け、連携 Issue の Project 状態（Status / AI Status / HITL / Size）を投影 | フェーズ遷移ごとに更新 |

- 専用の「作業中」ラベルは作らない（**Draft** が「AI 作業中・触らないで」を兼ねる）。
- プロンプトは PR を作るとき **Draft で作成**し、HITL に渡すフェーズ末で **Ready + `🙋 HITL`** を要求する
  （実際のラベル付与・Draft 切替・sticky 更新は daemon が結果ファイルの意図を見て行う）。

### HITL は `🙋 HITL` ラベルに一本化（#813）

HITL の状態は **`🙋 HITL` ラベル**で表現する（Project に HITL フィールドは設けない／daemon は
読まない・書かない）。理由は **PR が Project フィールドを持てない**こと。ラベルなら 1 系統で
Issue/PR の両面を賄え、成果物ページにも見える。ラベルは Issue と PR の両面に投影される。

- **set（人間に渡す）**: daemon が **Issue/PR の両面に一括で `🙋 HITL` ラベルを付与**して整合を保つ。
- **release（AI に戻す）**: 適用される signal の **いずれか1つでも除去**されたら autopilot は
  処理を進める（= `tools/autopilot/src/phases.js` の `isHitlReleased` の OR 判定。signal は
  Issue ラベル / PR ラベルの 2 面）。その後 daemon が残りの面のラベルも除去して正規化する。

→ 人間はレビュー中に**目の前の PR の `🙋 HITL` ラベルを外すだけ**で autopilot に差し戻せる。
PR の無い段階（triage/decompose 等）では PR ラベルは非適用（Issue ラベルのみで判定）。

### worker は headless Playwright で一般 UI 確認まで完結できる（#891）

worker（verify / review フェーズ）は **`playwright` パッケージの bundled chromium を headless で**
起動し、**一般的な UI 確認は自分で完結できる**（Issue #891 で実証: worktree からも symlink 経由で
解決、ブラウザキャッシュは `~/.cache/ms-playwright`）。dev server の要否は **UI 種別で判断**する:

- **自己完結ページ（autopilot monitor 等）**: dev server 不要。daemon の `http://localhost:8787/` を
  開くか、`MONITOR_HTML` 等を静的 serve して確認（ヘルパー `tools/autopilot/bin/pw-check`）。
- **scratch-gui の UI**: dev server（`localhost:8601`）が必要。起動は重いので **プレビュー URL があれば優先**、
  無ければ dev server を起動して待機してから確認。
- **音 / autoplay 依存**: headless chromium では信用できない（`e2e-test.md` の既知事項）→ 実 Chrome が
  要るため **ホスト/人間へ引き継ぐ**（下記 `applyDodHandoffs` の headful 引き継ぎ）。

**Playwright MCP は使わない**（host Chrome 依存でコンテナ内では失敗）。必ず `playwright` パッケージ headless。

### DoD の headful 引き継ぎは音/autoplay 等の限定ケースに縮小（#821 → #891）

DoD の最終確認のうち **音/autoplay など実 Chrome が必須のケースのみ**、daemon が headful 引き継ぎを生成する
（**廃止ではなく対象の明確化**）。一般 UI の DoD は verify フェーズが headless で自己完結する。
限定ケースでは **プロンプト run ではなく daemon の tick ステップ**（`applyDodHandoffs`）として扱い、
`Status=DoD` の leaf に対し daemon が「プレビュー URL ＋ Issue の DoD チェックリスト ＋ 定型 headful 手順
＋ 報告の出口」を **テンプレート生成**して `autopilot:dod-handoff` マーカー付きコメントを PR に投稿する
（child Claude を起動せず、純粋な I/O + 文字列テンプレートで完結。冪等）。これを**ホスト側の Claude
（headful Playwright / 実 Chrome）**が実施し、結果を PR にコメントする。

- **OK** → 人間が merge → merge-progression が leaf を Close。
- **NG** → ホスト/人間が PR にコメントし `🙋 HITL` を外す → **DoD 解除 → `address-review`**（Review と対称。
  `phaseForItem` の DoD 解除パス。OR セマンティクスも同じ）。

`autopilot-verify` プロンプトは headless Playwright で一般 UI の DoD を確認する（#891）。詳細は
[`README.md`](./README.md) の「DoD — headless 確認と headful 引き継ぎ」。

---

## 8. プロンプト実装のチェックリスト

- [ ] 冒頭で本コントラクトに従うと宣言している
- [ ] `AskUserQuestion` を一切使っていない
- [ ] 判断が要るときは bot コメント + `AUTOPILOT_HITL` で終了している
- [ ] 終了直前に `AUTOPILOT_RESULT_FILE` へ JSON を書き、pane に signal トークンを出している
- [ ] Project フィールドを直接書き換えていない（意図は結果ファイルで伝える）
- [ ] 冪等（再実行で重複副作用を出さない）
- [ ] bot 認証（`bin/bot-git` / `bin/bot-token`）を使っている

---

## ライセンス

autopilot のツール群（`tools/autopilot/**`）と autopilot プロンプト（`tools/autopilot/prompts/autopilot-*/**`）は、
リポジトリ全体の AGPL-3.0 ではなく **MIT ライセンス**とする。詳細は `tools/autopilot/LICENSE` を参照。
