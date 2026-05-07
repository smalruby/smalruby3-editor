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
| `src/reducers/modals.js` | smalrubot firmware modal | ファームウェアモーダル開時に接続モーダルを自動で閉じる |
| `src/components/connection-modal/connection-modal.jsx` | meshV2 initial step feature | Mesh v2 初期ステップ UI |
| `src/components/connection-modal/connection-modal.jsx` | smalrubotS1 dedicated flow | SmalrubotS1 専用フロー (PHASES、ステップ振り分け、propTypes) |
| `src/containers/connection-modal.jsx` | smalrubotS1 dedicated flow | SmalrubotS1 専用フロー (initial phase 判定、ハンドラー、props) |
| `src/components/connection-modal/connected-step.jsx` | meshV2 connected message feature | Mesh v2 接続済みステップ UI |
| `src/components/menu-bar/menu-bar.jsx` | smalrubot firmware menu | SmalrubotS1 メニューの import、ハンドラー、レンダリング、Redux 接続 |
| `src/components/gui/gui.jsx` | smalrubot firmware modal | SmalrubotS1 ファームウェアモーダルの import と配置 |
| `src/components/gui/gui.jsx` | classroom modal | クラスルームモーダルの import と配置 |
| `src/components/gui/gui.jsx` | Redux action props prevention | Redux action props の伝播防止 |
| `src/components/gui/gui.jsx` | iPad portrait narrow desktop stage size | 744〜1023px viewport で stage を small に強制 (issue #572 Phase 3-C, #599 で 768→744 拡張) |
| `src/components/gui/gui.css` | iPad portrait narrow desktop layout | 744〜1023px viewport で editor-wrapper の flex-basis を緩める (issue #572 Phase 3-C, #599 で 768→744 拡張) |
| `src/components/gui/gui.css` | iPad portrait legal links cleanup | 744〜1023px viewport でフィードバックリンク + セパレータを非表示 (issue #600, #599 で 768→744 拡張) |
| `src/components/gui/gui.css` | narrow-height vertical chrome compression | max-height: 800px で body-wrapper / tab-list の高さを圧縮 (issue #600) |
| `src/components/menu-bar/menu-bar.css` | narrow-height menu bar compression | max-height: 800px で menu-bar 48→40px に圧縮 (issue #600) |
| `src/playground/index.css` | narrow viewport vertical scroll lock | 狭幅画面で縦スクロールを overflow-y: clip で抑止 (issue #572 Phase 1) |
| `src/playground/index.css` | iPad portrait min-width relax | 744〜1023px viewport の min-width: 1024px を緩めて横スクロールを抑止 (issue #572 Phase 3-C, #599 で 768→744 拡張) |
| `src/containers/gui.jsx` | smalrubot firmware modal | SmalrubotS1 ファームウェアモーダル state マッピング |
| `src/containers/gui.jsx` | classroom modal | クラスルームモーダル state マッピング |
| `src/containers/gui.jsx` | classcode auto-open | クラスコード URL パラメーターによるモーダル自動オープン |
| `src/components/menu-bar/menu-bar.jsx` | classroom button | クラスルームボタンの import、レンダリング、Redux 接続 |
| `src/components/menu-bar/settings-menu.jsx` | classroom management menu | クラス管理メニューアイテムの import、レンダリング、Redux 接続 |
| `webpack.config.js` | classroom API | CLASSROOM_API_ENDPOINT 環境変数注入 |
| `webpack.config.js` | scratch api proxy endpoint | SCRATCH_API_PROXY_ENDPOINT 環境変数注入 |
| `eslint.config.mjs` | react lifecycle typo detection | `react/no-typos` を error にして getDerivedStateFromProps/Error の static 抜け等を lint で検出 |
| `eslint.config.mjs` | prettier integration | eslintConfigPrettier を最後に置いて prettier と競合する整形ルールを無効化 |
| `src/lib/blocks.js` | gesture recovery import | ジェスチャー復旧モジュールの import |
| `src/lib/blocks.js` | gesture recovery | ジェスチャー復旧ハンドラーのインストール |
| `src/lib/blocks.js` | comment icon patch import | ScratchCommentIcon パッチモジュールの import |
| `src/lib/blocks.js` | comment icon patch | ScratchCommentIcon の synchronous collapse パッチをインストール (scratch-blocks v2 が XML の `minimized` を無視する問題への対応) |
| `src/containers/blocks.jsx` | comment icon patch import | コメントアイコンパッチ API の import |
| `src/containers/blocks.jsx` | pre-load collapse map | XML 読み込み前に minimized=true のコメントを Map に集めてパッチに渡す |
| `src/containers/blocks.jsx` | pre-load collapse map cleanup | finally で pending state をクリア |
| `src/containers/blocks.jsx` | @ruby:* workspace comment collapse | workspace-level `@ruby:*` コメントを setCollapsed で折り畳む |
| `src/playground/render-gui.jsx` | URL params for Playwright | URL パラメーター import |
| `src/playground/render-gui.jsx` | no_beforeunload URL param | beforeunload 無効化 |
| `src/playground/render-gui.jsx` | MobileGui dispatcher | ResponsiveGui import + GUI を ResponsiveGui に差し替え (issue #572 Phase 2-A) |
| `src/playground/render-gui.jsx` | storage worker timeout HOC | scratch-storage の FetchWorkerTool に 5s タイムアウトを当てる HOC import と compose 配置 (subdir deploy + iOS Safari の Worker hang 対策) |
| `src/components/target-pane/target-pane.jsx` | mobile-sprite-panel suppress-library | MobileSpritePanel が同一ツリーで TargetPane を再描画する際の SpriteLibrary 二重表示を `hideSpriteLibrary` prop で抑止 (issue #572 Phase 2-F) |
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
| `src/containers/backpack.jsx` | mesh v1 backpack auto-migration | Skyway 停止 (Issue #592) に伴う localStorage バックパックの自動 v1→v2 マイグレーション |
| `src/containers/controls.jsx` | block_run analytics | 緑旗クリック時に GA4 イベントを発火 (issue #645 Phase 1) |
| `src/containers/connection-modal.jsx` | mesh_v2/smalrubot_s1 connect analytics | 接続成功時に拡張別カテゴリ (`mesh_v2` / `smalrubot_s1`) で GA4 イベントを発火 (issue #645 Phase 1) |
| `src/containers/connection-modal.jsx` | mesh_v2/smalrubot_s1 disconnect analytics | 切断時に拡張別カテゴリで GA4 イベントを発火 (issue #645 Phase 1) |

## 関連ファイル

マーカーで囲まれたコードが参照するファイル:
- `src/reducers/smalruby-registry.ts` — gui.ts のマーカーから参照
- `src/lib/backpack-mesh-v1-migration.js` — backpack.jsx のマーカーから参照
