# バックパック (Backpack)

> **🔧 upstream 改良** — upstream にあるが Smalruby で機能を改良・拡張している
> **改良点**: ① バックパックの保存先を **localStorage** に変更（upstream はサーバ）。② Mesh v1 (Skyway) → v2 への**自動マイグレーション**を起動時に実行。

## 概要

バックパックは、スプライト・コスチューム・サウンド・コード片（スクリプト）を**プロジェクト間で持ち運ぶ**ための機能。upstream はサーバ上に保存するが、Smalruby はサーバを持たないため **localStorage** に保存する形に改良している。

加えて、旧 Mesh (v1) を含むスクリプトがバックパックに残っていると、v1 サービス停止後（Issue #592, Skyway 終了）に復元したときにブロックが壊れる。これを防ぐため、**起動時に自動で Mesh v1 → v2 マイグレーション**を実行する。

## ユーザーストーリー

- **小学生**として、よくできたスプライトを別の作品でも使いたい
- **アニメーション制作中の子**として、書いたスクリプトを使い回したい
- **作品を作り続けてきたユーザー**として、過去にバックパックに保存したものが Skyway 停止後も使えるようにしてほしい（Mesh v2 に自動更新）
- **教師**として、ローカル保存なのでサーバ運用コストなしでバックパック機能を提供したい

## UI / 操作フロー

エディタ右下の **バックパック** ペインをクリックすると展開。

### 保存

- ブロック / コスチューム / サウンド / スプライトを **ドラッグ&ドロップ** でバックパックに入れる
- スクリプトは右クリックメニューからも追加可能

### 復元

- バックパック内のアイテムを **ドラッグ&ドロップ** でワークスペースに戻す
- ステージ・スプライトに対象が応じて自動配置

### 自動マイグレーション（起動時）

- 起動時、`localStorage.smalruby:meshV1BackpackMigratedAt` が無ければ実行
- バックパック内のスクリプト・スプライト zip を全件スキャン
- Mesh v1 のブロック opcode (`mesh_*`) を Mesh v2 (`meshV2_*`) に書き換え
- マイグレーション後にフラグを保存して以降は no-op

## 主要ファイル

### scratch-gui

#### コンポーネント / コンテナ

- `packages/scratch-gui/src/components/backpack/` — UI コンポーネント
- `packages/scratch-gui/src/containers/backpack.jsx` — コンテナ。**起動時の Mesh v1 マイグレーション呼び出し** を含む

#### ライブラリ

| ファイル | 役割 |
|---|---|
| `packages/scratch-gui/src/lib/backpack-api.js` | localStorage ベースの保存・取得 API |
| `packages/scratch-gui/src/lib/backpack/code-payload.js` | コードスニペットのペイロード処理 |
| `packages/scratch-gui/src/lib/backpack/costume-payload.js` | コスチュームのペイロード処理 |
| `packages/scratch-gui/src/lib/backpack/sound-payload.js` | サウンドのペイロード処理 |
| `packages/scratch-gui/src/lib/backpack/sprite-payload.js` | スプライトのペイロード処理 |
| `packages/scratch-gui/src/lib/backpack/block-to-image.js` | ブロックの画像化 |
| `packages/scratch-gui/src/lib/backpack/jpeg-thumbnail.js` | JPEG サムネイル生成 |
| `packages/scratch-gui/src/lib/backpack-mesh-v1-migration.js` | **Mesh v1 → v2 自動マイグレーション**（Smalruby 独自）|

#### Smalruby マーカー (upstream への埋め込み)

`src/containers/backpack.jsx` 内の `// === Smalruby: Start of mesh v1 backpack auto-migration ===` で囲まれた箇所：

- import `migrateMeshV1InLocalStorageBackpack`
- componentDidMount でマイグレーション呼び出し
- ローディング state の追加

詳細は `.claude/rules/scratch-gui/smalruby-markers.md` 参照。

### scratch-vm

`vm.migrateMeshV1InBackpackBlocks(json)` — Mesh v1 → v2 のブロック書き換え本体は VM 側に実装。

### infra

なし。

## 関連ブロック

バックパックは特定のブロックには紐づかない（**全ブロックが対象**）。

ただし Mesh v1 マイグレーションでは以下の opcode を v2 に書き換える：
- `mesh_*` → `meshV2_*`

## 設定・データ永続化

### localStorage

| キー | 用途 |
|---|---|
| `smalrubyBackpack` | バックパックの全アイテム（JSON 配列、Base64 エンコード）|
| `smalruby:meshV1BackpackMigratedAt` | マイグレーション完了タイムスタンプ（フラグ）|

### 環境変数

なし（完全クライアント完結）。

## 既知の制限

- **localStorage の容量制限** (5〜10MB) があるため、大きなスプライトを多数バックパックに入れると失敗することがある
- **ブラウザ間でバックパックは共有されない**（同じデバイス・同じブラウザ・同じドメインのみ）
- プライベートブラウジング/シークレットモードではタブを閉じると消える

## upstream との差分

`.claude/rules/scratch-gui/smalruby-markers.md` で全マーカーを把握できる。バックパック関連の主な差分：

| 場所 | 差分 |
|---|---|
| `src/containers/backpack.jsx` | Mesh v1 → v2 自動マイグレーション機構 |
| `src/lib/backpack-api.js` | サーバ送信ではなく localStorage 経由 (`STORAGE_KEY = 'smalrubyBackpack'`) |
| `src/lib/backpack-mesh-v1-migration.js` | 新規ファイル（Smalruby 独自）|

## テスト

- 単体テスト: `packages/scratch-gui/test/unit/lib/backpack-api.test.js`, `backpack-mesh-v1-migration.test.js`
- 結合テスト: `packages/scratch-gui/test/unit/containers/backpack.test.jsx`

## 関連ドキュメント

- [`docs/mesh-v2/`](../mesh-v2/) — Mesh v2 ネットワーク（マイグレーション先）
- `.claude/rules/scratch-gui/smalruby-markers.md` — upstream マーカー一覧

## 関連 Issue / PR

- Issue #592 — Skyway 終了に伴う Mesh v1 → v2 自動マイグレーション
