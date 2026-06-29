---
paths:
  - "packages/scratch-gui/src/components/mobile-*"
  - "packages/scratch-gui/src/components/mobile-*/**"
  - "packages/scratch-gui/src/components/palette-toggle/**"
  - "packages/scratch-gui/src/lib/responsive-gui*"
  - "packages/scratch-gui/src/lib/use-is-narrow-screen*"
  - "packages/scratch-gui/src/components/gui/gui.css"
  - "packages/scratch-gui/src/components/gui/gui.jsx"
  - "packages/scratch-gui/src/components/menu-bar/menu-bar.css"
  - "packages/scratch-gui/src/playground/index.css"
  - "docs/mobile-ui/**"
description: "SP (スマホ) / iPad 対応のレビュー観点・影響範囲・Playwright 確認手順。Mobile* コンポーネント、responsive-gui、useIsNarrowScreen、iPad 用 narrow-desktop CSS を触るときに参照。"
---

# SP / iPad Responsive Support

> **設計意図と全画面の説明は [`docs/mobile-ui/ui-ux.md`](../../../docs/mobile-ui/ui-ux.md) を参照。**
> **Playwright での確認手順と data-testid 一覧は [`docs/mobile-ui/playwright.md`](../../../docs/mobile-ui/playwright.md) に集約。**

このファイルは SP / iPad 対応に関する **開発・レビュー時のチェックリスト** をまとめたもの。`docs/mobile-ui/` は対外ドキュメント (設計意図 + 操作手順)、本ファイルはコードを書く側のルール。

---

## 1. 切替の前提 (必ず把握しておくこと)

`packages/scratch-gui/src/lib/use-is-narrow-screen.js` の matchMedia で MobileGui / desktop GUI を出し分ける:

```js
const NARROW_SCREEN_QUERY = '(max-width: 743px), (max-height: 500px)';
```

| viewport                  | 出るモード                            |
| ------------------------- | ------------------------------------- |
| iPhone 14 横 (844×390)    | MobileGui                             |
| iPhone 縦 (390×844)       | MobileGui + 縦持ちゲート              |
| iPad mini portrait (744×1133) | desktop GUI + iPad CSS 調整        |
| iPad portrait (768×1024)  | desktop GUI + iPad CSS 調整          |
| iPad landscape (1024×768) | desktop GUI + 高さ圧縮               |
| Desktop ≥ 1024 幅 / > 800 高さ | upstream desktop GUI そのまま     |

URL パラメータ `?mobile_gui=1` のような **オプトインフラグは設けない**。viewport で自動判定する方針を変えない。

---

## 2. レビュー観点 (PR を作る・レビューするとき)

「この変更で SP / iPad に影響あり得るか」を必ず一度チェックする。SP 関連 PR でなくても、以下のいずれかに該当するなら本セクションを通す。

### 2.1 触ったファイルから SP 影響を判定

下記のいずれかに該当するなら **SP / iPad リグレッションを確認** する:

- `src/components/gui/gui.jsx` または `gui.css` を変更した
- `src/components/menu-bar/menu-bar.css` を変更した (iPad landscape 用 `max-height: 800px` 圧縮あり)
- `src/playground/index.css` を変更した (`min-width: 1024px` 解除あり)
- `src/components/mobile-*/` を変更した
- `src/lib/responsive-gui.jsx` または `src/lib/use-is-narrow-screen.js` を変更した
- `src/components/palette-toggle/` を変更した (SP のパレットトグルは紫拡大版)
- 新しいモーダル / オーバーレイを追加した (SP では Portal 配置と z-index が崩れやすい)
- 新しいボタン / フォーム要素を追加した (`data-testid` と最低 44×44px のタッチ領域)
- upstream ファイルへ Smalruby マーカーを追加・変更した (#1024 や 800px の境界条件と干渉していないか)

### 2.2 設計原則 (SP 関連 PR で必ず守る)

[`docs/mobile-ui/ui-ux.md`](../../../docs/mobile-ui/ui-ux.md) §4 と整合:

1. **upstream は加筆だけ**: `=== Smalruby: Start of <feature> === / End ===` で囲む。一覧 `docs/maintenance/smalruby-markers-gui.md` を更新する。
2. **オプトインフラグ (`?mobile_gui=1` 等) を増やさない**: viewport 自動判定で完結させる。
3. **「PC 表示が崩れている」警告バナーを置かない**: リサイズ可能な PC ブラウザでの誤検知が多い。viewport 自動判定で MobileGui に切り替わるならバナー不要。
4. **MobileGui は横向き専用**: 縦は orientation gate で止める。MobileGui に縦レイアウトを抱え込まない。
5. **隠すより再構成**: `display: none` で誤魔化さず、Mobile* 専用コンポーネントに分離する。
6. **iPad は desktop GUI のまま CSS で詰める**: iPad ユーザーは PC 操作慣れがあるので独自 UI に変えない。
7. **タッチ要素は最低 44×44px** (フィッツの法則)。
8. **新規ボタン / フォームには `data-testid` を必ず付ける** (`<component>-<element>` ケバブケース)。

### 2.3 PR 説明・レビューコメントで触れるべき項目

- どの viewport プリセットで動作確認したか (`docs/mobile-ui/playwright.md` §2 のプリセット名で記述)
- iPad portrait / iPad landscape にも影響あるかどうか、ない場合はその根拠
- 上記 §2.2 の設計原則に違反していないか
- 新しい `data-testid` を追加した場合、`docs/mobile-ui/playwright.md` §3 の表に追記したか

---

## 3. Playwright での動作確認

**SP / iPad 関連の動作確認は必ず [`docs/mobile-ui/playwright.md`](../../../docs/mobile-ui/playwright.md) を最初に参照する。** viewport プリセット、data-testid 一覧、共通操作パターン、リグレッションチェックリストはすべてそちらに集約してある。重複を避けるためここでは要点のみ:

- viewport プリセット: iPhone 14 横 (844×390)、iPad portrait (768×1024)、iPad landscape (1024×768) を最低限カバー
- MobileGui への切替確認: `mobile-side-rail` testid の visibility
- iPad モードの切替確認: 768×1024 で `mobile-side-rail` が DOM に **存在しない**こと + upstream menu-bar が visible
- 縦持ちゲート: 390×844 で `mobile-orientation-gate` が出ること
- リグレッションチェックリストは `docs/mobile-ui/playwright.md` §8

dev server を起動 → `docs/mobile-ui/playwright.md` の操作パターンを使う、というフローを徹底する。XPath や title 属性で要素を指す書き方は避ける (data-testid で統一済み)。

---

## 4. 関連ファイル早見表

| 役割                                          | ファイル                                                   |
| --------------------------------------------- | ---------------------------------------------------------- |
| 切替判定 (matchMedia)                          | `src/lib/use-is-narrow-screen.js`                         |
| 切替ディスパッチャ                             | `src/lib/responsive-gui.jsx`                              |
| MobileGui 本体                                | `src/components/mobile-gui/`                              |
| サイドレール (☰ + ▶ + 5 タブ)                  | `src/components/mobile-side-rail/`                        |
| 旧上部バー (現在 MobileSideRail に統合)        | `src/components/mobile-top-bar/`                          |
| 旧ボトムタブ (現在 MobileSideRail に統合)      | `src/components/mobile-bottom-tabs/`                      |
| ハンバーガードロワー                           | `src/components/mobile-drawer/`                           |
| スプライトパネル overlay                       | `src/components/mobile-sprite-panel/`                     |
| 縦持ち警告オーバーレイ                         | `src/components/mobile-orientation-gate/`                 |
| コスチュームツールバートグル                   | `src/components/mobile-paint-toolbar-toggle/`             |
| パレットトグル (SP は紫拡大版)                 | `src/components/palette-toggle/`                          |
| iPad 用 narrow-desktop CSS                     | `src/components/gui/gui.css` (744〜1023px / max-height: 800px) |
| iPad 用 stage size 強制                        | `src/components/gui/gui.jsx` (Smalruby マーカー)           |
| iPad 用 menu-bar 圧縮                          | `src/components/menu-bar/menu-bar.css` (max-height: 800px) |
| 横スクロール抑止 + min-width 解除              | `src/playground/index.css`                                 |

upstream ファイル内のマーカーは `docs/maintenance/smalruby-markers-gui.md` を参照。

---

## 5. 関連ドキュメント

- [`docs/mobile-ui/ui-ux.md`](../../../docs/mobile-ui/ui-ux.md) — 設計意図 + 全画面の説明 (対外ドキュメント)
- [`docs/mobile-ui/playwright.md`](../../../docs/mobile-ui/playwright.md) — Playwright での確認手順と data-testid 一覧
- `docs/maintenance/smalruby-markers-gui.md` — upstream マーカー一覧
- `.claude/rules/scratch-gui/e2e-test.md` — data-testid 命名規則 (SP に限らない一般則)
- `.claude/rules/scratch-gui/development.md` — scratch-gui の基本コマンド
