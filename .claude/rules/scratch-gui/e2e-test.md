# E2E Testing with Playwright MCP

## data-testid Convention

Playwright MCP でのブラウザ操作には `data-testid` 属性を使用する。各コンポーネントのボタンやフォーム要素に `data-testid` を設定し、Playwright の `getByTestId()` で操作する。

### Naming Convention

`data-testid` は `<component>-<element>` の形式:
- Component prefix: コンポーネント名をケバブケース（例: `ruby-toolbar`）
- Element suffix: 要素の役割をケバブケース（例: `mode-dncl`）

### Ruby Toolbar (`ruby-toolbar.jsx`)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `ruby-toolbar-execute` | button | 実行/停止ボタン |
| `ruby-toolbar-undo` | button | 元に戻す |
| `ruby-toolbar-redo` | button | やり直す |
| `ruby-toolbar-search` | button | 検索 |
| `ruby-toolbar-auto-correct` | button | 自動置換トグル |
| `ruby-toolbar-rubytee` | button | ルビティー（AI） |
| `ruby-toolbar-mode-furigana` | button | ふりがなモード |
| `ruby-toolbar-mode-ruby` | button | Rubyモード |
| `ruby-toolbar-mode-dncl` | button | 日本語(DNCL)モード |
| `ruby-toolbar-more-menu` | button | その他メニュー |
| `ruby-toolbar-menu-download` | div | Rubyスクリプト保存 |
| `ruby-toolbar-menu-insert-class` | div | クラス挿入 |
| `ruby-toolbar-menu-preview` | div | プレビュー |
| `ruby-toolbar-menu-auto-correct-settings` | div | 自動置換設定 |

### Target Selector (`target-selector.jsx`)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `ruby-toolbar-prev-sprite` | button | 前のスプライト |
| `ruby-toolbar-next-sprite` | button | 次のスプライト |
| `ruby-toolbar-sprite-search` | input | スプライト検索 |

## Playwright MCP での操作例

```javascript
// data-testid でボタンをクリック
// Playwright MCP の browser_click で ref を使う代わりに、
// browser_evaluate で data-testid を使って操作する
await page.evaluate(() => {
    document.querySelector('[data-testid="ruby-toolbar-mode-dncl"]').click();
});

// または Playwright のロケーターを使う
await page.getByTestId('ruby-toolbar-mode-dncl').click();
```

## URL Parameters for Testing

Playwright MCP でテストする際は以下の URL パラメータを使用:

```
http://localhost:8601?no_beforeunload=1&tab=ruby&ruby_version=2&rubyMode=ruby
```

| Parameter | Values | Description |
|-----------|--------|-------------|
| `no_beforeunload` | `1` | beforeunload ダイアログを無効化（必須） |
| `tab` | `ruby` | Ruby タブを初期表示 |
| `ruby_version` | `2` | Ruby バージョン |
| `rubyMode` | `ruby`, `furigana`, `dncl` | Ruby タブの初期モード |

## Monaco Editor の操作

```javascript
// エディタの内容を設定
await page.evaluate(() => {
    monaco.editor.getEditors()[0].setValue('move(10)\n');
});

// エディタの内容を取得
const content = await page.evaluate(() => {
    return monaco.editor.getEditors()[0].getValue();
});

// エラーマーカーを取得
const markers = await page.evaluate(() => {
    const model = monaco.editor.getEditors()[0].getModel();
    return monaco.editor.getModelMarkers({ resource: model.uri }).map(m => ({
        line: m.startLineNumber,
        message: m.message,
        severity: m.severity
    }));
});

// エディタの言語を取得
const lang = await page.evaluate(() => {
    return monaco.editor.getEditors()[0].getModel().getLanguageId();
});
```
