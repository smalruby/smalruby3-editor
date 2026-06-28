# E2E Testing (Playwright MCP & Selenium Integration Tests)

> **SP / iPad 対応の動作確認は最初に [`docs/mobile-ui/playwright.md`](../../../docs/mobile-ui/playwright.md) を参照する。** viewport プリセット、Mobile* 系コンポーネントの data-testid 一覧、共通操作パターン、リグレッションチェックリストがすべて集約してある。本ファイルは SP に限らない一般則 (data-testid 命名規則、Ruby Toolbar / Classroom Modal の testid、Monaco 操作) を扱う。レビュー観点や影響範囲は [`.claude/rules/scratch-gui/mobile-ui.md`](mobile-ui.md) を参照。

## 準備済み E2E / リグレッションスクリプトの置き場所: `tools/playwright-verify/`

複数タブ連動 (Mesh v2 ↔ クラス管理) など unit/integration で網羅しづらい挙動の **スタンドアロン Playwright スクリプト** は `tools/playwright-verify/` にある（CI 非組込・手動 `node <script>.mjs`、独自 browser を起動）。一覧と前提・実行方法は **`tools/playwright-verify/README.md`**。機能を変更したらまず該当スクリプトを探す:

- **mesh** リグレッション → `mesh-v2-classroom-binding.mjs` ほか（詳細は [`mesh.md`](mesh.md) の「準備済み E2E リグレッションスクリプト」）
- classroom → `smoke-teacher-dashboard.mjs` / `verify-co-teacher.mjs`
- Ruby 基礎 → `verify-ruby-basics-1.mjs` / iPad キーボード → `verify-issue-727-ipad-keyboard.mjs`

**コンテナ（devpod）は画面が無いので headless で実行**（`HEADLESS=false CHANNEL=chrome` はホスト側で目視するとき）。`xvfb-run` は使わない。Playwright MCP でホスト Chrome を直接操作する方法は memory `reference_host_playwright_mcp.md` 参照。

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
| `ruby-toolbar-keyboard` | button | ソフトウェアキーボード表示/非表示トグル（タッチデバイスのみレンダリング） |
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
| `classroom-phase-teacher-login` | div | 教師ログインフェーズ |
| `classroom-phase-teacher-dashboard` | div | 教師ダッシュボードフェーズ |
| `classroom-phase-teacher-create` | div | クラス作成フェーズ |
| `classroom-phase-teacher-detail` | div | クラス詳細フェーズ |
| `classroom-phase-student-join` | div | 生徒参加コード入力フェーズ |
| `classroom-phase-student-seat` | div | 席番号選択フェーズ |
| `classroom-phase-student-joined` | div | 参加完了フェーズ |
| `classroom-phase-student-status` | div | 生徒ステータスフェーズ |
| `classroom-phase-submit-confirm` | div | 提出確認フェーズ |

**操作ボタン:**

| data-testid | 要素 | 説明 |
|------------|------|------|
| `settings-menu` | div | 設定メニュー（⚙ アイコン） |
| `settings-classroom-management` | MenuItem | 設定 → クラス管理 |
| `classroom-menu-button` | div | メニューバーのクラスボタン |
| `classroom-google-login` | button | Google ログイン |
| `classroom-microsoft-login` | button | Microsoft ログイン |
| `classroom-back` | button | 戻る |
| `classroom-create` | button | クラス作成（ダッシュボード） |
| `classroom-name-input` | input | クラス名入力 |
| `classroom-count-input` | input | 人数入力 |
| `classroom-assignment-name-input` | input | 課題名入力 |
| `classroom-create-submit` | button | クラス作成実行（クラス名・人数・課題名 3 つすべて必須） |
| `classroom-sidebar-item-{classroomId}` | li | サイドバーのクラス項目（クリックで選択・teacher-class-detail へ） |

**先生フロー自動化のコツ**:
- `classroom-create-submit` 後は `teacher-class-detail` には**自動遷移しない**。`teacher-dashboard` に戻ってから `classroom-sidebar-item-{id}` を明示的にクリックする必要がある
- Google ログインを毎回手作業でやらない: `?devlogin=<DEV_BYPASS_TOKEN>` で stg/ローカル環境ではバイパスできる（`.env` の `DEV_BYPASS_TOKEN`、教師として自動ログイン）
| `classroom-join-code-input` | input | 参加コード入力 |
| `classroom-join-submit` | button | 参加コード送信 |
| `classroom-seat-{n}` | button | 席番号 n のボタン |
| `classroom-confirm-seat` | button | 席番号確定・参加 |
| `classroom-joined-close` | button | 参加完了後の閉じるボタン |

**値確認用（テキスト内容の検証）:**

| data-testid | 要素 | 値の内容 |
|------------|------|----------|
| `classroom-menu-label` | span | メニューバーのクラス表示テキスト全体（参加中は「クラス:出席番号NN」、未参加は「クラス」） |
| `classroom-menu-seat-number` | span | 出席番号（0埋め2桁、参加中のみレンダリング） |
| `classroom-kicked-banner` | div | 先生に kick されたときに seat 画面で表示される警告バナー (#692) |
| `classroom-kicked-banner-dismiss` | button | バナーの × |
| `kick-request-confirm-dialog` | div | 「使用中の席」をタップすると現れる退室依頼ダイアログ (#692) |
| `kick-request-reason-input` | textarea | ひと言入力欄 (任意、最大 200 字) |
| `kick-request-submit` | button | 依頼を送る |
| `kick-request-cancel` | button | キャンセル |
| `kick-request-error` | div | 依頼送信エラー表示 |
| `kick-request-pending-banner` | div | 依頼後に表示される「先生に依頼中です…」バナー |
| `classroom-seat-kick-request-{N}` | span | 先生クラス詳細の座席に表示される赤いバッジ |
| `classroom-member-kick-request-panel` | div | メンバー詳細パネル内の依頼セクション |
| `classroom-kick-request-row-{requestId}` | div | 1 依頼の行 |
| `classroom-kick-request-approve-{requestId}` | button | 承認 = kick + リクエスト削除 |
| `classroom-kick-request-reject-{requestId}` | button | 却下 = リクエストのみ削除 |
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
| `classroom-joined-details` | div | 参加詳細（クラス名 + 出席番号） |
| `classroom-joined-class-name` | span | 参加したクラス名 |
| `classroom-joined-seat-number` | span | 出席番号（0埋め2桁） |
| `classroom-joined-assignment` | div | 課題名 |
| `classroom-status-class-name` | span | ステータス: クラス名 |
| `classroom-status-seat-number` | span | ステータス: 出席番号（0埋め2桁） |
| `classroom-status-assignment` | span | ステータス: 課題名 |
| `classroom-status-joined-at` | span | ステータス: 参加日時 |
| `classroom-submit-status` | span | ステータス: 提出状況 |
| `classroom-status-teacher-comment` | div | 先生からのコメント |
| `classroom-error` | div | エラーメッセージ |
| `classroom-error-action` | button | エラーアクションリンク |
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

## スクリーンショット / 一時ファイルの保存先は `tmp/` 配下

`mcp__playwright__browser_take_screenshot` の `filename` パラメータ、および Playwright デバッグ中に生成する一時ファイル (console ログ、HAR、抽出した DOM など) は **必ずプロジェクトルートの `tmp/` 配下を指定する**。

- `.gitignore` で `/tmp/` が除外されており、検証用の一時ファイルを置くための公式の場所
- プロジェクトルート直下に保存するとリポジトリが汚れ、複数セッションを跨ぐと数十枚の `test-*.png` が散乱する
- `tmp/` ディレクトリは作成済み

```javascript
// ✅ 正しい
mcp__playwright__browser_take_screenshot({ filename: 'tmp/issue-634-after-fix.png' })

// ❌ ダメ — プロジェクトルートに保存される
mcp__playwright__browser_take_screenshot({ filename: 'issue-634-after-fix.png' })
```

`.playwright-mcp/` ディレクトリは Playwright MCP が自動生成するスナップショット (yml) や、`browser_take_screenshot` の **デフォルト保存先** として使われることがある別物。意図的に Read 用の固有ファイル名を残したいときは `tmp/` を使うこと。

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
| `features` | カンマ区切り | 隠し機能の有効化（現在は未使用） |

### ❌ `?tab=sounds` で直接アクセスしてはいけない（AudioContext autoplay policy）

**やらないこと**: Playwright や手動デバッグで `?tab=sounds` を URL に直接指定してロードする。

**理由**: `SharedAudioContext` は upstream の設計により、ユーザー gesture (mousedown/touchstart/keydown) が発生するまで `AudioContext` を作成しない。`?tab=sounds` で直接遷移すると最初の gesture 前に `SoundEditor` が render され、`AudioBufferPlayer.constructor` が `audioContext.createBuffer()` を呼ぶときに `AudioContext` が `undefined` で TypeError になる。

**過去にハマったパターン**:

- 「`?tab=sounds` 直接アクセスでクラッシュするから」と言って `SharedAudioContext` を gesture 前に lazy 作成するように改造すると、Chrome の autoplay policy で **新しく作られる `AudioContext` は `state: 'suspended'`** になる。
- `StartAudioContext` ライブラリは gesture 後に `resume()` を呼ぶが、`resume()` は **async**（数 ms〜数十 ms の遅延）なので、同じ click handler の中で即座に `source.start()` を呼ぶ sound block (例: 旗を押した直後の音再生) は **suspended state に当たって無音**。
- 結果: 「音タブで再生ボタンを押しても音が出ない」「旗を押した瞬間の音再生ブロックが無音」という不具合が再発する。
- 過去に少なくとも 2 回試され、毎回同じ原因で revert している（直近: PR #630 の commit `cc2a8dab7e` → `79dd6be827` で revert）。
- Playwright の Chromium は autoplay policy が緩く `state: 'running'` で見えるため、Playwright での検証は信用できない。実機 (本番 Chrome) で旗→音再生フローを必ず確認する必要がある。

**正しいやり方**:

| やりたいこと | 推奨手順 |
|---|---|
| 音タブの状態確認 | 通常ロード（`?tab=ruby` などまたはデフォルト = コードタブ）で開いてから、音タブの DOM (`li[role="tab"]` で「音」テキストを含む要素) を **クリック**で切り替える。これは user gesture なので AudioContext が正しく `state: 'running'` で作成される。 |
| 自動テストでの音タブ移動 | Selenium の `clickText('音')` / `clickText('Sounds')` を使う。`loadUri(uri + '?tab=sounds')` のような直接遷移は禁止。 |
| Playwright MCP でのスクリーンショット | `browser_navigate` で通常 URL を開いてから `browser_evaluate` で `tabs.find(t => t.textContent.includes('音')).click()` のように DOM クリックで切り替える。 |

**修正していいケース**:

`SharedAudioContext` の lazy 作成は **絶対にしない**。upstream の挙動を維持する。直接アクセス時のクラッシュを直したい場合は、`AudioContext` ではなく **`AudioBufferPlayer` 側を `audioContext` が `undefined` でも crash しない null-safe 実装にする**方向で検討する（が、その場合も実機での旗→音テストを必須）。

### クラスルーム機能

クラスルーム機能は `CLASSROOM_API_ENDPOINT` 環境変数が設定されていれば常に有効です（`?features=classroom` は不要）。

### ブロックパレットの文字化け回避

Playwright でルビータブ（またはコスチューム/音タブ）からコードタブに切り替えると、ブロックパレットの文字が乱れることがある。これはコードタブ非表示中に Blockly が SVG を再構築する際、`getBBox()` が `0` を返すためブロックパスの幅が最小値で固定されることが原因。

**回避策**: タブ切り替え後に `resize` イベントを発火してブロックを再描画させる:

```javascript
// コードタブに切り替えた後
await page.locator('[role="tab"]').first().click();
await page.waitForTimeout(500);
await page.evaluate(() => window.dispatchEvent(new Event('resize')));
await page.waitForTimeout(500);
```

この問題は通常のブラウザ操作では発生しない（Playwright 環境固有）。

## ❌ Playwright で Blockly / React のライブメソッドを monkey-patch しない

`browser_evaluate` で **稼働中の Blockly / React lifecycle メソッドを書き換えて、その内側の処理を再トリガーする** と、Playwright MCP が無応答になり、ユーザの interrupt がない限り抜けられなくなります。少なくとも 2 回踏みました（gesture 調査 と toolbox `forceRerender` + `flyout.show` wrap）。

### やってはいけないこと

| アンチパターン | なぜ詰むか |
|---|---|
| `flyout.show` / `toolbox.show` / `workspace.setVisible` などを wrap して同じ操作を内側で呼ぶ | wrapper → orig → React `componentDidUpdate` → 別の `forceRerender` → wrapper … と相互再帰しイベントループが詰まる |
| `pointerdown` を dispatch だけして対応する `pointerup` を出さない | Blockly の Gesture が global の `pointermove` / `pointerup` listener を `document` に張った「ドラッグ進行中」状態のまま固まり、後続のクリックや React 状態が破綻 |
| `forceRerender()` / `setSelectedItem()` / `inject()` 等の重い lifecycle 入口を eval から呼ぶ | それ自体は OK だが、wrapper や warning ハンドラがそこに絡むと相互再帰しがち |

### 守るルール

1. **Probe は read-only にする** — フィールド読み取り / 関数呼び出しの戻り値を取るだけ。書き込み・wrap はしない。
2. **静的解析を優先** — どこから API が呼ばれるかを知りたいなら、`curl http://localhost:8601/gui.js` した bundle を grep する方が安全で速い。Smalruby のソースなら `node_modules/scratch-blocks/src` を直接 grep。
3. **イベントペアを必ず対称に dispatch する** — `pointerdown` を出したら同じ eval 内で `pointerup` も。失敗時は `workspace.cancelCurrentGesture()` で必ずリセット。
4. **probe は bounded time にする** — `await new Promise(r => setTimeout(r, X))` の `X` は 1500ms 以下を上限とする。再帰やループは書かない。
5. **応答が遅いと感じたら早めに interrupt** — Playwright MCP transport は応答待ちで永遠に止まりうる。ユーザの Esc / 中断指示に頼らず、自分で別アプローチに切り替える判断を早めに行う。

### 推奨パターン

- runtime プロパティを覗きたい → `Object.keys(obj).filter(...)` / `Object.getOwnPropertyNames(proto)` で **読み取りのみ**。
- どの API が存在するかチェックしたい → `typeof obj.method` を返すだけ。
- ライブの workspace 状態をログしたい → 既存の **公開 listener フック点** (`workspace.addChangeListener`) を使う。`flyout.show` などの内部メソッドは触らない。
- イベント順序を観測したい → addChangeListener + 配列 push で十分。原関数は wrap しない。

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
