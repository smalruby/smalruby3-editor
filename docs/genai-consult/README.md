# 生成AI への相談

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能
> ブロックで作品を作っている生徒が、学校で使っている生成AI（Gemini / ChatGPT など）に相談するのを手伝う。

## 概要

スクリプトエリアの左下（ブロックパレットの右）に **ルビティーの顔** が出る。生徒は顔を押して
（または手が止まったときの声かけから）次の順に進む。

1. **困りごと** — 5 種類から選び、自分のことばで書く（必須。書き出しの例のままでは進めない）
2. **コピーして相談** — 作品全体のブロックを Ruby にした質問文ができる（見せて書き足せる）。
   ［コピーして生成AI を開く］でクリップボードにコピーし、クラスで決めた生成AI を別タブで開く。
   生成AI を開くのは最初の 1 回だけで、2 回目からはコピーだけして「生成AI のタブにもどって貼りつけてね」と出す
   （タブを閉じてしまったときのために［生成AI をもう一度開く］も出す）。Gemini や ChatGPT は
   Cross-Origin-Opener-Policy でスモウルビーのタブから切り離されるので、開いたタブを名前で探したり
   前に出したりできないため。タブは `noopener` で開き、開いた先からスモウルビーのタブを操作させない。
   長すぎて貼れないときは 2〜4 つに分けてコピーできる。
3. **貼りもどす** — 生成AI の答えを貼りもどしてブロックにする（段階 4 以降。まだプロトタイプのまま
   日本語のみ。次の sub-issue で本実装にする）

![声かけ](screenshots/0101-nudge.png)
![困りごと](screenshots/0102-trouble.png)
![分けてコピー（1300×600）](screenshots/0103-copy-split.png)

スモウルビーは生成AI と直接は通信しない。生徒が自分でコピー・貼りつけをする（学校が契約・許可して
いる生成AI を、学校のアカウントのまま使うため）。

## 表示条件

| 条件 | 顔 |
|------|----|
| 生徒としてクラス（課題）に参加していて、そのクラスで先生が生成AI を「使う」にしている | 出る |
| 参加しているクラスで生成AI を使わない / クラスに参加していない / 先生 | 出ない |
| `?features=genai`（開発用） | クラスの外でも出る |

クラスの設定（`genai.enabled` / `service` / `url`）は、参加（`/classrooms/join`）とセッション確認
（`/classrooms/verify-session`、クラスのモーダルを開いたとき）の応答で受け取り、Redux
（`state.scratchGui.classroom.studentGenai`）に入れる。セッションと一緒に localStorage に残すので
再読み込みしても顔は出たまま。別のクラスに移る・退室すると消える。https 以外の URL は「使わない」と
同じ扱いにする。先生側の設定画面は `docs/classroom/ui-ux.md` の「生成AI・ルビティー（クラス単位）」。

### 生成AI の種類と URL

**クラスの設定が決める**。生徒は変えられない（「相談先: Gemini」のように名前だけ出す。ほかの
生成AI は URL のホスト名を出す）。

プロトタイプにあった「1 回だけ聞いてブラウザに覚える」画面は、**`?features=genai` でクラスの外に
いるときだけ**残している（開発・試用用）。クラスに参加していれば出ない（クラスで生成AI を使わない
なら顔そのものが出ないため、保険として残す必要がない）。

## 声かけ

- 操作（クリック・キー・ホイール・作品の変更）が **2 分 30 秒** 無いと「手が止まっているみたい。
  生成AI に相談してみる？」を出す。
- 1 回出したら **10 分** あける。
- **出さないとき**: エラーの通知（警告のお知らせ）が出ている間、プログラムが動いている間
  （動かして見ている・止めた直後は数え直す）、タブが裏にあるとき、パネルを開いているとき。
- ［今日は出さない］は **その日だけ**（ローカルの日付で記録し、翌日にはまた出る）。

## 質問文

文面は `src/lib/genai-prompt.js`（純粋関数）。生徒が Ruby を知らなくても使えるように、生成AI に
次を頼んでいる: 質問を返さずすぐ直したプログラムを出す / 変えるスプライトごとに `# 「名前」` の
1 行から全部書く / 使える命令の例だけを使う / 音・コスチュームは一覧の名前から選ぶ /
「▼▼」〜「▲▲」の行でコードを囲む。質問文はエディタの言語にかかわらず日本語（困りごとの種類も
日本語の名前で入る）。

## 設定・データ永続化

| キー | 場所 | 内容 |
|------|------|------|
| `smalruby:classroom` の `studentGenai` | localStorage | クラスの生成AI 設定（`{enabled, service, url}`） |
| `smalruby:genaiNudgeOff` | localStorage | ［今日は出さない］を押した日付（`YYYY-MM-DD`）。プロトタイプの `'true'` は無効扱い |
| `smalruby:genaiService` | localStorage | 開発用（`?features=genai` でクラス外）に選んだ生成AI |
| `?features=genai` | URL | クラスの外でも顔を出す（開発用） |
| `?genai_idle=<秒>` | URL | 声かけまでの秒数を短くする（テスト用。あける時間も秒数の 4 倍までに縮む） |

## 主要ファイル

| ファイル | 役割 |
|---------|------|
| `packages/scratch-gui/src/containers/genai-concierge.jsx` | 顔・パネル・声かけ・コピーと生成AI のタブ（表示条件は Redux から） |
| `packages/scratch-gui/src/components/genai-concierge/genai-nudge.jsx` | 声かけの吹き出し |
| `packages/scratch-gui/src/components/genai-concierge/genai-trouble-step.jsx` | 段階 1: 困りごと |
| `packages/scratch-gui/src/components/genai-concierge/genai-copy-step.jsx` | 段階 2: 質問文のコピー・分割（開発用の生成AI 選択を含む） |
| `packages/scratch-gui/src/components/genai-concierge/genai-answer-steps.jsx` | 段階 3 以降: 貼りもどし・切りかえ（プロトタイプ） |
| `packages/scratch-gui/src/components/genai-concierge/messages.js` | 文言（`gui.genaiConcierge.*`） |
| `packages/scratch-gui/src/lib/genai-concierge-state.js` | 表示条件・相談先・声かけの判定（純粋関数） |
| `packages/scratch-gui/src/lib/genai-prompt.js` | 質問文の組み立て・分割・答えからの Ruby 取り出し（純粋関数） |
| `packages/scratch-gui/src/lib/genai-repair.js` | 生成AI の Ruby の自動修正・スプライトごとの分割 |
| `packages/scratch-gui/src/reducers/classroom.js` | `studentGenai` と `setStudentGenai` |

## data-testid

| data-testid | 要素 | 説明 |
|------------|------|------|
| `genai-face` | button | ルビティーの顔（押すとパネルを開く/閉じる） |
| `genai-nudge` | div | 声かけの吹き出し |
| `genai-nudge-open` / `genai-nudge-later` / `genai-nudge-off` | button | 相談する / あとで / 今日は出さない |
| `genai-panel` | div | パネル全体 |
| `genai-drag-handle` | div | パネルのヘッダー（ドラッグで動かせる） |
| `genai-close` | button | 閉じる（×） |
| `genai-kind-<id>` | button | 困りごとの種類（`not-working` / `error` / `next` / `how` / `more-fun`） |
| `genai-trouble-text` | textarea | 困りごとを自分のことばで書く欄 |
| `genai-make-prompt` | button | 相談文をつくる |
| `genai-service-name` | p | 相談先の名前 |
| `genai-service-gemini` / `genai-service-chatgpt` / `genai-service-url` / `genai-service-change` | button / input / a | 開発用（`?features=genai` でクラス外）の生成AI 選択 |
| `genai-prompt` | textarea | 質問文（書き足せる） |
| `genai-copy-open` | button | コピーして生成AI を開く（開いたあとは「コピーする」） |
| `genai-reopen` | a | 生成AI をもう一度開く（開いたあとだけ） |
| `genai-split` | a | 「生成AI に貼れなかった・長すぎると言われた」（分けてコピーする） |
| `genai-copy-part-<n>` | button | 分けた n つ目をコピー |
| `genai-notice` | p | コピーした / できなかったのお知らせ |
| `genai-to-paste` | button | 答えをもらったら次へ |
| `genai-answer` / `genai-convert` / `genai-checking` / `genai-convert-ok` / `genai-convert-ng` / `genai-fixes` / `genai-raw-count` / `genai-reflection` / `genai-apply` / `genai-self` / `genai-copy-rewrite` | — | 段階 3 以降（貼りもどし。プロトタイプ） |
| `genai-switch-before` / `genai-switch-after` / `genai-switch-state` / `genai-again` / `genai-finish` | — | 入れたあとの切りかえ（プロトタイプ） |

## 画面の大きさ

授業 PC の 1300×600 で、顔とパネルはスクリプトエリアの中（ブロックパレットの右・左下）に収まり、
スクリプトエリアの下のバックパックの帯とは重ならない。パネルが邪魔なときはヘッダーをドラッグして
動かせる。
