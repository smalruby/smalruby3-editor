# テスト

## data-testid 一覧

Playwright MCP および Selenium integration tests で使用する `data-testid` 属性の完全な一覧です。

### フェーズ検出

各フェーズのルート要素に付与されます。現在表示中のフェーズを判定するのに使います。

| data-testid | フェーズ |
|------------|---------|
| `classroom-modal` | モーダル全体 |
| `classroom-phase-role-select` | 役割選択 |
| `classroom-phase-teacher-login` | 先生: Google ログイン |
| `classroom-phase-teacher-dashboard` | 先生: ダッシュボード |
| `classroom-phase-teacher-create` | 先生: クラス作成 |
| `classroom-phase-teacher-detail` | 先生: クラス詳細 |
| `classroom-phase-teacher-google-courses` | 先生: GC コース一覧 |
| `classroom-phase-teacher-post-assignment` | 先生: 課題配信 |
| `classroom-phase-student-join` | 生徒: 参加コード入力 |
| `classroom-phase-student-seat` | 生徒: 席番号選択 |
| `classroom-phase-student-joined` | 生徒: 参加完了 |
| `classroom-phase-student-status` | 生徒: ステータス |
| `classroom-phase-submit-confirm` | 生徒: 提出確認 |

### 操作ボタン

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-menu-button` | div | メニューバーのクラスボタン |
| `classroom-role-teacher` | button | 「先生」選択 |
| `classroom-role-student` | button | 「生徒」選択 |
| `classroom-google-login` | button | Google ログイン |
| `classroom-back` | button | 戻る |
| `classroom-refresh` | button | 更新 (↻) |
| `classroom-create` | button | クラス作成 (ダッシュボード) |
| `classroom-google-import` | button | Google Classroom からインポート |
| `classroom-teacher-logout` | button | ログアウト |

### クラス作成

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-name-input` | input | クラス名入力 |
| `classroom-count-input` | input | 人数入力 |
| `classroom-create-submit` | button | 作成実行 |

### クラス一覧 (ダッシュボード)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-list` | ul | クラス一覧 |
| `classroom-empty-message` | div | クラスなしメッセージ |
| `classroom-item-{id}` | li | クラスカード |
| `classroom-item-name-{id}` | span | クラス名 |
| `classroom-item-code-{id}` | span | 参加コード |
| `classroom-item-details-{id}` | button | 詳細ボタン |

### クラス詳細 (先生)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-detail-name` | div | クラス名 |
| `classroom-detail-join-code` | div | 参加コード |
| `classroom-detail-expand-code` | button | コード拡大表示 |
| `classroom-members-grid` | div | 座席グリッド |
| `classroom-members-count` | span | メンバー数 |
| `classroom-delete-classroom` | button | クラス削除 |
| `classroom-delete-confirm` | button | 削除確認 |
| `classroom-delete-cancel` | button | 削除キャンセル |
| `classroom-download-all` | button | 全提出ダウンロード |

### メンバー詳細パネル (先生)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-member-detail` | div | 詳細パネル |
| `classroom-member-detail-name` | span | ニックネーム |
| `classroom-member-detail-seat` | span | 席番号 |
| `classroom-member-detail-seated` | span | 着席状態 |
| `classroom-member-detail-submitted` | span | 提出状態 |
| `classroom-member-detail-thumbnail` | img | サムネイル |
| `classroom-member-detail-image-index` | span | 画像インデックス |
| `classroom-member-detail-prev` | button | 前の画像 |
| `classroom-member-detail-next` | button | 次の画像 |
| `classroom-member-detail-open` | button | Smalruby で開く |
| `classroom-member-detail-return` | button | 返却 |
| `classroom-member-detail-comment` | textarea | コメント入力 |
| `classroom-member-remove` | button | メンバー削除 |

### コード表示

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-code-display-copy-link` | button | 招待リンクをコピー |
| `classroom-code-display-expand` | button | 全画面表示 |
| `classroom-code-display-shrink` | button | 全画面解除 |
| `classroom-code-display-close` | button | コード表示を閉じる |

### 生徒: 参加

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-join-code-input` | input | 参加コード入力 |
| `classroom-join-submit` | button | 参加コード送信 |

### 生徒: 席番号選択

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-seat-grid` | div | 席番号グリッド |
| `classroom-seat-{n}` | button | 席番号 n のボタン |
| `classroom-selected-seat` | div (hidden) | 選択中の席番号 |
| `classroom-confirm-seat` | button | 席番号確定・参加 |

### 生徒: 参加完了

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-joined-success` | div | 参加成功メッセージ |
| `classroom-joined-details` | div | 参加詳細 |
| `classroom-joined-class-name` | span | クラス名 |
| `classroom-joined-seat-number` | span | 席番号 |
| `classroom-joined-close` | button | 閉じる |

### 生徒: ステータス

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-status-class-name` | span | クラス名 |
| `classroom-status-seat-number` | span | 席番号 |
| `classroom-status-joined-at` | span | 参加日時 |
| `classroom-submit-status` | span | 提出状況 |
| `classroom-status-teacher-comment` | div | 先生のコメント |
| `classroom-student-refresh` | button | 更新 (↻) |
| `classroom-submit-button` | button | 提出/再提出 |
| `classroom-leave` | button | 退出 |
| `classroom-status-close` | button | 閉じる |

### 生徒: 提出確認

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-submit-preview` | img | サムネイルプレビュー |
| `classroom-submit-cancel` | button | キャンセル |
| `classroom-submit-confirm` | button | 提出する |

### 課題配信

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-post-assignment` | button | 課題配信ボタン (詳細画面) |
| `classroom-post-assignment-title` | input | タイトル |
| `classroom-post-assignment-description` | textarea | 説明 |
| `classroom-post-assignment-submit` | button | 配信実行 |
| `classroom-post-assignment-success` | div | 配信成功メッセージ |

### メニューバー

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-menu-label` | span | メニューバーのクラス表示テキスト |
| `classroom-menu-class-name` | span | 参加中のクラス名 |
| `classroom-menu-seat-number` | span | 参加中の席番号 |

### 汎用

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-loading` | div | ローディング表示 |
| `classroom-error` | div | エラーメッセージ |

---

## Playwright MCP でのテスト

### 基本的なテスト URL

```
http://localhost:8601?no_beforeunload=1&features=classroom
```

### data-testid を使ったテスト例

```javascript
// フェーズの確認
await page.getByTestId('classroom-phase-role-select').waitFor();

// ボタンクリック
await page.getByTestId('classroom-role-student').click();

// テキスト入力
await page.getByTestId('classroom-join-code-input').fill('ABC123');

// テキスト取得
const className = await page.getByTestId('classroom-status-class-name').textContent();

// 要素の存在確認
const hasError = await page.getByTestId('classroom-error').isVisible();
```

### 生徒参加フローのテスト例

```javascript
// 1. クラスモーダルを開く
await page.getByTestId('classroom-menu-button').click();

// 2. 生徒を選択
await page.getByTestId('classroom-role-student').click();
await page.getByTestId('classroom-phase-student-join').waitFor();

// 3. 参加コード入力
await page.getByTestId('classroom-join-code-input').fill('ABC123');
await page.getByTestId('classroom-join-submit').click();

// 4. 席番号選択
await page.getByTestId('classroom-phase-student-seat').waitFor();
await page.getByTestId('classroom-seat-5').click();
await page.getByTestId('classroom-confirm-seat').click();

// 5. 参加完了確認
await page.getByTestId('classroom-joined-success').waitFor();
await page.getByTestId('classroom-joined-close').click();
```

### 参加リンクからの自動参加テスト

```javascript
// classcode パラメータ付きで開く
await page.goto('http://localhost:8601?no_beforeunload=1&features=classroom&classcode=ABC123');

// 自動的に席番号選択画面に遷移
await page.getByTestId('classroom-phase-student-seat').waitFor();
```

---

## 結合テスト (Backend)

### 実行方法

```bash
# 基本実行 (認証不要テストのみ)
docker compose run --rm -w /app/infra/smalruby-classroom infra npm run test:integration

# 教師フロー含む全テスト
GOOGLE_ID_TOKEN=eyJ... docker compose run --rm -w /app/infra/smalruby-classroom infra npm run test:integration
```

### GOOGLE_ID_TOKEN の取得方法

1. ブラウザで Smalruby を開く (`?features=classroom`)
2. クラスモーダルを開き、先生としてログイン
3. 開発者ツールのコンソールで `window._classroomIdToken` を実行
4. 表示されたトークンをコピー

### テストカバレッジ

| カテゴリ | テスト数 | 認証 |
|---------|---------|------|
| 認証エラー (先生) | 3 | 不要 |
| Google Classroom 認証エラー | 3 | 不要 |
| 生徒フロー バリデーション | 5 | 不要 |
| セッション検証 | 2 | 不要 |
| 提出 認証エラー | 2 | 不要 |
| CORS | 2 | 不要 |
| 404 | 1 | 不要 |
| 教師フロー CRUD | 14 | GOOGLE_ID_TOKEN |
| **合計** | **32** | |

教師フロー CRUD では、クラス作成 → 生徒参加 → 提出 → 返却 → 退出 → 削除の E2E フローを検証します。

---

## Unit テスト (Frontend)

```bash
# Redux reducer テスト
docker compose run --rm app bash -c "cd packages/scratch-gui && npm exec jest test/unit/reducers/classroom-reducer.test.js"
```
