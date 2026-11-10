# レッスン（コース › レッスン › チャレンジ）

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能

## 概要

チュートリアルを **コース › レッスン › チャレンジ** の形に作り直す機能。探すための一覧ではなく、「何をやって、何ができるようになったか」が見えるレッスンにする。先生の説明がなくても、スモウルビーでのプログラミングのやり方が自然に身につくことがゴール。

仕組みの全体像（レッスン表・レッスンモード・吹き出し・判定・記録）は、それぞれの実装と一緒にこのドキュメントへ追記する。

## いまのチュートリアルの入口

レッスン機能がチュートリアルの役目を引き継ぐため、従来の **「チュートリアル」「デバッグ」のボタンはメニューバーから外し、右上の「?」メニューの項目**にした（ふだんは目に入らないようにする。そろったら消す）。

- 「?」メニュー › チュートリアル → チュートリアル一覧（`tips-library`）
- 「?」メニュー › デバッグ → デバッグ画面（`debug-modal`）
- `?tutorial=<urlId>` で直接開く経路はそのまま動く（教科書や授業資料のリンク用）
- はじめての人向けの吹き出し（旧 `tutorial-tooltip`）は出さない。レッスンの入口への案内はレッスン機能側で作る

詳細は [`docs/menu-bar/`](../menu-bar/) の「「?」メニュー（ヘルプ）」と [`docs/tutorial/`](../tutorial/) を参照。

## 主要ファイル

- **scratch-gui**:
  - `packages/scratch-gui/src/components/menu-bar/menu-bar.jsx` — 「?」メニューのチュートリアル / デバッグ項目（`help menu` マーカー）
  - `packages/scratch-gui/src/containers/menu-bar-hoc.jsx` — `onOpenTipsLibrary` の供給（`help menu` マーカー）
  - `packages/scratch-gui/src/lib/tutorial-from-url.js` — `?tutorial=<urlId>` の解決

## 関連ドキュメント

- [`docs/menu-bar/`](../menu-bar/) — 「?」メニュー
- [`docs/tutorial/`](../tutorial/) — 従来のチュートリアル（カード / tips-library）
