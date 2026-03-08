# Reference: ScratchBlocks API Migration Guide

upstream が scratch-blocks のメジャーバージョンを上げた場合に参照する。
Smalruby のカスタムコード (`blocks.jsx` 等) にも同じ変更を適用すること。

## scratch-blocks v2.0.0 (spork) での変更

### JavaScript API

| Before | After |
|--------|-------|
| `ScratchBlocks.prompt` | `ScratchBlocks.dialog.setPrompt()` |
| `ScratchBlocks.statusButtonCallback` | `ScratchBlocks.StatusIndicatorLabel.statusButtonCallback` |
| `ScratchBlocks.Xml.textToDom` | `ScratchBlocks.utils.xml.textToDom` |
| `ScratchBlocks.Xml.clearWorkspaceAndLoadFromXml` | `ScratchBlocks.clearWorkspaceAndLoadFromXml` |
| `this.workspace.reportValue()` | `this.ScratchBlocks.reportValue()` |

### CSS クラス名

| Before | After |
|--------|-------|
| `.blocklyToolboxDiv` | `.blocklyToolbox` |

テストで CSS セレクタを使っている場合は更新が必要。

### DOM 構造

scratch-blocks v2 ではブロックカテゴリのクリックターゲットが変わる場合がある。

- テストで `clickText('カテゴリ名')` が失敗する場合は `clickBlocksCategory('カテゴリ名')` を使用
- `clickBlocksCategory` は `packages/scratch-gui/test/helpers/selenium-helper.js` で定義

### ESM モジュール (.mjs)

scratch-blocks v2 は `.mjs` ファイルで ESM モジュールを使用する場合がある。
デフォルトエクスポートがない場合は named import を使用:

```javascript
// Before (CJS)
const ScratchBlocks = require('scratch-blocks');

// After (ESM, if applicable)
import {ScratchBlocks} from 'scratch-blocks';
```

### blocks.jsx での主な影響箇所

`packages/scratch-gui/src/containers/blocks.jsx` で特に注意が必要な箇所:

1. **ScratchBlocks の初期化コード** — API 名が変わっている可能性
2. **toolbox 関連** — DOM クラス名変更の影響
3. **ワークスペース操作** — `Xml` 名前空間の移動
4. **ステータスボタン** — callback の設定方法の変更
5. **プロンプト/ダイアログ** — prompt の設定方法の変更

### lib/blocks.js での主な影響箇所

`packages/scratch-gui/src/lib/blocks.js` でも API 変更の影響を受ける:

1. **XML 操作** — `ScratchBlocks.Xml.*` → `ScratchBlocks.utils.xml.*` または直接メソッド
2. **ワークスペース操作** — `clearWorkspaceAndLoadFromXml` の移動
