# メニューバー

> **🔧 upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> **改良点**: ① **Smalruby ロゴ**に置換（upstream の Scratch ロゴから）。② **クラスルーム** ボタン追加。③ **Smalrubot ファームウェア** メニュー追加。④ **バージョン更新通知** バナー追加。⑤ **設定** メニューにクラスルーム管理を追加。⑥ **チュートリアル / デバッグ** のボタンをメニューバーから外し、右上の **「?」メニュー** の項目にした。

## 概要

エディタ最上部の**メニューバー**。新規/開く/保存/ファイル名変更などのファイル操作、編集メニュー、設定メニュー、言語選択、アカウントメニュー、Smalruby 独自のクラスルームボタン・Smalrubot ファームウェアメニュー・バージョン更新通知などを集約する。

## ユーザーストーリー

- **小学生**として、Smalruby のロゴで自分が今何のアプリを使っているか確認したい
- **教師**として、メニューバーから直接「クラス」や「設定」にアクセスしたい
- **Smalrubot 利用者**として、ロボットのファームウェア書き込みをメニューから起動したい
- **長期間使っているユーザー**として、Smalruby に新しいバージョンが出たら通知してほしい
- **多言語ユーザー**として、画面右下の地球アイコンから言語を切り替えたい

## UI / 操作フロー

### メニューバー構成

| 要素 | 機能 |
|---|---|
| Smalruby ロゴ | アプリ識別（Smalruby 改良） |
| ファイルメニュー | 新規 / 開く / 保存 / Drive 連携 / URL ローダー |
| 編集メニュー | 元に戻す / やり直し / ターボモード切替 |
| 設定メニュー (⚙) | クラスルーム管理（Smalruby 改良） / 言語 / その他 |
| クラスボタン | クラスルームモーダルを開く（Smalruby 独自）|
| Smalrubot メニュー | ファームウェア書き込み（Smalruby 独自）|
| プロジェクトタイトル入力欄 | タイトル編集 |
| 共有 / 見る ボタン | upstream の Scratch アカウント機能（Smalruby では削減）|
| バージョン更新通知 | 新バージョン検出時にバナー表示（Smalruby 独自）|
| 「?」メニュー（右端） | チュートリアル / デバッグ / スモウルビーについて / ウェルカムをもう一度見る（Smalruby 独自構成。upstream はチュートリアル・デバッグをメニューバーのボタンとして出す）|

### 設定メニュー

![設定メニュー展開](screenshots/0101-settings-menu-1280x800.png)

設定メニューには **言語 / カラーモード / ルビー (バージョン切替) / ブロック表示 / クラス管理** が並ぶ。クラス管理は Smalruby 独自追加。

### 「?」メニュー（ヘルプ）

![「?」メニュー展開](screenshots/0102-help-menu-1280x800.png)

右上の「?」を押すと **チュートリアル / デバッグ** と、区切り線をはさんで **スモウルビーについて / ウェルカムをもう一度見る** が並ぶ。
upstream ではチュートリアルとデバッグはメニューバーのボタン（「編集」の右）だが、Smalruby はふだん目に入らないよう「?」の中に置く（レッスン機能がチュートリアルの役目を引き継ぐため。`docs/lessons/` 参照）。押したときの動きは upstream のボタンと同じ（チュートリアル一覧 `tips-library` / デバッグ画面 `debug-modal` を開く）。

- `?tutorial=<urlId>` で直接チュートリアルを開く経路はそのまま動く（[`docs/tutorial/`](../tutorial/)）。
- SP / iPad の `MobileGui` にはもともとチュートリアル / デバッグのボタンは無い（ドロワーの「ヘルプ」は「スモウルビーについて」「ウェルカムをもう一度見る」「不具合を報告」のみ）。
- はじめての人向けの吹き出し（旧 `tutorial-tooltip`「ルビーを試してみよう!」）は廃止した。

| data-testid | 要素 | 説明 |
|---|---|---|
| `menu-bar-about` | div | 「?」ボタン（押すとメニューが開く） |
| `menu-bar-help-tutorials` | li (`MenuItem`) | チュートリアル一覧を開く |
| `menu-bar-help-debug` | li (`MenuItem`) | デバッグ画面を開く |

## 主要ファイル

### scratch-gui

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/components/menu-bar/menu-bar.jsx` | メニューバー本体（Smalruby マーカー多数）|
| `packages/scratch-gui/src/components/menu-bar/menu-bar.css` | スタイル（mobile-ui 用 `max-height: 800px` 圧縮も含む）|
| `packages/scratch-gui/src/components/menu-bar/settings-menu.jsx` | 設定メニュー（Smalruby のクラスルーム管理を含む）|
| `packages/scratch-gui/src/containers/menu-bar-hoc.jsx` | メニューバー HOC（「?」メニューのチュートリアル項目用 `onOpenTipsLibrary` を供給）|
| `packages/scratch-gui/src/components/gui/gui.jsx` | 「?」メニューの「スモウルビーについて」「ウェルカムをもう一度見る」の定義（about menu マーカー）|
| `packages/scratch-gui/src/components/language-selector/` | 言語選択 |
| `packages/scratch-gui/src/lib/version-checker.js` | バージョン更新確認（Smalruby 独自）|

#### Smalruby マーカー (upstream への埋め込み)

主な箇所（詳細は `docs/maintenance/smalruby-markers-gui.md`）：

- smalrubot firmware menu — Smalrubot ファームウェアメニュー
- classroom button — クラスルームボタン
- replace Scratch logos with Smalruby logo — ロゴ置換
- version update notification — バージョン更新通知
- help menu — チュートリアル / デバッグを「?」メニューへ移動（menu-bar.jsx / menu-bar-hoc.jsx）
- welcome tooltip / about menu — 「?」まわりのウェルカム吹き出しとメニュー項目

### scratch-vm

なし。

### infra

なし。

## 関連ブロック

なし。

## 設定・データ永続化

### Redux state

- `menus.js` — メニュー開閉状態（「?」メニューは `aboutMenu`）
- `locales.js` — 言語設定

## 関連ドキュメント

- [`docs/classroom/`](../classroom/) — クラスルームボタン → クラスルームモーダル
- [`docs/extension-smalrubot-s1/`](../extension-smalrubot-s1/) — Smalrubot ファームウェアメニュー
- [`docs/tutorial/`](../tutorial/) — 「?」メニューから開くチュートリアル一覧
- [`docs/lessons/`](../lessons/) — チュートリアルの役目を引き継ぐレッスン機能
- [`docs/mobile-ui/`](../mobile-ui/) — mobile での menu-bar 圧縮
- `docs/maintenance/smalruby-markers-gui.md` — upstream マーカー一覧

## 関連 Issue / PR

- Issue #600 — narrow-height (max-height: 800px) で menu-bar 48→40px 圧縮
