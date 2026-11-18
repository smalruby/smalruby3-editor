# チュートリアル

> **🔧 upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> **改良点**: カードのチュートリアルの中身と部品は **upstream（v13.7.2）のまま**。Smalruby が変えたのは、① 入口を「?」メニューに移したこと、② 前にあった Smalruby のチュートリアルへのリンク（`?tutorial=`）を GA で数えること、③ 画像を開いたときだけ読むこと。別に **classroom-tutorial**（クラスルーム機能のチュートリアル）がある。
>
> **学ぶ入口はレッスン**（[`docs/lessons/`](../lessons/)）。Smalruby 独自のチュートリアル（チャット・Ruby のきほん・ブロックの本の試食など）はレッスンに置きかえて消した。

## 概要

新しいユーザーや特定の機能を初めて使うユーザー向けの**チュートリアル**機能。upstream Scratch の「カード」形式のチュートリアル (`cards`) と一覧 (`tips-library`) を**そのまま**使う（上流の追従を楽にするため）。スモウルビーの学び方はレッスン（[`docs/lessons/`](../lessons/)）で、チュートリアルは「?」メニューの奥に置く。ほかに Smalruby 独自のオンボーディング（クラスルーム）がある。

## ユーザーストーリー

- **初めて Smalruby を開いた小学生**として、簡単な作品例の作り方を順を追って教えてほしい
- **Ruby タブを初めて開いた子**として、ブロックとの違いやどう使うかを画面上で学びたい
- **Smalruby Classroom を初めて使う先生・生徒**として、操作方法をその場でガイドしてほしい
- **Scratch に慣れた人**として、Scratch と同じチュートリアルを「?」メニューから開きたい

## UI / 操作フロー

### カードチュートリアル (upstream 由来)

メニューバー右上の「?」メニューの **「チュートリアル」** から `tips-library` を開き、チュートリアルを選ぶ（メニューバーに直接のボタンは置かない。ふだんは目に入らないようにするため。「?」メニューの構成は [`docs/menu-bar/`](../menu-bar/) を参照）：

![チュートリアル一覧](screenshots/0201-tips-library-1280x800.png)

URL パラメータ `?tutorial=<urlId>`（例: `?tutorial=getStarted`）で直接チュートリアルを開く経路は「?」メニューとは独立に動く（`src/lib/tutorial-from-url.js`。`?tutorial=all` は一覧を開く）。

![チュートリアルを選ぶ（上）](screenshots/0101-tutorials-modal.png)

1. 全画面のチュートリアルカードが表示される
2. 「次へ」「前へ」で進む
3. 完了で閉じる

上流（Scratch v13.7.2）のチュートリアルがそのまま並ぶ（スモウルビー独自のチュートリアルは無い。学習の入口は [`docs/lessons/`](../lessons/) のレッスン）。

ただし、**スタータープロジェクト付きのチュートリアル 2 つは一覧に出さない**:「アニメ映画をコーディングしよう」（`code-cartoon`）と「アドベンチャーゲーム」（`cartoon-network`。`urlId` は `animate-an-adventure-game`）。この 2 つは `requiredProjectId` を持ち、一覧で選ぶと新しいタブで `/projects/<id>/editor?tutorial=<urlId>` を開く（scratch.mit.edu の作品ページの形）。smalruby.app にはこのパスが無く、開いても AccessDenied（または 404）になるため。隠し方は upstream にある `hideTutorialProjects`（Scratch Desktop 向けに同じ 2 つを隠すための prop）を `src/playground/render-gui.jsx` から渡すだけで、`tips-library.jsx` は upstream のまま。

ほかの入口ではこの 2 つを消していない（upstream と同じ）。どちらも **カードだけを開き、作品は読み込まない**（上の新しいタブは開かないので AccessDenied にはならない）:

- `?tutorial=code-cartoon` / `?tutorial=animate-an-adventure-game` で開いたとき
- ほかのチュートリアルの最後のカードの「次のチュートリアル」に `code-cartoon` が出るとき（「キャラクターを動かそう」「効果の追加方法」のあと）

カードの説明はスタータープロジェクトがある前提なので、手元の作品とは合わない。

前にスモウルビーにあったチュートリアルの `?tutorial=<urlId>`（`chat1Basic1` など）はもう開かない。こうしたリンクが使われているかを数えるため、見つからない `urlId` で開かれたら GA に送る（下の「GA の計測」）。

### Ruby タブオンボーディング (Smalruby 独自)

はじめての人向けの吹き出し（メニューバーの「チュートリアル」ボタン横の「ルビーを試してみよう!」）は廃止した。レッスンの入口は `docs/lessons/` のメニューの「レッスン」で、吹き出しでは誘わない。`tutorial-onboarding` reducer（`MARK_RUBY_TAB_USED` など）は Ruby タブ訪問の記録のために残っている。

### classroom-tutorial (Smalruby 独自)

Smalruby Classroom の各フェーズ（教師ログイン、クラス作成、生徒参加など）でツールチップ風の解説を表示。

画面の真ん中に出すカード + OK で、指す場所のそばに出す吹き出しとは形が違うので、共通の吹き出し部品
（`components/balloon/`。`docs/lessons/README.md` の「吹き出しの共通の土台」）の `Balloon` は使わない。
見た目をそろえるため、`balloon-tokens.css` の白地・角丸・影・文字色と、OK に `BalloonButton`（塗りのボタン）を使う。

## 主要ファイル

### scratch-gui

#### upstream 由来（Smalruby マーカー追加あり）

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/containers/cards.jsx` | チュートリアルカードのコンテナ（上流のまま）|
| `packages/scratch-gui/src/components/cards/` | カード UI |
| `packages/scratch-gui/src/containers/tips-library.jsx` | ヒント / チュートリアル一覧（上流のまま。スタータープロジェクト付きは `hideTutorialProjects` で外す）|
| `packages/scratch-gui/src/lib/tutorial-from-url.js` | `?tutorial=<urlId>` からチュートリアルを開く（Smalruby: 見つからないときの GA 計測）|

#### Smalruby 独自

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/reducers/tutorial-onboarding.js` | onboarding state（`MARK_TUTORIAL_SEEN`, `MARK_RUBY_TAB_USED`, `DISMISS_TOOLTIP`）。吹き出し UI は廃止済みで、現在は Ruby タブ訪問の記録に使う |
| `packages/scratch-gui/src/components/classroom-tutorial/` | クラスルーム機能のチュートリアル UI（見た目のトークンと OK ボタンは `components/balloon/`） |
| `packages/scratch-gui/src/reducers/classroom-tutorial.js` | クラスルームチュートリアル state |
| `packages/scratch-gui/src/lib/tutorial-url-analytics.js` | 見つからない `?tutorial=` の GA 計測（送る値を決める純粋関数と送信） |

#### Smalruby マーカー (upstream への埋め込み)

`src/lib/tutorial-from-url.js`:
- "unknown tutorial url analytics" — 見つからない `?tutorial=` を GA に送る

`src/playground/render-gui.jsx`:
- "hide project tutorials" — `hideTutorialProjects` を渡し、スタータープロジェクト付きのチュートリアルを一覧から外す

`webpack.config.js`:
- "lazy tutorial images" — チュートリアルの画像を `gui.js` に埋めこまず、開いたときだけ読みこむ

`src/components/menu-bar/menu-bar.jsx`, `src/containers/menu-bar-hoc.jsx`:
- "help menu" — 「チュートリアル」「デバッグ」をメニューバーのボタンから「?」メニューの項目へ移す

### scratch-vm

なし。

### infra

なし。

## 関連ブロック

なし。

## 設定・データ永続化

### Redux state

- `tutorial-onboarding` — `tutorialSeen`, `rubyTabUsed`, `tooltipDismissed`（いずれも書かれるだけで、読む画面は無い）
- `classroom-tutorial` — クラスルームチュートリアル状態
- `cards` — チュートリアルカードの開閉・現在ステップ

### LocalStorage

- `smalruby:tutorialSeen` — レッスン表を開くと `true`（`markTutorialSeen`）。`smalruby:rubyTabUsed` — Ruby タブを使うと `true`（`markRubyTabUsed`）。どちらも起動時に `tutorial-onboarding` の state へ読み込むだけで、表示の判定には使っていない

特定の onboarding 完了フラグは Redux state にあるが、永続化はプロジェクト state や `legacy-storage` 経由で扱われる場合がある。

## GA の計測

category は `tutorial_url`（`lib/tutorial-url-analytics.js`）。項目は `action` と `label` だけ。

| action | いつ送るか | label |
|---|---|---|
| `not_found` | `?tutorial=<urlId>` で開いたのに、その `urlId` のチュートリアルが無いとき（`all` と上流のチュートリアルの `urlId` は送らない） | 前にスモウルビーにあったチュートリアルの `urlId`（`chat1Basic1`〜`chat3Mesh3`・`gettingStartedCostume`・`gettingStartedSprites`・`rubyBasics1Numbers`〜`rubyBasics7Next`）なら、その値。ほかは `unknown`（入力した文字かもしれないので送らない） |

送られた数を見てから、古いリンクをレッスンへつなぎかえるかを決める。

## 画像の読み込み

上流のチュートリアルの画像（手順の絵とサムネイル。13 言語で約 1,500 枚・約 65 MB）は、**チュートリアルを開いたときだけ**読む。

- 言語ごとの手順の絵は上流のとおり `*-steps.js` の動的 import（チャンク `<言語>-steps`）で、カードを開くまで読まない。
- webpack（`webpack.config.js` のマーカー `lazy tutorial images`）で、`src/lib/libraries/decks/` の画像を `gui.js` に埋めこまず `static/assets/decks/` にファイルで出す。PWA の precache からも外し、開いたときだけ runtime caching（`smalruby-tutorial-images`）する。
- そのため、最初にエディターを開いたときの読み込み（`gui.js` の大きさ・リクエストの数）は画像の分だけ増えることはない。

## 関連ドキュメント

- [`docs/menu-bar/`](../menu-bar/) — 「?」メニュー（チュートリアル・デバッグの入口）
- [`docs/classroom/`](../classroom/) — `classroom-tutorial` の対象機能
- [`docs/ruby-editor/`](../ruby-editor/) — Ruby タブ onboarding の対象


