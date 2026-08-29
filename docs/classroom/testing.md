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
| `classroom-phase-teacher-detail` | 先生: 課題詳細 |
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
| `classroom-google-import` | button | Google Classroom からインポート |
| `classroom-avatar-button` | button | アカウントメニュー（タイトルバー右上・メール頭文字 + ▼） |
| `classroom-teacher-logout` | button | ログアウト（アカウントメニュー内） |

### 課題作成

| data-testid | 要素 | 説明 |
|------------|------|------|


### サイドバー (先生・常時表示、login 以外のフェーズで visible)

サイドバーはクラス管理モーダル左側に常時表示される（teacher-login 以外）。「クラス一覧 (ダッシュボード)」ではなく **サイドバー** に登録済みの課題がクラス（学級）ごとにリスト表示される。

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-sidebar-group-{className}` | div | クラス（学級）名でグルーピングされたヘッダ（例: 「6年A組」）|
| `classroom-sidebar-item-{classroomId}` | li | サイドバーの個別の課題項目。`data-classroom-id` 属性も持つ。クリックで `selectedClassroom` が更新され `teacher-class-detail` フェーズへ遷移。表示テキストは `assignmentName · 人数 · 参加コード(小文字)` |

### 課題詳細 (先生)

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-detail-name` | div | 課題が属するクラス（学級）名 |
| `classroom-detail-join-code` | div | 参加コード |
| `classroom-detail-expand-code` | button | コード拡大表示 |
| `classroom-members-grid` | div | 座席グリッド |
| `classroom-members-count` | span | メンバー数 |
| `classroom-delete-classroom` | button | 課題をアーカイブ（歴史的経緯で testid は delete のまま。soft-delete・復元可能） |
| `classroom-delete-confirm` | button | アーカイブ確認 |
| `classroom-delete-cancel` | button | アーカイブキャンセル |
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
| `classroom-joined-details` | div | 参加詳細（クラス（学級）名 + 出席番号） |
| `classroom-joined-class-name` | span | クラス（学級）名 |
| `classroom-joined-seat-number` | span | 出席番号（0埋め2桁） |
| `classroom-joined-assignment` | div | 課題名（課題名がある場合のみ） |
| `classroom-joined-close` | button | はじめる |

### 生徒: ステータス

| data-testid | 要素 | 説明 |
|------------|------|------|
| `classroom-status-class-name` | span | クラス（学級）名 |
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
| `classroom-class-import-gc` | button | クラス一覧の「Google Classroom からインポート」（Google ログイン時のみ） |
| `classroom-avatar-button` / `classroom-avatar-initials` / `classroom-avatar-email` | button/span | アカウントメニュー（右上・メール頭文字 + ▼。クリックでメール表示 + ログアウト） |
| `classroom-teacher-logout` | button | ログアウト（アカウントメニュー内。#1111 レビューでタイトルバー常時表示から移動） |
| `classroom-class-create-section` | input | 同時作成: セクション（オプション） |
| `classroom-class-settings-open-{groupId}` | button | クラスカードの「設定」（インライン編集を開く） |
| `classroom-class-settings-{groupId}` | form | クラス設定のインライン編集フォーム |
| `classroom-class-settings-name/year/section/count` | input | クラス設定の各フィールド |
| `classroom-class-settings-co-teacher-input` | input | 共同管理者メール入力（クラス単位） |
| `classroom-class-settings-add-co-teacher` | button | 共同管理者を追加 |
| `classroom-class-settings-remove-co-teacher-{email}` | button | 共同管理者を削除 |
| `classroom-class-settings-archive` | button | アーカイブ/もどす（アーカイブは 2 段階確認: 1 回目で確認表示、2 回目で実行） |
| `classroom-class-settings-archive-confirm-message` | p | アーカイブ確認メッセージ |
| `classroom-class-settings-archive-cancel` | button | アーカイブ確認のキャンセル |
| `classroom-class-settings-save` / `classroom-class-settings-cancel` | button | 保存 / キャンセル |
| `classroom-show-archived` | button | 「アーカイブ済みのクラス（{count}）」トグル（アーカイブ済みが 1 件以上のとき表示） |
| `classroom-archived-class-list` | ul | アーカイブ済みクラスのカード一覧 |
| `classroom-class-restore-{groupId}` | button | アーカイブ済みクラスカードの「元に戻す」 |
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
| `classroom-board-archived-section` | div | アーカイブ済み課題セクション（1 件以上のとき表示） |
| `classroom-board-archived-toggle` | button | 「アーカイブ済みの課題（{count}）」トグル |
| `classroom-board-archived-list` | ul | アーカイブ済み課題の行一覧 |
| `classroom-board-archived-row-{classroomId}` | li | アーカイブ済み課題行（保存期限を表示） |
| `classroom-board-restore-{classroomId}` | button | アーカイブ済み課題の「元に戻す」 |
| `classroom-board-expiry-{classroomId}` | span | 課題行の残り日数バッジ（保存期限 30 日以下で表示、7 日以下は警告色） |
| `classroom-board-download-class` | button | ボードの「全課題の提出物をダウンロード」（active + アーカイブ済みを 1 つの zip に） |
| `classroom-retention-banner` | div | 課題詳細の保存期限アラートバナー（30 日以下で表示） |
| `classroom-retention-banner-download` | button | バナー内の「全作品ダウンロード」 |
| `classroom-share-assignment` | button | 課題詳細の「この課題を共有」（みんなの課題フォームを開く） |
| `shared-form` | form | みんなの課題の共有フォーム |
| `shared-form-title` / `shared-form-summary` | input | タイトル / 短い説明 |
| `shared-form-level` | select | 学校種 |
| `shared-form-subject` | select | 教科（制御語彙。学校種=その他のときは `shared-form-subject-free` input） |
| `shared-form-grade-{n}` | checkbox | 対象学年 |
| `shared-form-tags` | input | タグ（カンマ区切り・最大5） |
| `shared-form-lesson-count` | input | 想定コマ数 |
| `shared-form-url` | input | 補足資料 URL（https のみ。ガイダンス=`shared-form-url-hint`、エラー=`shared-form-url-error`） |
| `shared-form-author-name` / `shared-form-author-affiliation` | input | 表示名 / 所属表記（localStorage 記憶） |
| `shared-form-consent` | checkbox | CC BY 4.0 同意（未チェックだと送信不可） |
| `shared-form-submit` / `shared-form-cancel` | button | 共有する / キャンセル |
| `shared-form-success` | p | 公開完了メッセージ（© 表示名 / CC BY 4.0） |
| `classroom-board-shared-catalog` | button | ボードの「みんなの課題からさがす」 |
| `shared-catalog` | div | みんなの課題カタログ（ボード内に展開） |
| `shared-catalog-close` | button | カタログを閉じる |
| `shared-catalog-tab-all` / `shared-catalog-tab-mine` | button | すべて / 自分の投稿 タブ |
| `shared-catalog-filter-level/subject/grade/tag` | select/input | 絞り込み（学校種・教科・学年・タグ） |
| `shared-catalog-filter-apply` | button | 絞り込み実行 |
| `shared-catalog-list` / `shared-catalog-item-{id}` / `shared-catalog-open-{id}` | ul/li/button | カード一覧（属性バッジ・投稿者・取り込み回数） |
| `shared-catalog-load-more` | button | 次ページ読み込み（cursor があるときのみ） |
| `shared-catalog-empty` | p | 空メッセージ |
| `shared-catalog-detail` | div | 詳細プレビュー |
| `shared-detail-close` | button | 一覧に戻る |
| `shared-detail-credit` | p | 「© 表示名（所属） / CC BY 4.0」クレジット行 |
| `shared-detail-starter` | p | スターター付きの説明 |
| `shared-detail-url` | button | 補足資料リンク（クリックで確認表示） |
| `shared-detail-url-confirm` / `shared-detail-url-open` / `shared-detail-url-cancel` | span/a/button | 外部ドメイン名付き確認 →「開く」（rel=noopener・新規タブ） |
| `shared-detail-import` | button | このクラスに取り込む（published のみ表示） |
| `shared-detail-report` | button | 通報フォームを開く（他人の投稿のみ） |
| `shared-report-form` / `shared-report-reason` / `shared-report-submit` | div/textarea/button | 通報理由（必須）と送信 |
| `shared-report-sent` | p | 通報完了メッセージ |
| `shared-detail-unlist` / `shared-detail-republish` | button | 自分の投稿の取り下げ / 再公開 |
| `shared-card-limited-badge` / `shared-card-recommended-badge` | span | カードの 限定公開 / 推薦 バッジ（#1110） |
| `shared-detail-recommended-note` | p | 自分の限定公開が推薦を受けたときの注記（#1110） |
| `shared-detail-broaden` | button | 「みんなの課題に公開する」（自分の限定公開のみ・#1110） |
| `shared-broaden-done` | p | 全体公開の完了メッセージ（#1110） |
| `shared-import-success` | p | 取り込み完了メッセージ（ボード上） |
| `classroom-share-suggestion-banner` / `classroom-share-suggestion-open` | div/button | 共有推奨バナーと「共有フォームを開く」CTA（#1106） |
| `classroom-board-share-suggested-{classroomId}` | span | ボード行の「共有おすすめ」マーク（#1106） |
| `classroom-breadcrumbs` | nav | パンくず（クラス一覧 > 課題一覧 > 課題詳細） |
| `classroom-breadcrumb-class-list` / `classroom-breadcrumb-assignments` | button | パンくずリンク |
| `classroom-board-create-name` / `classroom-board-create-submit` | input / button | インライン課題作成（課題名のみ） |
| `classroom-board-reuse` | button | 「課題を再利用」（作る の右隣） |
| `classroom-board-reuse-view` | div | 再利用ビュー（全課題を日付降順） |
| `classroom-board-reuse-filter` | select | 再利用ビューのクラスフィルタ |
| `classroom-board-reuse-copy-{classroomId}` | button | このクラスに複製 |
| `classroom-tab-description` | button | 課題詳細の「説明」タブ（デフォルトアクティブ） |
| `classroom-description-editor` | div | 説明タブの課題編集フォーム（埋め込み） |
| `classroom-description-preview` | div | 右ペインの生徒視点プレビュー |
| `classroom-description-preview-body` | div | プレビュー本文（テキスト+画像） |
| `classroom-description-preview-prev` / `-next` | button | プレビューのページ送り |
| `classroom-avatar-email` | span | アカウントメニュー内のユーザーメール（OIDC トークンに email がある場合のみ。旧 `classroom-teacher-email` は廃止） |
| `classroom-board-create-cancel` / `classroom-board-reuse-cancel` | button | インラインフォームのキャンセル |
| `classroom-google-course-imported-{courseId}` | span | GC コースの「インポート済み」バッジ |
| `classroom-breadcrumb-assignments` | button | パンくず「課題一覧」リンク |
| `classroom-ungrouped-list` | div | クラス未所属の課題のフォールバック一覧（develop 互換） |
| `classroom-ungrouped-open-{classroomId}` | button | 未所属課題をひらく |
| `classroom-phase-teacher-group-manage` | div | 組管理フェーズのルート |
| `classroom-sidebar-teachergroup-{groupId}` | li | サイドバーの組ヘッダー |

### 学期末評価（AI 評価支援）

| data-testid | 要素 | 説明 |
|------------|------|------|
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
| `classroom-seat-kick-request-{seatNumber}` | span | 先生の課題詳細の座席グリッドに表示する赤いバッジ「!」|
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

代表例: `tools/playwright-verify/mesh-v2-classroom-binding.mjs` は教師タブで devlogin → クラスと課題の同時作成 → 課題管理ボードの行をクリックして課題を選択、生徒タブで `?classcode=` 経由参加 という 2 タブのフローを自動で回し、Mesh v2 ドメインが課題の参加コードに揃うことを確認します。

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
