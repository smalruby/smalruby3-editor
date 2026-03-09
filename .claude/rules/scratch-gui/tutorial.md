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

### 6. Update navigation

Update `deckIds` in the last step of related decks to include the new deck.

## Screenshot Capture Workflow

### Blocks Screenshots (via blocks-screenshot.js)

For screenshots of assembled blocks, use the "命令ブロックを画像として保存" button in the Code tab toolbar.

**Workflow with Playwright MCP:**

1. Navigate to `http://localhost:8601`
2. Open the Ruby tab
3. Enter Ruby code in the Monaco editor:
   ```javascript
   // Click on Monaco editor
   page.locator('.monaco-editor .view-lines').click()
   // Set code via Monaco API
   monaco.editor.getEditors()[0].setValue(`ruby code here`)
   ```
4. Switch to the Code tab to trigger Ruby → Blocks conversion
5. Click the screenshot download button (blocks.jsx toolbar)
6. The PNG is saved via the browser's download mechanism (`saveAs` dialog)

**Important notes:**
- Always start with a fresh page (reload) to avoid variable scope conflicts
- The `blocks-screenshot.js` `buildExportSVG` function copies `injectionDiv.className` to the exported SVG for correct theme styling (`.scratch-renderer.default-theme`)
- Without this, input field text (e.g., numbers, strings in blocks) appears white-on-white

### Viewport Screenshots

For screenshots of the editor UI (e.g., Ruby tab view), use Playwright's `browser_take_screenshot` with `clip` to capture specific regions:

```javascript
// Example: Ruby tab area
clip: { x: 0, y: 48, width: 986, height: 250 }
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

### Handling Common Issues

- **beforeunload dialog**: Accept dialogs that appear when navigating away
- **Monaco editor click**: Use `.monaco-editor .view-lines` selector (not the textarea directly, which may be intercepted by `blocklyMainBackground`)
- **Variable scope conflicts**: Reload the page before creating blocks with global variables (`$var`) if a same-named instance variable (`@var`) was already created in the session
- **HMR after code changes**: The dev server hot-reloads; wait for the rebuild before taking screenshots

### Debug Globals

```javascript
window.smalruby.vm        // Scratch VM instance
window.smalruby.blocks    // Current target's blocks
monaco.editor.getEditors()[0]  // Monaco editor instance
```

## Card CSS Notes

- `.card` has `max-width: 550px` to prevent overly wide cards
- `.step-title` uses `word-break: break-word; overflow-wrap: break-word;` for long titles
- `.step-image` has `max-width: 450px; max-height: 200px; object-fit: contain;`
- `.insert-code-button-overlay` positions the insert button over the step image
- Glow animations (`.right-button-glow`, `.insert-code-button-glow`) use `@keyframes glow-pulse-*`
