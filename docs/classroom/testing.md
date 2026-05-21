# テスト

## data-testid 一覧

Playwright MCP および Selenium integration tests で使用する `data-testid` 属性の完全な一覧です。

### フェーズ検出

各フェーズのルート要素に付与されます。現在表示中のフェーズを判定するのに使います。

| data-testid | フェーズ |
|------------|---------|
| `classroom-modal` | モーダル全体 |
| `classroom-phase-teacher-login` | 先生: ログイン (Google / Microsoft) |
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
| `settings-menu` | div | 設定メニュー（⚙ アイコン） |
| `settings-classroom-management` | MenuItem | 設定 → クラス管理 |
| `classroom-menu-button` | div | メニューバーのクラスボタン |
| `classroom-google-login` | button | Google ログイン |
| `classroom-microsoft-login` | button | Microsoft ログイン |
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
| `classroom-assignment-name-input` | input | 課題名入力 |
| `classroom-create-submit` | button | 作成実行（クラス名・人数・課題名の **3 つすべて必須**。1 つでも空だと disabled）|

**作成後の挙動**: `classroom-create-submit` を押すと API 呼び出し成功後 `phase` は `teacher-dashboard` に戻り、新しいクラスはサイドバー一覧 (`classroom-sidebar-item-{id}`) に追加される。`teacher-class-detail` には自動遷移せず、サイドバーの該当アイテムをクリックして明示的に選択する必要がある。

### サイドバー (先生・常時表示、login 以外のフェーズで visible)

サイドバーはクラス管理モーダル左側に常時表示される（teacher-login 以外）。「クラス一覧 (ダッシュボード)」ではなく **サイドバー** に登録済みクラスがリスト表示される。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-sidebar-group-{className}` | div | クラス名でグルーピングされたヘッダ（例: 「6年A組」）|
| `classroom-sidebar-item-{classroomId}` | li | サイドバーの個別クラス項目。`data-classroom-id` 属性も持つ。クリックで `selectedClassroom` が更新され `teacher-class-detail` フェーズへ遷移。表示テキストは `assignmentName · 人数 · 参加コード(小文字)` |

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
| `classroom-member-detail-seat` | span | 出席番号 |
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
| `classroom-joined-details` | div | 参加詳細（クラス名 + 出席番号） |
| `classroom-joined-class-name` | span | クラス名 |
| `classroom-joined-seat-number` | span | 出席番号（0埋め2桁） |
| `classroom-joined-assignment` | div | 課題名（課題名がある場合のみ） |
| `classroom-joined-close` | button | はじめる |

### 生徒: ステータス

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-status-class-name` | span | クラス名 |
| `classroom-status-seat-number` | span | 出席番号（0埋め2桁） |
| `classroom-status-assignment` | span | 課題名 |
| `classroom-status-joined-at` | span | 参加日時（秒なし） |
| `classroom-submit-status` | span | 提出状況 |
| `classroom-status-teacher-comment` | div | 先生からのコメント |
| `classroom-student-refresh` | button | 更新 (↻) |
| `classroom-submit-button` | button | 課題を提出する / 課題を再提出する |
| `classroom-leave` | button | 退出する |
| `classroom-error-action` | button | セッション切れ時のアクションリンク |

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
| `classroom-menu-button` | div | クラスボタン（コンテナ） |
| `classroom-menu-label` | span | メニューバーのクラス表示テキスト全体（参加中は「クラス:出席番号NN」、未参加時は「クラス」）|
| `classroom-menu-seat-number` | span | 出席番号（0埋め2桁、参加中のみレンダリングされる） |

### 汎用

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-loading` | div | ローディング表示 |
| `classroom-error` | div | エラーメッセージ |
| `classroom-error-action` | button | エラーアクションリンク |

---

## Playwright MCP でのテスト

### 基本的なテスト URL

```
http://localhost:8601?no_beforeunload=1
```

### devlogin でのテスト（stg 環境）

```
http://localhost:8601?no_beforeunload=1&devlogin=<DEV_BYPASS_TOKEN>
```

`devlogin=<DEV_BYPASS_TOKEN>` を指定すると、Google ログインをバイパスして `DEV_BYPASS_TOKEN` で先生としてログインできます（stg/ローカル環境のみ）。先生ダッシュボードへは「⚙ 設定 → クラス管理」からアクセスしてください。

### tools/playwright-verify/ の手動 E2E スクリプト

クラス管理を絡めた end-to-end の動作確認は [`tools/playwright-verify/`](../../tools/playwright-verify/README.md) にあるスクリプトで自動化されています（CI には組み込まれていません。手動で `node ...` で実行）。

代表例: `tools/playwright-verify/mesh-v2-classroom-binding.mjs` は教師タブで devlogin → クラス作成 → サイドバーで選択、生徒タブで `?classcode=` 経由参加 という 2 タブのフローを自動で回し、Mesh v2 ドメインがクラスの参加コードに揃うことを確認します。

スクリプトを書く際の落とし穴と対処は `tools/playwright-verify/README.md` を参照してください（ログインバイパスの方法、Redux store の取り出し方、サイドバー testid、tutorial overlay の dismiss 等）。

### data-testid を使ったテスト例

```javascript
// フェーズの確認
await page.getByTestId('classroom-phase-student-join').waitFor();

// ボタンクリック
await page.getByTestId('classroom-join-submit').click();

// テキスト入力
await page.getByTestId('classroom-join-code-input').fill('ABC123');

// テキスト取得
const className = await page.getByTestId('classroom-status-class-name').textContent();

// data-testid 経由の JavaScript クリック
await page.evaluate(() => {
    document.querySelector('[data-testid="classroom-menu-button"]').click();
});
```

---

## 結合テスト (infra)

### 実行方法

```bash
# 認証なしテスト（バリデーション、CORS等）
docker compose run --rm -w /app/infra/smalruby-classroom infra npm run test:integration

# 教師フロー含む全テスト（DEV_BYPASS_TOKEN を使用）
docker compose run --rm -w /app/infra/smalruby-classroom -e GOOGLE_ID_TOKEN=<DEV_BYPASS_TOKEN> infra npm run test:integration
```

`DEV_BYPASS_TOKEN` は `infra/smalruby-classroom/.env.stg` に記載されています。
