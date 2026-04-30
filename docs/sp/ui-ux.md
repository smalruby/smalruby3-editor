# Smalruby Mobile (横向き専用) UI/UX

> **対象**: スマホ (横向き、`viewport min(width, height) ≤ 767px or 高さ ≤ 500px`) で `?mobile_gui=1` を指定したときに有効になる **MobileGui** モード
> **元 issue**: [#572](https://github.com/smalruby/smalruby3-editor/issues/572)

PC 版とほぼ同じ機能を、横向きスマホ (例: iPhone 14 = 844×390) でも操作できる UI に再構成したものです。縦持ち時は警告オーバーレイが出て、横にしてもらいます。

---

## 全体構成

レイアウト:

```
┌───┬────────────────────────────────────────┐
│ ☰ │                                        │
│ ▶ │                                        │
│ ─ │                                        │
│Cd │      Editor area                       │
│Cm │      (full height = 100vh)             │
│Sn │                                        │
│Rb │                                        │
│Sp │                                        │
└───┴────────────────────────────────────────┘
```

- **左 56px**: `MobileSideRail` (☰ + ▶ + 5 タブ)
- **右側**: 各タブの編集エリア (viewport 縦 100% / 横 100vw - 56px)

---

## 各画面 (TBD: PR #591 マージ後に preview URL でスクリーンショット撮影)

スクリーンショット格納先: `docs/sp/screenshots/`

詳細はこのファイルの後続セクションに記載予定:

- `01-side-rail.png` — サイドレール
- `02-code-palette-open.png` — コードタブ (パレット展開)
- `03-code-palette-closed.png` — コードタブ (パレット折りたたみ)
- `04-code-fullscreen.png` — ▶ で全画面ステージ
- `05-costume-toolbar-shown.png` — コスチューム (ツールバー表示)
- `06-costume-toolbar-collapsed.png` — コスチューム (ツールバー折りたたみ)
- `07-sound.png` — 音
- `08-ruby.png` — ルビー
- `09-sprite-panel.png` — スプライトパネル
- `10-drawer.png` — ハンバーガー
- `11-portrait-gate.png` — 縦持ち警告

---

## 未対応 / 別 PR で対応する予定の機能

### バックパック (Backpack) 対応

現状: PR-2J までは upstream `<Backpack>` を `display: none` で完全に隠している (`mobile-gui.css` の `gui_backpack-container` 部分)。

**要件:**
- **コードタブ下部**: バックパック表示。ブロックのみを扱う
- **スプライトタブ下部**: バックパック表示。スプライトのみを扱う

**実装メモ:**
- upstream `<Backpack>` は両方を扱える単一コンポーネント。タブごとに項目をフィルタする必要がある (`itemTypes` prop または同等)
- タブごとに別位置に表示するため、upstream 1 箇所の `<Backpack>` を活かしつつ、Smalruby 側でラッパを 2 個作って各タブに portal で配置するか、CSS だけで「現在のタブに合わせて移動」させるか検討する
- 縦サイズに余裕は無いので折りたたみハンドル (mobile-paint-toolbar-toggle と同じパターン) を併用するのが現実的

**ステータス**: 未着手 — 別 PR で対応する。

### サウンドエディタの縦スクロール最適化

現状: コスチュームエディタは `position: absolute` のフロート上部ツールバー + ▲/▼ トグルで縦最低高さの問題を解消したが、サウンドエディタ (`<SoundEditor>`) は同等の対応をしていない。AudioContext の Playwright クラッシュもあるので動作確認しづらいが、実機 iOS Safari では同じく上部ツールバーで縦が苦しくなる可能性がある。

**ステータス**: 後続 PR で必要に応じて対応。

### iPad portrait (768x1024) の扱い

現状: `useIsNarrowScreen` の検出条件は「短辺 ≤ 767px or 縦 ≤ 500px」。タブレット (820x1180 など) は両方とも閾値超えなので desktop UI が出る。Phase 1 で確定済みの方針通り、iPad portrait は別 Phase で扱う。

**ステータス**: スコープ外。

---

## 関連 PR (Phase 2)

- PR #581 (PR-2A): MobileGui スケルトン
- PR #582 (PR-2B): ボトムタブ × 5 (PR-2J で削除)
- PR #584 (PR-2C): ステージ全画面プレビュー
- PR #585 (PR-2D): ブロックパレットの自動クローズ (PR-2J で削除)
- PR #586 (PR-2E): ハンバーガーメニュー
- PR #587 (PR-2F): スプライト管理パネル
- PR #588 (PR-2G): コードタブ編集レイアウト
- PR #589 (PR-2H): コスチューム/音タブ最適化 (Close — PR-2I/J で抜本対応)
- PR #590 (PR-2I): モバイル横固定 + 縦向き案内
- PR #591 (PR-2J): 左サイドレール集約
