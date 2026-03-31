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

# Smalruby Marker Blocks (scratch-gui)

upstream ファイルに追加した Smalruby 固有コードのマーカー一覧。
マーカーの書式・ルールは `.claude/rules/code-style.md` の「Smalruby Marker Comments」を参照。

**重要**: Smalruby 固有ファイル（`smalruby-prettier-files.md` に記載されたファイル）にはマーカー不要。
このファイルに記載するのは **upstream ファイルに埋め込んだマーカーのみ**。

マーカーを追加・削除した場合は、下記の一覧を更新すること。

## 現在のマーカー一覧

| ファイル | 機能名 | 説明 |
|----------|--------|------|
| `src/reducers/gui.ts` | Redux state registry | Smalruby reducer の import |
| `src/reducers/gui.ts` | initial state | Smalruby 初期 state の展開 |
| `src/reducers/gui.ts` | reducers | Smalruby reducer の登録 |
| `src/containers/cards.jsx` | tutorial glow animation | チュートリアルのハイライトアニメーション |
| `src/containers/connection-modal.jsx` | smalrubot firmware flash | SmalrubotS1 ファームウェア書き込みの import、ハンドラー、props |
| `src/containers/connection-modal.jsx` | meshV2 initial step feature | Mesh v2 接続初期ステップ |
| `src/containers/connection-modal.jsx` | meshV2 connected message feature | Mesh v2 接続済みメッセージ |
| `src/containers/connection-modal.jsx` | meshV2 back button feature | Mesh v2 戻るボタン |
| `src/components/cards/cards.jsx` | tutorial glow animation | チュートリアル UI のハイライト |
| `src/components/connection-modal/connection-modal.jsx` | smalrubot firmware flash | SmalrubotS1 ファームウェアボタン propType |
| `src/components/connection-modal/connection-modal.jsx` | network filter detection feature | ネットワークフィルター検出 |
| `src/components/connection-modal/error-step.jsx` | smalrubot firmware flash | エラーステップのファームウェアボタン |
| `src/components/connection-modal/connection-modal.jsx` | meshV2 initial step feature | Mesh v2 初期ステップ UI |
| `src/components/connection-modal/connected-step.jsx` | meshV2 connected message feature | Mesh v2 接続済みステップ UI |
| `src/components/gui/gui.jsx` | smalrubot firmware modal | SmalrubotS1 ファームウェアモーダルの import と配置 |
| `src/components/gui/gui.jsx` | Redux action props prevention | Redux action props の伝播防止 |
| `src/containers/gui.jsx` | smalrubot firmware modal | SmalrubotS1 ファームウェアモーダル state マッピング |
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

## 関連ファイル

マーカーで囲まれたコードが参照するファイル:
- `src/reducers/smalruby-registry.ts` — gui.ts のマーカーから参照
