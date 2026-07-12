# テスト

## data-testid 一覧

Playwright MCP および Selenium integration tests で使用する `data-testid` 属性の完全な一覧です。

### フェーズ検出

各フェーズのルート要素に付与されます。現在表示中のフェーズを判定するのに使います。

| data-testid | フェーズ |
|------------|---------|
| `classroom-modal` | モーダル全体 |
| `classroom-phase-teacher-login` | 先生: ログイン (Google / Microsoft) |
| `classroom-phase-teacher-class-list` | 先生: クラス一覧（ログイン後の入口。v2 landing） |
| `classroom-phase-teacher-dashboard` | 先生: 課題ダッシュボード（クラス選択後） |
| `classroom-phase-teacher-create` | 先生: 課題作成 |
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

### 課題エディタ（課題コンテンツ）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-edit-assignment-content` | button | 課題を編集（詳細画面から課題エディタを開く） |
| `classroom-phase-teacher-assignment-edit` | div | 課題エディタフェーズのルート |
| `classroom-assignment-page-{n}` | div | ページ n（0-indexed）のカード |
| `classroom-assignment-page-text-{n}` | textarea | ページ n の本文（最大500文字） |
| `classroom-assignment-page-up-{n}` / `classroom-assignment-page-down-{n}` | button | ページの並べ替え |
| `classroom-assignment-page-remove-{n}` | button | ページ削除 |
| `classroom-assignment-page-image-attach-{n}` | button | 画像を追加（png/jpeg） |
| `classroom-assignment-page-image-{n}` | img | 画像プレビュー |
| `classroom-assignment-page-image-remove-{n}` | button | 画像を削除 |
| `classroom-assignment-add-page` | button | ページを追加（最大10） |
| `classroom-assignment-starter-status` | div | スターターの状態表示 |
| `classroom-assignment-starter-current` | button | 今開いているプロジェクトをスターターに設定 |
| `classroom-assignment-starter-file` | button | .sb3 ファイルをスターターに設定 |
| `classroom-assignment-starter-remove` | button | スターターを削除 |
| `classroom-assignment-save` | button | 課題を保存 |
| `classroom-assignment-cancel` | button | キャンセル（詳細画面へ戻る） |

### 課題パネル（生徒）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-phase-student-assignment` | div | 課題パネルフェーズのルート（join 直後に自動表示） |
| `classroom-assignment-joined-notice` | div | 「参加しました！」通知（join 直後のみ） |
| `classroom-assignment-view-page` | div | 現在の課題ページ |
| `classroom-assignment-view-text` | div | ページ本文 |
| `classroom-assignment-view-image` | img | ページ画像 |
| `classroom-assignment-prev-page` / `classroom-assignment-next-page` | button | ページ送り |
| `classroom-assignment-page-indicator` | span | ページ位置（`1 / 3`） |
| `classroom-assignment-reload-starter` | button | スタータープロジェクトを開く（編集中は confirm） |
| `classroom-assignment-close` | button | はじめる！（モーダルを閉じる） |
| `classroom-view-assignment-button` | button | ステータス画面の「課題を見る」（hasAssignment 時のみ） |

### 組（グループ）管理

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-group-manage` | button | サイドバーの「クラスの設定」（旧: 組の管理） |
| `classroom-sidebar-back-to-class-list` | button | サイドバーの「‹ クラス一覧」 |
| `classroom-class-create` | button | クラス一覧の「クラスを作る」（同時作成フォームを開く） |
| `classroom-class-create-name` | input | 同時作成: クラス名 |
| `classroom-class-create-year` | input | 同時作成: 年度 |
| `classroom-class-create-count` | input | 同時作成: 人数 |
| `classroom-class-create-assignment` | input | 同時作成: 最初の課題名 |
| `classroom-class-create-submit` | button | 同時作成: クラスと課題を作成 |
| `classroom-class-list` | ul | クラス一覧（カード） |
| `classroom-class-list-empty` | p | クラス一覧の空メッセージ |
| `classroom-class-card-{groupId}` | li | クラスカード |
| `classroom-class-open-{groupId}` | button | クラスカード本体（クリックでクラスをひらく） |
| `classroom-class-evaluate-{groupId}` | button | クラスカードの「評価」 |
| `classroom-board` | div | 課題管理ボード（クラス内のメイン領域） |
| `classroom-board-create` | button | ボードの「課題を作る」 |
| `classroom-board-empty` | p | ボードの空メッセージ |
| `classroom-board-section-{topic}` | div | トピックセクション（未設定は `-none`） |
| `classroom-board-row-{classroomId}` | li | 課題行 |
| `classroom-board-open-{classroomId}` | button | 課題行本体（クリックで課題詳細へ） |
| `classroom-board-topic-{classroomId}` | select | 課題行のトピック選択（その場編集） |
| `classroom-board-date-{classroomId}` | input | 課題行の日付（並び順キー・その場編集） |
| `classroom-topic-add-input` | input | 新しいトピック入力 |
| `classroom-topic-add` | button | トピックを追加 |
| `classroom-topic-chip-{topic}` | span | トピックチップ |
| `classroom-topic-rename-{topic}` | button | チップ名（クリックでリネーム開始） |
| `classroom-topic-rename-input-{topic}` | input | リネーム入力（Enter/blur で確定） |
| `classroom-topic-remove-{topic}` | button | トピック削除（課題側はトピックなしへ） |
| `classroom-phase-teacher-group-manage` | div | 組管理フェーズのルート |
| `classroom-group-create-name` / `classroom-group-create-year` | input | 新規組の名前 / 年度 |
| `classroom-group-create-submit` | button | 組をつくる |
| `classroom-group-list` | ul | 組一覧 |
| `classroom-group-row-{groupId}` | li | 組の行 |
| `classroom-group-name-{groupId}` | input | 組名（インライン編集、blur で保存） |
| `classroom-group-archive-{groupId}` | button | アーカイブ / もどす |
| `classroom-group-manage-back` | button | もどる |
| `classroom-sidebar-teachergroup-{groupId}` | li | サイドバーの組ヘッダー |
| `classroom-detail-group-select` | select | クラス詳細の組セレクタ |
| `classroom-duplicate` | button | クラス（授業）の複製 |

### 学期末評価（AI 評価支援）

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-group-evaluate-{groupId}` | button | 組管理画面の「評価」（評価画面を開く） |
| `classroom-phase-teacher-evaluation` | div | 評価フェーズのルート |
| `classroom-eval-lesson-{classroomId}` | input | 授業の選択チェックボックス |
| `classroom-eval-load` | button | 提出を読み込む（sb3 をブラウザ内で静的解析） |
| `classroom-eval-axis-name-{i}` / `classroom-eval-axis-desc-{i}` | input | 評価軸の名前 / 説明 |
| `classroom-eval-strictness` | select | 厳しさ（やや甘め/標準/やや厳しめ） |
| `classroom-eval-progress` | div | 進捗表示 |
| `classroom-eval-matrix` | table | 席 × 授業マトリクス |
| `classroom-eval-cell-{seat}-{classroomId}` | td | セル（未提出は ×、要確認はオレンジ） |
| `classroom-eval-grade-{seat}-{classroomId}` | select | 評価（S/A/B/C。手動変更は較正サンプルになる） |
| `classroom-eval-reason-{seat}-{classroomId}` | input | 根拠 |
| `classroom-eval-comment-{seat}-{classroomId}` | textarea | 生徒向けコメント |
| `classroom-eval-overall-{seat}` | td | 総合評価 |
| `classroom-eval-run-grade` | button | AI評価を実行 |
| `classroom-eval-run-comment` | button | コメント下書きを生成 |
| `classroom-eval-export` / `classroom-eval-export-audit` | button | 評価CSV / 検証用CSV |
| `classroom-eval-return-comments` | button | コメントを返却 |
| `classroom-eval-back` | button | もどる |

### メニューバー

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-menu-button` | div | クラスボタン（コンテナ） |
| `classroom-menu-label` | span | メニューバーのクラス表示テキスト全体（参加中は「クラス:出席番号NN」、未参加時は「クラス」）|
| `classroom-menu-seat-number` | span | 出席番号（0埋め2桁、参加中のみレンダリングされる） |

### 強制退室通知 / 退室リクエスト (Issue #692)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-kicked-banner` | div | 生徒の seat 画面に表示する「先生によって退室させられました」バナー |
| `classroom-kicked-banner-dismiss` | button | バナーの × |
| `kick-request-confirm-dialog` | div | 「使用中の席」をタップしたとき表示される退室依頼ダイアログ |
| `kick-request-reason-input` | textarea | 任意のひと言入力欄（200 字制限）|
| `kick-request-submit` | button | 依頼を送信 |
| `kick-request-cancel` | button | ダイアログを閉じる |
| `kick-request-error` | div | 依頼送信エラー表示 |
| `kick-request-pending-banner` | div | 「先生に依頼中です…」バナー（5 秒ごとに lookupClassroom を polling）|
| `kick-request-rejected-banner` | div | 「依頼は受理されませんでした」バナー (却下 / TTL 期限切れ検出時に pending と差し替え) |
| `kick-request-rejected-banner-dismiss` | button | × ボタン |
| `classroom-seat-kick-request-{seatNumber}` | span | 先生クラス詳細の座席グリッドに表示する赤いバッジ「!」|
| `classroom-member-kick-request-panel` | div | 先生メンバー詳細パネルに表示される依頼一覧 |
| `classroom-kick-request-row-{requestId}` | div | 1 リクエストの行 |
| `classroom-kick-request-approve-{requestId}` | button | 承認（kick + リクエスト削除）|
| `classroom-kick-request-reject-{requestId}` | button | 却下（リクエストのみ削除）|

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
