# 設定

> **🔧 upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> **改良点**: ① **Ruby バージョン (v1/v2)** の切替設定。② URL パラメータでの設定上書き (`ruby_version`)。③ V1 検出プロンプトのスキップフラグ。

## 概要

Smalruby のエディタ全体に影響する**設定**を管理する仕組み。upstream の `settings` reducer を継承しつつ、Smalruby 固有の Ruby バージョン切替などの項目を追加している。

設定 UI は主にメニューバーの設定メニュー (⚙) からアクセスする。

## ユーザーストーリー

- **既存ユーザー**として、Ruby v1 で書いた作品を v2 で開きたい / v1 で動かし続けたい
- **教師**として、生徒に共通の設定（バージョン）を URL パラメータで配布したい
- **作品ロード時**に、v1 構文を含むプロジェクトが検出されたら警告を出してほしい

## UI / 操作フロー

メニューバーの ⚙ ボタンから設定メニューを開き、各設定項目を変更する。

主な設定項目：

| 項目 | 値 | 永続化 |
|---|---|---|
| Ruby バージョン | v1 / v2 | localStorage `smalruby:rubyVersion` |
| ふりがな | ON / OFF | localStorage `smalruby:furiganaEnabled` ([`docs/furigana/`](../furigana/)) |
| DNCL モード | ON / OFF | localStorage `smalruby:dnclMode` ([`docs/dncl/`](../dncl/)) |
| Auto-correct | ON / OFF | localStorage `smalruby:autoCorrectEnabled` ([`docs/ruby-editor/`](../ruby-editor/)) |
| ルビティー同意 | 同意済み | localStorage `smalruby:rubyteeConsent` ([`docs/rubytee/`](../rubytee/)) |
| クラスルーム管理 | (Smalruby 改良) | メニューから直接アクセス |

## 主要ファイル

### scratch-gui

#### Settings reducer (Smalruby マーカー追加)

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/reducers/settings.js` | 設定 state（Ruby version, V1 prompt dismiss）|
| `packages/scratch-gui/src/lib/settings/` | 設定永続化ライブラリ |

#### URL パラメータ連携

- `packages/scratch-gui/src/lib/url-params.js` — `ruby_version` 等の URL パラメータパーサ

#### Smalruby マーカー (upstream への埋め込み)

`src/reducers/settings.js`:
- "URL params for Playwright" — URL パラメータ import
- "ruby_version URL param" — `ruby_version` パラメータ反映

### scratch-vm

なし。

### infra

なし。

## 関連ブロック

なし。

## 設定・データ永続化

### Redux state (settings reducer)

- `rubyVersion` (1 / 2)
- `dismissV1Prompt` (boolean) — v1 検出プロンプトをスキップするか

### LocalStorage キー

各設定機能ごとに独立した key を持つ（上記表参照）。

### URL パラメータ

| パラメータ | 効果 |
|---|---|
| `ruby_version` | Ruby バージョンを 1 または 2 に強制 |
| `rubyMode` | Ruby タブの初期モード |
| `tab` | 初期表示タブ |
| `no_beforeunload` | beforeunload 無効化（Playwright 用）|

## 関連ドキュメント

- [`docs/ruby-editor/`](../ruby-editor/) — Ruby v1/v2 の差異
- [`docs/smalruby-language-spec-v1-diff.ja.md`](../smalruby-language-spec-v1-diff.ja.md) — v1/v2 言語仕様差分
- [`docs/menu-bar/`](../menu-bar/) — 設定メニュー UI
- `docs/maintenance/smalruby-markers-gui.md` — upstream マーカー一覧

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*ruby_version|feat:.*settings` で grep）。
