# プロジェクト管理

> **🔧 upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> **改良点**: ① **URL ローダー**で外部 URL からプロジェクトを直接読み込み可能。② Google Drive との連携（保存・読込時に Drive state クリア）。③ URL パラメータでの初期タブ・Playwright 制御。④ プロジェクトタイトル変更時の挙動微調整。

## 概要

Scratch プロジェクト（`.sb3` ファイル）の **新規作成・読み込み・保存・URL からのロード・タイトル編集** を扱う機能群。Smalruby は upstream の Project Saver/Fetcher HOC を継承しつつ、Smalruby 固有の保存先（ローカルファイル、Google Drive、Smalruby Classroom）に対応する。

## ユーザーストーリー

- **小学生**として、自分のプロジェクトを `.sb3` でダウンロードして保存したい
- **教師**として、配布する作例の URL を子供たちに開かせて、すぐに編集を始められるようにしたい
- **複数デバイスを使う子**として、Google Drive 経由で作品を行き来させたい
- **作品を発表する子**として、プロジェクトのタイトルをわかりやすい名前に変更したい

## UI / 操作フロー

### 新規 / 読込 / 保存

メニューバーの「ファイル」メニュー：
- 新しく作る
- ファイルから読み込む（`.sb3`）
- ファイルとして保存する（`.sb3` ダウンロード）
- Google Drive から読み込み / Drive に保存（[`docs/google-drive/`](../google-drive/) 参照）

### URL からのロード

URL パラメータ `?project_url=https://...` または、URL ローダーモーダル (`url-loader-modal`) から URL を入力してロード。

### タイトル

メニューバー上部の「プロジェクトタイトル入力欄」をクリックして変更。

## 主要ファイル

### scratch-gui

#### Project HOC (upstream + Smalruby マーカー)

| ファイル | 役割 / Smalruby 改良 |
|---|---|
| `packages/scratch-gui/src/lib/project-fetcher-hoc.jsx` | プロジェクト取得 HOC。URL パラメータ (Playwright)、初期タブパラメータの追加 |
| `packages/scratch-gui/src/lib/project-saver-hoc.jsx` | プロジェクト保存 HOC。URL パラメータ・no_beforeunload の追加 |
| `packages/scratch-gui/src/lib/sb-file-uploader-hoc.jsx` | `.sb3` アップロード HOC。Google Drive state のクリア |
| `packages/scratch-gui/src/containers/sb3-downloader.jsx` | `.sb3` ダウンロード |

#### URL Loader (Smalruby 独自追加)

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/components/url-loader-modal/` | URL 入力モーダル UI |
| `packages/scratch-gui/src/lib/url-loader.js` | URL からのプロジェクト取得ロジック |
| `packages/scratch-gui/src/lib/url-loader-hoc.jsx` | HOC ラッパー |
| `packages/scratch-gui/src/lib/url-parser.js` | URL パース |

#### URL パラメータ (Smalruby 独自追加)

- `packages/scratch-gui/src/lib/url-params.js` — `tab`, `rubyMode`, `ruby_version`, `no_beforeunload`, `project_url`, `classcode`, `force_polling`, `mesh_debug` などの統一パーサ

#### Project Loader Utils

- `packages/scratch-gui/src/lib/project-loader-utils.js` — プロジェクトロード共通処理
- `packages/scratch-gui/src/lib/sb-file-uploader-utils.js` — `.sb3` アップロード共通処理

#### State 管理

- `packages/scratch-gui/src/reducers/project-state.js` — プロジェクトのライフサイクル state（loading, ready, saving, ...）
- `packages/scratch-gui/src/reducers/project-changed.js` — 未保存変更の検出
- `packages/scratch-gui/src/reducers/project-title.js` — タイトル
- `packages/scratch-gui/src/reducers/google-drive-file.js` — Google Drive ファイル state（[`docs/google-drive/`](../google-drive/) 参照）

#### プロジェクト状態図

`docs/project-management/project_state_diagram.svg` (SVG 図) — プロジェクトのライフサイクル状態遷移
`docs/project-management/project_state_example.png` — 状態遷移の具体例

### scratch-vm

VM 側の `loadProject`, `saveProjectSb3` を呼ぶ。Smalruby 独自の Marker は `serialization/smalruby-migration.js`（Mesh v1 → v2 ブロックマイグレーション）。

### infra

- Google Drive 経由は `infra/smalruby-classroom/` の課題提出機能と連動

## 関連ブロック

なし（プロジェクト管理は UI 機能でブロックを持たない）。

ただし、新規プロジェクトには **デフォルトプロジェクト** (`packages/scratch-gui/src/lib/default-project/`) のブロック構成が組み込まれる。

## 設定・データ永続化

### URL パラメータ（Smalruby 独自）

| パラメータ | 用途 |
|---|---|
| `project_url` | 指定 URL からプロジェクトを取得 |
| `tab` | 初期表示タブ |
| `ruby_version` | Ruby バージョン |
| `no_beforeunload` | beforeunload 無効化（Playwright 用）|

### LocalStorage

- `legacy-storage.ts` — 旧バージョンとの互換性データ管理

## upstream との差分（マーカー）

主な Smalruby マーカーは `docs/maintenance/smalruby-markers-gui.md` を参照：

- `src/lib/project-fetcher-hoc.jsx` — URL params, initial tab
- `src/lib/project-saver-hoc.jsx` — URL params, no_beforeunload
- `src/lib/sb-file-uploader-hoc.jsx` — Google Drive state クリア

## 関連ドキュメント

- [`docs/google-drive/`](../google-drive/) — Google Drive 保存・読込
- [`docs/classroom/`](../classroom/) — Smalruby Classroom 提出機能
- [`docs/backpack/`](../backpack/) — バックパック (mesh v1 マイグレーション含む)

## プロジェクトライフサイクル詳細

[`project_state_diagram.svg`](project_state_diagram.svg) — Project State Machine の状態遷移図
[`project_state_example.png`](project_state_example.png) — 具体的なフロー例

## 関連 Issue / PR

主要 PR は履歴を参照（`feat:.*url_loader|feat:.*project_url` で grep）。
