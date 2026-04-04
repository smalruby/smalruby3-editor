# E2E Testing (Playwright MCP & Selenium Integration Tests)

## data-testid Convention

**Playwright MCP と Selenium integration tests の両方で `data-testid` 属性を使用する。**

- 新しいボタン・フォーム要素を追加する際は、必ず `data-testid` を設定する
- Integration tests では `data-testid` を優先的に使い、XPath や title 属性での要素指定を避ける
- `data-testid` を使うことで、属性の追加漏れを防ぎ、テストの安定性を高める

### Integration Tests での data-testid 使用パターン

```javascript
// ヘルパー関数（テストファイル内で定義）
const clickByTestId = (d, testId) =>
    d.executeScript(`document.querySelector('[data-testid="${testId}"]').click()`);

const isActiveByTestId = (d, testId) =>
    d.executeScript(
        `return document.querySelector('[data-testid="${testId}"]')` +
            `?.className?.includes('Active') ?? false`,
    );

// 使用例
await clickByTestId(driver, 'ruby-toolbar-mode-dncl');
expect(await isActiveByTestId(driver, 'ruby-toolbar-mode-dncl')).toBe(true);
```

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

### Classroom Modal (`classroom-modal.jsx`)

**フェーズ検出（各フェーズのルートに付与）:**

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-modal` | div | モーダル全体 |
| `classroom-phase-role-select` | div | 役割選択フェーズ |
| `classroom-phase-teacher-login` | div | 教師ログインフェーズ |
| `classroom-phase-teacher-dashboard` | div | 教師ダッシュボードフェーズ |
| `classroom-phase-teacher-create` | div | クラス作成フェーズ |
| `classroom-phase-teacher-detail` | div | クラス詳細フェーズ |
| `classroom-phase-student-join` | div | 生徒参加コード入力フェーズ |
| `classroom-phase-student-seat` | div | 席番号選択フェーズ |
| `classroom-phase-student-joined` | div | 参加完了フェーズ |

**操作ボタン:**

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-menu-button` | div | メニューバーのクラスボタン |
| `classroom-role-teacher` | button | 「先生」選択 |
| `classroom-role-student` | button | 「生徒」選択 |
| `classroom-google-login` | button | Google ログイン |
| `classroom-back` | button | 戻る |
| `classroom-create` | button | クラス作成（ダッシュボード） |
| `classroom-name-input` | input | クラス名入力 |
| `classroom-count-input` | input | 人数入力 |
| `classroom-create-submit` | button | クラス作成実行 |
| `classroom-join-code-input` | input | 参加コード入力 |
| `classroom-join-submit` | button | 参加コード送信 |
| `classroom-seat-{n}` | button | 席番号 n のボタン |
| `classroom-confirm-seat` | button | 席番号確定・参加 |
| `classroom-joined-close` | button | 参加完了後の閉じるボタン |

**値確認用（テキスト内容の検証）:**

| data-testid | 要素 | 値の内容 |
|------------|------|----------|
| `classroom-menu-label` | span | メニューバーのクラス表示テキスト |
| `classroom-menu-class-name` | span | 参加中のクラス名 |
| `classroom-menu-seat-number` | span | 参加中の席番号 |
| `classroom-list` | ul | クラス一覧 |
| `classroom-item-{id}` | li | クラス一覧の各項目 |
| `classroom-item-name-{id}` | span | クラス名 |
| `classroom-item-code-{id}` | span | 参加コード |
| `classroom-item-details-{id}` | button | 詳細ボタン |
| `classroom-detail-name` | div | クラス詳細のクラス名 |
| `classroom-detail-join-code` | div | クラス詳細の参加コード |
| `classroom-members-list` | ul | メンバー一覧 |
| `classroom-member-{memberId}` | li | メンバー項目 |
| `classroom-member-seat-{memberId}` | span | メンバーの席番号 |
| `classroom-member-name-{memberId}` | span | メンバーのニックネーム |
| `classroom-member-remove-{memberId}` | button | メンバー削除 |
| `classroom-members-empty` | li | メンバー空メッセージ |
| `classroom-seat-grid` | div | 席番号グリッド |
| `classroom-selected-seat` | div (hidden) | 選択中の席番号（値取得用） |
| `classroom-joined-success` | div | 参加成功メッセージ |
| `classroom-joined-details` | div | 参加詳細（クラス名 + 席番号） |
| `classroom-joined-class-name` | span | 参加したクラス名 |
| `classroom-joined-seat-number` | span | 参加した席番号 |
| `classroom-error` | div | エラーメッセージ |
| `classroom-loading` | div | ローディング表示 |
| `classroom-empty-message` | div | クラスなしメッセージ |

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
| `features` | カンマ区切り（例: `classroom`) | 隠し機能の有効化 |

### Feature Flags

`?features=xxx` で隠し機能を有効化できる。カンマ区切りで複数指定可能。

| Flag | 機能 |
|------|------|
| `classroom` | クラスルーム機能（メニューバーに「クラス」ボタン表示） |

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
