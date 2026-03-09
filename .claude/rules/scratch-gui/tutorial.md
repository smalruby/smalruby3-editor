---
paths:
  - "packages/scratch-gui/src/lib/libraries/decks/**"
  - "packages/scratch-gui/src/components/cards/**"
  - "packages/scratch-gui/src/lib/libraries/tutorial-tags*"
---

# Tutorial (How-To Cards) Development Guide

## Architecture Overview

Tutorials are defined as "decks" — each deck contains a series of "steps" displayed in a card UI overlay.

### Key Files

| File | Role |
|------|------|
| `packages/scratch-gui/src/lib/libraries/decks/index.jsx` | Deck definitions (steps, titles, images, code, navigation) |
| `packages/scratch-gui/src/lib/libraries/decks/ja-steps.js` | Japanese step image imports and mapping |
| `packages/scratch-gui/src/lib/libraries/decks/en-steps.js` | English step image imports (usually same as ja) |
| `packages/scratch-gui/src/lib/libraries/decks/translate-image.js` | Locale-to-image-set resolver |
| `packages/scratch-gui/src/lib/libraries/decks/steps/` | Step image files (PNG/GIF) |
| `packages/scratch-gui/src/lib/libraries/decks/thumbnails/` | Deck thumbnail images (JPG/PNG) |
| `packages/scratch-gui/src/components/cards/cards.jsx` | Card UI component |
| `packages/scratch-gui/src/components/cards/card.css` | Card styling |
| `packages/scratch-gui/src/locales/ja.js` | Japanese locale strings |
| `packages/scratch-gui/src/locales/ja-Hira.js` | Hiragana locale strings |
| `packages/scratch-gui/src/locales/en.js` | English locale strings |
| `packages/scratch-gui/src/lib/libraries/tutorial-tags.js` | Tutorial category definitions |

## Deck Definition Structure

Each deck in `index.jsx` has:

```jsx
'deck-id': {
    name: <FormattedMessage ... />,  // Deck title shown in library
    tags: ['mesh'],                   // Search/filter tags
    category: CATEGORIES.chatApp,     // Category for grouping
    img: libraryThumbnail,            // Thumbnail image import
    allowedBlocks: { ... },           // Blocks visible in toolbox during tutorial
    steps: [ ... ],                   // Array of step objects
    urlId: 'deckId'                   // URL parameter ID
}
```

### Step Types

1. **Content step** — title + image + optional code:
   ```jsx
   {
       title: <FormattedMessage ... />,
       image: 'imageKey',              // Key in ja-steps.js / en-steps.js
       code: `ruby code here`,         // Optional: Ruby code for "insert code" button
       codeType: 'blocks',             // Optional: 'blocks' converts code to blocks after insertion
       animationTarget: 'nextButton'   // or 'insertCodeButton' — glow animation hint
   }
   ```

2. **Navigation step** (last step) — links to next tutorials:
   ```jsx
   {
       deckIds: ['next-deck-1', 'next-deck-2']
   }
   ```

### animationTarget Values

- `'nextButton'` — Glow the right arrow (proceed to next step)
- `'insertCodeButton'` — Glow the "insert code" button (step has `code` property)

### code and codeType

- `code`: Ruby source code string. When present, the step shows an "insert code" button.
- `codeType: 'blocks'`: After inserting Ruby code, automatically switch to Code tab to show the resulting blocks.
- Without `codeType`, the code is just inserted into the Ruby editor.

### Green Flag Icon in Titles

Use the `GreenFlagIcon` component (defined at the top of `index.jsx`) for inline flag icons:

```jsx
<FormattedMessage
    defaultMessage="{greenFlag}を押して実行しよう！"
    id="gui.howtos.deck-id.stepN.title"
    values={{greenFlag: <GreenFlagIcon />}}
/>
```

The corresponding locale files use `{greenFlag}` as a placeholder (it is replaced at render time by the component).

## Three-Part Tutorial Series (Lv1 / Lv2 / Lv3)

チュートリアルは同じゴールを3段階の難易度で構成する。レベルごとに学び方が異なり、理解の深さが増す設計。

| Level | 目的 | 操作方法 |
|-------|------|---------|
| **Lv1** | 動くものを体験 | コードを「コード挿入」ボタンで貼り付け、少しだけ変更 |
| **Lv2** | ブロックの構造を理解 | ブロックを自分で1つずつ組み立てる |
| **Lv3** | Ruby で同じプログラムを作る | Ruby コードを入力・編集する |

### 典型的なステップ構成

**Lv2（ブロック版）の例** — 8ステップ:

1. イントロ（Lv1 の intro GIF を流用）
2. 最初のブロック群を組み立てる（ブロック画像）
3. 次のブロック群を追加（ブロック画像）
4. 受信側のブロック群を組み立てる（ブロック画像）
5. スプライト追加（Lv1 の GIF を流用）
6. 位置調整（Lv1 の GIF を流用）
7. 2つ目のスプライトのブロック完成（ブロック画像）
8. 実行 → 次のチュートリアルへのナビゲーション（`deckIds`）

**Lv3（Ruby 版）の例** — 8ステップ:

1. イントロ（Lv1 の intro GIF を流用）
2. ルビータブに切り替え（Ruby タブのスクリーンショット）
3. 「Rubyコードを挿入」でベースコード入力（`code` + `animationTarget: 'insertCodeButton'`）
4. コードの一部を変更（変更行をハイライトしたエディタスクリーンショット）
5. スプライト追加（Lv1 の GIF を流用）
6. 位置調整（Lv1 の GIF を流用）
7. 2つ目のスプライトのコード入力（`code` + `codeType: 'blocks'`）
8. 実行 → 次のチュートリアルへのナビゲーション（`deckIds`）

### 画像の流用ルール

同じシリーズ内（例: chat-2-sprites-1/2/3）で共通の操作は Lv1 のステップ画像をそのまま再利用する:

- **イントロ GIF** — Lv1 の step 1 画像を Lv2/Lv3 の step 1 で使用
- **スプライト追加・位置調整 GIF** — Lv1 のアニメーション GIF をそのまま流用
- **実行ステップ** — Lv1 のイントロ GIF を流用（最終結果を見せる）

`ja-steps.js` / `en-steps.js` では流用元の画像を import 済みなので、`index.jsx` で同じキー名を参照すればよい。新規 import は不要。

## Adding a New Tutorial

### 1. Define the deck in `index.jsx`

Add a new deck entry following existing patterns. Use `FormattedMessage` for all user-visible strings with unique `id` values following the convention: `gui.howtos.<deck-id>.stepN.title`.

### 2. Add locale strings

Add matching entries to all three locale files (`en.js`, `ja.js`, `ja-Hira.js`). The key is the `id` from `FormattedMessage`, the value is the `defaultMessage` text (or translation).

### 3. Create step images

Place image files in `packages/scratch-gui/src/lib/libraries/decks/steps/` with naming convention: `<deckId>-<stepNumber>-<description>.<ext>`.

### 4. Register images in step files

Add imports and mappings in both `ja-steps.js` and `en-steps.js`.

### 5. Create thumbnail

Place in `packages/scratch-gui/src/lib/libraries/decks/thumbnails/`. Import in `index.jsx`.

Lv2/Lv3 サムネイルは Lv1 のサムネイルをベースに ImageMagick でラベルを合成する（→「Thumbnail Creation」セクション参照）。

### 6. Update navigation

Update `deckIds` in the last step of related decks to include the new deck. Lv1 の最終ステップにも Lv2 への導線を追加すること。

## Screenshot Capture Workflow

### Blocks Screenshots (via blocks-screenshot.js)

For screenshots of assembled blocks, use the "命令ブロックを画像として保存" button in the Code tab toolbar.

**Workflow with Playwright MCP:**

1. Navigate to `http://localhost:8601`（ページを毎回リロードして変数スコープの衝突を回避）
2. Ruby タブを開く
3. Monaco editor に Ruby コードを設定:
   ```javascript
   monaco.editor.getEditors()[0].setValue(`ruby code here`)
   ```
4. Code タブに切り替え → Ruby → Blocks 変換が実行される
5. 「命令ブロックを画像として保存」ボタンをクリック
6. PNG が `.playwright-mcp/スモウルビーのプロジェクト-スプライト1.png` にダウンロードされる
7. ダウンロードファイルを `steps/` ディレクトリにコピー:
   ```bash
   cp .playwright-mcp/スモウルビーのプロジェクト-スプライト1.png \
      packages/scratch-gui/src/lib/libraries/decks/steps/<target-name>.png
   ```

**Important notes:**
- Always start with a fresh page (reload) to avoid variable scope conflicts
- The `blocks-screenshot.js` `buildExportSVG` function copies `injectionDiv.className` to the exported SVG for correct theme styling (`.scratch-renderer.default-theme`)
- Without this, input field text (e.g., numbers, strings in blocks) appears white-on-white
- ダウンロードファイル名は固定（`スモウルビーのプロジェクト-スプライト1.png`）。複数キャプチャする場合は1枚ごとにコピーすること

### Ruby Editor Screenshots

Ruby タブのエディタ画面をスクリーンショットする場合は、Playwright の要素スクリーンショットを使う:

```javascript
// Ruby タブパネル全体を要素スクリーンショット
browser_take_screenshot({ element: 'ルビー tabpanel', ref: '<tabpanel ref>' })
```

**変更箇所のハイライト表示:**

Lv3 チュートリアルの「ここを変えよう」ステップでは、Monaco のデコレーション API で変更行を強調する:

```javascript
// 変更行（例: 9行目）を黄色ハイライト
const editor = monaco.editor.getEditors()[0];
editor.deltaDecorations([], [{
  range: new monaco.Range(9, 1, 9, 100),
  options: {
    isWholeLine: true,
    className: 'myHighlight'
  }
}]);

// ハイライト用 CSS を追加
const style = document.createElement('style');
style.textContent = `
  .myHighlight {
    background-color: rgba(255, 255, 0, 0.3) !important;
    border: 2px solid rgba(255, 165, 0, 0.8) !important;
    border-radius: 3px;
  }
`;
document.head.appendChild(style);
```

### Animated GIFs

For animated step images showing interaction sequences, record separately and place as `.gif` files.

## Thumbnail Creation

Thumbnails are 200x100px displayed in the tutorial library (scaled from larger source images).

### Using ImageMagick for Level Labels

For tutorial series with difficulty levels (Lv2, Lv3, etc.), create labeled thumbnails from the Lv1 base image. The label is a 180x70 rounded rectangle composited at the center of the image.

```bash
# Lv2 — Blue label, centered
convert base-lv1.jpg \
  \( -size 180x70 xc:none \
     -fill 'rgba(33, 150, 243, 0.85)' \
     -draw 'roundrectangle 0,0 179,69 15,15' \
     -fill white -font Helvetica-Bold -pointsize 52 \
     -gravity center -annotate 0 'Lv2' \
  \) -gravity center -composite \
  output-lv2.jpg

# Lv3 — Purple label, centered
convert base-lv1.jpg \
  \( -size 180x70 xc:none \
     -fill 'rgba(156, 39, 176, 0.85)' \
     -draw 'roundrectangle 0,0 179,69 15,15' \
     -fill white -font Helvetica-Bold -pointsize 52 \
     -gravity center -annotate 0 'Lv3' \
  \) -gravity center -composite \
  output-lv3.jpg
```

Color scheme for levels:
- **Lv2**: Blue `rgba(33, 150, 243, 0.85)`
- **Lv3**: Purple `rgba(156, 39, 176, 0.85)`

## Playwright Tips for Tutorial Work

### Playwright MCP のダウンロードディレクトリ

Playwright MCP でファイルがダウンロードされると、プロジェクトルート直下の **`.playwright-mcp/`** ディレクトリに保存される:

```
/Users/kouji/work/smalruby/smalruby3-editor/.playwright-mcp/
```

- 「命令ブロックを画像として保存」ボタンでダウンロードした PNG → `.playwright-mcp/スモウルビーのプロジェクト-スプライト1.png`
- `browser_take_screenshot` の `filename` パラメータはこれとは別で、プロジェクトルート相対のパスに保存される
- `.playwright-mcp/` は `.gitignore` に含まれるため、Git にはコミットされない

### Handling Common Issues

- **beforeunload dialog**: コード変更後にページ遷移すると beforeunload ダイアログが出る。`browser_handle_dialog({ accept: true })` で受理してからリロードする。2回連続で出ることがあるので注意
- **Monaco editor**: `monaco.editor.getEditors()[0].setValue(code)` で直接コードを設定するのが最も確実。クリック操作でのテキスト入力は日本語 IME の問題が起きやすい
- **Variable scope conflicts**: ページをリロードしてからブロック作成すること。同名のグローバル変数（`$var`）とインスタンス変数（`@var`）が混在するとスコープが衝突する
- **HMR reload**: ステップ画像ファイルの追加・変更で webpack の HMR が走る。`[HMR] Cannot apply update. Need to do a full reload!` が出たら自動リロードされるので待つ
- **スクリーンショットの保存先**: Playwright の `filename` パラメータで指定したパスはプロジェクトルート相対。`.playwright-mcp/` 配下のダウンロードファイルとは別

### 効率的なキャプチャの手順

1. ページリロード → beforeunload ダイアログを accept
2. Ruby タブを開く
3. `monaco.editor.getEditors()[0].setValue(code)` でコード設定
4. 必要に応じてデコレーション追加（ハイライト等）
5. スクリーンショット取得（要素指定 or ダウンロードボタン）
6. ファイルを `steps/` にコピー
7. 次のスクリーンショットへ（2 に戻る。リロードが必要な場合は 1 から）

### Debug Globals

```javascript
window.smalruby.vm        // Scratch VM instance
window.smalruby.blocks    // Current target's blocks
monaco.editor.getEditors()[0]  // Monaco editor instance
```

## Card CSS Notes

- `.card` has `max-width: 500px` to prevent overly wide cards
- `.step-title` uses `word-break: break-word; overflow-wrap: break-word;` for long titles
- `.step-image` has `max-width: 480px; max-height: 360px; object-fit: contain;`
- `.insert-code-button-overlay` positions the insert button over the step image
- Glow animations (`.right-button-glow`, `.insert-code-button-glow`) use `@keyframes glow-pulse-*`
