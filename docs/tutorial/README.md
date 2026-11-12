# チュートリアル

> **🔧 upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> **改良点**: ① **チュートリアル glow animation** をハイライト用に追加。② **Ruby タブの onboarding** を追加（初回 Ruby タブ訪問時のガイド）。③ **classroom-tutorial**（クラスルーム機能のチュートリアル）を追加。

## 概要

新しいユーザーや特定の機能を初めて使うユーザー向けの**チュートリアル**機能。upstream Scratch には基本的な「カード」形式のチュートリアル (`cards`) と「ヒント」(`tips-library`) があり、Smalruby はそれを継承しつつ Smalruby 独自のオンボーディング（Ruby タブ・クラスルーム）を追加している。

## ユーザーストーリー

- **初めて Smalruby を開いた小学生**として、簡単な作品例の作り方を順を追って教えてほしい
- **Ruby タブを初めて開いた子**として、ブロックとの違いやどう使うかを画面上で学びたい
- **Smalruby Classroom を初めて使う先生・生徒**として、操作方法をその場でガイドしてほしい
- **教師**として、生徒に既存のチュートリアル（カード）を順番に見せていきたい

## UI / 操作フロー

### カードチュートリアル (upstream 由来)

メニューバー右上の「?」メニューの **「チュートリアル」** から `tips-library` を開き、チュートリアルを選ぶ（メニューバーに直接のボタンは置かない。ふだんは目に入らないようにするため。「?」メニューの構成は [`docs/menu-bar/`](../menu-bar/) を参照）：

![チュートリアル一覧](screenshots/0201-tips-library-1280x800.png)

URL パラメータ `?tutorial=<urlId>`（例: `?tutorial=getStarted`）で直接チュートリアルを開く経路は「?」メニューとは独立に動く（`src/lib/tutorial-from-url.js`）。教科書や授業資料のリンクはこちらを使う。

1. 全画面のチュートリアルカードが表示される
2. 「次へ」「前へ」で進む
3. 完了で閉じる

Smalruby 独自のチュートリアル（「さあ、始めましょう」やメッセージ送信シリーズ）が並ぶ。タグで「ルビー」「メッシュ」フィルタが可能。

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
| `packages/scratch-gui/src/containers/cards.jsx` | チュートリアルカードのコンテナ（Smalruby: glow animation 追加）|
| `packages/scratch-gui/src/components/cards/` | カード UI |
| `packages/scratch-gui/src/containers/tips-library.jsx` | ヒント / チュートリアル一覧 |

#### Smalruby 独自

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/reducers/tutorial-onboarding.js` | onboarding state（`MARK_TUTORIAL_SEEN`, `MARK_RUBY_TAB_USED`, `DISMISS_TOOLTIP`）。吹き出し UI は廃止済みで、現在は Ruby タブ訪問の記録に使う |
| `packages/scratch-gui/src/components/classroom-tutorial/` | クラスルーム機能のチュートリアル UI（見た目のトークンと OK ボタンは `components/balloon/`） |
| `packages/scratch-gui/src/reducers/classroom-tutorial.js` | クラスルームチュートリアル state |
| `packages/scratch-gui/src/lib/libraries/decks/categories/book-promo.jsx` | Block 軸シリーズ共通の書籍プロモ要素（`BOOK` 書誌プレースホルダ / `BOOK_URL` / オープニング・クロージング step ファクトリ）。書誌確定後は `BOOK` 定数 1 箇所を差し替える（Phase 3, #956）。カテゴリは `blockBasics`（第1章）と `blockGames`（第4章）の 2 章のみ。第5章・第6章（`blockMath` / `blockScience`）は元となる書籍 PDF が提供されなかったため対象外（#962）|

#### Smalruby マーカー (upstream への埋め込み)

`src/containers/cards.jsx`, `src/components/cards/cards.jsx`:
- "tutorial glow animation" — チュートリアルのハイライト用アニメーション

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

## 関連ドキュメント

- [`docs/menu-bar/`](../menu-bar/) — 「?」メニュー（チュートリアル・デバッグの入口）
- [`docs/classroom/`](../classroom/) — `classroom-tutorial` の対象機能
- [`docs/ruby-editor/`](../ruby-editor/) — Ruby タブ onboarding の対象

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*tutorial|feat:.*onboarding` で grep）。
