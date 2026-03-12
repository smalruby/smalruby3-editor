---
paths:
  - "packages/scratch-gui/src/reducers/**"
  - "packages/scratch-gui/src/containers/**"
  - "packages/scratch-gui/src/components/**"
  - "packages/scratch-gui/src/lib/blocks*"
  - "packages/scratch-gui/src/playground/**"
  - "packages/scratch-gui/src/lib/project-saver*"
  - "packages/scratch-gui/src/lib/project-fetcher*"
  - "packages/scratch-gui/src/lib/url-params*"
description: "Smalruby マーカーコメントの一覧と規約。upstream ファイルへの Smalruby 固有コード追加や upstream merge 時に使用。"
---

# Smalruby Marker Blocks

Smalruby のカスタムコードは upstream ファイルの中に **マーカーコメント** で囲んで配置する。
upstream merge 時にコンフリクトを解決しやすくするための仕組み。

## マーカーの書式

```javascript
// === Smalruby: Start of <機能名> ===
// ... Smalruby 固有のコード ...
// === Smalruby: End of <機能名> ===
```

ファイル全体が Smalruby 固有の場合:
```javascript
// === Smalruby: This file is Smalruby-specific (<説明>) ===
```

## ルール

1. **upstream ファイルに Smalruby コードを追加するときは必ずマーカーで囲む**
2. **マーカー内のコードだけを変更する** — マーカー外は upstream の管轄
3. **新しいマーカーを追加したら、このセクションに記載する**
4. **マーカーを削除する場合は、このセクションからも削除する**

## 現在のマーカー一覧

| ファイル | 機能名 | 説明 |
|----------|--------|------|
| `src/reducers/gui.ts` | Redux state registry | Smalruby reducer の import |
| `src/reducers/gui.ts` | initial state | Smalruby 初期 state の展開 |
| `src/reducers/gui.ts` | reducers | Smalruby reducer の登録 |
| `src/containers/cards.jsx` | tutorial glow animation | チュートリアルのハイライトアニメーション |
| `src/containers/connection-modal.jsx` | meshV2 initial step feature | Mesh v2 接続初期ステップ |
| `src/containers/connection-modal.jsx` | meshV2 connected message feature | Mesh v2 接続済みメッセージ |
| `src/containers/connection-modal.jsx` | meshV2 back button feature | Mesh v2 戻るボタン |
| `src/components/cards/cards.jsx` | tutorial glow animation | チュートリアル UI のハイライト |
| `src/components/connection-modal/connection-modal.jsx` | network filter detection feature | ネットワークフィルター検出 |
| `src/components/connection-modal/connection-modal.jsx` | meshV2 initial step feature | Mesh v2 初期ステップ UI |
| `src/components/connection-modal/connected-step.jsx` | meshV2 connected message feature | Mesh v2 接続済みステップ UI |
| `src/components/gui/gui.jsx` | Redux action props prevention | Redux action props の伝播防止 |
| `src/lib/blocks.js` | gesture recovery import | ジェスチャー復旧モジュールの import |
| `src/lib/blocks.js` | gesture recovery | ジェスチャー復旧ハンドラーのインストール |
| `src/playground/render-gui.jsx` | URL params for Playwright | URL パラメーター import |
| `src/playground/render-gui.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/playground/render-gui-standalone.jsx` | URL params for Playwright | URL パラメーター import |
| `src/playground/render-gui-standalone.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/playground/player.jsx` | URL params for Playwright | URL パラメーター import |
| `src/playground/player.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/lib/project-saver-hoc.jsx` | URL params for Playwright | URL パラメーター import |
| `src/lib/project-saver-hoc.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/lib/project-fetcher-hoc.jsx` | URL params for Playwright | URL パラメーター import |
| `src/lib/project-fetcher-hoc.jsx` | initial tab from URL param | 初期タブ URL パラメーター |
| `src/reducers/editor-tab.js` | initial tab from URL param | 初期タブ URL パラメーター |
| `src/reducers/settings.js` | URL params for Playwright | URL パラメーター import |
| `src/reducers/settings.js` | ruby_version URL param | Ruby バージョン URL パラメーター |

## Smalruby 固有ファイル（ファイル全体がマーカー）

| ファイル | 説明 |
|----------|------|
| `src/components/connection-modal/mesh-v2-initial-step.jsx` | Mesh v2 初期接続ステップコンポーネント |
| `src/components/connection-modal/mesh-v2-network-filtered-step.jsx` | Mesh v2 ネットワークフィルター検出コンポーネント |
| `src/reducers/smalruby-registry.ts` | Smalruby reducer/state の一括エクスポート |
| `src/lib/blocks-gesture-recovery.js` | ジェスチャー復旧ハンドラー（ブロックドラッグのスタック防止） |
| `src/lib/url-params.js` | Playwright テスト用 URL パラメーター解析ユーティリティ |
| `src/containers/ruby-tab/debug-globals.js` | Playwright MCP 用デバッググローバル変数 |

## 関連ファイル

マーカーで囲まれたコードが参照するファイル:
- `src/reducers/smalruby-registry.ts` — gui.ts のマーカーから参照
