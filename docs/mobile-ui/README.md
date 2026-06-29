# Mobile UI (SP / iPad 対応)

> **🆕 Smalruby 独自** — upstream に存在しない、Smalruby のために新規追加された機能
> upstream の Scratch エディタはデスクトップ前提（最小幅 1024px）。Smalruby ではスマホ横向き専用 UI (`MobileGui`) と iPad 向けの幅・高さ調整 (`narrow-desktop`) を独自に追加している。

## 概要

スマートフォン（横向き）と iPad（portrait/landscape）でも Smalruby を快適に使えるようにする一連の対応。viewport ベースで自動的にモードを切り替え、URL パラメータでのオプトインは設けない。

- **MobileGui**: スマホ横向き専用に再構成された UI（左サイドレール・下部タブ・ドロワー型のブロックパレット）
- **narrow-desktop**: 744〜1023px の desktop GUI に当たる CSS 調整（iPad mini, iPad portrait, 縦が低い iPad landscape）

## ユーザーストーリー

- **小学生**として、家の iPad（portrait/landscape）でスモウルビーを開いて、PC と同じように作品を作りたい
- **スマホしか持っていない子**として、横向きにしたら最低限の作品制作ができてほしい（iPhone で完結したい）
- **教師**として、教室の iPad と PC で同じ作品ファイルを行き来できるようにしたい
- **縦持ちスマホで開いた子**として、「横向きにしてください」と画面に案内が出てほしい

## UI / 操作フロー

### 切り替えロジック（自動、`useIsNarrowScreen` の matchMedia）

```js
const NARROW_SCREEN_QUERY = '(max-width: 743px), (max-height: 500px)';
```

| Viewport | モード |
|---|---|
| iPhone 14 横 (844×390) | **MobileGui** (高さ ≤ 500 で発火) |
| iPhone 14 縦 (390×844) | **MobileGui** + 縦持ち警告 |
| iPad mini portrait (744×1133) | desktop GUI + iPad 調整 |
| iPad portrait (768×1024) | desktop GUI + iPad 調整 |
| iPad landscape (1024×768) | desktop GUI + 高さ調整 |
| Desktop (1280×800) | desktop GUI (upstream 通常) |

`useIsNarrowScreen` の matchMedia がリアルタイムに反応するため、ブラウザリサイズ・端末回転に追従する。

### MobileGui の主要画面

詳細・全画面の説明は **[`ui-ux.md`](ui-ux.md)** を参照（screenshots 付き）。

- ブロックパレット（ドロワー）
- コードタブ全画面
- コスチューム/サウンド/ルビー タブ
- スプライトパネル
- 縦持ち警告

## 主要ファイル

### scratch-gui

#### Mobile 専用コンポーネント

- `packages/scratch-gui/src/components/mobile-gui/` — モバイル専用 GUI ルート
- `packages/scratch-gui/src/components/mobile-top-bar/` — 上部バー
- `packages/scratch-gui/src/components/mobile-bottom-tabs/` — 下部タブ
- `packages/scratch-gui/src/components/mobile-side-rail/` — 左サイドレール
- `packages/scratch-gui/src/components/mobile-drawer/` — ドロワー型ブロックパレット
- `packages/scratch-gui/src/components/mobile-sprite-panel/` — スプライトパネル
- `packages/scratch-gui/src/components/mobile-paint-toolbar-toggle/` — ペイントツールバー切替
- `packages/scratch-gui/src/components/mobile-orientation-gate/` — 縦持ち警告
- `packages/scratch-gui/src/components/narrow-screen-warning/` — 狭幅警告
- `packages/scratch-gui/src/components/palette-toggle/` — パレット表示切替

#### 切替・状態管理

- `packages/scratch-gui/src/lib/responsive-gui.jsx` — `<MobileGui>` / `<GUI>` 出し分け
- `packages/scratch-gui/src/lib/use-is-narrow-screen.js` — viewport 判定 hook
- `packages/scratch-gui/src/reducers/palette-visibility.js` — パレット表示 state

#### upstream ファイルへの埋め込み（Smalruby マーカー付き）

`narrow-desktop` (744〜1023px の iPad 調整) は upstream ファイルに直接マーカー付きで追加：

| 場所 | 効果 |
|---|---|
| `src/playground/index.css` | iPad portrait min-width relax (744〜1023px で `min-width: 1024px` を解除) |
| `src/components/gui/gui.css` | iPad portrait narrow desktop layout (`editor-wrapper` の `flex-basis` 緩和) |
| `src/components/gui/gui.css` | iPad portrait legal links cleanup (フィードバックリンク非表示) |
| `src/components/gui/gui.jsx` | iPad portrait narrow desktop stage size (`stageSize` を `'small'` に強制) |
| `src/components/gui/gui.css` | narrow-height vertical chrome compression (`max-height: 800px` で body-wrapper / tab-list 圧縮) |
| `src/components/menu-bar/menu-bar.css` | narrow-height menu bar compression (`max-height: 800px` で menu-bar 48→40px) |
| `src/playground/index.css` | narrow viewport vertical scroll lock (`overflow-y: clip`) |

詳細マーカー一覧: `docs/maintenance/smalruby-markers-gui.md`

### scratch-vm

なし（UI のみ）。

### infra

なし。

## 設定・データ永続化

- **localStorage**: パレット表示状態など（`palette-visibility` reducer）
- **URL パラメータ**: なし（viewport ベースで完全自動）

## 詳細ドキュメント

- **[`ui-ux.md`](ui-ux.md)** — 設計意図と全画面の説明（対外ドキュメント、screenshots 付き）
- **[`playwright.md`](playwright.md)** — Playwright での確認手順、viewport プリセット、data-testid 一覧、リグレッションチェックリスト
- **[`screenshots/`](screenshots/)** — 各画面・viewport のスクリーンショット集

## 開発時のレビュー観点

`gui.css` / `gui.jsx` / `menu-bar.css` / `playground/index.css` / `mobile-*` コンポーネント / `responsive-gui*` / `use-is-narrow-screen*` / `palette-toggle/` を変更した場合、または新しいモーダルやボタンを追加した場合は、**SP と iPad のリグレッション確認が必要**。

詳細は `.claude/rules/scratch-gui/mobile-ui.md` の「6. 開発・レビュー時のチェックリスト」を参照。

## 関連 Issue / PR

- Issue #572 — Phase 1〜3: モバイル基本対応、レイアウト調整、iPad 対応
- Issue #599 — iPad mini portrait (744px) 対応、narrow-desktop しきい値拡張
- Issue #600 — narrow-height (max-height: 800px) 圧縮対応
- Issue #602 — Ruby tab の column overflow 修正
